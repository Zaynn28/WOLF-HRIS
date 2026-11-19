import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { Employee, Department, Position, Shift, Attendance, LeaveRequest, OvertimeRequest, PayrollPeriod, PayrollRecord, EmployeeDocument, DocumentType, AuditLog, Notification, ServiceChargeConfig, ServiceChargeDistribution, ServiceChargeEmployeeSlip, PayrollItem, PTKPTable, TERTable, BPJSRates, UMKTable, ComplianceRule, THRCalculation, OffboardingCalculation, EmployeeLoan, LoanRepayment, ReimbursementClaim, LeaveType, PayPolicy, OfficeLocation, ShiftAssignment, Applicant, EmploymentContract, PayrollPack, AccountingPost, StaffTask, CompanyAsset, OnboardingMaterial, OnboardingActivity, OffsiteDuty, TilLedgerEntry } from '../types';
import { localDate } from '../lib/localDate';
import { attendanceApi, checkApiHealth, departmentsApi, employeesApi, importsApi, mapAttendanceRow, mapEmployeeRow, mapPunchMine, mapStaffTask, positionsApi, staffTasksApi } from '../services/api';
import { applyImportGroups } from '../lib/companyImport';
import { defaultPayPolicy } from '../lib/payrollEngine';
import { cycleForMonth, defaultWorkingPeriodId } from '../lib/periodScope';
import {
  employees as initEmployees,
  departments as initDepartments,
  positions as initPositions,
  shifts as initShifts,
  attendance as initAttendance,
  shiftAssignments as initShiftAssignments,
  leaveRequests as initLeaveRequests,
  overtimeRequests as initOvertime,
  payrollPeriods as initPayrollPeriods,
  payrollRecords as initPayrollRecords,
  payrollItems as initPayrollItems,
  serviceChargeConfigs as initServiceChargeConfigs,
  serviceChargeDistributions as initServiceChargeDistributions,
  ptkpTables as initPTKPTables,
  terTables as initTERTables,
  bpjsRates as initBPJSRates,
  umkTables as initUMKTables,
  complianceRules as initComplianceRules,
  thrCalculations as initTHRCalculations,
  offboardingCalculations as initOffboardingCalculations,
  employeeLoans as initEmployeeLoans,
  leaveTypes as initLeaveTypes,
  documents as initDocuments,
  auditLogs as initAuditLogs,
  notifications as initNotifications,
  employmentContracts as initEmploymentContracts,
} from '../data/mockData';

const initialDocumentTypes: DocumentType[] = [
  { id: 'dt-ktp', name: 'KTP', active: true },
  { id: 'dt-npwp', name: 'NPWP', active: true },
  { id: 'dt-kk', name: 'Kartu Keluarga', active: true },
  { id: 'dt-bank', name: 'Bank account', active: true },
  { id: 'dt-contract', name: 'Contract', active: true },
  { id: 'dt-photo', name: 'Photo', active: true },
  { id: 'dt-skill', name: 'Skill certificate', active: true },
  { id: 'dt-bpjs-tk', name: 'BPJS TK', active: true },
  { id: 'dt-bpjs-kes', name: 'BPJS Kesehatan', active: true },
];

const initialOnboardingActivities: OnboardingActivity[] = [
  { id: 'ktp', label: 'KTP received' },
  { id: 'npwp', label: 'NPWP received' },
  { id: 'bank', label: 'Bank account confirmed' },
  { id: 'orientation', label: 'Orientation done' },
  { id: 'uniform', label: 'Uniform / name tag issued' },
  { id: 'slideshow', label: 'Onboarding slideshow completed' },
];

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

