/**
 * Client-side demo payroll + SC cycle mirroring server engine formulas.
 * Used when Vite is not embedded / API offline.
 */
import type {
  Attendance,
  BPJSRates,
  Employee,
  EmployeeLoan,
  LeaveRequest,
  LeaveType,
  OvertimeRequest,
  PayrollItem,
  PayrollPeriod,
  PayrollRecord,
  TERTable,
} from '../types';
import { mockPayrollConfigs, type MockPayrollConfig, DEMO_JKK_PERCENT } from '../data/mockPayrollConfigs';
import { overlapDays, roundIdr } from './payrollEngine';

export function splitFixedPay(grossFixed: number, basicPercentage: number) {
  const basic = Math.round((grossFixed * basicPercentage) / 100);
  return { basic, fixed_allowance: grossFixed - basic };
}

export function unpaidLeaveFromBasic(basic: number, workingDays: number, unpaidDays: number) {
  if (unpaidDays <= 0 || basic <= 0 || workingDays <= 0) return 0;
  return roundIdr((basic / workingDays) * unpaidDays);
}

function amountFromBp(base: number, rateBp: number | null | undefined) {
  if (!Number.isInteger(rateBp) || (rateBp as number) < 0 || !Number.isFinite(base) || base <= 0) return 0;
  return roundIdr((base * (rateBp as number)) / 10000);
}

function pctToBp(pct: number) {
  return roundIdr(pct * 100);
}

type RateBp = {
  health_employee_bp: number;
  health_employer_bp: number;
  health_salary_cap: number;
  jht_employee_bp: number;
  jht_employer_bp: number;
  jp_employee_bp: number;
  jp_employer_bp: number;
  jp_salary_cap: number;
  jkk_bp: number | null;
  jkm_bp: number;
};

export function ratesFromMock(bpjs: BPJSRates | undefined, useDemoJkk = true): RateBp | null {
  if (!bpjs) return null;
  const jkkPct = useDemoJkk ? DEMO_JKK_PERCENT : bpjs.jkkPercent;
  return {
    health_employee_bp: pctToBp(bpjs.healthEmployeePercent),
    health_employer_bp: pctToBp(bpjs.healthEmployerPercent),
    health_salary_cap: bpjs.healthSalaryCap,
    jht_employee_bp: pctToBp(bpjs.jhtEmployeePercent),
    jht_employer_bp: pctToBp(bpjs.jhtEmployerPercent),
    jp_employee_bp: pctToBp(bpjs.jpEmployeePercent),
    jp_employer_bp: pctToBp(bpjs.jpEmployerPercent),
    jp_salary_cap: bpjs.jpSalaryCap,
    jkk_bp: jkkPct == null ? null : pctToBp(jkkPct),
    jkm_bp: pctToBp(bpjs.jkmPercent),
  };
}

function overtimePay(basic: number, overtimeMinutes: number, isHoliday: boolean) {
  const hours = Math.max(0, overtimeMinutes / 60);
  const hourly = basic / 173;
  let paidHours = 0;
  if (isHoliday) {
    const first = Math.min(hours, 7);
    const eighth = Math.min(Math.max(hours - 7, 0), 1);
    const after = Math.max(hours - 8, 0);
    paidHours = first * 2 + eighth * 3 + after * 4;
  } else {
    const first = Math.min(hours, 1);
    const next = Math.max(hours - 1, 0);
    paidHours = first * 1.5 + next * 2;
  }
  return roundIdr(hourly * paidHours);
}

