/**
 * XC_OmniBox - 图像处理服务调度层 (IPC 桥接)
 * 严格遵循前后端职责隔离守则 (Rule 6)：
 * 前端仅负责文件采集与 UI 渲染，所有图像解码、缩放、压缩、格式转换、水印合成 100% 运行于后端 Node.js (Sharp/libvips)
 */

export function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

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

async function invokeNative<T = any>(channel: string, payload: any): Promise<T> {
  if (typeof window !== "undefined" && (window as any).electronAPI?.invoke) {
    try {
      const res = await (window as any).electronAPI.invoke(channel, payload);
      if (res && res.error) {
        throw new Error(res.error);
      }
      return res as T;
    } catch (err: any) {
      console.error(`[IPC Error] Channel ${channel} failed:`, err);
      throw err;
    }
  }
  throw new Error("桌面端原生服务未就绪 (仅支持在桌面客户端中运行)");
}

function getMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "avif":
      return "image/avif";
    case "ico":
      return "image/x-icon";
    case "tiff":
      return "image/tiff";
    case "zip":
      return "application/zip";
    default:
      return "application/octet-stream";
  }
}

function toBlob(buffer: any, filename: string): Blob {
  return new Blob([buffer as any], { type: getMimeType(filename) });
}

/**
 * 1. 苹果 HEIC / HEIF 转 JPG/PNG (后端 Sharp 原生流式转换)
 */
export async function convertHeic(
  file: File,
  targetType: "image/jpeg" | "image/png" = "image/jpeg",
  quality: number = 0.92
): Promise<{ blob: Blob; filename: string }> {
  const fileBuffer = await file.arrayBuffer();
  const targetFormat = targetType === "image/jpeg" ? "jpg" : "png";
  const res = await invokeNative<{ buffer: ArrayBuffer; filename: string }>("image:convert", {
    fileBuffer,
    fileName: file.name,
    targetFormat,
    quality: Math.round(quality * 100),
  });
  return {
    blob: toBlob(res.buffer, res.filename),
    filename: res.filename,
  };
}

/**
 * 辅助：生成缩略图预览
 */
export async function generateHeicThumbnail(file: File): Promise<string> {
  try {
    const fileBuffer = await file.arrayBuffer();
    const res = await invokeNative<{ buffer: ArrayBuffer; filename: string }>("image:resize", {
      fileBuffer,
      fileName: file.name,
      mode: "custom",
      targetWidth: 240,
      targetHeight: 240,
      maintainAspectRatio: true,
    });
    const blob = toBlob(res.buffer, res.filename);
    return URL.createObjectURL(blob);
  } catch (e) {
    console.warn("Failed to generate HEIC thumbnail via backend:", e);
    return "";
  }
}

/**
 * 2. 智能图片压缩 (后端 Sharp / mozjpeg / libvips 级别优化)
 */
export async function compressImage(
  file: File,
  options: {
    quality: number; // 0.1 ~ 1.0
    maxWidthOrHeight?: number;
    maxSizeMB?: number;
  }
): Promise<{
  blob: Blob;
  filename: string;
  originalSize: number;
  compressedSize: number;
  isOptimizedAlready?: boolean;
}> {
  const fileBuffer = await file.arrayBuffer();
  const res = await invokeNative<{
    buffer: ArrayBuffer;
    filename: string;
    originalSize: number;
    compressedSize: number;
    isOptimizedAlready: boolean;
  }>("image:compress", {
    fileBuffer,
    fileName: file.name,
    quality: options.quality,
    maxWidthOrHeight: options.maxWidthOrHeight,
  });

  return {
    blob: toBlob(res.buffer, res.filename),
    filename: res.filename,
    originalSize: res.originalSize,
    compressedSize: res.compressedSize,
    isOptimizedAlready: res.isOptimizedAlready,
  };
}

/**
 * 3. 万能图片格式互转 (高保真 libvips 流式处理)
 */
