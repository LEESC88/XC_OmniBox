@echo off
chcp 65001 >nul
title OmniToolbox All-in-One Launcher

echo =======================================================
echo    🌟 全能多功能工具箱 一键启动器 (前后端全栈)
echo =======================================================

echo.
echo [1/2] 正在启动 Python 后端服务 (端口 8000)...
start "OmniToolbox Backend (Port 8000)" cmd /k ""%~dp0run_backend.bat""

timeout /t 2 >nul

echo [2/2] 正在启动 Next.js 前端服务 (端口 3000)...
start "OmniToolbox Frontend (Port 3000)" cmd /k ""%~dp0run_frontend.bat""

echo.
echo =======================================================
echo  >>> 正在尝试打开默认浏览器访问前端界面...
echo  >>> 前端主页: http://localhost:3000
echo  >>> 后端文档: http://127.0.0.1:8000/docs
echo =======================================================

timeout /t 3 >nul
start http://localhost:3000
