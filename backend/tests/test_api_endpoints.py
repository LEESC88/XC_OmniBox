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
import pymupdf

client = TestClient(app)

def test_health_endpoint():
    """测试健康诊断端点"""
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    print(f"[OK] GET /api/v1/health 验证成功: {data}")

def test_pdf_to_word_endpoint(tmp_path: Path):
    """测试 PDF -> Word API 管道"""
    # 创建临时测试 PDF
    pdf_path = tmp_path / "test_api.pdf"
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_text((72, 100), "FastAPI TestClient PDF to Word", fontsize=16)
    doc.save(str(pdf_path))
    doc.close()

    with open(pdf_path, "rb") as f:
        res = client.post(
            "/api/v1/document/pdf-to-word",
            files={"file": ("test_api.pdf", f, "application/pdf")},
            data={"start_page": 0}
        )
    assert res.status_code == 200
    assert "application/vnd.openxmlformats-officedocument" in res.headers["content-type"]
    assert len(res.content) > 1000  # 确保返回了有效的 docx 二进制
    print(f"[OK] POST /api/v1/document/pdf-to-word 验证成功 (接收到 {len(res.content)} 字节 Word 文档)")

def test_pdf_watermark_endpoint(tmp_path: Path):
    """测试 PDF 水印 API 管道"""
    pdf_path = tmp_path / "test_watermark.pdf"
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_text((72, 100), "Watermark API Test", fontsize=16)
    doc.save(str(pdf_path))
    doc.close()

    with open(pdf_path, "rb") as f:
        res = client.post(
            "/api/v1/pdf/watermark",
            files={"file": ("test_watermark.pdf", f, "application/pdf")},
            data={"watermark_text": "CONFIDENTIAL", "opacity": 0.5, "angle": 45}
        )
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert len(res.content) > 500
    print(f"[OK] POST /api/v1/pdf/watermark 验证成功 (接收到 {len(res.content)} 字节带水印 PDF)")

if __name__ == "__main__":
    temp_dir = BASE_DIR / "tests" / "output"
    temp_dir.mkdir(parents=True, exist_ok=True)
    print("=== 开始执行 FastAPI 接口全链路测试 ===")
    test_health_endpoint()
    test_pdf_to_word_endpoint(temp_dir)
    test_pdf_watermark_endpoint(temp_dir)
    print("=== 所有 API 路由测试全部通过！===")
