@echo off
setlocal

cd /d "%~dp0"

echo === ClaudeBot Build + Run ===
echo.

if not exist node_modules (
    echo [1/4] npm install main ...
    call npm install || exit /b 1
) else (
    echo [1/4] node_modules OK
)

echo [2/4] tsc main ...
call npm run build || exit /b 1

if not exist dashboard\node_modules (
    echo [3/4] npm install dashboard ...
    pushd dashboard
    call npm install
    popd
    if errorlevel 1 exit /b 1
) else (
    echo [3/4] dashboard node_modules OK
)

echo [4/4] tsc dashboard server ...
pushd dashboard
call npx tsc -p tsconfig.server.json
popd
if errorlevel 1 exit /b 1

echo.
echo === Build OK ===
echo.

echo Starting dashboard http://localhost:5173/ ...
start "dashboard" cmd /c "cd /d %~dp0dashboard && npm run dev"

timeout /t 2 /nobreak >nul

echo Starting bot ...
node dist\index.js run %*
