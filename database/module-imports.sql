-- Additive company-scoped bulk import store.
-- Do not run database/schema.sql or server/migrate.js.

CREATE TABLE IF NOT EXISTS hris_module_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL REFERENCES hris_companies (id),
  module text NOT NULL,
  natural_key text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT hris_module_imports_module_check CHECK (module IN (
    'shifts', 'attendance', 'leave', 'overtime', 'hiring', 'contracts', 'documents',
    'assets', 'payroll', 'payroll-review', 'service-charge', 'payroll-finance',
    'reimbursements', 'loans'
  )),
  CONSTRAINT hris_module_imports_key UNIQUE (company_id, module, natural_key)
);

CREATE INDEX IF NOT EXISTS hris_module_imports_company_module_idx
  ON hris_module_imports (company_id, module);
