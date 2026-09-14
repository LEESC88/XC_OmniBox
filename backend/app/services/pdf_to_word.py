import os
from pathlib import Path
from typing import Optional
from app.core.exceptions import FileProcessingException

class PdfToWordService:
    """
    借鉴 GitHub 热门开源项目 pdf2docx
    基于 PyMuPDF 版面逆向提取与 python-docx 重构
    支持精准还原表格结构、字体段落、层级样式与浮动高保真图片
    """

    @staticmethod
    def convert(
        pdf_path: Path,
        output_docx_path: Path,
        start_page: int = 0,
        end_page: Optional[int] = None
    ) -> Path:
        """
        执行 PDF 转 Word (.docx)
        :param pdf_path: 输入 PDF 路径
        :param output_docx_path: 输出 docx 路径
        :param start_page: 起始页码 (从0开始)
        :param end_page: 结束页码 (None 表示最后一页)
        :return: 生成的 docx 文件路径
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
