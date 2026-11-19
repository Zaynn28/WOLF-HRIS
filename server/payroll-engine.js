/**
 * Single server payroll engine (spec §4).
 * Does not invent statutory rates — caller supplies rate set; JKK may be null.
 */
import { roundIdr, amountFromBp } from "./money.js";
import { splitFixedPay } from "./employee-payroll-config.js";

export function cutoffWindow(periodYear, periodMonth, startDay, endDay) {
  // Period label "November" with 26–25 => Oct 26 .. Nov 25
  const end = new Date(Date.UTC(periodYear, periodMonth - 1, endDay));
  let start = new Date(Date.UTC(periodYear, periodMonth - 2, startDay));
  if (startDay <= endDay) {
    start = new Date(Date.UTC(periodYear, periodMonth - 1, startDay));
  }
  const iso = (d) => d.toISOString().slice(0, 10);
  return { period_start: iso(start), period_end: iso(end) };
}

export function unpaidLeaveFromBasic(basic, workingDays, unpaidDays) {
  if (unpaidDays <= 0 || basic <= 0 || workingDays <= 0) return 0;
  return roundIdr((basic / workingDays) * unpaidDays);
}

export function overtimePay(basic, overtimeMinutes, isHoliday, settings) {
  const hours = Math.max(0, overtimeMinutes / 60);
  const hourly = basic / 173;
  let paidHours = 0;
  if (isHoliday) {
    const first = Math.min(hours, 7);
    const eighth = Math.min(Math.max(hours - 7, 0), 1);
    const after = Math.max(hours - 8, 0);
    paidHours =
      first * ((settings.ot_holiday_first_bp || 20000) / 10000)
      + eighth * ((settings.ot_holiday_eighth_bp || 30000) / 10000)
      + after * ((settings.ot_holiday_after_bp || 40000) / 10000);
  } else {
    const first = Math.min(hours, 1);
    const next = Math.max(hours - 1, 0);
    paidHours =
      first * ((settings.ot_weekday_first_bp || 15000) / 10000)
      + next * ((settings.ot_weekday_next_bp || 20000) / 10000);
  }
  return roundIdr(hourly * paidHours);
}

/**
 * @param {object} rates — bp fields; jkk_bp may be null
 */
