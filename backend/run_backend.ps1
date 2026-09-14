# ==========================================
# 全能多功能工具箱 - 后端一键启动脚本
# ==========================================

$Host.UI.RawUI.WindowTitle = "OmniToolbox Backend Service"
$env:PYTHONIOENCODING = "utf-8"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host " 🚀 正在启动 全能多功能工具箱 Python 后端服务... " -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Cyan

# 检查虚拟环境
$VenvPython = Join-Path $ScriptDir "venv\Scripts\python.exe"
if (-Not (Test-Path $VenvPython)) {
    Write-Host "未检测到虚拟环境，正在通过 uv 创建并安装依赖..." -ForegroundColor Yellow
    $env:Path = "C:\Users\souchen\.local\bin;$env:Path"
    uv venv venv --python 3.11
    uv pip install -r requirements.txt --python .\venv\Scripts\python.exe
}

Write-Host ">>> 后端服务启动成功！" -ForegroundColor Green
Write-Host ">>> 交互式 Swagger API 文档地址: http://127.0.0.1:8000/docs" -ForegroundColor Yellow
Write-Host ">>> 健康检查与环境探针地址:     http://127.0.0.1:8000/api/v1/health" -ForegroundColor Yellow
Write-Host ">>> 按 Ctrl+C 可停止服务" -ForegroundColor Gray
Write-Host ""

& $VenvPython -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
