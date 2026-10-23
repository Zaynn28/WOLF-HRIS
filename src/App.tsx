import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import { ThemeProvider } from './context/ThemeContext';
import { KeyboardShortcutsProvider } from './context/KeyboardShortcutsContext';
import Sidebar from './components/Sidebar';
import ToastContainer from './components/Toast';
import MobileBottomNav from './components/MobileBottomNav';
import KeyboardShortcutsHelp from './components/KeyboardShortcutsHelp';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import EmployeesPage from './pages/EmployeesPage';
import AttendancePage from './pages/AttendancePage';
import LeavePage from './pages/LeavePage';
import OvertimePage from './pages/OvertimePage';
import PayrollPage from './pages/PayrollPage';
import ReportsPage from './pages/ReportsPage';
import ConfigurationPage from './pages/ConfigurationPage';
import ContractManagementPage from './pages/ContractManagementPage';
import HiringPage from './pages/HiringPage';
import EmployeeSelfServicePage from './pages/EmployeeSelfServicePage';
import ServiceChargePage from './pages/ServiceChargePage';
import ComplianceConfigurationPage from './pages/ComplianceConfigurationPage';
import IntegrationExportPage from './pages/IntegrationExportPage';
import DocumentsPage from './pages/DocumentsPage';
import AssetRegisterPage from './pages/AssetRegisterPage';
import PayrollReviewPage from './pages/PayrollReviewPage';
import TasksPage from './pages/TasksPage';
import { EmployeeLoansPage, FinanceHomePage, ReimbursementsPage } from './pages/FinanceModulePage';
import { ChevronDown } from 'lucide-react';

function AppContent() {
  const { isAuthenticated, user } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');

  useEffect(() => {
    if (!user) return;
    if (user.role === 'EMPLOYEE') setCurrentPage('employee-self-service');
    else if (user.role === 'FINANCIAL_CONTROLLER' || user.role === 'FINANCE') setCurrentPage('integration-export');
    else if (user.role === 'PAYROLL') setCurrentPage('payroll');
    else if (user.role === 'GENERAL_MANAGER') setCurrentPage('tasks');
    else setCurrentPage('dashboard');
  }, [user?.id]);

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <Dashboard onNavigate={setCurrentPage} />;
      case 'hiring': return <HiringPage />;
      case 'employees': return <EmployeesPage />;
      case 'departments': return <ConfigurationPage initialTab="departments" />;
      case 'positions': return <ConfigurationPage initialTab="positions" />;
      case 'daily-attendance': return <AttendancePage />;
      case 'shifts': return <ConfigurationPage initialTab="shifts" />;
      case 'corrections': return <AttendancePage />;
      case 'leave': return <LeavePage />;
      case 'overtime': return <OvertimePage />;
      case 'payroll':
      case 'payroll-periods':
      case 'payroll-calculation': return <PayrollPage />;
      case 'service-charge-distribution': return <ServiceChargePage />;
      case 'contracts': return <ContractManagementPage />;
      case 'reports': return <ReportsPage />;
      case 'configuration': return <ConfigurationPage />;
      case 'compliance': return <ComplianceConfigurationPage />;
      case 'integration-export': return <IntegrationExportPage />;
      case 'documents': return <DocumentsPage />;
      case 'asset-register': return <AssetRegisterPage />;
      case 'payroll-review': return <PayrollReviewPage />;
      case 'tasks': return <TasksPage />;
      case 'finance': return <FinanceHomePage onNavigate={setCurrentPage} />;
      case 'reimbursements': return <ReimbursementsPage />;
      case 'employee-loans': return <EmployeeLoansPage />;
      case 'employee-self-service': return <EmployeeSelfServicePage />;
      default: return <Dashboard onNavigate={setCurrentPage} />;
    }
  };

  const getPageTitle = () => {
    const titles: Record<string, string> = {
      'dashboard': 'Command Centre',
      'hiring': 'Hiring',
      'employees': 'Employees',
      'departments': 'Departments',
      'positions': 'Positions',
      'daily-attendance': 'Daily Attendance',
      'shifts': 'Shift Management',
      'corrections': 'Attendance Corrections',
      'leave': 'Leave Management',
      'overtime': 'Overtime',
      'payroll': 'Payroll',
      'payroll-periods': 'Payroll Periods',
      'payroll-calculation': 'Payroll Calculation',
      'service-charge-distribution': 'Service Charge Distribution',
      'contracts': 'Contract Management',
      'reports': 'Reports',
      'configuration': 'Configuration',
      'compliance': 'Regulatory Compliance',
      'integration-export': 'Integration & Export',
      'employee-self-service': 'My Dashboard',
      'documents': 'Documents',
      'asset-register': 'Asset Register',
      'payroll-review': 'Payroll Review',
      'tasks': 'Staff Tasks',
      'finance': 'Finance',
      'reimbursements': 'Reimbursement',
      'employee-loans': 'Employee Loan',
    };
    return titles[currentPage] || 'ATRIUM HRIS';
  };

  return (
      <div className="flex h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden">
        <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
        
        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-4">
              <div className="lg:hidden w-8" />
              <div>
                <h2 className="text-lg font-semibold text-slate-800">{getPageTitle()}</h2>
                <p className="text-xs text-slate-400 hidden sm:block">ATRIUM HRIS • Hotel Management System</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
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

          <main className="flex-1 overflow-y-auto p-6 pb-20 lg:pb-6">
            {renderPage()}
          </main>
        </div>
        <ToastContainer />
        <MobileBottomNav currentPage={currentPage} onNavigate={setCurrentPage} />
        <KeyboardShortcutsHelp />
      </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppProvider>
          <KeyboardShortcutsProvider>
            <AppContent />
          </KeyboardShortcutsProvider>
        </AppProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
