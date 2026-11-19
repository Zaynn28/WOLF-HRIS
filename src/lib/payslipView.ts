import type { Employee, PayrollItem, PayrollRecord, TERTable } from '../types';

export const payslipCompanyNames: Record<string, string> = {
  amg: 'PT ATRIUM MANAGEMENT GROUP',
  bzg: 'PT BLU ZONE GROUP',
  ggv: 'GGV',
};

const labels: Record<string, string> = {
  basic: 'Basic Salary',
  transport: 'Tunjangan Transport',
  komunikasi: 'Tunjangan Komunikasi',
  housing: 'Housing',
  fixed_allowance: 'Fixed allowance',
  attendance_allowance: 'Attendance allowance',
  bpjsk_allowance: 'BPJS Kesehatan Allowance',
  jht_allowance: 'JHT Employee Allowance',
  jp_allowance: 'JP Employee Allowance',
  bonus: 'Bonus',
  overtime: 'Overtime',
  tax_allowance: 'Tax Allowance',
  allowance: 'Allowance',
  kasbon: 'Kasbon',
  unpaid: 'Unpaid leave',
  jp_employee: 'Jaminan Pensiun Employee',
  bpjsk_employee: 'BPJS Kesehatan Employee',
  jht_employee: 'JHT Employee',
  pph21: 'PPh 21',
  deductions: 'Deductions',
};

const order: Record<string, number> = {
  basic: 20,
  transport: 30,
  komunikasi: 40,
  housing: 45,
  fixed_allowance: 46,
  attendance_allowance: 47,
  bpjsk_allowance: 50,
  jht_allowance: 60,
  jp_allowance: 70,
  bonus: 80,
  overtime: 90,
  tax_allowance: 100,
  allowance: 105,
  kasbon: 110,
  unpaid: 115,
  jp_employee: 120,
  bpjsk_employee: 130,
  jht_employee: 140,
  pph21: 150,
  deductions: 155,
};

/** Codes never shown on the employee slip (company cost / meta). */
const omitFromSlip = new Set([
  'full_basic',
  'service_charge',
  'tax_mode',
  'ter_gross',
  'ter_rate_label',
  'jkk',
  'jkm',
  'jht_company',
  'jp_company',
  'bpjsk_company',
  'pph21_benefit',
]);

const youPayCodes = new Set([
  'kasbon',
  'unpaid',
  'jp_employee',
  'bpjsk_employee',
  'jht_employee',
  'pph21',
  'deductions',
]);

export type PayslipLine = { code: string; label: string; amount: number };

export type PayslipView = {
  earnings: PayslipLine[];
  youPay: PayslipLine[];
  /** @deprecated use youPay — kept for older call sites during rename */
  deductions: PayslipLine[];
  totalEarnings: number;
  totalYouPay: number;
  /** @deprecated use totalYouPay */
  totalDeductions: number;
  takeHome: number;
  taxMode: 'netto' | 'gross' | null;
  taxModeLabel: string;
  terRate: string | null;
};

export function payslipCompanyName(companyId: string | null | undefined): string {
  if (!companyId) return payslipCompanyNames.amg;
  return payslipCompanyNames[companyId] ?? companyId.toUpperCase();
}

const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function payrollCutoffLabel(start: string, end: string): string {
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  const dayMonth = (date: Date) => `${date.getDate()} ${shortMonths[date.getMonth()]}`;
  if (startDate.getFullYear() === endDate.getFullYear()) {
    return `${dayMonth(startDate)} - ${dayMonth(endDate)} ${endDate.getFullYear()}`;
  }
  return `${dayMonth(startDate)} ${startDate.getFullYear()} - ${dayMonth(endDate)} ${endDate.getFullYear()}`;
}

export function formatPayslipAmount(amount: number): string {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Math.round(amount));
}

export function formatBankLine(employee?: {
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
  fullName?: string;
} | null): string | null {
  if (!employee) return null;
  const parts = [
    employee.bankName?.trim(),
    employee.bankAccountNumber?.trim(),
    (employee.bankAccountName || employee.fullName || '').trim(),
  ].filter(Boolean);
  if (parts.length < 2) return parts[0] || null;
  return parts.join(' · ');
}

function whole(amount: number): boolean {
  return Number.isFinite(amount) && amount !== 0;
}

function line(code: string, amount: number): PayslipLine {
  return { code, label: labels[code] ?? code, amount };
}

function resolveTaxMode(record: PayrollRecord, employee?: Pick<Employee, 'taxConfiguration'> | null): 'netto' | 'gross' | null {
  if (employee?.taxConfiguration === 'netto') return 'netto';
  if (employee?.taxConfiguration === 'gross') return 'gross';
  const mode = record.componentAmounts?.tax_mode;
  if (mode === 1) return 'netto';
  if (mode === 0 && record.componentAmounts && Object.prototype.hasOwnProperty.call(record.componentAmounts, 'tax_mode')) {
    return 'gross';
  }
  return null;
}

