# 🔧 UUID Error Fix

## Problem
When creating a new employee, you got this error:
```
Failed to create employee: invalid input syntax for type uuid: "d6"
```

## Root Cause
The frontend was sending invalid UUID values (like `d1`, `p1`) for department and position IDs, but PostgreSQL expects proper UUID format (like `550e8400-e29b-41d4-a716-446655440001`).

## Solution Applied

### 1. Updated Mock Data (`src/data/mockData.ts`)
- Changed all department IDs from `d1`, `d2`, etc. to proper UUIDs
- Changed all position IDs from `p1`, `p2`, etc. to proper UUIDs
- Changed all employee IDs from `e1`, `e2`, etc. to proper UUIDs
- Updated all references to use the new UUID format

### 2. Updated Seed Script (`scripts/seed.js`)
- Modified to use fixed UUIDs instead of generating random ones
- This ensures frontend mock data and database are in sync

### 3. Updated Employees Page (`src/pages/EmployeesPage.tsx`)
- Fixed to not send ID when creating new employees (let backend generate UUID)
- Changed `undefined` to `null` for optional fields
- Improved error handling

---

## ✅ What You Need to Do Now

### Step 1: Re-seed the Database

Since we updated the UUIDs, you need to re-seed the database:

```bash
# Stop the backend server (Ctrl+C in the terminal running it)

# Re-seed the database
node scripts/seed.js
```

You should see:
```
🎉 Database seeded successfully!
📊 Summary:
   • 8 departments
   • 10 positions
   • 10 employees
   • 6 users
```

### Step 2: Restart the Backend

```bash
node server/index.js
```

### Step 3: Refresh the Frontend

The frontend should already be running. Just refresh your browser (Cmd+R or Ctrl+R).

### Step 4: Test Creating an Employee

1. Go to **People** → **Employees**
2. Click **"Add Employee"**
3. Fill in the form:
   - Full Name: Test Employee
   - NIK: 9999999999999999
   - Email: test@hotel.com
   - Department: Select any department
   - Position: Select any position
4. Click **"Create Employee"**

✅ **Success:** The employee should be created without errors!

---

## 🎯 What Changed

### Before (Broken)
```javascript
// Department ID
{ id: 'd1', code: 'F&B', name: 'Food & Beverage' }

// Position ID
{ id: 'p1', code: 'F&B-MGR', departmentId: 'd1' }

// Employee ID
{ id: 'e1', departmentId: 'd1', positionId: 'p1' }
```

### After (Fixed)
```javascript
// Department ID (proper UUID)
{ id: '550e8400-e29b-41d4-a716-446655440001', code: 'F&B', name: 'Food & Beverage' }

// Position ID (proper UUID)
{ id: '550e8400-e29b-41d4-a716-446655440011', code: 'F&B-MGR', departmentId: '550e8400-e29b-41d4-a716-446655440001' }

// Employee ID (proper UUID)
{ id: '550e8400-e29b-41d4-a716-446655440101', departmentId: '550e8400-e29b-41d4-a716-446655440001', positionId: '550e8400-e29b-41d4-a716-446655440011' }
```

---

## 🔄 Why This Happened

PostgreSQL has a `UUID` data type that requires a specific format:
```
xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

Where `x` is a hexadecimal digit (0-9, a-f).

The old IDs like `d1`, `p1`, `e1` don't match this format, so PostgreSQL rejected them.

---

## 📝 Summary

✅ **Fixed:** All mock data now uses proper UUIDs  
✅ **Fixed:** Seed script uses the same UUIDs  
✅ **Fixed:** Frontend doesn't send ID when creating employees  
✅ **Fixed:** Proper null/undefined handling  

**Next:** Re-seed the database and test creating employees!

---

## 🆘 If You Still Get Errors

1. **Check backend logs** - Look for detailed error messages
2. **Verify database is seeded** - Run `node scripts/seed.js` again
3. **Clear browser cache** - Hard refresh (Cmd+Shift+R)
4. **Check network tab** - See what data is being sent to the API

Let me know if you still encounter issues!
