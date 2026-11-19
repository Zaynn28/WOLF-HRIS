import assert from "node:assert/strict";
import test from "node:test";
import { prepareModuleRows } from "./module-import.js";

test("asset rows upsert on code and a second copy does not add another key", () => {
  const first = prepareModuleRows("assets", [
    { code: "BULK-A1", name: "Locker A", category: "OTHER" },
    { code: "BULK-A2", name: "Locker B", category: "KEYS" },
  ]);
  const second = prepareModuleRows("assets", [
    { code: "BULK-A1", name: "Locker A updated", category: "OTHER" },
    { code: "BULK-A2", name: "Locker B", category: "KEYS" },
  ]);
  assert.equal(first.ready.length, 2);
  assert.deepEqual(first.ready.map(row => row.key), ["BULK-A1", "BULK-A2"]);
  assert.equal(second.ready.length, 2);
  assert.equal(second.ready[0].fields.name, "Locker A updated");
});

test("duplicate keys in one file keep the later row", () => {
  const prepared = prepareModuleRows("assets", [
    { code: "BULK-A1", name: "First", category: "OTHER" },
    { code: "BULK-A1", name: "Second", category: "OTHER" },
  ]);
  assert.equal(prepared.ready.length, 1);
  assert.equal(prepared.ready[0].fields.name, "Second");
  assert.equal(prepared.skipped, 1);
});

test("employee import accepts optional gaji pokok and leaves a missing column untouched", () => {
  const missing = prepareModuleRows("employees", [
    { employee_code: "AMG-BULK-1", full_name: "Fixture", join_date: "2026-01-02" },
  ]);
  assert.equal(Object.prototype.hasOwnProperty.call(missing.ready[0].fields, "gaji_pokok"), false);
  const blank = prepareModuleRows("employees", [
    { employee_code: "AMG-BULK-1", full_name: "Fixture", join_date: "2026-01-02", gaji_pokok: "" },
  ]);
  assert.equal(Object.prototype.hasOwnProperty.call(blank.ready[0].fields, "gaji_pokok"), false);
  const whole = prepareModuleRows("employees", [
    { employee_code: "AMG-BULK-1", full_name: "Fixture", join_date: "2026-01-02", gaji_pokok: "1000" },
  ]);
  assert.equal(whole.ready[0].fields.gaji_pokok, 1000);
  const fraction = prepareModuleRows("employees", [
    { employee_code: "AMG-BULK-1", full_name: "Fixture", join_date: "2026-01-02", gaji_pokok: "10.5" },
  ]);
  assert.equal(fraction.ready.length, 0);
  assert.equal(fraction.skips[0].reason.includes("10.5"), false);
});

test("employee import does not invent a code and skips a row without one", () => {
  const prepared = prepareModuleRows("employees", [
    { full_name: "No Code", join_date: "2026-01-01" },
    { employee_code: "AMG-BULK-1", full_name: "Fixture", join_date: "2026-01-02" },
  ]);
  assert.equal(prepared.ready.length, 1);
  assert.equal(prepared.ready[0].key, "AMG-BULK-1");
  assert.equal(prepared.skips[0].reason, "employee_code is required");
});

test("organization task ids are reserved", () => {
  const prepared = prepareModuleRows("tasks", [
    { employee_code: "AMG-01", title: "Synced", due_date: "2026-10-26", external_id: "org:task-1" },
  ]);
  assert.equal(prepared.ready.length, 0);
  assert.equal(prepared.skips[0].reason, "organization task ids are reserved");
});

test("task import key is stable when the file is uploaded again", () => {
  const row = { employee_code: "AMG-01", title: "Count stock", due_date: "2026-10-26" };
  const first = prepareModuleRows("tasks", [row]);
  const second = prepareModuleRows("tasks", [row]);
  assert.equal(first.ready[0].key, second.ready[0].key);
  assert.equal(first.ready[0].key.startsWith("import:"), true);
  assert.equal(first.ready[0].key.startsWith("org:"), false);
});

test("payroll import keeps file amounts and does not calculate gross", () => {
  const prepared = prepareModuleRows("payroll", [{
    period_code: "2026-10",
    employee_code: "AMG-01",
    start_date: "2026-09-26",
    end_date: "2026-10-25",
    pay_date: "2026-10-28",
    basic_salary: "100",
    allowance: "0",
    overtime: "0",
    service_charge: "0",
    gross_pay: "90",
    total_deductions: "10",
    net_pay: "80",
  }]);
  assert.equal(prepared.ready[0].fields.gross_pay, 90);
  assert.equal(prepared.ready[0].fields.net_pay, 80);
});

test("unbalanced payroll journal rows are skipped", () => {
  const prepared = prepareModuleRows("payroll-finance", [{
    reference: "JRN-1",
    period_code: "2026-10",
    destination: "Ledger",
    total_debit: "10",
    total_credit: "11",
  }]);
  assert.equal(prepared.ready.length, 0);
  assert.equal(prepared.skips[0].reason, "debit and credit must match");
});

test("profile pictures are not part of document import", () => {
  const prepared = prepareModuleRows("documents", [{
    employee_code: "AMG-01",
    document_type: "Profile photo",
    file_name: "face.png",
  }]);
  assert.equal(prepared.ready.length, 0);
  assert.equal(prepared.skips[0].reason, "profile pictures are not imported");
});

test("unknown module is refused", () => {
  const prepared = prepareModuleRows("reports", []);
  assert.equal(prepared.error, "That import is not available.");
});
