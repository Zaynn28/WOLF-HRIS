import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { once } from "node:events";
import test from "node:test";
import app from "./index.js";
import { db } from "./database.js";
import { confirmedCompanyIsolation, replaceCompanyIsolationCatalog } from "./isolation.js";
import { payrollPeriodAcceptsProfileSalary, payrollPeriodInput, planProfileBasicSalaries, presentPayrollLine } from "./payroll-basic.js";

const secret = "local-test-assertion-secret-32chars";
const now = 1_700_000_000;
const periodId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const employeeId = "11111111-1111-4111-8111-111111111111";
const otherEmployeeId = "22222222-2222-4222-8222-222222222222";

function sign(claims = {}) {
  const payload = {
    iss: "wolf",
    aud: "hris",
    sub: "11111111-1111-4111-8111-111111111112",
    companyId: "amg",
    iat: now,
    exp: now + 120,
    jti: "0123456789abcdef",
    workspace: "hr",
    ...claims,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

test("profile basic salary is copied once, per company, and only when stored", () => {
  assert.equal(payrollPeriodAcceptsProfileSalary("DRAFT"), true);
  assert.equal(payrollPeriodAcceptsProfileSalary("FINALIZED"), false);
  assert.equal(payrollPeriodInput({ period_code: "2026-10", start_date: "2026-09-26", end_date: "2026-10-25", pay_date: "2026-11-05", company_id: "amg" }).ok, true);
  assert.equal(payrollPeriodInput({ period_code: "2026-13", start_date: "2026-09-26", end_date: "2026-10-25", pay_date: "2026-11-05" }).ok, false);

  const employees = [
    { id: employeeId, company_id: "amg", gaji_pokok: "42" },
    { id: otherEmployeeId, company_id: "amg", gaji_pokok: null },
    { id: "33333333-3333-4333-8333-333333333333", company_id: "bzg", gaji_pokok: "99" },
    { id: employeeId, company_id: "amg", gaji_pokok: "42" },
    { id: "44444444-4444-4444-8444-444444444444", company_id: "amg", gaji_pokok: "10.5" },
  ];
  const first = planProfileBasicSalaries("amg", employees, []);
  assert.deepEqual(first, [{ action: "insert", employeeId, basicSalary: 42 }]);
  const again = planProfileBasicSalaries("amg", employees, [
    { employee_id: employeeId, company_id: "amg", basic_salary: "42", basic_salary_from_profile: true },
  ]);
  assert.deepEqual(again, []);
  const updated = planProfileBasicSalaries("amg", [
    { id: employeeId, company_id: "amg", gaji_pokok: "50" },
  ], [
    { employee_id: employeeId, company_id: "amg", basic_salary: "42", basic_salary_from_profile: true },
  ]);
  assert.deepEqual(updated, [{ action: "update", employeeId, basicSalary: 50 }]);
  const manual = planProfileBasicSalaries("amg", [
    { id: employeeId, company_id: "amg", gaji_pokok: "50" },
  ], [
    { employee_id: employeeId, company_id: "amg", basic_salary: "7", basic_salary_from_profile: false },
  ]);
  assert.deepEqual(manual, []);
  const cleared = planProfileBasicSalaries("amg", [
    { id: employeeId, company_id: "amg", gaji_pokok: null },
  ], [
    { employee_id: employeeId, company_id: "amg", basic_salary: "42", basic_salary_from_profile: true },
  ]);
  assert.deepEqual(cleared, [{ action: "clear", employeeId }]);
  const otherCompany = planProfileBasicSalaries("bzg", employees, []);
  assert.deepEqual(otherCompany, [{ action: "insert", employeeId: "33333333-3333-4333-8333-333333333333", basicSalary: 99 }]);
  assert.equal(otherCompany.some((step) => step.employeeId === employeeId), false);

  const line = presentPayrollLine({
    id: "line-1",
    company_id: "amg",
    payroll_period_id: periodId,
    employee_id: employeeId,
    employee_code: "AMG-14",
    full_name: "Apriadi Idris",
    basic_salary: "42",
    gross_pay: "42.00",
    total_deductions: "0",
    net_pay: "42",
    gaji_pokok: "42",
    phone: "secret",
    status: "DRAFT",
  });
  assert.equal(line.basic_salary, 42);
  assert.equal(Number.isInteger(line.basic_salary), true);
  assert.equal(line.gross_pay, 42);
  assert.equal("gaji_pokok" in line, false);
  assert.equal("phone" in line, false);
  assert.equal(presentPayrollLine({ ...line, basic_salary: null, gross_pay: 0 }).basic_salary, null);
});

test("opening a payroll copies profile basic salary for that company and a self-service session cannot", async () => {
  const priorCatalog = replaceCompanyIsolationCatalog(confirmedCompanyIsolation);
  const previousSecret = process.env.WOLF_HR_ASSERTION_SECRET;
  const originalNow = Date.now;
  process.env.WOLF_HR_ASSERTION_SECRET = secret;
  Date.now = () => (now + 10) * 1000;
  const calls = [];
  const originals = {
    ensurePayrollPeriod: db.ensurePayrollPeriod,
    getPayrollPeriodById: db.getPayrollPeriodById,
    getPayrollPeriods: db.getPayrollPeriods,
    copyProfileBasicSalaries: db.copyProfileBasicSalaries,
    getPayrollRecords: db.getPayrollRecords,
    createAuditLog: db.createAuditLog,
  };
  const period = {
    id: periodId,
    company_id: "amg",
    period_code: "2026-10",
    start_date: "2026-09-26",
    end_date: "2026-10-25",
    pay_date: "2026-11-05",
    status: "DRAFT",
  };
  db.ensurePayrollPeriod = async (fields) => {
    calls.push(["ensure", fields.company_id, fields.period_code, fields.created_by]);
    return { created: calls.filter((call) => call[0] === "ensure").length === 1, period: { ...period, company_id: fields.company_id } };
  };
  db.getPayrollPeriodById = async (id, companyId) => (id === periodId && companyId === "amg" ? period : null);
  db.getPayrollPeriods = async (companyId) => {
    calls.push(["list", companyId]);
    return companyId === "amg" ? [period] : [];
  };
  db.copyProfileBasicSalaries = async (companyId, id) => {
    calls.push(["copy", companyId, id]);
    return { changed: 1 };
  };
  db.getPayrollRecords = async (id, companyId) => {
    calls.push(["records", companyId, id]);
    if (companyId !== "amg") return [];
    return [{
      id: "line-1",
      company_id: "amg",
      payroll_period_id: periodId,
      employee_id: employeeId,
      employee_code: "AMG-14",
      full_name: "Apriadi Idris",
      basic_salary: "42",
      gross_pay: "42",
      total_deductions: "0",
      net_pay: "42",
      status: "DRAFT",
    }];
  };
  db.createAuditLog = async (entry) => {
    calls.push(["audit", entry.company_id, entry.entity_type]);
    assert.equal(JSON.stringify(entry).includes("42"), false);
    return entry;
  };
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  try {
    const selfOpen = await fetch(`http://127.0.0.1:${port}/api/payroll-records/${periodId}`, {
      headers: { "x-wolf-hr-assertion": sign({ workspace: "self" }) },
    });
    assert.equal(selfOpen.status, 403);
    const selfCreate = await fetch(`http://127.0.0.1:${port}/api/payroll-periods`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-wolf-hr-assertion": sign({ workspace: "self" }) },
      body: JSON.stringify({ period_code: "2026-10", start_date: "2026-09-26", end_date: "2026-10-25", pay_date: "2026-11-05", company_id: "bzg" }),
    });
    assert.equal(selfCreate.status, 403);
    assert.equal(calls.some((call) => call[0] === "copy" || call[0] === "ensure"), false);

    const created = await fetch(`http://127.0.0.1:${port}/api/payroll-periods`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-wolf-hr-assertion": sign({ workspace: "hr" }) },
      body: JSON.stringify({ period_code: "2026-10", start_date: "2026-09-26", end_date: "2026-10-25", pay_date: "2026-11-05", company_id: "ggv" }),
    });
    assert.equal(created.status, 201);
    assert.deepEqual(calls.find((call) => call[0] === "ensure"), ["ensure", "amg", "2026-10", null]);
    assert.equal(calls.some((call) => call[1] === "bzg" || call[1] === "ggv"), false);

    const opened = await fetch(`http://127.0.0.1:${port}/api/payroll-records/${periodId}`, {
      headers: { "x-wolf-hr-assertion": sign({ workspace: "hr" }) },
    });
    assert.equal(opened.status, 200);
    const lines = await opened.json();
    assert.equal(lines.length, 1);
    assert.equal(lines[0].employee_code, "AMG-14");
    assert.equal(lines[0].basic_salary, 42);
    assert.equal(Number.isInteger(lines[0].basic_salary), true);
    assert.equal("gaji_pokok" in lines[0], false);

    const reopened = await fetch(`http://127.0.0.1:${port}/api/payroll-records/${periodId}`, {
      headers: { "x-wolf-hr-assertion": sign({ workspace: "hr" }) },
    });
    const reopenedLines = await reopened.json();
    assert.equal(reopenedLines.length, 1);
    assert.equal(reopenedLines.filter((line) => line.employee_code === "AMG-14").length, 1);

    const other = await fetch(`http://127.0.0.1:${port}/api/payroll-records/${periodId}`, {
      headers: { "x-wolf-hr-assertion": sign({ workspace: "hr", companyId: "bzg" }) },
    });
    assert.equal(other.status, 403);
    assert.equal(calls.filter((call) => call[0] === "copy").every((call) => call[1] === "amg"), true);
    assert.equal(calls.some((call) => call[0] === "copy" && call[1] !== "amg"), false);
  } finally {
    server.close();
    await once(server, "close");
    Object.assign(db, originals);
    replaceCompanyIsolationCatalog(priorCatalog);
    Date.now = originalNow;
    if (previousSecret === undefined) delete process.env.WOLF_HR_ASSERTION_SECRET;
    else process.env.WOLF_HR_ASSERTION_SECRET = previousSecret;
  }
});
