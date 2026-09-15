import JSZip from "jszip";

// 格式化文件大小
export function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

// 辅助：加载图片为 HTMLImageElement
export function loadImageFromFile(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("图片加载失败，请检查文件是否损坏"));
    };
    img.src = url;
  });
}

// 动态安全加载 heic2any (防止 SSR 报错)
let heic2anyModule: any = null;
async function getHeic2Any() {
  if (!heic2anyModule && typeof window !== "undefined") {
    try {
      const mod = await import("heic2any");
      heic2anyModule = mod.default || mod;
    } catch (e) {
      console.error("加载 heic2any 失败", e);
      throw new Error("HEIC 转换引擎初始化失败");
    }
  }
  return heic2anyModule;
}

/**
 * 1. 苹果 HEIC / HEIF 转 JPG/PNG
 */
export async function convertHeic(
  file: File,
  targetType: "image/jpeg" | "image/png" = "image/jpeg",
  quality: number = 0.92
): Promise<{ blob: Blob; filename: string }> {
  const heic2any = await getHeic2Any();
  const resultBlobOrArray = await heic2any({
    blob: file,
    toType: targetType,
    quality: quality,
  });

  const blob = Array.isArray(resultBlobOrArray) ? resultBlobOrArray[0] : resultBlobOrArray;
  const ext = targetType === "image/jpeg" ? "jpg" : "png";
  const baseName = file.name.replace(/\.[^/.]+$/, "");
  return {
    blob,
    filename: `${baseName}.${ext}`,
  };
}

/**
 * 2. 智能图片压缩 (TinyPNG 级别)
 */
export async function compressImage(
  file: File,
  options: {
    quality: number; // 0.1 ~ 1.0
    maxWidthOrHeight?: number;
    maxSizeMB?: number;
  }
): Promise<{ blob: Blob; filename: string; originalSize: number; compressedSize: number }> {
  const originalSize = file.size;

  // 尝试使用 browser-image-compression
  try {
    const imageCompression = (await import("browser-image-compression")).default;
    const compressionConfig = {
      maxSizeMB: options.maxSizeMB || 2,
      maxWidthOrHeight: options.maxWidthOrHeight || 4096,
      useWebWorker: true,
      initialQuality: options.quality,
      fileType: file.type || "image/jpeg",
    };

    const compressedFile = await imageCompression(file, compressionConfig);
    return {
      blob: compressedFile,
      filename: file.name,
      originalSize,
      compressedSize: compressedFile.size,
    };
  } catch (err) {
    // 降级使用 HTML5 Canvas 双三次重采样压缩
    const img = await loadImageFromFile(file);
    const canvas = document.createElement("canvas");
    let w = img.naturalWidth;
    let h = img.naturalHeight;

    if (options.maxWidthOrHeight && (w > options.maxWidthOrHeight || h > options.maxWidthOrHeight)) {
      if (w > h) {
        h = Math.round((h * options.maxWidthOrHeight) / w);
        w = options.maxWidthOrHeight;
      } else {
        w = Math.round((w * options.maxWidthOrHeight) / h);
        h = options.maxWidthOrHeight;
      }
    }

    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("无法创建 2D Canvas 上下文");

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, w, h);

    const mimeType = file.type === "image/png" ? "image/png" : "image/jpeg";
    const blob: Blob = await new Promise((res, rej) => {
      canvas.toBlob(
        (b) => {
          if (b) res(b);
          else rej(new Error("Canvas 导出 Blob 失败"));
        },
        mimeType,
        options.quality
      );
    });

    return {
      blob,
      filename: file.name,
      originalSize,
      compressedSize: blob.size,
    };
  }
}

/**
 * 3. 万能图片格式互转
 */
