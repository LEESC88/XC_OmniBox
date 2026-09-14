class ToolboxException(Exception):
    """基础工具箱异常"""
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)

class FileFormatNotSupportedException(ToolboxException):
    def __init__(self, format_name: str):
        super().__init__(f"不支持的文件格式: {format_name}", status_code=415)

class FileProcessingException(ToolboxException):
    def __init__(self, detail: str):
        super().__init__(f"文件处理失败: {detail}", status_code=500)

class FileTooLargeException(ToolboxException):
    def __init__(self, max_size_mb: int):
        super().__init__(f"文件大小超出限制 (最大 {max_size_mb}MB)", status_code=413)
