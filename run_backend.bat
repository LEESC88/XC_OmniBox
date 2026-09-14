@echo off
setlocal
chcp 65001 >nul
title XC_OmniBox Backend

cd /d "%~dp0backend"

echo =======================================================
echo    [XC_OmniBox] Starting Python Backend Service...
echo =======================================================

if not exist "venv\Scripts\python.exe" (
    echo [Notice] Initializing virtual environment...
    set "Path=C:\Users\souchen\.local\bin;%Path%"
    uv venv venv --python 3.11
    uv pip install -r requirements.txt --python .\venv\Scripts\python.exe
)

echo.
echo =======================================================
echo  - Backend Docs: http://127.0.0.1:8000/docs
echo  - Status: Running
echo  - Press Ctrl+C to stop
echo =======================================================
echo.

.\venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
pause
