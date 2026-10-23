-- ATRIUM HRIS Database Schema
-- PostgreSQL 16+

-- Drop tables if they exist (for clean migration)
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS payslips CASCADE;
DROP TABLE IF EXISTS payroll_items CASCADE;
DROP TABLE IF EXISTS payroll_records CASCADE;
DROP TABLE IF EXISTS payroll_periods CASCADE;
DROP TABLE IF EXISTS overtime_requests CASCADE;
DROP TABLE IF EXISTS leave_balances CASCADE;
DROP TABLE IF EXISTS leave_requests CASCADE;
DROP TABLE IF EXISTS leave_types CASCADE;
DROP TABLE IF EXISTS attendance_corrections CASCADE;
DROP TABLE IF EXISTS attendance CASCADE;
DROP TABLE IF EXISTS employee_shift_assignments CASCADE;
DROP TABLE IF EXISTS shifts CASCADE;
DROP TABLE IF EXISTS employee_documents CASCADE;
DROP TABLE IF EXISTS document_types CASCADE;
DROP TABLE IF EXISTS employment_contracts CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS positions CASCADE;
DROP TABLE IF EXISTS departments CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS role_permissions CASCADE;
DROP TABLE IF EXISTS permissions CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ============================================
-- USERS & AUTHENTICATION
-- ============================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- ROLES & PERMISSIONS
-- ============================================

CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE role_permissions (
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_roles (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

-- ============================================
-- ORGANIZATION STRUCTURE
-- ============================================

CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    parent_department_id UUID REFERENCES departments(id),
    manager_employee_id UUID,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(20) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    department_id UUID REFERENCES departments(id),
    grade VARCHAR(10),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- EMPLOYEES
-- ============================================

CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_code VARCHAR(20) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    preferred_name VARCHAR(255),
    nik VARCHAR(20) UNIQUE,
    npwp VARCHAR(20),
    date_of_birth DATE,
    gender CHAR(1) CHECK (gender IN ('M', 'F')),
    phone VARCHAR(20),
    email VARCHAR(255),
    address TEXT,
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(20),
    department_id UUID REFERENCES departments(id),
    position_id UUID REFERENCES positions(id),
    employment_status VARCHAR(20) CHECK (employment_status IN ('ACTIVE', 'ON_LEAVE', 'TERMINATED', 'RESIGNED', 'PROBATION')),
    join_date DATE NOT NULL,
    termination_date DATE,
    bank_name VARCHAR(100),
    bank_account_number VARCHAR(50),
    bank_account_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id)
);

-- Add foreign key for department manager
ALTER TABLE departments ADD CONSTRAINT fk_department_manager 
    FOREIGN KEY (manager_employee_id) REFERENCES employees(id) ON DELETE SET NULL;

-- ============================================
-- EMPLOYMENT CONTRACTS
-- ============================================

CREATE TABLE employment_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    contract_type VARCHAR(50) NOT NULL,
    contract_number VARCHAR(100),
    start_date DATE NOT NULL,
    end_date DATE,
    salary DECIMAL(15, 2),
    document_id UUID,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- DOCUMENTS
-- ============================================

CREATE TABLE document_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_required BOOLEAN DEFAULT false,
    allowed_file_types VARCHAR(255),
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE employee_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    document_type_id UUID REFERENCES document_types(id),
    file_path TEXT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    document_number VARCHAR(100),
    issue_date DATE,
    expiry_date DATE,
    verification_status VARCHAR(20) DEFAULT 'PENDING',
    uploaded_by UUID REFERENCES users(id),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- SHIFTS & ATTENDANCE
-- ============================================

CREATE TABLE shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    break_minutes INTEGER DEFAULT 0,
    crosses_midnight BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE employee_shift_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    shift_id UUID REFERENCES shifts(id),
    effective_from DATE NOT NULL,
    effective_to DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    shift_id UUID REFERENCES shifts(id),
    clock_in TIME,
    clock_out TIME,
    status VARCHAR(20) CHECK (status IN ('PRESENT', 'ABSENT', 'LATE', 'EARLY_LEAVE', 'ON_LEAVE', 'HOLIDAY', 'REST_DAY', 'INCOMPLETE')),
    late_minutes INTEGER DEFAULT 0,
    early_leave_minutes INTEGER DEFAULT 0,
    overtime_minutes INTEGER DEFAULT 0,
    source VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id, attendance_date)
);

CREATE TABLE attendance_corrections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attendance_id UUID REFERENCES attendance(id) ON DELETE CASCADE,
    requested_by UUID REFERENCES users(id),
    original_value JSONB,
    requested_value JSONB,
    reason TEXT,
    status VARCHAR(20) DEFAULT 'PENDING',
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- LEAVE MANAGEMENT
-- ============================================

