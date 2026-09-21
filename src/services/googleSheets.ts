/**
 * Google Sheets API Service for ATRIUM HRIS
 * 
 * Uses Google Sheets API v4 with OAuth2 for full CRUD operations.
 * Users authenticate with their Google account to read/write sheets.
 */

// Configuration
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';
const DISCOVERY_DOC = 'https://sheets.googleapis.com/$discovery/rest?version=v4';

// Google API client state
let gapiLoaded = false;
let gisLoaded = false;
let tokenClient: any = null;
let accessToken: string | null = null;

// Sheet names
export const SHEETS = {
  USERS: 'users',
  DEPARTMENTS: 'departments',
  POSITIONS: 'positions',
  EMPLOYEES: 'employees',
  SHIFTS: 'shifts',
  ATTENDANCE: 'attendance',
  LEAVE_TYPES: 'leave_types',
  LEAVE_REQUESTS: 'leave_requests',
  OVERTIME_REQUESTS: 'overtime_requests',
  PAYROLL_PERIODS: 'payroll_periods',
  PAYROLL_RECORDS: 'payroll_records',
  DOCUMENTS: 'documents',
  AUDIT_LOGS: 'audit_logs',
  CONFIGURATION: 'configuration',
} as const;

type SheetName = typeof SHEETS[keyof typeof SHEETS];

// Column headers for each sheet
export const SHEET_HEADERS: Record<string, string[]> = {
  [SHEETS.USERS]: ['id', 'email', 'full_name', 'role', 'employee_id', 'is_active', 'created_at', 'updated_at'],
  [SHEETS.DEPARTMENTS]: ['id', 'code', 'name', 'description', 'parent_department_id', 'manager_employee_id', 'is_active', 'created_at', 'updated_at'],
  [SHEETS.POSITIONS]: ['id', 'code', 'title', 'department_id', 'grade', 'description', 'is_active', 'created_at', 'updated_at'],
  [SHEETS.EMPLOYEES]: ['id', 'employee_code', 'full_name', 'preferred_name', 'nik', 'npwp', 'date_of_birth', 'gender', 'phone', 'email', 'address', 'emergency_contact_name', 'emergency_contact_phone', 'department_id', 'position_id', 'employment_status', 'join_date', 'termination_date', 'bank_name', 'bank_account_number', 'bank_account_name', 'created_at', 'updated_at'],
  [SHEETS.SHIFTS]: ['id', 'code', 'name', 'start_time', 'end_time', 'break_minutes', 'crosses_midnight', 'is_active', 'created_at', 'updated_at'],
  [SHEETS.ATTENDANCE]: ['id', 'employee_id', 'attendance_date', 'shift_id', 'clock_in', 'clock_out', 'status', 'late_minutes', 'early_leave_minutes', 'overtime_minutes', 'notes', 'created_at', 'updated_at'],
  [SHEETS.LEAVE_TYPES]: ['id', 'code', 'name', 'default_entitlement', 'requires_attachment', 'requires_approval', 'is_paid', 'is_active'],
  [SHEETS.LEAVE_REQUESTS]: ['id', 'employee_id', 'leave_type_id', 'start_date', 'end_date', 'total_days', 'reason', 'status', 'submitted_at', 'approved_by', 'approved_at', 'rejection_reason'],
  [SHEETS.OVERTIME_REQUESTS]: ['id', 'employee_id', 'date', 'start_time', 'end_time', 'total_minutes', 'reason', 'status', 'requested_by', 'approved_by', 'approved_at', 'notes'],
  [SHEETS.PAYROLL_PERIODS]: ['id', 'period_code', 'start_date', 'end_date', 'pay_date', 'status', 'created_by', 'approved_by', 'approved_at', 'finalized_by', 'finalized_at', 'created_at', 'updated_at'],
  [SHEETS.PAYROLL_RECORDS]: ['id', 'payroll_period_id', 'employee_id', 'gross_pay', 'total_deductions', 'net_pay', 'status', 'created_at', 'updated_at'],
  [SHEETS.DOCUMENTS]: ['id', 'employee_id', 'document_type_name', 'file_name', 'file_size', 'issue_date', 'expiry_date', 'verification_status', 'uploaded_at'],
  [SHEETS.AUDIT_LOGS]: ['id', 'user_id', 'user_name', 'action', 'entity_type', 'entity_id', 'old_value', 'new_value', 'reason', 'ip_address', 'created_at'],
  [SHEETS.CONFIGURATION]: ['key', 'value', 'category', 'description', 'updated_at'],
};

/**
 * Load the Google API client library
 */
