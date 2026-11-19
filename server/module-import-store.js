import { moduleSpec } from "./module-import.js";

const storedModules = new Set([
  "shifts", "attendance", "leave", "overtime", "hiring", "contracts", "documents",
  "assets", "payroll", "payroll-review", "service-charge", "payroll-finance",
  "reimbursements", "loans",
]);

const employeeColumns = [
  "full_name", "preferred_name", "nik", "npwp", "date_of_birth", "gender", "phone", "email",
  "address", "emergency_contact_name", "emergency_contact_phone", "employment_status", "join_date",
  "bank_name", "bank_account_number", "bank_account_name", "ptkp_code", "gaji_pokok",
];

function skipped(reason) {
  return { outcome: "skipped", reason };
}

function importId(moduleId, key) {
  return `import:${moduleId}:${String(key).replace(/[^A-Za-z0-9_-]/g, "_")}`;
}

async function departmentId(db, companyId, code) {
  if (!code) return { id: null };
  const found = await db.query("SELECT id FROM departments WHERE company_id = $1 AND code = $2", [companyId, code]);
  if (!found.rows[0]) return skipped("department_code is not in this company");
  return { id: found.rows[0].id };
}

async function positionId(db, companyId, code) {
  if (!code) return { id: null };
  const found = await db.query("SELECT id FROM positions WHERE company_id = $1 AND code = $2", [companyId, code]);
  if (!found.rows[0]) return skipped("position_code is not in this company");
  return { id: found.rows[0].id };
}

async function employeeInCompany(db, companyId, code) {
  if (!code) return { id: null };
  const found = await db.query(
    "SELECT id FROM employees WHERE company_id = $1 AND employee_code = $2",
    [companyId, code],
  );
  if (!found.rows[0]) return skipped("employee_code is not in this company");
  return { id: found.rows[0].id };
}

async function leaveTypeExists(db, code) {
  const found = await db.query("SELECT 1 FROM leave_types WHERE code = $1", [code]);
  if (!found.rows[0]) return skipped("leave_type_code is not a known leave type");
  return { ok: true };
}

async function upsertEmployee(db, companyId, fields) {
  const department = await departmentId(db, companyId, fields.department_code);
  if (department.outcome) return department;
  const position = await positionId(db, companyId, fields.position_code);
  if (position.outcome) return position;
  const found = await db.query("SELECT id, company_id FROM employees WHERE employee_code = $1", [fields.employee_code]);
  const current = found.rows[0];
  if (current && current.company_id !== companyId) return skipped("employee_code is already used outside this company");
  try {
    if (current) {
      const sets = [];
      const values = [];
      const assign = (column, value) => {
        values.push(value);
        sets.push(`${column} = $${values.length}`);
      };
      for (const column of employeeColumns) {
        if (Object.prototype.hasOwnProperty.call(fields, column)) assign(column, fields[column]);
      }
      if (department.id) assign("department_id", department.id);
      if (position.id) assign("position_id", position.id);
      if (sets.length === 0) return { outcome: "updated" };
      sets.push("updated_at = CURRENT_TIMESTAMP");
      values.push(current.id, companyId);
      const updated = await db.query(
        `UPDATE employees SET ${sets.join(", ")} WHERE id = $${values.length - 1} AND company_id = $${values.length}`,
        values,
      );
      if (!updated.rowCount) return skipped("the row could not be stored");
      return { outcome: "updated" };
    }
    const email = typeof fields.email === "string" ? fields.email.trim().toLowerCase() : "";
    if (!email.includes("@") || /\s/.test(email)) return skipped("a work email is required");
    const duplicate = await db.query(
      "SELECT id FROM employees WHERE company_id = $1 AND lower(btrim(email)) = $2 LIMIT 1",
      [companyId, email],
    );
    if (duplicate.rows[0]) return skipped("another employee in this company already uses this email");
    fields = { ...fields, email };
    const columns = ["employee_code", "company_id", "employment_status"];
    const values = [fields.employee_code, companyId, fields.employment_status || "ACTIVE"];
    for (const column of employeeColumns) {
      if (column === "employment_status") continue;
      if (Object.prototype.hasOwnProperty.call(fields, column)) {
        columns.push(column);
        values.push(fields[column]);
      }
    }
    if (department.id) {
      columns.push("department_id");
      values.push(department.id);
    }
    if (position.id) {
      columns.push("position_id");
      values.push(position.id);
    }
    const placeholders = values.map((_, index) => `$${index + 1}`).join(", ");
    await db.query(`INSERT INTO employees (${columns.join(", ")}) VALUES (${placeholders})`, values);
    return { outcome: "imported" };
  } catch (error) {
    if (error?.code === "23505") return skipped("a unique value in this row is already used");
    return skipped("the row could not be stored");
  }
}

async function upsertDepartment(db, companyId, fields) {
  const found = await db.query("SELECT id FROM departments WHERE company_id = $1 AND code = $2", [companyId, fields.code]);
  if (found.rows[0]) {
    await db.query(
      `UPDATE departments
       SET name = $1, description = COALESCE($2, description), updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND company_id = $4`,
      [fields.name, fields.description ?? null, found.rows[0].id, companyId],
    );
    return { outcome: "updated" };
  }
  await db.query(
    "INSERT INTO departments (code, name, description, company_id) VALUES ($1, $2, $3, $4)",
    [fields.code, fields.name, fields.description ?? null, companyId],
  );
  return { outcome: "imported" };
}