CREATE TABLE leave_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    default_entitlement INTEGER DEFAULT 0,
    requires_attachment BOOLEAN DEFAULT false,
    requires_approval BOOLEAN DEFAULT true,
    is_paid BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE leave_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    leave_type_id UUID REFERENCES leave_types(id),
    year INTEGER NOT NULL,
    opening_balance DECIMAL(5, 2) DEFAULT 0,
    earned DECIMAL(5, 2) DEFAULT 0,
    used DECIMAL(5, 2) DEFAULT 0,
    adjusted DECIMAL(5, 2) DEFAULT 0,
    closing_balance DECIMAL(5, 2) DEFAULT 0,
    UNIQUE(employee_id, leave_type_id, year)
);

CREATE TABLE leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    leave_type_id UUID REFERENCES leave_types(id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days DECIMAL(5, 2) NOT NULL,
    reason TEXT,
    attachment_id UUID REFERENCES employee_documents(id),
    status VARCHAR(20) DEFAULT 'PENDING',
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP,
    rejection_reason TEXT
);

-- ============================================
-- OVERTIME
-- ============================================

CREATE TABLE overtime_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    total_minutes INTEGER NOT NULL,
    reason TEXT,
    status VARCHAR(20) DEFAULT 'PENDING',
    requested_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP,
    notes TEXT
);

-- ============================================
-- PAYROLL
-- ============================================

CREATE TABLE payroll_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_code VARCHAR(20) UNIQUE NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    pay_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'DRAFT',
    created_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP,
    finalized_by UUID REFERENCES users(id),
    finalized_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE payroll_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payroll_period_id UUID REFERENCES payroll_periods(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES employees(id),
    gross_pay DECIMAL(15, 2) DEFAULT 0,
    total_deductions DECIMAL(15, 2) DEFAULT 0,
    net_pay DECIMAL(15, 2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'CALCULATED',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(payroll_period_id, employee_id)
);

CREATE TABLE payroll_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payroll_record_id UUID REFERENCES payroll_records(id) ON DELETE CASCADE,
    component_code VARCHAR(50) NOT NULL,
    component_name VARCHAR(255) NOT NULL,
    category VARCHAR(20) CHECK (category IN ('EARNING', 'DEDUCTION')),
    quantity DECIMAL(10, 2),
    rate DECIMAL(15, 2),
    amount DECIMAL(15, 2) NOT NULL,
    source_type VARCHAR(50),
    source_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE payslips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payroll_record_id UUID REFERENCES payroll_records(id) ON DELETE CASCADE,
    file_path TEXT,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMP
);

-- ============================================
-- SERVICE CHARGE DISTRIBUTION
-- ============================================

CREATE TABLE service_charge_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_id UUID REFERENCES payroll_periods(id),
    service_charge_percentage DECIMAL(5, 2) NOT NULL DEFAULT 10.00,
    total_service_charge_pool DECIMAL(15, 2) NOT NULL DEFAULT 0,
    distribution_method VARCHAR(30) NOT NULL DEFAULT 'EQUAL',
    eligible_department_ids UUID[],
    role_weights JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE service_charge_distributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id UUID REFERENCES service_charge_configs(id) ON DELETE CASCADE,
    period_id UUID REFERENCES payroll_periods(id),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    payroll_record_id UUID REFERENCES payroll_records(id) ON DELETE SET NULL,
    amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    distribution_basis TEXT,
    status VARCHAR(20) DEFAULT 'DRAFT',
    distributed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- AUDIT & NOTIFICATIONS
-- ============================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    old_value JSONB,
    new_value JSONB,
    reason TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    entity_type VARCHAR(100),
    entity_id UUID,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX idx_employees_code ON employees(employee_code);
CREATE INDEX idx_employees_nik ON employees(nik);
CREATE INDEX idx_employees_department ON employees(department_id);
CREATE INDEX idx_employees_position ON employees(position_id);
CREATE INDEX idx_employees_status ON employees(employment_status);

CREATE INDEX idx_attendance_employee ON attendance(employee_id);
CREATE INDEX idx_attendance_date ON attendance(attendance_date);
CREATE INDEX idx_attendance_status ON attendance(status);

CREATE INDEX idx_leave_requests_employee ON leave_requests(employee_id);
CREATE INDEX idx_leave_requests_status ON leave_requests(status);
CREATE INDEX idx_leave_requests_dates ON leave_requests(start_date, end_date);

CREATE INDEX idx_overtime_employee ON overtime_requests(employee_id);
CREATE INDEX idx_overtime_status ON overtime_requests(status);

