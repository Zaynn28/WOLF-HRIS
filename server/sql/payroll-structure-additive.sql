-- Additive payroll structure and period snapshots.
-- Apply only to 127.0.0.1:5434/atrium_hris_local. Do not run migrate.js.
-- Re-running this script does not rewrite a snapshot that already exists
-- and does not update payroll_records or employees.

CREATE TABLE IF NOT EXISTS payroll_structures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL REFERENCES hris_companies (id),
  effective_from date NOT NULL,
  gross_formula text NOT NULL,
  net_formula text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (company_id, effective_from)
);

CREATE TABLE IF NOT EXISTS payroll_structure_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id uuid NOT NULL REFERENCES payroll_structures (id),
  company_id text NOT NULL REFERENCES hris_companies (id),
  code text NOT NULL,
  display_name text NOT NULL,
  kind text NOT NULL,
  sort_order integer NOT NULL,
  active boolean NOT NULL DEFAULT TRUE,
  UNIQUE (structure_id, code),
  CONSTRAINT payroll_structure_components_kind_check CHECK (kind IN ('earning', 'deduction')),
  CONSTRAINT payroll_structure_components_code_check CHECK (code ~ '^[a-z][a-z0-9_]{0,31}$'),
  CONSTRAINT payroll_structure_components_sort_check CHECK (sort_order >= 0)
);

CREATE INDEX IF NOT EXISTS payroll_structures_company_effective_idx
  ON payroll_structures (company_id, effective_from DESC);

CREATE INDEX IF NOT EXISTS payroll_structure_components_company_idx
  ON payroll_structure_components (company_id, structure_id);

CREATE TABLE IF NOT EXISTS payroll_period_structures (
  payroll_period_id uuid PRIMARY KEY REFERENCES payroll_periods (id) ON DELETE CASCADE,
  company_id text NOT NULL REFERENCES hris_companies (id),
  effective_from date NOT NULL,
  gross_formula text NOT NULL,
  net_formula text NOT NULL,
  components jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT payroll_period_structures_components_array CHECK (jsonb_typeof(components) = 'array')
);

CREATE INDEX IF NOT EXISTS payroll_period_structures_company_idx
  ON payroll_period_structures (company_id, payroll_period_id);

INSERT INTO payroll_structures (company_id, effective_from, gross_formula, net_formula)
SELECT company_id,
       MIN(start_date),
       'basic + allowance + overtime + service_charge',
       'gross - deductions'
FROM payroll_periods
WHERE company_id IS NOT NULL
GROUP BY company_id
ON CONFLICT (company_id, effective_from) DO NOTHING;

INSERT INTO payroll_structure_components (structure_id, company_id, code, display_name, kind, sort_order, active)
SELECT structure.id, structure.company_id, component.code, component.display_name, component.kind, component.sort_order, TRUE
FROM payroll_structures structure
CROSS JOIN (
  VALUES
    ('basic', 'Basic', 'earning', 10),
    ('allowance', 'Allowance', 'earning', 20),
    ('overtime', 'Overtime', 'earning', 30),
    ('service_charge', 'Service Charge', 'earning', 40),
    ('deductions', 'Deductions', 'deduction', 50)
) AS component(code, display_name, kind, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM payroll_structure_components existing WHERE existing.structure_id = structure.id
);

INSERT INTO payroll_period_structures (
  payroll_period_id, company_id, effective_from, gross_formula, net_formula, components
)
SELECT period.id,
       period.company_id,
       period.start_date,
       'basic + allowance + overtime + service_charge',
       'gross - deductions',
       '[
         {"code":"basic","display_name":"Basic","kind":"earning","sort_order":10,"active":true},
         {"code":"allowance","display_name":"Allowance","kind":"earning","sort_order":20,"active":true},
         {"code":"overtime","display_name":"Overtime","kind":"earning","sort_order":30,"active":true},
         {"code":"service_charge","display_name":"Service Charge","kind":"earning","sort_order":40,"active":true},
         {"code":"deductions","display_name":"Deductions","kind":"deduction","sort_order":50,"active":true}
       ]'::jsonb
FROM payroll_periods period
WHERE period.company_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM payroll_period_structures existing WHERE existing.payroll_period_id = period.id
  );

-- Rollback is a later forward drop, not applied by this script:
-- DROP TABLE IF EXISTS payroll_period_structures;
-- DROP TABLE IF EXISTS payroll_structure_components;
-- DROP TABLE IF EXISTS payroll_structures;
