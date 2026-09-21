import { Employee, Department, Position, Shift, Attendance, LeaveRequest, OvertimeRequest, PayrollPeriod, PayrollRecord, EmployeeDocument, AuditLog, Notification, LeaveType } from '../types';

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
  { id: '550e8400-e29b-41d4-a716-446655440101', employeeCode: 'EMP-001', fullName: 'Ahmad Wijaya', preferredName: 'Ahmad', nik: '3201010101900001', npwp: '01.234.567.8-012.000', dateOfBirth: '1990-01-15', gender: 'M', phone: '+6281234567890', email: 'ahmad.wijaya@hotel.com', address: 'Jl. Sudirman No. 12, Jakarta', emergencyContactName: 'Siti Wijaya', emergencyContactPhone: '+6281234567891', departmentId: '550e8400-e29b-41d4-a716-446655440001', positionId: '550e8400-e29b-41d4-a716-446655440011', employmentStatus: 'ACTIVE', joinDate: '2020-03-01', bankName: 'BCA', bankAccountNumber: '1234567890', bankAccountName: 'Ahmad Wijaya' },
  { id: '550e8400-e29b-41d4-a716-446655440102', employeeCode: 'EMP-002', fullName: 'Dewi Lestari', preferredName: 'Dewi', nik: '3201010102920002', npwp: '02.345.678.9-012.000', dateOfBirth: '1992-05-22', gender: 'F', phone: '+6281234567892', email: 'dewi.lestari@hotel.com', address: 'Jl. Gatot Subroto No. 5, Jakarta', emergencyContactName: 'Budi Lestari', emergencyContactPhone: '+6281234567893', departmentId: '550e8400-e29b-41d4-a716-446655440002', positionId: '550e8400-e29b-41d4-a716-446655440013', employmentStatus: 'ACTIVE', joinDate: '2019-07-15', bankName: 'Mandiri', bankAccountNumber: '2345678901', bankAccountName: 'Dewi Lestari' },
  { id: '550e8400-e29b-41d4-a716-446655440103', employeeCode: 'EMP-003', fullName: 'Budi Santoso', preferredName: 'Budi', nik: '3201010103880003', npwp: '03.456.789.0-012.000', dateOfBirth: '1988-11-08', gender: 'M', phone: '+6281234567894', email: 'budi.santoso@hotel.com', address: 'Jl. Thamrin No. 20, Jakarta', emergencyContactName: 'Rina Santoso', emergencyContactPhone: '+6281234567895', departmentId: '550e8400-e29b-41d4-a716-446655440003', positionId: '550e8400-e29b-41d4-a716-446655440016', employmentStatus: 'ACTIVE', joinDate: '2018-01-10', bankName: 'BNI', bankAccountNumber: '3456789012', bankAccountName: 'Budi Santoso' },
  { id: '550e8400-e29b-41d4-a716-446655440104', employeeCode: 'EMP-004', fullName: 'Sari Rahayu', preferredName: 'Sari', nik: '3201010104950004', npwp: '04.567.890.1-012.000', dateOfBirth: '1995-03-18', gender: 'F', phone: '+6281234567896', email: 'sari.rahayu@hotel.com', address: 'Jl. Kuningan No. 8, Jakarta', emergencyContactName: 'Agus Rahayu', emergencyContactPhone: '+6281234567897', departmentId: '550e8400-e29b-41d4-a716-446655440001', positionId: '550e8400-e29b-41d4-a716-446655440012', employmentStatus: 'ACTIVE', joinDate: '2022-06-01', bankName: 'BCA', bankAccountNumber: '4567890123', bankAccountName: 'Sari Rahayu' },
  { id: '550e8400-e29b-41d4-a716-446655440105', employeeCode: 'EMP-005', fullName: 'Rudi Hermawan', preferredName: 'Rudi', nik: '3201010105910005', npwp: '05.678.901.2-012.000', dateOfBirth: '1991-09-30', gender: 'M', phone: '+6281234567898', email: 'rudi.hermawan@hotel.com', address: 'Jl. Rasuna Said No. 15, Jakarta', emergencyContactName: 'Maya Hermawan', emergencyContactPhone: '+6281234567899', departmentId: '550e8400-e29b-41d4-a716-446655440004', positionId: '550e8400-e29b-41d4-a716-446655440017', employmentStatus: 'ACTIVE', joinDate: '2021-02-14', bankName: 'BRI', bankAccountNumber: '5678901234', bankAccountName: 'Rudi Hermawan' },
  { id: '550e8400-e29b-41d4-a716-446655440106', employeeCode: 'EMP-006', fullName: 'Linda Kusuma', preferredName: 'Linda', nik: '3201010106930006', npwp: '06.789.012.3-012.000', dateOfBirth: '1993-07-12', gender: 'F', phone: '+6281234567900', email: 'linda.kusuma@hotel.com', address: 'Jl. Casablanca No. 3, Jakarta', emergencyContactName: 'Toni Kusuma', emergencyContactPhone: '+6281234567901', departmentId: '550e8400-e29b-41d4-a716-446655440002', positionId: '550e8400-e29b-41d4-a716-446655440014', employmentStatus: 'ACTIVE', joinDate: '2023-01-09', bankName: 'BCA', bankAccountNumber: '6789012345', bankAccountName: 'Linda Kusuma' },
  { id: '550e8400-e29b-41d4-a716-446655440107', employeeCode: 'EMP-007', fullName: 'Hendra Pratama', preferredName: 'Hendra', nik: '3201010107870007', npwp: '07.890.123.4-012.000', dateOfBirth: '1987-12-25', gender: 'M', phone: '+6281234567902', email: 'hendra.pratama@hotel.com', address: 'Jl. HR Rasuna Said No. 7, Jakarta', emergencyContactName: 'Diana Pratama', emergencyContactPhone: '+6281234567903', departmentId: '550e8400-e29b-41d4-a716-446655440007', positionId: '550e8400-e29b-41d4-a716-446655440019', employmentStatus: 'ACTIVE', joinDate: '2019-11-20', bankName: 'Mandiri', bankAccountNumber: '7890123456', bankAccountName: 'Hendra Pratama' },
  { id: '550e8400-e29b-41d4-a716-446655440108', employeeCode: 'EMP-008', fullName: 'Nina Marlina', preferredName: 'Nina', nik: '3201010108940008', npwp: '08.901.234.5-012.000', dateOfBirth: '1994-04-05', gender: 'F', phone: '+6281234567904', email: 'nina.marlina@hotel.com', address: 'Jl. Sudirman No. 45, Jakarta', emergencyContactName: 'Rudi Marlina', emergencyContactPhone: '+6281234567905', departmentId: '550e8400-e29b-41d4-a716-446655440003', positionId: '550e8400-e29b-41d4-a716-446655440015', employmentStatus: 'ACTIVE', joinDate: '2022-09-01', bankName: 'BCA', bankAccountNumber: '8901234567', bankAccountName: 'Nina Marlina' },
  { id: '550e8400-e29b-41d4-a716-446655440109', employeeCode: 'EMP-009', fullName: 'Tono Wibisono', preferredName: 'Tono', nik: '3201010109890009', npwp: '09.012.345.6-012.000', dateOfBirth: '1989-08-17', gender: 'M', phone: '+6281234567906', email: 'tono.wibisono@hotel.com', address: 'Jl. Gatot Subroto No. 10, Jakarta', emergencyContactName: 'Ratna Wibisono', emergencyContactPhone: '+6281234567907', departmentId: '550e8400-e29b-41d4-a716-446655440006', positionId: '550e8400-e29b-41d4-a716-446655440020', employmentStatus: 'ACTIVE', joinDate: '2020-05-15', bankName: 'BNI', bankAccountNumber: '9012345678', bankAccountName: 'Tono Wibisono' },
  { id: '550e8400-e29b-41d4-a716-446655440110', employeeCode: 'EMP-010', fullName: 'Maya Anggraini', preferredName: 'Maya', nik: '3201010110960010', npwp: '10.123.456.7-012.000', dateOfBirth: '1996-02-28', gender: 'F', phone: '+6281234567908', email: 'maya.anggraini@hotel.com', address: 'Jl. Thamrin No. 30, Jakarta', emergencyContactName: 'Joko Anggraini', emergencyContactPhone: '+6281234567909', departmentId: '550e8400-e29b-41d4-a716-446655440005', positionId: '550e8400-e29b-41d4-a716-446655440018', employmentStatus: 'PROBATION', joinDate: '2025-11-01', bankName: 'BCA', bankAccountNumber: '0123456789', bankAccountName: 'Maya Anggraini' },
  { id: '550e8400-e29b-41d4-a716-446655440111', employeeCode: 'EMP-011', fullName: 'Fajar Nugroho', preferredName: 'Fajar', nik: '3201010111920011', dateOfBirth: '1992-06-14', gender: 'M', phone: '+6281234567910', email: 'fajar.nugroho@hotel.com', address: 'Jl. Kuningan No. 12, Jakarta', emergencyContactName: 'Sri Nugroho', emergencyContactPhone: '+6281234567911', departmentId: '550e8400-e29b-41d4-a716-446655440001', positionId: '550e8400-e29b-41d4-a716-446655440012', employmentStatus: 'ACTIVE', joinDate: '2021-08-20', bankName: 'Mandiri', bankAccountNumber: '1122334455', bankAccountName: 'Fajar Nugroho' },
  { id: '550e8400-e29b-41d4-a716-446655440112', employeeCode: 'EMP-012', fullName: 'Ratna Sari', preferredName: 'Ratna', nik: '3201010112900012', dateOfBirth: '1990-10-03', gender: 'F', phone: '+6281234567912', email: 'ratna.sari@hotel.com', address: 'Jl. Casablanca No. 7, Jakarta', emergencyContactName: 'Bambang Sari', emergencyContactPhone: '+6281234567913', departmentId: '550e8400-e29b-41d4-a716-446655440002', positionId: '550e8400-e29b-41d4-a716-446655440014', employmentStatus: 'ON_LEAVE', joinDate: '2020-04-10', bankName: 'BRI', bankAccountNumber: '2233445566', bankAccountName: 'Ratna Sari' },
];

