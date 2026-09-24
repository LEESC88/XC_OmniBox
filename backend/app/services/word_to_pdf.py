import os
import sys
import subprocess
import shutil
from pathlib import Path
from app.core.config import LIBREOFFICE_PATH
from app.core.exceptions import FileProcessingException

class WordToPdfService:
    """
    Word (.docx) 转 PDF 服务，支持三档质量选择：
    - light  (轻量): 96 DPI, 屏幕优化, 文件小
    - standard (标准): 150 DPI, 平衡画质与体积
    - high   (高清): 300 DPI, 打印级超清无损 (默认)
    """

    # 质量预设参数映射
    QUALITY_PRESETS = {
        "light": {
            "com_optimize": 1,   # wdExportOptimizeForOnScreen (屏幕优化，轻量小体积)
            "lo_quality": 50,
            "lo_max_res": 96,
            "lo_reduce": "true",
            "max_dpi": 96,
        },
        "standard": {
            "com_optimize": 0,   # wdExportOptimizeForPrint (标准打印排版，平衡体积)
            "lo_quality": 80,
            "lo_max_res": 150,
            "lo_reduce": "true",
            "max_dpi": 150,
        },
        "high": {
            "com_optimize": 0,   # wdExportOptimizeForPrint (超清打印级无损矢量)
            "lo_quality": 100,
            "lo_max_res": 300,
            "lo_reduce": "false",
            "max_dpi": None,
        },
    }

    @classmethod
    def convert(cls, docx_path: Path, output_pdf_path: Path, quality: str = "high") -> Path:
        """执行 Word 转 PDF，quality 可选 light / standard / high"""
        docx_path = docx_path.resolve()
        output_pdf_path = output_pdf_path.resolve()
        if quality not in cls.QUALITY_PRESETS:
            quality = "high"
        preset = cls.QUALITY_PRESETS[quality]

        # 策略 1: 尝试 Windows 原生 Office COM 接口
        if sys.platform == "win32":
            try:
                converted = cls._convert_via_windows_com(docx_path, output_pdf_path, preset)
                if converted and output_pdf_path.exists() and output_pdf_path.stat().st_size > 0:
                    return output_pdf_path
            except Exception as e:
                print(f"Notice: MS Word COM convert not available or failed ({e}), falling back...")

        # 策略 2: 尝试 LibreOffice Headless 导出
        libreoffice_bin = LIBREOFFICE_PATH or cls._find_libreoffice()
        if libreoffice_bin:
            try:
                converted = cls._convert_via_libreoffice(libreoffice_bin, docx_path, output_pdf_path, preset)
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
    def _convert_via_windows_com(cls, docx_path: Path, output_pdf_path: Path, preset: dict) -> bool:
        """通过 Windows win32com 调用 Word 原生导出，根据 preset 选择优化级别"""
        import pythoncom
        import win32com.client

        pythoncom.CoInitialize()
        word = None
        doc = None
        try:
            word = win32com.client.DispatchEx("Word.Application")
            word.Visible = False
            word.DisplayAlerts = 0

            doc = word.Documents.Open(str(docx_path), ReadOnly=True)

            # wdExportFormatPDF = 17
            # OptimizeFor: 0 = wdExportOptimizeForPrint, 1 = wdExportOptimizeForOnScreen
            wdExportFormatPDF = 17

            doc.ExportAsFixedFormat(
                OutputFileName=str(output_pdf_path),
                ExportFormat=wdExportFormatPDF,
                OpenAfterExport=False,
                OptimizeFor=preset["com_optimize"],
                CreateBookmarks=1,
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
    def _convert_via_libreoffice(cls, libreoffice_bin: str, docx_path: Path, output_pdf_path: Path, preset: dict) -> bool:
        """调用 LibreOffice 并根据 preset 配置 PDF 导出滤镜"""
        out_dir = output_pdf_path.parent
        filter_options = (
            '{"SelectPdfVersion":{"type":"long","value":"1"},'
            f'"Quality":{{"type":"long","value":"{preset["lo_quality"]}"}},'
            f'"ReduceImageResolution":{{"type":"boolean","value":"{preset["lo_reduce"]}"}},'
            f'"MaxImageResolution":{{"type":"long","value":"{preset["lo_max_res"]}"}}}}'
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
