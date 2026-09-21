/**
 * Data Provider for ATRIUM HRIS
 * 
 * Abstracts the data source - can use Google Sheets API or localStorage.
 * When Google Sheets is configured and authenticated, uses Sheets.
 * Otherwise, falls back to localStorage for offline/demo use.
 */

import { sheetsService, SHEETS, SHEET_HEADERS } from './googleSheets';
import {
  employees as mockEmployees,
  departments as mockDepartments,
  positions as mockPositions,
  shifts as mockShifts,
  attendance as mockAttendance,
  leaveRequests as mockLeaveRequests,
  overtimeRequests as mockOvertime,
  payrollPeriods as mockPayrollPeriods,
  payrollRecords as mockPayrollRecords,
  documents as mockDocuments,
  auditLogs as mockAuditLogs,
  notifications as mockNotifications,
  leaveTypes as mockLeaveTypes,
} from '../data/mockData';
import { Employee, Department, Position, Shift, Attendance, LeaveRequest, OvertimeRequest, PayrollPeriod, PayrollRecord, EmployeeDocument, AuditLog, Notification, LeaveType } from '../types';

const STORAGE_PREFIX = 'atrium_hris_';

type EntityType = 'employees' | 'departments' | 'positions' | 'shifts' | 'attendance' | 'leaveRequests' | 'overtimeRequests' | 'payrollPeriods' | 'payrollRecords' | 'documents' | 'auditLogs' | 'notifications' | 'leaveTypes';

const entityToSheet: Record<EntityType, string> = {
  employees: SHEETS.EMPLOYEES,
  departments: SHEETS.DEPARTMENTS,
  positions: SHEETS.POSITIONS,
  shifts: SHEETS.SHIFTS,
  attendance: SHEETS.ATTENDANCE,
  leaveRequests: SHEETS.LEAVE_REQUESTS,
  overtimeRequests: SHEETS.OVERTIME_REQUESTS,
  payrollPeriods: SHEETS.PAYROLL_PERIODS,
  payrollRecords: SHEETS.PAYROLL_RECORDS,
  documents: SHEETS.DOCUMENTS,
  auditLogs: SHEETS.AUDIT_LOGS,
  notifications: 'notifications',
  leaveTypes: SHEETS.LEAVE_TYPES,
};

const mockData: Record<EntityType, any[]> = {
  employees: mockEmployees,
  departments: mockDepartments,
  positions: mockPositions,
  shifts: mockShifts,
  attendance: mockAttendance,
  leaveRequests: mockLeaveRequests,
  overtimeRequests: mockOvertime,
  payrollPeriods: mockPayrollPeriods,
  payrollRecords: mockPayrollRecords,
  documents: mockDocuments,
  auditLogs: mockAuditLogs,
  notifications: mockNotifications,
  leaveTypes: mockLeaveTypes,
};

/**
 * LocalStorage helpers
 */
function getLocalData<T>(entity: EntityType): T[] {
  try {
    const stored = localStorage.getItem(`${STORAGE_PREFIX}${entity}`);
    if (stored) return JSON.parse(stored);
  } catch (e) {
    console.error(`Error reading ${entity} from localStorage:`, e);
  }
  return mockData[entity] as T[];
}

function setLocalData<T>(entity: EntityType, data: T[]): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${entity}`, JSON.stringify(data));
  } catch (e) {
    console.error(`Error writing ${entity} to localStorage:`, e);
  }
}

/**
 * Data Provider class
 */
class DataProvider {
  private useGoogleSheets: boolean = false;

  /**
   * Set whether to use Google Sheets
   */
  setUseGoogleSheets(use: boolean): void {
    this.useGoogleSheets = use;
  }

  /**
   * Check if using Google Sheets
   */
  isUsingGoogleSheets(): boolean {
    return this.useGoogleSheets && sheetsService.isAuthenticated();
  }

  /**
   * Get all data for an entity
   */
  async getAll<T>(entity: EntityType): Promise<T[]> {
    if (this.isUsingGoogleSheets()) {
      try {
        const sheetName = entityToSheet[entity];
        if (sheetName && SHEET_HEADERS[sheetName]) {
          return await sheetsService.readSheet<T>(sheetName as any);
        }
      } catch (e) {
        console.error(`Error reading from Google Sheets, falling back to localStorage:`, e);
      }
    }
    return getLocalData<T>(entity);
  }

  /**
   * Save all data for an entity
   */
  async saveAll<T>(entity: EntityType, data: T[]): Promise<void> {
    // Always save to localStorage as backup
    setLocalData(entity, data);

    // Also save to Google Sheets if connected
    if (this.isUsingGoogleSheets()) {
      try {
        const sheetName = entityToSheet[entity];
        if (sheetName && SHEET_HEADERS[sheetName]) {
          await sheetsService.writeSheet(sheetName as any, data as any[]);
        }
      } catch (e) {
        console.error(`Error writing to Google Sheets:`, e);
      }
    }
  }

  /**
   * Add a single item
   */
  async addItem<T extends { id: string }>(entity: EntityType, item: T): Promise<void> {
    const data = await this.getAll<T>(entity);
    data.push(item);
    await this.saveAll(entity, data);
  }

  /**
   * Update a single item by ID
   */
  async updateItem<T extends { id: string }>(entity: EntityType, id: string, updates: Partial<T>): Promise<void> {
    const data = await this.getAll<T>(entity);
    const index = data.findIndex((item: any) => item.id === id);
    if (index !== -1) {
      data[index] = { ...data[index], ...updates };
      await this.saveAll(entity, data);
    }
  }

  /**
   * Delete a single item by ID
   */
  async deleteItem<T extends { id: string }>(entity: EntityType, id: string): Promise<void> {
    const data = await this.getAll<T>(entity);
    const filtered = data.filter((item: any) => item.id !== id);
    await this.saveAll(entity, filtered);
  }

  /**
   * Reset all data to defaults
   */
  resetAll(): void {
    Object.keys(mockData).forEach(key => {
      localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
    });
  }

  /**
   * Get storage info
   */
  getStorageInfo(): { source: string; entities: number; totalItems: number } {
    const source = this.isUsingGoogleSheets() ? 'Google Sheets + LocalStorage' : 'LocalStorage (Demo Mode)';
    let totalItems = 0;
    Object.keys(mockData).forEach(key => {
      const data = getLocalData(key as EntityType);
      totalItems += data.length;
    });
    return { source, entities: Object.keys(mockData).length, totalItems };
  }
}

export const dataProvider = new DataProvider();
