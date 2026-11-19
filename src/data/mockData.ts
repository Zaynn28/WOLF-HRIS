import { Employee, Department, Position, Shift, Attendance, LeaveRequest, OvertimeRequest, PayrollPeriod, PayrollRecord, EmployeeDocument, AuditLog, Notification, LeaveType, ServiceChargeConfig, ServiceChargeDistribution, PayrollItem, PTKPTable, TERTable, BPJSRates, UMKTable, ComplianceRule, THRCalculation, OffboardingCalculation, EmployeeLoan, ShiftAssignment, EmploymentContract } from '../types';
import { EMP } from './mockPayrollConfigs';
import { buildDemoAttendance } from './mockAttendanceSeed';

const D = {
  fo: '550e8400-e29b-41d4-a716-446655440003',
  hk: '550e8400-e29b-41d4-a716-446655440002',
  fb: '550e8400-e29b-41d4-a716-446655440001',
  sec: '550e8400-e29b-41d4-a716-446655440007',
  eng: '550e8400-e29b-41d4-a716-446655440004',
  hr: '550e8400-e29b-41d4-a716-446655440005',
};

const P = {
  receptionist: '550e8400-e29b-41d4-a716-446655440015',
  roomAtt: '550e8400-e29b-41d4-a716-446655440014',
  fbService: '550e8400-e29b-41d4-a716-446655440012',
  security: '550e8400-e29b-41d4-a716-446655440019',
  hkSup: '550e8400-e29b-41d4-a716-446655440013',
  engTec: '550e8400-e29b-41d4-a716-446655440017',
  hrStaff: '550e8400-e29b-41d4-a716-446655440018',
};

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

