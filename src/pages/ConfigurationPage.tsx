import { useEffect, useState, type ReactNode } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { departmentsApi, positionsApi, punchSitesApi } from '../services/api';
import { departments as initDepts, positions as initPositions, shifts as initShifts, leaveTypes } from '../data/mockData';
import { Department, Position, Shift, LeaveType } from '../types';
import { visibleConfigurationTabs } from '../lib/hr-navigation';
import { cycleForMonth } from '../lib/periodScope';
import { Settings, Building2, Briefcase, Clock, CalendarDays, Save, Plus, Edit2, Trash2, CheckCircle, XCircle, MapPin, DollarSign } from 'lucide-react';
import Modal from '../components/Modal';
import { MAX_PUNCH_ACCURACY_METERS } from '../components/ClockCapture';
import BulkUploadButton from '../components/BulkUploadButton';
import PayrollStructurePage from './PayrollStructurePage';

interface ConfigurationPageProps { initialTab?: string; }

interface PunchSiteRow {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  active: boolean;
}

function PunchSitesPanel({ addToast }: { addToast: (message: string, type: 'success' | 'error' | 'warning') => void }) {
  const [sites, setSites] = useState<PunchSiteRow[]>([]);
  const [draft, setDraft] = useState({ name: '', latitude: '', longitude: '', radius: '100' });
  const [gpsNote, setGpsNote] = useState('');
  const [gpsError, setGpsError] = useState(false);
  const [readingLocation, setReadingLocation] = useState(false);

  const load = () => {
    punchSitesApi.list().then((rows) => setSites(rows)).catch(() => setSites([]));
  };

  useEffect(() => {
    load();
  }, []);

  const useHere = () => {
    if (!navigator.geolocation) {
      setGpsError(true);
      setGpsNote('This browser has no location service.');
      return;
    }
    setReadingLocation(true);
    setGpsError(false);
    setGpsNote('Waiting for GPS… Allow location access if the browser asks.');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const accuracy = Math.round(position.coords.accuracy);
        setReadingLocation(false);
        if (!Number.isFinite(position.coords.accuracy) || accuracy < 0 || accuracy > MAX_PUNCH_ACCURACY_METERS) {
          setGpsError(true);
          setGpsNote(`The location is too coarse${Number.isFinite(accuracy) ? ` (±${accuracy} m)` : ''}. Accuracy must be ${MAX_PUNCH_ACCURACY_METERS} metres or better.`);
          return;
        }
        setDraft((current) => ({
          ...current,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
        }));
        setGpsError(false);
        setGpsNote(`Location set · ±${accuracy} m. Name the site and save.`);
      },
      () => {
        setReadingLocation(false);
        setGpsError(true);
        setGpsNote('Location permission is required. Allow GPS for this site and try again.');
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  };

  const save = async () => {
    const name = draft.name.trim();
    const latitude = Number(draft.latitude);
    const longitude = Number(draft.longitude);
    const radius = Number(draft.radius);
    if (!name || draft.latitude.trim() === '' || draft.longitude.trim() === '' || !Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isInteger(radius)) {
      addToast('Enter a site name, latitude, longitude, and a whole-metre radius.', 'error');
      return;
    }
    try {
      await punchSitesApi.create({ name, latitude, longitude, radius_meters: radius, active: true });
      setDraft({ name: '', latitude: '', longitude: '', radius: '100' });
      setGpsNote('');
      setGpsError(false);
      addToast(`${name} saved.`, 'success');
      load();
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'The punch site was not saved.', 'error');
    }
  };

  const toggle = async (site: PunchSiteRow) => {
    try {
      await punchSitesApi.update(site.id, {
        name: site.name,
        latitude: Number(site.latitude),
        longitude: Number(site.longitude),
        radius_meters: Number(site.radius_meters),
        active: !site.active,
      });
      load();
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'The punch site was not saved.', 'error');
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-3xl space-y-4">
      <div>
        <h3 className="font-semibold text-slate-800 mb-1">Punch sites</h3>
        <p className="text-sm text-slate-500">Stand at the site and allow location. The saved point is this device’s GPS. The radius is 30 to 300 metres.</p>
      </div>
      {sites.length === 0 && <p className="text-sm text-amber-700">No punch site is set. Phone punches stay blocked.</p>}
      {sites.map((site) => (
        <div key={site.id} className="flex flex-wrap items-center justify-between gap-3 border border-slate-200 rounded-lg px-3 py-2">
          <div>
            <p className="text-sm font-medium text-slate-800">{site.name}</p>
            <p className="text-xs text-slate-500">{Number(site.latitude).toFixed(5)}, {Number(site.longitude).toFixed(5)} · {site.radius_meters} m · {site.active ? 'Active' : 'Inactive'}</p>
          </div>
          <button type="button" onClick={() => toggle(site)} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-700">{site.active ? 'Deactivate' : 'Activate'}</button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={useHere} disabled={readingLocation} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-60">
          <MapPin size={14} /> {readingLocation ? 'Reading GPS…' : 'Use this location'}
        </button>
        {gpsNote && <p className={`text-sm ${gpsError ? 'text-red-600' : 'text-slate-600'}`}>{gpsNote}</p>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
          <input type="text" value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Site name" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Latitude</label>
          <input type="text" inputMode="decimal" value={draft.latitude} onChange={event => setDraft({ ...draft, latitude: event.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Longitude</label>
          <input type="text" inputMode="decimal" value={draft.longitude} onChange={event => setDraft({ ...draft, longitude: event.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Radius (metres)</label>
          <input type="number" min={30} max={300} step={1} value={draft.radius} onChange={event => setDraft({ ...draft, radius: event.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
        </div>
      </div>
      <button type="button" onClick={save} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
        <Save size={14} /> Save punch site
      </button>
    </div>
  );
}

const formatCurrency = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

const embedded = typeof window !== 'undefined' && window.__WOLF_HR_EMBEDDED__ === true;

function savedDepartment(row: { id: string; code: string; name: string; description?: string | null; is_active?: boolean }): Department {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description ?? '',
    isActive: row.is_active !== false,
  };
}

function savedPosition(row: { id: string; code: string; title: string; department_id: string; grade?: string | null; description?: string | null; is_active?: boolean }): Position {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    departmentId: row.department_id,
    grade: row.grade ?? '',
    description: row.description ?? '',
    isActive: row.is_active !== false,
  };
}

const configurationTabIcons: Record<string, ReactNode> = {
  departments: <Building2 size={16} />,
  positions: <Briefcase size={16} />,
  shifts: <Clock size={16} />,
  'leave-types': <CalendarDays size={16} />,
  'payroll-config': <Settings size={16} />,
  'payroll-configuration': <DollarSign size={16} />,
  office: <MapPin size={16} />,
};

export default function ConfigurationPage({ initialTab }: ConfigurationPageProps) {
  const { user } = useAuth();
  const {
    departments, setDepartments,
    positions, setPositions,
    shifts, setShifts,
    leaveTypes: allLeaveTypes, setLeaveTypes,
    payPolicy, setPayPolicy,
    payrollPeriods, workingPeriodId,
    addToast, addAuditLog,
  } = useApp();
  const tabs = visibleConfigurationTabs(user?.role).map((tab) => ({
    ...tab,
    icon: configurationTabIcons[tab.id],
  }));
  const [activeTab, setActiveTab] = useState(
    tabs.some((tab) => tab.id === initialTab) ? (initialTab || 'departments') : 'departments',
  );
  const workingPeriod = payrollPeriods.find(period => period.id === workingPeriodId) || payrollPeriods[0];
  const [windowYear, windowMonth] = (workingPeriod?.periodCode || '2026-01').split('-').map(Number);
  const payCycle = cycleForMonth(windowYear, windowMonth, payPolicy.cutoffDay, payPolicy.payDay);
  const formatDay = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const payWindow = `${formatDay(payCycle.startDate)} – ${formatDay(payCycle.endDate)} · pay ${formatDay(payCycle.payDate)} · cutoff ${payPolicy.cutoffDay}`;

  // Add state
  const [showAddDept, setShowAddDept] = useState(false);
  const [showAddPos, setShowAddPos] = useState(false);
  const [showAddShift, setShowAddShift] = useState(false);
  const [showAddLeave, setShowAddLeave] = useState(false);
  const [newDept, setNewDept] = useState({ code: '', name: '', description: '' });
  const [newPos, setNewPos] = useState({ code: '', title: '', departmentId: '', grade: '', description: '' });
  const [newShift, setNewShift] = useState({ code: '', name: '', startTime: '08:00', endTime: '17:00', breakMinutes: 60, crossesMidnight: false });
  const [newLeave, setNewLeave] = useState({ code: '', name: '', defaultEntitlement: 0, requiresAttachment: false, requiresApproval: true, isPaid: true, isActive: true });

  // Edit state
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [editingPos, setEditingPos] = useState<Position | null>(null);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [editingLeave, setEditingLeave] = useState<LeaveType | null>(null);
  const [editDeptData, setEditDeptData] = useState({ code: '', name: '', description: '' });
  const [editPosData, setEditPosData] = useState({ code: '', title: '', departmentId: '', grade: '', description: '' });
  const [editShiftData, setEditShiftData] = useState({ code: '', name: '', startTime: '', endTime: '', breakMinutes: 60, crossesMidnight: false });
  const [editLeaveData, setEditLeaveData] = useState({ code: '', name: '', defaultEntitlement: 0, requiresAttachment: false, requiresApproval: true, isPaid: true, isActive: true });

  const [highSeasonDraft, setHighSeasonDraft] = useState(payPolicy.highSeasonDates.join('\n'));

  // ============ DEPARTMENTS ============
  const handleAddDept = async () => {
    if (!newDept.code || !newDept.name) { addToast('Code and Name are required', 'error'); return; }
    if (embedded) {
      try {
        const created = await departmentsApi.create({ code: newDept.code, name: newDept.name, description: newDept.description || null });
        setDepartments(prev => [...prev, savedDepartment(created)]);
        addToast(`Department "${created.name}" saved for this company`, 'success');
        setShowAddDept(false);
        setNewDept({ code: '', name: '', description: '' });
      } catch {
        addToast('That department was not saved for this company.', 'error');
      }
      return;
    }
    const dept: Department = { id: 'd' + Date.now(), code: newDept.code, name: newDept.name, description: newDept.description, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setDepartments(prev => [...prev, dept]);
    addAuditLog('CREATE', 'Department', dept.id, `${dept.name} created`);
    addToast(`Department "${dept.name}" created`, 'success');
    setShowAddDept(false);
    setNewDept({ code: '', name: '', description: '' });
  };

  const handleSaveDept = async () => {
    if (!editingDept) return;
    if (!editDeptData.code || !editDeptData.name) { addToast('Code and Name are required', 'error'); return; }
    if (embedded) {
      try {
        const saved = await departmentsApi.update(editingDept.id, { code: editDeptData.code, name: editDeptData.name, description: editDeptData.description || null });
        setDepartments(prev => prev.map(d => d.id === editingDept.id ? savedDepartment(saved) : d));
        addToast(`Department "${saved.name}" saved for this company`, 'success');
        setEditingDept(null);
      } catch {
        addToast('That department was not saved for this company.', 'error');
      }
      return;
    }
    setDepartments(prev => prev.map(d => d.id === editingDept.id ? { ...d, code: editDeptData.code, name: editDeptData.name, description: editDeptData.description, updatedAt: new Date().toISOString() } : d));
    addAuditLog('UPDATE', 'Department', editingDept.id, `${editingDept.name} updated`);
    addToast(`Department "${editDeptData.name}" updated`, 'success');
    setEditingDept(null);
  };

  const handleDeleteDept = async (id: string) => {
    if (!window.confirm('Delete this department? This cannot be undone.')) return;
    const dept = departments.find(d => d.id === id);
    if (embedded) {
      try {
        await departmentsApi.delete(id);
        setDepartments(prev => prev.filter(d => d.id !== id));
        addToast(`Department "${dept?.name}" removed from this company`, 'success');
      } catch {
        addToast('That department was not removed from this company.', 'error');
      }
      return;
    }
    setDepartments(prev => prev.filter(d => d.id !== id));
    addAuditLog('DELETE', 'Department', id, `${dept?.name} deleted`);
    addToast(`Department "${dept?.name}" deleted`, 'success');
  };

  // ============ POSITIONS ============
  const handleAddPos = async () => {
    if (!newPos.code || !newPos.title || !newPos.departmentId) { addToast('Code, Title, and Department are required', 'error'); return; }
    if (embedded) {
      try {
        const created = await positionsApi.create({ code: newPos.code, title: newPos.title, department_id: newPos.departmentId, grade: newPos.grade || null, description: newPos.description || null });
        setPositions(prev => [...prev, savedPosition(created)]);
        addToast(`Position "${created.title}" saved for this company`, 'success');
        setShowAddPos(false);
        setNewPos({ code: '', title: '', departmentId: '', grade: '', description: '' });
      } catch {
        addToast('That position was not saved for this company.', 'error');
      }
      return;
    }
    const pos: Position = { id: 'p' + Date.now(), code: newPos.code, title: newPos.title, departmentId: newPos.departmentId, grade: newPos.grade || 'S1', description: newPos.description, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setPositions(prev => [...prev, pos]);
    addAuditLog('CREATE', 'Position', pos.id, `${pos.title} created`);
    addToast(`Position "${pos.title}" created`, 'success');
    setShowAddPos(false);
    setNewPos({ code: '', title: '', departmentId: '', grade: '', description: '' });
  };

  const handleSavePos = async () => {
    if (!editingPos) return;
    if (!editPosData.code || !editPosData.title || !editPosData.departmentId) { addToast('Code, Title, and Department are required', 'error'); return; }
    if (embedded) {
      try {
        const saved = await positionsApi.update(editingPos.id, { code: editPosData.code, title: editPosData.title, department_id: editPosData.departmentId, grade: editPosData.grade || null, description: editPosData.description || null });
        setPositions(prev => prev.map(p => p.id === editingPos.id ? savedPosition(saved) : p));
        addToast(`Position "${saved.title}" saved for this company`, 'success');
        setEditingPos(null);
      } catch {
        addToast('That position was not saved for this company.', 'error');
      }
      return;
    }
    setPositions(prev => prev.map(p => p.id === editingPos.id ? { ...p, code: editPosData.code, title: editPosData.title, departmentId: editPosData.departmentId, grade: editPosData.grade, description: editPosData.description, updatedAt: new Date().toISOString() } : p));
    addAuditLog('UPDATE', 'Position', editingPos.id, `${editingPos.title} updated`);
    addToast(`Position "${editPosData.title}" updated`, 'success');
    setEditingPos(null);
  };

  const handleDeletePos = async (id: string) => {
    if (!window.confirm('Delete this position? This cannot be undone.')) return;
    const pos = positions.find(p => p.id === id);
    if (embedded) {
      try {
        await positionsApi.delete(id);
        setPositions(prev => prev.filter(p => p.id !== id));
        addToast(`Position "${pos?.title}" removed from this company`, 'success');
      } catch {
        addToast('That position was not removed from this company.', 'error');
      }
      return;
    }
    setPositions(prev => prev.filter(p => p.id !== id));
    addAuditLog('DELETE', 'Position', id, `${pos?.title} deleted`);
    addToast(`Position "${pos?.title}" deleted`, 'success');
  };

  // ============ SHIFTS ============
  const handleAddShift = () => {
    if (!newShift.code || !newShift.name) { addToast('Code and Name are required', 'error'); return; }
    const shift: Shift = { id: 's' + Date.now(), code: newShift.code, name: newShift.name, startTime: newShift.startTime, endTime: newShift.endTime, breakMinutes: newShift.breakMinutes, crossesMidnight: newShift.crossesMidnight, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setShifts(prev => [...prev, shift]);
    addAuditLog('CREATE', 'Shift', shift.id, `${shift.name} created`);
    addToast(`Shift "${shift.name}" created`, 'success');
    setShowAddShift(false);
    setNewShift({ code: '', name: '', startTime: '08:00', endTime: '17:00', breakMinutes: 60, crossesMidnight: false });
  };

  const handleSaveShift = () => {
    if (!editingShift) return;
    if (!editShiftData.code || !editShiftData.name) { addToast('Code and Name are required', 'error'); return; }
    setShifts(prev => prev.map(s => s.id === editingShift.id ? { ...s, code: editShiftData.code, name: editShiftData.name, startTime: editShiftData.startTime, endTime: editShiftData.endTime, breakMinutes: editShiftData.breakMinutes, crossesMidnight: editShiftData.crossesMidnight, updatedAt: new Date().toISOString() } : s));
    addAuditLog('UPDATE', 'Shift', editingShift.id, `${editingShift.name} updated`);
    addToast(`Shift "${editShiftData.name}" updated`, 'success');
    setEditingShift(null);
  };

  const handleDeleteShift = (id: string) => {
    if (!window.confirm('Delete this shift? This cannot be undone.')) return;
    const shift = shifts.find(s => s.id === id);
    setShifts(prev => prev.filter(s => s.id !== id));
    addAuditLog('DELETE', 'Shift', id, `${shift?.name} deleted`);
    addToast(`Shift "${shift?.name}" deleted`, 'success');
  };

  // ============ LEAVE TYPES ============
  const handleAddLeave = () => {
    if (!newLeave.code || !newLeave.name) { addToast('Code and Name are required', 'error'); return; }
    const lt: LeaveType = { id: 'lt' + Date.now(), code: newLeave.code, name: newLeave.name, defaultEntitlement: newLeave.defaultEntitlement, requiresAttachment: newLeave.requiresAttachment, requiresApproval: newLeave.requiresApproval, isPaid: newLeave.isPaid, isActive: newLeave.isActive, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setLeaveTypes(prev => [...prev, lt]);
    addAuditLog('CREATE', 'LeaveType', lt.id, `${lt.name} created`);
    addToast(`Leave type "${lt.name}" created`, 'success');
    setShowAddLeave(false);
    setNewLeave({ code: '', name: '', defaultEntitlement: 0, requiresAttachment: false, requiresApproval: true, isPaid: true, isActive: true });
  };

  const handleSaveLeave = () => {
    if (!editingLeave) return;
    if (!editLeaveData.code || !editLeaveData.name) { addToast('Code and Name are required', 'error'); return; }
    setLeaveTypes((prev: LeaveType[]) => prev.map((lt: LeaveType) => lt.id === editingLeave.id ? { ...lt, code: editLeaveData.code, name: editLeaveData.name, defaultEntitlement: editLeaveData.defaultEntitlement, requiresAttachment: editLeaveData.requiresAttachment, requiresApproval: editLeaveData.requiresApproval, isPaid: editLeaveData.isPaid, isActive: editLeaveData.isActive, updatedAt: new Date().toISOString() } : lt));
    addAuditLog('UPDATE', 'LeaveType', editingLeave.id, `${editingLeave.name} updated`);
    addToast(`Leave type "${editLeaveData.name}" updated`, 'success');
    setEditingLeave(null);
  };

  const handleDeleteLeave = (id: string) => {
    if (!window.confirm('Delete this leave type? This cannot be undone.')) return;
    const lt = allLeaveTypes.find((l: LeaveType) => l.id === id);
    setLeaveTypes((prev: LeaveType[]) => prev.filter((l: LeaveType) => l.id !== id));
    addAuditLog('DELETE', 'LeaveType', id, `${lt?.name} deleted`);
    addToast(`Leave type "${lt?.name}" deleted`, 'success');
  };

  const handleSavePayrollConfig = () => {
    const dates = highSeasonDraft.split(/[\s,]+/).map(date => date.trim()).filter(Boolean);
    setPayPolicy(prev => ({ ...prev, highSeasonDates: dates }));
    addAuditLog('UPDATE', 'Configuration', 'payroll', `Pay policy saved: cutoff=${payPolicy.cutoffDay}, pay day=${payPolicy.payDay}, service charge pay day=${payPolicy.serviceChargePayDay}, service charge=${payPolicy.serviceChargePercentage}%`);
    addToast('Pay policy saved. Payroll, leave, overtime, and service charge read these settings.', 'success');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Settings size={24} className="text-indigo-600" /> Configuration</h1>
        <p className="text-slate-500 text-sm mt-1">Manage departments, positions, shifts, leave types, punch sites, payroll parameters, and regulatory settings</p>
      </div>
      {(activeTab === 'departments' || activeTab === 'positions' || activeTab === 'shifts') && (
        <div className="flex justify-end">
          <BulkUploadButton module={activeTab} />
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-2">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${activeTab === t.id ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ============ DEPARTMENTS ============ */}
      {activeTab === 'departments' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-800">Departments</h3>
              {embedded && departments.length === 0 && <p className="text-xs text-slate-500 mt-1">No departments are recorded for this company. Existing unassigned departments stay hidden.</p>}
            </div>
            <button onClick={() => setShowAddDept(true)} className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"><Plus size={14} /> Add Department</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Code</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Description</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Status</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {departments.map(d => (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-mono text-slate-600">{d.code}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-800">{d.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{d.description || '-'}</td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded font-medium ${d.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{d.isActive ? 'Active' : 'Inactive'}</span></td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => { setEditingDept(d); setEditDeptData({ code: d.code, name: d.name, description: d.description || '' }); }} className="text-xs px-2 py-1 text-indigo-600 hover:text-indigo-800 underline underline-offset-4">Edit</button>
                      <button onClick={() => handleDeleteDept(d.id)} className="text-xs px-2 py-1 text-red-600 hover:text-red-800 underline underline-offset-4 ml-2">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============ POSITIONS ============ */}
      {activeTab === 'positions' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Positions</h3>
            <button onClick={() => setShowAddPos(true)} className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"><Plus size={14} /> Add Position</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Code</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Title</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Department</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Grade</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {positions.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-mono text-slate-600">{p.code}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-800">{p.title}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{departments.find(d => d.id === p.departmentId)?.name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{p.grade}</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => { setEditingPos(p); setEditPosData({ code: p.code, title: p.title, departmentId: p.departmentId, grade: p.grade, description: p.description || '' }); }} className="text-xs px-2 py-1 text-indigo-600 hover:text-indigo-800 underline underline-offset-4">Edit</button>
                      <button onClick={() => handleDeletePos(p.id)} className="text-xs px-2 py-1 text-red-600 hover:text-red-800 underline underline-offset-4 ml-2">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============ SHIFTS ============ */}
      {activeTab === 'shifts' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Shift Definitions</h3>
            <button onClick={() => setShowAddShift(true)} className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"><Plus size={14} /> Add Shift</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Code</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Start</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">End</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Break</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shifts.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-mono text-slate-600">{s.code}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-800">{s.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{s.startTime}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{s.endTime}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{s.breakMinutes} min</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => { setEditingShift(s); setEditShiftData({ code: s.code, name: s.name, startTime: s.startTime, endTime: s.endTime, breakMinutes: s.breakMinutes, crossesMidnight: s.crossesMidnight }); }} className="text-xs px-2 py-1 text-indigo-600 hover:text-indigo-800 underline underline-offset-4">Edit</button>
                      <button onClick={() => handleDeleteShift(s.id)} className="text-xs px-2 py-1 text-red-600 hover:text-red-800 underline underline-offset-4 ml-2">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============ LEAVE TYPES ============ */}
      {activeTab === 'leave-types' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Leave Types</h3>
            <p className="text-xs text-slate-500 mt-1">Read by leave requests and payroll. Unpaid types reduce net pay.</p>
            <button onClick={() => setShowAddLeave(true)} className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"><Plus size={14} /> Add Leave Type</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Code</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Name</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">Default Entitlement</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Paid</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Approval Required</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allLeaveTypes.map((lt: LeaveType) => (
                  <tr key={lt.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-mono text-slate-600">{lt.code}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-800">{lt.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 text-right">{lt.defaultEntitlement} days</td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded font-medium ${lt.isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{lt.isPaid ? 'Paid' : 'Unpaid'}</span></td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded font-medium ${lt.requiresApproval ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{lt.requiresApproval ? 'Yes' : 'No'}</span></td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => { setEditingLeave(lt); setEditLeaveData({ code: lt.code, name: lt.name, defaultEntitlement: lt.defaultEntitlement, requiresAttachment: lt.requiresAttachment, requiresApproval: lt.requiresApproval, isPaid: lt.isPaid, isActive: lt.isActive }); }} className="text-xs px-2 py-1 text-indigo-600 hover:text-indigo-800 underline underline-offset-4">Edit</button>
                      <button onClick={() => handleDeleteLeave(lt.id)} className="text-xs px-2 py-1 text-red-600 hover:text-red-800 underline underline-offset-4 ml-2">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============ PAYROLL CONFIG ============ */}
      {activeTab === 'payroll-config' && (
        <div className="space-y-6">
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-sm text-indigo-800">
            Payroll reads basic salary and fixed allowance from each payroll record, and overtime from approved requests. Service charge is paid on its own mid-month date and is not added to salary. BPJS and PPh 21 come from Compliance. These fields are the pay policy those screens share.
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-800 mb-1">Pay policy</h3>
            <p className="text-xs text-slate-500 mb-4">Read by payroll, overtime, leave, service charge, and the compliance calendar. {payWindow}. Finalized months keep the dates they were saved with.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Payroll cutoff day</label>
                <input type="number" value={payPolicy.cutoffDay} min={1} max={28} onChange={e => setPayPolicy({ ...payPolicy, cutoffDay: parseInt(e.target.value) || 25 })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                <p className="text-xs text-slate-500 mt-1">The pay month ends on this day. It starts the day after this day in the previous month.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Payment day</label>
                <input type="number" value={payPolicy.payDay} min={1} max={28} onChange={e => setPayPolicy({ ...payPolicy, payDay: parseInt(e.target.value) || 5 })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                <p className="text-xs text-slate-500 mt-1">Salary is paid on this day of the following month.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Service charge pay day</label>
                <input type="number" value={payPolicy.serviceChargePayDay} min={1} max={28} onChange={e => setPayPolicy({ ...payPolicy, serviceChargePayDay: parseInt(e.target.value) || 15 })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                <p className="text-xs text-slate-500 mt-1">Service charge is paid on this day of the same month as salary, not on the salary pay day.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Default service charge %</label>
                <input type="number" value={payPolicy.serviceChargePercentage} step={0.1} onChange={e => setPayPolicy({ ...payPolicy, serviceChargePercentage: parseFloat(e.target.value) || 10 })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Weekday first hour</label>
                <input type="number" value={payPolicy.otWeekdayFirst} step={0.1} onChange={e => setPayPolicy({ ...payPolicy, otWeekdayFirst: parseFloat(e.target.value) || 1.5 })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Weekday next hours</label>
                <input type="number" value={payPolicy.otWeekdayNext} step={0.1} onChange={e => setPayPolicy({ ...payPolicy, otWeekdayNext: parseFloat(e.target.value) || 2 })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Holiday hours 1–7</label>
                <input type="number" value={payPolicy.otHolidayFirst} step={0.1} onChange={e => setPayPolicy({ ...payPolicy, otHolidayFirst: parseFloat(e.target.value) || 2 })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Holiday 8th hour</label>
                <input type="number" value={payPolicy.otHolidayEighth} step={0.1} onChange={e => setPayPolicy({ ...payPolicy, otHolidayEighth: parseFloat(e.target.value) || 3 })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Holiday 9th hour onward</label>
                <input type="number" value={payPolicy.otHolidayAfter} step={0.1} onChange={e => setPayPolicy({ ...payPolicy, otHolidayAfter: parseFloat(e.target.value) || 4 })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">BPJS due day</label>
                <input type="number" value={payPolicy.bpjsDueDay} min={1} max={28} onChange={e => setPayPolicy({ ...payPolicy, bpjsDueDay: parseInt(e.target.value) || 15 })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">PPh 21 due day</label>
                <input type="number" value={payPolicy.pphDueDay} min={1} max={28} onChange={e => setPayPolicy({ ...payPolicy, pphDueDay: parseInt(e.target.value) || 10 })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div className="md:col-span-3">
                <label className="block text-sm font-medium text-slate-700 mb-1">High-season dates</label>
                <p className="text-xs text-slate-500 mb-1">One YYYY-MM-DD per line. Leave blocks these dates while the high-season rule is active. Overtime on these dates uses holiday factors.</p>
                <textarea value={highSeasonDraft} onChange={e => setHighSeasonDraft(e.target.value)} rows={4} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono" />
              </div>
              <div className="md:col-span-3">
                <button onClick={handleSavePayrollConfig} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
                  <Save size={14} /> Save pay policy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'payroll-configuration' && <PayrollStructurePage />}

      {activeTab === 'office' && <PunchSitesPanel addToast={addToast} />}

      {/* ============ ADD MODALS ============ */}
      {/* Add Department Modal */}
      <Modal isOpen={showAddDept} onClose={() => setShowAddDept(false)} title="Add Department">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Code *</label>
            <input type="text" value={newDept.code} onChange={e => setNewDept({...newDept, code: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="e.g. IT" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
            <input type="text" value={newDept.name} onChange={e => setNewDept({...newDept, name: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="e.g. Information Technology" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea value={newDept.description} onChange={e => setNewDept({...newDept, description: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" rows={3} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowAddDept(false)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={handleAddDept} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Create Department</button>
          </div>
        </div>
      </Modal>

      {/* Edit Department Modal */}
      <Modal isOpen={!!editingDept} onClose={() => setEditingDept(null)} title="Edit Department">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Code *</label>
            <input type="text" value={editDeptData.code} onChange={e => setEditDeptData({...editDeptData, code: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
            <input type="text" value={editDeptData.name} onChange={e => setEditDeptData({...editDeptData, name: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea value={editDeptData.description} onChange={e => setEditDeptData({...editDeptData, description: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" rows={3} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setEditingDept(null)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={handleSaveDept} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Save Changes</button>
          </div>
        </div>
      </Modal>

      {/* Add Position Modal */}
      <Modal isOpen={showAddPos} onClose={() => setShowAddPos(false)} title="Add Position">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Code *</label>
              <input type="text" value={newPos.code} onChange={e => setNewPos({...newPos, code: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Grade</label>
              <input type="text" value={newPos.grade} onChange={e => setNewPos({...newPos, grade: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="e.g. S1, M2" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
            <input type="text" value={newPos.title} onChange={e => setNewPos({...newPos, title: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Department *</label>
            <select value={newPos.departmentId} onChange={e => setNewPos({...newPos, departmentId: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option value="">Select Department</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea value={newPos.description} onChange={e => setNewPos({...newPos, description: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" rows={3} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowAddPos(false)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={handleAddPos} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Create Position</button>
          </div>
        </div>
      </Modal>

      {/* Edit Position Modal */}
      <Modal isOpen={!!editingPos} onClose={() => setEditingPos(null)} title="Edit Position">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Code *</label>
              <input type="text" value={editPosData.code} onChange={e => setEditPosData({...editPosData, code: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Grade</label>
              <input type="text" value={editPosData.grade} onChange={e => setEditPosData({...editPosData, grade: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
            <input type="text" value={editPosData.title} onChange={e => setEditPosData({...editPosData, title: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Department *</label>
            <select value={editPosData.departmentId} onChange={e => setEditPosData({...editPosData, departmentId: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option value="">Select Department</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea value={editPosData.description} onChange={e => setEditPosData({...editPosData, description: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" rows={3} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setEditingPos(null)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={handleSavePos} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Save Changes</button>
          </div>
        </div>
      </Modal>

      {/* Add Shift Modal */}
      <Modal isOpen={showAddShift} onClose={() => setShowAddShift(false)} title="Add Shift">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Code *</label>
              <input type="text" value={newShift.code} onChange={e => setNewShift({...newShift, code: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
              <input type="text" value={newShift.name} onChange={e => setNewShift({...newShift, name: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Start Time</label>
              <input type="time" value={newShift.startTime} onChange={e => setNewShift({...newShift, startTime: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">End Time</label>
              <input type="time" value={newShift.endTime} onChange={e => setNewShift({...newShift, endTime: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Break (minutes)</label>
              <input type="number" value={newShift.breakMinutes} onChange={e => setNewShift({...newShift, breakMinutes: parseInt(e.target.value)})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={newShift.crossesMidnight} onChange={e => setNewShift({...newShift, crossesMidnight: e.target.checked})} className="rounded border-slate-300" />
                Crosses Midnight
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowAddShift(false)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={handleAddShift} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Create Shift</button>
          </div>
        </div>
      </Modal>

      {/* Edit Shift Modal */}
      <Modal isOpen={!!editingShift} onClose={() => setEditingShift(null)} title="Edit Shift">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Code *</label>
              <input type="text" value={editShiftData.code} onChange={e => setEditShiftData({...editShiftData, code: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
              <input type="text" value={editShiftData.name} onChange={e => setEditShiftData({...editShiftData, name: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Start Time</label>
              <input type="time" value={editShiftData.startTime} onChange={e => setEditShiftData({...editShiftData, startTime: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">End Time</label>
              <input type="time" value={editShiftData.endTime} onChange={e => setEditShiftData({...editShiftData, endTime: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Break (minutes)</label>
              <input type="number" value={editShiftData.breakMinutes} onChange={e => setEditShiftData({...editShiftData, breakMinutes: parseInt(e.target.value)})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={editShiftData.crossesMidnight} onChange={e => setEditShiftData({...editShiftData, crossesMidnight: e.target.checked})} className="rounded border-slate-300" />
                Crosses Midnight
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setEditingShift(null)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={handleSaveShift} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Save Changes</button>
          </div>
        </div>
      </Modal>

      {/* Add Leave Type Modal */}
      <Modal isOpen={showAddLeave} onClose={() => setShowAddLeave(false)} title="Add Leave Type">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Code *</label>
            <input type="text" value={newLeave.code} onChange={e => setNewLeave({...newLeave, code: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="e.g. AL" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
            <input type="text" value={newLeave.name} onChange={e => setNewLeave({...newLeave, name: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="e.g. Annual Leave" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Default Entitlement (days)</label>
              <input type="number" value={newLeave.defaultEntitlement} onChange={e => setNewLeave({...newLeave, defaultEntitlement: parseInt(e.target.value) || 0})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Is Paid</label>
              <select value={newLeave.isPaid ? 'true' : 'false'} onChange={e => setNewLeave({...newLeave, isPaid: e.target.value === 'true'})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Approval Required</label>
              <select value={newLeave.requiresApproval ? 'true' : 'false'} onChange={e => setNewLeave({...newLeave, requiresApproval: e.target.value === 'true'})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Attachment Required</label>
              <select value={newLeave.requiresAttachment ? 'true' : 'false'} onChange={e => setNewLeave({...newLeave, requiresAttachment: e.target.value === 'true'})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowAddLeave(false)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={handleAddLeave} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Create Leave Type</button>
          </div>
        </div>
      </Modal>

      {/* Edit Leave Type Modal */}
      <Modal isOpen={!!editingLeave} onClose={() => setEditingLeave(null)} title="Edit Leave Type">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Code *</label>
            <input type="text" value={editLeaveData.code} onChange={e => setEditLeaveData({...editLeaveData, code: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
            <input type="text" value={editLeaveData.name} onChange={e => setEditLeaveData({...editLeaveData, name: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Default Entitlement (days)</label>
              <input type="number" value={editLeaveData.defaultEntitlement} onChange={e => setEditLeaveData({...editLeaveData, defaultEntitlement: parseInt(e.target.value) || 0})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Is Paid</label>
              <select value={editLeaveData.isPaid ? 'true' : 'false'} onChange={e => setEditLeaveData({...editLeaveData, isPaid: e.target.value === 'true'})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Approval Required</label>
              <select value={editLeaveData.requiresApproval ? 'true' : 'false'} onChange={e => setEditLeaveData({...editLeaveData, requiresApproval: e.target.value === 'true'})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Attachment Required</label>
              <select value={editLeaveData.requiresAttachment ? 'true' : 'false'} onChange={e => setEditLeaveData({...editLeaveData, requiresAttachment: e.target.value === 'true'})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setEditingLeave(null)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={handleSaveLeave} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Save Changes</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
