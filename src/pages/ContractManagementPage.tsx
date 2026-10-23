import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { FileText, AlertTriangle, CheckCircle, XCircle, Calendar, Search } from 'lucide-react';

export default function ContractManagementPage() {
  const { employees, departments, contracts } = useApp();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'expiring' | 'expired'>('all');

  const getEmp = (id: string) => employees.find(e => e.id === id);
  const getDept = (id: string) => departments.find(d => d.id === id)?.name || '-';
  const formatCurrency = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

  const getDaysUntilExpiry = (endDate: string | null) => {
    if (!endDate) return null;
    const today = new Date();
    const expiry = new Date(endDate);
    const diff = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const filteredContracts = contracts.filter(c => {
    const emp = getEmp(c.employeeId);
    const matchesSearch = emp?.fullName.toLowerCase().includes(search.toLowerCase()) ||
                         emp?.employeeCode.toLowerCase().includes(search.toLowerCase());
    
    if (!matchesSearch) return false;

    switch (filter) {
      case 'active':
        return c.status === 'active';
      case 'expiring':
        return c.status === 'expiring';
      case 'expired':
        return c.status === 'expired';
      default:
        return true;
    }
  });

  const stats = {
    total: contracts.length,
    active: contracts.filter(c => c.status === 'active').length,
    expiring: contracts.filter(c => c.status === 'expiring').length,
    expired: contracts.filter(c => c.status === 'expired').length,
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle size={16} className="text-emerald-600" />;
      case 'expiring':
        return <AlertTriangle size={16} className="text-amber-600" />;
      case 'expired':
        return <XCircle size={16} className="text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'expiring':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'expired':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getContractTypeLabel = (type: string) => {
    switch (type) {
      case 'PKWTT':
        return 'PKWTT permanent';
      case 'PKWT':
        return 'PKWT fixed term';
      default:
        return type;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Contract Management</h1>
          <p className="text-slate-500 text-sm mt-1">Signed offers from Hiring. Payroll reads the basic salary and allowance on the active contract.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Total Contracts</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{stats.total}</p>
            </div>
            <FileText size={24} className="text-slate-400" />
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Active</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.active}</p>
            </div>
            <CheckCircle size={24} className="text-emerald-400" />
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Expiring Soon</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">{stats.expiring}</p>
            </div>
            <AlertTriangle size={24} className="text-amber-400" />
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Expired</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{stats.expired}</p>
            </div>
            <XCircle size={24} className="text-red-400" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search employee..."
                className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('active')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === 'active'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setFilter('expiring')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === 'expiring'
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Expiring
            </button>
            <button
              onClick={() => setFilter('expired')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === 'expired'
                  ? 'bg-red-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Expired
            </button>
          </div>
        </div>
      </div>

      {/* Contracts List */}
      <div className="space-y-3">
        {filteredContracts.map(contract => {
          const emp = getEmp(contract.employeeId);
          const daysUntilExpiry = getDaysUntilExpiry(contract.endDate);

          return (
            <div key={contract.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-sm font-bold text-indigo-600">
                    {emp?.fullName.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-slate-800">{emp?.fullName}</h3>
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(contract.status)}`}>
                        {getStatusIcon(contract.status)}
                        {contract.status.charAt(0).toUpperCase() + contract.status.slice(1)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 mb-3">{emp?.employeeCode} • {getDept(emp?.departmentId || '')}</p>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-slate-500 text-xs">Contract Type</p>
                        <p className="font-medium text-slate-700">{getContractTypeLabel(contract.type)}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 text-xs">Start Date</p>
                        <p className="font-medium text-slate-700">{contract.startDate}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 text-xs">End Date</p>
                        <p className="font-medium text-slate-700">{contract.endDate || 'No End Date'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 text-xs">Salary</p>
                        <p className="font-medium text-slate-700">{formatCurrency(contract.basicSalary)} + {formatCurrency(contract.allowance)}</p>
                      </div>
                    </div>

                    {daysUntilExpiry !== null && daysUntilExpiry <= 30 && (
                      <div className="mt-3 flex items-center gap-2 text-amber-600 text-sm">
                        <Calendar size={14} />
                        <span>
                          {daysUntilExpiry > 0 
                            ? `Expires in ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''}`
                            : `Expired ${Math.abs(daysUntilExpiry)} day${Math.abs(daysUntilExpiry) !== 1 ? 's' : ''} ago`
                          }
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                
              </div>
            </div>
          );
        })}
      </div>

      {filteredContracts.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <FileText size={40} className="mx-auto mb-3 text-slate-300" />
          <p>No signed contracts yet. Accept an applicant in Hiring, then sign the offer.</p>
        </div>
      )}
    </div>
  );
}
