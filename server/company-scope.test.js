import assert from "node:assert/strict";
import test from "node:test";
import { companyForWrite, hrCompanyGate, listForCompany, nestedAccess, payrollApprovalAccess, recordAccess } from "./company-scope.js";

const same = { error: "HR is not available for this session." };

function verified(companyId, grants = []) {
  return { source: "verified-assertion", companyId, hrisGrants: grants, wolfRole: "owner" };
}

const amgEmployee = { id: "emp-amg", company_id: "amg" };
const bzgEmployee = { id: "emp-bzg", company_id: "bzg" };
const ggvEmployee = { id: "emp-ggv", company_id: "ggv" };
const unknownEmployee = { id: "emp-old", company_id: null };

test("missing, empty, and unknown identity do not open a company", () => {
  assert.equal(hrCompanyGate(null).status, 401);
  assert.equal(hrCompanyGate({ source: "verified-assertion", companyId: "" }).status, 401);
  assert.equal(hrCompanyGate({ source: "browser", companyId: "amg" }).status, 401);
  assert.equal(hrCompanyGate({ source: "verified-assertion" }).status, 401);
  assert.deepEqual(hrCompanyGate(null).body, same);
});

test("a verified company cannot read or list another company's employees", () => {
  for (const [actor, foreign] of [
    ["bzg", amgEmployee],
    ["amg", bzgEmployee],
    ["ggv", amgEmployee],
    ["amg", ggvEmployee],
    ["bzg", ggvEmployee],
    ["ggv", bzgEmployee],
  ]) {
    const access = recordAccess(verified(actor), foreign);
    assert.equal(access.status, 403);
    assert.deepEqual(access.body, same);
  }
  const listed = listForCompany(verified("bzg"), [amgEmployee, bzgEmployee, unknownEmployee, ggvEmployee]);
  assert.deepEqual(listed.rows.map((row) => row.id), ["emp-bzg"]);
});

test("a missing row and an unassigned row look the same", () => {
  const missing = recordAccess(verified("amg"), undefined);
  const unassigned = recordAccess(verified("amg"), unknownEmployee);
  assert.equal(missing.status, 403);
  assert.deepEqual(missing.body, unassigned.body);
  assert.equal("id" in missing.body, false);
});

test("a posted org id cannot move a write into another company", () => {
  const written = companyForWrite(verified("bzg"), { full_name: "Ada", orgId: "AMG", companyId: "ggv", company_id: "amg", role: "owner" });
  assert.equal(written.status, 200);
  assert.equal(written.fields.company_id, "bzg");
  assert.equal(written.fields.full_name, "Ada");
  assert.equal("orgId" in written.fields, false);
  assert.equal("role" in written.fields, false);
});

test("nested attendance and leave stay with the parent company", () => {
  const own = nestedAccess(verified("amg"), amgEmployee, { id: "att-1", employee_id: "emp-amg", company_id: "amg" });
  assert.equal(own.status, 200);
  const otherCompanyChild = nestedAccess(verified("amg"), amgEmployee, { id: "att-2", employee_id: "emp-amg", company_id: "bzg" });
  const unknownChild = nestedAccess(verified("amg"), amgEmployee, { id: "att-3", employee_id: "emp-amg", company_id: null });
  const otherParent = nestedAccess(verified("bzg"), amgEmployee, { id: "leave-1", employee_id: "emp-amg", company_id: "amg" });
  assert.equal(otherCompanyChild.status, 403);
  assert.equal(unknownChild.status, 403);
  assert.equal(otherParent.status, 403);
  assert.deepEqual(otherCompanyChild.body, unknownChild.body);
});

test("payroll approval needs an HRIS payroll grant and the same company", () => {
  const period = { id: "period-amg", company_id: "amg" };
  const owner = payrollApprovalAccess(verified("amg"), period);
  const granted = payrollApprovalAccess(verified("amg", ["payroll"]), period);
  const otherCompany = payrollApprovalAccess(verified("bzg", ["payroll"]), period);
  assert.equal(owner.status, 403);
  assert.equal(granted.status, 200);
  assert.equal(otherCompany.status, 403);
});
