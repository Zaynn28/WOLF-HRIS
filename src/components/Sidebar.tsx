import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, Users, Clock, CalendarDays, DollarSign, FileText, 
  BarChart3, Shield, Settings, ChevronLeft, ChevronRight, 
  Building2, LogOut, Menu, UserCircle, ClipboardList, Wallet
} from 'lucide-react';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  children?: { id: string; label: string }[];
}

export default function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const allItems: NavItem[] = [
    { id: 'tasks', label: 'Staff Tasks', icon: <ClipboardList size={20} /> },
    { id: 'dashboard', label: 'Command Centre', icon: <LayoutDashboard size={20} /> },
    { 
      id: 'people', label: 'People', icon: <Users size={20} />,
      children: [
        { id: 'hiring', label: 'Hiring' },
        { id: 'employees', label: 'Employees' },
        { id: 'contracts', label: 'Contracts' },
        { id: 'documents', label: 'Documents' },
        { id: 'asset-register', label: 'Asset Register' },
      ]
    },
    { id: 'daily-attendance', label: 'Attendance', icon: <Clock size={20} /> },
    { id: 'leave', label: 'Leave', icon: <CalendarDays size={20} /> },
    { id: 'overtime', label: 'Overtime', icon: <Clock size={20} /> },
    { 
      id: 'payroll-group', label: 'Payroll', icon: <DollarSign size={20} />,
      children: [
        { id: 'payroll', label: 'Payroll' },
        { id: 'payroll-review', label: 'Payroll Review' },
        { id: 'service-charge-distribution', label: 'Service Charge' },
      ]
    },
    {
      id: 'finance-group', label: 'Finance', icon: <Wallet size={20} />,
      children: [
        { id: 'finance', label: 'Overview' },
        { id: 'reimbursements', label: 'Reimbursement' },
        { id: 'employee-loans', label: 'Employee Loan' },
      ]
    },
    { id: 'reports', label: 'Reports', icon: <BarChart3 size={20} /> },
    { id: 'employee-self-service', label: 'My Dashboard', icon: <UserCircle size={20} /> },
    { id: 'compliance', label: 'Regulatory Compliance', icon: <Shield size={20} /> },
    { id: 'integration-export', label: 'Payroll to Finance', icon: <FileText size={20} /> },
    { id: 'configuration', label: 'Configuration', icon: <Settings size={20} /> },
  ];

  const role = user?.role;
  const isManagerRole = !!role && role.includes('MANAGER');
  const navItems = allItems.filter(item => {
    if (item.id === 'tasks') {
      if (!role || role === 'EMPLOYEE') return false;
      if (role === 'PAYROLL' || role === 'FINANCE' || role === 'FINANCIAL_CONTROLLER') return false;
      return role === 'HR_ADMIN' || role === 'HR_STAFF' || role === 'SUPER_ADMIN' || isManagerRole || role === 'DEPARTMENT_HEAD' || role === 'SUPERVISOR';
    }
    if (role === 'EMPLOYEE') return item.id === 'employee-self-service';
    if (role === 'GENERAL_MANAGER' || isManagerRole) return ['payroll-review', 'reports', 'finance-group'].includes(item.id) || item.id === 'payroll-group';
    if (role === 'FINANCIAL_CONTROLLER' || role === 'FINANCE') return item.id === 'reports' || item.id === 'integration-export' || item.id === 'payroll-group' || item.id === 'finance-group';
    if (role === 'PAYROLL') return ['payroll-group', 'reports', 'integration-export', 'finance-group'].includes(item.id);
    return item.id !== 'employee-self-service';
  });

  const isActive = (id: string) => currentPage === id;
  const isParentActive = (item: NavItem) => item.children?.some(c => currentPage === c.id);

  const sidebarContent = (
    <div className={`h-full flex flex-col bg-slate-900 text-white transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`}>
      <div className="p-4 flex items-center gap-3 border-b border-slate-700">
        <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center flex-shrink-0">
          <Building2 size={18} className="text-white" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="font-bold text-sm tracking-wide">ATRIUM HRIS</h1>
            <p className="text-xs text-slate-400">Hotel HR System</p>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {navItems.map(item => (
          <div key={item.id} className="mb-1">
            <button
              type="button"
              data-nav-id={item.id}
              onClick={() => {
                if (item.children) {
                  onNavigate(item.children[0].id);
                } else {
                  onNavigate(item.id);
                }
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive(item.id) || isParentActive(item)
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
              title={collapsed ? item.label : undefined}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
            {!collapsed && item.children && (isParentActive(item) || isActive(item.id)) && (
              <div className="ml-8 mt-1 space-y-1">
                {item.children.map(child => (
                  <button
                    key={child.id}
                    onClick={() => onNavigate(child.id)}
                    className={`w-full text-left px-3 py-1.5 rounded text-xs transition-colors ${
                      isActive(child.id)
                        ? 'text-indigo-300 font-medium'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {child.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-slate-700">
        {!collapsed && (
          <div className="flex items-center gap-2 mb-2 px-2">
            <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center text-xs font-bold">
              {user?.fullName?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{user?.fullName}</p>
              <p className="text-xs text-slate-400 truncate">{user?.role}</p>
            </div>
          </div>
        )}
        <button
          onClick={logout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="Logout"
        >
          <LogOut size={16} />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-slate-900 text-white rounded-lg"
      >
        <Menu size={20} />
      </button>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMobileOpen(false)} />
      )}

      <div className={`lg:hidden fixed inset-y-0 left-0 z-50 transform transition-transform ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {sidebarContent}
      </div>

      <div className="hidden lg:flex flex-shrink-0 relative">
        {sidebarContent}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute top-1/2 -right-3 w-6 h-6 bg-slate-700 border border-slate-600 rounded-full flex items-center justify-center text-white hover:bg-slate-600"
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </div>
    </>
  );
}
