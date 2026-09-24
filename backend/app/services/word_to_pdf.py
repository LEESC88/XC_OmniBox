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
                    cls._optimize_pdf_fonts(output_pdf_path)
                    return output_pdf_path
            except Exception as e:
                print(f"Notice: MS Word COM convert not available or failed ({e}), falling back...")

        # 策略 2: 尝试 LibreOffice Headless 导出
        libreoffice_bin = LIBREOFFICE_PATH or cls._find_libreoffice()
        if libreoffice_bin:
            try:
                converted = cls._convert_via_libreoffice(libreoffice_bin, docx_path, output_pdf_path, preset)
                if converted and output_pdf_path.exists() and output_pdf_path.stat().st_size > 0:
                    cls._optimize_pdf_fonts(output_pdf_path)
                    return output_pdf_path
            except Exception as e:
                print(f"Notice: LibreOffice convert failed ({e}), falling back...")

        # 策略 3: 尝试通用 docx2pdf 库
        try:
            from docx2pdf import convert as d2p_convert
            d2p_convert(str(docx_path), str(output_pdf_path))
            if output_pdf_path.exists() and output_pdf_path.stat().st_size > 0:
                cls._optimize_pdf_fonts(output_pdf_path)
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

    @classmethod
    def _optimize_pdf_fonts(cls, pdf_path: Path):
        """
        智能子集化修剪超大内嵌字体：
        Word 在导出含 Emoji（如 Segoe UI Emoji）或特殊符号的文档时，
        不会对彩色 OpenType 字体进行子集化，而是将整套 8MB 字体全量打包进 PDF，
        导致仅包含几个字符的文档体积异常膨胀至 4~5MB。
        本方法检测 > 500KB 的超大内嵌字体，提取其实际使用的 Unicode 字符集，
        并通过 fontTools 执行深度子集化修剪，将其压缩至数 KB，彻底消除无谓体积膨胀。
        """
        try:
            import io
            import re
            import pymupdf as fitz
            from fontTools.subset import Subsetter, Options
            from fontTools.ttLib import TTFont
        except ImportError:
            return

        try:
            doc = fitz.open(str(pdf_path))
            modified = False
            seen_fxrefs = set()

            for page in doc:
                for f in page.get_fonts():
                    fxref, ext, ftype, fname, falias, enc = f
                    if fxref in seen_fxrefs:
                        continue
                    seen_fxrefs.add(fxref)

                    try:
                        info = doc.extract_font(fxref)
                        # 仅处理解压体积 > 500KB 的超大字体（常规子集化字体通常仅几十KB）
                        if not info or not info[3] or len(info[3]) < 500 * 1024:
                            continue

                        buffer = info[3]
                        base_font = fname.split("+")[-1]

                        # 检索全文中该字体实际使用的字符集
                        unicodes = set()
                        for p in doc:
                            d = p.get_text("dict")
                            for b in d.get("blocks", []):
                                for l in b.get("lines", []):
                                    for s in l.get("spans", []):
                                        s_font = s.get("font", "")
                                        if s_font == fname or s_font == base_font or base_font in s_font or s_font in base_font:
                                            for ch in s.get("text", ""):
                                                unicodes.add(ord(ch))

                        if not unicodes:
                            continue

                        # 使用 fontTools 进行精确子集化
                        options = Options()
                        subsetter = Subsetter(options=options)
                        subsetter.populate(unicodes=list(unicodes))
                        tt = TTFont(io.BytesIO(buffer))
                        subsetter.subset(tt)
                        out_buf = io.BytesIO()
                        tt.save(out_buf)
                        subset_bytes = out_buf.getvalue()

                        # 沿 PDF 对象关系网追溯字体的实际流对象 xref (FontFile2 / FontFile3)
                        visited = set()
                        queue = [fxref]
                        stream_xref = None
                        while queue:
                            curr = queue.pop(0)
                            if curr in visited:
                                continue
                            visited.add(curr)
                            obj_str = doc.xref_object(curr)
                            m = re.search(r'/FontFile[23]?\s+(\d+)\s+0\s+R', obj_str)
                            if m:
                                stream_xref = int(m.group(1))
                                break
                            refs = re.findall(r'(\d+)\s+0\s+R', obj_str)
                            for r in refs:
                                r_int = int(r)
                                if r_int not in visited:
                                    queue.append(r_int)

                        if stream_xref and len(subset_bytes) < len(buffer):
                            doc.update_stream(stream_xref, subset_bytes)
                            doc.xref_set_key(stream_xref, "Length1", str(len(subset_bytes)))
                            modified = True
                    except Exception as fe:
                        print(f"Notice: font optimization skipped for {fname}: {fe}")

            if modified:
                temp_out = pdf_path.with_name(f"{pdf_path.stem}_fontopt.pdf")
                doc.save(str(temp_out), deflate=True, garbage=4, clean=True)
                doc.close()
                if temp_out.exists() and temp_out.stat().st_size > 0:
                    temp_out.replace(pdf_path)
            else:
                doc.close()
        except Exception as e:
            print(f"Notice: _optimize_pdf_fonts skipped: {e}")
