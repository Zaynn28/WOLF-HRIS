import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, Users, Clock, CalendarDays, DollarSign, FileText, 
  BarChart3, Bot, Shield, Settings, ChevronLeft, ChevronRight, 
  Building2, Briefcase, LogOut, Menu, Database
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

  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Command Centre', icon: <LayoutDashboard size={20} /> },
    { 
      id: 'people', label: 'People', icon: <Users size={20} />,
      children: [
        { id: 'employees', label: 'Employees' },
        { id: 'departments', label: 'Departments' },
        { id: 'positions', label: 'Positions' },
        { id: 'contracts', label: 'Contracts' },
        { id: 'org-chart', label: 'Organization Chart' },
      ]
    },
    { 
      id: 'attendance', label: 'Attendance', icon: <Clock size={20} />,
      children: [
        { id: 'daily-attendance', label: 'Daily Attendance' },
        { id: 'shifts', label: 'Shifts' },
        { id: 'shift-assignment', label: 'Shift Assignment' },
        { id: 'corrections', label: 'Corrections' },
      ]
    },
    { id: 'leave', label: 'Leave', icon: <CalendarDays size={20} /> },
    { id: 'overtime', label: 'Overtime', icon: <Clock size={20} /> },
    { 
      id: 'payroll', label: 'Payroll', icon: <DollarSign size={20} />,
      children: [
        { id: 'payroll-periods', label: 'Periods' },
        { id: 'payroll-calculation', label: 'Calculation' },
        { id: 'payslips', label: 'Payslips' },
        { id: 'payslips', label: 'Payslips' },
      ]
    },
    { id: 'documents', label: 'Documents', icon: <FileText size={20} /> },
    { id: 'reports', label: 'Reports', icon: <BarChart3 size={20} /> },
    { id: 'ai-assistant', label: 'AI Assistant', icon: <Bot size={20} /> },
    { id: 'audit', label: 'Controls & Audit', icon: <Shield size={20} /> },
    { id: 'configuration', label: 'Configuration', icon: <Settings size={20} /> },
    { id: 'database', label: 'Database (Sheets)', icon: <Database size={20} /> },
  ];

  const isActive = (id: string) => currentPage === id;
  const isParentActive = (item: NavItem) => item.children?.some(c => currentPage === c.id);

  const sidebarContent = (
    <div className={`h-full flex flex-col bg-slate-900 text-white transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`}>
      {/* Logo */}
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

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {navItems.map(item => (
          <div key={item.id} className="mb-1">
            <button
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

      {/* User section */}
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
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-slate-900 text-white rounded-lg"
      >
        <Menu size={20} />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile sidebar */}
      <div className={`lg:hidden fixed inset-y-0 left-0 z-50 transform transition-transform ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {sidebarContent}
      </div>

      {/* Desktop sidebar */}
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
