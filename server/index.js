import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { db } from './database.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ============================================
// HEALTH CHECK
// ============================================

app.get('/api/health', async (req, res) => {
  try {
    const connected = await db.testConnection();
    res.json({ 
      status: 'ok', 
      database: connected ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ============================================
// EMPLOYEES API
// ============================================

app.get('/api/employees', async (req, res) => {
  try {
    const employees = await db.getAllEmployees();
    res.json(employees);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/employees/:id', async (req, res) => {
  try {
    const employee = await db.getEmployeeById(req.params.id);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    res.json(employee);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/employees', async (req, res) => {
  try {
    const employee = await db.createEmployee(req.body);
    
    // Log audit
    await db.createAuditLog({
      user_id: req.body.created_by,
      action: 'CREATE',
      entity_type: 'Employee',
      entity_id: employee.id,
      new_value: { employee_code: employee.employee_code, full_name: employee.full_name },
      ip_address: req.ip
    });
    
    res.status(201).json(employee);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/employees/:id', async (req, res) => {
  try {
    const employee = await db.updateEmployee(req.params.id, req.body);
    
    // Log audit
    await db.createAuditLog({
      user_id: req.body.updated_by,
      action: 'UPDATE',
      entity_type: 'Employee',
      entity_id: req.params.id,
      new_value: req.body,
      ip_address: req.ip
    });
    
    res.json(employee);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/employees/:id', async (req, res) => {
  try {
    await db.deleteEmployee(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// DEPARTMENTS API
// ============================================

app.get('/api/departments', async (req, res) => {
  try {
    const departments = await db.getAllDepartments();
    res.json(departments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/departments', async (req, res) => {
  try {
    const department = await db.createDepartment(req.body);
    res.status(201).json(department);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ATTENDANCE API
// ============================================

app.get('/api/attendance/:date', async (req, res) => {
  try {
    const attendance = await db.getAttendanceByDate(req.params.date);
    res.json(attendance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/attendance', async (req, res) => {
  try {
    const attendance = await db.createAttendance(req.body);
    res.status(201).json(attendance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// LEAVE API
// ============================================

app.get('/api/leave-requests', async (req, res) => {
  try {
    const requests = await db.getLeaveRequests(req.query);
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/leave-requests', async (req, res) => {
  try {
    const request = await db.createLeaveRequest(req.body);
    res.status(201).json(request);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/leave-requests/:id/approve', async (req, res) => {
  try {
    const request = await db.approveLeaveRequest(req.params.id, req.body.approved_by);
    res.json(request);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// PAYROLL API
// ============================================

app.get('/api/payroll-periods', async (req, res) => {
  try {
    const periods = await db.getPayrollPeriods();
    res.json(periods);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/payroll-periods', async (req, res) => {
  try {
    const period = await db.createPayrollPeriod(req.body);
    res.status(201).json(period);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/payroll-records/:periodId', async (req, res) => {
  try {
    const records = await db.getPayrollRecords(req.params.periodId);
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// AUDIT LOGS API
// ============================================

app.get('/api/audit-logs', async (req, res) => {
  try {
    const logs = await db.getAuditLogs(req.query);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ERROR HANDLING
// ============================================

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🚀 ATRIUM HRIS API Server                              ║
║                                                           ║
║   Server running on: http://localhost:${PORT}              ║
║   Database: PostgreSQL                                    ║
║   Environment: ${process.env.NODE_ENV || 'development'}                           ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

export default app;
