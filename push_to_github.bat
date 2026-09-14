@echo off
chcp 65001 >nul
title XC_OmniBox GitHub Sync

echo =======================================================
echo    🚀 正在自动同步并推送到 GitHub (XC_OmniBox)...
echo =======================================================

cd /d "%~dp0"

git status --short
echo.
set /p commit_msg="请输入本次更新说明 (直接按回车默认: update XC_OmniBox): "
if "%commit_msg%"=="" set commit_msg="update: sync latest changes"

git add .
git commit -m "%commit_msg%"
echo.
echo 正在推送到远程 GitHub 仓库...
git push origin main

if %errorlevel% equ 0 (
    echo.
    echo =======================================================
    echo  🎉 成功！最新代码已成功推送到 GitHub！
    echo =======================================================
) else (
    echo.
    echo [提示] 推送未成功。请检查是否已关联远程仓库或网络连接。
    echo 如未关联，请在终端执行: git remote add origin 你的GitHub仓库URL
)
pause
