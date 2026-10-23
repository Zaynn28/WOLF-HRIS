import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { calculateOvertimePay, calculatePeriodPay, overlapDays, unpaidLeaveDeduction } from '../lib/payrollEngine';
import { FileText, ChevronDown, ChevronUp, Lock, CheckCircle, AlertTriangle, Calculator, Download } from 'lucide-react';
import Modal from '../components/Modal';
import PeriodBar from '../components/PeriodBar';
import { downloadPayrollExport, PayrollExportFormat } from '../lib/payrollExport';

const formatCurrency = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

interface PayrollItemView {
  id: string;
  componentCode: string;
  componentName: string;
  category: 'EARNING' | 'DEDUCTION';
  amount: number;
}

export default function PayrollPage() {
  const {
    payrollPeriods,
    setPayrollPeriods,
    payrollRecords,
    setPayrollRecords,
    payrollItems,
    setPayrollItems,
    serviceChargeDistributions,
    employees,
    contracts,
    departments,
    leaveRequests,
    leaveTypes,
    overtimeRequests,
    payPolicy,
    bpjsRates,
    terTables,
    workingPeriodId,
    addToast,
    addAuditLog,
    addNotification,
    setPayrollPacks,
  } = useApp();
  const { user } = useAuth();
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState<'review' | 'finalize' | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [exportFormat, setExportFormat] = useState<PayrollExportFormat>('csv');

  useEffect(() => {
    setExpandedRecord(null);
  }, [workingPeriodId]);

  const period = payrollPeriods.find(p => p.id === workingPeriodId);
  const records = payrollRecords.filter(r => r.payrollPeriodId === workingPeriodId);
  const periodItems = payrollItems.filter(i => records.some(r => r.id === i.payrollRecordId));

  // Recalculate totals from components so numbers always add up
  const totalBasic = records.reduce((sum, r) => sum + r.basicSalary, 0);
  const totalAllowance = records.reduce((sum, r) => sum + r.allowance, 0);
  const totalOvertime = records.reduce((sum, r) => sum + r.overtime, 0);
  const totalServiceCharge = records.reduce((sum, r) => sum + r.serviceCharge, 0);
  const totalGross = records.reduce((sum, r) => sum + r.grossPay, 0);
  const totalDeductions = records.reduce((sum, r) => sum + r.totalDeductions, 0);
  const totalNet = records.reduce((sum, r) => sum + r.netPay, 0);

  // Verify numbers add up: gross = basic + allowance + overtime + serviceCharge
  const calculatedGross = totalBasic + totalAllowance + totalOvertime + totalServiceCharge;
  const numbersMatch = Math.abs(calculatedGross - totalGross) < 0.01;

  const getEmp = (id: string) => employees.find(e => e.id === id);
  const getDept = (id: string) => departments.find(d => d.id === id)?.name || '-';

  const getRecordItems = (recordId: string): PayrollItemView[] => {
    return periodItems.filter(i => i.payrollRecordId === recordId);
  };

  const recordHasServiceChargeDist = (recordId: string) => {
    return serviceChargeDistributions.some(d => d.payrollRecordId === recordId && d.status === 'DISTRIBUTED');
  };

  const serviceChargeDistCount = serviceChargeDistributions.filter(d => d.periodId === workingPeriodId && d.status === 'DISTRIBUTED').length;

  const handleCalculate = () => {
    if (!period) return;
    setIsCalculating(true);

    setTimeout(() => {
      const rates = [...bpjsRates].sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))[0];
      const periodDistributions = serviceChargeDistributions.filter(row => row.periodId === workingPeriodId && row.status === 'DISTRIBUTED');
      const source = records.length > 0 ? records : employees
        .filter(employee => employee.employmentStatus !== 'TERMINATED')
        .map(employee => {
          const prior = payrollRecords
            .filter(row => row.employeeId === employee.id)
            .sort((a, b) => (payrollPeriods.find(item => item.id === b.payrollPeriodId)?.startDate || '').localeCompare(payrollPeriods.find(item => item.id === a.payrollPeriodId)?.startDate || ''))[0];
          const contract = contracts.find(row => row.employeeId === employee.id && row.status === 'active');
          return {
            id: `pr_${period.id}_${employee.employeeCode}`,
            payrollPeriodId: period.id,
            employeeId: employee.id,
            basicSalary: prior?.basicSalary || contract?.basicSalary || 0,
            allowance: prior?.allowance || contract?.allowance || 0,
            overtime: 0,
            serviceCharge: 0,
            grossPay: 0,
            totalDeductions: 0,
            netPay: 0,
            status: 'DRAFT',
          };
        });
      const updatedRecords = source.map(record => {
        const employee = getEmp(record.employeeId);
        const monthlyWage = record.basicSalary + record.allowance;
        const overtime = overtimeRequests
          .filter(request => request.employeeId === record.employeeId && request.status === 'APPROVED' && request.date >= period.startDate && request.date <= period.endDate)
          .reduce((sum, request) => sum + calculateOvertimePay(monthlyWage, request.totalMinutes, payPolicy.highSeasonDates.includes(request.date), payPolicy).overtimePay, 0);
        const unpaidDays = leaveRequests
          .filter(request => request.employeeId === record.employeeId && request.status === 'APPROVED')
          .reduce((sum, request) => {
            const leaveType = leaveTypes.find(type => type.id === request.leaveTypeId);
            if (!leaveType || leaveType.isPaid) return sum;
            return sum + overlapDays(request.startDate, request.endDate, period.startDate, period.endDate);
          }, 0);
        const serviceCharge = periodDistributions
          .filter(row => row.payrollRecordId === record.id || row.employeeId === record.employeeId)
          .reduce((sum, row) => sum + row.amount, 0);
        const result = calculatePeriodPay({
          basicSalary: record.basicSalary,
          allowance: record.allowance,
          overtime,
          serviceCharge,
          unpaidLeaveDeduction: unpaidLeaveDeduction(monthlyWage, unpaidDays),
          ptkpCode: employee?.ptkpCode || 'TK/0',
          rates,
          terTables,
        });
        return { ...record, ...result, status: 'CALCULATED' as const };
      });

      const newItems: typeof payrollItems = [];
      updatedRecords.forEach(record => {
        const lines: Array<[string, string, 'EARNING' | 'DEDUCTION', number]> = [
          ['BASIC', 'Basic Salary', 'EARNING', record.basicSalary],
          ['ALLOW', 'Allowance', 'EARNING', record.allowance],
          ['OTIME', 'Overtime Pay', 'EARNING', record.overtime],
          ['SERVCHG', 'Service Charge', 'EARNING', record.serviceCharge],
          ['UNPAID', 'Unpaid Leave', 'DEDUCTION', record.unpaidLeaveDeduction || 0],
          ['BPJS_KES', 'BPJS Kesehatan (employee)', 'DEDUCTION', record.bpjsHealth || 0],
          ['BPJS_JHT', 'BPJS JHT (employee)', 'DEDUCTION', record.bpjsJht || 0],
          ['BPJS_JP', 'BPJS JP (employee)', 'DEDUCTION', record.bpjsJp || 0],
          ['PPh21', 'PPh 21 Income Tax', 'DEDUCTION', record.pph21 || 0],
        ];
        lines.forEach(([code, name, category, amount]) => {
          if (amount <= 0 && code !== 'BASIC' && code !== 'ALLOW') return;
          newItems.push({
            id: `pi_${record.id}_${code}`,
            payrollRecordId: record.id,
            componentCode: code,
            componentName: name,
            category,
            quantity: 1,
            rate: amount,
            amount,
            source_type: code.toLowerCase(),
            source_id: record.employeeId,
          });
        });
      });

      const calculated = updatedRecords.map(({ unpaidLeaveDeduction: _unpaid, bpjsHealth: _health, bpjsJht: _jht, bpjsJp: _jp, bpjsEmployee: _emp, bpjsEmployerHealth: _eh, bpjsEmployerJht: _ej, bpjsEmployerJp: _ep, pph21: _tax, terRate: _rate, ...record }) => record);
      setPayrollItems(prev => [
        ...prev.filter(item => !source.some(record => record.id === item.payrollRecordId)),
        ...newItems,
      ]);
      setPayrollRecords(prev => records.length > 0
        ? prev.map(record => calculated.find(updated => updated.id === record.id) || record)
        : [...prev, ...calculated]);
      if (period.status === 'DRAFT') {
        setPayrollPeriods(prev => prev.map(row => row.id === period.id ? { ...row, status: 'CALCULATED' as const } : row));
      }

      const gross = calculated.reduce((sum, record) => sum + record.grossPay, 0);
      addAuditLog('CALCULATE', 'PayrollPeriod', workingPeriodId || '', `Payroll ${period.periodCode} calculated from attendance inputs. Gross: ${formatCurrency(gross)}`);
      addNotification('GENERAL', 'Payroll Calculated', `Payroll ${period.periodCode} calculated. Total gross: ${formatCurrency(gross)}`);
      addToast(`Payroll ${period.periodCode} calculated from approved overtime, unpaid leave, service charge, BPJS, and TER`, 'success');
      setIsCalculating(false);
    }, 600);
  };

  const handleSubmitForReview = () => {
    if (!period) return;
    const lines = records.map(record => {
      const employee = getEmp(record.employeeId);
      return {
        employeeId: record.employeeId,
        employeeName: employee?.fullName || record.employeeId,
        employeeCode: employee?.employeeCode || '',
        basicSalary: record.basicSalary,
        allowance: record.allowance,
        overtime: record.overtime,
        serviceCharge: record.serviceCharge,
        grossPay: record.grossPay,
        totalDeductions: record.totalDeductions,
        netPay: record.netPay,
      };
    });
    setPayrollPacks(prev => [{
      id: `pack${Date.now()}`,
      periodId: period.id,
      periodCode: period.periodCode,
      startDate: period.startDate,
      endDate: period.endDate,
      payDate: period.payDate,
      status: 'UNDER_REVIEW',
      submittedAt: new Date().toISOString(),
      submittedBy: user?.fullName || 'Payroll',
      lines,
      totalGross,
      totalDeductions,
      totalNet,
    }, ...prev.filter(pack => pack.periodId !== period.id || pack.status === 'RETURNED')]);
    setPayrollPeriods(prev => prev.map(p => p.id === workingPeriodId ? { ...p, status: 'UNDER_REVIEW' as const } : p));
    addAuditLog('UPDATE', 'PayrollPeriod', workingPeriodId || '', 'Submitted to Payroll Review');
    addNotification('GENERAL', 'Payroll Submitted', `Payroll ${period.periodCode} is locked in Payroll Review`);
    addToast(`${period.periodCode} is locked in Payroll Review for the director and finance.`, 'success');
    setShowConfirmModal(null);
  };

  const handleFinalize = () => {
    setPayrollPeriods(prev => prev.map(p => p.id === workingPeriodId ? { ...p, status: 'FINALIZED' as const, finalizedAt: new Date().toISOString() } : p));
    addAuditLog('FINALIZE', 'PayrollPeriod', workingPeriodId || '', `Payroll ${period?.periodCode} finalized`);
    addNotification('PAYROLL_FINALIZED', 'Payroll Finalized', `Payroll ${period?.periodCode} has been finalized and locked`);
    addToast(`Payroll ${period?.periodCode} finalized successfully. Records are now locked.`, 'success');
    setShowConfirmModal(null);
  };

  const handleExport = () => {
    if (!period || records.length === 0) {
      addToast('Calculate payroll before exporting this period.', 'error');
      return;
    }
    const filename = downloadPayrollExport(exportFormat, {
      periodCode: period.periodCode,
      status: period.status,
      startDate: period.startDate,
      endDate: period.endDate,
      payDate: period.payDate,
    }, records.map(record => {
      const employee = getEmp(record.employeeId);
      return {
        employeeCode: employee?.employeeCode || '',
        employeeName: employee?.fullName || record.employeeId,
        department: employee ? getDept(employee.departmentId) : '',
        basicSalary: record.basicSalary,
        allowance: record.allowance,
        overtime: record.overtime,
        serviceCharge: record.serviceCharge,
        grossPay: record.grossPay,
        totalDeductions: record.totalDeductions,
        netPay: record.netPay,
      };
    }));
    addToast(`Downloaded ${filename}. Finalizing is not required.`, 'success');
  };

  const isFinalized = period?.status === 'FINALIZED' || period?.status === 'LOCKED';
  const reviewLocked = period?.status === 'UNDER_REVIEW' || period?.status === 'APPROVED' || isFinalized;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Payroll</h1>
          <p className="text-slate-500 text-sm mt-1">Calculate the working period from overtime, unpaid leave, and service charge inside its dates.</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {period && (
            <>
              <label className="text-sm text-slate-600" htmlFor="payroll-export-format">Export</label>
              <select
                id="payroll-export-format"
                value={exportFormat}
                onChange={event => setExportFormat(event.target.value as PayrollExportFormat)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-800"
              >
                <option value="csv">CSV</option>
                <option value="xlsx">Excel</option>
                <option value="pdf">PDF</option>
              </select>
              <button onClick={handleExport} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 inline-flex items-center gap-2">
                <Download size={16} /> Download
              </button>
            </>
          )}
          {period && !reviewLocked && (
            <button onClick={handleCalculate} disabled={isCalculating} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isCalculating ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}>
              {isCalculating ? 'Calculating...' : (<><Calculator size={16} className="mr-2" />Calculate Payroll</>)}
            </button>
          )}
          {period && !isFinalized && period.status === 'CALCULATED' && (
            <button onClick={() => setShowConfirmModal('review')} className="px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-sm font-medium hover:bg-amber-100">
              Submit for Review
            </button>
          )}
          {period && period.status === 'APPROVED' && (
            <button onClick={() => setShowConfirmModal('finalize')} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
              Finalize Payroll
            </button>
          )}
        </div>
      </div>

      {!numbersMatch && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <AlertTriangle size={20} className="text-red-600 mr-2" />
          <p className="text-sm text-red-800">
            <strong>Payroll out of balance:</strong> Component total ({formatCurrency(calculatedGross)}) does not match stored gross ({formatCurrency(totalGross)}). Click "Calculate Payroll" to reconcile.
          </p>
        </div>
      )}

      <PeriodBar />

      {period && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4"><p className="text-sm text-slate-500">Period</p><p className="text-lg font-bold text-slate-800">{period.periodCode}</p><p className="text-xs text-slate-400">{period.startDate} to {period.endDate}</p></div>
          <div className="bg-white rounded-xl border border-slate-200 p-4"><p className="text-sm text-slate-500">Basic Salary</p><p className="text-lg font-bold text-slate-800">{formatCurrency(totalBasic)}</p><p className="text-xs text-slate-400">{records.length} employees</p></div>
          <div className="bg-white rounded-xl border border-slate-200 p-4"><p className="text-sm text-slate-500">Allowance + Overtime</p><p className="text-lg font-bold text-slate-800">{formatCurrency(totalAllowance + totalOvertime)}</p><p className="text-xs text-slate-400">Service Charge: {formatCurrency(totalServiceCharge)}</p></div>
          <div className="bg-white rounded-xl border border-slate-200 p-4"><p className="text-sm text-slate-500">Total Gross</p><p className="text-lg font-bold text-slate-800">{formatCurrency(totalGross)}</p><p className="text-xs text-slate-400">{numbersMatch ? '✓ Balanced' : '✗ Out of balance'}</p></div>
          <div className="bg-white rounded-xl border border-slate-200 p-4"><p className="text-sm text-slate-500">Total Deductions</p><p className="text-lg font-bold text-red-600">{formatCurrency(totalDeductions)}</p><p className="text-xs text-slate-400">BPJS + Tax</p></div>
          <div className="bg-white rounded-xl border border-slate-200 p-4"><p className="text-sm text-slate-500">Total Net Pay</p><p className="text-lg font-bold text-emerald-600">{formatCurrency(totalNet)}</p><p className="text-xs text-slate-400">Pay date: {period.payDate}</p></div>
        </div>
      )}

      {period?.status === 'UNDER_REVIEW' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm font-medium text-amber-800">Sent to Payroll Review</p>
          <p className="text-sm text-amber-700">The frozen pack is with the director and finance. Calculate stays off until they send it back.</p>
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
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-slate-500" />
            <h3 className="font-semibold text-slate-800">Payroll Records</h3>
          </div>
          <div className="text-sm text-slate-500">{records.length} records</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Employee</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Department</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">Basic</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">Allowance</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">Overtime</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">Service Charge</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">Gross</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">Deductions</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">Net Pay</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-sm text-slate-500">
                    No payroll lines for {period?.periodCode}. {isFinalized
                      ? 'This period is closed, so the attendance, leave, overtime, and service charge above stay as a record of that date range.'
                      : 'Calculate payroll to build a line for each employee from their last basic salary and allowance, then apply overtime, unpaid leave, and service charge dated inside this period.'}
                  </td>
                </tr>
              )}
              {records.map(record => {
                const emp = getEmp(record.employeeId);
                const isExpanded = expandedRecord === record.id;
                const items = getRecordItems(record.id);
                const earnings = items.filter(i => i.category === 'EARNING');
                const deductions = items.filter(i => i.category === 'DEDUCTION');
                const servDist = recordHasServiceChargeDist(record.id);
                return (
                  <>
                    <tr key={record.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center text-xs font-bold text-indigo-600">{emp?.fullName.charAt(0)}</div>
                          <div>
                            <p className="text-sm font-medium text-slate-800">{emp?.fullName}</p>
                            <p className="text-xs text-slate-500">{emp?.employeeCode}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{emp ? getDept(emp.departmentId) : '-'}</td>
                      <td className="px-4 py-3 text-sm text-right text-slate-600">{formatCurrency(record.basicSalary)}</td>
                      <td className="px-4 py-3 text-sm text-right text-slate-600">{formatCurrency(record.allowance)}</td>
                      <td className="px-4 py-3 text-sm text-right text-slate-600">{formatCurrency(record.overtime)}</td>
                      <td className={`px-4 py-3 text-sm text-right text-slate-600 font-medium ${servDist ? 'text-indigo-600' : ''}`}>{formatCurrency(record.serviceCharge)}{servDist ? ' *' : ''}</td>
                      <td className="px-4 py-3 text-sm text-right text-slate-800 font-medium">{formatCurrency(record.grossPay)}</td>
                      <td className="px-4 py-3 text-sm text-right text-red-600">{formatCurrency(record.totalDeductions)}</td>
                      <td className="px-4 py-3 text-sm text-right text-emerald-700 font-medium">{formatCurrency(record.netPay)}</td>
                      <td className="px-4 py-3"><button onClick={() => setExpandedRecord(isExpanded ? null : record.id)} className="text-slate-400 hover:text-slate-600">{isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button></td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${record.id}-detail`} className="bg-slate-50">
                        <td colSpan={10} className="px-4 py-4">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-slate-500 text-xs mb-1">EARNINGS</p>
                              <div className="space-y-1">
                                {earnings.map(item => (
                                  <div key={item.id} className="flex justify-between">
                                    <span className="text-slate-600">{item.componentName}</span>
                                    <span className="text-slate-800 font-medium">{formatCurrency(item.amount)}</span>
                                  </div>
                                ))}
                                {servDist && (
                                  <div className="flex justify-between text-xs text-indigo-600 pt-1 border-t border-indigo-100">
                                    <span className="text-slate-600">Service Charge (distributed)</span>
                                    <span className="text-indigo-600 font-medium">+ included above</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div>
                              <p className="text-slate-500 text-xs mb-1">DEDUCTIONS</p>
                              <div className="space-y-1">
                                {deductions.map(item => (
                                  <div key={item.id} className="flex justify-between">
                                    <span className="text-slate-600">{item.componentName}</span>
                                    <span className="text-red-600 font-medium">-{formatCurrency(item.amount)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div>
                              <p className="text-slate-500 text-xs mb-1">VERIFICATION</p>
                              <div className="space-y-1">
                                <div className="flex justify-between">
                                  <span className="text-slate-600">Components Sum</span>
                                  <span className="text-slate-800 font-medium">{formatCurrency(record.basicSalary + record.allowance + record.overtime + record.serviceCharge)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-600">Stored Gross</span>
                                  <span className={`text-slate-800 font-medium ${record.grossPay === record.basicSalary + record.allowance + record.overtime + record.serviceCharge ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {formatCurrency(record.grossPay)}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-600">Net = Gross - Deduct.</span>
                                  <span className={`text-slate-800 font-medium ${record.netPay === record.grossPay - record.totalDeductions ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {formatCurrency(record.netPay)}
                                  </span>
                                </div>
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
                          {servDist && (
                            <div className="mt-3 p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                              <p className="text-xs text-indigo-700 mb-1">
                                <CheckCircle size={12} className="mr-1 text-indigo-600" />
                                Service charge has been distributed to this employee via Service Charge Distribution. The distributed amount is included in Service Charge earnings above.
                              </p>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-200 bg-slate-50 p-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-slate-500">Service Charge Total</p>
              <p className="text-sm font-bold text-slate-800">{formatCurrency(totalServiceCharge)}</p>
            </div>
            <div className="text-xs text-slate-400">
              {serviceChargeDistCount > 0 ? `* = ${serviceChargeDistCount} employee(s) received service charge distribution` : ''}
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modals */}
      <Modal isOpen={showConfirmModal === 'review'} onClose={() => setShowConfirmModal(null)} title="Submit for Review">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
            <AlertTriangle size={20} className="text-amber-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">Confirm Submission</p>
              <p className="text-sm text-amber-700 mt-1">This freezes <strong>{period?.periodCode}</strong> as a payroll pack in Payroll Review. The director or finance accepts it or sends it back. Calculate stays locked while it is there.</p>
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
