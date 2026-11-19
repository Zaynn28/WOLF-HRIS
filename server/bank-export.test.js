import test from "node:test";
import assert from "node:assert/strict";
import { buildBankTransferFile, bankExportSupported } from "./bank-export.js";

test("supports Mandiri BNI BRI only", () => {
  assert.deepEqual(bankExportSupported(), ["mandiri", "bni", "bri"]);
  assert.equal(buildBankTransferFile("bca", []).ok, false);
});

test("Mandiri CSV includes amount and account", () => {
  const file = buildBankTransferFile("mandiri", [
    { account_number: "123", account_name: "Ada", amount: 1_500_000, employee_code: "E1" },
  ], { period: "2026-11" });
  assert.equal(file.ok, true);
  assert.match(file.content, /AccountNumber/);
  assert.match(file.content, /1500000/);
});
