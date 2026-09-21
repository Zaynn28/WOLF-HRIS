import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
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
import { Bell, Search, ChevronDown } from 'lucide-react';
import { notifications } from './data/mockData';

function AppContent() {
  const { isAuthenticated, user } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <Dashboard />;
      case 'employees': return <EmployeesPage />;
      case 'departments': return <ConfigurationPage />;
      case 'positions': return <ConfigurationPage />;
      case 'daily-attendance': return <AttendancePage />;
      case 'shifts': return <ConfigurationPage />;
      case 'corrections': return <AttendancePage />;
      case 'leave': return <LeavePage />;
      case 'overtime': return <OvertimePage />;
      case 'payroll-periods': return <PayrollPage />;
      case 'payroll-calculation': return <PayrollPage />;
      case 'payslips': return <PayrollPage />;
      case 'documents': return <DocumentsPage />;
      case 'reports': return <ReportsPage />;
      case 'ai-assistant': return <AIAssistantPage />;
      case 'audit': return <AuditPage />;
      case 'configuration': return <ConfigurationPage />;
      default: return <Dashboard />;
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
      'documents': 'Documents',
      'reports': 'Reports',
      'ai-assistant': 'AI Assistant',
      'audit': 'Controls & Audit',
      'configuration': 'Configuration',
    };
    return titles[currentPage] || 'ATRIUM HRIS';
  };

  const unreadNotifications = notifications.filter(n => !n.readAt).length;

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="lg:hidden w-8" /> {/* Spacer for mobile menu button */}
            <div>
              <h2 className="text-lg font-semibold text-slate-800">{getPageTitle()}</h2>
              <p className="text-xs text-slate-400 hidden sm:block">ATRIUM HRIS • Hotel Management System</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="hidden md:flex items-center relative">
              <Search size={16} className="absolute left-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search..."
                className="pl-9 pr-4 py-2 w-48 lg:w-64 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {/* Notifications */}
            <button className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
              <Bell size={20} />
              {unreadNotifications > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {unreadNotifications}
                </span>
              )}
            </button>
            
            {/* User Menu */}
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
        <main className="flex-1 overflow-y-auto p-6">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
