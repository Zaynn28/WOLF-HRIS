/**
 * Client mirror of server/payroll-run-projection.js — keep codes in sync.
 */
import type { PayrollItem, PayrollRecord } from '../types';

function whole(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.trunc(n);
}

export function componentAmountsFromRunLine(line: any): Record<string, number> {
  const d = line?.detail && typeof line.detail === 'object' ? line.detail : {};
  const bpjs = d.bpjs && typeof d.bpjs === 'object' ? d.bpjs : {};
  const taxMode = String(d.tax_mode || '').toUpperCase();
  const netto = taxMode === 'COMPANY';
  const companyTax = whole(line?.company_tax_cost ?? d.company_tax_cost ?? (netto ? d.pph21 : 0));
  const employeePph = whole(d.employee_pph);
  const showBpjsGrossUp = netto || d.company_covers_employee_bpjs === true;

  const healthEmployee = whole(bpjs.health_employee);
  const jhtEmployee = whole(bpjs.jht_employee);
  const jpEmployee = whole(bpjs.jp_employee);

  const amounts: Record<string, number> = {
    full_basic: whole(d.basic),
    basic: whole(d.basic),
    transport: whole(d.transport),
    komunikasi: 0,
    housing: whole(d.housing),
    fixed_allowance: whole(d.fixed_allowance),
    attendance_allowance: whole(d.attendance_pay),
    bpjsk_allowance: showBpjsGrossUp ? healthEmployee : 0,
    jht_allowance: showBpjsGrossUp ? jhtEmployee : 0,
    jp_allowance: showBpjsGrossUp ? jpEmployee : 0,
    bonus: whole(d.bonus),
    overtime: whole(d.overtime),
    tax_allowance: netto ? companyTax : 0,
    kasbon: whole(d.loan_installment) + whole(d.late_deduction),
    unpaid: whole(d.unpaid_deduction),
    jp_employee: jpEmployee,
    bpjsk_employee: healthEmployee,
    jht_employee: jhtEmployee,
    pph21: employeePph,
    pph21_benefit: companyTax,
    jkk: whole(bpjs.jkk),
    jkm: whole(bpjs.jkm),
    jht_company: whole(bpjs.jht_employer),
    jp_company: whole(bpjs.jp_employer),
    bpjsk_company: whole(bpjs.health_employer),
    ter_gross: whole(d.ter_gross),
    tax_mode: netto ? 1 : 0,
  };

  if (d.company_covers_employee_bpjs === true && !netto) {
    amounts.bpjsk_employee = 0;
    amounts.jht_employee = 0;
    amounts.jp_employee = 0;
  }

  return amounts;
}

export function payrollItemsFromAmounts(recordId: string, amounts: Record<string, number>): PayrollItem[] {
  const catalog: Array<[string, string, 'EARNING' | 'DEDUCTION']> = [
    ['basic', 'Basic Salary', 'EARNING'],
    ['transport', 'Tunjangan Transport', 'EARNING'],
    ['housing', 'Housing', 'EARNING'],
    ['fixed_allowance', 'Fixed allowance', 'EARNING'],
    ['attendance_allowance', 'Attendance allowance', 'EARNING'],
    ['bpjsk_allowance', 'BPJS Kesehatan Allowance', 'EARNING'],
    ['jht_allowance', 'JHT Employee Allowance', 'EARNING'],
    ['jp_allowance', 'JP Employee Allowance', 'EARNING'],
    ['bonus', 'Bonus', 'EARNING'],
    ['overtime', 'Overtime', 'EARNING'],
    ['tax_allowance', 'Tax Allowance', 'EARNING'],
    ['kasbon', 'Kasbon', 'DEDUCTION'],
    ['unpaid', 'Unpaid leave (basic only)', 'DEDUCTION'],
    ['bpjsk_employee', 'BPJS Kesehatan Employee', 'DEDUCTION'],
    ['jht_employee', 'JHT Employee', 'DEDUCTION'],
    ['jp_employee', 'Jaminan Pensiun Employee', 'DEDUCTION'],
    ['pph21', 'PPh 21', 'DEDUCTION'],
    ['jkk', 'JKK', 'EARNING'],
    ['jkm', 'JKM', 'EARNING'],
    ['jht_company', 'JHT Company', 'EARNING'],
    ['jp_company', 'Jaminan Pensiun Company', 'EARNING'],
    ['bpjsk_company', 'BPJS Kesehatan Company', 'EARNING'],
    ['pph21_benefit', 'PPh 21 Benefit', 'EARNING'],
  ];
  const items: PayrollItem[] = [];
  for (const [code, name, category] of catalog) {
    const amount = whole(amounts[code]);
    if (amount <= 0 && code !== 'basic') continue;
    items.push({
      id: `pi_${recordId}_${code}`,
      payrollRecordId: recordId,
      componentCode: code,
      componentName: name,
      category,
      quantity: 1,
      rate: amount,
      amount,
    });
  }
  return items;
}

export function projectRunLinesToClient(
  lines: any[],
  periodId: string,
): { records: PayrollRecord[]; items: PayrollItem[] } {
  const records: PayrollRecord[] = [];
  const items: PayrollItem[] = [];
  for (const line of lines || []) {
    const detail = typeof line.detail === 'string' ? JSON.parse(line.detail) : line.detail;
    const normalized = { ...line, detail };
    const amounts = componentAmountsFromRunLine(normalized);
    const employeeId = String(line.employee_id || line.employeeId || '');
    const id = `pr_${periodId}_${employeeId}`;
    const allowance =
      amounts.transport +
      amounts.komunikasi +
      amounts.housing +
      amounts.fixed_allowance +
      amounts.attendance_allowance +
      amounts.bpjsk_allowance +
      amounts.jht_allowance +
      amounts.jp_allowance +
      amounts.tax_allowance;
    records.push({
      id,
      payrollPeriodId: periodId,
      employeeId,
      basicSalary: amounts.basic,
      allowance,
      overtime: amounts.overtime,
      serviceCharge: 0,
      grossPay: whole(line.gross_earnings ?? line.grossEarnings),
      totalDeductions: whole(line.total_deductions ?? line.totalDeductions),
      netPay: whole(line.take_home_pay ?? line.takeHomePay ?? line.net),
      status: 'CALCULATED',
      componentAmounts: amounts,
    });
    items.push(...payrollItemsFromAmounts(id, amounts));
  }
  return { records, items };
}
