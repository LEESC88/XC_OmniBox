"""
Unified Document & PDF Operations API Router.
Consolidates document conversion (PDF to Word, Word to PDF) and PDF manipulation
(merge, split, watermark, protect, unlock, compress, images-to-pdf, organize).
"""

import json
import urllib.parse
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from app.core.exceptions import FileFormatNotSupportedException, ToolboxException
from app.services.pdf_service import PdfService
from app.services.word_to_pdf import WordToPdfService
from app.utils.file_helper import add_cleanup_task, get_unique_task_dir, save_upload_file

router = APIRouter()
document_router = APIRouter(prefix="/document", tags=["Document Conversion (Word & PDF)"])
pdf_router = APIRouter(prefix="/pdf", tags=["PDF Operations (Merge/Split/Watermark/Security)"])


# ==============================================================================
# Document Conversion Endpoints (Word & PDF)
# ==============================================================================

@document_router.post("/pdf-to-word", summary="Convert PDF to Word (.docx)")
async def convert_pdf_to_word(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., description="Uploaded PDF file"),
    start_page: int = Form(0, description="Starting page index (0-based)"),
    end_page: Optional[int] = Form(None, description="Ending page index (optional, None means till last page)")
):
    """
    Receives PDF file, analyzes and extracts layout reverse-engineered via pdf2docx,
    producing high-fidelity editable Word documents. Automatically cleans up temp task directory.
    """
    if not file.filename.lower().endswith(".pdf"):
        raise FileFormatNotSupportedException("请上传有效的 .pdf 格式文件")

    task_dir = get_unique_task_dir()
    input_pdf = task_dir / "input.pdf"
    output_docx = task_dir / f"{Path(file.filename).stem}.docx"

    try:
        await save_upload_file(file, input_pdf)
        PdfService.pdf_to_word(
            pdf_path=input_pdf,
            output_docx_path=output_docx,
            start_page=start_page,
            end_page=end_page
        )

        add_cleanup_task(background_tasks, task_dir)

        encoded_filename = urllib.parse.quote(output_docx.name)
        return FileResponse(
            path=output_docx,
            filename=output_docx.name,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"}
        )
    except ToolboxException as e:
        add_cleanup_task(background_tasks, task_dir)
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        add_cleanup_task(background_tasks, task_dir)
        raise HTTPException(status_code=500, detail=f"转换处理异常: {str(e)}")


@document_router.post("/word-to-pdf", summary="Convert Word to PDF (.pdf)")
async def convert_word_to_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., description="Uploaded Word (.docx / .doc) file"),
    quality: str = Form("high", description="Output quality: light(96DPI) / standard(150DPI) / high(300DPI)")
):
    """
    Receives Word document and converts it to PDF with user-selected DPI quality.
    - light: 96 DPI screen optimized, compact file size
    - standard: 150 DPI balanced quality and size
    - high: 300+ DPI print-grade ultra high fidelity (default)
    """
    valid_exts = (".docx", ".doc")
    if not any(file.filename.lower().endswith(ext) for ext in valid_exts):
        raise FileFormatNotSupportedException("请上传有效的 .docx 或 .doc 格式文件")

    task_dir = get_unique_task_dir()
    input_docx = task_dir / file.filename
    output_pdf = task_dir / f"{Path(file.filename).stem}.pdf"

    try:
        await save_upload_file(file, input_docx)
        WordToPdfService.convert(docx_path=input_docx, output_pdf_path=output_pdf, quality=quality)

        add_cleanup_task(background_tasks, task_dir)

        encoded_filename = urllib.parse.quote(output_pdf.name)
        return FileResponse(
            path=output_pdf,
            filename=output_pdf.name,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"}
        )
    except ToolboxException as e:
        add_cleanup_task(background_tasks, task_dir)
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        add_cleanup_task(background_tasks, task_dir)
        raise HTTPException(status_code=500, detail=f"Word 转 PDF 处理异常: {str(e)}")


# ==============================================================================
# PDF Geometry & Security Operations Endpoints
# ==============================================================================

@pdf_router.post("/merge", summary="Merge multiple PDF files")
async def merge_pdfs(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(..., description="List of PDF files to merge in order")
):
    """Upload 2 or more PDF files and merge them in sequence into a single PDF document."""
    if len(files) < 2:
        raise HTTPException(status_code=400, detail="请至少上传 2 个 PDF 文件进行合并")

    task_dir = get_unique_task_dir()
    saved_paths = []

    try:
        for idx, f in enumerate(files):
            if not f.filename.lower().endswith(".pdf"):
                raise FileFormatNotSupportedException(f"文件 {f.filename} 不是有效的 PDF 文件")
            saved_p = task_dir / f"input_{idx}_{f.filename}"
            await save_upload_file(f, saved_p)
            saved_paths.append(saved_p)

        output_pdf = task_dir / "merged_document.pdf"
        PdfService.merge_pdfs(saved_paths, output_pdf)

        add_cleanup_task(background_tasks, task_dir)

        encoded_filename = urllib.parse.quote(output_pdf.name)
        return FileResponse(
            path=output_pdf,
            filename=output_pdf.name,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"}
        )
    except Exception as e:
        add_cleanup_task(background_tasks, task_dir)
        raise HTTPException(status_code=500, detail=f"PDF 合并失败: {str(e)}")


