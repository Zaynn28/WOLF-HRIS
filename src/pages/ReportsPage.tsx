import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Download, Printer } from 'lucide-react';
import { overlapDays } from '../lib/payrollEngine';
import PayslipSheet from '../components/PayslipSheet';
import type { PayrollItem, PayrollPeriod, PayrollRecord } from '../types';
import {
  buildSalaryReportRow,
  formatSalaryReportCell,
  salaryReportColumns,
  salaryReportGrandTotal,
  salaryReportToCsv,
  type SalaryReportRow,
} from '../lib/salaryReportView';

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
  if (period?.startDate && period?.endDate) return { from: period.startDate, until: period.endDate };
  return calendarMonthRange();
}

const formatDay = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const monthTitle = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
const formatCurrency = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

const taxCodes = new Set(['PPh21', 'pph21']);
const bpjsCodes = new Set([
  'BPJS_KES', 'BPJS_JHT', 'BPJS_JP',
  'bpjsk_employee', 'jht_employee', 'jp_employee',
  'bpjsk_allowance', 'jht_allowance', 'jp_allowance',
  'jkk', 'jkm', 'jht_company', 'jp_company', 'bpjsk_company',
]);

type ReportItem = { id: string; label: string };

function groupsFor(monthLabel: string): { id: string; label: string; items: ReportItem[] }[] {
  return [
    {
      id: 'salary',
      label: 'Salary Report',
      items: [
        { id: 'salary-month', label: `Salary ${monthLabel}` },
        { id: 'salary-detail', label: 'Salary Detail' },
        { id: 'summary', label: 'Summary Report' },
        { id: 'thr', label: 'THR Report' },
        { id: 'payslip', label: 'Payslip' },
        { id: 'thr-slip', label: 'THR Slip' },
        { id: 'salary-yearly', label: 'Salary Detail Yearly' },
        { id: 'salary-compare', label: 'Salary Detail Compare' },
        { id: 'salary-recap', label: 'Salary Recapitulation (Payroll Component & Employee)' },
        { id: 'daily-allowance', label: 'Daily Allowance & Deduction Report' },
      ],
    },
    { id: 'tax', label: 'Tax Report', items: [{ id: 'tax', label: 'Tax Report' }] },
    { id: 'bpjs', label: 'BPJS Report', items: [{ id: 'bpjs', label: 'BPJS Report' }] },
    { id: 'hr', label: 'Human Resources Report', items: [{ id: 'hr', label: 'Human Resources Report' }] },
    { id: 'attendance', label: 'Attendance Report', items: [{ id: 'attendance', label: 'Attendance Report' }] },
    { id: 'reimbursement', label: 'Reimbursement Report', items: [{ id: 'reimbursement', label: 'Reimbursement Report' }] },
    { id: 'overtime', label: 'Overtime Report', items: [{ id: 'overtime', label: 'Overtime Report' }] },
    { id: 'loan', label: 'Loan Report', items: [{ id: 'loan', label: 'Loan Report' }] },
  ];
}

function EmptyReport({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-8">
      <h3 className="font-semibold text-slate-800">{title}</h3>
      <p className="text-sm text-slate-500 mt-2">{detail}</p>
    </div>
  );
}

function Stat({ label, value, tone = 'text-slate-800' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`text-xl font-bold mt-1 ${tone}`}>{value}</p>
    </div>
  );
}