export async function convertFormat(
  file: File,
  targetFormat: "jpg" | "png" | "webp" | "ico" | "bmp",
  quality: number = 0.92,
  fillBackground: string = "#FFFFFF"
): Promise<{ blob: Blob; filename: string }> {
  // 处理 HEIC 特殊输入
  let sourceBlob: Blob = file;
  if (file.name.toLowerCase().endsWith(".heic") || file.name.toLowerCase().endsWith(".heif")) {
    const heicRes = await convertHeic(file, "image/png");
    sourceBlob = heicRes.blob;
  }

  const img = await loadImageFromFile(sourceBlob);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法初始化图像处理画布");

  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;

  // ICO 格式特殊多尺寸处理 (默认建议 128x128 或 256x256)
  if (targetFormat === "ico") {
    canvas.width = Math.min(256, img.naturalWidth);
    canvas.height = Math.min(256, img.naturalHeight);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const pngBlob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), "image/png"));
    const icoBlob = await createIcoFromPng(pngBlob, canvas.width, canvas.height);
    const baseName = file.name.replace(/\.[^/.]+$/, "");
    return { blob: icoBlob, filename: `${baseName}.ico` };
  }

  // 如果目标格式不支持透明通道（如 JPG / BMP），先填充背景色
  if (targetFormat === "jpg" || targetFormat === "bmp") {
    ctx.fillStyle = fillBackground;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  let mimeType = "image/jpeg";
  let ext = "jpg";
  if (targetFormat === "png") {
    mimeType = "image/png";
    ext = "png";
  } else if (targetFormat === "webp") {
    mimeType = "image/webp";
    ext = "webp";
  } else if (targetFormat === "bmp") {
    mimeType = "image/bmp";
    ext = "bmp";
  }

  const blob: Blob = await new Promise((res, rej) => {
    canvas.toBlob(
      (b) => {
        if (b) res(b);
        else rej(new Error(`转换至 ${targetFormat} 失败`));
      },
      mimeType,
      quality
    );
  });

  const baseName = file.name.replace(/\.[^/.]+$/, "");
  return {
    blob,
    filename: `${baseName}.${ext}`,
  };
}

/**
 * 辅助：从 PNG 生成标准 Windows ICO 二进制文件
 */
async function createIcoFromPng(pngBlob: Blob, width: number, height: number): Promise<Blob> {
  const pngBuffer = await pngBlob.arrayBuffer();
  const pngBytes = new Uint8Array(pngBuffer);

  // ICO 头部 (6 字节)
  const header = new Uint8Array([0, 0, 1, 0, 1, 0]);

  // ICO 目录项 (16 字节)
  const dirEntry = new Uint8Array(16);
  dirEntry[0] = width >= 256 ? 0 : width; // Width (0 表示 256)
  dirEntry[1] = height >= 256 ? 0 : height; // Height (0 表示 256)
  dirEntry[2] = 0; // Color count
  dirEntry[3] = 0; // Reserved
  dirEntry[4] = 1; // Color planes
  dirEntry[5] = 0;
  dirEntry[6] = 32; // Bits per pixel (32-bit RGBA)
  dirEntry[7] = 0;

  // 图片数据大小 (4 字节, Little Endian)
  const size = pngBytes.length;
  dirEntry[8] = size & 0xff;
  dirEntry[9] = (size >> 8) & 0xff;
  dirEntry[10] = (size >> 16) & 0xff;
  dirEntry[11] = (size >> 24) & 0xff;

  // 数据偏移量 (4 字节, Little Endian) -> 6 (header) + 16 (dirEntry) = 22
  const offset = 22;
  dirEntry[12] = offset & 0xff;
  dirEntry[13] = (offset >> 8) & 0xff;
  dirEntry[14] = (offset >> 16) & 0xff;
  dirEntry[15] = (offset >> 24) & 0xff;

  // 拼接完整的 ICO Blob
  return new Blob([header, dirEntry, pngBytes], { type: "image/x-icon" });
}

/**
 * 4. 批量尺寸缩放与预设
 */
