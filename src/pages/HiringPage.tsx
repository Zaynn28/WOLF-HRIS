import { useState } from 'react';
import { useApp } from '../context/AppContext';
import type { Applicant, ApplicantStatus, Employee } from '../types';
import BulkUploadButton from '../components/BulkUploadButton';
import { employeesApi, isApiAvailable, mapEmployeeRow } from '../services/api';
import { hireEmployeeCode, planSignedHire } from '../lib/hiring.js';

const emptyChecks = { ktp: false, npwp: false, bank: false, orientation: false };

const PIPELINE: ApplicantStatus[] = [
  'CV_SCREENING',
  'HR_INTERVIEW',
  'USHER_INTERVIEW',
  'OFFER_SENT',
  'OFFER_ACCEPTED',
  'SIGNED',
  'ONBOARDED',
];

const STAGE_LABEL: Record<string, string> = {
  CV_SCREENING: 'CV screening',
  HR_INTERVIEW: 'HR interview',
  USHER_INTERVIEW: 'Usher interview',
  OFFER_SENT: 'Offer sent',
  OFFER_ACCEPTED: 'Offer accepted',
  OFFER_REJECTED: 'Offer rejected',
  APPLIED: 'CV screening',
  OFFERED: 'Offer sent',
  REJECTED: 'Rejected',
  SIGNED: 'Signed',
  ONBOARDED: 'Onboarded',
};

const normalizeStatus = (status: ApplicantStatus): ApplicantStatus => {
  if (status === 'APPLIED') return 'CV_SCREENING';
  if (status === 'OFFERED') return 'OFFER_SENT';
  return status;
};

const formatCurrency = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

