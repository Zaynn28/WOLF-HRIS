const codePattern = /^[a-z][a-z0-9_]{0,31}$/;

export const sharedTariffCodes = new Set([
  "bpjsk_allowance",
  "jht_allowance",
  "jp_allowance",
  "jp_employee",
  "bpjsk_employee",
  "jht_employee",
  "jkk",
  "jkm",
  "jht_company",
  "jp_company",
  "bpjsk_company",
]);

export function isSharedTariff(code) {
  return sharedTariffCodes.has(code);
}

export function basisPointsFromPercent(text) {
  if (typeof text !== "string") return null;
  const trimmed = text.trim();
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(trimmed)) return null;
  const [whole, fraction = ""] = trimmed.split(".");
  const basisPoints = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(basisPoints) || basisPoints > 10000) return null;
  return basisPoints;
}

export function parseRateBp(value) {
  if (value == null || value === "") return { ok: true, rateBp: null };
  if (typeof value === "string") {
    if (!/^\d+$/.test(value)) return { ok: false };
    value = Number(value);
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 10000) {
    return { ok: false };
  }
  return { ok: true, rateBp: value };
}

export function readRateBp(value) {
  const parsed = parseRateBp(value);
  return parsed.ok ? parsed.rateBp : null;
}

export function parseWageBase(value, code, known) {
  if (value == null) return { ok: true, wageBase: [] };
  if (!Array.isArray(value) || value.length > 24) return { ok: false };
  const wageBase = [];
  const seen = new Set();
  for (const item of value) {
    if (typeof item !== "string" || !codePattern.test(item) || item === code || seen.has(item) || !known.has(item)) {
      return { ok: false };
    }
    seen.add(item);
    wageBase.push(item);
  }
  return { ok: true, wageBase };
}

export function readWageBase(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((code) => typeof code === "string" && codePattern.test(code));
}

export function tariffWageBaseCycles(components) {
  const tariffs = new Map();
  for (const component of components ?? []) {
    if (!isSharedTariff(component.code)) continue;
    const deps = (component.wageBase ?? []).filter((code) => isSharedTariff(code));
    tariffs.set(component.code, deps);
  }
  const state = new Map();
  function visit(code) {
    const mark = state.get(code) ?? 0;
    if (mark === 1) return true;
    if (mark === 2) return false;
    state.set(code, 1);
    for (const next of tariffs.get(code) ?? []) {
      if (visit(next)) return true;
    }
    state.set(code, 2);
    return false;
  }
  for (const code of tariffs.keys()) {
    if (visit(code)) return true;
  }
  return false;
}

/**
 * Whole rupiah from a wage and a basis-point rate.
 * 100 basis points is one percent. Half-up, integers only.
 */
export function tariffAmount(wageBase, rateBp) {
  if (!Number.isSafeInteger(wageBase) || wageBase < 0) return null;
  if (!Number.isSafeInteger(rateBp) || rateBp < 0 || rateBp > 10000) return null;
  const product = wageBase * rateBp;
  if (!Number.isSafeInteger(product) || !Number.isSafeInteger(product + 5000)) return null;
  return Math.floor((product + 5000) / 10000);
}
