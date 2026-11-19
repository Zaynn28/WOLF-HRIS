import { useState } from 'react';
import { Upload } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { canBulkImport } from '../lib/companyImport';
import ModuleBulkUpload from './ModuleBulkUpload';

export default function BulkUploadButton({ module }: { module: string }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  if (!canBulkImport(user?.role, module)) return null;
  return (
    <>
      <button
        type="button"
        data-bulk-module={module}
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium"
      >
        <Upload size={16} /> Bulk upload
      </button>
      {open && <ModuleBulkUpload moduleId={module} onClose={() => setOpen(false)} />}
    </>
  );
}
