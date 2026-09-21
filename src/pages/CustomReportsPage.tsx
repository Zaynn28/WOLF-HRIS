import { useState } from 'react';
import { employees, departments, positions, leaveRequests, attendance, payrollRecords } from '../data/mockData';
import { BarChart3, Download, Filter, Plus, Trash2, Save, Eye } from 'lucide-react';

interface ReportField {
  id: string;
  label: string;
  field: string;
  type: 'text' | 'number' | 'date' | 'status';
}

interface CustomReport {
  id: string;
  name: string;
  dataSource: 'employees' | 'attendance' | 'leave' | 'payroll';
  fields: ReportField[];
  filters: { field: string; operator: string; value: string }[];
  createdAt: string;
}

export default function CustomReportsPage() {
  const [savedReports, setSavedReports] = useState<CustomReport[]>([
    {
      id: 'r1',
      name: 'Active Employees Report',
      dataSource: 'employees',
      fields: [
        { id: 'f1', label: 'Employee Code', field: 'employeeCode', type: 'text' },
        { id: 'f2', label: 'Full Name', field: 'fullName', type: 'text' },
        { id: 'f3', label: 'Department', field: 'departmentId', type: 'text' },
        { id: 'f4', label: 'Status', field: 'employmentStatus', type: 'status' },
      ],
      filters: [{ field: 'employmentStatus', operator: 'equals', value: 'ACTIVE' }],
      createdAt: '2024-01-10',
    },
  ]);

  const [showBuilder, setShowBuilder] = useState(false);
  const [previewReport, setPreviewReport] = useState<CustomReport | null>(null);
  const [newReport, setNewReport] = useState<Partial<CustomReport>>({
    name: '',
    dataSource: 'employees',
    fields: [],
    filters: [],
  });

  const availableFields: Record<string, ReportField[]> = {
    employees: [
      { id: 'employeeCode', label: 'Employee Code', field: 'employeeCode', type: 'text' },
      { id: 'fullName', label: 'Full Name', field: 'fullName', type: 'text' },
      { id: 'email', label: 'Email', field: 'email', type: 'text' },
      { id: 'departmentId', label: 'Department', field: 'departmentId', type: 'text' },
      { id: 'positionId', label: 'Position', field: 'positionId', type: 'text' },
      { id: 'employmentStatus', label: 'Status', field: 'employmentStatus', type: 'status' },
      { id: 'joinDate', label: 'Join Date', field: 'joinDate', type: 'date' },
    ],
    attendance: [
      { id: 'employeeId', label: 'Employee', field: 'employeeId', type: 'text' },
      { id: 'attendanceDate', label: 'Date', field: 'attendanceDate', type: 'date' },
      { id: 'status', label: 'Status', field: 'status', type: 'status' },
      { id: 'clockIn', label: 'Clock In', field: 'clockIn', type: 'text' },
      { id: 'clockOut', label: 'Clock Out', field: 'clockOut', type: 'text' },
      { id: 'lateMinutes', label: 'Late (min)', field: 'lateMinutes', type: 'number' },
    ],
    leave: [
      { id: 'employeeId', label: 'Employee', field: 'employeeId', type: 'text' },
      { id: 'startDate', label: 'Start Date', field: 'startDate', type: 'date' },
      { id: 'endDate', label: 'End Date', field: 'endDate', type: 'date' },
      { id: 'totalDays', label: 'Days', field: 'totalDays', type: 'number' },
      { id: 'status', label: 'Status', field: 'status', type: 'status' },
    ],
    payroll: [
      { id: 'employeeId', label: 'Employee', field: 'employeeId', type: 'text' },
      { id: 'grossPay', label: 'Gross Pay', field: 'grossPay', type: 'number' },
      { id: 'totalDeductions', label: 'Deductions', field: 'totalDeductions', type: 'number' },
      { id: 'netPay', label: 'Net Pay', field: 'netPay', type: 'number' },
    ],
  };

  const getDataForSource = (source: string) => {
    switch (source) {
      case 'employees': return employees;
      case 'attendance': return attendance;
      case 'leave': return leaveRequests;
      case 'payroll': return payrollRecords;
      default: return [];
    }
  };

  const applyFilters = (data: any[], filters: any[]) => {
    return data.filter(item => {
      return filters.every(filter => {
        const value = item[filter.field];
        switch (filter.operator) {
          case 'equals': return value === filter.value;
          case 'not_equals': return value !== filter.value;
          case 'contains': return String(value).toLowerCase().includes(filter.value.toLowerCase());
          case 'greater_than': return Number(value) > Number(filter.value);
          case 'less_than': return Number(value) < Number(filter.value);
          default: return true;
        }
      });
    });
  };

  const getPreviewData = (report: CustomReport) => {
    const rawData = getDataForSource(report.dataSource);
    const filteredData = applyFilters(rawData, report.filters);
    
    return filteredData.map(item => {
      const row: any = {};
      report.fields.forEach(field => {
        let value = item[field.field];
        if (field.field === 'departmentId') {
          const dept = departments.find(d => d.id === value);
          value = dept?.name || value;
        } else if (field.field === 'positionId') {
          const pos = positions.find(p => p.id === value);
          value = pos?.title || value;
        } else if (field.field === 'employeeId') {
          const emp = employees.find(e => e.id === value);
          value = emp?.fullName || value;
        }
        row[field.label] = value;
      });
      return row;
    });
  };

  const handleSaveReport = () => {
    if (!newReport.name || !newReport.fields?.length) {
      alert('Please provide a report name and select at least one field');
      return;
    }

    const report: CustomReport = {
      id: 'r' + Date.now(),
      name: newReport.name!,
      dataSource: newReport.dataSource as any,
      fields: newReport.fields!,
      filters: newReport.filters || [],
      createdAt: new Date().toISOString().split('T')[0],
    };

    setSavedReports([...savedReports, report]);
    setShowBuilder(false);
    setNewReport({ name: '', dataSource: 'employees', fields: [], filters: [] });
  };

  const handleDeleteReport = (id: string) => {
    setSavedReports(savedReports.filter(r => r.id !== id));
  };

  const handleExportCSV = (report: CustomReport) => {
    const data = getPreviewData(report);
    if (data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(h => `"${row[h]}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.name.replace(/\s+/g, '_')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Custom Reports</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Create and manage custom reports</p>
        </div>
        <button
          onClick={() => setShowBuilder(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
        >
          <Plus size={16} /> Create Report
        </button>
      </div>

      {/* Saved Reports */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {savedReports.map(report => (
          <div key={report.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center">
                  <BarChart3 size={20} className="text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <p className="font-medium text-slate-800 dark:text-slate-100">{report.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{report.dataSource} • {report.fields.length} fields</p>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Created: {report.createdAt}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setPreviewReport(report)}
                className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 rounded-lg text-sm font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
              >
                <Eye size={14} /> Preview
              </button>
              <button
                onClick={() => handleExportCSV(report)}
                className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-lg text-sm font-medium hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
              >
                <Download size={14} /> Export
              </button>
              <button
                onClick={() => handleDeleteReport(report.id)}
                className="px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm font-medium hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {savedReports.length === 0 && (
        <div className="text-center py-12 text-slate-500 dark:text-slate-400">
          <BarChart3 size={48} className="mx-auto mb-3 opacity-50" />
          <p>No custom reports yet. Create your first report!</p>
        </div>
      )}

      {/* Report Builder Modal */}
      {showBuilder && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">Create Custom Report</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Report Name</label>
                <input
                  type="text"
                  value={newReport.name}
                  onChange={(e) => setNewReport({ ...newReport, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                  placeholder="e.g. Active Employees Report"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Data Source</label>
                <select
                  value={newReport.dataSource}
                  onChange={(e) => setNewReport({ ...newReport, dataSource: e.target.value as any, fields: [] })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                >
                  <option value="employees">Employees</option>
                  <option value="attendance">Attendance</option>
                  <option value="leave">Leave Requests</option>
                  <option value="payroll">Payroll</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Select Fields</label>
                <div className="grid grid-cols-2 gap-2">
                  {availableFields[newReport.dataSource!].map(field => (
                    <label key={field.id} className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-700 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-600">
                      <input
                        type="checkbox"
                        checked={newReport.fields?.some(f => f.id === field.id) || false}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewReport({ ...newReport, fields: [...(newReport.fields || []), field] });
                          } else {
                            setNewReport({ ...newReport, fields: newReport.fields?.filter(f => f.id !== field.id) });
                          }
                        }}
                        className="rounded border-slate-300"
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-300">{field.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowBuilder(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveReport}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
                >
                  <Save size={16} /> Save Report
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewReport && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{previewReport.name}</h3>
                <button
                  onClick={() => setPreviewReport(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-6">
              {(() => {
                const data = getPreviewData(previewReport);
                if (data.length === 0) {
                  return <p className="text-center text-slate-500 dark:text-slate-400 py-12">No data found</p>;
                }
                const headers = Object.keys(data[0]);
                return (
                  <table className="w-full">
                    <thead className="bg-slate-50 dark:bg-slate-700 border-b border-slate-200 dark:border-slate-600">
                      <tr>
                        {headers.map(h => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {data.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700">
                          {headers.map(h => (
                            <td key={h} className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">{row[h]}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}
            </div>
            <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex gap-3">
              <button
                onClick={() => setPreviewReport(null)}
                className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                Close
              </button>
              <button
                onClick={() => handleExportCSV(previewReport)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
              >
                <Download size={16} /> Export CSV
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
