import { useState, useEffect } from 'react';
import { connectionApi } from '../services/api';
import { Database, Wifi, WifiOff } from 'lucide-react';

export default function ConnectionStatus() {
  const [status, setStatus] = useState<{
    connected: boolean;
    mode: string;
    message: string;
  }>({
    connected: false,
    mode: 'Checking...',
    message: 'Checking connection...',
  });

  useEffect(() => {
    const checkConnection = async () => {
      const result = await connectionApi.getStatus();
      setStatus(result);
    };

    checkConnection();
    const interval = setInterval(checkConnection, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium ${
      status.connected 
        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
        : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
    }`}>
      {status.connected ? (
        <>
          <Database size={14} />
          <span>{status.mode}</span>
        </>
      ) : (
        <>
          <WifiOff size={14} />
          <span>Demo Mode</span>
        </>
      )}
    </div>
  );
}
