import type {
  AccountingPost, Applicant, Attendance, CompanyAsset, EmployeeDocument, EmployeeLoan,
  EmploymentContract, LeaveRequest, LeaveType, OvertimeRequest, PayrollPack, PayrollPeriod,
  PayrollRecord, ReimbursementClaim, ServiceChargeDistribution, Shift,
} from '../types';

const hrRoles = new Set(['HR_STAFF', 'HR_ADMIN', 'SUPER_ADMIN']);
const payrollModules = new Set(['payroll', 'payroll-review', 'service-charge', 'payroll-finance']);
const financeModules = new Set(['reimbursements', 'loans', 'payroll-finance']);

export function canBulkImport(role: string | undefined, moduleId: string): boolean {
  if (!role || role === 'EMPLOYEE') return false;
  if (hrRoles.has(role)) return true;
  if (role === 'PAYROLL' && payrollModules.has(moduleId)) return true;
  if ((role === 'FINANCE' || role === 'FINANCIAL_CONTROLLER') && financeModules.has(moduleId)) return true;
  return false;
}

type Payload = Record<string, any>;
type ImportRow = { natural_key: string; payload: Payload };

type Lookup = {
  employees: { id: string; employeeCode: string; fullName?: string }[];
  leaveTypes: LeaveType[];
  shifts: Shift[];
};

function personId(payload: Payload, lookup: Lookup): string {
  return lookup.employees.find(person => person.id === payload.employeeId || person.employeeCode === payload.employee_code)?.id
    || payload.employeeId
    || '';
}

function replacePrefixed<T extends { id: string }>(prev: T[], incoming: T[], prefix: string): T[] {
  return [...incoming, ...prev.filter(row => !row.id.startsWith(prefix))];
}

export function nextShifts(prev: Shift[], rows: ImportRow[]): Shift[] {
  const incoming: Shift[] = rows.map(row => ({
    id: String(row.payload.id),
    code: row.payload.code,
    name: row.payload.name,
    startTime: row.payload.start_time,
    endTime: row.payload.end_time,
    breakMinutes: Number(row.payload.break_minutes || 0),
    crossesMidnight: Boolean(row.payload.crosses_midnight),
    isActive: true,
  }));
  const codes = new Set(incoming.map(shift => shift.code));
  return [...incoming, ...prev.filter(shift => !shift.id.startsWith('import:shifts:') && !codes.has(shift.code))];
}

export function nextAttendance(prev: Attendance[], rows: ImportRow[], lookup: Lookup): Attendance[] {
  const incoming: Attendance[] = rows.map(row => ({
    id: String(row.payload.id),
    employeeId: personId(row.payload, lookup),
    attendanceDate: row.payload.attendance_date,
    shiftId: lookup.shifts.find(shift => shift.code === row.payload.shift_code)?.id || '',
    clockIn: row.payload.clock_in || undefined,
    clockOut: row.payload.clock_out || undefined,
    status: row.payload.status,
    lateMinutes: row.payload.late_minutes ?? undefined,
    notes: row.payload.notes || undefined,
  }));
  return replacePrefixed(prev, incoming, 'import:attendance:');
}

export function nextLeave(prev: LeaveRequest[], rows: ImportRow[], lookup: Lookup): LeaveRequest[] {
  const incoming: LeaveRequest[] = rows.map(row => ({
    id: String(row.payload.id),
    employeeId: personId(row.payload, lookup),
    leaveTypeId: lookup.leaveTypes.find(type => type.code === row.payload.leave_type_code)?.id || row.payload.leave_type_code,
    startDate: row.payload.start_date,
    endDate: row.payload.end_date,
    totalDays: Number(row.payload.total_days),
    reason: row.payload.reason || '',
    status: row.payload.status || 'PENDING',
    submittedAt: row.payload.submittedAt || new Date().toISOString(),
  }));
  return replacePrefixed(prev, incoming, 'import:leave:');
}

export function nextOvertime(prev: OvertimeRequest[], rows: ImportRow[], lookup: Lookup): OvertimeRequest[] {
  const incoming: OvertimeRequest[] = rows.map(row => ({
    id: String(row.payload.id),
    employeeId: personId(row.payload, lookup),
    date: row.payload.date,
    startTime: row.payload.start_time,
    endTime: row.payload.end_time,
    totalMinutes: Number(row.payload.total_minutes),
    reason: row.payload.reason || '',
    status: row.payload.status || 'PENDING',
    requestedBy: 'import',
  }));
  return replacePrefixed(prev, incoming, 'import:overtime:');
}

