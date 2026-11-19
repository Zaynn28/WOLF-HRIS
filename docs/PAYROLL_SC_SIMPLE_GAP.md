# Payroll + Service Charge (simple UX) — gap note

## Shipped in this slice

- Per-employee **payroll checklist** (`pay_type`, gross fixed + basic %, allowances, BPJS toggles, tax_mode EMPLOYEE|COMPANY) via Salary structure.
- Server **payroll engine** + `payroll_runs` versioning (generate/overwrite).
- Unpaid leave = **basic only**.
- JKK **nullable / not invented**; Compliance form blank by default; generate warns if unset.
- Payroll components nav moved to **Advanced** (hidden from main sidebar).
- **Service charge v2**: calendar month, configurable pools, present-status checklist, PKWTT+PKWT default, FLAT PPh, Draft/Publish, Mandiri/BNI/BRI export.
- Bank adapters: Mandiri, BNI, BRI CSV layouts.

## Deferred

- Full Pasal 17 December true-up tables (engine accepts annual override; UI not yet a wizard).
- Consultant verification of BPJS/TER seed numbers.
- COMPANY tax-mode accounting treatment note for finance.
- PDF payslip server generation (client export shells remain).
- Migrating all historical periods into `payroll_run_lines` (new generates only).
- Removing structure/tariff APIs entirely (read path still exists for legacy).

## Deploy

Apply additive SQL on `atrium_hris` (or rely on `ensure*` at runtime), sync WOLFHRIS + wolf proxy into intelligence image when asked.
