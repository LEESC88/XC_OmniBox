const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";

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

export async function convertWordToPdf(file: File): Promise<{ blob: Blob; filename: string }> {
  const formData = new FormData();
  formData.append("file", file);

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
  return { blob, filename: "merged_document.pdf" };
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
  return { blob, filename: `extracted_${file.name}` };
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
  return { blob, filename: `watermarked_${file.name}` };
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
  return { blob, filename: `protected_${file.name}` };
}

export async function renderPdfPages(file: File): Promise<{
  success: boolean;
  title: string;
  numPages: number;
  pages: Array<{
    pageIndex: number;
    width: number;
    height: number;
    image: string;
    blocks: Array<{
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

  const res = await fetch(`${API_BASE}/editor/render-pages`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
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
    const err = await res.json().catch(() => ({ detail: "保存修改失败" }));
    throw new Error(err.detail || err.error || "保存修改后的 PDF 失败");
  }

  const blob = await res.blob();
  const filename = `${file.name.replace(/\.[^/.]+$/, "")}_edited.pdf`;
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

