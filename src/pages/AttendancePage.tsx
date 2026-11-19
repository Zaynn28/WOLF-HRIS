import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { localDate } from '../lib/localDate';
import { attendanceApi, attendancePhotoUrl, fingerspotApi, mapAttendanceRow, mapPunchMine } from '../services/api';
import { Search, Filter, AlertCircle } from 'lucide-react';
import Modal from '../components/Modal';
import BulkUploadButton from '../components/BulkUploadButton';
import ClockCapture, { ClockProof } from '../components/ClockCapture';
import type { PunchMine } from '../types';

export default function AttendancePage() {
  const { attendance, setAttendance, employees, shifts, offsiteDuties, setOffsiteDuties, addToast, addAuditLog } = useApp();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [dutyDraft, setDutyDraft] = useState({ employeeId: '', startDate: '', endDate: '', locationNote: '' });
  const [proofView, setProofView] = useState<{ url?: string; lat?: number; lng?: number; label: string; site?: string | null } | null>(null);
  const [pendingCorrections, setPendingCorrections] = useState<{ id: string; employee_code: string; full_name: string; attendance_date: string; reason: string; requested_value: { clock_in?: string | null; clock_out?: string | null } }[]>([]);
  const [correction, setCorrection] = useState({ employeeId: '', date: '', type: 'clock_in', value: '', reason: '' });
  const [unpaired, setUnpaired] = useState<{ cloud_id: string; pin: string; scanned_at: string }[]>([]);
  const [pairCode, setPairCode] = useState<Record<string, string>>({});
  const [mine, setMine] = useState<PunchMine | null | undefined>(undefined);
  const [mineError, setMineError] = useState('');
  const [punchMode, setPunchMode] = useState<'in' | 'out' | null>(null);
  const embedded = typeof window !== 'undefined' && window.__WOLF_HR_EMBEDDED__ === true;
  const today = localDate();
  const refreshUnpaired = () => {
    if (!embedded) return;
    fingerspotApi.unpaired().then(setUnpaired).catch(() => setUnpaired([]));
  };
  useEffect(() => {
    refreshUnpaired();
  }, [embedded]);
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

  const refreshBoard = async () => {
    const rows = await attendanceApi.getByDate(today);
    setAttendance((prev) => [...prev.filter((item) => item.attendanceDate !== today), ...rows.map(mapAttendanceRow)]);
  };

  const refreshCorrections = () => {
    attendanceApi.corrections().then(setPendingCorrections).catch(() => setPendingCorrections([]));
  };

  useEffect(() => {
    refreshCorrections();
    let cancelled = false;
    attendanceApi.mine().then((row) => {
      if (!cancelled) setMine(mapPunchMine(row));
    }).catch((error: unknown) => {
      if (!cancelled) {
        setMine(null);
        setMineError(error instanceof Error ? error.message : 'Punch is not available for this session.');
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const activeDutyToday = (employeeId?: string | null) => {
    if (!employeeId) return null;
    return offsiteDuties.find(duty =>
      duty.status === 'APPROVED'
      && duty.employeeId === employeeId
      && duty.startDate <= today
      && duty.endDate >= today
    ) || null;
  };

  const savePunch = async (captured: ClockProof) => {
    try {
      const selfId = mine?.day?.employeeId || employees.find(person => person.email)?.id;
      const duty = activeDutyToday(selfId);
      const saved = await attendanceApi.punch({
        photo: captured.photo,
        latitude: captured.latitude,
        longitude: captured.longitude,
        accuracy: captured.accuracy,
        idempotency_key: crypto.randomUUID(),
        off_site_duty: Boolean(duty),
        off_site_location_note: duty?.locationNote || undefined,
      });
      const fresh = mapPunchMine(await attendanceApi.mine());
      setMine(fresh);
      if (fresh.day) {
        const day = fresh.day;
        setAttendance((prev) => [...prev.filter((row) => !(row.employeeId === day.employeeId && row.attendanceDate === day.attendanceDate)), day]);
      }
      try {
        await refreshBoard();
      } catch {
        // The punch is already stored. The day board keeps the merged row.
      }
      addToast(saved.message || 'Punch recorded.', saved.outcome === 'kept' ? 'warning' : 'success');
      setPunchMode(null);
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'The punch was not recorded.', 'error');
    }
  };

  const handleSubmitCorrection = async () => {
    const employee = getEmp(correction.employeeId);
    if (!employee || !correction.date || !correction.value || !correction.reason.trim()) {
      addToast('Please fill in all required fields', 'error');
      return;
    }
    try {
      await attendanceApi.requestCorrection({
        employee_code: employee.employeeCode,
        attendance_date: correction.date,
        clock_in: correction.type === 'clock_in' ? correction.value : undefined,
        clock_out: correction.type === 'clock_out' ? correction.value : undefined,
        reason: correction.reason.trim(),
      });
      addAuditLog('UPDATE', 'Attendance', correction.employeeId, `Correction requested ${correction.type} ${correction.value} on ${correction.date} for ${employee.fullName}: ${correction.reason.trim()}`);
      addToast('Attendance correction filed', 'success');
      setShowCorrectionModal(false);
      setCorrection({ employeeId: '', date: '', type: 'clock_in', value: '', reason: '' });
      refreshCorrections();
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'The correction was not filed.', 'error');
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Daily Attendance</h1>
          <p className="text-slate-500 text-sm mt-1">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <div className="flex gap-2">
        <BulkUploadButton module="attendance" />
        <button onClick={() => setShowCorrectionModal(true)} className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 text-sm font-medium">
          <AlertCircle size={16} /> Request Correction
        </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium text-slate-800">Your punch</p>
          <p className="text-sm text-slate-500">
            {mine?.day?.clockIn ? `In ${mine.day.clockIn}` : 'Not clocked in'}
            {mine?.day?.clockOut ? ` · Out ${mine.day.clockOut}` : ''}
            {mine?.day?.clockInSiteName ? ` · ${mine.day.clockInSiteName}` : ''}
          </p>
          {mine?.blockedReason && <p className="text-sm text-red-600">{mine.blockedReason}</p>}
          {mine === null && <p className="text-sm text-slate-500">{mineError || 'Punch is not available for this session.'}</p>}
        </div>
        <div className="flex gap-2">
          {mine?.next === 'in' && <button type="button" onClick={() => setPunchMode('in')} className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm">Clock in</button>}
          {mine?.next === 'out' && <button type="button" onClick={() => setPunchMode('out')} className="px-3 py-2 bg-amber-600 text-white rounded-lg text-sm">Clock out</button>}
        </div>
      </div>
      {punchMode && <ClockCapture title={punchMode === 'in' ? 'Clock in' : 'Clock out'} onCancel={() => setPunchMode(null)} onConfirm={savePunch} />}

      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-medium text-slate-800">Off-site duty</p>
            <p className="text-sm text-slate-500">Approve kerja luar daerah so staff can punch outside the office geofence.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <select value={dutyDraft.employeeId} onChange={e => setDutyDraft(prev => ({ ...prev, employeeId: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm">
            <option value="">Employee</option>
            {employees.filter(person => person.employmentStatus === 'ACTIVE' || person.employmentStatus === 'PROBATION').map(person => (
              <option key={person.id} value={person.id}>{person.fullName}</option>
            ))}
          </select>
          <input type="date" value={dutyDraft.startDate} onChange={e => setDutyDraft(prev => ({ ...prev, startDate: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm" />
          <input type="date" value={dutyDraft.endDate} onChange={e => setDutyDraft(prev => ({ ...prev, endDate: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm" />
          <input value={dutyDraft.locationNote} onChange={e => setDutyDraft(prev => ({ ...prev, locationNote: e.target.value }))} placeholder="Location note" className="px-3 py-2 border rounded-lg text-sm" />
        </div>
        <button
          type="button"
          onClick={() => {
            if (!dutyDraft.employeeId || !dutyDraft.startDate || !dutyDraft.endDate) {
              addToast('Employee, start date, and end date are required.', 'error');
              return;
            }
            if (dutyDraft.endDate < dutyDraft.startDate) {
              addToast('End date must be on or after start date.', 'error');
              return;
            }
            const emp = employees.find(person => person.id === dutyDraft.employeeId);
            setOffsiteDuties(prev => [...prev, {
              id: `duty${Date.now()}`,
              employeeId: dutyDraft.employeeId,
              startDate: dutyDraft.startDate,
              endDate: dutyDraft.endDate,
              locationNote: dutyDraft.locationNote || 'Off-site assignment',
              status: 'APPROVED',
              createdAt: new Date().toISOString(),
            }]);
            addAuditLog('CREATE', 'OffsiteDuty', dutyDraft.employeeId, `${emp?.fullName} off-site ${dutyDraft.startDate}–${dutyDraft.endDate}`);
            addToast(`Off-site duty approved for ${emp?.fullName}.`, 'success');
            setDutyDraft({ employeeId: '', startDate: '', endDate: '', locationNote: '' });
          }}
          className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm"
        >
          Approve off-site duty
        </button>
        {offsiteDuties.filter(duty => duty.status === 'APPROVED' && duty.endDate >= today).length > 0 && (
          <ul className="text-sm text-slate-600 space-y-1">
            {offsiteDuties.filter(duty => duty.status === 'APPROVED' && duty.endDate >= today).map(duty => {
              const emp = employees.find(person => person.id === duty.employeeId);
              return <li key={duty.id}>{emp?.fullName || duty.employeeId} · {duty.startDate}–{duty.endDate} · {duty.locationNote}</li>;
            })}
          </ul>
        )}
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
            <option value="INCOMPLETE">Incomplete</option>
          </select>
        </div>
      </div>

      {embedded && unpaired.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <p className="text-sm font-medium text-slate-800">Unpaired fingerprint pins</p>
          {unpaired.map((row) => {
            const key = `${row.cloud_id}:${row.pin}`;
            return (
              <div key={`${key}:${row.scanned_at}`} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-mono text-slate-700">PIN {row.pin}</span>
                <span className="text-slate-500">{row.scanned_at}</span>
                <select value={pairCode[key] || ''} onChange={(event) => setPairCode((prev) => ({ ...prev, [key]: event.target.value }))} className="px-2 py-1 border border-slate-300 rounded">
                  <option value="">Employee</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.employeeCode}>{employee.employeeCode} {employee.fullName}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="px-3 py-1 rounded bg-slate-900 text-white"
                  onClick={async () => {
                    const employeeCode = pairCode[key];
                    if (!employeeCode) return;
                    await fingerspotApi.pair({ cloud_id: row.cloud_id, pin: row.pin, employee_code: employeeCode });
                    const rows = await attendanceApi.getByDate(today);
                    setAttendance((prev) => [...prev.filter((item) => item.attendanceDate !== today), ...rows.map(mapAttendanceRow)]);
                    refreshUnpaired();
                    addToast(`PIN ${row.pin} paired`, 'success');
                  }}
                >
                  Pair
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Employee</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Shift</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Clock In</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Clock Out</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Site</th>
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
                    <td className="px-4 py-3 text-sm text-slate-600">{a.clockOutSiteName || a.clockInSiteName || '—'}</td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded font-medium ${statusColor(a.status)}`}>{a.status}</span></td>
                    <td className="px-4 py-3 text-sm text-slate-600">{a.lateMinutes ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {a.hasClockInPhoto && (
                          <button type="button" onClick={() => setProofView({ url: attendancePhotoUrl(a.id, 'in'), lat: a.clockInLat, lng: a.clockInLng, site: a.clockInSiteName, label: `${emp?.fullName || 'Punch'} clock in` })} className="text-xs text-indigo-700">In photo</button>
                        )}
                        {a.hasClockOutPhoto && (
                          <button type="button" onClick={() => setProofView({ url: attendancePhotoUrl(a.id, 'out'), lat: a.clockOutLat, lng: a.clockOutLng, site: a.clockOutSiteName, label: `${emp?.fullName || 'Punch'} clock out` })} className="text-xs text-indigo-700">Out photo</button>
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

      {pendingCorrections.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <p className="text-sm font-medium text-slate-800">Pending corrections</p>
          {pendingCorrections.map((row) => (
            <div key={row.id} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-slate-800">{row.full_name}</span>
              <span className="text-slate-500">{row.attendance_date}</span>
              <span className="text-slate-500">{row.requested_value?.clock_in ? `In ${row.requested_value.clock_in}` : ''}{row.requested_value?.clock_out ? ` Out ${row.requested_value.clock_out}` : ''}</span>
              <span className="text-slate-600">{row.reason}</span>
              <button
                type="button"
                className="px-3 py-1 rounded bg-slate-900 text-white"
                onClick={async () => {
                  try {
                    await attendanceApi.approveCorrection(row.id);
                    addToast('Correction approved', 'success');
                    refreshCorrections();
                    await refreshBoard();
                  } catch (error) {
                    addToast(error instanceof Error ? error.message : 'The correction was not approved.', 'error');
                  }
                }}
              >
                Approve
              </button>
            </div>
          ))}
        </div>
      )}

      {proofView && (
        <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4" onClick={() => setProofView(null)}>
          <div className="bg-white rounded-xl p-4 max-w-sm" onClick={event => event.stopPropagation()}>
            <p className="font-medium text-slate-800 mb-2">{proofView.label}</p>
            {proofView.url && <img src={proofView.url} alt="Punch proof" className="rounded-lg mb-2" />}
            <p className="text-sm text-slate-600">{proofView.site || 'Punch site'}</p>
            <p className="text-sm text-slate-600">{proofView.lat != null && proofView.lng != null ? `${proofView.lat.toFixed(5)}, ${proofView.lng.toFixed(5)}` : ''}</p>
          </div>
        </div>
      )}

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
