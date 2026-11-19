import { createHash } from "node:crypto";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^\d{2}:\d{2}$/;
const employeeCodePattern = /^[A-Z0-9][A-Z0-9-]{1,31}$/;
const shortCodePattern = /^[A-Za-z0-9][A-Za-z0-9&_ ./-]{0,39}$/;
const referencePattern = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,40}$/;
const externalPattern = /^[a-z0-9][a-z0-9:_-]{2,80}$/;
const emailPattern = /^[^\s@]+@[^\s@]+$/;

const attendanceStatuses = new Set(["PRESENT", "ABSENT", "LATE", "EARLY_LEAVE", "ON_LEAVE", "HOLIDAY", "REST_DAY", "INCOMPLETE"]);
const leaveStatuses = new Set(["PENDING", "APPROVED", "REJECTED", "CANCELLED"]);
const overtimeStatuses = new Set(["PENDING", "APPROVED", "REJECTED"]);
const employmentStatuses = new Set(["ACTIVE", "ON_LEAVE", "TERMINATED", "RESIGNED", "PROBATION"]);
const hiringStatuses = new Set([
  "APPLIED",
  "REJECTED",
  "OFFERED",
  "SIGNED",
  "ONBOARDED",
  "CV_SCREENING",
  "HR_INTERVIEW",
  "USHER_INTERVIEW",
  "OFFER_SENT",
  "OFFER_ACCEPTED",
  "OFFER_REJECTED",
]);
const contractTypes = new Set(["PKWTT", "PKWT"]);
const contractStatuses = new Set(["active", "expiring", "expired"]);
const assetCategories = new Set(["LAPTOP", "PHONE", "UNIFORM", "KEYS", "OTHER"]);
const claimCategories = new Set(["TRANSPORT", "MEDICAL", "OTHER"]);
const claimStatuses = new Set(["SUBMITTED", "APPROVED", "REJECTED", "PAID"]);
const loanTypes = new Set(["SALARY_ADVANCE", "EMERGENCY", "HOUSING", "EDUCATION", "OTHER"]);
const loanStatuses = new Set(["ACTIVE", "PAID_OFF", "DEFAULTED"]);
const taskStatuses = new Set(["ASSIGNED", "ACCEPTED", "IN_PROGRESS", "BLOCKED", "IN_REVIEW", "COMPLETED"]);
const packStatuses = new Set(["UNDER_REVIEW", "APPROVED", "RETURNED"]);
const shareStatuses = new Set(["DRAFT", "DISTRIBUTED", "PAID"]);

function headerKey(name) {
  return String(name ?? "").trim().toLowerCase().replace(/\s+/g, "_");
}

function rawCell(row, name) {
  if (!row || typeof row !== "object" || Array.isArray(row)) return { present: false, value: "" };
  for (const key of Object.keys(row)) {
    if (headerKey(key) === name) return { present: true, value: String(row[key] ?? "").trim() };
  }
  return { present: false, value: "" };
}

function text(row, name, max) {
  const cell = rawCell(row, name);
  if (!cell.present || cell.value === "") return { present: false, value: "" };
  if (cell.value.length > max) return { present: true, error: `${name} is too long` };
  return { present: true, value: cell.value };
}

function requiredText(row, name, max) {
  const cell = text(row, name, max);
  if (cell.error) return cell;
  if (!cell.present) return { error: `${name} is required` };
  return cell;
}

function oneOf(row, name, allowed, fallback) {
  const cell = text(row, name, 40);
  if (cell.error) return cell;
  if (!cell.present) return fallback === undefined ? { present: false, value: "" } : { present: true, value: fallback };
  const value = cell.value.toUpperCase() === cell.value ? cell.value : cell.value;
  const normalized = allowed.has(cell.value) ? cell.value : allowed.has(cell.value.toUpperCase()) ? cell.value.toUpperCase() : null;
  if (!normalized) return { error: `${name} is not valid` };
  return { present: true, value: normalized };
}

