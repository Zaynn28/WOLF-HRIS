import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { bpjsShares } from '../lib/payrollEngine';
import { FileText, Download, Banknote, Building2, AlertTriangle, Save, Loader2 } from 'lucide-react';
import Modal from '../components/Modal';
import PeriodBar from '../components/PeriodBar';

const formatCurrency = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

export default function IntegrationExportPage() {
  const {
    payrollRecords: allPayrollRecords,
    payrollPeriods: allPayrollPeriods,
    payrollItems,
    employees: allEmployees,
    bpjsRates,
    workingPeriodId,
    accountingPosts, setAccountingPosts,
    addToast, addAuditLog,
  } = useApp();
  const [exportType, setExportType] = useState<'bank' | 'accounting' | 'ebupot' | 'bpjs'>('bank');
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<string | null>(null);
  const [downloadName, setDownloadName] = useState('');

  const period = allPayrollPeriods.find(p => p.id === workingPeriodId);
  const records = allPayrollRecords.filter(r => r.payrollPeriodId === workingPeriodId);
  const itemAmount = (recordId: string, code: string) => payrollItems
    .filter(item => item.payrollRecordId === recordId && item.componentCode === code)
    .reduce((sum, item) => sum + item.amount, 0);
  const latestBpjs = [...bpjsRates].sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))[0];

  const exportTypes = [
    { id: 'bank', label: 'Bank Transfer File (H2H/Bulk)', icon: <Banknote size={16} /> },
    { id: 'accounting', label: 'Accounting Journal (GL)', icon: <Building2 size={16} /> },
    { id: 'ebupot', label: 'e-Bupot / PPh 21 (Coretax)', icon: <FileText size={16} /> },
    { id: 'bpjs', label: 'BPJS Contribution File (SIPP)', icon: <AlertTriangle size={16} /> },
  ];

  const journalLines = () => {
    const lines = ['DATE,ACCOUNT_CODE,ACCOUNT_NAME,DEBIT,CREDIT,COST_CENTER,DESCRIPTION'];
    let totalDebit = 0;
    let totalCredit = 0;
    const payDate = period?.payDate || new Date().toISOString().split('T')[0];
    records.forEach(record => {
      const emp = allEmployees.find(person => person.id === record.employeeId);
      const dept = emp?.departmentId;
      const costCenter = dept === '550e8400-e29b-41d4-a716-446655440001' ? 'CC-FB' : dept === '550e8400-e29b-41d4-a716-446655440003' ? 'CC-FO' : 'CC-GEN';
      lines.push(`${payDate},5101,Salary Expense,${record.grossPay},,${costCenter},Gaji ${emp?.fullName} ${period?.periodCode}`);
      lines.push(`${payDate},1102,Salary Payable,,${record.netPay},${costCenter},Gaji ${emp?.fullName} ${period?.periodCode}`);
      lines.push(`${payDate},2101,Deductions Payable,,${record.totalDeductions},${costCenter},BPJS+Tax ${emp?.fullName} ${period?.periodCode}`);
      totalDebit += record.grossPay;
      totalCredit += record.netPay + record.totalDeductions;
    });
    return { text: lines.join('\n'), totalDebit, totalCredit };
  };

  const postJournal = () => {
    if (!period || (period.status !== 'FINALIZED' && period.status !== 'LOCKED')) {
      addToast('Finalize the period before posting it to accounting.', 'error');
      return;
    }
    if (accountingPosts.some(post => post.periodId === period.id)) {
      addToast(`${period.periodCode} is already in the accounting book.`, 'warning');
      return;
    }
    const journal = journalLines();
    const reference = `PAY-${period.periodCode}`;
    setAccountingPosts(prev => [{
      id: `acct${Date.now()}`,
      periodId: period.id,
      periodCode: period.periodCode,
      reference,
      destination: 'Session accounting book',
      postedAt: new Date().toISOString(),
      totalDebit: journal.totalDebit,
      totalCredit: journal.totalCredit,
      journal: journal.text,
    }, ...prev]);
    addAuditLog('CREATE', 'AccountingPost', period.id, `${reference} posted`);
    addToast(`${reference} posted to the session accounting book.`, 'success');
  };

  const handleExport = () => {
    setExporting(true);
    setTimeout(() => {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      let content = '';
      let filename = '';

      if (exportType === 'bank') {
        // Bank H2H bulk transfer file
        const lines: string[] = [];
        lines.push('NO,REKENING,NAMA,NAMA_BANK,JUMLAH,KETERANGAN');
        let total = 0;
        records.forEach((r, i) => {
          const emp = allEmployees.find(e => e.id === r.employeeId);
          if (emp) {
            lines.push(`${i + 1},${emp.bankAccountNumber || 'N/A'},${emp.fullName},${emp.bankName || 'N/A'},${r.netPay},Gaji ${period?.periodCode}`);
            total += r.netPay;
          }
        });
        lines.push(`TOTAL,,,,${total}`);
        content = lines.join('\n');
        filename = `bank_transfer_${period?.periodCode}_${timestamp}.csv`;
      } else if (exportType === 'accounting') {
        // Accounting journal entries per cost center
        const lines: string[] = [];
        lines.push('DATE,ACCOUNT_CODE,ACCOUNT_NAME,DEBIT,CREDIT,COST_CENTER,DESCRIPTION');
        const payDate = period?.payDate || new Date().toISOString().split('T')[0];
        let totalDebit = 0, totalCredit = 0;
        records.forEach(r => {
          const emp = allEmployees.find(e => e.id === r.employeeId);
          const dept = emp?.departmentId;
          const costCenter = dept === '550e8400-e29b-41d4-a716-446655440001' ? 'CC-FB' : dept === '550e8400-e29b-41d4-a716-446655440003' ? 'CC-FO' : 'CC-GEN';
          // Debit: salary expense
          lines.push(`${payDate},5101,Salary Expense,${r.grossPay},,${costCenter},Gaji ${emp?.fullName} ${period?.periodCode}`);
          totalDebit += r.grossPay;
          // Credit: cash payable
          lines.push(`${payDate},1102,Salary Payable,,${r.netPay},${costCenter},Gaji ${emp?.fullName} ${period?.periodCode}`);
          totalCredit += r.netPay;
          // Credit: deductions payable (BPJS, tax)
          const deductions = r.totalDeductions;
          lines.push(`${payDate},2101,Deductions Payable,,${deductions},${costCenter},BPJS+Tax ${emp?.fullName} ${period?.periodCode}`);
          totalCredit += deductions;
        });
        content = lines.join('\n');
        filename = `accounting_journal_${period?.periodCode}_${timestamp}.csv`;
      } else if (exportType === 'ebupot') {
        // e-Bupot / PPh 21 format
        const lines: string[] = [];
        lines.push('NO,NIK,NPWP,NAMA,GROSS,BPJS_JHT,BPJS_JP,NET_PH,PPh21,PTKP');
        records.forEach((r, i) => {
          const emp = allEmployees.find(e => e.id === r.employeeId);
          if (emp) {
            const shares = bpjsShares(r.basicSalary + r.allowance, latestBpjs);
            const jht = itemAmount(r.id, 'BPJS_JHT') || shares.jhtEmployee;
            const jp = itemAmount(r.id, 'BPJS_JP') || shares.jpEmployee;
            const pph21 = itemAmount(r.id, 'PPh21');
            lines.push(`${i + 1},${emp.nik || 'N/A'},${emp.npwp || 'N/A'},${emp.fullName},${r.grossPay},${jht},${jp},${r.netPay},${pph21},${emp.ptkpCode || 'TK/0'}`);
          }
        });
        content = lines.join('\n');
        filename = `ebupot_pph21_${period?.periodCode}_${timestamp}.csv`;
      } else if (exportType === 'bpjs') {
        // BPJS contribution file
        const lines: string[] = [];
        lines.push('NO,NIK,NAMA,KESEHATAN_EMP,KESEHATAN_CO,JHT_EMP,JHT_CO,JP_EMP,JP_CO');
        records.forEach((r, i) => {
          const emp = allEmployees.find(e => e.id === r.employeeId);
          if (emp) {
            const shares = bpjsShares(r.basicSalary + r.allowance, latestBpjs);
            lines.push(`${i + 1},${emp.nik || 'N/A'},${emp.fullName},${shares.healthEmployee},${shares.healthEmployer},${shares.jhtEmployee},${shares.jhtEmployer},${shares.jpEmployee},${shares.jpEmployer}`);
          }
        });
        content = lines.join('\n');
        filename = `bpjs_contribution_${period?.periodCode}_${timestamp}.csv`;
      }

      setExportResult(content);
      setDownloadName(filename);
      addAuditLog('EXPORT', `Integration${exportType.toUpperCase()}`, workingPeriodId, `Exported ${exportType} for ${period?.periodCode}`);
      addToast(`${exportTypes.find(t => t.id === exportType)?.label} exported`, 'success');
      setExporting(false);
    }, 800);
  };

  const downloadResult = () => {
    if (!exportResult) return;
    const blob = new Blob([exportResult], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadName || `${exportType}_${period?.periodCode || 'period'}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">System Integration & Export</h1>
          <p className="text-slate-500 text-sm mt-1">Files use the payroll lines of the working period.</p>
        </div>
      </div>

      <PeriodBar />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Period</p>
          <p className="text-lg font-bold text-slate-800">{period?.periodCode || '-'}</p>
          <p className="text-xs text-slate-400">{period?.startDate} to {period?.endDate}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Employees</p>
          <p className="text-lg font-bold text-slate-800">{records.length}</p>
          <p className="text-xs text-slate-400">payroll records</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Total Net Pay</p>
          <p className="text-lg font-bold text-emerald-600">{formatCurrency(records.reduce((sum, r) => sum + r.netPay, 0))}</p>
        </div>
      </div>

      {/* Export type selector */}
      <div className="flex gap-2 overflow-x-auto pb-2 border-b border-slate-200">
        {exportTypes.map(t => (
          <button
            key={t.id}
            onClick={() => setExportType(t.id as any)}
            className={`flex-shrink-0 px-4 py-2 rounded-lg border text-sm transition-colors ${
              exportType === t.id ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Export preview and action */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">Export Preview</h3>
          <button
            onClick={handleExport}
            disabled={exporting}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              exporting ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
          >
            {exporting ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Download size={16} className="mr-2" />}Generate File
          </button>
        </div>
        <div className="p-4 overflow-x-auto font-mono text-xs">
          {exportResult ? (
            <pre className="text-slate-600">{exportResult.split('\n').slice(0, 20).join('\n')}{exportResult.split('\n').length > 20 ? '\n...' : ''}</pre>
          ) : (
            <div className="text-slate-400 text-center py-8">No export generated yet. Select export type and click Generate File.</div>
          )}
        </div>
        {exportResult && (
          <div className="border-t border-slate-200 bg-slate-50 p-4 flex justify-between items-center">
            <div className="text-sm text-slate-500">Ready to download: {downloadName}</div>
            <button onClick={downloadResult} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center gap-2">
              <Download size={16} /> Download CSV
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-slate-800">Accounting ledger</h3>
            <p className="text-sm text-slate-500">Posts the finalized journal into this session’s accounting book. The CSV above is the same journal you can still download.</p>
          </div>
          <button
            onClick={postJournal}
            disabled={period?.status !== 'FINALIZED' && period?.status !== 'LOCKED'}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm disabled:bg-slate-200 disabled:text-slate-400"
          >
            Post journal
          </button>
        </div>
        {accountingPosts.length === 0 && <p className="text-sm text-slate-500">Nothing posted yet.</p>}
        {accountingPosts.map(post => (
          <div key={post.id} className="border border-slate-200 rounded-lg p-3 text-sm">
            <p className="font-medium text-slate-800">{post.reference} · {post.destination}</p>
            <p className="text-slate-500">Debit {formatCurrency(post.totalDebit)} · Credit {formatCurrency(post.totalCredit)} · {new Date(post.postedAt).toLocaleString()}</p>
            <pre className="mt-2 text-xs text-slate-600 overflow-x-auto">{post.journal.split('\n').slice(0, 6).join('\n')}</pre>
          </div>
        ))}
      </div>

      {/* Integration info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
          <h4 className="text-sm font-bold text-blue-800 mb-2">Bank Integration (H2H)</h4>
          <p className="text-xs text-blue-600">Export bulk transfer file for BCA, Mandiri, BNI, BRI. Format: CSV with account number, name, amount.</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
          <h4 className="text-sm font-bold text-blue-800 mb-2">Accounting Journal</h4>
          <p className="text-xs text-blue-600">Auto-generated GL entries per cost center. Salary expense, salary payable, deductions payable.</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
          <h4 className="text-sm font-bold text-blue-800 mb-2">Compliance Reports</h4>
          <p className="text-xs text-blue-600">e-Bupot PPh 21, BPJS SIPP, SPT Masa, WLKP annual reports.</p>
        </div>
      </div>
    </div>
  );
}
