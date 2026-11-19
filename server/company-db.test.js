import assert from "node:assert/strict";
import test from "node:test";
import { companyIsolationReady } from "./isolation.js";

test("company isolation stays closed without a database connection", () => {
  assert.equal(companyIsolationReady(), false);
});
