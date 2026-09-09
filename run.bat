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

:: 1. Check saved environment config first
if exist "%~dp0python_env.bat" (
    call "%~dp0python_env.bat"
    if defined PYTHON_EXE if exist "!PYTHON_EXE!" (
        set "PY_CMD=!PYTHON_EXE!"
        goto :PYTHON_FOUND
    )
)

:: 2. Check direct python on PATH
python --version >nul 2>&1
if not errorlevel 1 (
    set "PY_CMD=python"
    goto :PYTHON_FOUND
)

:: 3. Check py launcher on PATH
py --version >nul 2>&1
if not errorlevel 1 (
    set "PY_CMD=py"
    goto :PYTHON_FOUND
)

:: 4. Search LocalAppData user installations
for %%V in (Python314 Python313 Python312 Python311 Python310 Python39) do (
    if exist "%LOCALAPPDATA%\Programs\Python\%%V\python.exe" (
        set "PY_CMD=%LOCALAPPDATA%\Programs\Python\%%V\python.exe"
        goto :PYTHON_FOUND
    )
)

:: 5. Search Program Files installations
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

echo [ERROR] Python was not found on this system.
echo Run setup.bat or configure python_env.bat.
echo.
pause
exit /b 1

:PYTHON_FOUND

:: -------------------------------------------------------------
:: Pre-launch check
:: -------------------------------------------------------------
if exist "%~dp0check_env.py" (
    "%PY_CMD%" check_env.py quick_check >nul 2>&1
    if errorlevel 1 (
        echo [WARNING] Required dependencies are missing.
        echo.
        set /p REPAIR_CHOICE="Run setup now? (Y/N): "
        if /i "!REPAIR_CHOICE!"=="Y" (
            call "%~dp0setup.bat"
            exit /b 0
        ) else (
            echo Launch aborted.
            pause
            exit /b 1
        )
    )
)

:: -------------------------------------------------------------
:: Free port 8756 if occupied
:: -------------------------------------------------------------
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8756 ^| findstr LISTENING') do (
    echo Freeing port 8756 (PID %%a)...
    taskkill /F /PID %%a >nul 2>&1
)

:: -------------------------------------------------------------
:: Apply database seed/migrations
:: -------------------------------------------------------------
"%PY_CMD%" -m backend.app.seed

:: -------------------------------------------------------------
:: Launch browser after short delay (bundled Firefox ESR Portable)
:: -------------------------------------------------------------
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
echo Server stopped. Press any key to exit.
pause >nul