function bpjsFromRates(
  baseAmount: number,
  rates: RateBp | null,
  opts: { kesehatan: boolean; tk: boolean; programs: 2 | 4 },
) {
  const empty = {
    health_employee: 0,
    health_employer: 0,
    jht_employee: 0,
    jht_employer: 0,
    jp_employee: 0,
    jp_employer: 0,
    jkk: 0,
    jkm: 0,
    employee_total: 0,
    company_total: 0,
    jkk_missing: false,
  };
  if (!rates || baseAmount <= 0) return empty;

  const healthBase = Math.min(baseAmount, rates.health_salary_cap);
  const pensionBase = Math.min(baseAmount, rates.jp_salary_cap);

  let health_employee = 0;
  let health_employer = 0;
  if (opts.kesehatan) {
    health_employee = amountFromBp(healthBase, rates.health_employee_bp);
    health_employer = amountFromBp(healthBase, rates.health_employer_bp);
  }

  let jht_employee = 0;
  let jht_employer = 0;
  let jp_employee = 0;
  let jp_employer = 0;
  let jkk = 0;
  let jkm = 0;
  let jkk_missing = false;

  if (opts.tk) {
    jkm = amountFromBp(baseAmount, rates.jkm_bp);
    if (rates.jkk_bp == null) jkk_missing = true;
    else jkk = amountFromBp(baseAmount, rates.jkk_bp);
    if (opts.programs === 4) {
      jht_employee = amountFromBp(baseAmount, rates.jht_employee_bp);
      jht_employer = amountFromBp(baseAmount, rates.jht_employer_bp);
      jp_employee = amountFromBp(pensionBase, rates.jp_employee_bp);
      jp_employer = amountFromBp(pensionBase, rates.jp_employer_bp);
    }
  }

  return {
    health_employee,
    health_employer,
    jht_employee,
    jht_employer,
    jp_employee,
    jp_employer,
    jkk,
    jkm,
    employee_total: health_employee + jht_employee + jp_employee,
    company_total: health_employer + jht_employer + jp_employer + jkk + jkm,
    jkk_missing,
  };
}

function lookupTerRateBp(monthlyGross: number, ptkpCode: string, terBrackets: TERTable[]) {
  const matching = terBrackets.filter((row) => row.ptkpCode === (ptkpCode || 'TK/0'));
  const source = matching.length ? matching : terBrackets.filter((row) => row.ptkpCode === 'TK/0');
  const bracket = source.find((row) => monthlyGross >= row.monthlyGrossMin && monthlyGross <= row.monthlyGrossMax);
  return bracket ? pctToBp(bracket.terRate) : 0;
}

export function calculateEmployeePayDemo(input: {
  config: MockPayrollConfig & { ptkp_code?: string };
  days_present: number;
  unpaid_leave_days: number;
  overtime_minutes: number;
  overtime_is_holiday?: boolean;
  loan_installment?: number;
  rates: RateBp | null;
  ter_brackets: TERTable[];
}) {
  const { config, rates, ter_brackets } = input;
  const daysPresent = Math.max(0, input.days_present);
  const unpaidDays = Math.max(0, input.unpaid_leave_days);
  const overtimeMinutes = Math.max(0, input.overtime_minutes);
  const loanInstallment = roundIdr(input.loan_installment || 0);
  const warnings: string[] = [];

  let basic = 0;
  let fixed_allowance = 0;
  const housing = roundIdr(config.housing_allowance || 0);
  const transport = roundIdr(config.transport_allowance || 0);
  let attendance_pay = 0;
  let overtime = 0;
  let unpaid_deduction = 0;
  let gross_earnings = 0;

  if (config.pay_type === 'DAILY') {
    const daily = roundIdr(config.daily_rate || 0);
    overtime = overtimePay(daily * (config.working_days_per_month || 22), overtimeMinutes, input.overtime_is_holiday === true);
    basic = daily * daysPresent;
    gross_earnings = basic + overtime;
  } else {
    const grossFixed = roundIdr(config.gross_fixed_salary || 0);
    const split = splitFixedPay(grossFixed, config.basic_percentage || 60);
    basic = split.basic;
    fixed_allowance = split.fixed_allowance;
    unpaid_deduction = unpaidLeaveFromBasic(basic, config.working_days_per_month || 22, unpaidDays);
    attendance_pay = roundIdr(config.attendance_allowance_per_day || 0) * daysPresent;
    overtime = overtimePay(basic, overtimeMinutes, input.overtime_is_holiday === true);
    gross_earnings =
      basic + fixed_allowance + housing + transport + attendance_pay + overtime - unpaid_deduction;
  }

  const bpjsBaseAmount = config.bpjs_base === 'BASIC_PLUS_FIXED' ? basic + fixed_allowance : basic;
  const programs: 2 | 4 = config.pay_type === 'DAILY' ? 2 : 4;
  const bpjs = bpjsFromRates(bpjsBaseAmount, rates, {
    kesehatan: config.bpjs_kesehatan_enabled !== false,
    tk: config.bpjs_tk_enabled !== false,
    programs,
  });
  if (bpjs.jkk_missing && config.bpjs_tk_enabled !== false) {
    warnings.push('JKK rate is not set for this company.');
  }

  let employeeBpjs = bpjs.employee_total;
  if (config.company_covers_employee_bpjs) employeeBpjs = 0;

  const terGross = gross_earnings + bpjs.jkk + bpjs.jkm + bpjs.health_employer;
  const pph21 = amountFromBp(terGross, lookupTerRateBp(terGross, config.ptkp_code || 'TK/0', ter_brackets));

  let employee_pph = pph21;
  let company_tax_cost = 0;
  if (config.tax_mode === 'COMPANY') {
    company_tax_cost = pph21;
    employee_pph = 0;
  }

  const total_deductions = employeeBpjs + employee_pph + loanInstallment;
  const take_home_pay = gross_earnings - total_deductions;

  return {
    warnings,
    detail: {
      basic,
      fixed_allowance,
      housing,
      transport,
      attendance_pay,
      overtime,
      unpaid_deduction,
      days_present: daysPresent,
      unpaid_leave_days: unpaidDays,
      bpjs,
      employee_pph,
      loan_installment: loanInstallment,
      tax_mode: config.tax_mode,
      pay_type: config.pay_type,
      company_tax_cost,
    },
    gross_earnings,
    total_deductions,
    take_home_pay,
  };
}

