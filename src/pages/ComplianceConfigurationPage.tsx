import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { PTKPTable, TERTable, BPJSRates, UMKTable, ComplianceRule } from '../types';
import { Shield, Settings, Plus, AlertTriangle } from 'lucide-react';
import Modal from '../components/Modal';

const formatCurrency = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

const PTKP_OPTIONS = [
  { code: 'TK/0', label: 'TK/0 - Single, no dependents' },
  { code: 'TK/1', label: 'TK/1 - Single, 1 dependent' },
  { code: 'TK/2', label: 'TK/2 - Single, 2 dependents' },
  { code: 'TK/3', label: 'TK/3 - Single, 3 dependents' },
  { code: 'K/0', label: 'K/0 - Married, no dependents' },
  { code: 'K/1', label: 'K/1 - Married, 1 dependent' },
  { code: 'K/2', label: 'K/2 - Married, 2 dependents' },
  { code: 'K/3', label: 'K/3 - Married, 3 dependents' },
];

export default function ComplianceConfigurationPage() {
  const {
    ptkpTables, setPTKPTables,
    terTables, setTERTables,
    bpjsRates, setBPJSRates,
    umkTables, setUMKTables,
    complianceRules, setComplianceRules,
    addToast, addAuditLog,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'ptkp' | 'ter' | 'bpjs' | 'umk' | 'rules'>('ptkp');
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'ptkp' | 'ter' | 'bpjs' | 'umk' | 'rule'>('ptkp');
  const [formData, setFormData] = useState<Record<string, any>>({});

  // Edit state
  const [editingPTKP, setEditingPTKP] = useState<PTKPTable | null>(null);
  const [editingTER, setEditingTER] = useState<TERTable | null>(null);
  const [editingBPJS, setEditingBPJS] = useState<BPJSRates | null>(null);
  const [editingUMK, setEditingUMK] = useState<UMKTable | null>(null);
  const [editingRule, setEditingRule] = useState<ComplianceRule | null>(null);
  const [editPTKPData, setEditPTKPData] = useState({ code: '', label: '', annualAmount: '' });
  const [editTERData, setEditTERData] = useState({ ptkpCode: '', min: '', max: '', rate: '' });
  const [editBPJSData, setEditBPJSData] = useState({ effectiveDate: '', healthEmp: '1', healthCo: '4', healthCap: '12000000', jhtEmp: '2', jhtCo: '3.7', jpEmp: '1', jpCo: '2', jpCap: '5000000', jkk: '0.54', jkm: '0.3' });
  const [editUMKData, setEditUMKData] = useState({ region: '', province: '', umk: '', effectiveDate: '' });
  const [editRuleData, setEditRuleData] = useState({ name: '', category: 'PAYROLL', rule: '' });

  const tabs: { id: string; label: string; icon: React.ReactNode }[] = [
    { id: 'ptkp', label: 'PTKP Table', icon: <Shield size={18} /> },
    { id: 'ter', label: 'TER Table (PPh 21)', icon: <Settings size={18} /> },
    { id: 'bpjs', label: 'BPJS Rates', icon: <Shield size={18} /> },
    { id: 'umk', label: 'UMK (Regional Wage)', icon: <Settings size={18} /> },
    { id: 'rules', label: 'Compliance Rules', icon: <AlertTriangle size={18} /> },
  ];

  const ptkpChoices = Array.from(
    new Map([
      ...PTKP_OPTIONS.map(option => [option.code, option.label] as const),
      ...ptkpTables.map(row => [row.code, row.label] as const),
    ]).entries(),
  ).map(([code, label]) => ({ code, label }));

  const handleAdd = (type: 'ptkp' | 'ter' | 'bpjs' | 'umk' | 'rule') => {
    setModalType(type);
    const today = new Date().toISOString().slice(0, 10);
    if (type === 'ptkp') setFormData({ code: '', label: '', annualAmount: '' });
    else if (type === 'ter') setFormData({ ptkpCode: ptkpTables[0]?.code || 'TK/0', min: '', max: '', rate: '' });
    else if (type === 'bpjs') setFormData({
      effectiveDate: today,
      healthEmp: '1', healthCo: '4', healthCap: '12000000',
      jhtEmp: '2', jhtCo: '3.7',
      jpEmp: '1', jpCo: '2', jpCap: '5000000',
      jkk: '0.54', jkm: '0.3',
    });
    else if (type === 'umk') setFormData({ region: '', province: '', umk: '', effectiveDate: today });
    else setFormData({ name: '', category: 'PAYROLL', rule: '' });
    setShowModal(true);
  };

  const addLabel: Record<typeof activeTab, string> = {
    ptkp: 'Add PTKP',
    ter: 'Add TER bracket',
    bpjs: 'Add BPJS rates',
    umk: 'Add UMK',
    rules: 'Add rule',
  };

  const modalTitle: Record<typeof modalType, string> = {
    ptkp: 'Add PTKP',
    ter: 'Add TER bracket',
    bpjs: 'Add BPJS rates',
    umk: 'Add UMK',
    rule: 'Add compliance rule',
  };

  const handleSave = () => {
    if (modalType === 'ptkp') {
      const code = String(formData.code || '').trim();
      const amount = parseFloat(formData.annualAmount);
      if (!code) {
        addToast('Enter a PTKP code.', 'error');
        return;
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        addToast('Enter the annual non-taxable amount.', 'error');
        return;
      }
      if (ptkpTables.some(row => row.code.toUpperCase() === code.toUpperCase())) {
        addToast(`${code} is already in the PTKP table. Edit that row instead.`, 'error');
        return;
      }
      const known = PTKP_OPTIONS.find(option => option.code.toUpperCase() === code.toUpperCase());
      const entry: PTKPTable = {
        id: 'ptkp' + Date.now(),
        code: known?.code || code,
        label: String(formData.label || '').trim() || known?.label || code,
        annualAmount: amount,
        createdAt: new Date().toISOString(),
      };
      setPTKPTables(prev => [...prev, entry]);
      addAuditLog('CREATE', 'PTKPTable', entry.id, `PTKP ${entry.code} created`);
      addToast(`PTKP ${entry.code} added`, 'success');
    } else if (modalType === 'ter') {
      const ptkpCode = String(formData.ptkpCode || '').trim();
      const min = parseFloat(formData.min);
      const max = parseFloat(formData.max);
      const rate = parseFloat(formData.rate);
      if (!ptkpCode) {
        addToast('Choose a PTKP code for this bracket.', 'error');
        return;
      }
      if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
        addToast('Monthly gross max must be higher than the minimum.', 'error');
        return;
      }
      if (!Number.isFinite(rate) || rate < 0) {
        addToast('Enter a TER rate of 0 or higher.', 'error');
        return;
      }
      const entry: TERTable = {
        id: 'ter' + Date.now(),
        ptkpCode,
        monthlyGrossMin: min,
        monthlyGrossMax: max,
        terRate: rate,
        createdAt: new Date().toISOString(),
      };
      setTERTables(prev => [...prev, entry]);
      addAuditLog('CREATE', 'TERTable', entry.id, `TER ${entry.ptkpCode} ${entry.monthlyGrossMin}-${entry.monthlyGrossMax} created`);
      addToast(`TER rate ${entry.terRate}% added`, 'success');
    } else if (modalType === 'bpjs') {
      const effectiveDate = String(formData.effectiveDate || '').trim();
      if (!effectiveDate) {
        addToast('Enter the date these BPJS rates take effect.', 'error');
        return;
      }
      const entry: BPJSRates = {
        id: 'bpjs' + Date.now(),
        effectiveDate,
        healthEmployeePercent: parseFloat(formData.healthEmp) || 1,
        healthEmployerPercent: parseFloat(formData.healthCo) || 4,
        healthSalaryCap: parseFloat(formData.healthCap) || 12000000,
        jhtEmployeePercent: parseFloat(formData.jhtEmp) || 2,
        jhtEmployerPercent: parseFloat(formData.jhtCo) || 3.7,
        jpEmployeePercent: parseFloat(formData.jpEmp) || 1,
        jpEmployerPercent: parseFloat(formData.jpCo) || 2,
        jpSalaryCap: parseFloat(formData.jpCap) || 5000000,
        jkkPercent: parseFloat(formData.jkk) || 0.54,
        jkmPercent: parseFloat(formData.jkm) || 0.3,
        createdAt: new Date().toISOString(),
      };
      setBPJSRates(prev => [...prev, entry]);
      addAuditLog('CREATE', 'BPJSRates', entry.id, `BPJS rates effective ${entry.effectiveDate} created`);
      addToast('BPJS rates added', 'success');
    } else if (modalType === 'umk') {
      const region = String(formData.region || '').trim();
      const amount = parseFloat(formData.umk);
      const effectiveDate = String(formData.effectiveDate || '').trim();
      if (!region) {
        addToast('Enter the region for this UMK.', 'error');
        return;
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        addToast('Enter the UMK amount.', 'error');
        return;
      }
      if (!effectiveDate) {
        addToast('Enter the date this UMK takes effect.', 'error');
        return;
      }
      const entry: UMKTable = {
        id: 'umk' + Date.now(),
        region,
        province: String(formData.province || '').trim(),
        umk: amount,
        effectiveDate,
        createdAt: new Date().toISOString(),
      };
      setUMKTables(prev => [...prev, entry]);
      addAuditLog('CREATE', 'UMKTable', entry.id, `UMK ${entry.region} created`);
      addToast(`UMK ${entry.region} added`, 'success');
    } else if (modalType === 'rule') {
      const name = String(formData.name || '').trim();
      const rule = String(formData.rule || '').trim();
      if (!name || !rule) {
        addToast('Enter a rule name and description.', 'error');
        return;
      }
      const entry: ComplianceRule = {
        id: 'cr' + Date.now(),
        name,
        category: formData.category || 'PAYROLL',
        rule,
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      setComplianceRules(prev => [...prev, entry]);
      addAuditLog('CREATE', 'ComplianceRule', entry.id, `Rule ${entry.name} created`);
      addToast(`Rule "${entry.name}" added`, 'success');
    }
    setShowModal(false);
  };

  // ============ EDIT SAVES ============
  const handleSavePTKP = () => {
    if (!editingPTKP) return;
    setPTKPTables(prev => prev.map(p => p.id === editingPTKP.id ? { ...p, code: editPTKPData.code, label: editPTKPData.label, annualAmount: parseFloat(editPTKPData.annualAmount) || 0 } : p));
    addAuditLog('UPDATE', 'PTKPTable', editingPTKP.id, `PTKP ${editingPTKP.code} updated`);
    addToast(`PTKP ${editPTKPData.code} updated`, 'success');
    setEditingPTKP(null);
  };

  const handleSaveTER = () => {
    if (!editingTER) return;
    setTERTables(prev => prev.map(t => t.id === editingTER.id ? { ...t, ptkpCode: editTERData.ptkpCode, monthlyGrossMin: parseFloat(editTERData.min) || 0, monthlyGrossMax: parseFloat(editTERData.max) || 0, terRate: parseFloat(editTERData.rate) || 0 } : t));
    addAuditLog('UPDATE', 'TERTable', editingTER.id, `TER ${editingTER.ptkpCode} updated`);
    addToast(`TER rate ${editTERData.rate}% updated`, 'success');
    setEditingTER(null);
  };

  const handleSaveBPJS = () => {
    if (!editingBPJS) return;
    setBPJSRates(prev => prev.map(b => b.id === editingBPJS.id ? {
      ...b,
      healthEmployeePercent: parseFloat(editBPJSData.healthEmp) || 1,
      healthEmployerPercent: parseFloat(editBPJSData.healthCo) || 4,
      healthSalaryCap: parseFloat(editBPJSData.healthCap) || 12000000,
      jhtEmployeePercent: parseFloat(editBPJSData.jhtEmp) || 2,
      jhtEmployerPercent: parseFloat(editBPJSData.jhtCo) || 3.7,
      jpEmployeePercent: parseFloat(editBPJSData.jpEmp) || 1,
      jpEmployerPercent: parseFloat(editBPJSData.jpCo) || 2,
      jpSalaryCap: parseFloat(editBPJSData.jpCap) || 5000000,
      jkkPercent: parseFloat(editBPJSData.jkk) || 0.54,
      jkmPercent: parseFloat(editBPJSData.jkm) || 0.3,
    } : b));
    addAuditLog('UPDATE', 'BPJSRates', editingBPJS.id, `BPJS rates updated`);
    addToast('BPJS rates updated', 'success');
    setEditingBPJS(null);
  };

  const handleSaveUMK = () => {
    if (!editingUMK) return;
    setUMKTables(prev => prev.map(u => u.id === editingUMK.id ? { ...u, region: editUMKData.region, province: editUMKData.province, umk: parseFloat(editUMKData.umk) || 0, effectiveDate: editUMKData.effectiveDate || new Date().toISOString() } : u));
    addAuditLog('UPDATE', 'UMKTable', editingUMK.id, `UMK ${editingUMK.region} updated`);
    addToast(`UMK ${editUMKData.region} updated`, 'success');
    setEditingUMK(null);
  };

  const handleSaveRule = () => {
    if (!editingRule) return;
    setComplianceRules(prev => prev.map(r => r.id === editingRule.id ? { ...r, name: editRuleData.name, category: editRuleData.category as ComplianceRule['category'], rule: editRuleData.rule } : r));
    addAuditLog('UPDATE', 'ComplianceRule', editingRule.id, `Rule ${editingRule.name} updated`);
    addToast(`Rule "${editRuleData.name}" updated`, 'success');
    setEditingRule(null);
  };

  // ============ DELETES ============
  const handleDeletePTKP = (id: string) => {
    if (!window.confirm('Delete this PTKP entry?')) return;
    const p = ptkpTables.find(x => x.id === id);
    setPTKPTables(prev => prev.filter(x => x.id !== id));
    addAuditLog('DELETE', 'PTKPTable', id, `${p?.code} deleted`);
    addToast(`PTKP ${p?.code} deleted`, 'success');
  };

  const handleDeleteTER = (id: string) => {
    if (!window.confirm('Delete this TER entry?')) return;
    const t = terTables.find(x => x.id === id);
    setTERTables(prev => prev.filter(x => x.id !== id));
    addAuditLog('DELETE', 'TERTable', id, `${t?.ptkpCode} deleted`);
    addToast(`TER ${t?.ptkpCode} deleted`, 'success');
  };

  const handleDeleteBPJS = (id: string) => {
    if (!window.confirm('Delete this BPJS rate entry?')) return;
    setBPJSRates(prev => prev.filter(x => x.id !== id));
    addAuditLog('DELETE', 'BPJSRates', id, 'BPJS rate entry deleted');
    addToast('BPJS rate entry deleted', 'success');
  };

  const handleDeleteUMK = (id: string) => {
    if (!window.confirm('Delete this UMK entry?')) return;
    const u = umkTables.find(x => x.id === id);
    setUMKTables(prev => prev.filter(x => x.id !== id));
    addAuditLog('DELETE', 'UMKTable', id, `${u?.region} deleted`);
    addToast(`UMK ${u?.region} deleted`, 'success');
  };

  const handleDeleteRule = (id: string) => {
    if (!window.confirm('Delete this compliance rule?')) return;
    const r = complianceRules.find(x => x.id === id);
    setComplianceRules(prev => prev.filter(x => x.id !== id));
    addAuditLog('DELETE', 'ComplianceRule', id, `${r?.name} deleted`);
    addToast(`Rule "${r?.name}" deleted`, 'success');
  };

  // Toggle rule active status
  const handleToggleRule = (id: string) => {
    setComplianceRules(prev => prev.map(r => r.id === id ? { ...r, isActive: !r.isActive } : r));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Regulatory Compliance</h1>
          <p className="text-slate-500 text-sm mt-1">Payroll and file export read PTKP, TER, and BPJS, including wage caps. Leave reads the high-season rule. UMK is kept here for the January wage review.</p>
        </div>
        <button onClick={() => handleAdd(activeTab === 'rules' ? 'rule' : activeTab)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center gap-2">
          <Plus size={16} /> {addLabel[activeTab]}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-2 border-b border-slate-200">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-shrink-0 px-4 py-3 text-sm border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-indigo-500 text-indigo-600 font-medium'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ============ PTKP TABLE ============ */}
      {activeTab === 'ptkp' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Code</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Description</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">Monthly Non-Taxable (IDR)</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ptkpTables.map(p => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-medium text-slate-800">{p.code}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{p.label}</td>
                  <td className="px-4 py-3 text-sm text-right text-slate-600">{formatCurrency(p.annualAmount / 12)}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => { setEditingPTKP(p); setEditPTKPData({ code: p.code, label: p.label, annualAmount: p.annualAmount.toString() }); }} className="text-xs px-2 py-1 text-indigo-600 hover:text-indigo-800 underline underline-offset-4">Edit</button>
                    <button onClick={() => handleDeletePTKP(p.id)} className="text-xs px-2 py-1 text-red-600 hover:text-red-800 underline underline-offset-4 ml-2">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ============ TER TABLE ============ */}
      {activeTab === 'ter' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">PTKP Code</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Monthly Gross Min</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Monthly Gross Max</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">TER Rate %</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {terTables.map(t => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-medium text-slate-800">{t.ptkpCode}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{formatCurrency(t.monthlyGrossMin)}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{formatCurrency(t.monthlyGrossMax)}</td>
                  <td className="px-4 py-3 text-sm text-right text-slate-600">{t.terRate}%</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => { setEditingTER(t); setEditTERData({ ptkpCode: t.ptkpCode, min: t.monthlyGrossMin.toString(), max: t.monthlyGrossMax.toString(), rate: t.terRate.toString() }); }} className="text-xs px-2 py-1 text-indigo-600 hover:text-indigo-800 underline underline-offset-4">Edit</button>
                    <button onClick={() => handleDeleteTER(t.id)} className="text-xs px-2 py-1 text-red-600 hover:text-red-800 underline underline-offset-4 ml-2">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ============ BPJS RATES ============ */}
      {activeTab === 'bpjs' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Effective Date</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">Health (Emp/Co)</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">JHT (Emp/Co)</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">JP (Emp/Co)</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">JKK %</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">JKM %</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bpjsRates.map(b => (
                <tr key={b.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm text-slate-600">{new Date(b.effectiveDate).toLocaleDateString('id-ID')}</td>
                  <td className="px-4 py-3 text-sm text-right text-slate-600">{b.healthEmployeePercent}% / {b.healthEmployerPercent}%</td>
                  <td className="px-4 py-3 text-sm text-right text-slate-600">{b.jhtEmployeePercent}% / {b.jhtEmployerPercent}%</td>
                  <td className="px-4 py-3 text-sm text-right text-slate-600">{b.jpEmployeePercent}% / {b.jpEmployerPercent}%</td>
                  <td className="px-4 py-3 text-sm text-right text-slate-600">{b.jkkPercent}%</td>
                  <td className="px-4 py-3 text-sm text-right text-slate-600">{b.jkmPercent}%</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => { setEditingBPJS(b); setEditBPJSData({ effectiveDate: b.effectiveDate, healthEmp: b.healthEmployeePercent.toString(), healthCo: b.healthEmployerPercent.toString(), healthCap: b.healthSalaryCap.toString(), jhtEmp: b.jhtEmployeePercent.toString(), jhtCo: b.jhtEmployerPercent.toString(), jpEmp: b.jpEmployeePercent.toString(), jpCo: b.jpEmployerPercent.toString(), jpCap: b.jpSalaryCap.toString(), jkk: b.jkkPercent.toString(), jkm: b.jkmPercent.toString() }); }} className="text-xs px-2 py-1 text-indigo-600 hover:text-indigo-800 underline underline-offset-4">Edit</button>
                    <button onClick={() => handleDeleteBPJS(b.id)} className="text-xs px-2 py-1 text-red-600 hover:text-red-800 underline underline-offset-4 ml-2">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ============ UMK TABLE ============ */}
      {activeTab === 'umk' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Region</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Province</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">UMK (IDR)</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Effective Date</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {umkTables.map(u => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-medium text-slate-800">{u.region}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{u.province}</td>
                  <td className="px-4 py-3 text-sm text-right text-slate-600">{formatCurrency(u.umk)}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{new Date(u.effectiveDate).toLocaleDateString('id-ID')}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => { setEditingUMK(u); setEditUMKData({ region: u.region, province: u.province, umk: u.umk.toString(), effectiveDate: u.effectiveDate }); }} className="text-xs px-2 py-1 text-indigo-600 hover:text-indigo-800 underline underline-offset-4">Edit</button>
                    <button onClick={() => handleDeleteUMK(u.id)} className="text-xs px-2 py-1 text-red-600 hover:text-red-800 underline underline-offset-4 ml-2">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ============ COMPLIANCE RULES ============ */}
      {activeTab === 'rules' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Rule Name</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Category</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Rule Description</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase">Status</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {complianceRules.map(r => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-medium text-slate-800">{r.name}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 capitalize">{r.category}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{r.rule}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => handleToggleRule(r.id)} className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${r.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{r.isActive ? 'Active' : 'Inactive'}</button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => { setEditingRule(r); setEditRuleData({ name: r.name, category: r.category, rule: r.rule }); }} className="text-xs px-2 py-1 text-indigo-600 hover:text-indigo-800 underline underline-offset-4">Edit</button>
                    <button onClick={() => handleDeleteRule(r.id)} className="text-xs px-2 py-1 text-red-600 hover:text-red-800 underline underline-offset-4 ml-2">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ============ ADD/EDIT MODAL ============ */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={modalTitle[modalType]} size={modalType === 'bpjs' ? 'lg' : 'md'}>
        <div className="space-y-4">
          {modalType === 'ptkp' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">PTKP Code</label>
                <input list="ptkp-codes" value={formData.code || ''} onChange={e => {
                  const code = e.target.value;
                  const known = PTKP_OPTIONS.find(option => option.code.toUpperCase() === code.trim().toUpperCase());
                  setFormData(prev => {
                    const labelWasSuggested = PTKP_OPTIONS.some(option => option.label === prev.label);
                    return { ...prev, code, label: known ? known.label : (labelWasSuggested ? '' : prev.label) };
                  });
                }} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="TK/0" />
                <datalist id="ptkp-codes">
                  {PTKP_OPTIONS.map(option => <option key={option.code} value={option.code}>{option.label}</option>)}
                </datalist>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <input type="text" value={formData.label || ''} onChange={e => setFormData(prev => ({ ...prev, label: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Single, no dependents" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Annual Non-Taxable Amount (IDR)</label>
                <input type="number" step="100000" value={formData.annualAmount || ''} onChange={e => setFormData(prev => ({ ...prev, annualAmount: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
            </>
          )}
          {modalType === 'ter' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">PTKP Code</label>
                <select value={formData.ptkpCode || ''} onChange={e => setFormData(prev => ({ ...prev, ptkpCode: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                  {ptkpChoices.map(o => <option key={o.code} value={o.code}>{o.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Monthly Gross Min (IDR)</label>
                  <input type="number" step="1000" value={formData.min || ''} onChange={e => setFormData(prev => ({ ...prev, min: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Monthly Gross Max (IDR)</label>
                  <input type="number" step="1000" value={formData.max || ''} onChange={e => setFormData(prev => ({ ...prev, max: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">TER Rate (%)</label>
                <input type="number" step="0.1" value={formData.rate || ''} onChange={e => setFormData(prev => ({ ...prev, rate: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
            </>
          )}
          {modalType === 'bpjs' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Effective date</label>
                <input type="date" value={formData.effectiveDate || ''} onChange={e => setFormData(prev => ({ ...prev, effectiveDate: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                <p className="text-xs text-slate-500 mt-1">Payroll and the BPJS export use the latest effective date.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Health Employee %</label>
                  <input type="number" step="0.1" value={formData.healthEmp || 1} onChange={e => setFormData(prev => ({ ...prev, healthEmp: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Health Employer %</label>
                  <input type="number" step="0.1" value={formData.healthCo || 4} onChange={e => setFormData(prev => ({ ...prev, healthCo: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Health Salary Cap (IDR)</label>
                  <input type="number" step="1000000" value={formData.healthCap || 12000000} onChange={e => setFormData(prev => ({ ...prev, healthCap: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">JHT Employee %</label>
                  <input type="number" step="0.1" value={formData.jhtEmp || 2} onChange={e => setFormData(prev => ({ ...prev, jhtEmp: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">JHT Employer %</label>
                  <input type="number" step="0.1" value={formData.jhtCo || 3.7} onChange={e => setFormData(prev => ({ ...prev, jhtCo: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">JP Employee %</label>
                  <input type="number" step="0.1" value={formData.jpEmp || 1} onChange={e => setFormData(prev => ({ ...prev, jpEmp: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">JP Employer %</label>
                  <input type="number" step="0.1" value={formData.jpCo || 2} onChange={e => setFormData(prev => ({ ...prev, jpCo: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">JP Salary Cap (IDR)</label>
                  <input type="number" step="1000000" value={formData.jpCap || 5000000} onChange={e => setFormData(prev => ({ ...prev, jpCap: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">JKK %</label>
                  <input type="number" step="0.01" value={formData.jkk || 0.54} onChange={e => setFormData(prev => ({ ...prev, jkk: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">JKM %</label>
                  <input type="number" step="0.01" value={formData.jkm || 0.3} onChange={e => setFormData(prev => ({ ...prev, jkm: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
              </div>
            </>
          )}
          {modalType === 'umk' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Region</label>
                <input type="text" value={formData.region || ''} onChange={e => setFormData(prev => ({ ...prev, region: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="e.g. Jakarta" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Province</label>
                <input type="text" value={formData.province || ''} onChange={e => setFormData(prev => ({ ...prev, province: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="e.g. DKI Jakarta" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">UMK Amount (IDR)</label>
                <input type="number" step="1000" value={formData.umk || ''} onChange={e => setFormData(prev => ({ ...prev, umk: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Effective date</label>
                <input type="date" value={formData.effectiveDate || ''} onChange={e => setFormData(prev => ({ ...prev, effectiveDate: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
            </>
          )}
          {modalType === 'rule' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Rule Name</label>
                <input type="text" value={formData.name || ''} onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <select value={formData.category || 'PAYROLL'} onChange={e => setFormData(prev => ({ ...prev, category: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                  <option value="PAYROLL">Payroll</option>
                  <option value="LEAVE">Leave</option>
                  <option value="OVERTIME">Overtime</option>
                  <option value="TERMINATION">Termination</option>
                  <option value="ONBOARDING">Onboarding</option>
                  <option value="OFFBOARDING">Offboarding</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Rule Description</label>
                <textarea value={formData.rule || ''} onChange={e => setFormData(prev => ({ ...prev, rule: e.target.value }))} rows={3} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
            </>
          )}
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={handleSave} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Save Configuration</button>
          </div>
        </div>
      </Modal>

      {/* Edit PTKP Modal */}
      <Modal isOpen={!!editingPTKP} onClose={() => setEditingPTKP(null)} title="Edit PTKP Table">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">PTKP Code</label>
            <select value={editPTKPData.code} onChange={e => {
              const code = e.target.value;
              const known = ptkpChoices.find(option => option.code === code);
              setEditPTKPData({ ...editPTKPData, code, label: known?.label || editPTKPData.label });
            }} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
              {ptkpChoices.map(o => <option key={o.code} value={o.code}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <input type="text" value={editPTKPData.label} onChange={e => setEditPTKPData({...editPTKPData, label: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Annual Non-Taxable Amount (IDR)</label>
            <input type="number" step="100000" value={editPTKPData.annualAmount} onChange={e => setEditPTKPData({...editPTKPData, annualAmount: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => setEditingPTKP(null)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={handleSavePTKP} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Save Changes</button>
          </div>
        </div>
      </Modal>

      {/* Edit TER Modal */}
      <Modal isOpen={!!editingTER} onClose={() => setEditingTER(null)} title="Edit TER Table">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">PTKP Code</label>
            <select value={editTERData.ptkpCode} onChange={e => setEditTERData({...editTERData, ptkpCode: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
              {ptkpChoices.map(o => <option key={o.code} value={o.code}>{o.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Monthly Gross Min (IDR)</label>
              <input type="number" step="1000" value={editTERData.min} onChange={e => setEditTERData({...editTERData, min: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Monthly Gross Max (IDR)</label>
              <input type="number" step="1000" value={editTERData.max} onChange={e => setEditTERData({...editTERData, max: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">TER Rate (%)</label>
            <input type="number" step="0.1" value={editTERData.rate} onChange={e => setEditTERData({...editTERData, rate: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => setEditingTER(null)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={handleSaveTER} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Save Changes</button>
          </div>
        </div>
      </Modal>

      {/* Edit BPJS Modal */}
      <Modal isOpen={!!editingBPJS} onClose={() => setEditingBPJS(null)} title="Edit BPJS Rates">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Health Employee %</label>
              <input type="number" step="0.1" value={editBPJSData.healthEmp} onChange={e => setEditBPJSData({...editBPJSData, healthEmp: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Health Employer %</label>
              <input type="number" step="0.1" value={editBPJSData.healthCo} onChange={e => setEditBPJSData({...editBPJSData, healthCo: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Health Salary Cap (IDR)</label>
              <input type="number" step="1000000" value={editBPJSData.healthCap} onChange={e => setEditBPJSData({...editBPJSData, healthCap: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">JHT Employee %</label>
              <input type="number" step="0.1" value={editBPJSData.jhtEmp} onChange={e => setEditBPJSData({...editBPJSData, jhtEmp: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">JHT Employer %</label>
              <input type="number" step="0.1" value={editBPJSData.jhtCo} onChange={e => setEditBPJSData({...editBPJSData, jhtCo: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">JP Employee %</label>
              <input type="number" step="0.1" value={editBPJSData.jpEmp} onChange={e => setEditBPJSData({...editBPJSData, jpEmp: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">JP Employer %</label>
              <input type="number" step="0.1" value={editBPJSData.jpCo} onChange={e => setEditBPJSData({...editBPJSData, jpCo: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">JP Salary Cap (IDR)</label>
              <input type="number" step="1000000" value={editBPJSData.jpCap} onChange={e => setEditBPJSData({...editBPJSData, jpCap: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">JKK %</label>
              <input type="number" step="0.01" value={editBPJSData.jkk} onChange={e => setEditBPJSData({...editBPJSData, jkk: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">JKM %</label>
              <input type="number" step="0.01" value={editBPJSData.jkm} onChange={e => setEditBPJSData({...editBPJSData, jkm: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => setEditingBPJS(null)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={handleSaveBPJS} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Save Changes</button>
          </div>
        </div>
      </Modal>

      {/* Edit UMK Modal */}
      <Modal isOpen={!!editingUMK} onClose={() => setEditingUMK(null)} title="Edit UMK Table">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Region</label>
            <input type="text" value={editUMKData.region} onChange={e => setEditUMKData({...editUMKData, region: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Province</label>
            <input type="text" value={editUMKData.province} onChange={e => setEditUMKData({...editUMKData, province: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">UMK Amount (IDR)</label>
            <input type="number" step="1000" value={editUMKData.umk} onChange={e => setEditUMKData({...editUMKData, umk: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Effective Date</label>
            <input type="date" value={editUMKData.effectiveDate} onChange={e => setEditUMKData({...editUMKData, effectiveDate: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => setEditingUMK(null)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={handleSaveUMK} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Save Changes</button>
          </div>
        </div>
      </Modal>

      {/* Edit Rule Modal */}
      <Modal isOpen={!!editingRule} onClose={() => setEditingRule(null)} title="Edit Compliance Rule">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Rule Name</label>
            <input type="text" value={editRuleData.name} onChange={e => setEditRuleData({...editRuleData, name: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
            <select value={editRuleData.category} onChange={e => setEditRuleData({...editRuleData, category: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option value="PAYROLL">Payroll</option>
              <option value="LEAVE">Leave</option>
              <option value="OVERTIME">Overtime</option>
              <option value="TERMINATION">Termination</option>
              <option value="ONBOARDING">Onboarding</option>
              <option value="OFFBOARDING">Offboarding</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Rule Description</label>
            <textarea value={editRuleData.rule} onChange={e => setEditRuleData({...editRuleData, rule: e.target.value})} rows={3} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => setEditingRule(null)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={handleSaveRule} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Save Changes</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
