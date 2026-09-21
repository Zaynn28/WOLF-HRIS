# 🚀 ATRIUM HRIS - Quick Start Guide

Complete setup guide for running ATRIUM HRIS with PostgreSQL on Mac Studio.

## 📋 Prerequisites

- Mac Studio with macOS
- Homebrew package manager
- Node.js 18+ installed
- Terminal access

## 🎯 Quick Setup (10 Minutes)

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

-- Create user with password
CREATE USER atrium_user WITH ENCRYPTED PASSWORD 'test123';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE atrium_hris TO atrium_user;

-- Connect to the database
\c atrium_hris

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO atrium_user;

-- Exit psql
\q
```

### Step 3: Configure Environment

```bash
# Copy example env file
cp .env.example .env

# Edit .env file
nano .env
```

Update the `DB_PASSWORD` line:
```env
DB_PASSWORD=test123
```

### Step 4: Run Database Migration

```bash
# Install dependencies (if not already done)
npm install

# Run migration to create all tables
node scripts/migrate.js
```

Expected output:
```
✅ Migration completed successfully!
📊 Tables created:
   ✓ attendance
   ✓ departments
   ✓ employees
   ✓ leave_requests
   ... (26 tables total)
```

### Step 5: Seed Database with Sample Data

```bash
# Seed the database with sample data
node scripts/seed.js
```

Expected output:
```
🌱 Starting database seed...
✅ Connected to database
🗑️  Clearing existing data...
✅ Existing data cleared
📦 Seeding departments...
✅ 8 departments created
📦 Seeding positions...
✅ 10 positions created
📦 Seeding employees...
✅ 10 employees created
📦 Seeding users...
✅ 6 users created

🎉 Database seeded successfully!

📊 Summary:
   • 8 departments
   • 10 positions
   • 10 employees
   • 6 users

👤 Demo Users:
   • admin@atrium.hr (HR_ADMIN) - Password: admin123
   • payroll@atrium.hr (PAYROLL) - Password: payroll123
   • supervisor@atrium.hr (SUPERVISOR) - Password: super123
   • employee@atrium.hr (EMPLOYEE) - Password: emp123
   • gm@atrium.hr (GENERAL_MANAGER) - Password: gm123
   • finance@atrium.hr (FINANCIAL_CONTROLLER) - Password: fin123
```

### Step 6: Start the Application

Open **two terminal windows**:

**Terminal 1 - Backend API Server:**
```bash
node server/index.js
```

Expected output:
```
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🚀 ATRIUM HRIS API Server                              ║
║                                                           ║
║   Server running on: http://localhost:3001                ║
║   Database: PostgreSQL                                    ║
║   Environment: development                                ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

Expected output:
```
  VITE v5.0.0  ready in 500 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

### Step 7: Open the Application

Open your browser and go to: **http://localhost:5173**

Login with any demo user:
- **Email:** admin@atrium.hr
- **Password:** admin123

---

## 🧪 Verify the Setup

### Test Database Connection

```bash
node scripts/test-db.js
```

Expected output:
```
🔍 Testing database connection...

📍 Host: localhost
📍 Port: 5432
📍 Database: atrium_hris
📍 User: atrium_user

✅ Connection successful!

⏱️  Response time: 5ms
🕐 Server time: 2024-01-15T10:30:00.000Z
📦 PostgreSQL version: PostgreSQL 16.1

📊 Tables in database: 26

✅ Database is ready!
```

### Check Data in Database

```bash
# Connect to database
psql -U atrium_user -d atrium_hris

# Count records
SELECT COUNT(*) as department_count FROM departments;
SELECT COUNT(*) as employee_count FROM employees;
SELECT COUNT(*) as user_count FROM users;

# View sample data
SELECT employee_code, full_name, email FROM employees LIMIT 5;

# Exit
\q
```

### Test API Endpoints

```bash
# Test health endpoint
curl http://localhost:3001/api/health

# Test employees endpoint
curl http://localhost:3001/api/employees

# Test departments endpoint
curl http://localhost:3001/api/departments
```

---

## 📊 Sample Data Overview

### Departments (8)
- Food & Beverage (F&B)
- Housekeeping (HK)
- Front Office (FO)
- Engineering (ENG)
- Human Resources (HR)
- Finance (FIN)
- Security (SEC)
- Revenue Management (REV)

### Positions (10)
- F&B Manager, F&B Service Staff
- Housekeeping Supervisor, Room Attendant
- Receptionist, Front Office Manager
- Maintenance Technician
- HR Staff
- Security Guard
- Accountant

### Employees (10)
- Ahmad Wijaya (F&B Manager)
- Dewi Lestari (Housekeeping Supervisor)
- Budi Santoso (Front Office Manager)
- Sari Rahayu (F&B Service Staff)
- Rudi Hermawan (Maintenance Technician)
- Linda Kusuma (Room Attendant)
- Hendra Pratama (Security Guard)
- Nina Marlina (Receptionist)
- Tono Wibisono (Accountant)
- Maya Anggraini (HR Staff - Probation)

### Users (6)
- Admin HR (admin@atrium.hr)
- Payroll Staff (payroll@atrium.hr)
- Supervisor (supervisor@atrium.hr)
- Employee (employee@atrium.hr)
- General Manager (gm@atrium.hr)
- Financial Controller (finance@atrium.hr)

---

## 🛠️ Common Commands

### Database Operations

```bash
# Test connection
node scripts/test-db.js

