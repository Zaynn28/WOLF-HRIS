import {
  isSharedTariff,
  parseRateBp,
  parseWageBase,
  readRateBp,
  readWageBase,
  tariffWageBaseCycles,
} from "./payroll-tariff.js";

const codePattern = /^[a-z][a-z0-9_]{0,31}$/;
const formulaNames = new Set(["gross", "net"]);
const blockedKey = /salary|gaji|amount|pokok|private|secret|password|token|otp|cookie|payload/i;

function blankTariff(component) {
  return { ...component, rateBp: null, wageBase: [] };
}

export function defaultPayrollStructure() {
  return {
    effectiveFrom: null,
    grossFormula: "basic + transport + komunikasi + bpjsk_allowance + jht_allowance + jp_allowance + bonus + overtime + tax_allowance",
    netFormula: "gross - kasbon - jp_employee - bpjsk_employee - jht_employee - pph21",
    source: "company",
    components: [
      { code: "full_basic", displayName: "Full Basic Salary", kind: "earning", sortOrder: 10, active: true, rateBp: null, wageBase: [] },
      { code: "basic", displayName: "Basic Salary", kind: "earning", sortOrder: 20, active: true, rateBp: null, wageBase: [] },
      { code: "transport", displayName: "Tunjangan Transport", kind: "earning", sortOrder: 30, active: true, rateBp: null, wageBase: [] },
      { code: "komunikasi", displayName: "Tunjangan Komunikasi", kind: "earning", sortOrder: 40, active: true, rateBp: null, wageBase: [] },
      { code: "bpjsk_allowance", displayName: "BPJS Kesehatan Allowance", kind: "earning", sortOrder: 50, active: true, rateBp: null, wageBase: [] },
      { code: "jht_allowance", displayName: "JHT Employee Allowance", kind: "earning", sortOrder: 60, active: true, rateBp: null, wageBase: [] },
      { code: "jp_allowance", displayName: "JP Employee Allowance", kind: "earning", sortOrder: 70, active: true, rateBp: null, wageBase: [] },
      { code: "bonus", displayName: "Bonus", kind: "earning", sortOrder: 80, active: true, rateBp: null, wageBase: [] },
      { code: "overtime", displayName: "Overtime", kind: "earning", sortOrder: 90, active: true, rateBp: null, wageBase: [] },
      { code: "tax_allowance", displayName: "Tax Allowance", kind: "earning", sortOrder: 100, active: true, rateBp: null, wageBase: [] },
      { code: "kasbon", displayName: "Kasbon", kind: "deduction", sortOrder: 110, active: true, rateBp: null, wageBase: [] },
      { code: "jp_employee", displayName: "Jaminan Pensiun Employee", kind: "deduction", sortOrder: 120, active: true, rateBp: null, wageBase: [] },
      { code: "bpjsk_employee", displayName: "BPJS Kesehatan Employee", kind: "deduction", sortOrder: 130, active: true, rateBp: null, wageBase: [] },
      { code: "jht_employee", displayName: "JHT Employee", kind: "deduction", sortOrder: 140, active: true, rateBp: null, wageBase: [] },
      { code: "pph21", displayName: "PPh 21", kind: "deduction", sortOrder: 150, active: true, rateBp: null, wageBase: [] },
      { code: "jkk", displayName: "JKK", kind: "earning", sortOrder: 160, active: true, rateBp: null, wageBase: [] },
      { code: "jkm", displayName: "JKM", kind: "earning", sortOrder: 170, active: true, rateBp: null, wageBase: [] },
      { code: "jht_company", displayName: "JHT Company", kind: "earning", sortOrder: 180, active: true, rateBp: null, wageBase: [] },
      { code: "jp_company", displayName: "Jaminan Pensiun Company", kind: "earning", sortOrder: 190, active: true, rateBp: null, wageBase: [] },
      { code: "bpjsk_company", displayName: "BPJS Kesehatan Company", kind: "earning", sortOrder: 200, active: true, rateBp: null, wageBase: [] },
    ],
  };
}

function blockedKeys(value) {
  if (!value || typeof value !== "object") return false;
  for (const key of Object.keys(value)) {
    if (blockedKey.test(key)) return true;
    if (blockedKeys(value[key])) return true;
  }
  return false;
}

function tokenize(source) {
  const tokens = [];
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    if (char === " " || char === "\t") {
      index += 1;
      continue;
    }
    if (char === "+" || char === "-" || char === "(" || char === ")") {
      tokens.push({ type: char });
      index += 1;
      continue;
    }
    if (char === "/" || char === "*" || char === "%") {
      return { ok: false, error: "The formula only allows addition and subtraction." };
    }
    if (char >= "0" && char <= "9") {
      return { ok: false, error: "The formula only allows component codes." };
    }
    if (char >= "a" && char <= "z") {
      let end = index + 1;
      while (end < source.length && /[a-z0-9_]/.test(source[end])) end += 1;
      const code = source.slice(index, end);
      if (!codePattern.test(code)) return { ok: false, error: "The formula is not valid." };
      tokens.push({ type: "code", code });
      index = end;
      continue;
    }
    return { ok: false, error: "The formula is not valid." };
  }
  return { ok: true, tokens };
}