export function lookupPayslipTerRate(
  record: PayrollRecord,
  ptkpCode: string | undefined,
  terTables: TERTable[],
): string | null {
  const labeled = record.componentAmounts?.ter_rate_label;
  if (typeof labeled === 'number' && Number.isFinite(labeled) && labeled > 0) {
    return Number.isInteger(labeled) ? `${labeled}%` : `${labeled}%`;
  }
  if (!terTables.length) return null;
  const gross =
    (typeof record.componentAmounts?.ter_gross === 'number' && record.componentAmounts.ter_gross > 0
      ? record.componentAmounts.ter_gross
      : record.grossPay) || 0;
  const code = ptkpCode || 'TK/0';
  const matching = terTables.filter((row) => row.ptkpCode === code);
  const source = matching.length ? matching : terTables.filter((row) => row.ptkpCode === 'TK/0');
  const hit = source.find((row) => gross >= row.monthlyGrossMin && gross <= row.monthlyGrossMax);
  if (!hit) return null;
  return Number.isInteger(hit.terRate) ? `${hit.terRate}%` : `${hit.terRate}%`;
}

export function buildPayslip(
  record: PayrollRecord,
  items: PayrollItem[],
  options?: {
    employee?: Pick<Employee, 'taxConfiguration' | 'ptkpCode'> | null;
    terTables?: TERTable[];
  },
): PayslipView {
  const amounts: Record<string, number> = {};
  for (const [code, value] of Object.entries(record.componentAmounts ?? {})) {
    if (typeof value === 'number') amounts[code.toLowerCase()] = value;
  }
  for (const item of items) {
    const code = item.componentCode.toLowerCase();
    if (omitFromSlip.has(code)) continue;
    // Employee PPh only from componentAmounts.pph21 (withheld). Netto stores benefit on items — ignore here.
    if (code === 'pph21') continue;
    if (amounts[code] == null && typeof item.amount === 'number') amounts[code] = item.amount;
  }
  if (amounts.basic == null && record.basicSalary) amounts.basic = record.basicSalary;
  if (amounts.overtime == null && record.overtime) amounts.overtime = record.overtime;

  // Fold unpaid leave into kasbon for a single staff-facing line.
  if (whole(amounts.unpaid ?? 0)) {
    amounts.kasbon = (amounts.kasbon ?? 0) + amounts.unpaid;
    delete amounts.unpaid;
  }

  const itemizedAllowance =
    whole(amounts.transport ?? 0) ||
    whole(amounts.komunikasi ?? 0) ||
    whole(amounts.housing ?? 0) ||
    whole(amounts.fixed_allowance ?? 0) ||
    whole(amounts.attendance_allowance ?? 0);
  if (!itemizedAllowance && amounts.allowance == null && record.allowance) amounts.allowance = record.allowance;

  const itemizedYouPay = [...youPayCodes].some(
    (code) => code !== 'deductions' && code !== 'unpaid' && whole(amounts[code] ?? 0),
  );
  if (!itemizedYouPay && amounts.deductions == null && record.totalDeductions) {
    amounts.deductions = record.totalDeductions;
  }

  // Strip company / meta keys from the slip amounts map.
  for (const code of omitFromSlip) delete amounts[code];

  const earnings: PayslipLine[] = [];
  const youPay: PayslipLine[] = [];
  const codes = Object.keys(amounts).filter((code) => whole(amounts[code]));
  codes.sort((left, right) => (order[left] ?? 1000) - (order[right] ?? 1000) || left.localeCompare(right));
  for (const code of codes) {
    const row = line(code, amounts[code]);
    if (youPayCodes.has(code)) youPay.push(row);
    else earnings.push(row);
  }

  const taxMode = resolveTaxMode(record, options?.employee);
  const taxModeLabel =
    taxMode === 'netto'
      ? 'Netto — company pays PPh 21'
      : taxMode === 'gross'
        ? 'Gross — PPh 21 deducted from take-home'
        : '';

  const terRate =
    options?.terTables != null
      ? lookupPayslipTerRate(record, options.employee?.ptkpCode, options.terTables)
      : null;

  const total = (rows: PayslipLine[]) => rows.reduce((sum, row) => sum + row.amount, 0);
  const totalYouPay = total(youPay);
  return {
    earnings,
    youPay,
    deductions: youPay,
    totalEarnings: total(earnings),
    totalYouPay,
    totalDeductions: totalYouPay,
    takeHome: record.netPay,
    taxMode,
    taxModeLabel,
    terRate,
  };
}
