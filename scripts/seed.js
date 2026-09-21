#!/usr/bin/env node

/**
 * ATRIUM HRIS - Database Seed Script
 * 
 * This script seeds the PostgreSQL database with initial data from mockData.ts
 * Run with: node scripts/seed.js
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

dotenv.config();

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'atrium_hris',
  user: process.env.DB_USER || 'atrium_user',
  password: process.env.DB_PASSWORD || '',
};

// Import mock data
const mockData = {
  departments: [
    { code: 'F&B', name: 'Food & Beverage', description: 'Restaurant, bar, and banquet operations' },
    { code: 'HK', name: 'Housekeeping', description: 'Room cleaning and public area maintenance' },
    { code: 'FO', name: 'Front Office', description: 'Reception, concierge, and guest services' },
    { code: 'ENG', name: 'Engineering', description: 'Building maintenance and technical operations' },
    { code: 'HR', name: 'Human Resources', description: 'HR administration and employee relations' },
    { code: 'FIN', name: 'Finance', description: 'Accounting, procurement, and financial control' },
    { code: 'SEC', name: 'Security', description: 'Hotel security and safety operations' },
    { code: 'REV', name: 'Revenue Management', description: 'Pricing, distribution, and revenue optimization' },
  ],
  positions: [
    { code: 'F&B-MGR', title: 'F&B Manager', departmentCode: 'F&B', grade: 'M2', description: 'Manages F&B operations' },
    { code: 'F&B-SRV', title: 'F&B Service Staff', departmentCode: 'F&B', grade: 'S1', description: 'Restaurant service' },
    { code: 'HK-SUP', title: 'Housekeeping Supervisor', departmentCode: 'HK', grade: 'S2', description: 'Supervises housekeeping team' },
    { code: 'HK-ATT', title: 'Room Attendant', departmentCode: 'HK', grade: 'S1', description: 'Room cleaning' },
    { code: 'FO-RCV', title: 'Receptionist', departmentCode: 'FO', grade: 'S1', description: 'Front desk operations' },
    { code: 'FO-MGR', title: 'Front Office Manager', departmentCode: 'FO', grade: 'M2', description: 'Manages front office' },
    { code: 'ENG-TEC', title: 'Maintenance Technician', departmentCode: 'ENG', grade: 'S1', description: 'Technical maintenance' },
    { code: 'HR-STF', title: 'HR Staff', departmentCode: 'HR', grade: 'S2', description: 'HR administration' },
    { code: 'SEC-GRD', title: 'Security Guard', departmentCode: 'SEC', grade: 'S1', description: 'Security patrol' },
    { code: 'FIN-ACC', title: 'Accountant', departmentCode: 'FIN', grade: 'S2', description: 'Financial accounting' },
  ],
  employees: [
    {
      employeeCode: 'EMP-001', fullName: 'Ahmad Wijaya', preferredName: 'Ahmad',
      nik: '3201010101900001', npwp: '01.234.567.8-012.000',
      dateOfBirth: '1990-01-15', gender: 'M', phone: '+6281234567890',
      email: 'ahmad.wijaya@hotel.com', address: 'Jl. Sudirman No. 12, Jakarta',
      emergencyContactName: 'Siti Wijaya', emergencyContactPhone: '+6281234567891',
      departmentCode: 'F&B', positionCode: 'F&B-MGR', employmentStatus: 'ACTIVE',
      joinDate: '2020-03-01', bankName: 'BCA', bankAccountNumber: '1234567890',
      bankAccountName: 'Ahmad Wijaya'
    },
    {
      employeeCode: 'EMP-002', fullName: 'Dewi Lestari', preferredName: 'Dewi',
      nik: '3201010102920002', npwp: '02.345.678.9-012.000',
      dateOfBirth: '1992-05-22', gender: 'F', phone: '+6281234567892',
      email: 'dewi.lestari@hotel.com', address: 'Jl. Gatot Subroto No. 5, Jakarta',
      emergencyContactName: 'Budi Lestari', emergencyContactPhone: '+6281234567893',
      departmentCode: 'HK', positionCode: 'HK-SUP', employmentStatus: 'ACTIVE',
      joinDate: '2019-07-15', bankName: 'Mandiri', bankAccountNumber: '2345678901',
      bankAccountName: 'Dewi Lestari'
    },
    {
      employeeCode: 'EMP-003', fullName: 'Budi Santoso', preferredName: 'Budi',
      nik: '3201010103880003', npwp: '03.456.789.0-012.000',
      dateOfBirth: '1988-11-08', gender: 'M', phone: '+6281234567894',
      email: 'budi.santoso@hotel.com', address: 'Jl. Thamrin No. 20, Jakarta',
      emergencyContactName: 'Rina Santoso', emergencyContactPhone: '+6281234567895',
      departmentCode: 'FO', positionCode: 'FO-MGR', employmentStatus: 'ACTIVE',
      joinDate: '2018-01-10', bankName: 'BNI', bankAccountNumber: '3456789012',
      bankAccountName: 'Budi Santoso'
    },
    {
      employeeCode: 'EMP-004', fullName: 'Sari Rahayu', preferredName: 'Sari',
      nik: '3201010104950004', npwp: '04.567.890.1-012.000',
      dateOfBirth: '1995-03-18', gender: 'F', phone: '+6281234567896',
      email: 'sari.rahayu@hotel.com', address: 'Jl. Kuningan No. 8, Jakarta',
      emergencyContactName: 'Agus Rahayu', emergencyContactPhone: '+6281234567897',
      departmentCode: 'F&B', positionCode: 'F&B-SRV', employmentStatus: 'ACTIVE',
      joinDate: '2022-06-01', bankName: 'BCA', bankAccountNumber: '4567890123',
      bankAccountName: 'Sari Rahayu'
    },
    {
      employeeCode: 'EMP-005', fullName: 'Rudi Hermawan', preferredName: 'Rudi',
      nik: '3201010105910005', npwp: '05.678.901.2-012.000',
      dateOfBirth: '1991-09-30', gender: 'M', phone: '+6281234567898',
      email: 'rudi.hermawan@hotel.com', address: 'Jl. Rasuna Said No. 15, Jakarta',
      emergencyContactName: 'Maya Hermawan', emergencyContactPhone: '+6281234567899',
      departmentCode: 'ENG', positionCode: 'ENG-TEC', employmentStatus: 'ACTIVE',
      joinDate: '2021-02-14', bankName: 'BRI', bankAccountNumber: '5678901234',
      bankAccountName: 'Rudi Hermawan'
    },
    {
      employeeCode: 'EMP-006', fullName: 'Linda Kusuma', preferredName: 'Linda',
      nik: '3201010106930006', npwp: '06.789.012.3-012.000',
      dateOfBirth: '1993-07-12', gender: 'F', phone: '+6281234567900',
      email: 'linda.kusuma@hotel.com', address: 'Jl. Casablanca No. 3, Jakarta',
      emergencyContactName: 'Toni Kusuma', emergencyContactPhone: '+6281234567901',
      departmentCode: 'HK', positionCode: 'HK-ATT', employmentStatus: 'ACTIVE',
      joinDate: '2023-01-09', bankName: 'BCA', bankAccountNumber: '6789012345',
      bankAccountName: 'Linda Kusuma'
    },
    {
      employeeCode: 'EMP-007', fullName: 'Hendra Pratama', preferredName: 'Hendra',
      nik: '3201010107870007', npwp: '07.890.123.4-012.000',
      dateOfBirth: '1987-12-25', gender: 'M', phone: '+6281234567902',
      email: 'hendra.pratama@hotel.com', address: 'Jl. HR Rasuna Said No. 7, Jakarta',
      emergencyContactName: 'Diana Pratama', emergencyContactPhone: '+6281234567903',
      departmentCode: 'SEC', positionCode: 'SEC-GRD', employmentStatus: 'ACTIVE',
      joinDate: '2019-11-20', bankName: 'Mandiri', bankAccountNumber: '7890123456',
      bankAccountName: 'Hendra Pratama'
    },
    {
      employeeCode: 'EMP-008', fullName: 'Nina Marlina', preferredName: 'Nina',
      nik: '3201010108940008', npwp: '08.901.234.5-012.000',
      dateOfBirth: '1994-04-05', gender: 'F', phone: '+6281234567904',
      email: 'nina.marlina@hotel.com', address: 'Jl. Sudirman No. 45, Jakarta',
      emergencyContactName: 'Rudi Marlina', emergencyContactPhone: '+6281234567905',
      departmentCode: 'FO', positionCode: 'FO-RCV', employmentStatus: 'ACTIVE',
      joinDate: '2022-09-01', bankName: 'BCA', bankAccountNumber: '8901234567',
      bankAccountName: 'Nina Marlina'
    },
    {
      employeeCode: 'EMP-009', fullName: 'Tono Wibisono', preferredName: 'Tono',
      nik: '3201010109890009', npwp: '09.012.345.6-012.000',
      dateOfBirth: '1989-08-17', gender: 'M', phone: '+6281234567906',
      email: 'tono.wibisono@hotel.com', address: 'Jl. Gatot Subroto No. 10, Jakarta',
      emergencyContactName: 'Ratna Wibisono', emergencyContactPhone: '+6281234567907',
      departmentCode: 'FIN', positionCode: 'FIN-ACC', employmentStatus: 'ACTIVE',
      joinDate: '2020-05-15', bankName: 'BNI', bankAccountNumber: '9012345678',
      bankAccountName: 'Tono Wibisono'
    },
    {
      employeeCode: 'EMP-010', fullName: 'Maya Anggraini', preferredName: 'Maya',
      nik: '3201010110960010', npwp: '10.123.456.7-012.000',
      dateOfBirth: '1996-02-28', gender: 'F', phone: '+6281234567908',
      email: 'maya.anggraini@hotel.com', address: 'Jl. Thamrin No. 30, Jakarta',
      emergencyContactName: 'Joko Anggraini', emergencyContactPhone: '+6281234567909',
      departmentCode: 'HR', positionCode: 'HR-STF', employmentStatus: 'PROBATION',
      joinDate: '2025-11-01', bankName: 'BCA', bankAccountNumber: '0123456789',
      bankAccountName: 'Maya Anggraini'
    },
  ],
  users: [
    { email: 'admin@atrium.hr', password: 'admin123', fullName: 'Admin HR', role: 'HR_ADMIN' },
    { email: 'payroll@atrium.hr', password: 'payroll123', fullName: 'Tono Wibisono', role: 'PAYROLL' },
    { email: 'supervisor@atrium.hr', password: 'super123', fullName: 'Ahmad Wijaya', role: 'SUPERVISOR' },
    { email: 'employee@atrium.hr', password: 'emp123', fullName: 'Sari Rahayu', role: 'EMPLOYEE' },
    { email: 'gm@atrium.hr', password: 'gm123', fullName: 'General Manager', role: 'GENERAL_MANAGER' },
    { email: 'finance@atrium.hr', password: 'fin123', fullName: 'Financial Controller', role: 'FINANCIAL_CONTROLLER' },
  ],
};

async function seed() {
  const pool = new Pool(config);
  
  try {
    console.log('🌱 Starting database seed...\n');
    console.log(`📍 Connecting to: ${config.host}:${config.port}/${config.database}\n`);
    
    const client = await pool.connect();
    console.log('✅ Connected to database\n');

    // Clear existing data (in correct order to respect foreign keys)
    console.log('🗑️  Clearing existing data...');
    await client.query('DELETE FROM audit_logs');
    await client.query('DELETE FROM notifications');
    await client.query('DELETE FROM payroll_items');
    await client.query('DELETE FROM payroll_records');
    await client.query('DELETE FROM payroll_periods');
    await client.query('DELETE FROM overtime_requests');
    await client.query('DELETE FROM leave_balances');
    await client.query('DELETE FROM leave_requests');
    await client.query('DELETE FROM attendance_corrections');
    await client.query('DELETE FROM attendance');
    await client.query('DELETE FROM employee_shift_assignments');
    await client.query('DELETE FROM employee_documents');
    await client.query('DELETE FROM employment_contracts');
    await client.query('DELETE FROM employees');
    await client.query('DELETE FROM positions');
    await client.query('DELETE FROM departments');
    await client.query('DELETE FROM user_roles');
    await client.query('DELETE FROM users');
    console.log('✅ Existing data cleared\n');

    // Seed departments
    console.log('📦 Seeding departments...');
    const departmentMap = new Map();
    for (const dept of mockData.departments) {
      const id = uuidv4();
      await client.query(
        `INSERT INTO departments (id, code, name, description, is_active) 
         VALUES ($1, $2, $3, $4, true)`,
        [id, dept.code, dept.name, dept.description]
      );
      departmentMap.set(dept.code, id);
    }
    console.log(`✅ ${mockData.departments.length} departments created\n`);

    // Seed positions
    console.log('📦 Seeding positions...');
    const positionMap = new Map();
    for (const pos of mockData.positions) {
      const id = uuidv4();
      const deptId = departmentMap.get(pos.departmentCode);
      await client.query(
        `INSERT INTO positions (id, code, title, department_id, grade, description, is_active) 
         VALUES ($1, $2, $3, $4, $5, $6, true)`,
        [id, pos.code, pos.title, deptId, pos.grade, pos.description]
      );
      positionMap.set(pos.code, id);
    }
    console.log(`✅ ${mockData.positions.length} positions created\n`);

    // Seed employees
    console.log('📦 Seeding employees...');
    const employeeMap = new Map();
    for (const emp of mockData.employees) {
      const id = uuidv4();
      const deptId = departmentMap.get(emp.departmentCode);
      const posId = positionMap.get(emp.positionCode);
      
      await client.query(
        `INSERT INTO employees (
          id, employee_code, full_name, preferred_name, nik, npwp, date_of_birth,
          gender, phone, email, address, emergency_contact_name, emergency_contact_phone,
          department_id, position_id, employment_status, join_date, bank_name,
          bank_account_number, bank_account_name
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
        )`,
        [
          id, emp.employeeCode, emp.fullName, emp.preferredName, emp.nik, emp.npwp,
          emp.dateOfBirth, emp.gender, emp.phone, emp.email, emp.address,
          emp.emergencyContactName, emp.emergencyContactPhone, deptId, posId,
          emp.employmentStatus, emp.joinDate, emp.bankName, emp.bankAccountNumber,
          emp.bankAccountName
        ]
      );
      employeeMap.set(emp.employeeCode, id);
    }
    console.log(`✅ ${mockData.employees.length} employees created\n`);

    // Seed users
    console.log('📦 Seeding users...');
    const userMap = new Map();
    for (const user of mockData.users) {
      const id = uuidv4();
      const passwordHash = await bcrypt.hash(user.password, 10);
      
      await client.query(
        `INSERT INTO users (id, email, password_hash, full_name, is_active) 
         VALUES ($1, $2, $3, $4, true)`,
        [id, user.email, passwordHash, user.fullName]
      );
      
      // Get role ID
      const roleResult = await client.query(
        `SELECT id FROM roles WHERE name = $1`,
        [user.role]
      );
      
      if (roleResult.rows.length > 0) {
        await client.query(
          `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`,
          [id, roleResult.rows[0].id]
        );
      }
      
      userMap.set(user.email, id);
    }
    console.log(`✅ ${mockData.users.length} users created\n`);

    // Summary
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🎉 Database seeded successfully!');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    console.log('📊 Summary:');
    console.log(`   • ${mockData.departments.length} departments`);
    console.log(`   • ${mockData.positions.length} positions`);
    console.log(`   • ${mockData.employees.length} employees`);
    console.log(`   • ${mockData.users.length} users`);
    console.log(`   • ${departmentMap.size} department IDs mapped`);
    console.log(`   • ${positionMap.size} position IDs mapped`);
    console.log(`   • ${employeeMap.size} employee IDs mapped\n`);

    console.log('👤 Demo Users:');
    for (const user of mockData.users) {
      console.log(`   • ${user.email} (${user.role}) - Password: ${user.password}`);
    }
    
    console.log('\n📝 Next steps:');
    console.log('   1. Start the API server: node server/index.js');
    console.log('   2. Start the frontend: npm run dev');
    console.log('   3. Open http://localhost:5173 in your browser');
    console.log('   4. Login with any demo user above\n');

    client.release();

  } catch (error) {
    console.error('\n❌ Seed failed!\n');
    console.error('Error:', error.message);
    console.error('\n💡 Make sure you have run the migration first:');
    console.error('   node scripts/migrate.js\n');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
