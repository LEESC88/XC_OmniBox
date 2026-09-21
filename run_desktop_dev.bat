@echo off
setlocal
chcp 65001 >nul
title XC_OmniBox Desktop Dev Mode

cd /d "%~dp0"

echo =======================================================
echo    [XC_OmniBox] 启动桌面客户端极速开发模式 (Hot-Reload)
echo =======================================================
echo.
echo  * 前端服务: Next.js (http://localhost:3000)
echo  * 后端服务: Python FastAPI (http://127.0.0.1:8000)
echo  * 桌面窗口: Electron 联动实时预览 (带 F12 控制台)
echo.
echo  在 VS Code 中修改代码并保存，桌面窗口将毫秒级热刷新！
echo  按 Ctrl+C 即可同时停止所有服务。
echo =======================================================
echo.

call npm run dev:electron
pause
