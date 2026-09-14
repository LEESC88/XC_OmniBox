@echo off
chcp 65001 >nul
title OmniToolbox Frontend Service

echo =======================================================
echo    💻 正在启动 全能多功能工具箱 Next.js 前端服务...
echo =======================================================

cd /d "%~dp0frontend"

if not exist "node_modules" (
    echo [提示] 首次运行，正在自动安装前端依赖 (npm install)...
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
