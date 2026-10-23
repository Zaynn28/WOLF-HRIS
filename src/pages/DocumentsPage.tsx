import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { FileText, Upload, CheckCircle, AlertCircle, Clock, XCircle } from 'lucide-react';
import { EmployeeDocument } from '../types';

const MAX_FILE_BYTES = 8 * 1024 * 1024;

type QueuedFile = {
  key: string;
  fileName: string;
  fileSize: number;
  dataUrl: string;
  documentTypeName: string;
};

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

export default function DocumentsPage() {
  const { documents, setDocuments, documentTypes, setDocumentTypes, employees, addToast, addAuditLog } = useApp();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [newTypeName, setNewTypeName] = useState('');
  const [nameRevision, setNameRevision] = useState(0);
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [skippedNames, setSkippedNames] = useState<string[]>([]);
  const [saveSummary, setSaveSummary] = useState('');

  const selectedEmployee = employees.find(person => person.id === selectedEmployeeId);
  const activeTypes = documentTypes.filter(type => type.active);
  const employeeDocs = documents.filter(doc => doc.employeeId === selectedEmployeeId);

  const knownNames = new Set(documentTypes.map(type => type.name));
  const extraNames = employeeDocs
    .map(doc => doc.documentTypeName)
    .filter(name => !knownNames.has(name))
    .filter((name, index, list) => list.indexOf(name) === index);
  const lookupNames = [
    ...documentTypes.filter(type => type.active || employeeDocs.some(doc => doc.documentTypeName === type.name)).map(type => type.name),
    ...extraNames,
  ];
  const visibleNames = (typeFilter ? lookupNames.filter(name => name === typeFilter) : lookupNames).filter(name => {
    if (!statusFilter) return true;
    return employeeDocs.some(doc => doc.documentTypeName === name && doc.verificationStatus === statusFilter);
  });

  const getEmp = (id: string) => employees.find(person => person.id === id);

  const statusIcon = (status: string) => {
    switch (status) {
      case 'VERIFIED': return <CheckCircle size={14} className="text-emerald-500" />;
      case 'PENDING': return <Clock size={14} className="text-amber-500" />;
      case 'REJECTED': return <XCircle size={14} className="text-red-500" />;
      case 'EXPIRED': return <AlertCircle size={14} className="text-slate-500" />;
      default: return null;
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'VERIFIED': return 'bg-emerald-100 text-emerald-700';
      case 'PENDING': return 'bg-amber-100 text-amber-700';
      case 'REJECTED': return 'bg-red-100 text-red-700';
      case 'EXPIRED': return 'bg-slate-100 text-slate-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleVerify = (id: string) => {
    setDocuments(prev => prev.map(doc => doc.id === id ? { ...doc, verificationStatus: 'VERIFIED' as const } : doc));
    const doc = documents.find(row => row.id === id);
    const emp = getEmp(doc?.employeeId || '');
    addAuditLog('UPDATE', 'Document', id, `${doc?.documentTypeName} verified for ${emp?.fullName}`);
    addToast(`Document verified for ${emp?.fullName}`, 'success');
  };

  const handleRejectDoc = (id: string) => {
    setDocuments(prev => prev.map(doc => doc.id === id ? { ...doc, verificationStatus: 'REJECTED' as const } : doc));
    const doc = documents.find(row => row.id === id);
    const emp = getEmp(doc?.employeeId || '');
    addAuditLog('UPDATE', 'Document', id, `${doc?.documentTypeName} rejected for ${emp?.fullName}`);
    addToast(`Document rejected for ${emp?.fullName}`, 'warning');
  };

  const addDocumentType = () => {
    const name = newTypeName.trim();
    if (!name) {
      addToast('Enter a document type name.', 'error');
      return;
    }
    if (documentTypes.some(type => type.name.toLowerCase() === name.toLowerCase())) {
      addToast('That document type already exists.', 'error');
      return;
    }
    const created = { id: `dt${Date.now()}`, name, active: true };
    setDocumentTypes(prev => [...prev, created]);
    addAuditLog('CREATE', 'DocumentType', created.id, name);
    addToast(`Document type ${name} added.`, 'success');
    setNewTypeName('');
  };

  const renameDocumentType = (id: string, rawName: string) => {
    const name = rawName.trim();
    const current = documentTypes.find(type => type.id === id);
    if (!current) return false;
    if (!name) {
      addToast('Document type name cannot be empty.', 'error');
      return false;
    }
    if (name === current.name) return true;
    if (documentTypes.some(type => type.id !== id && type.name.toLowerCase() === name.toLowerCase())) {
      addToast('That document type already exists.', 'error');
      return false;
    }
    setDocumentTypes(prev => prev.map(type => type.id === id ? { ...type, name } : type));
    setDocuments(prev => prev.map(doc => doc.documentTypeName === current.name ? { ...doc, documentTypeName: name } : doc));
    setQueue(prev => prev.map(file => file.documentTypeName === current.name ? { ...file, documentTypeName: name } : file));
    if (typeFilter === current.name) setTypeFilter(name);
    addAuditLog('UPDATE', 'DocumentType', id, `${current.name} renamed to ${name}`);
    addToast(`Document type renamed to ${name}.`, 'success');
    return true;
  };

  const toggleDocumentType = (id: string) => {
    const current = documentTypes.find(type => type.id === id);
    if (!current) return;
    const active = !current.active;
    setDocumentTypes(prev => prev.map(type => type.id === id ? { ...type, active } : type));
    addAuditLog('UPDATE', 'DocumentType', id, `${current.name} ${active ? 'activated' : 'deactivated'}`);
    addToast(active ? `${current.name} is available for new uploads.` : `${current.name} deactivated.`, 'success');
  };

  const chooseEmployee = (employeeId: string) => {
    setSelectedEmployeeId(employeeId);
    setTypeFilter('');
    setQueue([]);
    setSkippedNames([]);
    setSaveSummary('');
  };

  const queueFiles = async (fileList: FileList | null) => {
    if (!fileList?.length) return;
    if (!selectedEmployeeId) {
      addToast('Choose an employee first.', 'error');
      return;
    }
    if (activeTypes.length === 0) {
      addToast('Activate a document type before uploading.', 'error');
      return;
    }
    const skipped: string[] = [];
    const accepted: File[] = [];
    Array.from(fileList).forEach(file => {
      if (file.size > MAX_FILE_BYTES) skipped.push(file.name);
      else accepted.push(file);
    });
    if (skipped.length) {
      setSkippedNames(prev => [...prev, ...skipped]);
      addToast(`${skipped.length} file${skipped.length === 1 ? '' : 's'} over 8 MB skipped: ${skipped.join(', ')}`, 'warning');
    }
    const fallback = activeTypes[0].name;
    const stamp = Date.now();
    const reads = await Promise.all(accepted.map(async (file, index) => ({
      key: `${stamp}-${index}-${file.name}`,
      fileName: file.name,
      fileSize: file.size,
      dataUrl: await readAsDataUrl(file),
      documentTypeName: fallback,
    })));
    setQueue(prev => [...prev, ...reads]);
    setSaveSummary('');
  };

  const saveBatch = () => {
    if (!selectedEmployee) {
      addToast('Choose an employee first.', 'error');
      return;
    }
    if (queue.length === 0) {
      addToast(skippedNames.length ? 'No files under 8 MB to save.' : 'Choose at least one file.', 'error');
      return;
    }
    const activeNames = new Set(activeTypes.map(type => type.name));
    if (queue.some(file => !activeNames.has(file.documentTypeName))) {
      addToast('Each file needs an active document type.', 'error');
      return;
    }
    const stamp = Date.now();
    const uploadedAt = new Date().toISOString();
    const created: EmployeeDocument[] = queue.map((file, index) => ({
      id: `doc${stamp}-${index}`,
      employeeId: selectedEmployee.id,
      documentTypeName: file.documentTypeName,
      fileName: file.fileName,
      fileSize: file.fileSize,
      dataUrl: file.dataUrl,
      verificationStatus: 'PENDING',
      uploadedAt,
    }));
    setDocuments(prev => [...prev, ...created]);
    addAuditLog('UPLOAD', 'Document', created[0].id, `${created.length} files uploaded for ${selectedEmployee.fullName}`);
    const skipNote = skippedNames.length
      ? ` ${skippedNames.length} file${skippedNames.length === 1 ? '' : 's'} over 8 MB ${skippedNames.length === 1 ? 'was' : 'were'} not saved: ${skippedNames.join(', ')}.`
      : '';
    const summary = `Saved ${created.length} file${created.length === 1 ? '' : 's'} for ${selectedEmployee.fullName}.${skipNote}`;
    setSaveSummary(summary);
    addToast(summary, 'success');
    setQueue([]);
    setSkippedNames([]);
  };

  const renderFile = (doc: EmployeeDocument) => (
    <div key={doc.id} className="border border-slate-200 rounded-lg p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center shrink-0"><FileText size={20} className="text-slate-500" /></div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-800 truncate">{doc.fileName}</p>
            <p className="text-xs text-slate-500">{formatSize(doc.fileSize)} · Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}</p>
          </div>
        </div>
        <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded font-medium shrink-0 ${statusColor(doc.verificationStatus)}`}>{statusIcon(doc.verificationStatus)}{doc.verificationStatus}</span>
      </div>
      <div className="flex flex-wrap gap-2 mt-3">
        <button onClick={() => doc.dataUrl && setPreviewUrl(doc.dataUrl)} className="text-xs text-indigo-700">Open file</button>
        {doc.dataUrl && <a href={doc.dataUrl} download={doc.fileName} className="text-xs text-indigo-700">Download</a>}
      </div>
      {doc.verificationStatus === 'PENDING' && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
          <button onClick={() => handleVerify(doc.id)} className="flex-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-100">Verify</button>
          <button onClick={() => handleRejectDoc(doc.id)} className="flex-1 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-xs font-medium hover:bg-red-100">Reject</button>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Documents</h1>
        <p className="text-slate-500 text-sm mt-1">{documents.length} documents · {documents.filter(doc => doc.verificationStatus === 'PENDING').length} pending verification</p>
      </div>

      <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div>
          <h2 className="font-semibold text-slate-800">Document types</h2>
          <p className="text-sm text-slate-500 mt-1">Inactive types stay on files already saved and are not offered for new uploads.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            id="document-type-name"
            value={newTypeName}
            onChange={event => setNewTypeName(event.target.value)}
            onKeyDown={event => { if (event.key === 'Enter') addDocumentType(); }}
            placeholder="New type name"
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm min-w-[200px]"
          />
          <button id="add-document-type" onClick={addDocumentType} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Add type</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {documentTypes.map(type => (
            <div key={type.id} className="flex flex-wrap items-center gap-2 border border-slate-200 rounded-lg p-3">
              <input
                key={`${type.id}-${type.name}-${nameRevision}`}
                aria-label={`Rename ${type.name}`}
                defaultValue={type.name}
                onBlur={event => {
                  const ok = renameDocumentType(type.id, event.currentTarget.value);
                  if (!ok) setNameRevision(revision => revision + 1);
                }}
                className="flex-1 min-w-[140px] px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
              <span className={`text-xs px-2 py-0.5 rounded font-medium ${type.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{type.active ? 'Active' : 'Inactive'}</span>
              <button onClick={() => toggleDocumentType(type.id)} className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-700 hover:bg-slate-50">
                {type.active ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div>
          <h2 className="font-semibold text-slate-800">Look up a staff member</h2>
          <p className="text-sm text-slate-500 mt-1">Choose the person first. Their files are grouped by document type, and empty types show as missing.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <select id="document-employee" value={selectedEmployeeId} onChange={event => chooseEmployee(event.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm min-w-[240px]">
            <option value="">Select a staff member</option>
            {employees.map(person => <option key={person.id} value={person.id}>{person.fullName} ({person.employeeCode})</option>)}
          </select>
          <select id="document-type-filter" value={typeFilter} onChange={event => setTypeFilter(event.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm" disabled={!selectedEmployeeId}>
            <option value="">All types</option>
            {lookupNames.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
          <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm" disabled={!selectedEmployeeId}>
            <option value="">All statuses</option>
            <option value="VERIFIED">Verified</option>
            <option value="PENDING">Pending</option>
            <option value="REJECTED">Rejected</option>
            <option value="EXPIRED">Expired</option>
          </select>
        </div>
        {employees.length === 0 && <p className="text-sm text-slate-500">No staff records in this session yet. Add someone under Employees, then file their documents here.</p>}
      </section>

      {selectedEmployee && (
        <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-slate-800">Upload files for {selectedEmployee.fullName}</h2>
              <p className="text-sm text-slate-500 mt-1">Choose several files, set a type on each one, then save them all onto this person. Each file must be under 8 MB.</p>
            </div>
            <Upload size={18} className="text-slate-400 mt-1" />
          </div>
          <input
            id="hr-document-files"
            type="file"
            multiple
            accept="application/pdf,image/*"
            onChange={event => {
              void queueFiles(event.target.files);
              event.target.value = '';
            }}
            className="text-sm"
          />
          {skippedNames.length > 0 && (
            <p className="text-sm text-amber-700">Over 8 MB, not included: {skippedNames.join(', ')}</p>
          )}
          {queue.length > 0 && (
            <div className="space-y-2">
              {queue.map((file, index) => (
                <div key={file.key} className="flex flex-wrap items-center gap-2 border border-slate-200 rounded-lg p-3">
                  <p className="text-sm text-slate-800 flex-1 min-w-[160px]">{file.fileName} <span className="text-slate-500">({formatSize(file.fileSize)})</span></p>
                  <select
                    id={`hr-file-type-${index}`}
                    aria-label={`Type for ${file.fileName}`}
                    value={file.documentTypeName}
                    onChange={event => setQueue(prev => prev.map(row => row.key === file.key ? { ...row, documentTypeName: event.target.value } : row))}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  >
                    {activeTypes.map(type => <option key={type.id} value={type.name}>{type.name}</option>)}
                  </select>
                  <button onClick={() => setQueue(prev => prev.filter(row => row.key !== file.key))} className="text-xs text-slate-500 hover:text-slate-800">Remove</button>
                </div>
              ))}
            </div>
          )}
          <button id="save-hr-documents" onClick={saveBatch} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
            Save {queue.length} file{queue.length === 1 ? '' : 's'}
          </button>
          {saveSummary && <p role="status" className="text-sm font-medium text-emerald-700">{saveSummary}</p>}
        </section>
      )}

      {selectedEmployee && (
        <section className="space-y-4">
          <h2 className="font-semibold text-slate-800">Files for {selectedEmployee.fullName}</h2>
          {visibleNames.length === 0 && <p className="text-sm text-slate-500">No document types match this filter.</p>}
          {visibleNames.map(name => {
            const type = documentTypes.find(row => row.name === name);
            const files = employeeDocs.filter(doc => doc.documentTypeName === name && (!statusFilter || doc.verificationStatus === statusFilter));
            const missing = files.length === 0;
            return (
              <div key={name} className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-medium text-slate-800">{name}</h3>
                  <div className="flex items-center gap-2">
                    {type && !type.active && <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600">Inactive</span>}
                    {missing ? <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-medium">Missing</span> : <span className="text-xs text-slate-500">{files.length} file{files.length === 1 ? '' : 's'}</span>}
                  </div>
                </div>
                {missing && <p className="text-sm text-slate-500">No file of this type for {selectedEmployee.fullName}.</p>}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {files.map(renderFile)}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {previewUrl && (
        <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4" onClick={() => setPreviewUrl(null)}>
          <div className="bg-white rounded-xl p-4 max-w-lg w-full" onClick={event => event.stopPropagation()}>
            {previewUrl.startsWith('data:image') ? <img src={previewUrl} alt="Stored document" className="max-h-96 mx-auto" /> : <iframe title="Stored document" src={previewUrl} className="w-full h-96" />}
            <a href={previewUrl} download className="mt-3 inline-block text-sm text-indigo-700">Download</a>
          </div>
        </div>
      )}
    </div>
  );
}
