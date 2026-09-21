import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import { ThemeProvider } from './context/ThemeContext';
import { KeyboardShortcutsProvider } from './context/KeyboardShortcutsContext';
import Sidebar from './components/Sidebar';
import ToastContainer from './components/Toast';
import NotificationCenter from './components/NotificationCenter';
import ThemeToggle from './components/ThemeToggle';
import MobileBottomNav from './components/MobileBottomNav';
import KeyboardShortcutsHelp from './components/KeyboardShortcutsHelp';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import EmployeesPage from './pages/EmployeesPage';
import AttendancePage from './pages/AttendancePage';
import LeavePage from './pages/LeavePage';
import OvertimePage from './pages/OvertimePage';
import PayrollPage from './pages/PayrollPage';
import DocumentsPage from './pages/DocumentsPage';
import ReportsPage from './pages/ReportsPage';
import AIAssistantPage from './pages/AIAssistantPage';
import AuditPage from './pages/AuditPage';
import ConfigurationPage from './pages/ConfigurationPage';
import GoogleSheetsSettings from './pages/GoogleSheetsSettings';
import PayslipsPage from './pages/PayslipsPage';
import ShiftAssignmentPage from './pages/ShiftAssignmentPage';
import ContractManagementPage from './pages/ContractManagementPage';
import OrgChartPage from './pages/OrgChartPage';
import DataImportExportPage from './pages/DataImportExportPage';
import AttendanceCalendarPage from './pages/AttendanceCalendarPage';
import EmployeeSelfServicePage from './pages/EmployeeSelfServicePage';
import CustomReportsPage from './pages/CustomReportsPage';
import ApprovalMatrixPage from './pages/ApprovalMatrixPage';
import EmailNotificationsPage from './pages/EmailNotificationsPage';
import AIAnomalyDetectionPage from './pages/AIAnomalyDetectionPage';
import RegulationsPage from './pages/RegulationsPage';
import ConnectionStatus from './components/ConnectionStatus';
import { Search, ChevronDown } from 'lucide-react';

function AppContent() {
  const { isAuthenticated, user } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <Dashboard onNavigate={setCurrentPage} />;
      case 'employees': return <EmployeesPage />;
      case 'departments': return <ConfigurationPage initialTab="departments" />;
      case 'positions': return <ConfigurationPage initialTab="positions" />;
      case 'daily-attendance': return <AttendancePage />;
      case 'shifts': return <ConfigurationPage initialTab="shifts" />;
      case 'corrections': return <AttendancePage />;
      case 'leave': return <LeavePage />;
      case 'overtime': return <OvertimePage />;
      case 'payroll-periods': return <PayrollPage />;
      case 'payroll-calculation': return <PayrollPage />;
      case 'payslips': return <PayslipsPage />;
      case 'shift-assignment': return <ShiftAssignmentPage />;
      case 'contracts': return <ContractManagementPage />;
      case 'org-chart': return <OrgChartPage />;
      case 'data-import-export': return <DataImportExportPage />;
      case 'attendance-calendar': return <AttendanceCalendarPage />;
      case 'employee-self-service': return <EmployeeSelfServicePage />;
      case 'custom-reports': return <CustomReportsPage />;
      case 'approval-matrix': return <ApprovalMatrixPage />;
      case 'email-notifications': return <EmailNotificationsPage />;
      case 'ai-anomaly-detection': return <AIAnomalyDetectionPage />;
      case 'regulations': return <RegulationsPage />;
      case 'documents': return <DocumentsPage />;
      case 'reports': return <ReportsPage />;
      case 'ai-assistant': return <AIAssistantPage />;
      case 'audit': return <AuditPage />;
      case 'configuration': return <ConfigurationPage />;
      case 'database': return <GoogleSheetsSettings />;
      default: return <Dashboard onNavigate={setCurrentPage} />;
    }
  };

  const getPageTitle = () => {
    const titles: Record<string, string> = {
      'dashboard': 'Command Centre',
      'employees': 'Employees',
      'departments': 'Departments',
      'positions': 'Positions',
      'daily-attendance': 'Daily Attendance',
      'shifts': 'Shift Management',
      'corrections': 'Attendance Corrections',
      'leave': 'Leave Management',
      'overtime': 'Overtime',
      'payroll-periods': 'Payroll Periods',
      'payroll-calculation': 'Payroll Calculation',
      'payslips': 'Payslips',
      'shift-assignment': 'Shift Assignment',
      'contracts': 'Contract Management',
      'org-chart': 'Organization Chart',
      'data-import-export': 'Data Import & Export',
      'attendance-calendar': 'Attendance Calendar',
      'employee-self-service': 'My Dashboard',
      'custom-reports': 'Custom Reports',
      'approval-matrix': 'Approval Matrix',
      'email-notifications': 'Email Notifications',
      'ai-anomaly-detection': 'AI Anomaly Detection',
      'regulations': 'Regulations & Tariffs',
      'documents': 'Documents',
      'reports': 'Reports',
      'ai-assistant': 'AI Assistant',
      'audit': 'Controls & Audit',
      'configuration': 'Configuration',
      'database': 'Database (Google Sheets)',
    };
    return titles[currentPage] || 'ATRIUM HRIS';
  };

  return (
    <AppProvider>
      <div className="flex h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden">
        <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
        
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-4">
              <div className="lg:hidden w-8" />
              <div>
                <h2 className="text-lg font-semibold text-slate-800">{getPageTitle()}</h2>
                <p className="text-xs text-slate-400 hidden sm:block">ATRIUM HRIS • Hotel Management System</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center relative">
                <Search size={16} className="absolute left-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="pl-9 pr-4 py-2 w-48 lg:w-64 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <ConnectionStatus />
              <NotificationCenter />
              <ThemeToggle />
              <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
                <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-sm font-bold text-indigo-600">
                  {user?.fullName?.charAt(0) || 'U'}
                </div>
                <div className="hidden sm:block">
                  <p className="text-sm font-medium text-slate-700">{user?.fullName}</p>
                  <p className="text-xs text-slate-400">{user?.role}</p>
                </div>
                <ChevronDown size={14} className="text-slate-400" />
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto p-6 pb-20 lg:pb-6">
            {renderPage()}
          </main>
        </div>
        <ToastContainer />
        <MobileBottomNav currentPage={currentPage} onNavigate={setCurrentPage} />
        <KeyboardShortcutsHelp />
      </div>
    </AppProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <KeyboardShortcutsProvider>
          <AppContent />
        </KeyboardShortcutsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
