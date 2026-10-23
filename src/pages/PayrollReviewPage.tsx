import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';

const formatCurrency = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

export default function PayrollReviewPage() {
  const { payrollPacks, setPayrollPacks, setPayrollPeriods, addToast, addAuditLog } = useApp();
  const { user } = useAuth();
  const [openId, setOpenId] = useState<string | null>(payrollPacks.find(pack => pack.status === 'UNDER_REVIEW')?.id || payrollPacks[0]?.id || null);
  const [note, setNote] = useState('');
  const pack = payrollPacks.find(row => row.id === openId) || null;
  const canDecide = user?.role === 'GENERAL_MANAGER' || user?.role === 'FINANCIAL_CONTROLLER' || user?.role === 'FINANCE';

  const decide = (status: 'APPROVED' | 'RETURNED') => {
    if (!pack) return;
    setPayrollPacks(prev => prev.map(row => row.id === pack.id ? {
      ...row,
      status,
      reviewNote: note || row.reviewNote,
      reviewedAt: new Date().toISOString(),
      reviewedBy: user?.fullName || 'Reviewer',
    } : row));
    setPayrollPeriods(prev => prev.map(row => row.id === pack.periodId ? { ...row, status: status === 'APPROVED' ? 'APPROVED' as const : 'CALCULATED' as const } : row));
    addAuditLog(status === 'APPROVED' ? 'APPROVE' : 'REJECT', 'PayrollPack', pack.id, `${pack.periodCode} ${status.toLowerCase()} by ${user?.fullName}`);
    addToast(status === 'APPROVED' ? `${pack.periodCode} accepted. Payroll can now finalize it.` : `${pack.periodCode} sent back. Payroll can calculate again.`, status === 'APPROVED' ? 'success' : 'warning');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Payroll Review</h1>
        <p className="text-slate-500 text-sm mt-1">A submitted period is frozen here. The numbers stay as they were when payroll sent them.</p>
      </div>
      {payrollPacks.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-sm text-slate-500">No payroll pack has been submitted.</div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-[16rem_1fr] gap-4">
        <div className="space-y-2">
          {payrollPacks.map(row => (
            <button key={row.id} onClick={() => setOpenId(row.id)} className={`w-full text-left rounded-xl border p-3 ${row.id === pack?.id ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white'}`}>
              <p className="font-medium text-slate-800">{row.periodCode}</p>
              <p className="text-xs text-slate-500">{row.status} · {formatCurrency(row.totalNet)} net</p>
            </button>
          ))}
        </div>
        {pack && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-slate-800">{pack.periodCode} payroll pack</p>
                <p className="text-sm text-slate-500">{pack.startDate} to {pack.endDate} · pay {pack.payDate}</p>
                <p className="text-sm text-slate-500">Submitted by {pack.submittedBy} on {new Date(pack.submittedAt).toLocaleString()}</p>
              </div>
              <span className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-800">{pack.status}</span>
            </div>
            <p className="text-sm text-slate-600">Locked for review. Recalculate is blocked until this pack is sent back.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-slate-500">
                  <tr>
                    <th className="py-2">Employee</th>
                    <th>Basic</th>
                    <th>Allowance</th>
                    <th>Overtime</th>
                    <th>Service</th>
                    <th>Gross</th>
                    <th>Deductions</th>
                    <th>Net</th>
                  </tr>
                </thead>
                <tbody>
                  {pack.lines.map(line => (
                    <tr key={line.employeeId} className="border-t border-slate-100">
                      <td className="py-2">{line.employeeName}<div className="text-xs text-slate-400">{line.employeeCode}</div></td>
                      <td>{formatCurrency(line.basicSalary)}</td>
                      <td>{formatCurrency(line.allowance)}</td>
                      <td>{formatCurrency(line.overtime)}</td>
                      <td>{formatCurrency(line.serviceCharge)}</td>
                      <td>{formatCurrency(line.grossPay)}</td>
                      <td>{formatCurrency(line.totalDeductions)}</td>
                      <td className="font-medium">{formatCurrency(line.netPay)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-6 text-sm">
              <span>Gross {formatCurrency(pack.totalGross)}</span>
              <span>Deductions {formatCurrency(pack.totalDeductions)}</span>
              <span className="font-semibold">Net {formatCurrency(pack.totalNet)}</span>
            </div>
            {pack.reviewNote && <p className="text-sm text-slate-600">Note: {pack.reviewNote}</p>}
            {canDecide && pack.status === 'UNDER_REVIEW' && (
              <div className="space-y-2">
                <textarea value={note} onChange={event => setNote(event.target.value)} placeholder="Review note" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" rows={2} />
                <div className="flex gap-2">
                  <button onClick={() => decide('APPROVED')} className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm">Accept pack</button>
                  <button onClick={() => decide('RETURNED')} className="px-3 py-2 bg-amber-50 text-amber-800 rounded-lg text-sm">Send back</button>
                </div>
              </div>
            )}
            {!canDecide && pack.status === 'UNDER_REVIEW' && <p className="text-sm text-slate-500">Waiting for the director or finance to accept or send back this pack.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