export const employees: Employee[] = [
  {
    id: EMP.siti,
    employeeCode: 'BZG-FO-01',
    fullName: 'Siti Nurhaliza',
    preferredName: 'Siti',
    nik: '3174015201900001',
    npwp: '10.20.30.40-567.000',
    dateOfBirth: '1990-05-12',
    gender: 'F',
    phone: '081234567801',
    email: 'siti.nurhaliza@bzg.demo',
    address: 'Jl. Melati 12, Denpasar',
    emergencyContactName: 'Ahmad Nurhaliza',
    emergencyContactPhone: '081234567891',
    departmentId: D.fo,
    positionId: P.receptionist,
    employmentStatus: 'ACTIVE',
    joinDate: '2022-03-01',
    bankName: 'Mandiri',
    bankAccountNumber: '1400012345678',
    bankAccountName: 'SITI NURHALIZA',
    ptkpCode: 'TK/0',
    bpjsEnrolled: true,
    companyCoversEmployeeBpjs: false,
    taxConfiguration: 'netto',
    serviceChargeEligible: true,
    bpjsKesehatanApplicable: true,
    bpjsTkApplicable: true,
    pph21Applicable: true,
  },
  {
    id: EMP.budi,
    employeeCode: 'BZG-HK-02',
    fullName: 'Budi Santoso',
    preferredName: 'Budi',
    nik: '3174011201880002',
    npwp: '10.20.30.40-567.001',
    dateOfBirth: '1988-02-12',
    gender: 'M',
    phone: '081234567802',
    email: 'budi.santoso@bzg.demo',
    address: 'Jl. Anggrek 8, Badung',
    emergencyContactName: 'Sari Santoso',
    emergencyContactPhone: '081234567892',
    departmentId: D.hk,
    positionId: P.roomAtt,
    employmentStatus: 'ACTIVE',
    joinDate: '2021-06-15',
    bankName: 'BNI',
    bankAccountNumber: '0112345678',
    bankAccountName: 'BUDI SANTOSO',
    ptkpCode: 'K/1',
    bpjsEnrolled: true,
    companyCoversEmployeeBpjs: false,
    taxConfiguration: 'gross',
    serviceChargeEligible: true,
    bpjsKesehatanApplicable: true,
    bpjsTkApplicable: true,
    pph21Applicable: true,
  },
  {
    id: EMP.dewi,
    employeeCode: 'BZG-FB-03',
    fullName: 'Dewi Lestari',
    preferredName: 'Dewi',
    nik: '3174015501930003',
    npwp: '10.20.30.40-567.002',
    dateOfBirth: '1993-08-15',
    gender: 'F',
    phone: '081234567803',
    email: 'dewi.lestari@bzg.demo',
    address: 'Jl. Mawar 3, Denpasar',
    emergencyContactName: 'Rudi Lestari',
    emergencyContactPhone: '081234567893',
    departmentId: D.fb,
    positionId: P.fbService,
    employmentStatus: 'ACTIVE',
    joinDate: '2024-01-10',
    bankName: 'BRI',
    bankAccountNumber: '020601234567890',
    bankAccountName: 'DEWI LESTARI',
    ptkpCode: 'TK/0',
    bpjsEnrolled: true,
    companyCoversEmployeeBpjs: false,
    taxConfiguration: 'netto',
    serviceChargeEligible: true,
    bpjsKesehatanApplicable: true,
    bpjsTkApplicable: true,
    pph21Applicable: true,
  },
  {
    id: EMP.agus,
    employeeCode: 'BZG-SEC-04',
    fullName: 'Agus Pratama',
    preferredName: 'Agus',
    nik: '3174011801850004',
    dateOfBirth: '1985-11-18',
    gender: 'M',
    phone: '081234567804',
    email: 'agus.pratama@bzg.demo',
    address: 'Jl. Kenanga 21, Gianyar',
    emergencyContactName: 'Tina Pratama',
    emergencyContactPhone: '081234567894',
    departmentId: D.sec,
    positionId: P.security,
    employmentStatus: 'ACTIVE',
    joinDate: '2020-09-01',
    bankName: 'Mandiri',
    bankAccountNumber: '1400098765432',
    bankAccountName: 'AGUS PRATAMA',
    ptkpCode: 'K/0',
    bpjsEnrolled: true,
    companyCoversEmployeeBpjs: false,
    taxConfiguration: 'gross',
    serviceChargeEligible: true,
    bpjsKesehatanApplicable: false,
    bpjsTkApplicable: true,
    pph21Applicable: true,
  },
  {
    id: EMP.rina,
    employeeCode: 'BZG-HK-05',
    fullName: 'Rina Wijaya',
    preferredName: 'Rina',
    nik: '3174016101870005',
    npwp: '10.20.30.40-567.003',
    dateOfBirth: '1987-04-21',
    gender: 'F',
    phone: '081234567805',
    email: 'rina.wijaya@bzg.demo',
    address: 'Jl. Flamboyan 5, Badung',
    emergencyContactName: 'Hendra Wijaya',
    emergencyContactPhone: '081234567895',
    departmentId: D.hk,
    positionId: P.hkSup,
    employmentStatus: 'ACTIVE',
    joinDate: '2019-02-01',
    bankName: 'BNI',
    bankAccountNumber: '0198765432',
    bankAccountName: 'RINA WIJAYA',
    ptkpCode: 'K/2',
    bpjsEnrolled: true,
    companyCoversEmployeeBpjs: false,
    taxConfiguration: 'netto',
    serviceChargeEligible: true,
    bpjsKesehatanApplicable: true,
    bpjsTkApplicable: true,
    pph21Applicable: true,
  },
  {
    id: EMP.andi,
    employeeCode: 'BZG-ENG-06',
    fullName: 'Andi Kusuma',
    preferredName: 'Andi',
    nik: '3174012201910006',
    npwp: '10.20.30.40-567.004',
    dateOfBirth: '1991-07-22',
    gender: 'M',
    phone: '081234567806',
    email: 'andi.kusuma@bzg.demo',
    address: 'Jl. Cempaka 9, Denpasar',
    emergencyContactName: 'Lina Kusuma',
    emergencyContactPhone: '081234567896',
    departmentId: D.eng,
    positionId: P.engTec,
    employmentStatus: 'ACTIVE',
    joinDate: '2023-05-01',
    bankName: 'BRI',
    bankAccountNumber: '020609876543210',
    bankAccountName: 'ANDI KUSUMA',
    ptkpCode: 'K/0',
    bpjsEnrolled: true,
    companyCoversEmployeeBpjs: false,
    taxConfiguration: 'gross',
    serviceChargeEligible: true,
    bpjsKesehatanApplicable: true,
    bpjsTkApplicable: true,
    pph21Applicable: true,
  },
  {
    id: EMP.maya,
    employeeCode: 'BZG-HR-07',
    fullName: 'Maya Putri',
    preferredName: 'Maya',
    nik: '3174016301890007',
    npwp: '10.20.30.40-567.005',
    dateOfBirth: '1989-12-03',
    gender: 'F',
    phone: '081234567807',
    email: 'maya.putri@bzg.demo',
    address: 'Jl. Dahlia 14, Denpasar',
    emergencyContactName: 'Yoga Putri',
    emergencyContactPhone: '081234567897',
    departmentId: D.hr,
    positionId: P.hrStaff,
    employmentStatus: 'ACTIVE',
    joinDate: '2018-08-01',
    bankName: 'Mandiri',
    bankAccountNumber: '1400055512345',
    bankAccountName: 'MAYA PUTRI',
    ptkpCode: 'TK/0',
    bpjsEnrolled: true,
    companyCoversEmployeeBpjs: false,
    taxConfiguration: 'netto',
    serviceChargeEligible: true,
    bpjsKesehatanApplicable: true,
    bpjsTkApplicable: true,
    pph21Applicable: true,
  },
  {
    id: EMP.joko,
    employeeCode: 'BZG-FB-08',
    fullName: 'Joko Susilo',
    preferredName: 'Joko',
    nik: '3174011501950008',
    dateOfBirth: '1995-03-15',
    gender: 'M',
    phone: '081234567808',
    email: 'joko.susilo@bzg.demo',
    address: 'Jl. Teratai 2, Tabanan',
    emergencyContactName: 'Wati Susilo',
    emergencyContactPhone: '081234567898',
    departmentId: D.fb,
    positionId: P.fbService,
    employmentStatus: 'ACTIVE',
    joinDate: '2026-08-01',
    bankName: 'BNI',
    bankAccountNumber: '0155512345',
    bankAccountName: 'JOKO SUSILO',
    ptkpCode: 'TK/0',
    bpjsEnrolled: true,
    companyCoversEmployeeBpjs: false,
    taxConfiguration: 'gross',
    serviceChargeEligible: false,
    bpjsKesehatanApplicable: false,
    bpjsTkApplicable: true,
    pph21Applicable: true,
  },
];

