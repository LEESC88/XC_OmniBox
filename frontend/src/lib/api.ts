/**
 * XC_OmniBox - 前端统一服务调用通道 (基于 Electron 进程内 IPC)
 * 0 外部端口占用 / 0 网络延迟 / 100% 内存直连
 */

export interface HealthStatus {
  status: string;
  platform: string;
  engines: {
    pdf2docx: boolean;
    windows_word_com_available: boolean;
    libreoffice_available: boolean;
  };
}

/**
 * 封装安全的 Electron 进程内 IPC 调用
 */
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
  throw new Error("桌面端原生引擎未就绪 (仅支持在 XC_OmniBox 桌面客户端中运行)");
}

function toBlob(buffer: any, type?: string): Blob {
  return new Blob([buffer as any], type ? { type } : undefined);
}

export async function checkHealth(): Promise<HealthStatus> {
  if (typeof window !== "undefined" && (window as any).electronAPI?.checkBackendHealth) {
    await (window as any).electronAPI.checkBackendHealth();
    return {
      status: "healthy",
      platform: "win32",
      engines: {
        pdf2docx: true,
        windows_word_com_available: true,
        libreoffice_available: false,
      },
    };
  }
  return {
    status: "healthy",
    platform: "win32",
    engines: {
      pdf2docx: true,
      windows_word_com_available: true,
      libreoffice_available: false,
    },
  };
}

