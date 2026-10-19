@echo off
setlocal
chcp 65001 >nul
title XC_OmniBox Desktop Dev Mode

cd /d "%~dp0"

echo =======================================================
echo    [XC_OmniBox] Starting Desktop Dev Mode (Hot-Reload)
echo =======================================================
echo.
echo  * Frontend: Next.js (http://localhost:3000)
echo  * Core Engine: Native in-process service (Zero-port direct IPC)
echo  * Desktop App: Live Electron preview (DevTools enabled)
echo.
echo  Save changes in your editor to hot-reload instantly.
echo  Press Ctrl+C to stop all services.
echo =======================================================
echo.

call npm run dev:electron
pause