export const employmentContracts: EmploymentContract[] = [
  { id: 'ctr-siti', employeeId: EMP.siti, type: 'PKWTT', startDate: '2022-03-01', endDate: null, status: 'active', basicSalary: 4_500_000, allowance: 3_000_000 },
  { id: 'ctr-budi', employeeId: EMP.budi, type: 'PKWTT', startDate: '2021-06-15', endDate: null, status: 'active', basicSalary: 3_300_000, allowance: 2_200_000 },
  { id: 'ctr-dewi', employeeId: EMP.dewi, type: 'PKWT', startDate: '2024-01-10', endDate: '2026-12-31', status: 'active', basicSalary: 3_600_000, allowance: 2_400_000 },
  { id: 'ctr-agus', employeeId: EMP.agus, type: 'PKWTT', startDate: '2020-09-01', endDate: null, status: 'active', basicSalary: 0, allowance: 0 },
  { id: 'ctr-rina', employeeId: EMP.rina, type: 'PKWTT', startDate: '2019-02-01', endDate: null, status: 'active', basicSalary: 5_100_000, allowance: 3_400_000 },
  { id: 'ctr-andi', employeeId: EMP.andi, type: 'PKWTT', startDate: '2023-05-01', endDate: null, status: 'active', basicSalary: 3_900_000, allowance: 2_600_000 },
  { id: 'ctr-maya', employeeId: EMP.maya, type: 'PKWTT', startDate: '2018-08-01', endDate: null, status: 'active', basicSalary: 5_400_000, allowance: 3_600_000 },
];

export const attendance: Attendance[] = buildDemoAttendance();