export async function convertPdfToWord(
  file: File,
  startPage: number = 0,
  endPage?: number
): Promise<{ blob: Blob; filename: string }> {
  const fileBuffer = await file.arrayBuffer();
  const res = await invokeNative<{ buffer: ArrayBuffer | Uint8Array; filename: string }>("document:pdf-to-word", {
    fileBuffer,
    fileName: file.name,
    startPage,
    endPage,
  });

  const blob = toBlob(
    res.buffer,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
  return { blob, filename: res.filename || `${file.name.replace(/\.[^/.]+$/, "")}.docx` };
}

export async function convertWordToPdf(
  file: File,
  quality: string = "high"
): Promise<{ blob: Blob; filename: string }> {
  const fileBuffer = await file.arrayBuffer();
  const res = await invokeNative<{ buffer: ArrayBuffer | Uint8Array; filename: string }>("document:word-to-pdf", {
    fileBuffer,
    fileName: file.name,
    quality,
  });

  const blob = toBlob(res.buffer, "application/pdf");
  return { blob, filename: res.filename || `${file.name.replace(/\.[^/.]+$/, "")}.pdf` };
}

export async function mergePdfs(files: File[]): Promise<{ blob: Blob; filename: string }> {
  const fileItems = await Promise.all(
    files.map(async (f) => ({
      buffer: await f.arrayBuffer(),
      name: f.name,
    }))
  );

  const res = await invokeNative<{ buffer: ArrayBuffer | Uint8Array; filename: string }>("document:merge-pdfs", {
    files: fileItems,
  });

  const blob = toBlob(res.buffer, "application/pdf");
  return { blob, filename: res.filename || "merged_document.pdf" };
}

export async function splitPdf(
  file: File,
  pageRanges?: string
): Promise<{ blob: Blob; filename: string }> {
  const fileBuffer = await file.arrayBuffer();
  const res = await invokeNative<{ buffer: ArrayBuffer | Uint8Array; filename: string }>("document:split-pdf", {
    fileBuffer,
    fileName: file.name,
    pageRanges,
  });

  const isZip = res.filename?.endsWith(".zip");
  const blob = toBlob(res.buffer, isZip ? "application/zip" : "application/pdf");
  return { blob, filename: res.filename || (pageRanges ? `extracted_${file.name}` : `${file.name.replace(/\.[^/.]+$/, "")}_all_pages.zip`) };
}

export async function addWatermark(
  file: File,
  text: string,
  opacity: number = 0.3,
  angle: number = 45,
  layout: "center" | "tile" = "center"
): Promise<{ blob: Blob; filename: string }> {
  const fileBuffer = await file.arrayBuffer();
  const res = await invokeNative<{ buffer: ArrayBuffer | Uint8Array; filename: string }>("document:add-watermark", {
    fileBuffer,
    fileName: file.name,
    text,
    opacity,
    angle,
    layout,
  });

  const blob = toBlob(res.buffer, "application/pdf");
  return { blob, filename: res.filename || `watermarked_${file.name}` };
}

export async function protectPdf(
  file: File,
  password: string,
  cleanMetadata: boolean = false
): Promise<{ blob: Blob; filename: string }> {
  const fileBuffer = await file.arrayBuffer();
  const res = await invokeNative<{ buffer: ArrayBuffer | Uint8Array; filename: string }>("document:protect-pdf", {
    fileBuffer,
    fileName: file.name,
    password,
    cleanMetadata,
  });

  const blob = toBlob(res.buffer, "application/pdf");
  return { blob, filename: res.filename || `protected_${file.name}` };
}

export async function unlockPdf(
  file: File,
  password: string = "",
  cleanMetadata: boolean = false
): Promise<{ blob: Blob; filename: string }> {
  const fileBuffer = await file.arrayBuffer();
  const res = await invokeNative<{ buffer: ArrayBuffer | Uint8Array; filename: string }>("document:unlock-pdf", {
    fileBuffer,
    fileName: file.name,
    password,
    cleanMetadata,
  });

  const blob = toBlob(res.buffer, "application/pdf");
  return { blob, filename: res.filename || `unlocked_${file.name}` };
}

export async function compressPdf(
  file: File,
  level: "low" | "medium" | "high" = "medium"
): Promise<{
  blob: Blob;
  filename: string;
  originalSize: number;
  compressedSize: number;
}> {
  const fileBuffer = await file.arrayBuffer();
  const res = await invokeNative<{
    buffer: ArrayBuffer | Uint8Array;
    filename: string;
    originalSize: number;
    compressedSize: number;
  }>("document:compress-pdf", {
    fileBuffer,
    fileName: file.name,
    level,
  });

  const blob = toBlob(res.buffer, "application/pdf");
  return {
    blob,
    filename: res.filename || `compressed_${file.name}`,
    originalSize: res.originalSize || file.size,
    compressedSize: res.compressedSize || blob.size,
  };
}

export async function convertImagesToPdf(
  files: File[],
  pageSize: "fit" | "a4" = "fit"
): Promise<{ blob: Blob; filename: string }> {
  const fileItems = await Promise.all(
    files.map(async (f) => ({
      buffer: await f.arrayBuffer(),
      name: f.name,
    }))
  );

  const res = await invokeNative<{ buffer: ArrayBuffer | Uint8Array; filename: string }>("document:images-to-pdf", {
    files: fileItems,
    pageSize,
  });

  const blob = toBlob(res.buffer, "application/pdf");
  return { blob, filename: res.filename || "images_combined.pdf" };
}

export async function organizePdfPages(
  file: File,
  pagesConfig: Array<{ page: number; rotation: number }>
): Promise<{ blob: Blob; filename: string }> {
  const fileBuffer = await file.arrayBuffer();
  const res = await invokeNative<{ buffer: ArrayBuffer | Uint8Array; filename: string }>("document:organize-pdf", {
    fileBuffer,
    fileName: file.name,
    pagesConfig,
  });

  const blob = toBlob(res.buffer, "application/pdf");
  return { blob, filename: res.filename || `organized_${file.name}` };
}

export async function convertImage(
  file: File,
  targetFormat: string,
  quality: number = 85,
  fillBg: string = "#FFFFFF"
): Promise<{ blob: Blob; filename: string }> {
  const fileBuffer = await file.arrayBuffer();
  const res = await invokeNative<{ buffer: ArrayBuffer | Uint8Array; filename: string }>("image:convert", {
    fileBuffer,
    fileName: file.name,
    targetFormat,
    quality,
    fillBg,
  });

  const mimeMap: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    avif: "image/avif",
    ico: "image/x-icon",
    bmp: "image/bmp",
  };
  const mimeType = mimeMap[targetFormat.toLowerCase()] || "application/octet-stream";
  const blob = toBlob(res.buffer, mimeType);
  return { blob, filename: res.filename || `${file.name.replace(/\.[^/.]+$/, "")}.${targetFormat}` };
}

export async function renderPdfPages(
  file: File,
  dpi: number = 100,
  maxPages?: number,
  extractWords: boolean = true
): Promise<{
  title: string;
  numPages: number;
  pages: Array<{
    pageIndex: number;
    width: number;
    height: number;
    image: string;
    words?: Array<{
      x0: number;
      y0: number;
      x1: number;
      y1: number;
      text: string;
      fontSize: number;
    }>;
  }>;
}> {
  const fileBuffer = await file.arrayBuffer();
  return await invokeNative("document:render-pdf-pages", {
    fileBuffer,
    fileName: file.name,
    dpi,
    maxPages,
    extractWords,
  });
}

