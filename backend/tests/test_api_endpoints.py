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
            data={"watermark_text": "内部机密 严禁外传", "opacity": 0.5, "angle": 45}
        )
    assert res.status_code == 200
    assert len(res.content) > 0
    # 验证输出 PDF 可以被正确读取并且提取到中文字符
    doc = pymupdf.open(stream=res.content, filetype="pdf")
    page_text = doc[0].get_text()
    assert "内部机密" in page_text
    print(f"[OK] POST /api/v1/pdf/watermark 中文水印验证成功 (接收到 {len(res.content)} 字节带水印 PDF)")

def test_render_pages_thumbnail(tmp_path: Path):
    """测试 PDF 页面快速缩略图渲染接口 (max_pages=1, extract_words=False)"""
    pdf_path = tmp_path / "test_thumb.pdf"
    doc = pymupdf.open()
    p1 = doc.new_page()
    p1.insert_text((72, 100), "Page 1 Content", fontsize=16)
    p2 = doc.new_page()
    p2.insert_text((72, 100), "Page 2 Content", fontsize=16)
    doc.save(str(pdf_path))
    doc.close()

    with open(pdf_path, "rb") as f:
        res = client.post(
            "/api/v1/editor/render-pages",
            files={"file": ("test_thumb.pdf", f, "application/pdf")},
            data={"dpi": 70, "max_pages": 1, "extract_words": False}
        )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["numPages"] == 2
    assert len(data["pages"]) == 1
    assert data["pages"][0]["image"].startswith("data:image/png;base64,")
    print(f"[OK] POST /api/v1/editor/render-pages (快速缩略图模式) 验证成功: 总页数 {data['numPages']}, 渲染 {len(data['pages'])} 页")

def test_pdf_split_endpoint(tmp_path: Path):
    """测试 PDF 拆分/提取接口"""
    pdf_path = tmp_path / "test_split.pdf"
    doc = pymupdf.open()
    for i in range(3):
        p = doc.new_page()
        p.insert_text((72, 100), f"Page {i+1}", fontsize=16)
    doc.save(str(pdf_path))
    doc.close()

    with open(pdf_path, "rb") as f:
        res = client.post(
            "/api/v1/pdf/split",
            files={"file": ("test_split.pdf", f, "application/pdf")},
            data={"page_ranges": "1, 3"}
        )
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert len(res.content) > 500
    print(f"[OK] POST /api/v1/pdf/split (页面提取) 验证成功")

if __name__ == "__main__":
    temp_dir = BASE_DIR / "tests" / "output"
    temp_dir.mkdir(parents=True, exist_ok=True)
    print("=== 开始执行 FastAPI 接口全链路测试 ===")
    test_health_endpoint()
    test_pdf_to_word_endpoint(temp_dir)
    test_pdf_watermark_endpoint(temp_dir)
    test_render_pages_thumbnail(temp_dir)
    test_pdf_split_endpoint(temp_dir)
    print("=== 所有 API 路由测试全部通过！===")
