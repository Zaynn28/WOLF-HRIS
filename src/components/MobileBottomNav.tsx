import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, Users, Clock, CalendarDays, DollarSign, UserCircle } from 'lucide-react';

interface MobileBottomNavProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

export default function MobileBottomNav({ currentPage, onNavigate }: MobileBottomNavProps) {
  const { user } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
    { id: 'employees', label: 'People', icon: Users },
    { id: 'daily-attendance', label: 'Attendance', icon: Clock },
    { id: 'leave', label: 'Leave', icon: CalendarDays },
    { id: 'employee-self-service', label: 'My HR', icon: UserCircle },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 z-40">
      <div className="grid grid-cols-5 gap-1">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex flex-col items-center justify-center py-3 px-2 transition-colors ${
                isActive
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Icon size={20} className={isActive ? 'stroke-[2.5]' : ''} />
              <span className="text-xs mt-1 font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