export async function convertFormat(
  file: File,
  targetFormat: "jpg" | "png" | "webp" | "avif" | "ico" | "bmp",
  quality: number = 0.92,
  fillBackground: string = "#FFFFFF"
): Promise<{ blob: Blob; filename: string; previewBlob?: Blob }> {
  const fileBuffer = await file.arrayBuffer();
  const res = await invokeNative<{ buffer: ArrayBuffer; filename: string }>("image:convert", {
    fileBuffer,
    fileName: file.name,
    targetFormat,
    quality: Math.round(quality * 100),
    fillBg: fillBackground,
  });

  const blob = toBlob(res.buffer, res.filename);
  return {
    blob,
    filename: res.filename,
    previewBlob: targetFormat === "ico" ? blob : undefined,
  };
}

/**
 * 4. 批量尺寸缩放与预设
 */
export interface ResizeOptions {
  mode: "percent" | "custom" | "preset";
  percent?: number;
  targetWidth?: number;
  targetHeight?: number;
  maintainAspectRatio?: boolean;
  fitMode?: "crop" | "pad" | "stretch";
  padBgColor?: string;
}

export async function resizeImage(
  file: File,
  options: ResizeOptions
): Promise<{
  blob: Blob;
  filename: string;
  originalWidth: number;
  originalHeight: number;
  targetWidth: number;
  targetHeight: number;
  originalSize: number;
  targetSize: number;
}> {
  const fileBuffer = await file.arrayBuffer();
  const res = await invokeNative<{
    buffer: ArrayBuffer;
    filename: string;
    originalWidth: number;
    originalHeight: number;
    targetWidth: number;
    targetHeight: number;
    originalSize: number;
    targetSize: number;
  }>("image:resize", {
    fileBuffer,
    fileName: file.name,
    mode: options.mode,
    percent: options.percent,
    targetWidth: options.targetWidth,
    targetHeight: options.targetHeight,
    maintainAspectRatio: options.maintainAspectRatio,
    fitMode: options.fitMode,
    padBgColor: options.padBgColor,
  });

  return {
    blob: toBlob(res.buffer, res.filename),
    filename: res.filename,
    originalWidth: res.originalWidth,
    originalHeight: res.originalHeight,
    targetWidth: res.targetWidth,
    targetHeight: res.targetHeight,
    originalSize: res.originalSize,
    targetSize: res.targetSize,
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
  const fileBuffer = await file.arrayBuffer();
  const res = await invokeNative<{
    buffer: ArrayBuffer;
    filename: string;
    originalSize: number;
    newSize: number;
  }>("image:strip-exif", {
    fileBuffer,
    fileName: file.name,
  });

  return {
    blob: toBlob(res.buffer, res.filename),
    filename: res.filename,
    originalSize: res.originalSize,
    newSize: res.newSize,
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
    opacity?: number;
    rotation?: number;
    position?: "center" | "bottom-right" | "bottom-left" | "top-right" | "tile";
    logoFile?: File;
  }
): Promise<{ blob: Blob; filename: string }> {
  const fileBuffer = await file.arrayBuffer();
  let logoBuffer: ArrayBuffer | undefined = undefined;
  if (options.logoFile) {
    logoBuffer = await options.logoFile.arrayBuffer();
  }

  const res = await invokeNative<{ buffer: ArrayBuffer; filename: string }>("image:watermark", {
    fileBuffer,
    fileName: file.name,
    type: options.type,
    text: options.text,
    textColor: options.textColor,
    fontSize: options.fontSize,
    opacity: options.opacity,
    rotation: options.rotation,
    position: options.position,
    logoBuffer,
  });

  return {
    blob: toBlob(res.buffer, res.filename),
    filename: res.filename,
  };
}

/**
 * 7. 打包为 ZIP 压缩包 (后端流式打包)
 */
export async function createZipBundle(
  items: Array<{ blob: Blob; filename: string }>,
  zipName: string = "processed_images.zip"
): Promise<{ blob: Blob; filename: string }> {
  const files = await Promise.all(
    items.map(async (item) => ({
      name: item.filename,
      buffer: await item.blob.arrayBuffer(),
    }))
  );

  const res = await invokeNative<{ buffer: ArrayBuffer; filename: string }>("image:bundle-zip", {
    files,
    zipName,
  });

  return {
    blob: toBlob(res.buffer, res.filename),
    filename: res.filename,
  };
}
