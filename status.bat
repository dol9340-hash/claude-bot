@echo off
setlocal

cd /d "%~dp0"

if not exist "node_modules" (
    echo [SETUP] npm install ...
    call npm install || exit /b 1
)

if not exist "dist\index.js" (
    echo [BUILD] tsc ...
    call npm run build || exit /b 1
)

node dist\index.js status %*
