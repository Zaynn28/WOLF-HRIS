import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import app from "./index.js";
import { db } from "./database.js";
import { planAttlog } from "./fingerspot.js";

const secret = "local-fingerspot-webhook-secret";
const employeeId = "11111111-1111-4111-8111-111111111111";

function attlog(overrides = {}) {
  return {
    type: "attlog",
    cloud_id: "revo-amg",
    data: { pin: "7", scan: "2026-10-29 08:02", verify: 1, status_scan: 0, template: "SECRET-TEMPLATE", ...overrides },
  };
}

test("a mapped scan becomes one company attendance row and drops biometric templates", () => {
  const first = planAttlog({
    body: attlog(),
    device: { companyId: "amg" },
    duplicate: false,
    employeeId,
    dayScans: [],
    shiftStart: null,
  });
  assert.equal(first.status, 200);
  assert.equal(first.body.companyId, "amg");
  assert.equal(first.attendance.status, "INCOMPLETE");
  assert.equal(first.attendance.clockIn, "08:02");
  assert.equal(JSON.stringify(first).includes("SECRET-TEMPLATE"), false);
  assert.equal("template" in first.scan, false);

  const second = planAttlog({
    body: attlog({ scan: "2026-10-29 17:05", status_scan: 1 }),
    device: { companyId: "amg" },
    duplicate: false,
    employeeId,
    dayScans: [first.scan],
    shiftStart: { start: "08:00", crossesMidnight: false },
  });
  assert.equal(second.attendance.status, "LATE");
  assert.equal(second.attendance.clockOut, "17:05");
  assert.equal(second.attendance.lateMinutes, 2);

  const otherCompany = planAttlog({
    body: attlog({ cloud_id: "revo-bzg" }),
    device: { companyId: "bzg" },
    duplicate: false,
    employeeId,
    dayScans: [],
    shiftStart: null,
  });
  assert.equal(otherCompany.body.companyId, "bzg");
  assert.equal(otherCompany.scan.companyId, "bzg");
});

test("unknown devices, unpaired pins, and repeated scans do not create people or a second row", () => {
  const unknown = planAttlog({ body: attlog(), device: null, duplicate: false, employeeId: null, dayScans: [], shiftStart: null });
  assert.equal(unknown.status, 404);
  assert.equal(unknown.scan, undefined);

  const unpaired = planAttlog({ body: attlog(), device: { companyId: "amg" }, duplicate: false, employeeId: null, dayScans: [], shiftStart: null });
  assert.equal(unpaired.status, 202);
  assert.equal(unpaired.body.outcome, "unpaired");
  assert.equal(unpaired.attendance, undefined);

  const duplicate = planAttlog({ body: attlog(), device: { companyId: "amg" }, duplicate: true, employeeId, dayScans: [], shiftStart: null });
  assert.equal(duplicate.body.outcome, "duplicate");
  assert.equal(duplicate.attendance, undefined);

  const withoutShift = planAttlog({
    body: attlog({ scan: "2026-10-29 17:05", status_scan: 1 }),
    device: { companyId: "amg" },
    duplicate: false,
    employeeId,
    dayScans: [{ scannedAt: "2026-10-29 08:02:00", attendanceDate: "2026-10-29", clock: "08:02", statusScan: 0 }],
    shiftStart: null,
  });
  assert.equal(withoutShift.attendance.status, "PRESENT");
  assert.equal(withoutShift.attendance.lateMinutes, null);
});

test("the webhook refuses a missing secret and stores one accepted scan", async () => {
  const previous = process.env.WOLF_FINGERSPOT_WEBHOOK_SECRET;
  delete process.env.WOLF_FINGERSPOT_WEBHOOK_SECRET;
  const calls = [];
  const originalEnsure = db.ensureFingerspotTables;
  const originalAccept = db.acceptFingerspotAttlog;
  db.ensureFingerspotTables = async () => {
    calls.push("ensure");
  };
  db.acceptFingerspotAttlog = async (body) => {
    calls.push(body.data.pin);
    assert.equal("template" in body.data, true);
    return { status: 200, body: { outcome: "recorded", companyId: "amg" } };
  };
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  try {
    const refused = await fetch(`http://127.0.0.1:${port}/api/fingerspot/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(attlog()),
    });
    assert.equal(refused.status, 401);
    assert.equal(calls.length, 0);

    process.env.WOLF_FINGERSPOT_WEBHOOK_SECRET = secret;
    const accepted = await fetch(`http://127.0.0.1:${port}/api/fingerspot/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-wolf-fingerspot-broker": secret },
      body: JSON.stringify(attlog()),
    });
    assert.equal(accepted.status, 200);
    assert.deepEqual(await accepted.json(), { outcome: "recorded", companyId: "amg" });
    assert.deepEqual(calls, ["ensure", "7"]);

    const again = await fetch(`http://127.0.0.1:${port}/api/fingerspot/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-wolf-fingerspot-broker": secret },
      body: JSON.stringify(attlog()),
    });
    assert.equal(again.status, 200);
    db.acceptFingerspotAttlog = async () => ({ status: 200, body: { outcome: "duplicate" } });
    const duplicate = await fetch(`http://127.0.0.1:${port}/api/fingerspot/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-wolf-fingerspot-broker": secret },
      body: JSON.stringify(attlog()),
    });
    assert.equal((await duplicate.json()).outcome, "duplicate");
  } finally {
    server.close();
    await once(server, "close");
    db.ensureFingerspotTables = originalEnsure;
    db.acceptFingerspotAttlog = originalAccept;
    if (previous === undefined) delete process.env.WOLF_FINGERSPOT_WEBHOOK_SECRET;
    else process.env.WOLF_FINGERSPOT_WEBHOOK_SECRET = previous;
  }
});
