import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { employees, departments, leaveRequests, payrollRecords } from '../data/mockData';
import { BarChart3, Users, TrendingUp, PieChart, Download, CheckCircle } from 'lucide-react';

export default function ReportsPage() {
  const { attendance, addToast } = useApp();
  const [activeReport, setActiveReport] = useState('headcount');

  const reports = [
    { id: 'headcount', label: 'Headcount', icon: <Users size={16} /> },
    { id: 'attendance', label: 'Attendance', icon: <BarChart3 size={16} /> },
    { id: 'leave', label: 'Leave', icon: <TrendingUp size={16} /> },
    { id: 'payroll', label: 'Payroll', icon: <PieChart size={16} /> },
  ];

  const deptHeadcount = departments.map(d => ({
    name: d.name,
    count: employees.filter(e => e.departmentId === d.id).length,
  })).filter(d => d.count > 0);

  const statusBreakdown = [
    { status: 'Active', count: employees.filter(e => e.employmentStatus === 'ACTIVE').length, color: 'bg-emerald-500' },
    { status: 'Probation', count: employees.filter(e => e.employmentStatus === 'PROBATION').length, color: 'bg-blue-500' },
    { status: 'On Leave', count: employees.filter(e => e.employmentStatus === 'ON_LEAVE').length, color: 'bg-amber-500' },
  ];

  const totalEmployees = employees.length;
  const maxDeptCount = Math.max(...deptHeadcount.map(d => d.count));

  const payrollSummary = {
    totalGross: payrollRecords.reduce((s, r) => s + r.grossPay, 0),
    totalDeductions: payrollRecords.reduce((s, r) => s + r.totalDeductions, 0),
    totalNet: payrollRecords.reduce((s, r) => s + r.netPay, 0),
    avgNet: payrollRecords.length > 0 ? payrollRecords.reduce((s, r) => s + r.netPay, 0) / payrollRecords.length : 0,
  };

  const formatCurrency = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

  const handleExport = (type: string) => {
    addToast(`${type} report exported successfully`, 'success');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Reports</h1>
          <p className="text-slate-500 text-sm mt-1">HR analytics and workforce insights</p>
        </div>
        <button onClick={() => handleExport(activeReport.charAt(0).toUpperCase() + activeReport.slice(1))} className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 text-sm font-medium">
          <Download size={16} /> Export Report
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto">
        {reports.map(r => (
          <button key={r.id} onClick={() => setActiveReport(r.id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${activeReport === r.id ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {r.icon} {r.label}
          </button>
        ))}
      </div>

      {activeReport === 'headcount' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5"><p className="text-sm text-slate-500">Total Headcount</p><p className="text-3xl font-bold text-slate-800 mt-1">{totalEmployees}</p></div>
            <div className="bg-white rounded-xl border border-slate-200 p-5"><p className="text-sm text-slate-500">Departments</p><p className="text-3xl font-bold text-slate-800 mt-1">{departments.filter(d => d.isActive).length}</p></div>
            <div className="bg-white rounded-xl border border-slate-200 p-5"><p className="text-sm text-slate-500">New This Month</p><p className="text-3xl font-bold text-emerald-600 mt-1">1</p></div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-800 mb-4">Headcount by Department</h3>
            <div className="space-y-3">
              {deptHeadcount.map(d => (
                <div key={d.name} className="flex items-center gap-4">
                  <span className="text-sm text-slate-600 w-40 truncate">{d.name}</span>
                  <div className="flex-1 bg-slate-100 rounded-full h-6 overflow-hidden">
                    <div className="bg-indigo-500 h-full rounded-full flex items-center justify-end pr-2 transition-all" style={{ width: `${(d.count / maxDeptCount) * 100}%` }}>
                      <span className="text-xs text-white font-medium">{d.count}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-800 mb-4">Employment Status</h3>
            <div className="flex flex-wrap gap-4">
              {statusBreakdown.map(s => (
                <div key={s.status} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg flex-1 min-w-[150px]">
                  <div className={`w-3 h-3 rounded-full ${s.color}`} />
                  <div><p className="text-sm font-medium text-slate-700">{s.status}</p><p className="text-lg font-bold text-slate-800">{s.count}</p></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeReport === 'attendance' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5"><p className="text-sm text-slate-500">Present Today</p><p className="text-3xl font-bold text-emerald-600 mt-1">{attendance.filter(a => a.status === 'PRESENT').length}</p></div>
            <div className="bg-white rounded-xl border border-slate-200 p-5"><p className="text-sm text-slate-500">Late Today</p><p className="text-3xl font-bold text-orange-600 mt-1">{attendance.filter(a => a.status === 'LATE').length}</p></div>
            <div className="bg-white rounded-xl border border-slate-200 p-5"><p className="text-sm text-slate-500">Absent Today</p><p className="text-3xl font-bold text-red-600 mt-1">{attendance.filter(a => a.status === 'ABSENT').length}</p></div>
            <div className="bg-white rounded-xl border border-slate-200 p-5"><p className="text-sm text-slate-500">On Leave Today</p><p className="text-3xl font-bold text-blue-600 mt-1">{attendance.filter(a => a.status === 'ON_LEAVE').length}</p></div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-800 mb-4">Attendance Rate</h3>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="bg-slate-100 rounded-full h-8 overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full flex items-center pl-4" style={{ width: `${(attendance.filter(a => a.status === 'PRESENT' || a.status === 'LATE').length / attendance.length) * 100}%` }}>
                    <span className="text-xs text-white font-medium">{((attendance.filter(a => a.status === 'PRESENT' || a.status === 'LATE').length / attendance.length) * 100).toFixed(0)}%</span>
                  </div>
                </div>
              </div>
              <p className="text-sm text-slate-500">{attendance.filter(a => a.status === 'PRESENT' || a.status === 'LATE').length} of {attendance.length} scheduled</p>
            </div>
          </div>
        </div>
      )}

      {activeReport === 'leave' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5"><p className="text-sm text-slate-500">Total Requests</p><p className="text-3xl font-bold text-slate-800 mt-1">{leaveRequests.length}</p></div>
            <div className="bg-white rounded-xl border border-slate-200 p-5"><p className="text-sm text-slate-500">Approved</p><p className="text-3xl font-bold text-emerald-600 mt-1">{leaveRequests.filter(l => l.status === 'APPROVED').length}</p></div>
            <div className="bg-white rounded-xl border border-slate-200 p-5"><p className="text-sm text-slate-500">Pending</p><p className="text-3xl font-bold text-amber-600 mt-1">{leaveRequests.filter(l => l.status === 'PENDING').length}</p></div>
            <div className="bg-white rounded-xl border border-slate-200 p-5"><p className="text-sm text-slate-500">Total Days Used</p><p className="text-3xl font-bold text-slate-800 mt-1">{leaveRequests.filter(l => l.status === 'APPROVED').reduce((s, l) => s + l.totalDays, 0)}</p></div>
          </div>
        </div>
      )}

      {activeReport === 'payroll' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5"><p className="text-sm text-slate-500">Total Gross</p><p className="text-xl font-bold text-slate-800 mt-1">{formatCurrency(payrollSummary.totalGross)}</p></div>
            <div className="bg-white rounded-xl border border-slate-200 p-5"><p className="text-sm text-slate-500">Total Deductions</p><p className="text-xl font-bold text-red-600 mt-1">{formatCurrency(payrollSummary.totalDeductions)}</p></div>
            <div className="bg-white rounded-xl border border-slate-200 p-5"><p className="text-sm text-slate-500">Total Net</p><p className="text-xl font-bold text-emerald-600 mt-1">{formatCurrency(payrollSummary.totalNet)}</p></div>
            <div className="bg-white rounded-xl border border-slate-200 p-5"><p className="text-sm text-slate-500">Average Net</p><p className="text-xl font-bold text-slate-800 mt-1">{formatCurrency(payrollSummary.avgNet)}</p></div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-800 mb-4">Payroll by Department</h3>
            <div className="space-y-3">
              {departments.map(d => {
                const deptEmps = employees.filter(e => e.departmentId === d.id);
                const deptPayroll = payrollRecords.filter(r => deptEmps.some(e => e.id === r.employeeId));
                const deptNet = deptPayroll.reduce((s, r) => s + r.netPay, 0);
                if (deptNet === 0) return null;
                return (
                  <div key={d.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <span className="text-sm text-slate-700">{d.name}</span>
                    <span className="text-sm font-medium text-slate-800">{formatCurrency(deptNet)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
