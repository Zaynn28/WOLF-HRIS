import path from "node:path";
import { fileURLToPath } from "node:url";

const maxPhotoBytes = 1024 * 1024;
const maxAccuracyMeters = 250;
const minSiteRadiusMeters = 30;
const maxSiteRadiusMeters = 300;
const repeatWindowMs = 60_000;
const maxAttempts = 30;
const companyPattern = /^(amg|bzg|ggv)$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export const punchPhotoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.local/punch-photos");

export function jakartaClock(now) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const read = (type) => parts.find((part) => part.type === type)?.value ?? "";
  let hour = read("hour");
  if (hour === "24") hour = "00";
  return {
    date: `${read("year")}-${read("month")}-${read("day")}`,
    clock: `${hour.padStart(2, "0")}:${read("minute").padStart(2, "0")}`,
  };
}

export function previousDate(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() - 1);
  return utc.toISOString().slice(0, 10);
}

export function jakartaDayStart(now) {
  return new Date(`${jakartaClock(now).date}T00:00:00+07:00`);
}

export function haversineMeters(lat1, lon1, lat2, lon2) {
  const earth = 6371000;
  const radians = (degrees) => (degrees * Math.PI) / 180;
  const deltaLat = radians(lat2 - lat1);
  const deltaLon = radians(lon2 - lon1);
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(deltaLon / 2) ** 2;
  return earth * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

export function readPunchJpeg(payload) {
  if (payload == null || payload === "") return { ok: false, error: "A photo is required." };
  if (typeof payload !== "string") return { ok: false, error: "Use a JPEG under 1 MB." };
  const base64 = payload.includes(",") ? payload.slice(payload.indexOf(",") + 1) : payload;
  const compact = base64.replace(/\s/g, "");
  if (compact === "" || !/^[A-Za-z0-9+/=]+$/.test(compact)) return { ok: false, error: "Use a JPEG under 1 MB." };
  const bytes = Buffer.from(compact, "base64");
  if (bytes.length === 0 || bytes.length > maxPhotoBytes) return { ok: false, error: "Use a JPEG under 1 MB." };
  if (!(bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)) {
    return { ok: false, error: "Use a JPEG under 1 MB." };
  }
  return { ok: true, bytes };
}

export function punchPhotoRelative(companyId, employeeId, attendanceDate, side) {
  if (!companyPattern.test(companyId) || !uuidPattern.test(employeeId)) return null;
  if (!datePattern.test(attendanceDate) || (side !== "in" && side !== "out")) return null;
  return `${companyId}/${employeeId}/attendance/${attendanceDate}-${side}.jpg`;
}

function clockText(value) {
  if (value == null || value === "") return null;
  const text = String(value).slice(0, 5);
  return timePattern.test(text) ? text : null;
}

function stampMs(value) {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function presentPunchDay(row) {
  if (!row) return null;
  const numberOrNull = (value) => {
    if (value == null || value === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  return {
    id: row.id,
    employee_id: row.employee_id,
    employee_code: row.employee_code ?? null,
    full_name: row.full_name ?? null,
    attendance_date: String(row.attendance_date).slice(0, 10),
    shift_id: row.shift_id ?? null,
    shift_name: row.shift_name ?? null,
    clock_in: clockText(row.clock_in),
    clock_out: clockText(row.clock_out),
    status: row.status,
    late_minutes: row.late_minutes == null ? null : Number(row.late_minutes),
    source: row.source ?? null,
    clock_in_site_name: row.clock_in_site_name ?? null,
    clock_out_site_name: row.clock_out_site_name ?? null,
    clock_in_lat: numberOrNull(row.clock_in_lat),
    clock_in_lng: numberOrNull(row.clock_in_lng),
    clock_in_accuracy_m: row.clock_in_accuracy_m == null ? null : Number(row.clock_in_accuracy_m),
    clock_out_lat: numberOrNull(row.clock_out_lat),
    clock_out_lng: numberOrNull(row.clock_out_lng),
    clock_out_accuracy_m: row.clock_out_accuracy_m == null ? null : Number(row.clock_out_accuracy_m),
    has_clock_in_photo: Boolean(row.clock_in_photo_path),
    has_clock_out_photo: Boolean(row.clock_out_photo_path),
  };
}

function refused(status, error, audit) {
  return { status, body: { error }, write: null, audit };
}

function targetDate(now, previousRow) {
  const clock = jakartaClock(now);
  const openPrevious = clock.clock < "05:00"
    && previousRow
    && clockText(previousRow.clock_in)
    && !clockText(previousRow.clock_out);
  return openPrevious ? previousDate(clock.date) : clock.date;
}

function leaveCovers(date, leaves) {
  return leaves.some((leave) => leave.startDate <= date && leave.endDate >= date);
}

function lastPunchMs(row) {
  return Math.max(stampMs(row?.clock_in_at) ?? 0, stampMs(row?.clock_out_at) ?? 0) || null;
}

export function matchPunchSite(latitude, longitude, sites) {
  let best = null;
  for (const site of sites) {
    if (site.active === false) continue;
    if (!Number.isInteger(site.radiusMeters) || site.radiusMeters < minSiteRadiusMeters || site.radiusMeters > maxSiteRadiusMeters) continue;
    if (!Number.isFinite(site.latitude) || !Number.isFinite(site.longitude)) continue;
    const distance = haversineMeters(latitude, longitude, site.latitude, site.longitude);
    if (distance > site.radiusMeters) continue;
    if (!best || distance < best.distance) best = { site, distance };
  }
  return best;
}

function lateMinutesFor(clock, shift) {
  if (!shift || shift.crossesMidnight || !timePattern.test(shift.start || "")) return null;
  const [hour, minute] = clock.split(":").map(Number);
  const [startHour, startMinute] = shift.start.split(":").map(Number);
  return Math.max(0, hour * 60 + minute - (startHour * 60 + startMinute));
}

export function planPhonePunch(input) {
  const employee = input.employee ?? null;
  const auditBase = {
    result: "rejected",
    employeeId: employee?.id ?? null,
    siteId: null,
    attendanceDate: null,
    side: null,
    reason: "",
  };
  if (input.workspace !== "self" && input.workspace !== "hr") {
    return refused(403, "This punch is only for a signed-in staff account.", { ...auditBase, reason: "workspace" });
  }
  if (!employee?.id) {
    return refused(403, "This account is not linked to an employee.", { ...auditBase, reason: "unlinked" });
  }
  if (typeof input.idempotencyKey !== "string" || !uuidPattern.test(input.idempotencyKey)) {
    return refused(400, "The punch is not valid.", { ...auditBase, employeeId: employee.id, reason: "idempotency" });
  }
  if (input.receipt) {
    return { status: input.receipt.status, body: input.receipt.body, write: null, audit: null };
  }
  if ((input.attemptCount ?? 0) >= maxAttempts) {
    return refused(429, "Too many punch attempts.", { ...auditBase, employeeId: employee.id, reason: "attempts" });
  }

  const clock = jakartaClock(input.now);
  const date = targetDate(input.now, input.previousRow);
  const row = date === clock.date ? input.todayRow : input.previousRow;
  const audit = { ...auditBase, employeeId: employee.id, attendanceDate: date };
  const recent = lastPunchMs(row);
  if (row?.source === "phone" && clockText(row.clock_in) && recent != null && input.now.getTime() >= recent && input.now.getTime() - recent < repeatWindowMs) {
    return {
      status: 200,
      body: { outcome: "kept", message: "This punch was already recorded.", day: presentPunchDay(row) },
      write: null,
      audit: { ...audit, result: "kept", reason: "repeat" },
    };
  }

  const photo = input.photo;
  if (!photo?.ok) {
    const reason = photo?.error || "A photo is required.";
    return refused(400, reason, { ...audit, reason });
  }
  const latitude = input.latitude;
  const longitude = input.longitude;
  const accuracy = input.accuracy;
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return refused(400, "A GPS fix is required.", { ...audit, reason: "A GPS fix is required." });
  }
  if (typeof accuracy !== "number" || !Number.isFinite(accuracy) || accuracy < 0 || accuracy > maxAccuracyMeters) {
    return refused(400, "The location is too coarse.", { ...audit, reason: "The location is too coarse." });
  }

  if (leaveCovers(date, input.leaves ?? []) || row?.status === "ON_LEAVE") {
    return refused(400, "You are on leave.", { ...audit, reason: "You are on leave." });
  }
  if (row?.status === "HOLIDAY" || row?.status === "REST_DAY") {
    return refused(400, "This day is not a working day.", { ...audit, reason: "This day is not a working day." });
  }
  if (row?.source === "fingerspot") {
    return refused(400, "This day belongs to the fingerprint device.", { ...audit, reason: "This day belongs to the fingerprint device." });
  }
  if (row?.source && row.source !== "phone") {
    return refused(400, "This day already has an attendance record.", { ...audit, reason: "This day already has an attendance record." });
  }
  if (row && !row.source && (clockText(row.clock_in) || clockText(row.clock_out))) {
    return refused(400, "This day already has an attendance record.", { ...audit, reason: "This day already has an attendance record." });
  }
  if (clockText(row?.clock_in) && clockText(row?.clock_out)) {
    return refused(400, "Already clocked out.", { ...audit, reason: "Already clocked out." });
  }

  const side = clockText(row?.clock_in) ? "out" : "in";
  if (side === "out" && date === clock.date && clock.clock <= clockText(row.clock_in)) {
    return refused(400, "Clock out is before clock in.", { ...audit, side, reason: "Clock out is before clock in." });
  }

  const offSiteDuty = Boolean(input.offSiteDuty);
  const matched = matchPunchSite(latitude, longitude, input.sites ?? []);
  if (!offSiteDuty && !input.sites?.length) {
    return refused(400, "No punch site is set.", { ...audit, side, reason: "No punch site is set." });
  }
  if (!offSiteDuty && !matched) {
    return refused(400, "You are outside the punch site.", { ...audit, side, reason: "You are outside the punch site." });
  }

  const shift = input.shiftsByDate?.[date] ?? null;
  const late = side === "in" ? lateMinutesFor(clock.clock, shift) : null;
  const status = side === "out"
    ? (row.status || "PRESENT")
    : late != null && late > 0
      ? "LATE"
      : "PRESENT";
  const write = {
    attendanceDate: date,
    side,
    clock: clock.clock,
    status,
    lateMinutes: side === "in" ? late : (row.late_minutes ?? null),
    siteId: matched?.site?.id ?? null,
    siteName: matched?.site?.name ?? (offSiteDuty ? (input.offSiteLocationNote || "Off-site duty") : null),
    latitude,
    longitude,
    accuracy: Math.round(accuracy),
    at: input.now.toISOString(),
    offSite: offSiteDuty && !matched,
  };
  return {
    status: 200,
    body: {
      outcome: "recorded",
      message: side === "in" ? `Clocked in at ${clock.clock}.` : `Clocked out at ${clock.clock}.`,
      day: null,
    },
    write,
    audit: { ...audit, result: "recorded", siteId: matched?.site?.id ?? null, side, reason: write.offSite ? "off-site duty" : write.status },
  };
}

export function workforceEmail(value) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length < 3 || email.length > 254) return null;
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email)) return null;
  return email;
}

