import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { once } from "node:events";
import test from "node:test";
import app from "./index.js";
import { db } from "./database.js";
import { replaceCompanyIsolationCatalog } from "./isolation.js";
import { projectStaffTask } from "./staff-tasks.js";

const secret = "local-test-assertion-secret-32chars";
const now = 1_700_000_000;
const employeeId = "11111111-1111-1111-1111-111111111111";
const taskId = "22222222-2222-2222-2222-222222222222";

function sign(companyId) {
  const payload = {
    iss: "wolf",
    aud: "hris",
    sub: "user-1",
    companyId,
    iat: now,
    exp: now + 120,
    jti: "0123456789abcdef",
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

test("staff task projection omits payroll and contact fields", () => {
  const projected = projectStaffTask({
    id: taskId,
    company_id: "amg",
    employee_id: employeeId,
    employee_code: "AMG-14",
    title: "AMG staff task link",
    detail: "",
    due_date: "2026-12-01",
    status: "ASSIGNED",
    assigner_name: "Organization",
    external_id: "hr:amg:abc123",
    created_at: "2026-10-26T00:00:00.000Z",
    updated_at: "2026-10-26T00:00:00.000Z",
    email: "person@example.test",
    nik: "1",
    salary: 9,
  }, "amg");
  assert.equal(projected.employee_code, "AMG-14");
  assert.equal(JSON.stringify(projected).includes("salary"), false);
  assert.equal(JSON.stringify(projected).includes("person@"), false);
  assert.equal(projectStaffTask({ ...projected, company_id: "bzg" }, "amg"), null);
});

test("staff task writes stay in the asserted company and update the same external id", async () => {
  const previousSecret = process.env.WOLF_HR_ASSERTION_SECRET;
  const originalNow = Date.now;
  const priorCatalog = replaceCompanyIsolationCatalog({ employees: ["company_id"] });
  process.env.WOLF_HR_ASSERTION_SECRET = secret;
  Date.now = () => (now + 10) * 1000;
  const store = [];
  const originals = {
    listStaffTasks: db.listStaffTasks,
    getEmployeeByCode: db.getEmployeeByCode,
    getEmployeeById: db.getEmployeeById,
    getStaffTaskByExternal: db.getStaffTaskByExternal,
    getStaffTaskById: db.getStaffTaskById,
    upsertStaffTask: db.upsertStaffTask,
    updateStaffTask: db.updateStaffTask,
    deleteStaffTaskByExternal: db.deleteStaffTaskByExternal,
    createAuditLog: db.createAuditLog,
  };
  db.getEmployeeByCode = async (companyId, code) => (
    companyId === "amg" && code === "AMG-14"
      ? { id: employeeId, company_id: "amg", employee_code: "AMG-14", email: "person@example.test", salary: 9 }
      : null
  );
  db.getEmployeeById = async (id, companyId) => (
    companyId === "amg" && id === employeeId
      ? { id: employeeId, company_id: "amg", employee_code: "AMG-14", nik: "1", email: "person@example.test" }
      : null
  );
  db.getStaffTaskByExternal = async (companyId, externalId) => store.find((row) => row.company_id === companyId && row.external_id === externalId) ?? null;
  db.getStaffTaskById = async (id, companyId) => store.find((row) => row.id === id && row.company_id === companyId) ?? null;
  db.listStaffTasks = async (companyId) => store.filter((row) => row.company_id === companyId);
  db.upsertStaffTask = async (companyId, data) => {
    assert.equal(companyId, "amg");
    const current = store.find((row) => row.company_id === companyId && row.external_id === data.external_id);
    const row = {
      id: current?.id ?? taskId,
      company_id: companyId,
      employee_id: data.employee_id,
      employee_code: data.employee_code,
      title: data.title,
      detail: data.detail ?? current?.detail ?? "",
      due_date: data.due_date,
      status: data.status,
      assigner_name: data.assigner_name,
      external_id: data.external_id,
      created_at: current?.created_at ?? data.updated_at,
      updated_at: data.updated_at,
    };
    if (current) Object.assign(current, row);
    else store.push(row);
    return row;
  };
  db.updateStaffTask = async (id, companyId, data) => {
    const current = store.find((row) => row.id === id && row.company_id === companyId);
    if (!current) return null;
    current.title = data.title;
    current.status = data.status;
    current.due_date = data.due_date;
    current.updated_at = "2026-10-26T07:00:00.000Z";
    return current;
  };
  db.deleteStaffTaskByExternal = async () => null;
  db.createAuditLog = async (entry) => {
    assert.equal(entry.entity_type, "StaffTask");
    assert.equal(JSON.stringify(entry).includes("person@"), false);
    assert.equal(JSON.stringify(entry).includes("salary"), false);
    return {};
  };
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const { port } = server.address();
    const headers = {
      "content-type": "application/json",
      "x-wolf-hr-assertion": sign("amg"),
      "x-org-id": "bzg",
    };
    const created = await fetch(`http://127.0.0.1:${port}/api/staff-tasks`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        company_id: "bzg",
        external_id: "org:demo-task-team",
        employee_code: "AMG-14",
        title: "Reset the demo lobby",
        due_date: "2026-11-01",
        status: "ASSIGNED",
        updated_at: "2026-10-26T03:00:00.000Z",
        email: "person@example.test",
        salary: 9,
      }),
    });
    const createdBody = await created.json();
    assert.equal(created.status, 201);
    assert.equal(createdBody.company_id, "amg");
    assert.equal(createdBody.external_id, "org:demo-task-team");
    assert.equal(JSON.stringify(createdBody).includes("salary"), false);
    assert.equal(JSON.stringify(createdBody).includes("person@"), false);
    const updated = await fetch(`http://127.0.0.1:${port}/api/staff-tasks`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        external_id: "org:demo-task-team",
        employee_code: "AMG-14",
        title: "Reset the demo lobby synced",
        due_date: "2026-11-01",
        status: "IN_PROGRESS",
        updated_at: "2026-10-26T05:00:00.000Z",
      }),
    });
    assert.equal(updated.status, 200);
    assert.equal(store.length, 1);
    assert.equal(store[0].title, "Reset the demo lobby synced");
    assert.equal(store[0].status, "IN_PROGRESS");
    const otherCompany = await fetch(`http://127.0.0.1:${port}/api/staff-tasks`, {
      headers: { "x-wolf-hr-assertion": sign("bzg") },
    });
    assert.deepEqual(await otherCompany.json(), []);
    const listed = await fetch(`http://127.0.0.1:${port}/api/staff-tasks`, { headers });
    const listedBody = await listed.json();
    assert.equal(listedBody.length, 1);
    assert.equal(listedBody[0].employee_code, "AMG-14");
    const denied = await fetch(`http://127.0.0.1:${port}/api/staff-tasks`, {
      method: "PUT",
      headers: { "content-type": "application/json", "x-wolf-hr-assertion": sign("bzg") },
      body: JSON.stringify({
        external_id: "org:demo-task-team",
        employee_code: "AMG-14",
        title: "Reset the demo lobby",
        due_date: "2026-11-01",
        status: "ASSIGNED",
        updated_at: "2026-10-26T08:00:00.000Z",
      }),
    });
    assert.equal(denied.status, 403);
    assert.equal(store.length, 1);
    assert.equal(store[0].company_id, "amg");
  } finally {
    server.close();
    await once(server, "close");
    Date.now = originalNow;
    replaceCompanyIsolationCatalog(priorCatalog);
    Object.assign(db, originals);
    if (previousSecret === undefined) delete process.env.WOLF_HR_ASSERTION_SECRET;
    else process.env.WOLF_HR_ASSERTION_SECRET = previousSecret;
  }
});
