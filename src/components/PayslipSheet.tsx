import {
  buildPayslip,
  formatBankLine,
  formatPayslipAmount,
  payrollCutoffLabel,
  payslipCompanyName,
  type PayslipLine,
} from '../lib/payslipView';
import type { Employee, PayrollItem, PayrollPeriod, PayrollRecord, TERTable } from '../types';

function companyIdFromPath(): string | null {
  if (typeof window === 'undefined') return null;
  const match = window.location.pathname.match(/\/hr\/(amg|bzg|ggv)\/runtime/);
  return match ? match[1] : null;
}

function MoneyColumn({
  title,
  rows,
  totalLabel,
  total,
}: {
  title: string;
  rows: PayslipLine[];
  totalLabel: string;
  total: number;
}) {
  return (
    <div className="flex min-h-[148px] flex-col border border-[#d8d8d8]">
      <div className="bg-[#ececec] px-3 py-2 text-[13px] font-semibold text-neutral-900">{title}</div>
      <div className="flex-1 space-y-1.5 px-3 py-2.5">
        {rows.map((row) => (
          <div key={row.code} className="flex items-baseline justify-between gap-4 text-sm text-neutral-900">
            <span>{row.label}</span>
            <span className="tabular-nums">{formatPayslipAmount(row.amount)}</span>
          </div>
        ))}
      </div>
      <div className="mt-auto flex items-baseline justify-between gap-4 border-t border-[#d8d8d8] px-3 py-2 text-sm font-semibold text-neutral-900">
        <span>{totalLabel}</span>
        <span className="tabular-nums">{formatPayslipAmount(total)}</span>
      </div>
    </div>
  );
}

export type PayslipEmployee = Pick<
  Employee,
  | 'employeeCode'
  | 'fullName'
  | 'ptkpCode'
  | 'npwp'
  | 'bankName'
  | 'bankAccountNumber'
  | 'bankAccountName'
  | 'taxConfiguration'
>;

export default function PayslipSheet({
  record,
  items,
  employee,
  department,
  position,
  period,
  terTables = [],
  companyId,
}: {
  record: PayrollRecord;
  items: PayrollItem[];
  employee?: PayslipEmployee | null;
  department?: { name: string } | null;
  position?: { title: string; grade: string } | null;
  period?: PayrollPeriod | null;
  terTables?: TERTable[];
  companyId?: string | null;
}) {
  const slip = buildPayslip(record, items, { employee, terTables });
  const companyName = payslipCompanyName(companyId ?? companyIdFromPath());
  const cutoff = period?.startDate && period?.endDate ? payrollCutoffLabel(period.startDate, period.endDate) : null;
  const bank = formatBankLine(employee);
  const idName = employee ? `${employee.employeeCode} / ${employee.fullName}` : null;

  return (
    <article className="payslip-sheet mx-auto w-full max-w-[210mm] bg-white text-neutral-900 shadow-sm border border-slate-200 print:shadow-none print:border-0">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .payslip-sheet, .payslip-sheet * { visibility: visible; }
          .payslip-sheet { position: absolute; inset: 0; width: auto; max-width: none; border: 0; box-shadow: none; }
          .payslip-print { display: none !important; }
        }
      `}</style>
      <div className="px-7 pt-7 pb-8">
        <div className="flex items-start justify-between">
          <div className="h-6" aria-hidden />
          <p className="text-[11px] font-semibold tracking-[0.16em] text-[#e53935]">CONFIDENTIAL</p>
        </div>

        <div className="mt-5 flex items-end justify-between gap-6 border-b border-neutral-200 pb-4">
          <h2 className="text-base font-semibold tracking-[0.12em] sm:text-lg">{companyName}</h2>
          <p className="text-base font-semibold tracking-[0.2em] sm:text-lg">PAYSLIP</p>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-x-10 gap-y-0.5 text-sm sm:grid-cols-2">
          {cutoff ? <Field label="Payroll cutoff" value={cutoff} /> : null}
          {position?.grade?.trim() ? <Field label="Grade / Level" value={position.grade.trim()} /> : null}
          {idName ? <Field label="ID / Name" value={idName} /> : null}
          {employee?.ptkpCode?.trim() ? <Field label="PTKP" value={employee.ptkpCode.trim()} /> : null}
          {position?.title?.trim() ? <Field label="Job position" value={position.title.trim()} /> : null}
          {employee?.npwp?.trim() ? <Field label="NPWP" value={employee.npwp.trim()} /> : null}
          {department?.name?.trim() ? <Field label="Organization" value={department.name.trim()} /> : null}
          {bank ? <Field label="Bank" value={bank} /> : null}
          {slip.terRate ? <Field label="TER" value={slip.terRate} /> : null}
          {slip.taxModeLabel ? <Field label="Tax mode" value={slip.taxModeLabel} /> : null}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-0 sm:grid-cols-2">
          <MoneyColumn title="Earnings" rows={slip.earnings} totalLabel="Total earnings" total={slip.totalEarnings} />
          <MoneyColumn
            title="You pay (deducted from take-home)"
            rows={slip.youPay}
            totalLabel="Total you pay"
            total={slip.totalYouPay}
          />
        </div>

        <div className="mt-5 flex items-baseline justify-between gap-6 border border-[#d8d8d8] bg-[#f7f7f7] px-4 py-3">
          <p className="text-lg font-semibold tracking-wide">Take Home Pay</p>
          <p className="text-lg font-semibold tabular-nums sm:text-xl">Rp {formatPayslipAmount(slip.takeHome)}</p>
        </div>

        <div className="mt-14 space-y-2.5 text-[10px] leading-snug text-neutral-700">
          <p className="uppercase">This is a computer-generated document and no signature is required.</p>
          <p className="uppercase">
            Please treat the contents of this statement as confidential, except where disclosure is required for tax,
            legal, or regulatory purposes. Any breach may result in disciplinary action.
          </p>
        </div>
      </div>
    </article>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[132px_10px_1fr] gap-1 py-0.5">
      <span className="text-neutral-600">{label}</span>
      <span className="text-neutral-400">:</span>
      <span className="text-neutral-900">{value}</span>
    </div>
  );
}
