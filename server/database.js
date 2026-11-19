import { Pool, types } from 'pg';
import dotenv from 'dotenv';
import { profileFields } from './employee-profile.js';
import { fingerspotMayRewrite, parseAttlog, planAttlog, rollupScans } from './fingerspot.js';
import { payrollPeriodAcceptsProfileSalary, planProfileBasicSalaries } from './payroll-basic.js';
import { defaultPayrollStructure, payrollComponentSnapshot, periodStructureWrite, structureFromParts } from './payroll-structure.js';
import { currentEligibility } from './employee-pay-components.js';
import {
  correctionAttendanceSql,
  describeMine,
  jakartaClock,
  jakartaDayStart,
  planCorrectionApproval,
  planPhonePunch,
  planEmployeeEmail,
  planWorkforceLink,
  workforceEmail,
  presentPunchDay,
  previousDate,
  punchPhotoRelative,
  punchPhotoRoot,
  readPunchJpeg,
} from './phone-punch.js';
import { readStoredPhoto, removeStoredPhoto, writeStoredPhoto } from './employee-profile.js';

types.setTypeParser(1082, (value) => value);
dotenv.config();

const productionHrisSocket = '/cloudsql/turing-zone-512505-v3:asia-southeast2:wolf-command';

export function assertHrisDatabaseTarget() {
  const host = process.env.DB_HOST;
  const port = Number(process.env.DB_PORT);
  const name = process.env.DB_NAME;
  if (host === '127.0.0.1' && port === 5434 && name === 'atrium_hris_local') return;
  if (
    process.env.WOLF_HR_PRODUCTION_DB === '1' &&
    host === productionHrisSocket &&
    port === 5432 &&
    name === 'atrium_hris'
  ) {
    return;
  }
  throw new Error('HRIS database target is refused');
}

// Database configuration from environment variables
const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'atrium_hris',
  user: process.env.DB_USER || 'atrium_user',
  password: process.env.DB_PASSWORD || '',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// Create connection pool
const pool = new Pool(config);

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

/**
 * Database service class
 */
class DatabaseService {
  constructor() {
    this.pool = pool;
  }

  /**
   * Test database connection
   */
  async testConnection() {
    try {
      const client = await this.pool.connect();
      const result = await client.query('SELECT NOW()');
      client.release();
      console.log('✅ Database connection successful!', result.rows[0]);
      return true;
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      return false;
    }
  }

