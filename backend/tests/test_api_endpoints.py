import io
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

    # Test tile layout
    with open(pdf_path, "rb") as f:
        res_tile = client.post(
            "/api/v1/pdf/watermark",
            files={"file": ("test_watermark.pdf", f, "application/pdf")},
            data={"watermark_text": "CONFIDENTIAL TILE", "opacity": 0.3, "angle": 30, "layout": "tile"}
        )
    assert res_tile.status_code == 200
    assert len(res_tile.content) > 0
    doc_tile = pymupdf.open(stream=res_tile.content, filetype="pdf")
    tile_text = doc_tile[0].get_text()
    assert "CONFIDENTIAL TILE" in tile_text
    print(f"[OK] POST /api/v1/pdf/watermark 平铺矩阵水印验证成功 (接收到 {len(res_tile.content)} 字节)")

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

def test_pdf_split_all_zip_endpoint(tmp_path: Path):
    """测试 PDF 全量拆分为单页 ZIP 压缩包接口"""
    import zipfile
    import io
    pdf_path = tmp_path / "test_split_all.pdf"
    doc = pymupdf.open()
    for i in range(4):
        p = doc.new_page()
        p.insert_text((72, 100), f"Split Page {i+1}", fontsize=16)
    doc.save(str(pdf_path))
    doc.close()

    with open(pdf_path, "rb") as f:
        res = client.post(
            "/api/v1/pdf/split",
            files={"file": ("test_split_all.pdf", f, "application/pdf")}
        )
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/zip"
    assert "filename*=UTF-8''test_split_all_all_pages.zip" in res.headers["content-disposition"]
    
    # 验证 zip 包内容
    with zipfile.ZipFile(io.BytesIO(res.content)) as zf:
        namelist = zf.namelist()
        assert len(namelist) == 4
        assert "test_split_all_page_1.pdf" in namelist
        assert "test_split_all_page_4.pdf" in namelist
    print(f"[OK] POST /api/v1/pdf/split (全量拆分为 ZIP 压缩包) 验证成功: 包含 {len(namelist)} 个单页 PDF")

def test_pdf_compress_endpoint(tmp_path: Path):
    """测试 PDF 智能压缩瘦身接口"""
    from PIL import Image
    pdf_path = tmp_path / "test_compress.pdf"
    doc = pymupdf.open()
    page = doc.new_page()
    img = Image.new("RGB", (600, 600), color="blue")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    page.insert_image(page.rect, stream=buf.getvalue())
    doc.save(str(pdf_path))
    doc.close()

    with open(pdf_path, "rb") as f:
        res = client.post(
            "/api/v1/pdf/compress",
            files={"file": ("test_compress.pdf", f, "application/pdf")},
            data={"level": "medium"}
        )
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert "x-original-size" in res.headers
    assert "x-compressed-size" in res.headers
    assert int(res.headers["x-compressed-size"]) <= int(res.headers["x-original-size"])
    print(f"[OK] POST /api/v1/pdf/compress 验证成功: 原体积 {res.headers['x-original-size']}B -> 压缩后 {res.headers['x-compressed-size']}B")

def test_images_to_pdf_endpoint(tmp_path: Path):
    """测试多图片一键拼合转 PDF 接口"""
    from PIL import Image
    img1_path = tmp_path / "photo1.jpg"
    img2_path = tmp_path / "photo2.png"
    Image.new("RGB", (300, 300), color="red").save(img1_path)
    Image.new("RGB", (400, 400), color="green").save(img2_path)

    with open(img1_path, "rb") as f1, open(img2_path, "rb") as f2:
        res = client.post(
            "/api/v1/pdf/images-to-pdf",
            files=[
                ("files", ("photo1.jpg", f1, "image/jpeg")),
                ("files", ("photo2.png", f2, "image/png")),
            ],
            data={"page_size": "fit"}
        )
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    
    # 验证生成的 PDF 为 2 页
    doc = pymupdf.open(stream=res.content, filetype="pdf")
    assert len(doc) == 2
    doc.close()
    print(f"[OK] POST /api/v1/pdf/images-to-pdf 验证成功: 成功拼合 2 页 PDF")

def test_pdf_organize_endpoint(tmp_path: Path):
    """测试 PDF 页面可视化调度与编排接口 (调序/旋转/删减)"""
    import json
    pdf_path = tmp_path / "test_organize.pdf"
    doc = pymupdf.open()
    for i in range(3):
        p = doc.new_page()
        p.insert_text((72, 100), f"Page {i+1}", fontsize=16)
    doc.save(str(pdf_path))
    doc.close()

    # 目标配置: 提取原第 3 页 (索引 2) 旋转 90°, 提取原第 1 页 (索引 0) 旋转 180°
    config = [{"page": 2, "rotation": 90}, {"page": 0, "rotation": 180}]

    with open(pdf_path, "rb") as f:
        res = client.post(
            "/api/v1/pdf/organize",
            files={"file": ("test_organize.pdf", f, "application/pdf")},
            data={"pages_config": json.dumps(config)}
        )
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    
    # 验证生成的 PDF 为 2 页，且每页旋转正确
    doc_out = pymupdf.open(stream=res.content, filetype="pdf")
    assert len(doc_out) == 2
    assert doc_out[0].rotation == 90
    assert doc_out[1].rotation == 180
    doc_out.close()
    print(f"[OK] POST /api/v1/pdf/organize 验证成功: 成功调序并旋转导出 2 页 PDF")

if __name__ == "__main__":
    temp_dir = BASE_DIR / "tests" / "output"
    temp_dir.mkdir(parents=True, exist_ok=True)
    print("=== 开始执行 FastAPI 接口全链路测试 ===")
    test_health_endpoint()
    test_pdf_to_word_endpoint(temp_dir)
    test_pdf_watermark_endpoint(temp_dir)
    test_render_pages_thumbnail(temp_dir)
    test_pdf_split_endpoint(temp_dir)
    test_pdf_split_all_zip_endpoint(temp_dir)
    test_pdf_compress_endpoint(temp_dir)
    test_images_to_pdf_endpoint(temp_dir)
    test_pdf_organize_endpoint(temp_dir)
    print("=== 所有 API 路由测试全部通过！===")
