import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { assertionSecret, hrContextFromHeader, verifyHrAssertion } from "./assertion.js";

const secret = "local-test-assertion-secret-32chars";
const now = 1_700_000_000;

function sign(claims) {
  const payload = {
    iss: "wolf",
    aud: "hris",
    sub: "user-1",
    companyId: "amg",
    iat: now,
    exp: now + 120,
    jti: "0123456789abcdef",
    ...claims,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

test("a valid assertion binds the company and ignores a payroll grant in the payload", () => {
  const context = verifyHrAssertion(sign({ hrisGrants: ["payroll"], role: "owner" }), secret, now + 10);
  assert.equal(context.companyId, "amg");
  assert.equal(context.userId, "user-1");
  assert.equal(context.workspace, null);
  assert.deepEqual(context.hrisGrants, []);
  assert.equal(context.source, "verified-assertion");
  const staffRole = verifyHrAssertion(sign({ role: "HR_STAFF", workspace: "owner" }), secret, now + 10);
  assert.equal(staffRole.workspace, null);
  assert.equal(verifyHrAssertion(sign({ workspace: "hr" }), secret, now + 10).workspace, "hr");
  assert.equal(verifyHrAssertion(sign({ workspace: "self" }), secret, now + 10).workspace, "self");
});

test("invalid signature, expiry, issuer, audience, and company are rejected", () => {
  const valid = sign();
  assert.equal(verifyHrAssertion(`${valid}x`, secret, now + 10), null);
  assert.equal(verifyHrAssertion(valid, "another-secret-that-is-long-enough", now + 10), null);
  assert.equal(verifyHrAssertion(valid, secret, now + 121), null);
  assert.equal(verifyHrAssertion(sign({ iss: "other" }), secret, now + 10), null);
  assert.equal(verifyHrAssertion(sign({ aud: "wolf" }), secret, now + 10), null);
  assert.equal(verifyHrAssertion(sign({ companyId: "local-books" }), secret, now + 10), null);
  assert.equal(verifyHrAssertion(sign({ sub: "" }), secret, now + 10), null);
  assert.equal(hrContextFromHeader(undefined, { WOLF_HR_ASSERTION_SECRET: secret }, now + 10), null);
  assert.equal(assertionSecret({ WOLF_HR_ASSERTION_SECRET: "too-short" }), null);
  assert.equal(assertionSecret({}), null);
});
