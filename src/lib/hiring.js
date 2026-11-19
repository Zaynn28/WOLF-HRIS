const emailPattern = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

function workEmail(value) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length < 3 || email.length > 254 || !emailPattern.test(email)) return null;
  return email;
}

function cleanName(value) {
  if (typeof value !== "string") return null;
  const name = value.trim();
  if (name.length < 1 || name.length > 255) return null;
  return name;
}

function cleanDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

export function hireEmployeeCode(companyId, now = new Date()) {
  const company = String(companyId ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2,4}$/.test(company)) return null;
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const suffix = String(now.getTime()).slice(-4);
  return `${company}${yy}${mm}${dd}${suffix}`;
}

/**
 * A signed applicant becomes one employee. A rejection writes nothing.
 * The fields never include a NIK or a login id.
 */
export function planSignedHire(input) {
  if (input?.action === "reject") return { action: "none" };
  if (input?.action !== "sign") return { action: "none" };
  const email = workEmail(input.email);
  const fullName = cleanName(input.fullName);
  const joinDate = cleanDate(input.startDate);
  if (!email) return { action: "refuse", status: 400, error: "A work email is required." };
  if (!fullName || !input.departmentId || !input.positionId || !joinDate || !input.employeeCode) {
    return { action: "refuse", status: 400, error: "Name, department, position, and start date are required." };
  }
  if ((input.sameCompanyCount ?? 0) > 0) {
    return { action: "refuse", status: 409, error: "Another employee in this company already uses this email." };
  }
  const fields = {
    employee_code: input.employeeCode,
    full_name: fullName,
    preferred_name: fullName.split(" ")[0] || fullName,
    email,
    phone: typeof input.phone === "string" && input.phone.trim() ? input.phone.trim() : null,
    department_id: input.departmentId,
    position_id: input.positionId,
    employment_status: "PROBATION",
    join_date: joinDate,
  };
  return { action: "create", fields };
}

export function planOnboarding(input) {
  if (!input?.employeeId) return { action: "refuse", status: 400, error: "That employee is not signed." };
  if (input.ready !== true) {
    return { action: "refuse", status: 400, error: "Complete every onboarding activity before activating the employee." };
  }
  return { action: "activate", employeeId: input.employeeId, fields: { employment_status: "ACTIVE" } };
}

export async function applySignedHire(store, input) {
  const plan = planSignedHire(input);
  if (plan.action !== "create") return plan;
  const employee = await store.createEmployee(plan.fields);
  return { action: "created", employee };
}

export async function applyOnboarding(store, input) {
  const plan = planOnboarding(input);
  if (plan.action !== "activate") return plan;
  const employee = await store.activateEmployee(plan.employeeId, plan.fields.employment_status);
  return { action: "activated", employee };
}
