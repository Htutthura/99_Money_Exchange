# 99 Money Exchange App - Simple Startup Script
# Compatible with older PowerShell versions

param(
    [switch]$Force,
    [int]$BackendPort = 8000,
    [int]$FrontendPort = 3000
)

Write-Host "99 Money Exchange App Startup Script" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Cyan

# Function to check if a port is available
function Test-PortAvailable {
    param([int]$Port)
    try {
        $tcpClient = New-Object System.Net.Sockets.TcpClient
        $tcpClient.Connect("localhost", $Port)
        $tcpClient.Close()
        return $false  # If we can connect, port is in use
    }
    catch {
        return $true   # If we can't connect, port is available
    }
}

# Function to stop processes on a port
function Stop-ProcessOnPort {
    param([int]$Port)
    try {
        $netstat = netstat -ano | findstr ":$Port "
        if ($netstat) {
            foreach ($line in $netstat) {
                $processId = ($line -split '\s+')[-1]
                if ($processId -match '^\d+$') {
                    Write-Host "Stopping process on port $Port (PID: $processId)" -ForegroundColor Yellow
                    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
                }
            }
        }
    }
    catch {
        Write-Host "Could not stop processes on port $Port" -ForegroundColor Yellow
    }
}

# Verify we're in the correct directory
if (!(Test-Path "backend\manage.py") -or !(Test-Path "frontend\package.json")) {
    Write-Host "Error: Please run this script from the money_exchange_app root directory!" -ForegroundColor Red
    Write-Host "Current directory: $(Get-Location)" -ForegroundColor Yellow
    exit 1
}

# Handle port conflicts
if (!(Test-PortAvailable $BackendPort)) {
    if ($Force) {
        Write-Host "Force mode: Stopping processes on port $BackendPort..." -ForegroundColor Yellow
        Stop-ProcessOnPort $BackendPort
        Start-Sleep 2
    } else {
        Write-Host "Port $BackendPort is already in use!" -ForegroundColor Red
        Write-Host "Use -Force to stop existing processes" -ForegroundColor Yellow
        exit 1
    }
}

if (!(Test-PortAvailable $FrontendPort)) {
    if ($Force) {
        Write-Host "Force mode: Stopping processes on port $FrontendPort..." -ForegroundColor Yellow
        Stop-ProcessOnPort $FrontendPort
        Start-Sleep 2
    } else {
        Write-Host "Port $FrontendPort is already in use!" -ForegroundColor Red
        Write-Host "Use -Force to stop existing processes" -ForegroundColor Yellow
        exit 1
    }
}

# Start Backend Server
Write-Host "Starting Django Backend Server..." -ForegroundColor Blue

Set-Location "backend"

# Check for virtual environment
if (Test-Path "venv\Scripts\Activate.ps1") {
    Write-Host "Activating virtual environment..." -ForegroundColor Magenta
    & "venv\Scripts\Activate.ps1"
    Write-Host "Virtual environment activated" -ForegroundColor Green
} else {
    Write-Host "Virtual environment not found, using system Python" -ForegroundColor Yellow
}

# Check if Django is available
$djangoOutput = cmd /c "python -c `"import django; print(django.get_version())`" 2>nul"
if ($LASTEXITCODE -eq 0) {
    Write-Host "Django version: $djangoOutput" -ForegroundColor Green
} else {
    Write-Host "Django not found! Installing requirements..." -ForegroundColor Red
    python -m pip install -r requirements.txt
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to install requirements!" -ForegroundColor Red
        Set-Location ".."
        exit 1
    }
}

# Create .env file if it doesn't exist
if (!(Test-Path ".env")) {
    Write-Host "Creating default .env file..." -ForegroundColor Yellow
    $envContent = @"
DEBUG=True
SECRET_KEY=django-insecure-development-key-change-in-production
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOW_ALL_ORIGINS=False
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=
EMAIL_HOST_PASSWORD=
DEFAULT_FROM_EMAIL=99 Money Exchange <your-email@gmail.com>
"@
    $envContent | Out-File -FilePath ".env" -Encoding UTF8
    Write-Host "Created .env file with default settings" -ForegroundColor Green
}

# Run migrations
Write-Host "Running Django migrations..." -ForegroundColor Yellow
python manage.py migrate

# Start Django server
Write-Host "Starting Django server on port $BackendPort..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "python manage.py runserver 127.0.0.1:$BackendPort" -WindowStyle Normal

Write-Host "Backend server started at http://127.0.0.1:$BackendPort" -ForegroundColor Green

Set-Location ".."

# Wait for backend to initialize
Write-Host "Waiting for backend to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# Start Frontend Server
Write-Host "Starting React Frontend Server..." -ForegroundColor Blue

Set-Location "frontend"

# Check if node_modules exists
if (!(Test-Path "node_modules")) {
    Write-Host "Installing npm dependencies..." -ForegroundColor Magenta
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to install npm dependencies!" -ForegroundColor Red
        Set-Location ".."
        exit 1
    }
}

# Set port if different from default
if ($FrontendPort -ne 3000) {
    $env:PORT = $FrontendPort
}

# Start React server
Write-Host "Starting React development server on port $FrontendPort..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm start" -WindowStyle Normal

Write-Host "Frontend server started at http://localhost:$FrontendPort" -ForegroundColor Green

Set-Location ".."

# Success message
Write-Host ""
Write-Host "99 Money Exchange App started successfully!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Frontend:    http://localhost:$FrontendPort" -ForegroundColor Cyan
Write-Host "Backend API: http://127.0.0.1:$BackendPort" -ForegroundColor Cyan
Write-Host "Admin Panel: http://127.0.0.1:$BackendPort/admin" -ForegroundColor Cyan
Write-Host ""
Write-Host "Usage Examples:" -ForegroundColor Yellow
Write-Host "  .\start_app_simple.ps1              # Normal startup"
Write-Host "  .\start_app_simple.ps1 -Force       # Force kill existing processes"
Write-Host ""
Write-Host "To stop servers: Close their terminal windows or press Ctrl+C" -ForegroundColor Yellow
Write-Host ""

Read-Host "Press Enter to exit this script..." 