const companies = new Set(["amg", "bzg", "ggv"]);

const denied = { status: 403, body: { error: "HR is not available for this session." } };
const unauthenticated = { status: 401, body: { error: "HR is not available for this session." } };

export function hrCompanyGate(context) {
  if (!context || context.source !== "verified-assertion" || typeof context.companyId !== "string" || context.companyId.trim() === "") {
    return unauthenticated;
  }
  if (!companies.has(context.companyId)) return denied;
  return null;
}

export function companyForWrite(context, body) {
  const gate = hrCompanyGate(context);
  if (gate) return gate;
  const source = body && typeof body === "object" ? body : {};
  const fields = { ...source };
  delete fields.orgId;
  delete fields.org_id;
  delete fields.companyId;
  delete fields.company_id;
  delete fields.role;
  delete fields.grants;
  delete fields.hrisGrants;
  fields.company_id = context.companyId;
  return { status: 200, fields };
}

export function recordAccess(context, record) {
  const gate = hrCompanyGate(context);
  if (gate) return gate;
  if (!record || record.company_id !== context.companyId) return denied;
  return { status: 200, record };
}

export function nestedAccess(context, parent, child) {
  const parentAccess = recordAccess(context, parent);
  if (parentAccess.status !== 200) return parentAccess;
  if (!child || child.company_id !== context.companyId || child.employee_id !== parent.id) return denied;
  return { status: 200, record: child };
}

export function payrollApprovalAccess(context, period) {
  const gate = hrCompanyGate(context);
  if (gate) return gate;
  const periodAccess = recordAccess(context, period);
  if (periodAccess.status !== 200) return periodAccess;
  const grants = Array.isArray(context.hrisGrants) ? context.hrisGrants : [];
  if (!grants.includes("payroll")) return denied;
  return { status: 200, record: period };
}

export function listForCompany(context, rows) {
  const gate = hrCompanyGate(context);
  if (gate) return gate;
  const visible = (rows ?? []).filter((row) => row && row.company_id === context.companyId);
  return { status: 200, rows: visible };
}
