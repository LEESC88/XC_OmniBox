import os
import sys
from pathlib import Path

# 项目基础路径 (兼容 PyInstaller 打包环境)
if getattr(sys, "frozen", False):
    BASE_DIR = Path(sys.executable).resolve().parent
else:
    BASE_DIR = Path(__file__).resolve().parent.parent.parent

# 临时文件处理目录 (每次转换生成的文件存放于此，任务完成后自动清理)
TEMP_DIR = BASE_DIR / "temp"
TEMP_DIR.mkdir(parents=True, exist_ok=True)

# 文件大小限制 (默认 100 MB)
MAX_UPLOAD_SIZE_MB = int(os.getenv("MAX_UPLOAD_SIZE_MB", "100"))
MAX_UPLOAD_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024

# 允许跨域请求的来源 (前端地址与桌面端协议)
CORS_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "app://localhost",
    "app://*",
    "*"
]

# LibreOffice 常用安装路径检测 (Windows / Linux)
def get_libreoffice_command() -> str | None:
    common_paths = [
        r"C:\Program Files\LibreOffice\program\soffice.exe",
        r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
        "/usr/bin/libreoffice",
        "/usr/bin/soffice",
    ]
    for p in common_paths:
        if os.path.exists(p):
            return p
    # 如果已在环境变量中
    import shutil
    if shutil.which("soffice"):
        return "soffice"
    if shutil.which("libreoffice"):
        return "libreoffice"
    return None

LIBREOFFICE_PATH = get_libreoffice_command()
