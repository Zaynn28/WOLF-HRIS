# ATRIUM HRIS - Google Sheets Integration

## 🎉 Google Sheets Database Integration Complete!

ATRIUM HRIS now supports **Google Sheets as a database**! All your HR data can be stored, synced, and managed directly in Google Sheets.

---

## 📋 Features

✅ **Full CRUD Operations** - Create, Read, Update, Delete all HR data  
✅ **Real-time Sync** - Data syncs between the app and Google Sheets  
✅ **Offline Support** - Works with localStorage when offline  
✅ **14 Data Tables** - Employees, Attendance, Leave, Payroll, and more  
✅ **Audit Trail** - All changes are logged  
✅ **Multi-user Ready** - Share the spreadsheet with your team  

---

## 🚀 Quick Start

### Option 1: Use the In-App Setup (Recommended)

1. **Open the app** and log in with any demo account
2. **Navigate to "Database (Sheets)"** in the sidebar
3. **Click "Setup Guide"** for step-by-step instructions
4. **Enter your credentials**:
   - Google Spreadsheet ID
   - Google OAuth Client ID
5. **Click "Connect & Sign In"**
6. **Authorize the app** when prompted
7. **Click "Sync All Data"** to populate your spreadsheet

### Option 2: Manual Setup

See [GOOGLE_SHEETS_SETUP.md](./GOOGLE_SHEETS_SETUP.md) for detailed instructions.

---

## 🔧 Setup Requirements

### 1. Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project: `atrium-hris`
3. Enable **Google Sheets API**
4. Create **OAuth 2.0 Client ID** (Web application type)
5. Add your app URL to "Authorized JavaScript origins"

### 2. Google Spreadsheet

1. Create a new Google Spreadsheet
2. Copy the **Spreadsheet ID** from the URL:
   ```
   https://docs.google.com/spreadsheets/d/SPREADSHEET_ID_HERE/edit
   ```
3. The app will automatically create required sheet tabs

### 3. Environment Variables (Optional)

Create a `.env` file:

```env
VITE_GOOGLE_SHEET_ID=your_spreadsheet_id
VITE_GOOGLE_CLIENT_ID=your_oauth_client_id
```

---

## 📊 Data Structure

The integration creates **14 sheets** (tabs) in your spreadsheet:

| Sheet Name | Description |
|------------|-------------|
| `employees` | Employee master data |
| `departments` | Department list |
| `positions` | Position/Job titles |
| `shifts` | Shift definitions |
| `attendance` | Daily attendance records |
| `leave_types` | Leave type configuration |
| `leave_requests` | Leave requests |
| `overtime_requests` | Overtime records |
| `payroll_periods` | Payroll period master |
| `payroll_records` | Payroll calculations |
| `documents` | Employee documents metadata |
| `audit_logs` | System audit trail |
| `users` | User accounts |
| `configuration` | System settings |

---

## 🔄 How It Works

### Data Flow

```
User Action → App → Google Sheets API → Your Spreadsheet
                ↓
           localStorage (backup)
```

### Sync Behavior

- **Automatic**: All changes are saved to both Google Sheets and localStorage
- **Manual**: Click "Sync All Data" to push all local data to Sheets
- **Cache**: Data is cached for 10 seconds to reduce API calls

### Offline Mode

- If Google Sheets is unavailable, the app uses localStorage
- Changes made offline are saved locally
- Sync when connection is restored

---

## ⚠️ Important Notes

### Limitations

1. **API Rate Limits**: Google Sheets API allows 60 requests/minute
2. **Performance**: Large datasets (1000+ rows) may be slow
3. **Concurrent Edits**: Avoid editing the spreadsheet directly while the app is running
4. **Data Size**: Google Sheets has a 10MB limit per spreadsheet

### Best Practices

✅ **Do**:
- Use the app's UI to make changes (not direct spreadsheet editing)
- Regularly backup your spreadsheet
- Monitor API usage in Google Cloud Console
- Use for prototyping and small teams (< 100 employees)

