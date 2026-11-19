-- Additive payroll basic-salary columns.
-- Apply only to 127.0.0.1:5434/atrium_hris_local. Do not run migrate.js.

ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS basic_salary BIGINT;
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS basic_salary_from_profile BOOLEAN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payroll_records_basic_salary_whole'
  ) THEN
    ALTER TABLE payroll_records
      ADD CONSTRAINT payroll_records_basic_salary_whole
      CHECK (basic_salary IS NULL OR basic_salary >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS payroll_records_company_period_idx
  ON payroll_records (company_id, payroll_period_id);