function dateValue(row, name, required) {
  const cell = text(row, name, 10);
  if (cell.error) return cell;
  if (!cell.present) return required ? { error: `${name} is required` } : { present: false, value: "" };
  if (!datePattern.test(cell.value) || Number.isNaN(Date.parse(`${cell.value}T00:00:00Z`))) return { error: `${name} is not a valid date` };
  return cell;
}

function timeValue(row, name, required) {
  const cell = text(row, name, 5);
  if (cell.error) return cell;
  if (!cell.present) return required ? { error: `${name} is required` } : { present: false, value: "" };
  if (!timePattern.test(cell.value)) return { error: `${name} is not a valid time` };
  return cell;
}

function numberValue(row, name, required) {
  const cell = rawCell(row, name);
  if (!cell.present || cell.value === "") return required ? { error: `${name} is required` } : { present: false, value: null };
  if (!/^-?\d+(\.\d+)?$/.test(cell.value)) return { error: `${name} is not a number` };
  const value = Number(cell.value);
  if (!Number.isFinite(value)) return { error: `${name} is not a number` };
  return { present: true, value };
}

function integerValue(row, name, required) {
  const cell = numberValue(row, name, required);
  if (cell.error || !cell.present) return cell;
  if (!Number.isInteger(cell.value)) return { error: `${name} is not a whole number` };
  return cell;
}

function optionalWholeIdr(row, name) {
  const cell = rawCell(row, name);
  if (!cell.present || cell.value === "") return { present: false, value: null };
  const body = cell.value.replace(/^Rp\s*/i, "").replace(/\s/g, "");
  if (body.includes(",")) return { error: `${name} is not a whole number` };
  const grouped = /^\d{1,3}(\.\d{3})+$/.test(body);
  const plain = /^\d+$/.test(body);
  if (!grouped && !plain) return { error: `${name} is not a whole number` };
  const value = Number(body.replace(/\./g, ""));
  if (!Number.isSafeInteger(value) || value > 999_999_999_999) return { error: `${name} is not a whole number` };
  return { present: true, value };
}

function employeeCode(row, required = true) {
  const cell = required ? requiredText(row, "employee_code", 32) : text(row, "employee_code", 32);
  if (cell.error || !cell.present) return cell;
  if (!employeeCodePattern.test(cell.value)) return { error: "employee_code is not valid" };
  return cell;
}

function shortCode(row, name, required = true) {
  const cell = required ? requiredText(row, name, 40) : text(row, name, 40);
  if (cell.error || !cell.present) return cell;
  if (!shortCodePattern.test(cell.value)) return { error: `${name} is not valid` };
  return cell;
}

function fail(fields) {
  const bad = Object.values(fields).find((field) => field && field.error);
  return bad ? bad.error : null;
}

function taskExternalId(employee, due, title, supplied) {
  if (supplied) {
    const value = supplied.toLowerCase();
    if (value.startsWith("org:")) return { error: "organization task ids are reserved" };
    if (!externalPattern.test(value)) return { error: "external_id is not valid" };
    return { value };
  }
  const digest = createHash("sha256").update(`${employee}|${due}|${title}`).digest("hex").slice(0, 32);
  return { value: `import:${digest}` };
}

function prepareEmployees(row) {
  const fields = {
    employee_code: employeeCode(row),
    full_name: requiredText(row, "full_name", 255),
    join_date: dateValue(row, "join_date", true),
    preferred_name: text(row, "preferred_name", 255),
    department_code: shortCode(row, "department_code", false),
    position_code: shortCode(row, "position_code", false),
    employment_status: oneOf(row, "employment_status", employmentStatuses),
    gender: oneOf(row, "gender", new Set(["M", "F"])),
    nik: text(row, "nik", 20),
    npwp: text(row, "npwp", 20),
    date_of_birth: dateValue(row, "date_of_birth", false),
    phone: text(row, "phone", 40),
    email: text(row, "email", 254),
    address: text(row, "address", 500),
    emergency_contact_name: text(row, "emergency_contact_name", 255),
    emergency_contact_phone: text(row, "emergency_contact_phone", 40),
    bank_name: text(row, "bank_name", 100),
    bank_account_number: text(row, "bank_account_number", 50),
    bank_account_name: text(row, "bank_account_name", 255),
    ptkp_code: text(row, "ptkp_code", 20),
    gaji_pokok: optionalWholeIdr(row, "gaji_pokok"),
  };
  const error = fail(fields);
  if (error) return { skip: error };
  if (fields.email.present && !emailPattern.test(fields.email.value)) return { skip: "email is not valid" };
  return { key: fields.employee_code.value, fields: compact(fields) };
}