export const shiftAssignments: ShiftAssignment[] = [
  { id: 'sa-siti', employeeId: EMP.siti, date: '2026-11-01', shiftId: 's4' },
  { id: 'sa-budi', employeeId: EMP.budi, date: '2026-11-01', shiftId: 's1' },
  { id: 'sa-dewi', employeeId: EMP.dewi, date: '2026-11-01', shiftId: 's2' },
  { id: 'sa-agus', employeeId: EMP.agus, date: '2026-11-01', shiftId: 's3' },
  { id: 'sa-rina', employeeId: EMP.rina, date: '2026-11-01', shiftId: 's1' },
  { id: 'sa-andi', employeeId: EMP.andi, date: '2026-11-01', shiftId: 's1' },
  { id: 'sa-maya', employeeId: EMP.maya, date: '2026-11-01', shiftId: 's4' },
  { id: 'sa-joko', employeeId: EMP.joko, date: '2026-11-01', shiftId: 's2' },
];

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

export const leaveRequests: LeaveRequest[] = [
  {
    id: 'lv-budi-unpaid',
    employeeId: EMP.budi,
    leaveTypeId: 'lt12',
    startDate: '2026-11-10',
    endDate: '2026-11-11',
    totalDays: 2,
    reason: 'Family matter — unpaid',
    status: 'APPROVED',
    submittedAt: '2026-11-08T03:00:00Z',
    approvedBy: EMP.maya,
    approvedAt: '2026-11-08T06:00:00Z',
  },
  {
    id: 'lv-andi-unpaid',
    employeeId: EMP.andi,
    leaveTypeId: 'lt12',
    startDate: '2026-11-18',
    endDate: '2026-11-18',
    totalDays: 1,
    reason: 'Personal — unpaid',
    status: 'APPROVED',
    submittedAt: '2026-11-16T02:00:00Z',
    approvedBy: EMP.maya,
    approvedAt: '2026-11-16T05:00:00Z',
  },
];

export const overtimeRequests: OvertimeRequest[] = [
  {
    id: 'ot-dewi-1',
    employeeId: EMP.dewi,
    date: '2026-11-07',
    startTime: '22:30',
    endTime: '02:30',
    totalMinutes: 240,
    reason: 'Banquet overflow — weekday OT',
    status: 'APPROVED',
    requestedBy: EMP.dewi,
    approvedBy: EMP.maya,
    approvedAt: '2026-11-07T10:00:00Z',
    writtenOrder: true,
    employeeConsent: true,
    settlement: 'PAID',
  },
];

/** Open Nov 2026 pay period — cut-off 26 Oct–25 Nov */
export const payrollPeriods: PayrollPeriod[] = [
  {
    id: 'pp-2026-11',
    periodCode: '2026-11',
    startDate: '2026-10-26',
    endDate: '2026-11-25',
    payDate: '2026-12-05',
    status: 'DRAFT',
    createdBy: EMP.maya,
  },
];

export const payrollRecords: PayrollRecord[] = [];

export const payrollItems: PayrollItem[] = [];

export const serviceChargeConfigs: ServiceChargeConfig[] = [
  {
    id: 'scc-demo-oct',
    periodId: 'pp-2026-11',
    serviceChargePercentage: 50,
    revenueBase: 200_000_000,
    totalServiceChargePool: 100_000_000,
    distributionMethod: 'EQUAL',
    eligibleDepartmentIds: [],
    roleWeights: {},
    isActive: true,
    createdBy: EMP.maya,
    createdAt: '2026-11-01T00:00:00Z',
  },
];

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
    // Demo JKK only for local payroll cycle — not statutory authority (Compliance UI stays blank in prod path).
    jkkPercent: 0.24,
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

export const employeeLoans: EmployeeLoan[] = [
  {
    id: 'loan-andi-1',
    employeeId: EMP.andi,
    loanType: 'SALARY_ADVANCE',
    principalAmount: 3_000_000,
    remainingBalance: 2_000_000,
    monthlyInstallment: 500_000,
    startDate: '2026-09-01',
    endDate: '2027-02-28',
    purpose: 'Emergency medical',
    status: 'ACTIVE',
    createdAt: '2026-08-28T00:00:00Z',
  },
];
