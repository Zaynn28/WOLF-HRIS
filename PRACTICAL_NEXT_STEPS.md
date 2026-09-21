# 🎯 PRACTICAL NEXT STEPS - Follow This Exactly

**Current Status:** Frontend complete ✅ | Backend ready ✅ | Seed script ready ✅
**Goal:** Get ATRIUM HRIS running on your Mac Studio with real PostgreSQL data

---

## 📋 PHASE 1: Install PostgreSQL (5 minutes)

### Step 1.1: Open Terminal
- Press `Cmd + Space` to open Spotlight
- Type "Terminal" and press Enter

### Step 1.2: Check if Homebrew is installed
```bash
brew --version
```

**If you see an error** → Install Homebrew first:
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```
Follow the prompts. This takes 2-3 minutes.

### Step 1.3: Install PostgreSQL
```bash
brew install postgresql@16
```
Wait for it to finish (1-2 minutes).

### Step 1.4: Start PostgreSQL
```bash
brew services start postgresql@16
```

### Step 1.5: Verify it's running
```bash
brew services list
```
✅ **Success:** You should see `postgresql@16` with status `started`

❌ **If not started:** Try `brew services restart postgresql@16`

---

## 📋 PHASE 2: Create Database (3 minutes)

### Step 2.1: Connect to PostgreSQL
```bash
psql postgres
```
You should see: `postgres=#`

### Step 2.2: Create the database
Copy and paste these commands **one at a time**:

```sql
CREATE DATABASE atrium_hris;
```
Press Enter. Wait for `CREATE DATABASE` message.

```sql
CREATE USER atrium_user WITH ENCRYPTED PASSWORD 'test123';
```
Press Enter. Wait for `CREATE ROLE` message.

```sql
GRANT ALL PRIVILEGES ON DATABASE atrium_hris TO atrium_user;
```
Press Enter. Wait for `GRANT` message.

```sql
\c atrium_hris
```
Press Enter. You should see: `You are now connected to database "atrium_hris"`

```sql
GRANT ALL ON SCHEMA public TO atrium_user;
```
Press Enter. Wait for `GRANT` message.

```sql
\q
```
Press Enter to exit.

✅ **Success:** You're back at your normal terminal prompt.

---

## 📋 PHASE 3: Configure the Project (2 minutes)

### Step 3.1: Navigate to your project folder
```bash
cd /path/to/your/atrium-hris-folder
```
Replace with your actual folder path.

### Step 3.2: Create .env file
```bash
cp .env.example .env
```

### Step 3.3: Edit .env file
```bash
nano .env
```

Make sure it looks like this:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=atrium_hris
DB_USER=atrium_user
DB_PASSWORD=test123
PORT=3001
NODE_ENV=development
VITE_API_URL=http://localhost:3001/api
```

Save: Press `Ctrl + O`, then `Enter`
Exit: Press `Ctrl + X`

---

## 📋 PHASE 4: Run Migration (1 minute)

### Step 4.1: Install dependencies
```bash
npm install
```
Wait for it to finish.

### Step 4.2: Run migration
```bash
node scripts/migrate.js
```

✅ **Success:** You should see:
```
✅ Migration completed successfully!
📊 Tables created:
   ✓ attendance
   ✓ departments
   ... (26 tables)
```

❌ **If error:** Check that PostgreSQL is running (`brew services list`)

---

## 📋 PHASE 5: Seed the Database (1 minute)

### Step 5.1: Run seed script
```bash
node scripts/seed.js
```

✅ **Success:** You should see:
```
🎉 Database seeded successfully!
📊 Summary:
   • 8 departments
   • 10 positions
   • 10 employees
   • 6 users
