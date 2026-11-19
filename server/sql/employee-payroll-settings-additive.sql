-- Per-employee BPJS enrollment, company-covered employee share, and tax configuration.
-- Additive. Does not change payroll records or component eligibility rows.
-- Apply only to atrium_hris (local or Cloud SQL). Do not run migrate.js.

ALTER TABLE employees ADD COLUMN IF NOT EXISTS bpjs_enrolled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS company_covers_employee_bpjs BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS tax_configuration TEXT NOT NULL DEFAULT 'netto';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'employees_tax_configuration_check'
  ) THEN
    ALTER TABLE employees
      ADD CONSTRAINT employees_tax_configuration_check
      CHECK (tax_configuration IN ('netto', 'gross'));
  END IF;
END $$;

-- Rollback is a later forward drop, not applied by this script:
-- ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_tax_configuration_check;
-- ALTER TABLE employees DROP COLUMN IF EXISTS tax_configuration;
-- ALTER TABLE employees DROP COLUMN IF EXISTS company_covers_employee_bpjs;
-- ALTER TABLE employees DROP COLUMN IF EXISTS bpjs_enrolled;
