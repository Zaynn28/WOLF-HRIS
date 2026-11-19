# Payroll + Service Charge — gap note

## Fixed (this slice)

- **Store split closed:** Generate projects engine `detail` into `payroll_records.component_amounts` (and run snapshots stay in `payroll_run_*`).
- **Payroll Processing** shows a per-component matrix (not rolled-up Basic/Allowance only).
- **Payslip / ESS / Salary Detail** read the same projected amounts.
- Live embed **no longer** silently falls back to hotel demo generate when the API fails; errors surface instead.
- Empty healthy API roster no longer loads mock demo employees.
- Generate warnings for missing attendance, TER brackets, BPJS/JKK, and zero present days.
- Loan installments loaded from `employee_loans` when the table exists.

## Still deferred

- Full Pasal 17 December true-up UI wizard.
- Consultant verification of BPJS/TER seed numbers.
- COMPANY tax-mode accounting note for finance.
- Server-side PDF payslip generation.
- ESS auto-load of published service-charge months from API (session persist from Service Charge page remains).

## Deploy

Apply `server/sql/payroll-component-amounts-additive.sql` (or rely on `ensurePayrollRecordProjectionColumns`), then ship WOLFHRIS in the intelligence image.
