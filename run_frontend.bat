@echo off
chcp 65001 >nul
title XC_OmniBox Frontend Service

set "CURRENT_DIR=%~dp0"
cd /d "%CURRENT_DIR%frontend"

echo =======================================================
echo    💻 正在启动 XC_OmniBox Next.js 前端服务...
echo    📂 目录: %CD%
echo =======================================================

if not exist "node_modules" (
    echo [提示] 正在自动安装前端依赖 (npm install)...
    call npm install
)

echo.
echo =======================================================
echo  >>> 前端服务已启动！
echo  >>> 打开浏览器访问: http://localhost:3000
echo  >>> 按 Ctrl + C 可关闭服务
echo =======================================================
echo.

call npm run dev
pause
