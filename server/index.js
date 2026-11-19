import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { randomBytes, randomUUID } from 'node:crypto';
import { assertHrisDatabaseTarget, db } from './database.js';
import { companyForWrite, hrCompanyGate, listForCompany, nestedAccess, payrollApprovalAccess, recordAccess } from './company-scope.js';
import { hrContextFromHeader } from './assertion.js';
import { catalogForCompanyIsolation, companyIsolationReady, employeeReadReady, replaceCompanyIsolationCatalog } from './isolation.js';
import { externalIdAllowed, projectStaffTask, staffTaskWrite } from './staff-tasks.js';
import { registerImportRoutes } from './import-routes.js';
import {
  canRequestChange,
  canReviewChange,
  baseSalaryPatch,
  changedFieldNames,
  mimeForPhoto,
  photoRelative,
  presentChangeRequest,
  presentEmployee,
  profilePatch,
  readStoredBaseSalary,
  profilePhotoRoot,
  readProfilePhoto,
  readStoredPhoto,
  removeStoredPhoto,
  writeStoredPhoto,
} from './employee-profile.js';
import { payrollPeriodInput, presentPayrollLine } from './payroll-basic.js';
import { applyPayOverlay, eligibilityInput, presentEligibility, structureWithCompanyTariffs } from './employee-pay-components.js';
import { payrollSettingsChanged, payrollSettingsPatch, presentPayrollSettings } from './employee-payroll-settings.js';
import {
  employeePayrollConfigPatch,
  presentEmployeePayrollConfig,
} from './employee-payroll-config.js';
import { defaultPayrollStructure, evaluatePayroll, payrollStructureInput, presentPayrollStructure } from './payroll-structure.js';
import { isSharedTariff } from './payroll-tariff.js';
import { webhookSecretAccepts } from './fingerspot.js';
import { photoSideAllowed, planCorrectionRequest, presentPunchDay, punchSiteInput } from './phone-punch.js';
import {
  documentRelative,
  employeeDocumentRoot,
  presentEmployeeDocument,
  readDocumentPayload,
  readStoredDocument,
  removeStoredDocument,
  writeStoredDocument,
} from './employee-documents.js';
import { generatePayrollRun } from './payroll-generate.js';
import { buildBankTransferFile } from './bank-export.js';
import {
  allocatePools,
  applyFlatPph,
  defaultContractEligible,
  splitEqualPerPresentDay,
} from './service-charge-engine.js';
import { lookupTerRateBp } from './payroll-engine.js';
import { serviceChargePayDate } from './service-charge-pay.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '12mb' }));

app.post('/api/fingerspot/webhook', async (req, res) => {
  if (!webhookSecretAccepts(process.env.WOLF_FINGERSPOT_WEBHOOK_SECRET, req.get('x-wolf-fingerspot-broker'))) {
    return res.status(401).json({ error: 'Fingerprint webhook is refused.' });
  }
  try {
    await db.ensureFingerspotTables();
    const result = await db.acceptFingerspotAttlog(req.body);
    res.status(result.status).json(result.body);
  } catch {
    res.status(500).json({ error: 'Fingerprint scan was not stored.' });
  }
});

app.use((req, res, next) => {
  if (!req.path.startsWith("/api/")) return next();
  const context = hrContextFromHeader(req.get("x-wolf-hr-assertion"), process.env);
  if (!context) {
    return res.status(401).json({ error: "HR is not available for this session." });
  }
  req.hrContext = context;
  next();
});

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ============================================
// HEALTH CHECK
// ============================================

