-- Additive HR master fields from 001_HRIS system.docx.
-- Apply only to atrium_hris (local or Cloud SQL). Do not run migrate.js.

ALTER TABLE employees ADD COLUMN IF NOT EXISTS bpjs_tk_number TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bpjs_kesehatan_number TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS last_education TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS education_institution TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS approval_line TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS manager_employee_id UUID;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS service_charge_eligible BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bpjs_kesehatan_applicable BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bpjs_tk_applicable BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS pph21_applicable BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS employee_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT NOT NULL,
  employee_id UUID NOT NULL,
  occurred_on DATE NOT NULL,
  violation_type TEXT NOT NULL,
  notes TEXT,
  recorded_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS employee_violations_employee_idx
  ON employee_violations (company_id, employee_id, occurred_on DESC);

CREATE TABLE IF NOT EXISTS offsite_duty_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT NOT NULL,
  employee_id UUID NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  location_note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'APPROVED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT offsite_duty_status_check CHECK (status IN ('APPROVED', 'CANCELLED'))
);

CREATE INDEX IF NOT EXISTS offsite_duty_employee_dates_idx
  ON offsite_duty_assignments (company_id, employee_id, start_date, end_date);

CREATE TABLE IF NOT EXISTS til_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT NOT NULL,
  employee_id UUID NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  minutes INTEGER NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT til_ledger_source_check CHECK (source_type IN ('OVERTIME', 'REDEMPTION'))
);

CREATE INDEX IF NOT EXISTS til_ledger_employee_idx
  ON til_ledger (company_id, employee_id, created_at DESC);

-- Rollback (forward drop later):
-- DROP TABLE IF EXISTS til_ledger;
-- DROP TABLE IF EXISTS offsite_duty_assignments;
-- DROP TABLE IF EXISTS employee_violations;
-- ALTER TABLE employees DROP COLUMN IF EXISTS pph21_applicable;
-- ALTER TABLE employees DROP COLUMN IF EXISTS bpjs_tk_applicable;
-- ALTER TABLE employees DROP COLUMN IF EXISTS bpjs_kesehatan_applicable;
-- ALTER TABLE employees DROP COLUMN IF EXISTS service_charge_eligible;
-- ALTER TABLE employees DROP COLUMN IF EXISTS manager_employee_id;
-- ALTER TABLE employees DROP COLUMN IF EXISTS approval_line;
-- ALTER TABLE employees DROP COLUMN IF EXISTS education_institution;
-- ALTER TABLE employees DROP COLUMN IF EXISTS last_education;
-- ALTER TABLE employees DROP COLUMN IF EXISTS bpjs_kesehatan_number;
-- ALTER TABLE employees DROP COLUMN IF EXISTS bpjs_tk_number;
