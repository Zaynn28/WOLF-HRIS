import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { BarChart3, Users, TrendingUp, PieChart, Download } from 'lucide-react';
import { overlapDays } from '../lib/payrollEngine';
import type { PayrollPeriod } from '../types';

function isoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function calendarMonthRange(today = new Date()): { from: string; until: string } {
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return { from: isoDate(start), until: isoDate(end) };
}

function defaultReportRange(periods: PayrollPeriod[], workingPeriodId: string): { from: string; until: string } {
  const period = periods.find(row => row.id === workingPeriodId);
  if (period?.startDate && period?.endDate) {
    return { from: period.startDate, until: period.endDate };
  }
  return calendarMonthRange();
}

const formatDay = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export default function ReportsPage() {
  const { attendance: allAttendance, employees: allEmployees, departments, leaveRequests: allLeave, payrollRecords: allPayroll, payrollPeriods, workingPeriodId, addToast } = useApp();
  const [range, setRange] = useState(() => defaultReportRange(payrollPeriods, workingPeriodId));
  const [activeReport, setActiveReport] = useState('headcount');
  const { from: fromDate, until: untilDate } = range;
  const rangeReady = Boolean(fromDate && untilDate && untilDate >= fromDate);
  const rangeLabel = rangeReady ? `${formatDay(fromDate)} until ${formatDay(untilDate)}` : '';

  const employees = rangeReady
    ? allEmployees.filter(person => {
        if (person.joinDate > untilDate) return false;
        if (person.terminationDate && person.terminationDate < fromDate) return false;
        return true;
      })
    : [];
  const attendance = rangeReady
    ? allAttendance.filter(row => row.attendanceDate >= fromDate && row.attendanceDate <= untilDate)
    : [];
  const leaveRequests = rangeReady
    ? allLeave.filter(row => overlapDays(row.startDate, row.endDate, fromDate, untilDate) > 0)
    : [];
  const payrollRecords = rangeReady
    ? allPayroll.filter(row => {
        const period = payrollPeriods.find(item => item.id === row.payrollPeriodId);
        if (!period) return false;
        return period.startDate <= untilDate && period.endDate >= fromDate;
      })
    : [];

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
  const joinedInRange = employees.filter(person => person.joinDate >= fromDate).length;
  const maxDeptCount = deptHeadcount.reduce((max, row) => Math.max(max, row.count), 1);

  const payrollSummary = {
    totalGross: payrollRecords.reduce((s, r) => s + r.grossPay, 0),
    totalDeductions: payrollRecords.reduce((s, r) => s + r.totalDeductions, 0),
    totalNet: payrollRecords.reduce((s, r) => s + r.netPay, 0),
    avgNet: payrollRecords.length > 0 ? payrollRecords.reduce((s, r) => s + r.netPay, 0) / payrollRecords.length : 0,
  };

  const formatCurrency = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

  const handleExport = (type: string) => {
    if (!rangeReady) {
      addToast('Choose a valid From and Until date', 'error');
      return;
    }
    const rows: string[] = [];
    if (activeReport === 'headcount') {
      rows.push('DEPARTMENT,HEADCOUNT');
      deptHeadcount.forEach(row => rows.push(`${row.name},${row.count}`));
    } else if (activeReport === 'attendance') {
      rows.push('DATE,EMPLOYEE_ID,STATUS,CLOCK_IN,CLOCK_OUT,LATE_MINUTES');
      attendance.forEach(row => rows.push(`${row.attendanceDate},${row.employeeId},${row.status},${row.clockIn || ''},${row.clockOut || ''},${row.lateMinutes || 0}`));
    } else if (activeReport === 'leave') {
      rows.push('EMPLOYEE_ID,LEAVE_TYPE_ID,START,END,DAYS,STATUS');
      leaveRequests.forEach(row => rows.push(`${row.employeeId},${row.leaveTypeId},${row.startDate},${row.endDate},${row.totalDays},${row.status}`));
    } else {
      rows.push('EMPLOYEE_ID,BASIC,ALLOWANCE,OVERTIME,SERVICE_CHARGE,GROSS,DEDUCTIONS,NET');
      payrollRecords.forEach(row => rows.push(`${row.employeeId},${row.basicSalary},${row.allowance},${row.overtime},${row.serviceCharge},${row.grossPay},${row.totalDeductions},${row.netPay}`));
    }
    if (rows.length <= 1) {
      addToast('This report has no rows to export', 'error');
      return;
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeReport}_report.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    addToast(`${type} report downloaded`, 'success');
  };

  const rangeError = !fromDate || !untilDate
    ? 'Enter both From and Until.'
    : untilDate < fromDate
      ? 'Until must be on or after From.'
      : '';

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

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-end gap-4">
          <label htmlFor="report-from" className="block text-sm font-medium text-slate-700">
            From
            <input
              id="report-from"
              type="date"
              value={fromDate}
              onChange={event => setRange(current => ({ ...current, from: event.target.value }))}
              className="mt-1 block px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 bg-white"
            />
          </label>
          <label htmlFor="report-until" className="block text-sm font-medium text-slate-700">
            Until
            <input
              id="report-until"
              type="date"
              value={untilDate}
              onChange={event => setRange(current => ({ ...current, until: event.target.value }))}
              className="mt-1 block px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 bg-white"
            />
          </label>
        </div>
        {rangeError ? (
          <p className="text-sm text-red-600 mt-3" role="alert">{rangeError}</p>
        ) : (
          <p className="text-sm text-slate-600 mt-3">Showing {rangeLabel}</p>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto">
        {reports.map(r => (
          <button key={r.id} onClick={() => setActiveReport(r.id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${activeReport === r.id ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {r.icon} {r.label}
          </button>
        ))}
      </div>

      {rangeReady && activeReport === 'headcount' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5"><p className="text-sm text-slate-500">Total Headcount</p><p className="text-3xl font-bold text-slate-800 mt-1">{totalEmployees}</p></div>
            <div className="bg-white rounded-xl border border-slate-200 p-5"><p className="text-sm text-slate-500">Departments</p><p className="text-3xl font-bold text-slate-800 mt-1">{departments.filter(d => d.isActive).length}</p></div>
            <div className="bg-white rounded-xl border border-slate-200 p-5"><p className="text-sm text-slate-500">Joined in range</p><p className="text-3xl font-bold text-emerald-600 mt-1">{joinedInRange}</p></div>
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

      {rangeReady && activeReport === 'attendance' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5"><p className="text-sm text-slate-500">Present in range</p><p className="text-3xl font-bold text-emerald-600 mt-1">{attendance.filter(a => a.status === 'PRESENT').length}</p></div>
            <div className="bg-white rounded-xl border border-slate-200 p-5"><p className="text-sm text-slate-500">Late in range</p><p className="text-3xl font-bold text-orange-600 mt-1">{attendance.filter(a => a.status === 'LATE').length}</p></div>
            <div className="bg-white rounded-xl border border-slate-200 p-5"><p className="text-sm text-slate-500">Absent in range</p><p className="text-3xl font-bold text-red-600 mt-1">{attendance.filter(a => a.status === 'ABSENT').length}</p></div>
            <div className="bg-white rounded-xl border border-slate-200 p-5"><p className="text-sm text-slate-500">On leave in range</p><p className="text-3xl font-bold text-blue-600 mt-1">{attendance.filter(a => a.status === 'ON_LEAVE').length}</p></div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-800 mb-4">Attendance Rate · {rangeLabel}</h3>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="bg-slate-100 rounded-full h-8 overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full flex items-center pl-4" style={{ width: `${attendance.length === 0 ? 0 : (attendance.filter(a => a.status === 'PRESENT' || a.status === 'LATE').length / attendance.length) * 100}%` }}>
                    <span className="text-xs text-white font-medium">{attendance.length === 0 ? '0' : ((attendance.filter(a => a.status === 'PRESENT' || a.status === 'LATE').length / attendance.length) * 100).toFixed(0)}%</span>
                  </div>
                </div>
              </div>
              <p className="text-sm text-slate-500">{attendance.filter(a => a.status === 'PRESENT' || a.status === 'LATE').length} of {attendance.length} scheduled</p>
            </div>
          </div>
        </div>
      )}

      {rangeReady && activeReport === 'leave' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5"><p className="text-sm text-slate-500">Total Requests</p><p className="text-3xl font-bold text-slate-800 mt-1">{leaveRequests.length}</p></div>
            <div className="bg-white rounded-xl border border-slate-200 p-5"><p className="text-sm text-slate-500">Approved</p><p className="text-3xl font-bold text-emerald-600 mt-1">{leaveRequests.filter(l => l.status === 'APPROVED').length}</p></div>
            <div className="bg-white rounded-xl border border-slate-200 p-5"><p className="text-sm text-slate-500">Pending</p><p className="text-3xl font-bold text-amber-600 mt-1">{leaveRequests.filter(l => l.status === 'PENDING').length}</p></div>
            <div className="bg-white rounded-xl border border-slate-200 p-5"><p className="text-sm text-slate-500">Total Days Used</p><p className="text-3xl font-bold text-slate-800 mt-1">{leaveRequests.filter(l => l.status === 'APPROVED').reduce((s, l) => s + l.totalDays, 0)}</p></div>
          </div>
        </div>
      )}

      {rangeReady && activeReport === 'payroll' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5"><p className="text-sm text-slate-500">Total Gross</p><p className="text-xl font-bold text-slate-800 mt-1">{formatCurrency(payrollSummary.totalGross)}</p></div>
            <div className="bg-white rounded-xl border border-slate-200 p-5"><p className="text-sm text-slate-500">Total Deductions</p><p className="text-xl font-bold text-red-600 mt-1">{formatCurrency(payrollSummary.totalDeductions)}</p></div>
            <div className="bg-white rounded-xl border border-slate-200 p-5"><p className="text-sm text-slate-500">Total Net</p><p className="text-xl font-bold text-emerald-600 mt-1">{formatCurrency(payrollSummary.totalNet)}</p></div>
            <div className="bg-white rounded-xl border border-slate-200 p-5"><p className="text-sm text-slate-500">Average Net</p><p className="text-xl font-bold text-slate-800 mt-1">{formatCurrency(payrollSummary.avgNet)}</p></div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-800 mb-4">Payroll by Department · {rangeLabel}</h3>
            <div className="space-y-3">
              {departments.map(d => {
                const deptIds = new Set(allEmployees.filter(e => e.departmentId === d.id).map(e => e.id));
                const deptPayroll = payrollRecords.filter(r => deptIds.has(r.employeeId));
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
