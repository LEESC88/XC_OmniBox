import os
import sys
from pathlib import Path

# 将 backend 根目录加入 sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')


from app.services.pdf_service import PdfService
from app.services.pdf_to_word import PdfToWordService
from app.services.word_to_pdf import WordToPdfService

def create_sample_docx(target_path: Path):
    """动态创建一个包含标题、段落、表格与样式的高保真示例 Word 文档"""
    from docx import Document
    from docx.shared import Inches, Pt, RGBColor
    
    doc = Document()
    
    # 标题
    heading = doc.add_heading("全能工具箱高保真转换测试文档", level=0)
    
    # 段落
    p = doc.add_paragraph("这是一段带有强调样式的测试段落。")
    run1 = p.add_run("加粗高亮文字 ")
    run1.bold = True
    run1.font.color.rgb = RGBColor(0x1E, 0x40, 0xAF)
    
    run2 = p.add_run("包含超链接与特殊排版信息。")
    run2.italic = True
    
    # 复杂表格
    table = doc.add_table(rows=3, cols=3)
    table.style = 'Table Grid'
    headers = ["功能名称", "支持格式", "保真度与清晰度"]
    row_0 = table.rows[0]
    for idx, text in enumerate(headers):
        row_0.cells[idx].text = text
        
    data = [
        ["Word转PDF", "docx / doc", "300+ DPI 矢量与高清位图无损"],
        ["PDF转Word", "pdf", "智能逆向排版与表格结构还原"]
    ]
    for row_idx, row_data in enumerate(data):
        row = table.rows[row_idx + 1]
        for col_idx, text in enumerate(row_data):
            row.cells[col_idx].text = text

    doc.save(str(target_path))
    print(f"[OK] 成功生成测试 Word 文档: {target_path}")

def test_pdf_operations(output_dir: Path):
    """测试 PDF 页面操作：水印、合并、加密与解密"""
    import fitz
    
    # 1. 动态生成测试 PDF 1
    pdf1_path = output_dir / "sample1.pdf"
    doc1 = fitz.open()
    page1 = doc1.new_page()
    page1.insert_text((100, 100), "This is Page 1 of Doc 1", fontsize=20)
    doc1.save(str(pdf1_path))
    doc1.close()

    # 2. 动态生成测试 PDF 2
    pdf2_path = output_dir / "sample2.pdf"
    doc2 = fitz.open()
    page2 = doc2.new_page()
    page2.insert_text((100, 100), "This is Page 2 of Doc 2", fontsize=20)
    doc2.save(str(pdf2_path))
    doc2.close()

    # 3. 测试合并
    merged_path = output_dir / "merged_result.pdf"
    PdfService.merge_pdfs([pdf1_path, pdf2_path], merged_path)
    assert merged_path.exists() and merged_path.stat().st_size > 0
    print(f"[OK] PDF 合并测试通过: {merged_path.name}")

    # 4. 测试加水印
    watermark_path = output_dir / "watermarked.pdf"
    PdfService.add_watermark(merged_path, watermark_path, "TEST WATERMARK", opacity=0.4)
    assert watermark_path.exists() and watermark_path.stat().st_size > 0
    print(f"[OK] PDF 水印测试通过: {watermark_path.name}")

    # 5. 测试加密
    protected_path = output_dir / "protected.pdf"
    PdfService.protect_pdf(merged_path, protected_path, "secret123")
    assert protected_path.exists() and protected_path.stat().st_size > 0
    print(f"[OK] PDF 加密测试通过: {protected_path.name}")

    # 6. 测试解密
    unlocked_path = output_dir / "unlocked.pdf"
    PdfService.unlock_pdf(protected_path, unlocked_path, "secret123")
    assert unlocked_path.exists() and unlocked_path.stat().st_size > 0
    print(f"[OK] PDF 解密测试通过: {unlocked_path.name}")

    # 7. 测试拆分
    split_dir = output_dir / "splits"
    split_dir.mkdir(exist_ok=True)
    splits = PdfService.split_pdf(merged_path, split_dir, page_ranges="1")
    assert len(splits) == 1 and splits[0].exists()
    print(f"[OK] PDF 拆分/提取测试通过: {splits[0].name}")

def test_pdf_to_word(output_dir: Path):
    """测试 PDF 逆向转 Word"""
    import fitz
    
    test_pdf = output_dir / "pdf_for_conversion.pdf"
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 100), "Hello World! PDF to Word Test", fontsize=18)
    page.insert_text((72, 140), "This document tests layout reverse engineering.", fontsize=12)
    doc.save(str(test_pdf))
    doc.close()

    out_docx = output_dir / "converted_from_pdf.docx"
    PdfToWordService.convert(test_pdf, out_docx)
    assert out_docx.exists() and out_docx.stat().st_size > 0
    print(f"[OK] PDF 转 Word 测试通过: {out_docx.name} ({out_docx.stat().st_size} bytes)")

if __name__ == "__main__":
    test_dir = BASE_DIR / "tests" / "output"
    test_dir.mkdir(parents=True, exist_ok=True)
    
    print("=== 开始执行全能工具箱后端核心服务验证 ===")
    test_pdf_operations(test_dir)
    test_pdf_to_word(test_dir)
    print("=== 所有核心算法与服务验证顺利通过！===")
