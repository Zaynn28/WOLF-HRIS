import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { once } from "node:events";
import test from "node:test";
import app from "./index.js";
import { db } from "./database.js";
import { confirmedCompanyIsolation, replaceCompanyIsolationCatalog } from "./isolation.js";

const secret = "local-test-assertion-secret-32chars";
const now = 1_700_000_000;

function sign(claims = {}) {
  const payload = {
    iss: "wolf",
    aud: "hris",
    sub: "user-1",
    companyId: "amg",
    iat: now,
    exp: now + 120,
    jti: "0123456789abcdef",
    ...claims,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

async function withServer(run) {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const { port } = server.address();
    await run(port);
  } finally {
    server.close();
    await once(server, "close");
  }
}

test("employee, payroll, and audit routes reject a browser company before any query", async () => {
  await withServer(async (port) => {
    const headers = { "content-type": "application/json", "x-org-id": "amg", "x-company-id": "bzg" };
    const paths = [
      ["/api/employees", "GET"],
      ["/api/employees/emp-1", "GET"],
      ["/api/employees", "POST"],
      ["/api/employees/emp-1", "PATCH"],
      ["/api/self/profile", "GET"],
      ["/api/profile-change-requests", "POST"],
      ["/api/profile-change-requests/req-1/approve", "POST"],
      ["/api/departments", "GET"],
      ["/api/attendance/2026-10-23", "GET"],
      ["/api/leave-requests", "GET"],
      ["/api/leave-requests/leave-1/approve", "POST"],
      ["/api/payroll-periods", "GET"],
      ["/api/payroll-periods/period-1/approve", "POST"],
      ["/api/payroll-records/period-1", "GET"],
      ["/api/audit-logs", "GET"],
    ];
    for (const [path, method] of paths) {
      const response = await fetch(`http://127.0.0.1:${port}${path}`, {
        method,
        headers,
        body: method === "POST" ? JSON.stringify({ orgId: "AMG", companyId: "ggv" }) : undefined,
      });
      assert.equal(response.status, 401, path);
      const body = await response.json();
      assert.deepEqual(body, { error: "HR is not available for this session." });
    }
  });
});

test("invalid, expired, and unauthorized assertions are rejected before a query", async () => {
  const previousSecret = process.env.WOLF_HR_ASSERTION_SECRET;
  const originalNow = Date.now;
  process.env.WOLF_HR_ASSERTION_SECRET = secret;
  Date.now = () => (now + 10) * 1000;
  const queried = async () => {
    throw new Error("database query");
  };
  const originals = {
    getAllEmployees: db.getAllEmployees,
    getPayrollPeriodById: db.getPayrollPeriodById,
    hasPayrollGrant: db.hasPayrollGrant,
    approvePayrollPeriod: db.approvePayrollPeriod,
  };
  db.getAllEmployees = queried;
  db.getPayrollPeriodById = queried;
  db.hasPayrollGrant = queried;
  db.approvePayrollPeriod = queried;
  try {
    await withServer(async (port) => {
      const cases = [
        ["invalid signature", `${sign()}x`],
        ["expired assertion", sign({ iat: now - 121, exp: now - 1 })],
        ["unauthorized company", sign({ companyId: "local-books" })],
        ["missing secret", sign()],
      ];
      for (const [label, token] of cases) {
        if (label === "missing secret") delete process.env.WOLF_HR_ASSERTION_SECRET;
        const response = await fetch(`http://127.0.0.1:${port}/api/employees`, {
          headers: { "x-wolf-hr-assertion": token, "x-org-id": "bzg" },
        });
        assert.equal(response.status, 401, label);
        assert.deepEqual(await response.json(), { error: "HR is not available for this session." });
        process.env.WOLF_HR_ASSERTION_SECRET = secret;
      }
    });
  } finally {
    Date.now = originalNow;
    Object.assign(db, originals);
    if (previousSecret === undefined) delete process.env.WOLF_HR_ASSERTION_SECRET;
    else process.env.WOLF_HR_ASSERTION_SECRET = previousSecret;
  }
});

test("employee and payroll routes stay blocked until company isolation is confirmed", async () => {
  const priorCatalog = replaceCompanyIsolationCatalog(null);
  const previousSecret = process.env.WOLF_HR_ASSERTION_SECRET;
  const originalNow = Date.now;
  process.env.WOLF_HR_ASSERTION_SECRET = secret;
  Date.now = () => (now + 10) * 1000;
  let queried = false;
  const originals = {
    getAllEmployees: db.getAllEmployees,
    getPayrollPeriodById: db.getPayrollPeriodById,
    hasPayrollGrant: db.hasPayrollGrant,
    approvePayrollPeriod: db.approvePayrollPeriod,
  };
  const mark = async () => {
    queried = true;
    throw new Error("database query");
  };
  Object.assign(db, {
    getAllEmployees: mark,
    getPayrollPeriodById: mark,
    hasPayrollGrant: mark,
    approvePayrollPeriod: mark,
  });
  try {
    await withServer(async (port) => {
      const headers = { "content-type": "application/json", "x-wolf-hr-assertion": sign({ hrisGrants: ["payroll"], role: "owner" }) };
      const employees = await fetch(`http://127.0.0.1:${port}/api/employees`, { headers });
      const approval = await fetch(`http://127.0.0.1:${port}/api/payroll-periods/period-1/approve`, { method: "POST", headers, body: "{}" });
      assert.equal(employees.status, 403);
      assert.equal(approval.status, 403);
      assert.deepEqual(await employees.json(), { error: "HR records are not connected for this company." });
      assert.deepEqual(await approval.json(), { error: "HR records are not connected for this company." });
      assert.equal(queried, false);
    });
  } finally {
    Date.now = originalNow;
    replaceCompanyIsolationCatalog(priorCatalog);
    Object.assign(db, originals);
    if (previousSecret === undefined) delete process.env.WOLF_HR_ASSERTION_SECRET;
    else process.env.WOLF_HR_ASSERTION_SECRET = previousSecret;
  }
});

test("payroll approval without an HRIS grant is denied for the same company", async () => {
  const previousSecret = process.env.WOLF_HR_ASSERTION_SECRET;
  const originalNow = Date.now;
  const priorCatalog = replaceCompanyIsolationCatalog(confirmedCompanyIsolation);
  process.env.WOLF_HR_ASSERTION_SECRET = secret;
  Date.now = () => (now + 10) * 1000;
  let approved = false;
  const originals = {
    getPayrollPeriodById: db.getPayrollPeriodById,
    hasPayrollGrant: db.hasPayrollGrant,
    approvePayrollPeriod: db.approvePayrollPeriod,
  };
  db.getPayrollPeriodById = async () => ({ id: "period-1", company_id: "amg" });
  db.hasPayrollGrant = async () => false;
  db.approvePayrollPeriod = async () => {
    approved = true;
    return { id: "period-1", status: "APPROVED" };
  };
  try {
    await withServer(async (port) => {
      const response = await fetch(`http://127.0.0.1:${port}/api/payroll-periods/period-1/approve`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-wolf-hr-assertion": sign({ hrisGrants: ["payroll"], role: "owner" }),
          "x-org-id": "bzg",
        },
        body: JSON.stringify({ companyId: "ggv" }),
      });
      assert.equal(response.status, 403);
      assert.deepEqual(await response.json(), { error: "HR is not available for this session." });
      assert.equal(approved, false);
    });
  } finally {
    Date.now = originalNow;
    replaceCompanyIsolationCatalog(priorCatalog);
    Object.assign(db, originals);
    if (previousSecret === undefined) delete process.env.WOLF_HR_ASSERTION_SECRET;
    else process.env.WOLF_HR_ASSERTION_SECRET = previousSecret;
  }
});
