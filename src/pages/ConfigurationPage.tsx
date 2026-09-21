import { useState } from 'react';
import { departments, positions, shifts, leaveTypes } from '../data/mockData';
import { Settings, Building2, Briefcase, Clock, CalendarDays, Save } from 'lucide-react';

export default function ConfigurationPage() {
  const [activeTab, setActiveTab] = useState('departments');

  const tabs = [
    { id: 'departments', label: 'Departments', icon: <Building2 size={16} /> },
    { id: 'positions', label: 'Positions', icon: <Briefcase size={16} /> },
    { id: 'shifts', label: 'Shifts', icon: <Clock size={16} /> },
    { id: 'leave-types', label: 'Leave Types', icon: <CalendarDays size={16} /> },
    { id: 'payroll-config', label: 'Payroll Config', icon: <Settings size={16} /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Settings size={24} className="text-indigo-600" /> Configuration
        </h1>
        <p className="text-slate-500 text-sm mt-1">Manage system settings and organizational structure</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === t.id ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Departments */}
      {activeTab === 'departments' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Departments</h3>
            <button className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">+ Add Department</button>
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
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${d.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                        {d.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Positions */}
      {activeTab === 'positions' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Positions</h3>
            <button className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">+ Add Position</button>
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
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded font-medium bg-emerald-100 text-emerald-700">Active</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Shifts */}
      {activeTab === 'shifts' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Shift Definitions</h3>
            <button className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">+ Add Shift</button>
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
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${s.crossesMidnight ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                        {s.crossesMidnight ? 'Yes' : 'No'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Leave Types */}
      {activeTab === 'leave-types' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Leave Types</h3>
            <button className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">+ Add Leave Type</button>
          </div>
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
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${lt.isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                        {lt.isPaid ? 'Paid' : 'Unpaid'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded font-medium bg-emerald-100 text-emerald-700">Active</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payroll Config */}
      {activeTab === 'payroll-config' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-800 mb-4">Payroll Components</h3>
            <p className="text-sm text-slate-500 mb-4">Configure salary components used in payroll calculation. Rates and rules are configurable.</p>
            <div className="space-y-3">
              {[
                { code: 'BASIC_SALARY', name: 'Basic Salary', category: 'Earning', configurable: true },
                { code: 'ALLOWANCE', name: 'Position Allowance', category: 'Earning', configurable: true },
                { code: 'OVERTIME', name: 'Overtime Pay', category: 'Earning', configurable: true },
                { code: 'SERVICE_CHARGE', name: 'Service Charge', category: 'Earning', configurable: true },
                { code: 'BPJS_KES', name: 'BPJS Kesehatan', category: 'Deduction', configurable: true },
                { code: 'BPJS_TK', name: 'BPJS Ketenagakerjaan', category: 'Deduction', configurable: true },
                { code: 'PPH21', name: 'PPh 21 (Income Tax)', category: 'Deduction', configurable: true },
              ].map(comp => (
                <div key={comp.code} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono bg-slate-200 px-2 py-0.5 rounded text-slate-600">{comp.code}</span>
                    <span className="text-sm text-slate-700">{comp.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${comp.category === 'Earning' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {comp.category}
                    </span>
                    <button className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">Configure</button>
                  </div>
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
                <p className="text-xs text-slate-400 mt-1">Day of month when payroll period ends</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Payment Date</label>
                <input type="number" defaultValue={5} min={1} max={28} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                <p className="text-xs text-slate-400 mt-1">Day of following month for salary payment</p>
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
            <button className="mt-4 flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
              <Save size={14} /> Save Configuration
            </button>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm text-amber-800">
              <strong>Note:</strong> Tax rates (PPh 21), BPJS contribution rates, and other regulatory parameters must be configured 
              according to current regulations. Changes to these settings require authorized approval and will not retroactively 
              affect finalized payroll periods.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
