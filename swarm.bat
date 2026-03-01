@echo off
setlocal

cd /d "%~dp0"

if not defined ANTHROPIC_API_KEY (
    echo [ERROR] ANTHROPIC_API_KEY is not set.
    echo   set ANTHROPIC_API_KEY=sk-ant-...
    exit /b 1
)

if not exist "node_modules" (
    echo [SETUP] npm install ...
    call npm install || exit /b 1
)

if not exist "dist\index.js" (
    echo [BUILD] tsc ...
    call npm run build || exit /b 1
)

echo [ClaudeBot] Running BotGraph swarm...
node dist\index.js swarm %*
