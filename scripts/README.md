# 🌱 Database Seed Script

This script seeds the PostgreSQL database with sample data for ATRIUM HRIS.

## 📦 What Gets Created

### Sample Data
- **8 Departments** (Food & Beverage, Housekeeping, Front Office, etc.)
- **10 Positions** (Manager, Supervisor, Staff roles)
- **10 Employees** (with complete profiles, bank info, emergency contacts)
- **6 Users** (with different roles: Admin, Payroll, Supervisor, Employee, GM, Finance)

### Demo Login Credentials

| Email | Password | Role |
|-------|----------|------|
| admin@atrium.hr | admin123 | HR_ADMIN |
| payroll@atrium.hr | payroll123 | PAYROLL |
| supervisor@atrium.hr | super123 | SUPERVISOR |
| employee@atrium.hr | emp123 | EMPLOYEE |
| gm@atrium.hr | gm123 | GENERAL_MANAGER |
| finance@atrium.hr | fin123 | FINANCIAL_CONTROLLER |

## 🚀 How to Run

### Prerequisites
1. PostgreSQL must be installed and running
2. Database `atrium_hris` must exist
3. Migration must be run first (`node scripts/migrate.js`)

### Run the Seed Script

```bash
node scripts/seed.js
```

### Expected Output

```
🌱 Starting database seed...

📍 Connecting to: localhost:5432/atrium_hris

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

═══════════════════════════════════════════════════════════
🎉 Database seeded successfully!
═══════════════════════════════════════════════════════════

📊 Summary:
   • 8 departments
   • 10 positions
   • 10 employees
   • 6 users
   • 8 department IDs mapped
   • 10 position IDs mapped
   • 10 employee IDs mapped

👤 Demo Users:
   • admin@atrium.hr (HR_ADMIN) - Password: admin123
   • payroll@atrium.hr (PAYROLL) - Password: payroll123
   • supervisor@atrium.hr (SUPERVISOR) - Password: super123
   • employee@atrium.hr (EMPLOYEE) - Password: emp123
   • gm@atrium.hr (GENERAL_MANAGER) - Password: gm123
   • finance@atrium.hr (FINANCIAL_CONTROLLER) - Password: fin123

📝 Next steps:
   1. Start the API server: node server/index.js
   2. Start the frontend: npm run dev
   3. Open http://localhost:5173 in your browser
   4. Login with any demo user above
```

## 🔄 Re-seeding the Database

The seed script is **idempotent** - you can run it multiple times safely. It will:
1. Clear all existing data
2. Re-create all sample data
3. Generate new UUIDs for all records

To reset and re-seed:

```bash
node scripts/seed.js
```

## 📊 Data Relationships

The seed script maintains proper relationships:

```
departments (8)
    ↓
positions (10) - each position belongs to a department
    ↓
employees (10) - each employee has a position and department
    ↓
users (6) - linked to roles for authentication
```

## 🔐 Security Features

- **Passwords are hashed** using bcrypt (10 rounds)
- **UUIDs are generated** for all primary keys
- **Foreign keys are maintained** between tables
- **Roles are assigned** to users based on their role name

## 🛠️ Customizing Sample Data

To add more sample data, edit the `mockData` object in `scripts/seed.js`:

```javascript
const mockData = {
  departments: [
    // Add more departments here
    { code: 'IT', name: 'Information Technology', description: 'IT support' },
  ],
  positions: [
    // Add more positions here
    { code: 'IT-MGR', title: 'IT Manager', departmentCode: 'IT', grade: 'M2' },
  ],
  employees: [
    // Add more employees here
    {
      employeeCode: 'EMP-011',
      fullName: 'John Doe',
      // ... other fields
    },
  ],
  users: [
    // Add more users here
    { email: 'it@atrium.hr', password: 'it123', fullName: 'IT Admin', role: 'SUPER_ADMIN' },
  ],
};
```

Then run the seed script again:

```bash
node scripts/seed.js
```

## 🐛 Troubleshooting

### Error: "relation does not exist"

**Solution:** Run migration first
```bash
node scripts/migrate.js
node scripts/seed.js
```

### Error: "database does not exist"

**Solution:** Create the database first
```bash
psql postgres
CREATE DATABASE atrium_hris;
GRANT ALL PRIVILEGES ON DATABASE atrium_hris TO atrium_user;
\q

node scripts/migrate.js
node scripts/seed.js
```

### Error: "permission denied"

**Solution:** Check user privileges
```bash
psql postgres
GRANT ALL PRIVILEGES ON DATABASE atrium_hris TO atrium_user;
\c atrium_hris
GRANT ALL ON SCHEMA public TO atrium_user;
\q
```

### Error: "connection refused"

**Solution:** Start PostgreSQL
```bash
brew services start postgresql@16
```

## 📝 What's Next?

After seeding:

1. **Start the API server**
   ```bash
   node server/index.js
   ```

2. **Start the frontend**
   ```bash
   npm run dev
   ```

3. **Open the application**
   - Go to http://localhost:5173
   - Login with any demo user
   - Explore the features

4. **Verify the data**
   ```bash
   psql -U atrium_user -d atrium_hris
   SELECT * FROM employees;
   SELECT * FROM users;
   \q
   ```

---

**Need help?** Check [QUICKSTART.md](../QUICKSTART.md) for complete setup instructions.
