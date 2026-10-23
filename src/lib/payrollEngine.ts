import type { BPJSRates, PayPolicy, TERTable } from '../types';

export const defaultPayPolicy: PayPolicy = {
  cutoffDay: 25,
  payDay: 5,
  otWeekdayFirst: 1.5,
  otWeekdayNext: 2,
  otHolidayFirst: 2,
  otHolidayEighth: 3,
  otHolidayAfter: 4,
  serviceChargePercentage: 10,
  highSeasonDates: [
    '2026-01-01', '2026-01-15', '2026-02-10', '2026-02-11', '2026-03-31',
    '2026-04-01', '2026-04-09', '2026-04-10', '2026-05-01', '2026-05-29',
    '2026-06-01', '2026-12-25', '2026-12-31',
  ],
  bpjsDueDay: 15,
  pphDueDay: 10,
};

export function roundIdr(amount: number): number {
  return Math.round(amount);
}

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0;
  return hours * 60 + minutes;
}

export function minutesLate(clockIn: string, shiftStart: string): number {
  return Math.max(0, timeToMinutes(clockIn) - timeToMinutes(shiftStart));
}

export function attendanceHours(clockIn?: string, clockOut?: string, breakMinutes = 0): number {
  if (!clockIn || !clockOut) return 0;
  let minutes = timeToMinutes(clockOut) - timeToMinutes(clockIn);
  if (minutes < 0) minutes += 24 * 60;
  return Math.max(0, minutes - breakMinutes) / 60;
}

export interface OvertimePay {
  hourlyRate: number;
  overtimePay: number;
  breakdown: string;
}

export function calculateOvertimePay(
  monthlyWage: number,
  totalMinutes: number,
  isHoliday: boolean,
  policy: Pick<PayPolicy, 'otWeekdayFirst' | 'otWeekdayNext' | 'otHolidayFirst' | 'otHolidayEighth' | 'otHolidayAfter'>,
): OvertimePay {
  const hours = Math.max(0, totalMinutes / 60);
  const hourlyRate = monthlyWage / 173;
  let paidHours = 0;
  let breakdown = '';

  if (isHoliday) {
    const first = Math.min(hours, 7);
    const eighth = Math.min(Math.max(hours - 7, 0), 1);
    const after = Math.max(hours - 8, 0);
    paidHours = first * policy.otHolidayFirst + eighth * policy.otHolidayEighth + after * policy.otHolidayAfter;
    breakdown = `Holiday: ${first.toFixed(1)}h × ${policy.otHolidayFirst}×`;
    if (eighth > 0) breakdown += ` + ${eighth.toFixed(1)}h × ${policy.otHolidayEighth}×`;
    if (after > 0) breakdown += ` + ${after.toFixed(1)}h × ${policy.otHolidayAfter}×`;
  } else {
    const first = Math.min(hours, 1);
    const next = Math.max(hours - 1, 0);
    paidHours = first * policy.otWeekdayFirst + next * policy.otWeekdayNext;
    breakdown = `Work day: ${first.toFixed(1)}h × ${policy.otWeekdayFirst}×`;
    if (next > 0) breakdown += ` + ${next.toFixed(1)}h × ${policy.otWeekdayNext}×`;
  }

  return { hourlyRate, overtimePay: roundIdr(hourlyRate * paidHours), breakdown };
}

export function overlapDays(start: string, end: string, periodStart: string, periodEnd: string): number {
  if (end < periodStart || start > periodEnd) return 0;
  const from = start > periodStart ? start : periodStart;
  const to = end < periodEnd ? end : periodEnd;
  const fromDate = new Date(`${from}T00:00:00`);
  const toDate = new Date(`${to}T00:00:00`);
  return Math.round((toDate.getTime() - fromDate.getTime()) / 86400000) + 1;
}

export function unpaidLeaveDeduction(monthlyWage: number, unpaidDays: number): number {
  if (unpaidDays <= 0 || monthlyWage <= 0) return 0;
  return roundIdr((monthlyWage / 30) * unpaidDays);
}

export interface BpjsShares {
  healthEmployee: number;
  healthEmployer: number;
  jhtEmployee: number;
  jhtEmployer: number;
  jpEmployee: number;
  jpEmployer: number;
  jkk: number;
  jkm: number;
  employeeTotal: number;
}

