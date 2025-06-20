# 99 Money Exchange App - Server Scripts

This directory contains simplified PowerShell scripts to manage the 99 Money Exchange application servers.

## Available Scripts

### `start_app.ps1` - Main Startup Script
Starts both Django backend and React frontend servers.

**Usage:**
```powershell
# Normal startup
.\start_app.ps1

# Force kill existing processes and start fresh
.\start_app.ps1 -Force

# Use custom ports
.\start_app.ps1 -BackendPort 8001 -FrontendPort 3001
```

**Features:**
- ✅ Port conflict detection and resolution
- ✅ Virtual environment activation
- ✅ Dependency checking
- ✅ Environment file creation
- ✅ Database migration handling
- ✅ Compatible with Windows PowerShell

### `stop_app.ps1` - Stop Script
Cleanly stops both servers and related processes.

**Usage:**
```powershell
# Stop servers on default ports
.\stop_app.ps1

# Stop servers on custom ports
.\stop_app.ps1 -BackendPort 8001 -FrontendPort 3001
```

## Server URLs

When running, your application will be available at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://127.0.0.1:8000
- **Admin Panel**: http://127.0.0.1:8000/admin

## Troubleshooting

If you encounter issues:

1. **Port conflicts**: Use `-Force` flag with start script
2. **PowerShell execution policy**: Run `Set-ExecutionPolicy RemoteSigned` as Administrator
3. **Missing dependencies**: The start script will automatically install them
4. **Frontend opens in Notepad**: Fixed in the current version

## Notes

- Scripts automatically activate the virtual environment if present
- Backend migrations are run automatically
- Environment file (.env) is created with default settings if missing
- Both servers open in separate PowerShell windows for easy monitoring 