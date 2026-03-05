@echo off
setlocal
cd /d "%~dp0"

echo.
echo  === ClaudeBot Dashboard ===
echo.

:: Dependencies
if not exist node_modules (
    echo [1/3] npm install ^(root^)...
    call npm install --silent || goto :err
)
if not exist dashboard\node_modules (
    echo [1/3] npm install ^(dashboard^)...
    pushd dashboard
    call npm install --silent
    if errorlevel 1 (
        popd
        goto :err
    )
    popd
)
echo [1/3] Dependencies OK

:: Build
echo [2/3] Building...
call npm run build >nul 2>&1 || goto :err
echo [2/3] Build OK

:: Start
echo [3/3] Starting dev server...
echo.
echo   Dashboard:  http://localhost:5173
echo   API:        http://localhost:3001
echo.
echo   Press Ctrl+C to stop.
echo.
npm run dev
goto :eof

:err
echo.
echo [ERROR] Failed. Check output above.
pause
