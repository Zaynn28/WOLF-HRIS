import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { employees, departments } from '../data/mockData';
import { FileText, ChevronDown, ChevronUp, Lock, CheckCircle, AlertTriangle } from 'lucide-react';
import Modal from '../components/Modal';

export default function PayrollPage() {
  const { payrollPeriods, setPayrollPeriods, payrollRecords, addToast, addAuditLog, addNotification } = useApp();
  const [selectedPeriod, setSelectedPeriod] = useState(payrollPeriods.find(p => p.status !== 'FINALIZED' && p.status !== 'LOCKED')?.id || payrollPeriods[0]?.id);
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState<'review' | 'finalize' | null>(null);

  const period = payrollPeriods.find(p => p.id === selectedPeriod);
  const records = payrollRecords.filter(r => r.payrollPeriodId === selectedPeriod);
  const totalGross = records.reduce((sum, r) => sum + r.grossPay, 0);
  const totalDeductions = records.reduce((sum, r) => sum + r.totalDeductions, 0);
  const totalNet = records.reduce((sum, r) => sum + r.netPay, 0);

  const getEmp = (id: string) => employees.find(e => e.id === id);
  const getDept = (id: string) => departments.find(d => d.id === id)?.name || '-';
  const formatCurrency = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

  const statusColor = (status: string) => {
    switch(status) {
      case 'DRAFT': return 'bg-slate-100 text-slate-700';
      case 'CALCULATED': return 'bg-blue-100 text-blue-700';
      case 'UNDER_REVIEW': return 'bg-amber-100 text-amber-700';
      case 'APPROVED': return 'bg-emerald-100 text-emerald-700';
      case 'FINALIZED': return 'bg-purple-100 text-purple-700';
      case 'LOCKED': return 'bg-slate-200 text-slate-800';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const handleSubmitForReview = () => {
    setPayrollPeriods(prev => prev.map(p => p.id === selectedPeriod ? { ...p, status: 'UNDER_REVIEW' as const } : p));
    addAuditLog('UPDATE', 'PayrollPeriod', selectedPeriod || '', 'Status changed to UNDER_REVIEW');
    addNotification('GENERAL', 'Payroll Submitted', `Payroll ${period?.periodCode} submitted for review`);
    addToast(`Payroll ${period?.periodCode} submitted for review`, 'success');
    setShowConfirmModal(null);
  };

  const handleFinalize = () => {
    setPayrollPeriods(prev => prev.map(p => p.id === selectedPeriod ? { ...p, status: 'FINALIZED' as const, finalizedAt: new Date().toISOString() } : p));
    addAuditLog('FINALIZE', 'PayrollPeriod', selectedPeriod || '', `Payroll ${period?.periodCode} finalized`);
    addNotification('PAYROLL_FINALIZED', 'Payroll Finalized', `Payroll ${period?.periodCode} has been finalized and locked`);
    addToast(`Payroll ${period?.periodCode} finalized successfully. Records are now locked.`, 'success');
    setShowConfirmModal(null);
  };

  const getBreakdown = (record: typeof records[0]) => {
    const basicSalary = record.grossPay * 0.7;
    const allowance = record.grossPay * 0.15;
    const overtime = record.grossPay * 0.1;
    const serviceCharge = record.grossPay * 0.05;
    const bpjs = record.totalDeductions * 0.6;
    const tax = record.totalDeductions * 0.4;
    return { basicSalary, allowance, overtime, serviceCharge, bpjs, tax };
  };

  const isFinalized = period?.status === 'FINALIZED' || period?.status === 'LOCKED';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Payroll</h1>
          <p className="text-slate-500 text-sm mt-1">Manage payroll periods and calculations</p>
        </div>
        {period && !isFinalized && (
          <div className="flex gap-2">
            {period.status === 'CALCULATED' && (
              <button onClick={() => setShowConfirmModal('review')} className="px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-sm font-medium hover:bg-amber-100">
                Submit for Review
              </button>
            )}
            {(period.status === 'UNDER_REVIEW' || period.status === 'APPROVED') && (
              <button onClick={() => setShowConfirmModal('finalize')} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
                Finalize Payroll
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {payrollPeriods.map(p => (
          <button key={p.id} onClick={() => setSelectedPeriod(p.id)} className={`flex-shrink-0 px-4 py-3 rounded-xl border text-sm transition-all ${selectedPeriod === p.id ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            <p className="font-medium">{p.periodCode}</p>
            <span className={`text-xs px-2 py-0.5 rounded mt-1 inline-block ${statusColor(p.status)}`}>{p.status}</span>
          </button>
        ))}
      </div>

      {period && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4"><p className="text-sm text-slate-500">Period</p><p className="text-lg font-bold text-slate-800">{period.periodCode}</p><p className="text-xs text-slate-400">{period.startDate} to {period.endDate}</p></div>
          <div className="bg-white rounded-xl border border-slate-200 p-4"><p className="text-sm text-slate-500">Total Gross</p><p className="text-lg font-bold text-slate-800">{formatCurrency(totalGross)}</p><p className="text-xs text-slate-400">{records.length} employees</p></div>
          <div className="bg-white rounded-xl border border-slate-200 p-4"><p className="text-sm text-slate-500">Total Deductions</p><p className="text-lg font-bold text-red-600">{formatCurrency(totalDeductions)}</p><p className="text-xs text-slate-400">BPJS + Tax</p></div>
          <div className="bg-white rounded-xl border border-slate-200 p-4"><p className="text-sm text-slate-500">Total Net Pay</p><p className="text-lg font-bold text-emerald-600">{formatCurrency(totalNet)}</p><p className="text-xs text-slate-400">Pay date: {period.payDate}</p></div>
        </div>
      )}

      {isFinalized && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex items-start gap-3">
          <Lock size={18} className="text-purple-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-purple-800">Payroll Locked</p>
            <p className="text-sm text-purple-700">This payroll period has been finalized. Records cannot be modified. Any corrections require a new adjustment period.</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">Payroll Records</h3>
          <div className="flex items-center gap-2 text-sm text-slate-500"><FileText size={14} /><span>{records.length} records</span></div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Employee</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Department</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">Gross Pay</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">Deductions</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">Net Pay</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.map(record => {
                const emp = getEmp(record.employeeId);
                const isExpanded = expandedRecord === record.id;
                const breakdown = getBreakdown(record);
                return (
                  <>
                    <tr key={record.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center text-xs font-bold text-indigo-600">{emp?.fullName.charAt(0)}</div>
                          <div><p className="text-sm font-medium text-slate-800">{emp?.fullName}</p><p className="text-xs text-slate-500">{emp?.employeeCode}</p></div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{emp ? getDept(emp.departmentId) : '-'}</td>
                      <td className="px-4 py-3 text-sm text-right text-slate-800 font-medium">{formatCurrency(record.grossPay)}</td>
                      <td className="px-4 py-3 text-sm text-right text-red-600">{formatCurrency(record.totalDeductions)}</td>
                      <td className="px-4 py-3 text-sm text-right text-emerald-700 font-medium">{formatCurrency(record.netPay)}</td>
                      <td className="px-4 py-3"><button onClick={() => setExpandedRecord(isExpanded ? null : record.id)} className="text-slate-400 hover:text-slate-600">{isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button></td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${record.id}-detail`} className="bg-slate-50">
                        <td colSpan={6} className="px-4 py-4">
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-slate-500 text-xs mb-1">EARNINGS</p>
                              <div className="space-y-1">
                                <div className="flex justify-between"><span className="text-slate-600">Basic Salary</span><span>{formatCurrency(breakdown.basicSalary)}</span></div>
                                <div className="flex justify-between"><span className="text-slate-600">Allowance</span><span>{formatCurrency(breakdown.allowance)}</span></div>
                                <div className="flex justify-between"><span className="text-slate-600">Overtime</span><span>{formatCurrency(breakdown.overtime)}</span></div>
                                <div className="flex justify-between"><span className="text-slate-600">Service Charge</span><span>{formatCurrency(breakdown.serviceCharge)}</span></div>
                              </div>
                            </div>
                            <div>
                              <p className="text-slate-500 text-xs mb-1">DEDUCTIONS</p>
                              <div className="space-y-1">
                                <div className="flex justify-between"><span className="text-slate-600">BPJS</span><span className="text-red-600">-{formatCurrency(breakdown.bpjs)}</span></div>
                                <div className="flex justify-between"><span className="text-slate-600">PPh 21</span><span className="text-red-600">-{formatCurrency(breakdown.tax)}</span></div>
                              </div>
                            </div>
                            <div>
                              <p className="text-slate-500 text-xs mb-1">SUMMARY</p>
                              <div className="space-y-1">
                                <div className="flex justify-between font-medium"><span>Gross</span><span>{formatCurrency(record.grossPay)}</span></div>
                                <div className="flex justify-between font-medium"><span>Deductions</span><span className="text-red-600">-{formatCurrency(record.totalDeductions)}</span></div>
                                <div className="flex justify-between font-bold text-emerald-700 border-t pt-1"><span>Net Pay</span><span>{formatCurrency(record.netPay)}</span></div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modals */}
      <Modal isOpen={showConfirmModal === 'review'} onClose={() => setShowConfirmModal(null)} title="Submit for Review">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
            <AlertTriangle size={20} className="text-amber-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">Confirm Submission</p>
              <p className="text-sm text-amber-700 mt-1">You are about to submit payroll period <strong>{period?.periodCode}</strong> for review. This will lock calculations and send it to the approval workflow.</p>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowConfirmModal(null)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={handleSubmitForReview} className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700">Submit for Review</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showConfirmModal === 'finalize'} onClose={() => setShowConfirmModal(null)} title="Finalize Payroll">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-red-50 rounded-lg border border-red-200">
            <Lock size={20} className="text-red-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-800">Confirm Finalization</p>
              <p className="text-sm text-red-700 mt-1">You are about to finalize payroll period <strong>{period?.periodCode}</strong>. <strong>This action cannot be undone.</strong> All records will be locked and payslips will be generated.</p>
              <p className="text-sm text-red-700 mt-2">Total Net Pay: <strong>{formatCurrency(totalNet)}</strong> for {records.length} employees.</p>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowConfirmModal(null)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={handleFinalize} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Confirm Finalize</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
