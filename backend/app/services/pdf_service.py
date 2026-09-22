import io
from pathlib import Path
from typing import List, Optional
from pypdf import PdfReader, PdfWriter
from app.core.exceptions import FileProcessingException

class PdfService:
    """
    PDF 页面操作与安全引擎 (借鉴 Stirling-PDF 核心能力)
    提供快速、无损、低资源占用的 PDF 几何操作与安全加解密
    """

    @staticmethod
    def merge_pdfs(pdf_paths: List[Path], output_path: Path) -> Path:
        """合并多个 PDF 文件，保持原始顺序与分辨率"""
        try:
            writer = PdfWriter()
            for p in pdf_paths:
                reader = PdfReader(str(p))
                for page in reader.pages:
                    writer.add_page(page)
            with open(output_path, "wb") as f_out:
                writer.write(f_out)
            return output_path
        except Exception as e:
            raise FileProcessingException(f"合并 PDF 失败: {str(e)}")

    @staticmethod
    def split_pdf(pdf_path: Path, output_dir: Path, page_ranges: Optional[str] = None) -> List[Path]:
        """
        拆分 PDF 或按指定范围提取页面
        :param page_ranges: 如 '1,3,5-7' 或 None (表示每页拆分成单文件)
        """
        try:
            reader = PdfReader(str(pdf_path))
            total_pages = len(reader.pages)
            output_files = []

            if not page_ranges:
                # 默认每页拆分一份
                for idx in range(total_pages):
                    writer = PdfWriter()
                    writer.add_page(reader.pages[idx])
                    out_file = output_dir / f"page_{idx + 1}.pdf"
                    with open(out_file, "wb") as f:
                        writer.write(f)
                    output_files.append(out_file)
                return output_files

            # 解析页码范围 (例如: 1-3, 5)
            target_indices = set()
            for part in page_ranges.split(","):
                part = part.strip()
                if "-" in part:
                    start_str, end_str = part.split("-")
                    s = max(1, int(start_str))
                    e = min(total_pages, int(end_str))
                    for p in range(s, e + 1):
                        target_indices.add(p - 1)
                else:
                    p = int(part)
                    if 1 <= p <= total_pages:
                        target_indices.add(p - 1)

            writer = PdfWriter()
            for idx in sorted(target_indices):
                writer.add_page(reader.pages[idx])
            
            out_file = output_dir / "extracted_pages.pdf"
            with open(out_file, "wb") as f:
                writer.write(f)
            output_files.append(out_file)
            return output_files

        except Exception as e:
            raise FileProcessingException(f"拆分/提取 PDF 失败: {str(e)}")

    @staticmethod
    def rotate_pdf(pdf_path: Path, output_path: Path, angle: int = 90) -> Path:
        """顺时针旋转 PDF 所有页面 (支持 90, 180, 270)"""
        try:
            reader = PdfReader(str(pdf_path))
            writer = PdfWriter()
            for page in reader.pages:
                page.rotate(angle)
                writer.add_page(page)
            with open(output_path, "wb") as f:
                writer.write(f)
            return output_path
        except Exception as e:
            raise FileProcessingException(f"旋转 PDF 失败: {str(e)}")

    @staticmethod
    def add_watermark(
        pdf_path: Path,
        output_path: Path,
        watermark_text: str,
        opacity: float = 0.3,
        font_size: int = 36,
        angle: int = 45
    ) -> Path:
        """
        为 PDF 每页添加自定义半透明文字倾斜水印
        使用 PyMuPDF (fitz) 实现矢量级高清晰度渲染
        """
        try:
            import pymupdf
            
            doc = pymupdf.open(str(pdf_path))
            
            # 加载内置 CJK 中文字体 (Droid Sans Fallback)，确保中文/日文/韩文及特殊字符正常渲染，杜绝菱形方框乱码
            cjk_font = pymupdf.Font("china-s")
            font_buffer = cjk_font.buffer

            font_size = max(8, font_size)
            opacity = max(0.05, min(1.0, opacity))

            for page in doc:
                # 注册 CJK 字体到当前页面
                page.insert_font(fontname="cjk", fontbuffer=font_buffer)
                
                rect = page.rect
                center_point = pymupdf.Point(rect.width / 2, rect.height / 2)
                
                # 计算水印文字的精确排版宽度以实现真正居中
                try:
                    text_len = pymupdf.get_text_length(watermark_text, fontname="china-s", fontsize=font_size)
                except Exception:
                    text_len = len(watermark_text) * font_size * 0.9

                # 垂直微调 baseline 保证视觉严格居中
                start_pt = pymupdf.Point(center_point.x - text_len / 2, center_point.y + font_size * 0.35)
                
                # 使用 Matrix morph 变换实现全角度平滑无畸变倾斜旋转
                mat = pymupdf.Matrix(angle)
                page.insert_text(
                    start_pt,
                    watermark_text,
                    fontname="cjk",
                    fontsize=font_size,
                    morph=(center_point, mat),
                    color=(0.5, 0.5, 0.5),
                    fill_opacity=opacity
                )

            # 执行字体子集化压缩 (Font Subsetting)，将嵌入字体体积从几兆压缩到十几KB
            try:
                doc.subset_fonts()
            except Exception:
                pass

            doc.save(str(output_path), deflate=True, garbage=4)
            doc.close()
            return output_path
        except Exception as e:
            raise FileProcessingException(f"添加水印失败: {str(e)}")

    @staticmethod
    def protect_pdf(pdf_path: Path, output_path: Path, user_password: str) -> Path:
        """为 PDF 添加访问密码保护与权限加密"""
        try:
            reader = PdfReader(str(pdf_path))
            writer = PdfWriter()
            for page in reader.pages:
                writer.add_page(page)
            # 使用强加密算法加密文档
            writer.encrypt(user_password=user_password)
            with open(output_path, "wb") as f:
                writer.write(f)
            return output_path
        except Exception as e:
            raise FileProcessingException(f"加密 PDF 失败: {str(e)}")

    @staticmethod
    def unlock_pdf(pdf_path: Path, output_path: Path, password: str) -> Path:
        """输入密码解除 PDF 保护并另存为无密码公开版本"""
        try:
            reader = PdfReader(str(pdf_path))
            if reader.is_encrypted:
                decrypt_success = reader.decrypt(password)
                if not decrypt_success:
                    raise FileProcessingException("密码不正确，无法解密该 PDF")
            writer = PdfWriter()
            for page in reader.pages:
                writer.add_page(page)
            with open(output_path, "wb") as f:
                writer.write(f)
            return output_path
        except Exception as e:
            raise FileProcessingException(f"解密 PDF 失败: {str(e)}")
