import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { ServiceChargeDistribution } from '../types';
import { attendanceHours } from '../lib/payrollEngine';
import { DollarSign, Settings, Wallet, CreditCard, PieChart, Clock, AlertTriangle, Plus, Edit, Trash2, Save, ArrowRight, ChevronDown, ChevronUp, Lock } from 'lucide-react';
import Modal from '../components/Modal';
import PeriodBar from '../components/PeriodBar';

const formatCurrency = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

interface DistributionPreview {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  departmentName: string;
  baseAmount: number;
  weight: number;
  shareAmount: number;
  payrollRecordId: string | null;
}

export default function ServiceChargePage() {
  const {
    serviceChargeConfigs,
    setServiceChargeConfigs,
    serviceChargeDistributions,
    setServiceChargeDistributions,
    payrollPeriods,
    payrollRecords,
    workingPeriodId,
    employees: allEmployees,
    departments: allDepartments,
    attendance,
    shifts,
    payPolicy,
    addToast,
    addAuditLog,
    addNotification,
  } = useApp();

  const [config, setConfig] = useState<{
    serviceChargePercentage: number;
    revenueBase: number;
    totalServiceChargePool: number;
    distributionMethod: 'EQUAL' | 'BY_DEPARTMENT' | 'BY_ROLE_WEIGHT' | 'BY_HOURS';
    eligibleDepartmentIds: string[];
    roleWeights: Record<string, number>;
  }>({
    serviceChargePercentage: 10,
    revenueBase: 0,
    totalServiceChargePool: 0,
    distributionMethod: 'EQUAL',
    eligibleDepartmentIds: [],
    roleWeights: {},
  });
  const [preview, setPreview] = useState<DistributionPreview[]>([]);
  const [isDistributing, setIsDistributing] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);
  const [hoursNote, setHoursNote] = useState('');

  const period = payrollPeriods.find(p => p.id === workingPeriodId);
  const periodConfigs = serviceChargeConfigs.filter(c => c.periodId === workingPeriodId);
  const currentConfig = periodConfigs[0] || null;

  const eligibleEmployees = allEmployees.filter(e => e.employmentStatus === 'ACTIVE' && (!currentConfig || currentConfig.eligibleDepartmentIds.includes(e.departmentId)));

  const buildConfig = () => {
    const existing = serviceChargeConfigs.find(row => row.periodId === workingPeriodId);
    if (existing) {
      const percent = existing.serviceChargePercentage || payPolicy.serviceChargePercentage;
      const revenueBase = existing.revenueBase ?? (percent > 0 ? Math.round(existing.totalServiceChargePool / (percent / 100)) : 0);
      return {
        serviceChargePercentage: percent,
        revenueBase,
        totalServiceChargePool: existing.totalServiceChargePool,
        distributionMethod: existing.distributionMethod,
        eligibleDepartmentIds: [...existing.eligibleDepartmentIds],
        roleWeights: { ...existing.roleWeights },
      };
    }
    return {
      serviceChargePercentage: payPolicy.serviceChargePercentage,
      revenueBase: 0,
      totalServiceChargePool: 0,
      distributionMethod: 'EQUAL' as const,
      eligibleDepartmentIds: allDepartments.filter(department => department.isActive).map(department => department.id),
      roleWeights: {},
    };
  };

  const computePreview = (source = config) => {
    if (!source || !workingPeriodId || !period) {
      setPreview([]);
      setHoursNote('');
      return;
    }

    const eligible = allEmployees.filter(employee => employee.employmentStatus === 'ACTIVE' && (source.eligibleDepartmentIds.length === 0 || source.eligibleDepartmentIds.includes(employee.departmentId)));
    const pool = source.totalServiceChargePool;
    if (source.distributionMethod !== 'BY_HOURS') setHoursNote('');
    const previews: DistributionPreview[] = [];

    if (eligible.length === 0 || pool <= 0) {
      eligible.forEach(e => {
        const rec = payrollRecords.find(r => r.payrollPeriodId === workingPeriodId && r.employeeId === e.id);
        previews.push({
          employeeId: e.id,
          employeeName: e.fullName,
          employeeCode: e.employeeCode,
          departmentName: allDepartments.find(d => d.id === e.departmentId)?.name || '-',
          baseAmount: 0,
          weight: 0,
          shareAmount: 0,
          payrollRecordId: rec?.id || null,
        });
      });
      setHoursNote('');
      setPreview(previews);
      return;
    }

    if (source.distributionMethod === 'EQUAL') {
      const share = pool / eligible.length;
      eligible.forEach(e => {
        const rec = payrollRecords.find(r => r.payrollPeriodId === workingPeriodId && r.employeeId === e.id);
        previews.push({
          employeeId: e.id,
          employeeName: e.fullName,
          employeeCode: e.employeeCode,
          departmentName: allDepartments.find(d => d.id === e.departmentId)?.name || '-',
          baseAmount: share,
          weight: 1,
          shareAmount: share,
          payrollRecordId: rec?.id || null,
        });
      });
    } else if (source.distributionMethod === 'BY_DEPARTMENT') {
      // Group by department, split pool equally among depts, then equally among staff in dept
      const deptGroups: Record<string, typeof eligible> = {};
      eligible.forEach(e => {
        if (!deptGroups[e.departmentId]) deptGroups[e.departmentId] = [];
        deptGroups[e.departmentId].push(e);
      });
      const deptShare = pool / Object.keys(deptGroups).length;
      Object.values(deptGroups).forEach(group => {
        const share = deptShare / group.length;
        group.forEach(e => {
          const rec = payrollRecords.find(r => r.payrollPeriodId === workingPeriodId && r.employeeId === e.id);
          previews.push({
            employeeId: e.id,
            employeeName: e.fullName,
            employeeCode: e.employeeCode,
            departmentName: allDepartments.find(d => d.id === e.departmentId)?.name || '-',
            baseAmount: share,
            weight: 1,
            shareAmount: share,
            payrollRecordId: rec?.id || null,
          });
        });
      });
    } else if (source.distributionMethod === 'BY_ROLE_WEIGHT') {
      let totalWeight = 0;
      const weighted: Array<{ e: typeof eligible[0]; weight: number }> = [];
      eligible.forEach(e => {
        const w = source.roleWeights[e.positionId] || 1;
        totalWeight += w;
        weighted.push({ e, weight: w });
      });
      weighted.forEach(({ e, weight }) => {
        const share = (pool * weight) / totalWeight;
        const rec = payrollRecords.find(r => r.payrollPeriodId === workingPeriodId && r.employeeId === e.id);
        previews.push({
          employeeId: e.id,
          employeeName: e.fullName,
          employeeCode: e.employeeCode,
          departmentName: allDepartments.find(d => d.id === e.departmentId)?.name || '-',
          baseAmount: share,
          weight,
          shareAmount: share,
          payrollRecordId: rec?.id || null,
        });
      });
    } else {
      const hoursByEmployee = new Map<string, number>();
      eligible.forEach(employee => {
        const hours = attendance
          .filter(row => row.employeeId === employee.id && row.attendanceDate >= period.startDate && row.attendanceDate <= period.endDate)
          .reduce((sum, row) => {
            const shift = shifts.find(item => item.id === row.shiftId);
            return sum + attendanceHours(row.clockIn, row.clockOut, shift?.breakMinutes || 0);
          }, 0);
        hoursByEmployee.set(employee.id, hours);
      });
      const totalHours = [...hoursByEmployee.values()].reduce((sum, hours) => sum + hours, 0);
      if (totalHours <= 0) {
        setHoursNote('No clocked hours in this period, so By Hours cannot split the pool.');
        eligible.forEach(employee => {
          const rec = payrollRecords.find(row => row.payrollPeriodId === workingPeriodId && row.employeeId === employee.id);
          previews.push({
            employeeId: employee.id,
            employeeName: employee.fullName,
            employeeCode: employee.employeeCode,
            departmentName: allDepartments.find(department => department.id === employee.departmentId)?.name || '-',
            baseAmount: 0,
            weight: 0,
            shareAmount: 0,
            payrollRecordId: rec?.id || null,
          });
        });
      } else {
        setHoursNote('');
        eligible.forEach(employee => {
          const hours = hoursByEmployee.get(employee.id) || 0;
          const share = pool * hours / totalHours;
          const rec = payrollRecords.find(row => row.payrollPeriodId === workingPeriodId && row.employeeId === employee.id);
          previews.push({
            employeeId: employee.id,
            employeeName: employee.fullName,
            employeeCode: employee.employeeCode,
            departmentName: allDepartments.find(department => department.id === employee.departmentId)?.name || '-',
            baseAmount: share,
            weight: hours,
            shareAmount: share,
            payrollRecordId: rec?.id || null,
          });
        });
      }
    }

    setPreview(previews);
  };

  useEffect(() => {
    if (!workingPeriodId) return;
    const next = buildConfig();
    setConfig(next);
    computePreview(next);
  }, [workingPeriodId, serviceChargeConfigs]);

  const handleSaveConfig = () => {
    if (!config || !workingPeriodId) return;

    const existing = periodConfigs[0];
    if (existing) {
      setServiceChargeConfigs(prev => prev.map(c => c.id === existing.id ? { ...c, ...config, periodId: workingPeriodId } : c));
    } else {
      const newConfig: typeof serviceChargeConfigs[0] = {
        id: 'sc' + Date.now(),
        periodId: workingPeriodId,
        serviceChargePercentage: config.serviceChargePercentage,
        revenueBase: config.revenueBase,
        totalServiceChargePool: config.totalServiceChargePool,
        distributionMethod: config.distributionMethod,
        eligibleDepartmentIds: config.eligibleDepartmentIds,
        roleWeights: config.roleWeights,
        isActive: true,
        createdBy: 'u1',
        createdAt: new Date().toISOString(),
      };
      setServiceChargeConfigs(prev => [...prev, newConfig]);
    }
    addAuditLog('UPDATE', 'ServiceChargeConfig', workingPeriodId, `Service charge config saved for period ${period?.periodCode}`);
    addToast('Service charge configuration saved', 'success');
    setShowConfigModal(false);
    computePreview(config);
  };

  const handleDistribute = () => {
    if (!workingPeriodId || preview.length === 0) return;
    setIsDistributing(true);

    setTimeout(() => {
      const newDistributions: ServiceChargeDistribution[] = preview
        .filter(row => row.shareAmount > 0)
        .map(row => ({
          id: 'scd' + Date.now() + Math.random(),
          configId: currentConfig?.id || '',
          periodId: workingPeriodId,
          employeeId: row.employeeId,
          payrollRecordId: row.payrollRecordId || undefined,
          amount: Math.round(row.shareAmount),
          distributionBasis: `${config?.distributionMethod} - ${formatCurrency(row.shareAmount)}`,
          status: 'DISTRIBUTED' as const,
          distributedAt: new Date().toISOString(),
        }));

      setServiceChargeDistributions(prev => [
        ...prev.filter(row => row.periodId !== workingPeriodId),
        ...newDistributions,
      ]);
      const total = newDistributions.reduce((sum, row) => sum + row.amount, 0);
      addAuditLog('DISTRIBUTE', 'ServiceChargeDistribution', workingPeriodId, `Saved service charge shares totaling ${formatCurrency(total)}`);
      addNotification('SERVICE_CHARGE_DISTRIBUTED', 'Service Charge Distributed', `Service charge shares saved for ${period?.periodCode}. Calculate payroll to apply them once.`);
      addToast(`Saved ${formatCurrency(total)} across ${newDistributions.length} employees. Calculate payroll to apply it once.`, 'success');
      setIsDistributing(false);
    }, 600);
  };

  const isDistributed = (empId: string) => serviceChargeDistributions.some(d => d.periodId === workingPeriodId && d.employeeId === empId && d.status === 'DISTRIBUTED');

  const totalDistributed = preview.reduce((sum, p) => sum + p.shareAmount, 0);

  const getMethodLabel = (m: string) => {
    switch (m) {
      case 'EQUAL': return 'Equal Split';
      case 'BY_DEPARTMENT': return 'By Department';
      case 'BY_ROLE_WEIGHT': return 'By Role Weight';
      case 'BY_HOURS': return 'By Hours Worked';
      default: return m;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Service Charge Distribution</h1>
          <p className="text-slate-500 text-sm mt-1">The pool and shares below belong to the working period. Calculate payroll to apply each saved share once.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowConfigModal(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center gap-2">
            <Settings size={16} /> Configure
          </button>
        </div>
      </div>

      <PeriodBar />

      {/* Configuration summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Period</p>
          <p className="text-lg font-bold text-slate-800">{period?.periodCode || '-'}</p>
          <p className="text-xs text-slate-400">{period?.startDate} to {period?.endDate}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Service Charge %</p>
          <p className="text-lg font-bold text-slate-800">{config?.serviceChargePercentage || 0}%</p>
          <p className="text-xs text-slate-400">of revenue pool</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Total Pool</p>
          <p className="text-lg font-bold text-slate-800">{formatCurrency(config?.totalServiceChargePool || 0)}</p>
          <p className="text-xs text-slate-400">to distribute</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Distributed</p>
          <p className="text-lg font-bold text-emerald-600">{formatCurrency(totalDistributed)}</p>
          <p className="text-xs text-slate-400">{preview.filter(p => isDistributed(p.employeeId)).length} employees</p>
        </div>
      </div>

      {/* Configuration lock warning */}
      {(period?.status === 'FINALIZED' || period?.status === 'LOCKED') && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex items-start gap-3">
          <Lock size={18} className="text-purple-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-purple-800">Payroll Period Locked</p>
            <p className="text-sm text-purple-700">This payroll period has been finalized. Service charge cannot be redistributed.</p>
          </div>
        </div>
      )}

      {/* Distribution method info */}
      {config && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <DollarSign size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-slate-800">Distribution Method: <span className="text-indigo-600 font-semibold">{getMethodLabel(config.distributionMethod)}</span></p>
              <p className="text-sm text-slate-600 mt-1">
                {config.distributionMethod === 'EQUAL' && 'Pool is split equally among all eligible employees.'}
                {config.distributionMethod === 'BY_DEPARTMENT' && 'Pool is split equally among eligible departments, then equally among staff in each department.'}
                {config.distributionMethod === 'BY_ROLE_WEIGHT' && 'Pool is distributed based on role weights assigned to each position.'}
                {config.distributionMethod === 'BY_HOURS' && 'Pool is distributed from clocked hours in this payroll period.'}
              </p>
              {hoursNote && <p className="text-sm text-amber-700 mt-2">{hoursNote}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Preview table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PieChart size={16} className="text-slate-500" />
            <h3 className="font-semibold text-slate-800">Distribution Preview</h3>
          </div>
          <div className="text-sm text-slate-500">{preview.length} eligible employees</div>
        </div>
        {(period?.status === 'FINALIZED' || period?.status === 'LOCKED') || !config || config.totalServiceChargePool <= 0 ? (
          <div className="p-8 text-center text-slate-500">
          {!config || config.totalServiceChargePool <= 0 ? (
            <div>
              <AlertTriangle size={20} className="mb-2 opacity-50 inline-block" />
              <p className="text-sm">No service charge pool configured. Open configuration to set the total amount to distribute.</p>
            </div>
          ) : (
            <div>
              <Lock size={20} className="mb-2 text-purple-400 inline-block" />
              <p className="text-sm">Period is locked. Distribution cannot be modified.</p>
            </div>
          )}
        </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Employee</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Department</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">Weight</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">Share Amount</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preview.map(p => {
                  const distributed = isDistributed(p.employeeId);
                  const isExpanded = expandedRecord === p.employeeId;
                  return (
                    <>
                      <tr key={p.employeeId} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center text-xs font-bold text-indigo-600">{p.employeeName.charAt(0)}</div>
                            <div>
                              <p className="text-sm font-medium text-slate-800">{p.employeeName}</p>
                              <p className="text-xs text-slate-500">{p.employeeCode}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">{p.departmentName}</td>
                        <td className="px-4 py-3 text-sm text-right text-slate-600">{config?.distributionMethod === 'BY_ROLE_WEIGHT' ? p.weight : '1'}</td>
                        <td className="px-4 py-3 text-sm text-right text-slate-800 font-medium">{formatCurrency(p.shareAmount)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            distributed ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                          }`}>{distributed ? 'Distributed' : 'Pending'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setExpandedRecord(isExpanded ? null : p.employeeId)}
                            className="text-slate-400 hover:text-slate-600"
                          >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${p.employeeId}-detail`} className="bg-slate-50">
                          <td colSpan={6} className="px-4 py-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <p className="text-slate-500 text-xs mb-1">Share Amount</p>
                                <p className="text-sm font-medium text-slate-800">{formatCurrency(p.shareAmount)}</p>
                              </div>
                              <div>
                                <p className="text-slate-500 text-xs mb-1">Method</p>
                                <p className="text-sm text-slate-600">{getMethodLabel(config?.distributionMethod || 'EQUAL')}</p>
                              </div>
                              <div>
                                <p className="text-slate-500 text-xs mb-1">Linked Payroll</p>
                                <p className="text-sm text-slate-600">{p.payrollRecordId || 'No payroll record'}</p>
                              </div>
                              <div>
                                <p className="text-slate-500 text-xs mb-1">Status</p>
                                <p className={`text-sm font-medium ${distributed ? 'text-emerald-600' : 'text-slate-600'}`}>{distributed ? 'Distributed to Payroll' : 'Pending Distribution'}</p>
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
        )}
        <div className="border-t border-slate-200 bg-slate-50 p-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-slate-500">Total to Distribute</p>
              <p className="text-sm font-bold text-slate-800">{formatCurrency(totalDistributed)}</p>
            </div>
            <button
              onClick={handleDistribute}
              disabled={isDistributing || totalDistributed <= 0 || (period?.status === 'FINALIZED' || period?.status === 'LOCKED')}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${
                isDistributing || totalDistributed <= 0 || (period?.status === 'FINALIZED' || period?.status === 'LOCKED')
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
            >
              {isDistributing ? 'Distributing...' : 'Distribute to Payroll'}
            </button>
          </div>
        </div>
      </div>

      {/* Config Modal */}
      <Modal isOpen={showConfigModal} onClose={() => setShowConfigModal(false)} title="Service Charge Configuration">
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Service charge % (default {payPolicy.serviceChargePercentage}% from pay policy)</label>
            <input
              type="number"
              step="0.1"
              value={config?.serviceChargePercentage || 0}
              onChange={(e) => {
                const serviceChargePercentage = parseFloat(e.target.value) || 0;
                setConfig(prev => ({
                  ...prev,
                  serviceChargePercentage,
                  totalServiceChargePool: Math.round(prev.revenueBase * serviceChargePercentage / 100),
                }));
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Revenue base (IDR)</label>
            <input
              type="number"
              step="1000"
              value={config?.revenueBase || 0}
              onChange={(e) => {
                const revenueBase = parseFloat(e.target.value) || 0;
                setConfig(prev => ({
                  ...prev,
                  revenueBase,
                  totalServiceChargePool: Math.round(revenueBase * prev.serviceChargePercentage / 100),
                }));
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Pool override (IDR)</label>
            <p className="text-xs text-slate-500 mb-1">Starts as revenue × percent. Edit this only to override that amount.</p>
            <input
              type="number"
              step="1000"
              value={config?.totalServiceChargePool || 0}
              onChange={(e) => setConfig(prev => ({ ...prev, totalServiceChargePool: parseFloat(e.target.value) || 0 }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Distribution Method</label>
            <select
              value={config?.distributionMethod || 'EQUAL'}
              onChange={(e) => setConfig(prev => ({ ...prev, distributionMethod: e.target.value as any }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="EQUAL">Equal Split</option>
              <option value="BY_DEPARTMENT">By Department</option>
              <option value="BY_ROLE_WEIGHT">By Role Weight</option>
              <option value="BY_HOURS">By Hours Worked</option>
            </select>
          </div>
          {config?.distributionMethod === 'BY_ROLE_WEIGHT' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Role Weights (by position)</label>
              <p className="text-xs text-slate-500 mb-2">Assign a multiplier weight to each position. Default is 1.</p>
              {eligibleEmployees.map(e => {
                const pos = e.positionId;
                const currentWeight = config?.roleWeights[pos] || 1;
                return (
                  <div key={pos} className="flex items-center gap-3 mb-2 p-3 bg-white border border-slate-200 rounded-lg">
                    <span className="w-32 text-sm text-slate-600">{e.fullName} ({e.employeeCode})</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={currentWeight}
                      onChange={(ev) => {
                        const val = parseFloat(ev.target.value) || 1;
                        setConfig(prev => ({
                          ...prev,
                          roleWeights: { ...prev.roleWeights, [pos]: val },
                        }));
                      }}
                      className="w-20 px-2 py-1 border border-slate-300 rounded text-sm"
                    />
                  </div>
                );
              })}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Eligible Departments</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {allDepartments.map(d => {
                const isSelected = config?.eligibleDepartmentIds.includes(d.id);
                return (
                  <button
                    key={d.id}
                    onClick={() => setConfig(prev => ({
                      ...prev,
                      eligibleDepartmentIds: isSelected
                        ? prev.eligibleDepartmentIds.filter(id => id !== d.id)
                        : [...prev.eligibleDepartmentIds, d.id],
                    }))}
                    className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
                      isSelected
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {d.name}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => setShowConfigModal(false)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={handleSaveConfig} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Save Configuration</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
