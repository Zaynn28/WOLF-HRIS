# ATRIUM HRIS - PostgreSQL Database Setup

## 🎯 Overview

ATRIUM HRIS now uses PostgreSQL as its database, running locally on your Mac Studio. This provides:

- ✅ Full SQL database with relationships and constraints
- ✅ Better performance for complex queries
- ✅ Production-ready architecture
- ✅ Full data integrity and ACID compliance
- ✅ Scalable for hundreds of employees

## 📋 Prerequisites

Before starting, ensure you have:

1. **Mac Studio** with macOS
2. **Homebrew** package manager
3. **Node.js 18+** installed
4. **Terminal** access

## 🚀 Quick Start (5 Minutes)

### Step 1: Install PostgreSQL

```bash
# Install PostgreSQL 16
brew install postgresql@16

# Start PostgreSQL service
brew services start postgresql@16

# Verify it's running
brew services list
```

You should see `postgresql@16` with status `started`.

### Step 2: Create Database and User

```bash
# Connect to PostgreSQL
psql postgres
```

Run these SQL commands:

```sql
-- Create database
CREATE DATABASE atrium_hris;

-- Create user (change password to something secure)
CREATE USER atrium_user WITH ENCRYPTED PASSWORD 'your_secure_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE atrium_hris TO atrium_user;

-- Connect to the database
\c atrium_hris

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO atrium_user;

-- Exit
\q
```

### Step 3: Configure Environment

```bash
# Copy example env file
cp .env.example .env

# Edit .env file with your database password
nano .env
```

Update the `DB_PASSWORD` line with the password you set in Step 2.

### Step 4: Run Database Migration

```bash
# Install dependencies (if not already done)
npm install

# Run migration to create all tables
node scripts/migrate.js
```

You should see output like:
```
✅ Migration completed successfully!
📊 Tables created:
   ✓ attendance
   ✓ departments
   ✓ employees
   ✓ leave_requests
   ...
```

### Step 5: Start the Application

```bash
# Terminal 1: Start backend API server
node server/index.js

# Terminal 2: Start frontend
npm run dev
```

Open your browser to `http://localhost:5173`

---

## 📁 Project Structure

```
atrium-hris/
├── database/
│   └── schema.sql              # Complete database schema
├── server/
│   ├── index.js                # Express API server
│   ├── database.js             # Database connection pool
│   └── migrate.js              # Migration runner
├── scripts/
│   ├── migrate.js              # Database migration script
│   └── test-db.js              # Connection test script
├── src/                        # React frontend
├── .env                        # Environment variables (create from .env.example)
└── package.json
```

---

## 🔧 Available Scripts

### Database Scripts

```bash
# Test database connection
node scripts/test-db.js

# Run database migration
node scripts/migrate.js
```

### Server Scripts

```bash
# Start API server (port 3001)
node server/index.js
```

### Frontend Scripts

```bash
# Start development server (port 5173)
npm run dev

# Build for production
npm run build
```

---

## 🗄️ Database Schema

### Core Tables (26 tables)

**Authentication & Users:**
- `users` - System users
- `roles` - User roles (SUPER_ADMIN, HR_ADMIN, etc.)
- `permissions` - System permissions
- `role_permissions` - Role-permission mapping
- `user_roles` - User-role mapping

**Organization:**
- `departments` - Hotel departments
- `positions` - Job positions
- `employees` - Employee master data

**Employment:**
- `employment_contracts` - Contract history
- `document_types` - Document type definitions
- `employee_documents` - Employee documents

**Attendance & Shifts:**
- `shifts` - Shift definitions
- `employee_shift_assignments` - Shift assignments
- `attendance` - Daily attendance records
- `attendance_corrections` - Attendance corrections

**Leave Management:**
- `leave_types` - Leave type configuration
- `leave_balances` - Employee leave balances
- `leave_requests` - Leave requests

**Overtime:**
- `overtime_requests` - Overtime records

**Payroll:**
- `payroll_periods` - Payroll periods
- `payroll_records` - Payroll calculations
- `payroll_items` - Payroll components
- `payslips` - Generated payslips

**AI Features:**
- `ai_requests` - AI request logs
- `ai_extractions` - AI extraction results

**System:**
- `audit_logs` - System audit trail
- `notifications` - User notifications

---

## 🔐 Security Features

### Database Security

- ✅ Encrypted passwords (bcrypt)
- ✅ Role-based access control (RBAC)
- ✅ Audit logging for all changes
- ✅ SQL injection protection (parameterized queries)
- ✅ Connection pooling with limits

### Application Security

- ✅ CORS configuration
- ✅ Environment variable management
- ✅ Secure session handling
- ✅ Input validation
- ✅ XSS protection

---

## 📊 Database Management

### Access PostgreSQL Console

```bash
psql -U atrium_user -d atrium_hris
```

