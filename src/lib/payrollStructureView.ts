import type { PayrollRecord, PayrollStructure, PayrollStructureComponent } from '../types';

export const sharedTariffCodes = new Set([
  'bpjsk_allowance',
  'jht_allowance',
  'jp_allowance',
  'jp_employee',
  'bpjsk_employee',
  'jht_employee',
  'jkk',
  'jkm',
  'jht_company',
  'jp_company',
  'bpjsk_company',
]);

export function basisPointsFromPercent(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(trimmed)) return null;
  const [whole, fraction = ''] = trimmed.split('.');
  const basisPoints = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(basisPoints) || basisPoints > 10000) return null;
  return basisPoints;
}

export function percentFromBasisPoints(rateBp: number | null | undefined): string {
  if (rateBp == null) return '';
  const whole = Math.trunc(rateBp / 100);
  const fraction = String(Math.abs(rateBp % 100)).padStart(2, '0');
  return `${whole}.${fraction}`;
}

function component(code: string, displayName: string, kind: PayrollStructureComponent['kind'], sortOrder: number): PayrollStructureComponent {
  return { code, displayName, kind, sortOrder, active: true, rateBp: null, wageBase: [] };
}

export const defaultPayrollStructure: PayrollStructure = {
  effectiveFrom: null,
  grossFormula: 'basic + transport + komunikasi + bpjsk_allowance + jht_allowance + jp_allowance + bonus + overtime + tax_allowance',
  netFormula: 'gross - kasbon - jp_employee - bpjsk_employee - jht_employee - pph21',
  source: 'company',
  components: [
    component('full_basic', 'Full Basic Salary', 'earning', 10),
    component('basic', 'Basic Salary', 'earning', 20),
    component('transport', 'Tunjangan Transport', 'earning', 30),
    component('komunikasi', 'Tunjangan Komunikasi', 'earning', 40),
    component('bpjsk_allowance', 'BPJS Kesehatan Allowance', 'earning', 50),
    component('jht_allowance', 'JHT Employee Allowance', 'earning', 60),
    component('jp_allowance', 'JP Employee Allowance', 'earning', 70),
    component('bonus', 'Bonus', 'earning', 80),
    component('overtime', 'Overtime', 'earning', 90),
    component('tax_allowance', 'Tax Allowance', 'earning', 100),
    component('kasbon', 'Kasbon', 'deduction', 110),
    component('jp_employee', 'Jaminan Pensiun Employee', 'deduction', 120),
    component('bpjsk_employee', 'BPJS Kesehatan Employee', 'deduction', 130),
    component('jht_employee', 'JHT Employee', 'deduction', 140),
    component('pph21', 'PPh 21', 'deduction', 150),
    component('jkk', 'JKK', 'earning', 160),
    component('jkm', 'JKM', 'earning', 170),
    component('jht_company', 'JHT Company', 'earning', 180),
    component('jp_company', 'Jaminan Pensiun Company', 'earning', 190),
    component('bpjsk_company', 'BPJS Kesehatan Company', 'earning', 200),
  ],
};

function componentAmount(record: PayrollRecord, code: string): number {
  const amount = payrollComponentAmount(record, code);
  return typeof amount === 'number' ? amount : 0;
}

export function payrollProcessingSummary(record: PayrollRecord, benefitAmount = 0) {
  const fixedAllowance = componentAmount(record, 'transport') + componentAmount(record, 'komunikasi');
  const bpjsAllowance = componentAmount(record, 'bpjsk_allowance') + componentAmount(record, 'jht_allowance') + componentAmount(record, 'jp_allowance');
  const bpjsDeduction = componentAmount(record, 'bpjsk_employee') + componentAmount(record, 'jht_employee') + componentAmount(record, 'jp_employee');
  const cashDeduction = componentAmount(record, 'kasbon') + componentAmount(record, 'pph21');
  const statutoryTouched = bpjsAllowance !== 0 || bpjsDeduction !== 0 || cashDeduction !== 0;
  return {
    basic: componentAmount(record, 'basic'),
    allowance: (fixedAllowance !== 0 ? fixedAllowance : componentAmount(record, 'allowance')) + Math.max(0, bpjsAllowance - bpjsDeduction),
    additional: componentAmount(record, 'bonus') + componentAmount(record, 'overtime'),
    deduction: statutoryTouched ? cashDeduction + Math.max(0, bpjsDeduction - bpjsAllowance) : componentAmount(record, 'deductions'),
    benefit: benefitAmount,
    total: record.netPay,
  };
}

export function activePayrollComponents(structure: PayrollStructure) {
  return structure.components
    .filter((component) => component.active)
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder || left.code.localeCompare(right.code));
}

export function payrollComponentAmount(record: PayrollRecord, code: string): number | null {
  if (record.componentAmounts && Object.prototype.hasOwnProperty.call(record.componentAmounts, code)) {
    return record.componentAmounts[code];
  }
  if (code === 'basic') return record.basicSalary;
  if (code === 'allowance') return record.allowance;
  if (code === 'overtime') return record.overtime;
  if (code === 'service_charge') return record.serviceCharge;
  if (code === 'deductions') return record.totalDeductions;
  return 0;
}

export function hrCanConfigurePayroll(role: string | undefined) {
  return role === 'HR_ADMIN' || role === 'HR_STAFF' || role === 'SUPER_ADMIN';
}
