import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Role } from '../types';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => boolean;
  logout: () => void;
  registerStaff: (user: User) => void;
  isAuthenticated: boolean;
  wolfGate: "off" | "checking" | "ready" | "denied";
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const demoUsers: Record<string, { user: User; password: string }> = import.meta.env.DEV
  ? {
      'admin@atrium.hr': { user: { id: 'u1', email: 'admin@atrium.hr', fullName: 'Admin HR', role: 'HR_ADMIN' }, password: 'admin123' },
      'payroll@atrium.hr': { user: { id: 'u2', email: 'payroll@atrium.hr', fullName: 'Payroll Officer', role: 'PAYROLL' }, password: 'payroll123' },
      'finance@atrium.hr': { user: { id: 'u6', email: 'finance@atrium.hr', fullName: 'Financial Controller', role: 'FINANCIAL_CONTROLLER' }, password: 'fin123' },
      'director@atrium.hr': { user: { id: 'u7', email: 'director@atrium.hr', fullName: 'Hotel Director', role: 'GENERAL_MANAGER' }, password: 'director123' },
    }
  : {};

export const STAFF_PASSWORD = import.meta.env.DEV ? 'staff123' : '';

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

function wolfCompanyFromPath(pathname: string): "amg" | "bzg" | "ggv" | null {
  const match = pathname.match(/^\/hr\/(amg|bzg|ggv)\/runtime(?:\/|$)/);
  return match ? (match[1] as "amg" | "bzg" | "ggv") : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const embedded = typeof window !== "undefined" && window.__WOLF_HR_EMBEDDED__ === true;
  const [wolfGate, setWolfGate] = useState<"off" | "checking" | "ready" | "denied">(embedded ? "checking" : "off");
  const [user, setUser] = useState<User | null>(() => {
    if (embedded || !import.meta.env.DEV) return null;
    const saved = localStorage.getItem("atrium_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [staffUsers, setStaffUsers] = useState<User[]>([]);

  useEffect(() => {
    if (!embedded) return;
    const companyId = wolfCompanyFromPath(window.location.pathname);
    if (!companyId) {
      setWolfGate("denied");
      return;
    }
    let stopped = false;
    let requestId = 0;
    let sawReady = false;
    const check = () => {
      const current = ++requestId;
      fetch(`/hr/${companyId}/runtime/__wolf/session`, { credentials: "same-origin" })
        .then(async (response) => {
          if (stopped || current !== requestId) return;
          if (response.status === 401) {
            try {
              (window.top ?? window).location.assign("/login");
            } catch {
              window.location.assign("/login");
            }
            return;
          }
          if (!response.ok) {
            if (!sawReady || response.status === 403) {
              setUser(null);
              setWolfGate("denied");
            }
            return;
          }
          const body = (await response.json()) as { companyId?: string; email?: string; access?: string };
          if (body.companyId !== companyId || typeof body.email !== "string" || !body.email.includes("@")) {
            if (!sawReady) {
              setUser(null);
              setWolfGate("denied");
            }
            return;
          }
          localStorage.removeItem("atrium_user");
          setUser({
            id: `wolf:${companyId}`,
            email: body.email,
            fullName: body.email,
            role: body.access === "employee" ? "EMPLOYEE" : "HR_STAFF",
          });
          sawReady = true;
          setWolfGate("ready");
        })
        .catch(() => {
          if (stopped || current !== requestId || sawReady) return;
          setUser(null);
          setWolfGate("denied");
        });
    };
    check();
    const timer = window.setInterval(check, 10000);
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", check);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", check);
    };
  }, [embedded]);

  const registerStaff = (staff: User) => {
    setStaffUsers(prev => [...prev.filter(row => row.email !== staff.email), staff]);
  };

  const login = (email: string, password: string): boolean => {
    if (embedded || !import.meta.env.DEV) return false;
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
    if (embedded) {
      const top = window.top;
      if (top) top.location.assign("/");
      return;
    }
    setUser(null);
    localStorage.removeItem('atrium_user');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, registerStaff, isAuthenticated: !!user, wolfGate }}>
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
