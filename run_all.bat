@echo off
setlocal
chcp 65001 >nul
title XC_OmniBox Launcher

set "PROJECT_DIR=%~dp0"

echo =======================================================
echo    Starting XC_OmniBox Services (Backend and Frontend)
echo =======================================================

echo [1/2] Launching Backend service on port 8000...
start "XC_OmniBox_Backend" cmd /k "cd /d ""%PROJECT_DIR%"" && run_backend.bat"

timeout /t 2 >nul

echo [2/2] Launching Frontend service on port 3000...
start "XC_OmniBox_Frontend" cmd /k "cd /d ""%PROJECT_DIR%"" && run_frontend.bat"

timeout /t 3 >nul

echo Opening browser at http://localhost:3000 ...
start http://localhost:3000
