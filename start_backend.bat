@echo off
echo =============================================
echo  POLARIS ENERGY AI - SIH 2026
echo  Starting Backend Server...
echo =============================================

cd /d "%~dp0backend"

REM Use virtual environment if it exists (recommended)
IF EXIST ".venv\Scripts\python.exe" (
    echo [INFO] Using virtual environment
    .venv\Scripts\python run.py
) ELSE (
    echo [INFO] Using system Python
    echo [WARN] If you see DLL errors, run setup.bat first
    python run.py
)
