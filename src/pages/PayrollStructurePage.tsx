import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { basisPointsFromPercent, defaultPayrollStructure, hrCanConfigurePayroll, percentFromBasisPoints, sharedTariffCodes } from '../lib/payrollStructureView';
import { mapPayrollStructure, payrollApi } from '../services/api';
import type { PayrollStructure, PayrollStructureComponent } from '../types';

const codePattern = /^[a-z][a-z0-9_]{0,31}$/;
const reserved = new Set(['gross', 'net']);

type DraftComponent = PayrollStructureComponent & { rateText: string };
type DraftStructure = Omit<PayrollStructure, 'components'> & { components: DraftComponent[] };

function withRateText(structure: PayrollStructure): DraftStructure {
  return {
    ...structure,
    components: structure.components.map((component) => ({
      ...component,
      rateBp: component.rateBp ?? null,
      wageBase: component.wageBase ?? [],
      rateText: percentFromBasisPoints(component.rateBp),
    })),
  };
}

function blankComponent(): DraftComponent {
  return { code: '', displayName: '', kind: 'earning', sortOrder: 0, active: true, rateBp: null, wageBase: [], rateText: '' };
}

export default function PayrollStructurePage() {
  const { user } = useAuth();
  const allowed = hrCanConfigurePayroll(user?.role);
  const [draft, setDraft] = useState<DraftStructure>(() => withRateText(defaultPayrollStructure));
  const [savedCodes, setSavedCodes] = useState<string[]>(defaultPayrollStructure.components.map((component) => component.code));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!allowed) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    payrollApi.getStructure().then((row) => {
      if (cancelled) return;
      const mapped = mapPayrollStructure(row) ?? defaultPayrollStructure;
      setDraft(withRateText(mapped));
      setSavedCodes(mapped.components.map((component) => component.code));
      setLoading(false);
    }).catch((reason: unknown) => {
      if (cancelled) return;
      setDraft(withRateText(defaultPayrollStructure));
      setError(reason instanceof Error ? reason.message : 'The payroll structure could not be opened.');
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [allowed]);

  const updateComponent = (index: number, patch: Partial<DraftComponent>) => {
    setDraft((current) => ({
      ...current,
      components: current.components.map((component, item) => item === index ? { ...component, ...patch } : component),
    }));
  };

  const move = (index: number, direction: -1 | 1) => {
    setDraft((current) => {
      const next = current.components.slice();
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      const [row] = next.splice(index, 1);
      next.splice(target, 0, row);
      return { ...current, components: next };
    });
  };

  const addComponent = () => {
    setDraft((current) => ({ ...current, components: [...current.components, blankComponent()] }));
  };

  const toggleWageBase = (index: number, code: string) => {
    setDraft((current) => ({
      ...current,
      components: current.components.map((component, item) => {
        if (item !== index) return component;
        const selected = new Set(component.wageBase);
        if (selected.has(code)) selected.delete(code);
        else selected.add(code);
        const wageBase = current.components
          .map((row) => row.code)
          .filter((rowCode) => selected.has(rowCode) && rowCode !== component.code && rowCode !== '');
        return { ...component, wageBase };
      }),
    }));
  };

  const removeComponent = (index: number) => {
    setDraft((current) => ({
      ...current,
      components: current.components.filter((_, item) => item !== index),
    }));
  };

  const save = () => {
    setError('');
    setMessage('');
    const seen = new Set<string>();
    for (const component of draft.components) {
      const code = component.code.trim();
      if (!codePattern.test(code) || reserved.has(code)) {
        setError('Use a component code of lowercase letters, numbers, and underscores.');
        return;
      }
      if (seen.has(code)) {
        setError('A component code is repeated.');
        return;
      }
      seen.add(code);
      if (!component.displayName.trim()) {
        setError('Each component needs a display name.');
        return;
      }
    }
    if (!seen.has('basic')) {
      setError('The basic component has to stay on the structure.');
      return;
    }
    const components = [];
    for (const component of draft.components) {
      const code = component.code.trim();
      const shared = sharedTariffCodes.has(code);
      const rateBp = shared ? basisPointsFromPercent(component.rateText) : null;
      if (shared && component.rateText.trim() !== '' && rateBp == null) {
        setError('Enter a company tariff percent with at most two decimal places.');
        return;
      }
      const known = new Set(draft.components.map((row) => row.code.trim()));
      const wageBase = shared
        ? component.wageBase.filter((base) => base !== code && known.has(base))
        : [];
      components.push({
        code,
        display_name: component.displayName.trim(),
        kind: code === 'basic' ? 'earning' as const : component.kind,
        active: component.active === true,
        rate_bp: rateBp,
        wage_base: wageBase,
      });
    }
    setSaving(true);
    payrollApi.saveStructure({
      gross_formula: draft.grossFormula.trim(),
      net_formula: draft.netFormula.trim(),
      components,
    }).then((row) => {
      const mapped = mapPayrollStructure(row);
      if (!mapped) throw new Error('The payroll structure could not be saved.');
      setDraft(withRateText(mapped));
      setSavedCodes(mapped.components.map((component) => component.code));
      setMessage('Payroll structure saved for this company. Opened pay periods keep the structure they were opened with.');
    }).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : 'The payroll structure could not be saved.');
    }).finally(() => setSaving(false));
  };

  if (!allowed) {
    return <p className="text-sm text-slate-600">Payroll configuration is available to HR staff and HR admin.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Payroll configuration</h1>
          <p className="text-slate-500 text-sm mt-1">Components, company tariffs, and the gross and net formulas for this company.</p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={loading || saving}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save structure'}
        </button>
      </div>

      <p className="text-sm text-slate-600">
        Opened pay periods keep the structure they were opened with. Basic stays each employee&apos;s gaji pokok. Transport and komunikasi stay a per-person amount on Salary structure. A company tariff is the same percent for every eligible person.
        {draft.effectiveFrom ? ` Current structure effective ${draft.effectiveFrom}.` : ''}
      </p>
      {message && <p className="text-sm font-medium text-emerald-700">{message}</p>}
      {error && <p className="text-sm font-medium text-red-700">{error}</p>}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800">Components</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {draft.components.map((component, index) => {
            const codeLocked = savedCodes.includes(component.code) && component.code !== '';
            const sharedTariff = sharedTariffCodes.has(component.code);
            const tariffUnset = sharedTariff && (component.rateText.trim() === '' || component.wageBase.length === 0);
            return (
              <div key={`${component.code || 'new'}-${index}`} className="px-5 py-4 space-y-3">
              <div className="grid gap-3 md:grid-cols-[8rem_1fr_9rem_auto] md:items-end">
                <label className="text-sm text-slate-700">Code
                  <input
                    className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm disabled:bg-slate-50"
                    value={component.code}
                    disabled={codeLocked || component.code === 'basic'}
                    onChange={(event) => updateComponent(index, { code: event.target.value.toLowerCase() })}
                  />
                </label>
                <label className="text-sm text-slate-700">Display name
                  <input
                    className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    value={component.displayName}
                    onChange={(event) => updateComponent(index, { displayName: event.target.value })}
                  />
                </label>
                <label className="text-sm text-slate-700">Kind
                  <select
                    className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white disabled:bg-slate-50"
                    value={component.code === 'basic' ? 'earning' : component.kind}
                    disabled={component.code === 'basic'}
                    onChange={(event) => updateComponent(index, { kind: event.target.value === 'deduction' ? 'deduction' : 'earning' })}
                  >
                    <option value="earning">Earning</option>
                    <option value="deduction">Deduction</option>
                  </select>
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="text-sm text-slate-700 inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={component.active}
                      onChange={(event) => updateComponent(index, { active: event.target.checked })}
                    />
                    Active
                  </label>
                  <button type="button" className="px-2 py-1 text-xs border border-slate-300 rounded" onClick={() => move(index, -1)} disabled={index === 0}>Up</button>
                  <button type="button" className="px-2 py-1 text-xs border border-slate-300 rounded" onClick={() => move(index, 1)} disabled={index === draft.components.length - 1}>Down</button>
                  {component.code !== 'basic' && (
                    <button type="button" className="px-2 py-1 text-xs border border-slate-300 rounded text-slate-600" onClick={() => removeComponent(index)}>Remove</button>
                  )}
                </div>
              </div>
              {sharedTariff && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-sm text-slate-700">Company tariff, same for every eligible person.</p>
                    {tariffUnset && <p className="text-sm font-medium text-amber-700">Tariff not set</p>}
                  </div>
                  <label className="block text-sm text-slate-700 max-w-[12rem]">Percent
                    <input
                      inputMode="decimal"
                      className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                      value={component.rateText}
                      placeholder="0.00"
                      onChange={(event) => updateComponent(index, { rateText: event.target.value })}
                    />
                  </label>
                  <div>
                    <p className="text-sm text-slate-700">Wage base</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {draft.components.filter((row) => row.code && row.code !== component.code).map((row) => (
                        <label key={row.code} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={component.wageBase.includes(row.code)}
                            onChange={() => toggleWageBase(index, row.code)}
                          />
                          {row.displayName || row.code}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              </div>
            );
          })}
        </div>
        <div className="px-5 py-4 border-t border-slate-200">
          <button type="button" onClick={addComponent} className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50">
            Add component
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h2 className="font-semibold text-slate-800">Formulas</h2>
        <p className="text-sm text-slate-500">Addition and subtraction of component codes only. Gross and net are results, not components.</p>
        <label className="block text-sm text-slate-700">Gross
          <input
            className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
            value={draft.grossFormula}
            onChange={(event) => setDraft((current) => ({ ...current, grossFormula: event.target.value }))}
          />
        </label>
        <label className="block text-sm text-slate-700">Net
          <input
            className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
            value={draft.netFormula}
            onChange={(event) => setDraft((current) => ({ ...current, netFormula: event.target.value }))}
          />
        </label>
      </div>
    </div>
  );
}