function prepareDepartments(row) {
  const fields = {
    code: shortCode(row, "code"),
    name: requiredText(row, "name", 255),
    description: text(row, "description", 500),
  };
  const error = fail(fields);
  if (error) return { skip: error };
  return { key: fields.code.value, fields: compact(fields) };
}

function preparePositions(row) {
  const fields = {
    code: shortCode(row, "code"),
    title: requiredText(row, "title", 255),
    department_code: shortCode(row, "department_code"),
    grade: text(row, "grade", 20),
    description: text(row, "description", 500),
  };
  const error = fail(fields);
  if (error) return { skip: error };
  return { key: fields.code.value, fields: compact(fields) };
}

function prepareShifts(row) {
  const fields = {
    code: shortCode(row, "code"),
    name: requiredText(row, "name", 100),
    start_time: timeValue(row, "start_time", true),
    end_time: timeValue(row, "end_time", true),
    break_minutes: integerValue(row, "break_minutes", false),
    crosses_midnight: text(row, "crosses_midnight", 5),
  };
  const error = fail(fields);
  if (error) return { skip: error };
  const midnight = fields.crosses_midnight.present ? /^(1|true|yes)$/i.test(fields.crosses_midnight.value) : false;
  return {
    key: fields.code.value,
    fields: {
      code: fields.code.value,
      name: fields.name.value,
      start_time: fields.start_time.value,
      end_time: fields.end_time.value,
      break_minutes: fields.break_minutes.present ? fields.break_minutes.value : 0,
      crosses_midnight: midnight,
    },
  };
}

function prepareAttendance(row) {
  const fields = {
    employee_code: employeeCode(row),
    attendance_date: dateValue(row, "attendance_date", true),
    status: oneOf(row, "status", attendanceStatuses),
    shift_code: shortCode(row, "shift_code", false),
    clock_in: timeValue(row, "clock_in", false),
    clock_out: timeValue(row, "clock_out", false),
    late_minutes: integerValue(row, "late_minutes", false),
    notes: text(row, "notes", 500),
  };
  const error = fail(fields);
  if (error) return { skip: error };
  if (!fields.status.present) return { skip: "status is required" };
  return { key: `${fields.employee_code.value}|${fields.attendance_date.value}`, fields: compact(fields) };
}

function prepareLeave(row) {
  const fields = {
    employee_code: employeeCode(row),
    leave_type_code: shortCode(row, "leave_type_code"),
    start_date: dateValue(row, "start_date", true),
    end_date: dateValue(row, "end_date", true),
    total_days: numberValue(row, "total_days", true),
    reason: text(row, "reason", 500),
    status: oneOf(row, "status", leaveStatuses, "PENDING"),
  };
  const error = fail(fields);
  if (error) return { skip: error };
  if (fields.end_date.value < fields.start_date.value) return { skip: "end_date is before start_date" };
  return { key: `${fields.employee_code.value}|${fields.leave_type_code.value}|${fields.start_date.value}`, fields: compact(fields) };
}

