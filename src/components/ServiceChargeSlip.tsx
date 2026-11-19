import { formatBankLine, formatPayslipAmount, payslipCompanyName } from '../lib/payslipView';
import type { Employee, ServiceChargeEmployeeSlip } from '../types';

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function companyIdFromPath(): string | null {
  if (typeof window === 'undefined') return null;
  const match = window.location.pathname.match(/\/hr\/(amg|bzg|ggv)\/runtime/);
  return match ? match[1] : null;
}

export default function ServiceChargeSlip({
  slip,
  employee,
  department,
  position,
  companyId,
}: {
  slip: ServiceChargeEmployeeSlip;
  employee?: Pick<
    Employee,
    'employeeCode' | 'fullName' | 'ptkpCode' | 'npwp' | 'bankName' | 'bankAccountNumber' | 'bankAccountName'
  > | null;
  department?: { name: string } | null;
  position?: { title: string; grade: string } | null;
  companyId?: string | null;
}) {
  const companyName = payslipCompanyName(companyId ?? companyIdFromPath());
  const periodLabel = `${monthNames[Math.max(0, slip.month - 1)]} ${slip.year}`;
  const bank = formatBankLine(employee);
  const idName = employee
    ? `${employee.employeeCode} / ${employee.fullName}`
    : slip.employeeCode && slip.fullName
      ? `${slip.employeeCode} / ${slip.fullName}`
      : null;

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
          <p className="text-right text-base font-semibold tracking-[0.12em] sm:text-lg">
            SERVICE CHARGE
            <span className="block text-xs font-medium tracking-normal text-neutral-500">Payslip</span>
          </p>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-x-10 gap-y-0.5 text-sm sm:grid-cols-2">
          <Field label="SC month" value={periodLabel} />
          {slip.payDate ? <Field label="Pay date" value={slip.payDate} /> : null}
          {idName ? <Field label="ID / Name" value={idName} /> : null}
          {position?.title?.trim() ? <Field label="Job position" value={position.title.trim()} /> : null}
          {department?.name?.trim() ? <Field label="Organization" value={department.name.trim()} /> : null}
          {bank ? <Field label="Bank" value={bank} /> : null}
        </div>

        <div className="mt-6 border border-[#d8d8d8]">
          <div className="bg-[#ececec] px-3 py-2 text-[13px] font-semibold">Earnings</div>
          <div className="space-y-1.5 px-3 py-2.5 text-sm">
            <Row label="Days present" value={String(slip.daysPresent)} />
            <Row label="Value per day" value={formatPayslipAmount(slip.valuePerDay)} />
            <Row label="Service charge gross" value={formatPayslipAmount(slip.gross)} />
          </div>
          <div className="flex justify-between border-t border-[#d8d8d8] px-3 py-2 text-sm font-semibold">
            <span>Total earnings</span>
            <span className="tabular-nums">{formatPayslipAmount(slip.gross)}</span>
          </div>
        </div>

        <div className="mt-0 border border-t-0 border-[#d8d8d8]">
          <div className="bg-[#ececec] px-3 py-2 text-[13px] font-semibold">You pay (deducted from take-home)</div>
          <div className="space-y-1.5 px-3 py-2.5 text-sm">
            {slip.pph21 > 0 ? <Row label="PPh 21" value={formatPayslipAmount(slip.pph21)} /> : null}
          </div>
          <div className="flex justify-between border-t border-[#d8d8d8] px-3 py-2 text-sm font-semibold">
            <span>Total you pay</span>
            <span className="tabular-nums">{formatPayslipAmount(slip.pph21)}</span>
          </div>
        </div>

        <div className="mt-5 flex items-baseline justify-between gap-6 border border-[#d8d8d8] bg-[#f7f7f7] px-4 py-3">
          <p className="text-lg font-semibold tracking-wide">Take Home Pay</p>
          <p className="text-lg font-semibold tabular-nums sm:text-xl">Rp {formatPayslipAmount(slip.net)}</p>
        </div>

        <div className="mt-14 space-y-2.5 text-[10px] leading-snug text-neutral-700">
          <p className="uppercase">Service charge is paid separately from monthly salary.</p>
          <p className="uppercase">This is a computer-generated document and no signature is required.</p>
          <p className="uppercase">
            Please treat the contents of this statement as confidential, except where disclosure is required for tax,
            legal, or regulatory purposes.
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
