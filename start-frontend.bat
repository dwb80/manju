@echo off
setlocal

set "PORT=3001"
set "ROOT=%~dp0"
set "FRONTEND=%ROOT%frontend"

echo [frontend] Checking port %PORT%...
for /f "usebackq tokens=*" %%p in (`powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique"`) do (
  if not "%%p"=="" (
    echo [frontend] Killing process %%p on port %PORT%...
    taskkill /PID %%p /F >nul 2>nul
  )
)

cd /d "%FRONTEND%"
if not exist "node_modules" (
  echo [frontend] node_modules not found. Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo [frontend] npm install failed.
    pause
    exit /b 1
  )
)

if exist ".next" (
  echo [frontend] Cleaning stale Next.js cache...
  rmdir /s /q ".next"
)

echo [frontend] Starting on http://localhost:%PORT%
echo [frontend] Next.js dev logs will appear in this window.
set "AGNES_BACKEND_URL=http://127.0.0.1:3000"
set "NEXT_PUBLIC_AGNES_BACKEND_URL=http://127.0.0.1:3000"
call npm run dev
