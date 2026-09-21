import { useState } from 'react';
import { leaveRequests, employees, leaveTypes } from '../data/mockData';
import { CalendarDays, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

export default function LeavePage() {
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');

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

  const pendingCount = leaveRequests.filter(l => l.status === 'PENDING').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Leave Management</h1>
          <p className="text-slate-500 text-sm mt-1">{pendingCount} pending approval{pendingCount !== 1 ? 's' : ''}</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium">
          <CalendarDays size={16} /> Request Leave
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Total Requests</p>
          <p className="text-2xl font-bold text-slate-800">{leaveRequests.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Pending</p>
          <p className="text-2xl font-bold text-amber-600">{leaveRequests.filter(l => l.status === 'PENDING').length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Approved</p>
          <p className="text-2xl font-bold text-emerald-600">{leaveRequests.filter(l => l.status === 'APPROVED').length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Rejected</p>
          <p className="text-2xl font-bold text-red-600">{leaveRequests.filter(l => l.status === 'REJECTED').length}</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* Leave Requests List */}
      <div className="space-y-3">
        {filtered.map(lr => {
          const emp = getEmp(lr.employeeId);
          const lt = getLeaveType(lr.leaveTypeId);
          return (
            <div key={lr.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-sm font-bold text-indigo-600">
                    {emp?.fullName.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-800">{emp?.fullName}</p>
                      <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded font-medium ${statusColor(lr.status)}`}>
                        {statusIcon(lr.status)}
                        {lr.status}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">
                      {lt?.name} • {lr.startDate} to {lr.endDate} • {lr.totalDays} day{lr.totalDays > 1 ? 's' : ''}
                    </p>
                    <p className="text-sm text-slate-600 mt-2">Reason: {lr.reason}</p>
                    <p className="text-xs text-slate-400 mt-1">Submitted: {new Date(lr.submittedAt).toLocaleDateString()}</p>
                  </div>
                </div>
                {lr.status === 'PENDING' && (
                  <div className="flex gap-2">
                    <button className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-100 transition-colors">
                      Approve
                    </button>
                    <button className="px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors">
                      Reject
                    </button>
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
    </div>
  );
}