@pdf_router.post("/split", summary="Split or extract PDF pages")
async def split_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., description="PDF file to split"),
    page_ranges: Optional[str] = Form(None, description="Page ranges to extract (e.g. '1-3,5'). Empty extracts all into zip.")
):
    """Extract specific page ranges or split entire PDF into single pages in a ZIP archive."""
    if not file.filename.lower().endswith(".pdf"):
        raise FileFormatNotSupportedException("请上传有效的 .pdf 格式文件")

    task_dir = get_unique_task_dir()
    input_pdf = task_dir / file.filename

    try:
        await save_upload_file(file, input_pdf)
        split_files = PdfService.split_pdf(input_pdf, task_dir, page_ranges)

        if not split_files:
            raise HTTPException(status_code=400, detail="未提取到任何有效页面，请检查页码范围")

        add_cleanup_task(background_tasks, task_dir)

        target_file = split_files[0]
        is_zip = target_file.suffix.lower() == ".zip"
        media_type = "application/zip" if is_zip else "application/pdf"
        encoded_filename = urllib.parse.quote(target_file.name)

        return FileResponse(
            path=target_file,
            filename=target_file.name,
            media_type=media_type,
            headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"}
        )
    except Exception as e:
        add_cleanup_task(background_tasks, task_dir)
        raise HTTPException(status_code=500, detail=f"PDF 拆分失败: {str(e)}")


@pdf_router.post("/watermark", summary="Add custom text watermark")
async def add_watermark(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., description="Uploaded PDF file"),
    watermark_text: str = Form("内部机密 严禁外传", description="Watermark text content"),
    opacity: float = Form(0.3, description="Opacity (0.1 ~ 1.0)"),
    font_size: int = Form(36, description="Font size"),
    angle: int = Form(45, description="Rotation angle in degrees"),
    layout: str = Form("center", description="Watermark layout: 'center' (single) or 'tile' (screen grid)")
):
    """Apply high-definition vector angled translucent text watermark to every page of the PDF."""
    if not file.filename.lower().endswith(".pdf"):
        raise FileFormatNotSupportedException("请上传有效的 .pdf 格式文件")

    task_dir = get_unique_task_dir()
    input_pdf = task_dir / file.filename
    output_pdf = task_dir / f"watermarked_{file.filename}"

    try:
        await save_upload_file(file, input_pdf)
        PdfService.add_watermark(
            pdf_path=input_pdf,
            output_path=output_pdf,
            watermark_text=watermark_text,
            opacity=opacity,
            font_size=font_size,
            angle=angle,
            layout=layout
        )

        add_cleanup_task(background_tasks, task_dir)

        encoded_filename = urllib.parse.quote(output_pdf.name)
        return FileResponse(
            path=output_pdf,
            filename=output_pdf.name,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"}
        )
    except Exception as e:
        add_cleanup_task(background_tasks, task_dir)
        raise HTTPException(status_code=500, detail=f"添加水印失败: {str(e)}")


@pdf_router.post("/protect", summary="Protect PDF with password")
async def protect_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., description="Uploaded PDF file"),
    password: str = Form(..., description="Password to protect PDF with")
):
    """Encrypt PDF document with AES protection so it cannot be viewed without the password."""
    if not file.filename.lower().endswith(".pdf"):
        raise FileFormatNotSupportedException("请上传有效的 .pdf 格式文件")

    task_dir = get_unique_task_dir()
    input_pdf = task_dir / file.filename
    output_pdf = task_dir / f"protected_{file.filename}"

    try:
        await save_upload_file(file, input_pdf)
        PdfService.protect_pdf(input_pdf, output_pdf, user_password=password)

        add_cleanup_task(background_tasks, task_dir)

        encoded_filename = urllib.parse.quote(output_pdf.name)
        return FileResponse(
            path=output_pdf,
            filename=output_pdf.name,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"}
        )
    except Exception as e:
        add_cleanup_task(background_tasks, task_dir)
        raise HTTPException(status_code=500, detail=f"加密 PDF 失败: {str(e)}")


