-- Additive profile photo and change-request storage.
-- Apply only to 127.0.0.1:5434/atrium_hris_local. Do not run migrate.js.

ALTER TABLE employees ADD COLUMN IF NOT EXISTS profile_photo_path TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS self_service_user_id TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS gaji_pokok BIGINT;

CREATE TABLE IF NOT EXISTS employee_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT NOT NULL,
  employee_id UUID NOT NULL,
  proposed JSONB NOT NULL DEFAULT '{}'::jsonb,
  photo_path TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  requested_by TEXT NOT NULL,
  reviewed_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMPTZ,
  CONSTRAINT employee_change_requests_status_check CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED'))
);

CREATE INDEX IF NOT EXISTS employee_change_requests_company_status_idx
  ON employee_change_requests (company_id, status);

CREATE INDEX IF NOT EXISTS employees_self_service_user_idx
  ON employees (company_id, self_service_user_id);
