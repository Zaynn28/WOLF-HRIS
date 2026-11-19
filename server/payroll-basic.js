import { readStoredBaseSalary } from "./employee-profile.js";
import { defaultPayrollStructure, evaluatePayroll } from "./payroll-structure.js";

const periodCodePattern = /^\d{4}-(0[1-9]|1[0-2])$/;

function isoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return value;
}

export function payrollPeriodAcceptsProfileSalary(status) {
  return status === "DRAFT" || status === "CALCULATED";
}

export function payrollPeriodInput(fields) {
  const source = fields && typeof fields === "object" ? fields : {};
  const periodCode = source.period_code;
  const start = isoDate(source.start_date);
  const end = isoDate(source.end_date);
  const pay = isoDate(source.pay_date);
  if (typeof periodCode !== "string" || !periodCodePattern.test(periodCode) || !start || !end || !pay || start > end) {
    return { ok: false, error: "The payroll period is not valid." };
  }
  return {
    ok: true,
    fields: {
      period_code: periodCode,
      start_date: start,
      end_date: end,
      pay_date: pay,
      company_id: source.company_id,
      created_by: null,
    },
  };
}

function wholeFromDb(value) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d+\.0+$/.test(trimmed)) return readStoredBaseSalary(trimmed.slice(0, trimmed.indexOf(".")));
  }
  return readStoredBaseSalary(value);
}

/**
 * Profile gaji pokok becomes one basic-salary step per employee.
 * Empty gaji pokok is skipped. Another company's row is skipped.
 * A line already stored from the profile is updated. A manual line is left alone.
 */
export function planProfileBasicSalaries(companyId, employees, existingRows) {
  const existingByEmployee = new Map();
  for (const row of existingRows ?? []) {
    if (!row || row.company_id !== companyId || !row.employee_id) continue;
    existingByEmployee.set(row.employee_id, row);
  }
  const steps = [];
  const seen = new Set();
  for (const employee of employees ?? []) {
    if (!employee || employee.company_id !== companyId || !employee.id || seen.has(employee.id)) continue;
    seen.add(employee.id);
    const amount = readStoredBaseSalary(employee.gaji_pokok);
    const existing = existingByEmployee.get(employee.id);
    if (amount == null) {
      if (existing?.basic_salary_from_profile === true && readStoredBaseSalary(existing.basic_salary) != null) {
        steps.push({ action: "clear", employeeId: employee.id });
      }
      continue;
    }
    if (!existing) {
      steps.push({ action: "insert", employeeId: employee.id, basicSalary: amount });
      continue;
    }
    if (existing.basic_salary_from_profile !== true) continue;
    if (readStoredBaseSalary(existing.basic_salary) !== amount) {
      steps.push({ action: "update", employeeId: employee.id, basicSalary: amount });
    }
  }
  return steps;
}

function storedComponentMap(row) {
  let raw = row?.component_amounts;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = null;
    }
  }
  return raw && typeof raw === "object" ? raw : null;
}

function readComponentAmount(row, code) {
  // Explicit null basic_salary means "no line" — do not resurrect from a prior presentPayrollLine map.
  if ((code === "basic" || code === "full_basic")
    && Object.prototype.hasOwnProperty.call(row, "basic_salary")
    && row.basic_salary == null) {
    return null;
  }
  const stored = storedComponentMap(row);
  if (stored && Object.prototype.hasOwnProperty.call(stored, code)) {
    const amount = wholeFromDb(stored[code]);
    if (amount != null) return amount;
    const n = Number(stored[code]);
    if (Number.isFinite(n)) return Math.trunc(n);
  }
  if (code === "basic" || code === "full_basic") return wholeFromDb(row.basic_salary);
  if (code === "allowance") return wholeFromDb(row.allowance) ?? 0;
  if (code === "overtime") return wholeFromDb(row.overtime) ?? 0;
  if (code === "service_charge") return wholeFromDb(row.service_charge) ?? 0;
  if (code === "deductions") return wholeFromDb(row.total_deductions) ?? 0;
  return 0;
}

function deductionTotal(view, componentAmounts, row) {
  if (Object.prototype.hasOwnProperty.call(componentAmounts, "deductions")) return componentAmounts.deductions;
  const itemized = view.components.filter((component) => component.kind === "deduction" && component.active);
  if (itemized.length === 0) return wholeFromDb(row.total_deductions) ?? 0;
  return itemized.reduce((sum, component) => sum + (componentAmounts[component.code] ?? 0), 0);
}

export function presentPayrollLine(row, structure) {
  if (!row || typeof row !== "object") return null;
  const view = structure?.grossFormula && Array.isArray(structure.components) ? structure : defaultPayrollStructure();
  const stored = storedComponentMap(row);
  const componentAmounts = {};
  // Prefer full engine projection when present (includes codes outside structure list).
  if (stored && !(Object.prototype.hasOwnProperty.call(row, "basic_salary") && row.basic_salary == null)) {
    for (const [code, value] of Object.entries(stored)) {
      if (typeof code !== "string" || !/^[a-z][a-z0-9_]{0,31}$/.test(code)) continue;
      const amount = Number(value);
      if (!Number.isFinite(amount)) continue;
      componentAmounts[code] = Math.trunc(amount);
    }
  }
  for (const component of view.components) {
    if (!Object.prototype.hasOwnProperty.call(componentAmounts, component.code)) {
      componentAmounts[component.code] = readComponentAmount(row, component.code);
    }
  }
  const basic = readComponentAmount(row, "basic");
  if (basic != null) componentAmounts.basic = basic;
  const hasEngineProjection = Boolean(stored && Object.keys(stored).length > 0);
  const formula = basic == null ? { gross: null, net: null } : evaluatePayroll(view, componentAmounts);
  const deductions = hasEngineProjection
    ? (wholeFromDb(row.total_deductions) ?? deductionTotal(view, componentAmounts, row))
    : deductionTotal(view, componentAmounts, row);
  const gross = hasEngineProjection
    ? (wholeFromDb(row.gross_pay) ?? formula.gross)
    : formula.gross;
  const net = hasEngineProjection
    ? (wholeFromDb(row.net_pay) ?? formula.net)
    : formula.net;
  return {
    id: row.id,
    company_id: row.company_id,
    payroll_period_id: row.payroll_period_id,
    employee_id: row.employee_id,
    employee_code: row.employee_code ?? null,
    full_name: row.full_name ?? null,
    department_name: row.department_name ?? null,
    basic_salary: basic,
    allowance: componentAmounts.allowance
      ?? (wholeFromDb(row.allowance) ?? 0),
    overtime: componentAmounts.overtime ?? 0,
    service_charge: componentAmounts.service_charge ?? 0,
    gross_pay: gross,
    formula_gross: gross,
    total_deductions: deductions ?? 0,
    net_pay: net,
    formula_net: net,
    component_amounts: componentAmounts,
    status: row.status ?? "DRAFT",
  };
}
