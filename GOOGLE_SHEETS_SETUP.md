# Google Sheets Integration Setup Guide

## Overview

This guide will help you set up Google Sheets as the database for ATRIUM HRIS.

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Name it: `atrium-hris-database`
4. Click "Create"

## Step 2: Enable Google Sheets API

1. In your new project, go to "APIs & Services" → "Library"
2. Search for "Google Sheets API"
3. Click on it → Click "Enable"

## Step 3: Create Service Account

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "Service Account"
3. Name: `atrium-hris-service`
4. Click "Create and Continue"
5. Role: Select "Project" → "Editor" (or create custom role with Sheets access)
6. Click "Continue" → "Done"

## Step 4: Generate Service Account Key

1. Click on the service account you just created
2. Go to "Keys" tab
3. Click "Add Key" → "Create new key"
4. Select "JSON" → Click "Create"
5. **Download the JSON file** (this is your credentials file)
6. **Keep this file secure!** Add it to `.gitignore`

## Step 5: Create Google Sheets

1. Go to [Google Sheets](https://sheets.google.com/)
2. Create a new spreadsheet named: `ATRIUM HRIS Database`
3. **Copy the Spreadsheet ID** from the URL:
   ```
   https://docs.google.com/spreadsheets/d/YOUR_SPREADSHEET_ID_HERE/edit
   ```

## Step 6: Share Spreadsheet with Service Account

1. Open the JSON key file you downloaded
2. Find the `client_email` field (looks like: `atrium-hris-service@project-id.iam.gserviceaccount.com`)
3. In your Google Sheet, click "Share" button
4. Paste the service account email
5. Set permission to "Editor"
6. Click "Send" (uncheck "Notify people")

## Step 7: Create Sheet Structure

Create the following sheets (tabs) in your spreadsheet:

### Required Sheets:

1. **users** - User accounts
2. **departments** - Department master
3. **positions** - Position master
4. **employees** - Employee master data
5. **shifts** - Shift definitions
6. **attendance** - Daily attendance records
7. **leave_types** - Leave type configuration
8. **leave_requests** - Leave requests
9. **overtime_requests** - Overtime records
10. **payroll_periods** - Payroll period master
11. **payroll_records** - Payroll calculations
12. **documents** - Employee documents metadata
13. **audit_logs** - System audit trail
14. **configuration** - System settings

### Sheet Column Structure:

See `sheets-structure.md` for detailed column definitions.

## Step 8: Configure Environment Variables

Create a `.env` file in your project root:

```env
# Google Sheets Configuration
GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id_here
GOOGLE_APPLICATION_CREDENTIALS=./path/to/your/service-account-key.json
```

**Important:** Add `.env` to your `.gitignore` file!

## Step 9: Initialize Database

Run the initialization script to create the sheet structure:

```bash
npm run init-sheets
```

This will:
- Create all required sheets
- Add column headers
- Seed initial data (roles, permissions, leave types, etc.)

## Step 10: Test Connection

Run the test script:

```bash
npm run test-sheets
```

This will verify:
- Authentication works
- Sheets are accessible
- Read/write operations succeed

## Security Notes

⚠️ **Critical Security Reminders:**

1. **Never commit credentials to Git**
   - Add `*.json` (service account keys) to `.gitignore`
   - Add `.env` to `.gitignore`

2. **Service Account Permissions**
   - Only share the spreadsheet with the service account
   - Don't share the service account key with anyone

3. **Production Considerations**
   - Google Sheets is NOT suitable for production HRIS
   - Plan migration to PostgreSQL before going live
   - Implement additional security layers

## Troubleshooting

### Error: "Permission denied"
- Check that the service account email has "Editor" access to the spreadsheet
- Verify the spreadsheet ID is correct

### Error: "API not enabled"
- Go to Google Cloud Console → APIs & Services → Library
- Enable "Google Sheets API"

### Error: "Invalid credentials"
- Verify the JSON key file path in `.env`
- Ensure the file exists and is readable

## Next Steps

After setup is complete:
1. Run `npm run init-sheets` to initialize the database
2. Test the application with real Google Sheets data
3. Monitor API usage (Google has rate limits)
4. Plan migration strategy for production

## Support

For issues or questions, refer to:
- [Google Sheets API Documentation](https://developers.google.com/sheets/api)
- [Service Account Documentation](https://cloud.google.com/iam/docs/service-accounts)