function prepareOvertime(row) {
  const fields = {
    employee_code: employeeCode(row),
    date: dateValue(row, "date", true),
    start_time: timeValue(row, "start_time", true),
    end_time: timeValue(row, "end_time", true),
    total_minutes: integerValue(row, "total_minutes", true),
    reason: text(row, "reason", 500),
    status: oneOf(row, "status", overtimeStatuses, "PENDING"),
  };
  const error = fail(fields);
  if (error) return { skip: error };
  return { key: `${fields.employee_code.value}|${fields.date.value}`, fields: compact(fields) };
}

function prepareHiring(row) {
  const fields = {
    full_name: requiredText(row, "full_name", 255),
    email: requiredText(row, "email", 254),
    phone: text(row, "phone", 40),
    department_code: shortCode(row, "department_code"),
    position_code: shortCode(row, "position_code"),
    status: oneOf(row, "status", hiringStatuses, "APPLIED"),
  };
  const error = fail(fields);
  if (error) return { skip: error };
  if (!emailPattern.test(fields.email.value)) return { skip: "email is not valid" };
  return { key: fields.email.value.toLowerCase(), fields: compact(fields) };
}

function prepareContracts(row) {
  const fields = {
    contract_number: text(row, "contract_number", 40),
    employee_code: employeeCode(row),
    type: oneOf(row, "type", contractTypes),
    start_date: dateValue(row, "start_date", true),
    end_date: dateValue(row, "end_date", false),
    basic_salary: numberValue(row, "basic_salary", true),
    allowance: numberValue(row, "allowance", true),
    status: oneOf(row, "status", contractStatuses, "active"),
  };
  const error = fail(fields);
  if (error) return { skip: error };
  if (!fields.contract_number.present || !referencePattern.test(fields.contract_number.value)) return { skip: "contract_number is required" };
  if (!fields.type.present) return { skip: "type is required" };
  return { key: fields.contract_number.value, fields: compact(fields) };
}

function prepareDocuments(row) {
  const fields = {
    employee_code: employeeCode(row),
    document_type: requiredText(row, "document_type", 100),
    file_name: requiredText(row, "file_name", 255),
    document_number: text(row, "document_number", 100),
    issue_date: dateValue(row, "issue_date", false),
    expiry_date: dateValue(row, "expiry_date", false),
    verification_status: oneOf(row, "verification_status", new Set(["PENDING", "VERIFIED", "REJECTED", "EXPIRED"]), "PENDING"),
  };
  const error = fail(fields);
  if (error) return { skip: error };
  if (/photo|picture|profile/i.test(fields.document_type.value)) return { skip: "profile pictures are not imported" };
  return {
    key: `${fields.employee_code.value}|${fields.document_type.value}|${fields.file_name.value}`,
    fields: compact(fields),
  };
}

function prepareAssets(row) {
  const fields = {
    code: shortCode(row, "code"),
    name: requiredText(row, "name", 255),
    category: oneOf(row, "category", assetCategories),
    employee_code: employeeCode(row, false),
    issued_on: dateValue(row, "issued_on", false),
    condition: text(row, "condition", 40),
    notes: text(row, "notes", 500),
  };
  const error = fail(fields);
  if (error) return { skip: error };
  if (!fields.category.present) return { skip: "category is required" };
  if (fields.employee_code.present && !employeeCodePattern.test(fields.employee_code.value)) return { skip: "employee_code is not valid" };
  return { key: fields.code.value, fields: compact(fields) };
}

function prepareTasks(row) {
  const employee = employeeCode(row);
  const title = requiredText(row, "title", 160);
  const due = dateValue(row, "due_date", true);
  const status = oneOf(row, "status", taskStatuses, "ASSIGNED");
  const detail = text(row, "detail", 500);
  const assigner = text(row, "assigner_name", 80);
  const external = text(row, "external_id", 81);
  const error = fail({ employee, title, due, status, detail, assigner, external });
  if (error) return { skip: error };
  if (assigner.present && assigner.value.includes("@")) return { skip: "assigner_name is not valid" };
  const key = taskExternalId(employee.value, due.value, title.value, external.present ? external.value : "");
  if (key.error) return { skip: key.error };
  return {
    key: key.value,
    fields: {
      external_id: key.value,
      employee_code: employee.value,
      title: title.value,
      due_date: due.value,
      status: status.value,
      detail: detail.present ? detail.value : "",
      assigner_name: assigner.present ? assigner.value : "Organization",
    },
  };
}

