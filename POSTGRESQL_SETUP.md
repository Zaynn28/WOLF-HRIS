# PostgreSQL Setup Guide for Mac Studio

## Overview
This guide will help you set up PostgreSQL as the database for ATRIUM HRIS on your Mac Studio.

## Prerequisites
- macOS (Mac Studio)
- Homebrew package manager
- Node.js 18+ installed

## Step 1: Install Homebrew (if not already installed)

Open Terminal and run:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Verify installation:
```bash
brew --version
```

## Step 2: Install PostgreSQL

```bash
brew install postgresql@16
```

Start PostgreSQL service:
```bash
brew services start postgresql@16
```

Verify it's running:
```bash
brew services list
```

You should see `postgresql@16` with status `started`.

## Step 3: Create Database and User

Connect to PostgreSQL:
```bash
psql postgres
```

Create the database and user:
```sql
-- Create database
CREATE DATABASE atrium_hris;

-- Create user with password
CREATE USER atrium_user WITH ENCRYPTED PASSWORD 'your_secure_password_here';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE atrium_hris TO atrium_user;

-- Connect to the database
\c atrium_hris

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO atrium_user;

-- Exit psql
\q
```

**Important:** Replace `your_secure_password_here` with a strong password and save it securely.

## Step 4: Configure Environment Variables

Create a `.env` file in the project root:

```env
# PostgreSQL Configuration
DATABASE_URL=postgresql://atrium_user:your_secure_password_here@localhost:5432/atrium_hris
DB_HOST=localhost
DB_PORT=5432
DB_NAME=atrium_hris
DB_USER=atrium_user
DB_PASSWORD=your_secure_password_here
```

**Security Note:** Add `.env` to your `.gitignore` file!

## Step 5: Install Node.js Dependencies

```bash
npm install pg @types/pg
```

## Step 6: Run Database Migrations

```bash
npm run db:migrate
```

This will create all necessary tables and seed initial data.

## Step 7: Verify Connection

Test the connection:
```bash
npm run db:test
```

You should see: "✅ Database connection successful!"

## Step 8: Start the Application

```bash
npm run dev
```

The application will now use PostgreSQL instead of Google Sheets.

---

## Database Management Commands

### Start/Stop PostgreSQL
```bash
# Start
brew services start postgresql@16

# Stop
brew services stop postgresql@16

# Restart
brew services restart postgresql@16
```

### Access psql Console
```bash
psql -U atrium_user -d atrium_hris
```

### Backup Database
```bash
pg_dump -U atrium_user atrium_hris > backup_$(date +%Y%m%d).sql
```

### Restore Database
```bash
psql -U atrium_user -d atrium_hris < backup_20240115.sql
```

### View All Databases
```bash
psql -U postgres -l
```

---

## Troubleshooting

### PostgreSQL won't start
```bash
# Check logs
cat /opt/homebrew/var/log/postgresql@16.log

# Try manual start
pg_ctl -D /opt/homebrew/var/postgresql@16 start
```

### Connection refused
- Verify PostgreSQL is running: `brew services list`
- Check port 5432 is not blocked: `lsof -i :5432`
- Verify credentials in `.env` file

### Permission denied
```bash
# Reset user password
psql postgres
ALTER USER atrium_user WITH PASSWORD 'new_password';
\q

# Update .env file with new password
```

### Database doesn't exist
```bash
# Recreate database
psql postgres
CREATE DATABASE atrium_hris;
GRANT ALL PRIVILEGES ON DATABASE atrium_hris TO atrium_user;
\q

# Run migrations again
npm run db:migrate
```

---

## Security Best Practices

1. **Use strong passwords** for database users
2. **Never commit `.env` file** to Git
3. **Regular backups** - Set up automated daily backups
4. **Limit network access** - Only allow localhost connections
5. **Use SSL** for production deployments
6. **Monitor logs** for suspicious activity

---

## Performance Tuning (Optional)

For better performance on Mac Studio:

Edit PostgreSQL config:
```bash
nano /opt/homebrew/var/postgresql@16/postgresql.conf
```

Recommended settings:
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

---

## Next Steps

After setup is complete:
1. ✅ Verify all tables are created
2. ✅ Test CRUD operations
3. ✅ Import existing data (if migrating)
4. ✅ Test application features
5. ✅ Set up automated backups

---

## Support

For issues:
- PostgreSQL docs: https://www.postgresql.org/docs/
- Homebrew docs: https://docs.brew.sh/
- Check logs: `/opt/homebrew/var/log/postgresql@16.log`
