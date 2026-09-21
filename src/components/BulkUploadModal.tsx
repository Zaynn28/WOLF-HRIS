import { useState } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Download, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { departments, positions } from '../data/mockData';
import { Employee } from '../types';

interface BulkUploadProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function BulkUploadModal({ isOpen, onClose }: BulkUploadProps) {
  const { setEmployees, addToast, addAuditLog } = useApp();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const generateEmployeeCode = () => {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const randomNum = String(Math.floor(Math.random() * 9000) + 1000);
    return `AMG${yy}${mm}${randomNum}`;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          setErrors(['File must have at least a header row and one data row']);
          return;
        }

        const headers = lines[0].split(',').map(h => h.trim());
        const data = lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.trim());
          const obj: any = {};
          headers.forEach((header, idx) => {
            obj[header] = values[idx] || '';
          });
          return obj;
        });

        // Validate data
        const validationErrors: string[] = [];
        data.forEach((row, idx) => {
          if (!row.fullName) validationErrors.push(`Row ${idx + 2}: Full Name is required`);
          if (!row.email) validationErrors.push(`Row ${idx + 2}: Email is required`);
          if (!row.nik) validationErrors.push(`Row ${idx + 2}: NIK is required`);
        });

        if (validationErrors.length > 0) {
          setErrors(validationErrors);
          setPreview([]);
        } else {
          setErrors([]);
          setPreview(data);
        }
      } catch (err) {
        setErrors(['Failed to parse CSV file. Please check the format.']);
      }
    };

    reader.readAsText(uploadedFile);
  };

  const handleImport = () => {
    setIsProcessing(true);
    
    setTimeout(() => {
      try {
        const newEmployees = preview.map(row => {
          const dept = departments.find(d => d.name.toLowerCase() === row.department?.toLowerCase());
          const pos = positions.find(p => p.title.toLowerCase() === row.position?.toLowerCase());
          
          return {
            id: 'emp-' + Date.now() + Math.random(),
            employeeCode: generateEmployeeCode(),
            fullName: row.fullName,
            preferredName: row.preferredName || '',
            nik: row.nik,
            npwp: row.npwp || '',
            dateOfBirth: row.dateOfBirth || '',
            gender: row.gender || 'M',
            phone: row.phone || '',
            email: row.email,
            address: row.address || '',
            emergencyContactName: row.emergencyContactName || '',
            emergencyContactPhone: row.emergencyContactPhone || '',
            departmentId: dept?.id || departments[0].id,
            positionId: pos?.id || positions[0].id,
            employmentStatus: 'ACTIVE',
            joinDate: row.joinDate || new Date().toISOString().split('T')[0],
            bankName: row.bankName || '',
            bankAccountNumber: row.bankAccountNumber || '',
            bankAccountName: row.bankAccountName || '',
          };
        });

        setEmployees(prev => [...prev, ...(newEmployees as Employee[])]);
        addAuditLog('BULK_IMPORT', 'Employee', '', `Imported ${newEmployees.length} employees`);
        addToast(`Successfully imported ${newEmployees.length} employees`, 'success');
        
        setFile(null);
        setPreview([]);
        setErrors([]);
        onClose();
      } catch (err) {
        addToast('Failed to import employees', 'error');
      } finally {
        setIsProcessing(false);
      }
    }, 1000);
  };

  const downloadTemplate = () => {
    const headers = 'fullName,preferredName,nik,npwp,dateOfBirth,gender,phone,email,address,emergencyContactName,emergencyContactPhone,department,position,joinDate,bankName,bankAccountNumber,bankAccountName';
    const sampleData = 'John Doe,John,1234567890123456,01.234.567.8-012.000,1990-01-15,M,+6281234567890,john@example.com,Jl. Sudirman No. 1,Jane Doe,+6281234567891,Food & Beverage,F&B Manager,2024-01-01,BCA,1234567890,John Doe';
    const csv = headers + '\n' + sampleData;
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'employee_import_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Bulk Employee Import</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Instructions */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">Import Instructions:</h3>
            <ul className="text-sm text-blue-800 dark:text-blue-400 space-y-1 list-disc list-inside">
              <li>Download the template CSV file first</li>
              <li>Fill in employee data following the template format</li>
              <li>Required fields: fullName, email, nik</li>
              <li>Department and Position should match existing values exactly</li>
              <li>Employee codes will be auto-generated in format: AMG + YY + MM + Number</li>
            </ul>
          </div>

          {/* Download Template */}
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
            <div className="flex items-center gap-3">
              <FileText size={24} className="text-slate-400" />
              <div>
                <p className="font-medium text-slate-700 dark:text-slate-300">Template File</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Download CSV template with sample data</p>
              </div>
            </div>
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
            >
              <Download size={16} />
              Download Template
            </button>
          </div>

          {/* Upload File */}
          <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-8 text-center">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer flex flex-col items-center gap-3"
            >
              <Upload size={48} className="text-slate-400" />
              <div>
                <p className="font-medium text-slate-700 dark:text-slate-300">
                  {file ? file.name : 'Click to upload CSV file'}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {file ? `${(file.size / 1024).toFixed(2)} KB` : 'CSV files only'}
                </p>
              </div>
            </label>
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle size={20} className="text-red-600 dark:text-red-400" />
                <h3 className="font-semibold text-red-900 dark:text-red-300">Validation Errors:</h3>
              </div>
              <ul className="text-sm text-red-800 dark:text-red-400 space-y-1 list-disc list-inside">
                {errors.map((error, idx) => (
                  <li key={idx}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Preview */}
          {preview.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle size={20} className="text-emerald-600 dark:text-emerald-400" />
                <h3 className="font-semibold text-slate-800 dark:text-slate-100">
                  Preview: {preview.length} employees ready to import
                </h3>
              </div>
              <div className="max-h-64 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-700 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-slate-600 dark:text-slate-300">Name</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600 dark:text-slate-300">Email</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600 dark:text-slate-300">NIK</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600 dark:text-slate-300">Department</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {preview.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{row.fullName}</td>
                        <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{row.email}</td>
                        <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{row.nik}</td>
                        <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{row.department || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={preview.length === 0 || isProcessing}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? 'Importing...' : `Import ${preview.length} Employees`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
