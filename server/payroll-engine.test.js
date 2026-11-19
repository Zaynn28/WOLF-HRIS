import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateEmployeePay,
  unpaidLeaveFromBasic,
  cutoffWindow,
  bpjsFromRates,
} from "./payroll-engine.js";

test("unpaid leave uses basic only", () => {
  assert.equal(unpaidLeaveFromBasic(6_000_000, 22, 1), Math.round(6_000_000 / 22));
  assert.equal(unpaidLeaveFromBasic(6_000_000, 22, 0), 0);
});

test("cutoffWindow 26-25 for November", () => {
  const w = cutoffWindow(2026, 11, 26, 25);
  assert.equal(w.period_start, "2026-10-26");
  assert.equal(w.period_end, "2026-11-25");
});

test("JKK missing when rate unset", () => {
  const shares = bpjsFromRates(6_000_000, {
    health_employee_bp: 100,
    health_employer_bp: 400,
    jht_employee_bp: 200,
    jht_employer_bp: 370,
    jp_employee_bp: 100,
    jp_employer_bp: 200,
    jkk_bp: null,
    jkm_bp: 30,
  }, { kesehatan: true, tk: true, programs: 4 });
  assert.equal(shares.jkk_missing, true);
  assert.equal(shares.jkk, 0);
  assert.equal(shares.jkm > 0, true);
});

test("MONTHLY calculate: basic split, unpaid on basic, COMPANY tax", () => {
  const result = calculateEmployeePay({
    config: {
      pay_type: "MONTHLY",
      gross_fixed_salary: 10_000_000,
      basic_percentage: 60,
      working_days_per_month: 22,
      housing_allowance: 0,
      transport_allowance: 0,
      attendance_allowance_per_day: 0,
      bpjs_kesehatan_enabled: false,
      bpjs_tk_enabled: false,
      bpjs_base: "BASIC",
      tax_mode: "COMPANY",
      ptkp_code: "TK/0",
    },
    unpaid_leave_days: 1,
    days_present: 21,
    rates: null,
    ter_brackets: [{ ptkp_code: "TK/0", monthly_gross_min: 0, monthly_gross_max: 99_999_999_999, ter_rate_bp: 500 }],
    settings: {},
  });
  assert.equal(result.detail.basic, 6_000_000);
  assert.equal(result.detail.fixed_allowance, 4_000_000);
  assert.equal(result.detail.unpaid_deduction, Math.round(6_000_000 / 22));
  assert.equal(result.detail.employee_pph, 0);
  assert.equal(result.company_tax_cost > 0, true);
  assert.equal(result.warnings.length, 0);
});

test("DAILY calculate uses days present", () => {
  const result = calculateEmployeePay({
    config: {
      pay_type: "DAILY",
      daily_rate: 200_000,
      working_days_per_month: 22,
      housing_allowance: 0,
      transport_allowance: 0,
      attendance_allowance_per_day: 0,
      bpjs_kesehatan_enabled: false,
      bpjs_tk_enabled: false,
      bpjs_base: "BASIC",
      tax_mode: "EMPLOYEE",
      ptkp_code: "TK/0",
    },
    days_present: 10,
    bonus: 100_000,
    rates: null,
    ter_brackets: [],
    settings: {},
  });
  assert.equal(result.gross_earnings, 2_000_000 + 100_000);
});
