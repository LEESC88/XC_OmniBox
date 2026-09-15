import os
import sys
import shutil
import subprocess
from pathlib import Path
from typing import Optional
from app.services.pdf_to_word import PdfToWordService
from app.core.exceptions import FileProcessingException
from app.core.config import LIBREOFFICE_PATH

class EditorService:
    """
    PDF 在线富文本编辑核心服务
    支持：
    1. PDF -> 逆向重构 -> 提取为结构化 HTML5 富文本（供网页在线编辑）
    2. 用户编辑后的 HTML -> 原生 Word 打印级引擎 -> 高清 300+ DPI PDF 导出
    3. 用户编辑后的 HTML -> 原生 Word 引擎 -> 标准 .docx 导出
    """

    @classmethod
    def parse_pdf_to_html(cls, pdf_path: Path, temp_dir: Path) -> dict:
        """解析 PDF 为可在线编辑的 HTML 富文本"""
        try:
            import mammoth

            temp_docx = temp_dir / "intermediate.docx"
            PdfToWordService.convert(pdf_path, temp_docx)

            with open(temp_docx, "rb") as docx_file:
                result = mammoth.convert_to_html(docx_file)
                html = result.value
                messages = result.messages

            if not html.strip():
                html = "<p>（已加载文档，但未识别到常规段落文字）</p>"

            return {
                "html": html,
                "title": pdf_path.stem
            }
        except Exception as e:
            raise FileProcessingException(f"PDF 在线编辑解析失败: {str(e)}")

    @classmethod
    def html_to_pdf(cls, html_content: str, output_pdf_path: Path, temp_dir: Path) -> Path:
        """将编辑后的 HTML 高保真渲染为 300+ DPI 高清 PDF"""
        styled_html = cls._wrap_with_a4_styles(html_content)
        html_file = temp_dir / "document.html"
        html_file.write_text(styled_html, encoding="utf-8")

        # 策略 1: Windows 原生 Word COM 打印级导出 (锁定最高画质)
        if sys.platform == "win32":
            try:
                if cls._convert_html_to_pdf_via_word(html_file, output_pdf_path):
                    return output_pdf_path
            except Exception as e:
                print(f"Notice: Word COM HTML->PDF failed: {e}")

        # 策略 2: LibreOffice Headless 导出
        if LIBREOFFICE_PATH or shutil.which("soffice"):
            bin_path = LIBREOFFICE_PATH or shutil.which("soffice")
            cmd = [bin_path, "--headless", "--convert-to", "pdf", str(html_file), "--outdir", str(temp_dir)]
            subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=60)
            default_out = temp_dir / "document.pdf"
            if default_out.exists():
                shutil.move(str(default_out), str(output_pdf_path))
                return output_pdf_path

        raise FileProcessingException("导出 PDF 失败: 系统未就绪高清渲染内核")

    @classmethod
    def html_to_docx(cls, html_content: str, output_docx_path: Path, temp_dir: Path) -> Path:
        """将编辑后的 HTML 导出为标准可编辑 Word (.docx)"""
        styled_html = cls._wrap_with_a4_styles(html_content)
        html_file = temp_dir / "document.html"
        html_file.write_text(styled_html, encoding="utf-8")

        # 策略 1: Windows 原生 Word COM 另存为 docx (格式还原度 100%)
        if sys.platform == "win32":
            try:
                if cls._convert_html_to_docx_via_word(html_file, output_docx_path):
                    return output_docx_path
            except Exception as e:
                print(f"Notice: Word COM HTML->DOCX failed: {e}")

        # 策略 2: LibreOffice Headless 导出
        if LIBREOFFICE_PATH or shutil.which("soffice"):
            bin_path = LIBREOFFICE_PATH or shutil.which("soffice")
            cmd = [bin_path, "--headless", "--convert-to", "docx", str(html_file), "--outdir", str(temp_dir)]
            subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=60)
            default_out = temp_dir / "document.docx"
            if default_out.exists():
                shutil.move(str(default_out), str(output_docx_path))
                return output_docx_path

        raise FileProcessingException("导出 Word 失败: 系统未就绪转换内核")

    @classmethod
    def _convert_html_to_pdf_via_word(cls, html_path: Path, output_pdf_path: Path) -> bool:
        """通过 Word COM 以 OptimizeForPrint 导出 PDF"""
        import pythoncom
        import win32com.client

        pythoncom.CoInitialize()
        word = None
        doc = None
        try:
            word = win32com.client.DispatchEx("Word.Application")
            word.Visible = False
            word.DisplayAlerts = 0

            doc = word.Documents.Open(str(html_path.resolve()), ReadOnly=True, ConfirmConversions=False)
            doc.ExportAsFixedFormat(
                OutputFileName=str(output_pdf_path.resolve()),
                ExportFormat=17,  # wdExportFormatPDF
                OpenAfterExport=False,
                OptimizeFor=0,     # wdExportOptimizeForPrint 打印级 300+ DPI 高画质
                CreateBookmarks=1,
                DocStructureTags=True,
                BitmapMissingFonts=True
            )
            return output_pdf_path.exists() and output_pdf_path.stat().st_size > 0
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
    def _convert_html_to_docx_via_word(cls, html_path: Path, output_docx_path: Path) -> bool:
        """通过 Word COM 将 HTML 另存为原生 docx (wdFormatXMLDocument = 12)"""
        import pythoncom
        import win32com.client

        pythoncom.CoInitialize()
        word = None
        doc = None
        try:
            word = win32com.client.DispatchEx("Word.Application")
            word.Visible = False
            word.DisplayAlerts = 0

            doc = word.Documents.Open(str(html_path.resolve()), ReadOnly=True, ConfirmConversions=False)
            # wdFormatXMLDocument = 12 (Word 2007+ .docx)
            doc.SaveAs2(FileName=str(output_docx_path.resolve()), FileFormat=12)
            return output_docx_path.exists() and output_docx_path.stat().st_size > 0
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
    def _wrap_with_a4_styles(cls, body_html: str) -> str:
        """为导出的 HTML 封装标准的 A4 排版样式与排版字体"""
        return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<style>
  @page {{
    size: A4;
    margin: 25mm 20mm;
  }}
  body {{
    font-family: "Microsoft YaHei", "PingFang SC", "Segoe UI", Arial, sans-serif;
    line-height: 1.6;
    color: #1a1a1a;
    background: #ffffff;
    font-size: 11pt;
  }}
  h1 {{ font-size: 20pt; margin-top: 18pt; margin-bottom: 8pt; font-weight: bold; color: #111827; }}
  h2 {{ font-size: 16pt; margin-top: 14pt; margin-bottom: 6pt; font-weight: bold; color: #1f2937; }}
  h3 {{ font-size: 13pt; margin-top: 10pt; margin-bottom: 4pt; font-weight: bold; color: #374151; }}
  p {{ margin-top: 0; margin-bottom: 8pt; text-align: justify; }}
  table {{
    width: 100%;
    border-collapse: collapse;
    margin: 12pt 0;
  }}
  th, td {{
    border: 1px solid #d1d5db;
    padding: 6pt 8pt;
    font-size: 10pt;
  }}
  th {{
    background-color: #f3f4f6;
    font-weight: bold;
  }}
  img {{
    max-width: 100%;
    height: auto;
    display: block;
    margin: 8pt auto;
  }}
  blockquote {{
    border-left: 3px solid #3b82f6;
    margin: 8pt 0;
    padding-left: 10pt;
    color: #4b5563;
    font-style: italic;
  }}
</style>
</head>
<body>
{body_html}
</body>
</html>
"""
