import { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth, hasPermission } from '../context/AuthContext';
import { employeesApi, isApiAvailable, mapEmployeeRow, profileRequestsApi } from '../services/api';
import { Search, Filter, Plus, ChevronRight, Mail, Phone, MapPin, Calendar, Briefcase, Users, RefreshCw } from 'lucide-react';
import Modal from '../components/Modal';
import BulkUploadButton from '../components/BulkUploadButton';
import { PendingProfileRequests, ProfileEditor, ProfilePhoto } from '../components/ProfileEditor';
import EmployeePayrollSettings from '../components/EmployeePayrollSettings';
import { payrollConfigurationVisible } from '../lib/hr-navigation';
import { Employee } from '../types';

export default function EmployeesPage({ heading = "Employees" }: { heading?: string }) {
  const { user } = useAuth();
  const { employees, setEmployees, departments, positions, ptkpTables, addToast, addAuditLog, companyRecords } = useApp();
  const embedded = typeof window !== 'undefined' && window.__WOLF_HR_EMBEDDED__ === true;
  const canEdit = !!user && hasPermission(user.role, 'employee.update');
  const salaryStructure = heading === 'Salary structure';
  const canAssignPay = !!user && payrollConfigurationVisible(user.role);
  const [requests, setRequests] = useState<Array<{ id: string; employee_code?: string; fields?: string[]; proposed?: Record<string, string | null>; has_photo?: boolean }>>([]);
  const [requestTick, setRequestTick] = useState(0);
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newEmp, setNewEmp] = useState({
    fullName: '', preferredName: '', nik: '', npwp: '', dateOfBirth: '', gender: 'M' as 'M' | 'F',
    phone: '', email: '', address: '', emergencyContactName: '', emergencyContactPhone: '',
    departmentId: '', positionId: '', employmentStatus: 'ACTIVE' as const, joinDate: '',
    bankName: '', bankAccountNumber: '', bankAccountName: '', ptkpCode: 'TK/0',
  });

  const openedFromWolf = useRef(false);
  useEffect(() => {
    if (openedFromWolf.current) return;
    const params = new URLSearchParams(window.location.search);
    const employeeId = params.get("employee");
    const wantsAdd = params.get("add") === "1";
    if (!employeeId && !wantsAdd) return;
    if (employeeId) {
      const found = employees.find((row) => row.id === employeeId);
      if (!found) return;
      setSelectedEmployee(found);
    }
    if (wantsAdd && !employeeId) setShowAddModal(true);
    openedFromWolf.current = true;
  }, [employees]);

  // Load employees from API if available
  useEffect(() => {
    const loadEmployees = async () => {
      if (isApiAvailable()) {
        setLoading(true);
        try {
          const data = await employeesApi.getAll();
          // Transform API data to match frontend format
          setEmployees(data.map((emp: any) => mapEmployeeRow(emp)));
        } catch (error) {
          console.error('Failed to load employees from API:', error);
          if (embedded) return;
          addToast('Using demo data. Start backend for live data.', 'info');
        } finally {
          setLoading(false);
        }
      }
    };

    loadEmployees();
  }, []);

  useEffect(() => {
    if (!canEdit) return;
    let cancelled = false;
    profileRequestsApi.list('PENDING')
      .then((rows) => { if (!cancelled) setRequests(rows); })
      .catch(() => { if (!cancelled) setRequests([]); });
    return () => { cancelled = true; };
  }, [canEdit, requestTick]);

  const filtered = employees.filter(e => {
    const matchSearch = e.fullName.toLowerCase().includes(search.toLowerCase()) || e.employeeCode.toLowerCase().includes(search.toLowerCase());
    const matchDept = !departmentFilter || e.departmentId === departmentFilter;
    const matchStatus = !statusFilter || e.employmentStatus === statusFilter;
    return matchSearch && matchDept && matchStatus;
  });

  const getDept = (id: string) => departments.find(d => d.id === id)?.name || '-';
  const getPos = (id: string) => positions.find(p => p.id === id)?.title || '-';

  const statusColor = (status: string) => {
    switch(status) {
      case 'ACTIVE': return 'bg-emerald-100 text-emerald-700';
      case 'PROBATION': return 'bg-blue-100 text-blue-700';
      case 'ON_LEAVE': return 'bg-amber-100 text-amber-700';
      case 'TERMINATED': return 'bg-red-100 text-red-700';
      case 'RESIGNED': return 'bg-slate-100 text-slate-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const handleAddEmployee = async () => {
    if (!newEmp.fullName || !newEmp.nik || !newEmp.email || !newEmp.departmentId || !newEmp.positionId) {
      addToast('Please fill in all required fields (Name, NIK, Email, Department, Position)', 'error');
      return;
    }
    if (employees.some(e => e.nik === newEmp.nik)) {
      addToast('An employee with this NIK already exists', 'error');
      return;
    }

    // Generate employee code in format: AMG + YY + MM + Number
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const randomNum = String(Math.floor(Math.random() * 9000) + 1000);
    const companyPrefix = embedded
      ? (window.location.pathname.match(/\/hr\/(amg|bzg|ggv)(?:\/|$)/)?.[1] ?? 'hr').toUpperCase()
      : 'AMG';
    const empCode = `${companyPrefix}${yy}${mm}${randomNum}`;
    const employeeData = {
      employee_code: empCode,
      full_name: newEmp.fullName,
      preferred_name: newEmp.preferredName || null,
      nik: newEmp.nik,
      npwp: newEmp.npwp || null,
      date_of_birth: newEmp.dateOfBirth || null,
      gender: newEmp.gender,
      phone: newEmp.phone || null,
      email: newEmp.email,
      address: newEmp.address || null,
      emergency_contact_name: newEmp.emergencyContactName || null,
      emergency_contact_phone: newEmp.emergencyContactPhone || null,
      department_id: newEmp.departmentId,
      position_id: newEmp.positionId,
      employment_status: newEmp.employmentStatus,
      join_date: newEmp.joinDate || new Date().toISOString().split('T')[0],
      bank_name: newEmp.bankName || null,
      bank_account_number: newEmp.bankAccountNumber || null,
      bank_account_name: newEmp.bankAccountName || null,
    };

    try {
      if (isApiAvailable()) {
        // Use API - don't send ID, let backend generate UUID
        const created = await employeesApi.create(employeeData);
        const newEmployee: Employee = {
          id: created.id,
          employeeCode: created.employee_code,
          fullName: created.full_name,
          preferredName: created.preferred_name,
          nik: created.nik,
          npwp: created.npwp,
          dateOfBirth: created.date_of_birth,
          gender: created.gender,
          phone: created.phone,
          email: created.email,
          address: created.address,
          emergencyContactName: created.emergency_contact_name,
          emergencyContactPhone: created.emergency_contact_phone,
          departmentId: created.department_id,
          positionId: created.position_id,
          employmentStatus: created.employment_status,
          joinDate: created.join_date,
          bankName: created.bank_name,
          bankAccountNumber: created.bank_account_number,
          bankAccountName: created.bank_account_name,
          ptkpCode: newEmp.ptkpCode || 'TK/0',
        };
        setEmployees(prev => [...prev, newEmployee]);
        addAuditLog('CREATE', 'Employee', newEmployee.id, `${newEmployee.fullName} created`);
        addToast(`Employee ${newEmployee.fullName} (${empCode}) created successfully`, 'success');
      } else if (embedded) {
        addToast('Employee records are not available for this company.', 'error');
        return;
      } else {
        // Use mock data - generate simple ID for local use only
        const employee: Employee = {
          id: 'mock-' + Date.now(),
          employeeCode: empCode,
          fullName: newEmp.fullName,
          preferredName: newEmp.preferredName,
          nik: newEmp.nik,
          npwp: newEmp.npwp,
          dateOfBirth: newEmp.dateOfBirth,
          gender: newEmp.gender,
          phone: newEmp.phone,
          email: newEmp.email,
          address: newEmp.address,
          emergencyContactName: newEmp.emergencyContactName,
          emergencyContactPhone: newEmp.emergencyContactPhone,
          departmentId: newEmp.departmentId,
          positionId: newEmp.positionId,
          employmentStatus: newEmp.employmentStatus,
          joinDate: newEmp.joinDate || new Date().toISOString().split('T')[0],
          bankName: newEmp.bankName,
          bankAccountNumber: newEmp.bankAccountNumber,
          bankAccountName: newEmp.bankAccountName,
          ptkpCode: newEmp.ptkpCode || 'TK/0',
        };
        setEmployees(prev => [...prev, employee]);
        addAuditLog('CREATE', 'Employee', employee.id, `${employee.fullName} created`);
        addToast(`Employee ${employee.fullName} (${empCode}) created successfully`, 'success');
      }
      
      setShowAddModal(false);
      setNewEmp({
        fullName: '', preferredName: '', nik: '', npwp: '', dateOfBirth: '', gender: 'M',
        phone: '', email: '', address: '', emergencyContactName: '', emergencyContactPhone: '',
        departmentId: '', positionId: '', employmentStatus: 'ACTIVE', joinDate: '',
        bankName: '', bankAccountNumber: '', bankAccountName: '', ptkpCode: 'TK/0',
      });
    } catch (error: any) {
      addToast(`Failed to create employee: ${error.message}`, 'error');
    }
  };

  const handleRefresh = async () => {
    if (isApiAvailable()) {
      setLoading(true);
      try {
        const data = await employeesApi.getAll();
        setEmployees(data.map((emp: any) => mapEmployeeRow(emp)));
        addToast('Employee list refreshed from database', 'success');
      } catch (error) {
        addToast('Failed to refresh employee list', 'error');
      } finally {
        setLoading(false);
      }
    } else {
      addToast('Employee list is the people registered in this session.', 'info');
    }
  };

  if (selectedEmployee) {
    return (
      <div className="space-y-6">
        <button onClick={() => setSelectedEmployee(null)} className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
          {salaryStructure ? '← Back to salary structure' : '← Back to Employee List'}
        </button>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-start gap-4">
            <ProfilePhoto employee={selectedEmployee} className="w-16 h-16 rounded-full text-xl" />
            <div className="flex-1">
              <h2 className="text-xl font-bold text-slate-800">{selectedEmployee.fullName}</h2>
              {selectedEmployee.preferredName && <p className="text-sm text-slate-500">"{selectedEmployee.preferredName}"</p>}
              <div className="flex flex-wrap gap-3 mt-2">
                <span className="text-sm text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{selectedEmployee.employeeCode}</span>
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${statusColor(selectedEmployee.employmentStatus)}`}>{selectedEmployee.employmentStatus}</span>
              </div>
            </div>
          </div>
        </div>
        {salaryStructure && (
          <EmployeePayrollSettings
            employeeId={selectedEmployee.id}
            canEdit={canAssignPay}
            notify={addToast}
          />
        )}
        {canEdit && !salaryStructure && (
          <ProfileEditor
            mode="edit"
            employee={selectedEmployee}
            departments={departments}
            positions={positions}
            notify={addToast}
            onSaved={(next) => {
              setSelectedEmployee(next);
              setEmployees((prev) => prev.map((row) => row.id === next.id ? next : row));
            }}
          />
        )}
        {canEdit && !salaryStructure && (
          <PendingProfileRequests
            requests={requests.filter((request) => request.employee_code === selectedEmployee.employeeCode)}
            departments={departments}
            positions={positions}
            onDecide={async () => {
              setRequestTick((value) => value + 1);
              try {
                const row = await employeesApi.getById(selectedEmployee.id);
                const next = mapEmployeeRow(row);
                setSelectedEmployee(next);
                setEmployees((prev) => prev.map((item) => item.id === next.id ? next : item));
              } catch {
                handleRefresh();
              }
            }}
          />
        )}
        {canEdit && !salaryStructure && selectedEmployee.employmentStatus !== 'TERMINATED' && selectedEmployee.employmentStatus !== 'RESIGNED' && (
          <div className="bg-white rounded-xl border border-amber-200 p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium text-slate-800">Deactivate employee</p>
              <p className="text-sm text-slate-500">Marks the person TERMINATED with today’s date. Prefer Offboarding for final pay.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                const reason = window.prompt('Reason for deactivation');
                if (!reason?.trim()) return;
                const today = new Date().toISOString().slice(0, 10);
                const next = { ...selectedEmployee, employmentStatus: 'TERMINATED' as const, terminationDate: today };
                setSelectedEmployee(next);
                setEmployees(prev => prev.map(row => row.id === next.id ? next : row));
                addAuditLog('UPDATE', 'Employee', next.id, `Deactivated: ${reason.trim()}`);
                addToast(`${next.fullName} deactivated.`, 'warning');
              }}
              className="px-3 py-2 bg-red-50 text-red-700 rounded-lg text-sm font-medium"
            >
              Deactivate
            </button>
          </div>
        )}
        {canEdit && !salaryStructure && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <h3 className="font-semibold text-slate-800">HR master data</h3>
            <p className="text-sm text-slate-500">BPJS numbers, education, approval line, Manager/HOD, benefit applicability, and violation history.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="text-xs text-slate-500">BPJS TK number<input className="mt-1 w-full px-3 py-2 border rounded-lg text-sm" value={selectedEmployee.bpjsTkNumber || ''} onChange={e => {
                const next = { ...selectedEmployee, bpjsTkNumber: e.target.value };
                setSelectedEmployee(next);
                setEmployees(prev => prev.map(row => row.id === next.id ? next : row));
              }} /></label>
              <label className="text-xs text-slate-500">BPJS Kesehatan number<input className="mt-1 w-full px-3 py-2 border rounded-lg text-sm" value={selectedEmployee.bpjsKesehatanNumber || ''} onChange={e => {
                const next = { ...selectedEmployee, bpjsKesehatanNumber: e.target.value };
                setSelectedEmployee(next);
                setEmployees(prev => prev.map(row => row.id === next.id ? next : row));
              }} /></label>
              <label className="text-xs text-slate-500">Last education<input className="mt-1 w-full px-3 py-2 border rounded-lg text-sm" value={selectedEmployee.lastEducation || ''} onChange={e => {
                const next = { ...selectedEmployee, lastEducation: e.target.value };
                setSelectedEmployee(next);
                setEmployees(prev => prev.map(row => row.id === next.id ? next : row));
              }} /></label>
              <label className="text-xs text-slate-500">Education institution<input className="mt-1 w-full px-3 py-2 border rounded-lg text-sm" value={selectedEmployee.educationInstitution || ''} onChange={e => {
                const next = { ...selectedEmployee, educationInstitution: e.target.value };
                setSelectedEmployee(next);
                setEmployees(prev => prev.map(row => row.id === next.id ? next : row));
              }} /></label>
              <label className="text-xs text-slate-500">Approval line<input className="mt-1 w-full px-3 py-2 border rounded-lg text-sm" value={selectedEmployee.approvalLine || ''} onChange={e => {
                const next = { ...selectedEmployee, approvalLine: e.target.value };
                setSelectedEmployee(next);
                setEmployees(prev => prev.map(row => row.id === next.id ? next : row));
              }} /></label>
              <label className="text-xs text-slate-500">Manager / HOD
                <select className="mt-1 w-full px-3 py-2 border rounded-lg text-sm" value={selectedEmployee.managerEmployeeId || ''} onChange={e => {
                  const next = { ...selectedEmployee, managerEmployeeId: e.target.value || undefined };
                  setSelectedEmployee(next);
                  setEmployees(prev => prev.map(row => row.id === next.id ? next : row));
                }}>
                  <option value="">—</option>
                  {employees.filter(row => row.id !== selectedEmployee.id).map(row => <option key={row.id} value={row.id}>{row.fullName}</option>)}
                </select>
              </label>
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={selectedEmployee.serviceChargeEligible !== false} onChange={e => {
                const next = { ...selectedEmployee, serviceChargeEligible: e.target.checked };
                setSelectedEmployee(next);
                setEmployees(prev => prev.map(row => row.id === next.id ? next : row));
              }} /> Service charge eligible</label>
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={selectedEmployee.bpjsKesehatanApplicable !== false} onChange={e => {
                const next = { ...selectedEmployee, bpjsKesehatanApplicable: e.target.checked };
                setSelectedEmployee(next);
                setEmployees(prev => prev.map(row => row.id === next.id ? next : row));
              }} /> BPJS Kesehatan applicable</label>
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={selectedEmployee.bpjsTkApplicable !== false} onChange={e => {
                const next = { ...selectedEmployee, bpjsTkApplicable: e.target.checked };
                setSelectedEmployee(next);
                setEmployees(prev => prev.map(row => row.id === next.id ? next : row));
              }} /> BPJS TK applicable</label>
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={selectedEmployee.pph21Applicable !== false} onChange={e => {
                const next = { ...selectedEmployee, pph21Applicable: e.target.checked };
                setSelectedEmployee(next);
                setEmployees(prev => prev.map(row => row.id === next.id ? next : row));
              }} /> PPh21 applicable</label>
            </div>
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-700">Violation history</p>
                <button type="button" className="text-sm text-indigo-600" onClick={() => {
                  const type = window.prompt('Violation type');
                  if (!type?.trim()) return;
                  const notes = window.prompt('Notes') || '';
                  const entry = {
                    id: `vio${Date.now()}`,
                    date: new Date().toISOString().slice(0, 10),
                    type: type.trim(),
                    notes,
                    recordedBy: user?.fullName || 'HR',
                    recordedAt: new Date().toISOString(),
                  };
                  const next = { ...selectedEmployee, violations: [...(selectedEmployee.violations || []), entry] };
                  setSelectedEmployee(next);
                  setEmployees(prev => prev.map(row => row.id === next.id ? next : row));
                  addAuditLog('CREATE', 'EmployeeViolation', next.id, entry.type);
                }}>Add violation</button>
              </div>
              {(selectedEmployee.violations || []).length === 0 && <p className="text-sm text-slate-500">No violations recorded.</p>}
              <ul className="space-y-1 text-sm text-slate-600">
                {(selectedEmployee.violations || []).map(row => (
                  <li key={row.id}>{row.date} · {row.type}{row.notes ? ` — ${row.notes}` : ''} · {row.recordedBy}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-800 mb-4">Personal Information</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-slate-600"><Mail size={14} /> {selectedEmployee.email}</div>
              <div className="flex items-center gap-2 text-slate-600"><Phone size={14} /> {selectedEmployee.phone}</div>
              <div className="flex items-center gap-2 text-slate-600"><MapPin size={14} /> {selectedEmployee.address}</div>
              <div className="flex items-center gap-2 text-slate-600"><Calendar size={14} /> DOB: {selectedEmployee.dateOfBirth}</div>
              <div className="text-slate-600">Gender: {selectedEmployee.gender === 'M' ? 'Male' : selectedEmployee.gender === 'F' ? 'Female' : '—'}</div>
              <div className="text-slate-600">NIK: {selectedEmployee.nik}</div>
              {selectedEmployee.npwp && <div className="text-slate-600">NPWP: {selectedEmployee.npwp}</div>}
              <div className="text-slate-600">PTKP: {selectedEmployee.ptkpCode || '—'}</div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs font-medium text-slate-500 mb-2">Emergency Contact</p>
              <p className="text-sm text-slate-700">{selectedEmployee.emergencyContactName}</p>
              <p className="text-sm text-slate-500">{selectedEmployee.emergencyContactPhone}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-800 mb-4">Employment Information</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-slate-600"><Briefcase size={14} /> {getDept(selectedEmployee.departmentId)}</div>
              <div className="text-slate-600">Position: {getPos(selectedEmployee.positionId)}</div>
              <div className="text-slate-600">Join Date: {selectedEmployee.joinDate}</div>
              <div className="text-slate-600">Status: {selectedEmployee.employmentStatus}</div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs font-medium text-slate-500 mb-2">Bank Information</p>
              <p className="text-sm text-slate-700">{selectedEmployee.bankName} - {selectedEmployee.bankAccountNumber}</p>
              <p className="text-sm text-slate-500">A/C Name: {selectedEmployee.bankAccountName}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-800 mb-4">Quick Overview</h3>
            <div className="space-y-4">
              {embedded ? (
                <p className="text-sm text-slate-500">Attendance, leave, and overtime for this person are limited to this company. None are recorded on this screen until those company records exist.</p>
              ) : (
                <>
                  <div className="p-3 bg-emerald-50 rounded-lg">
                    <p className="text-xs text-emerald-600 font-medium">Leave Balance (Annual)</p>
                    <p className="text-2xl font-bold text-emerald-700">9 <span className="text-sm font-normal">/ 12 days</span></p>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-xs text-blue-600 font-medium">This Month Attendance</p>
                    <p className="text-2xl font-bold text-blue-700">18 <span className="text-sm font-normal">/ 22 days</span></p>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-lg">
                    <p className="text-xs text-purple-600 font-medium">Overtime (This Month)</p>
                    <p className="text-2xl font-bold text-purple-700">6.5 <span className="text-sm font-normal">hours</span></p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{heading}</h1>
          <p className="text-slate-500 text-sm mt-1">{salaryStructure ? 'Choose a person, then turn on only the components they receive.' : `${filtered.length} employees found`}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          {!salaryStructure && (
            <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium">
              <Plus size={16} /> Add Employee
            </button>
          )}
          {!salaryStructure && <BulkUploadButton module="employees" />}
        </div>
      </div>

      {canEdit && !salaryStructure && (
        <PendingProfileRequests
          requests={requests}
          departments={departments}
          positions={positions}
          onDecide={() => {
            setRequestTick((value) => value + 1);
            handleRefresh();
          }}
        />
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px] relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or employee code..." className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-400" />
            <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
              <option value="">All Departments</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
              <option value="">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="PROBATION">Probation</option>
              <option value="ON_LEAVE">On Leave</option>
              <option value="TERMINATED">Terminated</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Employee</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Code</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Department</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Position</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Join Date</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(emp => (
                <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <ProfilePhoto employee={emp} className="w-8 h-8 rounded-full text-xs" />
                      <div>
                        <p className="text-sm font-medium text-slate-800">{emp.fullName}</p>
                        <p className="text-xs text-slate-500">{emp.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{emp.employeeCode}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{getDept(emp.departmentId)}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{getPos(emp.positionId)}</td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded font-medium ${statusColor(emp.employmentStatus)}`}>{emp.employmentStatus}</span></td>
                  <td className="px-4 py-3 text-sm text-slate-600">{emp.joinDate}</td>
                  <td className="px-4 py-3"><button onClick={() => setSelectedEmployee(emp)} className="text-indigo-600 hover:text-indigo-700"><ChevronRight size={16} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {companyRecords === 'denied' && (
          <div className="text-center py-12 text-slate-500">
            <p>This company is not available for the signed-in session.</p>
          </div>
        )}
        {companyRecords !== 'denied' && filtered.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <Users size={40} className="mx-auto mb-3 text-slate-300" />
            <p>{embedded ? 'No employees are recorded for this company.' : 'No employees found matching your criteria.'}</p>
          </div>
        )}
      </div>

      {/* Add Employee Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add New Employee" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Full Name *</label>
              <input type="text" value={newEmp.fullName} onChange={e => setNewEmp({...newEmp, fullName: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" placeholder="e.g. John Doe" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Preferred Name</label>
              <input type="text" value={newEmp.preferredName} onChange={e => setNewEmp({...newEmp, preferredName: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">NIK *</label>
              <input type="text" value={newEmp.nik} onChange={e => setNewEmp({...newEmp, nik: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" placeholder="16-digit NIK" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">NPWP</label>
              <input type="text" value={newEmp.npwp} onChange={e => setNewEmp({...newEmp, npwp: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date of Birth</label>
              <input type="date" value={newEmp.dateOfBirth} onChange={e => setNewEmp({...newEmp, dateOfBirth: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Gender</label>
              <select value={newEmp.gender} onChange={e => setNewEmp({...newEmp, gender: e.target.value as 'M' | 'F'})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
                <option value="M">Male</option>
                <option value="F">Female</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
              <input type="email" value={newEmp.email} onChange={e => setNewEmp({...newEmp, email: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
              <input type="tel" value={newEmp.phone} onChange={e => setNewEmp({...newEmp, phone: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Department *</label>
              <select value={newEmp.departmentId} onChange={e => setNewEmp({...newEmp, departmentId: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
                <option value="">Select Department</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Position *</label>
              <select value={newEmp.positionId} onChange={e => setNewEmp({...newEmp, positionId: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
                <option value="">Select Position</option>
                {positions.filter(p => !newEmp.departmentId || p.departmentId === newEmp.departmentId).map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Join Date</label>
              <input type="date" value={newEmp.joinDate} onChange={e => setNewEmp({...newEmp, joinDate: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">PTKP</label>
              <p className="text-xs text-slate-500 mb-1">Payroll uses this for the TER bracket.</p>
              <select value={newEmp.ptkpCode} onChange={e => setNewEmp({...newEmp, ptkpCode: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
                {(ptkpTables.length > 0 ? ptkpTables : [{ code: 'TK/0', label: 'TK/0' }]).map(row => (
                  <option key={row.code} value={row.code}>{row.label || row.code}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Bank name</label>
              <input type="text" value={newEmp.bankName} onChange={e => setNewEmp({...newEmp, bankName: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" placeholder="BCA" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Account number</label>
              <input type="text" value={newEmp.bankAccountNumber} onChange={e => setNewEmp({...newEmp, bankAccountNumber: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Account name</label>
              <input type="text" value={newEmp.bankAccountName} onChange={e => setNewEmp({...newEmp, bankAccountName: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Employment Status</label>
              <select value={newEmp.employmentStatus} onChange={e => setNewEmp({...newEmp, employmentStatus: e.target.value as any})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
                <option value="ACTIVE">Active</option>
                <option value="PROBATION">Probation</option>
              </select>
            </div>
          </div>
          <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
            <button onClick={() => setShowAddModal(false)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={handleAddEmployee} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Create Employee</button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
