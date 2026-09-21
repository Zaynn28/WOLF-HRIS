import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

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
      await callback(client);
      await client.query('COMMIT');
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

  async getAllEmployees() {
    const result = await this.query(`
      SELECT e.*, d.name as department_name, p.title as position_title
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN positions p ON e.position_id = p.id
      ORDER BY e.full_name
    `);
    return result.rows;
  }

  async getEmployeeById(id) {
    const result = await this.query(`
      SELECT e.*, d.name as department_name, p.title as position_title
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN positions p ON e.position_id = p.id
      WHERE e.id = $1
    `, [id]);
    return result.rows[0];
  }

  async createEmployee(data) {
    const result = await this.query(`
      INSERT INTO employees (
        employee_code, full_name, preferred_name, nik, npwp, date_of_birth,
        gender, phone, email, address, emergency_contact_name, emergency_contact_phone,
        department_id, position_id, employment_status, join_date, bank_name,
        bank_account_number, bank_account_name
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
      ) RETURNING *
    `, [
      data.employee_code, data.full_name, data.preferred_name, data.nik, data.npwp,
      data.date_of_birth, data.gender, data.phone, data.email, data.address,
      data.emergency_contact_name, data.emergency_contact_phone, data.department_id,
      data.position_id, data.employment_status, data.join_date, data.bank_name,
      data.bank_account_number, data.bank_account_name
    ]);
    return result.rows[0];
  }

  async updateEmployee(id, data) {
    const result = await this.query(`
      UPDATE employees SET
        full_name = $1, preferred_name = $2, nik = $3, npwp = $4, date_of_birth = $5,
        gender = $6, phone = $7, email = $8, address = $9, emergency_contact_name = $10,
        emergency_contact_phone = $11, department_id = $12, position_id = $13,
        employment_status = $14, bank_name = $15, bank_account_number = $16,
        bank_account_name = $17, updated_at = CURRENT_TIMESTAMP
      WHERE id = $18 RETURNING *
    `, [
      data.full_name, data.preferred_name, data.nik, data.npwp, data.date_of_birth,
      data.gender, data.phone, data.email, data.address, data.emergency_contact_name,
      data.emergency_contact_phone, data.department_id, data.position_id,
      data.employment_status, data.bank_name, data.bank_account_number,
      data.bank_account_name, id
    ]);
    return result.rows[0];
  }

  async deleteEmployee(id) {
    await this.query('DELETE FROM employees WHERE id = $1', [id]);
  }

  // ============================================
  // DEPARTMENT OPERATIONS
  // ============================================

  async getAllDepartments() {
    const result = await this.query('SELECT * FROM departments ORDER BY name');
    return result.rows;
  }

  async createDepartment(data) {
    const result = await this.query(`
      INSERT INTO departments (code, name, description, parent_department_id, manager_employee_id)
      VALUES ($1, $2, $3, $4, $5) RETURNING *
    `, [data.code, data.name, data.description, data.parent_department_id, data.manager_employee_id]);
    return result.rows[0];
  }

  // ============================================
  // ATTENDANCE OPERATIONS
  // ============================================

  async getAttendanceByDate(date) {
    const result = await this.query(`
      SELECT a.*, e.full_name, e.employee_code, s.name as shift_name
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      LEFT JOIN shifts s ON a.shift_id = s.id
      WHERE a.attendance_date = $1
      ORDER BY e.full_name
    `, [date]);
    return result.rows;
  }

  async createAttendance(data) {
    const result = await this.query(`
      INSERT INTO attendance (
        employee_id, attendance_date, shift_id, clock_in, clock_out, status,
        late_minutes, early_leave_minutes, overtime_minutes, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (employee_id, attendance_date) DO UPDATE SET
        clock_in = EXCLUDED.clock_in,
        clock_out = EXCLUDED.clock_out,
        status = EXCLUDED.status,
        late_minutes = EXCLUDED.late_minutes,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [
      data.employee_id, data.attendance_date, data.shift_id, data.clock_in,
      data.clock_out, data.status, data.late_minutes, data.early_leave_minutes,
      data.overtime_minutes, data.notes
    ]);
    return result.rows[0];
  }

  // ============================================
  // LEAVE OPERATIONS
  // ============================================

  async getLeaveRequests(filters) {
    let query = `
      SELECT lr.*, e.full_name, e.employee_code, lt.name as leave_type_name
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      JOIN leave_types lt ON lr.leave_type_id = lt.id
    `;
    
    const params = [];
    if (filters?.status) {
      query += ' WHERE lr.status = $1';
      params.push(filters.status);
    }
    
    query += ' ORDER BY lr.submitted_at DESC';
    
    const result = await this.query(query, params);
    return result.rows;
  }

  async createLeaveRequest(data) {
    const result = await this.query(`
      INSERT INTO leave_requests (
        employee_id, leave_type_id, start_date, end_date, total_days, reason, status
      ) VALUES ($1, $2, $3, $4, $5, $6, 'PENDING') RETURNING *
    `, [data.employee_id, data.leave_type_id, data.start_date, data.end_date, data.total_days, data.reason]);
    return result.rows[0];
  }

  async approveLeaveRequest(id, approvedBy) {
    const result = await this.query(`
      UPDATE leave_requests 
      SET status = 'APPROVED', approved_by = $1, approved_at = CURRENT_TIMESTAMP
      WHERE id = $2 RETURNING *
    `, [approvedBy, id]);
    return result.rows[0];
  }

  // ============================================
  // PAYROLL OPERATIONS
  // ============================================

  async getPayrollPeriods() {
    const result = await this.query('SELECT * FROM payroll_periods ORDER BY start_date DESC');
    return result.rows;
  }

  async createPayrollPeriod(data) {
    const result = await this.query(`
      INSERT INTO payroll_periods (period_code, start_date, end_date, pay_date, status, created_by)
      VALUES ($1, $2, $3, $4, 'DRAFT', $5) RETURNING *
    `, [data.period_code, data.start_date, data.end_date, data.pay_date, data.created_by]);
    return result.rows[0];
  }

  async getPayrollRecords(periodId) {
    const result = await this.query(`
      SELECT pr.*, e.full_name, e.employee_code, d.name as department_name
      FROM payroll_records pr
      JOIN employees e ON pr.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE pr.payroll_period_id = $1
      ORDER BY e.full_name
    `, [periodId]);
    return result.rows;
  }

  // ============================================
  // AUDIT LOG OPERATIONS
  // ============================================

  async createAuditLog(data) {
    const result = await this.query(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_value, new_value, reason, ip_address)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
    `, [
      data.user_id, data.action, data.entity_type, data.entity_id,
      data.old_value ? JSON.stringify(data.old_value) : null,
      data.new_value ? JSON.stringify(data.new_value) : null,
      data.reason, data.ip_address
    ]);
    return result.rows[0];
  }

  async getAuditLogs(filters) {
    let query = `
      SELECT al.*, u.full_name as user_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
    `;
    
    const params = [];
    const conditions = [];
    
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
}

// Export singleton instance
export const db = new DatabaseService();