export default function HiringPage() {
  const { applicants, setApplicants, employees, setEmployees, setContracts, departments, positions, ptkpTables, addToast, addAuditLog } = useApp();
  const embedded = typeof window !== 'undefined' && window.__WOLF_HR_EMBEDDED__ === true;
  const [showAdd, setShowAdd] = useState(false);
  const [offerId, setOfferId] = useState<string | null>(null);
  const [candidate, setCandidate] = useState({ fullName: '', email: '', phone: '', departmentId: '', positionId: '' });
  const [offer, setOffer] = useState({
    basicSalary: '4500000',
    allowance: '500000',
    ptkpCode: 'TK/0',
    bpjsEnrolled: true,
    companyCoversEmployeeBpjs: false,
    taxConfiguration: 'netto' as 'netto' | 'gross',
    bankName: 'BCA',
    bankAccountNumber: '',
    contractType: 'PKWT' as 'PKWT' | 'PKWTT',
    startDate: '2026-10-01',
    endDate: '2027-09-30',
  });

  const deptName = (id: string) => departments.find(row => row.id === id)?.name || '-';
  const posName = (id: string) => positions.find(row => row.id === id)?.title || '-';

  const addApplicant = () => {
    if (!candidate.fullName || !candidate.email || !candidate.departmentId || !candidate.positionId) {
      addToast('Name, email, department, and position are required.', 'error');
      return;
    }
    const row: Applicant = {
      id: `ap${Date.now()}`,
      ...candidate,
      status: 'CV_SCREENING',
      checks: { ...emptyChecks },
    };
    setApplicants(prev => [row, ...prev]);
    addAuditLog('CREATE', 'Applicant', row.id, `${row.fullName} entered CV screening`);
    addToast(`${row.fullName} is in CV screening.`, 'success');
    setCandidate({ fullName: '', email: '', phone: '', departmentId: '', positionId: '' });
    setShowAdd(false);
  };

  const rejectApplicant = (id: string, reason: string) => {
    const row = applicants.find(item => item.id === id);
    setApplicants(prev => prev.map(item => item.id === id ? { ...item, status: 'REJECTED', rejectionReason: reason } : item));
    addAuditLog('REJECT', 'Applicant', id, `${row?.fullName} rejected`);
    addToast(`${row?.fullName} was rejected. No contract, no login, and no payroll record.`, 'warning');
  };

  const advanceStage = (id: string, next: ApplicantStatus, note?: string) => {
    const row = applicants.find(item => item.id === id);
    setApplicants(prev => prev.map(item => item.id === id ? { ...item, status: next, stageNote: note || item.stageNote } : item));
    addAuditLog('UPDATE', 'Applicant', id, `${row?.fullName} → ${STAGE_LABEL[next] || next}`);
    addToast(`${row?.fullName}: ${STAGE_LABEL[next] || next}`, 'success');
  };

  const saveOffer = () => {
    if (!offerId) return;
    const basic = Number(offer.basicSalary);
    const allowance = Number(offer.allowance);
    if (!basic || basic < 0 || !offer.bankAccountNumber || !offer.startDate) {
      addToast('Salary, bank account, and start date are required.', 'error');
      return;
    }
    setApplicants(prev => prev.map(item => item.id === offerId ? {
      ...item,
      status: 'OFFER_SENT',
      basicSalary: basic,
      allowance,
      ptkpCode: offer.ptkpCode,
      bpjsEnrolled: offer.bpjsEnrolled,
      companyCoversEmployeeBpjs: offer.companyCoversEmployeeBpjs,
      taxConfiguration: offer.taxConfiguration,
      bankName: offer.bankName,
      bankAccountNumber: offer.bankAccountNumber,
      bankAccountName: item.fullName,
      contractType: offer.contractType,
      startDate: offer.startDate,
      endDate: offer.contractType === 'PKWT' ? offer.endDate : undefined,
    } : item));
    addToast('Offer letter marked as sent. Track accept or reject next.', 'success');
    setOfferId(null);
  };

  const signContract = async (row: Applicant) => {
    if (!row.basicSalary || !row.startDate || !row.contractType) return;
    const companyPrefix = embedded
      ? (window.location.pathname.match(/\/hr\/(amg|bzg|ggv)(?:\/|$)/)?.[1] ?? 'hr').toUpperCase()
      : 'AMG';
    const sameCompanyCount = employees.filter(person => person.email?.trim().toLowerCase() === row.email.trim().toLowerCase()).length;
    const plan = planSignedHire({
      action: 'sign',
      fullName: row.fullName,
      email: row.email,
      phone: row.phone,
      departmentId: row.departmentId,
      positionId: row.positionId,
      startDate: row.startDate,
      employeeCode: hireEmployeeCode(companyPrefix),
      sameCompanyCount,
    });
    if (plan.action !== 'create') {
      addToast(plan.action === 'refuse' ? plan.error : 'Name, email, department, and position are required.', 'error');
      return;
    }
    const remember = (employee: Employee) => {
      setEmployees(prev => [...prev, employee]);
      setContracts(prev => [...prev, {
        id: `ct${Date.now()}`,
        employeeId: employee.id,
        type: row.contractType || 'PKWT',
        startDate: row.startDate || '',
        endDate: row.endDate || null,
        status: 'active',
        basicSalary: row.basicSalary || 0,
        allowance: row.allowance || 0,
      }]);
      setApplicants(prev => prev.map(item => item.id === row.id ? {
        ...item,
        status: 'SIGNED',
        employeeId: employee.id,
        onboardingDate: row.startDate,
      } : item));
      addAuditLog('CREATE', 'Employee', employee.id, `${row.fullName} signed as a probation employee`);
      addToast(`${row.fullName} signed. Finish onboarding under People → Onboarding.`, 'success');
    };
    if (embedded || isApiAvailable()) {
      try {
        const created = await employeesApi.create(plan.fields);
        remember(mapEmployeeRow(created) as Employee);
      } catch (error) {
        addToast(error instanceof Error ? error.message : 'The employee was not saved.', 'error');
      }
      return;
    }
    remember({
      id: `emp${Date.now()}`,
      employeeCode: plan.fields.employee_code,
      fullName: plan.fields.full_name,
      preferredName: plan.fields.preferred_name,
      nik: '',
      dateOfBirth: '',
      phone: plan.fields.phone || '',
      email: plan.fields.email,
      address: '',
      emergencyContactName: '',
      emergencyContactPhone: '',
      departmentId: plan.fields.department_id,
      positionId: plan.fields.position_id,
      employmentStatus: 'PROBATION',
      joinDate: plan.fields.join_date,
      bankName: row.bankName,
      bankAccountNumber: row.bankAccountNumber,
      bankAccountName: row.fullName,
      violations: [],
    } as Employee);
  };

  const summaryStatuses: ApplicantStatus[] = ['CV_SCREENING', 'HR_INTERVIEW', 'USHER_INTERVIEW', 'OFFER_SENT', 'SIGNED', 'ONBOARDED'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Hiring</h1>
          <p className="text-slate-500 text-sm mt-1">CV screening → HR interview → Usher interview → offer letter → sign → onboarding.</p>
        </div>
        <div className="flex gap-2">
          <BulkUploadButton module="hiring" />
          <button onClick={() => setShowAdd(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium">Add applicant</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {summaryStatuses.map(status => (
          <div key={status} className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">{STAGE_LABEL[status]}</p>
            <p className="text-2xl font-bold text-slate-800">
              {applicants.filter(row => normalizeStatus(row.status) === status).length}
            </p>
          </div>
        ))}
      </div>

      {applicants.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">No applicants yet. Add one to start recruitment.</div>
      )}

      <div className="space-y-3">
        {applicants.map(row => {
          const status = normalizeStatus(row.status);
          return (
            <div key={row.id} className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-800">{row.fullName}</p>
                  <p className="text-sm text-slate-500">{row.email} · {deptName(row.departmentId)} · {posName(row.positionId)}</p>
                  {row.basicSalary ? <p className="text-sm text-slate-700 mt-1">Offer {formatCurrency(row.basicSalary)} + {formatCurrency(row.allowance || 0)} allowance · {row.contractType} · starts {row.startDate}</p> : null}
                  {(status === 'REJECTED' || status === 'OFFER_REJECTED') && (
                    <p className="text-sm text-red-600 mt-1">{STAGE_LABEL[status]}. {row.rejectionReason}. This person is not active in HRIS.</p>
                  )}
                  {row.employeeId && status !== 'REJECTED' && status !== 'OFFER_REJECTED' && (
                    <p className="text-sm text-slate-600 mt-1">Employee record saved. The Wolf login is added from Access.</p>
                  )}
                </div>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700">{STAGE_LABEL[status] || status}</span>
              </div>

              <div className="flex flex-wrap gap-1">
                {PIPELINE.map((step, index) => {
                  const currentIndex = PIPELINE.indexOf(status);
                  const done = currentIndex >= index || status === 'ONBOARDED';
                  return (
                    <span key={step} className={`text-[10px] px-2 py-0.5 rounded ${done ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-50 text-slate-400'}`}>
                      {STAGE_LABEL[step]}
                    </span>
                  );
                })}
              </div>

              {status === 'CV_SCREENING' && (
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => advanceStage(row.id, 'HR_INTERVIEW', 'Passed CV screening')} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm">Pass CV screening</button>
                  <button onClick={() => rejectApplicant(row.id, 'Did not pass CV screening')} className="px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-sm">Reject</button>
                </div>
              )}
              {status === 'HR_INTERVIEW' && (
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => advanceStage(row.id, 'USHER_INTERVIEW', 'Passed HR interview')} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm">Pass HR interview</button>
                  <button onClick={() => rejectApplicant(row.id, 'Did not pass HR interview')} className="px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-sm">Reject</button>
                </div>
              )}
              {status === 'USHER_INTERVIEW' && (
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setOfferId(row.id)} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm">Pass Usher · prepare offer</button>
                  <button onClick={() => rejectApplicant(row.id, 'Did not pass Usher interview')} className="px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-sm">Reject</button>
                </div>
              )}
              {status === 'OFFER_SENT' && (
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => advanceStage(row.id, 'OFFER_ACCEPTED', 'Offer accepted')} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm">Offer accepted</button>
                  <button onClick={() => {
                    setApplicants(prev => prev.map(item => item.id === row.id ? { ...item, status: 'OFFER_REJECTED', rejectionReason: 'Offer letter rejected by candidate' } : item));
                    addToast(`${row.fullName}: offer rejected`, 'warning');
                  }} className="px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-sm">Offer rejected</button>
                </div>
              )}
              {status === 'OFFER_ACCEPTED' && (
                <button onClick={() => signContract(row)} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm">Sign contract</button>
              )}
              {status === 'SIGNED' && (
                <p className="text-sm text-slate-600">Contract signed. Complete onboarding under <span className="font-medium">People → Onboarding</span>.</p>
              )}
              {status === 'ONBOARDED' && <p className="text-sm text-emerald-700">Registered and active. Payroll uses the signed salary.</p>}
            </div>
          );
        })}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-5 w-full max-w-md space-y-3">
            <h2 className="font-semibold text-slate-800">New applicant</h2>
            <input value={candidate.fullName} onChange={event => setCandidate(prev => ({ ...prev, fullName: event.target.value }))} placeholder="Full name" className="w-full px-3 py-2 border rounded-lg text-sm" />
            <input value={candidate.email} onChange={event => setCandidate(prev => ({ ...prev, email: event.target.value }))} placeholder="Email" className="w-full px-3 py-2 border rounded-lg text-sm" />
            <input value={candidate.phone} onChange={event => setCandidate(prev => ({ ...prev, phone: event.target.value }))} placeholder="Phone" className="w-full px-3 py-2 border rounded-lg text-sm" />
            <select value={candidate.departmentId} onChange={event => setCandidate(prev => ({ ...prev, departmentId: event.target.value, positionId: '' }))} className="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="">Department</option>
              {departments.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
            </select>
            <select value={candidate.positionId} onChange={event => setCandidate(prev => ({ ...prev, positionId: event.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="">Position</option>
              {positions.filter(row => !candidate.departmentId || row.departmentId === candidate.departmentId).map(row => <option key={row.id} value={row.id}>{row.title}</option>)}
            </select>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowAdd(false)} className="px-3 py-2 text-sm text-slate-600">Cancel</button>
              <button onClick={addApplicant} className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm">Save applicant</button>
            </div>
          </div>
        </div>
      )}

      {offerId && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-5 w-full max-w-md space-y-3">
            <h2 className="font-semibold text-slate-800">Prepare offer letter</h2>
            <p className="text-sm text-slate-500">Salary becomes the payroll base after the candidate accepts and signs.</p>
            <label className="block text-xs text-slate-500">Basic salary<input value={offer.basicSalary} onChange={event => setOffer(prev => ({ ...prev, basicSalary: event.target.value }))} className="mt-1 w-full px-3 py-2 border rounded-lg text-sm" /></label>
            <label className="block text-xs text-slate-500">Fixed allowance<input value={offer.allowance} onChange={event => setOffer(prev => ({ ...prev, allowance: event.target.value }))} className="mt-1 w-full px-3 py-2 border rounded-lg text-sm" /></label>
            <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={offer.bpjsEnrolled} onChange={event => setOffer(prev => ({ ...prev, bpjsEnrolled: event.target.checked, companyCoversEmployeeBpjs: event.target.checked ? prev.companyCoversEmployeeBpjs : false }))} /> Enrolled in BPJS</label>
            <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={offer.companyCoversEmployeeBpjs} disabled={!offer.bpjsEnrolled} onChange={event => setOffer(prev => ({ ...prev, companyCoversEmployeeBpjs: event.target.checked }))} /> Company covers employee BPJS share</label>
            <label className="block text-xs text-slate-500">Tax configuration
              <select value={offer.taxConfiguration} onChange={event => setOffer(prev => ({ ...prev, taxConfiguration: event.target.value as 'netto' | 'gross' }))} className="mt-1 w-full px-3 py-2 border rounded-lg text-sm">
                <option value="netto">Netto</option>
                <option value="gross">Gross</option>
              </select>
            </label>
            <label className="block text-xs text-slate-500">PTKP
              <select value={offer.ptkpCode} onChange={event => setOffer(prev => ({ ...prev, ptkpCode: event.target.value }))} className="mt-1 w-full px-3 py-2 border rounded-lg text-sm">
                {ptkpTables.map(row => <option key={row.id} value={row.code}>{row.code}</option>)}
              </select>
            </label>
            <label className="block text-xs text-slate-500">Bank<input value={offer.bankName} onChange={event => setOffer(prev => ({ ...prev, bankName: event.target.value }))} className="mt-1 w-full px-3 py-2 border rounded-lg text-sm" /></label>
            <label className="block text-xs text-slate-500">Account number<input value={offer.bankAccountNumber} onChange={event => setOffer(prev => ({ ...prev, bankAccountNumber: event.target.value }))} className="mt-1 w-full px-3 py-2 border rounded-lg text-sm" /></label>
            <label className="block text-xs text-slate-500">Contract
              <select value={offer.contractType} onChange={event => setOffer(prev => ({ ...prev, contractType: event.target.value as 'PKWT' | 'PKWTT' }))} className="mt-1 w-full px-3 py-2 border rounded-lg text-sm">
                <option value="PKWT">PKWT fixed term</option>
                <option value="PKWTT">PKWTT permanent</option>
              </select>
            </label>
            <label className="block text-xs text-slate-500">Start<input type="date" value={offer.startDate} onChange={event => setOffer(prev => ({ ...prev, startDate: event.target.value }))} className="mt-1 w-full px-3 py-2 border rounded-lg text-sm" /></label>
            {offer.contractType === 'PKWT' && (
              <label className="block text-xs text-slate-500">End<input type="date" value={offer.endDate} onChange={event => setOffer(prev => ({ ...prev, endDate: event.target.value }))} className="mt-1 w-full px-3 py-2 border rounded-lg text-sm" /></label>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setOfferId(null)} className="px-3 py-2 text-sm text-slate-600">Cancel</button>
              <button onClick={saveOffer} className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm">Mark offer sent</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
