import test from "node:test";
import assert from "node:assert/strict";
import { readDocumentPayload, documentRelative, presentEmployeeDocument } from "./employee-documents.js";

test("readDocumentPayload accepts a PDF data URL and rejects empty payloads", () => {
  const pdf = Buffer.from("%PDF-1.4 sample");
  const ok = readDocumentPayload({
    document_type_name: "KTP",
    file_name: "ktp.pdf",
    file: `data:application/pdf;base64,${pdf.toString("base64")}`,
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.documentTypeName, "KTP");
  assert.equal(ok.mime, "application/pdf");
  assert.equal(ok.ext, "pdf");

  const missing = readDocumentPayload({ document_type_name: "KTP", file_name: "ktp.pdf" });
  assert.equal(missing.ok, false);
});

test("documentRelative only allows company and uuid path segments", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  assert.equal(documentRelative("bzg", id, id, "pdf"), `bzg/${id}/${id}.pdf`);
  assert.equal(documentRelative("zzz", id, id, "pdf"), null);
  assert.equal(documentRelative("bzg", "not-a-uuid", id, "pdf"), null);
});

test("presentEmployeeDocument maps metadata without storage path", () => {
  const presented = presentEmployeeDocument({
    id: "11111111-1111-4111-8111-111111111111",
    employee_id: "22222222-2222-4222-8222-222222222222",
    document_type_name: "NPWP",
    file_name: "npwp.pdf",
    file_size: 1200,
    mime_type: "application/pdf",
    verification_status: "PENDING",
    uploaded_at: "2026-11-12T00:00:00.000Z",
    storage_path: "bzg/hidden.pdf",
  });
  assert.equal(presented.document_type_name, "NPWP");
  assert.equal("storage_path" in presented, false);
});