export default function ReportsPage() {
  const {
    attendance: allAttendance,
    employees: allEmployees,
    departments,
    positions,
    leaveRequests: allLeave,
    payrollRecords: allPayroll,
    payrollItems,
    payrollPeriods,
    workingPeriodId,
    overtimeRequests: allOvertime,
    thrCalculations,
    employeeLoans,
    reimbursements,
    terTables,
    addToast,
  } = useApp();
  const [range, setRange] = useState(() => defaultReportRange(payrollPeriods, workingPeriodId));
  const [groupId, setGroupId] = useState('salary');
  const [reportId, setReportId] = useState('salary-month');
  const [payslipId, setPayslipId] = useState('');
  const { from: fromDate, until: untilDate } = range;
  const rangeReady = Boolean(fromDate && untilDate && untilDate >= fromDate);
  const rangeLabel = rangeReady ? `${formatDay(fromDate)} until ${formatDay(untilDate)}` : '';
  const monthLabel = fromDate ? monthTitle(fromDate) : '';
  const groups = useMemo(() => groupsFor(monthLabel), [monthLabel]);
  const activeGroup = groups.find(group => group.id === groupId) ?? groups[0];
  const activeItem = activeGroup.items.find(item => item.id === reportId) ?? activeGroup.items[0];

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
  const overtime = rangeReady
    ? allOvertime.filter(row => row.date >= fromDate && row.date <= untilDate)
    : [];
  const claims = rangeReady
    ? reimbursements.filter(row => row.claimDate >= fromDate && row.claimDate <= untilDate)
    : [];
  const loans = rangeReady
    ? employeeLoans.filter(row => row.startDate <= untilDate && (!row.endDate || row.endDate >= fromDate))
    : [];
  const thrRows = rangeReady
    ? thrCalculations.filter(row => row.period >= fromDate.slice(0, 7) && row.period <= untilDate.slice(0, 7))
    : [];
  const recordIds = new Set(payrollRecords.map(row => row.id));
  const itemsInRange = payrollItems.filter(item => recordIds.has(item.payrollRecordId));

  const salaryReportRows = useMemo(() => {
    if (!rangeReady || payrollRecords.length === 0) return [] as SalaryReportRow[];
    const asOf = untilDate ? new Date(`${untilDate}T00:00:00`) : new Date();
    return payrollRecords.map((record) => {
      const employee = allEmployees.find((person) => person.id === record.employeeId);
      if (!employee) {
        return buildSalaryReportRow({
          employee: {
            id: record.employeeId,
            employeeCode: record.employeeId,
            fullName: record.employeeId,
            nik: '',
            dateOfBirth: '',
            gender: 'M',
            phone: '',
            email: '',
            address: '',
            emergencyContactName: '',
            emergencyContactPhone: '',
            departmentId: '',
            positionId: '',
            employmentStatus: 'ACTIVE',
            joinDate: fromDate,
          },
          record,
          items: itemsInRange.filter((item) => item.payrollRecordId === record.id),
          terTables,
          asOf,
        });
      }
      return buildSalaryReportRow({
        employee,
        position: positions.find((row) => row.id === employee.positionId),
        department: departments.find((row) => row.id === employee.departmentId),
        record,
        items: itemsInRange.filter((item) => item.payrollRecordId === record.id),
        terTables,
        asOf,
      });
    });
  }, [rangeReady, payrollRecords, allEmployees, positions, departments, itemsInRange, terTables, untilDate, fromDate]);

  const nameOf = (employeeId: string) => allEmployees.find(person => person.id === employeeId)?.fullName || employeeId;
  const deptOf = (employeeId: string) => {
    const person = allEmployees.find(row => row.id === employeeId);
    return departments.find(row => row.id === person?.departmentId)?.name || '—';
  };

  const storedComponent = (record: PayrollRecord, code: string) => {
    const amount = record.componentAmounts?.[code];
    return typeof amount === 'number' ? amount : 0;
  };

  const taxRows = itemsInRange.filter(item => taxCodes.has(item.componentCode));
  const taxFromComponents = payrollRecords
    .map(record => ({ employeeId: record.employeeId, amount: storedComponent(record, 'pph21') }))
    .filter(row => row.amount !== 0);
  const bpjsItemRows = itemsInRange.filter(item => bpjsCodes.has(item.componentCode));
  const bpjsFromComponents = payrollRecords.flatMap(record => {
    const amounts = record.componentAmounts ?? {};
    return Object.entries(amounts)
      .filter(([code, amount]) => bpjsCodes.has(code) && amount !== 0)
      .map(([code, amount]) => ({ employeeId: record.employeeId, code, amount }));
  });

  const year = fromDate.slice(0, 4);
  const yearlyPeriods = payrollPeriods
    .filter(period => period.periodCode.startsWith(year))
    .slice()
    .sort((left, right) => left.periodCode.localeCompare(right.periodCode));
  const comparePeriods = yearlyPeriods.filter(period => allPayroll.some(row => row.payrollPeriodId === period.id));

  const rangeError = !fromDate || !untilDate
    ? 'Enter both From and Until.'
    : untilDate < fromDate
      ? 'Until must be on or after From.'
      : '';

  const openGroup = (id: string) => {
    const group = groups.find(row => row.id === id) ?? groups[0];
    setGroupId(group.id);
    setReportId(group.items[0].id);
    setPayslipId('');
  };

  const handleExport = () => {
    if (!rangeReady) {
      addToast('Choose a valid From and Until date', 'error');
      return;
    }
    const lines = exportLines();
    if (lines.length <= 1) {
      addToast('This report has no rows to export', 'error');
      return;
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeItem.id}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    addToast(`${activeItem.label} downloaded`, 'success');
  };

  const exportLines = (): string[] => {
    if (activeItem.id === 'salary-detail' || activeItem.id === 'salary-month') {
      if (salaryReportRows.length === 0) return [activeItem.label];
      return salaryReportToCsv(salaryReportRows, true);
    }
    if (activeItem.id === 'payslip') {
      return ['EMPLOYEE,BASIC,ALLOWANCE,OVERTIME,DEDUCTIONS,NET', ...payrollRecords.map(row => `${csv(nameOf(row.employeeId))},${row.basicSalary},${row.allowance},${row.overtime},${row.totalDeductions},${row.netPay}`)];
    }
    if (activeItem.id === 'attendance') {
      return ['DATE,EMPLOYEE,STATUS,CLOCK_IN,CLOCK_OUT', ...attendance.map(row => `${row.attendanceDate},${csv(nameOf(row.employeeId))},${row.status},${row.clockIn || ''},${row.clockOut || ''}`)];
    }
    if (activeItem.id === 'hr') {
      return ['EMPLOYEE,DEPARTMENT,STATUS,JOIN_DATE', ...employees.map(row => `${csv(row.fullName)},${csv(deptOf(row.id))},${row.employmentStatus},${row.joinDate}`)];
    }
    if (activeItem.id === 'overtime') {
      return ['DATE,EMPLOYEE,MINUTES,STATUS', ...overtime.map(row => `${row.date},${csv(nameOf(row.employeeId))},${row.totalMinutes},${row.status}`)];
    }
    if (activeItem.id === 'reimbursement') {
      return ['DATE,EMPLOYEE,CATEGORY,AMOUNT,STATUS', ...claims.map(row => `${row.claimDate},${csv(nameOf(row.employeeId))},${row.category},${row.amount},${row.status}`)];
    }
    if (activeItem.id === 'loan') {
      return ['EMPLOYEE,TYPE,PRINCIPAL,REMAINING,INSTALLMENT,STATUS', ...loans.map(row => `${csv(nameOf(row.employeeId))},${row.loanType},${row.principalAmount},${row.remainingBalance},${row.monthlyInstallment},${row.status}`)];
    }
    if (activeItem.id === 'thr' || activeItem.id === 'thr-slip') {
      return ['EMPLOYEE,PERIOD,THR', ...thrRows.map(row => `${csv(nameOf(row.employeeId))},${row.period},${row.thrAmount}`)];
    }
    if (activeItem.id === 'tax') {
      const rows = taxRows.length > 0
        ? taxRows.map(item => `${csv(nameOf(recordEmployee(item)))},${item.componentName},${item.amount}`)
        : taxFromComponents.map(row => `${csv(nameOf(row.employeeId))},PPh 21,${row.amount}`);
      return ['EMPLOYEE,COMPONENT,AMOUNT', ...rows];
    }
    return [activeItem.label];
  };

  const recordEmployee = (item: PayrollItem) => payrollRecords.find(row => row.id === item.payrollRecordId)?.employeeId || '';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Reports</h1>
          <p className="text-slate-500 text-sm mt-1">Stored payroll, tax, BPJS, people, attendance, reimbursement, overtime, and loans</p>
        </div>
        <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 text-sm font-medium">
          <Download size={16} /> Export Report
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-end gap-4">
          <label htmlFor="report-from" className="block text-sm font-medium text-slate-700">
            From
            <input id="report-from" type="date" value={fromDate} onChange={event => setRange(current => ({ ...current, from: event.target.value }))} className="mt-1 block px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 bg-white" />
          </label>
          <label htmlFor="report-until" className="block text-sm font-medium text-slate-700">
            Until
            <input id="report-until" type="date" value={untilDate} onChange={event => setRange(current => ({ ...current, until: event.target.value }))} className="mt-1 block px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 bg-white" />
          </label>
        </div>
        {rangeError ? <p className="text-sm text-red-600 mt-3" role="alert">{rangeError}</p> : <p className="text-sm text-slate-600 mt-3">Showing {rangeLabel}</p>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 p-2">
          {groups.map(group => (
            <button key={group.id} type="button" onClick={() => openGroup(group.id)} className={`w-full text-left px-3 py-2 rounded-lg text-sm ${group.id === activeGroup.id ? 'bg-slate-100 font-semibold text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}>
              {group.label}
            </button>
          ))}
        </div>
        <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 p-2">
          {activeGroup.items.map(item => (
            <button key={item.id} type="button" onClick={() => { setReportId(item.id); setPayslipId(''); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm ${item.id === activeItem.id ? 'bg-indigo-50 font-medium text-indigo-800' : 'text-slate-700 hover:bg-slate-50'}`}>
              {item.label}
            </button>
          ))}
        </div>
        <div className="lg:col-span-5 space-y-4">
          {!rangeReady && <EmptyReport title={activeItem.label} detail={rangeError} />}
          {rangeReady && activeItem.id === 'salary-month' && (payrollRecords.length === 0
            ? <EmptyReport title={activeItem.label} detail="No payroll lines are stored for this range." />
            : <div className="grid grid-cols-1 gap-3">
                <Stat label="Employees" value={String(payrollRecords.length)} />
                <Stat label="Total gross" value={formatCurrency(payrollRecords.reduce((sum, row) => sum + row.grossPay, 0))} />
                <Stat label="Total deductions" value={formatCurrency(payrollRecords.reduce((sum, row) => sum + row.totalDeductions, 0))} tone="text-red-600" />
                <Stat label="Total net" value={formatCurrency(payrollRecords.reduce((sum, row) => sum + row.netPay, 0))} tone="text-emerald-700" />
              </div>)}
          {rangeReady && activeItem.id === 'salary-detail' && payrollRecords.length === 0 && (
            <EmptyReport title={activeItem.label} detail="No payroll lines are stored for this range." />
          )}
          {rangeReady && activeItem.id === 'salary-detail' && payrollRecords.length > 0 && (
            <p className="text-sm text-slate-600 bg-white rounded-xl border border-slate-200 p-4">
              Full component matrix ({salaryReportRows.length} employees) — scroll the table below. Export downloads the same columns as the Salary Report PDF.
            </p>
          )}
          {rangeReady && activeItem.id === 'summary' && <SummaryReport title={activeItem.label} records={payrollRecords} employees={allEmployees} departments={departments} />}
          {rangeReady && (activeItem.id === 'thr' || activeItem.id === 'thr-slip') && (thrRows.length === 0
            ? <EmptyReport title={activeItem.label} detail="No THR amounts are stored for this range. This report does not calculate THR." />
            : <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50"><tr><th className="text-left px-4 py-2">Employee</th><th className="text-left px-4 py-2">Period</th><th className="text-right px-4 py-2">THR</th></tr></thead>
                  <tbody>{thrRows.map(row => <tr key={row.id} className="border-t border-slate-100"><td className="px-4 py-2">{nameOf(row.employeeId)}</td><td className="px-4 py-2">{row.period}</td><td className="px-4 py-2 text-right">{formatCurrency(row.thrAmount)}</td></tr>)}</tbody>
                </table>
              </div>)}
          {rangeReady && activeItem.id === 'payslip' && payrollRecords.length === 0 && <EmptyReport title="Payslip" detail="No payslip can be opened because no payroll line is stored for this range." />}
          {rangeReady && activeItem.id === 'salary-yearly' && <YearlyReport title={activeItem.label} year={year} periods={yearlyPeriods} records={allPayroll} />}
          {rangeReady && activeItem.id === 'salary-compare' && (comparePeriods.length < 2
            ? <EmptyReport title={activeItem.label} detail={`Two stored payroll periods in ${year} are required to compare. ${comparePeriods.length} ${comparePeriods.length === 1 ? 'is' : 'are'} stored.`} />
            : <CompareReport title={activeItem.label} earlier={comparePeriods[0]} later={comparePeriods[comparePeriods.length - 1]} records={allPayroll} nameOf={nameOf} />)}
          {rangeReady && activeItem.id === 'salary-recap' && <RecapReport title={activeItem.label} records={payrollRecords} items={itemsInRange} nameOf={nameOf} />}
          {rangeReady && activeItem.id === 'daily-allowance' && <EmptyReport title={activeItem.label} detail="No daily allowance or deduction entries are stored. Standing allowances stay on each employee's salary structure." />}
          {rangeReady && activeItem.id === 'tax' && <TaxReport title={activeItem.label} items={taxRows} componentRows={taxFromComponents} nameOf={nameOf} recordEmployee={recordEmployee} />}
          {rangeReady && activeItem.id === 'bpjs' && <BpjsReport title={activeItem.label} items={bpjsItemRows} componentRows={bpjsFromComponents} nameOf={nameOf} recordEmployee={recordEmployee} />}
          {rangeReady && activeItem.id === 'hr' && <HumanResources records={employees} departments={departments} joined={employees.filter(person => person.joinDate >= fromDate).length} />}
          {rangeReady && activeItem.id === 'attendance' && <AttendanceReport rows={attendance} />}
          {rangeReady && activeItem.id === 'reimbursement' && (claims.length === 0
            ? <EmptyReport title={activeItem.label} detail="No reimbursement claims are stored for this range." />
            : <SimpleTable headers={['Employee', 'Date', 'Category', 'Amount', 'Status']} rows={claims.map(row => [nameOf(row.employeeId), row.claimDate, row.category, formatCurrency(row.amount), row.status])} />)}
          {rangeReady && activeItem.id === 'overtime' && (overtime.length === 0
            ? <EmptyReport title={activeItem.label} detail="No overtime requests are stored for this range." />
            : <SimpleTable headers={['Employee', 'Date', 'Minutes', 'Status']} rows={overtime.map(row => [nameOf(row.employeeId), row.date, String(row.totalMinutes), row.status])} />)}
          {rangeReady && activeItem.id === 'loan' && (loans.length === 0
            ? <EmptyReport title={activeItem.label} detail="No employee loans are stored for this range." />
            : <SimpleTable headers={['Employee', 'Type', 'Principal', 'Remaining', 'Installment', 'Status']} rows={loans.map(row => [nameOf(row.employeeId), row.loanType, formatCurrency(row.principalAmount), formatCurrency(row.remainingBalance), formatCurrency(row.monthlyInstallment), row.status])} />)}
        </div>
      </div>
      {rangeReady && activeItem.id === 'salary-detail' && salaryReportRows.length > 0 && (
        <SalaryDetailMatrix title={activeItem.label} rows={salaryReportRows} />
      )}
      {rangeReady && activeItem.id === 'payslip' && payrollRecords.length > 0 && (
        <PayslipReport records={payrollRecords} items={itemsInRange} employees={allEmployees} departments={departments} positions={positions} periods={payrollPeriods} terTables={terTables} selectedId={payslipId} onSelect={setPayslipId} />
      )}
      {rangeReady && activeItem.id === 'hr' && leaveRequests.length > 0 && (
        <p className="text-sm text-slate-500">{leaveRequests.filter(row => row.status === 'APPROVED').length} approved leave requests overlap this range.</p>
      )}
    </div>
  );
}

