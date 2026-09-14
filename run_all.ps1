# ==========================================
# XC_OmniBox - PowerShell 一键启动全栈服务
# ==========================================

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "   🚀 正在启动 XC_OmniBox 全栈服务 (前后端)..." -ForegroundColor Green
Write-Host "=======================================================" -ForegroundColor Cyan

# 启动后端
Write-Host "[1/2] 正在拉起 Python FastAPI 后端 (端口 8000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$ScriptDir'; .\run_backend.bat"

Start-Sleep -Seconds 2

# 启动前端
Write-Host "[2/2] 正在拉起 Next.js 前端 (端口 3000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$ScriptDir'; .\run_frontend.bat"

Start-Sleep -Seconds 3

# 打开浏览器
Write-Host ">>> 正在打开浏览器: http://localhost:3000" -ForegroundColor Green
Start-Process "http://localhost:3000"
