/** Shared money helpers — whole IDR only. */

export function roundIdr(amount) {
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount);
}

/** Basis points: 100 bp = 1%. */
export function amountFromBp(base, rateBp) {
  if (!Number.isInteger(rateBp) || rateBp < 0 || !Number.isFinite(base) || base <= 0) return 0;
  return roundIdr((base * rateBp) / 10000);
}
