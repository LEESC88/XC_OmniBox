import io
import zipfile
from pathlib import Path
from typing import List, Optional
import pymupdf
from app.core.exceptions import FileProcessingException

class PdfService:
    """
    PDF 页面操作与安全引擎 (统一采用 PyMuPDF C++ 底层原生驱动)
    提供毫秒级、无损、低资源占用的 PDF 几何操作与安全加解密，性能比纯 Python 库快 5~15 倍
    """

    @staticmethod
    def merge_pdfs(pdf_paths: List[Path], output_path: Path) -> Path:
        """合并多个 PDF 文件，保持原始顺序与高保真矢量排版 (PyMuPDF 原生加速)"""
        try:
            doc_out = pymupdf.open()
            for p in pdf_paths:
                doc_in = pymupdf.open(str(p))
                doc_out.insert_pdf(doc_in)
                doc_in.close()
            doc_out.save(str(output_path), deflate=True, garbage=4, clean=True)
            doc_out.close()
            return output_path
        except Exception as e:
            raise FileProcessingException(f"合并 PDF 失败: {str(e)}")

    @staticmethod
    def split_pdf(pdf_path: Path, output_dir: Path, page_ranges: Optional[str] = None) -> List[Path]:
        """
        拆分 PDF 或按指定范围提取页面
        :param page_ranges: 如 '1,3,5-7'；若为 None 或空则将全文档拆分为单页并自动打包为 .zip
        """
        try:
            doc_in = pymupdf.open(str(pdf_path))
            total_pages = len(doc_in)
            if total_pages == 0:
                doc_in.close()
                return []

            pdf_stem = pdf_path.stem
            output_files: List[Path] = []

            # 模式 A: 未指定范围，拆分为单页独立 PDF 并打包为 ZIP 压缩包
            if not page_ranges or not page_ranges.strip():
                zip_path = output_dir / f"{pdf_stem}_all_pages.zip"
                with zipfile.ZipFile(str(zip_path), "w", compression=zipfile.ZIP_DEFLATED) as zf:
                    for idx in range(total_pages):
                        doc_single = pymupdf.open()
                        doc_single.insert_pdf(doc_in, from_page=idx, to_page=idx)
                        single_file = output_dir / f"{pdf_stem}_page_{idx + 1}.pdf"
                        doc_single.save(str(single_file), deflate=True, garbage=4, clean=True)
                        doc_single.close()
                        zf.write(str(single_file), arcname=single_file.name)
                        output_files.append(single_file)
                doc_in.close()
                # 首位返回 zip 文件供前端主要下载
                return [zip_path] + output_files

            # 模式 B: 解析页码范围 (例如: 1-3, 5) 提取到单个新 PDF
            target_indices = set()
            for part in page_ranges.split(","):
                part = part.strip()
                if not part:
                    continue
                if "-" in part:
                    start_str, end_str = part.split("-", 1)
                    try:
                        s = max(1, int(start_str.strip()))
                        e = min(total_pages, int(end_str.strip()))
                        for p in range(s, e + 1):
                            target_indices.add(p - 1)
                    except ValueError:
                        continue
                else:
                    try:
                        p = int(part)
                        if 1 <= p <= total_pages:
                            target_indices.add(p - 1)
                    except ValueError:
                        continue

            if not target_indices:
                doc_in.close()
                return []

            doc_out = pymupdf.open()
            for idx in sorted(target_indices):
                doc_out.insert_pdf(doc_in, from_page=idx, to_page=idx)

            out_file = output_dir / f"extracted_{pdf_stem}.pdf"
            doc_out.save(str(out_file), deflate=True, garbage=4, clean=True)
            doc_out.close()
            doc_in.close()
            return [out_file]

        except Exception as e:
            raise FileProcessingException(f"拆分/提取 PDF 失败: {str(e)}")

    @staticmethod
    def rotate_pdf(pdf_path: Path, output_path: Path, angle: int = 90) -> Path:
        """顺时针旋转 PDF 所有页面 (支持 90, 180, 270)"""
        try:
            doc = pymupdf.open(str(pdf_path))
            for page in doc:
                page.set_rotation((page.rotation + angle) % 360)
            doc.save(str(output_path), deflate=True, garbage=4, clean=True)
            doc.close()
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
        支持纯中文、中英混排、纯英文、数字符号，杜绝任何乱码、菱形方块或省略点问题
        """
        try:
            import pymupdf
            
            doc = pymupdf.open(str(pdf_path))
            
            # 首选 Windows 官方预装超清晰高对比 TrueType 中文字体 (优先 SimHei 黑体，粗壮醒目极适宜水印)
            font_file = None
            candidate_fonts = [
                Path("C:/Windows/Fonts/simhei.ttf"),
                Path("C:/Windows/Fonts/msyh.ttc"),
                Path("C:/Windows/Fonts/simsun.ttc"),
                Path("/System/Library/Fonts/PingFang.ttc"), # macOS
                Path("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"), # Linux
            ]
            for p in candidate_fonts:
                if p.exists():
                    font_file = str(p)
                    break

            if font_file:
                font = pymupdf.Font(fontfile=font_file)
                font_buffer = None
            else:
                # 若非 Windows 或系统字体缺失，平滑回退到 PyMuPDF 官方内置 CJK 字体
                font = pymupdf.Font("china-s")
                font_buffer = font.buffer

            font_size = max(8, font_size)
            opacity = max(0.05, min(1.0, opacity))
            text_len = font.text_length(watermark_text, fontsize=font_size)
            mat = pymupdf.Matrix(angle)

            for page in doc:
                if font_file:
                    page.insert_font(fontname="wm_font", fontfile=font_file)
                else:
                    page.insert_font(fontname="wm_font", fontbuffer=font_buffer)

                rect = page.rect
                center_point = pymupdf.Point(rect.width / 2, rect.height / 2)
                start_pt = pymupdf.Point(center_point.x - text_len / 2, center_point.y + font_size * 0.35)

                page.insert_text(
                    start_pt,
                    watermark_text,
                    fontname="wm_font",
                    fontsize=font_size,
                    morph=(center_point, mat),
                    color=(0.5, 0.5, 0.5),
                    fill_opacity=opacity
                )

            # 字体子集化压缩，将嵌入字体体积大幅度瘦身
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
        """为 PDF 添加访问密码保护与权限加密 (基于 AES-256 标准工业级加密)"""
        try:
            doc = pymupdf.open(str(pdf_path))
            doc.save(
                str(output_path),
                encryption=pymupdf.PDF_ENCRYPT_AES_256,
                user_pw=user_password,
                owner_pw=user_password,
                deflate=True,
                garbage=4,
                clean=True
            )
            doc.close()
            return output_path
        except Exception as e:
            raise FileProcessingException(f"加密 PDF 失败: {str(e)}")

    @staticmethod
    def unlock_pdf(pdf_path: Path, output_path: Path, password: str) -> Path:
        """输入密码解除 PDF 保护并另存为无密码公开版本"""
        try:
            doc = pymupdf.open(str(pdf_path))
            if doc.needs_pass or doc.is_encrypted:
                auth_res = doc.authenticate(password)
                if auth_res <= 0:
                    doc.close()
                    raise FileProcessingException("密码不正确，无法解密该 PDF")
            doc.save(str(output_path), deflate=True, garbage=4, clean=True)
            doc.close()
            return output_path
        except Exception as e:
            raise FileProcessingException(f"解密 PDF 失败: {str(e)}")
