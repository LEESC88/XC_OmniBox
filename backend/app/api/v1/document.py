import urllib.parse
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, UploadFile, File, Form, BackgroundTasks, HTTPException
from fastapi.responses import FileResponse

from app.utils.file_helper import get_unique_task_dir, save_upload_file, add_cleanup_task
from app.services.pdf_to_word import PdfToWordService
from app.services.word_to_pdf import WordToPdfService
from app.core.exceptions import FileFormatNotSupportedException, ToolboxException

router = APIRouter(prefix="/document", tags=["Document Conversion (Word & PDF)"])

@router.post("/pdf-to-word", summary="PDF 转 Word (.docx)")
async def convert_pdf_to_word(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., description="上传的 PDF 文件"),
    start_page: int = Form(0, description="起始页码 (从 0 开始计数)"),
    end_page: Optional[int] = Form(None, description="结束页码 (留空表示转换到最后一页)")
):
    """
    接收 PDF 文件，基于开源 pdf2docx 引擎逆向分析排版，
    提取文本段落、样式、表格边框合并与高清内嵌图片，输出高保真可编辑 Word。
    处理完毕后自动通过后台任务擦除服务器临时文件，保障隐私。
    """
    if not file.filename.lower().endswith(".pdf"):
        raise FileFormatNotSupportedException("请上传有效的 .pdf 格式文件")

    task_dir = get_unique_task_dir()
    input_pdf = task_dir / "input.pdf"
    output_docx = task_dir / f"{Path(file.filename).stem}.docx"

    try:
        await save_upload_file(file, input_pdf)
        PdfToWordService.convert(
            pdf_path=input_pdf,
            output_docx_path=output_docx,
            start_page=start_page,
            end_page=end_page
        )

        add_cleanup_task(background_tasks, task_dir)

        # 编码文件名以支持中文
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

@router.post("/word-to-pdf", summary="Word 转高质量 PDF (300+ DPI 原图保真)")
async def convert_word_to_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., description="上传的 Word (.docx / .doc) 文件")
):
    """
    接收 Word 文档，以打印级超高质量 (300+ DPI 矢量与位图无损) 渲染导出为 PDF。
    避免市面常规工具出现的图片压缩模糊与排版跑位问题。
    """
    valid_exts = (".docx", ".doc")
    if not any(file.filename.lower().endswith(ext) for ext in valid_exts):
        raise FileFormatNotSupportedException("请上传有效的 .docx 或 .doc 格式文件")

    task_dir = get_unique_task_dir()
    input_docx = task_dir / file.filename
    output_pdf = task_dir / f"{Path(file.filename).stem}.pdf"

    try:
        await save_upload_file(file, input_docx)
        WordToPdfService.convert(docx_path=input_docx, output_pdf_path=output_pdf)

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
