-- Employee document metadata. File bytes stay on disk under .local/employee-documents.
-- Additive. Apply to atrium_hris (local or Cloud SQL). Do not run migrate.js.

CREATE TABLE IF NOT EXISTS employee_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT NOT NULL,
  employee_id UUID NOT NULL,
  document_type_name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  verification_status TEXT NOT NULL DEFAULT 'PENDING',
  uploaded_by TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  verified_by TEXT,
  verified_at TIMESTAMPTZ,
  CONSTRAINT employee_documents_type_check CHECK (length(btrim(document_type_name)) BETWEEN 1 AND 80),
  CONSTRAINT employee_documents_name_check CHECK (length(btrim(file_name)) BETWEEN 1 AND 180),
  CONSTRAINT employee_documents_size_check CHECK (file_size > 0 AND file_size <= 8388608),
  CONSTRAINT employee_documents_status_check CHECK (verification_status IN ('PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED'))
);

CREATE INDEX IF NOT EXISTS employee_documents_employee_idx
  ON employee_documents (company_id, employee_id, uploaded_at DESC);

CREATE INDEX IF NOT EXISTS employee_documents_company_idx
  ON employee_documents (company_id, uploaded_at DESC);

-- Rollback later:
-- DROP TABLE IF EXISTS employee_documents;
