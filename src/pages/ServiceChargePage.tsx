import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { serviceChargeV2Api } from '../services/api';
import { serviceChargePayDate } from '../lib/serviceChargePay.js';
import { buildBankCsv, generateDemoServiceCharge } from '../lib/payrollDemoCycle';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

const ATTENDANCE_STATUS_OPTIONS = ['PRESENT', 'LATE', 'ON_LEAVE', 'SICK', 'REST_DAY', 'ABSENT'];
const isEmbedded = typeof window !== 'undefined' && !!window.__WOLF_HR_EMBEDDED__;

export default function ServiceChargePage() {
  const { payPolicy, addToast, addAuditLog, employees, attendance, terTables, setServiceChargeSlips } = useApp();
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(10);
  const [total, setTotal] = useState('100000000');
  const [pools, setPools] = useState<{ pool_key: string; label: string; pct: number }[]>([
    { pool_key: 'employee_pool', label: 'Employees', pct: 50 },
    { pool_key: 'breakage', label: 'Breakage', pct: 0 },
    { pool_key: 'hr_development', label: 'HR development', pct: 0 },
    { pool_key: 'company_other', label: 'Company other', pct: 0 },
  ]);
  const [presentStatuses, setPresentStatuses] = useState<string[]>(['PRESENT', 'LATE']);
  const [policyBasis, setPolicyBasis] = useState('Demo hotel PKB — equal per present day');
  const [items, setItems] = useState<any[]>([]);
  const [meta, setMeta] = useState<{ value_per_day?: number; under_95_warning?: boolean; status?: string; version?: number }>({});
  const [busy, setBusy] = useState(false);

  // SC for calendar month M is paid on the 15th of month M+1 (salary pay month).
  const payMonth = month === 12 ? 1 : month + 1;
  const payYear = month === 12 ? year + 1 : year;
  const payDate = serviceChargePayDate(`${payYear}-${String(payMonth).padStart(2, '0')}-01`, payPolicy.serviceChargePayDay || 15);
  const poolSum = pools.reduce((sum, p) => sum + (Number(p.pct) || 0), 0);

  const persistSlips = useCallback((rows: any[], status: 'DRAFT' | 'PUBLISHED', valuePerDay: number) => {
    const slips = (rows || [])
      .filter((row) => row && (row.employee_id || row.employeeId) && Number(row.net || row.gross || 0) > 0)
      .map((row) => ({
        id: `sc_${year}_${month}_${row.employee_id || row.employeeId}`,
        year,
        month,
        status,
        employeeId: String(row.employee_id || row.employeeId),
        employeeCode: row.employee_code || row.employeeCode,
        fullName: row.full_name || row.fullName,
        daysPresent: Math.trunc(Number(row.days_present ?? row.daysPresent) || 0),
        gross: Math.trunc(Number(row.gross) || 0),
        pph21: Math.trunc(Number(row.pph21) || 0),
        net: Math.trunc(Number(row.net) || 0),
        valuePerDay: Math.trunc(Number(valuePerDay) || 0),
        payDate,
        eligible: row.eligible !== false,
      }));
    setServiceChargeSlips((prev) => [
      ...prev.filter((slip) => !(slip.year === year && slip.month === month)),
      ...slips,
    ]);
  }, [year, month, payDate, setServiceChargeSlips]);

  useEffect(() => {
    if (!isEmbedded) return;
    serviceChargeV2Api.getSettings()
      .then((row) => {
        if (Array.isArray(row.pools) && row.pools.length) {
          setPools(row.pools.map((p: any) => ({ pool_key: p.pool_key, label: p.label, pct: Number(p.pct) || 0 })));
        }
        const statuses = row.settings?.present_statuses;
        if (Array.isArray(statuses) && statuses.length) setPresentStatuses(statuses.map(String));
        if (row.settings?.policy_basis) setPolicyBasis(String(row.settings.policy_basis));
      })
      .catch(() => undefined);
    serviceChargeV2Api.get(year, month)
      .then((current) => {
        const rows = current.items || [];
        setItems(rows);
        const statusRaw = String(current.month?.status || '').toUpperCase();
        const status: 'DRAFT' | 'PUBLISHED' = statusRaw === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT';
        setMeta({
          value_per_day: current.version?.value_per_day,
          status,
          version: current.version?.version,
        });
        if (current.month?.total_service_charge != null) setTotal(String(current.month.total_service_charge));
        if (rows.length) {
          persistSlips(rows, status, Number(current.version?.value_per_day) || 0);
        }
      })
      .catch(() => {
        setItems([]);
        setMeta({});
      });
  }, [year, month, persistSlips]);

  const saveSettings = async () => {
    if (!isEmbedded) {
      addToast('Service charge settings kept locally for this demo session.', 'success');
      return;
    }
    try {
      await serviceChargeV2Api.saveSettings({
        settings: {
          employee_pool_pct: pools.find((p) => p.pool_key === 'employee_pool')?.pct ?? 50,
          policy_basis: policyBasis,
          present_statuses: presentStatuses,
          eligible_contract_types: ['PKWTT', 'PKWT'],
          tax_method: 'FLAT',
        },
        pools,
      });
      addToast('Service charge settings saved.', 'success');
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Settings could not be saved.', 'error');
    }
  };

  const runLocalGenerate = (publish: boolean, amount: number) => {
    const result = generateDemoServiceCharge({
      year,
      month,
      total: amount,
      pools,
      presentStatuses,
      employees,
      attendance,
      terTables,
    });
    setItems(result.items || []);
    const status = publish ? 'PUBLISHED' : 'DRAFT';
    setMeta({
      value_per_day: result.value_per_day,
      under_95_warning: result.under_95_warning,
      status,
      version: result.version,
    });
    persistSlips(result.items || [], status, result.value_per_day || 0);
    if (result.under_95_warning) {
      addToast('Employee pool is under 95%. Document the policy basis.', 'info');
    }
    const eligibleCount = (result.items || []).filter((i: any) => i.eligible !== false && i.gross > 0).length;
    addToast(
      publish
        ? `Service charge published (local demo) — ${eligibleCount} eligible.`
        : `Service charge draft (local demo) — ${eligibleCount} eligible · ${formatCurrency(result.value_per_day)} / day.`,
      'success',
    );
    addAuditLog(publish ? 'UPDATE' : 'CREATE', 'ServiceChargeMonth', `${year}-${month}`, publish ? 'Published (demo)' : `Draft v${result.version} (demo)`);
  };

  const generate = async (publish: boolean) => {
    const amount = Math.trunc(Number(String(total).replace(/[^\d]/g, '')) || 0);
    if (amount <= 0) {
      addToast('Enter the monthly service charge total.', 'error');
      return;
    }
    setBusy(true);
    if (!isEmbedded) {
      try {
        runLocalGenerate(publish, amount);
      } finally {
        setBusy(false);
      }
      return;
    }
    try {
      await saveSettings();
      const result = await serviceChargeV2Api.generate(year, month, {
        total_service_charge: amount,
        pools,
        publish,
      });
      setItems(result.items || []);
      const status = publish ? 'PUBLISHED' : 'DRAFT';
      setMeta({
        value_per_day: result.value_per_day,
        under_95_warning: result.under_95_warning,
        status,
        version: result.version,
      });
      persistSlips(result.items || [], status, Number(result.value_per_day) || 0);
      if (result.under_95_warning) {
        addToast('Employee pool is under 95%. Document the policy basis.', 'info');
      }
      addToast(publish ? 'Service charge published.' : `Service charge draft generated (v${result.version}).`, 'success');
      addAuditLog(publish ? 'UPDATE' : 'CREATE', 'ServiceChargeMonth', `${year}-${month}`, publish ? 'Published' : `Draft v${result.version}`);
    } catch (error) {
      // API offline — fall back to client demo
      runLocalGenerate(publish, amount);
      addToast('API offline — used local demo calculator.', 'info');
    } finally {
      setBusy(false);
    }
  };

  const downloadLocalBank = (bank: 'mandiri' | 'bni' | 'bri') => {
    if (!items.length) {
      addToast('Generate a draft before exporting.', 'error');
      return;
    }
    const file = buildBankCsv(
      bank,
      items.map((row) => ({
        bank_account: row.bank_account,
        bank_account_name: row.bank_account_name,
        bank_name: row.bank_name,
        net: Number(row.net) || 0,
        employee_code: row.employee_code,
        full_name: row.full_name,
      })),
      `${year}-${String(month).padStart(2, '0')}`,
    );
    const blob = new Blob([file.content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadBank = async (bank: 'mandiri' | 'bni' | 'bri') => {
    if (!isEmbedded) {
      downloadLocalBank(bank);
      return;
    }
    try {
      const file = await serviceChargeV2Api.bank(year, month, bank);
      const blob = new Blob([file.content], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      downloadLocalBank(bank);
      addToast(error instanceof Error ? `${error.message} — exported local CSV.` : 'Exported local CSV.', 'info');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Service charge</h1>
        <p className="text-sm text-slate-500 mt-1">
          Calendar month, paid on the 15th for the prior month. Equal share per present day. Separate from monthly payroll.
        </p>
      </div>

      <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div className="flex flex-wrap gap-4 items-end">
          <label className="text-sm space-y-1">
            <span className="font-medium text-slate-700">Year</span>
            <input type="number" className="block border border-slate-200 rounded-lg px-3 py-2 w-28" value={year} onChange={(e) => setYear(Number(e.target.value) || year)} />
          </label>
          <label className="text-sm space-y-1">
            <span className="font-medium text-slate-700">Month</span>
            <input type="number" min={1} max={12} className="block border border-slate-200 rounded-lg px-3 py-2 w-24" value={month} onChange={(e) => setMonth(Number(e.target.value) || month)} />
          </label>
          <label className="text-sm space-y-1 flex-1 min-w-[12rem]">
            <span className="font-medium text-slate-700">Total service charge (IDR)</span>
            <input className="block w-full border border-slate-200 rounded-lg px-3 py-2" value={total} onChange={(e) => setTotal(e.target.value)} />
          </label>
          <p className="text-sm text-slate-500">Pay date {payDate || '—'}</p>
        </div>

        <div>
          <p className="text-sm font-medium text-slate-800 mb-2">Pools (must total 100%; remainder stays unallocated)</p>
          <div className="space-y-2">
            {pools.map((pool, index) => (
              <div key={pool.pool_key} className="flex flex-wrap gap-2 items-center">
                <input
                  className="border border-slate-200 rounded-lg px-2 py-1 text-sm flex-1 min-w-[8rem]"
                  value={pool.label}
                  onChange={(e) => setPools((prev) => prev.map((row, i) => i === index ? { ...row, label: e.target.value } : row))}
                />
                <input
                  type="number"
                  className="border border-slate-200 rounded-lg px-2 py-1 text-sm w-24"
                  value={pool.pct}
                  onChange={(e) => setPools((prev) => prev.map((row, i) => i === index ? { ...row, pct: Number(e.target.value) || 0 } : row))}
                />
                <span className="text-xs text-slate-500">%</span>
              </div>
            ))}
          </div>
          <p className={`text-xs mt-2 ${poolSum === 100 ? 'text-slate-500' : 'text-amber-700'}`}>Allocated {poolSum}% · unallocated {Math.max(0, 100 - poolSum)}%</p>
        </div>

        <label className="block text-sm space-y-1">
          <span className="font-medium text-slate-700">Policy basis</span>
          <textarea className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" rows={2} value={policyBasis} onChange={(e) => setPolicyBasis(e.target.value)} placeholder="PKB / written company policy…" />
        </label>

        <div>
          <p className="text-sm font-medium text-slate-800 mb-2">Count as present for SC</p>
          <div className="flex flex-wrap gap-3">
            {ATTENDANCE_STATUS_OPTIONS.map((status) => (
              <label key={status} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={presentStatuses.includes(status)}
                  onChange={(e) => setPresentStatuses((prev) => e.target.checked ? [...prev, status] : prev.filter((s) => s !== status))}
                />
                {status}
              </label>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-1">Default eligible staff: PKWTT and PKWT only.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => generate(false)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
            Generate draft
          </button>
          <button type="button" disabled={busy} onClick={() => generate(true)} className="px-4 py-2 bg-emerald-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
            Publish
          </button>
          <button type="button" onClick={saveSettings} className="px-4 py-2 border border-slate-200 rounded-lg text-sm">
            Save settings
          </button>
        </div>
        {meta.under_95_warning && <p className="text-sm text-amber-700">Employee pool is under 95% — keep the policy basis on file.</p>}
        {meta.status && <p className="text-sm text-slate-600">Status {meta.status}{meta.version != null ? ` · version ${meta.version}` : ''}{meta.value_per_day != null ? ` · ${formatCurrency(meta.value_per_day)} / present day` : ''}</p>}
      </section>

      <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
        <div className="flex flex-wrap justify-between gap-2 items-center">
          <h2 className="font-semibold text-slate-800">Results</h2>
          <div className="flex gap-2">
            <button type="button" onClick={() => downloadBank('mandiri')} className="text-sm text-indigo-700">Mandiri</button>
            <button type="button" onClick={() => downloadBank('bni')} className="text-sm text-indigo-700">BNI</button>
            <button type="button" onClick={() => downloadBank('bri')} className="text-sm text-indigo-700">BRI</button>
          </div>
        </div>
        <p className="text-xs text-slate-500">Announcement should show pool totals and value per day only — not per-person amounts.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="py-2">Employee</th>
                <th className="py-2">Days</th>
                <th className="py-2">Gross</th>
                <th className="py-2">PPh</th>
                <th className="py-2">Net</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={5} className="py-6 text-slate-500">Generate a draft to see shares.</td></tr>
              ) : (
                items.map((row) => (
                  <tr key={row.employee_id || row.employeeId} className="border-b border-slate-100">
                    <td className="py-2">
                      <div className="font-medium text-slate-800">{row.full_name || row.employee_name || '—'}</div>
                      <div className="text-xs text-slate-500">{row.employee_code}{row.eligible === false ? ' · not eligible' : ''}</div>
                    </td>
                    <td className="py-2">{row.days_present ?? 0}</td>
                    <td className="py-2">{formatCurrency(Number(row.gross) || 0)}</td>
                    <td className="py-2">{formatCurrency(Number(row.pph21) || 0)}</td>
                    <td className="py-2 font-medium">{formatCurrency(Number(row.net) || 0)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
