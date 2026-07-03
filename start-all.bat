@echo off
setlocal

set "ROOT=%~dp0"

echo Starting Agnes AI Studio...
start "Agnes Backend :3000" cmd /k ""%ROOT%start-backend.bat""
timeout /t 3 /nobreak >nul
start "Agnes Frontend :3001" cmd /k ""%ROOT%start-frontend.bat""

echo.
echo Backend:  http://localhost:3000
echo Frontend: http://localhost:3001
echo.
echo Two terminal windows have been opened.

