import { Employee, Department, Position, Shift, Attendance, LeaveRequest, OvertimeRequest, PayrollPeriod, PayrollRecord, EmployeeDocument, AuditLog, Notification, LeaveType, ServiceChargeConfig, ServiceChargeDistribution, PayrollItem, PTKPTable, TERTable, BPJSRates, UMKTable, ComplianceRule, THRCalculation, OffboardingCalculation, EmployeeLoan, ShiftAssignment } from '../types';

export const departments: Department[] = [
  { id: '550e8400-e29b-41d4-a716-446655440001', code: 'F&B', name: 'Food & Beverage', description: 'Restaurant, bar, and banquet operations', isActive: true },
  { id: '550e8400-e29b-41d4-a716-446655440002', code: 'HK', name: 'Housekeeping', description: 'Room cleaning and public area maintenance', isActive: true },
  { id: '550e8400-e29b-41d4-a716-446655440003', code: 'FO', name: 'Front Office', description: 'Reception, concierge, and guest services', isActive: true },
  { id: '550e8400-e29b-41d4-a716-446655440004', code: 'ENG', name: 'Engineering', description: 'Building maintenance and technical operations', isActive: true },
  { id: '550e8400-e29b-41d4-a716-446655440005', code: 'HR', name: 'Human Resources', description: 'HR administration and employee relations', isActive: true },
  { id: '550e8400-e29b-41d4-a716-446655440006', code: 'FIN', name: 'Finance', description: 'Accounting, procurement, and financial control', isActive: true },
  { id: '550e8400-e29b-41d4-a716-446655440007', code: 'SEC', name: 'Security', description: 'Hotel security and safety operations', isActive: true },
  { id: '550e8400-e29b-41d4-a716-446655440008', code: 'REV', name: 'Revenue Management', description: 'Pricing, distribution, and revenue optimization', isActive: true },
];

export const positions: Position[] = [
  { id: '550e8400-e29b-41d4-a716-446655440011', code: 'F&B-MGR', title: 'F&B Manager', departmentId: '550e8400-e29b-41d4-a716-446655440001', grade: 'M2', description: 'Manages F&B operations', isActive: true },
  { id: '550e8400-e29b-41d4-a716-446655440012', code: 'F&B-SRV', title: 'F&B Service Staff', departmentId: '550e8400-e29b-41d4-a716-446655440001', grade: 'S1', description: 'Restaurant service', isActive: true },
  { id: '550e8400-e29b-41d4-a716-446655440013', code: 'HK-SUP', title: 'Housekeeping Supervisor', departmentId: '550e8400-e29b-41d4-a716-446655440002', grade: 'S2', description: 'Supervises housekeeping team', isActive: true },
  { id: '550e8400-e29b-41d4-a716-446655440014', code: 'HK-ATT', title: 'Room Attendant', departmentId: '550e8400-e29b-41d4-a716-446655440002', grade: 'S1', description: 'Room cleaning', isActive: true },
  { id: '550e8400-e29b-41d4-a716-446655440015', code: 'FO-RCV', title: 'Receptionist', departmentId: '550e8400-e29b-41d4-a716-446655440003', grade: 'S1', description: 'Front desk operations', isActive: true },
  { id: '550e8400-e29b-41d4-a716-446655440016', code: 'FO-MGR', title: 'Front Office Manager', departmentId: '550e8400-e29b-41d4-a716-446655440003', grade: 'M2', description: 'Manages front office', isActive: true },
  { id: '550e8400-e29b-41d4-a716-446655440017', code: 'ENG-TEC', title: 'Maintenance Technician', departmentId: '550e8400-e29b-41d4-a716-446655440004', grade: 'S1', description: 'Technical maintenance', isActive: true },
  { id: '550e8400-e29b-41d4-a716-446655440018', code: 'HR-STF', title: 'HR Staff', departmentId: '550e8400-e29b-41d4-a716-446655440005', grade: 'S2', description: 'HR administration', isActive: true },
  { id: '550e8400-e29b-41d4-a716-446655440019', code: 'SEC-GRD', title: 'Security Guard', departmentId: '550e8400-e29b-41d4-a716-446655440007', grade: 'S1', description: 'Security patrol', isActive: true },
  { id: '550e8400-e29b-41d4-a716-446655440020', code: 'FIN-ACC', title: 'Accountant', departmentId: '550e8400-e29b-41d4-a716-446655440006', grade: 'S2', description: 'Financial accounting', isActive: true },
];