  /**
   * Execute a query
   */
  async query(text, params) {
    const start = Date.now();
    const result = await this.pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text: text.substring(0, 50), duration, rows: result.rowCount });
    return result;
  }

  /**
   * Get a client from the pool for transactions
   */
  async getClient() {
    return await this.pool.connect();
  }

  /**
   * Execute multiple queries in a transaction
   */
  async transaction(callback) {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  /**
   * Close all connections
   */
  async close() {
    await this.pool.end();
  }

  // ============================================
  // EMPLOYEE OPERATIONS
  // ============================================

  async getAllEmployees(companyId) {
    const result = await this.query(`
      SELECT e.*, d.name as department_name, p.title as position_title
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id AND d.company_id = e.company_id
      LEFT JOIN positions p ON e.position_id = p.id AND p.company_id = e.company_id
      WHERE e.company_id = $1
      ORDER BY e.full_name
    `, [companyId]);
    return result.rows;
  }

  async getEmployeeById(id, companyId) {
    const result = await this.query(`
      SELECT e.*, d.name as department_name, p.title as position_title
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id AND d.company_id = e.company_id
      LEFT JOIN positions p ON e.position_id = p.id AND p.company_id = e.company_id
      WHERE e.id = $1 AND e.company_id = $2
    `, [id, companyId]);
    return result.rows[0];
  }

  async createEmployee(data) {
    const duplicate = await this.query(
      `SELECT id FROM employees WHERE company_id = $1 AND lower(btrim(email)) = lower(btrim($2)) LIMIT 1`,
      [data.company_id, typeof data.email === "string" ? data.email : ""],
    );
    const planned = planEmployeeEmail(data.email, duplicate.rows.length);
    if (!planned.ok || !data.company_id) {
      const error = new Error(planned.ok ? "A work email is required." : planned.error);
      error.status = planned.ok ? 400 : planned.status;
      throw error;
    }
    const email = planned.email;
    const result = await this.query(`
      INSERT INTO employees (
        employee_code, full_name, preferred_name, nik, npwp, date_of_birth,
        gender, phone, email, address, emergency_contact_name, emergency_contact_phone,
        department_id, position_id, employment_status, join_date, bank_name,
        bank_account_number, bank_account_name, company_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
      ) RETURNING *
    `, [
      data.employee_code, data.full_name, data.preferred_name, data.nik, data.npwp,
      data.date_of_birth, data.gender, data.phone, email, data.address,
      data.emergency_contact_name, data.emergency_contact_phone, data.department_id,
      data.position_id, data.employment_status, data.join_date, data.bank_name,
      data.bank_account_number, data.bank_account_name, data.company_id
    ]);
    return result.rows[0];
  }

  async updateEmployee(id, data, companyId) {
    const duplicate = await this.query(
      `SELECT id FROM employees WHERE company_id = $1 AND lower(btrim(email)) = lower(btrim($2)) AND id <> $3 LIMIT 1`,
      [companyId, typeof data.email === "string" ? data.email : "", id],
    );
    const planned = planEmployeeEmail(data.email, duplicate.rows.length);
    if (!planned.ok) {
      const error = new Error(planned.error);
      error.status = planned.status;
      throw error;
    }
    const email = planned.email;
    const result = await this.query(`
      UPDATE employees SET
        full_name = $1, preferred_name = $2, nik = $3, npwp = $4, date_of_birth = $5,
        gender = $6, phone = $7, email = $8, address = $9, emergency_contact_name = $10,
        emergency_contact_phone = $11, department_id = $12, position_id = $13,
        employment_status = $14, bank_name = $15, bank_account_number = $16,
        bank_account_name = $17, updated_at = CURRENT_TIMESTAMP
      WHERE id = $18 AND company_id = $19 RETURNING *
    `, [
      data.full_name, data.preferred_name, data.nik, data.npwp, data.date_of_birth,
      data.gender, data.phone, email, data.address, data.emergency_contact_name,
      data.emergency_contact_phone, data.department_id, data.position_id,
      data.employment_status, data.bank_name, data.bank_account_number,
      data.bank_account_name, id, companyId
    ]);
    return result.rows[0];
  }

  async deleteEmployee(id, companyId) {
    const result = await this.query('DELETE FROM employees WHERE id = $1 AND company_id = $2', [id, companyId]);
    return result.rowCount;
  }

  // ============================================
  // DEPARTMENT OPERATIONS
  // ============================================

  async getAllDepartments(companyId) {
    const result = await this.query('SELECT * FROM departments WHERE company_id = $1 ORDER BY name', [companyId]);
    return result.rows;
  }

  async getDepartmentById(id, companyId) {
    const result = await this.query('SELECT * FROM departments WHERE id = $1 AND company_id = $2', [id, companyId]);
    return result.rows[0];
  }

  async getAllPositions(companyId) {
    const result = await this.query('SELECT * FROM positions WHERE company_id = $1 ORDER BY title', [companyId]);
    return result.rows;
  }

  async getPositionById(id, companyId) {
    const result = await this.query('SELECT * FROM positions WHERE id = $1 AND company_id = $2', [id, companyId]);
    return result.rows[0];
  }

  async createPosition(data, companyId) {
    const result = await this.query(`
      INSERT INTO positions (code, title, department_id, grade, description, company_id)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
    `, [data.code, data.title, data.department_id, data.grade, data.description, companyId]);
    return result.rows[0];
  }

  async updateDepartment(id, data, companyId) {
    const result = await this.query(`
      UPDATE departments
      SET code = $1, name = $2, description = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $4 AND company_id = $5
      RETURNING *
    `, [data.code, data.name, data.description, id, companyId]);
    return result.rows[0];
  }

  async deleteDepartment(id, companyId) {
    const result = await this.query('DELETE FROM departments WHERE id = $1 AND company_id = $2', [id, companyId]);
    return result.rowCount;
  }

  async updatePosition(id, data, companyId) {
    const result = await this.query(`
      UPDATE positions
      SET code = $1, title = $2, department_id = $3, grade = $4, description = $5, updated_at = CURRENT_TIMESTAMP
      WHERE id = $6 AND company_id = $7
      RETURNING *
    `, [data.code, data.title, data.department_id, data.grade, data.description, id, companyId]);
    return result.rows[0];
  }

  async deletePosition(id, companyId) {
    const result = await this.query('DELETE FROM positions WHERE id = $1 AND company_id = $2', [id, companyId]);
    return result.rowCount;
  }

  async hasPayrollGrant(companyId, wolfUserId) {
    const result = await this.query(
      'SELECT 1 FROM hris_payroll_grants WHERE company_id = $1 AND wolf_user_id = $2',
      [companyId, wolfUserId],
    );
    return result.rowCount > 0;
  }

  async createDepartment(data, companyId) {
    const result = await this.query(`
      INSERT INTO departments (code, name, description, parent_department_id, manager_employee_id, company_id)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
    `, [data.code, data.name, data.description, data.parent_department_id, data.manager_employee_id, companyId]);
    return result.rows[0];
  }

  // ============================================
  // ATTENDANCE OPERATIONS
  // ============================================

  async getAttendanceBetween(companyId, startDate, endDate) {
    const result = await this.query(
      `SELECT employee_id, attendance_date, status, late_minutes,
              COALESCE(overtime_minutes, 0) AS overtime_minutes
       FROM attendance
       WHERE company_id = $1 AND attendance_date >= $2::date AND attendance_date <= $3::date`,
      [companyId, startDate, endDate],
    );
    return result.rows;
  }

  async getAttendanceByDate(date, companyId) {
    const result = await this.query(`
      SELECT a.*, e.full_name, e.employee_code, s.name as shift_name
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id AND e.company_id = a.company_id
      LEFT JOIN shifts s ON a.shift_id = s.id
      WHERE a.attendance_date = $1 AND a.company_id = $2
      ORDER BY e.full_name
    `, [date, companyId]);
    return result.rows;
  }

  async createAttendance(data) {
    const result = await this.query(`
      INSERT INTO attendance (
        employee_id, attendance_date, shift_id, clock_in, clock_out, status,
        late_minutes, early_leave_minutes, overtime_minutes, notes, company_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (employee_id, attendance_date) DO UPDATE SET
        clock_in = EXCLUDED.clock_in,
        clock_out = EXCLUDED.clock_out,
        status = EXCLUDED.status,
        late_minutes = EXCLUDED.late_minutes,
        company_id = EXCLUDED.company_id,
        updated_at = CURRENT_TIMESTAMP
      WHERE attendance.company_id = EXCLUDED.company_id
      RETURNING *
    `, [
      data.employee_id, data.attendance_date, data.shift_id, data.clock_in,
      data.clock_out, data.status, data.late_minutes, data.early_leave_minutes,
      data.overtime_minutes, data.notes, data.company_id
    ]);
    return result.rows[0];
  }

  async ensureFingerspotTables() {
    if (this.fingerspotReady) return;
    await this.query(`CREATE TABLE IF NOT EXISTS fingerspot_devices (
      cloud_id text PRIMARY KEY,
      company_id text NOT NULL REFERENCES hris_companies (id),
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    await this.query(`CREATE TABLE IF NOT EXISTS fingerspot_pins (
      cloud_id text NOT NULL REFERENCES fingerspot_devices (cloud_id),
      pin text NOT NULL,
      employee_id uuid NOT NULL REFERENCES employees (id),
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (cloud_id, pin)
    )`);
    await this.query(`CREATE TABLE IF NOT EXISTS fingerspot_scans (
      cloud_id text NOT NULL,
      pin text NOT NULL,
      scanned_at text NOT NULL,
      verify integer,
      status_scan integer,
      company_id text NOT NULL,
      employee_id uuid,
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (cloud_id, pin, scanned_at)
    )`);
    await this.query(`CREATE INDEX IF NOT EXISTS fingerspot_scans_company_idx ON fingerspot_scans (company_id, scanned_at)`);
    this.fingerspotReady = true;
  }

  async acceptFingerspotAttlog(body) {
    const parsed = parseAttlog(body);
    if (!parsed.ok) return { status: 400, body: { error: "Fingerprint scan is not valid." } };
    const deviceRow = await this.query(`SELECT cloud_id, company_id FROM fingerspot_devices WHERE cloud_id = $1`, [parsed.cloudId]);
    const device = deviceRow.rows[0] ? { companyId: deviceRow.rows[0].company_id } : null;
    if (!device) return { status: 404, body: { error: "Fingerprint device is not connected." } };
    const inserted = await this.query(`
      INSERT INTO fingerspot_scans (cloud_id, pin, scanned_at, verify, status_scan, company_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (cloud_id, pin, scanned_at) DO NOTHING
      RETURNING scanned_at
    `, [parsed.cloudId, parsed.pin, parsed.scannedAt, parsed.verify, parsed.statusScan, device.companyId]);
    const duplicate = inserted.rowCount === 0;
    const pinRow = await this.query(
      `SELECT employee_id FROM fingerspot_pins WHERE cloud_id = $1 AND pin = $2`,
      [parsed.cloudId, parsed.pin],
    );
    const employeeId = pinRow.rows[0]?.employee_id ?? null;
    if (!duplicate && employeeId) {
      await this.query(`UPDATE fingerspot_scans SET employee_id = $4 WHERE cloud_id = $1 AND pin = $2 AND scanned_at = $3`, [parsed.cloudId, parsed.pin, parsed.scannedAt, employeeId]);
    }
    const dayRows = await this.query(`
      SELECT scanned_at, status_scan FROM fingerspot_scans
      WHERE cloud_id = $1 AND pin = $2 AND scanned_at LIKE $3
      ORDER BY scanned_at
    `, [parsed.cloudId, parsed.pin, `${parsed.attendanceDate}%`]);
    const dayScans = dayRows.rows
      .filter((row) => row.scanned_at !== parsed.scannedAt)
      .map((row) => ({
        scannedAt: row.scanned_at,
        attendanceDate: row.scanned_at.slice(0, 10),
        clock: row.scanned_at.slice(11, 16),
        statusScan: row.status_scan,
      }));
    const shiftStart = employeeId ? await this.shiftStartForEmployee(employeeId, parsed.attendanceDate) : null
    const planned = planAttlog({
      body,
      device,
      duplicate,
      employeeId,
      dayScans,
      shiftStart,
    });
    if (planned.attendance && employeeId) {
      const existingDay = await this.query(
        `SELECT source FROM attendance WHERE employee_id = $1 AND attendance_date = $2 AND company_id = $3`,
        [employeeId, planned.attendance.attendanceDate, device.companyId],
      );
      if (existingDay.rows[0] && !fingerspotMayRewrite(existingDay.rows[0].source)) {
        planned.body = { outcome: "kept", companyId: device.companyId };
        return planned;
      }
      const saved = await this.upsertFingerspotDay({
        employeeId,
        companyId: device.companyId,
        attendanceDate: planned.attendance.attendanceDate,
        clockIn: planned.attendance.clockIn,
        clockOut: planned.attendance.clockOut,
        status: planned.attendance.status,
        lateMinutes: planned.attendance.lateMinutes,
      });
      if (!saved) planned.body = { outcome: "kept", companyId: device.companyId };
    }
    return planned;
  }

  async shiftStartForEmployee(employeeId, attendanceDate) {
    const result = await this.query(`
      SELECT s.start_time, s.crosses_midnight
      FROM employee_shift_assignments a
      JOIN shifts s ON s.id = a.shift_id
      WHERE a.employee_id = $1
        AND a.effective_from <= $2::date
        AND (a.effective_to IS NULL OR a.effective_to >= $2::date)
      ORDER BY a.effective_from DESC
      LIMIT 1
    `, [employeeId, attendanceDate]);
    const row = result.rows[0];
    if (!row || row.crosses_midnight) return null;
    const start = String(row.start_time).slice(0, 5);
    return /^\d{2}:\d{2}$/.test(start) ? { start, crossesMidnight: false } : null;
  }

  async upsertFingerspotDay(row) {
    const result = await this.query(`
      INSERT INTO attendance (
        employee_id, attendance_date, clock_in, clock_out, status, late_minutes, source, company_id
      ) VALUES ($1, $2, $3, $4, $5, $6, 'fingerspot', $7)
      ON CONFLICT (employee_id, attendance_date) DO UPDATE SET
        clock_in = EXCLUDED.clock_in,
        clock_out = EXCLUDED.clock_out,
        status = EXCLUDED.status,
        late_minutes = EXCLUDED.late_minutes,
        source = 'fingerspot',
        updated_at = CURRENT_TIMESTAMP
      WHERE attendance.company_id = EXCLUDED.company_id
        AND attendance.source = 'fingerspot'
      RETURNING id, company_id
    `, [
      row.employeeId,
      row.attendanceDate,
      row.clockIn,
      row.clockOut,
      row.status,
      row.lateMinutes,
      row.companyId,
    ]);
    return result.rows[0] ?? null;
  }

  async listUnpairedFingerspot(companyId) {
    const result = await this.query(`
      SELECT s.cloud_id, s.pin, s.scanned_at
      FROM fingerspot_scans s
      JOIN fingerspot_devices d ON d.cloud_id = s.cloud_id AND d.company_id = $1
      LEFT JOIN fingerspot_pins p ON p.cloud_id = s.cloud_id AND p.pin = s.pin
      WHERE s.company_id = $1 AND p.pin IS NULL
      ORDER BY s.scanned_at DESC
      LIMIT 50
    `, [companyId]);
    return result.rows;
  }

  async pairFingerspotPin(companyId, cloudId, pin, employeeId) {
    const device = await this.query(`SELECT company_id FROM fingerspot_devices WHERE cloud_id = $1`, [cloudId]);
    if (!device.rows[0] || device.rows[0].company_id !== companyId) return null;
    await this.query(`
      INSERT INTO fingerspot_pins (cloud_id, pin, employee_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (cloud_id, pin) DO UPDATE SET employee_id = EXCLUDED.employee_id
    `, [cloudId, pin, employeeId]);
    await this.query(`
      UPDATE fingerspot_scans SET employee_id = $3
      WHERE cloud_id = $1 AND pin = $2 AND company_id = $4
    `, [cloudId, pin, employeeId, companyId]);
    const scans = await this.query(`
      SELECT scanned_at, status_scan FROM fingerspot_scans
      WHERE cloud_id = $1 AND pin = $2 AND company_id = $3
      ORDER BY scanned_at
    `, [cloudId, pin, companyId]);
    const byDate = new Map();
    for (const row of scans.rows) {
      const attendanceDate = row.scanned_at.slice(0, 10);
      const bucket = byDate.get(attendanceDate) ?? [];
      bucket.push({
        scannedAt: row.scanned_at,
        attendanceDate,
        clock: row.scanned_at.slice(11, 16),
        statusScan: row.status_scan,
      });
      byDate.set(attendanceDate, bucket);
    }
    for (const [attendanceDate, dayScans] of byDate) {
      const shiftStart = await this.shiftStartForEmployee(employeeId, attendanceDate);
      const attendance = rollupScans(dayScans, shiftStart);
      if (!attendance) continue;
      await this.upsertFingerspotDay({
        employeeId,
        companyId,
        attendanceDate: attendance.attendanceDate,
        clockIn: attendance.clockIn,
        clockOut: attendance.clockOut,
        status: attendance.status,
        lateMinutes: attendance.lateMinutes,
      });
    }
    return { cloudId, pin, employeeId, companyId };
  }

  // ============================================
  // LEAVE OPERATIONS
  // ============================================

  async getLeaveRequests(filters, companyId) {
    let query = `
      SELECT lr.*, e.full_name, e.employee_code, lt.name as leave_type_name
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id AND e.company_id = lr.company_id
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      WHERE lr.company_id = $1
    `;
    
    const params = [companyId];
    if (filters?.status) {
      query += ` AND lr.status = $${params.length + 1}`;
      params.push(filters.status);
    }
    
    query += ' ORDER BY lr.submitted_at DESC';
    
    const result = await this.query(query, params);
    return result.rows;
  }

  async createLeaveRequest(data) {
    const result = await this.query(`
      INSERT INTO leave_requests (
        employee_id, leave_type_id, start_date, end_date, total_days, reason, status, company_id
      ) VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', $7) RETURNING *
    `, [data.employee_id, data.leave_type_id, data.start_date, data.end_date, data.total_days, data.reason, data.company_id]);
    return result.rows[0];
  }

  async getLeaveRequestById(id, companyId) {
    const result = await this.query(
      `SELECT * FROM leave_requests WHERE id = $1 AND company_id = $2`,
      [id, companyId],
    );
    return result.rows[0];
  }

  async approveLeaveRequest(id, approvedBy, companyId) {
    const result = await this.query(`
      UPDATE leave_requests 
      SET status = 'APPROVED', approved_by = $1, approved_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND company_id = $3 RETURNING *
    `, [approvedBy, id, companyId]);
    return result.rows[0];
  }

  // ============================================
  // PAYROLL OPERATIONS
  // ============================================

  async getPayrollPeriods(companyId) {
    const result = await this.query('SELECT * FROM payroll_periods WHERE company_id = $1 ORDER BY start_date DESC', [companyId]);
    return result.rows;
  }

  async createPayrollPeriod(data) {
    const result = await this.query(`
      INSERT INTO payroll_periods (period_code, start_date, end_date, pay_date, status, created_by, company_id)
      VALUES ($1, $2, $3, $4, 'DRAFT', $5, $6) RETURNING *
    `, [data.period_code, data.start_date, data.end_date, data.pay_date, data.created_by, data.company_id]);
    return result.rows[0];
  }

  async findPayrollPeriodByCode(companyId, periodCode) {
    const result = await this.query(
      `SELECT * FROM payroll_periods WHERE company_id = $1 AND period_code = $2`,
      [companyId, periodCode],
    );
    return result.rows[0] ?? null;
  }

  async ensurePayrollPeriod(data) {
    const existing = await this.findPayrollPeriodByCode(data.company_id, data.period_code);
    if (existing) return { created: false, period: existing };
    try {
      const period = await this.createPayrollPeriod({ ...data, created_by: null });
      return { created: true, period };
    } catch (error) {
      if (error.code !== '23505') throw error;
      const again = await this.findPayrollPeriodByCode(data.company_id, data.period_code);
      if (again) return { created: false, period: again };
      return { created: false, period: null };
    }
  }

  async approvePayrollPeriod(id, companyId) {
    const result = await this.query(
      `UPDATE payroll_periods SET status = 'APPROVED' WHERE id = $1 AND company_id = $2 RETURNING *`,
      [id, companyId],
    );
    return result.rows[0];
  }

  async getPayrollPeriodById(id, companyId) {
    const result = await this.query(`SELECT * FROM payroll_periods WHERE id = $1 AND company_id = $2`, [id, companyId]);
    return result.rows[0];
  }

  async getPayrollRecords(periodId, companyId) {
    const result = await this.query(`
      SELECT pr.*, e.full_name, e.employee_code, d.name as department_name
      FROM payroll_records pr
      JOIN employees e ON pr.employee_id = e.id AND e.company_id = pr.company_id
      LEFT JOIN departments d ON e.department_id = d.id AND d.company_id = e.company_id
      WHERE pr.payroll_period_id = $1 AND pr.company_id = $2
      ORDER BY e.full_name
    `, [periodId, companyId]);
    return result.rows;
  }

  async copyProfileBasicSalaries(companyId, periodId) {
    const period = await this.getPayrollPeriodById(periodId, companyId);
    if (!period || period.company_id !== companyId || !payrollPeriodAcceptsProfileSalary(period.status)) {
      return { changed: 0 };
    }
    const employees = await this.query(
      `SELECT id, company_id, gaji_pokok FROM employees WHERE company_id = $1`,
      [companyId],
    );
    const existing = await this.query(
      `SELECT employee_id, company_id, basic_salary, basic_salary_from_profile
       FROM payroll_records
       WHERE payroll_period_id = $1 AND company_id = $2`,
      [periodId, companyId],
    );
    const steps = planProfileBasicSalaries(companyId, employees.rows, existing.rows);
    if (steps.length === 0) return { changed: 0 };
    return this.transaction(async (client) => {
      let changed = 0;
      for (const step of steps) {
        if (step.action === 'insert') {
          const result = await client.query(
            `INSERT INTO payroll_records (
               payroll_period_id, employee_id, company_id,
               basic_salary, basic_salary_from_profile,
               gross_pay, total_deductions, net_pay, status
             ) VALUES ($1, $2, $3, $4::bigint, TRUE, $4::bigint, 0, $4::bigint, 'DRAFT')
             ON CONFLICT (payroll_period_id, employee_id) DO NOTHING`,
            [periodId, step.employeeId, companyId, step.basicSalary],
          );
          changed += result.rowCount;
        } else if (step.action === 'update') {
          const result = await client.query(
            `UPDATE payroll_records
             SET basic_salary = $4::bigint,
                 gross_pay = $4::bigint,
                 total_deductions = 0,
                 net_pay = $4::bigint,
                 basic_salary_from_profile = TRUE,
                 updated_at = CURRENT_TIMESTAMP
             WHERE payroll_period_id = $1
               AND employee_id = $2
               AND company_id = $3
               AND basic_salary_from_profile IS TRUE`,
            [periodId, step.employeeId, companyId, step.basicSalary],
          );
          changed += result.rowCount;
        } else if (step.action === 'clear') {
          const result = await client.query(
            `UPDATE payroll_records
             SET basic_salary = NULL,
                 gross_pay = NULL,
                 net_pay = NULL,
                 total_deductions = 0,
                 updated_at = CURRENT_TIMESTAMP
             WHERE payroll_period_id = $1
               AND employee_id = $2
               AND company_id = $3
               AND basic_salary_from_profile IS TRUE`,
            [periodId, step.employeeId, companyId],
          );
          changed += result.rowCount;
        }
      }
      return { changed };
    });
  }

  async getCompanyPayrollStructure(companyId) {
    assertHrisDatabaseTarget();
    const header = await this.query(
      `SELECT id, company_id, effective_from::text AS effective_from, gross_formula, net_formula
       FROM payroll_structures
       WHERE company_id = $1
       ORDER BY effective_from DESC
       LIMIT 1`,
      [companyId],
    );
    if (!header.rows[0]) return null;
    const components = await this.query(
      `SELECT code, display_name, kind, sort_order, active, rate_bp, wage_base
       FROM payroll_structure_components
       WHERE structure_id = $1 AND company_id = $2
       ORDER BY sort_order, code`,
      [header.rows[0].id, companyId],
    );
    return structureFromParts(header.rows[0], components.rows, 'company');
  }

  async payrollStructureAsOf(companyId, day) {
    assertHrisDatabaseTarget();
    const header = await this.query(
      `SELECT id, company_id, effective_from::text AS effective_from, gross_formula, net_formula
       FROM payroll_structures
       WHERE company_id = $1 AND effective_from <= $2::date
       ORDER BY effective_from DESC
       LIMIT 1`,
      [companyId, day],
    );
    if (!header.rows[0]) return null;
    const components = await this.query(
      `SELECT code, display_name, kind, sort_order, active, rate_bp, wage_base
       FROM payroll_structure_components
       WHERE structure_id = $1 AND company_id = $2
       ORDER BY sort_order, code`,
      [header.rows[0].id, companyId],
    );
    return structureFromParts(header.rows[0], components.rows, 'company');
  }

  async getPeriodPayrollStructure(companyId, periodId) {
    assertHrisDatabaseTarget();
    const result = await this.query(
      `SELECT company_id, effective_from::text AS effective_from, gross_formula, net_formula, components
       FROM payroll_period_structures
       WHERE payroll_period_id = $1 AND company_id = $2`,
      [periodId, companyId],
    );
    if (!result.rows[0]) return null;
    return structureFromParts(result.rows[0], result.rows[0].components, 'period');
  }

  async ensurePayrollPeriodSnapshot(companyId, period) {
    assertHrisDatabaseTarget();
    const existing = await this.getPeriodPayrollStructure(companyId, period.id);
    if (existing) return { created: false, snapshot: existing };
    const current = await this.getCompanyPayrollStructure(companyId) ?? defaultPayrollStructure();
    const write = periodStructureWrite(null, current);
    if (!write?.grossFormula) return { created: false, snapshot: null };
    const day = write.effectiveFrom || String(period.start_date).slice(0, 10);
    await this.query(
      `INSERT INTO payroll_period_structures (
         payroll_period_id, company_id, effective_from, gross_formula, net_formula, components
       ) VALUES ($1, $2, $3::date, $4, $5, $6::jsonb)
       ON CONFLICT (payroll_period_id) DO NOTHING`,
      [
        period.id,
        companyId,
        day,
        write.grossFormula,
        write.netFormula,
        JSON.stringify(payrollComponentSnapshot(write.components)),
      ],
    );
    const stored = await this.getPeriodPayrollStructure(companyId, period.id);
    return { created: !existing && Boolean(stored), snapshot: stored };
  }

  async saveCompanyPayrollStructure(companyId, structure) {
    assertHrisDatabaseTarget();
    return this.transaction(async (client) => {
      const today = await client.query('SELECT CURRENT_DATE::text AS today');
      const day = today.rows[0].today;
      const latest = await client.query(
        `SELECT id, effective_from::text AS effective_from
         FROM payroll_structures
         WHERE company_id = $1
         ORDER BY effective_from DESC
         LIMIT 1`,
        [companyId],
      );
      let structureId = latest.rows[0]?.effective_from === day ? latest.rows[0].id : null;
      if (structureId) {
        await client.query(
          `UPDATE payroll_structures
           SET gross_formula = $2, net_formula = $3
           WHERE id = $1 AND company_id = $4`,
          [structureId, structure.grossFormula, structure.netFormula, companyId],
        );
        await client.query(
          'DELETE FROM payroll_structure_components WHERE structure_id = $1 AND company_id = $2',
          [structureId, companyId],
        );
      } else {
        const inserted = await client.query(
          `INSERT INTO payroll_structures (company_id, effective_from, gross_formula, net_formula)
           VALUES ($1, CURRENT_DATE, $2, $3)
           RETURNING id`,
          [companyId, structure.grossFormula, structure.netFormula],
        );
        structureId = inserted.rows[0].id;
      }
      for (const component of structure.components) {
        await client.query(
          `INSERT INTO payroll_structure_components (
             structure_id, company_id, code, display_name, kind, sort_order, active, rate_bp, wage_base
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::text[])`,
          [
            structureId,
            companyId,
            component.code,
            component.displayName,
            component.kind,
            component.sortOrder,
            component.active === true,
            Number.isInteger(component.rateBp) ? component.rateBp : null,
            Array.isArray(component.wageBase) ? component.wageBase : [],
          ],
        );
      }
      const header = await client.query(
        `SELECT id, company_id, effective_from::text AS effective_from, gross_formula, net_formula
         FROM payroll_structures
         WHERE id = $1 AND company_id = $2`,
        [structureId, companyId],
      );
      const components = await client.query(
        `SELECT code, display_name, kind, sort_order, active, rate_bp, wage_base
         FROM payroll_structure_components
         WHERE structure_id = $1 AND company_id = $2
         ORDER BY sort_order, code`,
        [structureId, companyId],
      );
      return structureFromParts(header.rows[0], components.rows, 'company');
    });
  }

  async hrisToday() {
    assertHrisDatabaseTarget();
    const result = await this.query('SELECT CURRENT_DATE::text AS today');
    return result.rows[0].today;
  }

  async listEmployeeComponentEligibility(companyId, employeeId) {
    assertHrisDatabaseTarget();
    const result = await this.query(
      `SELECT component_code, eligible, amount::text AS amount, effective_from::text AS effective_from
       FROM employee_component_eligibility
       WHERE company_id = $1 AND employee_id = $2
       ORDER BY component_code, effective_from`,
      [companyId, employeeId],
    );
    return result.rows.map((row) => ({
      ...row,
      amount: row.amount == null ? null : Number(row.amount),
    }));
  }

  async currentComponentEligibility(companyId) {
    assertHrisDatabaseTarget();
    const today = await this.query('SELECT CURRENT_DATE::text AS today');
    const result = await this.query(
      `SELECT employee_id, component_code, eligible, amount::text AS amount, effective_from::text AS effective_from
       FROM employee_component_eligibility
       WHERE company_id = $1 AND effective_from <= CURRENT_DATE
       ORDER BY employee_id, component_code, effective_from`,
      [companyId],
    );
    const grouped = new Map();
    for (const row of result.rows) {
      const list = grouped.get(row.employee_id) ?? [];
      list.push({
        ...row,
        amount: row.amount == null ? null : Number(row.amount),
      });
      grouped.set(row.employee_id, list);
    }
    const current = new Map();
    for (const [employeeId, rows] of grouped) {
      current.set(employeeId, currentEligibility(rows, today.rows[0].today));
    }
    return current;
  }

  async saveEmployeeComponentEligibility(companyId, employeeId, components) {
    assertHrisDatabaseTarget();
    return this.transaction(async (client) => {
      const today = await client.query('SELECT CURRENT_DATE::text AS today');
      const day = today.rows[0].today;
      for (const component of components) {
        const existing = await client.query(
          `SELECT id
           FROM employee_component_eligibility
           WHERE company_id = $1 AND employee_id = $2 AND component_code = $3 AND effective_from = $4::date`,
          [companyId, employeeId, component.code, day],
        );
        if (existing.rows[0]) {
          await client.query(
            `UPDATE employee_component_eligibility
             SET eligible = $2, amount = $3
             WHERE id = $1 AND company_id = $4`,
            [existing.rows[0].id, component.eligible, component.amount, companyId],
          );
        } else {
          await client.query(
            `INSERT INTO employee_component_eligibility (
               company_id, employee_id, component_code, eligible, amount, effective_from
             ) VALUES ($1, $2, $3, $4, $5, $6::date)`,
            [companyId, employeeId, component.code, component.eligible, component.amount, day],
          );
        }
      }
      return day;
    });
  }

  // ============================================
  // AUDIT LOG OPERATIONS
  // ============================================

  async createAuditLog(data) {
    const result = await this.query(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_value, new_value, reason, ip_address, company_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *
    `, [
      data.user_id ?? null, data.action, data.entity_type, data.entity_id,
      data.old_value ? JSON.stringify(data.old_value) : null,
      data.new_value ? JSON.stringify(data.new_value) : null,
      data.reason, data.ip_address, data.company_id
    ]);
    return result.rows[0];
  }

  async getAuditLogs(filters, companyId) {
    let query = `
      SELECT al.*, u.full_name as user_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
    `;
    
    const params = [companyId];
    const conditions = ["al.company_id = $1"];
    
    if (filters?.entity_type) {
      conditions.push(`al.entity_type = $${params.length + 1}`);
      params.push(filters.entity_type);
    }
    
    if (filters?.user_id) {
      conditions.push(`al.user_id = $${params.length + 1}`);
      params.push(filters.user_id);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY al.created_at DESC LIMIT 100';
    
    const result = await this.query(query, params);
    return result.rows;
  }

  async listStaffTasks(companyId) {
    const result = await this.query(`
      SELECT id, company_id, employee_id, employee_code, title, detail, due_date, status,
             assigner_name, external_id, created_at, updated_at
      FROM staff_tasks
      WHERE company_id = $1
      ORDER BY due_date, title
    `, [companyId]);
    return result.rows;
  }

  async getStaffTaskById(id, companyId) {
    const result = await this.query(`
      SELECT id, company_id, employee_id, employee_code, title, detail, due_date, status,
             assigner_name, external_id, created_at, updated_at
      FROM staff_tasks
      WHERE id = $1 AND company_id = $2
    `, [id, companyId]);
    return result.rows[0] ?? null;
  }

  async getStaffTaskByExternal(companyId, externalId) {
    const result = await this.query(`
      SELECT id, company_id, employee_id, employee_code, title, detail, due_date, status,
             assigner_name, external_id, created_at, updated_at
      FROM staff_tasks
      WHERE company_id = $1 AND external_id = $2
    `, [companyId, externalId]);
    return result.rows[0] ?? null;
  }

  async getEmployeeByCode(companyId, employeeCode) {
    const result = await this.query(
      `SELECT id, company_id, employee_code FROM employees WHERE company_id = $1 AND employee_code = $2`,
      [companyId, employeeCode],
    );
    return result.rows[0] ?? null;
  }

  async upsertStaffTask(companyId, data) {
    const result = await this.query(`
      INSERT INTO staff_tasks (
        company_id, employee_id, employee_code, title, detail, due_date, status,
        assigner_name, external_id, updated_at
      ) VALUES (
        $1, $2, $3, $4, COALESCE($5, ''), $6, $7, $8, $9, COALESCE($10::timestamptz, CURRENT_TIMESTAMP)
      )
      ON CONFLICT (company_id, external_id) DO UPDATE SET
        employee_id = EXCLUDED.employee_id,
        employee_code = EXCLUDED.employee_code,
        title = EXCLUDED.title,
        detail = CASE WHEN $5::text IS NULL THEN staff_tasks.detail ELSE EXCLUDED.detail END,
        due_date = EXCLUDED.due_date,
        status = EXCLUDED.status,
        updated_at = EXCLUDED.updated_at
      WHERE staff_tasks.company_id = EXCLUDED.company_id
        AND EXCLUDED.updated_at >= staff_tasks.updated_at
      RETURNING id, company_id, employee_id, employee_code, title, detail, due_date, status,
                assigner_name, external_id, created_at, updated_at
    `, [
      companyId,
      data.employee_id,
      data.employee_code,
      data.title,
      data.detail ?? null,
      data.due_date,
      data.status,
      data.assigner_name,
      data.external_id,
      data.updated_at,
    ]);
    if (result.rows[0]) return result.rows[0];
    return this.getStaffTaskByExternal(companyId, data.external_id);
  }

  async updateStaffTask(id, companyId, data) {
    const result = await this.query(`
      UPDATE staff_tasks SET
        title = $3,
        detail = CASE WHEN $4::text IS NULL THEN detail ELSE $4 END,
        due_date = $5,
        status = $6,
        employee_id = COALESCE($7, employee_id),
        employee_code = COALESCE($8, employee_code),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND company_id = $2
      RETURNING id, company_id, employee_id, employee_code, title, detail, due_date, status,
                assigner_name, external_id, created_at, updated_at
    `, [
      id,
      companyId,
      data.title,
      data.detail ?? null,
      data.due_date,
      data.status,
      data.employee_id ?? null,
      data.employee_code ?? null,
    ]);
    return result.rows[0] ?? null;
  }

  async saveEmployeePayrollSettings(id, companyId, settings) {
    const result = await this.query(`
      UPDATE employees SET
        bpjs_enrolled = $3,
        company_covers_employee_bpjs = $4,
        tax_configuration = $5,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND company_id = $2
      RETURNING id, company_id, bpjs_enrolled, company_covers_employee_bpjs, tax_configuration
    `, [
      id,
      companyId,
      settings.bpjs_enrolled,
      settings.company_covers_employee_bpjs,
      settings.tax_configuration,
    ]);
    return result.rows[0] ?? null;
  }

  async applyProfileFields(id, companyId, fields, photoPath = undefined, client = null, baseSalary = undefined) {
    const run = (text, params) => (client ? client.query(text, params) : this.query(text, params));
    if (fields && Object.prototype.hasOwnProperty.call(fields, "email")) {
      const email = workforceEmail(fields.email);
      if (!email) {
        const error = new Error("A work email is required.");
        error.status = 400;
        throw error;
      }
      const duplicate = await run(
        `SELECT id FROM employees WHERE company_id = $1 AND lower(btrim(email)) = $2 AND id <> $3 LIMIT 1`,
        [companyId, email, id],
      );
      if (duplicate.rows[0]) {
        const error = new Error("Another employee in this company already uses this email.");
        error.status = 409;
        throw error;
      }
      fields = { ...fields, email };
    }
    const assignments = [];
    const values = [];
    for (const key of profileFields) {
      if (!Object.prototype.hasOwnProperty.call(fields ?? {}, key)) continue;
      values.push(fields[key]);
      assignments.push(`${key} = $${values.length}`);
    }
    if (baseSalary !== undefined) {
      values.push(baseSalary);
      assignments.push(`gaji_pokok = $${values.length}`);
    }
    if (photoPath !== undefined) {
      values.push(photoPath);
      assignments.push(`profile_photo_path = $${values.length}`);
    }
    if (assignments.length > 0) {
      assignments.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id, companyId);
      const updated = await run(
        `UPDATE employees SET ${assignments.join(', ')} WHERE id = $${values.length - 1} AND company_id = $${values.length}`,
        values,
      );
      if (!updated.rowCount) return null;
    }
    const full = await run(`
      SELECT e.*, d.name as department_name, p.title as position_title
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id AND d.company_id = e.company_id
      LEFT JOIN positions p ON e.position_id = p.id AND p.company_id = e.company_id
      WHERE e.id = $1 AND e.company_id = $2
    `, [id, companyId]);
    return full.rows[0] ?? null;
  }

  async getEmployeeBySelfUser(companyId, userId) {
    const result = await this.query(`
      SELECT e.*, d.name as department_name, p.title as position_title
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id AND d.company_id = e.company_id
      LEFT JOIN positions p ON e.position_id = p.id AND p.company_id = e.company_id
      WHERE e.company_id = $1 AND e.self_service_user_id = $2
      LIMIT 2
    `, [companyId, userId]);
    if (result.rows.length !== 1) return null;
    return result.rows[0];
  }

  async getPendingChangeRequest(companyId, employeeId) {
    const result = await this.query(`
      SELECT id FROM employee_change_requests
      WHERE company_id = $1 AND employee_id = $2 AND status = 'PENDING'
      LIMIT 1
    `, [companyId, employeeId]);
    return result.rows[0] ?? null;
  }

  async insertChangeRequest(data) {
    const result = await this.query(`
      INSERT INTO employee_change_requests (
        id, company_id, employee_id, proposed, photo_path, status, requested_by
      ) VALUES ($1, $2, $3, $4::jsonb, $5, 'PENDING', $6)
      RETURNING *
    `, [
      data.id,
      data.company_id,
      data.employee_id,
      JSON.stringify(data.proposed ?? {}),
      data.photo_path ?? null,
      data.requested_by,
    ]);
    return result.rows[0];
  }

  async listChangeRequests(companyId, status, requestedBy = null) {
    const result = await this.query(`
      SELECT r.*, e.employee_code
      FROM employee_change_requests r
      JOIN employees e ON e.id = r.employee_id AND e.company_id = r.company_id
      WHERE r.company_id = $1
        AND ($2::text IS NULL OR r.status = $2)
        AND ($3::text IS NULL OR r.requested_by = $3)
      ORDER BY r.created_at DESC
    `, [companyId, status, requestedBy]);
    return result.rows;
  }

  async getChangeRequest(id, companyId) {
    const result = await this.query(`
      SELECT r.*, e.employee_code
      FROM employee_change_requests r
      JOIN employees e ON e.id = r.employee_id AND e.company_id = r.company_id
      WHERE r.id = $1 AND r.company_id = $2
    `, [id, companyId]);
    return result.rows[0] ?? null;
  }

  async reviewChangeRequest(id, companyId, reviewerId, status, fields, photoPath) {
    return this.transaction(async (client) => {
      const current = await client.query(`
        SELECT r.*, e.employee_code
        FROM employee_change_requests r
        JOIN employees e ON e.id = r.employee_id AND e.company_id = r.company_id
        WHERE r.id = $1 AND r.company_id = $2
        FOR UPDATE OF r
      `, [id, companyId]);
      const request = current.rows[0];
      if (!request || request.status !== 'PENDING') return null;
      let employee = null;
      if (status === 'APPROVED') {
        employee = await this.applyProfileFields(request.employee_id, companyId, fields, photoPath, client);
        if (!employee) throw new Error('profile update missed the company row');
      }
      const reviewed = await client.query(`
        UPDATE employee_change_requests
        SET status = $3, reviewed_by = $4, reviewed_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND company_id = $2 AND status = 'PENDING'
        RETURNING *
      `, [id, companyId, status, reviewerId]);
      return { request: { ...request, ...reviewed.rows[0] }, employee };
    });
  }

  async ensurePunchTables() {
    if (this.punchReady) return;
    await this.query(`CREATE TABLE IF NOT EXISTS punch_sites (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id text NOT NULL,
      name text NOT NULL,
      latitude double precision NOT NULL,
      longitude double precision NOT NULL,
      radius_meters integer NOT NULL,
      active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT punch_sites_radius_check CHECK (radius_meters BETWEEN 30 AND 300)
    )`);
    await this.query(`CREATE INDEX IF NOT EXISTS punch_sites_company_idx ON punch_sites (company_id, active)`);
    await this.query(`CREATE TABLE IF NOT EXISTS punch_receipts (
      company_id text NOT NULL,
      employee_id uuid NOT NULL,
      idempotency_key text NOT NULL,
      status_code integer NOT NULL,
      body jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (company_id, employee_id, idempotency_key)
    )`);
    const columns = [
      "clock_in_photo_path text",
      "clock_out_photo_path text",
      "clock_in_lat double precision",
      "clock_in_lng double precision",
      "clock_in_accuracy_m integer",
      "clock_out_lat double precision",
      "clock_out_lng double precision",
      "clock_out_accuracy_m integer",
      "clock_in_site_id uuid",
      "clock_out_site_id uuid",
      "clock_in_site_name text",
      "clock_out_site_name text",
      "clock_in_at timestamptz",
      "clock_out_at timestamptz",
    ];
    for (const column of columns) {
      await this.query(`ALTER TABLE attendance ADD COLUMN IF NOT EXISTS ${column}`);
    }
    await this.query(`CREATE TABLE IF NOT EXISTS attendance_corrections (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      attendance_id uuid,
      requested_by uuid,
      original_value jsonb,
      requested_value jsonb,
      reason text,
      status varchar(20) DEFAULT 'PENDING',
      approved_by uuid,
      approved_at timestamp,
      created_at timestamp DEFAULT CURRENT_TIMESTAMP
    )`);
    for (const column of [
      "company_id text",
      "employee_id uuid",
      "attendance_date date",
      "requested_by_user text",
      "reviewed_by_user text",
    ]) {
      await this.query(`ALTER TABLE attendance_corrections ADD COLUMN IF NOT EXISTS ${column}`);
    }
    await this.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS self_service_user_id text`);
    await this.query(`CREATE UNIQUE INDEX IF NOT EXISTS employees_workforce_user_unique
      ON employees (company_id, self_service_user_id)
      WHERE self_service_user_id IS NOT NULL`);
    this.punchReady = true;
  }

  async ensureWorkforceEmployee(client, input) {
    const byUser = await client.query(
      `SELECT id, employee_code FROM employees WHERE company_id = $1 AND self_service_user_id = $2 FOR UPDATE`,
      [input.companyId, input.userId],
    );
    const byEmail = input.email
      ? await client.query(
        `SELECT id, employee_code, email, self_service_user_id, employment_status
         FROM employees
         WHERE company_id = $1 AND lower(btrim(email)) = $2
         FOR UPDATE`,
        [input.companyId, input.email],
      )
      : { rows: [] };
    const plan = planWorkforceLink({
      companyId: input.companyId,
      userId: input.userId,
      email: input.email,
      linkedRows: byUser.rows,
      emailRows: byEmail.rows,
    });
    if (plan.action === "refuse") return { ok: false, status: plan.status, error: plan.error };
    if (plan.action === "use") {
      const row = [...byUser.rows, ...byEmail.rows].find((item) => item.id === plan.employeeId);
      return { ok: true, employee: { id: plan.employeeId, employeeCode: row?.employee_code } };
    }
    if (plan.action === "link") {
      const updated = await client.query(
        `UPDATE employees
         SET self_service_user_id = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 AND company_id = $3 AND self_service_user_id IS NULL
         RETURNING id, employee_code`,
        [input.userId, plan.employeeId, input.companyId],
      );
      if (!updated.rows[0]) return { ok: false, status: 403, error: "This email already belongs to another login." };
      return { ok: true, employee: { id: updated.rows[0].id, employeeCode: updated.rows[0].employee_code } };
    }
    return { ok: false, status: 403, error: "This account is not linked to an employee." };
  }

  async setWorkforceLink(companyId, employeeCode, wolfUserId, email) {
    const employee = await this.query(
      `SELECT id, email, self_service_user_id FROM employees WHERE company_id = $1 AND employee_code = $2 LIMIT 1`,
      [companyId, employeeCode],
    );
    const row = employee.rows[0];
    if (!row) return { ok: false, status: 404, error: "That employee is not in this company." };
    if (wolfUserId === null) {
      await this.query(
        `UPDATE employees SET self_service_user_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND company_id = $2`,
        [row.id, companyId],
      );
      return { ok: true };
    }
    const currentEmail = workforceEmail(row.email);
    const nextEmail = email === undefined || email === null || email === "" ? currentEmail : workforceEmail(email);
    if (!nextEmail) return { ok: false, status: 400, error: "A work email is required." };
    if (currentEmail && currentEmail !== nextEmail) {
      return { ok: false, status: 409, error: "This email does not match the employee." };
    }
    if (row.self_service_user_id && row.self_service_user_id !== wolfUserId) {
      return { ok: false, status: 409, error: "This employee is already linked to another login." };
    }
    const duplicate = await this.query(
      `SELECT id FROM employees WHERE company_id = $1 AND lower(btrim(email)) = $2 AND id <> $3 LIMIT 1`,
      [companyId, nextEmail, row.id],
    );
    if (duplicate.rows[0]) return { ok: false, status: 409, error: "Another employee in this company already uses this email." };
    await this.query(
      `UPDATE employees
       SET email = $1, self_service_user_id = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND company_id = $4`,
      [nextEmail, wolfUserId, row.id, companyId],
    );
    return { ok: true };
  }

  async listPunchSites(companyId) {
    await this.ensurePunchTables();
    const result = await this.query(
      `SELECT id, company_id, name, latitude, longitude, radius_meters, active
       FROM punch_sites WHERE company_id = $1 ORDER BY name`,
      [companyId],
    );
    return result.rows;
  }

  async createPunchSite(companyId, site) {
    await this.ensurePunchTables();
    const result = await this.query(
      `INSERT INTO punch_sites (company_id, name, latitude, longitude, radius_meters, active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, company_id, name, latitude, longitude, radius_meters, active`,
      [companyId, site.name, site.latitude, site.longitude, site.radiusMeters, site.active],
    );
    return result.rows[0];
  }

  async updatePunchSite(companyId, id, site) {
    await this.ensurePunchTables();
    const result = await this.query(
      `UPDATE punch_sites
       SET name = $3, latitude = $4, longitude = $5, radius_meters = $6, active = $7, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND company_id = $2
       RETURNING id, company_id, name, latitude, longitude, radius_meters, active`,
      [id, companyId, site.name, site.latitude, site.longitude, site.radiusMeters, site.active],
    );
    return result.rows[0] ?? null;
  }

  async shiftBounds(client, employeeId, attendanceDate) {
    const result = await client.query(`
      SELECT s.start_time, s.crosses_midnight
      FROM employee_shift_assignments a
      JOIN shifts s ON s.id = a.shift_id
      WHERE a.employee_id = $1
        AND a.effective_from <= $2::date
        AND (a.effective_to IS NULL OR a.effective_to >= $2::date)
      ORDER BY a.effective_from DESC
      LIMIT 1
    `, [employeeId, attendanceDate]);
    const row = result.rows[0];
    if (!row) return null;
    const start = String(row.start_time).slice(0, 5);
    if (!/^\d{2}:\d{2}$/.test(start)) return null;
    return { start, crossesMidnight: row.crosses_midnight === true };
  }

  async acceptPhonePunch(input) {
    await this.ensurePunchTables();
    let photoRelative = null;
    try {
      return await this.transaction(async (client) => {
        const ensured = await this.ensureWorkforceEmployee(client, {
          companyId: input.companyId,
          userId: input.userId,
          email: input.email,
          joinDate: jakartaClock(input.now).date,
        });
        if (!ensured.ok) return { status: ensured.status, body: { error: ensured.error } };
        const linked = ensured.employee;
        if (linked) {
          await client.query(`SELECT id FROM employees WHERE id = $1 AND company_id = $2 FOR UPDATE`, [linked.id, input.companyId]);
        }
        let receipt = null;
        if (linked) {
          const existing = await client.query(
            `SELECT status_code, body FROM punch_receipts WHERE company_id = $1 AND employee_id = $2 AND idempotency_key = $3`,
            [input.companyId, linked.id, String(input.idempotencyKey ?? "")],
          );
          if (existing.rows[0]) receipt = { status: existing.rows[0].status_code, body: existing.rows[0].body };
        }
        const clock = jakartaClock(input.now);
        const yesterday = previousDate(clock.date);
        const days = linked
          ? await client.query(
            `SELECT * FROM attendance WHERE company_id = $1 AND employee_id = $2 AND attendance_date IN ($3::date, $4::date)`,
            [input.companyId, linked.id, clock.date, yesterday],
          )
          : { rows: [] };
        const todayRow = days.rows.find((row) => String(row.attendance_date).slice(0, 10) === clock.date) ?? null;
        const previousRow = days.rows.find((row) => String(row.attendance_date).slice(0, 10) === yesterday) ?? null;
        const siteRows = await client.query(
          `SELECT id, name, latitude, longitude, radius_meters, active FROM punch_sites WHERE company_id = $1 AND active = true`,
          [input.companyId],
        );
        const leaveRows = linked
          ? await client.query(
            `SELECT start_date::text AS start_date, end_date::text AS end_date
             FROM leave_requests
             WHERE company_id = $1 AND employee_id = $2 AND status = 'APPROVED'
               AND end_date >= $3::date AND start_date <= $4::date`,
            [input.companyId, linked.id, yesterday, clock.date],
          )
          : { rows: [] };
        const attemptRows = linked
          ? await client.query(
            `SELECT count(*)::int AS count FROM punch_receipts
             WHERE company_id = $1 AND employee_id = $2 AND created_at >= $3`,
            [input.companyId, linked.id, jakartaDayStart(input.now).toISOString()],
          )
          : { rows: [{ count: 0 }] };
        const shiftsByDate = {};
        if (linked) {
          shiftsByDate[clock.date] = await this.shiftBounds(client, linked.id, clock.date);
          shiftsByDate[yesterday] = await this.shiftBounds(client, linked.id, yesterday);
        }
        const decision = planPhonePunch({
          now: input.now,
          workspace: input.workspace === "hr" ? "hr" : "self",
          employee: linked,
          photo: readPunchJpeg(input.photo),
          latitude: input.latitude,
          longitude: input.longitude,
          accuracy: input.accuracy,
          idempotencyKey: input.idempotencyKey,
          receipt,
          attemptCount: attemptRows.rows[0]?.count ?? 0,
          sites: siteRows.rows.map((row) => ({
            id: row.id,
            name: row.name,
            latitude: Number(row.latitude),
            longitude: Number(row.longitude),
            radiusMeters: Number(row.radius_meters),
            active: row.active !== false,
          })),
          leaves: leaveRows.rows.map((row) => ({ startDate: row.start_date, endDate: row.end_date })),
          todayRow,
          previousRow,
          shiftsByDate,
          offSiteDuty: input.offSiteDuty === true,
          offSiteLocationNote: input.offSiteLocationNote || "",
        });
        if (!decision.audit) return { status: decision.status, body: decision.body };
        let saved = null;
        if (decision.write) {
          photoRelative = punchPhotoRelative(input.companyId, linked.id, decision.write.attendanceDate, decision.write.side);
          const jpeg = readPunchJpeg(input.photo);
          if (!photoRelative || !jpeg.ok) return { status: 400, body: { error: "The punch is not valid." } };
          await writeStoredPhoto(punchPhotoRoot, photoRelative, jpeg.bytes);
          saved = await this.writePhoneDay(client, linked.id, input.companyId, photoRelative, decision.write);
          if (!saved) {
            await removeStoredPhoto(punchPhotoRoot, photoRelative);
            photoRelative = null;
            const clash = { status: 409, body: { error: "This day already has an attendance record." } };
            await this.storePunchReceipt(client, input.companyId, linked.id, input.idempotencyKey, clash);
            await this.storePunchAudit(client, input, { ...decision.audit, result: "rejected", reason: clash.body.error }, linked.id);
            return clash;
          }
        }
        const result = {
          status: decision.status,
          body: decision.write ? { ...decision.body, day: presentPunchDay(saved) } : decision.body,
        };
        if (linked && decision.audit.reason !== "idempotency") {
          await this.storePunchReceipt(client, input.companyId, linked.id, input.idempotencyKey, result);
          await this.storePunchAudit(client, input, decision.audit, saved?.id ?? linked.id);
        }
        return result;
      });
    } catch (error) {
      if (photoRelative) await removeStoredPhoto(punchPhotoRoot, photoRelative).catch(() => undefined);
      throw error;
    }
  }

  async writePhoneDay(client, employeeId, companyId, photoPath, write) {
    if (write.side === "in") {
      const result = await client.query(`
        INSERT INTO attendance (
          employee_id, attendance_date, clock_in, status, late_minutes, source, company_id,
          clock_in_photo_path, clock_in_lat, clock_in_lng, clock_in_accuracy_m,
          clock_in_site_id, clock_in_site_name, clock_in_at
        ) VALUES ($1, $2, $3, $4, $5, 'phone', $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (employee_id, attendance_date) DO UPDATE SET
          clock_in = EXCLUDED.clock_in,
          status = EXCLUDED.status,
          late_minutes = EXCLUDED.late_minutes,
          source = 'phone',
          clock_in_photo_path = EXCLUDED.clock_in_photo_path,
          clock_in_lat = EXCLUDED.clock_in_lat,
          clock_in_lng = EXCLUDED.clock_in_lng,
          clock_in_accuracy_m = EXCLUDED.clock_in_accuracy_m,
          clock_in_site_id = EXCLUDED.clock_in_site_id,
          clock_in_site_name = EXCLUDED.clock_in_site_name,
          clock_in_at = EXCLUDED.clock_in_at,
          updated_at = CURRENT_TIMESTAMP
        WHERE attendance.company_id = EXCLUDED.company_id
          AND (attendance.source IS NULL OR attendance.source = 'phone')
          AND attendance.clock_in IS NULL
        RETURNING *
      `, [
        employeeId, write.attendanceDate, write.clock, write.status, write.lateMinutes, companyId,
        photoPath, write.latitude, write.longitude, write.accuracy, write.siteId, write.siteName, write.at,
      ]);
      return result.rows[0] ?? null;
    }
    const result = await client.query(`
      UPDATE attendance SET
        clock_out = $3,
        clock_out_photo_path = $4,
        clock_out_lat = $5,
        clock_out_lng = $6,
        clock_out_accuracy_m = $7,
        clock_out_site_id = $8,
        clock_out_site_name = $9,
        clock_out_at = $10,
        updated_at = CURRENT_TIMESTAMP
      WHERE employee_id = $1 AND attendance_date = $2::date AND company_id = $11
        AND source = 'phone'
        AND clock_in IS NOT NULL
        AND clock_out IS NULL
      RETURNING *
    `, [
      employeeId, write.attendanceDate, write.clock, photoPath, write.latitude, write.longitude,
      write.accuracy, write.siteId, write.siteName, write.at, companyId,
    ]);
    return result.rows[0] ?? null;
  }

  async storePunchReceipt(client, companyId, employeeId, idempotencyKey, result) {
    await client.query(
      `INSERT INTO punch_receipts (company_id, employee_id, idempotency_key, status_code, body)
       VALUES ($1, $2, $3, $4, $5::jsonb)
       ON CONFLICT (company_id, employee_id, idempotency_key) DO NOTHING`,
      [companyId, employeeId, idempotencyKey, result.status, JSON.stringify(result.body)],
    );
  }

  async storePunchAudit(client, input, audit, entityId) {
    await client.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_value, new_value, reason, ip_address, company_id)
       VALUES (NULL, $1, 'Attendance', $2, NULL, $3::jsonb, $4, $5, $6)`,
      [
        audit.result === "recorded" ? "CREATE" : "REJECT",
        entityId,
        JSON.stringify({
          result: audit.result,
          reason: audit.reason,
          siteId: audit.siteId,
          employeeId: audit.employeeId,
          attendanceDate: audit.attendanceDate,
          side: audit.side,
        }),
        input.userId,
        input.ip ?? null,
        input.companyId,
      ],
    );
  }

  async myPunch(companyId, userId, email, now) {
    await this.ensurePunchTables();
    const ensured = await this.transaction((client) => this.ensureWorkforceEmployee(client, {
      companyId,
      userId,
      email,
      joinDate: jakartaClock(now).date,
    }));
    if (!ensured.ok) return { status: ensured.status, body: { error: ensured.error } };
    const clock = jakartaClock(now);
    const yesterday = previousDate(clock.date);
    const days = await this.query(
      `SELECT * FROM attendance WHERE company_id = $1 AND employee_id = $2 AND attendance_date IN ($3::date, $4::date)`,
      [companyId, ensured.employee.id, clock.date, yesterday],
    );
    const leaves = await this.query(
      `SELECT start_date::text AS start_date, end_date::text AS end_date
       FROM leave_requests
       WHERE company_id = $1 AND employee_id = $2 AND status = 'APPROVED'
         AND end_date >= $3::date AND start_date <= $4::date`,
      [companyId, ensured.employee.id, yesterday, clock.date],
    );
    return {
      status: 200,
      body: describeMine({
        now,
        todayRow: days.rows.find((row) => String(row.attendance_date).slice(0, 10) === clock.date) ?? null,
        previousRow: days.rows.find((row) => String(row.attendance_date).slice(0, 10) === yesterday) ?? null,
        leaves: leaves.rows.map((row) => ({ startDate: row.start_date, endDate: row.end_date })),
      }),
    };
  }

  async punchPhoto(companyId, attendanceId, side) {
    await this.ensurePunchTables();
    if (side !== "in" && side !== "out") return null;
    const column = side === "in" ? "clock_in_photo_path" : "clock_out_photo_path";
    const result = await this.query(
      `SELECT id, employee_id, company_id, ${column} AS photo_path FROM attendance WHERE id = $1 AND company_id = $2`,
      [attendanceId, companyId],
    );
    const row = result.rows[0];
    if (!row?.photo_path) return null;
    const bytes = await readStoredPhoto(punchPhotoRoot, row.photo_path);
    if (!bytes) return null;
    return { employeeId: row.employee_id, bytes };
  }

  async fileAttendanceCorrection(input) {
    await this.ensurePunchTables();
    const existing = await this.query(
      `SELECT id, status, source, clock_in, clock_out, late_minutes FROM attendance
       WHERE company_id = $1 AND employee_id = $2 AND attendance_date = $3::date`,
      [input.companyId, input.request.employeeId, input.request.attendanceDate],
    );
    const result = await this.query(
      `INSERT INTO attendance_corrections (
         company_id, employee_id, attendance_id, attendance_date, requested_value, original_value, reason, status, requested_by_user
       ) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, 'PENDING', $8)
       RETURNING id, status`,
      [
        input.companyId,
        input.request.employeeId,
        existing.rows[0]?.id ?? null,
        input.request.attendanceDate,
        JSON.stringify({ clock_in: input.request.clockIn, clock_out: input.request.clockOut }),
        JSON.stringify(existing.rows[0] ? { source: existing.rows[0].source, clock_in: existing.rows[0].clock_in, clock_out: existing.rows[0].clock_out } : {}),
        input.request.reason,
        input.userId,
      ],
    );
    return result.rows[0];
  }

  async listAttendanceCorrections(companyId) {
    await this.ensurePunchTables();
    const result = await this.query(
      `SELECT c.id, c.employee_id, c.attendance_date::text AS attendance_date, c.requested_value, c.reason, c.status,
              c.requested_by_user, e.employee_code, e.full_name
       FROM attendance_corrections c
       JOIN employees e ON e.id = c.employee_id AND e.company_id = c.company_id
       WHERE c.company_id = $1 AND c.status = 'PENDING'
       ORDER BY c.created_at DESC`,
      [companyId],
    );
    return result.rows;
  }

  async approveAttendanceCorrection(companyId, id, reviewerId) {
    await this.ensurePunchTables();
    return this.transaction(async (client) => {
      const found = await client.query(
        `SELECT * FROM attendance_corrections WHERE id = $1 AND company_id = $2 FOR UPDATE`,
        [id, companyId],
      );
      const row = found.rows[0];
      if (!row) return { status: 404, body: { error: "This correction is not pending." } };
      const requested = row.requested_value && typeof row.requested_value === "object" ? row.requested_value : {};
      const existingResult = await client.query(
        `SELECT * FROM attendance WHERE company_id = $1 AND employee_id = $2 AND attendance_date = $3::date FOR UPDATE`,
        [companyId, row.employee_id, row.attendance_date],
      );
      const existing = existingResult.rows[0] ?? null;
      const shift = await this.shiftBounds(client, row.employee_id, String(row.attendance_date).slice(0, 10));
      const decision = planCorrectionApproval({
        workspace: "hr",
        reviewerId,
        correction: {
          status: row.status,
          requestedBy: row.requested_by_user,
          employeeId: row.employee_id,
          attendanceDate: String(row.attendance_date).slice(0, 10),
          clockIn: requested.clock_in ?? null,
          clockOut: requested.clock_out ?? null,
        },
        existing,
        shift,
      });
      if (!decision.apply) return { status: decision.status, body: decision.body };
      const saved = await client.query(correctionAttendanceSql, [
        decision.apply.employeeId,
        decision.apply.attendanceDate,
        decision.apply.clockIn,
        decision.apply.clockOut,
        decision.apply.status,
        decision.apply.lateMinutes,
        companyId,
      ]);
      if (!saved.rows[0]) return { status: 409, body: { error: "This day already has an attendance record." } };
      await client.query(
        `UPDATE attendance_corrections
         SET status = 'APPROVED', reviewed_by_user = $3, approved_at = CURRENT_TIMESTAMP, attendance_id = $4
         WHERE id = $1 AND company_id = $2 AND status = 'PENDING'`,
        [id, companyId, reviewerId, saved.rows[0].id],
      );
      await client.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_value, new_value, reason, company_id)
         VALUES (NULL, 'UPDATE', 'Attendance', $1, $2::jsonb, $3::jsonb, $4, $5)`,
        [
          saved.rows[0].id,
          JSON.stringify({ source: existing?.source ?? null }),
          JSON.stringify({ result: "corrected", attendanceDate: decision.apply.attendanceDate, employeeId: decision.apply.employeeId }),
          reviewerId,
          companyId,
        ],
      );
      return { status: 200, body: { approved: true, attendance_id: saved.rows[0].id } };
    });
  }

  async deleteStaffTaskByExternal(companyId, externalId) {
    const result = await this.query(
      `DELETE FROM staff_tasks WHERE company_id = $1 AND external_id = $2 RETURNING id`,
      [companyId, externalId],
    );
    return result.rows[0]?.id ?? null;
  }

  async ensureEmployeeDocumentTables() {
    await this.query(`
      CREATE TABLE IF NOT EXISTS employee_documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id TEXT NOT NULL,
        employee_id UUID NOT NULL,
        document_type_name TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        mime_type TEXT NOT NULL,
        storage_path TEXT NOT NULL,
        verification_status TEXT NOT NULL DEFAULT 'PENDING',
        uploaded_by TEXT,
        uploaded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        verified_by TEXT,
        verified_at TIMESTAMPTZ,
        CONSTRAINT employee_documents_type_check CHECK (length(btrim(document_type_name)) BETWEEN 1 AND 80),
        CONSTRAINT employee_documents_name_check CHECK (length(btrim(file_name)) BETWEEN 1 AND 180),
        CONSTRAINT employee_documents_size_check CHECK (file_size > 0 AND file_size <= 8388608),
        CONSTRAINT employee_documents_status_check CHECK (verification_status IN ('PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED'))
      )
    `);
    await this.query(`
      CREATE INDEX IF NOT EXISTS employee_documents_employee_idx
      ON employee_documents (company_id, employee_id, uploaded_at DESC)
    `);
  }

  async listEmployeeDocuments(companyId, employeeId) {
    await this.ensureEmployeeDocumentTables();
    const result = await this.query(
      `SELECT id, company_id, employee_id, document_type_name, file_name, file_size, mime_type,
              verification_status, uploaded_by, uploaded_at, verified_by, verified_at
       FROM employee_documents
       WHERE company_id = $1 AND employee_id = $2
       ORDER BY uploaded_at DESC`,
      [companyId, employeeId],
    );
    return result.rows;
  }

  async getEmployeeDocument(companyId, documentId) {
    await this.ensureEmployeeDocumentTables();
    const result = await this.query(
      `SELECT id, company_id, employee_id, document_type_name, file_name, file_size, mime_type,
              storage_path, verification_status, uploaded_by, uploaded_at, verified_by, verified_at
       FROM employee_documents
       WHERE company_id = $1 AND id = $2`,
      [companyId, documentId],
    );
    return result.rows[0] ?? null;
  }

  async createEmployeeDocument(row) {
    await this.ensureEmployeeDocumentTables();
    const result = await this.query(
      `INSERT INTO employee_documents (
         id, company_id, employee_id, document_type_name, file_name, file_size, mime_type,
         storage_path, verification_status, uploaded_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING', $9)
       RETURNING id, company_id, employee_id, document_type_name, file_name, file_size, mime_type,
                 verification_status, uploaded_by, uploaded_at, verified_by, verified_at`,
      [
        row.id,
        row.company_id,
        row.employee_id,
        row.document_type_name,
        row.file_name,
        row.file_size,
        row.mime_type,
        row.storage_path,
        row.uploaded_by ?? null,
      ],
    );
    return result.rows[0];
  }

  async updateEmployeeDocumentStatus(companyId, documentId, status, reviewerId) {
    await this.ensureEmployeeDocumentTables();
    const result = await this.query(
      `UPDATE employee_documents
       SET verification_status = $3,
           verified_by = $4,
           verified_at = CURRENT_TIMESTAMP
       WHERE company_id = $1 AND id = $2
       RETURNING id, company_id, employee_id, document_type_name, file_name, file_size, mime_type,
                 verification_status, uploaded_by, uploaded_at, verified_by, verified_at`,
      [companyId, documentId, status, reviewerId],
    );
    return result.rows[0] ?? null;
  }

  async ensureEmployeePayrollConfigColumns() {
    await this.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS pay_type TEXT NOT NULL DEFAULT 'MONTHLY'`);
    await this.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS gross_fixed_salary BIGINT`);
    await this.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS basic_percentage INTEGER NOT NULL DEFAULT 60`);
    await this.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS daily_rate BIGINT`);
    await this.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS working_days_per_month INTEGER NOT NULL DEFAULT 22`);
    await this.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS housing_allowance BIGINT NOT NULL DEFAULT 0`);
    await this.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS transport_allowance BIGINT NOT NULL DEFAULT 0`);
    await this.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS attendance_allowance_per_day BIGINT NOT NULL DEFAULT 0`);
    await this.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS bpjs_kesehatan_enabled BOOLEAN NOT NULL DEFAULT TRUE`);
    await this.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS bpjs_tk_enabled BOOLEAN NOT NULL DEFAULT TRUE`);
    await this.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS bpjs_base TEXT NOT NULL DEFAULT 'BASIC'`);
    await this.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS tax_mode TEXT`);
    await this.query(`UPDATE employees SET tax_mode = CASE WHEN tax_configuration = 'gross' THEN 'EMPLOYEE' ELSE 'COMPANY' END WHERE tax_mode IS NULL`);
    await this.query(`ALTER TABLE employees ALTER COLUMN tax_mode SET DEFAULT 'COMPANY'`);
    await this.query(`UPDATE employees SET tax_mode = 'COMPANY' WHERE tax_mode IS NULL`);
    await this.query(`UPDATE employees SET gross_fixed_salary = gaji_pokok WHERE gross_fixed_salary IS NULL AND gaji_pokok IS NOT NULL`);
  }

  async ensurePayrollGlobalTables() {
    await this.query(`
      CREATE TABLE IF NOT EXISTS payroll_global_settings (
        company_id TEXT PRIMARY KEY,
        cutoff_start_day INTEGER NOT NULL DEFAULT 26,
        cutoff_end_day INTEGER NOT NULL DEFAULT 25,
        pay_day INTEGER NOT NULL DEFAULT 5,
        ot_weekday_first_bp INTEGER NOT NULL DEFAULT 15000,
        ot_weekday_next_bp INTEGER NOT NULL DEFAULT 20000,
        ot_holiday_first_bp INTEGER NOT NULL DEFAULT 20000,
        ot_holiday_eighth_bp INTEGER NOT NULL DEFAULT 30000,
        ot_holiday_after_bp INTEGER NOT NULL DEFAULT 40000,
        late_deduction_per_event BIGINT NOT NULL DEFAULT 0,
        service_charge_pay_day INTEGER NOT NULL DEFAULT 15,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await this.query(`
      CREATE TABLE IF NOT EXISTS bpjs_rate_sets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id TEXT NOT NULL,
        effective_from DATE NOT NULL,
        health_employee_bp INTEGER NOT NULL DEFAULT 100,
        health_employer_bp INTEGER NOT NULL DEFAULT 400,
        health_salary_cap BIGINT,
        jht_employee_bp INTEGER NOT NULL DEFAULT 200,
        jht_employer_bp INTEGER NOT NULL DEFAULT 370,
        jp_employee_bp INTEGER NOT NULL DEFAULT 100,
        jp_employer_bp INTEGER NOT NULL DEFAULT 200,
        jp_salary_cap BIGINT,
        jkk_bp INTEGER,
        jkm_bp INTEGER NOT NULL DEFAULT 30,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (company_id, effective_from)
      )
    `);
    await this.query(`
      CREATE TABLE IF NOT EXISTS payroll_runs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id TEXT NOT NULL,
        period_code TEXT NOT NULL,
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        current_version INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (company_id, period_code)
      )
    `);
    await this.query(`
      CREATE TABLE IF NOT EXISTS payroll_run_versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        run_id UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
        company_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        generated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        generated_by TEXT,
        warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
        rates_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
        settings_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
        UNIQUE (run_id, version)
      )
    `);
    await this.query(`
      CREATE TABLE IF NOT EXISTS payroll_run_lines (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        version_id UUID NOT NULL REFERENCES payroll_run_versions(id) ON DELETE CASCADE,
        company_id TEXT NOT NULL,
        employee_id UUID NOT NULL,
        employee_code TEXT NOT NULL,
        full_name TEXT NOT NULL,
        pay_type TEXT NOT NULL,
        detail JSONB NOT NULL,
        gross_earnings BIGINT NOT NULL DEFAULT 0,
        total_deductions BIGINT NOT NULL DEFAULT 0,
        take_home_pay BIGINT NOT NULL DEFAULT 0,
        company_tax_cost BIGINT NOT NULL DEFAULT 0,
        UNIQUE (version_id, employee_id)
      )
    `);
  }

  async ensureServiceChargeV2Tables() {
    await this.query(`
      CREATE TABLE IF NOT EXISTS service_charge_settings (
        company_id TEXT PRIMARY KEY,
        employee_pool_pct INTEGER NOT NULL DEFAULT 50,
        policy_basis TEXT,
        present_statuses JSONB NOT NULL DEFAULT '["PRESENT"]'::jsonb,
        eligible_contract_types JSONB NOT NULL DEFAULT '["PKWTT","PKWT"]'::jsonb,
        include_resigned_in_period BOOLEAN NOT NULL DEFAULT TRUE,
        tax_method TEXT NOT NULL DEFAULT 'FLAT',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await this.query(`
      CREATE TABLE IF NOT EXISTS service_charge_pool_defaults (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id TEXT NOT NULL,
        pool_key TEXT NOT NULL,
        label TEXT NOT NULL,
        pct INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0,
        UNIQUE (company_id, pool_key)
      )
    `);
    await this.query(`
      CREATE TABLE IF NOT EXISTS service_charge_months (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id TEXT NOT NULL,
        period_year INTEGER NOT NULL,
        period_month INTEGER NOT NULL,
        total_service_charge BIGINT NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'DRAFT',
        current_version INTEGER NOT NULL DEFAULT 0,
        pay_date DATE,
        published_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (company_id, period_year, period_month)
      )
    `);
    await this.query(`
      CREATE TABLE IF NOT EXISTS service_charge_month_versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        month_id UUID NOT NULL REFERENCES service_charge_months(id) ON DELETE CASCADE,
        company_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        status TEXT NOT NULL,
        generated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        generated_by TEXT,
        pools JSONB NOT NULL DEFAULT '[]'::jsonb,
        settings_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
        value_per_day BIGINT NOT NULL DEFAULT 0,
        total_days_present INTEGER NOT NULL DEFAULT 0,
        UNIQUE (month_id, version)
      )
    `);
    await this.query(`
      CREATE TABLE IF NOT EXISTS service_charge_month_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        version_id UUID NOT NULL REFERENCES service_charge_month_versions(id) ON DELETE CASCADE,
        company_id TEXT NOT NULL,
        employee_id UUID NOT NULL,
        employee_code TEXT NOT NULL,
        full_name TEXT NOT NULL,
        days_present INTEGER NOT NULL DEFAULT 0,
        gross BIGINT NOT NULL DEFAULT 0,
        pph21 BIGINT NOT NULL DEFAULT 0,
        net BIGINT NOT NULL DEFAULT 0,
        eligible BOOLEAN NOT NULL DEFAULT TRUE,
        UNIQUE (version_id, employee_id)
      )
    `);
    await this.query(`
      CREATE TABLE IF NOT EXISTS service_charge_audit_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id TEXT NOT NULL,
        month_id UUID,
        action TEXT NOT NULL,
        detail JSONB NOT NULL DEFAULT '{}'::jsonb,
        actor TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  async saveEmployeePayrollConfig(id, companyId, config) {
    await this.ensureEmployeePayrollConfigColumns();
    const result = await this.query(`
      UPDATE employees SET
        pay_type = $3,
        gross_fixed_salary = $4,
        basic_percentage = $5,
        daily_rate = $6,
        working_days_per_month = $7,
        housing_allowance = $8,
        transport_allowance = $9,
        attendance_allowance_per_day = $10,
        bpjs_kesehatan_enabled = $11,
        bpjs_tk_enabled = $12,
        bpjs_base = $13,
        bpjs_enrolled = $14,
        company_covers_employee_bpjs = $15,
        tax_mode = $16,
        tax_configuration = $17,
        gaji_pokok = COALESCE($4, gaji_pokok),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND company_id = $2
      RETURNING *
    `, [
      id,
      companyId,
      config.pay_type,
      config.gross_fixed_salary,
      config.basic_percentage,
      config.daily_rate,
      config.working_days_per_month,
      config.housing_allowance,
      config.transport_allowance,
      config.attendance_allowance_per_day,
      config.bpjs_kesehatan_enabled,
      config.bpjs_tk_enabled,
      config.bpjs_base,
      config.bpjs_enrolled,
      config.company_covers_employee_bpjs,
      config.tax_mode,
      config.tax_configuration,
    ]);
    return result.rows[0] ?? null;
  }

  async getPayrollGlobalSettings(companyId) {
    await this.ensurePayrollGlobalTables();
    const result = await this.query(`SELECT * FROM payroll_global_settings WHERE company_id = $1`, [companyId]);
    if (result.rows[0]) return result.rows[0];
    const inserted = await this.query(
      `INSERT INTO payroll_global_settings (company_id) VALUES ($1)
       ON CONFLICT (company_id) DO UPDATE SET company_id = EXCLUDED.company_id
       RETURNING *`,
      [companyId],
    );
    return inserted.rows[0];
  }

  async savePayrollGlobalSettings(companyId, settings) {
    await this.ensurePayrollGlobalTables();
    const result = await this.query(`
      INSERT INTO payroll_global_settings (
        company_id, cutoff_start_day, cutoff_end_day, pay_day,
        ot_weekday_first_bp, ot_weekday_next_bp, ot_holiday_first_bp, ot_holiday_eighth_bp, ot_holiday_after_bp,
        late_deduction_per_event, service_charge_pay_day, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,CURRENT_TIMESTAMP)
      ON CONFLICT (company_id) DO UPDATE SET
        cutoff_start_day = EXCLUDED.cutoff_start_day,
        cutoff_end_day = EXCLUDED.cutoff_end_day,
        pay_day = EXCLUDED.pay_day,
        ot_weekday_first_bp = EXCLUDED.ot_weekday_first_bp,
        ot_weekday_next_bp = EXCLUDED.ot_weekday_next_bp,
        ot_holiday_first_bp = EXCLUDED.ot_holiday_first_bp,
        ot_holiday_eighth_bp = EXCLUDED.ot_holiday_eighth_bp,
        ot_holiday_after_bp = EXCLUDED.ot_holiday_after_bp,
        late_deduction_per_event = EXCLUDED.late_deduction_per_event,
        service_charge_pay_day = EXCLUDED.service_charge_pay_day,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [
      companyId,
      settings.cutoff_start_day,
      settings.cutoff_end_day,
      settings.pay_day,
      settings.ot_weekday_first_bp,
      settings.ot_weekday_next_bp,
      settings.ot_holiday_first_bp,
      settings.ot_holiday_eighth_bp,
      settings.ot_holiday_after_bp,
      settings.late_deduction_per_event,
      settings.service_charge_pay_day,
    ]);
    return result.rows[0];
  }

  async getBpjsRateSet(companyId, asOfDate) {
    await this.ensurePayrollGlobalTables();
    const result = await this.query(
      `SELECT * FROM bpjs_rate_sets
       WHERE company_id = $1 AND effective_from <= $2::date
       ORDER BY effective_from DESC LIMIT 1`,
      [companyId, asOfDate],
    );
    return result.rows[0] ?? null;
  }

  async upsertBpjsRateSet(companyId, row) {
    await this.ensurePayrollGlobalTables();
    const result = await this.query(`
      INSERT INTO bpjs_rate_sets (
        company_id, effective_from, health_employee_bp, health_employer_bp, health_salary_cap,
        jht_employee_bp, jht_employer_bp, jp_employee_bp, jp_employer_bp, jp_salary_cap, jkk_bp, jkm_bp
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      ON CONFLICT (company_id, effective_from) DO UPDATE SET
        health_employee_bp = EXCLUDED.health_employee_bp,
        health_employer_bp = EXCLUDED.health_employer_bp,
        health_salary_cap = EXCLUDED.health_salary_cap,
        jht_employee_bp = EXCLUDED.jht_employee_bp,
        jht_employer_bp = EXCLUDED.jht_employer_bp,
        jp_employee_bp = EXCLUDED.jp_employee_bp,
        jp_employer_bp = EXCLUDED.jp_employer_bp,
        jp_salary_cap = EXCLUDED.jp_salary_cap,
        jkk_bp = EXCLUDED.jkk_bp,
        jkm_bp = EXCLUDED.jkm_bp
      RETURNING *
    `, [
      companyId,
      row.effective_from,
      row.health_employee_bp,
      row.health_employer_bp,
      row.health_salary_cap ?? null,
      row.jht_employee_bp,
      row.jht_employer_bp,
      row.jp_employee_bp,
      row.jp_employer_bp,
      row.jp_salary_cap ?? null,
      row.jkk_bp ?? null,
      row.jkm_bp,
    ]);
    return result.rows[0];
  }

  async listActiveEmployeesForPayroll(companyId) {
    await this.ensureEmployeePayrollConfigColumns();
    const result = await this.query(
      `SELECT * FROM employees
       WHERE company_id = $1
         AND (employment_status IS NULL OR upper(employment_status) IN ('ACTIVE','PROBATION'))
       ORDER BY employee_code`,
      [companyId],
    );
    return result.rows;
  }

  async createPayrollRunVersion(companyId, periodCode, periodStart, periodEnd, generatedBy, warnings, ratesSnapshot, settingsSnapshot, lines) {
    await this.ensurePayrollGlobalTables();
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const runUpsert = await client.query(
        `INSERT INTO payroll_runs (company_id, period_code, period_start, period_end, current_version)
         VALUES ($1,$2,$3,$4,0)
         ON CONFLICT (company_id, period_code) DO UPDATE SET
           period_start = EXCLUDED.period_start,
           period_end = EXCLUDED.period_end,
           updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [companyId, periodCode, periodStart, periodEnd],
      );
      const run = runUpsert.rows[0];
      const nextVersion = Number(run.current_version) + 1;
      const version = await client.query(
        `INSERT INTO payroll_run_versions (run_id, company_id, version, generated_by, warnings, rates_snapshot, settings_snapshot)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb)
         RETURNING *`,
        [
          run.id,
          companyId,
          nextVersion,
          generatedBy ?? null,
          JSON.stringify(warnings || []),
          JSON.stringify(ratesSnapshot || {}),
          JSON.stringify(settingsSnapshot || {}),
        ],
      );
      const versionRow = version.rows[0];
      for (const line of lines) {
        await client.query(
          `INSERT INTO payroll_run_lines (
             version_id, company_id, employee_id, employee_code, full_name, pay_type,
             detail, gross_earnings, total_deductions, take_home_pay, company_tax_cost
           ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11)`,
          [
            versionRow.id,
            companyId,
            line.employee_id,
            line.employee_code,
            line.full_name,
            line.pay_type,
            JSON.stringify(line.detail),
            line.gross_earnings,
            line.total_deductions,
            line.take_home_pay,
            line.company_tax_cost,
          ],
        );
      }
      await client.query(
        `UPDATE payroll_runs SET current_version = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [run.id, nextVersion],
      );
      await client.query("COMMIT");
      return { run_id: run.id, version: nextVersion, version_id: versionRow.id, warnings: warnings || [] };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getCurrentPayrollRun(companyId, periodCode) {
    await this.ensurePayrollGlobalTables();
    const run = await this.query(
      `SELECT * FROM payroll_runs WHERE company_id = $1 AND period_code = $2`,
      [companyId, periodCode],
    );
    if (!run.rows[0] || !run.rows[0].current_version) return null;
    const version = await this.query(
      `SELECT * FROM payroll_run_versions WHERE run_id = $1 AND version = $2`,
      [run.rows[0].id, run.rows[0].current_version],
    );
    if (!version.rows[0]) return null;
    const lines = await this.query(
      `SELECT * FROM payroll_run_lines WHERE version_id = $1 ORDER BY employee_code`,
      [version.rows[0].id],
    );
    return { run: run.rows[0], version: version.rows[0], lines: lines.rows };
  }

  async getServiceChargeSettings(companyId) {
    await this.ensureServiceChargeV2Tables();
    const result = await this.query(`SELECT * FROM service_charge_settings WHERE company_id = $1`, [companyId]);
    if (result.rows[0]) return result.rows[0];
    const inserted = await this.query(
      `INSERT INTO service_charge_settings (company_id) VALUES ($1)
       ON CONFLICT (company_id) DO UPDATE SET company_id = EXCLUDED.company_id
       RETURNING *`,
      [companyId],
    );
    const pools = await this.query(`SELECT * FROM service_charge_pool_defaults WHERE company_id = $1 ORDER BY sort_order`, [companyId]);
    if (pools.rows.length === 0) {
      await this.query(
        `INSERT INTO service_charge_pool_defaults (company_id, pool_key, label, pct, sort_order) VALUES
         ($1,'employee_pool','Employees',50,0),
         ($1,'breakage','Breakage',0,1),
         ($1,'hr_development','HR development',0,2),
         ($1,'company_other','Company other',0,3)
         ON CONFLICT DO NOTHING`,
        [companyId],
      );
    }
    return inserted.rows[0];
  }

  async saveServiceChargeSettings(companyId, settings, pools) {
    await this.ensureServiceChargeV2Tables();
    const result = await this.query(`
      INSERT INTO service_charge_settings (
        company_id, employee_pool_pct, policy_basis, present_statuses, eligible_contract_types,
        include_resigned_in_period, tax_method, updated_at
      ) VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7,CURRENT_TIMESTAMP)
      ON CONFLICT (company_id) DO UPDATE SET
        employee_pool_pct = EXCLUDED.employee_pool_pct,
        policy_basis = EXCLUDED.policy_basis,
        present_statuses = EXCLUDED.present_statuses,
        eligible_contract_types = EXCLUDED.eligible_contract_types,
        include_resigned_in_period = EXCLUDED.include_resigned_in_period,
        tax_method = EXCLUDED.tax_method,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [
      companyId,
      settings.employee_pool_pct,
      settings.policy_basis ?? null,
      JSON.stringify(settings.present_statuses || ["PRESENT"]),
      JSON.stringify(settings.eligible_contract_types || ["PKWTT", "PKWT"]),
      settings.include_resigned_in_period !== false,
      settings.tax_method || "FLAT",
    ]);
    if (Array.isArray(pools)) {
      await this.query(`DELETE FROM service_charge_pool_defaults WHERE company_id = $1`, [companyId]);
      let order = 0;
      for (const pool of pools) {
        await this.query(
          `INSERT INTO service_charge_pool_defaults (company_id, pool_key, label, pct, sort_order)
           VALUES ($1,$2,$3,$4,$5)`,
          [companyId, pool.pool_key, pool.label, pool.pct, order++],
        );
      }
    }
    return result.rows[0];
  }

  async listServiceChargePoolDefaults(companyId) {
    await this.ensureServiceChargeV2Tables();
    await this.getServiceChargeSettings(companyId);
    const result = await this.query(
      `SELECT * FROM service_charge_pool_defaults WHERE company_id = $1 ORDER BY sort_order`,
      [companyId],
    );
    return result.rows;
  }

  async createServiceChargeMonthVersion(companyId, year, month, total, status, generatedBy, pools, settingsSnapshot, valuePerDay, totalDays, items, payDate) {
    await this.ensureServiceChargeV2Tables();
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const monthUpsert = await client.query(
        `INSERT INTO service_charge_months (company_id, period_year, period_month, total_service_charge, status, pay_date)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (company_id, period_year, period_month) DO UPDATE SET
           total_service_charge = EXCLUDED.total_service_charge,
           pay_date = COALESCE(EXCLUDED.pay_date, service_charge_months.pay_date),
           updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [companyId, year, month, total, status, payDate ?? null],
      );
      const monthRow = monthUpsert.rows[0];
      if (monthRow.status === "PUBLISHED" && status === "DRAFT") {
        // regenerating draft after publish creates a new version but keeps published until republish
      }
      const nextVersion = Number(monthRow.current_version) + 1;
      const version = await client.query(
        `INSERT INTO service_charge_month_versions (
           month_id, company_id, version, status, generated_by, pools, settings_snapshot, value_per_day, total_days_present
         ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9)
         RETURNING *`,
        [
          monthRow.id,
          companyId,
          nextVersion,
          status,
          generatedBy ?? null,
          JSON.stringify(pools || []),
          JSON.stringify(settingsSnapshot || {}),
          valuePerDay,
          totalDays,
        ],
      );
      const versionRow = version.rows[0];
      for (const item of items) {
        await client.query(
          `INSERT INTO service_charge_month_items (
             version_id, company_id, employee_id, employee_code, full_name,
             days_present, gross, pph21, net, eligible
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            versionRow.id,
            companyId,
            item.employee_id,
            item.employee_code,
            item.full_name,
            item.days_present,
            item.gross,
            item.pph21,
            item.net,
            item.eligible !== false,
          ],
        );
      }
      const publishedAt = status === "PUBLISHED" ? new Date().toISOString() : null;
      await client.query(
        `UPDATE service_charge_months SET
           current_version = $2,
           status = CASE WHEN $3 = 'PUBLISHED' THEN 'PUBLISHED' ELSE status END,
           published_at = CASE WHEN $3 = 'PUBLISHED' THEN COALESCE(published_at, $4::timestamptz) ELSE published_at END,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [monthRow.id, nextVersion, status, publishedAt],
      );
      await client.query(
        `INSERT INTO service_charge_audit_log (company_id, month_id, action, detail, actor)
         VALUES ($1,$2,$3,$4::jsonb,$5)`,
        [companyId, monthRow.id, status === "PUBLISHED" ? "PUBLISH" : "GENERATE", JSON.stringify({ version: nextVersion, total }), generatedBy ?? null],
      );
      await client.query("COMMIT");
      return { month_id: monthRow.id, version: nextVersion, version_id: versionRow.id };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getCurrentServiceChargeMonth(companyId, year, month) {
    await this.ensureServiceChargeV2Tables();
    const monthRow = await this.query(
      `SELECT * FROM service_charge_months WHERE company_id = $1 AND period_year = $2 AND period_month = $3`,
      [companyId, year, month],
    );
    if (!monthRow.rows[0] || !monthRow.rows[0].current_version) return null;
    const version = await this.query(
      `SELECT * FROM service_charge_month_versions WHERE month_id = $1 AND version = $2`,
      [monthRow.rows[0].id, monthRow.rows[0].current_version],
    );
    if (!version.rows[0]) return null;
    const items = await this.query(
      `SELECT * FROM service_charge_month_items WHERE version_id = $1 ORDER BY employee_code`,
      [version.rows[0].id],
    );
    return { month: monthRow.rows[0], version: version.rows[0], items: items.rows };
  }
}

// Export singleton instance
export const db = new DatabaseService();
