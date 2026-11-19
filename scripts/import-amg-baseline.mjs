/**
 * Idempotent AMG staff baseline import.
 * Matches the sheet's NO column, stored as employee_code AMG-01 … AMG-26.
 * Refuses port 5432, port 5433, and any database other than atrium_hris_local on 127.0.0.1.
 * Does not print staff identifiers.
 */
import { execFileSync } from "node:child_process";
import pg from "pg";

const workbookPath = process.env.AMG_STAFF_XLSX || "/Users/nozerre/Downloads/AMG STAFF.xlsx";
const host = process.env.DB_HOST;
const port = Number(process.env.DB_PORT);
const database = process.env.DB_NAME;
const user = process.env.DB_USER || "nozerre";

if (host !== "127.0.0.1" || port !== 5434 || database !== "atrium_hris_local") {
  console.error("refusing database target");
  process.exit(1);
}

const departmentCodes = new Map([
  ["Housekeeping", "HK"],
  ["Executive", "EXEC"],
  ["Front Office", "FO"],
  ["Accounting and Finance", "ACCFIN"],
]);

function unzip(entry) {
  return execFileSync("unzip", ["-p", workbookPath, entry], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
}

function decodeXml(text) {
  return text
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

function sharedStrings(xml) {
  const values = [];
  for (const block of xml.match(/<si[\s\S]*?<\/si>/g) ?? []) {
    const parts = [...block.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((match) => decodeXml(match[1]));
    values.push(parts.join(""));
  }
  return values;
}

function sheetRows(xml, strings) {
  const rows = [];
  for (const row of xml.match(/<row[\s\S]*?<\/row>/g) ?? []) {
    const index = Number(row.match(/r="(\d+)"/)?.[1] ?? 0);
    const cells = {};
    for (const cell of row.match(/<c\b[^>]*(?:\/>|>[\s\S]*?<\/c>)/g) ?? []) {
      const ref = cell.match(/\br="([A-Z]+)(\d+)"/);
      if (!ref) continue;
      const type = cell.match(/\bt="([^"]+)"/)?.[1] ?? "n";
      let value = null;
      if (type === "inlineStr") {
        value = decodeXml(cell.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] ?? "");
      } else if (type === "s") {
        value = strings[Number(cell.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "-1")] ?? null;
      } else {
        value = cell.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? null;
      }
      if (typeof value === "string") value = value.trim();
      cells[ref[1]] = value === "" ? null : value;
    }
    rows.push({ index, cells });
  }
  return rows;
}

function blankToNull(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text === "" ? null : text;
}

function excelDate(serial) {
  if (serial == null || serial === "") return null;
  const number = Number(serial);
  if (!Number.isFinite(number)) return null;
  const utc = new Date(Date.UTC(1899, 11, 30) + number * 86400000);
  const year = utc.getUTCFullYear();
  const month = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const day = String(utc.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function text(value) {
  const cleaned = blankToNull(value);
  return cleaned == null ? null : cleaned.replace(/\s+/g, " ");
}

function digits(value, allowSeparators = false) {
  const cleaned = blankToNull(value);
  if (cleaned == null) return null;
  if (/^\d+$/.test(cleaned)) return cleaned;
  if (!allowSeparators) return null;
  const stripped = cleaned.replace(/[\s().+-]/g, "");
  if (/^\d+$/.test(stripped)) return stripped;
  return null;
}

function gender(value) {
  const cleaned = text(value);
  if (cleaned == null) return null;
  if (cleaned.toLowerCase() === "male") return "M";
  if (cleaned.toLowerCase() === "female") return "F";
  return { invalid: true };
}

const strings = sharedStrings(unzip("xl/sharedStrings.xml"));
const sheetXml = unzip("xl/worksheets/sheet1.xml").replace(/<c\b[^>]*\/>/g, (tag) => `${tag.slice(0, -2)}></c>`);
const rows = sheetRows(sheetXml, strings);
const header = rows.find((row) => row.index === 1);
const expected = ["NO", "NAME", "OUTLET", "DEPARTMENT", "JOIN DATE", "GENDER", "RELIGION", "PoB", "DoB", "NIK", "STATUS PERNIKAHAN", "NPWP", "STATUS PTKP", "ADDRESS", "PHONE NUMBER", "EMAIL", "BPJS KESEHATAN", "BPJS TK 2P", "BPJS TK 4P", "BANK NAME", "ACCOUNT NUMBER", "EMERGENCY CONTACT NAME", "EMERGENCY CONTACT NUMBER", "ALLERGY", "BLOOD TYPE", "LAST EDUCATION", "SCHOOL NAME"];
const columns = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ", "AA"].slice(0, expected.length);
const headerValues = columns.map((column) => header?.cells[column] ?? null);
if (headerValues.join("|") !== expected.join("|")) {
  console.error("unexpected header");
  process.exit(1);
}

const people = [];
const stats = {
  blankRows: 0,
  missingDepartment: 0,
  missingJoinDate: 0,
  missingGender: 0,
  missingNik: 0,
  identifierOmitted: 0,
};
const seenCodes = new Set();

for (const row of rows) {
  if (row.index === 1) continue;
  const cells = row.cells;
  const occupied = Object.values(cells).some((value) => value != null);
  if (!occupied) {
    stats.blankRows += 1;
    continue;
  }
  const no = Number(cells.A);
  if (!Number.isInteger(no) || no < 1) {
    console.error("sheet row has no usable NO value");
    process.exit(1);
  }
  const code = `AMG-${String(no).padStart(2, "0")}`;
  if (seenCodes.has(code)) {
    console.error("duplicate NO value");
    process.exit(1);
  }
  seenCodes.add(code);
  const fullName = text(cells.B);
  if (!fullName) {
    console.error("occupied row has no name");
    process.exit(1);
  }
  const departmentName = text(cells.D);
  if (!departmentName) stats.missingDepartment += 1;
  else if (!departmentCodes.has(departmentName)) {
    console.error(`department is not mapped: ${departmentName}`);
    process.exit(1);
  }
  const joinDate = excelDate(cells.E);
  if (!joinDate) stats.missingJoinDate += 1;
  const parsedGender = gender(cells.F);
  if (parsedGender && typeof parsedGender === "object") {
    console.error("unexpected gender value");
    process.exit(1);
  }
  if (!parsedGender) stats.missingGender += 1;
  const nik = digits(cells.J);
  const npwp = digits(cells.L);
  const phone = digits(cells.O, true);
  const account = digits(cells.U, true);
  const emergencyPhone = digits(cells.W, true);
  for (const [raw, parsed] of [[cells.J, nik], [cells.L, npwp], [cells.O, phone], [cells.U, account], [cells.W, emergencyPhone]]) {
    if (blankToNull(raw) && !parsed) stats.identifierOmitted += 1;
  }
  if (!nik) stats.missingNik += 1;
  people.push({
    code,
    fullName,
    departmentName,
    joinDate,
    gender: typeof parsedGender === "string" ? parsedGender : null,
    nik: nik,
    npwp: npwp,
    ptkp: text(cells.M),
    address: text(cells.N),
    phone: phone,
    email: text(cells.P),
    bankName: text(cells.T),
    account: account,
    emergencyName: text(cells.V),
    emergencyPhone: emergencyPhone,
    dateOfBirth: excelDate(cells.I),
  });
}

if (people.length !== 26) {
  console.error(`expected 26 staff rows, found ${people.length}`);
  process.exit(1);
}

const client = new pg.Client({ host, port, database, user, password: process.env.DB_PASSWORD || "" });
await client.connect();
try {
  await client.query("BEGIN");
  await client.query("ALTER TABLE employees ALTER COLUMN join_date DROP NOT NULL");
  await client.query("ALTER TABLE employees ADD COLUMN IF NOT EXISTS ptkp_code varchar(16)");
  const departments = new Map();
  for (const [name, code] of departmentCodes) {
    if (!people.some((person) => person.departmentName === name)) continue;
    const saved = await client.query(
      `INSERT INTO departments (code, name, company_id)
       VALUES ($1, $2, 'amg')
       ON CONFLICT (company_id, code) WHERE company_id IS NOT NULL
       DO UPDATE SET name = EXCLUDED.name, updated_at = CURRENT_TIMESTAMP
       RETURNING id`,
      [code, name],
    );
    departments.set(name, saved.rows[0].id);
  }

  let inserted = 0;
  let updated = 0;
  let skippedOtherCompany = 0;
  for (const person of people) {
    const byCode = await client.query(
      "SELECT id, company_id FROM employees WHERE employee_code = $1",
      [person.code],
    );
    let existing = byCode.rows[0] ?? null;
    if (!existing && person.nik) {
      const byNik = await client.query(
        "SELECT id, company_id FROM employees WHERE nik = $1",
        [person.nik],
      );
      existing = byNik.rows[0] ?? null;
    }
    if (existing && existing.company_id !== "amg") {
      skippedOtherCompany += 1;
      continue;
    }
    const values = [
      person.code,
      person.fullName,
      person.nik,
      person.npwp,
      person.dateOfBirth,
      person.gender,
      person.phone,
      person.email,
      person.address,
      person.emergencyName,
      person.emergencyPhone,
      person.departmentName ? departments.get(person.departmentName) : null,
      person.joinDate,
      person.bankName,
      person.account,
      person.ptkp,
    ];
    if (existing) {
      await client.query(
        `UPDATE employees SET
           employee_code = $1,
           full_name = $2,
           nik = $3,
           npwp = $4,
           date_of_birth = $5,
           gender = $6,
           phone = $7,
           email = $8,
           address = $9,
           emergency_contact_name = $10,
           emergency_contact_phone = $11,
           department_id = $12,
           join_date = $13,
           bank_name = $14,
           bank_account_number = $15,
           ptkp_code = $16,
           employment_status = 'ACTIVE',
           company_id = 'amg',
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $17 AND company_id = 'amg'`,
        [...values, existing.id],
      );
      updated += 1;
    } else {
      await client.query(
        `INSERT INTO employees (
           employee_code, full_name, nik, npwp, date_of_birth, gender, phone, email, address,
           emergency_contact_name, emergency_contact_phone, department_id, join_date,
           bank_name, bank_account_number, ptkp_code, employment_status, company_id
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9,
           $10, $11, $12, $13,
           $14, $15, $16, 'ACTIVE', 'amg'
         )`,
        values,
      );
      inserted += 1;
    }
  }
  const counts = await client.query(
    `SELECT company_id, count(*)::int AS total
     FROM employees
     GROUP BY company_id
     ORDER BY company_id`,
  );
  const departmentsByCompany = await client.query(
    `SELECT company_id, count(*)::int AS total
     FROM departments
     GROUP BY company_id
     ORDER BY company_id`,
  );
  await client.query("COMMIT");
  console.log(JSON.stringify({
    inserted,
    updated,
    skippedOtherCompany,
    sheetRows: people.length,
    blankRows: stats.blankRows,
    missingDepartment: stats.missingDepartment,
    missingJoinDate: stats.missingJoinDate,
    missingGender: stats.missingGender,
    missingNik: stats.missingNik,
    identifierOmitted: stats.identifierOmitted,
    employeesByCompany: counts.rows,
    departmentsByCompany: departmentsByCompany.rows,
  }));
} catch (error) {
  await client.query("ROLLBACK");
  console.error("import failed", error.code || "", error.constraint || "");
  process.exitCode = 1;
} finally {
  await client.end();
}
