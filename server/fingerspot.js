const scanPattern = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})(?::(\d{2}))?$/;

function cleanText(value, max) {
  if (typeof value !== "string") return "";
  const text = value.trim();
  if (!text || text.length > max || /[\0\r\n]/.test(text)) return "";
  return text;
}

function wholeNumber(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 && number <= 9 ? number : null;
}

export function parseAttlog(body) {
  if (!body || body.type !== "attlog" || !body.data || typeof body.data !== "object") return { ok: false };
  const cloudId = cleanText(body.cloud_id, 64);
  const pin = cleanText(String(body.data.pin ?? ""), 32);
  const matched = scanPattern.exec(cleanText(String(body.data.scan ?? ""), 19));
  const verify = wholeNumber(body.data.verify);
  const statusScan = wholeNumber(body.data.status_scan);
  if (!cloudId || !pin || !matched || verify === null || statusScan === null) return { ok: false };
  return {
    ok: true,
    cloudId,
    pin,
    scannedAt: `${matched[1]} ${matched[2]}:${matched[3] || "00"}`,
    attendanceDate: matched[1],
    clock: matched[2],
    verify,
    statusScan,
  };
}

export function minutesAfter(clock, shiftStart) {
  const [leftHour, leftMinute] = clock.split(":").map(Number);
  const [rightHour, rightMinute] = shiftStart.split(":").map(Number);
  return leftHour * 60 + leftMinute - (rightHour * 60 + rightMinute);
}

export function rollupScans(scans, shiftStart) {
  const ordered = [...scans].sort((left, right) => left.scannedAt.localeCompare(right.scannedAt));
  const ins = ordered.filter((scan) => scan.statusScan === 0);
  const outs = ordered.filter((scan) => scan.statusScan === 1);
  const clockIn = ins[0]?.clock || null;
  const clockOut = outs.length ? outs[outs.length - 1].clock : null;
  if (!clockIn && !clockOut) return null;
  let status = clockIn && clockOut ? "PRESENT" : "INCOMPLETE";
  let lateMinutes = null;
  if (clockIn && shiftStart && !shiftStart.crossesMidnight) {
    const late = minutesAfter(clockIn, shiftStart.start);
    if (late > 0) {
      lateMinutes = clockOut ? late : null;
      if (clockOut) status = "LATE";
    } else if (clockOut) {
      lateMinutes = 0;
    }
  }
  return {
    attendanceDate: ordered[0].attendanceDate,
    clockIn,
    clockOut,
    status,
    lateMinutes,
  };
}

export function planAttlog({ body, device, duplicate, employeeId, dayScans, shiftStart }) {
  const parsed = parseAttlog(body);
  if (!parsed.ok) return { status: 400, body: { error: "Fingerprint scan is not valid." } };
  if (!device?.companyId) return { status: 404, body: { error: "Fingerprint device is not connected." } };
  if (duplicate) return { status: 200, body: { outcome: "duplicate" } };
  const scan = {
    cloudId: parsed.cloudId,
    pin: parsed.pin,
    scannedAt: parsed.scannedAt,
    attendanceDate: parsed.attendanceDate,
    clock: parsed.clock,
    verify: parsed.verify,
    statusScan: parsed.statusScan,
    companyId: device.companyId,
    employeeId: employeeId || null,
  };
  if (!employeeId) return { status: 202, body: { outcome: "unpaired" }, scan };
  const attendance = rollupScans([...dayScans, scan], shiftStart);
  return {
    status: 200,
    body: { outcome: attendance ? "recorded" : "stored", companyId: device.companyId },
    scan,
    attendance,
  };
}

export function fingerspotMayRewrite(source) {
  return source == null || source === "fingerspot";
}

export function webhookSecretAccepts(secret, provided) {
  return typeof secret === "string" && secret.length >= 16 && !/\s/.test(secret) && provided === secret;
}
