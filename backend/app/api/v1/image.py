import urllib.parse
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, UploadFile, File, Form, BackgroundTasks, HTTPException
from fastapi.responses import FileResponse

from app.utils.file_helper import get_unique_task_dir, save_upload_file, add_cleanup_task
from app.services.image_service import ImageService
from app.core.exceptions import FileFormatNotSupportedException

router = APIRouter(prefix="/image", tags=["Image Suite - 图片处理工具箱"])

@router.post("/convert", summary="图像格式转换 (支持 WebP, PNG, JPG, ICO, BMP)")
async def convert_image(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., description="上传待转换的图片"),
    target_format: str = Form("webp", description="目标格式: webp, png, jpg, ico, bmp"),
    quality: int = Form(85, description="画质 (1-100)"),
    fill_bg: str = Form("#FFFFFF", description="透明通道转JPG时的填充底色")
):
    task_dir = get_unique_task_dir()
    input_path = task_dir / file.filename

    stem = Path(file.filename).stem
    target_fmt_lower = target_format.lower()
    ext = "jpg" if target_fmt_lower == "jpeg" else target_fmt_lower
    output_filename = f"{stem}.{ext}"
    output_path = task_dir / output_filename

    try:
        await save_upload_file(file, input_path)

        if target_fmt_lower == "ico":
            ImageService.generate_ico(input_path, output_path)
        else:
            ImageService.convert_image(input_path, output_path, target_format=target_format, quality=quality, fill_bg=fill_bg)

        add_cleanup_task(background_tasks, task_dir)

        mime_map = {
            "webp": "image/webp",
            "png": "image/png",
            "jpg": "image/jpeg",
            "jpeg": "image/jpeg",
            "ico": "image/x-icon",
            "bmp": "image/bmp",
        }
        media_type = mime_map.get(target_fmt_lower, "application/octet-stream")
        encoded_filename = urllib.parse.quote(output_filename)

        return FileResponse(
            path=output_path,
            filename=output_filename,
            media_type=media_type,
            headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"}
        )
    except Exception as e:
        add_cleanup_task(background_tasks, task_dir)
        raise HTTPException(status_code=500, detail=f"图片转换失败: {str(e)}")

@router.post("/strip-exif", summary="清除图片 EXIF 与 GPS 隐私数据")
async def strip_exif_metadata(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., description="上传需要清理隐私元数据的图片")
):
    task_dir = get_unique_task_dir()
    input_path = task_dir / file.filename

    stem = Path(file.filename).stem
    suffix = Path(file.filename).suffix
    output_filename = f"{stem}_no_exif{suffix}"
    output_path = task_dir / output_filename

    try:
        await save_upload_file(file, input_path)
        ImageService.strip_exif_metadata(input_path, output_path)
        add_cleanup_task(background_tasks, task_dir)

        encoded_filename = urllib.parse.quote(output_filename)
        return FileResponse(
            path=output_path,
            filename=output_filename,
            media_type="application/octet-stream",
            headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"}
        )
    except Exception as e:
        add_cleanup_task(background_tasks, task_dir)
        raise HTTPException(status_code=500, detail=f"清除 EXIF 失败: {str(e)}")
