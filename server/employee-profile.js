import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Direct edits and approvals require the signed HR workspace. A self-service session can only file its own change request. */
export const profileFields = [
  "full_name",
  "preferred_name",
  "phone",
  "email",
  "address",
  "emergency_contact_name",
  "emergency_contact_phone",
  "department_id",
  "position_id",
  "employment_status",
];

const statuses = new Set(["ACTIVE", "ON_LEAVE", "TERMINATED", "RESIGNED", "PROBATION"]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const companyPattern = /^(amg|bzg|ggv)$/;
const employeeCodePattern = /^[A-Z0-9][A-Z0-9-]{1,31}$/;
const maxPhotoBytes = 256 * 1024;

const limits = {
  full_name: 255,
  preferred_name: 255,
  phone: 40,
  email: 254,
  address: 500,
  emergency_contact_name: 255,
  emergency_contact_phone: 40,
};

export const profilePhotoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.local/profile-photos");

export function canDirectEdit(workspace) {
  return workspace === "hr";
}

export function canRequestChange(workspace) {
  return workspace === "self";
}

export function canReviewChange(workspace, requestedBy, reviewerId) {
  return workspace === "hr" && typeof reviewerId === "string" && reviewerId !== "" && requestedBy !== reviewerId;
}

export function profilePatch(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "The profile fields are not valid." };
  }
  const fields = {};
  for (const key of profileFields) {
    if (!Object.prototype.hasOwnProperty.call(input, key)) continue;
    const value = input[key];
    if (value === null || value === "") {
      if (key === "full_name" || key === "employment_status" || key === "email") {
        return { ok: false, error: key === "email" ? "A work email is required." : "The profile fields are not valid." };
      }
      fields[key] = null;
      continue;
    }
    if (typeof value !== "string") return { ok: false, error: "The profile fields are not valid." };
    const trimmed = value.trim();
    if (trimmed === "") {
      if (key === "full_name" || key === "employment_status" || key === "email") {
        return { ok: false, error: key === "email" ? "A work email is required." : "The profile fields are not valid." };
      }
      fields[key] = null;
      continue;
    }
    if (trimmed.length > (limits[key] ?? 40)) return { ok: false, error: "The profile fields are not valid." };
    if (key === "employment_status" && !statuses.has(trimmed)) return { ok: false, error: "The profile fields are not valid." };
    if ((key === "department_id" || key === "position_id") && !uuidPattern.test(trimmed)) {
      return { ok: false, error: "The profile fields are not valid." };
    }
    if (key === "email") {
      const email = trimmed.toLowerCase();
      if (!email.includes("@") || /\s/.test(email) || email.length < 3) {
        return { ok: false, error: "The profile fields are not valid." };
      }
      fields[key] = email;
      continue;
    }
    fields[key] = trimmed;
  }
  return { ok: true, fields };
}

const maxBaseSalary = 999_999_999_999;

/** Whole rupiah. Empty stays empty. Floats and the payroll salary key are refused. */
export function baseSalaryPatch(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "The profile fields are not valid." };
  }
  if (!Object.prototype.hasOwnProperty.call(input, "gaji_pokok")) return { ok: true, present: false };
  const value = input.gaji_pokok;
  if (value === null || value === "") return { ok: true, present: true, value: null };
  let parsed = null;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) return { ok: false, error: "The profile fields are not valid." };
    parsed = value;
  } else if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    parsed = Number(value.trim());
    if (!Number.isSafeInteger(parsed)) return { ok: false, error: "The profile fields are not valid." };
  } else {
    return { ok: false, error: "The profile fields are not valid." };
  }
  if (parsed < 0 || parsed > maxBaseSalary) return { ok: false, error: "The profile fields are not valid." };
  return { ok: true, present: true, value: parsed };
}

export function readStoredBaseSalary(value) {
  if (value == null || value === "") return null;
  if (typeof value === "bigint") {
    if (value < 0n || value > BigInt(maxBaseSalary)) return null;
    return Number(value);
  }
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value >= 0 && value <= maxBaseSalary ? value : null;
  }
  if (typeof value === "string" && /^\d+$/.test(value)) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed <= maxBaseSalary ? parsed : null;
  }
  return null;
}

