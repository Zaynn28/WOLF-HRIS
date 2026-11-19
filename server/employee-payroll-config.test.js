import test from "node:test";
import assert from "node:assert/strict";
import {
  employeePayrollConfigPatch,
  presentEmployeePayrollConfig,
  splitFixedPay,
  legacyTaxToMode,
} from "./employee-payroll-config.js";

test("splitFixedPay uses whole rupiah basic percent", () => {
  assert.deepEqual(splitFixedPay(10_000_000, 60), { basic: 6_000_000, fixed_allowance: 4_000_000 });
});

test("legacy tax maps to tax_mode", () => {
  assert.equal(legacyTaxToMode("gross"), "EMPLOYEE");
  assert.equal(legacyTaxToMode("netto"), "COMPANY");
});

test("employeePayrollConfigPatch accepts MONTHLY checklist", () => {
  const parsed = employeePayrollConfigPatch({
    pay_type: "MONTHLY",
    gross_fixed_salary: 8_000_000,
    basic_percentage: 60,
    working_days_per_month: 22,
    housing_allowance: 0,
    transport_allowance: 500_000,
    attendance_allowance_per_day: 25_000,
    bpjs_kesehatan_enabled: true,
    bpjs_tk_enabled: true,
    bpjs_base: "BASIC",
    tax_mode: "COMPANY",
    npwp_enabled: true,
    company_covers_employee_bpjs: false,
  });
  assert.equal(parsed.ok, true);
  assert.equal(parsed.config.tax_configuration, "netto");
  assert.equal(parsed.config.transport_allowance, 500_000);
});

test("presentEmployeePayrollConfig seeds gross from gaji_pokok", () => {
  const view = presentEmployeePayrollConfig("e1", {
    gaji_pokok: "7500000",
    tax_configuration: "gross",
  });
  assert.equal(view.gross_fixed_salary, 7_500_000);
  assert.equal(view.tax_mode, "EMPLOYEE");
});
