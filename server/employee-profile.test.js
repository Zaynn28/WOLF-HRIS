import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { once } from "node:events";
import test from "node:test";
import app from "./index.js";
import { db } from "./database.js";
import { confirmedCompanyIsolation, replaceCompanyIsolationCatalog } from "./isolation.js";
import { baseSalaryPatch, canReviewChange, changedFieldNames, presentEmployee, profilePatch, readProfilePhoto, readStoredBaseSalary } from "./employee-profile.js";

const secret = "local-test-assertion-secret-32chars";
const now = 1_700_000_000;
const employeeId = "11111111-1111-4111-8111-111111111111";
const tinyPng = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

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

function employee(companyId = "amg") {
  return {
    id: employeeId,
    company_id: companyId,
    employee_code: "AMG-14",
    full_name: "Apriadi Idris",
    preferred_name: null,
    phone: null,
    email: null,
    address: null,
    emergency_contact_name: null,
    emergency_contact_phone: null,
    department_id: null,
    position_id: null,
    employment_status: "ACTIVE",
    profile_photo_path: null,
    self_service_user_id: "22222222-2222-4222-8222-222222222222",
  };
}

test("profile edits keep the existing fields and drop payroll, identity, and tax keys", () => {
  const parsed = profilePatch({
    preferred_name: "Checked",
    full_name: "Apriadi Idris",
    nik: "secret",
    gender: "M",
    salary: 10,
    ptkp_code: "TK/0",
    photo: tinyPng,
  });
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.fields, { preferred_name: "Checked", full_name: "Apriadi Idris" });
  assert.deepEqual(changedFieldNames({ preferred_name: null, full_name: "Apriadi Idris" }, parsed.fields), ["preferred_name"]);
  assert.equal(readProfilePhoto(tinyPng).ok, true);
  assert.equal(readProfilePhoto("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7").ok, false);
  assert.equal(canReviewChange("self", "person-a", "person-b"), false);
  assert.equal(canReviewChange("hr", "person-a", "person-a"), false);
  assert.equal(canReviewChange("hr", "person-a", "person-b"), true);
  assert.deepEqual(baseSalaryPatch({ gaji_pokok: "" }), { ok: true, present: true, value: null });
  assert.equal(baseSalaryPatch({ gaji_pokok: 1.5 }).ok, false);
  assert.equal(baseSalaryPatch({ salary: 10 }).present, false);
  const listed = presentEmployee({ ...employee(), gaji_pokok: "42" });
  assert.equal("gaji_pokok" in listed, false);
  assert.equal(presentEmployee({ ...employee(), gaji_pokok: "42" }, { includeBaseSalary: true }).gaji_pokok, 42);
  assert.equal(presentEmployee({ ...employee(), gaji_pokok: null }, { includeBaseSalary: true }).gaji_pokok, null);
  assert.equal(readStoredBaseSalary("42.5"), null);
});

