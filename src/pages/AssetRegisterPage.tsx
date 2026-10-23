import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Package, Search, Plus, ArrowRightLeft } from 'lucide-react';
import Modal from '../components/Modal';
import { AssetCategory, CompanyAsset } from '../types';

const CATEGORIES: { id: AssetCategory; label: string }[] = [
  { id: 'LAPTOP', label: 'Laptop' },
  { id: 'PHONE', label: 'Phone' },
  { id: 'UNIFORM', label: 'Uniform' },
  { id: 'KEYS', label: 'Keys' },
  { id: 'OTHER', label: 'Other' },
];

const CONDITIONS = ['New', 'Good', 'Fair', 'Damaged'];

const blankIssue = {
  name: '',
  code: '',
  category: 'LAPTOP' as AssetCategory,
  employeeId: '',
  issuedOn: '',
  condition: 'Good',
  notes: '',
};

export default function AssetRegisterPage() {
  const { employees, companyAssets, setCompanyAssets, addToast, addAuditLog } = useApp();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showIssue, setShowIssue] = useState(false);
  const [issueForm, setIssueForm] = useState(blankIssue);
  const [handoverAssetId, setHandoverAssetId] = useState<string | null>(null);
  const [handover, setHandover] = useState({
    action: 'RETURN' as 'RETURN' | 'TRANSFER' | 'ISSUE',
    date: '',
    toEmployeeId: '',
    condition: 'Good',
    notes: '',
  });

  const assignable = employees.filter(person => person.employmentStatus === 'ACTIVE' || person.employmentStatus === 'PROBATION' || person.employmentStatus === 'ON_LEAVE');
  const getEmp = (id: string | null) => employees.find(person => person.id === id);
  const categoryLabel = (id: AssetCategory) => CATEGORIES.find(row => row.id === id)?.label || id;

  const filtered = companyAssets.filter(asset => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    const holder = getEmp(asset.holderId);
    const holderName = holder?.fullName.toLowerCase() || '';
    return asset.name.toLowerCase().includes(query) || holderName.includes(query);
  });

  const selected = companyAssets.find(asset => asset.id === selectedId) || null;
  const handingOver = companyAssets.find(asset => asset.id === handoverAssetId) || null;

  const openHandover = (asset: CompanyAsset) => {
    setHandoverAssetId(asset.id);
    setSelectedId(asset.id);
    setHandover({
      action: asset.holderId ? 'RETURN' : 'ISSUE',
      date: '',
      toEmployeeId: '',
      condition: 'Good',
      notes: '',
    });
  };

  const handleIssue = () => {
    const name = issueForm.name.trim();
    const code = issueForm.code.trim();
    if (!name || !code || !issueForm.employeeId || !issueForm.issuedOn || !issueForm.condition.trim()) {
      addToast('Asset name, code or serial, employee, issue date, and condition are required.', 'error');
      return;
    }
    const holder = getEmp(issueForm.employeeId);
    if (!holder) {
      addToast('Choose an employee from the list.', 'error');
      return;
    }
    const now = new Date().toISOString();
    const asset: CompanyAsset = {
      id: `asset${Date.now()}`,
      name,
      code,
      category: issueForm.category,
      holderId: holder.id,
      issuedOn: issueForm.issuedOn,
      conditionOnIssue: issueForm.condition,
      notes: issueForm.notes.trim() || undefined,
      returnedOn: null,
      history: [{
        id: `mv${Date.now()}`,
        kind: 'ISSUE',
        date: issueForm.issuedOn,
        fromEmployeeId: null,
        toEmployeeId: holder.id,
        condition: issueForm.condition,
        notes: issueForm.notes.trim() || undefined,
        recordedAt: now,
      }],
      createdAt: now,
    };
    setCompanyAssets(prev => [asset, ...prev]);
    addAuditLog('CREATE', 'CompanyAsset', asset.id, `${asset.name} (${asset.code}) issued to ${holder.fullName}`);
    addToast(`${asset.name} issued to ${holder.fullName}`, 'success');
    setSelectedId(asset.id);
    setShowIssue(false);
    setIssueForm(blankIssue);
  };

  const handleHandover = () => {
    if (!handingOver) return;
    const condition = handover.condition.trim();
    if (!handover.date || !condition) {
      addToast('Handover date and condition are required.', 'error');
      return;
    }
    const fromId = handingOver.holderId;
    const fromName = getEmp(fromId)?.fullName || 'the company';

    if (handover.action === 'RETURN') {
      if (!fromId) {
        addToast('This asset is already in store.', 'error');
        return;
      }
      const movement = {
        id: `mv${Date.now()}`,
        kind: 'RETURN' as const,
        date: handover.date,
        fromEmployeeId: fromId,
        toEmployeeId: null,
        condition,
        notes: handover.notes.trim() || undefined,
        recordedAt: new Date().toISOString(),
      };
      setCompanyAssets(prev => prev.map(row => row.id === handingOver.id ? {
        ...row,
        holderId: null,
        returnedOn: handover.date,
        conditionOnReturn: condition,
        history: [...row.history, movement],
      } : row));
      addAuditLog('UPDATE', 'CompanyAsset', handingOver.id, `${handingOver.name} returned by ${fromName}. Condition: ${condition}`);
      addToast(`${handingOver.name} is back in store`, 'success');
      setHandoverAssetId(null);
      return;
    }

    if (handover.action === 'TRANSFER' || handover.action === 'ISSUE') {
      if (handover.action === 'TRANSFER' && !fromId) {
        addToast('This asset is in store. Issue it to a staff member.', 'error');
        return;
      }
      const to = getEmp(handover.toEmployeeId);
      if (!to || to.id === fromId) {
        addToast('Choose a different employee to receive the asset.', 'error');
        return;
      }
      const movement = {
        id: `mv${Date.now()}`,
        kind: (handover.action === 'TRANSFER' ? 'TRANSFER' : 'ISSUE') as 'TRANSFER' | 'ISSUE',
        date: handover.date,
        fromEmployeeId: fromId,
        toEmployeeId: to.id,
        condition,
        notes: handover.notes.trim() || undefined,
        recordedAt: new Date().toISOString(),
      };
      setCompanyAssets(prev => prev.map(row => row.id === handingOver.id ? {
        ...row,
        holderId: to.id,
        issuedOn: handover.action === 'ISSUE' ? handover.date : row.issuedOn,
        conditionOnIssue: handover.action === 'ISSUE' ? condition : row.conditionOnIssue,
        returnedOn: null,
        conditionOnReturn: undefined,
        history: [...row.history, movement],
      } : row));
      const detail = handover.action === 'TRANSFER'
        ? `${handingOver.name} transferred from ${fromName} to ${to.fullName}`
        : `${handingOver.name} issued from store to ${to.fullName}`;
      addAuditLog('UPDATE', 'CompanyAsset', handingOver.id, `${detail}. Condition: ${condition}`);
      addToast(detail, 'success');
      setHandoverAssetId(null);
    }
  };

  const movementText = (kind: 'ISSUE' | 'RETURN' | 'TRANSFER', fromId: string | null, toId: string | null) => {
    const from = getEmp(fromId)?.fullName || 'the company';
    const to = getEmp(toId)?.fullName || 'the company';
    if (kind === 'ISSUE') return `Issued to ${to}`;
    if (kind === 'RETURN') return `Returned by ${from}`;
    return `Transferred from ${from} to ${to}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Asset Register</h1>
          <p className="text-slate-500 text-sm mt-1">{companyAssets.length} company assets • {companyAssets.filter(asset => asset.holderId).length} currently with staff</p>
        </div>
        <button
          onClick={() => setShowIssue(true)}
          disabled={assignable.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus size={16} /> Issue asset
        </button>
      </div>

      {employees.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-sm text-slate-600">
          There are no employees yet. Hire someone before issuing company assets. This register does not invent staff.
        </div>
      )}
      {employees.length > 0 && assignable.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-sm text-slate-600">
          No active employees are available to receive an asset.
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search by employee or asset name"
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {companyAssets.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 text-center py-12 text-slate-500">
          <Package size={40} className="mx-auto mb-3 text-slate-300" />
          <p className="font-medium text-slate-700">No assets issued yet</p>
          <p className="text-sm mt-1 max-w-md mx-auto">Issue the first asset to record a laptop, phone, uniform, keys, or other company item given to a staff member.</p>
        </div>
      )}

      {companyAssets.length > 0 && filtered.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 text-center py-12 text-slate-500">
          <p>No assets match that employee or asset name.</p>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Asset</th>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Current holder</th>
                <th className="px-4 py-3 font-medium">Issued</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(asset => (
                <tr key={asset.id} className={`border-t border-slate-100 ${selectedId === asset.id ? 'bg-indigo-50/40' : ''}`}>
                  <td className="px-4 py-3">
                    <button onClick={() => setSelectedId(asset.id)} className="font-medium text-slate-800 text-left hover:text-indigo-700">{asset.name}</button>
                    {asset.notes && <p className="text-xs text-slate-500 mt-0.5">{asset.notes}</p>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{asset.code}</td>
                  <td className="px-4 py-3 text-slate-600">{categoryLabel(asset.category)}</td>
                  <td className="px-4 py-3">
                    {asset.holderId ? (
                      <span className="text-slate-800">{getEmp(asset.holderId)?.fullName || 'Unknown employee'}</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">In store</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{asset.issuedOn || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openHandover(asset)} className="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-700 hover:bg-slate-50">
                      <ArrowRightLeft size={12} /> {asset.holderId ? 'Handover' : 'Issue from store'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="font-semibold text-slate-800">{selected.name}</h2>
              <p className="text-sm text-slate-500">{selected.code} · {categoryLabel(selected.category)} · condition on issue: {selected.conditionOnIssue}</p>
              {selected.returnedOn && <p className="text-sm text-slate-500">Returned {selected.returnedOn}{selected.conditionOnReturn ? ` · condition on return: ${selected.conditionOnReturn}` : ''}</p>}
            </div>
            <button onClick={() => openHandover(selected)} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700">
              {selected.holderId ? 'Record handover' : 'Issue from store'}
            </button>
          </div>
          <h3 className="text-sm font-medium text-slate-700 mb-2">History</h3>
          <div className="space-y-2">
            {selected.history.map(movement => (
              <div key={movement.id} className="flex items-start justify-between gap-3 border border-slate-100 rounded-lg px-3 py-2">
                <div>
                  <p className="text-sm text-slate-800">{movementText(movement.kind, movement.fromEmployeeId, movement.toEmployeeId)}</p>
                  <p className="text-xs text-slate-500">{movement.date} · {movement.condition}{movement.notes ? ` · ${movement.notes}` : ''}</p>
                </div>
                <span className="text-xs text-slate-400">{movement.kind}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal isOpen={showIssue} onClose={() => setShowIssue(false)} title="Issue asset">
        <div className="space-y-4">
          {assignable.length === 0 && (
            <p className="text-sm text-slate-600">There are no employees to issue an asset to.</p>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Asset name *</label>
            <input value={issueForm.name} onChange={event => setIssueForm({ ...issueForm, name: event.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Front office laptop" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Asset code or serial *</label>
            <input value={issueForm.code} onChange={event => setIssueForm({ ...issueForm, code: event.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="LT-1042" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category *</label>
              <select value={issueForm.category} onChange={event => setIssueForm({ ...issueForm, category: event.target.value as AssetCategory })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                {CATEGORIES.map(row => <option key={row.id} value={row.id}>{row.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Condition on issue *</label>
              <select value={issueForm.condition} onChange={event => setIssueForm({ ...issueForm, condition: event.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                {CONDITIONS.map(row => <option key={row} value={row}>{row}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Employee *</label>
            <select value={issueForm.employeeId} onChange={event => setIssueForm({ ...issueForm, employeeId: event.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option value="">Select employee</option>
              {assignable.map(person => <option key={person.id} value={person.id}>{person.fullName} ({person.employeeCode})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Date issued *</label>
            <input type="date" value={issueForm.issuedOn} onChange={event => setIssueForm({ ...issueForm, issuedOn: event.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea value={issueForm.notes} onChange={event => setIssueForm({ ...issueForm, notes: event.target.value })} rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Optional" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowIssue(false)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={handleIssue} disabled={assignable.length === 0} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">Issue</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!handingOver} onClose={() => setHandoverAssetId(null)} title={handingOver?.holderId ? `Handover ${handingOver.name}` : `Issue ${handingOver?.name || 'asset'} from store`}>
        {handingOver && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              {handingOver.holderId
                ? `Currently with ${getEmp(handingOver.holderId)?.fullName || 'an employee'}.`
                : 'Currently in store. Issue it to an active employee.'}
            </p>
            {handingOver.holderId && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Handover type *</label>
                <select value={handover.action} onChange={event => setHandover({ ...handover, action: event.target.value as 'RETURN' | 'TRANSFER' })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                  <option value="RETURN">Return to company</option>
                  <option value="TRANSFER">Transfer to another employee</option>
                </select>
              </div>
            )}
            {(handover.action === 'TRANSFER' || handover.action === 'ISSUE') && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">To employee *</label>
                <select value={handover.toEmployeeId} onChange={event => setHandover({ ...handover, toEmployeeId: event.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                  <option value="">Select employee</option>
                  {assignable.filter(person => person.id !== handingOver.holderId).map(person => (
                    <option key={person.id} value={person.id}>{person.fullName} ({person.employeeCode})</option>
                  ))}
                </select>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{handover.action === 'RETURN' ? 'Return date *' : 'Handover date *'}</label>
                <input type="date" value={handover.date} onChange={event => setHandover({ ...handover, date: event.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{handover.action === 'RETURN' ? 'Condition on return *' : 'Condition *'}</label>
                <select value={handover.condition} onChange={event => setHandover({ ...handover, condition: event.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                  {CONDITIONS.map(row => <option key={row} value={row}>{row}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
              <textarea value={handover.notes} onChange={event => setHandover({ ...handover, notes: event.target.value })} rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Optional" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setHandoverAssetId(null)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={handleHandover} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Save handover</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
