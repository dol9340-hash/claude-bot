@echo off
setlocal

cd /d "%~dp0\dashboard"

if not exist "node_modules" (
    echo [SETUP] npm install ...
    call npm install || exit /b 1
)

echo [ClaudeBot] Dashboard: http://localhost:5173/
npm run dev
