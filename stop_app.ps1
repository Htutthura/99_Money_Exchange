# 99 Money Exchange App - Simple Stop Script

param(
    [int]$BackendPort = 8000,
    [int]$FrontendPort = 3000
)

Write-Host "Stopping 99 Money Exchange App..." -ForegroundColor Red
Write-Host "=================================" -ForegroundColor Cyan

# Function to stop processes on a specific port
function Stop-ProcessOnPort {
    param([int]$Port, [string]$ServiceName)
    try {
        $netstat = netstat -ano | findstr ":$Port "
        if ($netstat) {
            foreach ($line in $netstat) {
                $processId = ($line -split '\s+')[-1]
                if ($processId -match '^\d+$') {
                    Write-Host "Stopping $ServiceName (PID: $processId)" -ForegroundColor Yellow
                    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
                }
            }
            Write-Host "$ServiceName stopped" -ForegroundColor Green
        } else {
            Write-Host "No processes found on port $Port for $ServiceName" -ForegroundColor Gray
        }
    }
    catch {
        Write-Host "Could not stop $ServiceName on port $Port" -ForegroundColor Yellow
    }
}

# Stop backend server
Write-Host "Stopping Django Backend Server (Port: $BackendPort)..." -ForegroundColor Blue
Stop-ProcessOnPort -Port $BackendPort -ServiceName "Django Backend"

# Stop frontend server  
Write-Host "Stopping React Frontend Server (Port: $FrontendPort)..." -ForegroundColor Blue
Stop-ProcessOnPort -Port $FrontendPort -ServiceName "React Frontend"

# Also stop any remaining Python and Node processes
Write-Host "Stopping remaining Python and Node processes..." -ForegroundColor Blue
try {
    Get-Process -Name "python" -ErrorAction SilentlyContinue | 
        Where-Object { $_.ProcessName -eq "python" } |
        ForEach-Object { 
            Write-Host "Stopping Python process (PID: $($_.Id))" -ForegroundColor Yellow
            Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue 
        }
    
    Get-Process -Name "node" -ErrorAction SilentlyContinue | 
        ForEach-Object { 
            Write-Host "Stopping Node process (PID: $($_.Id))" -ForegroundColor Yellow
            Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue 
        }
}
catch {
    Write-Host "Could not check for remaining processes" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "99 Money Exchange App stopped successfully!" -ForegroundColor Green
Write-Host ""

Read-Host "Press Enter to exit..." 