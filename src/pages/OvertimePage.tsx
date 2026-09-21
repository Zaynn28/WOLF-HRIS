import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { employees } from '../data/mockData';
import { Clock, CheckCircle, AlertCircle } from 'lucide-react';
import Modal from '../components/Modal';

export default function OvertimePage() {
  const { overtimeRequests, setOvertimeRequests, addToast, addAuditLog, addNotification } = useApp();
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [newOT, setNewOT] = useState({ employeeId: '', date: '', startTime: '', endTime: '', reason: '' });

  const getEmp = (id: string) => employees.find(e => e.id === id);

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
    const [sh, sm] = newOT.startTime.split(':').map(Number);
    const [eh, em] = newOT.endTime.split(':').map(Number);
    const totalMinutes = (eh * 60 + em) - (sh * 60 + sm);
    const request = {
      id: 'ot' + Date.now(),
      employeeId: newOT.employeeId,
      date: newOT.date,
      startTime: newOT.startTime,
      endTime: newOT.endTime,
      totalMinutes,
      reason: newOT.reason,
      status: 'PENDING' as const,
      requestedBy: 'u1',
    };
    setOvertimeRequests(prev => [...prev, request]);
    const emp = getEmp(newOT.employeeId);
    addAuditLog('CREATE', 'OvertimeRequest', request.id, `${emp?.fullName} overtime request created`);
    addNotification('PENDING_APPROVAL', 'New Overtime Request', `${emp?.fullName} has an overtime request for ${newOT.date}`);
    addToast(`Overtime request submitted for ${emp?.fullName}`, 'success');
    setShowRequestModal(false);
    setNewOT({ employeeId: '', date: '', startTime: '', endTime: '', reason: '' });
  };

  const totalApprovedMinutes = overtimeRequests.filter(o => o.status === 'APPROVED').reduce((sum, o) => sum + o.totalMinutes, 0);
  const totalPendingMinutes = overtimeRequests.filter(o => o.status === 'PENDING').reduce((sum, o) => sum + o.totalMinutes, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Overtime Management</h1>
          <p className="text-slate-500 text-sm mt-1">Track and approve overtime requests</p>
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
              {employees.filter(e => e.employmentStatus === 'ACTIVE').map(e => <option key={e.id} value={e.id}>{e.fullName} ({e.employeeCode})</option>)}
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
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowRequestModal(false)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={handleSubmitOT} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Submit Request</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
