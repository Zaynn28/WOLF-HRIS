import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { cycleForMonth, periodScope } from '../lib/periodScope';
import type { PayrollPeriod } from '../types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function PayMonthPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const [year, month] = value.split('-').map(Number);
  const [viewYear, setViewYear] = useState(year);

  useEffect(() => {
    setViewYear(year);
  }, [year]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const firstYear = Math.min(year, new Date().getFullYear()) - 5;
  const lastYear = Math.max(year, new Date().getFullYear()) + 6;
  const years = Array.from({ length: lastYear - firstYear + 1 }, (_, index) => firstYear + index);
  const label = new Date(year, month - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  const apply = (nextYear: number, nextMonth: number) => {
    onChange(`${nextYear}-${String(nextMonth).padStart(2, '0')}`);
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        id="pay-month"
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(current => !current)}
        className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 bg-white inline-flex items-center gap-2 min-w-[10.5rem]"
      >
        <span>{label}</span>
        <span aria-hidden="true" className="text-slate-400">▾</span>
      </button>
      {open && (
        <div role="dialog" aria-label="Choose pay month" className="absolute z-30 mt-1 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
          <label htmlFor="pay-year" className="block text-xs font-medium text-slate-500 mb-1">Year</label>
          <select
            id="pay-year"
            value={viewYear}
            onChange={event => {
              const nextYear = Number(event.target.value);
              setViewYear(nextYear);
              apply(nextYear, month);
            }}
            className="w-full mb-3 px-2 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-800 bg-white"
          >
            {years.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
          <div className="grid grid-cols-4 gap-1">
            {MONTHS.map((name, index) => {
              const selected = viewYear === year && index + 1 === month;
              return (
                <button
                  key={name}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    apply(viewYear, index + 1);
                    setOpen(false);
                  }}
                  className={`px-2 py-1.5 rounded-lg text-sm ${selected ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-100'}`}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const formatDay = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const statusColor = (status: string) => {
  switch (status) {
    case 'CALCULATED': return 'bg-blue-100 text-blue-700';
    case 'UNDER_REVIEW': return 'bg-amber-100 text-amber-700';
    case 'APPROVED': return 'bg-emerald-100 text-emerald-700';
    case 'FINALIZED':
    case 'LOCKED': return 'bg-purple-100 text-purple-700';
    default: return 'bg-slate-100 text-slate-700';
  }
};

export default function PeriodBar() {
  const {
    payrollPeriods, setPayrollPeriods,
    workingPeriodId, setWorkingPeriodId,
    payPolicy, attendance, overtimeRequests, leaveRequests, leaveTypes,
    serviceChargeDistributions, payrollRecords, addToast,
  } = useApp();

  const period = payrollPeriods.find(row => row.id === workingPeriodId) || payrollPeriods[payrollPeriods.length - 1];
  const today = new Date();
  const openMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const scope = period ? periodScope(period, attendance, overtimeRequests, leaveRequests, leaveTypes, serviceChargeDistributions, payrollRecords) : null;

  const chooseMonth = (value: string) => {
    if (!/^\d{4}-\d{2}$/.test(value)) return;
    const existing = payrollPeriods.find(row => row.periodCode === value);
    if (existing) {
      setWorkingPeriodId(existing.id);
      return;
    }
    const [year, month] = value.split('-').map(Number);
    const cycle = cycleForMonth(year, month, payPolicy.cutoffDay, payPolicy.payDay);
    const created: PayrollPeriod = {
      id: `pp${Date.now()}`,
      ...cycle,
      status: 'DRAFT',
      createdBy: 'u1',
    };
    setPayrollPeriods(prev => [...prev, created]);
    setWorkingPeriodId(created.id);
    addToast(`${cycle.periodCode} is the working period for payroll, service charge, and export.`, 'success');
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-slate-700">Pay month</span>
        <PayMonthPicker value={period?.periodCode || openMonth} onChange={chooseMonth} />
        {period && <span className={`text-xs px-2 py-0.5 rounded ${statusColor(period.status)}`}>{period.status}</span>}
      </div>
      {period ? (
        <p className="text-sm text-slate-700">
          {formatDay(period.startDate)} – {formatDay(period.endDate)} · pay {formatDay(period.payDate)} · cutoff {payPolicy.cutoffDay}
        </p>
      ) : (
        <p className="text-sm text-slate-500">Choose a pay month. Its dates come from the cutoff and pay day.</p>
      )}
      {scope && (
      <p className="text-xs text-slate-500">
        Loaded for this month: {scope.attendanceCount} attendance rows, {scope.approvedOt} approved overtime{scope.pendingOt > 0 ? ` (${scope.pendingOt} pending)` : ''}, {scope.approvedLeave} approved leave{scope.unpaidDays > 0 ? ` (${scope.unpaidDays} unpaid days)` : ''}, {scope.distributedEmployees === 0 ? 'service charge not distributed' : `${scope.distributedEmployees} service-charge shares`}, {scope.records} payroll lines. Payroll, service charge, and export stay on this month.
      </p>
      )}
    </div>
  );
}