export function changedFieldNames(before, fields) {
  const names = [];
  for (const key of Object.keys(fields)) {
    const current = before?.[key] ?? null;
    const next = fields[key] ?? null;
    const currentText = current instanceof Date ? current.toISOString().slice(0, 10) : current;
    if (currentText !== next) names.push(key);
  }
  return names;
}

function sniffPhoto(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { ext: "jpg", mime: "image/jpeg" };
  }
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { ext: "png", mime: "image/png" };
  }
  if (
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  ) {
    return { ext: "webp", mime: "image/webp" };
  }
  return null;
}

export function readProfilePhoto(payload) {
  if (payload == null || payload === "") return { ok: true, photo: null };
  if (typeof payload !== "string") return { ok: false, error: "Use a JPEG, PNG, or WebP image." };
  const base64 = payload.includes(",") ? payload.slice(payload.indexOf(",") + 1) : payload;
  const compact = base64.replace(/\s/g, "");
  if (compact === "" || !/^[A-Za-z0-9+/=]+$/.test(compact)) {
    return { ok: false, error: "Use a JPEG, PNG, or WebP image." };
  }
  const bytes = Buffer.from(compact, "base64");
  if (bytes.length === 0 || bytes.length > maxPhotoBytes) {
    return { ok: false, error: "Use an image under 256 KB." };
  }
  const kind = sniffPhoto(bytes);
  if (!kind) return { ok: false, error: "Use a JPEG, PNG, or WebP image." };
  return { ok: true, photo: { bytes, ext: kind.ext, mime: kind.mime } };
}

export function presentEmployee(row, options = {}) {
  if (!row || typeof row !== "object") return row;
  const copy = { ...row };
  copy.has_profile_photo = Boolean(copy.profile_photo_path);
  delete copy.profile_photo_path;
  delete copy.self_service_user_id;
  const baseSalary = options.includeBaseSalary === true ? readStoredBaseSalary(copy.gaji_pokok) : undefined;
  delete copy.gaji_pokok;
  if (options.includeBaseSalary === true) copy.gaji_pokok = baseSalary;
  return copy;
}

export function presentChangeRequest(row) {
  const source = row?.proposed && typeof row.proposed === "object" && !Array.isArray(row.proposed) ? row.proposed : {};
  const proposed = {};
  for (const key of profileFields) {
    if (Object.prototype.hasOwnProperty.call(source, key)) proposed[key] = source[key];
  }
  return {
    id: row.id,
    company_id: row.company_id,
    employee_id: row.employee_id,
    employee_code: row.employee_code,
    status: row.status,
    proposed,
    fields: Object.keys(proposed),
    has_photo: Boolean(row.photo_path),
    requested_by: row.requested_by,
    created_at: row.created_at,
    reviewed_at: row.reviewed_at ?? null,
  };
}

export function photoRelative(companyId, employeeCode, name) {
  if (!companyPattern.test(companyId) || !employeeCodePattern.test(employeeCode)) return null;
  if (!/^(profile|requests\/[0-9a-f-]{36})\.(jpg|png|webp)$/.test(name)) return null;
  return `${companyId}/${employeeCode}/${name}`;
}

export function resolveStoredPhoto(root, relative) {
  if (typeof relative !== "string" || relative === "" || relative.includes("\0")) return null;
  const rootPath = path.resolve(root);
  const resolved = path.resolve(rootPath, relative);
  if (resolved !== rootPath && !resolved.startsWith(rootPath + path.sep)) return null;
  if (resolved === rootPath) return null;
  return resolved;
}

export async function writeStoredPhoto(root, relative, bytes) {
  const target = resolveStoredPhoto(root, relative);
  if (!target) throw new Error("photo path refused");
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.tmp`;
  await writeFile(temporary, bytes, { flag: "w" });
  await rename(temporary, target);
}

export async function readStoredPhoto(root, relative) {
  const target = resolveStoredPhoto(root, relative);
  if (!target) return null;
  try {
    return await readFile(target);
  } catch {
    return null;
  }
}

export async function removeStoredPhoto(root, relative) {
  const target = resolveStoredPhoto(root, relative);
  if (!target) return;
  await rm(target, { force: true });
}

export function mimeForPhoto(relative) {
  if (typeof relative !== "string") return null;
  if (relative.endsWith(".png")) return "image/png";
  if (relative.endsWith(".webp")) return "image/webp";
  if (relative.endsWith(".jpg")) return "image/jpeg";
  return null;
}
