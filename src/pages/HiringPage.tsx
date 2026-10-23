import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth, STAFF_PASSWORD } from '../context/AuthContext';
import type { Applicant } from '../types';

const emptyChecks = { ktp: false, npwp: false, bank: false, orientation: false };

const formatCurrency = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

export default function HiringPage() {
  const { applicants, setApplicants, employees, setEmployees, setContracts, departments, positions, ptkpTables, addToast, addAuditLog } = useApp();
  const { registerStaff } = useAuth();
  const [showAdd, setShowAdd] = useState(false);
  const [offerId, setOfferId] = useState<string | null>(null);
  const [candidate, setCandidate] = useState({ fullName: '', email: '', phone: '', departmentId: '', positionId: '' });
  const [offer, setOffer] = useState({
    basicSalary: '4500000',
    allowance: '500000',
    ptkpCode: 'TK/0',
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
      status: 'APPLIED',
      checks: { ...emptyChecks },
    };
    setApplicants(prev => [row, ...prev]);
    addAuditLog('CREATE', 'Applicant', row.id, `${row.fullName} applied`);
    addToast(`${row.fullName} is in recruitment.`, 'success');
    setCandidate({ fullName: '', email: '', phone: '', departmentId: '', positionId: '' });
    setShowAdd(false);
  };

  const rejectApplicant = (id: string) => {
    const row = applicants.find(item => item.id === id);
    setApplicants(prev => prev.map(item => item.id === id ? { ...item, status: 'REJECTED', rejectionReason: 'Not selected for this opening' } : item));
    addAuditLog('REJECT', 'Applicant', id, `${row?.fullName} rejected`);
    addToast(`${row?.fullName} was rejected. No contract, no login, and no payroll record.`, 'warning');
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
      status: 'OFFERED',
      basicSalary: basic,
      allowance,
      ptkpCode: offer.ptkpCode,
      bankName: offer.bankName,
      bankAccountNumber: offer.bankAccountNumber,
      bankAccountName: item.fullName,
      contractType: offer.contractType,
      startDate: offer.startDate,
      endDate: offer.contractType === 'PKWT' ? offer.endDate : undefined,
    } : item));
    addToast('Offer saved. Sign the contract to register this person.', 'success');
    setOfferId(null);
  };

  const signContract = (row: Applicant) => {
    if (!row.basicSalary || !row.startDate || !row.contractType) return;
    const contractType = row.contractType;
    const startDate = row.startDate;
    const employeeId = `emp${Date.now()}`;
    const code = `EMP-${String(employees.length + 1).padStart(3, '0')}`;
    const employee = {
      id: employeeId,
      employeeCode: code,
      fullName: row.fullName,
      preferredName: row.fullName.split(' ')[0],
      nik: `3174${String(Date.now()).slice(-12)}`,
      dateOfBirth: '1998-01-01',
      gender: 'M' as const,
      phone: row.phone || '-',
      email: row.email,
      address: '-',
      emergencyContactName: '-',
      emergencyContactPhone: '-',
      departmentId: row.departmentId,
      positionId: row.positionId,
      employmentStatus: 'PROBATION' as const,
      joinDate: startDate,
      bankName: row.bankName,
      bankAccountNumber: row.bankAccountNumber,
      bankAccountName: row.fullName,
      ptkpCode: row.ptkpCode || 'TK/0',
    };
    setEmployees(prev => [...prev, employee]);
    setContracts(prev => [...prev, {
      id: `ct${Date.now()}`,
      employeeId,
      type: contractType,
      startDate,
      endDate: row.endDate || null,
      status: 'active',
      basicSalary: row.basicSalary || 0,
      allowance: row.allowance || 0,
    }]);
    registerStaff({ id: `u-${employeeId}`, email: row.email, fullName: row.fullName, role: 'EMPLOYEE', employeeId });
    setApplicants(prev => prev.map(item => item.id === row.id ? { ...item, status: 'SIGNED', employeeId, loginEmail: row.email } : item));
    addAuditLog('CREATE', 'Contract', employeeId, `${row.fullName} signed. Login ${row.email}`);
    addToast(`${row.fullName} signed. Login ${row.email} / ${STAFF_PASSWORD}. Finish onboarding to mark them active.`, 'success');
  };

  const toggleCheck = (id: string, key: keyof Applicant['checks']) => {
    setApplicants(prev => prev.map(item => item.id === id ? { ...item, checks: { ...item.checks, [key]: !item.checks[key] } } : item));
  };

  const completeOnboarding = (row: Applicant) => {
    if (!Object.values(row.checks).every(Boolean) || !row.employeeId) {
      addToast('Tick every onboarding item before registering them as active.', 'error');
      return;
    }
    setEmployees(prev => prev.map(item => item.id === row.employeeId ? { ...item, employmentStatus: 'ACTIVE' } : item));
    setApplicants(prev => prev.map(item => item.id === row.id ? { ...item, status: 'ONBOARDED' } : item));
    addAuditLog('UPDATE', 'Employee', row.employeeId, `${row.fullName} onboarded and active`);
    addToast(`${row.fullName} is registered and active.`, 'success');
  };

  const offering = applicants.find(row => row.id === offerId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Hiring</h1>
          <p className="text-slate-500 text-sm mt-1">Recruit, accept or reject, sign the salary contract, then finish onboarding.</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium">Add applicant</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(['APPLIED', 'REJECTED', 'SIGNED', 'ONBOARDED'] as const).map(status => (
          <div key={status} className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">{status === 'SIGNED' ? 'ONBOARDING' : status}</p>
            <p className="text-2xl font-bold text-slate-800">{applicants.filter(row => row.status === status).length}</p>
          </div>
        ))}
      </div>

      {applicants.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">No applicants yet. Add one to start recruitment.</div>
      )}

      <div className="space-y-3">
        {applicants.map(row => (
          <div key={row.id} className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-800">{row.fullName}</p>
                <p className="text-sm text-slate-500">{row.email} · {deptName(row.departmentId)} · {posName(row.positionId)}</p>
                {row.basicSalary ? <p className="text-sm text-slate-700 mt-1">Offer {formatCurrency(row.basicSalary)} + {formatCurrency(row.allowance || 0)} allowance · {row.contractType} · starts {row.startDate}</p> : null}
                {row.status === 'REJECTED' && <p className="text-sm text-red-600 mt-1">Rejected. {row.rejectionReason}. This person is not in HRIS.</p>}
                {row.loginEmail && row.status !== 'REJECTED' && <p className="text-sm text-slate-600 mt-1">Staff login {row.loginEmail} / {STAFF_PASSWORD}</p>}
              </div>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700">{row.status}</span>
            </div>
            {row.status === 'APPLIED' && (
              <div className="flex gap-2">
                <button onClick={() => { setOfferId(row.id); }} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm">Accept and set pay</button>
                <button onClick={() => rejectApplicant(row.id)} className="px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-sm">Reject</button>
              </div>
            )}
            {row.status === 'OFFERED' && (
              <button onClick={() => signContract(row)} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm">Sign contract and create login</button>
            )}
            {row.status === 'SIGNED' && (
              <div className="space-y-2">
                <p className="text-sm text-slate-600">Onboarding. The employee is on probation until every item is done.</p>
                <div className="flex flex-wrap gap-3 text-sm">
                  {([
                    ['ktp', 'KTP received'],
                    ['npwp', 'NPWP received'],
                    ['bank', 'Bank account confirmed'],
                    ['orientation', 'Orientation done'],
                  ] as const).map(([key, label]) => (
                    <label key={key} className="inline-flex items-center gap-2">
                      <input type="checkbox" checked={row.checks[key]} onChange={() => toggleCheck(row.id, key)} />
                      {label}
                    </label>
                  ))}
                </div>
                <button onClick={() => completeOnboarding(row)} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm">Complete onboarding</button>
              </div>
            )}
            {row.status === 'ONBOARDED' && <p className="text-sm text-emerald-700">Registered and active. Payroll uses the signed salary.</p>}
          </div>
        ))}
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

      {offering && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-5 w-full max-w-md space-y-3">
            <h2 className="font-semibold text-slate-800">Accept {offering.fullName}</h2>
            <p className="text-sm text-slate-500">This salary is what payroll calculates from. Rejected applicants never reach this step.</p>
            <label className="block text-xs text-slate-500">Basic salary<input value={offer.basicSalary} onChange={event => setOffer(prev => ({ ...prev, basicSalary: event.target.value }))} className="mt-1 w-full px-3 py-2 border rounded-lg text-sm" /></label>
            <label className="block text-xs text-slate-500">Fixed allowance<input value={offer.allowance} onChange={event => setOffer(prev => ({ ...prev, allowance: event.target.value }))} className="mt-1 w-full px-3 py-2 border rounded-lg text-sm" /></label>
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
              <button onClick={saveOffer} className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm">Save offer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
