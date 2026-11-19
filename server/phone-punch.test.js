import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { once } from "node:events";
import test from "node:test";
import app from "./index.js";
import { db } from "./database.js";
import { fingerspotMayRewrite } from "./fingerspot.js";
import {
  correctionAttendanceSql,
  describeMine,
  matchPunchSite,
  planCorrectionApproval,
  planCorrectionRequest,
  planEmployeeEmail,
  planPhonePunch,
  planWorkforceLink,
  punchPhotoRelative,
  punchSiteInput,
  readPunchJpeg,
} from "./phone-punch.js";

const employee = { id: "11111111-1111-4111-8111-111111111111", employeeCode: "EMP01" };
const site = { id: "22222222-2222-4222-8222-222222222222", name: "UMA BLU", latitude: -6.2, longitude: 106.8, radiusMeters: 100, active: true };
const key = "33333333-3333-4333-8333-333333333333";
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]).toString("base64");
const morning = new Date("2026-11-06T08:10:00+07:00");

function punch(overrides = {}) {
  return planPhonePunch({
    now: morning,
    workspace: "self",
    employee,
    photo: { ok: true, bytes: Buffer.from(jpeg, "base64") },
    latitude: -6.2,
    longitude: 106.8,
    accuracy: 25,
    idempotencyKey: key,
    receipt: null,
    attemptCount: 0,
    sites: [site],
    leaves: [],
    todayRow: null,
    previousRow: null,
    shiftsByDate: { "2026-11-06": { start: "08:00", crossesMidnight: false } },
    attendanceDate: "1999-01-01",
    employeeId: "99999999-9999-4999-8999-999999999999",
    inside: true,
    ...overrides,
  });
}

test("a phone punch uses the server clock, the linked employee, and the nearest site", () => {
  const nearer = { ...site, id: "44444444-4444-4444-8444-444444444444", name: "BluZone", latitude: -6.2002, longitude: 106.8, radiusMeters: 80 };
  const saved = punch({ latitude: -6.20015, longitude: 106.8, sites: [site, nearer] });
  assert.equal(saved.status, 200);
  assert.equal(saved.write.attendanceDate, "2026-11-06");
  assert.equal(saved.write.clock, "08:10");
  assert.equal(saved.write.side, "in");
  assert.equal(saved.write.siteName, "BluZone");
  assert.equal(saved.write.status, "LATE");
  assert.equal(saved.write.lateMinutes, 10);
  assert.equal(saved.audit.employeeId, employee.id);
  assert.equal(JSON.stringify(saved).includes("1999-01-01"), false);
  assert.equal(JSON.stringify(saved).includes("99999999"), false);
});

test("the punch refuses a coarse fix, a missing fix, a non-JPEG, and an empty fence", () => {
  assert.equal(punch({ accuracy: 251 }).body.error, "The location is too coarse.");
  assert.equal(punch({ accuracy: 250 }).status, 200);
  assert.equal(punch({ accuracy: "25" }).body.error, "The location is too coarse.");
  assert.equal(punch({ latitude: Number.NaN }).body.error, "A GPS fix is required.");
  assert.equal(punch({ photo: readPunchJpeg(Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString("base64")) }).body.error, "Use a JPEG under 1 MB.");
  assert.equal(punch({ photo: readPunchJpeg("") }).body.error, "A photo is required.");
  const huge = Buffer.alloc(1024 * 1024 + 1, 0);
  huge[0] = 0xff;
  huge[1] = 0xd8;
  huge[2] = 0xff;
  assert.equal(readPunchJpeg(huge.toString("base64")).error, "Use a JPEG under 1 MB.");
  assert.equal(punch({ sites: [] }).body.error, "No punch site is set.");
  assert.equal(punch({ latitude: -6.21 }).body.error, "You are outside the punch site.");
  const offSite = punch({ latitude: -6.21, offSiteDuty: true, offSiteLocationNote: "Bali assignment" });
  assert.equal(offSite.status, 200);
  assert.equal(offSite.write?.siteName, "Bali assignment");
  assert.equal(offSite.write?.offSite, true);
  assert.equal(punch({ write: true }).write.attendanceDate, "2026-11-06");
});