❌ **Don't**:
- Edit spreadsheet cells directly while app is running
- Use for large-scale production (> 500 employees)
- Share spreadsheet edit access with unauthorized users
- Store sensitive data without proper encryption

### Production Recommendations

For production use with 100+ employees, migrate to:
- **Supabase** (PostgreSQL + Auth + Storage)
- **Firebase** (Firestore + Auth)
- **Custom backend** (Node.js + PostgreSQL)

---

## 🛠️ Technical Details

### Architecture

```
Frontend (React + TypeScript)
    ↓
DataProvider (Abstraction Layer)
    ↓
┌───────────────────┬──────────────────┐
│  Google Sheets    │   localStorage   │
│  (Primary)        │   (Backup)       │
└───────────────────┴──────────────────┘
```

### API Calls

The app uses **Google Sheets API v4** with OAuth2 authentication:

- **Read**: `spreadsheets.values.get`
- **Write**: `spreadsheets.values.update`
- **Append**: `spreadsheets.values.append`

### Security

- OAuth2 authentication (user signs in with Google)
- Spreadsheet access controlled by Google sharing settings
- No service account keys stored in the app
- All API calls use HTTPS

---

## 📖 Usage Examples

### Viewing Data in Google Sheets

1. Click **"Open Sheet"** button in the Database settings
2. Your spreadsheet opens in Google Sheets
3. View all HR data in organized tabs

### Editing Data

**Option 1: Through the App** (Recommended)
- Use the app's UI to add/edit/delete records
- Changes automatically sync to Google Sheets

**Option 2: Direct in Sheets** (Not Recommended)
- Edit cells directly in Google Sheets
- Refresh the app to see changes
- ⚠️ Risk of data conflicts

### Syncing Data

1. Go to **Database (Sheets)** page
2. Click **"Sync All Data to Sheets"**
3. Wait for confirmation toast
4. Check your spreadsheet

---

## 🐛 Troubleshooting

### "Not authenticated" Error

**Solution**: Click "Connect & Sign In" and authorize the app

### "Permission denied" Error

**Solution**: 
- Ensure the spreadsheet is shared with your Google account
- Check that OAuth scopes include `spreadsheets`

### "API rate limit exceeded" Error

**Solution**: 
- Wait 1 minute before retrying
- Reduce the frequency of sync operations
- Check Google Cloud Console for quota usage

### Data Not Syncing

**Solution**:
1. Check internet connection
2. Verify Google Sheets API is enabled
3. Clear browser cache
4. Re-authenticate with Google

### Spreadsheet Not Found

**Solution**:
- Verify the Spreadsheet ID is correct
- Ensure the spreadsheet exists and is accessible
- Check that you're signed in with the correct Google account

---

## 📚 Resources

- [Google Sheets API Documentation](https://developers.google.com/sheets/api)
- [OAuth 2.0 for Client-side Web Applications](https://developers.google.com/identity/oauth2/web/guides/overview)
- [Google Cloud Console](https://console.cloud.google.com/)

---

## 🤝 Support

For issues or questions:
1. Check the [GOOGLE_SHEETS_SETUP.md](./GOOGLE_SHEETS_SETUP.md) guide
2. Review the troubleshooting section above
3. Check browser console for error messages
4. Verify Google Cloud project configuration

---

## 📝 Changelog

### v1.0.0 (2026-01-14)
- ✅ Initial Google Sheets integration
- ✅ Full CRUD operations for all entities
- ✅ OAuth2 authentication
- ✅ Automatic sync with localStorage backup
- ✅ Setup wizard in the app
- ✅ 14 data tables supported

---

## 🎯 Next Steps

1. **Set up Google Cloud project** (5 minutes)
2. **Create spreadsheet** (1 minute)
3. **Connect the app** (2 minutes)
4. **Sync your data** (1 minute)
5. **Start using!** 🎉

---

**Built with ❤️ for hotel HR management**

*ATRIUM HRIS - Professional, Reliable, Configurable*