```

---

## 📋 PHASE 6: Test the Connection (30 seconds)

### Step 6.1: Test database connection
```bash
node scripts/test-db.js
```

✅ **Success:** You should see:
```
✅ Connection successful!
📊 Tables in database: 26
```

### Step 6.2: Verify data exists
```bash
psql -U atrium_user -d atrium_hris -c "SELECT COUNT(*) FROM employees;"
```

✅ **Success:** You should see `10` (10 employees)

---

## 📋 PHASE 7: Start the Application (2 minutes)

### Step 7.1: Open TWO terminal windows
- Terminal 1: For backend
- Terminal 2: For frontend

### Step 7.2: In Terminal 1 - Start Backend
```bash
node server/index.js
```

✅ **Success:** You should see:
```
🚀 ATRIUM HRIS API Server
Server running on: http://localhost:3001
```

**Keep this terminal running!** Don't close it.

### Step 7.3: In Terminal 2 - Start Frontend
```bash
npm run dev
```

✅ **Success:** You should see:
```
VITE ready in 500 ms
➜  Local:   http://localhost:5173/
```

### Step 7.4: Open Browser
Go to: **http://localhost:5173**

### Step 7.5: Login
- **Email:** `admin@atrium.hr`
- **Password:** `admin123`

✅ **Success:** You should see the ATRIUM HRIS dashboard!

---

## 📋 PHASE 8: Verify Everything Works (5 minutes)

### ✅ Check 1: View Employees
1. Click "People" → "Employees" in the sidebar
2. You should see 10 employees listed
3. Click on "Ahmad Wijaya" to see details

### ✅ Check 2: View Attendance
1. Click "Attendance" → "Daily Attendance"
2. You should see today's attendance

### ✅ Check 3: View Leave
1. Click "Leave" in the sidebar
2. You should see leave requests

### ✅ Check 4: View Payroll
1. Click "Payroll" → "Periods"
2. You should see payroll periods

### ✅ Check 5: Test API directly
In a new browser tab, go to:
```
http://localhost:3001/api/health
```
✅ **Success:** You should see JSON with `"status": "ok"`

---

## 🎉 YOU'RE DONE WITH SETUP!

Your ATRIUM HRIS is now running with PostgreSQL!

### Quick Reference
- **Frontend:** http://localhost:5173
- **API:** http://localhost:3001
- **Database:** PostgreSQL on localhost:5432

### Demo Accounts
| Email | Password | Role |
|-------|----------|------|
| admin@atrium.hr | admin123 | HR Admin |
| payroll@atrium.hr | payroll123 | Payroll |
| supervisor@atrium.hr | super123 | Supervisor |
| employee@atrium.hr | emp123 | Employee |
| gm@atrium.hr | gm123 | General Manager |
| finance@atrium.hr | fin123 | Finance Controller |

---

## 🔄 Daily Usage

### Starting the App (each time you use it)

**Terminal 1:**
```bash
brew services start postgresql@16  # Only if not running
node server/index.js
```

**Terminal 2:**
```bash
npm run dev
```

### Stopping the App
- Press `Ctrl + C` in both terminals
- Or: `brew services stop postgresql@16`

---

## 🐛 If Something Goes Wrong

### Problem: "Connection refused" on port 5432
```bash
brew services restart postgresql@16
```

### Problem: "Database does not exist"
```bash
psql postgres -c "CREATE DATABASE atrium_hris;"
psql postgres -c "GRANT ALL PRIVILEGES ON DATABASE atrium_hris TO atrium_user;"
node scripts/migrate.js
node scripts/seed.js
```

### Problem: "Port 3001 already in use"
```bash
lsof -i :3001
kill -9 <PID>
```

### Problem: "Port 5173 already in use"
```bash
lsof -i :5173
kill -9 <PID>
```

### Problem: Frontend shows mock data, not PostgreSQL data
- This is expected right now! The frontend still uses mock data.
- The next phase is to connect the frontend to the API.

---

## 🚀 WHAT'S NEXT?

After completing all phases above, you have two options:

### Option A: Test and Explore (Recommended)
- Play with the application
- Try all features
- Note what works and what doesn't
- Give feedback on UX

### Option B: Connect Frontend to API
- Make the UI use real PostgreSQL data
- Replace mock data with API calls
- This is the next development phase

**Tell me which option you want, and I'll help you with the next steps!**

---

## 📞 Need Help?

If you get stuck:
1. Check the error message carefully
2. Look at the Troubleshooting section above
3. Check `QUICKSTART.md` for detailed info
4. Check PostgreSQL logs: `cat /opt/homebrew/var/log/postgresql@16.log`

**Good luck! 🎉**
