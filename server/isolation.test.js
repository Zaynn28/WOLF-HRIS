import assert from "node:assert/strict";
import test from "node:test";
import { catalogForCompanyIsolation, catalogForEmployeeRead, companyIsolationReady, confirmedCompanyIsolation, employeeReadReady, replaceCompanyIsolationCatalog } from "./isolation.js";

test("employee and payroll isolation stays closed until every company column is present", () => {
  assert.equal(companyIsolationReady(null), false);
  assert.equal(companyIsolationReady({}), false);
  assert.equal(companyIsolationReady({ employees: ["company_id"], payroll_periods: ["company_id"], payroll_records: ["company_id"] }), false);
  assert.equal(companyIsolationReady(confirmedCompanyIsolation), true);
  const prior = replaceCompanyIsolationCatalog(confirmedCompanyIsolation);
  try {
    assert.equal(companyIsolationReady(), true);
  } finally {
    replaceCompanyIsolationCatalog(prior);
  }
  assert.equal(companyIsolationReady(), false);
});

test("employee read can be confirmed without opening payroll isolation", () => {
  assert.equal(employeeReadReady(null), false);
  assert.equal(employeeReadReady({}), false);
  const catalog = catalogForEmployeeRead([
    { table_name: "employees", column_name: "company_id" },
    { table_name: "hris_payroll_grants", column_name: "company_id" },
    { table_name: "hris_payroll_grants", column_name: "wolf_user_id" },
    { table_name: "payroll_periods", column_name: "company_id" },
    { table_name: "payroll_records", column_name: "company_id" },
  ]);
  assert.deepEqual(catalog, { employees: ["company_id"] });
  assert.equal(employeeReadReady(catalog), true);
  assert.equal(companyIsolationReady(catalog), false);
  assert.equal(catalogForEmployeeRead([]), null);
  const partial = [
    { table_name: "employees", column_name: "company_id" },
    { table_name: "payroll_periods", column_name: "company_id" },
    { table_name: "payroll_records", column_name: "company_id" },
  ];
  assert.equal(companyIsolationReady(catalogForCompanyIsolation(partial)), false);
  assert.deepEqual(catalogForCompanyIsolation(partial), { employees: ["company_id"] });
  const readyRows = [
    ...partial,
    { table_name: "hris_payroll_grants", column_name: "company_id" },
    { table_name: "hris_payroll_grants", column_name: "wolf_user_id" },
  ];
  assert.equal(companyIsolationReady(catalogForCompanyIsolation(readyRows)), true);
  assert.equal(catalogForCompanyIsolation([]), null);
});
