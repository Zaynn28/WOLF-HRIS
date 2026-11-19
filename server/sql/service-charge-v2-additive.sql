-- Service charge calendar-month runs (separate from payroll periods).
-- Additive. Apply only to atrium_hris.

CREATE TABLE IF NOT EXISTS service_charge_settings (
  company_id TEXT PRIMARY KEY,
  employee_pool_pct INTEGER NOT NULL DEFAULT 50,
  policy_basis TEXT,
  present_statuses JSONB NOT NULL DEFAULT '["PRESENT"]'::jsonb,
  eligible_contract_types JSONB NOT NULL DEFAULT '["PKWTT","PKWT"]'::jsonb,
  include_resigned_in_period BOOLEAN NOT NULL DEFAULT TRUE,
  tax_method TEXT NOT NULL DEFAULT 'FLAT',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT service_charge_settings_tax_check CHECK (tax_method IN ('FLAT', 'INCREMENTAL'))
);

CREATE TABLE IF NOT EXISTS service_charge_pool_defaults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT NOT NULL,
  pool_key TEXT NOT NULL,
  label TEXT NOT NULL,
  pct INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (company_id, pool_key)
);

CREATE TABLE IF NOT EXISTS service_charge_months (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT NOT NULL,
  period_year INTEGER NOT NULL,
  period_month INTEGER NOT NULL,
  total_service_charge BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  current_version INTEGER NOT NULL DEFAULT 0,
  pay_date DATE,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (company_id, period_year, period_month),
  CONSTRAINT service_charge_months_status_check CHECK (status IN ('DRAFT', 'PUBLISHED')),
  CONSTRAINT service_charge_months_month_check CHECK (period_month BETWEEN 1 AND 12)
);

CREATE TABLE IF NOT EXISTS service_charge_month_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month_id UUID NOT NULL REFERENCES service_charge_months(id) ON DELETE CASCADE,
  company_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  status TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  generated_by TEXT,
  pools JSONB NOT NULL DEFAULT '[]'::jsonb,
  settings_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  value_per_day BIGINT NOT NULL DEFAULT 0,
  total_days_present INTEGER NOT NULL DEFAULT 0,
  UNIQUE (month_id, version)
);

CREATE TABLE IF NOT EXISTS service_charge_month_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES service_charge_month_versions(id) ON DELETE CASCADE,
  company_id TEXT NOT NULL,
  employee_id UUID NOT NULL,
  employee_code TEXT NOT NULL,
  full_name TEXT NOT NULL,
  days_present INTEGER NOT NULL DEFAULT 0,
  gross BIGINT NOT NULL DEFAULT 0,
  pph21 BIGINT NOT NULL DEFAULT 0,
  net BIGINT NOT NULL DEFAULT 0,
  eligible BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (version_id, employee_id)
);

CREATE TABLE IF NOT EXISTS service_charge_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT NOT NULL,
  month_id UUID,
  action TEXT NOT NULL,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
