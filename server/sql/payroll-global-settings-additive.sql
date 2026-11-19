-- Company-scoped payroll global settings and BPJS rate sets (effective-dated).
-- Additive. Apply only to atrium_hris. Do not run migrate.js.

CREATE TABLE IF NOT EXISTS payroll_global_settings (
  company_id TEXT PRIMARY KEY,
  cutoff_start_day INTEGER NOT NULL DEFAULT 26,
  cutoff_end_day INTEGER NOT NULL DEFAULT 25,
  pay_day INTEGER NOT NULL DEFAULT 5,
  ot_weekday_first_bp INTEGER NOT NULL DEFAULT 15000,
  ot_weekday_next_bp INTEGER NOT NULL DEFAULT 20000,
  ot_holiday_first_bp INTEGER NOT NULL DEFAULT 20000,
  ot_holiday_eighth_bp INTEGER NOT NULL DEFAULT 30000,
  ot_holiday_after_bp INTEGER NOT NULL DEFAULT 40000,
  late_deduction_per_event BIGINT NOT NULL DEFAULT 0,
  service_charge_pay_day INTEGER NOT NULL DEFAULT 15,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT payroll_global_settings_cutoff_check CHECK (
    cutoff_start_day BETWEEN 1 AND 31 AND cutoff_end_day BETWEEN 1 AND 31
  )
);

CREATE TABLE IF NOT EXISTS bpjs_rate_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT NOT NULL,
  effective_from DATE NOT NULL,
  health_employee_bp INTEGER NOT NULL DEFAULT 100,
  health_employer_bp INTEGER NOT NULL DEFAULT 400,
  health_salary_cap BIGINT,
  jht_employee_bp INTEGER NOT NULL DEFAULT 200,
  jht_employer_bp INTEGER NOT NULL DEFAULT 370,
  jp_employee_bp INTEGER NOT NULL DEFAULT 100,
  jp_employer_bp INTEGER NOT NULL DEFAULT 200,
  jp_salary_cap BIGINT,
  jkk_bp INTEGER,
  jkm_bp INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (company_id, effective_from)
);

CREATE INDEX IF NOT EXISTS bpjs_rate_sets_company_idx
  ON bpjs_rate_sets (company_id, effective_from DESC);

CREATE TABLE IF NOT EXISTS payroll_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT NOT NULL,
  period_code TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  current_version INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (company_id, period_code)
);

CREATE TABLE IF NOT EXISTS payroll_run_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  company_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  generated_by TEXT,
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  rates_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  settings_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (run_id, version)
);

CREATE TABLE IF NOT EXISTS payroll_run_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES payroll_run_versions(id) ON DELETE CASCADE,
  company_id TEXT NOT NULL,
  employee_id UUID NOT NULL,
  employee_code TEXT NOT NULL,
  full_name TEXT NOT NULL,
  pay_type TEXT NOT NULL,
  detail JSONB NOT NULL,
  gross_earnings BIGINT NOT NULL DEFAULT 0,
  total_deductions BIGINT NOT NULL DEFAULT 0,
  take_home_pay BIGINT NOT NULL DEFAULT 0,
  company_tax_cost BIGINT NOT NULL DEFAULT 0,
  UNIQUE (version_id, employee_id)
);

CREATE INDEX IF NOT EXISTS payroll_run_lines_version_idx ON payroll_run_lines (version_id);
