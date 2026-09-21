@echo off
setlocal
chcp 65001 >nul
title XC_OmniBox Installer Builder

cd /d "%~dp0"

echo =======================================================
echo    [XC_OmniBox] 开始自动打包生成 Windows 安装包 (.exe)
echo =======================================================
echo.
echo  1. 静态构建 Next.js 前端 (Next Export)...
echo  2. 独立打包 Python 后端 (PyInstaller)...
echo  3. 压制 Windows NSIS 一键安装包 (Electron Builder)...
echo.
echo  整个过程约需 1~2 分钟，请稍候...
echo =======================================================
echo.

call npm run dist

if %ERRORLEVEL% equ 0 (
    echo.
    echo =======================================================
    echo  [成功] 安装包已打包完成！
    echo  文件位于: %~dp0release\
    echo    - XC_OmniBox-Setup-1.0.0.exe  (可分发给用户的安装包)
    echo    - latest.yml                  (自动更新发布清单)
    echo =======================================================
    explorer "%~dp0release"
) else (
    echo.
    echo [错误] 打包过程出现异常，请查看上方错误信息。
)

pause
