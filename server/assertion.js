import { createHmac, timingSafeEqual } from "node:crypto";
import { workforceEmail } from "./phone-punch.js";

const companies = new Set(["amg", "bzg", "ggv"]);

/**
 * WOLF_HR_ASSERTION_SECRET comes from the process environment. Production
 * expects the platform, such as Google Secret Manager on Cloud Run, to inject
 * it. A missing or weak value fails closed. This function does not generate
 * or print a secret.
 */
export function assertionSecret(env) {
  const raw = env.WOLF_HR_ASSERTION_SECRET;
  if (typeof raw !== "string" || raw.length < 32 || raw.length > 512 || /\s/.test(raw)) return null;
  if (new Set(raw).size < 8) return null;
  return raw;
}

export function verifyHrAssertion(token, secret, nowSeconds) {
  if (typeof token !== "string" || typeof secret !== "string" || typeof nowSeconds !== "number") return null;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const expectedSignature = createHmac("sha256", secret).update(parts[0]).digest("base64url");
  const actual = Buffer.from(parts[1]);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (actual.length !== expectedBuffer.length || !timingSafeEqual(actual, expectedBuffer)) return null;
  let parsed;
  try {
    parsed = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!parsed || parsed.iss !== "wolf" || parsed.aud !== "hris") return null;
  if (!companies.has(parsed.companyId)) return null;
  if (typeof parsed.sub !== "string" || parsed.sub.trim() === "") return null;
  if (typeof parsed.jti !== "string" || parsed.jti.length < 16) return null;
  if (!Number.isFinite(parsed.iat) || !Number.isFinite(parsed.exp)) return null;
  if (parsed.iat > nowSeconds + 30 || parsed.exp <= nowSeconds || parsed.exp - parsed.iat > 120) return null;
  return {
    source: "verified-assertion",
    companyId: parsed.companyId,
    userId: parsed.sub,
    email: workforceEmail(parsed.email),
    workspace: parsed.workspace === "hr" || parsed.workspace === "self" ? parsed.workspace : null,
    hrisGrants: [],
  };
}

export function hrContextFromHeader(header, env, nowSeconds = Math.floor(Date.now() / 1000)) {
  const secret = assertionSecret(env);
  if (!secret || typeof header !== "string" || header.trim() === "" || /[\r\n]/.test(header)) return null;
  return verifyHrAssertion(header.trim(), secret, nowSeconds);
}