export function planEmployeeEmail(email, sameCompanyCount) {
  const normalized = workforceEmail(email);
  if (!normalized) return { ok: false, status: 400, error: "A work email is required." };
  if (sameCompanyCount > 0) return { ok: false, status: 409, error: "Another employee in this company already uses this email." };
  return { ok: true, email: normalized };
}

export function workforceCode(companyId, userId) {
  const company = String(companyId ?? "").toUpperCase();
  if (!/^[A-Z]{2,4}$/.test(company)) return null;
  const compact = String(userId ?? "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (compact.length < 12) return null;
  return `${company}-${compact.slice(0, 12)}`;
}

export function planWorkforceLink(input) {
  const linked = Array.isArray(input.linkedRows) ? input.linkedRows : [];
  if (linked.length > 1) return { action: "refuse", status: 403, error: "This account is linked to more than one employee." };
  if (linked.length === 1 && linked[0]?.id) return { action: "use", employeeId: linked[0].id };
  const email = workforceEmail(input.email);
  const matches = email
    ? (Array.isArray(input.emailRows) ? input.emailRows : []).filter((row) => workforceEmail(row?.email) === email)
    : [];
  if (matches.length > 1) return { action: "refuse", status: 409, error: "More than one employee uses this email." };
  if (matches.length === 1) {
    const row = matches[0];
    if (row.self_service_user_id && row.self_service_user_id !== input.userId) {
      return { action: "refuse", status: 403, error: "This email already belongs to another login." };
    }
    if (row.employment_status === "TERMINATED" || row.employment_status === "RESIGNED") {
      return { action: "refuse", status: 403, error: "This employee is not active." };
    }
    if (!row.id) return { action: "refuse", status: 403, error: "This account is not linked to an employee." };
    return row.self_service_user_id === input.userId ? { action: "use", employeeId: row.id } : { action: "link", employeeId: row.id };
  }
  return { action: "refuse", status: 403, error: "This account is not linked to an employee." };
}

export function describeMine(input) {
  const clock = jakartaClock(input.now);
  const date = targetDate(input.now, input.previousRow);
  const row = date === clock.date ? input.todayRow : input.previousRow;
  let blocked = null;
  if (leaveCovers(date, input.leaves ?? []) || row?.status === "ON_LEAVE") blocked = "You are on leave.";
  else if (row?.status === "HOLIDAY" || row?.status === "REST_DAY") blocked = "This day is not a working day.";
  else if (row?.source === "fingerspot") blocked = "This day belongs to the fingerprint device.";
  else if ((row?.source && row.source !== "phone") || (row && !row.source && (clockText(row.clock_in) || clockText(row.clock_out)))) {
    blocked = "This day already has an attendance record.";
  } else if (clockText(row?.clock_in) && clockText(row?.clock_out)) blocked = "Already clocked out.";
  const next = blocked ? null : clockText(row?.clock_in) ? "out" : "in";
  return {
    attendance_date: date,
    next,
    blocked_reason: blocked,
    day: presentPunchDay(row),
  };
}

export function punchSiteInput(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, error: "The punch site is not valid." };
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 80 || /[\0\r\n]/.test(name)) return { ok: false, error: "The punch site is not valid." };
  const latitude = body.latitude;
  const longitude = body.longitude;
  if (typeof latitude !== "number" || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    return { ok: false, error: "The punch site is not valid." };
  }
  if (typeof longitude !== "number" || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return { ok: false, error: "The punch site is not valid." };
  }
  const radius = body.radius_meters;
  if (!Number.isInteger(radius) || radius < minSiteRadiusMeters || radius > maxSiteRadiusMeters) {
    return { ok: false, error: "The punch site radius must be from 30 to 300 metres." };
  }
  const active = body.active === undefined ? true : body.active;
  if (typeof active !== "boolean") return { ok: false, error: "The punch site is not valid." };
  return { ok: true, site: { name, latitude, longitude, radiusMeters: radius, active } };
}