export const leaveTypes: LeaveType[] = [
  { id: 'lt1', code: 'AL', name: 'Annual Leave', defaultEntitlement: 12, isPaid: true, isActive: true },
  { id: 'lt2', code: 'SL', name: 'Sick Leave', defaultEntitlement: 10, isPaid: true, isActive: true },
  { id: 'lt3', code: 'ML', name: 'Maternity Leave', defaultEntitlement: 90, isPaid: true, isActive: true },
  { id: 'lt4', code: 'UL', name: 'Unpaid Leave', defaultEntitlement: 0, isPaid: false, isActive: true },
  { id: 'lt5', code: 'CL', name: 'Compassionate Leave', defaultEntitlement: 3, isPaid: true, isActive: true },
];

const today = new Date().toISOString().split('T')[0];

export const attendance: Attendance[] = [
  { id: 'a1', employeeId: '550e8400-e29b-41d4-a716-446655440101', attendanceDate: today, shiftId: 's1', clockIn: '05:55', clockOut: '14:35', status: 'PRESENT', lateMinutes: 0 },
  { id: 'a2', employeeId: '550e8400-e29b-41d4-a716-446655440102', attendanceDate: today, shiftId: 's4', clockIn: '08:15', clockOut: undefined, status: 'LATE', lateMinutes: 15 },
  { id: 'a3', employeeId: '550e8400-e29b-41d4-a716-446655440103', attendanceDate: today, shiftId: 's4', clockIn: '07:50', clockOut: undefined, status: 'PRESENT' },
  { id: 'a4', employeeId: '550e8400-e29b-41d4-a716-446655440104', attendanceDate: today, shiftId: 's2', clockIn: undefined, clockOut: undefined, status: 'ABSENT' },
  { id: 'a5', employeeId: '550e8400-e29b-41d4-a716-446655440105', attendanceDate: today, shiftId: 's1', clockIn: '06:00', clockOut: undefined, status: 'PRESENT' },
  { id: 'a6', employeeId: '550e8400-e29b-41d4-a716-446655440106', attendanceDate: today, shiftId: 's1', clockIn: '05:58', clockOut: undefined, status: 'PRESENT' },
  { id: 'a7', employeeId: '550e8400-e29b-41d4-a716-446655440107', attendanceDate: today, shiftId: 's3', clockIn: undefined, clockOut: undefined, status: 'REST_DAY' },
  { id: 'a8', employeeId: '550e8400-e29b-41d4-a716-446655440108', attendanceDate: today, shiftId: 's2', clockIn: '13:55', clockOut: undefined, status: 'PRESENT' },
  { id: 'a9', employeeId: '550e8400-e29b-41d4-a716-446655440109', attendanceDate: today, shiftId: 's4', clockIn: '08:00', clockOut: undefined, status: 'PRESENT' },
  { id: 'a10', employeeId: '550e8400-e29b-41d4-a716-446655440110', attendanceDate: today, shiftId: 's4', clockIn: '08:05', clockOut: undefined, status: 'PRESENT' },
  { id: 'a11', employeeId: '550e8400-e29b-41d4-a716-446655440111', attendanceDate: today, shiftId: 's1', clockIn: '06:10', clockOut: undefined, status: 'LATE', lateMinutes: 10 },
  { id: 'a12', employeeId: '550e8400-e29b-41d4-a716-446655440112', attendanceDate: today, shiftId: 's1', clockIn: undefined, clockOut: undefined, status: 'ON_LEAVE' },
];

