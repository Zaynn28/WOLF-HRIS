import { useState } from 'react';
import { documents, employees } from '../data/mockData';
import { FileText, Upload, Search, CheckCircle, AlertCircle, Clock, XCircle } from 'lucide-react';

export default function DocumentsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Documents</h1>
          <p className="text-slate-500 text-sm mt-1">{documents.length} documents • {documents.filter(d => d.verificationStatus === 'PENDING').length} pending verification</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium">
          <Upload size={16} /> Upload Document
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents..."
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm">
          <option value="">All Status</option>
          <option value="VERIFIED">Verified</option>
          <option value="PENDING">Pending</option>
          <option value="REJECTED">Rejected</option>
          <option value="EXPIRED">Expired</option>
        </select>
      </div>

      {/* Documents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(doc => {
          const emp = getEmp(doc.employeeId);
          return (
            <div key={doc.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                    <FileText size={20} className="text-slate-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{doc.documentTypeName}</p>
                    <p className="text-xs text-slate-500">{emp?.fullName}</p>
                  </div>
                </div>
                <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded font-medium ${statusColor(doc.verificationStatus)}`}>
                  {statusIcon(doc.verificationStatus)}
                  {doc.verificationStatus}
                </span>
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
                  <button className="flex-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-100">Verify</button>
                  <button className="flex-1 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-xs font-medium hover:bg-red-100">Reject</button>
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
    </div>
  );
}
