const taxConfigurations = new Set(["netto", "gross"]);

function asBoolean(value, field) {
  if (typeof value === "boolean") return { ok: true, value };
  return { ok: false, error: `Set ${field} to true or false.` };
}

/** Standing payroll switches for one person. Independent of fixed-allowance eligibility. */
export function payrollSettingsPatch(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "The payroll settings are not valid." };
  }
  const enrolled = asBoolean(input.bpjs_enrolled, "BPJS enrollment");
  if (!enrolled.ok) return enrolled;
  const covered = asBoolean(input.company_covers_employee_bpjs, "company-covered employee BPJS");
  if (!covered.ok) return covered;
  const tax = input.tax_configuration;
  if (typeof tax !== "string" || !taxConfigurations.has(tax)) {
    return { ok: false, error: "Tax configuration must be netto or gross." };
  }
  return {
    ok: true,
    settings: {
      bpjs_enrolled: enrolled.value,
      company_covers_employee_bpjs: enrolled.value ? covered.value : false,
      tax_configuration: tax,
    },
  };
}

export function readPayrollSettings(row) {
  const tax = typeof row?.tax_configuration === "string" && taxConfigurations.has(row.tax_configuration)
    ? row.tax_configuration
    : "netto";
  return {
    bpjs_enrolled: row?.bpjs_enrolled !== false,
    company_covers_employee_bpjs: row?.company_covers_employee_bpjs === true,
    tax_configuration: tax,
  };
}

export function presentPayrollSettings(employeeId, row) {
  return {
    employee_id: employeeId,
    ...readPayrollSettings(row),
  };
}

export function payrollSettingsChanged(before, next) {
  const previous = readPayrollSettings(before);
  return (
    previous.bpjs_enrolled !== next.bpjs_enrolled
    || previous.company_covers_employee_bpjs !== next.company_covers_employee_bpjs
    || previous.tax_configuration !== next.tax_configuration
  );
}
