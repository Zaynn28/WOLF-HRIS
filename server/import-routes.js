import { hrCompanyGate } from "./company-scope.js";
import { importCatalog, prepareModuleRows } from "./module-import.js";
import { listImportRows, savePreparedRows } from "./module-import-store.js";

export function registerImportRoutes(app, { db, companyDenied, blockUntilEmployeeRead }) {
  app.get("/api/imports", async (req, res) => {
    const gate = hrCompanyGate(req.hrContext);
    if (gate) return companyDenied(res, gate);
    if (blockUntilEmployeeRead(res)) return;
    try {
      const rows = await listImportRows(db, req.hrContext.companyId);
      res.json({ catalog: importCatalog(), rows });
    } catch (error) {
      res.status(500).json({ error: "The import list is not available." });
    }
  });

  app.post("/api/imports/:module", async (req, res) => {
    const gate = hrCompanyGate(req.hrContext);
    if (gate) return companyDenied(res, gate);
    if (blockUntilEmployeeRead(res)) return;
    const prepared = prepareModuleRows(req.params.module, req.body?.rows);
    if (prepared.error) return res.status(400).json({ error: prepared.error });
    try {
      const saved = await savePreparedRows(db, req.hrContext.companyId, req.params.module, prepared.ready);
      const skips = [...prepared.skips, ...saved.skips].slice(0, 5);
      const skipped = prepared.skipped + saved.skipped;
      await db.createAuditLog({
        action: "BULK_IMPORT",
        entity_type: "Import",
        entity_id: null,
        new_value: { module: req.params.module, imported: saved.imported, updated: saved.updated, skipped },
        ip_address: req.ip,
        company_id: req.hrContext.companyId,
      }).catch(() => undefined);
      res.json({
        imported: saved.imported,
        updated: saved.updated,
        skipped,
        skips,
        refresh: saved.refresh,
        rows: saved.rows,
      });
    } catch {
      res.status(500).json({ error: "The import could not be stored." });
    }
  });
}
