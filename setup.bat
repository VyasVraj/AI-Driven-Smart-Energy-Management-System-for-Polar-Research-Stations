@echo off
echo =============================================
echo  POLARIS ENERGY AI - SIH 2026 SETUP
echo  Setting up Python virtual environment...
echo =============================================

cd /d "%~dp0backend"

echo [1/3] Creating virtual environment...
python -m venv .venv

echo [2/3] Installing Python dependencies...
.venv\Scripts\pip install -r requirements.txt

echo [3/3] Done! Run start_backend.bat to launch the server.
echo.
echo Backend will be available at: http://localhost:8000
echo Swagger API docs at:         http://localhost:8000/docs
echo.
pause
