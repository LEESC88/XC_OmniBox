import os
import shutil
import uuid
from pathlib import Path
from fastapi import UploadFile, BackgroundTasks
from app.core.config import TEMP_DIR
from app.core.exceptions import FileTooLargeException, ToolboxException

def get_unique_task_dir() -> Path:
    """为每次文件处理任务创建一个唯一的临时文件夹"""
    task_id = str(uuid.uuid4())
    task_dir = TEMP_DIR / task_id
    task_dir.mkdir(parents=True, exist_ok=True)
    return task_dir

async def save_upload_file(upload_file: UploadFile, destination: Path, max_size_bytes: int = 100 * 1024 * 1024) -> int:
    """异步安全保存上传文件并校验大小"""
    size = 0
    chunk_size = 1024 * 1024  # 1MB
    with open(destination, "wb") as buffer:
        while True:
            chunk = await upload_file.read(chunk_size)
            if not chunk:
                break
            size += len(chunk)
            if size > max_size_bytes:
                buffer.close()
                if destination.exists():
                    destination.unlink()
                raise FileTooLargeException(max_size_mb=max_size_bytes // (1024 * 1024))
            buffer.write(chunk)
    return size

def cleanup_directory(directory_path: Path):
    """安全递归删除临时任务文件夹"""
    try:
        if directory_path.exists() and directory_path.is_dir():
            shutil.rmtree(directory_path, ignore_errors=True)
    except Exception as e:
        print(f"Warning: Failed to cleanup {directory_path}: {e}")

def add_cleanup_task(background_tasks: BackgroundTasks, directory_path: Path):
    """注册后台任务，响应完成后自动清理临时文件，保护用户隐私并节省磁盘"""
    background_tasks.add_task(cleanup_directory, directory_path)