# Run migration (creates tables)
node scripts/migrate.js

# Seed database (loads sample data)
node scripts/seed.js

# Reset database (drop and recreate)
psql postgres -c "DROP DATABASE IF EXISTS atrium_hris;"
psql postgres -c "CREATE DATABASE atrium_hris;"
psql postgres -c "GRANT ALL PRIVILEGES ON DATABASE atrium_hris TO atrium_user;"
node scripts/migrate.js
node scripts/seed.js
```

### Server Operations

```bash
# Start API server
node server/index.js

# Start frontend dev server
npm run dev

# Build for production
npm run build
```

### PostgreSQL Management

```bash
# Start PostgreSQL
brew services start postgresql@16

# Stop PostgreSQL
brew services stop postgresql@16

# Restart PostgreSQL
brew services restart postgresql@16

# Check status
brew services list

# Connect to database
psql -U atrium_user -d atrium_hris
```

---

## 🐛 Troubleshooting

### PostgreSQL won't start

```bash
# Check logs
cat /opt/homebrew/var/log/postgresql@16.log

# Try manual start
pg_ctl -D /opt/homebrew/var/postgresql@16 start
```

### "Connection refused" error

1. Verify PostgreSQL is running: `brew services list`
2. Check port 5432: `lsof -i :5432`
3. Verify credentials in `.env` file
4. Test connection: `node scripts/test-db.js`

### "Database does not exist" error

```bash
# Create database
psql postgres
CREATE DATABASE atrium_hris;
GRANT ALL PRIVILEGES ON DATABASE atrium_hris TO atrium_user;
\q

# Run migration
node scripts/migrate.js
```

### "Permission denied" error

```bash
# Reset user password
psql postgres
ALTER USER atrium_user WITH PASSWORD 'test123';
\q

# Update .env file
nano .env
```

### API server won't start

1. Check if port 3001 is available: `lsof -i :3001`
2. Verify `.env` file exists and has correct values
3. Check server logs for errors
4. Ensure all dependencies are installed: `npm install`

### Frontend won't start

1. Check if port 5173 is available: `lsof -i :5173`
2. Clear node_modules and reinstall:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```
3. Check browser console for errors

---

## 📝 Next Steps

After successful setup:

1. **Explore the Application**
   - Login with different user roles
   - View employee list
   - Check attendance records
   - Review payroll data

2. **Customize Data**
   - Add your own employees
   - Configure departments
   - Set up shifts
   - Define leave types

3. **Connect Frontend to API**
   - Update frontend to call API endpoints
   - Replace mock data with real API calls
   - Add loading states and error handling

4. **Add Authentication**
   - Implement JWT-based login
   - Add protected routes
   - Set up session management

---

## 📚 Documentation

- **POSTGRESQL_README.md** - Complete PostgreSQL setup guide
- **POSTGRESQL_SETUP.md** - Detailed installation instructions
- **POSTGRESQL_INTEGRATION_COMPLETE.md** - Integration summary
- **database/schema.sql** - Complete database schema
- **server/index.js** - API server documentation

---

## ✅ Success Checklist

After setup, verify:

- [ ] PostgreSQL is running (`brew services list`)
- [ ] Database `atrium_hris` exists
- [ ] User `atrium_user` can connect
- [ ] All 26 tables are created
- [ ] Sample data is loaded (8 departments, 10 employees, 6 users)
- [ ] API server starts without errors (port 3001)
- [ ] Frontend loads in browser (port 5173)
- [ ] Can login with demo users
- [ ] Can view employee list
- [ ] Can navigate between pages

---

## 🎉 You're Ready!

Your ATRIUM HRIS is now running with PostgreSQL on Mac Studio!

**Quick Reference:**
- Frontend: http://localhost:5173
- API: http://localhost:3001
- Database: PostgreSQL on localhost:5432

**Demo Login:**
- Email: admin@atrium.hr
- Password: admin123

For questions or issues, check the troubleshooting section or review the logs.

---

**Built with ❤️ for ATRIUM Hotel Group**