export async function resizeImage(
  file: File,
  options: {
    mode: "percent" | "custom" | "preset";
    percent?: number; // 25, 50, 75, 150, 200
    targetWidth?: number;
    targetHeight?: number;
    maintainAspectRatio?: boolean;
  }
): Promise<{
  blob: Blob;
  filename: string;
  originalWidth: number;
  originalHeight: number;
  targetWidth: number;
  targetHeight: number;
}> {
  const img = await loadImageFromFile(file);
  const origW = img.naturalWidth;
  const origH = img.naturalHeight;

  let finalW = origW;
  let finalH = origH;

  if (options.mode === "percent") {
    const p = (options.percent || 100) / 100;
    finalW = Math.max(1, Math.round(origW * p));
    finalH = Math.max(1, Math.round(origH * p));
  } else if (options.mode === "custom") {
    if (options.targetWidth && options.targetHeight) {
      finalW = options.targetWidth;
      finalH = options.targetHeight;
    } else if (options.targetWidth && !options.targetHeight) {
      finalW = options.targetWidth;
      finalH = options.maintainAspectRatio ? Math.round((origH * finalW) / origW) : origH;
    } else if (!options.targetWidth && options.targetHeight) {
      finalH = options.targetHeight;
      finalW = options.maintainAspectRatio ? Math.round((origW * finalH) / origH) : origW;
    }
  } else if (options.mode === "preset") {
    finalW = options.targetWidth || origW;
    finalH = options.targetHeight || origH;
  }

  const canvas = document.createElement("canvas");
  canvas.width = finalW;
  canvas.height = finalH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法初始化缩放画布");

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, finalW, finalH);

  const mimeType = file.type || "image/png";
  const blob: Blob = await new Promise((res, rej) => {
    canvas.toBlob(
      (b) => {
        if (b) res(b);
        else rej(new Error("缩放图像失败"));
      },
      mimeType,
      0.95
    );
  });

  const baseName = file.name.replace(/\.[^/.]+$/, "");
  const ext = file.name.split(".").pop() || "png";
  return {
    blob,
    filename: `${baseName}_${finalW}x${finalH}.${ext}`,
    originalWidth: origW,
    originalHeight: origH,
    targetWidth: finalW,
    targetHeight: finalH,
  };
}

/**
 * 5. EXIF 隐私元数据抹除 (清除拍摄 GPS、相机、时间等)
 */
export async function stripExif(file: File): Promise<{
  blob: Blob;
  filename: string;
  originalSize: number;
  newSize: number;
}> {
  const img = await loadImageFromFile(file);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法初始化隐私清理画布");

  // 通过 Canvas 纯像素重新光栅化输出，天然剥离任何 EXIF、GPS、镜头信息
  ctx.drawImage(img, 0, 0);

  const mimeType = file.type.includes("png") ? "image/png" : "image/jpeg";
  const blob: Blob = await new Promise((res, rej) => {
    canvas.toBlob(
      (b) => {
        if (b) res(b);
        else rej(new Error("清理 EXIF 失败"));
      },
      mimeType,
      0.96
    );
  });

  const baseName = file.name.replace(/\.[^/.]+$/, "");
  const ext = mimeType === "image/png" ? "png" : "jpg";
  return {
    blob,
    filename: `${baseName}_no_exif.${ext}`,
    originalSize: file.size,
    newSize: blob.size,
  };
}

/**
 * 6. 批量水印 (文字水印 / Logo水印)
 */
