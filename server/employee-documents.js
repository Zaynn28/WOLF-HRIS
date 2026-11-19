import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";

const maxBytes = 8 * 1024 * 1024;
const companyPattern = /^(amg|bzg|ggv)$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fileNamePattern = /^[A-Za-z0-9][A-Za-z0-9 ._()\--]{0,179}$/;
const typePattern = /^[A-Za-z0-9][A-Za-z0-9 /&._-]{0,79}$/;

export const employeeDocumentRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.local/employee-documents",
);

const mimeByExt = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export function presentEmployeeDocument(row) {
  if (!row) return null;
  return {
    id: row.id,
    employee_id: row.employee_id,
    document_type_name: row.document_type_name,
    file_name: row.file_name,
    file_size: Number(row.file_size),
    mime_type: row.mime_type,
    verification_status: row.verification_status,
    uploaded_at: row.uploaded_at,
    uploaded_by: row.uploaded_by ?? null,
    verified_at: row.verified_at ?? null,
    verified_by: row.verified_by ?? null,
  };
}

export function documentRelative(companyId, employeeId, documentId, ext) {
  if (!companyPattern.test(companyId) || !uuidPattern.test(employeeId) || !uuidPattern.test(documentId)) return null;
  if (!Object.prototype.hasOwnProperty.call(mimeByExt, ext)) return null;
  return `${companyId}/${employeeId}/${documentId}.${ext}`;
}

function extensionForMime(mime) {
  if (mime === "application/pdf") return "pdf";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "application/msword") return "doc";
  if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx";
  return null;
}

function sniffMime(bytes, claimed) {
  if (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return "application/pdf";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8
    && bytes[0] === 0x89
    && bytes[1] === 0x50
    && bytes[2] === 0x4e
    && bytes[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12
    && bytes[0] === 0x52
    && bytes[1] === 0x49
    && bytes[2] === 0x46
    && bytes[3] === 0x46
    && bytes[8] === 0x57
    && bytes[9] === 0x45
    && bytes[10] === 0x42
    && bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  if (claimed === "application/msword" || claimed === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return claimed;
  }
  return null;
}

export function readDocumentPayload(input) {
  if (!input || typeof input !== "object") return { ok: false, error: "A document file is required." };
  const documentTypeName = typeof input.document_type_name === "string" ? input.document_type_name.trim() : "";
  const fileName = typeof input.file_name === "string" ? input.file_name.trim() : "";
  if (!typePattern.test(documentTypeName)) return { ok: false, error: "Choose a document type." };
  if (!fileNamePattern.test(fileName)) return { ok: false, error: "The file name is not valid." };
  const payload = input.file ?? input.data_url ?? input.dataUrl;
  if (payload == null || payload === "") return { ok: false, error: "A document file is required." };
  if (typeof payload !== "string") return { ok: false, error: "Use a file under 8 MB." };
  const base64 = payload.includes(",") ? payload.slice(payload.indexOf(",") + 1) : payload;
  const compact = base64.replace(/\s/g, "");
  if (compact === "" || !/^[A-Za-z0-9+/=]+$/.test(compact)) return { ok: false, error: "Use a file under 8 MB." };
  let bytes;
  try {
    bytes = Buffer.from(compact, "base64");
  } catch {
    return { ok: false, error: "Use a file under 8 MB." };
  }
  if (bytes.length === 0 || bytes.length > maxBytes) return { ok: false, error: "Keep each file under 8 MB." };
  const claimed = typeof input.mime_type === "string" ? input.mime_type.trim().toLowerCase() : "";
  const mime = sniffMime(bytes, claimed);
  if (!mime) return { ok: false, error: "Use a PDF, image, or Word document." };
  const ext = extensionForMime(mime);
  if (!ext) return { ok: false, error: "Use a PDF, image, or Word document." };
  return {
    ok: true,
    documentTypeName,
    fileName,
    mime,
    ext,
    bytes,
    fileSize: bytes.length,
  };
}

export function resolveStoredDocument(root, relative) {
  if (typeof relative !== "string" || relative === "" || relative.includes("\0")) return null;
  const rootPath = path.resolve(root);
  const resolved = path.resolve(rootPath, relative);
  if (resolved !== rootPath && !resolved.startsWith(rootPath + path.sep)) return null;
  if (resolved === rootPath) return null;
  return resolved;
}

export async function writeStoredDocument(root, relative, bytes) {
  const target = resolveStoredDocument(root, relative);
  if (!target) throw new Error("document path refused");
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.tmp`;
  await writeFile(temporary, bytes, { flag: "w" });
  await rename(temporary, target);
}

export async function readStoredDocument(root, relative) {
  const target = resolveStoredDocument(root, relative);
  if (!target) return null;
  try {
    return await readFile(target);
  } catch {
    return null;
  }
}

export async function removeStoredDocument(root, relative) {
  const target = resolveStoredDocument(root, relative);
  if (!target) return;
  await rm(target, { force: true });
}
