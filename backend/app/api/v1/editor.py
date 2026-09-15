import urllib.parse
from pathlib import Path
from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, UploadFile, File, Form, BackgroundTasks, HTTPException
from fastapi.responses import FileResponse, JSONResponse

from app.utils.file_helper import get_unique_task_dir, save_upload_file, add_cleanup_task
from app.services.editor_service import EditorService
from app.core.exceptions import FileFormatNotSupportedException, ToolboxException

router = APIRouter(prefix="/editor", tags=["PDF Online Editor (WYSIWYG)"])

class ExportRequest(BaseModel):
    html: str
    filename: Optional[str] = "edited_document"

@router.post("/parse-pdf", summary="上传 PDF 并解析为结构化富文本流")
async def parse_pdf_for_editor(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., description="上传待编辑的 PDF 文件")
):
    """
    接收 PDF，通过 pdf2docx 和 mammoth 深度提取排版、标题、样式、表格与图片，
    返回包含精美 HTML5 的富文本数据，供前端在线 Word 级工作台直接加载并随意编辑。
    """
    if not file.filename.lower().endswith(".pdf"):
        raise FileFormatNotSupportedException("请上传有效的 .pdf 文件")

    task_dir = get_unique_task_dir()
    input_pdf = task_dir / file.filename

    try:
        await save_upload_file(file, input_pdf)
        result = EditorService.parse_pdf_to_html(input_pdf, task_dir)
        add_cleanup_task(background_tasks, task_dir)
        return {
            "success": True,
            "title": result["title"],
            "html": result["html"]
        }
    except Exception as e:
        add_cleanup_task(background_tasks, task_dir)
        raise HTTPException(status_code=500, detail=f"解析 PDF 富文本失败: {str(e)}")

@router.post("/export-pdf", summary="将编辑后的富文本导出为高质量 PDF")
async def export_edited_pdf(
    background_tasks: BackgroundTasks,
    payload: ExportRequest
):
    """
    接收用户在网页上编辑修改后的 HTML 内容，
    调用 Windows 原生 Word 打印级引擎以 300+ DPI 超清画质导出 PDF 并自动下载。
    """
    if not payload.html.strip():
        raise HTTPException(status_code=400, detail="HTML 内容不能为空")

    task_dir = get_unique_task_dir()
    clean_stem = Path(payload.filename or "edited_document").stem
    output_pdf = task_dir / f"{clean_stem}.pdf"

    try:
        EditorService.html_to_pdf(payload.html, output_pdf, task_dir)
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
        raise HTTPException(status_code=500, detail=f"导出 PDF 失败: {str(e)}")

@router.post("/export-docx", summary="将编辑后的富文本导出为可编辑 Word")
async def export_edited_docx(
    background_tasks: BackgroundTasks,
    payload: ExportRequest
):
    """
    接收编辑后的 HTML 内容，导出为标准可编辑的 Word (.docx) 文档。
    """
    if not payload.html.strip():
        raise HTTPException(status_code=400, detail="HTML 内容不能为空")

    task_dir = get_unique_task_dir()
    clean_stem = Path(payload.filename or "edited_document").stem
    output_docx = task_dir / f"{clean_stem}.docx"

    try:
        EditorService.html_to_docx(payload.html, output_docx, task_dir)
        add_cleanup_task(background_tasks, task_dir)

        encoded_filename = urllib.parse.quote(output_docx.name)
        return FileResponse(
            path=output_docx,
            filename=output_docx.name,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"}
        )
    except Exception as e:
        add_cleanup_task(background_tasks, task_dir)
        raise HTTPException(status_code=500, detail=f"导出 Word 失败: {str(e)}")