export function nextApplicants(prev: Applicant[], rows: ImportRow[]): Applicant[] {
  const incoming: Applicant[] = rows.map(row => ({
    id: String(row.payload.id),
    fullName: row.payload.full_name,
    email: row.payload.email,
    phone: row.payload.phone || '',
    departmentId: row.payload.departmentId,
    positionId: row.payload.positionId,
    status: row.payload.status || 'APPLIED',
    checks: { ktp: false, npwp: false, bank: false, orientation: false },
  }));
  return replacePrefixed(prev, incoming, 'import:hiring:');
}

export function nextContracts(prev: EmploymentContract[], rows: ImportRow[], lookup: Lookup): EmploymentContract[] {
  const incoming: EmploymentContract[] = rows.map(row => ({
    id: String(row.payload.id),
    employeeId: personId(row.payload, lookup),
    type: row.payload.type,
    startDate: row.payload.start_date,
    endDate: row.payload.end_date || null,
    status: row.payload.status || 'active',
    basicSalary: Number(row.payload.basic_salary),
    allowance: Number(row.payload.allowance),
  }));
  return replacePrefixed(prev, incoming, 'import:contracts:');
}

export function nextDocuments(prev: EmployeeDocument[], rows: ImportRow[], lookup: Lookup): EmployeeDocument[] {
  const incoming: EmployeeDocument[] = rows.map(row => ({
    id: String(row.payload.id),
    employeeId: personId(row.payload, lookup),
    documentTypeName: row.payload.document_type,
    fileName: row.payload.file_name,
    fileSize: 0,
    issueDate: row.payload.issue_date || undefined,
    expiryDate: row.payload.expiry_date || undefined,
    verificationStatus: row.payload.verification_status || 'PENDING',
    uploadedAt: row.payload.submittedAt || new Date().toISOString(),
  }));
  return replacePrefixed(prev, incoming, 'import:documents:');
}

export function nextAssets(prev: CompanyAsset[], rows: ImportRow[], lookup: Lookup): CompanyAsset[] {
  const incoming: CompanyAsset[] = rows.map(row => ({
    id: String(row.payload.id),
    name: row.payload.name,
    code: row.payload.code,
    category: row.payload.category,
    holderId: row.payload.employee_code ? personId(row.payload, lookup) || null : null,
    issuedOn: row.payload.issued_on || null,
    conditionOnIssue: row.payload.condition || '',
    notes: row.payload.notes || undefined,
    returnedOn: null,
    history: [],
    createdAt: row.payload.submittedAt || new Date().toISOString(),
  }));
  return replacePrefixed(prev, incoming, 'import:assets:');
}

function periodFrom(payload: Payload): PayrollPeriod {
  return {
    id: `import-period-${payload.period_code}`,
    periodCode: payload.period_code,
    startDate: payload.start_date,
    endDate: payload.end_date,
    payDate: payload.pay_date,
    status: 'DRAFT',
    createdBy: 'import',
  };
}

export function nextPayroll(prevPeriods: PayrollPeriod[], prevRecords: PayrollRecord[], rows: ImportRow[], lookup: Lookup) {
  const periods = new Map<string, PayrollPeriod>();
  const records: PayrollRecord[] = rows.map(row => {
    const period = periodFrom(row.payload);
    periods.set(period.id, period);
    return {
      id: String(row.payload.id),
      payrollPeriodId: period.id,
      employeeId: personId(row.payload, lookup),
      basicSalary: Number(row.payload.basic_salary),
      allowance: Number(row.payload.allowance),
      overtime: Number(row.payload.overtime),
      serviceCharge: Number(row.payload.service_charge),
      grossPay: Number(row.payload.gross_pay),
      totalDeductions: Number(row.payload.total_deductions),
      netPay: Number(row.payload.net_pay),
      status: row.payload.status || 'DRAFT',
    };
  });
  return {
    periods: mergePeriods(prevPeriods, [...periods.values()]),
    records: replacePrefixed(prevRecords, records, 'import:payroll:'),
  };
}