test("leave, a fingerprint day, a third punch, and a same-day early clock-out do not write", () => {
  const open = { clock_in: "08:00", clock_out: null, source: "phone", status: "PRESENT", late_minutes: 0, clock_in_at: "2026-11-06T01:00:00.000Z" };
  assert.equal(punch({ leaves: [{ startDate: "2026-11-06", endDate: "2026-11-06" }] }).body.error, "You are on leave.");
  assert.equal(punch({ todayRow: { ...open, source: "fingerspot" } }).body.error, "This day belongs to the fingerprint device.");
  assert.equal(punch({ todayRow: { ...open, clock_out: "17:00" } }).body.error, "Already clocked out.");
  assert.equal(punch({ now: new Date("2026-11-06T07:50:00+07:00"), todayRow: open }).body.error, "Clock out is before clock in.");
  assert.equal(punch({ todayRow: { clock_in: "08:00", source: null } }).body.error, "This day already has an attendance record.");
  const manager = punch({ workspace: "hr", employeeId: "99999999-9999-4999-8999-999999999999" });
  assert.equal(manager.write.attendanceDate, "2026-11-06");
  assert.equal(manager.write.side, "in");
  assert.equal(manager.audit.employeeId, employee.id);
  assert.equal(punch({ workspace: "owner" }).body.error, "This punch is only for a signed-in staff account.");
  assert.equal(punch({ employee: null }).body.error, "This account is not linked to an employee.");
  for (const result of [
    punch({ leaves: [{ startDate: "2026-11-06", endDate: "2026-11-06" }] }),
    punch({ todayRow: { ...open, source: "fingerspot" } }),
    punch({ latitude: -6.21 }),
  ]) {
    assert.equal(result.write, null);
  }
});

test("a repeat key and a second tap inside a minute do not become clock-out", () => {
  const stored = { status: 400, body: { error: "You are outside the punch site." } };
  const replay = punch({ receipt: stored, latitude: -6.2 });
  assert.equal(replay.status, 400);
  assert.equal(replay.write, null);
  assert.equal(replay.audit, null);

  const open = {
    id: "55555555-5555-4555-8555-555555555555",
    employee_id: employee.id,
    attendance_date: "2026-11-06",
    clock_in: "08:00:00",
    source: "phone",
    status: "PRESENT",
    clock_in_at: "2026-11-06T01:09:30.000Z",
    clock_in_photo_path: "amg/EMP01/attendance/2026-11-06-in.jpg",
  };
  const kept = punch({
    now: new Date("2026-11-06T08:10:00+07:00"),
    idempotencyKey: "66666666-6666-4666-8666-666666666666",
    todayRow: open,
  });
  assert.equal(kept.body.outcome, "kept");
  assert.equal(kept.write, null);
  assert.equal(JSON.stringify(kept).includes("clock_in_photo_path"), false);

  const out = punch({
    now: new Date("2026-11-06T17:05:00+07:00"),
    todayRow: { ...open, clock_in_at: "2026-11-06T01:00:00.000Z" },
    shiftsByDate: {},
  });
  assert.equal(out.write.side, "out");
  assert.equal(out.write.clock, "17:05");
  assert.equal(out.write.attendanceDate, "2026-11-06");
});

test("a punch before 05:00 closes the open day, and 05:00 starts today", () => {
  const previous = { clock_in: "22:00", clock_out: null, source: "phone", status: "PRESENT", late_minutes: null, clock_in_at: "2026-11-05T15:00:00.000Z" };
  const night = punch({ now: new Date("2026-11-06T00:30:00+07:00"), previousRow: previous, todayRow: null });
  assert.equal(night.write.attendanceDate, "2026-11-05");
  assert.equal(night.write.side, "out");
  assert.equal(night.write.clock, "00:30");

  const today = punch({ now: new Date("2026-11-06T05:00:00+07:00"), previousRow: previous, todayRow: null, shiftsByDate: {} });
  assert.equal(today.write.attendanceDate, "2026-11-06");
  assert.equal(today.write.side, "in");
  assert.equal(today.write.lateMinutes, null);
  assert.equal(today.write.status, "PRESENT");
});

test("a missing shift and a midnight shift do not invent a late time", () => {
  const none = punch({ shiftsByDate: {} });
  assert.equal(none.write.lateMinutes, null);
  assert.equal(none.write.status, "PRESENT");
  const crossing = punch({ shiftsByDate: { "2026-11-06": { start: "22:00", crossesMidnight: true } } });
  assert.equal(crossing.write.lateMinutes, null);
});

test("too many attempts stop, and the photo path stays inside the company", () => {
  assert.equal(punch({ attemptCount: 30 }).status, 429);
  assert.equal(punchPhotoRelative("bzg", employee.id, "2026-11-06", "in"), `bzg/${employee.id}/attendance/2026-11-06-in.jpg`);
  assert.equal(punchPhotoRelative("../bzg", employee.id, "2026-11-06", "in"), null);
  assert.equal(punchPhotoRelative("bzg", employee.id, "2026-11-06", "out/../in"), null);
});

