/**
 * API Client for ATRIUM HRIS
 * 
 * Connects frontend to the PostgreSQL backend API.
 * Falls back to mock data if API is unavailable.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Check if API is available
let apiAvailable: boolean | null = null;

export async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
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
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
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
  
  delete: (id: string) => apiRequest<any>(`/employees/${id}`, {
    method: 'DELETE',
  }),
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
};

// ============================================
// ATTENDANCE API
// ============================================

export const attendanceApi = {
  getByDate: (date: string) => apiRequest<any[]>(`/attendance/${date}`),
  
  create: (data: any) => apiRequest<any>('/attendance', {
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

// ============================================
// PAYROLL API
// ============================================

export const payrollApi = {
  getPeriods: () => apiRequest<any[]>('/payroll-periods'),
  
  createPeriod: (data: any) => apiRequest<any>('/payroll-periods', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  
  getRecords: (periodId: string) => apiRequest<any[]>(`/payroll-records/${periodId}`),
};

// ============================================
// AUDIT LOGS API
// ============================================

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
