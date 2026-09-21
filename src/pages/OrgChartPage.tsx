import { useState } from 'react';
import { employees, departments, positions } from '../data/mockData';
import { Building2, Users, ChevronDown, ChevronRight } from 'lucide-react';

export default function OrgChartPage() {
  const [expandedDepts, setExpandedDepts] = useState<string[]>(departments.map(d => d.id));

  const toggleDept = (deptId: string) => {
    setExpandedDepts(prev => 
      prev.includes(deptId) 
        ? prev.filter(id => id !== deptId)
        : [...prev, deptId]
    );
  };

  const getDeptEmployees = (deptId: string) => {
    return employees.filter(e => e.departmentId === deptId && e.employmentStatus === 'ACTIVE');
  };

  const getDeptManager = (deptId: string) => {
    const dept = departments.find(d => d.id === deptId);
    if (!dept?.managerEmployeeId) return null;
    return employees.find(e => e.id === dept.managerEmployeeId);
  };

  const getPositionTitle = (positionId: string) => {
    return positions.find(p => p.id === positionId)?.title || 'Unknown Position';
  };

  const totalEmployees = employees.filter(e => e.employmentStatus === 'ACTIVE').length;
  const totalDepartments = departments.filter(d => d.isActive).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Organization Chart</h1>
          <p className="text-slate-500 text-sm mt-1">Visual hierarchy of departments and positions</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Total Employees</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{totalEmployees}</p>
            </div>
            <Users size={24} className="text-indigo-400" />
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Departments</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{totalDepartments}</p>
            </div>
            <Building2 size={24} className="text-indigo-400" />
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Avg per Department</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">
                {totalDepartments > 0 ? Math.round(totalEmployees / totalDepartments) : 0}
              </p>
            </div>
            <Users size={24} className="text-indigo-400" />
          </div>
        </div>
      </div>

      {/* Organization Chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="space-y-4">
          {/* General Manager */}
          <div className="flex justify-center mb-8">
            <div className="bg-indigo-600 text-white px-6 py-4 rounded-xl shadow-lg">
              <p className="font-semibold text-lg">General Manager</p>
              <p className="text-indigo-200 text-sm">Hotel Leadership</p>
            </div>
          </div>

          {/* Departments */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {departments.filter(d => d.isActive).map(dept => {
              const deptEmployees = getDeptEmployees(dept.id);
              const manager = getDeptManager(dept.id);
              const isExpanded = expandedDepts.includes(dept.id);

              return (
                <div key={dept.id} className="border border-slate-200 rounded-xl overflow-hidden">
                  {/* Department Header */}
                  <button
                    onClick={() => toggleDept(dept.id)}
                    className="w-full bg-slate-50 px-4 py-3 flex items-center justify-between hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                        <Building2 size={20} className="text-indigo-600" />
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-slate-800">{dept.name}</p>
                        <p className="text-xs text-slate-500">{deptEmployees.length} employees</p>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronDown size={20} className="text-slate-400" />
                    ) : (
                      <ChevronRight size={20} className="text-slate-400" />
                    )}
                  </button>

                  {/* Department Content */}
                  {isExpanded && (
                    <div className="p-4 space-y-3">
                      {/* Manager */}
                      {manager && (
                        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                          <p className="text-xs text-indigo-600 font-medium mb-1">Department Head</p>
                          <p className="font-medium text-slate-800">{manager.fullName}</p>
                          <p className="text-xs text-slate-500">{getPositionTitle(manager.positionId)}</p>
                        </div>
                      )}

                      {/* Employees */}
                      <div className="space-y-2">
                        {deptEmployees.slice(0, 5).map(emp => (
                          <div key={emp.id} className="flex items-center gap-2 text-sm">
                            <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-xs font-medium text-slate-600">
                              {emp.fullName.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-slate-700 truncate">{emp.fullName}</p>
                              <p className="text-xs text-slate-500 truncate">{getPositionTitle(emp.positionId)}</p>
                            </div>
                          </div>
                        ))}
                        {deptEmployees.length > 5 && (
                          <p className="text-xs text-slate-500 text-center pt-2">
                            +{deptEmployees.length - 5} more employee{deptEmployees.length - 5 !== 1 ? 's' : ''}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Department Breakdown */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-800 mb-4">Department Breakdown</h3>
        <div className="space-y-3">
          {departments.filter(d => d.isActive).map(dept => {
            const deptEmployees = getDeptEmployees(dept.id);
            const percentage = totalEmployees > 0 ? (deptEmployees.length / totalEmployees) * 100 : 0;

            return (
              <div key={dept.id} className="flex items-center gap-4">
                <div className="w-40 text-sm font-medium text-slate-700">{dept.name}</div>
                <div className="flex-1 bg-slate-100 rounded-full h-6 overflow-hidden">
                  <div
                    className="bg-indigo-500 h-full rounded-full flex items-center justify-end pr-2 transition-all"
                    style={{ width: `${percentage}%` }}
                  >
                    <span className="text-xs text-white font-medium">{deptEmployees.length}</span>
                  </div>
                </div>
                <div className="w-16 text-sm text-slate-500 text-right">{percentage.toFixed(0)}%</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
