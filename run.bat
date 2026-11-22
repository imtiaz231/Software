@echo off
REM Shop Manager for Windows: double-click run.bat   (development mode: run.bat dev)
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is not installed. Install Node 22 or 24 LTS from nodejs.org. & pause & exit /b 1)
node -v

if not exist server\node_modules (echo Installing server packages... & call npm --prefix server install || goto :fail)
if not exist client\node_modules (echo Installing client packages... & call npm --prefix client install || goto :fail)
if not exist server\.env (copy server\.env.example server\.env >nul & echo Created server\.env - change ADMIN_PASSWORD and JWT_SECRET inside it.)

if /i "%1"=="dev" (
  echo Dev mode: the app opens at http://localhost:5173
  start "Shop Manager API" cmd /k npm --prefix server run dev
  call npm --prefix client run dev
  goto :eof
)
echo Building the frontend (a few seconds)...
call npm --prefix client run build || goto :fail
echo Starting: http://localhost:4000
call npm --prefix server start
goto :eof

:fail
echo.
echo An error occurred. Please read the message above.
pause
