-- Company tariff on a payroll component. Additive.
-- Null rate or an empty wage base means the tariff is not configured.
-- rate_bp is basis points (two decimal places of a percent). Do not backfill rates.

ALTER TABLE payroll_structure_components
  ADD COLUMN IF NOT EXISTS rate_bp integer,
  ADD COLUMN IF NOT EXISTS wage_base text[] NOT NULL DEFAULT '{}';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payroll_structure_components_rate_bp_check'
  ) THEN
    ALTER TABLE payroll_structure_components
      ADD CONSTRAINT payroll_structure_components_rate_bp_check
      CHECK (rate_bp IS NULL OR (rate_bp >= 0 AND rate_bp <= 10000));
  END IF;
END $$;

-- Rollback is a later forward drop, not applied by this script:
-- ALTER TABLE payroll_structure_components DROP CONSTRAINT IF EXISTS payroll_structure_components_rate_bp_check;
-- ALTER TABLE payroll_structure_components DROP COLUMN IF EXISTS wage_base;
-- ALTER TABLE payroll_structure_components DROP COLUMN IF EXISTS rate_bp;
