import assert from "node:assert/strict";
import test from "node:test";
import {
  payrollSettingsChanged,
  payrollSettingsPatch,
  presentPayrollSettings,
  readPayrollSettings,
} from "./employee-payroll-settings.js";

test("payroll settings accept BPJS enrollment, company cover, and Netto", () => {
  const parsed = payrollSettingsPatch({
    bpjs_enrolled: true,
    company_covers_employee_bpjs: true,
    tax_configuration: "netto",
  });
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.settings, {
    bpjs_enrolled: true,
    company_covers_employee_bpjs: true,
    tax_configuration: "netto",
  });
});

test("unenrolled and uncovered people store false switches", () => {
  const parsed = payrollSettingsPatch({
    bpjs_enrolled: false,
    company_covers_employee_bpjs: false,
    tax_configuration: "gross",
  });
  assert.equal(parsed.ok, true);
  assert.equal(parsed.settings.bpjs_enrolled, false);
  assert.equal(parsed.settings.company_covers_employee_bpjs, false);
  assert.equal(parsed.settings.tax_configuration, "gross");
});

test("payroll settings refuse unknown tax configuration and non-booleans", () => {
  assert.equal(payrollSettingsPatch({
    bpjs_enrolled: true,
    company_covers_employee_bpjs: true,
    tax_configuration: "gross-up",
  }).ok, false);
  assert.equal(payrollSettingsPatch({
    bpjs_enrolled: "yes",
    company_covers_employee_bpjs: false,
    tax_configuration: "netto",
  }).ok, false);
});

test("missing columns default to enrolled, not company-covered, Netto", () => {
  assert.deepEqual(readPayrollSettings({}), {
    bpjs_enrolled: true,
    company_covers_employee_bpjs: false,
    tax_configuration: "netto",
  });
  const view = presentPayrollSettings("11111111-1111-4111-8111-111111111199", {
    bpjs_enrolled: false,
    company_covers_employee_bpjs: true,
    tax_configuration: "netto",
  });
  assert.equal(view.employee_id, "11111111-1111-4111-8111-111111111199");
  assert.equal(view.bpjs_enrolled, false);
  assert.equal(view.company_covers_employee_bpjs, true);
  assert.equal(payrollSettingsChanged(
    { bpjs_enrolled: true, company_covers_employee_bpjs: false, tax_configuration: "netto" },
    { bpjs_enrolled: true, company_covers_employee_bpjs: true, tax_configuration: "netto" },
  ), true);
});