test("self-service cannot write the live row, and only HR can approve someone else's request", async () => {
  const priorCatalog = replaceCompanyIsolationCatalog(confirmedCompanyIsolation);
  const previousSecret = process.env.WOLF_HR_ASSERTION_SECRET;
  const originalNow = Date.now;
  process.env.WOLF_HR_ASSERTION_SECRET = secret;
  Date.now = () => (now + 10) * 1000;
  const calls = [];
  const originals = {
    getEmployeeById: db.getEmployeeById,
    getEmployeeBySelfUser: db.getEmployeeBySelfUser,
    applyProfileFields: db.applyProfileFields,
    getPendingChangeRequest: db.getPendingChangeRequest,
    insertChangeRequest: db.insertChangeRequest,
    getChangeRequest: db.getChangeRequest,
    reviewChangeRequest: db.reviewChangeRequest,
    createAuditLog: db.createAuditLog,
  };
  const row = employee();
  db.getEmployeeById = async (id, companyId) => (id === employeeId && companyId === "amg" ? row : null);
  db.getEmployeeBySelfUser = async (companyId, userId) => (
    companyId === "amg" && userId === row.self_service_user_id ? row : null
  );
  db.applyProfileFields = async (id, companyId, fields, _photo, _client, baseSalary) => {
    calls.push(["apply", companyId, fields, baseSalary === undefined ? "unchanged" : baseSalary === null ? "cleared" : "set"]);
    if (baseSalary !== undefined) row.gaji_pokok = baseSalary;
    return { ...row, ...fields, company_id: companyId };
  };
  db.getPendingChangeRequest = async () => null;
  db.insertChangeRequest = async (data) => {
    calls.push(["insert", data.company_id, data.proposed, Boolean(data.photo_path)]);
    return { ...data, status: "PENDING", created_at: "2026-10-26T00:00:00.000Z" };
  };
  db.getChangeRequest = async (id, companyId) => ({
    id,
    company_id: companyId,
    employee_id: employeeId,
    employee_code: "AMG-14",
    proposed: { preferred_name: "Requested" },
    photo_path: null,
    status: "PENDING",
    requested_by: row.self_service_user_id,
  });
  db.reviewChangeRequest = async (id, companyId, reviewerId, status, fields) => {
    calls.push(["review", status, reviewerId, fields]);
    if (status === "APPROVED") calls.push(["apply-on-approve", fields]);
    return {
      request: { id, company_id: companyId, status, proposed: fields, requested_by: row.self_service_user_id },
      employee: status === "APPROVED" ? { ...row, ...fields } : null,
    };
  };
  db.createAuditLog = async (entry) => {
    calls.push(["audit", entry.action, entry.new_value]);
    assert.equal(JSON.stringify(entry).includes("salary"), false);
    assert.equal(JSON.stringify(entry).includes("4321"), false);
    assert.equal(JSON.stringify(entry).includes("nik"), false);
    return entry;
  };
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  try {
    const denied = await fetch(`http://127.0.0.1:${port}/api/employees/${employeeId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-wolf-hr-assertion": sign({ workspace: "self", sub: row.self_service_user_id }) },
      body: JSON.stringify({ preferred_name: "Nope", nik: "1", salary: 9 }),
    });
    assert.equal(denied.status, 403);
    const saved = await fetch(`http://127.0.0.1:${port}/api/employees/${employeeId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-wolf-hr-assertion": sign({ workspace: "hr" }) },
      body: JSON.stringify({ preferred_name: "Checked", nik: "1", salary: 9, gender: "M" }),
    });
    assert.equal(saved.status, 200);
    const savedBody = await saved.json();
    assert.equal(savedBody.preferred_name, "Checked");
    assert.equal("profile_photo_path" in savedBody, false);
    assert.equal("self_service_user_id" in savedBody, false);
    const otherCompany = await fetch(`http://127.0.0.1:${port}/api/employees/${employeeId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-wolf-hr-assertion": sign({ workspace: "hr", companyId: "bzg" }) },
      body: JSON.stringify({ preferred_name: "Other" }),
    });
    assert.equal(otherCompany.status, 403);
    const hrRequest = await fetch(`http://127.0.0.1:${port}/api/profile-change-requests`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-wolf-hr-assertion": sign({ workspace: "hr" }) },
      body: JSON.stringify({ preferred_name: "From HR" }),
    });
    assert.equal(hrRequest.status, 403);
    const requested = await fetch(`http://127.0.0.1:${port}/api/profile-change-requests`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-wolf-hr-assertion": sign({ workspace: "self", sub: row.self_service_user_id }) },
      body: JSON.stringify({ preferred_name: "Requested", nik: "1", gaji_pokok: "77" }),
    });
    assert.equal(requested.status, 201);
    const requestedBody = await requested.json();
    assert.deepEqual(requestedBody.proposed, { preferred_name: "Requested" });
    assert.equal(JSON.stringify(requestedBody).includes("gaji_pokok"), false);
    assert.equal(calls.some((call) => call[0] === "apply" && call[1] === "bzg"), false);
    const selfApprove = await fetch(`http://127.0.0.1:${port}/api/profile-change-requests/${requestedBody.id}/approve`, {
      method: "POST",
      headers: { "x-wolf-hr-assertion": sign({ workspace: "self", sub: row.self_service_user_id }) },
    });
    assert.equal(selfApprove.status, 403);
    const ownApprove = await fetch(`http://127.0.0.1:${port}/api/profile-change-requests/${requestedBody.id}/approve`, {
      method: "POST",
      headers: { "x-wolf-hr-assertion": sign({ workspace: "hr", sub: row.self_service_user_id }) },
    });
    assert.equal(ownApprove.status, 403);
    const rejected = await fetch(`http://127.0.0.1:${port}/api/profile-change-requests/${requestedBody.id}/reject`, {
      method: "POST",
      headers: { "x-wolf-hr-assertion": sign({ workspace: "hr", sub: "33333333-3333-4333-8333-333333333333" }) },
    });
    assert.equal(rejected.status, 200);
    const rejectedBody = await rejected.json();
    assert.equal(rejectedBody.employee, null);
    assert.equal(calls.some((call) => call[0] === "apply-on-approve"), false);
    const applyCalls = calls.filter((call) => call[0] === "apply");
    assert.equal(applyCalls.length, 1);
    assert.deepEqual(applyCalls[0][2], { preferred_name: "Checked" });
    assert.equal(applyCalls[0][3], "unchanged");
    const salarySaved = await fetch(`http://127.0.0.1:${port}/api/employees/${employeeId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-wolf-hr-assertion": sign({ workspace: "hr" }) },
      body: JSON.stringify({ gaji_pokok: "4321" }),
    });
    assert.equal(salarySaved.status, 200);
    const salaryBody = await salarySaved.json();
    assert.equal(salaryBody.gaji_pokok, 4321);
    const salaryAudit = calls.filter((call) => call[0] === "audit").at(-1);
    assert.equal(JSON.stringify(salaryAudit).includes("4321"), false);
    assert.deepEqual(salaryAudit[2].fields, ["gaji_pokok"]);
    const cleared = await fetch(`http://127.0.0.1:${port}/api/employees/${employeeId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-wolf-hr-assertion": sign({ workspace: "hr" }) },
      body: JSON.stringify({ gaji_pokok: "" }),
    });
    assert.equal(cleared.status, 200);
    assert.equal((await cleared.json()).gaji_pokok, null);
    const floated = await fetch(`http://127.0.0.1:${port}/api/employees/${employeeId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-wolf-hr-assertion": sign({ workspace: "hr" }) },
      body: JSON.stringify({ gaji_pokok: 1.5 }),
    });
    assert.equal(floated.status, 400);
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
