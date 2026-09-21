import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { Employee, Department, Position, Shift, Attendance, LeaveRequest, OvertimeRequest, PayrollPeriod, PayrollRecord, EmployeeDocument, AuditLog, Notification } from '../types';
import {
  employees as initEmployees,
  departments as initDepartments,
  positions as initPositions,
  shifts as initShifts,
  attendance as initAttendance,
  leaveRequests as initLeaveRequests,
  overtimeRequests as initOvertime,
  payrollPeriods as initPayrollPeriods,
  payrollRecords as initPayrollRecords,
  documents as initDocuments,
  auditLogs as initAuditLogs,
  notifications as initNotifications,
} from '../data/mockData';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

interface AppContextType {
  employees: Employee[];
  setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>;
  departments: Department[];
  setDepartments: React.Dispatch<React.SetStateAction<Department[]>>;
  positions: Position[];
  setPositions: React.Dispatch<React.SetStateAction<Position[]>>;
  shifts: Shift[];
  setShifts: React.Dispatch<React.SetStateAction<Shift[]>>;
  attendance: Attendance[];
  setAttendance: React.Dispatch<React.SetStateAction<Attendance[]>>;
  leaveRequests: LeaveRequest[];
  setLeaveRequests: React.Dispatch<React.SetStateAction<LeaveRequest[]>>;
  overtimeRequests: OvertimeRequest[];
  setOvertimeRequests: React.Dispatch<React.SetStateAction<OvertimeRequest[]>>;
  payrollPeriods: PayrollPeriod[];
  setPayrollPeriods: React.Dispatch<React.SetStateAction<PayrollPeriod[]>>;
  payrollRecords: PayrollRecord[];
  setPayrollRecords: React.Dispatch<React.SetStateAction<PayrollRecord[]>>;
  documents: EmployeeDocument[];
  setDocuments: React.Dispatch<React.SetStateAction<EmployeeDocument[]>>;
  auditLogs: AuditLog[];
  setAuditLogs: React.Dispatch<React.SetStateAction<AuditLog[]>>;
  notifications: Notification[];
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
  toasts: Toast[];
  addToast: (message: string, type: Toast['type']) => void;
  removeToast: (id: string) => void;
  addAuditLog: (action: string, entityType: string, entityId: string, newValue?: string, oldValue?: string) => void;
  addNotification: (type: Notification['type'], title: string, message: string) => void;
  markNotificationRead: (id: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [employees, setEmployees] = useState<Employee[]>(initEmployees);
  const [departments, setDepartments] = useState<Department[]>(initDepartments);
  const [positions, setPositions] = useState<Position[]>(initPositions);
  const [shifts, setShifts] = useState<Shift[]>(initShifts);
  const [attendance, setAttendance] = useState<Attendance[]>(initAttendance);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(initLeaveRequests);
  const [overtimeRequests, setOvertimeRequests] = useState<OvertimeRequest[]>(initOvertime);
  const [payrollPeriods, setPayrollPeriods] = useState<PayrollPeriod[]>(initPayrollPeriods);
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>(initPayrollRecords);
  const [documents, setDocuments] = useState<EmployeeDocument[]>(initDocuments);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(initAuditLogs);
  const [notifications, setNotifications] = useState<Notification[]>(initNotifications);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: Toast['type']) => {
    const id = Date.now().toString() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addAuditLog = useCallback((action: string, entityType: string, entityId: string, newValue?: string, oldValue?: string) => {
    const log: AuditLog = {
      id: 'al' + Date.now(),
      userId: 'u1',
      userName: 'Current User',
      action,
      entityType,
      entityId,
      oldValue,
      newValue,
      ipAddress: '192.168.1.10',
      createdAt: new Date().toISOString(),
    };
    setAuditLogs(prev => [log, ...prev]);
  }, []);

  const addNotification = useCallback((type: Notification['type'], title: string, message: string) => {
    const notif: Notification = {
      id: 'n' + Date.now(),
      type,
      title,
      message,
      createdAt: new Date().toISOString(),
    };
    setNotifications(prev => [notif, ...prev]);
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, readAt: new Date().toISOString() } : n));
  }, []);

  return (
    <AppContext.Provider value={{
      employees, setEmployees,
      departments, setDepartments,
      positions, setPositions,
      shifts, setShifts,
      attendance, setAttendance,
      leaveRequests, setLeaveRequests,
      overtimeRequests, setOvertimeRequests,
      payrollPeriods, setPayrollPeriods,
      payrollRecords, setPayrollRecords,
      documents, setDocuments,
      auditLogs, setAuditLogs,
      notifications, setNotifications,
      toasts, addToast, removeToast,
      addAuditLog, addNotification, markNotificationRead,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
