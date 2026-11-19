import assert from "node:assert/strict";
import test from "node:test";
import { applyOnboarding, applySignedHire, planOnboarding, planSignedHire } from "../src/lib/hiring.js";

const hire = {
  action: "sign",
  fullName: "Ayu Putri",
  email: "Ayu@Example.Test",
  phone: "0812",
  departmentId: "dept-1",
  positionId: "pos-1",
  startDate: "2026-11-13",
  employeeCode: "AMG2611130001",
  sameCompanyCount: 0,
};

test("a signed hire inserts one employee and does not create a login", async () => {
  const users = [];
  const employees = [];
  const result = await applySignedHire({
    createEmployee: async (fields) => {
      employees.push(fields);
      return { id: "emp-1", ...fields };
    },
  }, hire);
  assert.equal(result.action, "created");
  assert.equal(employees.length, 1);
  assert.equal(employees[0].email, "ayu@example.test");
  assert.equal(employees[0].employment_status, "PROBATION");
  assert.equal(employees[0].full_name, "Ayu Putri");
  assert.equal("nik" in employees[0], false);
  assert.equal("self_service_user_id" in employees[0], false);
  assert.equal(users.length, 0);
});

test("the same email in that company refuses and inserts nothing", async () => {
  let created = 0;
  const result = await applySignedHire({
    createEmployee: async () => {
      created += 1;
      return { id: "emp-2" };
    },
  }, { ...hire, sameCompanyCount: 1 });
  assert.equal(result.action, "refuse");
  assert.equal(result.status, 409);
  assert.equal(created, 0);
});

test("a rejected applicant inserts nothing", async () => {
  let created = 0;
  const result = await applySignedHire({
    createEmployee: async () => {
      created += 1;
      return { id: "emp-3" };
    },
  }, { action: "reject", email: hire.email, fullName: hire.fullName });
  assert.equal(result.action, "none");
  assert.equal(created, 0);
  assert.equal(planSignedHire({ action: "reject" }).action, "none");
});

test("onboarding activates the same employee and does not create another", async () => {
  const created = [];
  const activated = [];
  const store = {
    createEmployee: async (fields) => {
      created.push(fields);
      return { id: "emp-1", ...fields };
    },
    activateEmployee: async (id, status) => {
      activated.push({ id, status });
      return { id, employment_status: status };
    },
  };
  const signed = await applySignedHire(store, hire);
  const early = await applyOnboarding(store, { employeeId: signed.employee.id, ready: false });
  assert.equal(early.action, "refuse");
  const done = await applyOnboarding(store, { employeeId: signed.employee.id, ready: true });
  assert.equal(done.action, "activated");
  assert.equal(done.employee.id, "emp-1");
  assert.equal(done.employee.employment_status, "ACTIVE");
  assert.equal(created.length, 1);
  assert.deepEqual(activated, [{ id: "emp-1", status: "ACTIVE" }]);
  assert.equal(planOnboarding({ ready: true }).action, "refuse");
});
