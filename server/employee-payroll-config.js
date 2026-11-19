/** Simple per-employee payroll checklist (spec §2). */

const payTypes = new Set(["MONTHLY", "DAILY"]);
const bpjsBases = new Set(["BASIC", "BASIC_PLUS_FIXED"]);
const taxModes = new Set(["EMPLOYEE", "COMPANY"]);

function asBoolean(value, field) {
  if (typeof value === "boolean") return { ok: true, value };
  return { ok: false, error: `Set ${field} to true or false.` };
}

function asWholeIdr(value, field, { allowZero = true, allowNull = false } = {}) {
  if (value == null || value === "") {
    if (allowNull) return { ok: true, value: null };
    return { ok: false, error: `${field} is required.` };
  }
  const n = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  if (!Number.isInteger(n) || n < 0 || (!allowZero && n === 0)) {
    return { ok: false, error: `${field} must be a whole rupiah amount.` };
  }
  return { ok: true, value: n };
}

function asPercent(value, field) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 100) {
    return { ok: false, error: `${field} must be a whole percent from 1 to 100.` };
  }
  return { ok: true, value: n };
}

function asWorkingDays(value) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 31) {
    return { ok: false, error: "Working days per month must be between 1 and 31." };
  }
  return { ok: true, value: n };
}

export function legacyTaxToMode(taxConfiguration) {
  return taxConfiguration === "gross" ? "EMPLOYEE" : "COMPANY";
}

export function taxModeToLegacy(taxMode) {
  return taxMode === "EMPLOYEE" ? "gross" : "netto";
}

export function splitFixedPay(grossFixed, basicPercentage) {
  const basic = Math.round((grossFixed * basicPercentage) / 100);
  return { basic, fixed_allowance: grossFixed - basic };
}

export function employeePayrollConfigPatch(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "The payroll config is not valid." };
  }
  const payType = typeof input.pay_type === "string" ? input.pay_type.trim().toUpperCase() : "";
  if (!payTypes.has(payType)) return { ok: false, error: "Pay type must be MONTHLY or DAILY." };

  const workingDays = asWorkingDays(input.working_days_per_month ?? 22);
  if (!workingDays.ok) return workingDays;

  const housing = asWholeIdr(input.housing_allowance ?? 0, "Housing allowance");
  if (!housing.ok) return housing;
  const transport = asWholeIdr(input.transport_allowance ?? 0, "Transport allowance");
  if (!transport.ok) return transport;
  const attendance = asWholeIdr(input.attendance_allowance_per_day ?? 0, "Attendance allowance");
  if (!attendance.ok) return attendance;

  const kes = asBoolean(input.bpjs_kesehatan_enabled ?? true, "BPJS Kesehatan");
  if (!kes.ok) return kes;
  const tk = asBoolean(input.bpjs_tk_enabled ?? true, "BPJS TK");
  if (!tk.ok) return tk;

  const bpjsBase = typeof input.bpjs_base === "string" ? input.bpjs_base.trim().toUpperCase() : "BASIC";
  if (!bpjsBases.has(bpjsBase)) return { ok: false, error: "BPJS base must be BASIC or BASIC_PLUS_FIXED." };

  let taxMode = typeof input.tax_mode === "string" ? input.tax_mode.trim().toUpperCase() : "";
  if (!taxMode && typeof input.tax_configuration === "string") {
    taxMode = legacyTaxToMode(input.tax_configuration);
  }
  if (!taxModes.has(taxMode)) return { ok: false, error: "Tax mode must be EMPLOYEE or COMPANY." };

  const npwp = asBoolean(input.npwp_enabled ?? true, "NPWP");
  if (!npwp.ok) return npwp;

  const companyCover = asBoolean(input.company_covers_employee_bpjs ?? false, "company-covered employee BPJS");
  if (!companyCover.ok) return companyCover;

  let grossFixed = null;
  let basicPct = 60;
  let dailyRate = null;

  if (payType === "MONTHLY") {
    const gross = asWholeIdr(input.gross_fixed_salary, "Gross fixed salary", { allowZero: false, allowNull: false });
    if (!gross.ok) return gross;
    grossFixed = gross.value;
    const pct = asPercent(input.basic_percentage ?? 60, "Basic percentage");
    if (!pct.ok) return pct;
    basicPct = pct.value;
  } else {
    const daily = asWholeIdr(input.daily_rate, "Daily rate", { allowZero: false });
    if (!daily.ok) return daily;
    dailyRate = daily.value;
  }

  const enrolled = kes.value || tk.value;
  return {
    ok: true,
    config: {
      pay_type: payType,
      gross_fixed_salary: grossFixed,
      basic_percentage: basicPct,
      daily_rate: dailyRate,
      working_days_per_month: workingDays.value,
      housing_allowance: housing.value,
      transport_allowance: transport.value,
      attendance_allowance_per_day: attendance.value,
      bpjs_kesehatan_enabled: kes.value,
      bpjs_tk_enabled: tk.value,
      bpjs_base: bpjsBase,
      bpjs_enrolled: enrolled,
      company_covers_employee_bpjs: enrolled ? companyCover.value : false,
      tax_mode: taxMode,
      tax_configuration: taxModeToLegacy(taxMode),
      npwp_enabled: npwp.value,
    },
  };
}

export function readEmployeePayrollConfig(row) {
  const payType = row?.pay_type === "DAILY" ? "DAILY" : "MONTHLY";
  const taxMode = taxModes.has(row?.tax_mode)
    ? row.tax_mode
    : legacyTaxToMode(row?.tax_configuration);
  const gross = row?.gross_fixed_salary != null
    ? Number(row.gross_fixed_salary)
    : (row?.gaji_pokok != null ? Number(row.gaji_pokok) : null);
  return {
    pay_type: payType,
    gross_fixed_salary: Number.isFinite(gross) ? Math.trunc(gross) : null,
    basic_percentage: Number.isInteger(Number(row?.basic_percentage)) ? Number(row.basic_percentage) : 60,
    daily_rate: row?.daily_rate != null ? Number(row.daily_rate) : null,
    working_days_per_month: Number.isInteger(Number(row?.working_days_per_month)) ? Number(row.working_days_per_month) : 22,
    housing_allowance: Number(row?.housing_allowance) || 0,
    transport_allowance: Number(row?.transport_allowance) || 0,
    attendance_allowance_per_day: Number(row?.attendance_allowance_per_day) || 0,
    bpjs_kesehatan_enabled: row?.bpjs_kesehatan_enabled !== false,
    bpjs_tk_enabled: row?.bpjs_tk_enabled !== false,
    bpjs_base: row?.bpjs_base === "BASIC_PLUS_FIXED" ? "BASIC_PLUS_FIXED" : "BASIC",
    bpjs_enrolled: row?.bpjs_enrolled !== false,
    company_covers_employee_bpjs: row?.company_covers_employee_bpjs === true,
    tax_mode: taxMode,
    tax_configuration: taxModeToLegacy(taxMode),
    npwp_enabled: row?.npwp_enabled !== false,
    ptkp_code: typeof row?.ptkp_code === "string" && row.ptkp_code ? row.ptkp_code : "TK/0",
  };
}

export function presentEmployeePayrollConfig(employeeId, row) {
  return {
    employee_id: employeeId,
    ...readEmployeePayrollConfig(row),
  };
}
