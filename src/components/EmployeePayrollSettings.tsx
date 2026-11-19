import { useEffect, useState } from 'react';
import { employeePayrollSettingsApi, EmployeePayrollConfigRow } from '../services/api';
import { mockPayrollConfigs } from '../data/mockPayrollConfigs';

const isEmbedded = typeof window !== 'undefined' && !!window.__WOLF_HR_EMBEDDED__;

const defaults: EmployeePayrollConfigRow = {
  employee_id: '',
  pay_type: 'MONTHLY',
  gross_fixed_salary: null,
  basic_percentage: 60,
  daily_rate: null,
  working_days_per_month: 22,
  housing_allowance: 0,
  transport_allowance: 0,
  attendance_allowance_per_day: 0,
  bpjs_kesehatan_enabled: true,
  bpjs_tk_enabled: true,
  bpjs_base: 'BASIC',
  company_covers_employee_bpjs: false,
  tax_mode: 'COMPANY',
  npwp_enabled: true,
};

function money(value: number | null | undefined) {
  if (value == null || value === 0) return '';
  return String(value);
}

function parseMoney(raw: string) {
  const n = Number(String(raw).replace(/[^\d]/g, ''));
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

export default function EmployeePayrollSettings({
  employeeId,
  canEdit,
  notify,
}: {
  employeeId: string;
  canEdit: boolean;
  notify: (message: string, type: 'success' | 'error' | 'info') => void;
}) {
  const [row, setRow] = useState<EmployeePayrollConfigRow>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    if (!isEmbedded) {
      const mock = mockPayrollConfigs[employeeId];
      if (mock) {
        setRow({
          ...defaults,
          employee_id: employeeId,
          pay_type: mock.pay_type,
          gross_fixed_salary: mock.gross_fixed_salary,
          basic_percentage: mock.basic_percentage,
          daily_rate: mock.daily_rate,
          working_days_per_month: mock.working_days_per_month,
          housing_allowance: mock.housing_allowance,
          transport_allowance: mock.transport_allowance,
          attendance_allowance_per_day: mock.attendance_allowance_per_day,
          bpjs_kesehatan_enabled: mock.bpjs_kesehatan_enabled,
          bpjs_tk_enabled: mock.bpjs_tk_enabled,
          bpjs_base: mock.bpjs_base,
          company_covers_employee_bpjs: mock.company_covers_employee_bpjs,
          tax_mode: mock.tax_mode,
          npwp_enabled: mock.npwp_enabled,
        });
      } else {
        setRow({ ...defaults, employee_id: employeeId });
      }
      setLoading(false);
      return () => { cancelled = true; };
    }
    employeePayrollSettingsApi.get(employeeId)
      .then((saved) => { if (!cancelled) setRow({ ...defaults, ...saved }); })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setRow({ ...defaults, employee_id: employeeId });
        setError(reason instanceof Error ? reason.message : 'The payroll config could not be opened.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [employeeId]);

  const basicPreview = row.pay_type === 'MONTHLY' && row.gross_fixed_salary
    ? Math.round((row.gross_fixed_salary * (row.basic_percentage || 60)) / 100)
    : 0;
  const fixedPreview = row.pay_type === 'MONTHLY' && row.gross_fixed_salary
    ? row.gross_fixed_salary - basicPreview
    : 0;

  const save = () => {
    setSaving(true);
    setError('');
    const payload = {
      pay_type: row.pay_type,
      gross_fixed_salary: row.pay_type === 'MONTHLY' ? row.gross_fixed_salary : null,
      basic_percentage: row.basic_percentage,
      daily_rate: row.pay_type === 'DAILY' ? row.daily_rate : null,
      working_days_per_month: row.working_days_per_month,
      housing_allowance: row.housing_allowance || 0,
      transport_allowance: row.transport_allowance || 0,
      attendance_allowance_per_day: row.attendance_allowance_per_day || 0,
      bpjs_kesehatan_enabled: row.bpjs_kesehatan_enabled,
      bpjs_tk_enabled: row.bpjs_tk_enabled,
      bpjs_base: row.bpjs_base,
      company_covers_employee_bpjs: row.company_covers_employee_bpjs,
      tax_mode: row.tax_mode,
      npwp_enabled: row.npwp_enabled,
    };
    if (!isEmbedded) {
      const existing = mockPayrollConfigs[employeeId];
      mockPayrollConfigs[employeeId] = {
        ...(existing || {
          contract_kind: 'PKWTT' as const,
          loan_installment: 0,
        }),
        ...payload,
        gross_fixed_salary: payload.gross_fixed_salary,
        daily_rate: payload.daily_rate,
      };
      setRow({ ...defaults, employee_id: employeeId, ...payload });
      notify('Payroll config saved (local demo).', 'success');
      setSaving(false);
      return;
    }
    employeePayrollSettingsApi.save(employeeId, payload)
      .then((saved) => {
        setRow({ ...defaults, ...saved });
        notify('Payroll config saved.', 'success');
      })
      .catch((reason: unknown) => {
        const message = reason instanceof Error ? reason.message : 'The payroll config could not be saved.';
        setError(message);
        notify(message, 'error');
      })
      .finally(() => setSaving(false));
  };

  if (loading) return <p className="text-sm text-slate-500">Opening payroll config…</p>;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
      <div>
        <h3 className="font-semibold text-slate-800">Employee payroll</h3>
        <p className="text-sm text-slate-500 mt-1">
          Simple checklist: pay type, fixed salary split, allowances, BPJS, and tax. Statutory rates live under Compliance.
        </p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-slate-800">Pay type</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" checked={row.pay_type === 'MONTHLY'} disabled={!canEdit} onChange={() => setRow((c) => ({ ...c, pay_type: 'MONTHLY' }))} />
          Monthly
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" checked={row.pay_type === 'DAILY'} disabled={!canEdit} onChange={() => setRow((c) => ({ ...c, pay_type: 'DAILY' }))} />
          Daily worker
        </label>
      </fieldset>

      {row.pay_type === 'MONTHLY' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="text-sm space-y-1">
            <span className="font-medium text-slate-700">Total fixed salary (IDR)</span>
            <input
              className="w-full border border-slate-200 rounded-lg px-3 py-2"
              disabled={!canEdit}
              value={money(row.gross_fixed_salary)}
              onChange={(e) => setRow((c) => ({ ...c, gross_fixed_salary: parseMoney(e.target.value) || null }))}
            />
          </label>
          <label className="text-sm space-y-1">
            <span className="font-medium text-slate-700">Basic %</span>
            <input
              type="number"
              min={1}
              max={100}
              className="w-full border border-slate-200 rounded-lg px-3 py-2"
              disabled={!canEdit}
              value={row.basic_percentage}
              onChange={(e) => setRow((c) => ({ ...c, basic_percentage: Number(e.target.value) || 60 }))}
            />
            <span className="text-xs text-slate-500">Basic {basicPreview.toLocaleString('id-ID')} · Fixed allowance {fixedPreview.toLocaleString('id-ID')}</span>
          </label>
        </div>
      ) : (
        <label className="text-sm space-y-1 block max-w-sm">
          <span className="font-medium text-slate-700">Daily rate (IDR)</span>
          <input
            className="w-full border border-slate-200 rounded-lg px-3 py-2"
            disabled={!canEdit}
            value={money(row.daily_rate)}
            onChange={(e) => setRow((c) => ({ ...c, daily_rate: parseMoney(e.target.value) || null }))}
          />
        </label>
      )}

      <label className="text-sm space-y-1 block max-w-xs">
        <span className="font-medium text-slate-700">Working days / month</span>
        <input
          type="number"
          min={1}
          max={31}
          className="w-full border border-slate-200 rounded-lg px-3 py-2"
          disabled={!canEdit}
          value={row.working_days_per_month}
          onChange={(e) => setRow((c) => ({ ...c, working_days_per_month: Number(e.target.value) || 22 }))}
        />
      </label>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <label className="text-sm space-y-1">
          <span className="font-medium text-slate-700">Housing / month</span>
          <input className="w-full border border-slate-200 rounded-lg px-3 py-2" disabled={!canEdit} value={money(row.housing_allowance)} onChange={(e) => setRow((c) => ({ ...c, housing_allowance: parseMoney(e.target.value) }))} />
        </label>
        <label className="text-sm space-y-1">
          <span className="font-medium text-slate-700">Transport / month</span>
          <input className="w-full border border-slate-200 rounded-lg px-3 py-2" disabled={!canEdit} value={money(row.transport_allowance)} onChange={(e) => setRow((c) => ({ ...c, transport_allowance: parseMoney(e.target.value) }))} />
        </label>
        <label className="text-sm space-y-1">
          <span className="font-medium text-slate-700">Attendance / day present</span>
          <input className="w-full border border-slate-200 rounded-lg px-3 py-2" disabled={!canEdit} value={money(row.attendance_allowance_per_day)} onChange={(e) => setRow((c) => ({ ...c, attendance_allowance_per_day: parseMoney(e.target.value) }))} />
        </label>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-800">BPJS</p>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={row.bpjs_kesehatan_enabled} disabled={!canEdit} onChange={(e) => setRow((c) => ({ ...c, bpjs_kesehatan_enabled: e.target.checked }))} /> BPJS Kesehatan</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={row.bpjs_tk_enabled} disabled={!canEdit} onChange={(e) => setRow((c) => ({ ...c, bpjs_tk_enabled: e.target.checked }))} /> BPJS Ketenagakerjaan</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={row.company_covers_employee_bpjs} disabled={!canEdit || !(row.bpjs_kesehatan_enabled || row.bpjs_tk_enabled)} onChange={(e) => setRow((c) => ({ ...c, company_covers_employee_bpjs: e.target.checked }))} /> Company covers employee BPJS share</label>
        <fieldset className="space-y-1 pt-1">
          <legend className="text-xs text-slate-500">BPJS wage base</legend>
          <label className="flex items-center gap-2 text-sm"><input type="radio" checked={row.bpjs_base === 'BASIC'} disabled={!canEdit} onChange={() => setRow((c) => ({ ...c, bpjs_base: 'BASIC' }))} /> Basic only</label>
          <label className="flex items-center gap-2 text-sm"><input type="radio" checked={row.bpjs_base === 'BASIC_PLUS_FIXED'} disabled={!canEdit} onChange={() => setRow((c) => ({ ...c, bpjs_base: 'BASIC_PLUS_FIXED' }))} /> Basic + fixed allowance</label>
        </fieldset>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-slate-800">PPh 21</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" checked={row.tax_mode === 'COMPANY'} disabled={!canEdit} onChange={() => setRow((c) => ({ ...c, tax_mode: 'COMPANY' }))} />
          Company pays tax (no employee deduction)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" checked={row.tax_mode === 'EMPLOYEE'} disabled={!canEdit} onChange={() => setRow((c) => ({ ...c, tax_mode: 'EMPLOYEE' }))} />
          Employee pays tax (deducted from take-home)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={row.npwp_enabled} disabled={!canEdit} onChange={(e) => setRow((c) => ({ ...c, npwp_enabled: e.target.checked }))} />
          Has NPWP
        </label>
      </fieldset>

      {canEdit && (
        <button type="button" onClick={save} disabled={saving} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save payroll config'}
        </button>
      )}
    </div>
  );
}