export function parseFormula(source) {
  if (typeof source !== "string") return { ok: false, error: "The formula is not valid." };
  const trimmed = source.trim();
  if (!trimmed) return { ok: false, error: "The formula is empty." };
  if (trimmed.length > 240) return { ok: false, error: "The formula is not valid." };
  const tokenized = tokenize(trimmed);
  if (!tokenized.ok) return tokenized;
  const tokens = tokenized.tokens;
  if (tokens.length === 0) return { ok: false, error: "The formula is empty." };
  let index = 0;
  const peek = () => tokens[index];
  const take = () => tokens[index++];
  function parseExpr() {
    let left = parseTerm();
    if (!left.ok) return left;
    while (peek() && (peek().type === "+" || peek().type === "-")) {
      const operator = take().type;
      const right = parseTerm();
      if (!right.ok) return right;
      left = { ok: true, ast: { type: operator === "+" ? "add" : "sub", left: left.ast, right: right.ast } };
    }
    return left;
  }
  function parseTerm() {
    const token = peek();
    if (!token) return { ok: false, error: "The formula is not valid." };
    if (token.type === "code") {
      take();
      return { ok: true, ast: { type: "code", code: token.code } };
    }
    if (token.type === "(") {
      take();
      const inner = parseExpr();
      if (!inner.ok) return inner;
      if (!peek() || peek().type !== ")") return { ok: false, error: "The formula is not valid." };
      take();
      return inner;
    }
    return { ok: false, error: "The formula is not valid." };
  }
  const parsed = parseExpr();
  if (!parsed.ok) return parsed;
  if (index !== tokens.length) return { ok: false, error: "The formula is not valid." };
  return { ok: true, ast: parsed.ast, formula: trimmed };
}

function walk(ast, visit) {
  visit(ast);
  if (ast.type === "add" || ast.type === "sub") {
    walk(ast.left, visit);
    walk(ast.right, visit);
  }
}

function references(ast) {
  const formulas = new Set();
  const codes = new Set();
  walk(ast, (node) => {
    if (node.type !== "code") return;
    if (formulaNames.has(node.code)) formulas.add(node.code);
    else codes.add(node.code);
  });
  return { formulas, codes };
}

function cycles(graph) {
  const state = new Map();
  function visit(node) {
    const mark = state.get(node) ?? 0;
    if (mark === 1) return true;
    if (mark === 2) return false;
    state.set(node, 1);
    for (const next of graph.get(node) ?? []) {
      if (visit(next)) return true;
    }
    state.set(node, 2);
    return false;
  }
  for (const node of graph.keys()) {
    if (visit(node)) return true;
  }
  return false;
}

function wholeNumber(value) {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) return null;
  return value;
}

function evaluateAst(ast, amounts, results) {
  if (ast.type === "code") {
    if (Object.prototype.hasOwnProperty.call(results, ast.code)) return wholeNumber(results[ast.code]);
    if (!Object.prototype.hasOwnProperty.call(amounts, ast.code)) return null;
    return wholeNumber(amounts[ast.code]);
  }
  const left = evaluateAst(ast.left, amounts, results);
  const right = evaluateAst(ast.right, amounts, results);
  if (left == null || right == null) return null;
  const value = ast.type === "add" ? left + right : left - right;
  return wholeNumber(value);
}

export function evaluatePayroll(structure, amounts) {
  const grossParsed = parseFormula(structure?.grossFormula);
  const netParsed = parseFormula(structure?.netFormula);
  if (!grossParsed.ok || !netParsed.ok) return { gross: null, net: null };
  const grossRefs = references(grossParsed.ast);
  const netRefs = references(netParsed.ast);
  const values = amounts && typeof amounts === "object" ? amounts : {};
  if (grossRefs.formulas.has("net") && !netRefs.formulas.has("gross")) {
    const net = evaluateAst(netParsed.ast, values, {});
    const gross = evaluateAst(grossParsed.ast, values, { net });
    return { gross, net };
  }
  const gross = evaluateAst(grossParsed.ast, values, {});
  const net = evaluateAst(netParsed.ast, values, { gross });
  return { gross, net };
}

function componentInput(component, index) {
  if (!component || typeof component !== "object" || Array.isArray(component)) return { ok: false, error: "The payroll structure is not valid." };
  const code = component.code;
  const displayName = typeof component.display_name === "string" ? component.display_name.trim() : "";
  const kind = component.kind;
  if (typeof code !== "string" || !codePattern.test(code) || formulaNames.has(code)) {
    return { ok: false, error: "A component code is not valid." };
  }
  if (!displayName || displayName.length > 80 || /[\r\n\0]/.test(displayName)) {
    return { ok: false, error: "A component name is not valid." };
  }
  if (kind !== "earning" && kind !== "deduction") return { ok: false, error: "A component kind is not valid." };
  if (code === "basic" && kind !== "earning") return { ok: false, error: "The basic component has to stay an earning." };
  if (typeof component.active !== "boolean") return { ok: false, error: "The payroll structure is not valid." };
  return {
    ok: true,
    component: blankTariff({ code, displayName, kind, sortOrder: (index + 1) * 10, active: component.active }),
  };
}

