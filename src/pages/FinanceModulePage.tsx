import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Role, ReimbursementClaim } from '../types';
import Modal from '../components/Modal';
import { Wallet, Receipt, Landmark } from 'lucide-react';

const formatCurrency = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

const HR_ROLES: Role[] = ['HR_ADMIN', 'HR_STAFF', 'SUPER_ADMIN'];
const FINANCE_DESK: Role[] = ['FINANCE', 'FINANCIAL_CONTROLLER'];
const DECIDERS: Role[] = ['FINANCE', 'FINANCIAL_CONTROLLER', 'GENERAL_MANAGER'];

const canSubmitClaim = (role?: Role) => !!role && (HR_ROLES.includes(role) || FINANCE_DESK.includes(role));
const canDecideClaim = (role?: Role) => !!role && DECIDERS.includes(role);
const canManageLoans = (role?: Role) => !!role && (HR_ROLES.includes(role) || FINANCE_DESK.includes(role));

const categoryLabel: Record<ReimbursementClaim['category'], string> = {
  TRANSPORT: 'Transport',
  MEDICAL: 'Medical',
  OTHER: 'Other',
};

const statusColor = (status: string) => {
  switch (status) {
    case 'SUBMITTED': return 'bg-amber-100 text-amber-700';
    case 'APPROVED': return 'bg-emerald-100 text-emerald-700';
    case 'REJECTED': return 'bg-red-100 text-red-700';
    case 'PAID':
    case 'PAID_OFF': return 'bg-indigo-100 text-indigo-700';
    case 'ACTIVE': return 'bg-amber-100 text-amber-700';
    default: return 'bg-slate-100 text-slate-700';
  }
};

const emptyClaim = { employeeId: '', claimDate: '', category: 'TRANSPORT' as ReimbursementClaim['category'], amount: '', description: '', receiptFileName: '', receiptFileSize: 0, receiptDataUrl: '' };

export function FinanceHomePage({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { reimbursements, employeeLoans } = useApp();
  const openClaims = reimbursements.filter(row => row.status === 'SUBMITTED' || row.status === 'APPROVED');
  const openAmount = openClaims.reduce((sum, row) => sum + row.amount, 0);
  const openLoans = employeeLoans.filter(row => row.status === 'ACTIVE' && row.remainingBalance > 0);
  const outstanding = openLoans.reduce((sum, row) => sum + row.remainingBalance, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Finance</h1>
        <p className="text-slate-500 text-sm mt-1">Open reimbursements and employee loans. Loan installments are visible for payroll and do not change the payroll calculation.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button onClick={() => onNavigate('reimbursements')} className="bg-white rounded-xl border border-slate-200 p-5 text-left hover:shadow-sm transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center"><Receipt size={20} className="text-indigo-600" /></div>
            <p className="font-medium text-slate-800">Reimbursement</p>
          </div>
          <p className="text-2xl font-bold text-slate-800">{openClaims.length}</p>
          <p className="text-sm text-slate-500">Open claims · {formatCurrency(openAmount)}</p>
          {openClaims.length === 0 && <p className="text-sm text-slate-500 mt-3">No open claims. Submit the first one from Reimbursement: employee, date, category, amount, and description.</p>}
        </button>
        <button onClick={() => onNavigate('employee-loans')} className="bg-white rounded-xl border border-slate-200 p-5 text-left hover:shadow-sm transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center"><Landmark size={20} className="text-indigo-600" /></div>
            <p className="font-medium text-slate-800">Employee Loan</p>
          </div>
          <p className="text-2xl font-bold text-slate-800">{formatCurrency(outstanding)}</p>
          <p className="text-sm text-slate-500">{openLoans.length} outstanding balance{openLoans.length === 1 ? '' : 's'}</p>
          {openLoans.length === 0 && <p className="text-sm text-slate-500 mt-3">No outstanding loans. Record the first one from Employee Loan: employee, principal, monthly installment, start date, and purpose.</p>}
        </button>
      </div>
      {openClaims.length === 0 && openLoans.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">
          <Wallet size={36} className="mx-auto mb-3 text-slate-300" />
          <p>Finance is empty. Open Reimbursement to submit a claim, or Employee Loan to record a loan.</p>
        </div>
      )}
    </div>
  );
}