function preparePayroll(row) {
  const fields = {
    period_code: text(row, "period_code", 20),
    employee_code: employeeCode(row),
    start_date: dateValue(row, "start_date", true),
    end_date: dateValue(row, "end_date", true),
    pay_date: dateValue(row, "pay_date", true),
    basic_salary: numberValue(row, "basic_salary", true),
    allowance: numberValue(row, "allowance", true),
    overtime: numberValue(row, "overtime", true),
    service_charge: numberValue(row, "service_charge", true),
    gross_pay: numberValue(row, "gross_pay", true),
    total_deductions: numberValue(row, "total_deductions", true),
    net_pay: numberValue(row, "net_pay", true),
    status: text(row, "status", 20),
  };
  const error = fail(fields);
  if (error) return { skip: error };
  if (!/^\d{4}-\d{2}$/.test(fields.period_code.value)) return { skip: "period_code is required" };
  return { key: `${fields.period_code.value}|${fields.employee_code.value}`, fields: compact(fields) };
}

function preparePayrollReview(row) {
  const prepared = preparePayroll(row);
  if (prepared.skip) return prepared;
  const status = prepared.fields.status && packStatuses.has(prepared.fields.status) ? prepared.fields.status : "UNDER_REVIEW";
  return { key: prepared.key, fields: { ...prepared.fields, status } };
}

function prepareServiceCharge(row) {
  const fields = {
    period_code: text(row, "period_code", 20),
    employee_code: employeeCode(row),
    start_date: dateValue(row, "start_date", true),
    end_date: dateValue(row, "end_date", true),
    pay_date: dateValue(row, "pay_date", true),
    amount: numberValue(row, "amount", true),
    distribution_basis: text(row, "distribution_basis", 200),
    status: oneOf(row, "status", shareStatuses, "DRAFT"),
  };
  const error = fail(fields);
  if (error) return { skip: error };
  if (!/^\d{4}-\d{2}$/.test(fields.period_code.value)) return { skip: "period_code is required" };
  return { key: `${fields.period_code.value}|${fields.employee_code.value}`, fields: compact(fields) };
}

function preparePayrollFinance(row) {
  const fields = {
    reference: text(row, "reference", 40),
    period_code: text(row, "period_code", 20),
    destination: requiredText(row, "destination", 80),
    total_debit: numberValue(row, "total_debit", true),
    total_credit: numberValue(row, "total_credit", true),
    journal: text(row, "journal", 2000),
  };
  const error = fail(fields);
  if (error) return { skip: error };
  if (!fields.reference.present || !referencePattern.test(fields.reference.value)) return { skip: "reference is required" };
  if (!/^\d{4}-\d{2}$/.test(fields.period_code.value)) return { skip: "period_code is required" };
  if (fields.total_debit.value !== fields.total_credit.value) return { skip: "debit and credit must match" };
  return { key: fields.reference.value, fields: compact(fields) };
}

function prepareReimbursements(row) {
  const fields = {
    employee_code: employeeCode(row),
    claim_date: dateValue(row, "claim_date", true),
    category: oneOf(row, "category", claimCategories),
    amount: numberValue(row, "amount", true),
    description: requiredText(row, "description", 500),
    status: oneOf(row, "status", claimStatuses, "SUBMITTED"),
  };
  const error = fail(fields);
  if (error) return { skip: error };
  if (!fields.category.present) return { skip: "category is required" };
  return { key: `${fields.employee_code.value}|${fields.claim_date.value}|${fields.category.value}|${fields.description.value}`, fields: compact(fields) };
}