### Useful SQL Commands

```sql
-- List all tables
\dt

-- Count employees
SELECT COUNT(*) FROM employees;

-- View recent audit logs
SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 10;

-- View departments with employee count
SELECT d.name, COUNT(e.id) as employee_count
FROM departments d
LEFT JOIN employees e ON d.id = e.department_id
GROUP BY d.name
ORDER BY employee_count DESC;

-- Exit psql
\q
```

### Backup Database

```bash
# Create backup
pg_dump -U atrium_user atrium_hris > backup_$(date +%Y%m%d).sql

# Restore from backup
psql -U atrium_user -d atrium_hris < backup_20240115.sql
```

### Reset Database

```bash
# Drop and recreate database
psql postgres
DROP DATABASE IF EXISTS atrium_hris;
CREATE DATABASE atrium_hris;
GRANT ALL PRIVILEGES ON DATABASE atrium_hris TO atrium_user;
\c atrium_hris
GRANT ALL ON SCHEMA public TO atrium_user;
\q

# Run migration again
node scripts/migrate.js
```

---

## 🐛 Troubleshooting

### PostgreSQL won't start

```bash
# Check logs
cat /opt/homebrew/var/log/postgresql@16.log

# Try manual start
pg_ctl -D /opt/homebrew/var/postgresql@16 start

# Restart service
brew services restart postgresql@16
```

### Connection refused

1. Verify PostgreSQL is running: `brew services list`
2. Check port 5432: `lsof -i :5432`
3. Verify credentials in `.env` file
4. Test connection: `node scripts/test-db.js`

### Migration fails

```bash
# Check if database exists
psql -U postgres -l | grep atrium_hris

# Recreate database if needed
psql postgres
DROP DATABASE IF EXISTS atrium_hris;
CREATE DATABASE atrium_hris;
GRANT ALL PRIVILEGES ON DATABASE atrium_hris TO atrium_user;
\c atrium_hris
GRANT ALL ON SCHEMA public TO atrium_user;
\q

# Run migration again
node scripts/migrate.js
```

### API server won't start

1. Check if port 3001 is available: `lsof -i :3001`
2. Verify `.env` file exists and has correct values
3. Check server logs for errors
4. Ensure all dependencies are installed: `npm install`

---

## 🚢 Production Deployment

### Environment Variables

```env
# Production database
DB_HOST=your-production-host
DB_PORT=5432
DB_NAME=atrium_hris_prod
DB_USER=atrium_prod_user
DB_PASSWORD=strong_production_password

# Server
PORT=3001
NODE_ENV=production

# Frontend
VITE_API_URL=https://api.yourdomain.com
```

### Deployment Steps

1. Set up PostgreSQL on production server
2. Run migration on production database
3. Configure environment variables
4. Start API server with process manager (PM2)
5. Build and deploy frontend
6. Set up reverse proxy (nginx)
7. Configure SSL certificates
8. Set up automated backups

---

## 📈 Performance Tips

### PostgreSQL Tuning

Edit PostgreSQL config:
```bash
nano /opt/homebrew/var/postgresql@16/postgresql.conf
```

Recommended settings for Mac Studio:
```
shared_buffers = 2GB
effective_cache_size = 6GB
work_mem = 16MB
maintenance_work_mem = 512MB
max_connections = 100
```

Restart PostgreSQL after changes:
```bash
brew services restart postgresql@16
```

### Indexes

The schema includes indexes on frequently queried columns:
- `employees.employee_code`
- `employees.nik`
- `attendance.attendance_date`
- `leave_requests.status`
- `payroll_records.payroll_period_id`

---

## ✅ Verification Checklist

After setup, verify:

- [ ] PostgreSQL is running (`brew services list`)
- [ ] Database `atrium_hris` exists
- [ ] User `atrium_user` can connect
- [ ] All 26 tables are created
- [ ] Seed data is loaded (roles, permissions, departments, etc.)
- [ ] API server starts without errors
- [ ] Frontend loads in browser
- [ ] Can create/edit employees
- [ ] Can view attendance
- [ ] Can submit leave requests
- [ ] Audit logs are being created

---

## 📞 Support

### Documentation

- PostgreSQL: https://www.postgresql.org/docs/
- Express: https://expressjs.com/
- React: https://react.dev/

### Common Issues

1. **Permission denied**: Check user privileges in PostgreSQL
2. **Table not found**: Run migration again
3. **Connection timeout**: Check firewall and network
4. **Out of memory**: Increase PostgreSQL shared_buffers

---

## 🎉 You're Ready!

Your ATRIUM HRIS is now running with PostgreSQL on Mac Studio!

**Next steps:**
1. Create admin user in the database
2. Log in to the application
3. Import existing employee data
4. Configure departments and positions
5. Start using the system!

For questions or issues, check the troubleshooting section or review the logs.
