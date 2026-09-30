@echo off
echo =============================================
echo  POLARIS ENERGY AI - SIH 2026
echo  Starting Frontend Dashboard...
echo =============================================

cd /d "%~dp0frontend"

IF NOT EXIST "node_modules\" (
    echo [INFO] Installing frontend dependencies (first time only)...
    call npm install
)

echo [INFO] Launching Vite development server...
npm run dev
