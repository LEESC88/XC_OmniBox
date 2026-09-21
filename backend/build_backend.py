import os
import sys
import shutil
import subprocess
from pathlib import Path

def build():
    backend_dir = Path(__file__).resolve().parent
    dist_dir = backend_dir / "dist"
    build_dir = backend_dir / "build"
    run_server = backend_dir / "run_server.py"

    print(f"[Build Backend] Target directory: {backend_dir}")
    print("[Build Backend] Cleaning previous build artifacts...")
    if dist_dir.exists():
        shutil.rmtree(dist_dir, ignore_errors=True)
    if build_dir.exists():
        shutil.rmtree(build_dir, ignore_errors=True)

    pyinstaller_exe = backend_dir / "venv" / "Scripts" / "pyinstaller.exe"
    if not pyinstaller_exe.exists():
        pyinstaller_exe = "pyinstaller"

    cmd = [
        str(pyinstaller_exe),
        "--noconfirm",
        "--onedir",
        "--name", "omni-backend",
        "--clean",
        "--add-data", f"{backend_dir / 'app'};app",
        # 补充 Uvicorn 及常用底层依赖的 hidden imports，防止动态加载丢失
        "--hidden-import", "uvicorn.logging",
        "--hidden-import", "uvicorn.loops",
        "--hidden-import", "uvicorn.loops.auto",
        "--hidden-import", "uvicorn.protocols",
        "--hidden-import", "uvicorn.protocols.http",
        "--hidden-import", "uvicorn.protocols.http.auto",
        "--hidden-import", "uvicorn.protocols.websockets",
        "--hidden-import", "uvicorn.protocols.websockets.auto",
        "--hidden-import", "uvicorn.lifespans",
        "--hidden-import", "uvicorn.lifespans.on",
        "--hidden-import", "fitz",
        "--hidden-import", "pdf2docx",
        "--hidden-import", "docx2pdf",
        "--hidden-import", "pypdf",
        "--hidden-import", "docx",
        "--hidden-import", "PIL",
        "--hidden-import", "mammoth",
        "--hidden-import", "fastapi",
        "--hidden-import", "starlette",
        str(run_server)
    ]

    print(f"[Build Backend] Running PyInstaller command:\n{' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=str(backend_dir))
    if result.returncode != 0:
        print("[Build Backend] ERROR: PyInstaller build failed!")
        sys.exit(result.returncode)

    output_exe = dist_dir / "omni-backend" / "omni-backend.exe"
    if output_exe.exists():
        print(f"[Build Backend] SUCCESS: Built backend executable at: {output_exe}")
    else:
        print(f"[Build Backend] WARNING: Expected output not found at: {output_exe}")

if __name__ == "__main__":
    build()
