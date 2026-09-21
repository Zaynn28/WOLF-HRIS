import { overtimeRequests, employees } from '../data/mockData';
import { Clock, CheckCircle, AlertCircle } from 'lucide-react';

export default function OvertimePage() {
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

  const totalApprovedMinutes = overtimeRequests.filter(o => o.status === 'APPROVED').reduce((sum, o) => sum + o.totalMinutes, 0);
  const totalPendingMinutes = overtimeRequests.filter(o => o.status === 'PENDING').reduce((sum, o) => sum + o.totalMinutes, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Overtime Management</h1>
          <p className="text-slate-500 text-sm mt-1">Track and approve overtime requests</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium">
          <Clock size={16} /> New Request
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Total Requests</p>
          <p className="text-2xl font-bold text-slate-800">{overtimeRequests.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Approved Hours</p>
          <p className="text-2xl font-bold text-emerald-600">{(totalApprovedMinutes / 60).toFixed(1)}h</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Pending Hours</p>
          <p className="text-2xl font-bold text-amber-600">{(totalPendingMinutes / 60).toFixed(1)}h</p>
        </div>
      </div>

      {/* Overtime List */}
      <div className="space-y-3">
        {overtimeRequests.map(ot => {
          const emp = getEmp(ot.employeeId);
          return (
            <div key={ot.id} className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center text-sm font-bold text-purple-600">
                    {emp?.fullName.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-800">{emp?.fullName}</p>
                      <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded font-medium ${statusColor(ot.status)}`}>
                        {statusIcon(ot.status)}
                        {ot.status}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">
                      {ot.date} • {ot.startTime} - {ot.endTime} • {ot.totalMinutes} minutes ({(ot.totalMinutes / 60).toFixed(1)}h)
                    </p>
                    <p className="text-sm text-slate-600 mt-1">Reason: {ot.reason}</p>
                  </div>
                </div>
                {ot.status === 'PENDING' && (
                  <div className="flex gap-2">
                    <button className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-100">Approve</button>
                    <button className="px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-sm font-medium hover:bg-red-100">Reject</button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
