@echo off
title Bot Studio IDE
cd /d "%~dp0"
echo Starting Bot Studio IDE (aiogram 3.x)...
py run.py
if %ERRORLEVEL% NEQ 0 (
    echo Python 'py' launcher exited with code %ERRORLEVEL%. Trying 'python'...
    python run.py
)
pause
