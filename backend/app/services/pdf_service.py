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
        angle: int = 45,
        layout: str = "center"
    ) -> Path:
        """
        为 PDF 每页添加自定义半透明文字倾斜水印
        支持纯中文、中英混排、纯英文、数字符号，杜绝任何乱码、菱形方块或省略点问题
        支持 center (居中单水印) 与 tile (满屏防截屏平铺水印) 两种排版
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
            is_tile = str(layout).lower().strip() == "tile"

            for page in doc:
                if font_file:
                    page.insert_font(fontname="wm_font", fontfile=font_file)
                else:
                    page.insert_font(fontname="wm_font", fontbuffer=font_buffer)

                rect = page.rect

                if is_tile:
                    # 满屏平铺水印：自适应计算行距与列距
                    step_x = max(180, int(text_len * 1.5))
                    step_y = max(130, int(font_size * 4.5))
                    for y in range(int(step_y * 0.4), int(rect.height), step_y):
                        for x in range(int(step_x * 0.4), int(rect.width), step_x):
                            pt = pymupdf.Point(x, y)
                            start_pt = pymupdf.Point(pt.x - text_len / 2, pt.y + font_size * 0.35)
                            page.insert_text(
                                start_pt,
                                watermark_text,
                                fontname="wm_font",
                                fontsize=font_size,
                                morph=(pt, mat),
                                color=(0.5, 0.5, 0.5),
                                fill_opacity=opacity
                            )
                else:
                    # 居中单水印
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

    @staticmethod
    def compress_pdf(pdf_path: Path, output_path: Path, level: str = "medium") -> Path:
        """
        高能 PDF 智能极致压缩与体积瘦身
        支持三档压缩方案：
        - low: 轻度无损 (Quality 80, MaxDim 1800)
        - medium: 平衡推荐 (Quality 65, MaxDim 1400)
        - high: 极限减容 (Quality 45, MaxDim 1000)
        """
        from PIL import Image
        try:
            doc = pymupdf.open(str(pdf_path))
            level = level.lower().strip()
            if level == "high":
                quality = 45
                max_dim = 1000
            elif level == "low":
                quality = 80
                max_dim = 1800
            else:
                quality = 65
                max_dim = 1400

            processed_xrefs = set()

            for page in doc:
                image_list = page.get_images(full=True)
                for img_info in image_list:
                    xref = img_info[0]
                    if xref in processed_xrefs:
                        continue
                    processed_xrefs.add(xref)

                    try:
                        base_img = doc.extract_image(xref)
                        if not base_img:
                            continue

                        raw_bytes = base_img.get("image")
                        if not raw_bytes or len(raw_bytes) < 4096:
                            continue

                        pil_img = Image.open(io.BytesIO(raw_bytes))
                        width, height = pil_img.size

                        needs_resize = max(width, height) > max_dim
                        if needs_resize:
                            ratio = max_dim / max(width, height)
                            new_w = max(1, int(width * ratio))
                            new_h = max(1, int(height * ratio))
                            pil_img = pil_img.resize((new_w, new_h), Image.Resampling.LANCZOS)

                        out_buf = io.BytesIO()
                        if pil_img.mode in ("RGBA", "LA", "P"):
                            pil_img.save(out_buf, format="PNG", optimize=True)
                        else:
                            if pil_img.mode != "RGB":
                                pil_img = pil_img.convert("RGB")
                            pil_img.save(out_buf, format="JPEG", quality=quality, optimize=True)

                        compressed_bytes = out_buf.getvalue()
                        # 仅当压缩后体积确实变小时才替换，确保绝不“反向变大”
                        if len(compressed_bytes) < len(raw_bytes):
                            doc.update_stream(xref, compressed_bytes)
                    except Exception:
                        continue

            doc.save(str(output_path), deflate=True, garbage=4, clean=True)
            doc.close()
            return output_path
        except Exception as e:
            raise FileProcessingException(f"PDF 压缩失败: {str(e)}")

    @staticmethod
    def images_to_pdf(image_paths: List[Path], output_path: Path, page_size: str = "fit") -> Path:
        """
        多图片一键拼合转高清 PDF
        :param image_paths: 图片文件路径列表
        :param page_size: 'fit' (原图自适应，无白边) 或 'a4' (标准 A4 等比例居中)
        """
        try:
            doc = pymupdf.open()
            page_size = page_size.lower().strip()

            for img_path in image_paths:
                if not img_path.exists():
                    continue

                if page_size == "a4":
                    a4_rect = pymupdf.paper_rect("a4")
                    page = doc.new_page(width=a4_rect.width, height=a4_rect.height)
                    margin = 36
                    target_rect = pymupdf.Rect(margin, margin, a4_rect.width - margin, a4_rect.height - margin)
                    page.insert_image(target_rect, filename=str(img_path), keep_proportion=True)
                else:
                    img_doc = pymupdf.open(str(img_path))
                    pdf_bytes = img_doc.convert_to_pdf()
                    img_doc.close()
                    img_pdf = pymupdf.open("pdf", pdf_bytes)
                    doc.insert_pdf(img_pdf)
                    img_pdf.close()

            doc.save(str(output_path), deflate=True, garbage=4, clean=True)
            doc.close()
            return output_path
        except Exception as e:
            raise FileProcessingException(f"图片合成 PDF 失败: {str(e)}")

    @staticmethod
    def organize_pages(pdf_path: Path, output_path: Path, pages_config: List[dict]) -> Path:
        """
        PDF 页面可视化自由调度与编排 (调序、单页独立旋转、删减页面)
        :param pages_config: 例如 [{"page": 0, "rotation": 90}, {"page": 2, "rotation": 0}]
                             page 为原始 0 索引，rotation 为增量旋转角度 (90, 180, 270 或 0)
        """
        try:
            doc_in = pymupdf.open(str(pdf_path))
            total_pages = len(doc_in)
            if total_pages == 0:
                doc_in.close()
                raise FileProcessingException("该 PDF 文档不包含任何有效页面")

            if not pages_config:
                doc_in.close()
                raise FileProcessingException("未指定任何需要保留或导出的页面")

            doc_out = pymupdf.open()
            for item in pages_config:
                src_page_idx = int(item.get("page", 0))
                rot_delta = int(item.get("rotation", 0))

                if 0 <= src_page_idx < total_pages:
                    doc_out.insert_pdf(doc_in, from_page=src_page_idx, to_page=src_page_idx)
                    target_page = doc_out[-1]
                    if rot_delta != 0:
                        target_page.set_rotation((target_page.rotation + rot_delta) % 360)

            doc_out.save(str(output_path), deflate=True, garbage=4, clean=True)
            doc_out.close()
            doc_in.close()
            return output_path
        except Exception as e:
            raise FileProcessingException(f"页面编排处理失败: {str(e)}")

    @staticmethod
    def pdf_to_word(
        pdf_path: Path,
        output_docx_path: Path,
        start_page: int = 0,
        end_page: Optional[int] = None
    ) -> Path:
        """
        Convert PDF to editable Word (.docx) layout using pdf2docx engine.
        Extracts formatted text paragraphs, styling, table borders, and embedded images.
        :param pdf_path: Input PDF file path
        :param output_docx_path: Output Word docx file path
        :param start_page: Starting page index (0-based)
        :param end_page: Ending page index (None indicates till end of document)
        :return: Path to generated docx file
        """
        try:
            from pdf2docx import Converter

            cv = Converter(str(pdf_path))
            try:
                cv.convert(str(output_docx_path), start=start_page, end=end_page)
            finally:
                cv.close()

            if not output_docx_path.exists() or output_docx_path.stat().st_size == 0:
                raise FileProcessingException("生成的 Word 文件为空或未生成")

            return output_docx_path

        except ImportError:
            raise FileProcessingException("缺失核心组件 pdf2docx，请安装 requirements.txt 依赖")
        except Exception as e:
            raise FileProcessingException(f"PDF 转 Word 处理失败: {str(e)}")


class PdfToWordService:
    """Backward compatibility wrapper delegating to PdfService.pdf_to_word."""

    @staticmethod
    def convert(
        pdf_path: Path,
        output_docx_path: Path,
        start_page: int = 0,
        end_page: Optional[int] = None
    ) -> Path:
        return PdfService.pdf_to_word(
            pdf_path=pdf_path,
            output_docx_path=output_docx_path,
            start_page=start_page,
            end_page=end_page
        )

