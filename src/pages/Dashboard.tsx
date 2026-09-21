import { useApp } from '../context/AppContext';
import { employees, departments } from '../data/mockData';
import { Users, UserCheck, UserX, CalendarClock, Clock, AlertTriangle, FileWarning, CheckCircle } from 'lucide-react';

interface DashboardProps { onNavigate: (page: string) => void; }

export default function Dashboard({ onNavigate }: DashboardProps) {
  const { attendance, leaveRequests, overtimeRequests, payrollPeriods, documents } = useApp();
  const today = new Date().toISOString().split('T')[0];
  const todayAttendance = attendance.filter(a => a.attendanceDate === today);
  const presentToday = todayAttendance.filter(a => a.status === 'PRESENT' || a.status === 'LATE').length;
  const absentToday = todayAttendance.filter(a => a.status === 'ABSENT').length;
  const onLeaveToday = todayAttendance.filter(a => a.status === 'ON_LEAVE').length;
  const lateToday = todayAttendance.filter(a => a.status === 'LATE').length;
  const pendingLeave = leaveRequests.filter(l => l.status === 'PENDING').length;
  const pendingOvertime = overtimeRequests.filter(o => o.status === 'PENDING').length;
  const activeEmployees = employees.filter(e => e.employmentStatus === 'ACTIVE').length;
  const probationEmployees = employees.filter(e => e.employmentStatus === 'PROBATION').length;
  const pendingDocs = documents.filter(d => d.verificationStatus === 'PENDING').length;
  
  const currentPayroll = payrollPeriods.find(p => p.status !== 'FINALIZED' && p.status !== 'LOCKED');
  
  const expiringContracts = employees.filter(e => {
    const contract = documents.find(d => d.employeeId === e.id && d.documentTypeName === 'Employment Contract');
    if (contract?.expiryDate) {
      const expDate = new Date(contract.expiryDate);
      const now = new Date();
      const diff = (expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return diff <= 60 && diff > 0;
    }
    return false;
  });

  const cards = [
    { label: 'Total Employees', value: activeEmployees, sublabel: `${probationEmployees} on probation`, icon: <Users size={24} />, color: 'bg-blue-500', page: 'employees' },
    { label: 'Present Today', value: presentToday, sublabel: `of ${todayAttendance.length} scheduled`, icon: <UserCheck size={24} />, color: 'bg-emerald-500', page: 'daily-attendance' },
    { label: 'Absent Today', value: absentToday, sublabel: 'Without approved leave', icon: <UserX size={24} />, color: 'bg-red-500', page: 'daily-attendance' },
    { label: 'On Leave', value: onLeaveToday, sublabel: 'Approved leave today', icon: <CalendarClock size={24} />, color: 'bg-amber-500', page: 'leave' },
    { label: 'Late Today', value: lateToday, sublabel: 'Arrived after shift start', icon: <Clock size={24} />, color: 'bg-orange-500', page: 'daily-attendance' },
    { label: 'Pending Approvals', value: pendingLeave + pendingOvertime, sublabel: `${pendingLeave} leave, ${pendingOvertime} overtime`, icon: <AlertTriangle size={24} />, color: 'bg-purple-500', page: 'leave' },
    { label: 'Contracts Expiring', value: expiringContracts.length, sublabel: 'Within 60 days', icon: <FileWarning size={24} />, color: 'bg-rose-500', page: 'documents' },
    { label: 'Pending Documents', value: pendingDocs, sublabel: 'Awaiting verification', icon: <CheckCircle size={24} />, color: 'bg-teal-500', page: 'documents' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Command Centre</h1>
        <p className="text-slate-500 text-sm mt-1">Operational overview — {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, i) => (
          <button key={i} onClick={() => onNavigate(card.page)} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-all text-left hover:border-indigo-200 group">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500">{card.label}</p>
                <p className="text-3xl font-bold text-slate-800 mt-1">{card.value}</p>
                <p className="text-xs text-slate-400 mt-1">{card.sublabel}</p>
              </div>
              <div className={`${card.color} p-2.5 rounded-lg text-white group-hover:scale-110 transition-transform`}>
                {card.icon}
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-800 mb-4">Payroll Status</h3>
          {currentPayroll ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <p className="font-medium text-slate-700">Period: {currentPayroll.periodCode}</p>
                  <p className="text-xs text-slate-500">{currentPayroll.startDate} to {currentPayroll.endDate}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                  currentPayroll.status === 'CALCULATED' ? 'bg-blue-100 text-blue-700' :
                  currentPayroll.status === 'DRAFT' ? 'bg-slate-100 text-slate-700' :
                  currentPayroll.status === 'UNDER_REVIEW' ? 'bg-amber-100 text-amber-700' :
                  'bg-green-100 text-green-700'
                }`}>
                  {currentPayroll.status}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Pay Date</span>
                <span className="font-medium text-slate-700">{currentPayroll.payDate}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Employees</span>
                <span className="font-medium text-slate-700">{activeEmployees}</span>
              </div>
              <button onClick={() => onNavigate('payroll-periods')} className="w-full mt-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
                View Payroll Details
              </button>
            </div>
          ) : (
            <p className="text-slate-500 text-sm">No active payroll period</p>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-800 mb-4">Pending Approvals</h3>
          <div className="space-y-3">
            {leaveRequests.filter(l => l.status === 'PENDING').slice(0, 3).map(lr => {
              const emp = employees.find(e => e.id === lr.employeeId);
              return (
                <div key={lr.id} className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-100">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{emp?.fullName}</p>
                    <p className="text-xs text-slate-500">Leave: {lr.startDate} to {lr.endDate} ({lr.totalDays} days)</p>
                  </div>
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium">Pending</span>
                </div>
              );
            })}
            {overtimeRequests.filter(o => o.status === 'PENDING').slice(0, 2).map(ot => {
              const emp = employees.find(e => e.id === ot.employeeId);
              return (
                <div key={ot.id} className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-100">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{emp?.fullName}</p>
                    <p className="text-xs text-slate-500">OT: {ot.date} ({ot.totalMinutes} min)</p>
                  </div>
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">Pending</span>
                </div>
              );
            })}
            {pendingLeave + pendingOvertime === 0 && (
              <p className="text-slate-500 text-sm text-center py-4">No pending approvals</p>
            )}
            {(pendingLeave + pendingOvertime) > 0 && (
              <button onClick={() => onNavigate('leave')} className="w-full mt-2 px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-sm font-medium hover:bg-amber-100 transition-colors">
                View All Approvals
              </button>
            )}
          </div>
        </div>
      </div>

      {expiringContracts.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <FileWarning size={18} className="text-rose-500" />
            Contracts Expiring Soon
          </h3>
          <div className="space-y-2">
            {expiringContracts.map(emp => {
              const contract = documents.find(d => d.employeeId === emp.id && d.documentTypeName === 'Employment Contract');
              return (
                <div key={emp.id} className="flex items-center justify-between p-3 bg-rose-50 rounded-lg border border-rose-100">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-rose-100 rounded-full flex items-center justify-center text-xs font-bold text-rose-700">
                      {emp.fullName.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700">{emp.fullName}</p>
                      <p className="text-xs text-slate-500">{emp.employeeCode} • {departments.find(d => d.id === emp.departmentId)?.name}</p>
                    </div>
                  </div>
                  <span className="text-sm font-medium text-rose-600">Expires: {contract?.expiryDate}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