function loadGapi(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (gapiLoaded) { resolve(); return; }
    
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.onload = () => {
      (window as any).gapi.load('client', async () => {
        await (window as any).gapi.client.init({
          discoveryDocs: [DISCOVERY_DOC],
        });
        gapiLoaded = true;
        resolve();
      });
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

/**
 * Load Google Identity Services
 */
function loadGis(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (gisLoaded) { resolve(); return; }
    
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.onload = () => {
      gisLoaded = true;
      resolve();
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

/**
 * Convert sheet rows to objects
 */
function rowsToObjects(headers: string[], rows: string[][]): Record<string, any>[] {
  if (rows.length <= 1) return [];
  return rows.slice(1).map(row => {
    const obj: Record<string, any> = {};
    headers.forEach((header, i) => {
      obj[header] = row[i] || '';
    });
    return obj;
  });
}

/**
 * Convert objects to sheet rows
 */
function objectsToRows(headers: string[], objects: Record<string, any>[]): string[][] {
  return objects.map(obj => headers.map(h => obj[h] !== undefined ? String(obj[h]) : ''));
}

/**
 * Main Google Sheets Service Class
 */
class GoogleSheetsService {
  private spreadsheetId: string = '';
  private clientId: string = '';
  private initialized: boolean = false;
  private authenticated: boolean = false;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private cacheTimeout = 10000; // 10 seconds

  /**
   * Initialize the service with credentials
   */
  async initialize(spreadsheetId: string, clientId: string): Promise<void> {
    this.spreadsheetId = spreadsheetId;
    this.clientId = clientId;
    
    await loadGapi();
    await loadGis();
    
    // Initialize token client
    tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: this.clientId,
      scope: SCOPES,
      callback: (response: any) => {
        if (response.access_token) {
          accessToken = response.access_token;
          this.authenticated = true;
          (window as any).gapi.client.setToken({ access_token: accessToken });
        }
      },
    });
    
    this.initialized = true;
  }

  /**
   * Check if service is configured
   */
  isConfigured(): boolean {
    return !!this.spreadsheetId && !!this.clientId;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.authenticated && !!accessToken;
  }

  /**
   * Sign in with Google
   */
  async signIn(): Promise<boolean> {
    if (!this.initialized) {
      throw new Error('Service not initialized. Call initialize() first.');
    }
    
    return new Promise((resolve) => {
      tokenClient.callback = (response: any) => {
        if (response.error) {
          console.error('Auth error:', response.error);
          resolve(false);
          return;
        }
        accessToken = response.access_token;
        this.authenticated = true;
        (window as any).gapi.client.setToken({ access_token: accessToken });
        resolve(true);
      };
      
      if (accessToken) {
        // Already have a token
        resolve(true);
      } else {
        tokenClient.requestAccessToken({ prompt: 'consent' });
      }
    });
  }

  /**
   * Sign out
   */
  signOut(): void {
    if (accessToken) {
      (window as any).google.accounts.oauth2.revoke(accessToken, () => {});
      accessToken = null;
      this.authenticated = false;
    }
  }

  /**
   * Read all data from a sheet
   */
  async readSheet<T = Record<string, any>>(sheetName: SheetName): Promise<T[]> {
    if (!this.isAuthenticated()) {
      throw new Error('Not authenticated. Please sign in first.');
    }

    // Check cache
    const cacheKey = `read_${sheetName}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data as T[];
    }

    const headers = SHEET_HEADERS[sheetName];
    if (!headers) throw new Error(`Unknown sheet: ${sheetName}`);

    try {
      const response = await (window as any).gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A:Z`,
      });

      const rows = response.result.values || [];
      const result = rowsToObjects(headers, rows) as T[];
      
      this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    } catch (error: any) {
      console.error(`Error reading ${sheetName}:`, error);
      throw new Error(error.result?.error?.message || 'Failed to read sheet');
    }
  }

  /**
   * Write data to a sheet (overwrite all rows)
   */
  async writeSheet(sheetName: SheetName, data: Record<string, any>[]): Promise<void> {
    if (!this.isAuthenticated()) {
      throw new Error('Not authenticated. Please sign in first.');
    }

    const headers = SHEET_HEADERS[sheetName];
    if (!headers) throw new Error(`Unknown sheet: ${sheetName}`);

    const rows = [headers, ...objectsToRows(headers, data)];

    try {
      await (window as any).gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A:Z`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: rows },
      });

      // Clear cache for this sheet
      this.cache.delete(`read_${sheetName}`);
    } catch (error: any) {
      console.error(`Error writing ${sheetName}:`, error);
      throw new Error(error.result?.error?.message || 'Failed to write sheet');
    }
  }

  /**
   * Append a row to a sheet
   */
  async appendRow(sheetName: SheetName, row: Record<string, any>): Promise<void> {
    if (!this.isAuthenticated()) {
      throw new Error('Not authenticated. Please sign in first.');
    }

    const headers = SHEET_HEADERS[sheetName];
    if (!headers) throw new Error(`Unknown sheet: ${sheetName}`);

    const values = headers.map(h => row[h] !== undefined ? String(row[h]) : '');

    try {
      await (window as any).gapi.client.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A:Z`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: [values] },
      });

      this.cache.delete(`read_${sheetName}`);
    } catch (error: any) {
      console.error(`Error appending to ${sheetName}:`, error);
      throw new Error(error.result?.error?.message || 'Failed to append row');
    }
  }

  /**
   * Update a specific row by finding it and replacing
   */
  async updateRow(sheetName: SheetName, id: string, updatedData: Record<string, any>): Promise<void> {
    const allData = await this.readSheet(sheetName);
    const rowIndex = allData.findIndex((row: any) => row.id === id);
    
    if (rowIndex === -1) {
      throw new Error(`Row with id ${id} not found in ${sheetName}`);
    }

    const updatedRow = { ...allData[rowIndex], ...updatedData, updated_at: new Date().toISOString() };
    allData[rowIndex] = updatedRow;
    
    await this.writeSheet(sheetName, allData);
  }

  /**
   * Delete a row by ID
   */
  async deleteRow(sheetName: SheetName, id: string): Promise<void> {
    const allData = await this.readSheet(sheetName);
    const filtered = allData.filter((row: any) => row.id !== id);
    await this.writeSheet(sheetName, filtered);
  }

  /**
   * Clear cache
   */
  clearCache(sheetName?: SheetName): void {
    if (sheetName) {
      this.cache.delete(`read_${sheetName}`);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Get spreadsheet URL
   */
  getSpreadsheetUrl(): string {
    return `https://docs.google.com/spreadsheets/d/${this.spreadsheetId}/edit`;
  }
}

// Export singleton
export const sheetsService = new GoogleSheetsService();
