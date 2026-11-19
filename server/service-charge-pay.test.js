import assert from "node:assert/strict";
import test from "node:test";
import { serviceChargePayDate } from "../src/lib/serviceChargePay.js";

test("service charge is paid mid-month and not on the salary pay date", () => {
  assert.equal(serviceChargePayDate("2026-11-05", 15), "2026-11-15");
  assert.notEqual(serviceChargePayDate("2026-11-05", 15), "2026-11-05");
  assert.equal(serviceChargePayDate("2026-11-05"), "2026-11-15");
  assert.equal(serviceChargePayDate(""), "");
});
