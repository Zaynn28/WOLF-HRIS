/**
 * Full Salary Report columns matching the reference PDF layout
 * (Employee ID … Ter Rates, one row per employee).
 */
import type { Department, Employee, PayrollItem, PayrollRecord, Position, TERTable } from '../types';

export type SalaryReportColumn = {
  key: string;
  header: string;
  kind: 'text' | 'money' | 'percent';
};

/** PDF column order */
export const salaryReportColumns: SalaryReportColumn[] = [
  { key: 'employee_id', header: 'Employee ID', kind: 'text' },
  { key: 'full_name', header: 'Full Name', kind: 'text' },
  { key: 'job_position', header: 'Job Position', kind: 'text' },
  { key: 'organization', header: 'Organization', kind: 'text' },
  { key: 'join_date', header: 'Join Date', kind: 'text' },
  { key: 'tax_configuration', header: 'Tax Configuration', kind: 'text' },
  { key: 'bpjs_tk_number', header: 'BPJS Ketenagakerjaan', kind: 'text' },
  { key: 'bpjs_kes_number', header: 'BPJS Kesehatan', kind: 'text' },
  { key: 'npwp', header: 'NPWP', kind: 'text' },
  { key: 'ktp', header: 'KTP (No Identity)', kind: 'text' },
  { key: 'length_of_service', header: 'Length of Service', kind: 'text' },
  { key: 'full_basic', header: 'Full Basic Salary', kind: 'money' },
  { key: 'basic', header: 'Basic Salary', kind: 'money' },
  { key: 'transport', header: 'Tunjangan Transport', kind: 'money' },
  { key: 'komunikasi', header: 'Tunjangan Komunikasi', kind: 'money' },
  { key: 'bpjsk_allowance', header: 'BPJSK Allowance', kind: 'money' },
  { key: 'jht_allowance', header: 'Employee JHT Allowance', kind: 'money' },
  { key: 'jp_allowance', header: 'JP Employee Allowance', kind: 'money' },
  { key: 'time_off_compensation', header: 'Time Off Compensation Allowance', kind: 'money' },
  { key: 'bonus', header: 'Bonus', kind: 'money' },
  { key: 'overtime', header: 'Overtime', kind: 'money' },
  { key: 'tax_allowance', header: 'Tax Allowance', kind: 'money' },
  { key: 'total_allowance', header: 'Total Allowance', kind: 'money' },
  { key: 'total_earnings', header: 'Total Earnings', kind: 'money' },
  { key: 'kasbon', header: 'kasbon', kind: 'money' },
  { key: 'jp_employee', header: 'Jaminan Pensiun Employee', kind: 'money' },
  { key: 'bpjsk_employee', header: 'BPJSK Employee', kind: 'money' },
  { key: 'jht_employee', header: 'JHT Employee', kind: 'money' },
  { key: 'pph21', header: 'PPH 21', kind: 'money' },
  { key: 'total_deduction', header: 'Total Deduction', kind: 'money' },
  { key: 'pph21_payment', header: 'PPH 21 Payment', kind: 'money' },
  { key: 'take_home_pay', header: 'Take Home Pay', kind: 'money' },
  { key: 'pph21_benefit', header: 'PPH 21 Benefit', kind: 'money' },
  { key: 'bank_name', header: 'Bank Name', kind: 'text' },
  { key: 'bank_account', header: 'Bank Account', kind: 'text' },
  { key: 'bank_account_holder', header: 'Bank Account Holder', kind: 'text' },
  { key: 'jkk', header: 'JKK', kind: 'money' },
  { key: 'jkm', header: 'JKM', kind: 'money' },
  { key: 'jht_company', header: 'JHT Company', kind: 'money' },
  { key: 'jp_company', header: 'Jaminan Pensiun Company', kind: 'money' },
  { key: 'bpjsk_company', header: 'BPJS K Company', kind: 'money' },
  { key: 'ter_rates', header: 'Ter Rates', kind: 'percent' },
];

const moneyKeys = new Set(salaryReportColumns.filter((c) => c.kind === 'money').map((c) => c.key));

/** Demo / legacy aliases → structure codes used by payslip + PDF */
const ALIASES: Record<string, string> = {
  BASIC: 'basic',
  FIXED: 'fixed_allowance',
  HOUSING: 'housing',
  TRANSPORT: 'transport',
  KOMUNIKASI: 'komunikasi',
  ATTEND: 'attendance_allowance',
  OTIME: 'overtime',
  BONUS: 'bonus',
  UNPAID: 'unpaid',
  LOAN: 'kasbon',
  BPJS_KES: 'bpjsk_employee',
  BPJS_JHT: 'jht_employee',
  BPJS_JP: 'jp_employee',
  PPh21: 'pph21',
  PPH21: 'pph21',
  bpjs_kes: 'bpjsk_employee',
  bpjs_jht: 'jht_employee',
  bpjs_jp: 'jp_employee',
  company_tax: 'pph21_benefit',
  loan: 'kasbon',
};

