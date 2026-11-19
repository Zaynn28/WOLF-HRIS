export const staffTaskStatuses = ["ASSIGNED", "ACCEPTED", "IN_PROGRESS", "BLOCKED", "IN_REVIEW", "COMPLETED"];

const statusSet = new Set(staffTaskStatuses);
const externalIdPattern = /^[a-z0-9][a-z0-9:_-]{2,80}$/;
const employeeCodePattern = /^[A-Z0-9][A-Z0-9-]{1,31}$/;
const dueDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export function externalIdAllowed(companyId, externalId) {
  if (typeof externalId !== "string" || !externalIdPattern.test(externalId)) return false;
  if (externalId.startsWith("hr:") && !externalId.startsWith(`hr:${companyId}:`)) return false;
  return true;
}

export function cleanTaskText(value, max) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (text.length < 1 || text.length > max) return null;
  return text;
}

export function projectStaffTask(row, companyId) {
  if (!row || row.company_id !== companyId) return null;
  if (!externalIdAllowed(companyId, row.external_id)) return null;
  if (!statusSet.has(row.status)) return null;
  if (typeof row.employee_code !== "string" || !employeeCodePattern.test(row.employee_code)) return null;
  const title = cleanTaskText(row.title, 160);
  const due = typeof row.due_date === "string" ? row.due_date.slice(0, 10) : null;
  if (!title || !due || !dueDatePattern.test(due)) return null;
  const assigner = cleanTaskText(row.assigner_name, 80);
  return {
    id: row.id,
    company_id: companyId,
    employee_id: row.employee_id,
    employee_code: row.employee_code,
    title,
    detail: typeof row.detail === "string" ? row.detail.slice(0, 500) : "",
    due_date: due,
    status: row.status,
    assigner_name: assigner && !assigner.includes("@") ? assigner : "Organization",
    external_id: row.external_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function staffTaskWrite(companyId, body) {
  const source = body && typeof body === "object" ? body : {};
  const title = cleanTaskText(source.title, 160);
  const due = typeof source.due_date === "string" ? source.due_date.slice(0, 10) : "";
  const status = source.status === undefined ? "ASSIGNED" : source.status;
  if (!title || !dueDatePattern.test(due) || !statusSet.has(status)) return null;
  let assigner = "Organization";
  if (typeof source.assigner_name === "string" && source.assigner_name.trim() !== "") {
    const cleaned = cleanTaskText(source.assigner_name, 80);
    if (!cleaned || cleaned.includes("@")) return null;
    assigner = cleaned;
  }
  const detail = typeof source.detail === "string" ? source.detail.trim().slice(0, 500) : undefined;
  const externalId = typeof source.external_id === "string" ? source.external_id : null;
  if (externalId !== null && !externalIdAllowed(companyId, externalId)) return null;
  return {
    title,
    due_date: due,
    status,
    assigner_name: assigner,
    detail,
    external_id: externalId,
    updated_at: typeof source.updated_at === "string" && Number.isFinite(Date.parse(source.updated_at)) ? new Date(source.updated_at).toISOString() : null,
  };
}