export function ReimbursementsPage() {
  const { reimbursements, setReimbursements, employees, addToast, addAuditLog } = useApp();
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<'ALL' | ReimbursementClaim['status']>('ALL');
  const [form, setForm] = useState(emptyClaim);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const submitter = canSubmitClaim(user?.role);
  const decider = canDecideClaim(user?.role);
  const activeEmployees = employees.filter(person => person.employmentStatus === 'ACTIVE' || person.employmentStatus === 'PROBATION');
  const visible = reimbursements.filter(row => filter === 'ALL' || row.status === filter);
  const getEmp = (id: string) => employees.find(person => person.id === id);

  const readReceipt = (file: File) => {
    if (file.size > 8 * 1024 * 1024) {
      addToast('Keep the receipt under 8 MB. It is stored in this session.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setForm(prev => ({ ...prev, receiptFileName: file.name, receiptFileSize: file.size, receiptDataUrl: String(reader.result || '') }));
    reader.readAsDataURL(file);
  };

  const submit = () => {
    const amount = Math.round(Number(form.amount));
    if (!form.employeeId || !form.claimDate || !form.description.trim() || !Number.isFinite(amount) || amount <= 0) {
      addToast('Employee, date, description, and an amount greater than 0 are required.', 'error');
      return;
    }
    const claim: ReimbursementClaim = {
      id: `rb${Date.now()}`,
      employeeId: form.employeeId,
      claimDate: form.claimDate,
      category: form.category,
      amount,
      description: form.description.trim(),
      receiptFileName: form.receiptFileName || undefined,
      receiptFileSize: form.receiptFileSize || undefined,
      receiptDataUrl: form.receiptDataUrl || undefined,
      status: 'SUBMITTED',
      submittedByName: user?.fullName || 'HR',
      submittedAt: new Date().toISOString(),
    };
    setReimbursements(prev => [claim, ...prev]);
    addAuditLog('CREATE', 'Reimbursement', claim.id, `${categoryLabel[claim.category]} ${formatCurrency(amount)} for ${getEmp(claim.employeeId)?.fullName}`);
    addToast(`Claim submitted for ${getEmp(claim.employeeId)?.fullName}`, 'success');
    setForm(emptyClaim);
    setShowForm(false);
  };

  const approve = (id: string) => {
    const claim = reimbursements.find(row => row.id === id);
    if (!claim || claim.status !== 'SUBMITTED') return;
    setReimbursements(prev => prev.map(row => row.id === id ? { ...row, status: 'APPROVED', decidedByName: user?.fullName, decidedAt: new Date().toISOString() } : row));
    addAuditLog('APPROVE', 'Reimbursement', id, `Approved ${formatCurrency(claim.amount)} for ${getEmp(claim.employeeId)?.fullName}`);
    addToast(`Claim approved for ${getEmp(claim.employeeId)?.fullName}`, 'success');
  };

  const reject = () => {
    if (!rejectId) return;
    const note = rejectNote.trim();
    if (!note) {
      addToast('A rejection note is required.', 'error');
      return;
    }
    const claim = reimbursements.find(row => row.id === rejectId);
    if (!claim || claim.status !== 'SUBMITTED') return;
    setReimbursements(prev => prev.map(row => row.id === rejectId ? { ...row, status: 'REJECTED', rejectionNote: note, decidedByName: user?.fullName, decidedAt: new Date().toISOString() } : row));
    addAuditLog('REJECT', 'Reimbursement', rejectId, `Rejected: ${note}`);
    addToast(`Claim rejected for ${getEmp(claim.employeeId)?.fullName}`, 'warning');
    setRejectId(null);
    setRejectNote('');
  };

  const markPaid = (id: string) => {
    const claim = reimbursements.find(row => row.id === id);
    if (!claim || claim.status !== 'APPROVED') return;
    setReimbursements(prev => prev.map(row => row.id === id ? { ...row, status: 'PAID', paidAt: new Date().toISOString() } : row));
    addAuditLog('PAY', 'Reimbursement', id, `Paid ${formatCurrency(claim.amount)} to ${getEmp(claim.employeeId)?.fullName}`);
    addToast(`Claim marked paid for ${getEmp(claim.employeeId)?.fullName}`, 'success');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Reimbursement</h1>
          <p className="text-slate-500 text-sm mt-1">Submitted claims wait for Finance or the Director to approve, reject, or mark paid.</p>
        </div>
        {submitter && (
          <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Submit claim</button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {(['ALL', 'SUBMITTED', 'APPROVED', 'REJECTED', 'PAID'] as const).map(item => (
          <button key={item} onClick={() => setFilter(item)} className={`px-4 py-2 rounded-lg text-sm font-medium ${filter === item ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {item === 'ALL' ? 'All' : item.charAt(0) + item.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {visible.map(claim => {
          const emp = getEmp(claim.employeeId);
          return (
            <div key={claim.id} className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-slate-800">{emp?.fullName || 'Employee'}</p>
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${statusColor(claim.status)}`}>{claim.status}</span>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">{categoryLabel[claim.category]} · {claim.claimDate} · {formatCurrency(claim.amount)}</p>
                  <p className="text-sm text-slate-600 mt-1">{claim.description}</p>
                  <p className="text-xs text-slate-400 mt-1">Submitted by {claim.submittedByName} on {new Date(claim.submittedAt).toLocaleDateString()}</p>
                  {claim.rejectionNote && <p className="text-sm text-red-600 mt-1">Rejection note: {claim.rejectionNote}</p>}
                  {claim.receiptDataUrl && <a href={claim.receiptDataUrl} download={claim.receiptFileName} className="inline-block mt-2 text-xs text-indigo-700">Open receipt</a>}
                </div>
                {decider && (
                  <div className="flex flex-wrap gap-2 justify-end">
                    {claim.status === 'SUBMITTED' && <button onClick={() => approve(claim.id)} className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium">Approve</button>}
                    {claim.status === 'SUBMITTED' && <button onClick={() => { setRejectId(claim.id); setRejectNote(''); }} className="px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-sm font-medium">Reject</button>}
                    {claim.status === 'APPROVED' && <button onClick={() => markPaid(claim.id)} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium">Mark paid</button>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {visible.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">
          <Receipt size={36} className="mx-auto mb-3 text-slate-300" />
          {reimbursements.length === 0
            ? 'No claims yet. Submit the first one with an employee, date, category (transport, medical, or other), amount, and description. A receipt file is optional and stays in this session.'
            : 'No claims match this status.'}
        </div>
      )}

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Submit reimbursement">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Employee *</label>
            <select value={form.employeeId} onChange={event => setForm(prev => ({ ...prev, employeeId: event.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option value="">Select employee</option>
              {activeEmployees.map(person => <option key={person.id} value={person.id}>{person.fullName} ({person.employeeCode})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date *</label>
              <input type="date" value={form.claimDate} onChange={event => setForm(prev => ({ ...prev, claimDate: event.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category *</label>
              <select value={form.category} onChange={event => setForm(prev => ({ ...prev, category: event.target.value as ReimbursementClaim['category'] }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                <option value="TRANSPORT">Transport</option>
                <option value="MEDICAL">Medical</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Amount (IDR) *</label>
            <input type="number" min="1" value={form.amount} onChange={event => setForm(prev => ({ ...prev, amount: event.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="150000" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description *</label>
            <textarea value={form.description} onChange={event => setForm(prev => ({ ...prev, description: event.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" rows={3} placeholder="What was paid for" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Receipt (optional, max 8 MB)</label>
            <input type="file" accept="application/pdf,image/*" onChange={event => { const file = event.target.files?.[0]; if (file) readReceipt(file); }} className="w-full text-sm" />
            {form.receiptFileName && <p className="text-xs text-slate-500 mt-1">{form.receiptFileName}</p>}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-600">Cancel</button>
            <button onClick={submit} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium">Submit</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!rejectId} onClose={() => setRejectId(null)} title="Reject claim">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Note *</label>
            <textarea value={rejectNote} onChange={event => setRejectNote(event.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" rows={3} placeholder="Why this claim is rejected" />
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setRejectId(null)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-600">Cancel</button>
            <button onClick={reject} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium">Reject</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export function EmployeeLoansPage() {
  const { employeeLoans, setEmployeeLoans, loanRepayments, setLoanRepayments, employees, addToast, addAuditLog } = useApp();
  const { user } = useAuth();
  const [form, setForm] = useState({ employeeId: '', principal: '', installment: '', startDate: '', purpose: '' });
  const [repayId, setRepayId] = useState<string | null>(null);
  const [repayAmount, setRepayAmount] = useState('');
  const [repayDate, setRepayDate] = useState('');
  const manager = canManageLoans(user?.role);
  const activeEmployees = employees.filter(person => person.employmentStatus === 'ACTIVE' || person.employmentStatus === 'PROBATION');
  const getEmp = (id: string) => employees.find(person => person.id === id);
  const repaying = employeeLoans.find(row => row.id === repayId);

  const recordLoan = () => {
    const principal = Math.round(Number(form.principal));
    const installment = Math.round(Number(form.installment));
    if (!form.employeeId || !form.startDate || !form.purpose.trim() || !Number.isFinite(principal) || principal <= 0 || !Number.isFinite(installment) || installment <= 0) {
      addToast('Employee, principal, monthly installment, start date, and purpose are required.', 'error');
      return;
    }
    if (installment > principal) {
      addToast('The monthly installment cannot be larger than the principal.', 'error');
      return;
    }
    const loan = {
      id: `loan${Date.now()}`,
      employeeId: form.employeeId,
      loanType: 'OTHER' as const,
      principalAmount: principal,
      remainingBalance: principal,
      monthlyInstallment: installment,
      startDate: form.startDate,
      purpose: form.purpose.trim(),
      status: 'ACTIVE' as const,
      createdAt: new Date().toISOString(),
    };
    setEmployeeLoans(prev => [loan, ...prev]);
    addAuditLog('CREATE', 'EmployeeLoan', loan.id, `${formatCurrency(principal)} for ${getEmp(loan.employeeId)?.fullName}, installment ${formatCurrency(installment)}`);
    addToast(`Loan recorded for ${getEmp(loan.employeeId)?.fullName}. Payroll is unchanged.`, 'success');
    setForm({ employeeId: '', principal: '', installment: '', startDate: '', purpose: '' });
  };

  const postRepayment = () => {
    if (!repaying || repaying.status !== 'ACTIVE') return;
    const amount = Math.round(Number(repayAmount));
    if (!repayDate || !Number.isFinite(amount) || amount <= 0) {
      addToast('A payment date and an amount greater than 0 are required.', 'error');
      return;
    }
    if (amount > repaying.remainingBalance) {
      addToast('The repayment cannot be more than the remaining balance.', 'error');
      return;
    }
    const remaining = repaying.remainingBalance - amount;
    setEmployeeLoans(prev => prev.map(row => row.id === repaying.id ? {
      ...row,
      remainingBalance: remaining,
      status: remaining === 0 ? 'PAID_OFF' as const : 'ACTIVE' as const,
      endDate: remaining === 0 ? repayDate : row.endDate,
    } : row));
    setLoanRepayments(prev => [{ id: `pay${Date.now()}`, loanId: repaying.id, amount, paidOn: repayDate, recordedAt: new Date().toISOString() }, ...prev]);
    addAuditLog('UPDATE', 'EmployeeLoan', repaying.id, `Repayment ${formatCurrency(amount)}. Remaining ${formatCurrency(remaining)}`);
    addToast(remaining === 0 ? 'Loan is paid off. Payroll is unchanged.' : `Repayment posted. Remaining ${formatCurrency(remaining)}.`, 'success');
    setRepayId(null);
    setRepayAmount('');
    setRepayDate('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Employee Loan</h1>
        <p className="text-slate-500 text-sm mt-1">HR or Finance records the loan and each repayment. The installment is what payroll staff can see is owed. This does not change payroll calculation.</p>
      </div>

      {manager && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <select value={form.employeeId} onChange={event => setForm(prev => ({ ...prev, employeeId: event.target.value }))} className="px-3 py-2 border border-slate-300 rounded-lg text-sm">
            <option value="">Employee</option>
            {activeEmployees.map(person => <option key={person.id} value={person.id}>{person.fullName}</option>)}
          </select>
          <input type="number" min="1" value={form.principal} onChange={event => setForm(prev => ({ ...prev, principal: event.target.value }))} placeholder="Principal (IDR)" className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          <input type="number" min="1" value={form.installment} onChange={event => setForm(prev => ({ ...prev, installment: event.target.value }))} placeholder="Monthly installment (IDR)" className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          <input type="date" value={form.startDate} onChange={event => setForm(prev => ({ ...prev, startDate: event.target.value }))} className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          <input value={form.purpose} onChange={event => setForm(prev => ({ ...prev, purpose: event.target.value }))} placeholder="Purpose" className="px-3 py-2 border border-slate-300 rounded-lg text-sm md:col-span-2" />
          <button onClick={recordLoan} className="md:col-span-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm w-fit">Record loan</button>
        </div>
      )}

      <div className="space-y-3">
        {employeeLoans.map(loan => {
          const payments = loanRepayments.filter(row => row.loanId === loan.id);
          return (
            <div key={loan.id} className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-slate-800">{getEmp(loan.employeeId)?.fullName || 'Employee'}</p>
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${statusColor(loan.status)}`}>{loan.status}</span>
                  </div>
                  <p className="text-sm text-slate-600 mt-1">{loan.purpose || loan.loanType} · starts {loan.startDate}</p>
                  <p className="text-sm text-slate-500 mt-1">Principal {formatCurrency(loan.principalAmount)}</p>
                  <p className="text-sm font-medium text-indigo-700 mt-2">Monthly installment {formatCurrency(loan.monthlyInstallment)}</p>
                  <p className="text-lg font-bold text-slate-800 mt-1">Remaining {formatCurrency(loan.remainingBalance)}</p>
                  {payments.length > 0 && (
                    <ul className="mt-2 space-y-1 text-xs text-slate-500">
                      {payments.map(payment => <li key={payment.id}>{payment.paidOn}: {formatCurrency(payment.amount)}</li>)}
                    </ul>
                  )}
                </div>
                {manager && loan.status === 'ACTIVE' && (
                  <button onClick={() => { setRepayId(loan.id); setRepayAmount(String(Math.min(loan.monthlyInstallment, loan.remainingBalance))); setRepayDate(''); }} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium">Record repayment</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {employeeLoans.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">
          <Landmark size={36} className="mx-auto mb-3 text-slate-300" />
          <p>No employee loans yet. {manager ? 'Record the first one above: employee, principal, monthly installment, start date, and purpose.' : 'HR or Finance can record a loan here so the monthly installment is visible for payroll.'}</p>
        </div>
      )}

      <Modal isOpen={!!repayId} onClose={() => setRepayId(null)} title="Record repayment">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">Remaining balance {formatCurrency(repaying?.remainingBalance || 0)}. Installment {formatCurrency(repaying?.monthlyInstallment || 0)}. Payroll is not updated.</p>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Amount (IDR) *</label>
            <input type="number" min="1" value={repayAmount} onChange={event => setRepayAmount(event.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Date *</label>
            <input type="date" value={repayDate} onChange={event => setRepayDate(event.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setRepayId(null)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-600">Cancel</button>
            <button onClick={postRepayment} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium">Post repayment</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
