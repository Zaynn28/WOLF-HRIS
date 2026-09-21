import { useApp } from '../context/AppContext';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

export default function ToastContainer() {
  const { toasts, removeToast } = useApp();

  if (toasts.length === 0) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle size={18} className="text-emerald-500" />;
      case 'error': return <XCircle size={18} className="text-red-500" />;
      case 'warning': return <AlertCircle size={18} className="text-amber-500" />;
      case 'info': return <Info size={18} className="text-blue-500" />;
      default: return null;
    }
  };

  const getBg = (type: string) => {
    switch (type) {
      case 'success': return 'bg-emerald-50 border-emerald-200';
      case 'error': return 'bg-red-50 border-red-200';
      case 'warning': return 'bg-amber-50 border-amber-200';
      case 'info': return 'bg-blue-50 border-blue-200';
      default: return 'bg-slate-50 border-slate-200';
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-[200] space-y-2 max-w-sm">
      {toasts.map(toast => (
        <div key={toast.id} className={`flex items-start gap-3 p-4 rounded-xl border shadow-lg ${getBg(toast.type)} animate-in slide-in-from-right`}>
          {getIcon(toast.type)}
          <p className="flex-1 text-sm text-slate-700">{toast.message}</p>
          <button onClick={() => removeToast(toast.id)} className="text-slate-400 hover:text-slate-600">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