export const leaveRequests: LeaveRequest[] = [
  { id: 'lr1', employeeId: '550e8400-e29b-41d4-a716-446655440104', leaveTypeId: 'lt1', startDate: '2026-01-20', endDate: '2026-01-22', totalDays: 3, reason: 'Family vacation', status: 'PENDING', submittedAt: '2026-01-10T08:00:00Z' },
  { id: 'lr2', employeeId: '550e8400-e29b-41d4-a716-446655440112', leaveTypeId: 'lt2', startDate: '2026-01-13', endDate: '2026-01-17', totalDays: 5, reason: 'Medical treatment', status: 'APPROVED', submittedAt: '2026-01-08T09:00:00Z', approvedBy: '550e8400-e29b-41d4-a716-446655440102', approvedAt: '2026-01-09T10:00:00Z' },
  { id: 'lr3', employeeId: '550e8400-e29b-41d4-a716-446655440106', leaveTypeId: 'lt1', startDate: '2026-01-25', endDate: '2026-01-26', totalDays: 2, reason: 'Personal matters', status: 'PENDING', submittedAt: '2026-01-12T14:00:00Z' },
  { id: 'lr4', employeeId: '550e8400-e29b-41d4-a716-446655440111', leaveTypeId: 'lt5', startDate: '2026-01-15', endDate: '2026-01-15', totalDays: 1, reason: 'Family bereavement', status: 'APPROVED', submittedAt: '2026-01-14T07:00:00Z', approvedBy: '550e8400-e29b-41d4-a716-446655440101', approvedAt: '2026-01-14T08:00:00Z' },
  { id: 'lr5', employeeId: '550e8400-e29b-41d4-a716-446655440108', leaveTypeId: 'lt1', startDate: '2026-02-01', endDate: '2026-02-03', totalDays: 3, reason: 'Holiday trip', status: 'PENDING', submittedAt: '2026-01-13T11:00:00Z' },
];

