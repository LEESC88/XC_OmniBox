import sys
from pathlib import Path
from fastapi.testclient import TestClient

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

from app.main import app
from app.services.editor_service import EditorService
import pymupdf

client = TestClient(app)

def test_editor_full_lifecycle(tmp_path: Path):
    """测试 PDF 编辑器的全生命周期：解析为 HTML -> 用户修改 -> 导出 PDF 和 Word"""
    # 1. 动态生成一个测试 PDF
    pdf_path = tmp_path / "sample_contract.pdf"
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_text((72, 72), "Project Agreement", fontsize=22)
    page.insert_text((72, 110), "This agreement is made between Party A and Party B.", fontsize=12)
    page.insert_text((72, 140), "Term: 12 months. Total amount: $50,000 USD.", fontsize=12)
    doc.save(str(pdf_path))
    doc.close()

    # 2. 测试解析为 HTML
    parse_result = EditorService.parse_pdf_to_html(pdf_path, tmp_path)
    assert "html" in parse_result
    assert len(parse_result["html"]) > 0
    print("[OK] PDF 成功解析为 HTML 富文本:", parse_result["html"][:120], "...")

    # 3. 模拟用户在前端像 Word 一样编辑修改（修改金额与期限）
    modified_html = """
    <h1>Project Agreement (Updated Version)</h1>
    <p>This agreement has been directly modified online in the browser.</p>
    <p><strong>Term:</strong> 24 months. <strong>Total amount:</strong> $100,000 USD.</p>
    <table border="1">
      <tr><th>Role</th><th>Name</th><th>Status</th></tr>
      <tr><td>Party A</td><td>Alice</td><td>Approved</td></tr>
      <tr><td>Party B</td><td>Bob</td><td>Signed</td></tr>
    </table>
    """

    # 4. 测试导出为高保真 PDF
    out_pdf = tmp_path / "exported_edited.pdf"
    EditorService.html_to_pdf(modified_html, out_pdf, tmp_path)
    assert out_pdf.exists() and out_pdf.stat().st_size > 0
    print(f"[OK] 编辑后成功导出高保真 PDF: {out_pdf.name} ({out_pdf.stat().st_size} bytes)")

    # 5. 测试导出为标准 Word (.docx)
    out_docx = tmp_path / "exported_edited.docx"
    EditorService.html_to_docx(modified_html, out_docx, tmp_path)
    assert out_docx.exists() and out_docx.stat().st_size > 0
    print(f"[OK] 编辑后成功导出 Word 文档: {out_docx.name} ({out_docx.stat().st_size} bytes)")

    # 6. 测试 FastAPI 接口请求
    with open(pdf_path, "rb") as f:
        res = client.post("/api/v1/editor/parse-pdf", files={"file": ("sample.pdf", f, "application/pdf")})
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    print("[OK] POST /api/v1/editor/parse-pdf 接口测试成功")

if __name__ == "__main__":
    temp_dir = BASE_DIR / "tests" / "output"
    temp_dir.mkdir(parents=True, exist_ok=True)
    print("=== 开始执行 PDF 在线编辑核心服务与 API 测试 ===")
    test_editor_full_lifecycle(temp_dir)
    print("=== 所有 PDF Edit 测试 100% 通过！===")
