export function getApiBase(): string {
  if (typeof window !== "undefined" && (window as any).electronAPI?.backendPort) {
    return `http://127.0.0.1:${(window as any).electronAPI.backendPort}/api/v1`;
  }
  if (typeof window !== "undefined" && (window as any).electronAPI) {
    return "http://127.0.0.1:18520/api/v1";
  }
  return process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";
}

export const API_BASE = {
  toString: () => getApiBase(),
  valueOf: () => getApiBase(),
};

export interface HealthStatus {
  status: string;
  platform: string;
  engines: {
    pdf2docx: boolean;
    windows_word_com_available: boolean;
    libreoffice_available: boolean;
  };
}

export async function checkHealth(): Promise<HealthStatus> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error("后端服务未连接");
  return res.json();
}

export async function convertPdfToWord(
  file: File,
  startPage: number = 0,
  endPage?: number
): Promise<{ blob: Blob; filename: string }> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("start_page", String(startPage));
  if (endPage !== undefined && endPage !== null) {
    formData.append("end_page", String(endPage));
  }

  const res = await fetch(`${API_BASE}/document/pdf-to-word`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "转换失败" }));
    throw new Error(err.detail || err.error || "PDF 转 Word 失败");
  }

  const blob = await res.blob();
  const filename = `${file.name.replace(/\.[^/.]+$/, "")}.docx`;
  return { blob, filename };
}

export async function convertWordToPdf(file: File, quality: string = "high"): Promise<{ blob: Blob; filename: string }> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("quality", quality);

  const res = await fetch(`${API_BASE}/document/word-to-pdf`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "转换失败" }));
    throw new Error(err.detail || err.error || "Word 转 PDF 失败");
  }

  const blob = await res.blob();
  const filename = `${file.name.replace(/\.[^/.]+$/, "")}.pdf`;
  return { blob, filename };
}

function parseFilenameFromHeader(res: Response, fallback: string): string {
  const disposition = res.headers.get("Content-Disposition") || res.headers.get("content-disposition");
  if (!disposition) return fallback;
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match && utf8Match[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }
  const match = disposition.match(/filename="?([^";]+)"?/i);
  if (match && match[1]) {
    return match[1];
  }
  return fallback;
}

export async function mergePdfs(files: File[]): Promise<{ blob: Blob; filename: string }> {
  const formData = new FormData();
  files.forEach((f) => formData.append("files", f));

  const res = await fetch(`${API_BASE}/pdf/merge`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "合并失败" }));
    throw new Error(err.detail || err.error || "PDF 合并失败");
  }

  const blob = await res.blob();
  const filename = parseFilenameFromHeader(res, "merged_document.pdf");
  return { blob, filename };
}

export async function splitPdf(file: File, pageRanges?: string): Promise<{ blob: Blob; filename: string }> {
  const formData = new FormData();
  formData.append("file", file);
  if (pageRanges) {
    formData.append("page_ranges", pageRanges);
  }

  const res = await fetch(`${API_BASE}/pdf/split`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "拆分失败" }));
    throw new Error(err.detail || err.error || "PDF 拆分失败");
  }

  const blob = await res.blob();
  const fallback = pageRanges
    ? `extracted_${file.name}`
    : `${file.name.replace(/\.[^/.]+$/, "")}_all_pages.zip`;
  const filename = parseFilenameFromHeader(res, fallback);
  return { blob, filename };
}

export async function addWatermark(
  file: File,
  text: string,
  opacity: number = 0.3,
  angle: number = 45
): Promise<{ blob: Blob; filename: string }> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("watermark_text", text);
  formData.append("opacity", String(opacity));
  formData.append("angle", String(angle));

  const res = await fetch(`${API_BASE}/pdf/watermark`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "添加水印失败" }));
    throw new Error(err.detail || err.error || "添加水印失败");
  }

  const blob = await res.blob();
  const filename = parseFilenameFromHeader(res, `watermarked_${file.name}`);
  return { blob, filename };
}

