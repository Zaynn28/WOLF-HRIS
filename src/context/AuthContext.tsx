import React, { createContext, useContext, useState, ReactNode } from 'react';
import { User, Role } from '../types';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => boolean;
  logout: () => void;
  registerStaff: (user: User) => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const demoUsers: Record<string, { user: User; password: string }> = {
  'admin@atrium.hr': { user: { id: 'u1', email: 'admin@atrium.hr', fullName: 'Admin HR', role: 'HR_ADMIN' }, password: 'admin123' },
  'payroll@atrium.hr': { user: { id: 'u2', email: 'payroll@atrium.hr', fullName: 'Payroll Officer', role: 'PAYROLL' }, password: 'payroll123' },
  'finance@atrium.hr': { user: { id: 'u6', email: 'finance@atrium.hr', fullName: 'Financial Controller', role: 'FINANCIAL_CONTROLLER' }, password: 'fin123' },
  'director@atrium.hr': { user: { id: 'u7', email: 'director@atrium.hr', fullName: 'Hotel Director', role: 'GENERAL_MANAGER' }, password: 'director123' },
};

export const STAFF_PASSWORD = 'staff123';

export const rolePermissions: Record<Role, string[]> = {
  SUPER_ADMIN: ['*'],
  HR_ADMIN: ['employee.*', 'attendance.*', 'leave.*', 'overtime.*', 'payroll.read', 'document.*', 'department.*', 'position.*', 'audit.read', 'config.*'],
  HR_STAFF: ['employee.read', 'employee.create', 'employee.update', 'attendance.read', 'leave.read', 'leave.approve', 'document.*', 'audit.read'],
  PAYROLL: ['employee.read', 'payroll.*', 'attendance.read', 'leave.read', 'overtime.read'],
  FINANCE: ['payroll.read', 'payroll.approve'],
  FINANCIAL_CONTROLLER: ['payroll.read', 'payroll.approve', 'reports.*', 'audit.read'],
  DEPARTMENT_HEAD: ['employee.read', 'attendance.read', 'leave.read', 'leave.approve', 'overtime.read', 'overtime.approve', 'reports.read'],
  SUPERVISOR: ['employee.read', 'attendance.read', 'attendance.approve', 'leave.read', 'leave.approve', 'leave.reject', 'overtime.read', 'overtime.approve'],
  EMPLOYEE: ['employee.read.own', 'attendance.read.own', 'attendance.create', 'leave.read.own', 'leave.create', 'overtime.read.own', 'overtime.create'],
  GENERAL_MANAGER: ['employee.read', 'attendance.read', 'leave.read', 'overtime.read', 'payroll.read', 'reports.*', 'dashboard.*'],
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('atrium_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [staffUsers, setStaffUsers] = useState<User[]>([]);

  const registerStaff = (staff: User) => {
    setStaffUsers(prev => [...prev.filter(row => row.email !== staff.email), staff]);
  };

  const login = (email: string, password: string): boolean => {
    const demoUser = demoUsers[email];
    if (demoUser) {
      setUser(demoUser.user);
      localStorage.setItem('atrium_user', JSON.stringify(demoUser.user));
      return true;
    }
    const staff = staffUsers.find(row => row.email === email);
    if (staff && password === STAFF_PASSWORD) {
      setUser(staff);
      localStorage.setItem('atrium_user', JSON.stringify(staff));
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('atrium_user');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, registerStaff, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

export function hasPermission(userRole: Role, permission: string): boolean {
  const perms = rolePermissions[userRole];
  if (perms.includes('*')) return true;
  if (perms.includes(permission)) return true;
  const [entity, action] = permission.split('.');
  if (perms.includes(`${entity}.*`)) return true;
  return false;
}
