-- Additive component amount columns for payroll records.
-- Apply only to 127.0.0.1:5434/atrium_hris_local. Do not run migrate.js.
-- Does not change basic_salary, gaji_pokok, or existing gross and net values.

ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS allowance BIGINT NOT NULL DEFAULT 0;
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS overtime BIGINT NOT NULL DEFAULT 0;
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS service_charge BIGINT NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payroll_records_allowance_whole'
  ) THEN
    ALTER TABLE payroll_records
      ADD CONSTRAINT payroll_records_allowance_whole
      CHECK (allowance >= 0);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payroll_records_overtime_whole'
  ) THEN
    ALTER TABLE payroll_records
      ADD CONSTRAINT payroll_records_overtime_whole
      CHECK (overtime >= 0);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payroll_records_service_charge_whole'
  ) THEN
    ALTER TABLE payroll_records
      ADD CONSTRAINT payroll_records_service_charge_whole
      CHECK (service_charge >= 0);
  END IF;
END $$;
