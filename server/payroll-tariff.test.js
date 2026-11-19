import assert from "node:assert/strict";
import test from "node:test";
import { applyPayOverlay, structureWithCompanyTariffs } from "./employee-pay-components.js";
import { defaultPayrollStructure, evaluatePayroll, validatePayrollStructure } from "./payroll-structure.js";
import { basisPointsFromPercent, tariffAmount } from "./payroll-tariff.js";

function rawStructure(overrides = {}) {
  return {
    grossFormula: defaultPayrollStructure().grossFormula,
    netFormula: defaultPayrollStructure().netFormula,
    components: defaultPayrollStructure().components.map((component) => ({
      code: component.code,
      display_name: component.displayName,
      kind: component.kind,
      active: true,
      rate_bp: overrides[component.code]?.rate_bp ?? null,
      wage_base: overrides[component.code]?.wage_base ?? [],
    })),
  };
}

function amountsFor(basic, extra = {}) {
  const amounts = {};
  for (const component of defaultPayrollStructure().components) amounts[component.code] = 0;
  amounts.basic = basic;
  amounts.full_basic = basic;
  return { ...amounts, ...extra };
}

function rated(overrides) {
  const parsed = validatePayrollStructure(rawStructure(overrides));
  assert.equal(parsed.ok, true);
  return parsed.structure;
}

test("54 basis points is the stored form of a 0.54 percent tariff", () => {
  assert.equal(basisPointsFromPercent("0.54"), 54);
  assert.equal(tariffAmount(10000000, basisPointsFromPercent("0.54")), 54000);
});

test("370 basis points is the stored form of a 3.70 percent tariff", () => {
  assert.equal(basisPointsFromPercent("3.70"), 370);
  assert.equal(tariffAmount(5000000, basisPointsFromPercent("3.70")), 185000);
  assert.equal(tariffAmount(100, 50), 1);
  assert.equal(tariffAmount(99, 50), 0);
});

test("the wage base is the one stored on the component", () => {
  const structure = rated({
    jkk: { rate_bp: 54, wage_base: ["basic", "transport"] },
  });
  const withTransport = applyPayOverlay(amountsFor(10000000, { transport: 500000 }), [
    { component_code: "jkk", eligible: true },
    { component_code: "transport", eligible: true, amount: 500000 },
  ], structure);
  assert.equal(withTransport.amounts.jkk, 56700);
  const basicOnly = rated({ jkk: { rate_bp: 54, wage_base: ["basic"] } });
  const withoutTransport = applyPayOverlay(amountsFor(10000000, { transport: 500000 }), [
    { component_code: "jkk", eligible: true },
    { component_code: "transport", eligible: true, amount: 500000 },
  ], basicOnly);
  assert.equal(withoutTransport.amounts.jkk, 54000);
});

test("a missing tariff is not treated as zero", () => {
  const structure = rated({ jht_employee: { rate_bp: null, wage_base: ["basic"] } });
  const overlay = applyPayOverlay(amountsFor(5000000), [
    { component_code: "jht_employee", eligible: true },
  ], structure);
  assert.equal(Object.prototype.hasOwnProperty.call(overlay.amounts, "jht_employee"), false);
  assert.deepEqual(overlay.missing, ["jht_employee"]);
  assert.notEqual(overlay.amounts.jht_employee, 0);

  const emptyBase = rated({ jht_employee: { rate_bp: 54, wage_base: [] } });
  const unsetBase = applyPayOverlay(amountsFor(5000000), [
    { component_code: "jht_employee", eligible: true },
  ], emptyBase);
  assert.equal(Object.prototype.hasOwnProperty.call(unsetBase.amounts, "jht_employee"), false);
  assert.deepEqual(unsetBase.missing, ["jht_employee"]);
});

test("an eligible person with a saved tariff gets that amount, and an ineligible person gets zero", () => {
  const structure = rated({
    bpjsk_employee: { rate_bp: 54, wage_base: ["basic"] },
    jkk: { rate_bp: 370, wage_base: ["basic"] },
  });
  const eligible = applyPayOverlay(amountsFor(10000000), [
    { component_code: "bpjsk_employee", eligible: true },
    { component_code: "jkk", eligible: true },
  ], structure);
  assert.equal(eligible.amounts.bpjsk_employee, 54000);
  assert.equal(eligible.amounts.jkk, 370000);
  assert.deepEqual(eligible.missing, []);
  const formula = evaluatePayroll(structure, eligible.amounts);
  assert.equal(formula.gross, 10000000);
  assert.equal(formula.net, 9946000);

  const ineligible = applyPayOverlay(amountsFor(10000000), [
    { component_code: "bpjsk_employee", eligible: false },
    { component_code: "jkk", eligible: false },
  ], structure);
  assert.equal(ineligible.amounts.bpjsk_employee, 0);
  assert.equal(ineligible.amounts.jkk, 0);
  assert.deepEqual(ineligible.missing, []);
});

test("an employer tariff does not change take-home", () => {
  const structure = rated({ jkk: { rate_bp: 54, wage_base: ["basic"] } });
  const overlay = applyPayOverlay(amountsFor(10000000), [
    { component_code: "jkk", eligible: true },
  ], structure);
  assert.equal(overlay.amounts.jkk, 54000);
  const formula = evaluatePayroll(structure, overlay.amounts);
  assert.equal(formula.gross, 10000000);
  assert.equal(formula.net, 10000000);
});

test("a saved zero rate is a configured tariff", () => {
  const structure = rated({ jkm: { rate_bp: 0, wage_base: ["basic"] } });
  const overlay = applyPayOverlay(amountsFor(10000000), [
    { component_code: "jkm", eligible: true },
  ], structure);
  assert.equal(overlay.amounts.jkm, 0);
  assert.deepEqual(overlay.missing, []);
});

test("company tariffs stay off components that are not a shared rate", () => {
  for (const code of ["transport", "overtime", "bonus", "kasbon", "pph21", "tax_allowance", "basic"]) {
    const rejected = validatePayrollStructure(rawStructure({ [code]: { rate_bp: 54, wage_base: ["basic"] } }));
    assert.equal(rejected.ok, false, code);
  }
  const floated = validatePayrollStructure(rawStructure({ jkk: { rate_bp: 0.54, wage_base: ["basic"] } }));
  assert.equal(floated.ok, false);
  const cycled = validatePayrollStructure(rawStructure({
    jkk: { rate_bp: 54, wage_base: ["jkm"] },
    jkm: { rate_bp: 54, wage_base: ["jkk"] },
  }));
  assert.equal(cycled.ok, false);
});

test("an open period reads the current company tariff without treating a blank rate as zero", () => {
  const snapshot = defaultPayrollStructure();
  const company = rated({ bpjsk_company: { rate_bp: 370, wage_base: ["basic"] } });
  const merged = structureWithCompanyTariffs(snapshot, company);
  assert.equal(merged.components.find((component) => component.code === "bpjsk_company").rateBp, 370);
  assert.deepEqual(merged.components.find((component) => component.code === "transport").wageBase, []);
  const overlay = applyPayOverlay(amountsFor(5000000), [
    { component_code: "bpjsk_company", eligible: true },
  ], merged);
  assert.equal(overlay.amounts.bpjsk_company, 185000);
  const formula = evaluatePayroll(snapshot, overlay.amounts);
  assert.equal(formula.net, 5000000);
});