export const overtimeRequests: OvertimeRequest[] = [
  { id: 'ot1', employeeId: '550e8400-e29b-41d4-a716-446655440104', date: '2026-01-12', startTime: '14:30', endTime: '18:30', totalMinutes: 240, reason: 'Event coverage - banquet', status: 'APPROVED', requestedBy: '550e8400-e29b-41d4-a716-446655440101', approvedBy: '550e8400-e29b-41d4-a716-446655440101', approvedAt: '2026-01-11T16:00:00Z' },
  { id: 'ot2', employeeId: '550e8400-e29b-41d4-a716-446655440111', date: '2026-01-13', startTime: '14:30', endTime: '17:30', totalMinutes: 180, reason: 'VIP dinner service', status: 'PENDING', requestedBy: '550e8400-e29b-41d4-a716-446655440101' },
  { id: 'ot3', employeeId: '550e8400-e29b-41d4-a716-446655440105', date: '2026-01-11', startTime: '14:30', endTime: '20:30', totalMinutes: 360, reason: 'Emergency AC repair', status: 'APPROVED', requestedBy: '550e8400-e29b-41d4-a716-446655440105', approvedBy: '550e8400-e29b-41d4-a716-446655440103', approvedAt: '2026-01-11T08:00:00Z' },
  { id: 'ot4', employeeId: '550e8400-e29b-41d4-a716-446655440106', date: '2026-01-14', startTime: '14:30', endTime: '16:30', totalMinutes: 120, reason: 'Deep cleaning - floor 5-8', status: 'PENDING', requestedBy: '550e8400-e29b-41d4-a716-446655440102' },
];

