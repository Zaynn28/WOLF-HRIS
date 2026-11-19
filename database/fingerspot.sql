CREATE TABLE IF NOT EXISTS fingerspot_devices (
  cloud_id text PRIMARY KEY,
  company_id text NOT NULL REFERENCES hris_companies (id),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fingerspot_pins (
  cloud_id text NOT NULL REFERENCES fingerspot_devices (cloud_id),
  pin text NOT NULL,
  employee_id uuid NOT NULL REFERENCES employees (id),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (cloud_id, pin)
);

CREATE TABLE IF NOT EXISTS fingerspot_scans (
  cloud_id text NOT NULL,
  pin text NOT NULL,
  scanned_at text NOT NULL,
  verify integer,
  status_scan integer,
  company_id text NOT NULL,
  employee_id uuid,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (cloud_id, pin, scanned_at)
);

CREATE INDEX IF NOT EXISTS fingerspot_scans_company_idx ON fingerspot_scans (company_id, scanned_at);
