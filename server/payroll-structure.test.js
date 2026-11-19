import assert from "node:assert/strict";
import test from "node:test";
import { db } from "./database.js";
import { presentPayrollLine } from "./payroll-basic.js";
import { defaultPayrollStructure, evaluatePayroll, validatePayrollStructure } from "./payroll-structure.js";

function component(code, displayName, kind, active = true) {
  return { code, display_name: displayName, kind, active };
}

const defaults = defaultPayrollStructure().components.map((row) => component(row.code, row.displayName, row.kind, row.active));

test("the default gross and net formulas follow the salary report columns", () => {
  const amounts = {
    full_basic: 2850000,
    basic: 2850000,
    transport: 0,
    komunikasi: 150000,
    bpjsk_allowance: 30000,
    jht_allowance: 60000,
    jp_allowance: 30000,
    bonus: 0,
    overtime: 0,
    tax_allowance: 0,
    kasbon: 0,
    jp_employee: 30000,
    bpjsk_employee: 30000,
    jht_employee: 60000,
    pph21: 0,
    jkk: 16200,
    jkm: 9000,
    jht_company: 111000,
    jp_company: 60000,
    bpjsk_company: 120000,
  };
  const result = evaluatePayroll(defaultPayrollStructure(), amounts);
  assert.equal(result.gross, 3120000);
  assert.equal(result.net, 3000000);
  const line = presentPayrollLine({
    id: "line-1",
    company_id: "bzg",
    payroll_period_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    employee_id: "11111111-1111-4111-8111-111111111111",
    basic_salary: "2850000",
    allowance: "1",
    overtime: "0",
    service_charge: "3",
    total_deductions: "4",
    status: "DRAFT",
  }, defaultPayrollStructure());
  assert.equal(line.formula_gross, 2850000);
  assert.equal(line.formula_net, 2850000);
  assert.equal(line.component_amounts.basic, 2850000);
  assert.equal(line.component_amounts.full_basic, 2850000);
  assert.equal(line.total_deductions, 0);
  assert.equal(line.service_charge, 0);
});

test("a custom earning is included in gross and net", () => {
  const parsed = validatePayrollStructure({
    grossFormula: "basic + overtime + thr",
    netFormula: "gross - kasbon",
    components: [
      component("basic", "Basic Salary", "earning"),
      component("overtime", "Overtime", "earning"),
      component("thr", "THR", "earning"),
      component("kasbon", "Kasbon", "deduction"),
    ],
  });
  assert.equal(parsed.ok, true);
  const result = evaluatePayroll(parsed.structure, {
    basic: 10,
    overtime: 2,
    thr: 5,
    kasbon: 4,
  });
  assert.equal(result.gross, 17);
  assert.equal(result.net, 13);
});

test("an unknown component code is rejected", () => {
  const rejected = validatePayrollStructure({
    grossFormula: "basic + missing",
    netFormula: "gross - pph21",
    components: defaults,
  });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.error, "The formula uses an unknown component.");
});

test("an opened period keeps the structure snapshot it was opened with", async () => {
  const period = {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    company_id: "bzg",
    start_date: "2026-09-26",
  };
  const historical = [
    component("basic", "Basic", "earning"),
    component("allowance", "Allowance", "earning"),
    component("overtime", "Overtime", "earning"),
    component("deductions", "Deductions", "deduction"),
  ];
  const openedWith = validatePayrollStructure({
    grossFormula: "basic + allowance + overtime + service_charge",
    netFormula: "gross - deductions",
    components: [...historical, component("service_charge", "Service Charge", "earning")],
  });
  const later = validatePayrollStructure({
    grossFormula: "basic + bonus",
    netFormula: "gross - deductions",
    components: [...historical, component("bonus", "Bonus", "earning")],
  });
  assert.equal(openedWith.ok, true);
  assert.equal(later.ok, true);
  let company = { ...openedWith.structure, effectiveFrom: "2026-09-01" };
  let stored = null;
  const original = {
    getPeriodPayrollStructure: db.getPeriodPayrollStructure,
    getCompanyPayrollStructure: db.getCompanyPayrollStructure,
    query: db.query,
  };
  db.getCompanyPayrollStructure = async () => company;
  db.getPeriodPayrollStructure = async () => stored;
  db.query = async (sql, params) => {
    assert.match(String(sql), /INSERT INTO payroll_period_structures/);
    const components = JSON.parse(params[5]);
    stored = {
      effectiveFrom: params[2],
      grossFormula: params[3],
      netFormula: params[4],
      source: "period",
      components: components.map((row) => ({
        code: row.code,
        displayName: row.display_name,
        kind: row.kind,
        sortOrder: row.sort_order,
        active: row.active === true,
      })),
    };
    return { rows: [], rowCount: 1 };
  };
  try {
    const first = await db.ensurePayrollPeriodSnapshot("bzg", period);
    assert.equal(first.created, true);
    assert.equal(first.snapshot.grossFormula, "basic + allowance + overtime + service_charge");
    company = { ...later.structure, effectiveFrom: "2026-10-28" };
    const second = await db.ensurePayrollPeriodSnapshot("bzg", period);
    assert.equal(second.created, false);
    assert.equal(second.snapshot.grossFormula, "basic + allowance + overtime + service_charge");
    assert.equal(second.snapshot.components.some((row) => row.code === "bonus"), false);
  } finally {
    Object.assign(db, original);
  }
});
