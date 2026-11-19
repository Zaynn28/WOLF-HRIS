/**
 * Replace BZG HRIS employees with the active-hire roster.
 * Refuses every database other than atrium_hris on 127.0.0.1:5432.
 * Does not print names, emails, NIK, or account numbers.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const host = process.env.DB_HOST;
const port = Number(process.env.DB_PORT);
const database = process.env.DB_NAME;
const user = process.env.DB_USER;
const rosterPath = process.env.BZG_HRIS_ROSTER || resolve("/Users/nozerre/Projects/wolf-command-v3-clean/.local/bzg-hris-hires.json");

const localOk = host === "127.0.0.1" && port === 5432 && database === "atrium_hris" && process.env.WOLF_ALLOW_BZG_HRIS_IMPORT === "1";
const productionProxyOk =
  host === "127.0.0.1"
  && port === 5434
  && database === "atrium_hris"
  && process.env.WOLF_ALLOW_PRODUCTION_BZG_HRIS_IMPORT === "1";
if (!localOk && !productionProxyOk) {
  console.error("refusing database target");
  process.exit(1);
}

const roster = JSON.parse(readFileSync(rosterPath, "utf8"));
if (roster.companyId !== "bzg" || !Array.isArray(roster.people) || roster.people.length < 1) {
  console.error("invalid roster");
  process.exit(1);
}

const codes = new Set();
const niks = new Set();
const emails = new Set();
for (const person of roster.people) {
  if (!/^BZG-\d{2}$/.test(person.employeeCode || "")) {
    console.error("invalid employee code");
    process.exit(1);
  }
  if (codes.has(person.employeeCode)) {
    console.error("duplicate employee code");
    process.exit(1);
  }
  codes.add(person.employeeCode);
  if (!person.fullName || String(person.fullName).trim().length < 1) {
    console.error("missing full name");
    process.exit(1);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(person.joinDate || "")) {
    console.error("missing join date");
    process.exit(1);
  }
  if (person.gender != null && person.gender !== "M" && person.gender !== "F") {
    console.error("invalid gender");
    process.exit(1);
  }
  if (person.nik) {
    if (niks.has(person.nik)) {
      console.error("duplicate nik");
      process.exit(1);
    }
    niks.add(person.nik);
  }
  if (person.email) {
    const email = String(person.email).trim().toLowerCase();
    if (emails.has(email)) {
      console.error("duplicate email");
      process.exit(1);
    }
    emails.add(email);
  }
}

const client = new pg.Client({
  host,
  port,
  database,
  user,
  password: process.env.DB_PASSWORD || "",
});
await client.connect();

try {
  await client.query("BEGIN");
  await client.query("ALTER TABLE employees ALTER COLUMN join_date DROP NOT NULL");
  await client.query("ALTER TABLE employees ADD COLUMN IF NOT EXISTS ptkp_code varchar(16)");
  await client.query("INSERT INTO hris_companies (id) VALUES ('bzg') ON CONFLICT DO NOTHING");

  // Remove BZG-scoped operational rows first (company-scoped tables).
  await client.query("DELETE FROM attendance WHERE company_id = 'bzg'");
  await client.query("DELETE FROM leave_requests WHERE company_id = 'bzg'");
  await client.query("DELETE FROM payroll_records WHERE company_id = 'bzg'");
  await client.query("DELETE FROM payroll_periods WHERE company_id = 'bzg'");
  await client.query("DELETE FROM audit_logs WHERE company_id = 'bzg'");

  // Child rows of BZG employees (some tables are not company-scoped).
  await client.query(`
    DELETE FROM employee_documents
    WHERE employee_id IN (SELECT id FROM employees WHERE company_id = 'bzg')
  `);
  await client.query(`
    DELETE FROM employee_shift_assignments
    WHERE employee_id IN (SELECT id FROM employees WHERE company_id = 'bzg')
  `);
  await client.query(`
    DELETE FROM employment_contracts
    WHERE employee_id IN (SELECT id FROM employees WHERE company_id = 'bzg')
  `);
  await client.query(`
    DELETE FROM leave_balances
    WHERE employee_id IN (SELECT id FROM employees WHERE company_id = 'bzg')
  `);
  await client.query(`
    DELETE FROM overtime_requests
    WHERE employee_id IN (SELECT id FROM employees WHERE company_id = 'bzg')
  `);
  await client.query(`
    DELETE FROM service_charge_distributions
    WHERE employee_id IN (SELECT id FROM employees WHERE company_id = 'bzg')
  `);

  const removedEmployees = await client.query("DELETE FROM employees WHERE company_id = 'bzg' RETURNING id");
  await client.query("UPDATE departments SET manager_employee_id = NULL WHERE company_id = 'bzg'");
  await client.query("DELETE FROM positions WHERE company_id = 'bzg'");
  await client.query("DELETE FROM departments WHERE company_id = 'bzg'");

  const department = await client.query(
    `INSERT INTO departments (code, name, description, company_id)
     VALUES ('OPS', 'Operations', 'BZG active hires', 'bzg')
     RETURNING id`,
  );
  const departmentId = department.rows[0].id;

  let inserted = 0;
  for (const person of roster.people) {
    await client.query(
      `INSERT INTO employees (
         employee_code, full_name, preferred_name, nik, npwp, date_of_birth, gender, phone, email, address,
         emergency_contact_name, emergency_contact_phone, department_id, join_date,
         bank_name, bank_account_number, bank_account_name, ptkp_code, employment_status, company_id
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
         $11, $12, $13, $14,
         $15, $16, $17, $18, 'ACTIVE', 'bzg'
       )`,
      [
        person.employeeCode,
        person.fullName,
        person.fullName.split(/\s+/)[0] || person.fullName,
        person.nik ?? null,
        person.npwp ?? null,
        person.dateOfBirth ?? null,
        person.gender ?? null,
        person.phone ?? null,
        person.email ?? null,
        person.address ?? null,
        person.emergencyName ?? null,
        person.emergencyPhone ?? null,
        departmentId,
        person.joinDate,
        person.bankName ?? null,
        person.bankAccountNumber ?? null,
        person.bankAccountName ?? null,
        person.ptkpCode ?? null,
      ],
    );
    inserted += 1;
  }

  const counts = await client.query(
    `SELECT company_id, count(*)::int AS total
     FROM employees
     GROUP BY company_id
     ORDER BY company_id NULLS FIRST`,
  );
  await client.query("COMMIT");
  console.log(JSON.stringify({
    removedEmployees: removedEmployees.rowCount,
    inserted,
    roster: roster.people.length,
    employeesByCompany: counts.rows,
  }));
} catch (error) {
  await client.query("ROLLBACK");
  console.error("import failed", error.code || "", error.constraint || error.message || "");
  process.exitCode = 1;
} finally {
  await client.end();
}
