import { useState } from 'react';
import { attendance, employees, shifts } from '../data/mockData';
import { Clock, Search, Filter } from 'lucide-react';

export default function AttendancePage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const today = new Date().toISOString().split('T')[0];
  const todayAttendance = attendance.filter(a => a.attendanceDate === today);

  const filtered = todayAttendance.filter(a => {
    const emp = employees.find(e => e.id === a.employeeId);
    const matchSearch = emp?.fullName.toLowerCase().includes(search.toLowerCase()) || emp?.employeeCode.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || a.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const getEmp = (id: string) => employees.find(e => e.id === id);
  const getShift = (id: string) => shifts.find(s => s.id === id);

  const statusColor = (status: string) => {
    switch(status) {
      case 'PRESENT': return 'bg-emerald-100 text-emerald-700';
      case 'LATE': return 'bg-orange-100 text-orange-700';
      case 'ABSENT': return 'bg-red-100 text-red-700';
      case 'ON_LEAVE': return 'bg-blue-100 text-blue-700';
      case 'REST_DAY': return 'bg-slate-100 text-slate-600';
      case 'EARLY_LEAVE': return 'bg-amber-100 text-amber-700';
      case 'INCOMPLETE': return 'bg-purple-100 text-purple-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const stats = {
    present: todayAttendance.filter(a => a.status === 'PRESENT').length,
    late: todayAttendance.filter(a => a.status === 'LATE').length,
    absent: todayAttendance.filter(a => a.status === 'ABSENT').length,
    onLeave: todayAttendance.filter(a => a.status === 'ON_LEAVE').length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Daily Attendance</h1>
        <p className="text-slate-500 text-sm mt-1">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-emerald-700">{stats.present}</p>
          <p className="text-xs text-emerald-600">Present</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-orange-700">{stats.late}</p>
          <p className="text-xs text-orange-600">Late</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-red-700">{stats.absent}</p>
          <p className="text-xs text-red-600">Absent</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-blue-700">{stats.onLeave}</p>
          <p className="text-xs text-blue-600">On Leave</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search employee..."
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-slate-400" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm">
            <option value="">All Status</option>
            <option value="PRESENT">Present</option>
            <option value="LATE">Late</option>
            <option value="ABSENT">Absent</option>
            <option value="ON_LEAVE">On Leave</option>
            <option value="REST_DAY">Rest Day</option>
          </select>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Employee</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Shift</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Clock In</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Clock Out</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Late (min)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(a => {
                const emp = getEmp(a.employeeId);
                const shift = getShift(a.shiftId);
                return (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center text-xs font-bold text-indigo-600">
                          {emp?.fullName.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-800">{emp?.fullName}</p>
                          <p className="text-xs text-slate-500">{emp?.employeeCode}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{shift?.name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{a.clockIn || '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{a.clockOut || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${statusColor(a.status)}`}>{a.status}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{a.lateMinutes || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
