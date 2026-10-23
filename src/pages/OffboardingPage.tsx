import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { OffboardingCalculation } from '../types';
import { UserCircle, AlertTriangle, CheckCircle, FileText, Save, Pin, Loader2 } from 'lucide-react';
import Modal from '../components/Modal';

const formatCurrency = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

const OFFBOARDING_REASONS = [
  { id: 'RESIGN', label: 'Resign' },
  { id: 'CONTRACT_END', label: 'Contract End (PKWT)' },
  { id: 'TERMINATION', label: 'Termination (PHK)' },
  { id: 'RETIREMENT', label: 'Retirement' },
  { id: 'DEATH', label: 'Death' },
  { id: 'SEVERE_VIOLATION', label: 'Severe Violation' },
];

export default function OffboardingPage() {
  const {
    offboardingCalculations, setOffboardingCalculations,
    employees: allEmployees, payrollRecords: allPayrollRecords,
    employeeLoans: allEmployeeLoans, leaveRequests, leaveTypes,
    serviceChargeDistributions,
    addToast, addAuditLog, addNotification,
  } = useApp();
  const [showCalcModal, setShowCalcModal] = useState(false);
  const [newCalc, setNewCalc] = useState<{
    employeeId: string;
    reason: 'RESIGN' | 'CONTRACT_END' | 'TERMINATION' | 'RETIREMENT' | 'DEATH' | 'SEVERE_VIOLATION';
    lastWorkingDay: string;
    noticePeriodDays: number;
  }>({
    employeeId: '',
    reason: 'RESIGN',
    lastWorkingDay: '',
    noticePeriodDays: 30,
  });
  const [calculating, setCalculating] = useState(false);
  const [showResult, setShowResult] = useState<OffboardingCalculation | null>(null);

  const getEmp = (id: string) => allEmployees.find(e => e.id === id);
  const getPayrollRecord = (empId: string) => allPayrollRecords.find(r => {
    const emp = getEmp(r.employeeId);
    return emp && emp.id === empId;
  });
  const getLoans = (empId: string) => allEmployeeLoans.filter(l => l.employeeId === empId && l.status === 'ACTIVE');

  const calculateOffboarding = () => {
    if (!newCalc.employeeId || !newCalc.lastWorkingDay) {
      addToast('Please select employee and last working day', 'error');
      return;
    }
    setCalculating(true);

    setTimeout(() => {
      const emp = getEmp(newCalc.employeeId);
      const payroll = getPayrollRecord(newCalc.employeeId);
      const loans = getLoans(newCalc.employeeId);

      if (!emp || !payroll) {
        addToast('Employee or payroll record not found', 'error');
        setCalculating(false);
        return;
      }

      const monthlyWage = payroll.basicSalary + payroll.allowance;
      const noticeDays = newCalc.noticePeriodDays;
      const finalSalaryProrata = Math.round((monthlyWage / 30) * noticeDays);

      const annualLeave = leaveTypes.find(type => type.code === 'AL');
      const joinDateForLeave = new Date(emp.joinDate);
      const monthsWorked = (new Date(newCalc.lastWorkingDay).getFullYear() - joinDateForLeave.getFullYear()) * 12 + (new Date(newCalc.lastWorkingDay).getMonth() - joinDateForLeave.getMonth());
      const usedAnnual = leaveRequests
        .filter(request => request.employeeId === emp.id && request.status === 'APPROVED' && request.leaveTypeId === annualLeave?.id)
        .reduce((sum, request) => sum + request.totalDays, 0);
      const unusedLeaveDays = monthsWorked >= 12 ? Math.max(0, (annualLeave?.defaultEntitlement || 0) - usedAnnual) : 0;
      const unusedLeaveAmount = Math.round((monthlyWage / 30) * unusedLeaveDays);

      const distributed = serviceChargeDistributions.filter(row => row.employeeId === emp.id && row.status === 'DISTRIBUTED');
      const serviceChargeOutstanding = distributed.reduce((sum, row) => sum + row.amount, 0);

      // Severance pay per PP 35/2021 based on reason and service years
      let severancePay = 0;
      let serviceAppreciation = 0;
      let replacementRights = 0;
      let contractCompensation = 0;

      const joinDate = new Date(emp.joinDate);
      const lastDay = new Date(newCalc.lastWorkingDay);
      const serviceYears = (lastDay.getFullYear() - joinDate.getFullYear()) + (lastDay.getMonth() - joinDate.getMonth()) / 12;

      switch (newCalc.reason) {
        case 'RESIGN':
          // Resign: no severance, but service appreciation if applicable
          serviceAppreciation = serviceYears >= 3 ? Math.round(monthlyWage * 0.5 * Math.floor(serviceYears / 3)) : 0;
          break;
        case 'CONTRACT_END':
          contractCompensation = Math.round(monthlyWage * 0.5); // PKWT compensation
          break;
        case 'TERMINATION':
          // PHK efficiency: severance based on service years
          if (serviceYears < 1) severancePay = Math.round(monthlyWage * 1);
          else if (serviceYears < 2) severancePay = Math.round(monthlyWage * 2);
          else if (serviceYears < 3) severancePay = Math.round(monthlyWage * 3);
          else if (serviceYears < 4) severancePay = Math.round(monthlyWage * 4);
          else if (serviceYears < 5) severancePay = Math.round(monthlyWage * 5);
          else if (serviceYears < 6) severancePay = Math.round(monthlyWage * 6);
          else if (serviceYears < 7) severancePay = Math.round(monthlyWage * 7);
          else if (serviceYears < 8) severancePay = Math.round(monthlyWage * 8);
          else severancePay = Math.round(monthlyWage * 9); // 8+ years
          serviceAppreciation = serviceYears >= 3 ? Math.round(monthlyWage * 0.5 * Math.floor(serviceYears / 3)) : 0;
          replacementRights = serviceYears >= 3 ? Math.round(monthlyWage * Math.floor(serviceYears / 3)) : 0;
          break;
        case 'RETIREMENT':
          severancePay = Math.round(monthlyWage * 2);
          serviceAppreciation = Math.round(monthlyWage * 1);
          break;
        case 'DEATH':
          severancePay = Math.round(monthlyWage * 2);
          serviceAppreciation = Math.round(monthlyWage * 1);
          replacementRights = serviceYears >= 3 ? Math.round(monthlyWage * Math.floor(serviceYears / 3)) : 0;
          break;
        case 'SEVERE_VIOLATION':
          // No severance for severe violation
          break;
      }

      const loanDeduction = loans.reduce((sum, l) => sum + l.remainingBalance, 0);
      const totalFinalPay = finalSalaryProrata + unusedLeaveAmount + serviceChargeOutstanding + severancePay + serviceAppreciation + replacementRights + contractCompensation - loanDeduction;
      const pph21Final = Math.round(totalFinalPay * 0.05); // simplified progressive rate
      const netFinalPay = totalFinalPay - pph21Final;

      const calculation: OffboardingCalculation = {
        id: 'off' + Date.now(),
        employeeId: newCalc.employeeId,
        lastWorkingDay: newCalc.lastWorkingDay,
        reason: newCalc.reason,
        noticePeriodDays: noticeDays,
        finalSalaryProrata,
        unusedLeaveDays,
        unusedLeaveAmount,
        serviceChargeOutstanding,
        severancePay,
        serviceAppreciation,
        replacementRights,
        contractCompensation,
        loanDeduction,
        totalFinalPay,
        pph21Final,
        netFinalPay,
        status: 'CALCULATED',
        createdAt: new Date().toISOString(),
      };

      setOffboardingCalculations(prev => [...prev, calculation]);
      addAuditLog('CREATE', 'OffboardingCalculation', calculation.id, `Offboarding calculation for ${emp.fullName}`);
      addNotification('GENERAL', 'Offboarding Calculation', `Final pay calculated for ${emp.fullName}: ${formatCurrency(netFinalPay)}`);
      addToast(`Offboarding calculation completed for ${emp.fullName}`, 'success');
      setShowResult(calculation);
      setCalculating(false);
      setShowCalcModal(false);
    }, 500);
  };

  const calculations = offboardingCalculations;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Offboarding & Final Pay</h1>
          <p className="text-slate-500 text-sm mt-1">Final pay uses basic salary plus fixed allowance. Unused annual leave is entitlement minus approved annual leave. UP, UPMK, and UPH stay on the simplified PP 35/2021 table.</p>
        </div>
        <button onClick={() => setShowCalcModal(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center gap-2">
          <UserCircle size={16} /> New Offboarding
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4"><p className="text-sm text-slate-500">Total Offboardings</p><p className="text-2xl font-bold text-slate-800">{calculations.length}</p></div>
        <div className="bg-white rounded-xl border border-slate-200 p-4"><p className="text-sm text-slate-500">Draft</p><p className="text-2xl font-bold text-slate-600">{calculations.filter(c => c.status === 'DRAFT').length}</p></div>
        <div className="bg-white rounded-xl border border-slate-200 p-4"><p className="text-sm text-slate-500">Calculated</p><p className="text-2xl font-bold text-blue-600">{calculations.filter(c => c.status === 'CALCULATED').length}</p></div>
        <div className="bg-white rounded-xl border border-slate-200 p-4"><p className="text-sm text-slate-500">Paid</p><p className="text-2xl font-bold text-emerald-600">{calculations.filter(c => c.status === 'PAID').length}</p></div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">Offboarding Calculations</h3>
          <div className="text-sm text-slate-500">{calculations.length} records</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Employee</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Reason</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Last Working Day</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">Final Pay</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">PPh 21</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">Net Pay</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {calculations.map(c => {
                const emp = getEmp(c.employeeId);
                return (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center text-xs font-bold text-slate-600">{emp?.fullName.charAt(0)}</div>
                        <div className="text-sm font-medium text-slate-800">{emp?.fullName}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 capitalize">{c.reason}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{new Date(c.lastWorkingDay).toLocaleDateString('id-ID')}</td>
                    <td className="px-4 py-3 text-sm text-right text-slate-800 font-medium">{formatCurrency(c.totalFinalPay)}</td>
                    <td className="px-4 py-3 text-sm text-right text-red-600">{formatCurrency(c.pph21Final)}</td>
                    <td className="px-4 py-3 text-sm text-right text-emerald-700 font-medium">{formatCurrency(c.netFinalPay)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        c.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' :
                        c.status === 'CALCULATED' ? 'bg-blue-100 text-blue-700' :
                        c.status === 'APPROVED' ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>{c.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => setShowResult(c)} className="text-slate-400 hover:text-slate-600"><FileText size={16} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Offboarding Modal */}
      <Modal isOpen={showCalcModal} onClose={() => setShowCalcModal(false)} title="New Offboarding Calculation">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Employee *</label>
            <select value={newCalc.employeeId} onChange={e => setNewCalc({...newCalc, employeeId: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option value="">Select Employee</option>
              {allEmployees.map(e => <option key={e.id} value={e.id}>{e.fullName} ({e.employeeCode})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Reason *</label>
            <select value={newCalc.reason} onChange={e => setNewCalc({...newCalc, reason: e.target.value as any})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
              {OFFBOARDING_REASONS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Last Working Day *</label>
              <input type="date" value={newCalc.lastWorkingDay} onChange={e => setNewCalc({...newCalc, lastWorkingDay: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notice Period (Days)</label>
              <input type="number" value={newCalc.noticePeriodDays} onChange={e => setNewCalc({...newCalc, noticePeriodDays: parseInt(e.target.value) || 30})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowCalcModal(false)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={calculateOffboarding} disabled={calculating} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
              {calculating ? <Loader2 size={16} className="mr-2 animate-spin" /> : 'Calculate Final Pay'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Result Modal */}
      <Modal isOpen={!!showResult} onClose={() => setShowResult(null)} title="Offboarding Calculation Result">
        <div className="space-y-4">
          {showResult && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase">Employee</p>
                  <p className="text-sm font-bold text-slate-800">{getEmp(showResult.employeeId)?.fullName}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase">Reason</p>
                  <p className="text-sm font-bold text-slate-800 capitalize">{showResult.reason}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase">Last Working Day</p>
                  <p className="text-sm font-bold text-slate-800">{new Date(showResult.lastWorkingDay).toLocaleDateString('id-ID')}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase">Status</p>
                  <p className={`text-sm font-bold ${showResult.status === 'CALCULATED' ? 'text-blue-600' : 'text-emerald-600'}`}>{showResult.status}</p>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-medium text-slate-500 uppercase mb-3">Final Pay Breakdown</p>
                <div className="space-y-2">
                  <div className="flex justify-between"><span className="text-slate-600 text-sm">Final Salary (Prorata)</span><span className="text-sm text-slate-800">{formatCurrency(showResult.finalSalaryProrata)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-600 text-sm">Unused Leave ({showResult.unusedLeaveDays} days)</span><span className="text-sm text-slate-800">{formatCurrency(showResult.unusedLeaveAmount)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-600 text-sm">Service Charge Outstanding</span><span className="text-sm text-slate-800">{formatCurrency(showResult.serviceChargeOutstanding)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-600 text-sm">Severance Pay (UP)</span><span className="text-sm text-slate-800">{formatCurrency(showResult.severancePay)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-600 text-sm">Service Appreciation (UPMK)</span><span className="text-sm text-slate-800">{formatCurrency(showResult.serviceAppreciation)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-600 text-sm">Replacement Rights (UPH)</span><span className="text-sm text-slate-800">{formatCurrency(showResult.replacementRights)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-600 text-sm">Contract Compensation (PKWT)</span><span className="text-sm text-slate-800">{formatCurrency(showResult.contractCompensation)}</span></div>
                  <div className="flex justify-between border-t border-slate-200 pt-2"><span className="text-slate-600 text-sm text-red-600">Loan Deductions</span><span className="text-sm text-red-600">-{formatCurrency(showResult.loanDeduction)}</span></div>
                  <div className="flex justify-between border-t border-slate-200 pt-2 font-medium"><span className="text-slate-800">Total Final Pay</span><span className="text-slate-800 font-bold">{formatCurrency(showResult.totalFinalPay)}</span></div>
                  <div className="flex justify-between border-t border-slate-200 pt-2"><span className="text-slate-600 text-sm text-red-600">PPh 21 Final</span><span className="text-sm text-red-600">-{formatCurrency(showResult.pph21Final)}</span></div>
                  <div className="flex justify-between border-t border-slate-200 pt-2 text-emerald-700 font-bold"><span>Net Final Pay</span><span>{formatCurrency(showResult.netFinalPay)}</span></div>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-xs font-medium text-amber-700 mb-2">Compliance Notes (PP 35/2021)</p>
                <ul className="text-sm text-amber-700 space-y-1 list-disc pl-4">
                  <li>PPh 21 on termination pay uses progressive rates</li>
                  <li>BPJS membership must be terminated</li>
                  <li>JHT claim available for employee</li>
                  <li>JKP claim if eligible</li>
                  <li>Final payment must include service charge outstanding</li>
                </ul>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button onClick={() => setShowResult(null)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Close</button>
                <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center gap-2">
                  <Pin size={16} /> Generate Settlement Letter
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
