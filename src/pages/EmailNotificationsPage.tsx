import { useState } from 'react';
import { Mail, Send, CheckCircle, Clock, AlertCircle, Settings } from 'lucide-react';

interface EmailNotification {
  id: string;
  to: string;
  subject: string;
  template: string;
  status: 'sent' | 'pending' | 'failed';
  sentAt?: string;
  variables: Record<string, string>;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  variables: string[];
}

export default function EmailNotificationsPage() {
  const [sentEmails, setSentEmails] = useState<EmailNotification[]>([
    {
      id: 'e1',
      to: 'sari.rahayu@hotel.com',
      subject: 'Leave Request Approved',
      template: 'leave_approved',
      status: 'sent',
      sentAt: '2024-01-15T10:30:00Z',
      variables: { employeeName: 'Sari Rahayu', leaveType: 'Annual Leave', startDate: '2024-01-20', endDate: '2024-01-22', approver: 'Ahmad Wijaya' },
    },
    {
      id: 'e2',
      to: 'fajar.nugroho@hotel.com',
      subject: 'Overtime Request Pending Approval',
      template: 'overtime_pending',
      status: 'sent',
      sentAt: '2024-01-14T14:20:00Z',
      variables: { employeeName: 'Fajar Nugroho', date: '2024-01-13', hours: '3.0', reason: 'VIP dinner service' },
    },
    {
      id: 'e3',
      to: 'all.employees@hotel.com',
      subject: 'December 2023 Payslip Available',
      template: 'payslip_available',
      status: 'sent',
      sentAt: '2024-01-05T09:00:00Z',
      variables: { period: 'December 2023', payDate: '2024-01-10' },
    },
  ]);

  const [templates] = useState<EmailTemplate[]>([
    {
      id: 'leave_approved',
      name: 'Leave Approved',
      subject: 'Leave Request Approved',
      body: 'Dear {{employeeName}},\n\nYour {{leaveType}} request from {{startDate}} to {{endDate}} has been approved by {{approver}}.\n\nBest regards,\nHR Department',
      variables: ['employeeName', 'leaveType', 'startDate', 'endDate', 'approver'],
    },
    {
      id: 'leave_rejected',
      name: 'Leave Rejected',
      subject: 'Leave Request Rejected',
      body: 'Dear {{employeeName}},\n\nYour {{leaveType}} request from {{startDate}} to {{endDate}} has been rejected.\n\nReason: {{reason}}\n\nBest regards,\nHR Department',
      variables: ['employeeName', 'leaveType', 'startDate', 'endDate', 'reason'],
    },
    {
      id: 'overtime_pending',
      name: 'Overtime Pending',
      subject: 'Overtime Request Pending Approval',
      body: 'Dear {{employeeName}},\n\nYour overtime request for {{date}} ({{hours}} hours) is pending approval.\n\nReason: {{reason}}\n\nBest regards,\nHR Department',
      variables: ['employeeName', 'date', 'hours', 'reason'],
    },
    {
      id: 'payslip_available',
      name: 'Payslip Available',
      subject: '{{period}} Payslip Available',
      body: 'Dear Employee,\n\nYour payslip for {{period}} is now available. Payment will be made on {{payDate}}.\n\nPlease login to the HRIS portal to view your payslip.\n\nBest regards,\nHR Department',
      variables: ['period', 'payDate'],
    },
    {
      id: 'contract_expiry',
      name: 'Contract Expiry Warning',
      subject: 'Contract Expiry Reminder',
      body: 'Dear {{employeeName}},\n\nThis is a reminder that your employment contract will expire on {{expiryDate}}.\n\nPlease contact HR to discuss renewal options.\n\nBest regards,\nHR Department',
      variables: ['employeeName', 'expiryDate'],
    },
  ]);

  const [showCompose, setShowCompose] = useState(false);
  const [composeData, setComposeData] = useState({
    to: '',
    template: '',
    variables: {} as Record<string, string>,
  });

  const [emailSettings, setEmailSettings] = useState({
    smtpHost: 'smtp.gmail.com',
    smtpPort: '587',
    smtpUser: 'hr@hotel.com',
    fromName: 'ATRIUM HRIS',
    autoNotify: true,
  });

  const handleSendEmail = () => {
    if (!composeData.to || !composeData.template) {
      alert('Please select recipient and template');
      return;
    }

    const template = templates.find(t => t.id === composeData.template);
    if (!template) return;

    const newEmail: EmailNotification = {
      id: 'e' + Date.now(),
      to: composeData.to,
      subject: template.subject,
      template: template.id,
      status: 'sent',
      sentAt: new Date().toISOString(),
      variables: composeData.variables,
    };

    setSentEmails([newEmail, ...sentEmails]);
    setShowCompose(false);
    setComposeData({ to: '', template: '', variables: {} });
  };

  const getTemplate = (id: string) => templates.find(t => t.id === id);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent': return <CheckCircle size={16} className="text-emerald-600 dark:text-emerald-400" />;
      case 'pending': return <Clock size={16} className="text-amber-600 dark:text-amber-400" />;
      case 'failed': return <AlertCircle size={16} className="text-red-600 dark:text-red-400" />;
      default: return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent': return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400';
      case 'pending': return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400';
      case 'failed': return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
      default: return 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-400';
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const stats = {
    total: sentEmails.length,
    sent: sentEmails.filter(e => e.status === 'sent').length,
    pending: sentEmails.filter(e => e.status === 'pending').length,
    failed: sentEmails.filter(e => e.status === 'failed').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Email Notifications</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Manage email notifications and templates</p>
        </div>
        <button
          onClick={() => setShowCompose(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
        >
          <Send size={16} /> Compose Email
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Total Emails</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">{stats.total}</p>
            </div>
            <Mail size={24} className="text-slate-400 dark:text-slate-600" />
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Sent</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{stats.sent}</p>
            </div>
            <CheckCircle size={24} className="text-emerald-400 dark:text-emerald-600" />
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Pending</p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{stats.pending}</p>
            </div>
            <Clock size={24} className="text-amber-400 dark:text-amber-600" />
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Failed</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{stats.failed}</p>
            </div>
            <AlertCircle size={24} className="text-red-400 dark:text-red-600" />
          </div>
        </div>
      </div>

      {/* Email Settings */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Settings size={20} className="text-slate-600 dark:text-slate-400" />
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">Email Settings</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">SMTP Host</label>
            <input
              type="text"
              value={emailSettings.smtpHost}
              onChange={(e) => setEmailSettings({ ...emailSettings, smtpHost: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">SMTP Port</label>
            <input
              type="text"
              value={emailSettings.smtpPort}
              onChange={(e) => setEmailSettings({ ...emailSettings, smtpPort: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">SMTP User</label>
            <input
              type="text"
              value={emailSettings.smtpUser}
              onChange={(e) => setEmailSettings({ ...emailSettings, smtpUser: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">From Name</label>
            <input
              type="text"
              value={emailSettings.fromName}
              onChange={(e) => setEmailSettings({ ...emailSettings, fromName: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
            />
          </div>
        </div>
        <div className="mt-4">
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={emailSettings.autoNotify}
              onChange={(e) => setEmailSettings({ ...emailSettings, autoNotify: e.target.checked })}
              className="rounded border-slate-300"
            />
            Automatically send notifications for approvals and payslips
          </label>
        </div>
      </div>

      {/* Sent Emails */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">Recent Emails</h3>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {sentEmails.map(email => {
            const template = getTemplate(email.template);
            return (
              <div key={email.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Mail size={20} className="text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 dark:text-slate-100">{email.subject}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">To: {email.to}</p>
                      {template && (
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Template: {template.name}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${getStatusColor(email.status)}`}>
                      {getStatusIcon(email.status)}
                      {email.status}
                    </span>
                    {email.sentAt && (
                      <span className="text-xs text-slate-500 dark:text-slate-400">{formatDate(email.sentAt)}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">Compose Email</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">To</label>
                <input
                  type="email"
                  value={composeData.to}
                  onChange={(e) => setComposeData({ ...composeData, to: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                  placeholder="recipient@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Template</label>
                <select
                  value={composeData.template}
                  onChange={(e) => setComposeData({ ...composeData, template: e.target.value, variables: {} })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                >
                  <option value="">Select a template</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              {composeData.template && (() => {
                const template = getTemplate(composeData.template);
                if (!template) return null;
                return (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Template Variables</label>
                    <div className="space-y-2">
                      {template.variables.map(variable => (
                        <div key={variable}>
                          <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">{variable}</label>
                          <input
                            type="text"
                            value={composeData.variables[variable] || ''}
                            onChange={(e) => setComposeData({
                              ...composeData,
                              variables: { ...composeData.variables, [variable]: e.target.value }
                            })}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowCompose(false);
                    setComposeData({ to: '', template: '', variables: {} });
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendEmail}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
                >
                  <Send size={16} /> Send Email
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
