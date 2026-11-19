-- Simple per-employee payroll config (HR Admin checklist model).
-- Additive. Apply only to atrium_hris. Do not run migrate.js.

ALTER TABLE employees ADD COLUMN IF NOT EXISTS pay_type TEXT NOT NULL DEFAULT 'MONTHLY';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS gross_fixed_salary BIGINT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS basic_percentage INTEGER NOT NULL DEFAULT 60;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS daily_rate BIGINT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS working_days_per_month INTEGER NOT NULL DEFAULT 22;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS housing_allowance BIGINT NOT NULL DEFAULT 0;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS transport_allowance BIGINT NOT NULL DEFAULT 0;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS attendance_allowance_per_day BIGINT NOT NULL DEFAULT 0;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bpjs_kesehatan_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bpjs_tk_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bpjs_base TEXT NOT NULL DEFAULT 'BASIC';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS tax_mode TEXT;

-- Seed tax_mode from legacy tax_configuration when present.
UPDATE employees
SET tax_mode = CASE
  WHEN tax_configuration = 'gross' THEN 'EMPLOYEE'
  ELSE 'COMPANY'
END
WHERE tax_mode IS NULL;

ALTER TABLE employees ALTER COLUMN tax_mode SET DEFAULT 'COMPANY';
UPDATE employees SET tax_mode = 'COMPANY' WHERE tax_mode IS NULL;
ALTER TABLE employees ALTER COLUMN tax_mode SET NOT NULL;

-- Seed gross_fixed from gaji_pokok when empty (treat stored basic as full fixed until HR splits).
UPDATE employees
SET gross_fixed_salary = gaji_pokok
WHERE gross_fixed_salary IS NULL AND gaji_pokok IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employees_pay_type_check') THEN
    ALTER TABLE employees ADD CONSTRAINT employees_pay_type_check CHECK (pay_type IN ('MONTHLY', 'DAILY'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employees_bpjs_base_check') THEN
    ALTER TABLE employees ADD CONSTRAINT employees_bpjs_base_check CHECK (bpjs_base IN ('BASIC', 'BASIC_PLUS_FIXED'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employees_tax_mode_check') THEN
    ALTER TABLE employees ADD CONSTRAINT employees_tax_mode_check CHECK (tax_mode IN ('EMPLOYEE', 'COMPANY'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employees_basic_percentage_check') THEN
    ALTER TABLE employees ADD CONSTRAINT employees_basic_percentage_check CHECK (basic_percentage BETWEEN 1 AND 100);
  END IF;
END $$;
