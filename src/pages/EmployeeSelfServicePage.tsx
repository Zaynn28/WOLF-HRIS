import { useState } from 'react';
import { employees, departments, positions, leaveRequests, payrollRecords, leaveTypes, payrollPeriods } from '../data/mockData';
import { User, Calendar, Clock, FileText, DollarSign, Bell, CheckCircle, AlertCircle } from 'lucide-react';

export default function EmployeeSelfServicePage() {
  // In a real app, this would be the logged-in employee
  const [currentEmployeeId] = useState('e1');
  const [activeTab, setActiveTab] = useState<'overview' | 'leave' | 'attendance' | 'payslips'>('overview');

  const employee = employees.find(e => e.id === currentEmployeeId);
  const department = employee ? departments.find(d => d.id === employee.departmentId) : null;
  const position = employee ? positions.find(p => p.id === employee.positionId) : null;

  // Mock data for this employee
  const myLeaveRequests = leaveRequests.filter(lr => lr.employeeId === currentEmployeeId);
  const myPayrollRecords = payrollRecords.filter(pr => pr.employeeId === currentEmployeeId);
  
  // Helper to get leave type name
  const getLeaveTypeName = (leaveTypeId: string) => {
    const leaveType = leaveTypes.find(lt => lt.id === leaveTypeId);
    return leaveType?.name || 'Leave';
  };
  
  // Helper to get payroll period info
  const getPayrollPeriod = (payrollPeriodId: string) => {
    return payrollPeriods.find(pp => pp.id === payrollPeriodId);
  };

  // Mock attendance data
  const attendanceStats = {
    present: 18,
    late: 2,
    absent: 1,
    leave: 3,
    totalDays: 24,
  };

  // Mock leave balance
  const leaveBalance = {
    annual: { total: 12, used: 3, remaining: 9 },
    sick: { total: 10, used: 1, remaining: 9 },
    personal: { total: 5, used: 0, remaining: 5 },
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved': return 'bg-emerald-100 text-emerald-700';
      case 'pending': return 'bg-amber-100 text-amber-700';
      case 'rejected': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-xl p-6 text-white">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
            <User size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Welcome back, {employee?.preferredName || employee?.fullName}!</h1>
            <p className="text-indigo-100">{position?.title} • {department?.name}</p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <CheckCircle size={20} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{attendanceStats.present}</p>
              <p className="text-xs text-slate-500">Days Present</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Calendar size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{leaveBalance.annual.remaining}</p>
              <p className="text-xs text-slate-500">Leave Days Left</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Clock size={20} className="text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{myLeaveRequests.filter(lr => lr.status === 'PENDING').length}</p>
              <p className="text-xs text-slate-500">Pending Requests</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
              <DollarSign size={20} className="text-indigo-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{myPayrollRecords.length}</p>
              <p className="text-xs text-slate-500">Payslips Available</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="border-b border-slate-200">
          <div className="flex">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === 'overview'
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('leave')}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === 'leave'
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              Leave Requests
            </button>
            <button
              onClick={() => setActiveTab('attendance')}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === 'attendance'
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              Attendance
            </button>
            <button
              onClick={() => setActiveTab('payslips')}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === 'payslips'
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              Payslips
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-slate-800 mb-4">Leave Balance</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-slate-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-700">Annual Leave</span>
                      <span className="text-xs text-slate-500">{leaveBalance.annual.used}/{leaveBalance.annual.total} used</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div
                        className="bg-indigo-600 h-2 rounded-full"
                        style={{ width: `${(leaveBalance.annual.used / leaveBalance.annual.total) * 100}%` }}
                      ></div>
                    </div>
                    <p className="text-sm text-slate-600 mt-2">{leaveBalance.annual.remaining} days remaining</p>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-700">Sick Leave</span>
                      <span className="text-xs text-slate-500">{leaveBalance.sick.used}/{leaveBalance.sick.total} used</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div
                        className="bg-indigo-600 h-2 rounded-full"
                        style={{ width: `${(leaveBalance.sick.used / leaveBalance.sick.total) * 100}%` }}
                      ></div>
                    </div>
                    <p className="text-sm text-slate-600 mt-2">{leaveBalance.sick.remaining} days remaining</p>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-700">Personal Leave</span>
                      <span className="text-xs text-slate-500">{leaveBalance.personal.used}/{leaveBalance.personal.total} used</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div
                        className="bg-indigo-600 h-2 rounded-full"
                        style={{ width: `${(leaveBalance.personal.used / leaveBalance.personal.total) * 100}%` }}
                      ></div>
                    </div>
                    <p className="text-sm text-slate-600 mt-2">{leaveBalance.personal.remaining} days remaining</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-slate-800 mb-4">Recent Activity</h3>
                <div className="space-y-3">
                  {myLeaveRequests.slice(0, 3).map(request => (
                    <div key={request.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Calendar size={20} className="text-slate-400" />
                        <div>
                          <p className="text-sm font-medium text-slate-700">{getLeaveTypeName(request.leaveTypeId)}</p>
                          <p className="text-xs text-slate-500">{request.startDate} - {request.endDate}</p>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                        {request.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Leave Requests Tab */}
          {activeTab === 'leave' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-slate-800">My Leave Requests</h3>
                <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
                  Request Leave
                </button>
              </div>

              {myLeaveRequests.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Calendar size={48} className="mx-auto mb-3 opacity-50" />
                  <p>No leave requests found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {myLeaveRequests.map(request => (
                    <div key={request.id} className="border border-slate-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-medium text-slate-800">{getLeaveTypeName(request.leaveTypeId)}</p>
                          <p className="text-sm text-slate-500">{request.startDate} - {request.endDate}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                          {request.status}
                        </span>
                      </div>
                      {request.reason && (
                        <p className="text-sm text-slate-600 mb-2">
                          <span className="font-medium">Reason:</span> {request.reason}
                        </p>
                      )}
                      {request.approvedBy && (
                        <p className="text-xs text-slate-500">
                          Approved by {request.approvedBy} on {request.approvedAt}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Attendance Tab */}
          {activeTab === 'attendance' && (
            <div className="space-y-6">
              <h3 className="font-semibold text-slate-800">This Month's Attendance</h3>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-emerald-50 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-emerald-700">{attendanceStats.present}</p>
                  <p className="text-sm text-emerald-600 mt-1">Present</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-amber-700">{attendanceStats.late}</p>
                  <p className="text-sm text-amber-600 mt-1">Late</p>
                </div>
                <div className="bg-red-50 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-red-700">{attendanceStats.absent}</p>
                  <p className="text-sm text-red-600 mt-1">Absent</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-blue-700">{attendanceStats.leave}</p>
                  <p className="text-sm text-blue-600 mt-1">On Leave</p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-700">Attendance Rate</span>
                  <span className="text-sm font-bold text-indigo-600">
                    {Math.round((attendanceStats.present / attendanceStats.totalDays) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-3">
                  <div
                    className="bg-indigo-600 h-3 rounded-full"
                    style={{ width: `${(attendanceStats.present / attendanceStats.totalDays) * 100}%` }}
                  ></div>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  {attendanceStats.present} out of {attendanceStats.totalDays} working days
                </p>
              </div>
            </div>
          )}

          {/* Payslips Tab */}
          {activeTab === 'payslips' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-800">My Payslips</h3>

              {myPayrollRecords.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <FileText size={48} className="mx-auto mb-3 opacity-50" />
                  <p>No payslips available</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {myPayrollRecords.map(record => {
                    const period = getPayrollPeriod(record.payrollPeriodId);
                    return (
                      <div key={record.id} className="border border-slate-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="font-medium text-slate-800">{period?.periodCode || 'Payroll'}</p>
                            <p className="text-sm text-slate-500">Paid on {period?.payDate || 'N/A'}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-indigo-600">{formatCurrency(record.netPay)}</p>
                            <p className="text-xs text-slate-500">Net Pay</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button className="flex-1 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors">
                            View Details
                          </button>
                          <button className="flex-1 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
                            Download PDF
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
