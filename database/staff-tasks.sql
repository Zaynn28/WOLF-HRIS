-- Additive staff-task store for one company.
-- Do not run database/schema.sql or server/migrate.js.

CREATE TABLE IF NOT EXISTS staff_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL REFERENCES hris_companies (id),
  employee_id uuid NOT NULL REFERENCES employees (id) ON DELETE RESTRICT,
  employee_code text NOT NULL,
  title text NOT NULL,
  detail text NOT NULL DEFAULT '',
  due_date date NOT NULL,
  status text NOT NULL,
  assigner_name text NOT NULL DEFAULT 'Organization',
  external_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT staff_tasks_company_external_key UNIQUE (company_id, external_id),
  CONSTRAINT staff_tasks_status_check CHECK (status IN ('ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'COMPLETED')),
  CONSTRAINT staff_tasks_title_check CHECK (length(btrim(title)) BETWEEN 1 AND 160),
  CONSTRAINT staff_tasks_code_check CHECK (employee_code ~ '^[A-Z0-9][A-Z0-9-]{1,31}$'),
  CONSTRAINT staff_tasks_external_check CHECK (external_id ~ '^[a-z0-9][a-z0-9:_-]{2,80}$'),
  CONSTRAINT staff_tasks_assigner_check CHECK (length(btrim(assigner_name)) BETWEEN 1 AND 80 AND position('@' in assigner_name) = 0)
);

CREATE INDEX IF NOT EXISTS staff_tasks_company_employee_idx ON staff_tasks (company_id, employee_id);
