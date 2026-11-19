/**
 * Map payroll engine detail (+ totals) into structure-style component_amounts
 * used by Payslip, Salary Detail, and Payroll Processing.
 */

function whole(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.trunc(n);
}

/**
 * @param {object} line - generate line: detail, gross_earnings, total_deductions, take_home_pay, company_tax_cost, pay_type
 */
export function componentAmountsFromRunLine(line) {
  const d = line?.detail && typeof line.detail === "object" ? line.detail : {};
  const bpjs = d.bpjs && typeof d.bpjs === "object" ? d.bpjs : {};
  const taxMode = String(d.tax_mode || "").toUpperCase();
  const netto = taxMode === "COMPANY";
  const companyTax = whole(line?.company_tax_cost ?? d.company_tax_cost ?? (netto ? d.pph21 : 0));
  const employeePph = whole(d.employee_pph);
  const showBpjsGrossUp = netto || d.company_covers_employee_bpjs === true;

  const healthEmployee = whole(bpjs.health_employee);
  const jhtEmployee = whole(bpjs.jht_employee);
  const jpEmployee = whole(bpjs.jp_employee);

  const amounts = {
    full_basic: whole(d.basic),
    basic: whole(d.basic),
    transport: whole(d.transport),
    komunikasi: 0,
    housing: whole(d.housing),
    fixed_allowance: whole(d.fixed_allowance),
    attendance_allowance: whole(d.attendance_pay),
    bpjsk_allowance: showBpjsGrossUp ? healthEmployee : 0,
    jht_allowance: showBpjsGrossUp ? jhtEmployee : 0,
    jp_allowance: showBpjsGrossUp ? jpEmployee : 0,
    bonus: whole(d.bonus),
    overtime: whole(d.overtime),
    tax_allowance: netto ? companyTax : 0,
    kasbon: whole(d.loan_installment) + whole(d.late_deduction),
    unpaid: whole(d.unpaid_deduction),
    jp_employee: jpEmployee,
    bpjsk_employee: healthEmployee,
    jht_employee: jhtEmployee,
    pph21: employeePph,
    pph21_benefit: companyTax,
    jkk: whole(bpjs.jkk),
    jkm: whole(bpjs.jkm),
    jht_company: whole(bpjs.jht_employer),
    jp_company: whole(bpjs.jp_employer),
    bpjsk_company: whole(bpjs.health_employer),
    ter_gross: whole(d.ter_gross),
    tax_mode: netto ? 1 : 0,
  };

  // When company covers employee BPJS, employee shares are still shown as deductions=0
  // but allowances may gross-up; keep employee share codes at computed rates for reporting.
  if (d.company_covers_employee_bpjs === true && !netto) {
    amounts.bpjsk_employee = 0;
    amounts.jht_employee = 0;
    amounts.jp_employee = 0;
  }

  return amounts;
}

export function payrollItemsFromAmounts(recordId, amounts) {
  const catalog = [
    ["basic", "Basic Salary", "EARNING"],
    ["transport", "Tunjangan Transport", "EARNING"],
    ["komunikasi", "Tunjangan Komunikasi", "EARNING"],
    ["housing", "Housing", "EARNING"],
    ["fixed_allowance", "Fixed allowance", "EARNING"],
    ["attendance_allowance", "Attendance allowance", "EARNING"],
    ["bpjsk_allowance", "BPJS Kesehatan Allowance", "EARNING"],
    ["jht_allowance", "JHT Employee Allowance", "EARNING"],
    ["jp_allowance", "JP Employee Allowance", "EARNING"],
    ["bonus", "Bonus", "EARNING"],
    ["overtime", "Overtime", "EARNING"],
    ["tax_allowance", "Tax Allowance", "EARNING"],
    ["kasbon", "Kasbon", "DEDUCTION"],
    ["unpaid", "Unpaid leave (basic only)", "DEDUCTION"],
    ["bpjsk_employee", "BPJS Kesehatan Employee", "DEDUCTION"],
    ["jht_employee", "JHT Employee", "DEDUCTION"],
    ["jp_employee", "Jaminan Pensiun Employee", "DEDUCTION"],
    ["pph21", "PPh 21", "DEDUCTION"],
    ["jkk", "JKK", "EARNING"],
    ["jkm", "JKM", "EARNING"],
    ["jht_company", "JHT Company", "EARNING"],
    ["jp_company", "Jaminan Pensiun Company", "EARNING"],
    ["bpjsk_company", "BPJS Kesehatan Company", "EARNING"],
    ["pph21_benefit", "PPh 21 Benefit", "EARNING"],
  ];
  const items = [];
  for (const [code, name, category] of catalog) {
    const amount = whole(amounts[code]);
    if (amount <= 0 && code !== "basic") continue;
    items.push({
      id: `pi_${recordId}_${code}`,
      payrollRecordId: recordId,
      componentCode: code,
      componentName: name,
      category,
      quantity: 1,
      rate: amount,
      amount,
    });
  }
  return items;
}

export function projectRunLineToRecord(line, { periodId, companyId }) {
  const amounts = componentAmountsFromRunLine(line);
  const employeeId = String(line.employee_id || line.employeeId || "");
  const recordId = `pr_${periodId}_${employeeId}`;
  const basic = amounts.basic;
  const allowance =
    amounts.transport +
    amounts.komunikasi +
    amounts.housing +
    amounts.fixed_allowance +
    amounts.attendance_allowance +
    amounts.bpjsk_allowance +
    amounts.jht_allowance +
    amounts.jp_allowance +
    amounts.tax_allowance;
  return {
    id: recordId,
    company_id: companyId,
    payroll_period_id: periodId,
    employee_id: employeeId,
    employee_code: line.employee_code || line.employeeCode || null,
    full_name: line.full_name || line.fullName || null,
    basic_salary: basic,
    allowance,
    overtime: amounts.overtime,
    service_charge: 0,
    gross_pay: whole(line.gross_earnings ?? line.grossEarnings),
    total_deductions: whole(line.total_deductions ?? line.totalDeductions),
    net_pay: whole(line.take_home_pay ?? line.takeHomePay ?? line.net),
    status: "CALCULATED",
    basic_salary_from_profile: false,
    component_amounts: amounts,
    items: payrollItemsFromAmounts(recordId, amounts),
  };
}

/** Client-facing PayrollRecord shape */
export function projectRunLineToClientRecord(line, periodId) {
  const row = projectRunLineToRecord(line, { periodId, companyId: "" });
  return {
    id: row.id,
    payrollPeriodId: periodId,
    employeeId: row.employee_id,
    basicSalary: row.basic_salary,
    allowance: row.allowance,
    overtime: row.overtime,
    serviceCharge: 0,
    grossPay: row.gross_pay,
    totalDeductions: row.total_deductions,
    netPay: row.net_pay,
    status: "CALCULATED",
    componentAmounts: row.component_amounts,
  };
}
