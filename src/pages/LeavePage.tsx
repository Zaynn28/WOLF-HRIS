import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { employees, leaveTypes } from '../data/mockData';
import { CalendarDays, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import Modal from '../components/Modal';

export default function LeavePage() {
  const { leaveRequests, setLeaveRequests, addToast, addAuditLog, addNotification } = useApp();
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [newLeave, setNewLeave] = useState({ employeeId: '', leaveTypeId: '', startDate: '', endDate: '', reason: '' });

  const filtered = leaveRequests.filter(l => filter === 'ALL' || l.status === filter);
  const getEmp = (id: string) => employees.find(e => e.id === id);
  const getLeaveType = (id: string) => leaveTypes.find(lt => lt.id === id);

  const statusIcon = (status: string) => {
    switch(status) {
      case 'PENDING': return <Clock size={14} className="text-amber-500" />;
      case 'APPROVED': return <CheckCircle size={14} className="text-emerald-500" />;
      case 'REJECTED': return <XCircle size={14} className="text-red-500" />;
      default: return <AlertCircle size={14} className="text-slate-400" />;
    }
  };

  const statusColor = (status: string) => {
    switch(status) {
      case 'PENDING': return 'bg-amber-100 text-amber-700';
      case 'APPROVED': return 'bg-emerald-100 text-emerald-700';
      case 'REJECTED': return 'bg-red-100 text-red-700';
      case 'CANCELLED': return 'bg-slate-100 text-slate-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const handleApprove = (id: string) => {
    setLeaveRequests(prev => prev.map(l => l.id === id ? { ...l, status: 'APPROVED' as const, approvedAt: new Date().toISOString() } : l));
    const lr = leaveRequests.find(l => l.id === id);
    const emp = getEmp(lr?.employeeId || '');
    addAuditLog('APPROVE', 'LeaveRequest', id, `Approved by current user`);
    addNotification('LEAVE_APPROVED', 'Leave Approved', `Leave request for ${emp?.fullName} has been approved`);
    addToast(`Leave request approved for ${emp?.fullName}`, 'success');
  };

  const handleReject = () => {
    if (!showRejectModal) return;
    setLeaveRequests(prev => prev.map(l => l.id === showRejectModal ? { ...l, status: 'REJECTED' as const, rejectionReason: rejectReason } : l));
    const lr = leaveRequests.find(l => l.id === showRejectModal);
    const emp = getEmp(lr?.employeeId || '');
    addAuditLog('REJECT', 'LeaveRequest', showRejectModal, `Rejected: ${rejectReason}`);
    addNotification('LEAVE_REJECTED', 'Leave Rejected', `Leave request for ${emp?.fullName} has been rejected`);
    addToast(`Leave request rejected for ${emp?.fullName}`, 'warning');
    setShowRejectModal(null);
    setRejectReason('');
  };

  const handleSubmitLeave = () => {
    if (!newLeave.employeeId || !newLeave.leaveTypeId || !newLeave.startDate || !newLeave.endDate) {
      addToast('Please fill in all required fields', 'error');
      return;
    }
    const start = new Date(newLeave.startDate);
    const end = new Date(newLeave.endDate);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const request = {
      id: 'lr' + Date.now(),
      employeeId: newLeave.employeeId,
      leaveTypeId: newLeave.leaveTypeId,
      startDate: newLeave.startDate,
      endDate: newLeave.endDate,
      totalDays: days,
      reason: newLeave.reason,
      status: 'PENDING' as const,
      submittedAt: new Date().toISOString(),
    };
    setLeaveRequests(prev => [...prev, request]);
    const emp = getEmp(newLeave.employeeId);
    addAuditLog('CREATE', 'LeaveRequest', request.id, `${emp?.fullName} submitted leave request`);
    addNotification('PENDING_APPROVAL', 'New Leave Request', `${emp?.fullName} submitted a leave request for ${newLeave.startDate} to ${newLeave.endDate}`);
    addToast(`Leave request submitted for ${emp?.fullName}`, 'success');
    setShowRequestModal(false);
    setNewLeave({ employeeId: '', leaveTypeId: '', startDate: '', endDate: '', reason: '' });
  };

  const pendingCount = leaveRequests.filter(l => l.status === 'PENDING').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Leave Management</h1>
          <p className="text-slate-500 text-sm mt-1">{pendingCount} pending approval{pendingCount !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowRequestModal(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium">
          <CalendarDays size={16} /> Request Leave
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4"><p className="text-sm text-slate-500">Total Requests</p><p className="text-2xl font-bold text-slate-800">{leaveRequests.length}</p></div>
        <div className="bg-white rounded-xl border border-slate-200 p-4"><p className="text-sm text-slate-500">Pending</p><p className="text-2xl font-bold text-amber-600">{leaveRequests.filter(l => l.status === 'PENDING').length}</p></div>
        <div className="bg-white rounded-xl border border-slate-200 p-4"><p className="text-sm text-slate-500">Approved</p><p className="text-2xl font-bold text-emerald-600">{leaveRequests.filter(l => l.status === 'APPROVED').length}</p></div>
        <div className="bg-white rounded-xl border border-slate-200 p-4"><p className="text-sm text-slate-500">Rejected</p><p className="text-2xl font-bold text-red-600">{leaveRequests.filter(l => l.status === 'REJECTED').length}</p></div>
      </div>

      <div className="flex gap-2">
        {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === f ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map(lr => {
          const emp = getEmp(lr.employeeId);
          const lt = getLeaveType(lr.leaveTypeId);
          return (
            <div key={lr.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-sm font-bold text-indigo-600">{emp?.fullName.charAt(0)}</div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-800">{emp?.fullName}</p>
                      <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded font-medium ${statusColor(lr.status)}`}>{statusIcon(lr.status)}{lr.status}</span>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">{lt?.name} • {lr.startDate} to {lr.endDate} • {lr.totalDays} day{lr.totalDays > 1 ? 's' : ''}</p>
                    <p className="text-sm text-slate-600 mt-2">Reason: {lr.reason}</p>
                    {lr.rejectionReason && <p className="text-sm text-red-600 mt-1">Rejection reason: {lr.rejectionReason}</p>}
                    <p className="text-xs text-slate-400 mt-1">Submitted: {new Date(lr.submittedAt).toLocaleDateString()}</p>
                  </div>
                </div>
                {lr.status === 'PENDING' && (
                  <div className="flex gap-2">
                    <button onClick={() => handleApprove(lr.id)} className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-100 transition-colors">Approve</button>
                    <button onClick={() => setShowRejectModal(lr.id)} className="px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors">Reject</button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <CalendarDays size={40} className="mx-auto mb-3 text-slate-300" />
            <p>No leave requests found.</p>
          </div>
        )}
      </div>

      {/* Request Leave Modal */}
      <Modal isOpen={showRequestModal} onClose={() => setShowRequestModal(false)} title="Request Leave">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Employee *</label>
            <select value={newLeave.employeeId} onChange={e => setNewLeave({...newLeave, employeeId: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option value="">Select Employee</option>
              {employees.filter(e => e.employmentStatus === 'ACTIVE').map(e => <option key={e.id} value={e.id}>{e.fullName} ({e.employeeCode})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Leave Type *</label>
            <select value={newLeave.leaveTypeId} onChange={e => setNewLeave({...newLeave, leaveTypeId: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option value="">Select Leave Type</option>
              {leaveTypes.filter(lt => lt.isActive).map(lt => <option key={lt.id} value={lt.id}>{lt.name} ({lt.defaultEntitlement} days)</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Start Date *</label>
              <input type="date" value={newLeave.startDate} onChange={e => setNewLeave({...newLeave, startDate: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">End Date *</label>
              <input type="date" value={newLeave.endDate} onChange={e => setNewLeave({...newLeave, endDate: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Reason</label>
            <textarea value={newLeave.reason} onChange={e => setNewLeave({...newLeave, reason: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" rows={3} placeholder="Reason for leave..." />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowRequestModal(false)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={handleSubmitLeave} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Submit Request</button>
          </div>
        </div>
      </Modal>

      {/* Reject Modal */}
      <Modal isOpen={!!showRejectModal} onClose={() => setShowRejectModal(null)} title="Reject Leave Request">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">Please provide a reason for rejecting this leave request.</p>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Rejection Reason *</label>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" rows={3} placeholder="Reason for rejection..." />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowRejectModal(null)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={handleReject} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">Confirm Rejection</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
