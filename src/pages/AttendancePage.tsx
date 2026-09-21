import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { employees, shifts } from '../data/mockData';
import { Search, Filter, LogIn, LogOut, AlertCircle } from 'lucide-react';
import Modal from '../components/Modal';

export default function AttendancePage() {
  const { attendance, setAttendance, addToast, addAuditLog } = useApp();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correction, setCorrection] = useState({ employeeId: '', date: '', type: 'clock_in', value: '', reason: '' });
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

  const handleClockIn = (id: string) => {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    setAttendance(prev => prev.map(a => a.id === id ? { ...a, clockIn: timeStr, status: 'PRESENT' as const } : a));
    const att = attendance.find(a => a.id === id);
    const emp = getEmp(att?.employeeId || '');
    addAuditLog('UPDATE', 'Attendance', id, `Clock in at ${timeStr} for ${emp?.fullName}`);
    addToast(`${emp?.fullName} clocked in at ${timeStr}`, 'success');
  };

  const handleClockOut = (id: string) => {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    setAttendance(prev => prev.map(a => a.id === id ? { ...a, clockOut: timeStr } : a));
    const att = attendance.find(a => a.id === id);
    const emp = getEmp(att?.employeeId || '');
    addAuditLog('UPDATE', 'Attendance', id, `Clock out at ${timeStr} for ${emp?.fullName}`);
    addToast(`${emp?.fullName} clocked out at ${timeStr}`, 'success');
  };

  const handleSubmitCorrection = () => {
    if (!correction.employeeId || !correction.date || !correction.value || !correction.reason) {
      addToast('Please fill in all required fields', 'error');
      return;
    }
    addAuditLog('CREATE', 'AttendanceCorrection', Date.now().toString(), `Correction requested for ${getEmp(correction.employeeId)?.fullName}`);
    addToast('Attendance correction request submitted', 'success');
    setShowCorrectionModal(false);
    setCorrection({ employeeId: '', date: '', type: 'clock_in', value: '', reason: '' });
  };

  const stats = {
    present: todayAttendance.filter(a => a.status === 'PRESENT').length,
    late: todayAttendance.filter(a => a.status === 'LATE').length,
    absent: todayAttendance.filter(a => a.status === 'ABSENT').length,
    onLeave: todayAttendance.filter(a => a.status === 'ON_LEAVE').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Daily Attendance</h1>
          <p className="text-slate-500 text-sm mt-1">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <button onClick={() => setShowCorrectionModal(true)} className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 text-sm font-medium">
          <AlertCircle size={16} /> Request Correction
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center"><p className="text-2xl font-bold text-emerald-700">{stats.present}</p><p className="text-xs text-emerald-600">Present</p></div>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center"><p className="text-2xl font-bold text-orange-700">{stats.late}</p><p className="text-xs text-orange-600">Late</p></div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center"><p className="text-2xl font-bold text-red-700">{stats.absent}</p><p className="text-xs text-red-600">Absent</p></div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center"><p className="text-2xl font-bold text-blue-700">{stats.onLeave}</p><p className="text-xs text-blue-600">On Leave</p></div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employee..." className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />
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
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Actions</th>
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
                        <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center text-xs font-bold text-indigo-600">{emp?.fullName.charAt(0)}</div>
                        <div><p className="text-sm font-medium text-slate-800">{emp?.fullName}</p><p className="text-xs text-slate-500">{emp?.employeeCode}</p></div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{shift?.name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{a.clockIn || '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{a.clockOut || '—'}</td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded font-medium ${statusColor(a.status)}`}>{a.status}</span></td>
                    <td className="px-4 py-3 text-sm text-slate-600">{a.lateMinutes || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {!a.clockIn && a.status !== 'ON_LEAVE' && a.status !== 'REST_DAY' && a.status !== 'ABSENT' && (
                          <button onClick={() => handleClockIn(a.id)} className="p-1.5 bg-emerald-50 text-emerald-700 rounded hover:bg-emerald-100" title="Clock In">
                            <LogIn size={14} />
                          </button>
                        )}
                        {a.clockIn && !a.clockOut && (
                          <button onClick={() => handleClockOut(a.id)} className="p-1.5 bg-amber-50 text-amber-700 rounded hover:bg-amber-100" title="Clock Out">
                            <LogOut size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Correction Modal */}
      <Modal isOpen={showCorrectionModal} onClose={() => setShowCorrectionModal(false)} title="Request Attendance Correction">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Employee *</label>
            <select value={correction.employeeId} onChange={e => setCorrection({...correction, employeeId: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option value="">Select Employee</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.fullName} ({e.employeeCode})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Date *</label>
            <input type="date" value={correction.date} onChange={e => setCorrection({...correction, date: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Correction Type</label>
              <select value={correction.type} onChange={e => setCorrection({...correction, type: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                <option value="clock_in">Clock In</option>
                <option value="clock_out">Clock Out</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Correct Time *</label>
              <input type="time" value={correction.value} onChange={e => setCorrection({...correction, value: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Reason *</label>
            <textarea value={correction.reason} onChange={e => setCorrection({...correction, reason: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" rows={3} placeholder="Reason for correction..." />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowCorrectionModal(false)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={handleSubmitCorrection} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Submit Correction</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