test("mine tells the employee the next punch and a fingerprint day stays blocked", () => {
  const mine = describeMine({
    now: morning,
    todayRow: { attendance_date: "2026-11-06", clock_in: "08:00", source: "phone", status: "LATE", late_minutes: 10, clock_in_site_name: "UMA BLU" },
    previousRow: null,
    leaves: [],
  });
  assert.equal(mine.next, "out");
  assert.equal(mine.day.clock_in_site_name, "UMA BLU");
  const blocked = describeMine({
    now: morning,
    todayRow: { attendance_date: "2026-11-06", clock_in: "08:00", source: "fingerspot", status: "INCOMPLETE" },
    previousRow: null,
    leaves: [],
  });
  assert.equal(blocked.next, null);
  assert.equal(blocked.blocked_reason, "This day belongs to the fingerprint device.");
});

test("HR saves a site only with a real radius, and a correction keeps the photo columns alone", () => {
  assert.equal(punchSiteInput({ name: "Hotel", latitude: -6.2, longitude: 106.8, radius_meters: 29 }).ok, false);
  assert.equal(punchSiteInput({ name: "Hotel", latitude: -6.2, longitude: 106.8, radius_meters: 250 }).ok, true);
  assert.equal(punchSiteInput({ name: "Hotel", latitude: "-6.2", longitude: 106.8, radius_meters: 100 }).ok, false);
  const requested = planCorrectionRequest({
    workspace: "hr",
    employee,
    attendanceDate: "2026-11-06",
    clockIn: "08:05",
    clockOut: null,
    reason: "",
  });
  assert.equal(requested.body.error, "A reason is required.");
  const filed = planCorrectionRequest({
    workspace: "hr",
    employee,
    attendanceDate: "2026-11-06",
    clockIn: "08:05",
    reason: "Missed the phone punch",
  });
  assert.equal(filed.status, 201);
  const approved = planCorrectionApproval({
    workspace: "hr",
    reviewerId: "reviewer",
    correction: { ...filed.request, status: "PENDING", requestedBy: "reviewer" },
    existing: { status: "PRESENT", clock_in: "08:00", source: "phone", clock_in_photo_path: "secret.jpg" },
    shift: { start: "08:00", crossesMidnight: false },
  });
  assert.equal(approved.status, 403);
  const applied = planCorrectionApproval({
    workspace: "hr",
    reviewerId: "reviewer",
    correction: { ...filed.request, status: "PENDING", requestedBy: "staff" },
    existing: { status: "PRESENT", clock_in: "08:00", source: "fingerspot", clock_in_photo_path: "secret.jpg" },
    shift: { start: "08:00", crossesMidnight: false },
  });
  assert.equal(applied.apply.source, "correction");
  assert.equal(applied.apply.clockIn, "08:05");
  assert.equal(applied.apply.lateMinutes, 5);
  assert.equal("clock_in_photo_path" in applied.apply, false);
  assert.equal(correctionAttendanceSql.includes("photo"), false);
  const onLeave = planCorrectionApproval({
    workspace: "hr",
    reviewerId: "reviewer",
    correction: { ...filed.request, status: "PENDING", requestedBy: "staff" },
    existing: { status: "ON_LEAVE" },
    shift: null,
  });
  assert.equal(onLeave.body.error, "This day is on leave.");
});

