import io
import pytest
from pathlib import Path
from PIL import Image
from fastapi.testclient import TestClient

from app.main import app
from app.services.image_service import ImageService

client = TestClient(app)

@pytest.fixture
def sample_image(tmp_path: Path) -> Path:
    img_path = tmp_path / "test_input.png"
    img = Image.new("RGBA", (200, 100), color=(255, 0, 0, 128))
    img.save(img_path, format="PNG")
    return img_path

def test_image_service_convert_webp(sample_image: Path, tmp_path: Path):
    output_path = tmp_path / "output.webp"
    res = ImageService.convert_image(sample_image, output_path, target_format="WEBP", quality=80)
    assert res.exists()
    assert res.stat().st_size > 0
    with Image.open(res) as img:
        assert img.format == "WEBP"
        assert img.size == (200, 100)

def test_image_service_convert_jpeg_with_fill(sample_image: Path, tmp_path: Path):
    output_path = tmp_path / "output.jpg"
    res = ImageService.convert_image(sample_image, output_path, target_format="JPG", quality=90, fill_bg="#00FF00")
    assert res.exists()
    with Image.open(res) as img:
        assert img.format == "JPEG"
        assert img.mode == "RGB"

def test_image_service_generate_ico(sample_image: Path, tmp_path: Path):
    output_path = tmp_path / "favicon.ico"
    res = ImageService.generate_ico(sample_image, output_path)
    assert res.exists()
    with Image.open(res) as img:
        assert img.format == "ICO"

def test_image_service_resize(sample_image: Path, tmp_path: Path):
    output_path = tmp_path / "resized.png"
    res = ImageService.resize_image(sample_image, output_path, target_width=100, target_height=50)
    assert res.exists()
    with Image.open(res) as img:
        assert img.size == (100, 50)

def test_image_service_strip_exif(sample_image: Path, tmp_path: Path):
    output_path = tmp_path / "no_exif.png"
    res = ImageService.strip_exif_metadata(sample_image, output_path)
    assert res.exists()
    with Image.open(res) as img:
        assert img.size == (200, 100)

def test_api_convert_endpoint(sample_image: Path):
    with open(sample_image, "rb") as f:
        response = client.post(
            "/api/v1/image/convert",
            files={"file": ("test_input.png", f, "image/png")},
            data={"target_format": "webp", "quality": "85"}
        )
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/webp"
    assert len(response.content) > 0

def test_api_strip_exif_endpoint(sample_image: Path):
    with open(sample_image, "rb") as f:
        response = client.post(
            "/api/v1/image/strip-exif",
            files={"file": ("test_input.png", f, "image/png")}
        )
    assert response.status_code == 200
    assert len(response.content) > 0
