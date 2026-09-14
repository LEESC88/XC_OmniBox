@echo off
chcp 65001 >nul
title XC_OmniBox All-in-One Launcher

set "ROOT_PATH=%~dp0"

echo =======================================================
echo    🌟 XC_OmniBox 全能工具箱 一键启动器
echo =======================================================
echo.

echo [1/2] 正在启动 Python 后端服务 (端口 8000)...
start "XC_OmniBox Backend" /d "%ROOT_PATH%" cmd /c "run_backend.bat"

timeout /t 2 >nul

echo [2/2] 正在启动 Next.js 前端服务 (端口 3000)...
start "XC_OmniBox Frontend" /d "%ROOT_PATH%" cmd /c "run_frontend.bat"

echo.
echo =======================================================
echo  >>> 正在打开浏览器访问前端操作界面...
echo  >>> 前端主页: http://localhost:3000
echo  >>> 后端文档: http://127.0.0.1:8000/docs
echo =======================================================

timeout /t 3 >nul
start http://localhost:3000