export const shifts: Shift[] = [
  { id: 's1', code: 'MOR', name: 'Morning Shift', startTime: '06:00', endTime: '14:30', breakMinutes: 60, crossesMidnight: false, isActive: true },
  { id: 's2', code: 'AFT', name: 'Afternoon Shift', startTime: '14:00', endTime: '22:30', breakMinutes: 60, crossesMidnight: false, isActive: true },
  { id: 's3', code: 'NGT', name: 'Night Shift', startTime: '22:00', endTime: '06:30', breakMinutes: 60, crossesMidnight: true, isActive: true },
  { id: 's4', code: 'ADM', name: 'Administrative', startTime: '08:00', endTime: '17:00', breakMinutes: 60, crossesMidnight: false, isActive: true },
];

export const employees: Employee[] = [];

export const attendance: Attendance[] = [];

export const shiftAssignments: ShiftAssignment[] = [];

export const leaveTypes: LeaveType[] = [
  { id: 'lt1', code: 'AL', name: 'Cuti Tahunan (Annual Leave)', defaultEntitlement: 12, requiresAttachment: false, requiresApproval: true, isPaid: true, isActive: true },
  { id: 'lt2', code: 'SL', name: 'Cuti Sakit (Sick Leave)', defaultEntitlement: 0, requiresAttachment: true, requiresApproval: true, isPaid: true, isActive: true },
  { id: 'lt3', code: 'ML', name: 'Cuti Melahirkan (Maternity Leave)', defaultEntitlement: 90, requiresAttachment: true, requiresApproval: true, isPaid: true, isActive: true },
  { id: 'lt4', code: 'PL', name: 'Cuti Ayah (Paternity Leave)', defaultEntitlement: 2, requiresAttachment: false, requiresApproval: true, isPaid: true, isActive: true },
  { id: 'lt5', code: 'MRL', name: 'Cuti Menikah (Marriage Leave)', defaultEntitlement: 3, requiresAttachment: false, requiresApproval: true, isPaid: true, isActive: true },
  { id: 'lt6', code: 'MCL', name: 'Cuti Menikahkan Anak (Child Marriage Leave)', defaultEntitlement: 2, requiresAttachment: false, requiresApproval: true, isPaid: true, isActive: true },
  { id: 'lt7', code: 'CL', name: 'Cuti Menghitamkan Anak (Child Circumcision Leave)', defaultEntitlement: 2, requiresAttachment: false, requiresApproval: true, isPaid: true, isActive: true },
  { id: 'lt8', code: 'BL', name: 'Cuti Membaptiskan Anak (Child Baptism Leave)', defaultEntitlement: 2, requiresAttachment: false, requiresApproval: true, isPaid: true, isActive: true },
  { id: 'lt9', code: 'MIS', name: 'Cuti Istri Keguguran (Miscarriage Leave)', defaultEntitlement: 30, requiresAttachment: true, requiresApproval: true, isPaid: true, isActive: true },
  { id: 'lt10', code: 'BL-C', name: 'Cuti Berkabung - Suami/Istri/Ortua/Mertua/Anak (Immediate Family Death)', defaultEntitlement: 3, requiresAttachment: true, requiresApproval: true, isPaid: true, isActive: true },
  { id: 'lt11', code: 'BL-E', name: 'Cuti Berkabung - Anggota Keluarga Serumah (Household Member Death)', defaultEntitlement: 1, requiresAttachment: true, requiresApproval: true, isPaid: true, isActive: true },
  { id: 'lt12', code: 'UL', name: 'Cuti Tidak Berbayar (Unpaid Leave)', defaultEntitlement: 0, requiresAttachment: false, requiresApproval: true, isPaid: false, isActive: true },
];

export const leaveRequests: LeaveRequest[] = [];

export const overtimeRequests: OvertimeRequest[] = [];

export const payrollPeriods: PayrollPeriod[] = [];

export const payrollRecords: PayrollRecord[] = [];

export const payrollItems: PayrollItem[] = [];

export const serviceChargeConfigs: ServiceChargeConfig[] = [];

export const serviceChargeDistributions: ServiceChargeDistribution[] = [];

export const documents: EmployeeDocument[] = [];

export const auditLogs: AuditLog[] = [];

export const notifications: Notification[] = [];

// ============================================
// Indonesian Compliance Data
// ============================================

export const ptkpTables: PTKPTable[] = [
  { id: 'ptkp1', code: 'TK/0', label: 'TK/0 - Single, no dependents', annualAmount: 54000000, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'ptkp2', code: 'TK/1', label: 'TK/1 - Single, 1 dependent', annualAmount: 58500000, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'ptkp3', code: 'TK/2', label: 'TK/2 - Single, 2 dependents', annualAmount: 63000000, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'ptkp4', code: 'TK/3', label: 'TK/3 - Single, 3 dependents', annualAmount: 67500000, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'ptkp5', code: 'K/0', label: 'K/0 - Married, no dependents', annualAmount: 58500000, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'ptkp6', code: 'K/1', label: 'K/1 - Married, 1 dependent', annualAmount: 63000000, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'ptkp7', code: 'K/2', label: 'K/2 - Married, 2 dependents', annualAmount: 67500000, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'ptkp8', code: 'K/3', label: 'K/3 - Married, 3 dependents', annualAmount: 72000000, createdAt: '2026-01-01T00:00:00Z' },
];

