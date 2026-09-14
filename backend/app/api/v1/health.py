import sys
import shutil
from fastapi import APIRouter
from app.core.config import LIBREOFFICE_PATH, TEMP_DIR

router = APIRouter(prefix="/health", tags=["Health & Diagnostics"])

@router.get("")
def health_check():
    """系统健康检查与文档转换引擎环境诊断"""
    has_win32com = False
    if sys.platform == "win32":
        try:
            import win32com.client
            has_win32com = True
        except ImportError:
            has_win32com = False

    return {
        "status": "healthy",
        "platform": sys.platform,
        "python_version": sys.version,
        "engines": {
            "pdf2docx": True,
            "libreoffice_path": LIBREOFFICE_PATH,
            "libreoffice_available": LIBREOFFICE_PATH is not None,
            "windows_word_com_available": has_win32com,
        },
        "temp_directory": str(TEMP_DIR),
    }
