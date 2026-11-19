import { useEffect, useState } from 'react';
import { employeePayApi, EmployeePayComponent } from '../services/api';

function formatRupiah(amount: number | null) {
  if (amount == null) return '';
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(amount);
}

function digitsFromDisplay(value: string) {
  return value.replace(/\D/g, '');
}

export default function EmployeePayComponents({
  employeeId,
  canEdit,
  notify,
}: {
  employeeId: string;
  canEdit: boolean;
  notify: (message: string, type: 'success' | 'error' | 'info') => void;
}) {
  const [rows, setRows] = useState<EmployeePayComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    employeePayApi.get(employeeId)
      .then((row) => { if (!cancelled) setRows(row.components); })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setRows([]);
        setError(reason instanceof Error ? reason.message : 'The component assignment could not be opened.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [employeeId]);

  const update = (code: string, patch: Partial<EmployeePayComponent>) => {
    setRows((current) => current.map((row) => row.code === code ? { ...row, ...patch } : row));
  };

  const save = () => {
    setSaving(true);
    setError('');
    employeePayApi.save(employeeId, rows.map((row) => ({
      code: row.code,
      eligible: row.eligible,
      amount: row.eligible && row.sets_amount ? row.amount : null,
    })))
      .then((row) => {
        setRows(row.components);
        notify('Component eligibility saved for this employee.', 'success');
      })
      .catch((reason: unknown) => {
        const message = reason instanceof Error ? reason.message : 'The component assignment could not be saved.';
        setError(message);
        notify(message, 'error');
      })
      .finally(() => setSaving(false));
  };

  if (loading) return <p className="text-sm text-slate-500">Opening component eligibility…</p>;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
      <div>
        <h3 className="font-semibold text-slate-800">Component eligibility</h3>
        <p className="text-sm text-slate-500 mt-1">Turn on only the payroll components this person receives. Basic salary stays the gaji pokok on the employee profile. Transport and komunikasi need a monthly amount. Overtime, bonus, and kasbon are included only when this person is eligible. Company percents for the shared BPJS components are set on Payroll components and apply to every eligible person.</p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {rows.length === 0 && !error && (
        <p className="text-sm text-slate-500">No payroll components are configured for this company yet.</p>
      )}
      <div className="divide-y divide-slate-100">
        {rows.map((row) => (
          <div key={row.code} className="py-3 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 min-w-[240px] text-sm text-slate-800">
              <input
                type="checkbox"
                checked={row.eligible}
                disabled={!canEdit}
                onChange={(event) => update(row.code, { eligible: event.target.checked, amount: event.target.checked ? row.amount : null })}
              />
              {row.display_name}
            </label>
            {row.sets_amount && (
              <input
                inputMode="numeric"
                disabled={!canEdit || !row.eligible}
                value={formatRupiah(row.amount)}
                onChange={(event) => {
                  const digits = digitsFromDisplay(event.target.value);
                  update(row.code, { amount: digits ? Number(digits) : null });
                }}
                placeholder="Amount"
                className="w-40 px-3 py-2 border border-slate-300 rounded-lg text-sm disabled:bg-slate-50"
              />
            )}
          </div>
        ))}
      </div>
      {canEdit && rows.length > 0 && (
        <button type="button" onClick={save} disabled={saving} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save eligibility'}
        </button>
      )}
    </div>
  );
}
