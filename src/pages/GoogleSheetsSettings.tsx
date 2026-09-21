import { useState, useEffect } from 'react';
import { sheetsService, SHEETS, SHEET_HEADERS } from '../services/googleSheets';
import { dataProvider } from '../services/dataProvider';
import { 
  Database, CheckCircle, XCircle, AlertCircle, ExternalLink, 
  Key, FileSpreadsheet, RefreshCw, Wifi, WifiOff, Loader2,
  Copy, Check
} from 'lucide-react';
import Modal from '../components/Modal';
import { useApp } from '../context/AppContext';

export default function GoogleSheetsSettings() {
  const { addToast } = useApp();
  const [spreadsheetId, setSpreadsheetId] = useState(
    localStorage.getItem('atrium_sheet_id') || ''
  );
  const [clientId, setClientId] = useState(
    localStorage.getItem('atrium_client_id') || ''
  );
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('');
  const [sheetCount, setSheetCount] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [copiedField, setCopiedField] = useState('');

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    const savedSheetId = localStorage.getItem('atrium_sheet_id');
    const savedClientId = localStorage.getItem('atrium_client_id');
    
    if (savedSheetId && savedClientId) {
      setSpreadsheetId(savedSheetId);
      setClientId(savedClientId);
      
      try {
        await sheetsService.initialize(savedSheetId, savedClientId);
        if (sheetsService.isAuthenticated()) {
          setIsConnected(true);
          dataProvider.setUseGoogleSheets(true);
          setConnectionStatus('Connected to Google Sheets');
        }
      } catch (e) {
        setConnectionStatus('Not connected');
      }
    } else {
      setConnectionStatus('Not configured');
    }
  };

  const handleConnect = async () => {
    if (!spreadsheetId || !clientId) {
      addToast('Please enter both Spreadsheet ID and Client ID', 'error');
      return;
    }

    setIsConnecting(true);
    setConnectionStatus('Connecting...');

    try {
      // Save credentials
      localStorage.setItem('atrium_sheet_id', spreadsheetId);
      localStorage.setItem('atrium_client_id', clientId);

      // Initialize service
      await sheetsService.initialize(spreadsheetId, clientId);

      // Sign in
      const success = await sheetsService.signIn();
      
      if (success) {
        setIsConnected(true);
        dataProvider.setUseGoogleSheets(true);
        setConnectionStatus('Connected successfully!');
        addToast('Connected to Google Sheets!', 'success');
        
        // Sync initial data
        await syncDataToSheets();
      } else {
        setConnectionStatus('Authentication failed');
        addToast('Authentication failed. Please try again.', 'error');
      }
    } catch (error: any) {
      setConnectionStatus(`Error: ${error.message}`);
      addToast(`Connection failed: ${error.message}`, 'error');
    }

    setIsConnecting(false);
  };

  const handleDisconnect = () => {
    sheetsService.signOut();
    setIsConnected(false);
    dataProvider.setUseGoogleSheets(false);
    localStorage.removeItem('atrium_sheet_id');
    localStorage.removeItem('atrium_client_id');
    setConnectionStatus('Disconnected');
    addToast('Disconnected from Google Sheets', 'info');
  };

  const syncDataToSheets = async () => {
    try {
      addToast('Syncing data to Google Sheets...', 'info');
      
      const entities = ['employees', 'departments', 'positions', 'shifts', 'attendance', 'leaveRequests', 'overtimeRequests', 'payrollPeriods', 'payrollRecords', 'documents', 'auditLogs', 'leaveTypes'] as const;
      
      for (const entity of entities) {
        const data = await dataProvider.getAll(entity);
        const sheetName = (SHEETS as any)[entity.toUpperCase()];
        if (sheetName && SHEET_HEADERS[sheetName]) {
          await sheetsService.writeSheet(sheetName, data as Record<string, any>[]);
        }
      }
      
      addToast('Data synced to Google Sheets successfully!', 'success');
    } catch (error: any) {
      addToast(`Sync failed: ${error.message}`, 'error');
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(''), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Database size={24} className="text-indigo-600" />
            Google Sheets Database
          </h1>
          <p className="text-slate-500 text-sm mt-1">Connect ATRIUM HRIS to Google Sheets as your database</p>
        </div>
        <button onClick={() => setShowHelp(true)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200">
          Setup Guide
        </button>
      </div>

      {/* Connection Status */}
      <div className={`rounded-xl border p-6 ${isConnected ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isConnected ? (
              <Wifi size={24} className="text-emerald-600" />
            ) : (
              <WifiOff size={24} className="text-slate-400" />
            )}
            <div>
              <p className={`font-semibold ${isConnected ? 'text-emerald-800' : 'text-slate-700'}`}>
                {isConnected ? 'Connected to Google Sheets' : 'Not Connected'}
              </p>
              <p className="text-sm text-slate-500">{connectionStatus}</p>
            </div>
          </div>
          {isConnected && (
            <div className="flex gap-2">
              <a
                href={sheetsService.getSpreadsheetUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-3 py-1.5 bg-white border border-emerald-200 text-emerald-700 rounded-lg text-sm hover:bg-emerald-50"
              >
                <ExternalLink size={14} /> Open Sheet
              </a>
              <button onClick={handleDisconnect} className="px-3 py-1.5 bg-white border border-red-200 text-red-700 rounded-lg text-sm hover:bg-red-50">
                Disconnect
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Configuration Form */}
      {!isConnected && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-800 mb-4">Connection Settings</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Google Spreadsheet ID *
              </label>
              <input
                type="text"
                value={spreadsheetId}
                onChange={(e) => setSpreadsheetId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g. 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
              />
              <p className="text-xs text-slate-400 mt-1">
                Found in the URL: docs.google.com/spreadsheets/d/<strong>SPREADSHEET_ID</strong>/edit
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Google OAuth Client ID *
              </label>
              <input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g. 123456789-abcdef.apps.googleusercontent.com"
              />
              <p className="text-xs text-slate-400 mt-1">
                Create in Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID
              </p>
            </div>
            <button
              onClick={handleConnect}
              disabled={isConnecting || !spreadsheetId || !clientId}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isConnecting ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Connecting...
                </>
              ) : (
                <>
                  <Key size={16} /> Connect & Sign In
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Connected State - Data Management */}
      {isConnected && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-800 mb-4">Data Management</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(SHEETS).map(([key, value]) => (
                <div key={key} className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">{key}</p>
                  <p className="text-sm font-medium text-slate-700">{value}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-3 pt-4 border-t border-slate-200">
              <button
                onClick={syncDataToSheets}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
              >
                <RefreshCw size={16} /> Sync All Data to Sheets
              </button>
              <button
                onClick={() => {
                  sheetsService.clearCache();
                  addToast('Cache cleared', 'info');
                }}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200"
              >
                Clear Cache
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Warnings */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertCircle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">Important Notes</p>
            <ul className="text-sm text-amber-700 mt-2 space-y-1 list-disc list-inside">
              <li>Google Sheets has API rate limits (60 requests/minute). Large datasets may be slow.</li>
              <li>Data is stored in your Google account. Ensure proper access controls on the spreadsheet.</li>
              <li>This integration is suitable for prototyping and small-scale use.</li>
              <li>For production with 100+ employees, migrate to PostgreSQL/Supabase.</li>
              <li>All changes are synced to both Google Sheets and localStorage as backup.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Setup Help Modal */}
      <Modal isOpen={showHelp} onClose={() => setShowHelp(false)} title="Google Sheets Setup Guide" size="lg">
        <div className="space-y-6">
          <div>
            <h4 className="font-semibold text-slate-800 mb-2">Step 1: Create Google Cloud Project</h4>
            <ol className="text-sm text-slate-600 space-y-1 list-decimal list-inside">
              <li>Go to <a href="https://console.cloud.google.com/" target="_blank" className="text-indigo-600 underline">console.cloud.google.com</a></li>
              <li>Create a new project named "atrium-hris"</li>
              <li>Enable "Google Sheets API" in APIs & Services → Library</li>
            </ol>
          </div>

          <div>
            <h4 className="font-semibold text-slate-800 mb-2">Step 2: Create OAuth Credentials</h4>
            <ol className="text-sm text-slate-600 space-y-1 list-decimal list-inside">
              <li>Go to APIs & Services → Credentials</li>
              <li>Click "Create Credentials" → "OAuth client ID"</li>
              <li>Application type: "Web application"</li>
              <li>Add authorized JavaScript origins: your app's URL</li>
              <li>Copy the Client ID</li>
            </ol>
          </div>

          <div>
            <h4 className="font-semibold text-slate-800 mb-2">Step 3: Create Google Spreadsheet</h4>
            <ol className="text-sm text-slate-600 space-y-1 list-decimal list-inside">
              <li>Create a new Google Spreadsheet</li>
              <li>Copy the Spreadsheet ID from the URL</li>
              <li>The app will automatically create required sheet tabs</li>
            </ol>
          </div>

          <div>
            <h4 className="font-semibold text-slate-800 mb-2">Step 4: Required Sheet Tabs</h4>
            <p className="text-sm text-slate-600 mb-2">Create these tabs in your spreadsheet:</p>
            <div className="grid grid-cols-2 gap-2">
              {Object.values(SHEETS).map(sheet => (
                <div key={sheet} className="flex items-center gap-2 p-2 bg-slate-50 rounded text-xs">
                  <FileSpreadsheet size={12} className="text-emerald-600" />
                  <span className="font-mono">{sheet}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Tip:</strong> After connecting, click "Sync All Data to Sheets" to populate your spreadsheet with the current data structure.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
