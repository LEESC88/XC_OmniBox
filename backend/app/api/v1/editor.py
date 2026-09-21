import json
import urllib.parse
from pathlib import Path
from typing import Optional, List
from fastapi import APIRouter, UploadFile, File, Form, BackgroundTasks, HTTPException
from fastapi.responses import FileResponse

from app.utils.file_helper import get_unique_task_dir, save_upload_file, add_cleanup_task
from app.services.editor_service import EditorService
from app.core.exceptions import FileFormatNotSupportedException

router = APIRouter(prefix="/editor", tags=["1:1 In-Place Visual PDF Editor"])

@router.post("/render-pages", summary="解析原版 PDF 并渲染 1:1 页面与物理文字坐标")
async def render_pdf_pages(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., description="上传待编辑的原始 PDF 文件"),
    dpi: int = Form(150, description="页面渲染清晰度 (默认 150 DPI)"),
    max_pages: Optional[int] = Form(None, description="最多渲染页数 (用于缩略图提速)"),
    extract_words: bool = Form(True, description="是否提取物理文字块")
):
    """
    高保真提取原版真实 PDF 页面图像与每一个物理文字块的精确绝对坐标 (x0, y0, x1, y1)。
    前端据此在原版画面上精准覆盖交互热区，实现原版视觉 1:1 毫无偏差的编辑体验。
    """
    if not file.filename.lower().endswith(".pdf"):
        raise FileFormatNotSupportedException("请上传有效的 .pdf 格式文件")

    task_dir = get_unique_task_dir()
    input_pdf = task_dir / file.filename

    try:
        await save_upload_file(file, input_pdf)
        data = EditorService.render_pdf_pages_and_words(
            input_pdf,
            dpi=dpi,
            max_pages=max_pages,
            extract_words=extract_words
        )
        add_cleanup_task(background_tasks, task_dir)
        return {
            "success": True,
            "title": data["title"],
            "numPages": data["numPages"],
            "pages": data["pages"]
        }
    except Exception as e:
        add_cleanup_task(background_tasks, task_dir)
        raise HTTPException(status_code=500, detail=f"渲染解析 PDF 失败: {str(e)}")

@router.post("/apply-modifications", summary="原子级原地修改并导出 100% 不跑偏的 PDF")
async def apply_modifications(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., description="上传的原始 PDF 文件"),
    modifications: str = Form(..., description="JSON 格式的修改项列表")
):
    """
    接收用户在原版页面上的所有原位改字、涂抹遮白和新增文字项，
    直接在原版 PDF 的物理二进制层上执行原子级覆盖另存。
    原文档的所有未修改部分（排版、字体、间距、线条、表格）100% 绝对不跑偏！
    """
    if not file.filename.lower().endswith(".pdf"):
        raise FileFormatNotSupportedException("请上传有效的 .pdf 格式文件")

    try:
        mod_list = json.loads(modifications)
    except Exception:
        raise HTTPException(status_code=400, detail="modifications 参数必须是合法的 JSON 列表")

    task_dir = get_unique_task_dir()
    input_pdf = task_dir / "original.pdf"
    clean_stem = Path(file.filename).stem
    output_pdf = task_dir / f"{clean_stem}_edited.pdf"

    try:
        await save_upload_file(file, input_pdf)
        EditorService.apply_inplace_modifications(input_pdf, mod_list, output_pdf)

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
        raise HTTPException(status_code=500, detail=f"保存修改后的 PDF 失败: {str(e)}")