app.get('/api/health', async (req, res) => {
  const gate = hrCompanyGate(req.hrContext);
  if (gate) return res.status(gate.status).json(gate.body);
  try {
    const connected = await db.testConnection();
    res.json({ 
      status: 'ok', 
      database: connected ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

function companyDenied(res, decision) {
  return res.status(decision.status).json(decision.body);
}

function recordsUnconnected(res) {
  return res.status(403).json({ error: "HR records are not connected for this company." });
}

function blockUntilCompanyIsolation(res) {
  if (companyIsolationReady()) return null;
  return recordsUnconnected(res);
}

function blockUntilEmployeeRead(res) {
  if (employeeReadReady()) return null;
  return recordsUnconnected(res);
}

function workspaceDenied(res) {
  return res.status(403).json({ error: "That HR operation is blocked." });
}

function profileAudit(req, action, entityType, entityId, fieldNames, photo) {
  const names = Array.isArray(fieldNames) ? fieldNames : [];
  return db.createAuditLog({
    action,
    entity_type: entityType,
    entity_id: entityId,
    old_value: { fields: names },
    new_value: photo ? { fields: names, photo: true } : { fields: names },
    reason: req.hrContext.userId,
    ip_address: req.ip,
    company_id: req.hrContext.companyId,
  }).catch(() => undefined);
}

function presentSelf(row) {
  const presented = presentEmployee(row);
  for (const key of ["nik", "npwp", "gender", "date_of_birth", "bank_name", "bank_account_number", "bank_account_name", "ptkp_code", "termination_date", "gaji_pokok", "bpjs_enrolled", "company_covers_employee_bpjs", "tax_configuration"]) {
    delete presented[key];
  }
  return presented;
}

async function linkedProfile(context, fields, employee) {
  const departmentId = Object.prototype.hasOwnProperty.call(fields, "department_id") ? fields.department_id : employee.department_id;
  if (fields.department_id) {
    const department = await db.getDepartmentById(fields.department_id, context.companyId);
    const access = recordAccess(context, department);
    if (access.status !== 200) return access;
  }
  if (fields.position_id) {
    const position = await db.getPositionById(fields.position_id, context.companyId);
    const access = recordAccess(context, position);
    if (access.status !== 200) return access;
    if (departmentId && position.department_id && position.department_id !== departmentId) {
      return { status: 400, body: { error: "The profile fields are not valid." } };
    }
  }
  return null;
}

async function saveEmployeeProfile(req, res) {
  const gate = hrCompanyGate(req.hrContext);
  if (gate) return companyDenied(res, gate);
  if (req.hrContext.workspace !== "hr") return workspaceDenied(res);
  if (blockUntilEmployeeRead(res)) return;
  const parsed = profilePatch(req.body ?? {});
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  const salary = baseSalaryPatch(req.body ?? {});
  if (!salary.ok) return res.status(400).json({ error: salary.error });
  const photo = readProfilePhoto(req.body?.photo);
  if (!photo.ok) return res.status(400).json({ error: photo.error });
  let written = null;
  try {
    const existing = await db.getEmployeeById(req.params.id, req.hrContext.companyId);
    const access = recordAccess(req.hrContext, existing);
    if (access.status !== 200) return companyDenied(res, access);
    const link = await linkedProfile(req.hrContext, parsed.fields, existing);
    if (link) return link.status === 400 ? res.status(400).json(link.body) : companyDenied(res, link);
    const names = changedFieldNames(existing, parsed.fields);
    const nextSalary = salary.present ? salary.value : undefined;
    if (nextSalary !== undefined && readStoredBaseSalary(existing.gaji_pokok) !== nextSalary) names.push("gaji_pokok");
    if (names.length === 0 && !photo.photo) return res.status(400).json({ error: "Nothing to save." });
    if (photo.photo) {
      written = photoRelative(req.hrContext.companyId, existing.employee_code, `profile.${photo.photo.ext}`);
      if (!written) return res.status(400).json({ error: "The profile fields are not valid." });
      await writeStoredPhoto(profilePhotoRoot, written, photo.photo.bytes);
    }
    const employee = await db.applyProfileFields(
      existing.id,
      req.hrContext.companyId,
      parsed.fields,
      written ?? undefined,
      null,
      names.includes("gaji_pokok") ? nextSalary : undefined,
    );
    const saved = recordAccess(req.hrContext, employee);
    if (saved.status !== 200) {
      if (written) await removeStoredPhoto(profilePhotoRoot, written);
      return companyDenied(res, saved);
    }
    if (written && existing.profile_photo_path && existing.profile_photo_path !== written) {
      await removeStoredPhoto(profilePhotoRoot, existing.profile_photo_path);
    }
    await profileAudit(req, "UPDATE", "Employee", existing.id, names, Boolean(photo.photo));
    res.json(presentEmployee(saved.record, { includeBaseSalary: true }));
  } catch (error) {
    if (written) await removeStoredPhoto(profilePhotoRoot, written);
    console.error(`profile save failed ${error.code || ""}`);
    res.status(500).json({ error: "The profile could not be saved." });
  }
}

// ============================================
// EMPLOYEES API
// ============================================

app.get('/api/employees', async (req, res) => {
  const gate = hrCompanyGate(req.hrContext);
  if (gate) return companyDenied(res, gate);
  if (blockUntilEmployeeRead(res)) return;
  try {
    const employees = await db.getAllEmployees(req.hrContext.companyId);
    const visible = listForCompany(req.hrContext, employees);
    res.json(visible.rows.map(presentEmployee));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/employees/:id', async (req, res) => {
  const gate = hrCompanyGate(req.hrContext);
  if (gate) return companyDenied(res, gate);
  if (blockUntilEmployeeRead(res)) return;
  try {
    const employee = await db.getEmployeeById(req.params.id, req.hrContext.companyId);
    const access = recordAccess(req.hrContext, employee);
    if (access.status !== 200) return companyDenied(res, access);
    res.json(presentEmployee(access.record, { includeBaseSalary: req.hrContext.workspace === "hr" }));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/employees/:id/photo', async (req, res) => {
  const gate = hrCompanyGate(req.hrContext);
  if (gate) return companyDenied(res, gate);
  if (req.hrContext.workspace !== "hr" && req.hrContext.workspace !== "self") return workspaceDenied(res);
  if (blockUntilEmployeeRead(res)) return;
  try {
    const employee = await db.getEmployeeById(req.params.id, req.hrContext.companyId);
    const access = recordAccess(req.hrContext, employee);
    if (access.status !== 200) return companyDenied(res, access);
    if (req.hrContext.workspace === "self") {
      const own = await db.getEmployeeBySelfUser(req.hrContext.companyId, req.hrContext.userId);
      if (!own || own.id !== employee.id) return workspaceDenied(res);
    }
    const mime = mimeForPhoto(employee.profile_photo_path);
    const bytes = mime ? await readStoredPhoto(profilePhotoRoot, employee.profile_photo_path) : null;
    if (!bytes) return res.status(404).json({ error: "No profile photo is stored." });
    res.setHeader("Content-Type", mime);
    res.setHeader("Cache-Control", "private, no-store");
    res.end(bytes);
  } catch (error) {
    console.error(`profile photo failed ${error.code || ""}`);
    res.status(500).json({ error: "The profile photo is not available." });
  }
});

app.get('/api/self/profile', async (req, res) => {
  const gate = hrCompanyGate(req.hrContext);
  if (gate) return companyDenied(res, gate);
  if (!canRequestChange(req.hrContext.workspace)) return workspaceDenied(res);
  if (blockUntilEmployeeRead(res)) return;
  try {
    const employee = await db.getEmployeeBySelfUser(req.hrContext.companyId, req.hrContext.userId);
    if (!employee) return res.status(404).json({ error: "This login is not linked to an employee record." });
    const access = recordAccess(req.hrContext, employee);
    if (access.status !== 200) return companyDenied(res, access);
    res.json(presentSelf(access.record));
  } catch (error) {
    console.error(`self profile failed ${error.code || ""}`);
    res.status(500).json({ error: "The profile is not available." });
  }
});

async function storeEmployeeDocuments(req, res, employee) {
  const files = Array.isArray(req.body?.files) ? req.body.files : [req.body];
  if (files.length === 0) return res.status(400).json({ error: "Choose at least one file." });
  if (files.length > 20) return res.status(400).json({ error: "Upload at most 20 files at once." });
  const created = [];
  const writtenPaths = [];
  try {
    for (const item of files) {
      const parsed = readDocumentPayload(item);
      if (!parsed.ok) {
        for (const relative of writtenPaths) await removeStoredDocument(employeeDocumentRoot, relative);
        return res.status(400).json({ error: parsed.error });
      }
      const id = randomUUID();
      const relative = documentRelative(req.hrContext.companyId, employee.id, id, parsed.ext);
      if (!relative) {
        for (const path of writtenPaths) await removeStoredDocument(employeeDocumentRoot, path);
        return res.status(400).json({ error: "The document could not be stored." });
      }
      await writeStoredDocument(employeeDocumentRoot, relative, parsed.bytes);
      writtenPaths.push(relative);
      const row = await db.createEmployeeDocument({
        id,
        company_id: req.hrContext.companyId,
        employee_id: employee.id,
        document_type_name: parsed.documentTypeName,
        file_name: parsed.fileName,
        file_size: parsed.fileSize,
        mime_type: parsed.mime,
        storage_path: relative,
        uploaded_by: req.hrContext.userId,
      });
      created.push(presentEmployeeDocument(row));
    }
    await db.createAuditLog({
      action: "UPLOAD",
      entity_type: "Document",
      entity_id: created[0]?.id,
      new_value: { count: created.length, employee_id: employee.id },
      reason: req.hrContext.userId,
      ip_address: req.ip,
      company_id: req.hrContext.companyId,
    }).catch(() => undefined);
    return res.status(201).json({ documents: created });
  } catch (error) {
    for (const relative of writtenPaths) await removeStoredDocument(employeeDocumentRoot, relative).catch(() => undefined);
    console.error(`document upload failed ${error.code || ""}`);
    return res.status(500).json({ error: "The documents were not saved." });
  }
}

app.get('/api/self/documents', async (req, res) => {
  const gate = hrCompanyGate(req.hrContext);
  if (gate) return companyDenied(res, gate);
  if (req.hrContext.workspace !== "self" && req.hrContext.workspace !== "hr") return workspaceDenied(res);
  if (blockUntilEmployeeRead(res)) return;
  try {
    const employee = await db.getEmployeeBySelfUser(req.hrContext.companyId, req.hrContext.userId);
    if (!employee) return res.status(404).json({ error: "This login is not linked to an employee record." });
    const access = recordAccess(req.hrContext, employee);
    if (access.status !== 200) return companyDenied(res, access);
    const rows = await db.listEmployeeDocuments(req.hrContext.companyId, employee.id);
    res.json(rows.map(presentEmployeeDocument));
  } catch (error) {
    console.error(`self documents failed ${error.code || ""}`);
    res.status(500).json({ error: "Documents are not available." });
  }
});

app.post('/api/self/documents', async (req, res) => {
  const gate = hrCompanyGate(req.hrContext);
  if (gate) return companyDenied(res, gate);
  if (req.hrContext.workspace !== "self" && req.hrContext.workspace !== "hr") return workspaceDenied(res);
  if (blockUntilEmployeeRead(res)) return;
  try {
    const employee = await db.getEmployeeBySelfUser(req.hrContext.companyId, req.hrContext.userId);
    if (!employee) return res.status(404).json({ error: "This login is not linked to an employee record." });
    const access = recordAccess(req.hrContext, employee);
    if (access.status !== 200) return companyDenied(res, access);
    return storeEmployeeDocuments(req, res, employee);
  } catch (error) {
    console.error(`self document upload failed ${error.code || ""}`);
    res.status(500).json({ error: "The documents were not saved." });
  }
});

app.get('/api/self/documents/:id/file', async (req, res) => {
  const gate = hrCompanyGate(req.hrContext);
  if (gate) return companyDenied(res, gate);
  if (req.hrContext.workspace !== "self" && req.hrContext.workspace !== "hr") return workspaceDenied(res);
  if (blockUntilEmployeeRead(res)) return;
  try {
    const employee = await db.getEmployeeBySelfUser(req.hrContext.companyId, req.hrContext.userId);
    if (!employee) return res.status(404).json({ error: "This login is not linked to an employee record." });
    const row = await db.getEmployeeDocument(req.hrContext.companyId, req.params.id);
    if (!row || row.employee_id !== employee.id) return res.status(404).json({ error: "That document is not available." });
    const bytes = await readStoredDocument(employeeDocumentRoot, row.storage_path);
    if (!bytes) return res.status(404).json({ error: "That document file is not available." });
    res.setHeader("Content-Type", row.mime_type);
    res.setHeader("Content-Disposition", `inline; filename="${row.file_name.replace(/"/g, "")}"`);
    res.setHeader("Cache-Control", "private, no-store");
    res.end(bytes);
  } catch (error) {
    console.error(`self document file failed ${error.code || ""}`);
    res.status(500).json({ error: "That document file is not available." });
  }
});

app.get('/api/employees/:id/documents', async (req, res) => {
  const gate = hrCompanyGate(req.hrContext);
  if (gate) return companyDenied(res, gate);
  if (req.hrContext.workspace !== "hr") return workspaceDenied(res);
  if (blockUntilEmployeeRead(res)) return;
  try {
    const employee = await db.getEmployeeById(req.params.id, req.hrContext.companyId);
    const access = recordAccess(req.hrContext, employee);
    if (access.status !== 200) return companyDenied(res, access);
    const rows = await db.listEmployeeDocuments(req.hrContext.companyId, employee.id);
    res.json(rows.map(presentEmployeeDocument));
  } catch (error) {
    console.error(`employee documents failed ${error.code || ""}`);
    res.status(500).json({ error: "Documents are not available." });
  }
});

app.post('/api/employees/:id/documents', async (req, res) => {
  const gate = hrCompanyGate(req.hrContext);
  if (gate) return companyDenied(res, gate);
  if (req.hrContext.workspace !== "hr") return workspaceDenied(res);
  if (blockUntilEmployeeRead(res)) return;
  try {
    const employee = await db.getEmployeeById(req.params.id, req.hrContext.companyId);
    const access = recordAccess(req.hrContext, employee);
    if (access.status !== 200) return companyDenied(res, access);
    return storeEmployeeDocuments(req, res, employee);
  } catch (error) {
    console.error(`employee document upload failed ${error.code || ""}`);
    res.status(500).json({ error: "The documents were not saved." });
  }
});

app.get('/api/documents/:id/file', async (req, res) => {
  const gate = hrCompanyGate(req.hrContext);
  if (gate) return companyDenied(res, gate);
  if (req.hrContext.workspace !== "hr" && req.hrContext.workspace !== "self") return workspaceDenied(res);
  if (blockUntilEmployeeRead(res)) return;
  try {
    const row = await db.getEmployeeDocument(req.hrContext.companyId, req.params.id);
    if (!row) return res.status(404).json({ error: "That document is not available." });
    if (req.hrContext.workspace === "self") {
      const own = await db.getEmployeeBySelfUser(req.hrContext.companyId, req.hrContext.userId);
      if (!own || own.id !== row.employee_id) return res.status(404).json({ error: "That document is not available." });
    }
    const bytes = await readStoredDocument(employeeDocumentRoot, row.storage_path);
    if (!bytes) return res.status(404).json({ error: "That document file is not available." });
    res.setHeader("Content-Type", row.mime_type);
    res.setHeader("Content-Disposition", `inline; filename="${row.file_name.replace(/"/g, "")}"`);
    res.setHeader("Cache-Control", "private, no-store");
    res.end(bytes);
  } catch (error) {
    console.error(`document file failed ${error.code || ""}`);
    res.status(500).json({ error: "That document file is not available." });
  }
});

app.patch('/api/documents/:id', async (req, res) => {
  const gate = hrCompanyGate(req.hrContext);
  if (gate) return companyDenied(res, gate);
  if (req.hrContext.workspace !== "hr") return workspaceDenied(res);
  if (blockUntilEmployeeRead(res)) return;
  const status = typeof req.body?.verification_status === "string" ? req.body.verification_status.trim().toUpperCase() : "";
  if (status !== "VERIFIED" && status !== "REJECTED") {
    return res.status(400).json({ error: "Verification status must be VERIFIED or REJECTED." });
  }
  try {
    const existing = await db.getEmployeeDocument(req.hrContext.companyId, req.params.id);
    if (!existing) return res.status(404).json({ error: "That document is not available." });
    const employee = await db.getEmployeeById(existing.employee_id, req.hrContext.companyId);
    const access = recordAccess(req.hrContext, employee);
    if (access.status !== 200) return companyDenied(res, access);
    const row = await db.updateEmployeeDocumentStatus(req.hrContext.companyId, req.params.id, status, req.hrContext.userId);
    if (!row) return res.status(404).json({ error: "That document is not available." });
    res.json(presentEmployeeDocument(row));
  } catch (error) {
    console.error(`document verify failed ${error.code || ""}`);
    res.status(500).json({ error: "The document status was not updated." });
  }
});

app.post('/api/employees/wolf-link', async (req, res) => {
  const gate = hrCompanyGate(req.hrContext);
  if (gate) return companyDenied(res, gate);
  if (req.hrContext.workspace !== "hr") return workspaceDenied(res);
  const code = typeof req.body?.employee_code === "string" ? req.body.employee_code.trim() : "";
  const rawUser = req.body?.wolf_user_id;
  const wolfUserId = rawUser === null ? null : typeof rawUser === "string" ? rawUser.trim() : undefined;
  if (!code || wolfUserId === undefined || wolfUserId === "") {
    return res.status(400).json({ error: "The employee link is not valid." });
  }
  try {
    const result = await db.setWorkforceLink(req.hrContext.companyId, code, wolfUserId, req.body?.email);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    res.json({ ok: true });
  } catch (error) {
    console.error(`wolf link failed ${error.code || ""}`);
    res.status(500).json({ error: "The employee link was not saved." });
  }
});

app.post('/api/employees', async (req, res) => {
  const written = companyForWrite(req.hrContext, req.body);
  if (written.status !== 200) return companyDenied(res, written);
  if (req.hrContext.workspace !== "hr") return workspaceDenied(res);
  if (blockUntilCompanyIsolation(res)) return;
  try {
    if (written.fields.department_id) {
      const department = await db.getDepartmentById(written.fields.department_id, req.hrContext.companyId);
      const departmentAccess = recordAccess(req.hrContext, department);
      if (departmentAccess.status !== 200) return companyDenied(res, departmentAccess);
    }
    if (written.fields.position_id) {
      const position = await db.getPositionById(written.fields.position_id, req.hrContext.companyId);
      const positionAccess = recordAccess(req.hrContext, position);
      if (positionAccess.status !== 200) return companyDenied(res, positionAccess);
    }
    const employee = await db.createEmployee({ ...written.fields, company_id: req.hrContext.companyId });
    const access = recordAccess(req.hrContext, employee);
    if (access.status !== 200) return companyDenied(res, access);
    await db.createAuditLog({
      action: 'CREATE',
      entity_type: 'Employee',
      entity_id: employee.id,
      new_value: { employee_code: employee.employee_code },
      ip_address: req.ip,
      company_id: req.hrContext.companyId,
    }).catch(() => undefined);
    res.status(201).json(presentEmployee(access.record));
  } catch (error) {
    const status = error.status === 400 || error.status === 409 ? error.status : 500;
    res.status(status).json({ error: status === 500 ? "The employee was not saved." : error.message });
  }
});

app.put('/api/employees/:id', saveEmployeeProfile);
app.patch('/api/employees/:id', saveEmployeeProfile);

app.delete('/api/employees/:id', async (req, res) => {
  const gate = hrCompanyGate(req.hrContext);
  if (gate) return companyDenied(res, gate);
  if (req.hrContext.workspace !== "hr") return workspaceDenied(res);
  if (blockUntilCompanyIsolation(res)) return;
  try {
    const removed = await db.deleteEmployee(req.params.id, req.hrContext.companyId);
    if (!removed) return companyDenied(res, recordAccess(req.hrContext, null));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/profile-change-requests', async (req, res) => {
  const gate = hrCompanyGate(req.hrContext);
  if (gate) return companyDenied(res, gate);
  if (req.hrContext.workspace !== "hr" && !canRequestChange(req.hrContext.workspace)) return workspaceDenied(res);
  if (blockUntilEmployeeRead(res)) return;
  const status = req.query.status === "PENDING" || req.query.status === "APPROVED" || req.query.status === "REJECTED" ? req.query.status : null;
  try {
    const requestedBy = req.hrContext.workspace === "self" ? req.hrContext.userId : null;
    const rows = await db.listChangeRequests(req.hrContext.companyId, status, requestedBy);
    res.json(listForCompany(req.hrContext, rows).rows.map(presentChangeRequest));
  } catch (error) {
    console.error(`profile requests failed ${error.code || ""}`);
    res.status(500).json({ error: "Profile change requests are not available." });
  }
});

app.post('/api/profile-change-requests', async (req, res) => {
  const gate = hrCompanyGate(req.hrContext);
  if (gate) return companyDenied(res, gate);
  if (!canRequestChange(req.hrContext.workspace)) return workspaceDenied(res);
  if (blockUntilEmployeeRead(res)) return;
  const parsed = profilePatch(req.body ?? {});
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  const photo = readProfilePhoto(req.body?.photo);
  if (!photo.ok) return res.status(400).json({ error: photo.error });
  if (Object.keys(parsed.fields).length === 0 && !photo.photo) return res.status(400).json({ error: "Nothing to submit." });
  const requestId = randomUUID();
  let written = null;
  try {
    const employee = await db.getEmployeeBySelfUser(req.hrContext.companyId, req.hrContext.userId);
    if (!employee) return res.status(404).json({ error: "This login is not linked to an employee record." });
    const access = recordAccess(req.hrContext, employee);
    if (access.status !== 200) return companyDenied(res, access);
    const link = await linkedProfile(req.hrContext, parsed.fields, employee);
    if (link) return link.status === 400 ? res.status(400).json(link.body) : companyDenied(res, link);
    const pending = await db.getPendingChangeRequest(req.hrContext.companyId, employee.id);
    if (pending) return res.status(409).json({ error: "A profile change is already waiting for HR review." });
    const names = changedFieldNames(employee, parsed.fields);
    if (names.length === 0 && !photo.photo) return res.status(400).json({ error: "Nothing to submit." });
    const proposed = {};
    for (const name of names) proposed[name] = parsed.fields[name];
    if (photo.photo) {
      written = photoRelative(req.hrContext.companyId, employee.employee_code, `requests/${requestId}.${photo.photo.ext}`);
      if (!written) return res.status(400).json({ error: "The profile fields are not valid." });
      await writeStoredPhoto(profilePhotoRoot, written, photo.photo.bytes);
    }
    const created = await db.insertChangeRequest({
      id: requestId,
      company_id: req.hrContext.companyId,
      employee_id: employee.id,
      proposed,
      photo_path: written,
      requested_by: req.hrContext.userId,
    });
    await profileAudit(req, "CREATE", "EmployeeChangeRequest", created.id, names, Boolean(photo.photo));
    res.status(201).json(presentChangeRequest({ ...created, employee_code: employee.employee_code }));
  } catch (error) {
    if (written) await removeStoredPhoto(profilePhotoRoot, written);
    console.error(`profile request failed ${error.code || ""}`);
    res.status(500).json({ error: "The profile change could not be submitted." });
  }
});

app.get('/api/profile-change-requests/:id/photo', async (req, res) => {
  const gate = hrCompanyGate(req.hrContext);
  if (gate) return companyDenied(res, gate);
  if (req.hrContext.workspace !== "hr" && !canRequestChange(req.hrContext.workspace)) return workspaceDenied(res);
  if (blockUntilEmployeeRead(res)) return;
  try {
    const request = await db.getChangeRequest(req.params.id, req.hrContext.companyId);
    const access = recordAccess(req.hrContext, request);
    if (access.status !== 200) return companyDenied(res, access);
    if (req.hrContext.workspace === "self" && request.requested_by !== req.hrContext.userId) return workspaceDenied(res);
    const mime = mimeForPhoto(request.photo_path);
    const bytes = mime ? await readStoredPhoto(profilePhotoRoot, request.photo_path) : null;
    if (!bytes) return res.status(404).json({ error: "No profile photo is stored." });
    res.setHeader("Content-Type", mime);
    res.setHeader("Cache-Control", "private, no-store");
    res.end(bytes);
  } catch (error) {
    console.error(`profile request photo failed ${error.code || ""}`);
    res.status(500).json({ error: "The profile photo is not available." });
  }
});

async function reviewProfileRequest(req, res, status) {
  const gate = hrCompanyGate(req.hrContext);
  if (gate) return companyDenied(res, gate);
  if (blockUntilEmployeeRead(res)) return;
  let written = null;
  try {
    const request = await db.getChangeRequest(req.params.id, req.hrContext.companyId);
    const access = recordAccess(req.hrContext, request);
    if (access.status !== 200) return companyDenied(res, access);
    if (!canReviewChange(req.hrContext.workspace, request.requested_by, req.hrContext.userId)) return workspaceDenied(res);
    if (request.status !== "PENDING") return res.status(409).json({ error: "That request is no longer pending." });
    const parsed = profilePatch(request.proposed ?? {});
    if (status === "APPROVED" && !parsed.ok) return res.status(400).json({ error: parsed.error });
    const fields = parsed.ok ? parsed.fields : {};
    const names = Object.keys(fields);
    if (status === "APPROVED" && request.photo_path) {
      const bytes = await readStoredPhoto(profilePhotoRoot, request.photo_path);
      const ext = request.photo_path.endsWith(".png") ? "png" : request.photo_path.endsWith(".webp") ? "webp" : "jpg";
      written = bytes ? photoRelative(req.hrContext.companyId, request.employee_code, `profile.${ext}`) : null;
      if (!bytes || !written) return res.status(409).json({ error: "The profile photo is no longer available." });
      await writeStoredPhoto(profilePhotoRoot, written, bytes);
    }
    const previous = status === "APPROVED" ? await db.getEmployeeById(request.employee_id, req.hrContext.companyId) : null;
    const reviewed = await db.reviewChangeRequest(
      request.id,
      req.hrContext.companyId,
      req.hrContext.userId,
      status,
      fields,
      written ?? undefined,
    );
    if (!reviewed) {
      if (written) await removeStoredPhoto(profilePhotoRoot, written);
      return res.status(409).json({ error: "That request is no longer pending." });
    }
    if (written && previous?.profile_photo_path && previous.profile_photo_path !== written) {
      await removeStoredPhoto(profilePhotoRoot, previous.profile_photo_path);
    }
    await profileAudit(req, status === "APPROVED" ? "APPROVE" : "REJECT", "EmployeeChangeRequest", request.id, names, Boolean(request.photo_path));
    res.json({
      request: presentChangeRequest({ ...reviewed.request, employee_code: request.employee_code }),
      employee: reviewed.employee ? presentEmployee(reviewed.employee) : null,
    });
  } catch (error) {
    if (written) await removeStoredPhoto(profilePhotoRoot, written);
    console.error(`profile review failed ${error.code || ""}`);
    res.status(500).json({ error: "The profile change could not be reviewed." });
  }
}

app.post('/api/profile-change-requests/:id/approve', (req, res) => reviewProfileRequest(req, res, "APPROVED"));
app.post('/api/profile-change-requests/:id/reject', (req, res) => reviewProfileRequest(req, res, "REJECTED"));

// ============================================
// DEPARTMENTS API
// ============================================

app.get('/api/departments', async (req, res) => {
  const gate = hrCompanyGate(req.hrContext);
  if (gate) return companyDenied(res, gate);
  try {
    const departments = await db.getAllDepartments(req.hrContext.companyId);
    res.json(listForCompany(req.hrContext, departments).rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/positions', async (req, res) => {
  const gate = hrCompanyGate(req.hrContext);
  if (gate) return companyDenied(res, gate);
  try {
    const positions = await db.getAllPositions(req.hrContext.companyId);
    res.json(listForCompany(req.hrContext, positions).rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/positions', async (req, res) => {
  const written = companyForWrite(req.hrContext, req.body);
  if (written.status !== 200) return companyDenied(res, written);
  try {
    if (written.fields.department_id) {
      const department = await db.getDepartmentById(written.fields.department_id, req.hrContext.companyId);
      const departmentAccess = recordAccess(req.hrContext, department);
      if (departmentAccess.status !== 200) return companyDenied(res, departmentAccess);
    }
    const position = await db.createPosition(written.fields, req.hrContext.companyId);
    const access = recordAccess(req.hrContext, position);
    if (access.status !== 200) return companyDenied(res, access);
    res.status(201).json(access.record);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/departments/:id', async (req, res) => {
  const written = companyForWrite(req.hrContext, req.body);
  if (written.status !== 200) return companyDenied(res, written);
  try {
    const department = await db.updateDepartment(req.params.id, written.fields, req.hrContext.companyId);
    const access = recordAccess(req.hrContext, department);
    if (access.status !== 200) return companyDenied(res, access);
    res.json(access.record);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/departments/:id', async (req, res) => {
  const gate = hrCompanyGate(req.hrContext);
  if (gate) return companyDenied(res, gate);
  try {
    const removed = await db.deleteDepartment(req.params.id, req.hrContext.companyId);
    if (!removed) return companyDenied(res, recordAccess(req.hrContext, null));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/positions/:id', async (req, res) => {
  const written = companyForWrite(req.hrContext, req.body);
  if (written.status !== 200) return companyDenied(res, written);
  try {
    if (written.fields.department_id) {
      const department = await db.getDepartmentById(written.fields.department_id, req.hrContext.companyId);
      const departmentAccess = recordAccess(req.hrContext, department);
      if (departmentAccess.status !== 200) return companyDenied(res, departmentAccess);
    }
    const position = await db.updatePosition(req.params.id, written.fields, req.hrContext.companyId);
    const access = recordAccess(req.hrContext, position);
    if (access.status !== 200) return companyDenied(res, access);
    res.json(access.record);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/positions/:id', async (req, res) => {
  const gate = hrCompanyGate(req.hrContext);
  if (gate) return companyDenied(res, gate);
  try {
    const removed = await db.deletePosition(req.params.id, req.hrContext.companyId);
    if (!removed) return companyDenied(res, recordAccess(req.hrContext, null));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/departments', async (req, res) => {
  const written = companyForWrite(req.hrContext, req.body);
  if (written.status !== 200) return companyDenied(res, written);
  try {
    const department = await db.createDepartment(written.fields, req.hrContext.companyId);
    const access = recordAccess(req.hrContext, department);
    if (access.status !== 200) return companyDenied(res, access);
    res.status(201).json(access.record);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ATTENDANCE API
// ============================================

app.post('/api/attendance/punch', async (req, res) => {
  const gate = hrCompanyGate(req.hrContext);
  if (gate) return companyDenied(res, gate);
  if (req.hrContext.workspace !== 'self' && req.hrContext.workspace !== 'hr') {
    return res.status(403).json({ error: 'This punch is only for a signed-in staff account.' });
  }
  try {
    const result = await db.acceptPhonePunch({
      companyId: req.hrContext.companyId,
      userId: req.hrContext.userId,
      email: req.hrContext.email,
      workspace: req.hrContext.workspace,
      photo: req.body?.photo,
      latitude: req.body?.latitude,
      longitude: req.body?.longitude,
      accuracy: req.body?.accuracy,
      idempotencyKey: req.body?.idempotency_key,
      offSiteDuty: req.body?.off_site_duty === true,
      offSiteLocationNote: typeof req.body?.off_site_location_note === 'string' ? req.body.off_site_location_note.trim().slice(0, 120) : '',
      now: new Date(),
      ip: req.ip,
    });
    res.status(result.status).json(result.body);
  } catch {
    res.status(500).json({ error: 'The punch was not recorded.' });
  }
});

app.get('/api/attendance/mine', async (req, res) => {
  const gate = hrCompanyGate(req.hrContext);
  if (gate) return companyDenied(res, gate);
  if (req.hrContext.workspace !== 'self' && req.hrContext.workspace !== 'hr') return workspaceDenied(res);
  try {
    const result = await db.myPunch(req.hrContext.companyId, req.hrContext.userId, req.hrContext.email, new Date());
    res.status(result.status).json(result.body);
  } catch {
    res.status(500).json({ error: 'Attendance is not available.' });
  }
});

app.get('/api/attendance/:date', async (req, res) => {
  const gate = hrCompanyGate(req.hrContext);
  if (gate) return companyDenied(res, gate);
  try {
    if (req.hrContext.workspace === 'self') return workspaceDenied(res);
    const attendance = await db.getAttendanceByDate(req.params.date, req.hrContext.companyId);
    res.json(listForCompany(req.hrContext, attendance).rows.map((row) => presentPunchDay(row)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/fingerspot/unpaired', async (req, res) => {
  const gate = hrCompanyGate(req.hrContext);
  if (gate) return companyDenied(res, gate);
  try {
    await db.ensureFingerspotTables();
    const rows = await db.listUnpairedFingerspot(req.hrContext.companyId);
    res.json(rows.map((row) => ({ cloud_id: row.cloud_id, pin: row.pin, scanned_at: row.scanned_at })));
  } catch {
    res.status(500).json({ error: 'Fingerprint scans are not available.' });
  }
});

app.post('/api/fingerspot/pins', async (req, res) => {
  const gate = hrCompanyGate(req.hrContext);
  if (gate) return companyDenied(res, gate);
  const cloudId = typeof req.body?.cloud_id === 'string' ? req.body.cloud_id.trim() : '';
  const pin = typeof req.body?.pin === 'string' ? req.body.pin.trim() : '';
  const employeeCode = typeof req.body?.employee_code === 'string' ? req.body.employee_code.trim() : '';
  if (!cloudId || !pin || !employeeCode) return res.status(400).json({ error: 'Fingerprint pin is not valid.' });
  try {
    await db.ensureFingerspotTables();
    const employee = await db.getEmployeeByCode(req.hrContext.companyId, employeeCode);
    if (!employee) return res.status(404).json({ error: 'Employee is not in this company.' });
    const paired = await db.pairFingerspotPin(req.hrContext.companyId, cloudId, pin, employee.id);
    if (!paired) return res.status(404).json({ error: 'Fingerprint device is not connected.' });
    res.json({ paired: true, cloud_id: cloudId, pin, employee_code: employee.employee_code });
  } catch {
    res.status(500).json({ error: 'Fingerprint pin was not paired.' });
  }
});

app.get('/api/attendance-photos/:id/:side', async (req, res) => {
  const gate = hrCompanyGate(req.hrContext);
  if (gate) return companyDenied(res, gate);
  if (req.params.side !== 'in' && req.params.side !== 'out') return res.status(404).json({ error: 'No punch photo is stored.' });
  try {
    const own = req.hrContext.workspace === 'self'
      ? await db.getEmployeeBySelfUser(req.hrContext.companyId, req.hrContext.userId)
      : null;
    const photo = await db.punchPhoto(req.hrContext.companyId, req.params.id, req.params.side);
    if (!photo || !photoSideAllowed(req.hrContext.workspace, own?.id ?? null, photo.employeeId)) {
      return res.status(404).json({ error: 'No punch photo is stored.' });
    }
    res.set('cache-control', 'no-store');
    res.type('image/jpeg').send(photo.bytes);
  } catch {
    res.status(500).json({ error: 'The punch photo is not available.' });
  }
});

app.get('/api/punch-sites', async (req, res) => {
  const gate = hrCompanyGate(req.hrContext);
  if (gate) return companyDenied(res, gate);
  if (req.hrContext.workspace !== 'hr') return workspaceDenied(res);
  try {
    res.json(await db.listPunchSites(req.hrContext.companyId));
  } catch {
    res.status(500).json({ error: 'Punch sites are not available.' });
  }
});

app.post('/api/punch-sites', async (req, res) => {
  const gate = hrCompanyGate(req.hrContext);
  if (gate) return companyDenied(res, gate);
  if (req.hrContext.workspace !== 'hr') return workspaceDenied(res);
  const parsed = punchSiteInput(req.body);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  try {
    res.status(201).json(await db.createPunchSite(req.hrContext.companyId, parsed.site));
  } catch {
    res.status(500).json({ error: 'The punch site was not saved.' });
  }
});

app.patch('/api/punch-sites/:id', async (req, res) => {
  const gate = hrCompanyGate(req.hrContext);
  if (gate) return companyDenied(res, gate);
  if (req.hrContext.workspace !== 'hr') return workspaceDenied(res);
  const parsed = punchSiteInput(req.body);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  try {
    const saved = await db.updatePunchSite(req.hrContext.companyId, req.params.id, parsed.site);
    if (!saved) return res.status(404).json({ error: 'The punch site is not in this company.' });
    res.json(saved);
  } catch {
    res.status(500).json({ error: 'The punch site was not saved.' });
  }
});

app.get('/api/attendance-corrections', async (req, res) => {
  const gate = hrCompanyGate(req.hrContext);
  if (gate) return companyDenied(res, gate);
  if (req.hrContext.workspace !== 'hr') return workspaceDenied(res);
  try {
    res.json(await db.listAttendanceCorrections(req.hrContext.companyId));
  } catch {
    res.status(500).json({ error: 'Attendance corrections are not available.' });
  }
});

app.post('/api/attendance-corrections', async (req, res) => {
  const gate = hrCompanyGate(req.hrContext);
  if (gate) return companyDenied(res, gate);
  try {
    const employeeCode = typeof req.body?.employee_code === 'string' ? req.body.employee_code.trim() : '';
    const employee = employeeCode ? await db.getEmployeeByCode(req.hrContext.companyId, employeeCode) : null;
    const decision = planCorrectionRequest({
      workspace: req.hrContext.workspace,
      employee: employee ? { id: employee.id } : null,
      attendanceDate: req.body?.attendance_date,
      clockIn: req.body?.clock_in,
      clockOut: req.body?.clock_out,
      reason: req.body?.reason,
    });
    if (!decision.request) return res.status(decision.status).json(decision.body);
    const filed = await db.fileAttendanceCorrection({
      companyId: req.hrContext.companyId,
      userId: req.hrContext.userId,
      request: decision.request,
    });
    res.status(201).json({ id: filed.id, status: filed.status });
  } catch {
    res.status(500).json({ error: 'The correction was not filed.' });
  }
});

app.post('/api/attendance-corrections/:id/approve', async (req, res) => {
  const gate = hrCompanyGate(req.hrContext);
  if (gate) return companyDenied(res, gate);
  if (req.hrContext.workspace !== 'hr') return workspaceDenied(res);
  try {
    const result = await db.approveAttendanceCorrection(req.hrContext.companyId, req.params.id, req.hrContext.userId);
    res.status(result.status).json(result.body);
  } catch {
    res.status(500).json({ error: 'The correction was not approved.' });
  }
});

app.post('/api/attendance', async (req, res) => {
  const written = companyForWrite(req.hrContext, req.body);
  if (written.status !== 200) return companyDenied(res, written);
  try {
    const employee = await db.getEmployeeById(written.fields.employee_id, req.hrContext.companyId);
    const access = nestedAccess(req.hrContext, employee, { ...written.fields, employee_id: employee?.id });
    if (access.status !== 200) return companyDenied(res, access);
    const attendance = await db.createAttendance(written.fields);
    res.status(201).json(attendance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// LEAVE API
// ============================================

app.get('/api/leave-requests', async (req, res) => {
  const gate = hrCompanyGate(req.hrContext);
  if (gate) return companyDenied(res, gate);
  try {
    const requests = await db.getLeaveRequests(req.query, req.hrContext.companyId);
    res.json(listForCompany(req.hrContext, requests).rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/leave-requests', async (req, res) => {
  const written = companyForWrite(req.hrContext, req.body);
  if (written.status !== 200) return companyDenied(res, written);
  try {
    const employee = await db.getEmployeeById(written.fields.employee_id, req.hrContext.companyId);
    const access = nestedAccess(req.hrContext, employee, { ...written.fields, employee_id: employee?.id });
    if (access.status !== 200) return companyDenied(res, access);
    const request = await db.createLeaveRequest(written.fields);
    res.status(201).json(request);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/leave-requests/:id/approve', async (req, res) => {
  const gate = hrCompanyGate(req.hrContext);
  if (gate) return companyDenied(res, gate);
  try {
    const existing = await db.getLeaveRequestById(req.params.id, req.hrContext.companyId);
    const access = recordAccess(req.hrContext, existing);
    if (access.status !== 200) return companyDenied(res, access);
    const request = await db.approveLeaveRequest(req.params.id, req.hrContext.userId, req.hrContext.companyId);
    res.json(request);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// PAYROLL API
// ============================================

function payrollStaffOnly(context) {
  return context?.workspace === "hr";
}

function payrollBasicAudit(req, periodId) {
  return db.createAuditLog({
    action: "UPDATE",
    entity_type: "PayrollPeriod",
    entity_id: periodId,
    old_value: { fields: ["basic_salary"] },
    new_value: { fields: ["basic_salary"] },
    reason: req.hrContext.userId,
    ip_address: req.ip,
    company_id: req.hrContext.companyId,
  }).catch(() => undefined);
}

app.get('/api/payroll-periods', async (req, res) => {
  const gate = hrCompanyGate(req.hrContext);
  if (gate) return companyDenied(res, gate);
  if (!payrollStaffOnly(req.hrContext)) return workspaceDenied(res);
  if (blockUntilCompanyIsolation(res)) return;
  try {
    const periods = await db.getPayrollPeriods(req.hrContext.companyId);
    res.json(listForCompany(req.hrContext, periods).rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/payroll-periods', async (req, res) => {
  const gate = hrCompanyGate(req.hrContext);
  if (gate) return companyDenied(res, gate);
  if (!payrollStaffOnly(req.hrContext)) return workspaceDenied(res);
  if (blockUntilCompanyIsolation(res)) return;
  const written = companyForWrite(req.hrContext, req.body);
  if (written.status !== 200) return companyDenied(res, written);
  const parsed = payrollPeriodInput(written.fields);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  try {
    const ensured = await db.ensurePayrollPeriod(parsed.fields);
    if (!ensured.period) return res.status(409).json({ error: "That payroll period is not available for this company." });
    const access = recordAccess(req.hrContext, ensured.period);
    if (access.status !== 200) return companyDenied(res, access);
    const copied = await db.copyProfileBasicSalaries(req.hrContext.companyId, ensured.period.id);
    if (copied.changed > 0) await payrollBasicAudit(req, ensured.period.id);
    try {
      await db.ensurePayrollPeriodSnapshot(req.hrContext.companyId, ensured.period);
    } catch (error) {
      if (error?.message === "HRIS database target is refused") throw error;
      console.error(`payroll structure snapshot failed ${error.code || ""}`);
    }
    res.status(ensured.created ? 201 : 200).json(access.record);
  } catch (error) {
    console.error(`payroll period failed ${error.code || ""}`);
    res.status(500).json({ error: "The payroll period could not be opened." });
  }
});

app.post('/api/payroll-periods/:id/approve', async (req, res) => {
  const gate = hrCompanyGate(req.hrContext);
  if (gate) return companyDenied(res, gate);
  if (blockUntilCompanyIsolation(res)) return;
  try {
    const period = await db.getPayrollPeriodById(req.params.id, req.hrContext.companyId);
    const granted = await db.hasPayrollGrant(req.hrContext.companyId, req.hrContext.userId);
    const access = payrollApprovalAccess({ ...req.hrContext, hrisGrants: granted ? ["payroll"] : [] }, period);
    if (access.status !== 200) return companyDenied(res, access);
    const approved = await db.approvePayrollPeriod(req.params.id, req.hrContext.companyId);
    res.json(approved);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/payroll-structure', async (req, res) => {
  const gate = hrCompanyGate(req.hrContext);
  if (gate) return companyDenied(res, gate);
  if (!payrollStaffOnly(req.hrContext)) return workspaceDenied(res);
  if (blockUntilCompanyIsolation(res)) return;
  const periodId = typeof req.query.period_id === "string" ? req.query.period_id : "";
  if (periodId && !/^[0-9a-f-]{36}$/i.test(periodId)) {
    return res.status(400).json({ error: "The payroll structure is not valid." });
  }
  try {
    if (periodId) {
      const period = await db.getPayrollPeriodById(periodId, req.hrContext.companyId);
      const access = recordAccess(req.hrContext, period);
      if (access.status !== 200) return companyDenied(res, access);
      const snap = await db.ensurePayrollPeriodSnapshot(req.hrContext.companyId, access.record);
      return res.json(presentPayrollStructure(req.hrContext.companyId, snap?.snapshot ?? defaultPayrollStructure()));
    }
    const current = await db.getCompanyPayrollStructure(req.hrContext.companyId);
    return res.json(presentPayrollStructure(req.hrContext.companyId, current ?? defaultPayrollStructure()));
  } catch (error) {
    if (error?.message === "HRIS database target is refused") {
      return res.status(500).json({ error: "The payroll structure could not be opened." });
    }
    console.error(`payroll structure failed ${error.code || ""}`);
    return res.status(500).json({ error: "The payroll structure could not be opened." });
  }
});

app.put('/api/payroll-structure', async (req, res) => {
  // Advanced path retained for migration; primary UX is simple employee config + generate.
  if (req.headers['x-hris-advanced'] !== '1' && process.env.WOLF_HR_ALLOW_STRUCTURE_WRITE !== '1') {
    return res.status(410).json({ error: "Payroll components are retired for day-to-day use. Configure each employee under Salary structure, then Generate Payroll." });
  }
  const gate = hrCompanyGate(req.hrContext);
  if (gate) return companyDenied(res, gate);
  if (!payrollStaffOnly(req.hrContext)) return workspaceDenied(res);
  if (blockUntilCompanyIsolation(res)) return;
  const written = companyForWrite(req.hrContext, req.body);
  if (written.status !== 200) return companyDenied(res, written);
  const parsed = payrollStructureInput(written.fields);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  try {
    const previous = await db.getCompanyPayrollStructure(req.hrContext.companyId);
    const saved = await db.saveCompanyPayrollStructure(req.hrContext.companyId, parsed.structure);
    await db.createAuditLog({
      action: "UPDATE",
      entity_type: "PayrollStructure",
      entity_id: req.hrContext.companyId,
      old_value: tariffAudit(previous),
      new_value: tariffAudit(saved),
      reason: req.hrContext.userId,
      ip_address: req.ip,
      company_id: req.hrContext.companyId,
    }).catch(() => undefined);
    res.json(presentPayrollStructure(req.hrContext.companyId, saved));
  } catch (error) {
    console.error(`payroll structure save failed ${error.code || ""}`);
    res.status(500).json({ error: "The payroll structure could not be saved." });
  }
});


app.get('/api/employee-payroll-settings/:employeeId', async (req, res) => {
  const gate = hrCompanyGate(req.hrContext);
  if (gate) return companyDenied(res, gate);
  if (!payrollStaffOnly(req.hrContext)) return workspaceDenied(res);
  if (blockUntilCompanyIsolation(res)) return;
  if (!/^[0-9a-f-]{36}$/i.test(req.params.employeeId)) {
    return res.status(400).json({ error: "The payroll settings are not valid." });
  }
  try {
    await db.ensureEmployeePayrollConfigColumns().catch(() => undefined);
    const employee = await db.getEmployeeById(req.params.employeeId, req.hrContext.companyId);
    const access = recordAccess(req.hrContext, employee);
    if (access.status !== 200) return companyDenied(res, access);
    res.json(presentEmployeePayrollConfig(employee.id, employee));
  } catch (error) {
    console.error(`employee payroll settings failed ${error.code || ""}`);
    res.status(500).json({ error: "The payroll settings could not be opened." });
  }
});

app.put('/api/employee-payroll-settings/:employeeId', async (req, res) => {
  const gate = hrCompanyGate(req.hrContext);
  if (gate) return companyDenied(res, gate);
  if (!payrollStaffOnly(req.hrContext)) return workspaceDenied(res);
  if (blockUntilCompanyIsolation(res)) return;
  if (!/^[0-9a-f-]{36}$/i.test(req.params.employeeId)) {
    return res.status(400).json({ error: "The payroll settings are not valid." });
  }
  try {
    await db.ensureEmployeePayrollConfigColumns().catch(() => undefined);
    const employee = await db.getEmployeeById(req.params.employeeId, req.hrContext.companyId);
    const access = recordAccess(req.hrContext, employee);
    if (access.status !== 200) return companyDenied(res, access);
    // Prefer simple checklist config; fall back to legacy three-field patch.
    if (req.body?.pay_type || req.body?.gross_fixed_salary != null || req.body?.tax_mode) {
      const parsed = employeePayrollConfigPatch(req.body ?? {});
      if (!parsed.ok) return res.status(400).json({ error: parsed.error });
      const saved = await db.saveEmployeePayrollConfig(employee.id, req.hrContext.companyId, parsed.config);
      if (!saved) return res.status(404).json({ error: "The payroll settings could not be saved." });
      await db.createAuditLog({
        action: "UPDATE",
        entity_type: "EmployeePayrollConfig",
        entity_id: employee.id,
        old_value: presentEmployeePayrollConfig(employee.id, employee),
        new_value: presentEmployeePayrollConfig(employee.id, saved),
        reason: req.hrContext.userId,
        ip_address: req.ip,
        company_id: req.hrContext.companyId,
      }).catch(() => undefined);
      return res.json(presentEmployeePayrollConfig(employee.id, saved));
    }
    const parsed = payrollSettingsPatch(req.body ?? {});
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });
    if (!payrollSettingsChanged(employee, parsed.settings)) {
      return res.json(presentPayrollSettings(employee.id, employee));
    }
    const saved = await db.saveEmployeePayrollSettings(employee.id, req.hrContext.companyId, parsed.settings);
    if (!saved) return res.status(404).json({ error: "The payroll settings could not be saved." });
    await db.createAuditLog({
      action: "UPDATE",
      entity_type: "EmployeePayrollSettings",
      entity_id: employee.id,
      old_value: presentPayrollSettings(employee.id, employee),
      new_value: presentPayrollSettings(employee.id, saved),
      reason: req.hrContext.userId,
      ip_address: req.ip,
      company_id: req.hrContext.companyId,
    }).catch(() => undefined);
    res.json(presentPayrollSettings(employee.id, saved));
  } catch (error) {
    console.error(`employee payroll settings save failed ${error.code || ""}`);
    res.status(500).json({ error: "The payroll settings could not be saved." });
  }
});

app.get('/api/payroll-global-settings', async (req, res) => {
  const gate = hrCompanyGate(req.hrContext);
  if (gate) return companyDenied(res, gate);
  if (!payrollStaffOnly(req.hrContext)) return workspaceDenied(res);
  try {
    const settings = await db.getPayrollGlobalSettings(req.hrContext.companyId);
    const rates = await db.getBpjsRateSet(req.hrContext.companyId, new Date().toISOString().slice(0, 10));
    res.json({ settings, bpjs_rates: rates });
  } catch (error) {
    console.error(`payroll global settings failed ${error.code || ""}`);
    res.status(500).json({ error: "Payroll settings are not available." });
  }
});

app.put('/api/payroll-global-settings', async (req, res) => {
  const gate = hrCompanyGate(req.hrContext);
  if (gate) return companyDenied(res, gate);
  if (!payrollStaffOnly(req.hrContext)) return workspaceDenied(res);
  try {
    const body = req.body?.settings || req.body || {};
    const settings = await db.savePayrollGlobalSettings(req.hrContext.companyId, {
      cutoff_start_day: Number(body.cutoff_start_day) || 26,
      cutoff_end_day: Number(body.cutoff_end_day) || 25,
      pay_day: Number(body.pay_day) || 5,
      ot_weekday_first_bp: Number(body.ot_weekday_first_bp) || 15000,
      ot_weekday_next_bp: Number(body.ot_weekday_next_bp) || 20000,
      ot_holiday_first_bp: Number(body.ot_holiday_first_bp) || 20000,
      ot_holiday_eighth_bp: Number(body.ot_holiday_eighth_bp) || 30000,
      ot_holiday_after_bp: Number(body.ot_holiday_after_bp) || 40000,
      late_deduction_per_event: Number(body.late_deduction_per_event) || 0,
      service_charge_pay_day: Number(body.service_charge_pay_day) || 15,
    });
    if (req.body?.bpjs_rates) {
      const r = req.body.bpjs_rates;
      await db.upsertBpjsRateSet(req.hrContext.companyId, {
        effective_from: r.effective_from || new Date().toISOString().slice(0, 10),
        health_employee_bp: Number(r.health_employee_bp),
        health_employer_bp: Number(r.health_employer_bp),
        health_salary_cap: r.health_salary_cap != null ? Number(r.health_salary_cap) : null,
        jht_employee_bp: Number(r.jht_employee_bp),
        jht_employer_bp: Number(r.jht_employer_bp),
        jp_employee_bp: Number(r.jp_employee_bp),
        jp_employer_bp: Number(r.jp_employer_bp),
        jp_salary_cap: r.jp_salary_cap != null ? Number(r.jp_salary_cap) : null,
        jkk_bp: r.jkk_bp == null || r.jkk_bp === "" ? null : Number(r.jkk_bp),
        jkm_bp: Number(r.jkm_bp),
      });
    }
    const rates = await db.getBpjsRateSet(req.hrContext.companyId, new Date().toISOString().slice(0, 10));
    res.json({ settings, bpjs_rates: rates });
  } catch (error) {
    console.error(`payroll global settings save failed ${error.code || ""}`);
    res.status(500).json({ error: "Payroll settings could not be saved." });
  }
});

app.post('/api/payroll-runs/:periodCode/generate', async (req, res) => {
  const gate = hrCompanyGate(req.hrContext);
  if (gate) return companyDenied(res, gate);
  if (!payrollStaffOnly(req.hrContext)) return workspaceDenied(res);
  try {
    const result = await generatePayrollRun(db, {
      companyId: req.hrContext.companyId,
      periodCode: req.params.periodCode,
      userId: req.hrContext.userId,
      adjustments: req.body?.adjustments || {},
      terBrackets: req.body?.ter_brackets || [],
    });
    if (!result.ok) return res.status(400).json({ error: result.error });
    const current = await db.getCurrentPayrollRun(req.hrContext.companyId, req.params.periodCode);
    res.status(201).json({ ...result, lines: current?.lines || [] });
  } catch (error) {
    console.error(`payroll generate failed ${error.code || ""}`);
    res.status(500).json({ error: "Payroll could not be generated." });
  }
});

app.get('/api/payroll-runs/:periodCode', async (req, res) => {
  const gate = hrCompanyGate(req.hrContext);
  if (gate) return companyDenied(res, gate);
  if (!payrollStaffOnly(req.hrContext)) return workspaceDenied(res);
  try {
    const current = await db.getCurrentPayrollRun(req.hrContext.companyId, req.params.periodCode);
    if (!current) return res.status(404).json({ error: "No payroll run for this period." });
    res.json(current);
  } catch (error) {
    console.error(`payroll run failed ${error.code || ""}`);
    res.status(500).json({ error: "Payroll run is not available." });
  }
});

app.get('/api/payroll-runs/:periodCode/bank/:bank', async (req, res) => {
  const gate = hrCompanyGate(req.hrContext);
  if (gate) return companyDenied(res, gate);
  if (!payrollStaffOnly(req.hrContext)) return workspaceDenied(res);
  try {
    const current = await db.getCurrentPayrollRun(req.hrContext.companyId, req.params.periodCode);
    if (!current) return res.status(404).json({ error: "No payroll run for this period." });
    const employees = await db.listActiveEmployeesForPayroll(req.hrContext.companyId);
    const byId = new Map(employees.map((e) => [e.id, e]));
    const payments = current.lines.map((line) => {
      const emp = byId.get(line.employee_id);
      return {
        account_number: emp?.bank_account_number || "",
        account_name: emp?.bank_account_name || emp?.full_name || "",
        amount: Number(line.take_home_pay) || 0,
        employee_code: line.employee_code,
        remark: `PAYROLL ${req.params.periodCode}`,
      };
    });
    const file = buildBankTransferFile(req.params.bank, payments, { period: req.params.periodCode });
    if (!file.ok) return res.status(400).json({ error: file.error });
    res.json(file);
  } catch (error) {
    console.error(`payroll bank export failed ${error.code || ""}`);
    res.status(500).json({ error: "Bank export failed." });
  }
});

app.get('/api/service-charge-v2/settings', async (req, res) => {
  const gate = hrCompanyGate(req.hrContext);
  if (gate) return companyDenied(res, gate);
  if (!payrollStaffOnly(req.hrContext)) return workspaceDenied(res);
  try {
    const settings = await db.getServiceChargeSettings(req.hrContext.companyId);
    const pools = await db.listServiceChargePoolDefaults(req.hrContext.companyId);
    res.json({ settings, pools });
  } catch (error) {
    console.error(`service charge settings failed ${error.code || ""}`);
    res.status(500).json({ error: "Service charge settings are not available." });
  }
});

app.put('/api/service-charge-v2/settings', async (req, res) => {
  const gate = hrCompanyGate(req.hrContext);
  if (gate) return companyDenied(res, gate);
  if (!payrollStaffOnly(req.hrContext)) return workspaceDenied(res);
  try {
    const body = req.body?.settings || req.body || {};
    const settings = await db.saveServiceChargeSettings(
      req.hrContext.companyId,
      {
        employee_pool_pct: Number(body.employee_pool_pct) || 50,
        policy_basis: body.policy_basis || null,
        present_statuses: body.present_statuses || ["PRESENT"],
        eligible_contract_types: body.eligible_contract_types || ["PKWTT", "PKWT"],
        include_resigned_in_period: body.include_resigned_in_period !== false,
        tax_method: body.tax_method || "FLAT",
      },
      req.body?.pools,
    );
    const pools = await db.listServiceChargePoolDefaults(req.hrContext.companyId);
    res.json({ settings, pools });
  } catch (error) {
    console.error(`service charge settings save failed ${error.code || ""}`);
    res.status(500).json({ error: "Service charge settings could not be saved." });
  }
});

app.post('/api/service-charge-v2/:year/:month/generate', async (req, res) => {
  const gate = hrCompanyGate(req.hrContext);
  if (gate) return companyDenied(res, gate);
  if (!payrollStaffOnly(req.hrContext)) return workspaceDenied(res);
  try {
    const year = Number(req.params.year);
    const month = Number(req.params.month);
    const total = Math.trunc(Number(req.body?.total_service_charge) || 0);
    if (!Number.isInteger(year) || month < 1 || month > 12 || total < 0) {
      return res.status(400).json({ error: "Year, month, and total are required." });
    }
    const status = req.body?.publish === true ? "PUBLISHED" : "DRAFT";
    const settings = await db.getServiceChargeSettings(req.hrContext.companyId);
    const poolDefaults = await db.listServiceChargePoolDefaults(req.hrContext.companyId);
    const poolsInput = Array.isArray(req.body?.pools) && req.body.pools.length
      ? req.body.pools
      : poolDefaults.map((p) => ({ pool_key: p.pool_key, label: p.label, pct: p.pct }));
    const allocated = allocatePools(total, poolsInput);
    const periodStart = `${year}-${String(month).padStart(2, "0")}-01`;
    const periodEnd = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
    const employees = await db.listActiveEmployeesForPayroll(req.hrContext.companyId);
    const attendance = await db.getAttendanceBetween(req.hrContext.companyId, periodStart, periodEnd).catch(() => []);
    const presentStatuses = new Set(
      (settings.present_statuses || ["PRESENT"]).map((s) => String(typeof s === "string" ? s : s).toUpperCase()),
    );
    const daysByEmp = new Map();
    for (const row of attendance) {
      const st = String(row.status || "").toUpperCase();
      if (!presentStatuses.has(st) && st !== "PRESENT" && st !== "LATE") continue;
      daysByEmp.set(row.employee_id, (daysByEmp.get(row.employee_id) || 0) + 1);
    }
    const eligibleTypes = settings.eligible_contract_types || ["PKWTT", "PKWT"];
    const people = employees.map((emp) => {
      const contract = emp.contract_type || emp.employment_type || "PKWTT";
      const override = emp.service_charge_eligible;
      const eligible = override === false
        ? false
        : override === true
          ? true
          : defaultContractEligible(contract, eligibleTypes);
      return {
        employee_id: emp.id,
        employee_code: emp.employee_code,
        full_name: emp.full_name,
        days_present: daysByEmp.get(emp.id) || 0,
        eligible,
      };
    });
    const split = splitEqualPerPresentDay(allocated.employee_pool_nominal, people);
    const terBp = Number(req.body?.ter_rate_bp) || lookupTerRateBp(
      Math.max(...split.items.map((i) => i.gross), 0),
      "TK/0",
      req.body?.ter_brackets || [],
    );
    const taxed = applyFlatPph(split.items, terBp);
    const payDate = serviceChargePayDate(`${year}-${String(month).padStart(2, "0")}-01`, 15);
    const saved = await db.createServiceChargeMonthVersion(
      req.hrContext.companyId,
      year,
      month,
      total,
      status,
      req.hrContext.userId,
      allocated.pools,
      { ...settings, under_95_warning: allocated.under_95_warning },
      split.value_per_day,
      split.total_days_present,
      taxed,
      payDate,
    );
    const current = await db.getCurrentServiceChargeMonth(req.hrContext.companyId, year, month);
    res.status(201).json({
      ...saved,
      under_95_warning: allocated.under_95_warning,
      pools: allocated.pools,
      value_per_day: split.value_per_day,
      items: current?.items || [],
      month: current?.month,
    });
  } catch (error) {
    console.error(`service charge generate failed ${error.code || ""}`);
    res.status(500).json({ error: "Service charge could not be generated." });
  }
});

app.get('/api/service-charge-v2/:year/:month', async (req, res) => {
  const gate = hrCompanyGate(req.hrContext);
  if (gate) return companyDenied(res, gate);
  if (!payrollStaffOnly(req.hrContext)) return workspaceDenied(res);
  try {
    const current = await db.getCurrentServiceChargeMonth(
      req.hrContext.companyId,
      Number(req.params.year),
      Number(req.params.month),
    );
    if (!current) return res.status(404).json({ error: "No service charge run for this month." });
    res.json(current);
  } catch (error) {
    console.error(`service charge month failed ${error.code || ""}`);
    res.status(500).json({ error: "Service charge is not available." });
  }
});

app.get('/api/service-charge-v2/:year/:month/bank/:bank', async (req, res) => {
  const gate = hrCompanyGate(req.hrContext);
  if (gate) return companyDenied(res, gate);
  if (!payrollStaffOnly(req.hrContext)) return workspaceDenied(res);
  try {
    const current = await db.getCurrentServiceChargeMonth(
      req.hrContext.companyId,
      Number(req.params.year),
      Number(req.params.month),
    );
    if (!current) return res.status(404).json({ error: "No service charge run for this month." });
    const employees = await db.listActiveEmployeesForPayroll(req.hrContext.companyId);
    const byId = new Map(employees.map((e) => [e.id, e]));
    const payments = current.items.map((item) => {
      const emp = byId.get(item.employee_id);
      return {
        account_number: emp?.bank_account_number || "",
        account_name: emp?.bank_account_name || emp?.full_name || "",
        amount: Number(item.net) || 0,
        employee_code: item.employee_code,
        remark: `SC ${req.params.year}-${req.params.month}`,
      };
    });
    const file = buildBankTransferFile(req.params.bank, payments, {
      period: `${req.params.year}-${req.params.month}`,
      remark: "SERVICE-CHARGE",
    });
    if (!file.ok) return res.status(400).json({ error: file.error });
    res.json(file);
  } catch (error) {
    console.error(`service charge bank export failed ${error.code || ""}`);
    res.status(500).json({ error: "Bank export failed." });
  }
});

app.get('/api/employee-pay-components/:employeeId', async (req, res) => {
  const gate = hrCompanyGate(req.hrContext);
  if (gate) return companyDenied(res, gate);
  if (!payrollStaffOnly(req.hrContext)) return workspaceDenied(res);
  if (blockUntilCompanyIsolation(res)) return;
  if (!/^[0-9a-f-]{36}$/i.test(req.params.employeeId)) {
    return res.status(400).json({ error: "The component assignment is not valid." });
  }
  try {
    const employee = await db.getEmployeeById(req.params.employeeId, req.hrContext.companyId);
    const access = recordAccess(req.hrContext, employee);
    if (access.status !== 200) return companyDenied(res, access);
    const structure = await db.getCompanyPayrollStructure(req.hrContext.companyId) ?? defaultPayrollStructure();
    const rows = await db.listEmployeeComponentEligibility(req.hrContext.companyId, employee.id);
    const today = await db.hrisToday();
    res.json(presentEligibility(employee.id, structure, rows, today));
  } catch (error) {
    console.error(`employee component eligibility failed ${error.code || ""}`);
    res.status(500).json({ error: "The component assignment could not be opened." });
  }
});

app.put('/api/employee-pay-components/:employeeId', async (req, res) => {
  const gate = hrCompanyGate(req.hrContext);
  if (gate) return companyDenied(res, gate);
  if (!payrollStaffOnly(req.hrContext)) return workspaceDenied(res);
  if (blockUntilCompanyIsolation(res)) return;
  if (!/^[0-9a-f-]{36}$/i.test(req.params.employeeId)) {
    return res.status(400).json({ error: "The component assignment is not valid." });
  }
  try {
    const employee = await db.getEmployeeById(req.params.employeeId, req.hrContext.companyId);
    const access = recordAccess(req.hrContext, employee);
    if (access.status !== 200) return companyDenied(res, access);
    const structure = await db.getCompanyPayrollStructure(req.hrContext.companyId) ?? defaultPayrollStructure();
    const parsed = eligibilityInput(req.body ?? {}, structure);
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });
    const previous = await db.listEmployeeComponentEligibility(req.hrContext.companyId, employee.id);
    await db.saveEmployeeComponentEligibility(req.hrContext.companyId, employee.id, parsed.components);
    const rows = await db.listEmployeeComponentEligibility(req.hrContext.companyId, employee.id);
    const today = await db.hrisToday();
    await db.createAuditLog({
      action: "UPDATE",
      entity_type: "EmployeePayComponents",
      entity_id: employee.id,
      old_value: { components: currentCodes(previous, today) },
      new_value: { components: parsed.components.map((component) => ({ code: component.code, eligible: component.eligible, amount: component.amount })) },
      reason: req.hrContext.userId,
      ip_address: req.ip,
      company_id: req.hrContext.companyId,
    }).catch(() => undefined);
    res.json(presentEligibility(employee.id, structure, rows, today));
  } catch (error) {
    console.error(`employee component eligibility save failed ${error.code || ""}`);
    res.status(500).json({ error: "The component assignment could not be saved." });
  }
});

function tariffAudit(structure) {
  return {
    components: (structure?.components ?? [])
      .filter((component) => isSharedTariff(component.code))
      .map((component) => ({
        code: component.code,
        rate_bp: component.rateBp ?? null,
        wage_base: component.wageBase ?? [],
      })),
  };
}

function currentCodes(rows, day) {
  const chosen = new Map();
  for (const row of rows ?? []) {
    if (!row || row.effective_from > day) continue;
    const previous = chosen.get(row.component_code);
    if (!previous || previous.effective_from < row.effective_from) chosen.set(row.component_code, row);
  }
  return [...chosen.values()].map((row) => ({ code: row.component_code, eligible: row.eligible === true, amount: row.amount }));
}

app.get('/api/payroll-records/:periodId', async (req, res) => {
  const gate = hrCompanyGate(req.hrContext);
  if (gate) return companyDenied(res, gate);
  if (!payrollStaffOnly(req.hrContext)) return workspaceDenied(res);
  if (blockUntilCompanyIsolation(res)) return;
  try {
    const period = await db.getPayrollPeriodById(req.params.periodId, req.hrContext.companyId);
    const access = recordAccess(req.hrContext, period);
    if (access.status !== 200) return companyDenied(res, access);
    const copied = await db.copyProfileBasicSalaries(req.hrContext.companyId, access.record.id);
    if (copied.changed > 0) await payrollBasicAudit(req, access.record.id);
    let structure = null;
    try {
      const snap = await db.ensurePayrollPeriodSnapshot(req.hrContext.companyId, access.record);
      structure = snap?.snapshot ?? null;
    } catch (error) {
      if (error?.message === "HRIS database target is refused") throw error;
      console.error(`payroll structure snapshot failed ${error.code || ""}`);
    }
    const records = await db.getPayrollRecords(access.record.id, req.hrContext.companyId);
    const visible = listForCompany(req.hrContext, records).rows.map((row) => presentPayrollLine(row, structure)).filter(Boolean);
    if (access.record.status === "DRAFT" || access.record.status === "CALCULATED") {
      try {
        const eligibility = await db.currentComponentEligibility(req.hrContext.companyId);
        const companyStructure = await db.getCompanyPayrollStructure(req.hrContext.companyId);
        const rated = structureWithCompanyTariffs(structure, companyStructure) ?? structure;
        const formulaStructure = structure?.grossFormula ? structure : rated;
        for (const line of visible) {
          const overlay = applyPayOverlay(line.component_amounts, eligibility.get(line.employee_id), rated);
          line.component_amounts = overlay.amounts;
          line.tariff_missing = overlay.missing;
          if (formulaStructure?.grossFormula) {
            const formula = evaluatePayroll(formulaStructure, overlay.amounts);
            line.formula_incomplete = formula.gross == null || formula.net == null;
            if (!line.formula_incomplete) {
              line.gross_pay = formula.gross;
              line.formula_gross = formula.gross;
              line.net_pay = formula.net;
              line.formula_net = formula.net;
              if (formula.gross >= formula.net) line.total_deductions = formula.gross - formula.net;
            }
          }
        }
      } catch (error) {
        if (error?.message === "HRIS database target is refused") throw error;
        console.error(`employee component eligibility failed ${error.code || ""}`);
      }
    }
    res.json(visible);
  } catch (error) {
    console.error(`payroll records failed ${error.code || ""}`);
    res.status(500).json({ error: "The payroll period could not be opened." });
  }
});

function staffTaskAudit(req, action, task, previousStatus) {
  return db.createAuditLog({
    action,
    entity_type: 'StaffTask',
    entity_id: task.id,
    old_value: previousStatus ? { status: previousStatus } : null,
    new_value: { status: task.status },
    ip_address: req.ip,
    company_id: req.hrContext.companyId,
  }).catch(() => undefined);
}

async function employeeInCompany(companyId, body) {
  if (body && typeof body.employee_code === 'string' && body.employee_code.trim() !== '') {
    return db.getEmployeeByCode(companyId, body.employee_code.trim());
  }
  if (body && typeof body.employee_id === 'string' && body.employee_id.trim() !== '') {
    const employee = await db.getEmployeeById(body.employee_id.trim(), companyId);
    if (!employee) return null;
    return { id: employee.id, company_id: employee.company_id, employee_code: employee.employee_code };
  }
  return null;
}

app.get('/api/staff-tasks', async (req, res) => {
  const gate = hrCompanyGate(req.hrContext);
  if (gate) return companyDenied(res, gate);
  if (blockUntilEmployeeRead(res)) return;
  try {
    const rows = await db.listStaffTasks(req.hrContext.companyId);
    const visible = listForCompany(req.hrContext, rows).rows
      .map((row) => projectStaffTask(row, req.hrContext.companyId))
      .filter(Boolean);
    res.json(visible);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/staff-tasks', async (req, res) => {
  const gate = hrCompanyGate(req.hrContext);
  if (gate) return companyDenied(res, gate);
  if (blockUntilEmployeeRead(res)) return;
  const written = staffTaskWrite(req.hrContext.companyId, req.body);
  if (!written?.external_id) return res.status(400).json({ error: 'The staff task fields are not valid.' });
  try {
    const employee = await employeeInCompany(req.hrContext.companyId, req.body);
    const access = recordAccess(req.hrContext, employee);
    if (access.status !== 200) return companyDenied(res, access);
    const existing = await db.getStaffTaskByExternal(req.hrContext.companyId, written.external_id);
    const saved = await db.upsertStaffTask(req.hrContext.companyId, {
      ...written,
      employee_id: employee.id,
      employee_code: employee.employee_code,
    });
    const projected = projectStaffTask(saved, req.hrContext.companyId);
    if (!projected) return res.status(500).json({ error: 'The staff task was not stored.' });
    await staffTaskAudit(req, existing ? 'UPDATE' : 'CREATE', projected, existing?.status);
    res.status(existing ? 200 : 201).json(projected);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/staff-tasks', async (req, res) => {
  const gate = hrCompanyGate(req.hrContext);
  if (gate) return companyDenied(res, gate);
  if (blockUntilEmployeeRead(res)) return;
  const written = staffTaskWrite(req.hrContext.companyId, { ...req.body, status: 'ASSIGNED', external_id: undefined });
  if (!written) return res.status(400).json({ error: 'The staff task fields are not valid.' });
  try {
    const employee = await employeeInCompany(req.hrContext.companyId, req.body);
    const access = recordAccess(req.hrContext, employee);
    if (access.status !== 200) return companyDenied(res, access);
    const externalId = `hr:${req.hrContext.companyId}:${randomBytes(8).toString('hex')}`;
    const saved = await db.upsertStaffTask(req.hrContext.companyId, {
      ...written,
      external_id: externalId,
      employee_id: employee.id,
      employee_code: employee.employee_code,
      status: 'ASSIGNED',
      updated_at: new Date().toISOString(),
    });
    const projected = projectStaffTask(saved, req.hrContext.companyId);
    if (!projected) return res.status(500).json({ error: 'The staff task was not stored.' });
    await staffTaskAudit(req, 'CREATE', projected, null);
    res.status(201).json(projected);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/staff-tasks/:id', async (req, res) => {
  const gate = hrCompanyGate(req.hrContext);
  if (gate) return companyDenied(res, gate);
  if (blockUntilEmployeeRead(res)) return;
  try {
    const existing = await db.getStaffTaskById(req.params.id, req.hrContext.companyId);
    const access = recordAccess(req.hrContext, existing);
    if (access.status !== 200) return companyDenied(res, access);
    const written = staffTaskWrite(req.hrContext.companyId, {
      title: req.body?.title ?? existing.title,
      due_date: req.body?.due_date ?? existing.due_date,
      status: req.body?.status ?? existing.status,
      detail: req.body?.detail,
      assigner_name: existing.assigner_name,
    });
    if (!written) return res.status(400).json({ error: 'The staff task fields are not valid.' });
    let employeeId = null;
    let employeeCode = null;
    if (typeof req.body?.employee_code === 'string' && req.body.employee_code.trim() !== '') {
      const employee = await db.getEmployeeByCode(req.hrContext.companyId, req.body.employee_code.trim());
      const employeeAccess = recordAccess(req.hrContext, employee);
      if (employeeAccess.status !== 200) return companyDenied(res, employeeAccess);
      employeeId = employee.id;
      employeeCode = employee.employee_code;
    }
    const saved = await db.updateStaffTask(existing.id, req.hrContext.companyId, {
      title: written.title,
      detail: written.detail,
      due_date: written.due_date,
      status: written.status,
      employee_id: employeeId,
      employee_code: employeeCode,
    });
    const projected = projectStaffTask(saved, req.hrContext.companyId);
    if (!projected) return res.status(500).json({ error: 'The staff task was not stored.' });
    await staffTaskAudit(req, 'UPDATE', projected, existing.status);
    res.json(projected);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/staff-tasks', async (req, res) => {
  const gate = hrCompanyGate(req.hrContext);
  if (gate) return companyDenied(res, gate);
  if (blockUntilEmployeeRead(res)) return;
  const externalId = typeof req.query.external_id === 'string' ? req.query.external_id : '';
  if (!externalIdAllowed(req.hrContext.companyId, externalId)) {
    return res.status(400).json({ error: 'The staff task fields are not valid.' });
  }
  try {
    const existing = await db.getStaffTaskByExternal(req.hrContext.companyId, externalId);
    const removedId = await db.deleteStaffTaskByExternal(req.hrContext.companyId, externalId);
    if (removedId) {
      await db.createAuditLog({
        action: 'UPDATE',
        entity_type: 'StaffTask',
        entity_id: removedId,
        old_value: existing ? { status: existing.status } : null,
        new_value: { removed: true },
        ip_address: req.ip,
        company_id: req.hrContext.companyId,
      }).catch(() => undefined);
    }
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// AUDIT LOGS API
// ============================================

app.get('/api/audit-logs', async (req, res) => {
  const gate = hrCompanyGate(req.hrContext);
  if (gate) return companyDenied(res, gate);
  try {
    const logs = await db.getAuditLogs(req.query, req.hrContext.companyId);
    res.json(listForCompany(req.hrContext, logs).rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

registerImportRoutes(app, { db, companyDenied, blockUntilEmployeeRead });

// ============================================
// ERROR HANDLING
// ============================================

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// ============================================
// START SERVER
// ============================================

function assertLocalHrisDatabase() {
  try {
    assertHrisDatabaseTarget();
  } catch {
    console.error("HRIS database target is refused");
    process.exit(1);
  }
}

async function confirmEmployeeReadCatalog() {
  try {
    const result = await db.query(
      `SELECT table_name, column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND (
           (table_name = 'employees' AND column_name = 'company_id')
           OR (table_name = 'payroll_periods' AND column_name = 'company_id')
           OR (table_name = 'payroll_records' AND column_name = 'company_id')
           OR (table_name IN ('hris_payroll_grants') AND column_name IN ('company_id', 'wolf_user_id'))
         )`,
    );
    replaceCompanyIsolationCatalog(catalogForCompanyIsolation(result.rows));
  } catch {
    replaceCompanyIsolationCatalog(null);
    console.error("Employee company catalog was not confirmed");
  }
}

async function confirmProductionDatabaseName() {
  if (process.env.WOLF_HR_PRODUCTION_DB !== "1") return;
  const result = await db.query("SELECT current_database() AS name");
  if (result.rows[0]?.name !== "atrium_hris") {
    throw new Error("HRIS database target is refused");
  }
}

const startedDirectly = process.argv[1] && import.meta.url.endsWith(process.argv[1].replaceAll("\\", "/"));
if (startedDirectly) {
  assertLocalHrisDatabase();
  confirmProductionDatabaseName()
    .then(() => confirmEmployeeReadCatalog())
    .then(() => {
      app.listen(PORT, "127.0.0.1", () => {
        console.log(`ATRIUM HRIS API listening on 127.0.0.1:${PORT}`);
      });
    })
    .catch(() => {
      console.error("HRIS database target is refused");
      process.exit(1);
    });
}

export default app;
