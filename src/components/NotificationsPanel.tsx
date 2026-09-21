import { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Bell, Check, CheckCheck } from 'lucide-react';

export default function NotificationsPanel() {
  const { notifications, markNotificationRead } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const unread = notifications.filter(n => !n.readAt);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const markAllRead = () => {
    notifications.forEach(n => { if (!n.readAt) markNotificationRead(n.id); });
  };

  const typeIcon = (type: string) => {
    switch(type) {
      case 'LEAVE_APPROVED': return '🟢';
      case 'LEAVE_REJECTED': return '🔴';
      case 'CONTRACT_EXPIRY': return '🟡';
      case 'PAYROLL_FINALIZED': return '🟣';
      case 'PAYSLIP_AVAILABLE': return '🔵';
      case 'PENDING_APPROVAL': return '🟠';
      default: return '⚪';
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
      >
        <Bell size={20} />
        {unread.length > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
            {unread.length > 9 ? '9+' : unread.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl border border-slate-200 shadow-xl z-50">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <h4 className="font-semibold text-sm text-slate-800">Notifications</h4>
            {unread.length > 0 && (
              <button onClick={markAllRead} className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                <CheckCheck size={12} /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">No notifications</p>
            ) : (
              notifications.slice(0, 10).map(n => (
                <button
                  key={n.id}
                  onClick={() => markNotificationRead(n.id)}
                  className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors ${!n.readAt ? 'bg-indigo-50/50' : ''}`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-sm">{typeIcon(n.type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!n.readAt ? 'font-medium text-slate-800' : 'text-slate-600'}`}>{n.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{n.message}</p>
                      <p className="text-xs text-slate-400 mt-1">{new Date(n.createdAt).toLocaleDateString()}</p>
                    </div>
                    {!n.readAt && <div className="w-2 h-2 bg-indigo-500 rounded-full mt-1.5 flex-shrink-0" />}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
