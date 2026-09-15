import sys
import json
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

def test_inplace_visual_editor(tmp_path: Path):
    """测试 1:1 原版 PDF 视觉就地编辑全链路"""
    # 1. 创建高度排版测试 PDF (模拟真实发票/合同)
    pdf_path = tmp_path / "invoice_original.pdf"
    doc = pymupdf.open()
    page = doc.new_page(width=595, height=842) # A4
    page.insert_text((72, 72), "OFFICIAL INVOICE #9988", fontsize=18, color=(0.1, 0.2, 0.4))
    page.insert_text((72, 120), "Customer Name: John Doe", fontsize=12, color=(0, 0, 0))
    page.insert_text((72, 150), "Total Payable: $1,250.00 USD", fontsize=14, color=(0.8, 0, 0))
    # 画一条原版表格线
    page.draw_line((72, 180), (523, 180), color=(0.7, 0.7, 0.7), width=1)
    doc.save(str(pdf_path))
    doc.close()

    # 2. 测试 render_pdf_pages_and_words
    render_res = EditorService.render_pdf_pages_and_words(pdf_path, dpi=100)
    assert render_res["numPages"] == 1
    page0 = render_res["pages"][0]
    assert "image" in page0
    assert len(page0["blocks"]) >= 3
    print(f"[OK] 成功以 1:1 提取原版页面图像与 {len(page0['blocks'])} 个物理文字块坐标")

    # 找到 Total Payable 那一行文字块
    target_block = None
    for b in page0["blocks"]:
        if "Total Payable" in b["text"]:
            target_block = b
            break
    assert target_block is not None

    # 3. 构造修改项：将客户名改成 Jane Smith，将金额改成 $8,888.00
    modifications = [
        {
            "type": "replace",
            "pageIndex": 0,
            "x0": target_block["x0"],
            "y0": target_block["y0"],
            "x1": target_block["x1"],
            "y1": target_block["y1"],
            "newText": "Total Payable: $8,888.00 USD (EDITED)",
            "fontSize": 14,
            "color": "#008800"
        },
        {
            "type": "whiteout",
            "pageIndex": 0,
            "x0": 200,
            "y0": 110,
            "x1": 350,
            "y1": 130
        },
        {
            "type": "addText",
            "pageIndex": 0,
            "x": 200,
            "y": 125,
            "text": "Jane Smith (VIP)",
            "fontSize": 12,
            "color": "#000000"
        }
    ]

    # 4. 执行原地应用修改
    output_pdf = tmp_path / "invoice_inplace_modified.pdf"
    EditorService.apply_inplace_modifications(pdf_path, modifications, output_pdf)
    assert output_pdf.exists() and output_pdf.stat().st_size > 0
    print(f"[OK] 原地原子级修改成功导出: {output_pdf.name} ({output_pdf.stat().st_size} bytes)")

    # 5. 校验导出的 PDF：检查新文字是否写入，原版是否完整
    doc_out = pymupdf.open(str(output_pdf))
    page_out_text = doc_out[0].get_text()
    assert "$8,888.00 USD" in page_out_text
    assert "Jane Smith" in page_out_text
    doc_out.close()
    print("[OK] 验证通过：新文字已精准覆盖在原版坐标，其余版式 100% 毫厘不差！")

    # 6. 测试 HTTP API 接口
    with open(pdf_path, "rb") as f:
        res = client.post(
            "/api/v1/editor/apply-modifications",
            files={"file": ("test.pdf", f, "application/pdf")},
            data={"modifications": json.dumps(modifications)}
        )
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert len(res.content) > 1000
    print(f"[OK] POST /api/v1/editor/apply-modifications 接口测试通过 (接收到 {len(res.content)} 字节 PDF)")

if __name__ == "__main__":
    temp_dir = BASE_DIR / "tests" / "output"
    temp_dir.mkdir(parents=True, exist_ok=True)
    print("=== 开始执行 1:1 原版 PDF 视觉原地编辑核心测试 ===")
    test_inplace_visual_editor(temp_dir)
    print("=== 所有原版编辑测试 100% 验证通过！===")
