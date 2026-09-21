import { useState } from 'react';
import { Brain, AlertTriangle, TrendingUp, Users, Clock, DollarSign, CheckCircle, Eye } from 'lucide-react';

interface Anomaly {
  id: string;
  type: 'attendance' | 'overtime' | 'payroll' | 'leave';
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  employeeId?: string;
  employeeName?: string;
  detectedAt: string;
  status: 'new' | 'reviewed' | 'resolved';
  details: Record<string, any>;
}

export default function AIAnomalyDetectionPage() {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([
    {
      id: 'a1',
      type: 'attendance',
      severity: 'high',
      title: 'Repeated Late Arrivals',
      description: 'Employee has been late 5 times in the past 2 weeks',
      employeeId: 'e4',
      employeeName: 'Sari Rahayu',
      detectedAt: '2024-01-15T08:00:00Z',
      status: 'new',
      details: { lateCount: 5, period: '14 days', avgLateMinutes: 18 },
    },
    {
      id: 'a2',
      type: 'overtime',
      severity: 'medium',
      title: 'Unusually High Overtime',
      description: 'Employee overtime is 150% above department average',
      employeeId: 'e5',
      employeeName: 'Rudi Hermawan',
      detectedAt: '2024-01-14T10:30:00Z',
      status: 'new',
      details: { employeeOT: 45, deptAvg: 18, percentage: 150 },
    },
    {
      id: 'a3',
      type: 'payroll',
      severity: 'high',
      title: 'Large Month-on-Month Change',
      description: 'Net pay increased by 45% compared to last month',
      employeeId: 'e3',
      employeeName: 'Budi Santoso',
      detectedAt: '2024-01-13T14:20:00Z',
      status: 'reviewed',
      details: { currentPay: 14500000, previousPay: 10000000, change: 45 },
    },
    {
      id: 'a4',
      type: 'attendance',
      severity: 'low',
      title: 'Missing Clock-Out',
      description: 'Employee forgot to clock out 3 times this month',
      employeeId: 'e8',
      employeeName: 'Nina Marlina',
      detectedAt: '2024-01-12T17:00:00Z',
      status: 'resolved',
      details: { missingCount: 3, period: 'current month' },
    },
    {
      id: 'a5',
      type: 'leave',
      severity: 'medium',
      title: 'Frequent Short Leaves',
      description: 'Employee has taken 8 single-day leaves in 2 months',
      employeeId: 'e6',
      employeeName: 'Linda Kusuma',
      detectedAt: '2024-01-11T09:15:00Z',
      status: 'new',
      details: { leaveCount: 8, period: '2 months', avgDuration: 1 },
    },
  ]);

  const [filter, setFilter] = useState<'all' | 'new' | 'reviewed' | 'resolved'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'attendance' | 'overtime' | 'payroll' | 'leave'>('all');
  const [selectedAnomaly, setSelectedAnomaly] = useState<Anomaly | null>(null);

  const filteredAnomalies = anomalies.filter(a => {
    const statusMatch = filter === 'all' || a.status === filter;
    const typeMatch = typeFilter === 'all' || a.type === typeFilter;
    return statusMatch && typeMatch;
  });

  const stats = {
    total: anomalies.length,
    new: anomalies.filter(a => a.status === 'new').length,
    high: anomalies.filter(a => a.severity === 'high').length,
    attendance: anomalies.filter(a => a.type === 'attendance').length,
    payroll: anomalies.filter(a => a.type === 'payroll').length,
  };

  const handleMarkReviewed = (id: string) => {
    setAnomalies(anomalies.map(a => a.id === id ? { ...a, status: 'reviewed' } : a));
  };

  const handleMarkResolved = (id: string) => {
    setAnomalies(anomalies.map(a => a.id === id ? { ...a, status: 'resolved' } : a));
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800';
      case 'medium': return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800';
      case 'low': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800';
      default: return 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-600';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'attendance': return <Clock size={20} className="text-indigo-600 dark:text-indigo-400" />;
      case 'overtime': return <TrendingUp size={20} className="text-purple-600 dark:text-purple-400" />;
      case 'payroll': return <DollarSign size={20} className="text-emerald-600 dark:text-emerald-400" />;
      case 'leave': return <Users size={20} className="text-amber-600 dark:text-amber-400" />;
      default: return <AlertTriangle size={20} className="text-slate-600 dark:text-slate-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
      case 'reviewed': return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400';
      case 'resolved': return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400';
      default: return 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-400';
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Brain size={28} className="text-indigo-600 dark:text-indigo-400" />
            AI Anomaly Detection
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Automated detection of unusual patterns in HR data</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">Total Anomalies</p>
          <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">{stats.total}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">New</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{stats.new}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">High Severity</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{stats.high}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">Attendance</p>
          <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">{stats.attendance}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">Payroll</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{stats.payroll}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Status</label>
            <div className="flex gap-2">
              {(['all', 'new', 'reviewed', 'resolved'] as const).map(status => (
                <button
                  key={status}
                  onClick={() => setFilter(status)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filter === status
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Type</label>
            <div className="flex gap-2">
              {(['all', 'attendance', 'overtime', 'payroll', 'leave'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setTypeFilter(type)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    typeFilter === type
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Anomalies List */}
      <div className="space-y-3">
        {filteredAnomalies.map(anomaly => (
          <div
            key={anomaly.id}
            className={`bg-white dark:bg-slate-800 rounded-xl border-2 p-5 hover:shadow-md transition-all cursor-pointer ${
              anomaly.severity === 'high' ? 'border-red-200 dark:border-red-800' :
              anomaly.severity === 'medium' ? 'border-amber-200 dark:border-amber-800' :
              'border-blue-200 dark:border-blue-800'
            }`}
            onClick={() => setSelectedAnomaly(anomaly)}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4 flex-1">
                <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center flex-shrink-0">
                  {getTypeIcon(anomaly.type)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-slate-800 dark:text-slate-100">{anomaly.title}</h3>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getSeverityColor(anomaly.severity)}`}>
                      {anomaly.severity}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(anomaly.status)}`}>
                      {anomaly.status}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">{anomaly.description}</p>
                  {anomaly.employeeName && (
                    <p className="text-xs text-slate-500 dark:text-slate-500">Employee: {anomaly.employeeName}</p>
                  )}
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Detected: {formatDate(anomaly.detectedAt)}</p>
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {anomaly.status === 'new' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMarkReviewed(anomaly.id);
                    }}
                    className="px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-lg text-sm font-medium hover:bg-amber-100 dark:hover:bg-amber-900/30"
                  >
                    Mark Reviewed
                  </button>
                )}
                {anomaly.status === 'reviewed' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMarkResolved(anomaly.id);
                    }}
                    className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-lg text-sm font-medium hover:bg-emerald-100 dark:hover:bg-emerald-900/30"
                  >
                    Mark Resolved
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedAnomaly(anomaly);
                  }}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <Eye size={16} className="text-slate-600 dark:text-slate-400" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredAnomalies.length === 0 && (
        <div className="text-center py-12 text-slate-500 dark:text-slate-400">
          <CheckCircle size={48} className="mx-auto mb-3 opacity-50" />
          <p>No anomalies found matching your filters</p>
        </div>
      )}

      {/* Detail Modal */}
      {selectedAnomaly && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center">
                  {getTypeIcon(selectedAnomaly.type)}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{selectedAnomaly.title}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getSeverityColor(selectedAnomaly.severity)}`}>
                      {selectedAnomaly.severity} severity
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(selectedAnomaly.status)}`}>
                      {selectedAnomaly.status}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedAnomaly(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">{selectedAnomaly.description}</p>
              </div>

              {selectedAnomaly.employeeName && (
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Employee</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{selectedAnomaly.employeeName}</p>
                </div>
              )}

              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Details</p>
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
                  <dl className="space-y-2">
                    {Object.entries(selectedAnomaly.details).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <dt className="text-sm text-slate-600 dark:text-slate-400 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</dt>
                        <dd className="text-sm font-medium text-slate-800 dark:text-slate-200">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Detected At</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">{formatDate(selectedAnomaly.detectedAt)}</p>
              </div>

              <div className="flex gap-3 pt-4">
                {selectedAnomaly.status === 'new' && (
                  <button
                    onClick={() => {
                      handleMarkReviewed(selectedAnomaly.id);
                      setSelectedAnomaly(null);
                    }}
                    className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700"
                  >
                    Mark as Reviewed
                  </button>
                )}
                {selectedAnomaly.status === 'reviewed' && (
                  <button
                    onClick={() => {
                      handleMarkResolved(selectedAnomaly.id);
                      setSelectedAnomaly(null);
                    }}
                    className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700"
                  >
                    Mark as Resolved
                  </button>
                )}
                <button
                  onClick={() => setSelectedAnomaly(null)}
                  className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
