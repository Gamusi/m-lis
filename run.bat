@echo off
title M-LIS Server
setlocal enabledelayedexpansion

cd /d "%~dp0"
set PYTHONPATH=%~dp0

echo ============================================================
echo   Starting M-LIS Server...
echo   Laboratory Information System
echo ============================================================
echo.

:: -------------------------------------------------------------
:: Detect Python executable
:: -------------------------------------------------------------
set "PY_CMD="

python --version >nul 2>&1
if not errorlevel 1 (
    set "PY_CMD=python"
    goto :PYTHON_FOUND
)

py --version >nul 2>&1
if not errorlevel 1 (
    set "PY_CMD=py"
    goto :PYTHON_FOUND
)

for %%V in (Python314 Python313 Python312 Python311 Python310 Python39) do (
    if exist "%LOCALAPPDATA%\Programs\Python\%%V\python.exe" (
        set "PY_CMD=%LOCALAPPDATA%\Programs\Python\%%V\python.exe"
        goto :PYTHON_FOUND
    )
)

for %%V in (Python314 Python313 Python312 Python311 Python310 Python39) do (
    if exist "C:\Program Files\Python\%%V\python.exe" (
        set "PY_CMD=C:\Program Files\Python\%%V\python.exe"
        goto :PYTHON_FOUND
    )
    if exist "C:\Program Files\Python%%V\python.exe" (
        set "PY_CMD=C:\Program Files\Python%%V\python.exe"
        goto :PYTHON_FOUND
    )
    if exist "C:\Python%%V\python.exe" (
        set "PY_CMD=C:\Python%%V\python.exe"
        goto :PYTHON_FOUND
    )
)

echo [ERROR] Python was not found on this system!
echo Please run setup.bat first or install Python (checking "Add Python to PATH").
echo.
pause
exit /b 1

:PYTHON_FOUND

:: -------------------------------------------------------------
:: Self-Healing: Check if port 8756 is occupied and clear ghost process
:: -------------------------------------------------------------
echo Checking for ghost processes on port 8756...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8756 ^| findstr LISTENING') do (
    echo Port 8756 is occupied by PID %%a. Freeing port...
    taskkill /F /PID %%a >nul 2>&1
)

:: -------------------------------------------------------------
:: Apply database seed/migrations
:: -------------------------------------------------------------
echo Checking database schema and test catalog...
"%PY_CMD%" -m backend.app.seed

:: -------------------------------------------------------------
:: Launch browser after short delay (bundled Firefox ESR Portable)
:: -------------------------------------------------------------
echo Launching client browser...
if exist "%~dp0portable_browser\firefox\FirefoxPortable.exe" (
    start "" "%PY_CMD%" -c "import time, subprocess; time.sleep(2); subprocess.Popen([r'%~dp0portable_browser\firefox\FirefoxPortable.exe', 'http://127.0.0.1:8756/'])"
) else if exist "%~dp0portable_browser\firefox\App\Firefox64\firefox.exe" (
    start "" "%PY_CMD%" -c "import time, subprocess; time.sleep(2); subprocess.Popen([r'%~dp0portable_browser\firefox\App\Firefox64\firefox.exe', 'http://127.0.0.1:8756/'])"
) else (
    start "" "%PY_CMD%" -c "import time, webbrowser; time.sleep(2); webbrowser.open('http://127.0.0.1:8756/')"
)

:: -------------------------------------------------------------
:: Run server
:: -------------------------------------------------------------
echo.
echo Server running at http://127.0.0.1:8756/
echo Keep this window open during lab operations. Press Ctrl+C to stop.
echo ============================================================
echo.

"%PY_CMD%" backend\run_server.py

echo.
echo Server has stopped. Press any key to exit.
pause >nul