test("a workforce login links one matching employee and does not take another person's row", () => {
  const userId = "11111111-1111-4111-8111-111111111111";
  const existing = { id: "22222222-2222-4222-8222-222222222222", email: "Person@Example.Test", self_service_user_id: null, employment_status: "ACTIVE" };
  assert.equal(planWorkforceLink({ companyId: "amg", userId, email: "person@example.test", linkedRows: [], emailRows: [existing] }).action, "link");
  assert.equal(planWorkforceLink({ companyId: "amg", userId, email: "person@example.test", linkedRows: [{ id: existing.id }], emailRows: [] }).action, "use");
  assert.equal(planWorkforceLink({
    companyId: "amg",
    userId,
    email: "person@example.test",
    linkedRows: [],
    emailRows: [{ ...existing, self_service_user_id: "33333333-3333-4333-8333-333333333333" }],
  }).error, "This email already belongs to another login.");
  assert.equal(planWorkforceLink({
    companyId: "amg",
    userId,
    email: "person@example.test",
    linkedRows: [],
    emailRows: [existing, { ...existing, id: "44444444-4444-4444-8444-444444444444" }],
  }).error, "More than one employee uses this email.");
  assert.equal(planWorkforceLink({ companyId: "amg", userId, email: "person@example.test", linkedRows: [], emailRows: [{ ...existing, employment_status: "TERMINATED" }] }).error, "This employee is not active.");
  assert.equal(planEmployeeEmail("", 0).status, 400);
  assert.equal(planEmployeeEmail("person@example.test", 1).status, 409);
  assert.equal(planEmployeeEmail("person@example.test", 0).email, "person@example.test");
  const missing = planWorkforceLink({ companyId: "amg", userId, email: "operator.dev@wolf-command.test", linkedRows: [], emailRows: [] });
  assert.equal(missing.action, "refuse");
  assert.equal(missing.error, "This account is not linked to an employee.");
  assert.equal(planWorkforceLink({ companyId: "bzg", userId, email: "person@example.test", linkedRows: [], emailRows: [existing] }).action, "link");
  assert.equal(planWorkforceLink({ companyId: "amg", userId: "user-1", email: "not-an-email", linkedRows: [], emailRows: [] }).error, "This account is not linked to an employee.");
});

function assertion(workspace, email) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: "wolf",
    aud: "hris",
    sub: "user-1",
    companyId: "bzg",
    workspace,
    ...(email ? { email } : {}),
    iat: now,
    exp: now + 120,
    jti: "0123456789abcdef",
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", "local-test-assertion-secret-32chars").update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

test("the punch route records only the signed-in employee", async () => {
  const previous = process.env.WOLF_HR_ASSERTION_SECRET;
  process.env.WOLF_HR_ASSERTION_SECRET = "local-test-assertion-secret-32chars";
  const calls = [];
  const original = db.acceptPhonePunch;
  db.acceptPhonePunch = async (input) => {
    calls.push(input);
    return { status: 200, body: { outcome: "recorded", message: "Clocked in at 08:10." } };
  };
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  try {
    const staff = await fetch(`http://127.0.0.1:${port}/api/attendance/punch`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-wolf-hr-assertion": assertion("hr", "operator.dev@wolf-command.test") },
      body: JSON.stringify({
        employee_id: "99999999-9999-4999-8999-999999999999",
        email: "other@example.test",
        attendance_date: "1999-01-01",
        inside: true,
        photo: "abc",
        latitude: 1,
        longitude: 2,
        accuracy: 10,
        idempotency_key: key,
      }),
    });
    assert.equal(staff.status, 200);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].workspace, "hr");
    assert.equal(calls[0].userId, "user-1");
    assert.equal(calls[0].email, "operator.dev@wolf-command.test");
    assert.equal(JSON.stringify(calls[0]).includes("other@example.test"), false);
    assert.equal(calls[0].employeeId, undefined);
    assert.equal(JSON.stringify(calls[0]).includes("99999999"), false);

    const self = await fetch(`http://127.0.0.1:${port}/api/attendance/punch`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-wolf-hr-assertion": assertion("self") },
      body: JSON.stringify({
        employee_id: "99999999-9999-4999-8999-999999999999",
        attendance_date: "1999-01-01",
        inside: true,
        photo: "abc",
        latitude: 1,
        longitude: 2,
        accuracy: 10,
        idempotency_key: key,
      }),
    });
    assert.equal(self.status, 200);
    assert.equal(calls.length, 2);
    assert.equal(calls[1].workspace, "self");
    assert.equal(calls[1].userId, "user-1");
    assert.equal(calls[0].companyId, "bzg");
    assert.equal(calls[0].employeeId, undefined);
    assert.equal(calls[0].idempotencyKey, key);
    assert.equal(JSON.stringify(calls[0]).includes("1999-01-01"), false);
    assert.equal(JSON.stringify(calls[0]).includes("99999999"), false);
  } finally {
    server.close();
    await once(server, "close");
    db.acceptPhonePunch = original;
    if (previous === undefined) delete process.env.WOLF_HR_ASSERTION_SECRET;
    else process.env.WOLF_HR_ASSERTION_SECRET = previous;
  }
});

test("a later fingerprint scan does not rewrite a phone day", () => {
  assert.equal(fingerspotMayRewrite("phone"), false);
  assert.equal(fingerspotMayRewrite("correction"), false);
  assert.equal(fingerspotMayRewrite("fingerspot"), true);
  assert.equal(fingerspotMayRewrite(null), true);
  const matched = matchPunchSite(-6.2, 106.8, [{ ...site, radiusMeters: 1000 }]);
  assert.equal(matched, null);
});