export async function protectPdf(file: File, password: string): Promise<{ blob: Blob; filename: string }> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("password", password);

  const res = await fetch(`${API_BASE}/pdf/protect`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "加密失败" }));
    throw new Error(err.detail || err.error || "PDF 加密失败");
  }

  const blob = await res.blob();
  const filename = parseFilenameFromHeader(res, `protected_${file.name}`);
  return { blob, filename };
}

export async function renderPdfPages(
  file: File,
  dpi: number = 100,
  maxPages?: number,
  extractWords: boolean = true
): Promise<{
  success: boolean;
  title: string;
  numPages: number;
  pages: Array<{
    pageIndex: number;
    width: number;
    height: number;
    image: string;
    blocks?: Array<{
      id: string;
      x0: number;
      y0: number;
      x1: number;
      y1: number;
      text: string;
      fontSize: number;
    }>;
  }>;
}> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("dpi", String(dpi));
  if (maxPages !== undefined && maxPages !== null) {
    formData.append("max_pages", String(maxPages));
  }
  formData.append("extract_words", String(extractWords));

  const res = await fetch(`${API_BASE}/editor/render-pages`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error("后端服务未找到对应接口 (404)，请确认后端已正确启动");
    }
    const err = await res.json().catch(() => ({ detail: "渲染失败" }));
    throw new Error(err.detail || err.error || "原版 PDF 页面渲染解析失败");
  }

  return res.json();
}

export async function applyPdfModifications(
  file: File,
  modifications: any[]
): Promise<{ blob: Blob; filename: string }> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("modifications", JSON.stringify(modifications));

  const res = await fetch(`${API_BASE}/editor/apply-modifications`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error("后端服务未找到对应接口 (404)，请确认后端已正确启动");
    }
    const err = await res.json().catch(() => ({ detail: "保存修改失败" }));
    throw new Error(err.detail || err.error || "保存修改后的 PDF 失败");
  }

  const blob = await res.blob();
  const filename = `${file.name.replace(/\.[^/.]+$/, "")}_edited.pdf`;
  return { blob, filename };
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
  const formData = new FormData();
  formData.append("file", file);
  formData.append("level", level);

  const res = await fetch(`${API_BASE}/pdf/compress`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "压缩失败" }));
    throw new Error(err.detail || err.error || "PDF 压缩失败");
  }

  const blob = await res.blob();
  const origSizeHeader = res.headers.get("X-Original-Size");
  const compSizeHeader = res.headers.get("X-Compressed-Size");
  const originalSize = origSizeHeader ? parseInt(origSizeHeader, 10) : file.size;
  const compressedSize = compSizeHeader ? parseInt(compSizeHeader, 10) : blob.size;

  const filename = parseFilenameFromHeader(res, `compressed_${file.name}`);
  return { blob, filename, originalSize, compressedSize };
}

export async function convertImagesToPdf(
  files: File[],
  pageSize: "fit" | "a4" = "fit"
): Promise<{ blob: Blob; filename: string }> {
  const formData = new FormData();
  files.forEach((f) => formData.append("files", f));
  formData.append("page_size", pageSize);

  const res = await fetch(`${API_BASE}/pdf/images-to-pdf`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "合成失败" }));
    throw new Error(err.detail || err.error || "图片合成 PDF 失败");
  }

  const blob = await res.blob();
  const filename = parseFilenameFromHeader(res, "images_combined.pdf");
  return { blob, filename };
}

export async function organizePdfPages(
  file: File,
  pagesConfig: Array<{ page: number; rotation: number }>
): Promise<{ blob: Blob; filename: string }> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("pages_config", JSON.stringify(pagesConfig));

  const res = await fetch(`${API_BASE}/pdf/organize`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "编排处理失败" }));
    throw new Error(err.detail || err.error || "PDF 页面编排失败");
  }

  const blob = await res.blob();
  const filename = parseFilenameFromHeader(res, `organized_${file.name}`);
  return { blob, filename };
}


export function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.style.display = "none";
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

