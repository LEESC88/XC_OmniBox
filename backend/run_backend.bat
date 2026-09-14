@echo off
chcp 65001 >nul
title OmniToolbox Backend Service

echo =======================================================
echo    🚀 正在启动 全能多功能工具箱 Python 后端服务...
echo =======================================================

cd /d "%~dp0"

echo.
echo =======================================================
echo  >>> 后端服务已启动！
echo  >>> 打开浏览器访问可视化界面: http://127.0.0.1:8000/docs
echo  >>> 可直接在网页上拖入 Word/PDF 测试转换并下载
echo  >>> 按 Ctrl + C 可关闭服务
echo =======================================================
echo.

.\venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
pause
