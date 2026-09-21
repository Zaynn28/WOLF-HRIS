import { useState } from 'react';
import { employees, departments } from '../data/mockData';
import { Upload, Download, FileText, CheckCircle, AlertCircle, Users } from 'lucide-react';

export default function DataImportExportPage() {
  const [activeTab, setActiveTab] = useState<'import' | 'export'>('export');
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [importMessage, setImportMessage] = useState('');

  const handleExport = (type: string) => {
    // Generate CSV data based on type
    let csvContent = '';
    let filename = '';

    switch (type) {
      case 'employees':
        csvContent = 'Employee Code,Full Name,Email,Department,Position,Status,Join Date\n';
        employees.forEach(emp => {
          const dept = departments.find(d => d.id === emp.departmentId);
          csvContent += `${emp.employeeCode},${emp.fullName},${emp.email},${dept?.name || ''},${emp.positionId},${emp.employmentStatus},${emp.joinDate}\n`;
        });
        filename = 'employees_export.csv';
        break;
      case 'attendance':
        csvContent = 'Employee Code,Date,Status,Clock In,Clock Out\n';
        filename = 'attendance_export.csv';
        break;
      case 'leave':
        csvContent = 'Employee Code,Leave Type,Start Date,End Date,Days,Status\n';
        filename = 'leave_export.csv';
        break;
      case 'payroll':
        csvContent = 'Employee Code,Period,Gross Pay,Deductions,Net Pay\n';
        filename = 'payroll_export.csv';
        break;
    }

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const lines = content.split('\n');
        const headers = lines[0].split(',');
        
        // Validate CSV structure
        if (headers.length < 2) {
          throw new Error('Invalid CSV format');
        }

        // Simulate import process
        const dataRows = lines.slice(1).filter(line => line.trim());
        setImportStatus('success');
        setImportMessage(`Successfully imported ${dataRows.length} records from ${file.name}`);
      } catch (error) {
        setImportStatus('error');
        setImportMessage('Failed to import file. Please check the format and try again.');
      }
    };
    reader.readAsText(file);
  };

  const exportOptions = [
    { type: 'employees', label: 'Employees', description: 'Export all employee data with personal and employment information', count: employees.length },
    { type: 'attendance', label: 'Attendance', description: 'Export attendance records for all employees', count: 'Daily records' },
    { type: 'leave', label: 'Leave Requests', description: 'Export all leave requests with approval status', count: 'All requests' },
    { type: 'payroll', label: 'Payroll', description: 'Export payroll calculations and salary details', count: 'Current period' },
  ];

  const importTemplates = [
    { type: 'employees', label: 'Employee Import Template', description: 'Upload CSV file with employee data' },
    { type: 'attendance', label: 'Attendance Import Template', description: 'Upload CSV file with attendance records' },
    { type: 'leave', label: 'Leave Import Template', description: 'Upload CSV file with leave requests' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Data Import & Export</h1>
        <p className="text-slate-500 text-sm mt-1">Import data from CSV files or export data for backup and reporting</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('export')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'export'
              ? 'bg-indigo-600 text-white'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Download size={16} className="inline mr-2" />
          Export Data
        </button>
        <button
          onClick={() => setActiveTab('import')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'import'
              ? 'bg-indigo-600 text-white'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Upload size={16} className="inline mr-2" />
          Import Data
        </button>
      </div>

      {/* Export Tab */}
      {activeTab === 'export' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm text-blue-800">
              <strong>Tip:</strong> Export data regularly for backup purposes. CSV files can be opened in Excel, Google Sheets, or any spreadsheet application.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {exportOptions.map(option => (
              <div key={option.type} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                      <FileText size={20} className="text-indigo-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">{option.label}</p>
                      <p className="text-xs text-slate-500">{typeof option.count === 'number' ? `${option.count} records` : option.count}</p>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-slate-600 mb-4">{option.description}</p>
                <button
                  onClick={() => handleExport(option.type)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                >
                  <Download size={16} />
                  Export CSV
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Import Tab */}
      {activeTab === 'import' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertCircle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">Important: Before Importing</p>
                <ul className="text-sm text-amber-700 mt-2 space-y-1 list-disc list-inside">
                  <li>Ensure your CSV file matches the required format</li>
                  <li>Download a template first to see the correct structure</li>
                  <li>Import will create new records, not update existing ones</li>
                  <li>Duplicate employee codes will be skipped</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Status Message */}
          {importStatus !== 'idle' && (
            <div className={`rounded-xl border p-4 flex items-start gap-3 ${
              importStatus === 'success' 
                ? 'bg-emerald-50 border-emerald-200' 
                : 'bg-red-50 border-red-200'
            }`}>
              {importStatus === 'success' ? (
                <CheckCircle size={20} className="text-emerald-600 flex-shrink-0" />
              ) : (
                <AlertCircle size={20} className="text-red-600 flex-shrink-0" />
              )}
              <p className={`text-sm ${importStatus === 'success' ? 'text-emerald-800' : 'text-red-800'}`}>
                {importMessage}
              </p>
            </div>
          )}

          {/* Import Templates */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {importTemplates.map(template => (
              <div key={template.type} className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                    <FileText size={20} className="text-slate-600" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-800">{template.label}</p>
                    <p className="text-xs text-slate-500">{template.description}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <button
                    onClick={() => handleExport(template.type)}
                    className="w-full px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
                  >
                    Download Template
                  </button>
                  <label className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors cursor-pointer">
                    <Upload size={16} />
                    Upload CSV
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleImport}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>

          {/* Import Instructions */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-800 mb-4">CSV Format Requirements</h3>
            <div className="space-y-3 text-sm text-slate-600">
              <div>
                <p className="font-medium text-slate-700 mb-1">Employee Import:</p>
                <code className="block bg-slate-50 p-3 rounded-lg text-xs">
                  Employee Code,Full Name,Email,Department,Position,Status,Join Date
                </code>
              </div>
              <div>
                <p className="font-medium text-slate-700 mb-1">Attendance Import:</p>
                <code className="block bg-slate-50 p-3 rounded-lg text-xs">
                  Employee Code,Date,Status,Clock In,Clock Out
                </code>
              </div>
              <div>
                <p className="font-medium text-slate-700 mb-1">Leave Import:</p>
                <code className="block bg-slate-50 p-3 rounded-lg text-xs">
                  Employee Code,Leave Type,Start Date,End Date,Days,Status
                </code>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
