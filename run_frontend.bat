@echo off
setlocal
chcp 65001 >nul
title XC_OmniBox Frontend

cd /d "%~dp0frontend"

echo =======================================================
echo    [XC_OmniBox] Starting Next.js Frontend Service...
echo =======================================================

if not exist "node_modules" (
    echo [Notice] Installing frontend dependencies...
    call npm install
)

echo.
echo =======================================================
echo  - Frontend Web: http://localhost:3000
echo  - Status: Running
echo  - Press Ctrl+C to stop
echo =======================================================
echo.

call npm run dev
pause
