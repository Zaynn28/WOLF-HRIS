import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { FileText, Lock, AlertTriangle, Calculator, Download } from 'lucide-react';
import Modal from '../components/Modal';
import PeriodBar from '../components/PeriodBar';
import { downloadPayrollExport, PayrollExportFormat } from '../lib/payrollExport';
import { payrollConfigurationVisible } from '../lib/hr-navigation';
import {
  activePayrollComponents,
  defaultPayrollStructure,
  payrollComponentAmount,
  payrollProcessingSummary,
} from '../lib/payrollStructureView';
import { projectRunLinesToClient } from '../lib/payrollRunProjection';
import { mapPayrollRecord, mapPayrollStructure, payrollApi, payrollRunsApi } from '../services/api';
import type { PayrollRecord, PayrollStructure } from '../types';
import BulkUploadButton from '../components/BulkUploadButton';
import { generateDemoPayroll } from '../lib/payrollDemoCycle';

const formatCurrency = (amount: number) => new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
}).format(amount);

export default function PayrollPage({ onConfigure, mode = "run" }: { onConfigure?: () => void; mode?: "run" | "tax" }) {
  const {
    payrollPeriods,
    setPayrollPeriods,
    payrollRecords,
    setPayrollRecords,
    payrollItems,
    setPayrollItems,
    employees,
    departments,
    leaveRequests,
    leaveTypes,
    overtimeRequests,
    attendance,
    employeeLoans,
    bpjsRates,
    terTables,
    workingPeriodId,
    addToast,
    addAuditLog,
    addNotification,
    setPayrollPacks,
  } = useApp();
  const { user } = useAuth();
  const [showConfirmModal, setShowConfirmModal] = useState<'review' | 'finalize' | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [exportFormat, setExportFormat] = useState<PayrollExportFormat>('csv');
  const [structure, setStructure] = useState<PayrollStructure>(defaultPayrollStructure);
  const [structureSource, setStructureSource] = useState<'loading' | 'company' | 'period' | 'unavailable'>('loading');
  const [generateWarnings, setGenerateWarnings] = useState<string[]>([]);
  const [lastGenerateVersion, setLastGenerateVersion] = useState<number | null>(null);
  const embedded = typeof window !== 'undefined' && window.__WOLF_HR_EMBEDDED__ === true;

  useEffect(() => {
    let cancelled = false;
    const periodId = /^[0-9a-f-]{36}$/i.test(workingPeriodId) ? workingPeriodId : undefined;
    payrollApi.getStructure(periodId)
      .then((row) => {
        const mapped = mapPayrollStructure(row);
        if (cancelled || !mapped) return;
        setStructure(mapped);
        setStructureSource(mapped.source);
      })
      .catch(() => {
        if (!cancelled) setStructureSource('unavailable');
      });
    return () => {
      cancelled = true;
    };
  }, [workingPeriodId]);

  const period = payrollPeriods.find(p => p.id === workingPeriodId);
  const records = payrollRecords.filter(r => r.payrollPeriodId === workingPeriodId);
  const componentColumns = activePayrollComponents(structure).filter((component) => {
    // Hide meta-only codes from the processing grid headers when unused across the period.
    if (component.code === 'full_basic') return false;
    return true;
  });

  const summaries = records.map((record) => {
    const withheld = record.componentAmounts?.pph21;
    const benefit = record.componentAmounts?.pph21_benefit
      ?? (typeof withheld === 'number' && withheld > 0
        ? 0
        : (payrollItems.find((item) => item.payrollRecordId === record.id && item.componentCode.toLowerCase() === 'pph21')?.amount ?? 0));
    return payrollProcessingSummary(record, benefit);
  });
  const totalBasic = summaries.reduce((sum, row) => sum + row.basic, 0);
  const totalAllowance = summaries.reduce((sum, row) => sum + row.allowance, 0);
  const totalAdditional = summaries.reduce((sum, row) => sum + row.additional, 0);
  const totalDeduction = summaries.reduce((sum, row) => sum + row.deduction, 0);
  const totalBenefit = summaries.reduce((sum, row) => sum + row.benefit, 0);
  const totalNet = summaries.reduce((sum, row) => sum + row.total, 0);
  const totalGross = records.reduce((sum, record) => sum + record.grossPay, 0);
  const columnTotals = Object.fromEntries(
    componentColumns.map((component) => [
      component.code,
      records.reduce((sum, record) => sum + (payrollComponentAmount(record, component.code) ?? 0), 0),
    ]),
  ) as Record<string, number>;
  const calculatedGross = records.reduce((sum, record) => sum + record.basicSalary + record.allowance + record.overtime, 0);
  const numbersMatch = structure.grossFormula !== 'basic + allowance + overtime' || Math.abs(calculatedGross - totalGross) < 0.01;

  const applyProjectedLines = (target: NonNullable<typeof period>, lines: any[], version?: number) => {
    const { records: calculated, items: newItems } = projectRunLinesToClient(lines, target.id);
    setPayrollItems((prev) => [
      ...prev.filter((item) => !calculated.some((record) => record.id === item.payrollRecordId)),
      ...newItems,
    ]);
    setPayrollRecords((prev) => [
      ...prev.filter((row) => row.payrollPeriodId !== target.id),
      ...calculated,
    ]);
    if (target.status === 'DRAFT') {
      setPayrollPeriods((prev) => prev.map((row) => (row.id === target.id ? { ...row, status: 'CALCULATED' as const } : row)));
    }
    if (typeof version === 'number') setLastGenerateVersion(version);
  };

  const getEmp = (id: string) => employees.find(e => e.id === id);
  const getDept = (id: string) => departments.find(d => d.id === id)?.name || '-';

  const runLocalDemoGenerate = (target: NonNullable<typeof period>) => {
    const { records: calculated, items: newItems, warnings } = generateDemoPayroll({
      period: target,
      employees,
      attendance,
      leaveRequests,
      leaveTypes,
      overtimeRequests,
      loans: employeeLoans,
      bpjsRates,
      terTables,
    });
    setGenerateWarnings(warnings);
    if (warnings.length) addToast(warnings.slice(0, 3).join(' '), 'info');

    setPayrollItems((prev) => [
      ...prev.filter((item) => !calculated.some((record) => record.id === item.payrollRecordId)),
      ...newItems,
    ]);
    setPayrollRecords((prev) => [
      ...prev.filter((row) => row.payrollPeriodId !== target.id),
      ...calculated,
    ]);
    if (target.status === 'DRAFT') {
      setPayrollPeriods((prev) => prev.map((row) => (row.id === target.id ? { ...row, status: 'CALCULATED' as const } : row)));
    }

    const gross = calculated.reduce((sum, record) => sum + record.grossPay, 0);
    addAuditLog('CALCULATE', 'PayrollPeriod', workingPeriodId || '', `Payroll ${target.periodCode} demo generate. Gross: ${formatCurrency(gross)}`);
    addNotification('GENERAL', 'Payroll Calculated', `Payroll ${target.periodCode} calculated. Total gross: ${formatCurrency(gross)}`);
    addToast(`Payroll ${target.periodCode}: ${calculated.length} lines · gross ${formatCurrency(gross)} (local demo)`, 'success');
  };

  const handleCalculate = () => {
    if (!period) return;
    if (embedded) {
      setIsCalculating(true);
      setGenerateWarnings([]);
      const periodCode = period.periodCode || period.startDate?.slice(0, 7);
      payrollRunsApi.generate(periodCode, {
        ter_brackets: terTables.map((row) => ({
          ptkp_code: row.ptkpCode,
          monthly_gross_min: row.monthlyGrossMin,
          monthly_gross_max: row.monthlyGrossMax,
          ter_rate: row.terRate,
        })),
      }).then(async (generated) => {
        const warnings = Array.isArray(generated.warnings) ? generated.warnings.map(String) : [];
        setGenerateWarnings(warnings);
        if (warnings.length) addToast(warnings.slice(0, 3).join(' '), 'info');

        const runLines = Array.isArray(generated.lines) ? generated.lines : [];
        if (runLines.length) {
          applyProjectedLines(period, runLines, Number(generated.version) || undefined);
        } else {
          // Fallback: reload projected payroll_records after server upsert.
          try {
            const rows = await payrollApi.getRecords(period.id);
            const lines = rows.map(mapPayrollRecord).filter((row): row is PayrollRecord => row !== null);
            if (!lines.length) {
              addToast('Generate finished but returned no employee lines. Check roster and payroll settings.', 'error');
              return;
            }
            setPayrollRecords((prev) => [...prev.filter((row) => row.payrollPeriodId !== period.id), ...lines]);
            if (period.status === 'DRAFT') {
              setPayrollPeriods((prev) => prev.map((row) => (row.id === period.id ? { ...row, status: 'CALCULATED' as const } : row)));
            }
          } catch {
            addToast('Generate finished but payroll lines could not be loaded.', 'error');
            return;
          }
        }
        addToast(`Generated payroll ${periodCode} (version ${generated.version}).`, 'success');
        addAuditLog('CREATE', 'PayrollRun', periodCode, `Generated version ${generated.version}`);
        setLastGenerateVersion(Number(generated.version) || null);
      }).catch((error: unknown) => {
        addToast(error instanceof Error ? error.message : 'Payroll could not be generated.', 'error');
      }).finally(() => setIsCalculating(false));
      return;
    }
    setIsCalculating(true);
    setTimeout(() => {
      runLocalDemoGenerate(period);
      setIsCalculating(false);
    }, 400);
  };

  const handleSubmitForReview = () => {
    if (!period) return;
    const lines = records.map(record => {
      const employee = getEmp(record.employeeId);
      return {
        employeeId: record.employeeId,
        employeeName: employee?.fullName || record.employeeId,
        employeeCode: employee?.employeeCode || '',
        basicSalary: record.basicSalary,
        allowance: record.allowance,
        overtime: record.overtime,
        serviceCharge: record.serviceCharge,
        grossPay: record.grossPay,
        totalDeductions: record.totalDeductions,
        netPay: record.netPay,
      };
    });
    setPayrollPacks(prev => [{
      id: `pack${Date.now()}`,
      periodId: period.id,
      periodCode: period.periodCode,
      startDate: period.startDate,
      endDate: period.endDate,
      payDate: period.payDate,
      status: 'UNDER_REVIEW',
      submittedAt: new Date().toISOString(),
      submittedBy: user?.fullName || 'Payroll',
      lines,
      totalGross,
      totalDeductions: totalDeduction,
      totalNet,
    }, ...prev.filter(pack => pack.periodId !== period.id || pack.status === 'RETURNED')]);
    setPayrollPeriods(prev => prev.map(p => p.id === workingPeriodId ? { ...p, status: 'UNDER_REVIEW' as const } : p));
    addAuditLog('UPDATE', 'PayrollPeriod', workingPeriodId || '', 'Submitted to Payroll Review');
    addNotification('GENERAL', 'Payroll Submitted', `Payroll ${period.periodCode} is locked in Payroll Review`);
    addToast(`${period.periodCode} is locked in Payroll Review for the director and finance.`, 'success');
    setShowConfirmModal(null);
  };

  const handleFinalize = async () => {
    if (typeof window !== 'undefined' && window.__WOLF_HR_EMBEDDED__) {
      try {
        await payrollApi.approve(workingPeriodId);
      } catch {
        addToast('Payroll approval requires an HRIS payroll grant for this company.', 'error');
        setShowConfirmModal(null);
        return;
      }
    }
    setPayrollPeriods(prev => prev.map(p => p.id === workingPeriodId ? { ...p, status: 'FINALIZED' as const, finalizedAt: new Date().toISOString() } : p));
    addAuditLog('FINALIZE', 'PayrollPeriod', workingPeriodId || '', `Payroll ${period?.periodCode} finalized`);
    addNotification('PAYROLL_FINALIZED', 'Payroll Finalized', `Payroll ${period?.periodCode} has been finalized and locked`);
    addToast(`Payroll ${period?.periodCode} finalized successfully. Records are now locked.`, 'success');
    setShowConfirmModal(null);
  };

  const handleExport = () => {
    if (!period || records.length === 0) {
      addToast('Calculate payroll before exporting this period.', 'error');
      return;
    }
    const filename = downloadPayrollExport(exportFormat, {
      periodCode: period.periodCode,
      status: period.status,
      startDate: period.startDate,
      endDate: period.endDate,
      payDate: period.payDate,
    }, records.map(record => {
      const employee = getEmp(record.employeeId);
      return {
        employeeCode: employee?.employeeCode || '',
        employeeName: employee?.fullName || record.employeeId,
        department: employee ? getDept(employee.departmentId) : '',
        basicSalary: record.basicSalary,
        allowance: record.allowance,
        overtime: record.overtime,
        serviceCharge: record.serviceCharge,
        grossPay: record.grossPay,
        totalDeductions: record.totalDeductions,
        netPay: record.netPay,
      };
    }));
    addToast(`Downloaded ${filename}. Finalizing is not required.`, 'success');
  };

  if (mode === "tax") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Tax simulation</h1>
          <p className="text-slate-500 text-sm mt-1">PPh 21 benefit already stored for this period. It is not edited here and it is not taken off take-home pay on this screen.</p>
        </div>
        <PeriodBar />
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Employee</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">PPh 21 benefit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.length === 0 && (
                <tr><td colSpan={2} className="px-4 py-8 text-sm text-slate-500">No payroll lines for this period.</td></tr>
              )}
              {records.map((record) => {
                const benefit = payrollItems.find((item) => item.payrollRecordId === record.id && item.componentCode === "PPh21");
                const person = getEmp(record.employeeId);
                return (
                  <tr key={record.id}>
                    <td className="px-4 py-3 text-sm text-slate-800">{person?.fullName || record.employeeId}</td>
                    <td className="px-4 py-3 text-sm text-right text-slate-800">{benefit ? formatCurrency(benefit.amount) : "Not calculated"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const isFinalized = period?.status === 'FINALIZED' || period?.status === 'LOCKED';
  // Spec: generate anytime with version snapshots — review/finalize must not block regenerate.
  const reviewLocked = false;
  const reviewInFlight = period?.status === 'UNDER_REVIEW' || period?.status === 'APPROVED' || isFinalized;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Payroll processing</h1>
          <p className="text-slate-500 text-sm mt-1">Salary is paid on the payroll date. Service charge is a separate payment in the middle of that pay month.</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {payrollConfigurationVisible(user?.role) && onConfigure && (
            <button type="button" onClick={onConfigure} className="px-4 py-2 bg-white border border-indigo-200 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-50">
              Payroll structure
            </button>
          )}
          <BulkUploadButton module="payroll" />
          {period && (
            <>
              <label className="text-sm text-slate-600" htmlFor="payroll-export-format">Export</label>
              <select
                id="payroll-export-format"
                value={exportFormat}
                onChange={event => setExportFormat(event.target.value as PayrollExportFormat)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-800"
              >
                <option value="csv">CSV</option>
                <option value="xlsx">Excel</option>
                <option value="pdf">PDF</option>
              </select>
              <button onClick={handleExport} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 inline-flex items-center gap-2">
                <Download size={16} /> Download
              </button>
            </>
          )}
          {period && !reviewLocked && (
            <button onClick={handleCalculate} disabled={isCalculating} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isCalculating ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}>
              {isCalculating ? 'Generating…' : (<><Calculator size={16} className="mr-2" />Generate Payroll</>)}
            </button>
          )}
          {period && !isFinalized && period.status === 'CALCULATED' && (
            <button onClick={() => setShowConfirmModal('review')} className="px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-sm font-medium hover:bg-amber-100">
              Submit for Review (optional)
            </button>
          )}
          {period && period.status === 'APPROVED' && (
            <button onClick={() => setShowConfirmModal('finalize')} className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50">
              Mark reviewed
            </button>
          )}
        </div>
      </div>

      {!numbersMatch && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <AlertTriangle size={20} className="text-red-600 mr-2" />
          <p className="text-sm text-red-800">
            <strong>Payroll out of balance:</strong> Component total ({formatCurrency(calculatedGross)}) does not match stored gross ({formatCurrency(totalGross)}). Click Generate Payroll to reconcile.
          </p>
        </div>
      )}

      <PeriodBar />

      {period && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4"><p className="text-sm text-slate-500">Period</p><p className="text-lg font-bold text-slate-800">{period.periodCode}</p><p className="text-xs text-slate-400">{period.startDate} to {period.endDate}</p></div>
          <div className="bg-white rounded-xl border border-slate-200 p-4"><p className="text-sm text-slate-500">Basic salary</p><p className="text-lg font-bold text-slate-800">{formatCurrency(totalBasic)}</p><p className="text-xs text-slate-400">{records.length} employees</p></div>
          <div className="bg-white rounded-xl border border-slate-200 p-4"><p className="text-sm text-slate-500">Allowance</p><p className="text-lg font-bold text-slate-800">{formatCurrency(totalAllowance)}</p></div>
          <div className="bg-white rounded-xl border border-slate-200 p-4"><p className="text-sm text-slate-500">Additional earnings</p><p className="text-lg font-bold text-slate-800">{formatCurrency(totalAdditional)}</p></div>
          <div className="bg-white rounded-xl border border-slate-200 p-4"><p className="text-sm text-slate-500">Deduction</p><p className="text-lg font-bold text-red-600">{formatCurrency(totalDeduction)}</p></div>
          <div className="bg-white rounded-xl border border-slate-200 p-4"><p className="text-sm text-slate-500">Benefit</p><p className="text-lg font-bold text-slate-800">{formatCurrency(totalBenefit)}</p></div>
          <div className="bg-white rounded-xl border border-slate-200 p-4"><p className="text-sm text-slate-500">Total</p><p className="text-lg font-bold text-emerald-600">{formatCurrency(totalNet)}</p><p className="text-xs text-slate-400">Pay date: {period.payDate}</p></div>
        </div>
      )}

      {reviewInFlight && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm font-medium text-amber-800">Review pack in flight</p>
          <p className="text-sm text-amber-700">You can still Generate Payroll anytime; each run keeps a version snapshot.</p>
        </div>
      )}

      {isFinalized && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex items-start gap-3">
          <Lock size={18} className="text-purple-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-purple-800">Payroll Locked</p>
            <p className="text-sm text-purple-700">This payroll period has been finalized. Records cannot be modified. Any corrections require a new adjustment period.</p>
          </div>
        </div>
      )}

      {generateWarnings.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 space-y-1">
          <p className="font-medium">Generate notes{lastGenerateVersion != null ? ` · version ${lastGenerateVersion}` : ''}</p>
          {generateWarnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-slate-500" />
              <h3 className="font-semibold text-slate-800">Payroll Records</h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Each payroll component from Generate{lastGenerateVersion != null ? ` (v${lastGenerateVersion})` : ''}. Scroll horizontally for the full matrix.
            </p>
          </div>
          <div className="text-sm text-slate-500">{records.length} employees</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px]" data-payroll-structure-source={structureSource}>
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="sticky left-0 z-10 bg-slate-50 text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Employee</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Department</th>
                {componentColumns.map((component) => (
                  <th key={component.code} className="text-right px-3 py-3 text-xs font-medium text-slate-500 uppercase whitespace-nowrap">
                    {component.displayName}
                  </th>
                ))}
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.length === 0 && (
                <tr>
                  <td colSpan={componentColumns.length + 3} className="px-4 py-8 text-sm text-slate-500">
                    No payroll lines for {period?.periodCode || 'this month'}. {isFinalized
                      ? 'This period is closed. Service charge stays a separate payment.'
                      : 'Click Generate Payroll after employee checklist settings and attendance are ready.'}
                  </td>
                </tr>
              )}
              {records.map((record) => {
                const emp = getEmp(record.employeeId);
                return (
                  <tr key={record.id} className="hover:bg-slate-50">
                    <td className="sticky left-0 z-10 bg-white px-4 py-3">
                      <div className="flex items-center gap-2 min-w-[160px]">
                        <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center text-xs font-bold text-indigo-600">{emp?.fullName?.charAt(0) || '?'}</div>
                        <div>
                          <p className="text-sm font-medium text-slate-800">{emp?.fullName || record.employeeId}</p>
                          <p className="text-xs text-slate-500">{emp?.employeeCode}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{emp ? getDept(emp.departmentId) : '-'}</td>
                    {componentColumns.map((component) => {
                      const amount = payrollComponentAmount(record, component.code) ?? 0;
                      const isDeduction = component.kind === 'deduction';
                      return (
                        <td
                          key={component.code}
                          className={`px-3 py-3 text-sm text-right tabular-nums whitespace-nowrap ${isDeduction ? 'text-red-600' : 'text-slate-800'}`}
                        >
                          {amount ? formatCurrency(amount) : '—'}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-sm text-right text-emerald-700 font-medium tabular-nums whitespace-nowrap">
                      {formatCurrency(record.netPay)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {records.length > 0 && (
              <tfoot className="bg-slate-50 border-t border-slate-200">
                <tr>
                  <td className="sticky left-0 z-10 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800" colSpan={2}>Totals</td>
                  {componentColumns.map((component) => (
                    <td key={component.code} className="px-3 py-3 text-sm text-right font-semibold text-slate-800 tabular-nums whitespace-nowrap">
                      {columnTotals[component.code] ? formatCurrency(columnTotals[component.code]) : '—'}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-sm text-right font-semibold text-emerald-700 tabular-nums">{formatCurrency(totalNet)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Confirmation Modals */}
      <Modal isOpen={showConfirmModal === 'review'} onClose={() => setShowConfirmModal(null)} title="Submit for Review">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
            <AlertTriangle size={20} className="text-amber-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">Confirm Submission</p>
              <p className="text-sm text-amber-700 mt-1">This freezes <strong>{period?.periodCode}</strong> as a payroll pack in Payroll Review. The director or finance accepts it or sends it back. Calculate stays locked while it is there.</p>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowConfirmModal(null)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={handleSubmitForReview} className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700">Submit for Review</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showConfirmModal === 'finalize'} onClose={() => setShowConfirmModal(null)} title="Finalize Payroll">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-red-50 rounded-lg border border-red-200">
            <Lock size={20} className="text-red-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-800">Confirm Finalization</p>
              <p className="text-sm text-red-700 mt-1">You are about to finalize payroll period <strong>{period?.periodCode}</strong>. <strong>This action cannot be undone.</strong> All records will be locked and payslips will be generated.</p>
              <p className="text-sm text-red-700 mt-2">Total Net Pay: <strong>{formatCurrency(totalNet)}</strong> for {records.length} employees.</p>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowConfirmModal(null)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={handleFinalize} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Confirm Finalize</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
