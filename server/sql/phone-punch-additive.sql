-- Phone punch sites, evidence columns, and correction fields.
-- Additive. Existing attendance rows and fingerprint rows stay as they are.

CREATE TABLE IF NOT EXISTS punch_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL,
  name text NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  radius_meters integer NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT punch_sites_radius_check CHECK (radius_meters BETWEEN 30 AND 300)
);

CREATE INDEX IF NOT EXISTS punch_sites_company_idx ON punch_sites (company_id, active);

CREATE TABLE IF NOT EXISTS punch_receipts (
  company_id text NOT NULL,
  employee_id uuid NOT NULL,
  idempotency_key text NOT NULL,
  status_code integer NOT NULL,
  body jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (company_id, employee_id, idempotency_key)
);

ALTER TABLE attendance ADD COLUMN IF NOT EXISTS clock_in_photo_path text;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS clock_out_photo_path text;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS clock_in_lat double precision;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS clock_in_lng double precision;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS clock_in_accuracy_m integer;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS clock_out_lat double precision;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS clock_out_lng double precision;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS clock_out_accuracy_m integer;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS clock_in_site_id uuid;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS clock_out_site_id uuid;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS clock_in_site_name text;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS clock_out_site_name text;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS clock_in_at timestamptz;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS clock_out_at timestamptz;

CREATE TABLE IF NOT EXISTS attendance_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id uuid,
  requested_by uuid,
  original_value jsonb,
  requested_value jsonb,
  reason text,
  status varchar(20) DEFAULT 'PENDING',
  approved_by uuid,
  approved_at timestamp,
  created_at timestamp DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE attendance_corrections ADD COLUMN IF NOT EXISTS company_id text;
ALTER TABLE attendance_corrections ADD COLUMN IF NOT EXISTS employee_id uuid;
ALTER TABLE attendance_corrections ADD COLUMN IF NOT EXISTS attendance_date date;
ALTER TABLE attendance_corrections ADD COLUMN IF NOT EXISTS requested_by_user text;
ALTER TABLE attendance_corrections ADD COLUMN IF NOT EXISTS reviewed_by_user text;