function cleanTime(value) {
  if (value == null || value === "") return null;
  return typeof value === "string" && timePattern.test(value) ? value : false;
}

export function planCorrectionRequest(input) {
  if (input.workspace !== "hr") return { status: 403, body: { error: "That HR operation is blocked." } };
  if (!input.employee?.id) return { status: 404, body: { error: "Employee is not in this company." } };
  if (typeof input.attendanceDate !== "string" || !datePattern.test(input.attendanceDate)) {
    return { status: 400, body: { error: "The correction is not valid." } };
  }
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (!reason || reason.length > 500 || /[\0\r\n]/.test(reason)) {
    return { status: 400, body: { error: "A reason is required." } };
  }
  const clockIn = cleanTime(input.clockIn);
  const clockOut = cleanTime(input.clockOut);
  if (clockIn === false || clockOut === false || (!clockIn && !clockOut)) {
    return { status: 400, body: { error: "The correction is not valid." } };
  }
  if (clockIn && clockOut && clockOut <= clockIn) {
    return { status: 400, body: { error: "Clock out is before clock in." } };
  }
  return {
    status: 201,
    request: {
      employeeId: input.employee.id,
      attendanceDate: input.attendanceDate,
      clockIn,
      clockOut,
      reason,
    },
  };
}

function overnightOut(clockIn, clockOut) {
  return Boolean(clockIn && clockOut && clockIn >= "17:00" && clockOut < "12:00");
}

