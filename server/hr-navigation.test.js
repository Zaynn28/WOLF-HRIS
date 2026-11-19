import assert from "node:assert/strict";
import test from "node:test";
import {
  configurationTabs,
  payrollConfigurationVisible,
  payrollMenuChildren,
  visibleConfigurationTabs,
} from "../src/lib/hr-navigation.js";

test("payroll menu keeps processing and salary structure; advanced components are flagged", () => {
  assert.deepEqual(
    payrollMenuChildren.filter((item) => !item.advanced).map((item) => [item.id, item.label]),
    [
      ["payroll", "Payroll processing"],
      ["tax-simulation", "Tax simulation"],
      ["compliance", "Compliance"],
      ["salary-structure", "Salary structure"],
      ["reports", "Reports"],
    ],
  );
  const advanced = payrollMenuChildren.find((item) => item.id === "payroll-configuration");
  assert.equal(advanced?.advanced, true);
  assert.equal(advanced?.roles?.has("HR_STAFF"), true);
  assert.equal(configurationTabs.some((tab) => tab.id === "payroll-configuration"), false);
  assert.equal(payrollConfigurationVisible("HR_STAFF"), true);
  assert.equal(payrollConfigurationVisible("EMPLOYEE"), false);
  assert.equal(visibleConfigurationTabs("HR_STAFF").some((tab) => tab.id === "payroll-configuration"), false);
});