export const terTables: TERTable[] = [
  // TK/0
  { id: 'ter1', ptkpCode: 'TK/0', monthlyGrossMin: 0, monthlyGrossMax: 4000000, terRate: 0, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'ter2', ptkpCode: 'TK/0', monthlyGrossMin: 4000001, monthlyGrossMax: 5000000, terRate: 5, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'ter3', ptkpCode: 'TK/0', monthlyGrossMin: 5000001, monthlyGrossMax: 6000000, terRate: 10, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'ter4', ptkpCode: 'TK/0', monthlyGrossMin: 6000001, monthlyGrossMax: 10000000, terRate: 15, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'ter5', ptkpCode: 'TK/0', monthlyGrossMin: 10000001, monthlyGrossMax: 999999999, terRate: 20, createdAt: '2026-01-01T00:00:00Z' },
  // K/0
  { id: 'ter6', ptkpCode: 'K/0', monthlyGrossMin: 0, monthlyGrossMax: 4000000, terRate: 0, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'ter7', ptkpCode: 'K/0', monthlyGrossMin: 4000001, monthlyGrossMax: 5000000, terRate: 5, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'ter8', ptkpCode: 'K/0', monthlyGrossMin: 5000001, monthlyGrossMax: 6000000, terRate: 10, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'ter9', ptkpCode: 'K/0', monthlyGrossMin: 6000001, monthlyGrossMax: 10000000, terRate: 15, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'ter10', ptkpCode: 'K/0', monthlyGrossMin: 10000001, monthlyGrossMax: 999999999, terRate: 20, createdAt: '2026-01-01T00:00:00Z' },
];

export const bpjsRates: BPJSRates[] = [
  {
    id: 'bpjs1',
    effectiveDate: '2026-01-01T00:00:00Z',
    healthEmployeePercent: 1,
    healthEmployerPercent: 4,
    healthSalaryCap: 12000000,
    jhtEmployeePercent: 2,
    jhtEmployerPercent: 3.7,
    jpEmployeePercent: 1,
    jpEmployerPercent: 2,
    jpSalaryCap: 5000000,
    jkkPercent: 0.54,
    jkmPercent: 0.3,
    createdAt: '2026-01-01T00:00:00Z',
  },
];

export const umkTables: UMKTable[] = [
  { id: 'umk1', region: 'Jakarta', province: 'DKI Jakarta', umk: 5067381, effectiveDate: '2026-01-01T00:00:00Z', createdAt: '2026-01-01T00:00:00Z' },
  { id: 'umk2', region: 'Badung', province: 'Bali', umk: 2937439, effectiveDate: '2026-01-01T00:00:00Z', createdAt: '2026-01-01T00:00:00Z' },
  { id: 'umk3', region: 'Surabaya', province: 'Jawa Timur', umk: 4914903, effectiveDate: '2026-01-01T00:00:00Z', createdAt: '2026-01-01T00:00:00Z' },
];

export const complianceRules: ComplianceRule[] = [
  { id: 'cr1', name: 'Max 4 hours overtime per day', category: 'OVERTIME', rule: 'Overtime cannot exceed 4 hours per day per PP 35/2021', isActive: true, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'cr2', name: 'Max 18 hours overtime per week', category: 'OVERTIME', rule: 'Overtime cannot exceed 18 hours per week per PP 35/2021', isActive: true, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'cr3', name: 'Overtime requires written order and employee consent', category: 'OVERTIME', rule: 'Overtime must have written order and employee approval', isActive: true, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'cr4', name: 'Annual leave 12 days after 12 months', category: 'LEAVE', rule: '12 days annual leave after 12 consecutive months of service', isActive: true, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'cr5', name: 'Daily worker max 21 days/month, 3 months consecutive', category: 'TERMINATION', rule: 'Daily worker automatically converts after 21 days/month or 3 months consecutive', isActive: true, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'cr6', name: 'PKWT max 5 years including extension', category: 'TERMINATION', rule: 'PKWT maximum 5 years including extensions', isActive: true, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'cr7', name: 'THR paid at least H-7 before religious holiday', category: 'PAYROLL', rule: 'THR must be paid at least 7 days before religious holiday', isActive: true, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'cr8', name: 'Block leave on high-season dates', category: 'LEAVE', rule: 'Leave that overlaps configured high-season dates is blocked while this rule is active', isActive: true, createdAt: '2026-01-01T00:00:00Z' },
];

export const thrCalculations: THRCalculation[] = [];

export const offboardingCalculations: OffboardingCalculation[] = [];

export const employeeLoans: EmployeeLoan[] = [];
