import assert from "node:assert/strict";
import test from "node:test";
import { applyEligibility, eligibilityInput, presentEligibility } from "./employee-pay-components.js";

const structure = {
  components: [
    { code: "basic", displayName: "Basic Salary", kind: "earning", sortOrder: 20, active: true },
    { code: "transport", displayName: "Tunjangan Transport", kind: "earning", sortOrder: 30, active: true },
    { code: "komunikasi", displayName: "Tunjangan Komunikasi", kind: "earning", sortOrder: 40, active: true },
    { code: "overtime", displayName: "Overtime", kind: "earning", sortOrder: 90, active: true },
    { code: "kasbon", displayName: "Kasbon", kind: "deduction", sortOrder: 110, active: true },
  ],
};

function assignment(transportEligible, transportAmount, komunikasiEligible, overtimeEligible) {
  return {
    components: [
      { code: "transport", eligible: transportEligible, amount: transportAmount },
      { code: "komunikasi", eligible: komunikasiEligible, amount: komunikasiEligible ? 150000 : null },
      { code: "overtime", eligible: overtimeEligible, amount: null },
      { code: "kasbon", eligible: false, amount: null },
    ],
  };
}

test("a standing allowance is stored only for an eligible employee", () => {
  const parsed = eligibilityInput(assignment(true, 350000, false, true), structure);
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.components.find((row) => row.code === "transport"), {
    code: "transport",
    eligible: true,
    amount: 350000,
    setsAmount: true,
  });
  assert.equal(parsed.components.find((row) => row.code === "komunikasi").amount, null);
  assert.equal(parsed.components.find((row) => row.code === "overtime").setsAmount, false);
});

test("an ineligible allowance cannot keep an amount", () => {
  const parsed = eligibilityInput(assignment(false, 350000, false, false), structure);
  assert.equal(parsed.ok, false);
});

test("payroll uses only the allowances that employee is eligible for", () => {
  const amounts = applyEligibility({ transport: 0, komunikasi: 0, overtime: 0 }, [
    { component_code: "transport", eligible: true, amount: 350000 },
    { component_code: "komunikasi", eligible: false, amount: null },
    { component_code: "overtime", eligible: false, amount: null },
  ], structure);
  assert.equal(amounts.transport, 350000);
  assert.equal(amounts.komunikasi, 0);
  const view = presentEligibility("employee-1", structure, [
    { component_code: "transport", eligible: false, amount: null, effective_from: "2026-10-01" },
    { component_code: "transport", eligible: true, amount: "350000", effective_from: "2026-11-01" },
  ], "2026-11-03");
  assert.equal(view.components.find((row) => row.code === "transport").amount, 350000);
  assert.equal(view.components.some((row) => row.code === "basic"), false);
});