async function upsertPosition(db, companyId, fields) {
  const department = await departmentId(db, companyId, fields.department_code);
  if (department.outcome) return department;
  const found = await db.query("SELECT id FROM positions WHERE company_id = $1 AND code = $2", [companyId, fields.code]);
  if (found.rows[0]) {
    await db.query(
      `UPDATE positions
       SET title = $1, department_id = $2, grade = COALESCE($3, grade), description = COALESCE($4, description), updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 AND company_id = $6`,
      [fields.title, department.id, fields.grade ?? null, fields.description ?? null, found.rows[0].id, companyId],
    );
    return { outcome: "updated" };
  }
  await db.query(
    "INSERT INTO positions (code, title, department_id, grade, description, company_id) VALUES ($1, $2, $3, $4, $5, $6)",
    [fields.code, fields.title, department.id, fields.grade ?? null, fields.description ?? null, companyId],
  );
  return { outcome: "imported" };
}

async function upsertTask(db, companyId, fields) {
  if (String(fields.external_id).startsWith("org:")) return skipped("organization task ids are reserved");
  const employee = await db.query(
    "SELECT id, company_id, employee_code FROM employees WHERE company_id = $1 AND employee_code = $2",
    [companyId, fields.employee_code],
  );
  if (!employee.rows[0]) return skipped("employee_code is not in this company");
  const existing = await db.getStaffTaskByExternal(companyId, fields.external_id);
  if (existing?.external_id?.startsWith("org:")) return skipped("organization tasks are not changed by import");
  await db.upsertStaffTask(companyId, {
    external_id: fields.external_id,
    employee_id: employee.rows[0].id,
    employee_code: employee.rows[0].employee_code,
    title: fields.title,
    detail: fields.detail ?? "",
    due_date: fields.due_date,
    status: fields.status,
    assigner_name: fields.assigner_name || "Organization",
    updated_at: new Date().toISOString(),
  });
  return { outcome: existing ? "updated" : "imported" };
}

async function upsertStored(db, companyId, moduleId, key, fields) {
  const payload = { ...fields, id: importId(moduleId, key) };
  if (fields.employee_code) {
    const employee = await employeeInCompany(db, companyId, fields.employee_code);
    if (employee.outcome) return employee;
    if (employee.id) payload.employeeId = employee.id;
  }
  if (moduleId === "leave") {
    const leaveType = await leaveTypeExists(db, fields.leave_type_code);
    if (leaveType.outcome) return leaveType;
  }
  if (moduleId === "hiring") {
    const department = await departmentId(db, companyId, fields.department_code);
    if (department.outcome) return department;
    const position = await positionId(db, companyId, fields.position_code);
    if (position.outcome) return position;
    payload.departmentId = department.id;
    payload.positionId = position.id;
  }
  const existing = await db.query(
    "SELECT payload FROM hris_module_imports WHERE company_id = $1 AND module = $2 AND natural_key = $3",
    [companyId, moduleId, key],
  );
  if (existing.rows[0]?.payload?.submittedAt) payload.submittedAt = existing.rows[0].payload.submittedAt;
  else payload.submittedAt = new Date().toISOString();
  if (existing.rows[0]) {
    await db.query(
      `UPDATE hris_module_imports
       SET payload = $4::jsonb, updated_at = CURRENT_TIMESTAMP
       WHERE company_id = $1 AND module = $2 AND natural_key = $3`,
      [companyId, moduleId, key, JSON.stringify(payload)],
    );
    return { outcome: "updated" };
  }
  await db.query(
    `INSERT INTO hris_module_imports (company_id, module, natural_key, payload)
     VALUES ($1, $2, $3, $4::jsonb)`,
    [companyId, moduleId, key, JSON.stringify(payload)],
  );
  return { outcome: "imported" };
}

export async function listImportRows(db, companyId) {
  const result = await db.query(
    `SELECT module, natural_key, payload
     FROM hris_module_imports
     WHERE company_id = $1
     ORDER BY module, natural_key`,
    [companyId],
  );
  const rows = {};
  for (const row of result.rows) {
    if (!rows[row.module]) rows[row.module] = [];
    rows[row.module].push({ natural_key: row.natural_key, payload: row.payload });
  }
  return rows;
}

export async function listModuleRows(db, companyId, moduleId) {
  const result = await db.query(
    `SELECT natural_key, payload
     FROM hris_module_imports
     WHERE company_id = $1 AND module = $2
     ORDER BY natural_key`,
    [companyId, moduleId],
  );
  return result.rows.map((row) => ({ natural_key: row.natural_key, payload: row.payload }));
}

export async function savePreparedRows(db, companyId, moduleId, ready) {
  const spec = moduleSpec(moduleId);
  let imported = 0;
  let updated = 0;
  const skips = [];
  for (const row of ready) {
    let saved;
    if (moduleId === "employees") saved = await upsertEmployee(db, companyId, row.fields);
    else if (moduleId === "departments") saved = await upsertDepartment(db, companyId, row.fields);
    else if (moduleId === "positions") saved = await upsertPosition(db, companyId, row.fields);
    else if (moduleId === "tasks") saved = await upsertTask(db, companyId, row.fields);
    else if (storedModules.has(moduleId)) saved = await upsertStored(db, companyId, moduleId, row.key, row.fields);
    else saved = skipped("That import is not available.");
    if (saved.outcome === "imported") imported += 1;
    else if (saved.outcome === "updated") updated += 1;
    else if (skips.length < 5) skips.push({ row: row.row, reason: saved.reason || "the row could not be stored" });
  }
  const skippedCount = ready.length - imported - updated;
  return {
    imported,
    updated,
    skipped: skippedCount,
    skips,
    refresh: spec?.refresh ?? null,
    rows: storedModules.has(moduleId) ? await listModuleRows(db, companyId, moduleId) : undefined,
  };
}
