import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { User, Calendar, Clock, FileText, DollarSign, Bell, CheckCircle, AlertCircle } from 'lucide-react';
import ClockCapture, { ClockProof } from '../components/ClockCapture';
import { minutesLate } from '../lib/payrollEngine';
import { punchRejection } from '../lib/officeLocation';
import { EmployeeDocument, ReimbursementClaim } from '../types';

const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;

type QueuedStaffFile = {
  key: string;
  fileName: string;
  fileSize: number;
  dataUrl: string;
  documentTypeName: string;
};

function readStaffFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

export default function EmployeeSelfServicePage() {
  const { user } = useAuth();
  const { employees, departments, positions, leaveRequests, payrollRecords, payrollItems, leaveTypes, payrollPeriods, attendance, setAttendance, shifts, tasks, setTasks, documents, setDocuments, documentTypes, officeLocation, reimbursements, setReimbursements, employeeLoans, companyAssets, addToast, addAuditLog } = useApp();
  const [activeTab, setActiveTab] = useState<'overview' | 'leave' | 'attendance' | 'payslips' | 'tasks' | 'documents' | 'reimbursements'>('overview');
  const [openSlip, setOpenSlip] = useState<string | null>(null);
  const [punchMode, setPunchMode] = useState<'in' | 'out' | null>(null);
  const [claimForm, setClaimForm] = useState({ claimDate: '', category: 'TRANSPORT' as ReimbursementClaim['category'], amount: '', description: '', receiptFileName: '', receiptFileSize: 0, receiptDataUrl: '' });
  const [documentQueue, setDocumentQueue] = useState<QueuedStaffFile[]>([]);
  const [skippedDocumentNames, setSkippedDocumentNames] = useState<string[]>([]);
  const [documentSaveSummary, setDocumentSaveSummary] = useState('');

  const employee = employees.find(person => person.id === user?.employeeId) || employees.find(person => person.email === user?.email);
  const currentEmployeeId = employee?.id || '';
  const department = employee ? departments.find(d => d.id === employee.departmentId) : null;
  const position = employee ? positions.find(p => p.id === employee.positionId) : null;

  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const todayRow = attendance.find(row => row.employeeId === currentEmployeeId && row.attendanceDate === today);
  const myTasks = tasks.filter(task => task.assigneeId === currentEmployeeId);
  const myDocuments = documents.filter(doc => doc.employeeId === currentEmployeeId);
  const myAssets = companyAssets.filter(asset => asset.holderId === currentEmployeeId);

  const savePunch = (captured: ClockProof) => {
    if (!employee || !punchMode) return;
    const rejected = punchRejection(captured.photo, captured.latitude, captured.longitude, officeLocation);
    if (rejected) {
      addToast(rejected, 'error');
      return;
    }
    const stamp = new Date();
    const timeStr = `${String(stamp.getHours()).padStart(2, '0')}:${String(stamp.getMinutes()).padStart(2, '0')}`;
    const shift = shifts.find(row => row.id === (todayRow?.shiftId || 's4')) || shifts[0];
    const late = punchMode === 'in' && shift && !shift.crossesMidnight ? minutesLate(timeStr, shift.startTime) : todayRow?.lateMinutes || 0;
    setAttendance(prev => {
      const existing = prev.find(row => row.employeeId === employee.id && row.attendanceDate === today);
      if (!existing) {
        return [...prev, {
          id: `att${Date.now()}`,
          employeeId: employee.id,
          attendanceDate: today,
          shiftId: shift?.id || 's4',
          clockIn: timeStr,
          status: late > 0 ? 'LATE' as const : 'PRESENT' as const,
          lateMinutes: late,
          clockInPhoto: captured.photo,
          clockInLat: captured.latitude,
          clockInLng: captured.longitude,
          clockInAccuracy: captured.accuracy,
        }];
      }
      return prev.map(row => {
        if (row.id !== existing.id) return row;
        if (punchMode === 'out') return { ...row, clockOut: timeStr, clockOutPhoto: captured.photo, clockOutLat: captured.latitude, clockOutLng: captured.longitude, clockOutAccuracy: captured.accuracy };
        return { ...row, clockIn: timeStr, lateMinutes: late, status: late > 0 ? 'LATE' as const : 'PRESENT' as const, clockInPhoto: captured.photo, clockInLat: captured.latitude, clockInLng: captured.longitude, clockInAccuracy: captured.accuracy };
      });
    });
    addToast(`Clocked ${punchMode === 'in' ? 'in' : 'out'} at ${timeStr}.`, 'success');
    setPunchMode(null);
  };

  const activeDocumentTypes = documentTypes.filter(type => type.active);

  const queueOwnFiles = async (fileList: FileList | null) => {
    if (!employee) {
      addToast('This login is not linked to an employee record.', 'error');
      return;
    }
    if (!fileList?.length) return;
    if (activeDocumentTypes.length === 0) {
      addToast('No document type is available for upload.', 'error');
      return;
    }
    const skipped: string[] = [];
    const accepted: File[] = [];
    Array.from(fileList).forEach(file => {
      if (file.size > MAX_DOCUMENT_BYTES) skipped.push(file.name);
      else accepted.push(file);
    });
    if (skipped.length) {
      setSkippedDocumentNames(prev => [...prev, ...skipped]);
      addToast(`${skipped.length} file${skipped.length === 1 ? '' : 's'} over 8 MB skipped: ${skipped.join(', ')}`, 'warning');
    }
    const fallback = activeDocumentTypes[0].name;
    const stamp = Date.now();
    const reads = await Promise.all(accepted.map(async (file, index) => ({
      key: `${stamp}-${index}-${file.name}`,
      fileName: file.name,
      fileSize: file.size,
      dataUrl: await readStaffFile(file),
      documentTypeName: fallback,
    })));
    setDocumentQueue(prev => [...prev, ...reads]);
    setDocumentSaveSummary('');
  };

  const saveOwnFiles = () => {
    if (!employee) {
      addToast('This login is not linked to an employee record.', 'error');
      return;
    }
    if (documentQueue.length === 0) {
      addToast(skippedDocumentNames.length ? 'No files under 8 MB to save.' : 'Choose at least one file.', 'error');
      return;
    }
    const activeNames = new Set(activeDocumentTypes.map(type => type.name));
    if (documentQueue.some(file => !activeNames.has(file.documentTypeName))) {
      addToast('Each file needs an active document type.', 'error');
      return;
    }
    const stamp = Date.now();
    const uploadedAt = new Date().toISOString();
    const created: EmployeeDocument[] = documentQueue.map((file, index) => ({
      id: `doc${stamp}-${index}`,
      employeeId: employee.id,
      documentTypeName: file.documentTypeName,
      fileName: file.fileName,
      fileSize: file.fileSize,
      dataUrl: file.dataUrl,
      verificationStatus: 'PENDING',
      uploadedAt,
    }));
    setDocuments(prev => [...created, ...prev]);
    addAuditLog('UPLOAD', 'Document', created[0].id, `${created.length} files uploaded by ${employee.fullName}`);
    const skipNote = skippedDocumentNames.length
      ? ` ${skippedDocumentNames.length} file${skippedDocumentNames.length === 1 ? '' : 's'} over 8 MB ${skippedDocumentNames.length === 1 ? 'was' : 'were'} not saved: ${skippedDocumentNames.join(', ')}.`
      : '';
    const summary = `Saved ${created.length} file${created.length === 1 ? '' : 's'} to your documents.${skipNote}`;
    setDocumentSaveSummary(summary);
    addToast(summary, 'success');
    setDocumentQueue([]);
    setSkippedDocumentNames([]);
  };

  const myClaims = reimbursements.filter(row => row.employeeId === currentEmployeeId);
  const myLoans = employeeLoans.filter(row => row.employeeId === currentEmployeeId);
  const myLoanBalance = myLoans.reduce((sum, row) => sum + row.remainingBalance, 0);

  const readClaimReceipt = (file: File) => {
    if (file.size > 8 * 1024 * 1024) {
      addToast('Keep the receipt under 8 MB.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setClaimForm(prev => ({ ...prev, receiptFileName: file.name, receiptFileSize: file.size, receiptDataUrl: String(reader.result || '') }));
    reader.readAsDataURL(file);
  };

  const submitOwnClaim = () => {
    if (!employee) {
      addToast('This login is not linked to an employee record.', 'error');
      return;
    }
    const amount = Math.round(Number(claimForm.amount));
    if (!claimForm.claimDate || !claimForm.description.trim() || !Number.isFinite(amount) || amount <= 0) {
      addToast('Date, description, and an amount greater than 0 are required.', 'error');
      return;
    }
    const claim: ReimbursementClaim = {
      id: `rb${Date.now()}`,
      employeeId: employee.id,
      claimDate: claimForm.claimDate,
      category: claimForm.category,
      amount,
      description: claimForm.description.trim(),
      receiptFileName: claimForm.receiptFileName || undefined,
      receiptFileSize: claimForm.receiptFileSize || undefined,
      receiptDataUrl: claimForm.receiptDataUrl || undefined,
      status: 'SUBMITTED',
      submittedByName: employee.fullName,
      submittedAt: new Date().toISOString(),
    };
    setReimbursements(prev => [claim, ...prev]);
    addAuditLog('CREATE', 'Reimbursement', claim.id, `${claim.category} ${amount} submitted by ${employee.fullName}`);
    addToast('Claim submitted. Finance or the Director will review it.', 'success');
    setClaimForm({ claimDate: '', category: 'TRANSPORT', amount: '', description: '', receiptFileName: '', receiptFileSize: 0, receiptDataUrl: '' });
  };

  const myLeaveRequests = leaveRequests.filter(lr => lr.employeeId === currentEmployeeId);
  const myAttendance = attendance.filter(row => row.employeeId === currentEmployeeId);
  const myPayrollRecords = payrollRecords.filter(pr => {
    if (pr.employeeId !== currentEmployeeId) return false;
    const period = payrollPeriods.find(row => row.id === pr.payrollPeriodId);
    return period?.status === 'FINALIZED' || period?.status === 'LOCKED';
  });

  const getLeaveTypeName = (leaveTypeId: string) => {
    const leaveType = leaveTypes.find(lt => lt.id === leaveTypeId);
    return leaveType?.name || 'Leave';
  };

  const getPayrollPeriod = (payrollPeriodId: string) => {
    return payrollPeriods.find(pp => pp.id === payrollPeriodId);
  };

  const attendanceStats = {
    present: myAttendance.filter(row => row.status === 'PRESENT').length,
    late: myAttendance.filter(row => row.status === 'LATE').length,
    absent: myAttendance.filter(row => row.status === 'ABSENT').length,
    leave: myAttendance.filter(row => row.status === 'ON_LEAVE').length,
    totalDays: myAttendance.length,
  };

  const annualUsed = myLeaveRequests
    .filter(row => row.status === 'APPROVED' && leaveTypes.find(type => type.id === row.leaveTypeId)?.code === 'AL')
    .reduce((sum, row) => sum + row.totalDays, 0);
  const leaveBalance = {
    annual: { total: 12, used: annualUsed, remaining: Math.max(0, 12 - annualUsed) },
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
            <h1 className="text-2xl font-bold">Welcome back, {employee?.preferredName || employee?.fullName || user?.fullName}!</h1>
            <p className="text-indigo-100">{position?.title} • {department?.name}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium text-slate-800">Today’s punch</p>
          <p className="text-sm text-slate-500">{todayRow?.clockIn ? `In ${todayRow.clockIn}` : 'Not clocked in'}{todayRow?.clockOut ? ` · Out ${todayRow.clockOut}` : ''}</p>
          {todayRow?.clockInLat != null && <p className="text-xs text-slate-400">In at {todayRow.clockInLat.toFixed(5)}, {todayRow.clockInLng?.toFixed(5)}</p>}
        </div>
        <div className="flex gap-2">
          {!todayRow?.clockIn && <button onClick={() => setPunchMode('in')} className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm">Clock in</button>}
          {todayRow?.clockIn && !todayRow.clockOut && <button onClick={() => setPunchMode('out')} className="px-3 py-2 bg-amber-600 text-white rounded-lg text-sm">Clock out</button>}
        </div>
      </div>
      {punchMode && <ClockCapture title={punchMode === 'in' ? 'Clock in' : 'Clock out'} onCancel={() => setPunchMode(null)} onConfirm={savePunch} />}

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
        <div className="border-b border-slate-200 overflow-x-auto">
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
            <button onClick={() => setActiveTab('tasks')} className={`px-6 py-3 text-sm font-medium ${activeTab === 'tasks' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-600'}`}>Tasks</button>
            <button onClick={() => setActiveTab('documents')} className={`px-6 py-3 text-sm font-medium whitespace-nowrap ${activeTab === 'documents' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-600'}`}>Documents</button>
            <button onClick={() => setActiveTab('reimbursements')} className={`px-6 py-3 text-sm font-medium whitespace-nowrap ${activeTab === 'reimbursements' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-600'}`}>Reimbursements</button>
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
                    <p className="text-sm font-medium text-slate-700">Late arrivals</p>
                    <p className="text-2xl font-bold text-slate-800 mt-2">{attendanceStats.late}</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-4">
                    <p className="text-sm font-medium text-slate-700">Unpaid leave days</p>
                    <p className="text-2xl font-bold text-slate-800 mt-2">{myLeaveRequests.filter(row => row.status === 'APPROVED' && leaveTypes.find(type => type.id === row.leaveTypeId)?.isPaid === false).reduce((sum, row) => sum + row.totalDays, 0)}</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-slate-800 mb-4">Company assets with me</h3>
                {myAssets.length === 0 ? (
                  <p className="text-sm text-slate-500">No company assets are currently issued to you.</p>
                ) : (
                  <div className="space-y-2">
                    {myAssets.map(asset => (
                      <div key={asset.id} className="p-3 bg-slate-50 rounded-lg">
                        <p className="text-sm font-medium text-slate-700">{asset.name}</p>
                        <p className="text-xs text-slate-500">{asset.code} · {asset.category === 'LAPTOP' ? 'Laptop' : asset.category === 'PHONE' ? 'Phone' : asset.category === 'UNIFORM' ? 'Uniform' : asset.category === 'KEYS' ? 'Keys' : 'Other'} · issued {asset.issuedOn} · {asset.conditionOnIssue}</p>
                      </div>
                    ))}
                  </div>
                )}
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
                    {attendanceStats.totalDays === 0 ? 0 : Math.round((attendanceStats.present / attendanceStats.totalDays) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-3">
                  <div
                    className="bg-indigo-600 h-3 rounded-full"
                    style={{ width: `${attendanceStats.totalDays === 0 ? 0 : (attendanceStats.present / attendanceStats.totalDays) * 100}%` }}
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
                  <p>No payslip yet. It appears here after payroll for your month is finalized.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {myPayrollRecords.map(record => {
                    const period = getPayrollPeriod(record.payrollPeriodId);
                    const lines = payrollItems.filter(item => item.payrollRecordId === record.id);
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
                        <button onClick={() => setOpenSlip(openSlip === record.id ? null : record.id)} className="w-full px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors">
                          {openSlip === record.id ? 'Hide slip' : 'View slip'}
                        </button>
                        {openSlip === record.id && (
                          <div className="mt-3 space-y-1 text-sm">
                            {lines.map(line => (
                              <div key={line.id} className="flex justify-between">
                                <span className="text-slate-600">{line.componentName}</span>
                                <span className={line.category === 'DEDUCTION' ? 'text-red-600' : 'text-slate-800'}>{formatCurrency(line.amount)}</span>
                              </div>
                            ))}
                            <div className="flex justify-between font-medium pt-2 border-t border-slate-200">
                              <span>Net pay</span>
                              <span>{formatCurrency(record.netPay)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'tasks' && (
            <div className="space-y-3">
              <h3 className="font-semibold text-slate-800">Assigned to me</h3>
              {myTasks.length === 0 && <p className="text-sm text-slate-500">No tasks from your manager yet.</p>}
              {myTasks.map(task => (
                <div key={task.id} className="border border-slate-200 rounded-lg p-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-800">{task.title}</p>
                    <p className="text-sm text-slate-500">{task.detail} · due {task.dueDate} · from {task.assignerName}</p>
                  </div>
                  <div className="flex gap-2">
                    {task.status === 'OPEN' && <button onClick={() => setTasks(prev => prev.map(row => row.id === task.id ? { ...row, status: 'IN_PROGRESS' } : row))} className="px-2 py-1 text-xs bg-amber-50 text-amber-800 rounded">Start</button>}
                    {task.status !== 'DONE' && <button onClick={() => setTasks(prev => prev.map(row => row.id === task.id ? { ...row, status: 'DONE', completedAt: new Date().toISOString() } : row))} className="px-2 py-1 text-xs bg-emerald-50 text-emerald-800 rounded">Mark done</button>}
                    {task.status === 'DONE' && <span className="text-xs text-emerald-700">Done</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-slate-800">My documents</h3>
                <p className="text-sm text-slate-500 mt-1">
                  {employee
                    ? `Files are saved on your record (${employee.fullName}). Choose several files, set a type on each, then save them together.`
                    : 'This login is not linked to an employee record.'}
                </p>
              </div>
              <input
                id="staff-document-files"
                type="file"
                multiple
                accept="application/pdf,image/*"
                onChange={event => {
                  void queueOwnFiles(event.target.files);
                  event.target.value = '';
                }}
                className="text-sm"
              />
              {skippedDocumentNames.length > 0 && (
                <p className="text-sm text-amber-700">Over 8 MB, not included: {skippedDocumentNames.join(', ')}</p>
              )}
              {documentQueue.length > 0 && (
                <div className="space-y-2">
                  {documentQueue.map((file, index) => (
                    <div key={file.key} className="flex flex-wrap items-center gap-2 border border-slate-200 rounded-lg p-3">
                      <p className="text-sm text-slate-800 flex-1 min-w-[160px]">{file.fileName}</p>
                      <select
                        id={`staff-file-type-${index}`}
                        aria-label={`Type for ${file.fileName}`}
                        value={file.documentTypeName}
                        onChange={event => setDocumentQueue(prev => prev.map(row => row.key === file.key ? { ...row, documentTypeName: event.target.value } : row))}
                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      >
                        {activeDocumentTypes.map(type => <option key={type.id} value={type.name}>{type.name}</option>)}
                      </select>
                      <button onClick={() => setDocumentQueue(prev => prev.filter(row => row.key !== file.key))} className="text-xs text-slate-500">Remove</button>
                    </div>
                  ))}
                </div>
              )}
              <button id="save-staff-documents" onClick={saveOwnFiles} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium">
                Save {documentQueue.length} file{documentQueue.length === 1 ? '' : 's'}
              </button>
              {documentSaveSummary && <p role="status" className="text-sm font-medium text-emerald-700">{documentSaveSummary}</p>}
              {activeDocumentTypes.map(type => {
                const files = myDocuments.filter(doc => doc.documentTypeName === type.name);
                return (
                  <div key={type.id} className="border border-slate-200 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-slate-800">{type.name}</p>
                      {files.length === 0 ? <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800">Missing</span> : <span className="text-xs text-slate-500">{files.length} file{files.length === 1 ? '' : 's'}</span>}
                    </div>
                    {files.map(doc => (
                      <div key={doc.id} className="flex justify-between gap-3 text-sm">
                        <div>
                          <p className="text-slate-800">{doc.fileName}</p>
                          <p className="text-xs text-slate-500">{doc.verificationStatus}</p>
                        </div>
                        {doc.dataUrl && <a href={doc.dataUrl} download={doc.fileName} className="text-indigo-700">Download</a>}
                      </div>
                    ))}
                  </div>
                );
              })}
              {myDocuments.filter(doc => !activeDocumentTypes.some(type => type.name === doc.documentTypeName)).map(doc => (
                <div key={doc.id} className="border border-slate-200 rounded-lg p-3 flex justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-800">{doc.fileName}</p>
                    <p className="text-xs text-slate-500">{doc.documentTypeName} · {doc.verificationStatus}</p>
                  </div>
                  {doc.dataUrl && <a href={doc.dataUrl} download={doc.fileName} className="text-sm text-indigo-700">Download</a>}
                </div>
              ))}
            </div>
          )}

          {activeTab === 'reimbursements' && (
            <div className="space-y-6">
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-sm font-medium text-slate-700">My loan balance</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{formatCurrency(myLoanBalance)}</p>
                {myLoans.length === 0 && <p className="text-sm text-slate-500 mt-1">You have no employee loan. HR or Finance records one if you need an advance.</p>}
                {myLoans.map(loan => (
                  <p key={loan.id} className="text-sm text-slate-600 mt-2">{loan.purpose || 'Loan'} · installment {formatCurrency(loan.monthlyInstallment)} · remaining {formatCurrency(loan.remainingBalance)} · {loan.status}</p>
                ))}
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 mb-3">Submit a claim</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input type="date" value={claimForm.claimDate} onChange={event => setClaimForm(prev => ({ ...prev, claimDate: event.target.value }))} className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                  <select value={claimForm.category} onChange={event => setClaimForm(prev => ({ ...prev, category: event.target.value as ReimbursementClaim['category'] }))} className="px-3 py-2 border border-slate-300 rounded-lg text-sm">
                    <option value="TRANSPORT">Transport</option>
                    <option value="MEDICAL">Medical</option>
                    <option value="OTHER">Other</option>
                  </select>
                  <input type="number" min="1" value={claimForm.amount} onChange={event => setClaimForm(prev => ({ ...prev, amount: event.target.value }))} placeholder="Amount (IDR)" className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                  <input type="file" accept="application/pdf,image/*" onChange={event => { const file = event.target.files?.[0]; if (file) readClaimReceipt(file); }} className="text-sm" />
                  <textarea value={claimForm.description} onChange={event => setClaimForm(prev => ({ ...prev, description: event.target.value }))} placeholder="Description" className="md:col-span-2 px-3 py-2 border border-slate-300 rounded-lg text-sm" rows={2} />
                  <button onClick={submitOwnClaim} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm w-fit">Submit claim</button>
                </div>
                {claimForm.receiptFileName && <p className="text-xs text-slate-500 mt-2">Receipt: {claimForm.receiptFileName}</p>}
              </div>
              <div className="space-y-3">
                <h3 className="font-semibold text-slate-800">My claims</h3>
                {myClaims.length === 0 && <p className="text-sm text-slate-500">No claims yet. Submit the first one above with a date, category, amount, and description. A receipt is optional.</p>}
                {myClaims.map(claim => (
                  <div key={claim.id} className="border border-slate-200 rounded-lg p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-800">{claim.category === 'TRANSPORT' ? 'Transport' : claim.category === 'MEDICAL' ? 'Medical' : 'Other'} · {formatCurrency(claim.amount)}</p>
                        <p className="text-sm text-slate-500">{claim.claimDate} · {claim.description}</p>
                        {claim.rejectionNote && <p className="text-sm text-red-600 mt-1">Rejection note: {claim.rejectionNote}</p>}
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(claim.status === 'SUBMITTED' ? 'pending' : claim.status === 'PAID' ? 'approved' : claim.status)}`}>{claim.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