function prepareLoans(row) {
  const fields = {
    employee_code: employeeCode(row),
    loan_type: oneOf(row, "loan_type", loanTypes),
    start_date: dateValue(row, "start_date", true),
    principal_amount: numberValue(row, "principal_amount", true),
    remaining_balance: numberValue(row, "remaining_balance", true),
    monthly_installment: numberValue(row, "monthly_installment", true),
    purpose: text(row, "purpose", 500),
    status: oneOf(row, "status", loanStatuses, "ACTIVE"),
  };
  const error = fail(fields);
  if (error) return { skip: error };
  if (!fields.loan_type.present) return { skip: "loan_type is required" };
  return { key: `${fields.employee_code.value}|${fields.loan_type.value}|${fields.start_date.value}`, fields: compact(fields) };
}

function compact(fields) {
  const out = {};
  for (const [key, field] of Object.entries(fields)) {
    if (field && field.present) out[key] = field.value;
  }
  return out;
}

export const importModules = [
  { id: "employees", label: "Employees", keyLabel: "employee_code", headers: ["employee_code", "full_name", "join_date", "preferred_name", "department_code", "position_code", "employment_status", "gender", "nik", "npwp", "date_of_birth", "phone", "email", "address", "emergency_contact_name", "emergency_contact_phone", "bank_name", "bank_account_number", "bank_account_name", "ptkp_code", "gaji_pokok"], required: ["employee_code", "full_name", "join_date"], prepare: prepareEmployees, refresh: "employees" },
  { id: "departments", label: "Departments", keyLabel: "code", headers: ["code", "name", "description"], required: ["code", "name"], prepare: prepareDepartments, refresh: "departments" },
  { id: "positions", label: "Positions", keyLabel: "code", headers: ["code", "title", "department_code", "grade", "description"], required: ["code", "title", "department_code"], prepare: preparePositions, refresh: "positions" },
  { id: "shifts", label: "Shifts", keyLabel: "code", headers: ["code", "name", "start_time", "end_time", "break_minutes", "crosses_midnight"], required: ["code", "name", "start_time", "end_time"], prepare: prepareShifts },
  { id: "attendance", label: "Attendance", keyLabel: "employee_code + attendance_date", headers: ["employee_code", "attendance_date", "status", "shift_code", "clock_in", "clock_out", "late_minutes", "notes"], required: ["employee_code", "attendance_date", "status"], prepare: prepareAttendance },
  { id: "leave", label: "Leave", keyLabel: "employee_code + leave_type_code + start_date", headers: ["employee_code", "leave_type_code", "start_date", "end_date", "total_days", "reason", "status"], required: ["employee_code", "leave_type_code", "start_date", "end_date", "total_days"], prepare: prepareLeave },
  { id: "overtime", label: "Overtime", keyLabel: "employee_code + date", headers: ["employee_code", "date", "start_time", "end_time", "total_minutes", "reason", "status"], required: ["employee_code", "date", "start_time", "end_time", "total_minutes"], prepare: prepareOvertime },
  { id: "hiring", label: "Hiring", keyLabel: "email", headers: ["full_name", "email", "phone", "department_code", "position_code", "status"], required: ["full_name", "email", "department_code", "position_code"], prepare: prepareHiring },
  { id: "contracts", label: "Contracts", keyLabel: "contract_number", headers: ["contract_number", "employee_code", "type", "start_date", "end_date", "basic_salary", "allowance", "status"], required: ["contract_number", "employee_code", "type", "start_date", "basic_salary", "allowance"], prepare: prepareContracts },
  { id: "documents", label: "Documents", keyLabel: "employee_code + document_type + file_name", headers: ["employee_code", "document_type", "file_name", "document_number", "issue_date", "expiry_date", "verification_status"], required: ["employee_code", "document_type", "file_name"], prepare: prepareDocuments },
  { id: "assets", label: "Assets", keyLabel: "code", headers: ["code", "name", "category", "employee_code", "issued_on", "condition", "notes"], required: ["code", "name", "category"], prepare: prepareAssets },
  { id: "tasks", label: "Staff tasks", keyLabel: "external_id, or employee_code + due_date + title", headers: ["employee_code", "title", "due_date", "status", "detail", "assigner_name", "external_id"], required: ["employee_code", "title", "due_date"], prepare: prepareTasks, refresh: "tasks" },
  { id: "payroll", label: "Payroll", keyLabel: "period_code + employee_code", headers: ["period_code", "employee_code", "start_date", "end_date", "pay_date", "basic_salary", "allowance", "overtime", "service_charge", "gross_pay", "total_deductions", "net_pay", "status"], required: ["period_code", "employee_code", "start_date", "end_date", "pay_date", "basic_salary", "allowance", "overtime", "service_charge", "gross_pay", "total_deductions", "net_pay"], prepare: preparePayroll },
  { id: "payroll-review", label: "Payroll review", keyLabel: "period_code + employee_code", headers: ["period_code", "employee_code", "start_date", "end_date", "pay_date", "basic_salary", "allowance", "overtime", "service_charge", "gross_pay", "total_deductions", "net_pay", "status"], required: ["period_code", "employee_code", "start_date", "end_date", "pay_date", "basic_salary", "allowance", "overtime", "service_charge", "gross_pay", "total_deductions", "net_pay"], prepare: preparePayrollReview },
  { id: "service-charge", label: "Service charge", keyLabel: "period_code + employee_code", headers: ["period_code", "employee_code", "start_date", "end_date", "pay_date", "amount", "distribution_basis", "status"], required: ["period_code", "employee_code", "start_date", "end_date", "pay_date", "amount"], prepare: prepareServiceCharge },
  { id: "payroll-finance", label: "Payroll to finance", keyLabel: "reference", headers: ["reference", "period_code", "destination", "total_debit", "total_credit", "journal"], required: ["reference", "period_code", "destination", "total_debit", "total_credit"], prepare: preparePayrollFinance },
  { id: "reimbursements", label: "Reimbursement", keyLabel: "employee_code + claim_date + category + description", headers: ["employee_code", "claim_date", "category", "amount", "description", "status"], required: ["employee_code", "claim_date", "category", "amount", "description"], prepare: prepareReimbursements },
  { id: "loans", label: "Employee loans", keyLabel: "employee_code + loan_type + start_date", headers: ["employee_code", "loan_type", "start_date", "principal_amount", "remaining_balance", "monthly_installment", "purpose", "status"], required: ["employee_code", "loan_type", "start_date", "principal_amount", "remaining_balance", "monthly_installment"], prepare: prepareLoans },
];

