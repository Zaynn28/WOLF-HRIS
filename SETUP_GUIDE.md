# ATRIUM HRIS - PostgreSQL Setup Guide

## 🎯 Overview

This guide will help you set up ATRIUM HRIS with PostgreSQL database on your Mac Studio.

## 📋 Prerequisites

- Mac Studio with macOS
- Homebrew package manager
- Node.js 18+ installed
- Terminal access

## 🚀 Quick Start (5 Steps)

### Step 1: Install PostgreSQL

```bash
# Install PostgreSQL
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

-- Create user with password (change 'your_secure_password' to a strong password)
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
npm run db:migrate
```

You should see output like:
```
✅ Migration completed successfully!
📊 Tables created:
   - attendance
   - departments
   - employees
   - leave_requests
   ...
```

### Step 5: Start the Application

```bash
# Start backend API server
npm run server

# In another terminal, start frontend
npm run dev
```

Open your browser to `http://localhost:5173`

---

## 📁 Project Structure

```
atrium-hris/
├── database/
│   └── schema.sql          # Database schema
├── server/
│   ├── index.js            # Express API server
│   ├── database.js         # Database connection
│   └── migrate.js          # Migration runner
├── src/                    # React frontend
├── .env                    # Environment variables (create from .env.example)
└── package.json
```

---

## 🔧 Available Commands

### Database Commands

```bash
# Run database migration
npm run db:migrate

# Test database connection
npm run db:test

# Backup database
npm run db:backup

# Restore database
npm run db:restore
```

### Server Commands

```bash
# Start API server (port 3001)
npm run server

# Start API server in development mode
npm run server:dev
```

### Frontend Commands

```bash
# Start development server (port 5173)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## 🗄️ Database Management

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
DROP DATABASE atrium_hris;
CREATE DATABASE atrium_hris;
GRANT ALL PRIVILEGES ON DATABASE atrium_hris TO atrium_user;
\q

# Run migration again
npm run db:migrate
```

---

## 🔐 Security Checklist

Before deploying to production:

- [ ] Change default database password
- [ ] Update `.env` file with production values
- [ ] Never commit `.env` file to Git
- [ ] Enable SSL for database connections
- [ ] Set up automated backups
- [ ] Configure firewall rules
- [ ] Use strong passwords for all users
- [ ] Enable audit logging
- [ ] Set up monitoring

---

## 🐛 Troubleshooting

### PostgreSQL won't start

```bash
# Check logs
cat /opt/homebrew/var/log/postgresql@16.log

# Try manual start
pg_ctl -D /opt/homebrew/var/postgresql@16 start
```

### Connection refused

1. Verify PostgreSQL is running: `brew services list`
2. Check port 5432: `lsof -i :5432`
3. Verify credentials in `.env` file
4. Test connection: `npm run db:test`

### Migration fails

```bash
# Check if database exists
psql -U postgres -l | grep atrium_hris

# Recreate database if needed
psql postgres
DROP DATABASE IF EXISTS atrium_hris;
CREATE DATABASE atrium_hris;
GRANT ALL PRIVILEGES ON DATABASE atrium_hris TO atrium_user;
\q

# Run migration again
npm run db:migrate
```

### API server won't start

1. Check if port 3001 is available: `lsof -i :3001`
2. Verify `.env` file exists and has correct values
3. Check server logs for errors
4. Ensure all dependencies are installed: `npm install`

---

## 📊 Database Schema

### Core Tables

- **users** - System users and authentication
- **roles** - User roles (SUPER_ADMIN, HR_ADMIN, etc.)
- **permissions** - System permissions
- **departments** - Hotel departments
- **positions** - Job positions
- **employees** - Employee master data
- **employment_contracts** - Contract history
- **shifts** - Shift definitions
- **attendance** - Daily attendance records
- **leave_types** - Leave type configuration
- **leave_requests** - Leave requests
- **overtime_requests** - Overtime records
- **payroll_periods** - Payroll periods
- **payroll_records** - Payroll calculations
- **audit_logs** - System audit trail
- **notifications** - User notifications

### Relationships

```
departments → positions → employees
employees → attendance
employees → leave_requests
employees → payroll_records
employees → documents
```

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

## ✅ Verification Checklist

After setup, verify:

- [ ] PostgreSQL is running
- [ ] Database `atrium_hris` exists
- [ ] User `atrium_user` can connect
- [ ] All tables are created
- [ ] Seed data is loaded
- [ ] API server starts without errors
- [ ] Frontend loads in browser
- [ ] Can create/edit employees
- [ ] Can view attendance
- [ ] Can submit leave requests
- [ ] Audit logs are being created

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
