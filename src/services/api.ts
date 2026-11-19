/**
 * API Client for ATRIUM HRIS
 * 
 * Connects frontend to the PostgreSQL backend API.
 * Falls back to mock data if API is unavailable.
 */

import type { Attendance, Employee, EmployeeDocument, PayrollPeriod, PayrollRecord, PayrollStructure, PayrollStructureComponent, PunchMine, StaffTask } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Check if API is available
let apiAvailable: boolean | null = null;

export async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      credentials: 'same-origin',
      signal: AbortSignal.timeout(2000),
    });
    apiAvailable = response.ok;
    return response.ok;
  } catch {
    apiAvailable = false;
    return false;
  }
}

export function isApiAvailable(): boolean {
  return apiAvailable === true;
}

// Generic fetch wrapper
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const defaultOptions: RequestInit = {
    ...options,
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  };

  try {
    const response = await fetch(url, defaultOptions);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`API Error [${endpoint}]:`, error);
    throw error;
  }
}

// ============================================
// EMPLOYEES API
// ============================================

export function mapEmployeeRow(emp: any): Employee {
  return {
    id: emp.id,
    employeeCode: emp.employee_code,
    fullName: emp.full_name,
    preferredName: emp.preferred_name,
    nik: emp.nik,
    npwp: emp.npwp,
    dateOfBirth: emp.date_of_birth,
    gender: emp.gender,
    phone: emp.phone,
    email: emp.email,
    address: emp.address,
    emergencyContactName: emp.emergency_contact_name,
    emergencyContactPhone: emp.emergency_contact_phone,
    departmentId: emp.department_id,
    positionId: emp.position_id,
    employmentStatus: emp.employment_status,
    joinDate: emp.join_date,
    bankName: emp.bank_name,
    bankAccountNumber: emp.bank_account_number,
    bankAccountName: emp.bank_account_name,
    ptkpCode: emp.ptkp_code || undefined,
    hasProfilePhoto: emp.has_profile_photo === true,
    updatedAt: typeof emp.updated_at === 'string' ? emp.updated_at : undefined,
  };
}

export const employeesApi = {
  getAll: () => apiRequest<any[]>('/employees'),
  
  getById: (id: string) => apiRequest<any>(`/employees/${id}`),
  
  create: (data: any) => apiRequest<any>('/employees', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  
  update: (id: string, data: any) => apiRequest<any>(`/employees/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  updateProfile: (id: string, data: Record<string, string>) => apiRequest<any>(`/employees/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),

  getSelf: async () => {
    const response = await fetch(`${API_BASE_URL}/self/profile`, { credentials: 'same-origin' });
    if (response.status === 404) return null;
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }
    return response.json();
  },
  
  delete: (id: string) => apiRequest<any>(`/employees/${id}`, {
    method: 'DELETE',
  }),
};

export function employeePhotoUrl(id: string): string {
  return `${API_BASE_URL}/employees/${id}/photo`;
}

export function changeRequestPhotoUrl(id: string): string {
  return `${API_BASE_URL}/profile-change-requests/${id}/photo`;
}