function countPresentDays(attendance: Attendance[], employeeId: string, start: string, end: string, statuses = ['PRESENT', 'LATE']) {
  const allowed = new Set(statuses);
  return attendance.filter(
    (row) =>
      row.employeeId === employeeId
      && row.attendanceDate >= start
      && row.attendanceDate <= end
      && allowed.has(row.status),
  ).length;
}

export function generateDemoPayroll(args: {
  period: PayrollPeriod;
  employees: Employee[];
  attendance: Attendance[];
  leaveRequests: LeaveRequest[];
  leaveTypes: LeaveType[];
  overtimeRequests: OvertimeRequest[];
  loans: EmployeeLoan[];
  bpjsRates: BPJSRates[];
  terTables: TERTable[];
  configs?: Record<string, MockPayrollConfig>;
}): { records: PayrollRecord[]; items: PayrollItem[]; warnings: string[] } {
  const configs = args.configs || mockPayrollConfigs;
  const rates = ratesFromMock(
    [...args.bpjsRates].sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))[0],
    true,
  );
  const warnings: string[] = [];
  const records: PayrollRecord[] = [];
  const items: PayrollItem[] = [];

  const active = args.employees.filter((e) => e.employmentStatus !== 'TERMINATED' && e.employmentStatus !== 'RESIGNED');

  for (const employee of active) {
    const config = configs[employee.id];
    if (!config) continue;

    const daysPresent = countPresentDays(args.attendance, employee.id, args.period.startDate, args.period.endDate);
    const unpaidDays = args.leaveRequests
      .filter((r) => r.employeeId === employee.id && r.status === 'APPROVED')
      .reduce((sum, r) => {
        const lt = args.leaveTypes.find((t) => t.id === r.leaveTypeId);
        if (!lt || lt.isPaid) return sum;
        return sum + overlapDays(r.startDate, r.endDate, args.period.startDate, args.period.endDate);
      }, 0);
    const overtimeMinutes = args.overtimeRequests
      .filter(
        (r) =>
          r.employeeId === employee.id
          && r.status === 'APPROVED'
          && (r.settlement || 'PAID') === 'PAID'
          && r.date >= args.period.startDate
          && r.date <= args.period.endDate,
      )
      .reduce((sum, r) => sum + r.totalMinutes, 0);
    const loan = args.loans.find((l) => l.employeeId === employee.id && l.status === 'ACTIVE');
    const loanInstallment = loan?.monthlyInstallment || config.loan_installment || 0;

    const result = calculateEmployeePayDemo({
      config: { ...config, ptkp_code: employee.ptkpCode || 'TK/0' },
      days_present: daysPresent,
      unpaid_leave_days: unpaidDays,
      overtime_minutes: overtimeMinutes,
      loan_installment: loanInstallment,
      rates,
      ter_brackets: args.terTables,
    });
    warnings.push(...result.warnings.map((w) => `${employee.employeeCode}: ${w}`));

    const d = result.detail;
    const allowance =
      d.fixed_allowance + d.housing + d.transport + d.attendance_pay;
    const recordId = `pr_${args.period.id}_${employee.employeeCode}`;
    // Structure-style codes (payslip + Salary Report PDF columns).
    // Netto (COMPANY tax): show BPJS employee shares as allowances + deductions (PDF style).
    const netto = config.tax_mode === 'COMPANY';
    const showBpjsGrossUp = netto || config.company_covers_employee_bpjs;
    const componentAmounts: Record<string, number> = {
      full_basic: d.basic,
      basic: d.basic,
      transport: d.transport,
      komunikasi: 0,
      housing: d.housing,
      fixed_allowance: d.fixed_allowance,
      attendance_allowance: d.attendance_pay,
      bpjsk_allowance: showBpjsGrossUp ? d.bpjs.health_employee : 0,
      jht_allowance: showBpjsGrossUp ? d.bpjs.jht_employee : 0,
      jp_allowance: showBpjsGrossUp ? d.bpjs.jp_employee : 0,
      bonus: 0,
      overtime: d.overtime,
      tax_allowance: netto ? d.company_tax_cost : 0,
      kasbon: d.loan_installment,
      unpaid: d.unpaid_deduction,
      jp_employee: d.bpjs.jp_employee,
      bpjsk_employee: d.bpjs.health_employee,
      jht_employee: d.bpjs.jht_employee,
      pph21: d.employee_pph,
      pph21_benefit: d.company_tax_cost,
      jkk: d.bpjs.jkk,
      jkm: d.bpjs.jkm,
      jht_company: d.bpjs.jht_employer,
      jp_company: d.bpjs.jp_employer,
      bpjsk_company: d.bpjs.health_employer,
      ter_gross: result.gross_earnings + d.bpjs.jkk + d.bpjs.jkm + d.bpjs.health_employer,
      tax_mode: netto ? 1 : 0,
    };
    const record: PayrollRecord = {
      id: recordId,
      payrollPeriodId: args.period.id,
      employeeId: employee.id,
      basicSalary: d.basic,
      allowance,
      overtime: d.overtime,
      serviceCharge: 0,
      grossPay: result.gross_earnings,
      totalDeductions: result.total_deductions,
      netPay: result.take_home_pay,
      status: 'CALCULATED',
      componentAmounts,
    };
    records.push(record);

    const lines: Array<[string, string, 'EARNING' | 'DEDUCTION', number]> = [
      ['basic', 'Basic Salary', 'EARNING', d.basic],
      ['transport', 'Tunjangan Transport', 'EARNING', d.transport],
      ['komunikasi', 'Tunjangan Komunikasi', 'EARNING', 0],
      ['housing', 'Housing', 'EARNING', d.housing],
      ['fixed_allowance', 'Fixed allowance', 'EARNING', d.fixed_allowance],
      ['attendance_allowance', 'Attendance allowance', 'EARNING', d.attendance_pay],
      ['overtime', 'Overtime', 'EARNING', d.overtime],
      ['tax_allowance', 'Tax Allowance', 'EARNING', componentAmounts.tax_allowance],
      ['kasbon', 'Kasbon', 'DEDUCTION', d.loan_installment],
      ['unpaid', 'Unpaid leave (basic only)', 'DEDUCTION', d.unpaid_deduction],
      ['bpjsk_employee', 'BPJS Kesehatan Employee', 'DEDUCTION', d.bpjs.health_employee],
      ['jht_employee', 'JHT Employee', 'DEDUCTION', d.bpjs.jht_employee],
      ['jp_employee', 'Jaminan Pensiun Employee', 'DEDUCTION', d.bpjs.jp_employee],
      ['pph21', 'PPh 21', 'DEDUCTION', d.employee_pph],
      ['jkk', 'JKK', 'EARNING', d.bpjs.jkk],
      ['jkm', 'JKM', 'EARNING', d.bpjs.jkm],
      ['jht_company', 'JHT Company', 'EARNING', d.bpjs.jht_employer],
      ['jp_company', 'Jaminan Pensiun Company', 'EARNING', d.bpjs.jp_employer],
      ['bpjsk_company', 'BPJS Kesehatan Company', 'EARNING', d.bpjs.health_employer],
      ['pph21_benefit', 'PPh 21 Benefit', 'EARNING', d.company_tax_cost],
    ];
    for (const [code, name, category, amount] of lines) {
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
        source_type: 'demo',
        source_id: employee.id,
      });
    }
  }

  return { records, items, warnings };
}

