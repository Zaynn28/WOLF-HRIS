-- Additive company scope for the existing HRIS Postgres schema.
-- Do not run database/schema.sql. That file drops the HRIS tables.
-- Do not backfill company_id. Rows without a company stay inaccessible.
-- This file has not been applied.

CREATE TABLE IF NOT EXISTS hris_companies (
  id text PRIMARY KEY CHECK (id IN ('amg', 'bzg', 'ggv'))
);

INSERT INTO hris_companies (id) VALUES ('amg'), ('bzg'), ('ggv')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE departments ADD COLUMN IF NOT EXISTS company_id text REFERENCES hris_companies (id);
ALTER TABLE positions ADD COLUMN IF NOT EXISTS company_id text REFERENCES hris_companies (id);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS company_id text REFERENCES hris_companies (id);
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS company_id text REFERENCES hris_companies (id);
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS company_id text REFERENCES hris_companies (id);
ALTER TABLE payroll_periods ADD COLUMN IF NOT EXISTS company_id text REFERENCES hris_companies (id);
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS company_id text REFERENCES hris_companies (id);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS company_id text REFERENCES hris_companies (id);

CREATE INDEX IF NOT EXISTS departments_company_id_idx ON departments (company_id);
CREATE INDEX IF NOT EXISTS positions_company_id_idx ON positions (company_id);
CREATE INDEX IF NOT EXISTS employees_company_id_idx ON employees (company_id);
CREATE INDEX IF NOT EXISTS attendance_company_id_idx ON attendance (company_id);
CREATE INDEX IF NOT EXISTS leave_requests_company_id_idx ON leave_requests (company_id);
CREATE INDEX IF NOT EXISTS payroll_periods_company_id_idx ON payroll_periods (company_id);
CREATE INDEX IF NOT EXISTS payroll_records_company_id_idx ON payroll_records (company_id);
CREATE INDEX IF NOT EXISTS audit_logs_company_id_idx ON audit_logs (company_id);

ALTER TABLE departments DROP CONSTRAINT IF EXISTS departments_code_key;
ALTER TABLE positions DROP CONSTRAINT IF EXISTS positions_code_key;
CREATE UNIQUE INDEX IF NOT EXISTS departments_company_code_uidx ON departments (company_id, code) WHERE company_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS positions_company_code_uidx ON positions (company_id, code) WHERE company_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS hris_payroll_grants (
  company_id text NOT NULL REFERENCES hris_companies (id),
  wolf_user_id text NOT NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (company_id, wolf_user_id)
);
