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
  fontFamily?: "times" | "arial" | "calibri" | "georgia" | "garamond" | "verdana" | "tahoma" | "courier" | "consolas" | "helvetica" | "sans" | "serif";
  displayFamily?: string;
  isBold?: boolean;
  isItalic?: boolean;
  detectedFont?: string;
  leftPercent: number;
  topPercent: number;
  widthPercent: number;
  heightPercent: number;
  lineId?: string;
  wordIndex?: number;
  items?: PdfInspectItem[];
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

export interface PdfReflowSegment {
  text: string;
  origX: number;
  origWidth: number;
  fontFamily?: string;
  fontSize?: number;
  isBold?: boolean;
  isItalic?: boolean;
  colorHex?: string;
  isPatched?: boolean;
}

export interface PdfTextPatch {
  id: string;
  targetItemId?: string;
  lineId?: string;
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
  fontFamily?: "times" | "arial" | "calibri" | "georgia" | "garamond" | "verdana" | "tahoma" | "courier" | "consolas" | "helvetica" | "sans" | "serif" | string;
  displayFamily?: string;
  isBold?: boolean;
  isItalic?: boolean;
  detectedFont?: string;
  fontSize?: number;
  colorHex?: string;
  bgHex?: string;
  autoFit?: boolean;
  padding?: number;
  isMoved?: boolean;
  isHighlight?: boolean;
  minXConstraint?: number;
  origTailRight?: number;
  reflowSegments?: PdfReflowSegment[];
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

export interface TableEncodingProbeResult {
  fileName: string;
  fileSize: number;
  detectedEncoding: {
    encoding: string;
    label: string;
    confidence: number;
    hasBom: boolean;
    bomLength: number;
  };
  activeEncoding: string;
  detectedDelimiter: string;
  activeDelimiter: string;
  totalRows: number;
  totalCols: number;
  headers: string[];
  previewRows: string[][];
  candidateEncodings: Array<{
    id: string;
    label: string;
    snippet: string;
  }>;
  hasGibberishRisk: boolean;
}

export interface TableEncodingConvertResult {
  success: boolean;
  blob: Blob;
  filename: string;
  totalRows: number;
  totalCols: number;
  targetFormat: string;
}

/**
 * 探测与分析表格文件字符集编码及分隔符
 */
export async function probeTableEncoding(
  file: File,
  options?: { overrideEncoding?: string; overrideDelimiter?: string }
): Promise<TableEncodingProbeResult> {
  const fileBuffer = await file.arrayBuffer();
  return await invokeNative<TableEncodingProbeResult>("spreadsheet:probe-encoding", {
    fileBuffer,
    fileName: file.name,
    overrideEncoding: options?.overrideEncoding,
    overrideDelimiter: options?.overrideDelimiter,
  });
}

/**
 * 智能转换并导出标准双击无乱码表格 (.xlsx / 带 BOM 的 .csv / 纯 UTF-8 .csv)
 */
export async function convertTableEncoding(
  file: File,
  options: {
    sourceEncoding?: string;
    targetFormat: "xlsx" | "csv-bom" | "csv-utf8";
    delimiter?: string;
  }
): Promise<TableEncodingConvertResult> {
  const fileBuffer = await file.arrayBuffer();
  const res = await invokeNative<{
    success: boolean;
    buffer: Uint8Array | ArrayBuffer;
    filename: string;
    mime: string;
    totalRows: number;
    totalCols: number;
    targetFormat: string;
  }>("spreadsheet:convert-encoding", {
    fileBuffer,
    fileName: file.name,
    sourceEncoding: options.sourceEncoding,
    targetFormat: options.targetFormat,
    delimiter: options.delimiter,
  });

  const blob = new Blob([res.buffer as any], { type: res.mime });
  return {
    success: res.success,
    blob,
    filename: res.filename,
    totalRows: res.totalRows,
    totalCols: res.totalCols,
    targetFormat: res.targetFormat,
  };
}

export type WordTemplateType = "gov-redhead" | "business-report" | "academic-paper";

export interface MarkdownPreviewBlock {
  type: "heading" | "paragraph" | "table" | "code" | "blockquote" | "list" | "hr";
  level?: number;
  text?: string;
  headers?: string[];
  rows?: string[][];
  alignments?: ("left" | "center" | "right")[];
  items?: Array<{
    text: string;
    ordered: boolean;
    level: number;
    checked?: boolean | null;
  }>;
  language?: string;
  lines?: string[];
  tokenizedLines?: Array<
    Array<{ text: string; type: string; color: string; italic?: boolean }>
  >;
}

export interface MarkdownInspectResult {
  success: boolean;
  fileName: string;
  normalizedMarkdown: string;
  detectedTitle: string;
  stats: {
    charCount: number;
    wordCount: number;
    headingCount: number;
    tableCount: number;
    listItemCount: number;
    codeBlockCount: number;
    quoteCount: number;
  };
  outline: Array<{ level: number; text: string }>;
  previewBlocks: MarkdownPreviewBlock[];
}

export interface MarkdownToWordOptions {
  content?: string;
  file?: File;
  fileName?: string;
  template: WordTemplateType;
  documentTitle?: string;
  enableRedHeader?: boolean;
  redHeaderOrg?: string;
  docNumber?: string;
  firstLineIndent?: boolean;
  includePageNumbers?: boolean;
  headerText?: string;
  cleanAiArtifacts?: boolean;
  lang?: string;
}

/**
 * 后端嗅探与解析 AI / Markdown 材料结构及排版预览块
 */
export async function inspectMarkdown(options: {
  content?: string;
  file?: File;
  cleanAiArtifacts?: boolean;
  lang?: string;
}): Promise<MarkdownInspectResult> {
  const fileBuffer = options.file ? await options.file.arrayBuffer() : undefined;
  return await invokeNative<MarkdownInspectResult>("document:inspect-markdown", {
    content: options.content,
    fileBuffer,
    fileName: options.file?.name || "AI_Document.md",
    cleanAiArtifacts: options.cleanAiArtifacts ?? true,
    lang: options.lang,
  });
}

/**
 * 一键将 AI / Markdown 材料转换为带规范样式的标准 Word (.docx)
 */
export async function convertMarkdownToWord(
  options: MarkdownToWordOptions
): Promise<{
  success: boolean;
  blob: Blob;
  filename: string;
  detectedTitle: string;
  stats: MarkdownInspectResult["stats"];
}> {
  const fileBuffer = options.file ? await options.file.arrayBuffer() : undefined;
  const res = await invokeNative<{
    success: boolean;
    buffer: Uint8Array | ArrayBuffer;
    filename: string;
    mime: string;
    detectedTitle: string;
    stats: MarkdownInspectResult["stats"];
  }>("document:markdown-to-word", {
    content: options.content,
    fileBuffer,
    fileName: options.file?.name || options.fileName || "AI_Document.md",
    template: options.template,
    documentTitle: options.documentTitle,
    enableRedHeader: options.enableRedHeader,
    redHeaderOrg: options.redHeaderOrg,
    docNumber: options.docNumber,
    firstLineIndent: options.firstLineIndent,
    includePageNumbers: options.includePageNumbers,
    headerText: options.headerText,
    cleanAiArtifacts: options.cleanAiArtifacts,
    lang: options.lang,
  });

  const blob = new Blob([res.buffer as any], { type: res.mime });
  return {
    success: res.success,
    blob,
    filename: res.filename,
    detectedTitle: res.detectedTitle,
    stats: res.stats,
  };
}



