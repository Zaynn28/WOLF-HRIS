import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Shield, Search, Filter, AlertTriangle, Download } from 'lucide-react';

export default function AuditPage() {
  const { auditLogs, addToast } = useApp();
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const filtered = auditLogs.filter(log => {
    const matchSearch = log.userName.toLowerCase().includes(search.toLowerCase()) ||
      log.entityType.toLowerCase().includes(search.toLowerCase()) ||
      log.action.toLowerCase().includes(search.toLowerCase());
    const matchAction = !actionFilter || log.action === actionFilter;
    return matchSearch && matchAction;
  });

  const actionColor = (action: string) => {
    switch(action) {
      case 'CREATE': return 'bg-emerald-100 text-emerald-700';
      case 'UPDATE': return 'bg-blue-100 text-blue-700';
      case 'APPROVE': return 'bg-indigo-100 text-indigo-700';
      case 'FINALIZE': return 'bg-purple-100 text-purple-700';
      case 'CALCULATE': return 'bg-amber-100 text-amber-700';
      case 'ALERT': return 'bg-rose-100 text-rose-700';
      case 'UPLOAD': return 'bg-teal-100 text-teal-700';
      case 'DELETE': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Shield size={24} className="text-indigo-600" /> Controls & Audit
          </h1>
          <p className="text-slate-500 text-sm mt-1">System activity log and compliance tracking</p>
        </div>
        <button onClick={() => addToast('Audit log exported successfully', 'success')} className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 text-sm font-medium">
          <Download size={16} /> Export Log
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Total Events</p>
          <p className="text-2xl font-bold text-slate-800">{auditLogs.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Approvals</p>
          <p className="text-2xl font-bold text-indigo-600">{auditLogs.filter(l => l.action === 'APPROVE').length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Alerts</p>
          <p className="text-2xl font-bold text-rose-600">{auditLogs.filter(l => l.action === 'ALERT').length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Finalizations</p>
          <p className="text-2xl font-bold text-purple-600">{auditLogs.filter(l => l.action === 'FINALIZE').length}</p>
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
            placeholder="Search audit logs..."
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-slate-400" />
          <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm">
            <option value="">All Actions</option>
            <option value="CREATE">Create</option>
            <option value="UPDATE">Update</option>
            <option value="APPROVE">Approve</option>
            <option value="FINALIZE">Finalize</option>
            <option value="CALCULATE">Calculate</option>
            <option value="ALERT">Alert</option>
            <option value="UPLOAD">Upload</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Timestamp</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">User</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Action</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Entity</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Details</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(log => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-slate-200 rounded-full flex items-center justify-center text-xs font-bold text-slate-600">
                        {log.userName.charAt(0)}
                      </div>
                      <span className="text-sm text-slate-700">{log.userName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${actionColor(log.action)}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{log.entityType}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 max-w-[200px] truncate">{log.newValue || log.oldValue || '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 font-mono">{log.ipAddress}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <Shield size={40} className="mx-auto mb-3 text-slate-300" />
            <p>No audit records found.</p>
          </div>
        )}
      </div>

      {/* Compliance Notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-800">Audit Compliance Notice</p>
          <p className="text-sm text-amber-700 mt-1">
            All sensitive operations are logged. Audit logs are append-only and cannot be modified by regular users. 
            Finalized payroll records are locked and require a controlled correction workflow for any changes.
          </p>
        </div>
      </div>
    </div>
  );
}