export const payrollPeriods: PayrollPeriod[] = [
  { id: 'pp1', periodCode: '2025-12', startDate: '2025-12-01', endDate: '2025-12-31', payDate: '2026-01-05', status: 'FINALIZED', createdBy: '550e8400-e29b-41d4-a716-446655440109', approvedBy: '550e8400-e29b-41d4-a716-446655440109', finalizedAt: '2026-01-03T10:00:00Z' },
  { id: 'pp2', periodCode: '2026-01', startDate: '2026-01-01', endDate: '2026-01-31', payDate: '2026-02-05', status: 'CALCULATED', createdBy: '550e8400-e29b-41d4-a716-446655440109' },
];

export const payrollRecords: PayrollRecord[] = [
  { id: 'pr1', payrollPeriodId: 'pp2', employeeId: '550e8400-e29b-41d4-a716-446655440101', grossPay: 12500000, totalDeductions: 1875000, netPay: 10625000, status: 'CALCULATED' },
  { id: 'pr2', payrollPeriodId: 'pp2', employeeId: '550e8400-e29b-41d4-a716-446655440102', grossPay: 9800000, totalDeductions: 1470000, netPay: 8330000, status: 'CALCULATED' },
  { id: 'pr3', payrollPeriodId: 'pp2', employeeId: '550e8400-e29b-41d4-a716-446655440103', grossPay: 14200000, totalDeductions: 2130000, netPay: 12070000, status: 'CALCULATED' },
  { id: 'pr4', payrollPeriodId: 'pp2', employeeId: '550e8400-e29b-41d4-a716-446655440104', grossPay: 5500000, totalDeductions: 825000, netPay: 4675000, status: 'CALCULATED' },
  { id: 'pr5', payrollPeriodId: 'pp2', employeeId: '550e8400-e29b-41d4-a716-446655440105', grossPay: 7200000, totalDeductions: 1080000, netPay: 6120000, status: 'CALCULATED' },
  { id: 'pr6', payrollPeriodId: 'pp2', employeeId: '550e8400-e29b-41d4-a716-446655440106', grossPay: 5200000, totalDeductions: 780000, netPay: 4420000, status: 'CALCULATED' },
  { id: 'pr7', payrollPeriodId: 'pp2', employeeId: '550e8400-e29b-41d4-a716-446655440107', grossPay: 5800000, totalDeductions: 870000, netPay: 4930000, status: 'CALCULATED' },
  { id: 'pr8', payrollPeriodId: 'pp2', employeeId: '550e8400-e29b-41d4-a716-446655440108', grossPay: 5400000, totalDeductions: 810000, netPay: 4590000, status: 'CALCULATED' },
  { id: 'pr9', payrollPeriodId: 'pp2', employeeId: '550e8400-e29b-41d4-a716-446655440109', grossPay: 8500000, totalDeductions: 1275000, netPay: 7225000, status: 'CALCULATED' },
  { id: 'pr10', payrollPeriodId: 'pp2', employeeId: '550e8400-e29b-41d4-a716-446655440110', grossPay: 5000000, totalDeductions: 750000, netPay: 4250000, status: 'CALCULATED' },
  { id: 'pr11', payrollPeriodId: 'pp2', employeeId: '550e8400-e29b-41d4-a716-446655440111', grossPay: 5500000, totalDeductions: 825000, netPay: 4675000, status: 'CALCULATED' },
  { id: 'pr12', payrollPeriodId: 'pp2', employeeId: '550e8400-e29b-41d4-a716-446655440112', grossPay: 5200000, totalDeductions: 780000, netPay: 4420000, status: 'CALCULATED' },
];