function attachTariffs(components, rawComponents) {
  const known = new Set(components.map((component) => component.code));
  const next = [];
  for (let index = 0; index < components.length; index += 1) {
    const component = components[index];
    const raw = rawComponents[index] ?? {};
    const rate = parseRateBp(raw.rate_bp);
    const base = parseWageBase(raw.wage_base, component.code, known);
    if (!isSharedTariff(component.code)) {
      if (!rate.ok || !base.ok || rate.rateBp != null || (base.ok && base.wageBase.length > 0)) {
        return { ok: false, error: "That component does not take a company tariff." };
      }
      next.push(blankTariff(component));
      continue;
    }
    if (!rate.ok) return { ok: false, error: "A company tariff percent is not valid." };
    if (!base.ok) return { ok: false, error: "A tariff wage base is not valid." };
    next.push({ ...component, rateBp: rate.rateBp, wageBase: base.wageBase });
  }
  if (tariffWageBaseCycles(next)) return { ok: false, error: "A tariff wage base cannot depend on itself." };
  return { ok: true, components: next };
}

export function validatePayrollStructure(input) {
  const source = input && typeof input === "object" ? input : {};
  const rawComponents = source.components;
  if (!Array.isArray(rawComponents) || rawComponents.length === 0 || rawComponents.length > 24) {
    return { ok: false, error: "The payroll structure is not valid." };
  }
  const components = [];
  const seen = new Set();
  for (let index = 0; index < rawComponents.length; index += 1) {
    const parsed = componentInput(rawComponents[index], index);
    if (!parsed.ok) return parsed;
    if (seen.has(parsed.component.code)) return { ok: false, error: "A component code is repeated." };
    seen.add(parsed.component.code);
    components.push(parsed.component);
  }
  const withTariffs = attachTariffs(components, rawComponents);
  if (!withTariffs.ok) return withTariffs;
  components.splice(0, components.length, ...withTariffs.components);
  const basic = components.find((component) => component.code === "basic");
  if (!basic) return { ok: false, error: "The basic component has to stay on the structure." };
  const active = new Set(components.filter((component) => component.active).map((component) => component.code));
  const grossParsed = parseFormula(source.grossFormula);
  if (!grossParsed.ok) return grossParsed;
  const netParsed = parseFormula(source.netFormula);
  if (!netParsed.ok) return netParsed;
  const grossRefs = references(grossParsed.ast);
  const netRefs = references(netParsed.ast);
  for (const code of [...grossRefs.codes, ...netRefs.codes]) {
    if (!active.has(code)) return { ok: false, error: "The formula uses an unknown component." };
  }
  const graph = new Map([
    ["gross", grossRefs.formulas],
    ["net", netRefs.formulas],
  ]);
  if (cycles(graph)) return { ok: false, error: "The formulas cycle." };
  return {
    ok: true,
    structure: {
      effectiveFrom: null,
      grossFormula: grossParsed.formula,
      netFormula: netParsed.formula,
      source: "company",
      components,
    },
  };
}

export function payrollStructureInput(body) {
  if (!body || typeof body !== "object" || Array.isArray(body) || blockedKeys(body)) {
    return { ok: false, error: "The payroll structure is not valid." };
  }
  return validatePayrollStructure({
    grossFormula: body.gross_formula,
    netFormula: body.net_formula,
    components: body.components,
  });
}

export function periodStructureWrite(existing, current) {
  if (existing) return null;
  return current ?? null;
}

export function structureFromParts(header, components, source) {
  const list = Array.isArray(components) ? components : [];
  return {
    effectiveFrom: header?.effective_from ? String(header.effective_from).slice(0, 10) : null,
    grossFormula: header?.gross_formula,
    netFormula: header?.net_formula,
    source: source === "period" ? "period" : "company",
    components: list.map((component) => ({
      code: component.code,
      displayName: component.display_name,
      kind: component.kind,
      sortOrder: Number(component.sort_order),
      active: component.active === true,
      rateBp: readRateBp(component.rate_bp),
      wageBase: readWageBase(component.wage_base),
    })).sort((left, right) => left.sortOrder - right.sortOrder || left.code.localeCompare(right.code)),
  };
}

export function payrollComponentSnapshot(components) {
  return (components ?? []).map((component) => ({
    code: component.code,
    display_name: component.displayName,
    kind: component.kind,
    sort_order: component.sortOrder,
    active: component.active === true,
    rate_bp: Number.isInteger(component.rateBp) ? component.rateBp : null,
    wage_base: Array.isArray(component.wageBase) ? component.wageBase.slice() : [],
  }));
}

export function presentPayrollStructure(companyId, structure) {
  const view = structure ?? defaultPayrollStructure();
  return {
    company_id: companyId,
    effective_from: view.effectiveFrom,
    gross_formula: view.grossFormula,
    net_formula: view.netFormula,
    source: view.source === "period" ? "period" : "company",
    components: payrollComponentSnapshot(view.components),
  };
}
