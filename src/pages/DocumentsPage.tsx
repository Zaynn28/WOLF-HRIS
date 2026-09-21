import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { employees } from '../data/mockData';
import { FileText, Upload, Search, CheckCircle, AlertCircle, Clock, XCircle } from 'lucide-react';
import Modal from '../components/Modal';

export default function DocumentsPage() {
  const { documents, setDocuments, addToast, addAuditLog } = useApp();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [newDoc, setNewDoc] = useState({ employeeId: '', documentTypeName: 'KTP', fileName: '' });

  const filtered = documents.filter(d => {
    const emp = employees.find(e => e.id === d.employeeId);
    const matchSearch = emp?.fullName.toLowerCase().includes(search.toLowerCase()) || d.documentTypeName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || d.verificationStatus === statusFilter;
    return matchSearch && matchStatus;
  });

  const getEmp = (id: string) => employees.find(e => e.id === id);

  const statusIcon = (status: string) => {
    switch(status) {
      case 'VERIFIED': return <CheckCircle size={14} className="text-emerald-500" />;
      case 'PENDING': return <Clock size={14} className="text-amber-500" />;
      case 'REJECTED': return <XCircle size={14} className="text-red-500" />;
      case 'EXPIRED': return <AlertCircle size={14} className="text-slate-500" />;
      default: return null;
    }
  };

  const statusColor = (status: string) => {
    switch(status) {
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
    setDocuments(prev => prev.map(d => d.id === id ? { ...d, verificationStatus: 'VERIFIED' as const } : d));
    const doc = documents.find(d => d.id === id);
    const emp = getEmp(doc?.employeeId || '');
    addAuditLog('UPDATE', 'Document', id, `${doc?.documentTypeName} verified for ${emp?.fullName}`);
    addToast(`Document verified for ${emp?.fullName}`, 'success');
  };

  const handleRejectDoc = (id: string) => {
    setDocuments(prev => prev.map(d => d.id === id ? { ...d, verificationStatus: 'REJECTED' as const } : d));
    const doc = documents.find(d => d.id === id);
    const emp = getEmp(doc?.employeeId || '');
    addAuditLog('UPDATE', 'Document', id, `${doc?.documentTypeName} rejected for ${emp?.fullName}`);
    addToast(`Document rejected for ${emp?.fullName}`, 'warning');
  };

  const handleUpload = () => {
    if (!newDoc.employeeId || !newDoc.fileName) {
      addToast('Please select an employee and provide a file name', 'error');
      return;
    }
    const doc = {
      id: 'doc' + Date.now(),
      employeeId: newDoc.employeeId,
      documentTypeName: newDoc.documentTypeName,
      fileName: newDoc.fileName,
      fileSize: Math.floor(Math.random() * 500000) + 100000,
      verificationStatus: 'PENDING' as const,
      uploadedAt: new Date().toISOString(),
    };
    setDocuments(prev => [...prev, doc]);
    const emp = getEmp(newDoc.employeeId);
    addAuditLog('UPLOAD', 'Document', doc.id, `${doc.documentTypeName} uploaded for ${emp?.fullName}`);
    addToast(`Document uploaded for ${emp?.fullName}`, 'success');
    setShowUploadModal(false);
    setNewDoc({ employeeId: '', documentTypeName: 'KTP', fileName: '' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Documents</h1>
          <p className="text-slate-500 text-sm mt-1">{documents.length} documents • {documents.filter(d => d.verificationStatus === 'PENDING').length} pending verification</p>
        </div>
        <button onClick={() => setShowUploadModal(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium">
          <Upload size={16} /> Upload Document
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search documents..." className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm">
          <option value="">All Status</option>
          <option value="VERIFIED">Verified</option>
          <option value="PENDING">Pending</option>
          <option value="REJECTED">Rejected</option>
          <option value="EXPIRED">Expired</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(doc => {
          const emp = getEmp(doc.employeeId);
          return (
            <div key={doc.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center"><FileText size={20} className="text-slate-500" /></div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{doc.documentTypeName}</p>
                    <p className="text-xs text-slate-500">{emp?.fullName}</p>
                  </div>
                </div>
                <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded font-medium ${statusColor(doc.verificationStatus)}`}>{statusIcon(doc.verificationStatus)}{doc.verificationStatus}</span>
              </div>
              <div className="space-y-1 text-xs text-slate-500">
                <p>File: {doc.fileName}</p>
                <p>Size: {formatSize(doc.fileSize)}</p>
                {doc.issueDate && <p>Issued: {doc.issueDate}</p>}
                {doc.expiryDate && <p>Expires: {doc.expiryDate}</p>}
                <p>Uploaded: {new Date(doc.uploadedAt).toLocaleDateString()}</p>
              </div>
              {doc.verificationStatus === 'PENDING' && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
                  <button onClick={() => handleVerify(doc.id)} className="flex-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-100">Verify</button>
                  <button onClick={() => handleRejectDoc(doc.id)} className="flex-1 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-xs font-medium hover:bg-red-100">Reject</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <FileText size={40} className="mx-auto mb-3 text-slate-300" />
          <p>No documents found.</p>
        </div>
      )}

      {/* Upload Modal */}
      <Modal isOpen={showUploadModal} onClose={() => setShowUploadModal(false)} title="Upload Document">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Employee *</label>
            <select value={newDoc.employeeId} onChange={e => setNewDoc({...newDoc, employeeId: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option value="">Select Employee</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.fullName} ({e.employeeCode})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Document Type *</label>
            <select value={newDoc.documentTypeName} onChange={e => setNewDoc({...newDoc, documentTypeName: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option value="KTP">KTP (National ID)</option>
              <option value="NPWP">NPWP (Tax ID)</option>
              <option value="BPJS Kesehatan">BPJS Kesehatan</option>
              <option value="BPJS Ketenagakerjaan">BPJS Ketenagakerjaan</option>
              <option value="Employment Contract">Employment Contract</option>
              <option value="Certificate">Certificate</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">File Name *</label>
            <input type="text" value={newDoc.fileName} onChange={e => setNewDoc({...newDoc, fileName: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="e.g. ktp_john_doe.pdf" />
          </div>
          <div className="p-4 bg-slate-50 rounded-lg border-2 border-dashed border-slate-300 text-center">
            <Upload size={24} className="mx-auto text-slate-400 mb-2" />
            <p className="text-sm text-slate-500">Drag & drop file here or click to browse</p>
            <p className="text-xs text-slate-400 mt-1">PDF, JPG, PNG up to 10MB</p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowUploadModal(false)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={handleUpload} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Upload</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
