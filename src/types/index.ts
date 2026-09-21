export type Role = 
  | 'SUPER_ADMIN'
  | 'HR_ADMIN'
  | 'HR_STAFF'
  | 'PAYROLL'
  | 'FINANCE'
  | 'FINANCIAL_CONTROLLER'
  | 'DEPARTMENT_HEAD'
  | 'SUPERVISOR'
  | 'EMPLOYEE'
  | 'GENERAL_MANAGER';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  employeeId?: string;
  avatar?: string;
}

export interface Employee {
  id: string;
  employeeCode: string;
  fullName: string;
  preferredName?: string;
  nik: string;
  npwp?: string;
  dateOfBirth: string;
  gender: 'M' | 'F';
  phone: string;
  email: string;
  address: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  departmentId: string;
  positionId: string;
  employmentStatus: 'ACTIVE' | 'ON_LEAVE' | 'TERMINATED' | 'RESIGNED' | 'PROBATION';
  joinDate: string;
  terminationDate?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
  photo?: string;
}

export interface Department {
  id: string;
  code: string;
  name: string;
  description: string;
  parentDepartmentId?: string;
  managerEmployeeId?: string;
  isActive: boolean;
}

export interface Position {
  id: string;
  code: string;
  title: string;
  departmentId: string;
  grade: string;
  description: string;
  isActive: boolean;
}

export interface Shift {
  id: string;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  crossesMidnight: boolean;
  isActive: boolean;
}

export interface Attendance {
  id: string;
  employeeId: string;
  attendanceDate: string;
  shiftId: string;
  clockIn?: string;
  clockOut?: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EARLY_LEAVE' | 'ON_LEAVE' | 'HOLIDAY' | 'REST_DAY' | 'INCOMPLETE';
  lateMinutes?: number;
  earlyLeaveMinutes?: number;
  overtimeMinutes?: number;
  notes?: string;
}

export interface LeaveType {
  id: string;
  code: string;
  name: string;
  defaultEntitlement: number;
  isPaid: boolean;
  isActive: boolean;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  submittedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
}

export interface OvertimeRequest {
  id: string;
  employeeId: string;
  date: string;
  startTime: string;
  endTime: string;
  totalMinutes: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedBy: string;
  approvedBy?: string;
  approvedAt?: string;
}

export interface PayrollPeriod {
  id: string;
  periodCode: string;
  startDate: string;
  endDate: string;
  payDate: string;
  status: 'DRAFT' | 'CALCULATED' | 'UNDER_REVIEW' | 'APPROVED' | 'FINALIZED' | 'LOCKED';
  createdBy: string;
  approvedBy?: string;
  finalizedAt?: string;
}

export interface PayrollRecord {
  id: string;
  payrollPeriodId: string;
  employeeId: string;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  status: string;
}

export interface PayrollItem {
  id: string;
  payrollRecordId: string;
  componentCode: string;
  componentName: string;
  category: 'EARNING' | 'DEDUCTION';
  amount: number;
}

export interface EmployeeDocument {
  id: string;
  employeeId: string;
  documentTypeName: string;
  fileName: string;
  fileSize: number;
  issueDate?: string;
  expiryDate?: string;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'EXPIRED';
  uploadedAt: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: string;
  newValue?: string;
  reason?: string;
  ipAddress: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  type: 'LEAVE_APPROVED' | 'LEAVE_REJECTED' | 'CONTRACT_EXPIRY' | 'PAYROLL_FINALIZED' | 'PAYSLIP_AVAILABLE' | 'PENDING_APPROVAL' | 'GENERAL';
  title: string;
  message: string;
  readAt?: string;
  createdAt: string;
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  classification?: 'INFORMATION' | 'SUGGESTION' | 'ANOMALY' | 'ACTION_REQUEST';
  timestamp: string;
}
