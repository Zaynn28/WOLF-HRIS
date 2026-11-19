-- Additive: store full engine projection on payroll_records for Payslip / Processing.
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS component_amounts JSONB;