function csv(value: string) {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function SimpleTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50"><tr>{headers.map(header => <th key={header} className="text-left px-3 py-2 font-medium text-slate-500">{header}</th>)}</tr></thead>
        <tbody>{rows.map((row, index) => <tr key={index} className="border-t border-slate-100">{row.map((cell, cellIndex) => <td key={cellIndex} className="px-3 py-2 text-slate-700">{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

function SalaryDetailMatrix({ title, rows }: { title: string; rows: SalaryReportRow[] }) {
  const grand = salaryReportGrandTotal(rows);
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
        <h3 className="font-semibold text-slate-800">{title}</h3>
        <p className="text-xs text-slate-500">All payroll components · horizontal scroll</p>
      </div>
      <div className="overflow-x-auto">
        <table className="text-xs whitespace-nowrap">
          <thead className="bg-slate-50">
            <tr>
              {salaryReportColumns.map((col) => (
                <th key={col.key} className="text-left px-2 py-2 font-medium text-slate-500 border-b border-slate-100">
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={String(row.employee_id)} className="border-t border-slate-100 hover:bg-slate-50/80">
                {salaryReportColumns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-2 py-1.5 text-slate-700 ${col.kind === 'money' || col.kind === 'percent' ? 'text-right tabular-nums' : ''}`}
                  >
                    {formatSalaryReportCell(col, row[col.key])}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
              {salaryReportColumns.map((col) => (
                <td
                  key={col.key}
                  className={`px-2 py-2 text-slate-800 ${col.kind === 'money' ? 'text-right tabular-nums' : ''}`}
                >
                  {col.key === 'employee_id'
                    ? 'GRAND TOTAL'
                    : col.kind === 'money'
                      ? formatSalaryReportCell(col, grand[col.key])
                      : ''}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryReport({ title, records, employees, departments }: { title: string; records: PayrollRecord[]; employees: { id: string; departmentId: string }[]; departments: { id: string; name: string }[] }) {
  if (records.length === 0) return <EmptyReport title={title} detail="No payroll lines are stored for this range." />;
  const rows = departments.map(department => {
    const ids = new Set(employees.filter(person => person.departmentId === department.id).map(person => person.id));
    const net = records.filter(row => ids.has(row.employeeId)).reduce((sum, row) => sum + row.netPay, 0);
    return net === 0 ? null : [department.name, formatCurrency(net)];
  }).filter((row): row is string[] => row !== null);
  if (rows.length === 0) return <EmptyReport title={title} detail="Stored payroll lines are not linked to a department." />;
  return <SimpleTable headers={['Department', 'Net']} rows={rows} />;
}

function PayslipReport({ records, items, employees, departments, positions, periods, terTables, selectedId, onSelect }: {
  records: PayrollRecord[];
  items: PayrollItem[];
  employees: {
    id: string;
    fullName: string;
    employeeCode: string;
    departmentId: string;
    positionId: string;
    ptkpCode?: string;
    npwp?: string;
    email?: string;
    bankName?: string;
    bankAccountNumber?: string;
    bankAccountName?: string;
    taxConfiguration?: 'netto' | 'gross';
  }[];
  departments: { id: string; name: string }[];
  positions: { id: string; title: string; grade: string }[];
  periods: PayrollPeriod[];
  terTables: import('../types').TERTable[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  if (records.length === 0) return <EmptyReport title="Payslip" detail="No payslip can be opened because no payroll line is stored for this range." />;
  const selected = records.find(row => row.id === selectedId) ?? records[0];
  const employee = employees.find(person => person.id === selected.employeeId);
  const department = departments.find(row => row.id === employee?.departmentId);
  const position = positions.find(row => row.id === employee?.positionId);
  const period = periods.find(row => row.id === selected.payrollPeriodId);
  const lines = items.filter(item => item.payrollRecordId === selected.id);
  return (
    <div className="space-y-3 lg:col-span-full">
      <div className="flex flex-wrap items-end justify-between gap-3 payslip-print">
        <label className="block text-sm text-slate-600 min-w-[220px]">Employee
          <select value={selected.id} onChange={event => onSelect(event.target.value)} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white">
            {records.map(row => <option key={row.id} value={row.id}>{employees.find(person => person.id === row.employeeId)?.fullName || row.employeeId}</option>)}
          </select>
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              if (!employee?.email) {
                window.alert('This employee has no email on file.');
                return;
              }
              const subject = encodeURIComponent(`Payslip ${period?.periodCode || selected.payrollPeriodId}`);
              const body = encodeURIComponent(
                `Dear ${employee.fullName},\n\nYour payslip for ${period?.periodCode || 'this period'} is ready.\nNet pay: ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(selected.netPay)}\n\nOpen HRIS Reports to view or download the full slip.\n`,
              );
              window.location.href = `mailto:${employee.email}?subject=${subject}&body=${body}`;
            }}
            className="flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg text-sm font-medium"
          >
            Email
          </button>
          <button type="button" onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg text-sm font-medium">
            <Printer size={16} /> Print
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium"
            title="Save as PDF from the print dialog"
          >
            <Download size={16} /> Download PDF
          </button>
        </div>
      </div>
      <PayslipSheet
        record={selected}
        items={lines}
        employee={employee}
        department={department}
        position={position}
        period={period}
        terTables={terTables}
      />
    </div>
  );
}

function YearlyReport({ title, year, periods, records }: { title: string; year: string; periods: PayrollPeriod[]; records: PayrollRecord[] }) {
  const rows = periods.map(period => {
    const lines = records.filter(row => row.payrollPeriodId === period.id);
    if (lines.length === 0) return null;
    return [period.periodCode, String(lines.length), formatCurrency(lines.reduce((sum, row) => sum + row.netPay, 0))];
  }).filter((row): row is string[] => row !== null);
  if (rows.length === 0) return <EmptyReport title={title} detail={`No payroll lines are stored for ${year}.`} />;
  return <SimpleTable headers={['Period', 'Employees', 'Net']} rows={rows} />;
}

function CompareReport({ title, earlier, later, records, nameOf }: { title: string; earlier: PayrollPeriod; later: PayrollPeriod; records: PayrollRecord[]; nameOf: (id: string) => string }) {
  const earlierRows = new Map(records.filter(row => row.payrollPeriodId === earlier.id).map(row => [row.employeeId, row]));
  const laterRows = records.filter(row => row.payrollPeriodId === later.id);
  const people = new Set([...earlierRows.keys(), ...laterRows.map(row => row.employeeId)]);
  const table = [...people].map(employeeId => {
    const before = earlierRows.get(employeeId)?.netPay ?? 0;
    const after = laterRows.find(row => row.employeeId === employeeId)?.netPay ?? 0;
    return [nameOf(employeeId), formatCurrency(before), formatCurrency(after), formatCurrency(after - before)];
  });
  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-500">{title}: {earlier.periodCode} and {later.periodCode}, stored net pay only.</p>
      <SimpleTable headers={['Employee', earlier.periodCode, later.periodCode, 'Change']} rows={table} />
    </div>
  );
}

function RecapReport({ title, records, items, nameOf }: { title: string; records: PayrollRecord[]; items: PayrollItem[]; nameOf: (id: string) => string }) {
  if (records.length === 0 && items.length === 0) return <EmptyReport title={title} detail="No payroll components are stored for this range." />;
  const totals = new Map<string, number>();
  const add = (label: string, amount: number) => totals.set(label, (totals.get(label) ?? 0) + amount);
  if (items.length > 0) items.forEach(item => add(item.componentName, item.amount));
  else records.forEach(record => {
    add('Basic salary', record.basicSalary);
    add('Allowance', record.allowance);
    add('Overtime', record.overtime);
    add('Deductions', record.totalDeductions);
  });
  const byEmployee = records.map(record => [nameOf(record.employeeId), formatCurrency(record.netPay)]);
  return (
    <div className="space-y-3">
      <SimpleTable headers={['Component', 'Amount']} rows={[...totals.entries()].map(([label, amount]) => [label, formatCurrency(amount)])} />
      {byEmployee.length > 0 && <SimpleTable headers={['Employee', 'Net']} rows={byEmployee} />}
    </div>
  );
}

function TaxReport({ title, items, componentRows, nameOf, recordEmployee }: { title: string; items: PayrollItem[]; componentRows: { employeeId: string; amount: number }[]; nameOf: (id: string) => string; recordEmployee: (item: PayrollItem) => string }) {
  if (items.length === 0 && componentRows.length === 0) return <EmptyReport title={title} detail="PPh 21 has not been stored for this range. This report does not calculate tax." />;
  const rows = items.length > 0
    ? items.map(item => [nameOf(recordEmployee(item)), item.componentName, formatCurrency(item.amount)])
    : componentRows.map(row => [nameOf(row.employeeId), 'PPh 21', formatCurrency(row.amount)]);
  return <SimpleTable headers={['Employee', 'Component', 'Stored amount']} rows={rows} />;
}

function BpjsReport({ title, items, componentRows, nameOf, recordEmployee }: { title: string; items: PayrollItem[]; componentRows: { employeeId: string; code: string; amount: number }[]; nameOf: (id: string) => string; recordEmployee: (item: PayrollItem) => string }) {
  if (items.length === 0 && componentRows.length === 0) return <EmptyReport title={title} detail="No BPJS amounts are stored for this range. This report does not apply a contribution rate." />;
  const rows = items.length > 0
    ? items.map(item => [nameOf(recordEmployee(item)), item.componentName, formatCurrency(item.amount)])
    : componentRows.map(row => [nameOf(row.employeeId), row.code, formatCurrency(row.amount)]);
  return <SimpleTable headers={['Employee', 'Component', 'Stored amount']} rows={rows} />;
}

function HumanResources({ records, departments, joined }: { records: { id: string; fullName: string; departmentId: string; employmentStatus: string; joinDate: string }[]; departments: { id: string; name: string; isActive: boolean }[]; joined: number }) {
  if (records.length === 0) return <EmptyReport title="Human Resources Report" detail="No employees are in this company for the selected range." />;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Headcount" value={String(records.length)} />
        <Stat label="Joined in range" value={String(joined)} tone="text-emerald-700" />
      </div>
      <SimpleTable headers={['Employee', 'Department', 'Status', 'Join date']} rows={records.map(person => [person.fullName, departments.find(row => row.id === person.departmentId)?.name || '—', person.employmentStatus, person.joinDate])} />
    </div>
  );
}

function AttendanceReport({ rows }: { rows: { id: string; attendanceDate: string; employeeId: string; status: string }[] }) {
  if (rows.length === 0) return <EmptyReport title="Attendance Report" detail="No attendance rows are stored for this range." />;
  const count = (status: string) => rows.filter(row => row.status === status).length;
  return (
    <div className="grid grid-cols-2 gap-3">
      <Stat label="Present" value={String(count('PRESENT'))} tone="text-emerald-700" />
      <Stat label="Late" value={String(count('LATE'))} tone="text-orange-600" />
      <Stat label="Absent" value={String(count('ABSENT'))} tone="text-red-600" />
      <Stat label="On leave" value={String(count('ON_LEAVE'))} tone="text-blue-600" />
    </div>
  );
}