CREATE INDEX idx_payroll_period ON payroll_records(payroll_period_id);
CREATE INDEX idx_payroll_employee ON payroll_records(employee_id);

CREATE INDEX idx_contracts_employee ON employment_contracts(employee_id);
CREATE INDEX idx_contracts_end_date ON employment_contracts(end_date);

CREATE INDEX idx_documents_employee ON employee_documents(employee_id);
CREATE INDEX idx_documents_expiry ON employee_documents(expiry_date);

CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read_at);

-- ============================================
-- SEED DATA
-- ============================================

-- Insert default roles
INSERT INTO roles (name, description) VALUES
('SUPER_ADMIN', 'Full system access'),
('HR_ADMIN', 'HR management access'),
('HR_STAFF', 'HR operational access'),
('PAYROLL', 'Payroll processing access'),
('FINANCE', 'Financial reporting access'),
('FINANCIAL_CONTROLLER', 'Financial control access'),
('DEPARTMENT_HEAD', 'Department management'),
('SUPERVISOR', 'Team supervision'),
('EMPLOYEE', 'Self-service access'),
('GENERAL_MANAGER', 'Executive overview');

-- Insert default permissions
INSERT INTO permissions (code, description) VALUES
('employee.read', 'View employee records'),
('employee.create', 'Create employee records'),
('employee.update', 'Update employee records'),
('employee.archive', 'Archive employee records'),
('attendance.read', 'View attendance records'),
('attendance.create', 'Create attendance records'),
('attendance.correct', 'Correct attendance records'),
('attendance.approve', 'Approve attendance corrections'),
('leave.read', 'View leave records'),
('leave.create', 'Create leave requests'),
('leave.approve', 'Approve leave requests'),
('leave.reject', 'Reject leave requests'),
('overtime.read', 'View overtime records'),
('overtime.create', 'Create overtime requests'),
('overtime.approve', 'Approve overtime requests'),
('payroll.read', 'View payroll records'),
('payroll.calculate', 'Calculate payroll'),
('payroll.adjust', 'Adjust payroll records'),
('payroll.approve', 'Approve payroll'),
('payroll.finalize', 'Finalize payroll'),
('document.read', 'View documents'),
('document.upload', 'Upload documents'),
('document.verify', 'Verify documents'),
('report.read', 'View reports'),
('audit.read', 'View audit logs'),
('config.manage', 'Manage system configuration');

-- Insert default document types
INSERT INTO document_types (name, description, is_required) VALUES
('KTP', 'National ID Card', true),
('NPWP', 'Tax ID Number', true),
('BPJS Kesehatan', 'Health Insurance Card', true),
('BPJS Ketenagakerjaan', 'Employment Insurance Card', true),
('Employment Contract', 'Employment Agreement', true),
('Certificate', 'Professional Certificates', false),
('Photo', 'Employee Photo', false);

-- Insert default leave types
INSERT INTO leave_types (code, name, default_entitlement, is_paid) VALUES
('AL', 'Annual Leave', 12, true),
('SL', 'Sick Leave', 10, true),
('ML', 'Maternity Leave', 90, true),
('UL', 'Unpaid Leave', 0, false),
('CL', 'Compassionate Leave', 3, true);

-- Insert default shifts
INSERT INTO shifts (code, name, start_time, end_time, break_minutes, crosses_midnight) VALUES
('MOR', 'Morning Shift', '06:00', '14:30', 60, false),
('AFT', 'Afternoon Shift', '14:00', '22:30', 60, false),
('NGT', 'Night Shift', '22:00', '06:30', 60, true),
('ADM', 'Administrative', '08:00', '17:00', 60, false);

-- Insert default departments
INSERT INTO departments (code, name, description) VALUES
('F&B', 'Food & Beverage', 'Restaurant, bar, and banquet operations'),
('HK', 'Housekeeping', 'Room cleaning and public area maintenance'),
('FO', 'Front Office', 'Reception, concierge, and guest services'),
('ENG', 'Engineering', 'Building maintenance and technical operations'),
('HR', 'Human Resources', 'HR administration and employee relations'),
('FIN', 'Finance', 'Accounting, procurement, and financial control'),
('SEC', 'Security', 'Hotel security and safety operations'),
('REV', 'Revenue Management', 'Pricing, distribution, and revenue optimization');

-- Insert admin user (password: admin123 - hash this in production!)
INSERT INTO users (email, password_hash, full_name) VALUES
('admin@atrium.hr', '$2b$10$example_hash_replace_in_production', 'System Administrator');

-- Assign SUPER_ADMIN role to admin user
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u, roles r 
WHERE u.email = 'admin@atrium.hr' AND r.name = 'SUPER_ADMIN';
