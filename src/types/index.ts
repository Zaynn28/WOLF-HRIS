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
  ptkpCode?: string;
  photo?: string;
}

export interface Applicant {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  departmentId: string;
  positionId: string;
  status: 'APPLIED' | 'REJECTED' | 'OFFERED' | 'SIGNED' | 'ONBOARDED';
  rejectionReason?: string;
  basicSalary?: number;
  allowance?: number;
  ptkpCode?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
  contractType?: 'PKWTT' | 'PKWT';
  startDate?: string;
  endDate?: string;
  employeeId?: string;
  loginEmail?: string;
  checks: { ktp: boolean; npwp: boolean; bank: boolean; orientation: boolean };
}

export interface EmploymentContract {
  id: string;
  employeeId: string;
  type: 'PKWTT' | 'PKWT';
  startDate: string;
  endDate: string | null;
  status: 'active' | 'expiring' | 'expired';
  basicSalary: number;
  allowance: number;
}

export interface PayPolicy {
  cutoffDay: number;
  payDay: number;
  otWeekdayFirst: number;
  otWeekdayNext: number;
  otHolidayFirst: number;
  otHolidayEighth: number;
  otHolidayAfter: number;
  serviceChargePercentage: number;
  highSeasonDates: string[];
  bpjsDueDay: number;
  pphDueDay: number;
}

export interface OfficeLocation {
  name: string;
  latitude: number;
  longitude: number;
}

export interface ShiftAssignment {
  id: string;
  employeeId: string;
  date: string;
  shiftId: string;
}

