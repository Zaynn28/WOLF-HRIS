import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { calculateOvertimePay } from '../lib/payrollEngine';
import { Clock, CheckCircle, AlertCircle, AlertTriangle, FileText } from 'lucide-react';
import Modal from '../components/Modal';

const formatCurrency = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

const localDate = (date: Date) => {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

export default function OvertimePage() {
  const {
    overtimeRequests, setOvertimeRequests, employees: allEmployees, payrollRecords, payPolicy, addToast, addAuditLog, addNotification,
  } = useApp();
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [newOT, setNewOT] = useState({ employeeId: '', date: '', startTime: '', endTime: '', reason: '', writtenOrder: false, employeeConsent: false });

  const getEmp = (id: string) => allEmployees.find(e => e.id === id);

  const statusColor = (status: string) => {
    switch(status) {
      case 'PENDING': return 'bg-amber-100 text-amber-700';
      case 'APPROVED': return 'bg-emerald-100 text-emerald-700';
      case 'REJECTED': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const statusIcon = (status: string) => {
    switch(status) {
      case 'PENDING': return <AlertCircle size={14} className="text-amber-500" />;
      case 'APPROVED': return <CheckCircle size={14} className="text-emerald-500" />;
      case 'REJECTED': return <Clock size={14} className="text-red-500" />;
      default: return null;
    }
  };

  const wageFor = (employeeId: string) => {
    const record = payrollRecords.find(row => row.employeeId === employeeId);
    return (record?.basicSalary || 0) + (record?.allowance || 0);
  };

  const handleApprove = (id: string) => {
    setOvertimeRequests(prev => prev.map(o => o.id === id ? { ...o, status: 'APPROVED' as const, approvedAt: new Date().toISOString() } : o));
    const ot = overtimeRequests.find(o => o.id === id);
    const emp = getEmp(ot?.employeeId || '');
    addAuditLog('APPROVE', 'OvertimeRequest', id, `Overtime approved for ${emp?.fullName}`);
    addToast(`Overtime approved for ${emp?.fullName}`, 'success');
  };

  const handleReject = (id: string) => {
    setOvertimeRequests(prev => prev.map(o => o.id === id ? { ...o, status: 'REJECTED' as const } : o));
    const ot = overtimeRequests.find(o => o.id === id);
    const emp = getEmp(ot?.employeeId || '');
    addAuditLog('REJECT', 'OvertimeRequest', id, `Overtime rejected for ${emp?.fullName}`);
    addToast(`Overtime rejected for ${emp?.fullName}`, 'warning');
  };

  const handleSubmitOT = () => {
    if (!newOT.employeeId || !newOT.date || !newOT.startTime || !newOT.endTime) {
      addToast('Please fill in all required fields', 'error');
      return;
    }

    if (!newOT.writtenOrder || !newOT.employeeConsent) {
      addToast('Overtime requires a written order and employee consent.', 'error');
      return;
    }

    const [sh, sm] = newOT.startTime.split(':').map(Number);
    const [eh, em] = newOT.endTime.split(':').map(Number);
    let totalMinutes = (eh * 60 + em) - (sh * 60 + sm);
    if (totalMinutes <= 0) totalMinutes += 24 * 60;
    const totalHours = totalMinutes / 60;

    if (totalHours > 4) {
      addToast('Overtime cannot exceed 4 hours in one day.', 'error');
      return;
    }

    const anchor = new Date(`${newOT.date}T00:00:00`);
    const weekStart = new Date(anchor);
    weekStart.setDate(anchor.getDate() - anchor.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const startKey = localDate(weekStart);
    const endKey = localDate(weekEnd);
    const weeklyOT = overtimeRequests.filter(request => {
      return request.employeeId === newOT.employeeId
        && request.status !== 'REJECTED'
        && request.date >= startKey
        && request.date <= endKey;
    }).reduce((sum, request) => sum + request.totalMinutes, 0);
    if (weeklyOT + totalMinutes > 18 * 60) {
      addToast('Overtime cannot exceed 18 hours in one week for this employee.', 'error');
      return;
    }

    const request = {
      id: 'ot' + Date.now(),
      employeeId: newOT.employeeId,
      date: newOT.date,
      startTime: newOT.startTime,
      endTime: newOT.endTime,
      totalMinutes,
      reason: newOT.reason,
      status: 'PENDING' as const,
      requestedBy: newOT.employeeId,
      writtenOrder: newOT.writtenOrder,
      employeeConsent: newOT.employeeConsent,
    };
    setOvertimeRequests(prev => [...prev, request]);
    const emp = getEmp(newOT.employeeId);
    addAuditLog('CREATE', 'OvertimeRequest', request.id, `${emp?.fullName} overtime request created`);
    addNotification('PENDING_APPROVAL', 'New Overtime Request', `${emp?.fullName} has an overtime request for ${newOT.date}`);
    addToast(`Overtime request submitted for ${emp?.fullName}`, 'success');
    setShowRequestModal(false);
    setNewOT({ employeeId: '', date: '', startTime: '', endTime: '', reason: '', writtenOrder: false, employeeConsent: false });
  };

  const totalApprovedMinutes = overtimeRequests.filter(o => o.status === 'APPROVED').reduce((sum, o) => sum + o.totalMinutes, 0);
  const totalPendingMinutes = overtimeRequests.filter(o => o.status === 'PENDING').reduce((sum, o) => sum + o.totalMinutes, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Overtime Management</h1>
          <p className="text-slate-500 text-sm mt-1">Overtime tracking with PP 35/2021 compliance (1.5×/2× rates, max 4h/day, 18h/week)</p>
        </div>
        <button onClick={() => setShowRequestModal(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium">
          <Clock size={16} /> New Request
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4"><p className="text-sm text-slate-500">Total Requests</p><p className="text-2xl font-bold text-slate-800">{overtimeRequests.length}</p></div>
        <div className="bg-white rounded-xl border border-slate-200 p-4"><p className="text-sm text-slate-500">Approved Hours</p><p className="text-2xl font-bold text-emerald-600">{(totalApprovedMinutes / 60).toFixed(1)}h</p></div>
        <div className="bg-white rounded-xl border border-slate-200 p-4"><p className="text-sm text-slate-500">Pending Hours</p><p className="text-2xl font-bold text-amber-600">{(totalPendingMinutes / 60).toFixed(1)}h</p></div>
      </div>

      {/* Compliance banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <FileText size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-blue-800">PP 35/2021 Overtime Rules</p>
          <p className="text-sm text-blue-700 mt-1">• Max 4 hours per day, 18 hours per week</p>
          <p className="text-sm text-blue-700 mt-1">• Work day: 1st hour 1.5×, subsequent 2×</p>
          <p className="text-sm text-blue-700 mt-1">• Holiday: 1st-7th hour 2×, 8th hour 3×, 9th+ 4×</p>
          <p className="text-sm text-blue-700 mt-1">• Written order + employee consent required</p>
        </div>
      </div>

      <div className="space-y-3">
        {overtimeRequests.map(ot => {
          const emp = getEmp(ot.employeeId);
          return (
            <div key={ot.id} className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center text-sm font-bold text-purple-600">{emp?.fullName.charAt(0)}</div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-800">{emp?.fullName}</p>
                      <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded font-medium ${statusColor(ot.status)}`}>{statusIcon(ot.status)}{ot.status}</span>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">{ot.date} • {ot.startTime} - {ot.endTime} • {ot.totalMinutes} minutes ({(ot.totalMinutes / 60).toFixed(1)}h)</p>
                    <p className="text-sm text-slate-600 mt-1">Reason: {ot.reason}</p>
                    <div className="flex items-center gap-2 mt-2 text-xs">
                      {ot.writtenOrder ? <span className="flex items-center gap-1 text-emerald-600"><CheckCircle size={12} className="text-emerald-600" /> Written Order</span> : <span className="flex items-center gap-1 text-red-600"><AlertCircle size={12} className="text-red-600" /> No Written Order</span>}
                      {ot.employeeConsent ? <span className="flex items-center gap-1 text-emerald-600"><CheckCircle size={12} className="text-emerald-600" /> Employee Consent</span> : <span className="flex items-center gap-1 text-red-600"><AlertCircle size={12} className="text-red-600" /> No Consent</span>}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">Submitted by: {getEmp(ot.requestedBy)?.fullName || emp?.fullName}</p>
                    <p className="text-xs text-slate-500 mt-1">{(() => {
                      const estimate = calculateOvertimePay(wageFor(ot.employeeId), ot.totalMinutes, payPolicy.highSeasonDates.includes(ot.date), payPolicy);
                      return `${estimate.breakdown} • ${formatCurrency(estimate.overtimePay)}`;
                    })()}</p>
                  </div>
                </div>
                {ot.status === 'PENDING' && (
                  <div className="flex gap-2">
                    <button onClick={() => handleApprove(ot.id)} className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-100">Approve</button>
                    <button onClick={() => handleReject(ot.id)} className="px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-sm font-medium hover:bg-red-100">Reject</button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* New OT Request Modal */}
      <Modal isOpen={showRequestModal} onClose={() => setShowRequestModal(false)} title="New Overtime Request">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Employee *</label>
            <select value={newOT.employeeId} onChange={e => setNewOT({...newOT, employeeId: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option value="">Select Employee</option>
              {allEmployees.filter(e => e.employmentStatus === 'ACTIVE').map(e => <option key={e.id} value={e.id}>{e.fullName} ({e.employeeCode})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Date *</label>
            <input type="date" value={newOT.date} onChange={e => setNewOT({...newOT, date: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Start Time *</label>
              <input type="time" value={newOT.startTime} onChange={e => setNewOT({...newOT, startTime: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">End Time *</label>
              <input type="time" value={newOT.endTime} onChange={e => setNewOT({...newOT, endTime: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Reason</label>
            <textarea value={newOT.reason} onChange={e => setNewOT({...newOT, reason: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" rows={3} placeholder="Reason for overtime..." />
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <p className="text-xs font-medium text-slate-700 mb-2">PP 35/2021 Compliance</p>
            <div className="flex items-start gap-2 mb-2">
              <input type="checkbox" checked={newOT.writtenOrder} onChange={e => setNewOT({...newOT, writtenOrder: e.target.checked})} className="w-4 h-4 text-indigo-600 rounded border-slate-300" />
              <label className="text-sm text-slate-600 cursor-pointer">Written order from management (required)</label>
            </div>
            <div className="flex items-start gap-2">
              <input type="checkbox" checked={newOT.employeeConsent} onChange={e => setNewOT({...newOT, employeeConsent: e.target.checked})} className="w-4 h-4 text-indigo-600 rounded border-slate-300" />
              <label className="text-sm text-slate-600 cursor-pointer">Employee consent (required)</label>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowRequestModal(false)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={handleSubmitOT} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Submit Request</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