/** SC equal-per-present-day + FLAT PPh */
export function allocatePools(total: number, pools: { pool_key: string; label: string; pct: number }[]) {
  let allocatedPct = 0;
  const rows = pools.map((pool) => {
    const pct = Math.max(0, Math.trunc(Number(pool.pct) || 0));
    allocatedPct += pct;
    return {
      pool_key: pool.pool_key,
      label: pool.label,
      pct,
      nominal: roundIdr((total * pct) / 100),
    };
  });
  const unallocatedPct = Math.max(0, 100 - allocatedPct);
  const used = rows.reduce((sum, row) => sum + row.nominal, 0);
  rows.push({
    pool_key: 'unallocated',
    label: 'Unallocated',
    pct: unallocatedPct,
    nominal: Math.max(0, total - used),
  });
  const employeePool = rows.find((r) => r.pool_key === 'employee_pool');
  return {
    pools: rows,
    employee_pool_nominal: employeePool?.nominal ?? 0,
    under_95_warning: (employeePool?.pct ?? 0) < 95,
  };
}

export function splitEqualPerPresentDay(
  employeePoolNominal: number,
  people: { employee_id: string; employee_code?: string; full_name?: string; days_present: number; eligible: boolean; bank_name?: string; bank_account?: string; bank_account_name?: string }[],
) {
  const eligible = people.filter((p) => p.eligible !== false && (p.days_present || 0) > 0);
  const totalDays = eligible.reduce((sum, p) => sum + Math.max(0, Math.trunc(p.days_present || 0)), 0);
  if (totalDays <= 0 || employeePoolNominal <= 0) {
    return {
      value_per_day: 0,
      total_days_present: totalDays,
      items: people.map((p) => ({ ...p, days_present: Math.max(0, Math.trunc(p.days_present || 0)), gross: 0, pph21: 0, net: 0 })),
    };
  }
  const valuePerDay = Math.floor(employeePoolNominal / totalDays);
  let distributed = 0;
  const items = people.map((p) => {
    const days = Math.max(0, Math.trunc(p.days_present || 0));
    const gross = p.eligible === false ? 0 : valuePerDay * days;
    distributed += gross;
    return { ...p, days_present: days, gross, pph21: 0, net: gross };
  });
  let remainder = employeePoolNominal - distributed;
  if (remainder > 0) {
    const ranked = [...items].filter((i) => i.eligible !== false).sort((a, b) => b.days_present - a.days_present);
    if (ranked[0]) {
      const target = items.find((i) => i.employee_id === ranked[0].employee_id);
      if (target) {
        target.gross += remainder;
        target.net = target.gross;
      }
    }
  }
  return { value_per_day: valuePerDay, total_days_present: totalDays, items };
}

