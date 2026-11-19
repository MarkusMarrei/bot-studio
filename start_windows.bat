@echo off
setlocal enabledelayedexpansion
title Bot Studio IDE - Universal Launcher (Windows 10/11)

echo =====================================================================
echo                BOT STUDIO IDE - UNIVERSAL LAUNCHER
echo              Visual Telegram Bot Engineering Platform
echo =====================================================================
echo.

:: 1. Detect Python
echo [1/4] Checking Python environment...
set PYTHON_CMD=
where py >nul 2>&1
if %errorlevel% equ 0 (
    set PYTHON_CMD=py -3
) else (
    where python >nul 2>&1
    if %errorlevel% equ 0 (
        set PYTHON_CMD=python
    )
)

if "%PYTHON_CMD%"=="" (
    echo.
    echo [ERROR] Python 3.10+ is not found on your system!
    echo Please install Python from https://www.python.org/downloads/
    echo Make sure to check "Add Python to PATH" during installation.
    echo.
    pause
    exit /b 1
)

echo   Found Python: !PYTHON_CMD!
!PYTHON_CMD! --version

:: 2. Detect Node.js
echo.
echo [2/4] Checking Node.js environment...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Node.js is not found on your system!
    echo Please install Node.js 18+ from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] npm package manager is not found!
    echo.
    pause
    exit /b 1
)

echo   Found Node.js:
node --version
npm --version

:: 3. Setup Backend
echo.
echo [3/4] Initializing Backend dependencies...
cd /d "%~dp0backend"
!PYTHON_CMD! -m pip install --quiet -r requirements.txt
if %errorlevel% neq 0 (
    echo [WARNING] Failed to install some pip packages, attempting to run with existing ones...
)

:: 4. Setup Frontend
echo.
echo [4/4] Initializing Frontend dependencies...
cd /d "%~dp0frontend"
if not exist "node_modules" (
    echo   Installing npm packages (first run only)...
    call npm install
)

:: 5. Launch Servers
echo.
echo =====================================================================
echo   Starting Bot Studio IDE:
echo   - Backend API:  http://127.0.0.1:8000
echo   - Frontend IDE: http://127.0.0.1:5173
echo =====================================================================
echo.

:: Launch Backend in background process
cd /d "%~dp0backend"
start "Bot Studio Backend" /b !PYTHON_CMD! -m uvicorn app.main:app --host 127.0.0.1 --port 8000

:: Give backend 1 second to bind port
timeout /t 2 /nobreak >nul

:: Open browser automatically
start http://127.0.0.1:5173

:: Launch Frontend in current window
cd /d "%~dp0frontend"
call npm run dev -- --host 127.0.0.1 --port 5173

pause