export async function applyWatermark(
  file: File,
  options: {
    type: "text" | "logo";
    text?: string;
    textColor?: string;
    fontSize?: number;
    opacity?: number; // 0.1 ~ 1.0
    rotation?: number; // 角度，如 -30
    position?: "center" | "bottom-right" | "bottom-left" | "top-right" | "tile";
    logoFile?: File;
  }
): Promise<{ blob: Blob; filename: string }> {
  const img = await loadImageFromFile(file);
  const canvas = document.createElement("canvas");
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法初始化水印画布");

  // 绘制底图
  ctx.drawImage(img, 0, 0, w, h);

  ctx.save();
  ctx.globalAlpha = options.opacity !== undefined ? options.opacity : 0.4;

  if (options.type === "text" && options.text) {
    const fontSize = options.fontSize || Math.max(16, Math.round(w / 25));
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.fillStyle = options.textColor || "#ffffff";
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 4;

    if (options.position === "tile") {
      // 平铺防盗水印
      const stepX = fontSize * 10;
      const stepY = fontSize * 5;
      const rad = ((options.rotation || -25) * Math.PI) / 180;

      for (let x = -w; x < w * 2; x += stepX) {
        for (let y = -h; y < h * 2; y += stepY) {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(rad);
          ctx.fillText(options.text, 0, 0);
          ctx.restore();
        }
      }
    } else {
      // 单点水印
      let x = w / 2;
      let y = h / 2;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const margin = 20;
      if (options.position === "bottom-right") {
        ctx.textAlign = "right";
        ctx.textBaseline = "bottom";
        x = w - margin;
        y = h - margin;
      } else if (options.position === "bottom-left") {
        ctx.textAlign = "left";
        ctx.textBaseline = "bottom";
        x = margin;
        y = h - margin;
      } else if (options.position === "top-right") {
        ctx.textAlign = "right";
        ctx.textBaseline = "top";
        x = w - margin;
        y = margin;
      }

      ctx.save();
      ctx.translate(x, y);
      if (options.rotation) {
        ctx.rotate((options.rotation * Math.PI) / 180);
      }
      ctx.fillText(options.text, 0, 0);
      ctx.restore();
    }
  } else if (options.type === "logo" && options.logoFile) {
    const logoImg = await loadImageFromFile(options.logoFile);
    // Logo 限制在主图宽度的 15%~25%
    const logoScale = Math.min((w * 0.2) / logoImg.naturalWidth, (h * 0.2) / logoImg.naturalHeight, 1);
    const lw = logoImg.naturalWidth * logoScale;
    const lh = logoImg.naturalHeight * logoScale;

    let lx = (w - lw) / 2;
    let ly = (h - lh) / 2;
    const margin = 20;

    if (options.position === "bottom-right") {
      lx = w - lw - margin;
      ly = h - lh - margin;
    } else if (options.position === "bottom-left") {
      lx = margin;
      ly = h - lh - margin;
    } else if (options.position === "top-right") {
      lx = w - lw - margin;
      ly = margin;
    }

    ctx.drawImage(logoImg, lx, ly, lw, lh);
  }

  ctx.restore();

  const mimeType = file.type.includes("png") ? "image/png" : "image/jpeg";
  const blob: Blob = await new Promise((res, rej) => {
    canvas.toBlob(
      (b) => {
        if (b) res(b);
        else rej(new Error("添加水印失败"));
      },
      mimeType,
      0.95
    );
  });

  const baseName = file.name.replace(/\.[^/.]+$/, "");
  const ext = mimeType === "image/png" ? "png" : "jpg";
  return {
    blob,
    filename: `${baseName}_watermarked.${ext}`,
  };
}

/**
 * 7. 打包为 ZIP 压缩包
 */
export async function createZipBundle(
  items: Array<{ blob: Blob; filename: string }>,
  zipName: string = "processed_images.zip"
): Promise<{ blob: Blob; filename: string }> {
  const zip = new JSZip();
  const nameTracker = new Map<string, number>();

  items.forEach((item) => {
    let name = item.filename;
    if (nameTracker.has(name)) {
      const count = nameTracker.get(name)! + 1;
      nameTracker.set(name, count);
      const parts = name.split(".");
      const ext = parts.pop();
      name = `${parts.join(".")}_(${count}).${ext}`;
    } else {
      nameTracker.set(name, 0);
    }
    zip.file(name, item.blob);
  });

  const zipBlob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  return { blob: zipBlob, filename: zipName };
}
