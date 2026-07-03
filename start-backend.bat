@echo off
setlocal

set "PORT=3000"
set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"

echo [backend] Checking port %PORT%...
for /f "usebackq tokens=*" %%p in (`powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique"`) do (
  if not "%%p"=="" (
    echo [backend] Killing process %%p on port %PORT%...
    taskkill /PID %%p /F >nul 2>nul
  )
)

cd /d "%BACKEND%"
if not exist "data\logs" mkdir "data\logs"
echo [backend] Building...
call npm run build
if errorlevel 1 (
  echo [backend] Build failed.
  pause
  exit /b 1
)

echo [backend] Starting on http://localhost:%PORT%
echo [backend] Runtime logs: %BACKEND%\data\logs
call npm start