const byId = new Map(importModules.map((module) => [module.id, module]));

export function importCatalog() {
  return importModules.map(({ id, label, keyLabel, headers, required }) => ({ id, label, keyLabel, headers, required }));
}

export function moduleSpec(moduleId) {
  return byId.get(moduleId) ?? null;
}

export function prepareModuleRows(moduleId, rawRows) {
  const spec = moduleSpec(moduleId);
  if (!spec) return { error: "That import is not available." };
  if (!Array.isArray(rawRows)) return { error: "rows must be a list" };
  const skipped = [];
  const ready = new Map();
  const limit = Math.min(rawRows.length, 500);
  if (rawRows.length > 500) skipped.push({ row: 501, reason: "Only the first 500 rows are imported." });
  for (let index = 0; index < limit; index += 1) {
    const rowNumber = index + 2;
    const prepared = spec.prepare(rawRows[index]);
    if (prepared.skip) {
      skipped.push({ row: rowNumber, reason: prepared.skip });
      continue;
    }
    const previous = ready.get(prepared.key);
    if (previous) skipped.push({ row: previous.row, reason: "Duplicate key in this file. The later row is kept." });
    ready.set(prepared.key, { row: rowNumber, key: prepared.key, fields: prepared.fields });
  }
  return {
    ready: [...ready.values()],
    skipped: skipped.length,
    skips: skipped.slice(0, 5),
    refresh: spec.refresh ?? null,
  };
}
