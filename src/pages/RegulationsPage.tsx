import { useState } from 'react';
import { Save, AlertCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function RegulationsPage() {
  const { addToast } = useApp();
  
  const [config, setConfig] = useState({
    // BPJS Configuration
    bpjsKesEmployee: 1.0,
    bpjsKesEmployer: 4.0,
    bpjsTKEmployee: 2.0,
    bpjsTKEmployer: 3.7,
    bpjsTKJHT: 3.7,
    bpjsTKJP: 2.0,
    
    // Tax Configuration (PPh 21)
    ptkpTK0: 54000000,
    ptkpK0: 58500000,
    ptkpK1: 63000000,
    ptkpK2: 67500000,
    ptkpK3: 72000000,
    taxRate1: 5,
    taxRate2: 15,
    taxRate3: 25,
    taxBracket1: 60000000,
    taxBracket2: 250000000,
    
    // Overtime Rates
    overtimeWeekday: 1.5,
    overtimeWeekend: 2.0,
    overtimeHoliday: 3.0,
    overtimeMaxHours: 4,
    
    // Leave Configuration
    annualLeaveAfter1Year: 12,
    annualLeaveAfter5Years: 15,
    sickLeaveMax: 183,
    maternityLeave: 90,
    paternityLeave: 2,
    
    // Salary Configuration
    minSalary: 4500000,
    serviceChargePercent: 2.5,
    
    // Working Hours
    workDaysPerWeek: 5,
    workHoursPerDay: 8,
    breakMinutes: 60,
  });

  const handleSave = () => {
    // In real app, this would save to database
    localStorage.setItem('regulations_config', JSON.stringify(config));
    addToast('Regulations configuration saved successfully', 'success');
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset to default values?')) {
      setConfig({
        bpjsKesEmployee: 1.0,
        bpjsKesEmployer: 4.0,
        bpjsTKEmployee: 2.0,
        bpjsTKEmployer: 3.7,
        bpjsTKJHT: 3.7,
        bpjsTKJP: 2.0,
        ptkpTK0: 54000000,
        ptkpK0: 58500000,
        ptkpK1: 63000000,
        ptkpK2: 67500000,
        ptkpK3: 72000000,
        taxRate1: 5,
        taxRate2: 15,
        taxRate3: 25,
        taxBracket1: 60000000,
        taxBracket2: 250000000,
        overtimeWeekday: 1.5,
        overtimeWeekend: 2.0,
        overtimeHoliday: 3.0,
        overtimeMaxHours: 4,
        annualLeaveAfter1Year: 12,
        annualLeaveAfter5Years: 15,
        sickLeaveMax: 183,
        maternityLeave: 90,
        paternityLeave: 2,
        minSalary: 4500000,
        serviceChargePercent: 2.5,
        workDaysPerWeek: 5,
        workHoursPerDay: 8,
        breakMinutes: 60,
      });
      addToast('Configuration reset to defaults', 'info');
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Regulations & Tariffs Configuration</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Configure Indonesian labor law regulations and company tariffs</p>
        </div>
      </div>

      {/* Warning */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle size={20} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800 dark:text-amber-300">
          <p className="font-semibold mb-1">Important:</p>
          <p>Changes to these configurations will affect payroll calculations and leave entitlements. Make sure to verify with current Indonesian labor laws (UU Ketenagakerjaan No. 13/2003 and UU Cipta Kerja).</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* BPJS Configuration */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">BPJS Configuration (%)</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                BPJS Kesehatan - Employee
              </label>
              <input
                type="number"
                step="0.1"
                value={config.bpjsKesEmployee}
                onChange={(e) => setConfig({ ...config, bpjsKesEmployee: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Default: 1% of salary</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                BPJS Kesehatan - Employer
              </label>
              <input
                type="number"
                step="0.1"
                value={config.bpjsKesEmployer}
                onChange={(e) => setConfig({ ...config, bpjsKesEmployer: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Default: 4% of salary</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                BPJS Ketenagakerjaan - Employee (JKK + JKM)
              </label>
              <input
                type="number"
                step="0.1"
                value={config.bpjsTKEmployee}
                onChange={(e) => setConfig({ ...config, bpjsTKEmployee: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Default: 2% of salary</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                BPJS Ketenagakerjaan - Employer (JHT + JP + JKK + JKM)
              </label>
              <input
                type="number"
                step="0.1"
                value={config.bpjsTKEmployer}
                onChange={(e) => setConfig({ ...config, bpjsTKEmployer: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Default: 3.7% of salary</p>
            </div>
          </div>
        </div>

        {/* Tax Configuration */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">PPh 21 (Income Tax) Configuration</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                PTKP TK/0 (Tidak Kawin, 0 Tanggungan)
              </label>
              <input
                type="number"
                value={config.ptkpTK0}
                onChange={(e) => setConfig({ ...config, ptkpTK0: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Default: {formatCurrency(54000000)}/year</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                PTKP K/3 (Kawin, 3 Tanggungan)
              </label>
              <input
                type="number"
                value={config.ptkpK3}
                onChange={(e) => setConfig({ ...config, ptkpK3: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Default: {formatCurrency(72000000)}/year</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Tax Rate Tier 1 (%)
              </label>
              <input
                type="number"
                step="0.5"
                value={config.taxRate1}
                onChange={(e) => setConfig({ ...config, taxRate1: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Default: 5% for income up to {formatCurrency(60000000)}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Tax Rate Tier 2 (%)
              </label>
              <input
                type="number"
                step="0.5"
                value={config.taxRate2}
                onChange={(e) => setConfig({ ...config, taxRate2: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Default: 15% for income {formatCurrency(60000000)} - {formatCurrency(250000000)}</p>
            </div>
          </div>
        </div>

        {/* Overtime Configuration */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">Overtime Rates</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Weekday Overtime Multiplier
              </label>
              <input
                type="number"
                step="0.1"
                value={config.overtimeWeekday}
                onChange={(e) => setConfig({ ...config, overtimeWeekday: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Default: 1.5x hourly rate</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Weekend Overtime Multiplier
              </label>
              <input
                type="number"
                step="0.1"
                value={config.overtimeWeekend}
                onChange={(e) => setConfig({ ...config, overtimeWeekend: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Default: 2.0x hourly rate</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Holiday Overtime Multiplier
              </label>
              <input
                type="number"
                step="0.1"
                value={config.overtimeHoliday}
                onChange={(e) => setConfig({ ...config, overtimeHoliday: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Default: 3.0x hourly rate</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Maximum Overtime Hours per Day
              </label>
              <input
                type="number"
                value={config.overtimeMaxHours}
                onChange={(e) => setConfig({ ...config, overtimeMaxHours: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Default: 4 hours (per Indonesian labor law)</p>
            </div>
          </div>
        </div>

        {/* Leave Configuration */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">Leave Entitlements (Days)</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Annual Leave (after 1 year)
              </label>
              <input
                type="number"
                value={config.annualLeaveAfter1Year}
                onChange={(e) => setConfig({ ...config, annualLeaveAfter1Year: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Default: 12 days (per Indonesian labor law)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Annual Leave (after 5 years)
              </label>
              <input
                type="number"
                value={config.annualLeaveAfter5Years}
                onChange={(e) => setConfig({ ...config, annualLeaveAfter5Years: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Default: 15 days</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Maternity Leave
              </label>
              <input
                type="number"
                value={config.maternityLeave}
                onChange={(e) => setConfig({ ...config, maternityLeave: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Default: 90 days (per Indonesian labor law)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Paternity Leave
              </label>
              <input
                type="number"
                value={config.paternityLeave}
                onChange={(e) => setConfig({ ...config, paternityLeave: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Default: 2 days (per Indonesian labor law)</p>
            </div>
          </div>
        </div>

        {/* Salary Configuration */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">Salary Configuration</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Minimum Salary (UMR)
              </label>
              <input
                type="number"
                value={config.minSalary}
                onChange={(e) => setConfig({ ...config, minSalary: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Default: {formatCurrency(4500000)}/month</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Service Charge Percentage (%)
              </label>
              <input
                type="number"
                step="0.1"
                value={config.serviceChargePercent}
                onChange={(e) => setConfig({ ...config, serviceChargePercent: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Default: 2.5% of revenue</p>
            </div>
          </div>
        </div>

        {/* Working Hours */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">Working Hours</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Work Days per Week
              </label>
              <input
                type="number"
                value={config.workDaysPerWeek}
                onChange={(e) => setConfig({ ...config, workDaysPerWeek: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Default: 5 days (40 hours/week)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Work Hours per Day
              </label>
              <input
                type="number"
                value={config.workHoursPerDay}
                onChange={(e) => setConfig({ ...config, workHoursPerDay: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Default: 8 hours</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Break Time (minutes)
              </label>
              <input
                type="number"
                value={config.breakMinutes}
                onChange={(e) => setConfig({ ...config, breakMinutes: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Default: 60 minutes</p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-6 border-t border-slate-200 dark:border-slate-700">
        <button
          onClick={handleReset}
          className="px-6 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
        >
          Reset to Defaults
        </button>
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
        >
          <Save size={16} />
          Save Configuration
        </button>
      </div>
    </div>
  );
}