export function bpjsFromRates(baseAmount, rates, { kesehatan, tk, programs }) {
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

  const healthCap = rates.health_salary_cap != null ? Number(rates.health_salary_cap) : null;
  const jpCap = rates.jp_salary_cap != null ? Number(rates.jp_salary_cap) : null;
  const healthBase = healthCap != null ? Math.min(baseAmount, healthCap) : baseAmount;
  const pensionBase = jpCap != null ? Math.min(baseAmount, jpCap) : baseAmount;

  let health_employee = 0;
  let health_employer = 0;
  if (kesehatan) {
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

  if (tk) {
    jkm = amountFromBp(baseAmount, rates.jkm_bp);
    if (rates.jkk_bp == null) {
      jkk_missing = true;
    } else {
      jkk = amountFromBp(baseAmount, rates.jkk_bp);
    }
    if (programs === 4) {
      jht_employee = amountFromBp(baseAmount, rates.jht_employee_bp);
      jht_employer = amountFromBp(baseAmount, rates.jht_employer_bp);
      jp_employee = amountFromBp(pensionBase, rates.jp_employee_bp);
      jp_employer = amountFromBp(pensionBase, rates.jp_employer_bp);
    }
  }

  const employee_total = health_employee + jht_employee + jp_employee;
  const company_total = health_employer + jht_employer + jp_employer + jkk + jkm;
  return {
    health_employee,
    health_employer,
    jht_employee,
    jht_employer,
    jp_employee,
    jp_employer,
    jkk,
    jkm,
    employee_total,
    company_total,
    jkk_missing,
  };
}

export function lookupTerRateBp(monthlyGross, ptkpCode, terBrackets) {
  if (!Array.isArray(terBrackets) || terBrackets.length === 0) return 0;
  const code = ptkpCode || "TK/0";
  const matching = terBrackets.filter((row) => row.ptkp_code === code || row.ptkpCode === code);
  const source = matching.length ? matching : terBrackets.filter((row) => (row.ptkp_code || row.ptkpCode) === "TK/0");
  const min = (row) => Number(row.monthly_gross_min ?? row.monthlyGrossMin ?? 0);
  const max = (row) => Number(row.monthly_gross_max ?? row.monthlyGrossMax ?? Number.MAX_SAFE_INTEGER);
  const rate = (row) => {
    if (row.ter_rate_bp != null) return Number(row.ter_rate_bp);
    if (row.terRateBp != null) return Number(row.terRateBp);
    // Percent (e.g. 5) → bp
    const pct = Number(row.ter_rate ?? row.terRate ?? 0);
    return roundIdr(pct * 100);
  };
  const bracket = source.find((row) => monthlyGross >= min(row) && monthlyGross <= max(row));
  return bracket ? rate(bracket) : 0;
}

export function pph21Ter(grossForTax, ptkpCode, terBrackets) {
  const bp = lookupTerRateBp(grossForTax, ptkpCode, terBrackets);
  return amountFromBp(grossForTax, bp);
}

/**
 * Calculate one employee line for a period.
 */
export function calculateEmployeePay(input) {
  const warnings = [];
  const config = input.config;
  const settings = input.settings || {};
  const rates = input.rates || null;
  const terBrackets = input.ter_brackets || [];
  const daysPresent = Math.max(0, Number(input.days_present) || 0);
  const unpaidDays = Math.max(0, Number(input.unpaid_leave_days) || 0);
  const overtimeMinutes = Math.max(0, Number(input.overtime_minutes) || 0);
  const bonus = roundIdr(Number(input.bonus) || 0);
  const lateEvents = Math.max(0, Number(input.late_events) || 0);
  const loanInstallment = roundIdr(Number(input.loan_installment) || 0);
  const isProbation = input.is_probation === true;
  const isDecember = input.is_december === true;
  const ytdPph = roundIdr(Number(input.ytd_pph_jan_nov) || 0);
  const annualNetForTrueUp = roundIdr(Number(input.annual_net_for_true_up) || 0);

  let basic = 0;
  let fixed_allowance = 0;
  let housing = roundIdr(config.housing_allowance || 0);
  let transport = roundIdr(config.transport_allowance || 0);
  let attendance_pay = 0;
  let overtime = 0;
  let unpaid_deduction = 0;
  let gross_earnings = 0;

  if (config.pay_type === "DAILY") {
    const daily = roundIdr(config.daily_rate || 0);
    gross_earnings = daily * daysPresent + bonus;
    overtime = overtimePay(daily * (config.working_days_per_month || 22), overtimeMinutes, input.overtime_is_holiday === true, settings);
    gross_earnings += overtime;
    basic = daily * daysPresent;
  } else {
    const grossFixed = roundIdr(config.gross_fixed_salary || 0);
    const split = splitFixedPay(grossFixed, config.basic_percentage || 60);
    basic = split.basic;
    fixed_allowance = split.fixed_allowance;
    unpaid_deduction = unpaidLeaveFromBasic(basic, config.working_days_per_month || 22, unpaidDays);
    attendance_pay = roundIdr(config.attendance_allowance_per_day || 0) * daysPresent;
    overtime = overtimePay(basic, overtimeMinutes, input.overtime_is_holiday === true, settings);
    gross_earnings =
      basic + fixed_allowance + housing + transport + attendance_pay + overtime + bonus - unpaid_deduction;
  }

  const bpjsBaseAmount =
    config.bpjs_base === "BASIC_PLUS_FIXED" ? basic + fixed_allowance : basic;
  const programs = config.pay_type === "DAILY" || isProbation ? 2 : 4;
  const bpjs = bpjsFromRates(bpjsBaseAmount, rates, {
    kesehatan: config.bpjs_kesehatan_enabled !== false,
    tk: config.bpjs_tk_enabled !== false,
    programs,
  });
  if (bpjs.jkk_missing && config.bpjs_tk_enabled !== false) {
    warnings.push("JKK rate is not set for this company.");
  }

  let employeeBpjs = bpjs.employee_total;
  if (config.company_covers_employee_bpjs) {
    employeeBpjs = 0;
  }

  // TER gross includes company-paid JKK, JKM, Kesehatan employer share (spec §4.4)
  const terGross = gross_earnings + bpjs.jkk + bpjs.jkm + bpjs.health_employer;
  let pph21 = 0;
  let company_tax_cost = 0;
  if (isDecember && annualNetForTrueUp > 0) {
    // True-up stub: caller may pass computed annual; without brackets use TER on month
    pph21 = Math.max(0, pph21Ter(terGross, config.ptkp_code, terBrackets) - 0);
    // Full Pasal 17 true-up requires annual tables — keep monthly TER if annual not provided
    if (input.annual_pph_pasal17 != null) {
      pph21 = Math.max(0, roundIdr(Number(input.annual_pph_pasal17)) - ytdPph);
    }
  } else {
    pph21 = pph21Ter(terGross, config.ptkp_code, terBrackets);
  }

  let employee_pph = pph21;
  if (config.tax_mode === "COMPANY") {
    company_tax_cost = pph21;
    employee_pph = 0;
  }

  const late_deduction = roundIdr((settings.late_deduction_per_event || 0) * lateEvents);
  const total_deductions = employeeBpjs + employee_pph + late_deduction + loanInstallment;
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
      bonus,
      unpaid_deduction,
      days_present: daysPresent,
      unpaid_leave_days: unpaidDays,
      bpjs,
      bpjs_base_amount: bpjsBaseAmount,
      bpjs_programs: programs,
      ter_gross: terGross,
      pph21,
      employee_pph,
      late_deduction,
      loan_installment: loanInstallment,
      tax_mode: config.tax_mode,
      pay_type: config.pay_type,
      company_covers_employee_bpjs: config.company_covers_employee_bpjs === true,
      company_tax_cost,
    },
    gross_earnings,
    total_deductions,
    take_home_pay,
    company_tax_cost,
  };
}
