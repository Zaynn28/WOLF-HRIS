-- One work email per company. The same address may exist in another company.
-- Additive. Does not rewrite existing employee rows.

CREATE UNIQUE INDEX IF NOT EXISTS employees_company_email_unique
  ON employees (company_id, lower(btrim(email)))
  WHERE email IS NOT NULL AND btrim(email) <> '';