export function applyFlatPph(
  items: { gross: number; [key: string]: unknown }[],
  terRateBp: number,
) {
  return items.map((item) => {
    const pph21 = amountFromBp(item.gross as number, terRateBp);
    return { ...item, pph21, net: (item.gross as number) - pph21 };
  });
}

export function generateDemoServiceCharge(args: {
  year: number;
  month: number;
  total: number;
  pools: { pool_key: string; label: string; pct: number }[];
  presentStatuses: string[];
  employees: Employee[];
  attendance: Attendance[];
  configs?: Record<string, MockPayrollConfig>;
  terTables: TERTable[];
  flatTerRateBp?: number;
}) {
  const configs = args.configs || mockPayrollConfigs;
  const start = `${args.year}-${String(args.month).padStart(2, '0')}-01`;
  const endDate = new Date(args.year, args.month, 0);
  const end = `${args.year}-${String(args.month).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

  const people = args.employees
    .filter((e) => e.employmentStatus !== 'TERMINATED' && e.employmentStatus !== 'RESIGNED')
    .map((e) => {
      const cfg = configs[e.id];
      const contractKind = cfg?.contract_kind || (e.serviceChargeEligible === false ? 'DAILY_HIRE' : 'PKWTT');
      const eligible =
        e.serviceChargeEligible !== false
        && (contractKind === 'PKWTT' || contractKind === 'PKWT');
      return {
        employee_id: e.id,
        employee_code: e.employeeCode,
        full_name: e.fullName,
        days_present: countPresentDays(args.attendance, e.id, start, end, args.presentStatuses),
        eligible,
        bank_name: e.bankName,
        bank_account: e.bankAccountNumber,
        bank_account_name: e.bankAccountName,
        ptkp_code: e.ptkpCode || 'TK/0',
      };
    });

  const allocated = allocatePools(args.total, args.pools);
  const split = splitEqualPerPresentDay(allocated.employee_pool_nominal, people);

  // FLAT PPh: use a single TER bp — default middle bracket 10% (1000 bp) unless provided
  const flatBp = args.flatTerRateBp != null
    ? args.flatTerRateBp
    : lookupTerRateBp(5_500_000, 'TK/0', args.terTables) || 1000;
  const taxed = applyFlatPph(split.items, flatBp);

  return {
    value_per_day: split.value_per_day,
    under_95_warning: allocated.under_95_warning,
    total_days_present: split.total_days_present,
    employee_pool_nominal: allocated.employee_pool_nominal,
    items: taxed,
    version: 1,
  };
}

function csvEscape(value: unknown) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function buildBankCsv(
  bank: 'mandiri' | 'bni' | 'bri',
  rows: { bank_account?: string; bank_account_name?: string; bank_name?: string; net: number; employee_code?: string; full_name?: string }[],
  periodLabel = 'export',
) {
  const list = rows.filter((r) => (r.net || 0) > 0 && r.bank_account);
  const remark = 'SERVICE_CHARGE';
  if (bank === 'mandiri') {
    const headers = ['AccountNumber', 'AccountName', 'Amount', 'Currency', 'Remark', 'EmployeeCode'];
    const lines = [
      headers.join(','),
      ...list.map((p) =>
        [
          csvEscape(p.bank_account),
          csvEscape(p.bank_account_name || p.full_name || ''),
          Math.trunc(p.net),
          'IDR',
          remark,
          csvEscape(p.employee_code || ''),
        ].join(','),
      ),
    ];
    return { filename: `mandiri-transfer-${periodLabel}.csv`, content: `${lines.join('\n')}\n` };
  }
  if (bank === 'bni') {
    const headers = ['NomorRekening', 'Nama', 'Jumlah', 'Keterangan', 'KodePegawai'];
    const lines = [
      headers.join(','),
      ...list.map((p) =>
        [
          csvEscape(p.bank_account),
          csvEscape(p.bank_account_name || p.full_name || ''),
          Math.trunc(p.net),
          remark,
          csvEscape(p.employee_code || ''),
        ].join(','),
      ),
    ];
    return { filename: `bni-transfer-${periodLabel}.csv`, content: `${lines.join('\n')}\n` };
  }
  const headers = ['REKENING', 'NAMA', 'NOMINAL', 'BERITA', 'NIK'];
  const lines = [
    headers.join(','),
    ...list.map((p) =>
      [
        csvEscape(p.bank_account),
        csvEscape(p.bank_account_name || p.full_name || ''),
        Math.trunc(p.net),
        remark,
        csvEscape(p.employee_code || ''),
      ].join(','),
    ),
  ];
  return { filename: `bri-transfer-${periodLabel}.csv`, content: `${lines.join('\n')}\n` };
}