export function nextPayrollPacks(prevPeriods: PayrollPeriod[], prevPacks: PayrollPack[], rows: ImportRow[], lookup: Lookup) {
  const groups = new Map<string, ImportRow[]>();
  for (const row of rows) {
    const code = row.payload.period_code;
    groups.set(code, [...(groups.get(code) ?? []), row]);
  }
  const periods: PayrollPeriod[] = [];
  const packs: PayrollPack[] = [];
  for (const [code, group] of groups) {
    const first = group[0].payload;
    const period = periodFrom(first);
    periods.push(period);
    const lines = group.map(row => {
      const person = lookup.employees.find(item => item.id === personId(row.payload, lookup));
      return {
        employeeId: personId(row.payload, lookup),
        employeeName: person?.fullName || row.payload.employee_code,
        employeeCode: person?.employeeCode || row.payload.employee_code,
        basicSalary: Number(row.payload.basic_salary),
        allowance: Number(row.payload.allowance),
        overtime: Number(row.payload.overtime),
        serviceCharge: Number(row.payload.service_charge),
        grossPay: Number(row.payload.gross_pay),
        totalDeductions: Number(row.payload.total_deductions),
        netPay: Number(row.payload.net_pay),
      };
    });
    packs.push({
      id: `import:pack:${code}`,
      periodId: period.id,
      periodCode: code,
      startDate: first.start_date,
      endDate: first.end_date,
      payDate: first.pay_date,
      status: rowStatus(first.status),
      submittedAt: first.submittedAt || new Date().toISOString(),
      submittedBy: 'Import',
      lines,
      totalGross: lines.reduce((sum, line) => sum + line.grossPay, 0),
      totalDeductions: lines.reduce((sum, line) => sum + line.totalDeductions, 0),
      totalNet: lines.reduce((sum, line) => sum + line.netPay, 0),
    });
  }
  return {
    periods: mergePeriods(prevPeriods, periods),
    packs: replacePrefixed(prevPacks, packs, 'import:pack:'),
  };
}

function rowStatus(status: string): PayrollPack['status'] {
  if (status === 'APPROVED' || status === 'RETURNED' || status === 'UNDER_REVIEW') return status;
  return 'UNDER_REVIEW';
}

function mergePeriods(prev: PayrollPeriod[], incoming: PayrollPeriod[]): PayrollPeriod[] {
  const ids = new Set(incoming.map(period => period.id));
  return [...incoming, ...prev.filter(period => !ids.has(period.id))];
}

export function nextServiceCharge(prevPeriods: PayrollPeriod[], prevRows: ServiceChargeDistribution[], rows: ImportRow[], lookup: Lookup) {
  const periods = new Map<string, PayrollPeriod>();
  const incoming: ServiceChargeDistribution[] = rows.map(row => {
    const period = periodFrom(row.payload);
    periods.set(period.id, period);
    return {
      id: String(row.payload.id),
      configId: '',
      periodId: period.id,
      employeeId: personId(row.payload, lookup),
      amount: Number(row.payload.amount),
      distributionBasis: row.payload.distribution_basis || 'Imported',
      status: row.payload.status || 'DRAFT',
    };
  });
  return {
    periods: mergePeriods(prevPeriods, [...periods.values()]),
    distributions: replacePrefixed(prevRows, incoming, 'import:service-charge:'),
  };
}

export function nextAccountingPosts(prev: AccountingPost[], rows: ImportRow[]): AccountingPost[] {
  const incoming: AccountingPost[] = rows.map(row => ({
    id: String(row.payload.id),
    periodId: `import-period-${row.payload.period_code}`,
    periodCode: row.payload.period_code,
    reference: row.payload.reference,
    destination: row.payload.destination,
    postedAt: row.payload.submittedAt || new Date().toISOString(),
    totalDebit: Number(row.payload.total_debit),
    totalCredit: Number(row.payload.total_credit),
    journal: row.payload.journal || '',
  }));
  return replacePrefixed(prev, incoming, 'import:payroll-finance:');
}

export function nextClaims(prev: ReimbursementClaim[], rows: ImportRow[], lookup: Lookup): ReimbursementClaim[] {
  const incoming: ReimbursementClaim[] = rows.map(row => ({
    id: String(row.payload.id),
    employeeId: personId(row.payload, lookup),
    claimDate: row.payload.claim_date,
    category: row.payload.category,
    amount: Number(row.payload.amount),
    description: row.payload.description,
    status: row.payload.status || 'SUBMITTED',
    submittedByName: 'Import',
    submittedAt: row.payload.submittedAt || new Date().toISOString(),
  }));
  return replacePrefixed(prev, incoming, 'import:reimbursements:');
}