@pdf_router.post("/unlock", summary="Unlock protected PDF")
async def unlock_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., description="Encrypted PDF file"),
    password: str = Form(..., description="Original password used to encrypt")
):
    """Decrypt password-protected PDF document into an open PDF."""
    if not file.filename.lower().endswith(".pdf"):
        raise FileFormatNotSupportedException("请上传有效的 .pdf 格式文件")

    task_dir = get_unique_task_dir()
    input_pdf = task_dir / file.filename
    output_pdf = task_dir / f"unlocked_{file.filename}"

    try:
        await save_upload_file(file, input_pdf)
        PdfService.unlock_pdf(input_pdf, output_pdf, password=password)

        add_cleanup_task(background_tasks, task_dir)

        encoded_filename = urllib.parse.quote(output_pdf.name)
        return FileResponse(
            path=output_pdf,
            filename=output_pdf.name,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"}
        )
    except Exception as e:
        add_cleanup_task(background_tasks, task_dir)
        raise HTTPException(status_code=500, detail=f"解密 PDF 失败: {str(e)}")


@pdf_router.post("/compress", summary="Compress and optimize PDF file")
async def compress_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., description="PDF file to compress"),
    level: str = Form("medium", description="Compression level: low / medium / high")
):
    """Clean redundant objects and smart downsample embedded images to compress PDF."""
    if not file.filename.lower().endswith(".pdf"):
        raise FileFormatNotSupportedException("请上传有效的 .pdf 格式文件")

    task_dir = get_unique_task_dir()
    input_pdf = task_dir / file.filename
    output_pdf = task_dir / f"compressed_{file.filename}"

    try:
        await save_upload_file(file, input_pdf)
        original_size = input_pdf.stat().st_size
        PdfService.compress_pdf(input_pdf, output_pdf, level=level)
        compressed_size = output_pdf.stat().st_size

        add_cleanup_task(background_tasks, task_dir)

        encoded_filename = urllib.parse.quote(output_pdf.name)
        headers = {
            "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}",
            "X-Original-Size": str(original_size),
            "X-Compressed-Size": str(compressed_size),
            "Access-Control-Expose-Headers": "X-Original-Size, X-Compressed-Size, Content-Disposition"
        }
        return FileResponse(
            path=output_pdf,
            filename=output_pdf.name,
            media_type="application/pdf",
            headers=headers
        )
    except Exception as e:
        add_cleanup_task(background_tasks, task_dir)
        raise HTTPException(status_code=500, detail=f"PDF 压缩处理失败: {str(e)}")


@pdf_router.post("/images-to-pdf", summary="Combine images into PDF")
async def images_to_pdf(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(..., description="List of image files to combine"),
    page_size: str = Form("fit", description="Layout format: fit(original size) / a4(standard A4)")
):
    """Combine multiple images into a single vector-compatible PDF document."""
    if not files:
        raise HTTPException(status_code=400, detail="请至少上传一张图片进行合成")

    task_dir = get_unique_task_dir()
    saved_images: List[Path] = []
    valid_exts = (".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff", ".gif")

    try:
        for idx, f in enumerate(files):
            ext = Path(f.filename).suffix.lower()
            if ext not in valid_exts:
                continue
            saved_p = task_dir / f"img_{idx}_{f.filename}"
            await save_upload_file(f, saved_p)
            saved_images.append(saved_p)

        if not saved_images:
            raise HTTPException(status_code=400, detail="没有检测到有效的图片格式文件")

        output_pdf = task_dir / "images_combined.pdf"
        PdfService.images_to_pdf(saved_images, output_pdf, page_size=page_size)

        add_cleanup_task(background_tasks, task_dir)

        encoded_filename = urllib.parse.quote(output_pdf.name)
        return FileResponse(
            path=output_pdf,
            filename=output_pdf.name,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"}
        )
    except Exception as e:
        add_cleanup_task(background_tasks, task_dir)
        raise HTTPException(status_code=500, detail=f"图片合成 PDF 失败: {str(e)}")


@pdf_router.post("/organize", summary="Organize and reorder PDF pages")
async def organize_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., description="PDF file to reorganize"),
    pages_config: str = Form(..., description="Page configuration JSON string, e.g. [{'page':0,'rotation':90}]")
):
    """Reorder, rotate, or remove pages according to custom visual configuration."""
    if not file.filename.lower().endswith(".pdf"):
        raise FileFormatNotSupportedException("请上传有效的 .pdf 格式文件")

    try:
        config_list = json.loads(pages_config)
        if not isinstance(config_list, list):
            raise ValueError()
    except Exception:
        raise HTTPException(status_code=400, detail="pages_config 必须是有效的 JSON 数组字符串")

    task_dir = get_unique_task_dir()
    input_pdf = task_dir / file.filename
    output_pdf = task_dir / f"organized_{file.filename}"

    try:
        await save_upload_file(file, input_pdf)
        PdfService.organize_pages(input_pdf, output_pdf, config_list)

        add_cleanup_task(background_tasks, task_dir)

        encoded_filename = urllib.parse.quote(output_pdf.name)
        return FileResponse(
            path=output_pdf,
            filename=output_pdf.name,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"}
        )
    except Exception as e:
        add_cleanup_task(background_tasks, task_dir)
        raise HTTPException(status_code=500, detail=f"PDF 页面编排失败: {str(e)}")


# Mount sub-routers to the unified router
router.include_router(document_router)
router.include_router(pdf_router)
