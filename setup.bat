@echo off
title M-LIS Setup
setlocal enabledelayedexpansion

cd /d "%~dp0"
set "LOG_FILE=%~dp0setup_debug.log"

echo ============================================================ > "%LOG_FILE%"
echo   M-LIS Setup Log >> "%LOG_FILE%"
echo   Date/Time: %DATE% %TIME% >> "%LOG_FILE%"
echo   Directory: %~dp0 >> "%LOG_FILE%"
echo ============================================================ >> "%LOG_FILE%"

echo ============================================================
echo   M-LIS Setup
echo   Laboratory Information System
echo ============================================================
echo.
echo Log file: setup_debug.log
echo.

:: -------------------------------------------------------------
:: Step 1: Detect Python executable
:: -------------------------------------------------------------
echo [1/4] Detecting Python...
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

:PYTHON_NOT_FOUND
echo.
echo [ERROR] Python not found on this computer.
echo [ERROR] Python not found on this computer >> "%LOG_FILE%"
echo.
echo Options:
echo   [1] Enter path to python.exe manually
echo   [2] View Python installation steps
echo   [3] Exit
echo.
set /p PY_CHOICE="Select [1-3]: "
if "%PY_CHOICE%"=="1" (
    set /p MANUAL_PY="Enter full path to python.exe: "
    if exist "!MANUAL_PY!" (
        set "PY_CMD=!MANUAL_PY!"
        (
            echo @echo off
            echo set "PYTHON_EXE=!MANUAL_PY!"
        ) > "%~dp0python_env.bat"
        goto :PYTHON_FOUND
    ) else (
        echo [ERROR] Path not found: !MANUAL_PY!
        pause
        exit /b 1
    )
)
if "%PY_CHOICE%"=="2" (
    echo.
    echo Python Installation:
    echo   1. Download and run Python installer (Python 3.11 recommended).
    echo   2. Check the box "Add Python to PATH" on the first screen.
    echo   3. Run setup.bat again.
    echo.
    pause
    exit /b 1
)
exit /b 1

:PYTHON_FOUND
echo Python executable: %PY_CMD% >> "%LOG_FILE%"
for /f "tokens=*" %%v in ('"%PY_CMD%" --version 2^>^&1') do set "PY_VER=%%v"
echo [OK] Using Python: !PY_VER! (%PY_CMD%)
echo Using Python: !PY_VER! >> "%LOG_FILE%"
echo.

:: Save detected python path into python_env.bat
(
    echo @echo off
    echo set "PYTHON_EXE=%PY_CMD%"
) > "%~dp0python_env.bat"

:: -------------------------------------------------------------
:: Step 2: Install dependencies
:: -------------------------------------------------------------
echo [2/4] Checking dependencies...
set "WHEELS_DIR=%~dp0offline_packages\wheels"
if not exist "%WHEELS_DIR%" (
    if exist "%~dp0wheels" set "WHEELS_DIR=%~dp0wheels"
)

:: Quick verification check
"%PY_CMD%" check_env.py quick_check >nul 2>&1
if not errorlevel 1 (
    echo [OK] Dependencies verified.
    goto :DEPS_OK
)

:: Attempt offline installation
if exist "%WHEELS_DIR%" (
    echo Installing from local packages...
    "%PY_CMD%" -m pip install --no-index --find-links="%WHEELS_DIR%" -r requirements.txt >> "%LOG_FILE%" 2>&1
) else (
    echo Offline packages folder not found. Installing via pip...
    "%PY_CMD%" -m pip install -r requirements.txt >> "%LOG_FILE%" 2>&1
)

:: Re-check dependencies
"%PY_CMD%" check_env.py quick_check >nul 2>&1
if not errorlevel 1 (
    echo [OK] Dependencies installed successfully.
    goto :DEPS_OK
)

:: Launch Pre-Installation Check interactive resolver
echo.
"%PY_CMD%" check_env.py interactive
if errorlevel 1 (
    echo.
    echo [ERROR] Dependencies not installed.
    echo See setup_debug.log for details.
    echo.
    pause
    exit /b 1
)

:DEPS_OK
echo.

:: -------------------------------------------------------------
:: Step 3: Run Database & Shortcut Setup
:: -------------------------------------------------------------
echo [3/4] Initializing database and shortcuts...
"%PY_CMD%" install.py >> "%LOG_FILE%" 2>&1

if errorlevel 1 (
    echo.
    echo [ERROR] Setup failed.
    echo install.py returned code %ERRORLEVEL% >> "%LOG_FILE%"
    echo See setup_debug.log for details.
    echo.
    pause
    exit /b 1
)

echo [OK] Database initialized and shortcut created.
echo.

:: -------------------------------------------------------------
:: Step 4: Completion
:: -------------------------------------------------------------
echo [4/4] Setup complete.
echo Setup finished at %TIME% >> "%LOG_FILE%"
echo ============================================================
echo.
echo First user registration will create the Super Administrator account.
echo.
echo Launch M-LIS using the Desktop shortcut or run.bat.
echo.

set /p START_NOW="Launch M-LIS now? (Y/N): "
if /i "%START_NOW%"=="Y" (
    call "%~dp0run.bat"
) else (
    echo Press any key to close.
    pause >nul
)