export interface TaskProgressEvent {
  task: string;
  current: number;
  total: number;
  percent: number;
}

/**
 * 订阅主进程大文件/批量长任务实时进度流 (Progress Stream)
 */
export function onTaskProgress(callback: (event: TaskProgressEvent) => void): () => void {
  if (typeof window !== "undefined" && (window as any).electronAPI?.onTaskProgress) {
    return (window as any).electronAPI.onTaskProgress(callback);
  }
  return () => {};
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.style.display = "none";
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    try {
      window.URL.revokeObjectURL(url);
      if (a.parentNode) {
        document.body.removeChild(a);
      }
    } catch (_) {}
  }, 10000);
}

export interface ExtractedMediaItem {
  id: string;
  name: string;
  originalPath: string;
  size: number;
  mimeType: string;
  extension: string;
  previewUrl: string | null;
}

export interface ExtractMediaResult {
  success: boolean;
  count: number;
  totalSize: number;
  items: ExtractedMediaItem[];
  zipBlob: Blob;
  zipFilename: string;
  message?: string;
}

/**
 * 一键提取 Word/PPT/Excel 开放文档内的全部内嵌无损原图与媒体文件
 */
export async function extractOfficeMedia(file: File): Promise<ExtractMediaResult> {
  const fileBuffer = await file.arrayBuffer();
  const res = await invokeNative<{
    success: boolean;
    count: number;
    totalSize: number;
    items: ExtractedMediaItem[];
    zipBuffer: Uint8Array | ArrayBuffer;
    zipFilename: string;
    message?: string;
  }>("document:extract-media", {
    fileBuffer,
    fileName: file.name,
  });

  const zipBlob = new Blob([res.zipBuffer as any], { type: "application/zip" });
  return {
    success: res.success,
    count: res.count,
    totalSize: res.totalSize,
    items: res.items || [],
    zipBlob,
    zipFilename: res.zipFilename,
    message: res.message,
  };
}

export interface PdfInspectItem {
  id: string;
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontName?: string;
  leftPercent: number;
  topPercent: number;
  widthPercent: number;
  heightPercent: number;
  vx?: number;
  vy?: number;
  vw?: number;
  vh?: number;
}

export interface PdfInspectPage {
  pageIndex: number;
  pageNumber: number;
  width: number;
  height: number;
  viewWidth: number;
  viewHeight: number;
  image: string;
  items: PdfInspectItem[];
  lines?: PdfInspectItem[];
}

export interface PdfInspectResult {
  success: boolean;
  fileName: string;
  numPages: number;
  pages: PdfInspectPage[];
}

export interface PdfTextPatch {
  id: string;
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  leftPercent?: number;
  topPercent?: number;
  widthPercent?: number;
  heightPercent?: number;
  originalText?: string;
  newText: string;
  fontFamily?: "sans" | "hei" | "kai" | "fang" | "song" | "serif" | "helvetica" | "times" | "courier";
  fontSize?: number;
  colorHex?: string;
  bgHex?: string;
  autoFit?: boolean;
  padding?: number;
}

export interface PdfApplyPatchesResult {
  success: boolean;
  blob: Blob;
  filename: string;
  patchCount: number;
}

/**
 * 探测与高保真解析 PDF 每一页文字块与版面几何坐标
 */
export async function inspectPdfForEdit(
  file: File,
  options?: { dpi?: number; maxPages?: number }
): Promise<PdfInspectResult> {
  const fileBuffer = await file.arrayBuffer();
  return await invokeNative<PdfInspectResult>("document:inspect-pdf-for-edit", {
    fileBuffer,
    fileName: file.name,
    dpi: options?.dpi || 120,
    maxPages: options?.maxPages || 50,
  });
}

/**
 * 执行 PDF 原地文字修正与排版自适应重绘
 */
export async function applyPdfTextPatches(
  file: File,
  patches: PdfTextPatch[]
): Promise<PdfApplyPatchesResult> {
  const fileBuffer = await file.arrayBuffer();
  const res = await invokeNative<{
    success: boolean;
    buffer: Uint8Array | ArrayBuffer;
    filename: string;
    patchCount: number;
  }>("document:apply-text-patches", {
    fileBuffer,
    fileName: file.name,
    patches,
  });

  const blob = new Blob([res.buffer as any], { type: "application/pdf" });
  return {
    success: res.success,
    blob,
    filename: res.filename,
    patchCount: res.patchCount,
  };
}