export const profileRequestsApi = {
  list: (status?: string) => apiRequest<any[]>(`/profile-change-requests${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  create: (data: Record<string, string>) => apiRequest<any>('/profile-change-requests', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  approve: (id: string) => apiRequest<any>(`/profile-change-requests/${id}/approve`, { method: 'POST' }),
  reject: (id: string) => apiRequest<any>(`/profile-change-requests/${id}/reject`, { method: 'POST' }),
};

// ============================================
// DEPARTMENTS API
// ============================================

export const departmentsApi = {
  getAll: () => apiRequest<any[]>('/departments'),
  
  create: (data: any) => apiRequest<any>('/departments', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  update: (id: string, data: any) => apiRequest<any>(`/departments/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  delete: (id: string) => apiRequest<any>(`/departments/${id}`, {
    method: 'DELETE',
  }),
};

export const positionsApi = {
  getAll: () => apiRequest<any[]>('/positions'),

  create: (data: any) => apiRequest<any>('/positions', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  update: (id: string, data: any) => apiRequest<any>(`/positions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  delete: (id: string) => apiRequest<any>(`/positions/${id}`, {
    method: 'DELETE',
  }),
};

// ============================================
// ATTENDANCE API
// ============================================

export function mapAttendanceRow(row: any): Attendance {
  const clock = (value: unknown) => (typeof value === 'string' && value ? value.slice(0, 5) : undefined);
  return {
    id: row.id,
    employeeId: row.employee_id,
    attendanceDate: typeof row.attendance_date === 'string' ? row.attendance_date.slice(0, 10) : '',
    shiftId: row.shift_id || '',
    clockIn: clock(row.clock_in),
    clockOut: clock(row.clock_out),
    status: row.status,
    lateMinutes: row.late_minutes ?? undefined,
    source: row.source ?? null,
    clockInSiteName: row.clock_in_site_name ?? null,
    clockOutSiteName: row.clock_out_site_name ?? null,
    clockInLat: row.clock_in_lat ?? undefined,
    clockInLng: row.clock_in_lng ?? undefined,
    clockOutLat: row.clock_out_lat ?? undefined,
    clockOutLng: row.clock_out_lng ?? undefined,
    clockInAccuracy: row.clock_in_accuracy_m ?? undefined,
    clockOutAccuracy: row.clock_out_accuracy_m ?? undefined,
    hasClockInPhoto: Boolean(row.has_clock_in_photo),
    hasClockOutPhoto: Boolean(row.has_clock_out_photo),
  };
}

export function mapPunchMine(row: any): PunchMine {
  return {
    attendanceDate: row.attendance_date,
    next: row.next ?? null,
    blockedReason: row.blocked_reason ?? null,
    day: row.day ? mapAttendanceRow(row.day) : null,
  };
}

export function attendancePhotoUrl(id: string, side: 'in' | 'out'): string {
  return `${API_BASE_URL}/attendance-photos/${id}/${side}`;
}

export const attendanceApi = {
  getByDate: (date: string) => apiRequest<any[]>(`/attendance/${date}`),

  mine: () => apiRequest<any>('/attendance/mine'),

  punch: (data: {
    photo: string;
    latitude: number;
    longitude: number;
    accuracy: number;
    idempotency_key: string;
    off_site_duty?: boolean;
    off_site_location_note?: string;
  }) => apiRequest<any>('/attendance/punch', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  requestCorrection: (data: { employee_code: string; attendance_date: string; clock_in?: string; clock_out?: string; reason: string }) => apiRequest<{ id: string; status: string }>('/attendance-corrections', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  corrections: () => apiRequest<any[]>('/attendance-corrections'),

  approveCorrection: (id: string) => apiRequest<{ approved: boolean }>(`/attendance-corrections/${id}/approve`, {
    method: 'POST',
    body: '{}',
  }),
};

export const punchSitesApi = {
  list: () => apiRequest<any[]>('/punch-sites'),
  create: (data: { name: string; latitude: number; longitude: number; radius_meters: number; active: boolean }) => apiRequest<any>('/punch-sites', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id: string, data: { name: string; latitude: number; longitude: number; radius_meters: number; active: boolean }) => apiRequest<any>(`/punch-sites/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
};

export const fingerspotApi = {
  unpaired: () => apiRequest<{ cloud_id: string; pin: string; scanned_at: string }[]>('/fingerspot/unpaired'),
  pair: (data: { cloud_id: string; pin: string; employee_code: string }) => apiRequest<{ paired: boolean }>('/fingerspot/pins', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
};

// ============================================
// LEAVE API
// ============================================

export const leaveApi = {
  getAll: (filters?: { status?: string }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    const queryString = params.toString();
    return apiRequest<any[]>(`/leave-requests${queryString ? `?${queryString}` : ''}`);
  },

  types: () => apiRequest<any[]>('/leave-types'),

  listSelf: () => apiRequest<any[]>('/self/leave-requests'),

  createSelf: (data: {
    leave_type_id: string;
    start_date: string;
    end_date: string;
    reason?: string;
  }) => apiRequest<any>('/self/leave-requests', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  
  create: (data: any) => apiRequest<any>('/leave-requests', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  
  approve: (id: string, approvedBy: string) => 
    apiRequest<any>(`/leave-requests/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ approved_by: approvedBy }),
    }),
};

export const selfServiceApi = {
  attendance: (from?: string, until?: string) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (until) params.set('until', until);
    const query = params.toString();
    return apiRequest<any[]>(`/self/attendance${query ? `?${query}` : ''}`);
  },
  payslips: () => apiRequest<any[]>('/self/payslips'),
  reimbursements: () => apiRequest<any[]>('/self/reimbursements'),
  createReimbursement: (data: {
    claim_date: string;
    category: string;
    amount: number;
    description: string;
    receipt?: string;
    receipt_file_name?: string;
  }) => apiRequest<any>('/self/reimbursements', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
};

export function mapSelfLeave(row: any) {
  return {
    id: row.id,
    employeeId: row.employee_id,
    leaveTypeId: row.leave_type_id,
    leaveTypeName: row.leave_type_name || 'Leave',
    leaveTypeCode: row.leave_type_code || '',
    isPaid: row.is_paid !== false,
    startDate: row.start_date,
    endDate: row.end_date,
    totalDays: Number(row.total_days) || 0,
    reason: row.reason || '',
    status: row.status,
    submittedAt: row.submitted_at,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    rejectionReason: row.rejection_reason,
  };
}

export function mapSelfPayslip(row: any) {
  return {
    id: row.id,
    employeeId: row.employee_id,
    payrollPeriodId: row.payroll_period_id,
    periodCode: row.period_code || 'Payroll',
    startDate: row.start_date,
    endDate: row.end_date,
    payDate: row.pay_date,
    periodStatus: row.period_status,
    status: row.status,
    grossPay: Number(row.gross_pay) || 0,
    totalDeductions: Number(row.total_deductions) || 0,
    netPay: Number(row.net_pay) || 0,
  };
}

export function mapSelfClaim(row: any) {
  return {
    id: row.id,
    employeeId: row.employee_id,
    claimDate: row.claim_date,
    category: row.category as 'TRANSPORT' | 'MEDICAL' | 'OTHER',
    amount: Number(row.amount) || 0,
    description: row.description || '',
    receiptFileName: row.receipt_file_name || undefined,
    receiptFileSize: row.receipt_file_size || undefined,
    status: row.status as 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'PAID',
    rejectionNote: row.rejection_note || undefined,
    submittedByName: row.submitted_by_name || row.submitted_by || 'Me',
    submittedAt: row.submitted_at,
  };
}

// ============================================
// PAYROLL API
// ============================================

const payrollStatuses = new Set(['DRAFT', 'CALCULATED', 'UNDER_REVIEW', 'APPROVED', 'FINALIZED', 'LOCKED']);

const payrollCodePattern = /^[a-z][a-z0-9_]{0,31}$/;

function wholeIdr(value: unknown): number | null {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  return null;
}

function signedWhole(value: unknown): number | null {
  if (typeof value === 'number' && Number.isSafeInteger(value)) return value;
  if (typeof value === 'string' && /^-?\d+$/.test(value)) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  return null;
}

export function mapPayrollPeriod(row: any): PayrollPeriod | null {
  if (!row?.id || typeof row.period_code !== 'string') return null;
  const day = (value: unknown) => (typeof value === 'string' ? value.slice(0, 10) : '');
  return {
    id: String(row.id),
    periodCode: row.period_code,
    startDate: day(row.start_date),
    endDate: day(row.end_date),
    payDate: day(row.pay_date),
    status: payrollStatuses.has(row.status) ? row.status : 'DRAFT',
    createdBy: row.created_by ? String(row.created_by) : '',
  };
}

export function mapPayrollStructure(row: any): PayrollStructure | null {
  if (!row || !Array.isArray(row.components) || typeof row.gross_formula !== 'string' || typeof row.net_formula !== 'string') return null;
  const components: PayrollStructureComponent[] = [];
  for (const component of row.components) {
    if (!component || typeof component.code !== 'string' || !payrollCodePattern.test(component.code)) return null;
    if (component.kind !== 'earning' && component.kind !== 'deduction') return null;
    if (typeof component.display_name !== 'string' || !component.display_name.trim()) return null;
    const rateBp = component.rate_bp == null || component.rate_bp === ''
      ? null
      : (typeof component.rate_bp === 'number' && Number.isInteger(component.rate_bp)
        ? component.rate_bp
        : (typeof component.rate_bp === 'string' && /^\d+$/.test(component.rate_bp) ? Number(component.rate_bp) : null));
    if (rateBp != null && (rateBp < 0 || rateBp > 10000)) return null;
    const wageBase = Array.isArray(component.wage_base)
      ? component.wage_base.filter((code: unknown): code is string => typeof code === 'string' && payrollCodePattern.test(code))
      : [];
    components.push({
      code: component.code,
      displayName: component.display_name.trim(),
      kind: component.kind,
      sortOrder: Number.isInteger(component.sort_order) ? component.sort_order : components.length * 10,
      active: component.active === true,
      rateBp,
      wageBase,
    });
  }
  if (!components.some((component) => component.code === 'basic' && component.kind === 'earning')) return null;
  return {
    effectiveFrom: typeof row.effective_from === 'string' ? row.effective_from.slice(0, 10) : null,
    grossFormula: row.gross_formula.trim(),
    netFormula: row.net_formula.trim(),
    source: row.source === 'period' ? 'period' : 'company',
    components,
  };
}

export function mapPayrollRecord(row: any): PayrollRecord | null {
  const basic = wholeIdr(row?.basic_salary);
  if (!row?.id || !row?.employee_id || !row?.payroll_period_id || basic == null) return null;
  const componentAmounts: Record<string, number> = {};
  if (row.component_amounts && typeof row.component_amounts === 'object') {
    for (const [code, value] of Object.entries(row.component_amounts)) {
      if (!payrollCodePattern.test(code)) continue;
      const amount = signedWhole(value);
      if (amount == null) continue;
      componentAmounts[code] = amount;
    }
  }
  return {
    id: String(row.id),
    payrollPeriodId: String(row.payroll_period_id),
    employeeId: String(row.employee_id),
    basicSalary: basic,
    allowance: wholeIdr(row.allowance) ?? 0,
    overtime: wholeIdr(row.overtime) ?? 0,
    serviceCharge: wholeIdr(row.service_charge) ?? 0,
    grossPay: signedWhole(row.formula_gross) ?? signedWhole(row.gross_pay) ?? basic,
    totalDeductions: wholeIdr(row.total_deductions) ?? componentAmounts.deductions ?? 0,
    netPay: signedWhole(row.formula_net) ?? signedWhole(row.net_pay) ?? basic,
    status: typeof row.status === 'string' ? row.status : 'DRAFT',
    componentAmounts,
    tariffMissing: Array.isArray(row.tariff_missing)
      ? row.tariff_missing.filter((code: unknown): code is string => typeof code === 'string' && payrollCodePattern.test(code))
      : [],
    formulaIncomplete: row.formula_incomplete === true,
  };
}

export const payrollApi = {
  getPeriods: () => apiRequest<any[]>('/payroll-periods'),
  
  createPeriod: (data: any) => apiRequest<any>('/payroll-periods', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  
  getRecords: (periodId: string) => apiRequest<any[]>(`/payroll-records/${periodId}`),

  getStructure: (periodId?: string) => apiRequest<any>(periodId ? `/payroll-structure?period_id=${encodeURIComponent(periodId)}` : '/payroll-structure'),

  saveStructure: (body: { gross_formula: string; net_formula: string; components: { code: string; display_name: string; kind: 'earning' | 'deduction'; active: boolean; rate_bp: number | null; wage_base: string[] }[] }) => apiRequest<any>('/payroll-structure', {
    method: 'PUT',
    body: JSON.stringify(body),
  }),

  approve: (periodId: string) => apiRequest<any>(`/payroll-periods/${periodId}/approve`, {
    method: 'POST',
    body: JSON.stringify({}),
  }),
};

export type EmployeePayComponent = {
  code: string;
  display_name: string;
  kind: 'earning' | 'deduction';
  sets_amount: boolean;
  eligible: boolean;
  amount: number | null;
};

export const employeePayApi = {
  get: (employeeId: string) => apiRequest<{ employee_id: string; components: EmployeePayComponent[] }>(`/employee-pay-components/${employeeId}`),
  save: (employeeId: string, components: { code: string; eligible: boolean; amount: number | null }[]) => apiRequest<{ employee_id: string; components: EmployeePayComponent[] }>(`/employee-pay-components/${employeeId}`, {
    method: 'PUT',
    body: JSON.stringify({ components }),
  }),
};

export type EmployeePayrollConfigRow = {
  employee_id: string;
  pay_type: 'MONTHLY' | 'DAILY';
  gross_fixed_salary: number | null;
  basic_percentage: number;
  daily_rate: number | null;
  working_days_per_month: number;
  housing_allowance: number;
  transport_allowance: number;
  attendance_allowance_per_day: number;
  bpjs_kesehatan_enabled: boolean;
  bpjs_tk_enabled: boolean;
  bpjs_base: 'BASIC' | 'BASIC_PLUS_FIXED';
  company_covers_employee_bpjs: boolean;
  tax_mode: 'EMPLOYEE' | 'COMPANY';
  npwp_enabled: boolean;
  bpjs_enrolled?: boolean;
  tax_configuration?: 'netto' | 'gross';
};

/** @deprecated alias — use EmployeePayrollConfigRow */
export type EmployeePayrollSettingsRow = EmployeePayrollConfigRow;

export const employeePayrollSettingsApi = {
  get: (employeeId: string) => apiRequest<EmployeePayrollConfigRow>(`/employee-payroll-settings/${employeeId}`),
  save: (employeeId: string, body: Partial<Omit<EmployeePayrollConfigRow, 'employee_id'>>) =>
    apiRequest<EmployeePayrollConfigRow>(`/employee-payroll-settings/${employeeId}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
};

export const payrollRunsApi = {
  generate: (periodCode: string, body?: { adjustments?: Record<string, unknown>; ter_brackets?: unknown[] }) =>
    apiRequest<any>(`/payroll-runs/${encodeURIComponent(periodCode)}/generate`, {
      method: 'POST',
      body: JSON.stringify(body || {}),
    }),
  get: (periodCode: string) => apiRequest<any>(`/payroll-runs/${encodeURIComponent(periodCode)}`),
  bank: (periodCode: string, bank: 'mandiri' | 'bni' | 'bri') =>
    apiRequest<{ ok: boolean; filename: string; content: string }>(`/payroll-runs/${encodeURIComponent(periodCode)}/bank/${bank}`),
};

export const payrollGlobalSettingsApi = {
  get: () => apiRequest<{ settings: any; bpjs_rates: any }>('/payroll-global-settings'),
  save: (body: { settings?: any; bpjs_rates?: any }) =>
    apiRequest<{ settings: any; bpjs_rates: any }>('/payroll-global-settings', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
};

export const serviceChargeV2Api = {
  getSettings: () => apiRequest<{ settings: any; pools: any[] }>('/service-charge-v2/settings'),
  saveSettings: (body: { settings?: any; pools?: any[] }) =>
    apiRequest<{ settings: any; pools: any[] }>('/service-charge-v2/settings', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  generate: (year: number, month: number, body: Record<string, unknown>) =>
    apiRequest<any>(`/service-charge-v2/${year}/${month}/generate`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  get: (year: number, month: number) => apiRequest<any>(`/service-charge-v2/${year}/${month}`),
  bank: (year: number, month: number, bank: 'mandiri' | 'bni' | 'bri') =>
    apiRequest<{ ok: boolean; filename: string; content: string }>(`/service-charge-v2/${year}/${month}/bank/${bank}`),
};


// ============================================
// AUDIT LOGS API
// ============================================

const sharedTaskStatuses = new Set(['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'COMPLETED', 'OPEN', 'DONE']);

export function mapStaffTask(row: any): StaffTask | null {
  if (!row || typeof row !== 'object' || !sharedTaskStatuses.has(row.status)) return null;
  const due = typeof row.due_date === 'string' ? row.due_date.slice(0, 10) : '';
  if (!row.id || typeof row.title !== 'string' || !due) return null;
  const assigner = typeof row.assigner_name === 'string' && !row.assigner_name.includes('@') ? row.assigner_name : 'Organization';
  return {
    id: String(row.id),
    title: row.title,
    detail: typeof row.detail === 'string' ? row.detail : '',
    assigneeId: String(row.employee_id),
    assignerName: assigner,
    dueDate: due,
    status: row.status,
    createdAt: typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
    externalId: typeof row.external_id === 'string' ? row.external_id : undefined,
    employeeCode: typeof row.employee_code === 'string' ? row.employee_code : undefined,
  };
}

export const staffTasksApi = {
  getAll: () => apiRequest<any[]>('/staff-tasks'),

  create: (data: { employee_id: string; title: string; detail?: string; due_date: string; assigner_name?: string }) =>
    apiRequest<any>('/staff-tasks', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: { title: string; status: string; due_date: string; detail?: string }) =>
    apiRequest<any>(`/staff-tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
};

export const importsApi = {
  list: () => apiRequest<{ catalog: { id: string; label: string; keyLabel: string; headers: string[]; required: string[] }[]; rows: Record<string, { natural_key: string; payload: Record<string, unknown> }[]> }>('/imports'),
  run: (moduleId: string, rows: Record<string, unknown>[]) => apiRequest<{
    imported: number;
    updated: number;
    skipped: number;
    skips: { row: number; reason: string }[];
    refresh?: string | null;
    rows?: { natural_key: string; payload: Record<string, unknown> }[];
  }>(`/imports/${moduleId}`, {
    method: 'POST',
    body: JSON.stringify({ rows }),
  }),
};

export function mapEmployeeDocument(row: any): EmployeeDocument {
  return {
    id: row.id,
    employeeId: row.employee_id,
    documentTypeName: row.document_type_name,
    fileName: row.file_name,
    fileSize: Number(row.file_size) || 0,
    verificationStatus: row.verification_status || 'PENDING',
    uploadedAt: typeof row.uploaded_at === 'string' ? row.uploaded_at : new Date().toISOString(),
  };
}

export function employeeDocumentFileUrl(id: string, selfService = false): string {
  return selfService
    ? `${API_BASE_URL}/self/documents/${encodeURIComponent(id)}/file`
    : `${API_BASE_URL}/documents/${encodeURIComponent(id)}/file`;
}

export const documentsApi = {
  listSelf: () => apiRequest<any[]>('/self/documents'),
  uploadSelf: (files: Array<{ document_type_name: string; file_name: string; file: string; mime_type?: string }>) =>
    apiRequest<{ documents: any[] }>('/self/documents', {
      method: 'POST',
      body: JSON.stringify({ files }),
    }),
  listForEmployee: (employeeId: string) => apiRequest<any[]>(`/employees/${encodeURIComponent(employeeId)}/documents`),
  uploadForEmployee: (employeeId: string, files: Array<{ document_type_name: string; file_name: string; file: string; mime_type?: string }>) =>
    apiRequest<{ documents: any[] }>(`/employees/${encodeURIComponent(employeeId)}/documents`, {
      method: 'POST',
      body: JSON.stringify({ files }),
    }),
  verify: (id: string, verification_status: 'VERIFIED' | 'REJECTED') =>
    apiRequest<any>(`/documents/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ verification_status }),
    }),
};

export const auditApi = {
  getAll: (filters?: any) => {
    const params = new URLSearchParams();
    if (filters?.entity_type) params.append('entity_type', filters.entity_type);
    if (filters?.user_id) params.append('user_id', filters.user_id);
    const queryString = params.toString();
    return apiRequest<any[]>(`/audit-logs${queryString ? `?${queryString}` : ''}`);
  },
};

// ============================================
// CONNECTION STATUS
// ============================================

export const connectionApi = {
  getStatus: async () => {
    const isAvailable = await checkApiHealth();
    return {
      connected: isAvailable,
      mode: isAvailable ? 'PostgreSQL' : 'Demo (Mock Data)',
      message: isAvailable 
        ? 'Connected to PostgreSQL database' 
        : 'Using demo data. Start backend with: node server/index.js',
    };
  },
};
