import urllib.parse
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, UploadFile, File, Form, BackgroundTasks, HTTPException
from fastapi.responses import FileResponse

from app.utils.file_helper import get_unique_task_dir, save_upload_file, add_cleanup_task
from app.services.pdf_service import PdfService
from app.core.exceptions import FileFormatNotSupportedException, ToolboxException

router = APIRouter(prefix="/pdf", tags=["PDF Operations (Merge/Split/Watermark/Security)"])

@router.post("/merge", summary="合并多个 PDF 文件")
async def merge_pdfs(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(..., description="按顺序列出需要合并的多个 PDF 文件")
):
    """上传 2 个或更多 PDF 文件，按上传顺序拼合成单一 PDF 文档"""
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

        return FileResponse(
            path=output_pdf,
            filename="merged_document.pdf",
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=merged_document.pdf"}
        )
    except Exception as e:
        add_cleanup_task(background_tasks, task_dir)
        raise HTTPException(status_code=500, detail=f"PDF 合并失败: {str(e)}")

@router.post("/split", summary="拆分或提取指定页面")
async def split_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., description="要拆分的 PDF 文件"),
    page_ranges: Optional[str] = Form(None, description="要提取的页面范围，例如 '1-3,5'。若留空则提取单页")
):
    """指定提取特定页码（如提取 1-3 页），或将文档拆分"""
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

        # 返回第一个生成的文件（单范围模式）
        target_file = split_files[0]
        return FileResponse(
            path=target_file,
            filename=target_file.name,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={target_file.name}"}
        )
    except Exception as e:
        add_cleanup_task(background_tasks, task_dir)
        raise HTTPException(status_code=500, detail=f"PDF 拆分失败: {str(e)}")

@router.post("/watermark", summary="添加自定义防伪/防盗文字水印")
async def add_watermark(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., description="上传的 PDF 文件"),
    watermark_text: str = Form("内部机密 严禁外传", description="水印文字内容"),
    opacity: float = Form(0.3, description="水印透明度 (0.1 ~ 1.0)"),
    font_size: int = Form(36, description="字号大小"),
    angle: int = Form(45, description="水印倾斜旋转角度 (度)")
):
    """为 PDF 全文档每页中心添加高清矢量文字倾斜半透明水印"""
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
            angle=angle
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

@router.post("/protect", summary="为 PDF 设置打开与查看密码")
async def protect_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., description="上传的 PDF 文件"),
    password: str = Form(..., description="要设置的加密访问密码")
):
    """对 PDF 文档进行权限加密，未输入密码无法打开查阅"""
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

@router.post("/unlock", summary="移除 PDF 密码保护")
async def unlock_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., description="已加密的 PDF 文件"),
    password: str = Form(..., description="原先设置的打开密码")
):
    """验证原始密码并生成无密码保护的公开版 PDF"""
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
