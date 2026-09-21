import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { departments, positions, employees } from '../data/mockData';
import { Search, Filter, Plus, ChevronRight, Mail, Phone, MapPin, Calendar, Briefcase, Users, X } from 'lucide-react';
import Modal from '../components/Modal';
import { Employee } from '../types';

export default function EmployeesPage() {
  const { setEmployees, addToast, addAuditLog } = useApp();
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmp, setNewEmp] = useState({
    fullName: '', preferredName: '', nik: '', npwp: '', dateOfBirth: '', gender: 'M' as 'M' | 'F',
    phone: '', email: '', address: '', emergencyContactName: '', emergencyContactPhone: '',
    departmentId: '', positionId: '', employmentStatus: 'ACTIVE' as const, joinDate: '',
    bankName: '', bankAccountNumber: '', bankAccountName: '',
  });

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

  const handleAddEmployee = () => {
    if (!newEmp.fullName || !newEmp.nik || !newEmp.email || !newEmp.departmentId || !newEmp.positionId) {
      addToast('Please fill in all required fields (Name, NIK, Email, Department, Position)', 'error');
      return;
    }
    if (employees.some(e => e.nik === newEmp.nik)) {
      addToast('An employee with this NIK already exists', 'error');
      return;
    }
    const empCode = `EMP-${String(employees.length + 1).padStart(3, '0')}`;
    const employee: Employee = {
      id: 'e' + Date.now(),
      employeeCode: empCode,
      fullName: newEmp.fullName,
      preferredName: newEmp.preferredName || undefined,
      nik: newEmp.nik,
      npwp: newEmp.npwp || undefined,
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
      bankName: newEmp.bankName || undefined,
      bankAccountNumber: newEmp.bankAccountNumber || undefined,
      bankAccountName: newEmp.bankAccountName || undefined,
    };
    setEmployees(prev => [...prev, employee]);
    addAuditLog('CREATE', 'Employee', employee.id, `${employee.fullName} created`);
    addToast(`Employee ${employee.fullName} (${empCode}) created successfully`, 'success');
    setShowAddModal(false);
    setNewEmp({ fullName: '', preferredName: '', nik: '', npwp: '', dateOfBirth: '', gender: 'M', phone: '', email: '', address: '', emergencyContactName: '', emergencyContactPhone: '', departmentId: '', positionId: '', employmentStatus: 'ACTIVE', joinDate: '', bankName: '', bankAccountNumber: '', bankAccountName: '' });
  };

  if (selectedEmployee) {
    return (
      <div className="space-y-6">
        <button onClick={() => setSelectedEmployee(null)} className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
          ← Back to Employee List
        </button>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center text-xl font-bold text-indigo-600">
              {selectedEmployee.fullName.split(' ').map(n => n[0]).join('')}
            </div>
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-800 mb-4">Personal Information</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-slate-600"><Mail size={14} /> {selectedEmployee.email}</div>
              <div className="flex items-center gap-2 text-slate-600"><Phone size={14} /> {selectedEmployee.phone}</div>
              <div className="flex items-center gap-2 text-slate-600"><MapPin size={14} /> {selectedEmployee.address}</div>
              <div className="flex items-center gap-2 text-slate-600"><Calendar size={14} /> DOB: {selectedEmployee.dateOfBirth}</div>
              <div className="text-slate-600">Gender: {selectedEmployee.gender === 'M' ? 'Male' : 'Female'}</div>
              <div className="text-slate-600">NIK: {selectedEmployee.nik}</div>
              {selectedEmployee.npwp && <div className="text-slate-600">NPWP: {selectedEmployee.npwp}</div>}
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
          <h1 className="text-2xl font-bold text-slate-800">Employees</h1>
          <p className="text-slate-500 text-sm mt-1">{filtered.length} employees found</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium">
          <Plus size={16} /> Add Employee
        </button>
      </div>

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
                      <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-xs font-bold text-indigo-600">{emp.fullName.split(' ').map(n => n[0]).join('').slice(0, 2)}</div>
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
        {filtered.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <Users size={40} className="mx-auto mb-3 text-slate-300" />
            <p>No employees found matching your criteria.</p>
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
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
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