export interface Department {
  id: string;
  code: string;
  name: string;
  description: string;
  parentDepartmentId?: string;
  managerEmployeeId?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Position {
  id: string;
  code: string;
  title: string;
  departmentId: string;
  grade: string;
  description: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
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
  createdAt?: string;
  updatedAt?: string;
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
  clockInPhoto?: string;
  clockOutPhoto?: string;
  clockInLat?: number;
  clockInLng?: number;
  clockOutLat?: number;
  clockOutLng?: number;
  clockInAccuracy?: number;
  clockOutAccuracy?: number;
}

export interface LeaveType {
  id: string;
  code: string;
  name: string;
  defaultEntitlement: number;
  requiresAttachment: boolean;
  requiresApproval: boolean;
  isPaid: boolean;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
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
  writtenOrder?: boolean;
  employeeConsent?: boolean;
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
  basicSalary: number;
  allowance: number;
  overtime: number;
  serviceCharge: number;
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
  quantity?: number;
  rate?: number;
  amount: number;
  source_type?: string;
  source_id?: string;
}

// ============================================
// Indonesian Compliance Types
// ============================================

export interface PTKPTable {
  id: string;
  code: string; // TK/0, K/0, K/1, K/2, K/3, etc.
  label: string;
  annualAmount: number; // annual non-taxable income
  createdAt: string;
}

export interface TERTable {
  id: string;
  ptkpCode: string;
  monthlyGrossMin: number;
  monthlyGrossMax: number;
  terRate: number; // effective tax rate %
  createdAt: string;
}

export interface BPJSRates {
  id: string;
  effectiveDate: string;
  // BPJS Kesehatan
  healthEmployeePercent: number; // 1%
  healthEmployerPercent: number; // 4%
  healthSalaryCap: number;
  // BPJS Ketenagakerjaan
  jhtEmployeePercent: number; // 2%
  jhtEmployerPercent: number; // 3.7%
  jpEmployeePercent: number; // 1%
  jpEmployerPercent: number; // 2%
  jpSalaryCap: number;
  jkkPercent: number; // 0.24%-1.74% risk class
  jkmPercent: number; // 0.3%
  createdAt: string;
}

export interface UMKTable {
  id: string;
  region: string; // province/city
  province: string;
  umk: number; // minimum wage
  effectiveDate: string;
  createdAt: string;
}

export interface ComplianceRule {
  id: string;
  name: string;
  category: 'PAYROLL' | 'LEAVE' | 'OVERTIME' | 'TERMINATION' | 'ONBOARDING' | 'OFFBOARDING';
  rule: string;
  isActive: boolean;
  createdAt: string;
}

export interface THRCalculation {
  id: string;
  employeeId: string;
  period: string; // e.g. "2026-01" religious holiday
  monthlyWage: number;
  monthsWorked: number;
  thrAmount: number;
  isProportional: boolean;
  religiousHoliday: string;
  createdAt: string;
}

export interface OffboardingCalculation {
  id: string;
  employeeId: string;
  lastWorkingDay: string;
  reason: 'RESIGN' | 'CONTRACT_END' | 'TERMINATION' | 'RETIREMENT' | 'DEATH' | 'SEVERE_VIOLATION';
  noticePeriodDays: number;
  finalSalaryProrata: number;
  unusedLeaveDays: number;
  unusedLeaveAmount: number;
  serviceChargeOutstanding: number;
  severancePay: number; // UP
  serviceAppreciation: number; // UPMK
  replacementRights: number; // UPH
  contractCompensation: number; // PKWT compensation
  loanDeduction: number;
  totalFinalPay: number;
  pph21Final: number;
  netFinalPay: number;
  status: 'DRAFT' | 'CALCULATED' | 'APPROVED' | 'PAID';
  createdAt: string;
}

export interface EmployeeLoan {
  id: string;
  employeeId: string;
  loanType: 'SALARY_ADVANCE' | 'EMERGENCY' | 'HOUSING' | 'EDUCATION' | 'OTHER';
  principalAmount: number;
  remainingBalance: number;
  monthlyInstallment: number;
  startDate: string;
  endDate?: string;
  purpose?: string;
  status: 'ACTIVE' | 'PAID_OFF' | 'DEFAULTED';
  createdAt: string;
}

export interface LoanRepayment {
  id: string;
  loanId: string;
  amount: number;
  paidOn: string;
  recordedAt: string;
}

export interface ReimbursementClaim {
  id: string;
  employeeId: string;
  claimDate: string;
  category: 'TRANSPORT' | 'MEDICAL' | 'OTHER';
  amount: number;
  description: string;
  receiptFileName?: string;
  receiptFileSize?: number;
  receiptDataUrl?: string;
  status: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'PAID';
  submittedByName: string;
  submittedAt: string;
  rejectionNote?: string;
  decidedByName?: string;
  decidedAt?: string;
  paidAt?: string;
}

export interface DocumentType {
  id: string;
  name: string;
  active: boolean;
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
  dataUrl?: string;
}

export interface PayrollPackLine {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  basicSalary: number;
  allowance: number;
  overtime: number;
  serviceCharge: number;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
}

export interface PayrollPack {
  id: string;
  periodId: string;
  periodCode: string;
  startDate: string;
  endDate: string;
  payDate: string;
  status: 'UNDER_REVIEW' | 'APPROVED' | 'RETURNED';
  submittedAt: string;
  submittedBy: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNote?: string;
  lines: PayrollPackLine[];
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
}

export interface AccountingPost {
  id: string;
  periodId: string;
  periodCode: string;
  reference: string;
  destination: string;
  postedAt: string;
  totalDebit: number;
  totalCredit: number;
  journal: string;
}

export interface StaffTask {
  id: string;
  title: string;
  detail: string;
  assigneeId: string;
  assignerName: string;
  dueDate: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'DONE';
  createdAt: string;
  completedAt?: string;
}

export type AssetCategory = 'LAPTOP' | 'PHONE' | 'UNIFORM' | 'KEYS' | 'OTHER';

export interface AssetMovement {
  id: string;
  kind: 'ISSUE' | 'RETURN' | 'TRANSFER';
  date: string;
  fromEmployeeId: string | null;
  toEmployeeId: string | null;
  condition: string;
  notes?: string;
  recordedAt: string;
}

export interface CompanyAsset {
  id: string;
  name: string;
  code: string;
  category: AssetCategory;
  holderId: string | null;
  issuedOn: string | null;
  conditionOnIssue: string;
  notes?: string;
  returnedOn: string | null;
  conditionOnReturn?: string;
  history: AssetMovement[];
  createdAt: string;
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
  type: 'LEAVE_APPROVED' | 'LEAVE_REJECTED' | 'CONTRACT_EXPIRY' | 'PAYROLL_FINALIZED' | 'PAYSLIP_AVAILABLE' | 'PENDING_APPROVAL' | 'GENERAL' | 'SERVICE_CHARGE_DISTRIBUTED' | 'COMPLIANCE_ALERT' | 'THR_DUE' | 'CONTRACT_EXPIRING' | 'BPJS_DUE' | 'PPh21_DUE';
  title: string;
  message: string;
  readAt?: string;
  createdAt: string;
}

export interface ServiceChargeConfig {
  id: string;
  periodId: string;
  serviceChargePercentage: number;
  revenueBase?: number;
  totalServiceChargePool: number;
  distributionMethod: 'EQUAL' | 'BY_DEPARTMENT' | 'BY_ROLE_WEIGHT' | 'BY_HOURS';
  eligibleDepartmentIds: string[];
  roleWeights: Record<string, number>;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
}

export interface ServiceChargeDistribution {
  id: string;
  configId: string;
  periodId: string;
  employeeId: string;
  payrollRecordId?: string;
  amount: number;
  distributionBasis: string;
  status: 'DRAFT' | 'DISTRIBUTED' | 'PAID';
  distributedAt?: string;
}