export const documents: EmployeeDocument[] = [
  { id: 'doc1', employeeId: '550e8400-e29b-41d4-a716-446655440101', documentTypeName: 'KTP', fileName: 'ktp_ahmad_wijaya.pdf', fileSize: 245000, issueDate: '2020-01-15', expiryDate: '2030-01-15', verificationStatus: 'VERIFIED', uploadedAt: '2020-03-01T08:00:00Z' },
  { id: 'doc2', employeeId: '550e8400-e29b-41d4-a716-446655440101', documentTypeName: 'NPWP', fileName: 'npwp_ahmad_wijaya.pdf', fileSize: 180000, verificationStatus: 'VERIFIED', uploadedAt: '2020-03-01T08:05:00Z' },
  { id: 'doc3', employeeId: '550e8400-e29b-41d4-a716-446655440101', documentTypeName: 'Employment Contract', fileName: 'contract_ahmad_wijaya.pdf', fileSize: 520000, issueDate: '2020-03-01', expiryDate: '2026-02-28', verificationStatus: 'VERIFIED', uploadedAt: '2020-03-01T08:10:00Z' },
  { id: 'doc4', employeeId: '550e8400-e29b-41d4-a716-446655440102', documentTypeName: 'KTP', fileName: 'ktp_dewi_lestari.pdf', fileSize: 230000, verificationStatus: 'VERIFIED', uploadedAt: '2019-07-15T09:00:00Z' },
  { id: 'doc5', employeeId: '550e8400-e29b-41d4-a716-446655440110', documentTypeName: 'KTP', fileName: 'ktp_maya_anggraini.pdf', fileSize: 210000, verificationStatus: 'PENDING', uploadedAt: '2025-11-01T10:00:00Z' },
  { id: 'doc6', employeeId: '550e8400-e29b-41d4-a716-446655440110', documentTypeName: 'BPJS Kesehatan', fileName: 'bpjs_maya.pdf', fileSize: 150000, verificationStatus: 'PENDING', uploadedAt: '2025-11-01T10:05:00Z' },
  { id: 'doc7', employeeId: '550e8400-e29b-41d4-a716-446655440104', documentTypeName: 'Employment Contract', fileName: 'contract_sari_rahayu.pdf', fileSize: 480000, issueDate: '2022-06-01', expiryDate: '2026-05-31', verificationStatus: 'VERIFIED', uploadedAt: '2022-06-01T08:00:00Z' },
];

