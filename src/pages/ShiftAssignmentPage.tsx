import { useState } from 'react';
import { employees, shifts, departments } from '../data/mockData';
import { Calendar, Clock, Users, Plus, X } from 'lucide-react';

export default function ShiftAssignmentPage() {
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedWeek, setSelectedWeek] = useState(new Date());
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedShift, setSelectedShift] = useState('');

  // Mock shift assignments
  const [assignments, setAssignments] = useState([
    { id: '1', employeeId: 'e1', date: '2024-01-15', shiftId: 's1' },
    { id: '2', employeeId: 'e1', date: '2024-01-16', shiftId: 's1' },
    { id: '3', employeeId: 'e2', date: '2024-01-15', shiftId: 's2' },
    { id: '4', employeeId: 'e3', date: '2024-01-15', shiftId: 's4' },
  ]);

  const getWeekDates = (date: Date) => {
    const week = [];
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - date.getDay());
    
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      week.push(day);
    }
    return week;
  };

  const weekDates = getWeekDates(selectedWeek);
  
  const filteredEmployees = selectedDepartment 
    ? employees.filter(e => e.departmentId === selectedDepartment && e.employmentStatus === 'ACTIVE')
    : employees.filter(e => e.employmentStatus === 'ACTIVE');

  const getEmp = (id: string) => employees.find(e => e.id === id);
  const getShift = (id: string) => shifts.find(s => s.id === id);
  const getDept = (id: string) => departments.find(d => d.id === id)?.name || '-';

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const formatDisplayDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const getAssignment = (employeeId: string, date: string) => {
    return assignments.find(a => a.employeeId === employeeId && a.date === date);
  };

  const handleAssign = () => {
    if (!selectedEmployee || !selectedDate || !selectedShift) return;

    const newAssignment = {
      id: Date.now().toString(),
      employeeId: selectedEmployee,
      date: selectedDate,
      shiftId: selectedShift,
    };

    setAssignments([...assignments, newAssignment]);
    setShowAssignModal(false);
    setSelectedEmployee('');
    setSelectedDate('');
    setSelectedShift('');
  };

  const handleRemoveAssignment = (id: string) => {
    setAssignments(assignments.filter(a => a.id !== id));
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedWeek);
    newDate.setDate(selectedWeek.getDate() + (direction === 'next' ? 7 : -7));
    setSelectedWeek(newDate);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Shift Assignment</h1>
          <p className="text-slate-500 text-sm mt-1">Assign shifts to employees</p>
        </div>
        <button
          onClick={() => setShowAssignModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
        >
          <Plus size={16} /> Assign Shift
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Departments</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button
              onClick={() => navigateWeek('prev')}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50"
            >
              ← Previous
            </button>
            <button
              onClick={() => setSelectedWeek(new Date())}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50"
            >
              Today
            </button>
            <button
              onClick={() => navigateWeek('next')}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50"
            >
              Next →
            </button>
          </div>
        </div>
      </div>

      {/* Shift Schedule Grid */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase sticky left-0 bg-slate-50">
                  Employee
                </th>
                {weekDates.map((date, idx) => (
                  <th key={idx} className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase min-w-[120px]">
                    <div>{formatDisplayDate(date)}</div>
                    <div className="text-xs text-slate-400">{formatDate(date)}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEmployees.map(emp => (
                <tr key={emp.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 sticky left-0 bg-white">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{emp.fullName}</p>
                      <p className="text-xs text-slate-500">{getDept(emp.departmentId)}</p>
                    </div>
                  </td>
                  {weekDates.map((date, idx) => {
                    const dateStr = formatDate(date);
                    const assignment = getAssignment(emp.id, dateStr);
                    const shift = assignment ? getShift(assignment.shiftId) : null;

                    return (
                      <td key={idx} className="px-2 py-2 text-center">
                        {shift ? (
                          <div className="relative group">
                            <div className="px-2 py-2 bg-indigo-50 border border-indigo-200 rounded-lg text-xs">
                              <div className="font-medium text-indigo-700">{shift.name}</div>
                              <div className="text-indigo-600">{shift.startTime} - {shift.endTime}</div>
                            </div>
                            {assignment && (
                              <button
                                onClick={() => handleRemoveAssignment(assignment.id)}
                                className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-600"
                              >
                                <X size={12} />
                              </button>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setSelectedEmployee(emp.id);
                              setSelectedDate(dateStr);
                              setShowAssignModal(true);
                            }}
                            className="w-full h-12 border-2 border-dashed border-slate-200 rounded-lg text-slate-400 hover:border-indigo-300 hover:text-indigo-500 transition-colors flex items-center justify-center"
                          >
                            <Plus size={16} />
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="text-sm font-medium text-slate-700 mb-3">Shift Types</h3>
        <div className="flex flex-wrap gap-3">
          {shifts.map(shift => (
            <div key={shift.id} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg">
              <Clock size={14} className="text-indigo-600" />
              <div>
                <p className="text-xs font-medium text-slate-700">{shift.name}</p>
                <p className="text-xs text-slate-500">{shift.startTime} - {shift.endTime}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Assign Shift Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-800">Assign Shift</h3>
              <button
                onClick={() => setShowAssignModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Employee</label>
                <select
                  value={selectedEmployee}
                  onChange={(e) => setSelectedEmployee(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select Employee</option>
                  {filteredEmployees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName} ({emp.employeeCode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Shift</label>
                <select
                  value={selectedShift}
                  onChange={(e) => setSelectedShift(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select Shift</option>
                  {shifts.map(shift => (
                    <option key={shift.id} value={shift.id}>
                      {shift.name} ({shift.startTime} - {shift.endTime})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssign}
                  disabled={!selectedEmployee || !selectedDate || !selectedShift}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Assign
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
