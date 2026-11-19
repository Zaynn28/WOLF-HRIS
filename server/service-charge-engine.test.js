import test from "node:test";
import assert from "node:assert/strict";
import {
  allocatePools,
  splitEqualPerPresentDay,
  applyFlatPph,
  defaultContractEligible,
} from "./service-charge-engine.js";

test("allocatePools leaves unallocated remainder and warns under 95%", () => {
  const result = allocatePools(10_000_000, [
    { pool_key: "employee_pool", label: "Employees", pct: 50 },
    { pool_key: "breakage", label: "Breakage", pct: 10 },
  ]);
  assert.equal(result.employee_pool_nominal, 5_000_000);
  assert.equal(result.under_95_warning, true);
  assert.equal(result.pools.some((p) => p.pool_key === "unallocated" && p.pct === 40), true);
});

test("splitEqualPerPresentDay is equal per day", () => {
  const split = splitEqualPerPresentDay(1_000_000, [
    { employee_id: "a", days_present: 10, eligible: true },
    { employee_id: "b", days_present: 10, eligible: true },
  ]);
  assert.equal(split.value_per_day, 50_000);
  assert.equal(split.items[0].gross, 500_000);
  assert.equal(split.items[1].gross, 500_000);
});

test("applyFlatPph uses TER bp on SC alone", () => {
  const taxed = applyFlatPph([{ employee_id: "a", gross: 1_000_000, net: 1_000_000 }], 500);
  assert.equal(taxed[0].pph21, 50_000);
  assert.equal(taxed[0].net, 950_000);
});

test("defaultContractEligible PKWTT PKWT only", () => {
  assert.equal(defaultContractEligible("PKWTT"), true);
  assert.equal(defaultContractEligible("PKWT"), true);
  assert.equal(defaultContractEligible("OUTSOURCE"), false);
});