export function planCorrectionApproval(input) {
  if (input.workspace !== "hr") return { status: 403, body: { error: "That HR operation is blocked." } };
  const correction = input.correction;
  if (!correction || correction.status !== "PENDING") return { status: 409, body: { error: "This correction is not pending." } };
  if (!input.reviewerId || input.reviewerId === correction.requestedBy) {
    return { status: 403, body: { error: "The requester cannot approve this correction." } };
  }
  if (input.existing?.status === "ON_LEAVE") return { status: 400, body: { error: "This day is on leave." } };
  const clockIn = correction.clockIn || clockText(input.existing?.clock_in);
  const clockOut = correction.clockOut || clockText(input.existing?.clock_out);
  if (clockIn && clockOut && clockOut <= clockIn && !overnightOut(clockIn, clockOut)) {
    return { status: 400, body: { error: "Clock out is before clock in." } };
  }
  const shift = input.shift;
  const late = correction.clockIn ? lateMinutesFor(correction.clockIn, shift) : (input.existing?.late_minutes ?? null);
  const status = correction.clockIn
    ? (late != null && late > 0 ? "LATE" : "PRESENT")
    : (input.existing?.status && input.existing.status !== "INCOMPLETE" ? input.existing.status : "PRESENT");
  return {
    status: 200,
    apply: {
      employeeId: correction.employeeId,
      attendanceDate: correction.attendanceDate,
      clockIn: clockIn || null,
      clockOut: clockOut || null,
      status,
      lateMinutes: late == null ? null : Number(late),
      source: "correction",
    },
  };
}

export const correctionAttendanceSql = `
INSERT INTO attendance (
  employee_id, attendance_date, clock_in, clock_out, status, late_minutes, source, company_id
) VALUES ($1, $2, $3, $4, $5, $6, 'correction', $7)
ON CONFLICT (employee_id, attendance_date) DO UPDATE SET
  clock_in = COALESCE(EXCLUDED.clock_in, attendance.clock_in),
  clock_out = COALESCE(EXCLUDED.clock_out, attendance.clock_out),
  status = EXCLUDED.status,
  late_minutes = EXCLUDED.late_minutes,
  source = 'correction',
  updated_at = CURRENT_TIMESTAMP
WHERE attendance.company_id = EXCLUDED.company_id
RETURNING id, company_id
`;

export function photoSideAllowed(workspace, ownEmployeeId, attendanceEmployeeId) {
  if (workspace === "hr") return true;
  return workspace === "self" && Boolean(ownEmployeeId) && ownEmployeeId === attendanceEmployeeId;
}
