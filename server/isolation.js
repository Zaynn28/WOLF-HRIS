const requiredColumns = {
  employees: ["company_id"],
  payroll_periods: ["company_id"],
  payroll_records: ["company_id"],
  hris_payroll_grants: ["company_id", "wolf_user_id"],
};

let catalog = null;

export function companyIsolationReady(columnsByTable = catalog) {
  for (const [table, columns] of Object.entries(requiredColumns)) {
    const present = new Set(columnsByTable?.[table] ?? []);
    if (!columns.every((column) => present.has(column))) return false;
  }
  return true;
}

export function employeeReadReady(columnsByTable = catalog) {
  return new Set(columnsByTable?.employees ?? []).has("company_id");
}

/**
 * Employee directory reads need employees.company_id only.
 * Payroll grant columns are omitted so confirming this catalog does not open payroll routes.
 */
export function catalogForEmployeeRead(rows) {
  const confirmed = (rows ?? []).some((row) => row?.table_name === "employees" && row?.column_name === "company_id");
  return confirmed ? { employees: ["company_id"] } : null;
}

/** Opens payroll only when every company column used by payroll is present. */
export function catalogForCompanyIsolation(rows) {
  const present = {};
  for (const row of rows ?? []) {
    if (!row?.table_name || !row?.column_name) continue;
    if (!present[row.table_name]) present[row.table_name] = [];
    if (!present[row.table_name].includes(row.column_name)) present[row.table_name].push(row.column_name);
  }
  if (!companyIsolationReady(present)) return catalogForEmployeeRead(rows);
  return {
    employees: ["company_id"],
    payroll_periods: ["company_id"],
    payroll_records: ["company_id"],
    hris_payroll_grants: ["company_id", "wolf_user_id"],
  };
}

export function replaceCompanyIsolationCatalog(next) {
  const prior = catalog;
  catalog = next;
  return prior;
}

export const confirmedCompanyIsolation = {
  employees: ["company_id"],
  payroll_periods: ["company_id"],
  payroll_records: ["company_id"],
  hris_payroll_grants: ["company_id", "wolf_user_id"],
};
