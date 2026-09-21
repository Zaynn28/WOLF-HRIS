import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { departments as initDepts, positions as initPositions, shifts as initShifts, leaveTypes } from '../data/mockData';
import { Settings, Building2, Briefcase, Clock, CalendarDays, Save, Plus } from 'lucide-react';
import Modal from '../components/Modal';

interface ConfigurationPageProps { initialTab?: string; }

export default function ConfigurationPage({ initialTab }: ConfigurationPageProps) {
  const { departments, setDepartments, positions, setPositions, shifts, setShifts, addToast, addAuditLog } = useApp();
  const [activeTab, setActiveTab] = useState(initialTab || 'departments');
  const [showAddDept, setShowAddDept] = useState(false);
  const [showAddPos, setShowAddPos] = useState(false);
  const [showAddShift, setShowAddShift] = useState(false);
  const [newDept, setNewDept] = useState({ code: '', name: '', description: '' });
  const [newPos, setNewPos] = useState({ code: '', title: '', departmentId: '', grade: '', description: '' });
  const [newShift, setNewShift] = useState({ code: '', name: '', startTime: '08:00', endTime: '17:00', breakMinutes: 60, crossesMidnight: false });

  const tabs = [
    { id: 'departments', label: 'Departments', icon: <Building2 size={16} /> },
    { id: 'positions', label: 'Positions', icon: <Briefcase size={16} /> },
    { id: 'shifts', label: 'Shifts', icon: <Clock size={16} /> },
    { id: 'leave-types', label: 'Leave Types', icon: <CalendarDays size={16} /> },
    { id: 'payroll-config', label: 'Payroll Config', icon: <Settings size={16} /> },
  ];

  const handleAddDept = () => {
    if (!newDept.code || !newDept.name) { addToast('Code and Name are required', 'error'); return; }
    const dept = { id: 'd' + Date.now(), code: newDept.code, name: newDept.name, description: newDept.description, isActive: true };
    setDepartments(prev => [...prev, dept]);
    addAuditLog('CREATE', 'Department', dept.id, `${dept.name} created`);
    addToast(`Department "${dept.name}" created`, 'success');
    setShowAddDept(false);
    setNewDept({ code: '', name: '', description: '' });
  };

  const handleAddPos = () => {
    if (!newPos.code || !newPos.title || !newPos.departmentId) { addToast('Code, Title, and Department are required', 'error'); return; }
    const pos = { id: 'p' + Date.now(), code: newPos.code, title: newPos.title, departmentId: newPos.departmentId, grade: newPos.grade || 'S1', description: newPos.description, isActive: true };
    setPositions(prev => [...prev, pos]);
    addAuditLog('CREATE', 'Position', pos.id, `${pos.title} created`);
    addToast(`Position "${pos.title}" created`, 'success');
    setShowAddPos(false);
    setNewPos({ code: '', title: '', departmentId: '', grade: '', description: '' });
  };

  const handleAddShift = () => {
    if (!newShift.code || !newShift.name) { addToast('Code and Name are required', 'error'); return; }
    const shift = { id: 's' + Date.now(), code: newShift.code, name: newShift.name, startTime: newShift.startTime, endTime: newShift.endTime, breakMinutes: newShift.breakMinutes, crossesMidnight: newShift.crossesMidnight, isActive: true };
    setShifts(prev => [...prev, shift]);
    addAuditLog('CREATE', 'Shift', shift.id, `${shift.name} created`);
    addToast(`Shift "${shift.name}" created`, 'success');
    setShowAddShift(false);
    setNewShift({ code: '', name: '', startTime: '08:00', endTime: '17:00', breakMinutes: 60, crossesMidnight: false });
  };

  const handleSavePayrollConfig = () => {
    addAuditLog('UPDATE', 'Configuration', 'payroll', 'Payroll configuration updated');
    addToast('Payroll configuration saved successfully', 'success');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Settings size={24} className="text-indigo-600" /> Configuration</h1>
        <p className="text-slate-500 text-sm mt-1">Manage system settings and organizational structure</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${activeTab === t.id ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'departments' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Departments</h3>
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
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {departments.map(d => (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-mono text-slate-600">{d.code}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-800">{d.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{d.description}</td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded font-medium ${d.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{d.isActive ? 'Active' : 'Inactive'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {positions.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-mono text-slate-600">{p.code}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-800">{p.title}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{departments.find(d => d.id === p.departmentId)?.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{p.grade}</td>
                    <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded font-medium bg-emerald-100 text-emerald-700">Active</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Crosses Midnight</th>
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
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded font-medium ${s.crossesMidnight ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{s.crossesMidnight ? 'Yes' : 'No'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'leave-types' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200"><h3 className="font-semibold text-slate-800">Leave Types</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Code</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Default Entitlement</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Paid</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leaveTypes.map(lt => (
                  <tr key={lt.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-mono text-slate-600">{lt.code}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-800">{lt.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{lt.defaultEntitlement} days</td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded font-medium ${lt.isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{lt.isPaid ? 'Paid' : 'Unpaid'}</span></td>
                    <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded font-medium bg-emerald-100 text-emerald-700">Active</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'payroll-config' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-800 mb-4">Payroll Components</h3>
            <p className="text-sm text-slate-500 mb-4">Configure salary components used in payroll calculation.</p>
            <div className="space-y-3">
              {[
                { code: 'BASIC_SALARY', name: 'Basic Salary', category: 'Earning' },
                { code: 'ALLOWANCE', name: 'Position Allowance', category: 'Earning' },
                { code: 'OVERTIME', name: 'Overtime Pay', category: 'Earning' },
                { code: 'SERVICE_CHARGE', name: 'Service Charge', category: 'Earning' },
                { code: 'BPJS_KES', name: 'BPJS Kesehatan', category: 'Deduction' },
                { code: 'BPJS_TK', name: 'BPJS Ketenagakerjaan', category: 'Deduction' },
                { code: 'PPH21', name: 'PPh 21 (Income Tax)', category: 'Deduction' },
              ].map(comp => (
                <div key={comp.code} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono bg-slate-200 px-2 py-0.5 rounded text-slate-600">{comp.code}</span>
                    <span className="text-sm text-slate-700">{comp.name}</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${comp.category === 'Earning' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{comp.category}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-800 mb-4">Payroll Parameters</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Payroll Cutoff Date</label>
                <input type="number" defaultValue={25} min={1} max={28} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Payment Date</label>
                <input type="number" defaultValue={5} min={1} max={28} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Overtime Multiplier (Weekday)</label>
                <input type="number" defaultValue={1.5} step={0.1} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Overtime Multiplier (Weekend/Holiday)</label>
                <input type="number" defaultValue={2.0} step={0.1} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
            </div>
            <button onClick={handleSavePayrollConfig} className="mt-4 flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
              <Save size={14} /> Save Configuration
            </button>
          </div>
        </div>
      )}

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
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowAddPos(false)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={handleAddPos} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Create Position</button>
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
    </div>
  );
}
