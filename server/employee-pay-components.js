import { isSharedTariff, tariffAmount } from "./payroll-tariff.js";

const codePattern = /^[a-z][a-z0-9_]{0,31}$/;
const standingExcluded = new Set([
  "basic",
  "full_basic",
  "overtime",
  "bonus",
  "tax_allowance",
  "bpjsk_allowance",
  "jht_allowance",
  "jp_allowance",
  "jkk",
  "jkm",
  "jht_company",
  "jp_company",
  "bpjsk_company",
]);

export function setsStandingAmount(component) {
  return component?.kind === "earning" && !standingExcluded.has(component.code);
}

export function assignableComponents(structure) {
  const components = Array.isArray(structure?.components) ? structure.components : [];
  return components
    .filter((component) => component && component.active === true && component.code !== "basic" && component.code !== "full_basic")
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder || left.code.localeCompare(right.code));
}

function wholeAmount(value) {
  if (typeof value === "string" && /^\d+$/.test(value)) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return value;
  return null;
}

export function eligibilityInput(body, structure) {
  const source = body && typeof body === "object" && !Array.isArray(body) ? body : null;
  const rows = source ? source.components : null;
  if (!Array.isArray(rows)) return { ok: false, error: "The component assignment is not valid." };
  const catalog = assignableComponents(structure);
  if (catalog.length === 0) return { ok: false, error: "Set payroll components before assigning them." };
  if (rows.length !== catalog.length) return { ok: false, error: "The component assignment is not complete." };
  const expected = new Map(catalog.map((component) => [component.code, component]));
  const seen = new Set();
  const components = [];
  for (const row of rows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) return { ok: false, error: "The component assignment is not valid." };
    const code = row.code;
    if (typeof code !== "string" || !codePattern.test(code) || seen.has(code) || !expected.has(code)) {
      return { ok: false, error: "A component code is not valid." };
    }
    seen.add(code);
    if (typeof row.eligible !== "boolean") return { ok: false, error: "The component assignment is not valid." };
    const component = expected.get(code);
    const standing = setsStandingAmount(component);
    if (!row.eligible) {
      if (row.amount != null && row.amount !== "") return { ok: false, error: "An ineligible component cannot have an amount." };
      components.push({ code, eligible: false, amount: null, setsAmount: standing });
      continue;
    }
    if (!standing) {
      if (row.amount != null && row.amount !== "") return { ok: false, error: "That component does not take a standing amount." };
      components.push({ code, eligible: true, amount: null, setsAmount: false });
      continue;
    }
    const amount = wholeAmount(row.amount);
    if (amount == null) return { ok: false, error: "Enter a whole rupiah amount." };
    components.push({ code, eligible: true, amount, setsAmount: true });
  }
  return { ok: true, components };
}

export function currentEligibility(rows, day) {
  const chosen = new Map();
  for (const row of rows ?? []) {
    if (!row || typeof row.effective_from !== "string" || row.effective_from > day) continue;
    const previous = chosen.get(row.component_code);
    if (!previous || previous.effective_from < row.effective_from) chosen.set(row.component_code, row);
  }
  return [...chosen.values()];
}

export function applyEligibility(amounts, rows, structure) {
  const next = amounts && typeof amounts === "object" ? { ...amounts } : {};
  const catalog = new Map(assignableComponents(structure).map((component) => [component.code, component]));
  for (const row of rows ?? []) {
    const component = catalog.get(row.component_code);
    if (!component || !setsStandingAmount(component)) continue;
    const amount = wholeAmount(row.amount);
    next[row.component_code] = row.eligible === true && amount != null ? amount : 0;
  }
  return next;
}

function storedAmount(amounts, code) {
  if (!amounts || !Object.prototype.hasOwnProperty.call(amounts, code)) return null;
  const value = amounts[code];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) return null;
  return value;
}

function tariffComponents(structure) {
  const components = Array.isArray(structure?.components) ? structure.components : [];
  return components
    .filter((component) => component && component.active === true && isSharedTariff(component.code))
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder || left.code.localeCompare(right.code));
}

export function structureWithCompanyTariffs(structure, company) {
  if (!structure) return company ?? null;
  const live = new Map((company?.components ?? []).map((component) => [component.code, component]));
  return {
    ...structure,
    components: structure.components.map((component) => {
      const source = live.get(component.code);
      if (!source || !isSharedTariff(component.code)) return component;
      return {
        ...component,
        rateBp: source.rateBp ?? null,
        wageBase: Array.isArray(source.wageBase) ? source.wageBase.slice() : [],
      };
    }),
  };
}

export function applyTariffs(amounts, rows, structure) {
  const next = amounts && typeof amounts === "object" ? { ...amounts } : {};
  const eligible = new Map((rows ?? []).map((row) => [row.component_code, row.eligible === true]));
  const components = tariffComponents(structure);
  const byCode = new Map(components.map((component) => [component.code, component]));
  const pending = new Set(components.map((component) => component.code));
  const resolved = new Set();
  const missing = [];

  function dependencies(code) {
    return (byCode.get(code)?.wageBase ?? []).filter((dep) => byCode.has(dep));
  }

  let guard = components.length + 1;
  while (pending.size > 0 && guard > 0) {
    guard -= 1;
    const ready = [...pending].filter((code) => dependencies(code).every((dep) => resolved.has(dep)));
    if (ready.length === 0) break;
    for (const code of ready) {
      pending.delete(code);
      resolved.add(code);
      const component = byCode.get(code);
      if (eligible.get(code) !== true) {
        next[code] = 0;
        continue;
      }
      const rateBp = component.rateBp;
      const wageBase = Array.isArray(component.wageBase) ? component.wageBase : [];
      if (rateBp == null || wageBase.length === 0 || wageBase.some((dep) => missing.includes(dep))) {
        delete next[code];
        missing.push(code);
        continue;
      }
      let wage = 0;
      let incomplete = false;
      for (const dep of wageBase) {
        const part = storedAmount(next, dep);
        if (part == null) {
          incomplete = true;
          break;
        }
        wage += part;
        if (!Number.isSafeInteger(wage)) {
          incomplete = true;
          break;
        }
      }
      const amount = incomplete ? null : tariffAmount(wage, rateBp);
      if (amount == null) {
        delete next[code];
        missing.push(code);
        continue;
      }
      next[code] = amount;
    }
  }
  for (const code of pending) {
    if (eligible.get(code) === true) {
      delete next[code];
      missing.push(code);
    } else {
      next[code] = 0;
    }
  }
  missing.sort((left, right) => (byCode.get(left)?.sortOrder ?? 0) - (byCode.get(right)?.sortOrder ?? 0) || left.localeCompare(right));
  return { amounts: next, missing };
}

export function applyPayOverlay(amounts, rows, structure) {
  return applyTariffs(applyEligibility(amounts, rows, structure), rows, structure);
}

export function presentEligibility(employeeId, structure, rows, day) {
  const current = new Map(currentEligibility(rows, day).map((row) => [row.component_code, row]));
  return {
    employee_id: employeeId,
    components: assignableComponents(structure).map((component) => {
      const saved = current.get(component.code);
      const standing = setsStandingAmount(component);
      return {
        code: component.code,
        display_name: component.displayName,
        kind: component.kind,
        sets_amount: standing,
        eligible: saved?.eligible === true,
        amount: standing && saved?.eligible === true ? wholeAmount(saved.amount) : null,
      };
    }),
  };
}