function whole(n: unknown): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 0;
  return Math.round(n);
}

function lengthOfService(joinDate: string, asOf = new Date()): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(joinDate)) return '';
  const start = new Date(`${joinDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || start > asOf) return '0 Year 0 Month 0 Day';
  let years = asOf.getFullYear() - start.getFullYear();
  let months = asOf.getMonth() - start.getMonth();
  let days = asOf.getDate() - start.getDate();
  if (days < 0) {
    months -= 1;
    const prev = new Date(asOf.getFullYear(), asOf.getMonth(), 0);
    days += prev.getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return `${years} Year ${months} Month ${days} Day`;
}

function taxLabel(employee: Employee, record: PayrollRecord): string {
  if (employee.taxConfiguration === 'netto') return 'Netto';
  if (employee.taxConfiguration === 'gross') return 'Gross';
  const mode = record.componentAmounts?.tax_mode;
  if (mode === 1) return 'Netto';
  if (mode === 0 && record.componentAmounts && Object.prototype.hasOwnProperty.call(record.componentAmounts, 'tax_mode')) {
    return 'Gross';
  }
  return employee.taxConfiguration === 'netto' ? 'Netto' : (employee.taxConfiguration || 'Netto');
}

function collectAmounts(record: PayrollRecord, items: PayrollItem[]): Record<string, number> {
  const amounts: Record<string, number> = {};
  const put = (rawCode: string, value: number) => {
    const code = ALIASES[rawCode] || ALIASES[rawCode.toUpperCase()] || rawCode.toLowerCase();
    if (!Number.isFinite(value)) return;
    amounts[code] = whole(value);
  };

  for (const [code, value] of Object.entries(record.componentAmounts ?? {})) {
    if (typeof value === 'number') put(code, value);
  }
  for (const item of items) {
    const code = item.componentCode;
    if (amounts[ALIASES[code] || ALIASES[code.toUpperCase()] || code.toLowerCase()] == null && typeof item.amount === 'number') {
      put(code, item.amount);
    }
  }

  if (amounts.basic == null && record.basicSalary) amounts.basic = whole(record.basicSalary);
  if (amounts.full_basic == null) amounts.full_basic = amounts.basic ?? whole(record.basicSalary);
  if (amounts.overtime == null && record.overtime) amounts.overtime = whole(record.overtime);

  // Fold housing / attendance / fixed into transport display only when transport empty —
  // PDF has no Housing column; keep them in total_allowance via explicit sum below.
  return amounts;
}

function lookupTerPercent(gross: number, ptkpCode: string | undefined, terTables: TERTable[]): string {
  if (!terTables.length) return '0%';
  const code = ptkpCode || 'TK/0';
  const matching = terTables.filter((row) => row.ptkpCode === code);
  const source = matching.length ? matching : terTables.filter((row) => row.ptkpCode === 'TK/0');
  const bracket = source.find((row) => gross >= row.monthlyGrossMin && gross <= row.monthlyGrossMax);
  if (!bracket) return '0%';
  const rate = bracket.terRate;
  if (rate === 0) return '0%';
  if (Number.isInteger(rate)) return `${rate}%`;
  return `${rate}%`;
}

export type SalaryReportRow = Record<string, string | number>;

export function buildSalaryReportRow(input: {
  employee: Employee;
  position?: Position | null;
  department?: Department | null;
  record: PayrollRecord;
  items: PayrollItem[];
  terTables?: TERTable[];
  asOf?: Date;
}): SalaryReportRow {
  const { employee, record, items } = input;
  const amounts = collectAmounts(record, items);

  const transport = amounts.transport ?? 0;
  const komunikasi = amounts.komunikasi ?? 0;
  const housing = amounts.housing ?? 0;
  const attendance = amounts.attendance_allowance ?? 0;
  const fixed = amounts.fixed_allowance ?? 0;
  const bpjskAllowance = amounts.bpjsk_allowance ?? 0;
  const jhtAllowance = amounts.jht_allowance ?? 0;
  const jpAllowance = amounts.jp_allowance ?? 0;
  const timeOff = amounts.time_off_compensation ?? 0;
  const bonus = amounts.bonus ?? 0;
  const overtime = amounts.overtime ?? 0;
  const taxAllowance = amounts.tax_allowance ?? 0;
  const basic = amounts.basic ?? 0;
  const fullBasic = amounts.full_basic ?? basic;

  const totalAllowance =
    transport + komunikasi + housing + attendance + fixed
    + bpjskAllowance + jhtAllowance + jpAllowance
    + timeOff + bonus + overtime + taxAllowance;

  const totalEarnings = amounts.total_earnings ?? (basic + totalAllowance);
  // Prefer stored gross when present and larger context already computed
  const earnings = record.grossPay > 0 ? whole(record.grossPay) : totalEarnings;

  const kasbon = (amounts.kasbon ?? 0) + (amounts.unpaid ?? 0);
  const jpEmployee = amounts.jp_employee ?? 0;
  const bpjskEmployee = amounts.bpjsk_employee ?? 0;
  const jhtEmployee = amounts.jht_employee ?? 0;
  const pph21Employee = amounts.pph21 ?? 0;
  const pph21Benefit = amounts.pph21_benefit ?? 0;

  const totalDeduction = amounts.total_deduction
    ?? (kasbon + jpEmployee + bpjskEmployee + jhtEmployee + pph21Employee);

  const takeHome = whole(record.netPay);
  const pph21Payment = pph21Benefit > 0 ? pph21Benefit : (pph21Employee > 0 ? pph21Employee : 0);

  const terGross = amounts.ter_gross
    ?? (earnings + (amounts.jkk ?? 0) + (amounts.jkm ?? 0) + (amounts.bpjsk_company ?? 0));
  const terRates = amounts.ter_rate_label != null
    ? String(amounts.ter_rate_label)
    : lookupTerPercent(terGross, employee.ptkpCode, input.terTables || []);

  const row: SalaryReportRow = {
    employee_id: employee.employeeCode,
    full_name: employee.fullName,
    job_position: input.position?.title || '',
    organization: input.department?.name || '',
    join_date: employee.joinDate,
    tax_configuration: taxLabel(employee, record),
    bpjs_tk_number: employee.bpjsTkNumber || '',
    bpjs_kes_number: employee.bpjsKesehatanNumber || '',
    npwp: employee.npwp || '',
    ktp: employee.nik || '',
    length_of_service: lengthOfService(employee.joinDate, input.asOf),
    full_basic: fullBasic,
    basic,
    transport,
    komunikasi,
    bpjsk_allowance: bpjskAllowance,
    jht_allowance: jhtAllowance,
    jp_allowance: jpAllowance,
    time_off_compensation: timeOff,
    bonus,
    overtime,
    tax_allowance: taxAllowance,
    total_allowance: totalAllowance,
    total_earnings: earnings,
    kasbon,
    jp_employee: jpEmployee,
    bpjsk_employee: bpjskEmployee,
    jht_employee: jhtEmployee,
    pph21: pph21Employee,
    total_deduction: totalDeduction,
    pph21_payment: pph21Payment,
    take_home_pay: takeHome,
    pph21_benefit: pph21Benefit,
    bank_name: employee.bankName || 'Not set',
    bank_account: employee.bankAccountNumber || '',
    bank_account_holder: employee.bankAccountName || '',
    jkk: amounts.jkk ?? 0,
    jkm: amounts.jkm ?? 0,
    jht_company: amounts.jht_company ?? 0,
    jp_company: amounts.jp_company ?? 0,
    bpjsk_company: amounts.bpjsk_company ?? 0,
    ter_rates: terRates,
  };

  return row;
}

export function formatSalaryReportCell(column: SalaryReportColumn, value: string | number): string {
  if (column.kind === 'money') {
    const n = typeof value === 'number' ? value : Number(value) || 0;
    return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Math.round(n));
  }
  return value == null ? '' : String(value);
}

export function salaryReportGrandTotal(rows: SalaryReportRow[]): SalaryReportRow {
  const total: SalaryReportRow = {
    employee_id: 'GRAND TOTAL',
    full_name: '',
    job_position: '',
    organization: '',
    join_date: '',
    tax_configuration: '',
    bpjs_tk_number: '',
    bpjs_kes_number: '',
    npwp: '',
    ktp: '',
    length_of_service: '',
    bank_name: '',
    bank_account: '',
    bank_account_holder: '',
    ter_rates: '',
  };
  for (const key of moneyKeys) {
    total[key] = rows.reduce((sum, row) => sum + whole(row[key]), 0);
  }
  return total;
}

function csvEscape(value: unknown): string {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function salaryReportToCsv(rows: SalaryReportRow[], includeGrandTotal = true): string[] {
  const header = salaryReportColumns.map((c) => csvEscape(c.header)).join(',');
  const body = rows.map((row) =>
    salaryReportColumns.map((col) => {
      const raw = row[col.key];
      if (col.kind === 'money') return String(whole(raw));
      return csvEscape(raw);
    }).join(','),
  );
  if (includeGrandTotal && rows.length) {
    const grand = salaryReportGrandTotal(rows);
    body.push(
      salaryReportColumns.map((col) => {
        if (col.key === 'employee_id') return csvEscape('GRAND TOTAL');
        if (col.kind === 'money') return String(whole(grand[col.key]));
        return '';
      }).join(','),
    );
  }
  return [header, ...body];
}