interface AppContextType {
  employees: Employee[];
  setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>;
  applicants: Applicant[];
  setApplicants: React.Dispatch<React.SetStateAction<Applicant[]>>;
  contracts: EmploymentContract[];
  setContracts: React.Dispatch<React.SetStateAction<EmploymentContract[]>>;
  payrollPacks: PayrollPack[];
  setPayrollPacks: React.Dispatch<React.SetStateAction<PayrollPack[]>>;
  accountingPosts: AccountingPost[];
  setAccountingPosts: React.Dispatch<React.SetStateAction<AccountingPost[]>>;
  tasks: StaffTask[];
  setTasks: React.Dispatch<React.SetStateAction<StaffTask[]>>;
  companyAssets: CompanyAsset[];
  setCompanyAssets: React.Dispatch<React.SetStateAction<CompanyAsset[]>>;
  departments: Department[];
  setDepartments: React.Dispatch<React.SetStateAction<Department[]>>;
  positions: Position[];
  setPositions: React.Dispatch<React.SetStateAction<Position[]>>;
  shifts: Shift[];
  setShifts: React.Dispatch<React.SetStateAction<Shift[]>>;
  attendance: Attendance[];
  setAttendance: React.Dispatch<React.SetStateAction<Attendance[]>>;
  shiftAssignments: ShiftAssignment[];
  setShiftAssignments: React.Dispatch<React.SetStateAction<ShiftAssignment[]>>;
  payPolicy: PayPolicy;
  setPayPolicy: React.Dispatch<React.SetStateAction<PayPolicy>>;
  officeLocation: OfficeLocation | null;
  setOfficeLocation: React.Dispatch<React.SetStateAction<OfficeLocation | null>>;
  leaveRequests: LeaveRequest[];
  setLeaveRequests: React.Dispatch<React.SetStateAction<LeaveRequest[]>>;
  overtimeRequests: OvertimeRequest[];
  setOvertimeRequests: React.Dispatch<React.SetStateAction<OvertimeRequest[]>>;
  payrollPeriods: PayrollPeriod[];
  setPayrollPeriods: React.Dispatch<React.SetStateAction<PayrollPeriod[]>>;
  workingPeriodId: string;
  setWorkingPeriodId: React.Dispatch<React.SetStateAction<string>>;
  payrollRecords: PayrollRecord[];
  setPayrollRecords: React.Dispatch<React.SetStateAction<PayrollRecord[]>>;
  payrollItems: PayrollItem[];
  setPayrollItems: React.Dispatch<React.SetStateAction<PayrollItem[]>>;
  serviceChargeConfigs: ServiceChargeConfig[];
  setServiceChargeConfigs: React.Dispatch<React.SetStateAction<ServiceChargeConfig[]>>;
  ptkpTables: PTKPTable[];
  setPTKPTables: React.Dispatch<React.SetStateAction<PTKPTable[]>>;
  terTables: TERTable[];
  setTERTables: React.Dispatch<React.SetStateAction<TERTable[]>>;
  bpjsRates: BPJSRates[];
  setBPJSRates: React.Dispatch<React.SetStateAction<BPJSRates[]>>;
  umkTables: UMKTable[];
  setUMKTables: React.Dispatch<React.SetStateAction<UMKTable[]>>;
  complianceRules: ComplianceRule[];
  setComplianceRules: React.Dispatch<React.SetStateAction<ComplianceRule[]>>;
  leaveTypes: LeaveType[];
  setLeaveTypes: React.Dispatch<React.SetStateAction<LeaveType[]>>;
  thrCalculations: THRCalculation[];
  setTHRCalculations: React.Dispatch<React.SetStateAction<THRCalculation[]>>;
  offboardingCalculations: OffboardingCalculation[];
  setOffboardingCalculations: React.Dispatch<React.SetStateAction<OffboardingCalculation[]>>;
  employeeLoans: EmployeeLoan[];
  setEmployeeLoans: React.Dispatch<React.SetStateAction<EmployeeLoan[]>>;
  loanRepayments: LoanRepayment[];
  setLoanRepayments: React.Dispatch<React.SetStateAction<LoanRepayment[]>>;
  reimbursements: ReimbursementClaim[];
  setReimbursements: React.Dispatch<React.SetStateAction<ReimbursementClaim[]>>;
  serviceChargeDistributions: ServiceChargeDistribution[];
  setServiceChargeDistributions: React.Dispatch<React.SetStateAction<ServiceChargeDistribution[]>>;
  serviceChargeSlips: ServiceChargeEmployeeSlip[];
  setServiceChargeSlips: React.Dispatch<React.SetStateAction<ServiceChargeEmployeeSlip[]>>;
  documents: EmployeeDocument[];
  setDocuments: React.Dispatch<React.SetStateAction<EmployeeDocument[]>>;
  documentTypes: DocumentType[];
  setDocumentTypes: React.Dispatch<React.SetStateAction<DocumentType[]>>;
  onboardingMaterials: OnboardingMaterial[];
  setOnboardingMaterials: React.Dispatch<React.SetStateAction<OnboardingMaterial[]>>;
  onboardingActivities: OnboardingActivity[];
  setOnboardingActivities: React.Dispatch<React.SetStateAction<OnboardingActivity[]>>;
  offsiteDuties: OffsiteDuty[];
  setOffsiteDuties: React.Dispatch<React.SetStateAction<OffsiteDuty[]>>;
  tilLedger: TilLedgerEntry[];
  setTilLedger: React.Dispatch<React.SetStateAction<TilLedgerEntry[]>>;
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
  markAllNotificationsRead: () => void;
  applyCompanyImport: (moduleId: string, result: { refresh?: string | null; rows?: { natural_key: string; payload: Record<string, unknown> }[] }) => Promise<void>;
  companyRecords: 'local' | 'loading' | 'ready' | 'denied';
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const wolfEmbedded = typeof window !== 'undefined' && window.__WOLF_HR_EMBEDDED__ === true;

export function AppProvider({ children }: { children: ReactNode }) {
  const [employees, setEmployees] = useState<Employee[]>(wolfEmbedded ? [] : initEmployees);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [contracts, setContracts] = useState<EmploymentContract[]>(wolfEmbedded ? [] : initEmploymentContracts);
  const [payrollPacks, setPayrollPacks] = useState<PayrollPack[]>([]);
  const [accountingPosts, setAccountingPosts] = useState<AccountingPost[]>([]);
  const [tasks, setTasks] = useState<StaffTask[]>([]);
  const [companyAssets, setCompanyAssets] = useState<CompanyAsset[]>([]);
  const [departments, setDepartments] = useState<Department[]>(wolfEmbedded ? [] : initDepartments);
  const [positions, setPositions] = useState<Position[]>(wolfEmbedded ? [] : initPositions);
  const [shifts, setShifts] = useState<Shift[]>(initShifts);
  const [attendance, setAttendance] = useState<Attendance[]>(wolfEmbedded ? [] : initAttendance);
  const [shiftAssignments, setShiftAssignments] = useState<ShiftAssignment[]>(initShiftAssignments);
  const [payPolicy, setPayPolicy] = useState<PayPolicy>(defaultPayPolicy);
  const [officeLocation, setOfficeLocation] = useState<OfficeLocation | null>(null);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(wolfEmbedded ? [] : initLeaveRequests);
  const [overtimeRequests, setOvertimeRequests] = useState<OvertimeRequest[]>(wolfEmbedded ? [] : initOvertime);
  const [payrollPeriods, setPayrollPeriods] = useState<PayrollPeriod[]>(wolfEmbedded ? [] : initPayrollPeriods);
  const [workingPeriodId, setWorkingPeriodId] = useState(defaultWorkingPeriodId(wolfEmbedded ? [] : initPayrollPeriods));
  const [companyRecords, setCompanyRecords] = useState<'local' | 'loading' | 'ready' | 'denied'>(wolfEmbedded ? 'loading' : 'local');

  useEffect(() => {
    setPayrollPeriods(prev => {
      let changed = false;
      const next = prev.map(row => {
        if (row.status === 'FINALIZED' || row.status === 'LOCKED') return row;
        const [year, month] = row.periodCode.split('-').map(Number);
        if (!year || !month) return row;
        const cycle = cycleForMonth(year, month, payPolicy.cutoffDay, payPolicy.payDay);
        if (row.startDate === cycle.startDate && row.endDate === cycle.endDate && row.payDate === cycle.payDate) return row;
        changed = true;
        return { ...row, ...cycle };
      });
      return changed ? next : prev;
    });
  }, [payPolicy.cutoffDay, payPolicy.payDay]);
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>(wolfEmbedded ? [] : initPayrollRecords);
  const [payrollItems, setPayrollItems] = useState<PayrollItem[]>(initPayrollItems);
  const [serviceChargeConfigs, setServiceChargeConfigs] = useState<ServiceChargeConfig[]>(initServiceChargeConfigs);
  const [serviceChargeDistributions, setServiceChargeDistributions] = useState<ServiceChargeDistribution[]>(initServiceChargeDistributions);
  const [serviceChargeSlips, setServiceChargeSlips] = useState<ServiceChargeEmployeeSlip[]>([]);
  const [ptkpTables, setPTKPTables] = useState<PTKPTable[]>(initPTKPTables);
  const [terTables, setTERTables] = useState<TERTable[]>(initTERTables);
  const [bpjsRates, setBPJSRates] = useState<BPJSRates[]>(initBPJSRates);
  const [umkTables, setUMKTables] = useState<UMKTable[]>(initUMKTables);
  const [complianceRules, setComplianceRules] = useState<ComplianceRule[]>(initComplianceRules);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>(initLeaveTypes);
  const [thrCalculations, setTHRCalculations] = useState<THRCalculation[]>(initTHRCalculations);
  const [offboardingCalculations, setOffboardingCalculations] = useState<OffboardingCalculation[]>(initOffboardingCalculations);
  const [employeeLoans, setEmployeeLoans] = useState<EmployeeLoan[]>(initEmployeeLoans);
  const [loanRepayments, setLoanRepayments] = useState<LoanRepayment[]>([]);
  const [reimbursements, setReimbursements] = useState<ReimbursementClaim[]>([]);
  const [documents, setDocuments] = useState<EmployeeDocument[]>(initDocuments);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>(initialDocumentTypes);
  const [onboardingMaterials, setOnboardingMaterials] = useState<OnboardingMaterial[]>([]);
  const [onboardingActivities, setOnboardingActivities] = useState<OnboardingActivity[]>(initialOnboardingActivities);
  const [offsiteDuties, setOffsiteDuties] = useState<OffsiteDuty[]>([]);
  const [tilLedger, setTilLedger] = useState<TilLedgerEntry[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(wolfEmbedded ? [] : initAuditLogs);

  const applyLocalDemoRoster = useCallback(() => {
    setEmployees(initEmployees);
    setDepartments(initDepartments);
    setPositions(initPositions);
    setAttendance(initAttendance);
    setLeaveRequests(initLeaveRequests);
    setOvertimeRequests(initOvertime);
    setPayrollPeriods(initPayrollPeriods);
    setWorkingPeriodId(defaultWorkingPeriodId(initPayrollPeriods));
    setContracts(initEmploymentContracts);
    setPayrollRecords(initPayrollRecords);
    setPayrollItems(initPayrollItems);
    setCompanyRecords('local');
  }, []);

  useEffect(() => {
    if (!wolfEmbedded) return;
    let cancelled = false;
    (async () => {
      const healthy = await checkApiHealth();
      if (!healthy) {
        if (!cancelled) applyLocalDemoRoster();
        return;
      }
      try {
        let people;
        let selfService = false;
        try {
          people = await employeesApi.getAll();
        } catch {
          selfService = true;
          const self = await employeesApi.getSelf();
          people = self ? [self] : [];
        }
        const [units, roles] = selfService
          ? await Promise.all([departmentsApi.getAll().catch(() => []), positionsApi.getAll().catch(() => [])])
          : await Promise.all([departmentsApi.getAll(), positionsApi.getAll()]);
        if (cancelled) return;
        if (!people.length) {
          // Healthy API with an empty roster: keep empty (do not inject hotel mock UUIDs on live).
          setEmployees([]);
          setCompanyRecords('ready');
          return;
        }
        const mappedPeople = people.map(mapEmployeeRow);
        setEmployees(mappedPeople);
        setDepartments(units.map((row) => ({
          id: row.id,
          code: row.code,
          name: row.name,
          description: row.description ?? '',
          parentDepartmentId: row.parent_department_id ?? undefined,
          managerEmployeeId: row.manager_employee_id ?? undefined,
          isActive: row.is_active !== false,
        })));
        setPositions(roles.map((row) => ({
          id: row.id,
          code: row.code,
          title: row.title,
          departmentId: row.department_id,
          grade: row.grade ?? '',
          description: row.description ?? '',
          isActive: row.is_active !== false,
        })));
        try {
          const taskRows = await staffTasksApi.getAll();
          if (!cancelled) {
            setTasks(taskRows.map((row) => mapStaffTask(row)).filter((row): row is StaffTask => row !== null));
          }
        } catch {
          if (!cancelled) setTasks([]);
        }
        try {
          const imported = await importsApi.list();
          if (!cancelled) {
            applyImportGroups(imported.rows || {}, { employees: mappedPeople, leaveTypes, shifts }, {
              setShifts, setAttendance, setLeaveRequests, setOvertimeRequests, setApplicants, setContracts,
              setDocuments, setCompanyAssets, setPayrollPeriods, setPayrollRecords, setPayrollPacks,
              setServiceChargeDistributions, setAccountingPosts, setReimbursements, setEmployeeLoans, setWorkingPeriodId,
            });
          }
        } catch {
          // Company screens still open when the import store is unavailable.
        }
        try {
          const today = localDate();
          const rows = await attendanceApi.getByDate(today);
          if (!cancelled) {
            const mapped = rows.map(mapAttendanceRow);
            setAttendance((prev) => [...prev.filter((row) => row.attendanceDate !== today), ...mapped]);
          }
        } catch {
          try {
            const mine = mapPunchMine(await attendanceApi.mine());
            if (!cancelled && mine.day) {
              const day = mine.day;
              setAttendance((prev) => [...prev.filter((row) => !(row.employeeId === day.employeeId && row.attendanceDate === day.attendanceDate)), day]);
            }
          } catch {
            // This session cannot read the company day board.
          }
        }
        setCompanyRecords('ready');
      } catch {
        if (!cancelled) applyLocalDemoRoster();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyLocalDemoRoster]);
  const [notifications, setNotifications] = useState<Notification[]>(initNotifications);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: Toast['type']) => {
    const id = Date.now().toString() + Math.random();
    let added = true;
    setToasts(prev => {
      if (prev.some((toast) => toast.message === message && toast.type === type)) {
        added = false;
        return prev;
      }
      return [...prev, { id, message, type }];
    });
    if (!added) return;
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

  const markAllNotificationsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, readAt: new Date().toISOString() })));
  }, []);

  const applyCompanyImport = useCallback(async (moduleId: string, result: { refresh?: string | null; rows?: { natural_key: string; payload: Record<string, unknown> }[] }) => {
    if (result.refresh === 'employees') {
      setEmployees((await employeesApi.getAll()).map(mapEmployeeRow));
      return;
    }
    if (result.refresh === 'departments') {
      const units = await departmentsApi.getAll();
      setDepartments(units.map(row => ({
        id: row.id,
        code: row.code,
        name: row.name,
        description: row.description ?? '',
        parentDepartmentId: row.parent_department_id ?? undefined,
        managerEmployeeId: row.manager_employee_id ?? undefined,
        isActive: row.is_active !== false,
      })));
      return;
    }
    if (result.refresh === 'positions') {
      const roles = await positionsApi.getAll();
      setPositions(roles.map(row => ({
        id: row.id,
        code: row.code,
        title: row.title,
        departmentId: row.department_id,
        grade: row.grade ?? '',
        description: row.description ?? '',
        isActive: row.is_active !== false,
      })));
      return;
    }
    if (result.refresh === 'tasks') {
      const taskRows = await staffTasksApi.getAll();
      setTasks(taskRows.map(row => mapStaffTask(row)).filter((row): row is StaffTask => row !== null));
      return;
    }
    if (result.rows) {
      applyImportGroups({ [moduleId]: result.rows }, { employees, leaveTypes, shifts }, {
        setShifts, setAttendance, setLeaveRequests, setOvertimeRequests, setApplicants, setContracts,
        setDocuments, setCompanyAssets, setPayrollPeriods, setPayrollRecords, setPayrollPacks,
        setServiceChargeDistributions, setAccountingPosts, setReimbursements, setEmployeeLoans, setWorkingPeriodId,
      });
    }
  }, [employees, leaveTypes, shifts]);

  return (
    <AppContext.Provider value={{
      employees, setEmployees,
      applicants, setApplicants,
      contracts, setContracts,
      payrollPacks, setPayrollPacks,
      accountingPosts, setAccountingPosts,
      tasks, setTasks,
      companyAssets, setCompanyAssets,
      departments, setDepartments,
      positions, setPositions,
      shifts, setShifts,
      attendance, setAttendance,
      shiftAssignments, setShiftAssignments,
      payPolicy, setPayPolicy,
      officeLocation, setOfficeLocation,
      leaveRequests, setLeaveRequests,
      overtimeRequests, setOvertimeRequests,
      payrollPeriods, setPayrollPeriods,
      workingPeriodId, setWorkingPeriodId,
      payrollRecords, setPayrollRecords,
      payrollItems, setPayrollItems,
      serviceChargeConfigs, setServiceChargeConfigs,
      serviceChargeDistributions, setServiceChargeDistributions,
      serviceChargeSlips, setServiceChargeSlips,
      ptkpTables, setPTKPTables,
      terTables, setTERTables,
      bpjsRates, setBPJSRates,
      umkTables, setUMKTables,
      complianceRules, setComplianceRules,
      leaveTypes, setLeaveTypes,
      thrCalculations, setTHRCalculations,
      offboardingCalculations, setOffboardingCalculations,
      employeeLoans, setEmployeeLoans,
      loanRepayments, setLoanRepayments,
      reimbursements, setReimbursements,
      documents, setDocuments,
      documentTypes, setDocumentTypes,
      onboardingMaterials, setOnboardingMaterials,
      onboardingActivities, setOnboardingActivities,
      offsiteDuties, setOffsiteDuties,
      tilLedger, setTilLedger,
      auditLogs, setAuditLogs,
      notifications, setNotifications,
      toasts, addToast, removeToast,
      addAuditLog, addNotification, markNotificationRead, markAllNotificationsRead,
      applyCompanyImport,
      companyRecords,
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
