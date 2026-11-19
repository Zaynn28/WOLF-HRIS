/** Service charge is paid on its own day in the salary pay month, not on the salary pay date. */
export function serviceChargePayDate(payrollPayDate, payDay = 15) {
  if (typeof payrollPayDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(payrollPayDate)) return "";
  const day = Math.min(28, Math.max(1, Number(payDay) || 15));
  const [year, month] = payrollPayDate.split("-");
  return `${year}-${month}-${String(day).padStart(2, "0")}`;
}
