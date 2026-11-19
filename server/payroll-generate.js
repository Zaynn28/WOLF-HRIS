import { calculateEmployeePay, cutoffWindow } from "./payroll-engine.js";
import { readEmployeePayrollConfig } from "./employee-payroll-config.js";

function parsePeriodCode(periodCode) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(periodCode || ""));
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { year, month };
}

function isProbation(employee, periodEnd) {
  const status = String(employee.employment_status || "").toUpperCase();
  if (status === "PROBATION") return true;
  if (employee.probation_end_date && String(employee.probation_end_date) >= periodEnd) return true;
  return false;
}

/**
 * Build attendance summary map from rows with attendance_date + status.
 */
export function summarizeAttendance(rows, presentStatuses, periodStart, periodEnd) {
  const statuses = new Set((presentStatuses || ["PRESENT", "LATE"]).map((s) => String(s).toUpperCase()));
  const byEmployee = new Map();
  for (const row of rows || []) {
    const day = String(row.attendance_date || row.date || "");
    if (day < periodStart || day > periodEnd) continue;
    const id = row.employee_id;
    if (!byEmployee.has(id)) byEmployee.set(id, { days_present: 0, unpaid_leave_days: 0, late_events: 0, overtime_minutes: 0 });
    const bucket = byEmployee.get(id);
    const status = String(row.status || "").toUpperCase();
    if (statuses.has(status) || status === "PRESENT" || status === "LATE") {
      if (statuses.has(status) || status === "PRESENT" || status === "LATE") bucket.days_present += 1;
    }
    if (status === "UNPAID_LEAVE" || status === "ABSENT") bucket.unpaid_leave_days += 1;
    if (status === "LATE") bucket.late_events += 1;
    bucket.overtime_minutes += Math.max(0, Number(row.overtime_minutes) || 0);
  }
  return byEmployee;
}

export async function generatePayrollRun(db, {
  companyId,
  periodCode,
  userId,
  adjustments = {},
  terBrackets = [],
  presentStatuses = ["PRESENT", "LATE"],
}) {
  const parsed = parsePeriodCode(periodCode);
  if (!parsed) return { ok: false, error: "Period must be YYYY-MM." };

  const settings = await db.getPayrollGlobalSettings(companyId);
  const window = cutoffWindow(parsed.year, parsed.month, settings.cutoff_start_day, settings.cutoff_end_day);
  const rates = await db.getBpjsRateSet(companyId, window.period_end);
  const employees = await db.listActiveEmployeesForPayroll(companyId);

  let attendanceRows = [];
  try {
    if (typeof db.getAttendanceBetween === "function") {
      attendanceRows = await db.getAttendanceBetween(companyId, window.period_start, window.period_end);
    } else if (typeof db.getAttendanceByDateRange === "function") {
      attendanceRows = await db.getAttendanceByDateRange(companyId, window.period_start, window.period_end);
    }
  } catch {
    attendanceRows = [];
  }

  const attendanceMap = summarizeAttendance(attendanceRows, presentStatuses, window.period_start, window.period_end);
  const warnings = [];
  if (!rates) warnings.push("No BPJS rate set is effective for this period. BPJS amounts are zero until rates are saved.");
  if (rates && rates.jkk_bp == null) warnings.push("JKK rate is not set. JKK amounts are zero until Compliance fills it.");

  const lines = [];
  for (const employee of employees) {
    const config = readEmployeePayrollConfig(employee);
    const att = attendanceMap.get(employee.id) || { days_present: 0, unpaid_leave_days: 0, late_events: 0, overtime_minutes: 0 };
    const adj = adjustments[employee.id] || adjustments[employee.employee_code] || {};
    const result = calculateEmployeePay({
      config: { ...config, ptkp_code: employee.ptkp_code || config.ptkp_code },
      settings,
      rates,
      ter_brackets: terBrackets,
      days_present: adj.days_present != null ? adj.days_present : att.days_present,
      unpaid_leave_days: adj.unpaid_leave_days != null ? adj.unpaid_leave_days : att.unpaid_leave_days,
      overtime_minutes: adj.overtime_minutes != null ? adj.overtime_minutes : att.overtime_minutes,
      overtime_is_holiday: adj.overtime_is_holiday === true,
      bonus: adj.bonus || 0,
      late_events: adj.late_events != null ? adj.late_events : att.late_events,
      loan_installment: adj.loan_installment || 0,
      is_probation: isProbation(employee, window.period_end),
      is_december: parsed.month === 12,
      ytd_pph_jan_nov: adj.ytd_pph_jan_nov || 0,
      annual_pph_pasal17: adj.annual_pph_pasal17,
    });
    for (const warning of result.warnings) {
      if (!warnings.includes(warning)) warnings.push(warning);
    }
    lines.push({
      employee_id: employee.id,
      employee_code: employee.employee_code,
      full_name: employee.full_name,
      pay_type: config.pay_type,
      detail: result.detail,
      gross_earnings: result.gross_earnings,
      total_deductions: result.total_deductions,
      take_home_pay: result.take_home_pay,
      company_tax_cost: result.company_tax_cost,
    });
  }

  const saved = await db.createPayrollRunVersion(
    companyId,
    periodCode,
    window.period_start,
    window.period_end,
    userId,
    warnings,
    rates || {},
    settings,
    lines,
  );

  return {
    ok: true,
    period_code: periodCode,
    period_start: window.period_start,
    period_end: window.period_end,
    ...saved,
    line_count: lines.length,
    warnings,
  };
}
