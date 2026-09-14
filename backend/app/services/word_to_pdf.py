import os
import sys
import subprocess
import shutil
from pathlib import Path
from typing import Optional
from app.core.config import LIBREOFFICE_PATH
from app.core.exceptions import FileProcessingException

class WordToPdfService:
    """
    高质量 Word (.docx) 转 PDF 服务
    重点针对用户要求的【保持高质量图片与排版无损】进行优化：
    1. 首选策略 (Windows 环境)：若本地有 MS Word，使用 COM 接口以【打印级超高质量 (wdExportOptimizeForPrint)】导出，绝不压缩降低图片分辨率。
    2. 备选策略 (通用/无 Word 环境)：调用 LibreOffice Headless 引擎，注入 PDF 导出滤镜参数：
       - ReduceImageResolution = False (禁用图片降质)
       - Quality = 100 (最高无损画质)
       - MaxImageResolution = 300 (锁定 300+ DPI 打印画质)
    """

    @classmethod
    def convert(cls, docx_path: Path, output_pdf_path: Path) -> Path:
        """执行高质量 Word 转 PDF"""
        docx_path = docx_path.resolve()
        output_pdf_path = output_pdf_path.resolve()

        # 策略 1: 尝试 Windows 原生 Office COM 接口 (排版与原图质量最佳)
        if sys.platform == "win32":
            try:
                converted = cls._convert_via_windows_com(docx_path, output_pdf_path)
                if converted and output_pdf_path.exists() and output_pdf_path.stat().st_size > 0:
                    return output_pdf_path
            except Exception as e:
                print(f"Notice: MS Word COM convert not available or failed ({e}), falling back...")

        # 策略 2: 尝试 LibreOffice Headless 高清滤镜导出
        libreoffice_bin = LIBREOFFICE_PATH or cls._find_libreoffice()
        if libreoffice_bin:
            try:
                converted = cls._convert_via_libreoffice(libreoffice_bin, docx_path, output_pdf_path)
                if converted and output_pdf_path.exists() and output_pdf_path.stat().st_size > 0:
                    return output_pdf_path
            except Exception as e:
                print(f"Notice: LibreOffice convert failed ({e}), falling back...")

        # 策略 3: 尝试通用 docx2pdf 库
        try:
            from docx2pdf import convert as d2p_convert
            d2p_convert(str(docx_path), str(output_pdf_path))
            if output_pdf_path.exists() and output_pdf_path.stat().st_size > 0:
                return output_pdf_path
        except Exception as e:
            print(f"Notice: docx2pdf failed ({e})")

        raise FileProcessingException(
            "Word 转 PDF 转换失败: 未检测到系统 Word 或 LibreOffice 高清转换引擎。"
            "请安装 Microsoft Word 或免费开源的 LibreOffice。"
        )

    @classmethod
    def _convert_via_windows_com(cls, docx_path: Path, output_pdf_path: Path) -> bool:
        """通过 Windows win32com 调用 Word 原生导出，并强制 OptimizeForPrint 高保真"""
        import pythoncom
        import win32com.client

        pythoncom.CoInitialize()
        word = None
        doc = None
        try:
            # 启动不可见的 Word 进程
            word = win32com.client.DispatchEx("Word.Application")
            word.Visible = False
            word.DisplayAlerts = 0

            # 打开文档 (只读模式打开，防止冲突)
            doc = word.Documents.Open(str(docx_path), ReadOnly=True)

            # wdExportFormatPDF = 17
            # wdExportOptimizeForPrint = 0 (保证打印级超清图片，而不是 wdExportOptimizeForOnScreen 压缩画质)
            wdExportFormatPDF = 17
            wdExportOptimizeForPrint = 0

            doc.ExportAsFixedFormat(
                OutputFileName=str(output_pdf_path),
                ExportFormat=wdExportFormatPDF,
                OpenAfterExport=False,
                OptimizeFor=wdExportOptimizeForPrint,
                CreateBookmarks=1,  # 保留书签
                DocStructureTags=True,
                BitmapMissingFonts=True,
                UseISO19005_1=False
            )
            return True
        finally:
            if doc:
                try:
                    doc.Close(SaveChanges=0)
                except Exception:
                    pass
            if word:
                try:
                    word.Quit()
                except Exception:
                    pass
            pythoncom.CoUninitialize()

    @classmethod
    def _convert_via_libreoffice(cls, libreoffice_bin: str, docx_path: Path, output_pdf_path: Path) -> bool:
        """调用 LibreOffice 并配置高清无损 PDF 导出滤镜"""
        out_dir = output_pdf_path.parent
        # 配置高质量导出参数：禁用图片压缩，设置质量 100%，分辨率 300
        filter_options = (
            '{"SelectPdfVersion":{"type":"long","value":"1"},'
            '"Quality":{"type":"long","value":"100"},'
            '"ReduceImageResolution":{"type":"boolean","value":"false"},'
            '"MaxImageResolution":{"type":"long","value":"300"}}'
        )
        
        cmd = [
            libreoffice_bin,
            "--headless",
            "--convert-to",
            f"pdf:writer_pdf_Export:{filter_options}",
            str(docx_path),
            "--outdir",
            str(out_dir)
        ]
        
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=60)
        
        # LibreOffice 默认输出文件名是 原文件名.pdf
        default_out = out_dir / f"{docx_path.stem}.pdf"
        if default_out.exists() and default_out != output_pdf_path:
            shutil.move(str(default_out), str(output_pdf_path))
            
        return result.returncode == 0

    @classmethod
    def _find_libreoffice(cls) -> Optional[str]:
        """寻找系统已安装的 LibreOffice 可执行程序"""
        candidates = [
            r"C:\Program Files\LibreOffice\program\soffice.exe",
            r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
        ]
        for c in candidates:
            if os.path.exists(c):
                return c
        return shutil.which("soffice") or shutil.which("libreoffice")