export function nextLoans(prev: EmployeeLoan[], rows: ImportRow[], lookup: Lookup): EmployeeLoan[] {
  const incoming: EmployeeLoan[] = rows.map(row => ({
    id: String(row.payload.id),
    employeeId: personId(row.payload, lookup),
    loanType: row.payload.loan_type,
    principalAmount: Number(row.payload.principal_amount),
    remainingBalance: Number(row.payload.remaining_balance),
    monthlyInstallment: Number(row.payload.monthly_installment),
    startDate: row.payload.start_date,
    purpose: row.payload.purpose || undefined,
    status: row.payload.status || 'ACTIVE',
    createdAt: row.payload.submittedAt || new Date().toISOString(),
  }));
  return replacePrefixed(prev, incoming, 'import:loans:');
}

export type ImportGroups = Record<string, ImportRow[]>;

type ImportSetters = {
  setShifts: (update: (prev: Shift[]) => Shift[]) => void;
  setAttendance: (update: (prev: Attendance[]) => Attendance[]) => void;
  setLeaveRequests: (update: (prev: LeaveRequest[]) => LeaveRequest[]) => void;
  setOvertimeRequests: (update: (prev: OvertimeRequest[]) => OvertimeRequest[]) => void;
  setApplicants: (update: (prev: Applicant[]) => Applicant[]) => void;
  setContracts: (update: (prev: EmploymentContract[]) => EmploymentContract[]) => void;
  setDocuments: (update: (prev: EmployeeDocument[]) => EmployeeDocument[]) => void;
  setCompanyAssets: (update: (prev: CompanyAsset[]) => CompanyAsset[]) => void;
  setPayrollPeriods: (update: (prev: PayrollPeriod[]) => PayrollPeriod[]) => void;
  setPayrollRecords: (update: (prev: PayrollRecord[]) => PayrollRecord[]) => void;
  setPayrollPacks: (update: (prev: PayrollPack[]) => PayrollPack[]) => void;
  setServiceChargeDistributions: (update: (prev: ServiceChargeDistribution[]) => ServiceChargeDistribution[]) => void;
  setAccountingPosts: (update: (prev: AccountingPost[]) => AccountingPost[]) => void;
  setReimbursements: (update: (prev: ReimbursementClaim[]) => ReimbursementClaim[]) => void;
  setEmployeeLoans: (update: (prev: EmployeeLoan[]) => EmployeeLoan[]) => void;
  setWorkingPeriodId: (update: (prev: string) => string) => void;
};

export function applyImportGroups(groups: ImportGroups, lookup: Lookup, set: ImportSetters) {
  if (groups.shifts) set.setShifts(prev => nextShifts(prev, groups.shifts));
  if (groups.attendance) set.setAttendance(prev => nextAttendance(prev, groups.attendance, lookup));
  if (groups.leave) set.setLeaveRequests(prev => nextLeave(prev, groups.leave, lookup));
  if (groups.overtime) set.setOvertimeRequests(prev => nextOvertime(prev, groups.overtime, lookup));
  if (groups.hiring) set.setApplicants(prev => nextApplicants(prev, groups.hiring));
  if (groups.contracts) set.setContracts(prev => nextContracts(prev, groups.contracts, lookup));
  if (groups.documents) set.setDocuments(prev => nextDocuments(prev, groups.documents, lookup));
  if (groups.assets) set.setCompanyAssets(prev => nextAssets(prev, groups.assets, lookup));
  if (groups.payroll) {
    set.setPayrollPeriods(prev => nextPayroll(prev, [], groups.payroll, lookup).periods);
    set.setPayrollRecords(prev => nextPayroll([], prev, groups.payroll, lookup).records);
  }
  if (groups['payroll-review']) {
    set.setPayrollPeriods(prev => nextPayrollPacks(prev, [], groups['payroll-review'], lookup).periods);
    set.setPayrollPacks(prev => nextPayrollPacks([], prev, groups['payroll-review'], lookup).packs);
  }
  if (groups['service-charge']) {
    set.setPayrollPeriods(prev => nextServiceCharge(prev, [], groups['service-charge'], lookup).periods);
    set.setServiceChargeDistributions(prev => nextServiceCharge([], prev, groups['service-charge'], lookup).distributions);
  }
  if (groups['payroll-finance']) set.setAccountingPosts(prev => nextAccountingPosts(prev, groups['payroll-finance']));
  if (groups.reimbursements) set.setReimbursements(prev => nextClaims(prev, groups.reimbursements, lookup));
  if (groups.loans) set.setEmployeeLoans(prev => nextLoans(prev, groups.loans, lookup));
  const periodCode = groups.payroll?.[0]?.payload?.period_code
    || groups['payroll-review']?.[0]?.payload?.period_code
    || groups['service-charge']?.[0]?.payload?.period_code;
  if (periodCode) set.setWorkingPeriodId(prev => prev || `import-period-${periodCode}`);
}