export function bpjsShares(wage: number, rates?: BPJSRates): BpjsShares {
  const empty: BpjsShares = {
    healthEmployee: 0, healthEmployer: 0, jhtEmployee: 0, jhtEmployer: 0,
    jpEmployee: 0, jpEmployer: 0, jkk: 0, jkm: 0, employeeTotal: 0,
  };
  if (!rates || wage <= 0) return empty;

  const healthBase = Math.min(wage, rates.healthSalaryCap > 0 ? rates.healthSalaryCap : wage);
  const pensionBase = Math.min(wage, rates.jpSalaryCap > 0 ? rates.jpSalaryCap : wage);
  const healthEmployee = roundIdr(healthBase * rates.healthEmployeePercent / 100);
  const healthEmployer = roundIdr(healthBase * rates.healthEmployerPercent / 100);
  const jhtEmployee = roundIdr(wage * rates.jhtEmployeePercent / 100);
  const jhtEmployer = roundIdr(wage * rates.jhtEmployerPercent / 100);
  const jpEmployee = roundIdr(pensionBase * rates.jpEmployeePercent / 100);
  const jpEmployer = roundIdr(pensionBase * rates.jpEmployerPercent / 100);
  const jkk = roundIdr(wage * rates.jkkPercent / 100);
  const jkm = roundIdr(wage * rates.jkmPercent / 100);

  return {
    healthEmployee, healthEmployer, jhtEmployee, jhtEmployer, jpEmployee, jpEmployer, jkk, jkm,
    employeeTotal: healthEmployee + jhtEmployee + jpEmployee,
  };
}

export function lookupTerRate(monthlyGross: number, ptkpCode: string, tables: TERTable[]): number {
  const code = ptkpCode || 'TK/0';
  const matching = tables.filter(row => row.ptkpCode === code);
  const source = matching.length > 0 ? matching : tables.filter(row => row.ptkpCode === 'TK/0');
  const bracket = source.find(row => monthlyGross >= row.monthlyGrossMin && monthlyGross <= row.monthlyGrossMax);
  return bracket?.terRate ?? 0;
}

export interface PeriodPayInput {
  basicSalary: number;
  allowance: number;
  overtime: number;
  serviceCharge: number;
  unpaidLeaveDeduction: number;
  ptkpCode: string;
  rates?: BPJSRates;
  terTables: TERTable[];
}

export interface PeriodPayResult {
  basicSalary: number;
  allowance: number;
  overtime: number;
  serviceCharge: number;
  unpaidLeaveDeduction: number;
  grossPay: number;
  bpjsHealth: number;
  bpjsJht: number;
  bpjsJp: number;
  bpjsEmployee: number;
  bpjsEmployerHealth: number;
  bpjsEmployerJht: number;
  bpjsEmployerJp: number;
  pph21: number;
  terRate: number;
  totalDeductions: number;
  netPay: number;
}

export function calculatePeriodPay(input: PeriodPayInput): PeriodPayResult {
  const basicSalary = roundIdr(input.basicSalary);
  const allowance = roundIdr(input.allowance);
  const overtime = roundIdr(input.overtime);
  const serviceCharge = roundIdr(input.serviceCharge);
  const unpaid = roundIdr(Math.max(0, input.unpaidLeaveDeduction));
  const grossPay = basicSalary + allowance + overtime + serviceCharge;
  const taxable = Math.max(0, grossPay - unpaid);
  const bpjs = bpjsShares(basicSalary + allowance, input.rates);
  const terRate = lookupTerRate(taxable, input.ptkpCode, input.terTables);
  const pph21 = roundIdr(taxable * terRate / 100);
  const totalDeductions = unpaid + bpjs.employeeTotal + pph21;

  return {
    basicSalary,
    allowance,
    overtime,
    serviceCharge,
    unpaidLeaveDeduction: unpaid,
    grossPay,
    bpjsHealth: bpjs.healthEmployee,
    bpjsJht: bpjs.jhtEmployee,
    bpjsJp: bpjs.jpEmployee,
    bpjsEmployee: bpjs.employeeTotal,
    bpjsEmployerHealth: bpjs.healthEmployer,
    bpjsEmployerJht: bpjs.jhtEmployer,
    bpjsEmployerJp: bpjs.jpEmployer,
    pph21,
    terRate,
    totalDeductions,
    netPay: grossPay - totalDeductions,
  };
}