export const auditLogs: AuditLog[] = [
  { id: 'al1', userId: 'u1', userName: 'Admin HR', action: 'CREATE', entityType: 'Employee', entityId: '550e8400-e29b-41d4-a716-446655440110', newValue: 'Maya Anggraini created', createdAt: '2025-11-01T10:00:00Z', ipAddress: '192.168.1.10' },
  { id: 'al2', userId: 'u1', userName: 'Admin HR', action: 'APPROVE', entityType: 'LeaveRequest', entityId: 'lr2', newValue: 'Approved by Dewi Lestari', createdAt: '2026-01-09T10:00:00Z', ipAddress: '192.168.1.10' },
  { id: 'al3', userId: 'u2', userName: 'Payroll Staff', action: 'CALCULATE', entityType: 'PayrollPeriod', entityId: 'pp2', newValue: 'Payroll 2026-01 calculated', createdAt: '2026-01-12T14:00:00Z', ipAddress: '192.168.1.15' },
  { id: 'al4', userId: 'u1', userName: 'Admin HR', action: 'UPDATE', entityType: 'Employee', entityId: '550e8400-e29b-41d4-a716-446655440104', oldValue: 'Status: ACTIVE', newValue: 'Status: ACTIVE, Bank updated', createdAt: '2026-01-10T11:00:00Z', ipAddress: '192.168.1.10' },
  { id: 'al5', userId: 'u1', userName: 'Admin HR', action: 'APPROVE', entityType: 'LeaveRequest', entityId: 'lr4', newValue: 'Approved by Ahmad Wijaya', createdAt: '2026-01-14T08:00:00Z', ipAddress: '192.168.1.10' },
  { id: 'al6', userId: 'u3', userName: 'System', action: 'ALERT', entityType: 'Contract', entityId: '550e8400-e29b-41d4-a716-446655440101', newValue: 'Contract expiring in 45 days', createdAt: '2026-01-14T06:00:00Z', ipAddress: 'system' },
  { id: 'al7', userId: 'u2', userName: 'Payroll Staff', action: 'UPLOAD', entityType: 'Document', entityId: 'doc5', newValue: 'KTP uploaded for Maya Anggraini', createdAt: '2025-11-01T10:00:00Z', ipAddress: '192.168.1.15' },
  { id: 'al8', userId: 'u1', userName: 'Admin HR', action: 'FINALIZE', entityType: 'PayrollPeriod', entityId: 'pp1', newValue: 'Payroll 2025-12 finalized', createdAt: '2026-01-03T10:00:00Z', ipAddress: '192.168.1.10' },
];

export const notifications: Notification[] = [
  { id: 'n1', type: 'PENDING_APPROVAL', title: 'Leave Request Pending', message: 'Sari Rahayu has submitted a leave request for Jan 20-22', createdAt: '2026-01-10T08:00:00Z' },
  { id: 'n2', type: 'CONTRACT_EXPIRY', title: 'Contract Expiring Soon', message: 'Ahmad Wijaya\'s contract expires on Feb 28, 2026', createdAt: '2026-01-14T06:00:00Z' },
  { id: 'n3', type: 'PAYSLIP_AVAILABLE', title: 'Payslip Available', message: 'Your December 2025 payslip is now available', createdAt: '2026-01-05T09:00:00Z' },
  { id: 'n4', type: 'PENDING_APPROVAL', title: 'Overtime Request', message: 'Fajar Nugroho has an overtime request pending approval', createdAt: '2026-01-13T09:00:00Z' },
  { id: 'n5', type: 'LEAVE_APPROVED', title: 'Leave Approved', message: 'Your compassionate leave for Jan 15 has been approved', createdAt: '2026-01-14T08:00:00Z' },
];
