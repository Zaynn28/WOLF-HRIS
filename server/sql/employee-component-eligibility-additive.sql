-- Per-employee payroll component eligibility. Additive. Does not change payroll records.
-- A later row for the same employee and component replaces the earlier one from its effective date.

CREATE TABLE IF NOT EXISTS employee_component_eligibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL REFERENCES hris_companies (id),
  employee_id uuid NOT NULL REFERENCES employees (id),
  component_code text NOT NULL,
  eligible boolean NOT NULL,
  amount bigint,
  effective_from date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT employee_component_eligibility_code_check CHECK (component_code ~ '^[a-z][a-z0-9_]{0,31}$'),
  CONSTRAINT employee_component_eligibility_amount_check CHECK (amount IS NULL OR amount >= 0),
  CONSTRAINT employee_component_eligibility_ineligible_amount_check CHECK (eligible OR amount IS NULL),
  UNIQUE (company_id, employee_id, component_code, effective_from)
);

CREATE INDEX IF NOT EXISTS employee_component_eligibility_current_idx
  ON employee_component_eligibility (company_id, employee_id, component_code, effective_from DESC);

-- Rollback is a later forward drop, not applied by this script:
-- DROP TABLE IF EXISTS employee_component_eligibility;
