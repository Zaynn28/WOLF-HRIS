import { useState } from 'react';
import { employees, departments } from '../data/mockData';
import { Calendar, ChevronLeft, ChevronRight, Users } from 'lucide-react';

export default function AttendanceCalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);

  // Generate calendar days for current month
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];
    
    // Add empty cells for days before first day of month
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null);
    }
    
    // Add days of month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }
    
    return days;
  };

  const days = getDaysInMonth(currentDate);
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Filter employees by department
  const filteredEmployees = selectedDepartment === 'all' 
    ? employees 
    : employees.filter(emp => emp.departmentId === selectedDepartment);

  // Mock attendance data generator
  const getAttendanceStatus = (employeeId: string, date: Date | null) => {
    if (!date) return null;
    
    // Generate random attendance for demo purposes
    const seed = employeeId.charCodeAt(0) + date.getDate();
    const random = (seed * 9301 + 49297) % 233280;
    const rnd = random / 233280;
    
    // 70% present, 15% late, 10% absent, 5% leave
    if (rnd < 0.70) return 'present';
    if (rnd < 0.85) return 'late';
    if (rnd < 0.95) return 'absent';
    return 'leave';
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'present': return 'bg-emerald-500';
      case 'late': return 'bg-amber-500';
      case 'absent': return 'bg-red-500';
      case 'leave': return 'bg-blue-500';
      default: return 'bg-slate-200';
    }
  };

  const getStatusLabel = (status: string | null) => {
    switch (status) {
      case 'present': return 'Present';
      case 'late': return 'Late';
      case 'absent': return 'Absent';
      case 'leave': return 'On Leave';
      default: return '';
    }
  };

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const today = new Date();
  const isToday = (date: Date | null) => {
    if (!date) return false;
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  // Calculate statistics for selected employee
  const getEmployeeStats = (employeeId: string) => {
    let present = 0, late = 0, absent = 0, leave = 0;
    const daysInMonth = getDaysInMonth(currentDate).filter(d => d !== null);
    
    daysInMonth.forEach(date => {
      const status = getAttendanceStatus(employeeId, date);
      if (status === 'present') present++;
      else if (status === 'late') late++;
      else if (status === 'absent') absent++;
      else if (status === 'leave') leave++;
    });

    return { present, late, absent, leave, total: daysInMonth.length };
  };

  const selectedEmployeeData = selectedEmployee ? employees.find(e => e.id === selectedEmployee) : null;
  const selectedEmployeeStats = selectedEmployee ? getEmployeeStats(selectedEmployee) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Attendance Calendar</h1>
        <p className="text-slate-500 text-sm mt-1">Monthly view of employee attendance patterns</p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={previousMonth}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <h2 className="text-lg font-semibold text-slate-800 min-w-[200px] text-center">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
            <button
              onClick={nextMonth}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Departments</option>
              {departments.map(dept => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>

            <select
              value={selectedEmployee || ''}
              onChange={(e) => setSelectedEmployee(e.target.value || null)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Employees</option>
              {filteredEmployees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.fullName}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Employee Stats Card */}
      {selectedEmployeeData && selectedEmployeeStats && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-semibold text-slate-800 text-lg">{selectedEmployeeData.fullName}</h3>
              <p className="text-sm text-slate-500">{selectedEmployeeData.employeeCode}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-indigo-600">
                {Math.round((selectedEmployeeStats.present / selectedEmployeeStats.total) * 100)}%
              </p>
              <p className="text-xs text-slate-500">Attendance Rate</p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div className="bg-emerald-50 rounded-lg p-3">
              <p className="text-2xl font-bold text-emerald-700">{selectedEmployeeStats.present}</p>
              <p className="text-xs text-emerald-600">Present</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-3">
              <p className="text-2xl font-bold text-amber-700">{selectedEmployeeStats.late}</p>
              <p className="text-xs text-amber-600">Late</p>
            </div>
            <div className="bg-red-50 rounded-lg p-3">
              <p className="text-2xl font-bold text-red-700">{selectedEmployeeStats.absent}</p>
              <p className="text-xs text-red-600">Absent</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-2xl font-bold text-blue-700">{selectedEmployeeStats.leave}</p>
              <p className="text-xs text-blue-600">On Leave</p>
            </div>
          </div>
        </div>
      )}

      {/* Calendar Grid */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        {/* Day Headers */}
        <div className="grid grid-cols-7 gap-2 mb-2">
          {dayNames.map(day => (
            <div key={day} className="text-center text-sm font-medium text-slate-600 py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7 gap-2">
          {days.map((date, idx) => {
            if (!date) {
              return <div key={idx} className="aspect-square"></div>;
            }

            const isCurrentDay = isToday(date);

            return (
              <div
                key={idx}
                className={`aspect-square border rounded-lg p-2 ${
                  isCurrentDay ? 'border-indigo-500 border-2' : 'border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm font-medium ${
                    isCurrentDay ? 'text-indigo-600' : 'text-slate-700'
                  }`}>
                    {date.getDate()}
                  </span>
                </div>

                {/* Employee Attendance Dots */}
                {!selectedEmployee && (
                  <div className="space-y-0.5">
                    {filteredEmployees.slice(0, 5).map(emp => {
                      const status = getAttendanceStatus(emp.id, date);
                      return (
                        <div
                          key={emp.id}
                          className={`h-1.5 rounded-full ${getStatusColor(status)}`}
                          title={`${emp.fullName}: ${getStatusLabel(status)}`}
                        ></div>
                      );
                    })}
                    {filteredEmployees.length > 5 && (
                      <p className="text-xs text-slate-400 text-center">
                        +{filteredEmployees.length - 5}
                      </p>
                    )}
                  </div>
                )}

                {/* Single Employee Status */}
                {selectedEmployee && (
                  <div className="flex items-center justify-center h-full">
                    <div
                      className={`w-full h-full rounded ${getStatusColor(getAttendanceStatus(selectedEmployee, date))}`}
                      title={getStatusLabel(getAttendanceStatus(selectedEmployee, date))}
                    ></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="font-semibold text-slate-800 mb-3">Legend</h3>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-emerald-500 rounded"></div>
            <span className="text-sm text-slate-600">Present</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-amber-500 rounded"></div>
            <span className="text-sm text-slate-600">Late</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 rounded"></div>
            <span className="text-sm text-slate-600">Absent</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 rounded"></div>
            <span className="text-sm text-slate-600">On Leave</span>
          </div>
        </div>
      </div>
    </div>
  );
}
