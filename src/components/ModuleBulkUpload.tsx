import { useEffect, useState } from 'react';
import { Download, Upload, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { importsApi } from '../services/api';
import { useApp } from '../context/AppContext';

type CatalogEntry = {
  id: string;
  label: string;
  keyLabel: string;
  headers: string[];
  required: string[];
};

type ImportResult = {
  imported: number;
  updated: number;
  skipped: number;
  skips: { row: number; reason: string }[];
  refresh?: string | null;
  rows?: { natural_key: string; payload: Record<string, unknown> }[];
};

export default function ModuleBulkUpload({ moduleId, onClose }: { moduleId: string; onClose: () => void }) {
  const { applyCompanyImport, addToast } = useApp();
  const [entry, setEntry] = useState<CatalogEntry | null>(null);
  const [rowCount, setRowCount] = useState(0);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    importsApi.list().then(body => {
      if (cancelled) return;
      const match = (body.catalog || []).find(item => item.id === moduleId) || null;
      setEntry(match);
      if (!match) setError('This module has no bulk upload.');
    }).catch(() => {
      if (!cancelled) setError('The import service is not available.');
    });
    return () => {
      cancelled = true;
    };
  }, [moduleId]);

  const downloadTemplate = () => {
    if (!entry) return;
    const sheet = XLSX.utils.aoa_to_sheet([entry.headers]);
    sheet['!cols'] = entry.headers.map(() => ({ wch: 22 }));
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Import');
    XLSX.writeFile(book, `${moduleId}_import_template.xlsx`);
  };

  const onFile = (file: File | undefined) => {
    setResult(null);
    setError('');
    setRows([]);
    setRowCount(0);
    if (!file) return;
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension !== 'xlsx' && extension !== 'xls' && extension !== 'csv') {
      setError('Use an .xlsx or .csv file.');
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = new Uint8Array(reader.result as ArrayBuffer);
        const book = XLSX.read(data, { type: 'array' });
        const sheet = book.Sheets[book.SheetNames[0]];
        const parsed = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: false });
        if (parsed.length === 0) {
          setError('The file has headers but no data rows.');
          return;
        }
        setRows(parsed);
        setRowCount(parsed.length);
      } catch {
        setError('The file could not be read.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const runImport = async () => {
    if (rows.length === 0) return;
    setBusy(true);
    setError('');
    try {
      const saved = await importsApi.run(moduleId, rows);
      setResult(saved);
      await applyCompanyImport(moduleId, saved);
      addToast(`Imported ${saved.imported}, updated ${saved.updated}, skipped ${saved.skipped}.`, saved.skipped > 0 ? 'warning' : 'success');
    } catch {
      setError('The import was not saved.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800">Bulk upload{entry ? ` · ${entry.label}` : ''}</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close">
            <X size={22} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-600">This file is saved only for the company that is open. Uploading the same file again updates matching rows.</p>
          {entry && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm">
              <p className="font-medium text-slate-800">Expected columns</p>
              <p className="mt-1 text-slate-600 break-words">{entry.headers.join(', ')}</p>
              <p className="mt-2 text-slate-600">Required: {entry.required.join(', ')}</p>
              <p className="mt-1 text-slate-600">Upsert key: {entry.keyLabel}</p>
              <button type="button" onClick={downloadTemplate} className="mt-3 inline-flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">
                <Download size={16} /> Download template
              </button>
            </div>
          )}
          <label className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center cursor-pointer block">
            <input className="hidden" type="file" accept=".xlsx,.xls,.csv" onChange={event => onFile(event.target.files?.[0])} />
            <Upload size={28} className="mx-auto text-slate-400" />
            <p className="mt-2 text-sm font-medium text-slate-700">{fileName || 'Choose an .xlsx or .csv file'}</p>
          </label>
          {rowCount > 0 && <p className="text-sm font-medium text-slate-800" data-import-count={rowCount}>{rowCount} rows ready to import</p>}
          {error && <p className="text-sm text-red-700">{error}</p>}
          {result && (
            <div className="text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-3" data-import-result="true">
              <p>Imported {result.imported}. Updated {result.updated}. Skipped {result.skipped}.</p>
              {result.skips?.length > 0 && (
                <ul className="mt-2 list-disc list-inside text-slate-600">
                  {result.skips.map(skip => <li key={`${skip.row}-${skip.reason}`}>Row {skip.row}: {skip.reason}</li>)}
                </ul>
              )}
            </div>
          )}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700">Close</button>
            <button type="button" onClick={runImport} disabled={rowCount === 0 || busy} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
              {busy ? 'Importing...' : 'Import'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
