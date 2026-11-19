/**
 * Service charge equal-per-present-day split (spec).
 * Pools configurable; PPh FLAT on SC alone via TER rate bp from caller.
 */
import { roundIdr, amountFromBp } from "./money.js";

export function allocatePools(total, pools) {
  const list = Array.isArray(pools) ? pools : [];
  let allocatedPct = 0;
  const rows = list.map((pool) => {
    const pct = Math.max(0, Math.trunc(Number(pool.pct) || 0));
    allocatedPct += pct;
    const nominal = roundIdr((total * pct) / 100);
    return {
      pool_key: String(pool.pool_key || pool.key || "pool"),
      label: String(pool.label || pool.pool_key || "Pool"),
      pct,
      nominal,
      notes: pool.notes || "",
    };
  });
  const unallocatedPct = Math.max(0, 100 - allocatedPct);
  if (unallocatedPct > 0 || rows.every((r) => r.pool_key !== "unallocated")) {
    const used = rows.reduce((sum, row) => sum + row.nominal, 0);
    rows.push({
      pool_key: "unallocated",
      label: "Unallocated",
      pct: unallocatedPct,
      nominal: Math.max(0, total - used),
      notes: "",
    });
  }
  const employeePool = rows.find((r) => r.pool_key === "employee_pool") || rows.find((r) => r.pct > 0);
  return {
    pools: rows,
    employee_pool_pct: employeePool?.pool_key === "employee_pool" ? employeePool.pct : (rows[0]?.pct || 0),
    employee_pool_nominal: rows.find((r) => r.pool_key === "employee_pool")?.nominal
      ?? roundIdr((total * (rows[0]?.pct || 0)) / 100),
    under_95_warning: (rows.find((r) => r.pool_key === "employee_pool")?.pct ?? 0) < 95,
  };
}

export function splitEqualPerPresentDay(employeePoolNominal, people) {
  const eligible = (people || []).filter((p) => p.eligible !== false && (p.days_present || 0) > 0);
  const totalDays = eligible.reduce((sum, p) => sum + Math.max(0, Math.trunc(p.days_present || 0)), 0);
  if (totalDays <= 0 || employeePoolNominal <= 0) {
    return {
      value_per_day: 0,
      total_days_present: totalDays,
      items: (people || []).map((p) => ({
        ...p,
        days_present: Math.max(0, Math.trunc(p.days_present || 0)),
        gross: 0,
        pph21: 0,
        net: 0,
      })),
    };
  }
  const valuePerDay = Math.floor(employeePoolNominal / totalDays);
  let distributed = 0;
  const items = (people || []).map((p) => {
    const days = Math.max(0, Math.trunc(p.days_present || 0));
    const gross = p.eligible === false ? 0 : valuePerDay * days;
    distributed += gross;
    return { ...p, days_present: days, gross, pph21: 0, net: gross };
  });
  // Remainder to person with most present days
  let remainder = employeePoolNominal - distributed;
  if (remainder > 0) {
    const ranked = [...items].filter((i) => i.eligible !== false).sort((a, b) => b.days_present - a.days_present);
    if (ranked[0]) {
      const target = items.find((i) => i.employee_id === ranked[0].employee_id);
      if (target) {
        target.gross += remainder;
        target.net = target.gross;
      }
    }
  }
  return { value_per_day: valuePerDay, total_days_present: totalDays, items };
}

export function applyFlatPph(items, terRateBp) {
  const bp = Number.isInteger(terRateBp) ? terRateBp : 0;
  return (items || []).map((item) => {
    const pph21 = amountFromBp(item.gross, bp);
    return { ...item, pph21, net: item.gross - pph21 };
  });
}

export function defaultContractEligible(contractType, eligibleTypes = ["PKWTT", "PKWT"]) {
  const type = String(contractType || "").toUpperCase();
  return eligibleTypes.map((t) => String(t).toUpperCase()).includes(type);
}
