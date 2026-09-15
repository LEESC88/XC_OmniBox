import io
from pathlib import Path
from typing import List, Tuple, Optional
from PIL import Image, ImageOps

class ImageService:
    @staticmethod
    def convert_image(
        input_path: Path,
        output_path: Path,
        target_format: str = "WEBP",
        quality: int = 85,
        fill_bg: Optional[str] = "#FFFFFF"
    ) -> Path:
        """
        使用 Pillow 高质量转换图像格式
        """
        target_fmt = target_format.upper()
        if target_fmt == "JPG":
            target_fmt = "JPEG"

        with Image.open(input_path) as img:
            # 矫正 EXIF 旋转
            img = ImageOps.exif_transpose(img)

            # 如果转为不支持透明通道的格式，填充背景色
            if target_fmt in ["JPEG", "BMP"] and img.mode in ("RGBA", "LA", "P"):
                background = Image.new("RGB", img.size, fill_bg or "#FFFFFF")
                if img.mode == "P":
                    img = img.convert("RGBA")
                background.paste(img, mask=img.split()[-1])
                img = background
            elif target_fmt == "PNG" and img.mode not in ("RGBA", "RGB"):
                img = img.convert("RGBA")

            save_kwargs = {}
            if target_fmt in ["JPEG", "WEBP"]:
                save_kwargs["quality"] = quality
                save_kwargs["optimize"] = True

            img.save(output_path, format=target_fmt, **save_kwargs)

        return output_path

    @staticmethod
    def generate_ico(
        input_path: Path,
        output_path: Path,
        sizes: Optional[List[Tuple[int, int]]] = None
    ) -> Path:
        """
        生成标准多尺寸 Windows ICO 图标文件
        """
        if sizes is None:
            sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]

        with Image.open(input_path) as img:
            img = ImageOps.exif_transpose(img)
            if img.mode != "RGBA":
                img = img.convert("RGBA")
            img.save(output_path, format="ICO", sizes=sizes)

        return output_path

    @staticmethod
    def resize_image(
        input_path: Path,
        output_path: Path,
        target_width: Optional[int] = None,
        target_height: Optional[int] = None,
        maintain_aspect: bool = True
    ) -> Path:
        """
        使用 Lanczos 重采样高质量缩放图像
        """
        with Image.open(input_path) as img:
            img = ImageOps.exif_transpose(img)
            w, h = img.size

            if target_width and target_height:
                final_w, final_h = target_width, target_height
            elif target_width and not target_height:
                final_w = target_width
                final_h = int(h * (final_w / w)) if maintain_aspect else h
            elif not target_width and target_height:
                final_h = target_height
                final_w = int(w * (final_h / h)) if maintain_aspect else w
            else:
                final_w, final_h = w, h

            resized = img.resize((final_w, final_h), Image.Resampling.LANCZOS)
            resized.save(output_path)

        return output_path

    @staticmethod
    def strip_exif_metadata(input_path: Path, output_path: Path) -> Path:
        """
        彻底剥离图像 EXIF、GPS、相机型号与时间元数据
        """
        with Image.open(input_path) as img:
            # 读取纯像素
            data = list(img.getdata())
            clean_img = Image.new(img.mode, img.size)
            clean_img.putdata(data)
            clean_img.save(output_path)

        return output_path
