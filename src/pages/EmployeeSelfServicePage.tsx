import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { User, Calendar, Clock, FileText, DollarSign, Bell, CheckCircle, AlertCircle, Download, Printer } from 'lucide-react';
import ClockCapture, { ClockProof } from '../components/ClockCapture';
import PayslipSheet from '../components/PayslipSheet';
import ServiceChargeSlip from '../components/ServiceChargeSlip';
import {
  attendanceApi,
  documentsApi,
  employeeDocumentFileUrl,
  employeePhotoUrl,
  isApiAvailable,
  mapEmployeeDocument,
  mapPunchMine,
} from '../services/api';
import type { Employee, PunchMine } from '../types';
import { EmployeeDocument, ReimbursementClaim } from '../types';
import { ProfileEditor } from '../components/ProfileEditor';

const PAYROLL_SLIP_STATUSES = new Set(['CALCULATED', 'UNDER_REVIEW', 'APPROVED', 'FINALIZED', 'LOCKED']);

function resolveEssEmployee(
  user: { employeeId?: string; email?: string; role?: string } | null | undefined,
  people: Employee[],
): Employee | undefined {
  if (!user) return undefined;
  if (user.employeeId) {
    const byId = people.find((person) => person.id === user.employeeId);
    if (byId) return byId;
  }
  if (user.email) {
    const email = user.email.toLowerCase();
    const byEmail = people.find((person) => person.email?.toLowerCase() === email);
    if (byEmail) return byEmail;
  }
  // Wolf preview / unlinked employee workspace — bind to first active roster member.
  if (user.role === 'EMPLOYEE' && /preview@|employee\.preview/i.test(user.email || '')) {
    return people.find((person) => person.employmentStatus === 'ACTIVE') || people[0];
  }
  if (user.role === 'EMPLOYEE' && people.length === 1) return people[0];
  return undefined;
}

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
  const { employees, departments, positions, leaveRequests, payrollRecords, payrollItems, leaveTypes, payrollPeriods, attendance, setAttendance, tasks, setTasks, documents, setDocuments, documentTypes, reimbursements, setReimbursements, employeeLoans, companyAssets, terTables, serviceChargeSlips, addToast, addAuditLog } = useApp();
  const [activeTab, setActiveTab] = useState<'overview' | 'leave' | 'attendance' | 'payslips' | 'tasks' | 'documents' | 'reimbursements'>('overview');
  const [openSlip, setOpenSlip] = useState<string | null>(null);
  const [punchMode, setPunchMode] = useState<'in' | 'out' | null>(null);
  const [mine, setMine] = useState<PunchMine | null | undefined>(undefined);
  const [mineError, setMineError] = useState('');
  const [claimForm, setClaimForm] = useState({ claimDate: '', category: 'TRANSPORT' as ReimbursementClaim['category'], amount: '', description: '', receiptFileName: '', receiptFileSize: 0, receiptDataUrl: '' });
  const [documentQueue, setDocumentQueue] = useState<QueuedStaffFile[]>([]);
  const [skippedDocumentNames, setSkippedDocumentNames] = useState<string[]>([]);
  const [documentSaveSummary, setDocumentSaveSummary] = useState('');

  const employee = resolveEssEmployee(user, employees);
  const currentEmployeeId = employee?.id || '';
  const department = employee ? departments.find(d => d.id === employee.departmentId) : null;
  const position = employee ? positions.find(p => p.id === employee.positionId) : null;

  useEffect(() => {
    let cancelled = false;
    attendanceApi.mine().then((row) => {
      if (!cancelled) setMine(mapPunchMine(row));
    }).catch((error: unknown) => {
      if (!cancelled) {
        setMine(null);
        setMineError(error instanceof Error ? error.message : 'Punch is not available for this session.');
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const myTasks = tasks.filter(task => task.assigneeId === currentEmployeeId);
  const myDocuments = documents.filter(doc => doc.employeeId === currentEmployeeId);
  const myAssets = companyAssets.filter(asset => asset.holderId === currentEmployeeId);

  const savePunch = async (captured: ClockProof) => {
    try {
      const saved = await attendanceApi.punch({
        photo: captured.photo,
        latitude: captured.latitude,
        longitude: captured.longitude,
        accuracy: captured.accuracy,
        idempotency_key: crypto.randomUUID(),
      });
      const fresh = mapPunchMine(await attendanceApi.mine());
      setMine(fresh);
      if (fresh.day) {
        const day = fresh.day;
        setAttendance((prev) => [...prev.filter((row) => !(row.employeeId === day.employeeId && row.attendanceDate === day.attendanceDate)), day]);
      }
      addToast(saved.message || 'Punch recorded.', saved.outcome === 'kept' ? 'warning' : 'success');
      setPunchMode(null);
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'The punch was not recorded.', 'error');
    }
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

  useEffect(() => {
    if (!employee?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await documentsApi.listSelf();
        if (cancelled) return;
        const mapped = rows.map(mapEmployeeDocument);
        setDocuments((prev) => [...mapped, ...prev.filter((doc) => doc.employeeId !== employee.id || !mapped.some((row) => row.id === doc.id))]);
      } catch {
        // Keep any in-session documents when the API is offline.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [employee?.id, setDocuments]);

  const saveOwnFiles = async () => {
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
    const skipNote = skippedDocumentNames.length
      ? ` ${skippedDocumentNames.length} file${skippedDocumentNames.length === 1 ? '' : 's'} over 8 MB ${skippedDocumentNames.length === 1 ? 'was' : 'were'} not saved: ${skippedDocumentNames.join(', ')}.`
      : '';
    const embedded = typeof window !== 'undefined' && window.__WOLF_HR_EMBEDDED__ === true;
    try {
      if (isApiAvailable() || embedded) {
        const saved = await documentsApi.uploadSelf(documentQueue.map((file) => ({
          document_type_name: file.documentTypeName,
          file_name: file.fileName,
          file: file.dataUrl,
        })));
        const created = (saved.documents || []).map(mapEmployeeDocument);
        setDocuments((prev) => [...created, ...prev.filter((doc) => !created.some((row) => row.id === doc.id))]);
        addAuditLog('UPLOAD', 'Document', created[0]?.id || employee.id, `${created.length} files uploaded by ${employee.fullName}`);
        const summary = `Saved ${created.length} file${created.length === 1 ? '' : 's'} to your documents.${skipNote}`;
        setDocumentSaveSummary(summary);
        addToast(summary, 'success');
        setDocumentQueue([]);
        setSkippedDocumentNames([]);
        return;
      }
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'The documents were not saved.', 'error');
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
  const myPayrollRecords = currentEmployeeId
    ? payrollRecords.filter((pr) => {
        if (pr.employeeId !== currentEmployeeId) return false;
        const period = payrollPeriods.find((row) => row.id === pr.payrollPeriodId);
        if (period && PAYROLL_SLIP_STATUSES.has(period.status)) return true;
        // Show calculated lines even if period status lagged behind.
        return pr.status === 'CALCULATED' || pr.status === 'FINALIZED' || pr.status === 'APPROVED';
      })
    : [];
  const myServiceChargeSlips = currentEmployeeId
    ? serviceChargeSlips.filter(
        (slip) =>
          slip.employeeId === currentEmployeeId &&
          slip.net > 0 &&
          (slip.status === 'PUBLISHED' || slip.status === 'DRAFT'),
      )
    : [];
  const payslipCount = myPayrollRecords.length + myServiceChargeSlips.length;

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
          {employee?.hasProfilePhoto ? (
            <img src={`${employeePhotoUrl(employee.id)}?v=${encodeURIComponent(employee.updatedAt || '1')}`} alt="" className="w-16 h-16 rounded-full object-cover" />
          ) : (
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
              <User size={32} />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold">Welcome back, {employee?.preferredName || employee?.fullName || user?.fullName}!</h1>
            <p className="text-indigo-100">{position?.title} • {department?.name}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium text-slate-800">Today’s punch</p>
          <p className="text-sm text-slate-500">
            {mine?.day?.clockIn ? `In ${mine.day.clockIn}` : 'Not clocked in'}
            {mine?.day?.clockOut ? ` · Out ${mine.day.clockOut}` : ''}
            {mine?.day?.clockInSiteName ? ` · ${mine.day.clockInSiteName}` : ''}
          </p>
          {mine?.blockedReason && <p className="text-sm text-red-600">{mine.blockedReason}</p>}
          {mine === null && <p className="text-sm text-slate-500">{mineError || 'Punch is not available for this session.'}</p>}
        </div>
        <div className="flex gap-2">
          {mine?.next === 'in' && <button onClick={() => setPunchMode('in')} className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm">Clock in</button>}
          {mine?.next === 'out' && <button onClick={() => setPunchMode('out')} className="px-3 py-2 bg-amber-600 text-white rounded-lg text-sm">Clock out</button>}
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
              <p className="text-2xl font-bold text-slate-800">{payslipCount}</p>
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
              {user?.role === 'EMPLOYEE' && employee && (
                <ProfileEditor mode="request" employee={employee} departments={departments} positions={positions} notify={addToast} onSaved={() => undefined} />
              )}
              {user?.role === 'EMPLOYEE' && !employee && (
                <p className="text-sm text-slate-500">This login is not linked to an employee record.</p>
              )}
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
              <p className="text-sm text-slate-500">Monthly salary and service charge — view, print, or download as PDF.</p>

              {payslipCount === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <FileText size={48} className="mx-auto mb-3 opacity-50" />
                  <p>No payslip yet. Salary slips appear after payroll is calculated; service charge after it is generated.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {myPayrollRecords.map((record) => {
                    const period = getPayrollPeriod(record.payrollPeriodId);
                    const lines = payrollItems.filter((item) => item.payrollRecordId === record.id);
                    const slipKey = `payroll:${record.id}`;
                    return (
                      <div key={slipKey} className="border border-slate-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="font-medium text-slate-800">Salary · {period?.periodCode || 'Payroll'}</p>
                            <p className="text-sm text-slate-500">Pay date {period?.payDate || '—'}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-indigo-600">{formatCurrency(record.netPay)}</p>
                            <p className="text-xs text-slate-500">Take Home</p>
                          </div>
                        </div>
                        <SlipActions
                          open={openSlip === slipKey}
                          onToggle={() => setOpenSlip(openSlip === slipKey ? null : slipKey)}
                          onPrint={() => {
                            setOpenSlip(slipKey);
                            window.setTimeout(() => window.print(), 50);
                          }}
                        />
                        {openSlip === slipKey && (
                          <div className="mt-4 -mx-1">
                            <PayslipSheet
                              record={record}
                              items={lines}
                              employee={employee}
                              department={department}
                              position={position}
                              period={period}
                              terTables={terTables}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {myServiceChargeSlips.map((slip) => {
                    const slipKey = `sc:${slip.id}`;
                    const monthLabel = new Date(slip.year, slip.month - 1, 1).toLocaleDateString('en-GB', {
                      month: 'long',
                      year: 'numeric',
                    });
                    return (
                      <div key={slipKey} className="border border-slate-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="font-medium text-slate-800">Service charge · {monthLabel}</p>
                            <p className="text-sm text-slate-500">
                              Pay date {slip.payDate || '—'}
                              {slip.status === 'DRAFT' ? ' · draft' : ''}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-indigo-600">{formatCurrency(slip.net)}</p>
                            <p className="text-xs text-slate-500">Take Home</p>
                          </div>
                        </div>
                        <SlipActions
                          open={openSlip === slipKey}
                          onToggle={() => setOpenSlip(openSlip === slipKey ? null : slipKey)}
                          onPrint={() => {
                            setOpenSlip(slipKey);
                            window.setTimeout(() => window.print(), 50);
                          }}
                        />
                        {openSlip === slipKey && (
                          <div className="mt-4 -mx-1">
                            <ServiceChargeSlip
                              slip={slip}
                              employee={employee}
                              department={department}
                              position={position}
                            />
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
                    {(task.status === 'OPEN' || task.status === 'ASSIGNED' || task.status === 'ACCEPTED') && <button onClick={() => setTasks(prev => prev.map(row => row.id === task.id ? { ...row, status: 'IN_PROGRESS' } : row))} className="px-2 py-1 text-xs bg-amber-50 text-amber-800 rounded">Start</button>}
                    {task.status !== 'DONE' && task.status !== 'COMPLETED' && <button onClick={() => setTasks(prev => prev.map(row => row.id === task.id ? { ...row, status: row.externalId ? 'COMPLETED' : 'DONE', completedAt: new Date().toISOString() } : row))} className="px-2 py-1 text-xs bg-emerald-50 text-emerald-800 rounded">Mark done</button>}
                    {(task.status === 'DONE' || task.status === 'COMPLETED') && <span className="text-xs text-emerald-700">{task.status === 'COMPLETED' ? 'COMPLETED' : 'Done'}</span>}
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
                    {files.map(doc => {
                      const href = doc.dataUrl || employeeDocumentFileUrl(doc.id, true);
                      return (
                      <div key={doc.id} className="flex justify-between gap-3 text-sm">
                        <div>
                          <p className="text-slate-800">{doc.fileName}</p>
                          <p className="text-xs text-slate-500">{doc.verificationStatus}</p>
                        </div>
                        <a href={href} target="_blank" rel="noreferrer" className="text-indigo-700">Download</a>
                      </div>
                      );
                    })}
                  </div>
                );
              })}
              {myDocuments.filter(doc => !activeDocumentTypes.some(type => type.name === doc.documentTypeName)).map(doc => {
                const href = doc.dataUrl || employeeDocumentFileUrl(doc.id, true);
                return (
                <div key={doc.id} className="border border-slate-200 rounded-lg p-3 flex justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-800">{doc.fileName}</p>
                    <p className="text-xs text-slate-500">{doc.documentTypeName} · {doc.verificationStatus}</p>
                  </div>
                  <a href={href} target="_blank" rel="noreferrer" className="text-sm text-indigo-700">Download</a>
                </div>
                );
              })}
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

function SlipActions({
  open,
  onToggle,
  onPrint,
}: {
  open: boolean;
  onToggle: () => void;
  onPrint: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 payslip-print">
      <button
        type="button"
        onClick={onToggle}
        className="flex-1 min-w-[120px] px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
      >
        {open ? 'Hide slip' : 'View slip'}
      </button>
      <button
        type="button"
        onClick={onPrint}
        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50"
      >
        <Printer size={14} /> Print
      </button>
      <button
        type="button"
        onClick={onPrint}
        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
        title="Save as PDF from the print dialog"
      >
        <Download size={14} /> Download PDF
      </button>
    </div>
  );
}
