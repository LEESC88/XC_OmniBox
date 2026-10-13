"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  ShieldAlert,
  Stamp,
  Type,
  Trash2,
  Download,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Upload,
  PenTool,
  Eraser,
  FileCheck,
} from "lucide-react";
import {
  renderPdfPages,
  signAndRedactPdf,
  PdfSignRedactOperation,
  downloadBlob,
  formatBytes,
} from "@/lib/api";
import { useI18n } from "@/lib/i18n";

interface PdfSignRedactStudioProps {
  file: File;
  onReset: () => void;
}

export default function PdfSignRedactStudio({
  file,
  onReset,
}: PdfSignRedactStudioProps) {
  const { lang } = useI18n();
  const [pages, setPages] = useState<
    Array<{ pageIndex: number; width: number; height: number; imageBase64: string }>
  >([]);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [loadingPages, setLoadingPages] = useState<boolean>(true);
  const [executing, setExecuting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    blob: Blob;
    filename: string;
    size: number;
    redactedPageCount: number;
  } | null>(null);

  // 当前工具模式：涂黑脱敏 (redact) | 签章盖印 (stamp) | 文字批注 (annotation)
  const [toolMode, setToolMode] = useState<"redact" | "stamp" | "annotation">("redact");
  const [redactColor, setRedactColor] = useState<string>("#000000");
  const [redactLabel, setRedactLabel] = useState<string>("");
  const [annotationText, setAnnotationText] = useState<string>(
    lang === "en" ? "APPROVED / VERIFIED" : "已审核 · 同意归档"
  );
  const [annotationColor, setAnnotationColor] = useState<string>("#DC2626");
  const [annotationFontSize, setAnnotationFontSize] = useState<number>(18);

  // 印章/手写签名图片 Base64
  const [stampBase64, setStampBase64] = useState<string | null>(null);
  const [showSignPad, setShowSignPad] = useState<boolean>(false);
  const signCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawingSign, setIsDrawingSign] = useState<boolean>(false);

  // 操作列表
  const [operations, setOperations] = useState<PdfSignRedactOperation[]>([]);

  // 鼠标拖拽选区状态
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null);

  // 1. 调用后端渲染 PDF 高清页面预览
  useEffect(() => {
    let cancelled = false;
    const loadPages = async () => {
      setLoadingPages(true);
      setError(null);
      try {
        const res = await renderPdfPages(file, 130, 50, false);
        if (!cancelled) {
          setPages(
            (res.pages || []).map((p: any, idx: number) => ({
              pageIndex: idx,
              width: p.width || 595,
              height: p.height || 842,
              imageBase64: p.image_base64 || p.imageBase64 || "",
            }))
          );
          setCurrentPage(0);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || "PDF 页面渲染失败");
        }
      } finally {
        if (!cancelled) {
          setLoadingPages(false);
        }
      }
    };
    loadPages();
    return () => {
      cancelled = true;
    };
  }, [file]);

  // 2. 上传透明印章或签名 PNG
  const handleStampUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setStampBase64(reader.result);
      }
    };
    reader.readAsDataURL(f);
  };

  // 3. 手写签名画板逻辑
  const startSignDraw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = signCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    setIsDrawingSign(true);
  };

  const moveSignDraw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingSign) return;
    const canvas = signCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const endSignDraw = () => {
    setIsDrawingSign(false);
  };

  const clearSignPad = () => {
    const canvas = signCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
  };

  const confirmSignPad = () => {
    const canvas = signCanvasRef.current;
    if (!canvas) return;
    setStampBase64(canvas.toDataURL("image/png"));
    setShowSignPad(false);
  };

  // 4. 在 PDF 页面预览图上拖拽拉框放置脱敏块/签章/批注
  const getNormalizedCoords = (clientX: number, clientY: number) => {
    const el = containerRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    return { x, y };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const pt = getNormalizedCoords(e.clientX, e.clientY);
    setDragStart(pt);
    setDragCurrent(pt);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragStart) return;
    setDragCurrent(getNormalizedCoords(e.clientX, e.clientY));
  };

  const handleMouseUp = () => {
    if (!dragStart || !dragCurrent) return;
    const x0 = Math.min(dragStart.x, dragCurrent.x);
    const y0 = Math.min(dragStart.y, dragCurrent.y);
    let w = Math.abs(dragCurrent.x - dragStart.x);
    let h = Math.abs(dragCurrent.y - dragStart.y);

    // 若用户只是单击，赋予合理默认尺寸
    if (w < 0.02 && h < 0.02) {
      if (toolMode === "annotation") {
        w = 0.28;
        h = 0.05;
      } else if (toolMode === "stamp") {
        w = 0.22;
        h = 0.12;
      } else {
        w = 0.25;
        h = 0.045;
      }
    }

    if (toolMode === "stamp" && !stampBase64) {
      setError(
        lang === "en"
          ? "Please upload a seal PNG or draw a signature on the left first"
          : "请先在左侧上传印章图片或手写绘制签名"
      );
      setDragStart(null);
      setDragCurrent(null);
      return;
    }

    const newOp: PdfSignRedactOperation = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      pageIndex: currentPage,
      type: toolMode,
      xRatio: x0,
      yRatio: y0,
      wRatio: Math.min(1 - x0, w),
      hRatio: Math.min(1 - y0, h),
      color: toolMode === "redact" ? redactColor : annotationColor,
      text:
        toolMode === "redact"
          ? redactLabel
          : toolMode === "annotation"
            ? annotationText
            : undefined,
      fontSize: annotationFontSize,
      imageBase64: toolMode === "stamp" ? stampBase64 || undefined : undefined,
    };

    setOperations((prev) => [...prev, newOp]);
    setError(null);
    setResult(null);
    setDragStart(null);
    setDragCurrent(null);
  };

  const removeOperation = (id?: string) => {
    setOperations((prev) => prev.filter((op) => op.id !== id));
    setResult(null);
  };

  const handleExecute = async () => {
    if (operations.length === 0) {
      setError(
        lang === "en"
          ? "Please drag on the page to add at least one redaction, stamp, or annotation"
          : "请先在右侧页面上拖拽或点击添加至少一处涂黑脱敏、签章或批注"
      );
      return;
    }
    setExecuting(true);
    setError(null);
    try {
      const res = await signAndRedactPdf(file, operations, 200);
      setResult({
        blob: res.blob,
        filename: res.filename,
        size: res.blob.size,
        redactedPageCount: res.redactedPageCount,
      });
    } catch (err: any) {
      setError(err.message || "处理失败");
    } finally {
      setExecuting(false);
    }
  };

  const pageOps = operations.filter((op) => op.pageIndex === currentPage);
  const activePageObj = pages[currentPage];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* 左侧控制面板 */}
      <div className="lg:col-span-5 coconut-panel p-5 sm:p-6 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-coconut-200/80 dark:border-darkbg-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-600 to-orange-600 text-white flex items-center justify-center shadow-sm">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-coconut-950 dark:text-darkbg-text">
                {lang === "en"
                  ? "PDF Sign, Annotate & Redact"
                  : "PDF 签章、批注与物理涂黑脱敏"}
              </h3>
              <p className="text-[11px] text-coconut-600 dark:text-darkbg-muted">
                {file.name} ({pages.length} {lang === "en" ? "pages" : "页"})
              </p>
            </div>
          </div>
          <button
            onClick={onReset}
            className="text-xs px-2.5 py-1.5 rounded-xl bg-coconut-100 dark:bg-darkbg-subtle text-coconut-700 dark:text-darkbg-muted hover:text-coconut-950 font-semibold"
          >
            {lang === "en" ? "Change File" : "更换文件"}
          </button>
        </div>

        {/* 3 大操作模式切换 */}
        <div className="grid grid-cols-3 gap-2 p-1 bg-coconut-100/80 dark:bg-darkbg-subtle rounded-2xl border border-coconut-200/80 dark:border-darkbg-border">
          <button
            type="button"
            onClick={() => setToolMode("redact")}
            className={`py-2.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              toolMode === "redact"
                ? "bg-white dark:bg-darkbg-card text-rose-700 dark:text-rose-300 shadow-sm"
                : "text-coconut-600 dark:text-darkbg-muted"
            }`}
          >
            <Eraser className="w-3.5 h-3.5" />
            <span>{lang === "en" ? "Redact" : "涂黑脱敏"}</span>
          </button>
          <button
            type="button"
            onClick={() => setToolMode("stamp")}
            className={`py-2.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              toolMode === "stamp"
                ? "bg-white dark:bg-darkbg-card text-orange-700 dark:text-orange-300 shadow-sm"
                : "text-coconut-600 dark:text-darkbg-muted"
            }`}
          >
            <Stamp className="w-3.5 h-3.5" />
            <span>{lang === "en" ? "Seal / Sign" : "公章/手写签"}</span>
          </button>
          <button
            type="button"
            onClick={() => setToolMode("annotation")}
            className={`py-2.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              toolMode === "annotation"
                ? "bg-white dark:bg-darkbg-card text-amber-700 dark:text-amber-300 shadow-sm"
                : "text-coconut-600 dark:text-darkbg-muted"
            }`}
          >
            <Type className="w-3.5 h-3.5" />
            <span>{lang === "en" ? "Annotate" : "文字批注"}</span>
          </button>
        </div>

        {/* 模式专属参数 */}
        {toolMode === "redact" && (
          <div className="space-y-3 p-3.5 rounded-2xl bg-coconut-100/50 dark:bg-darkbg-subtle border border-coconut-200/70 dark:border-darkbg-border">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-coconut-900 dark:text-darkbg-text">
                {lang === "en" ? "Redaction Fill Color" : "物理遮盖色块颜色"}
              </span>
              <div className="flex items-center gap-2">
                {["#000000", "#1E293B", "#7F1D1D", "#FFFFFF"].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setRedactColor(c)}
                    className={`w-6 h-6 rounded-full border-2 transition-transform ${
                      redactColor === c
                        ? "border-orange-500 scale-110"
                        : "border-coconut-300"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-coconut-800 dark:text-darkbg-muted mb-1">
                {lang === "en" ? "Overlay Label (Optional)" : "脱敏区表面印字（可选，如 CONFIDENTIAL）"}
              </label>
              <input
                type="text"
                value={redactLabel}
                onChange={(e) => setRedactLabel(e.target.value)}
                placeholder={lang === "en" ? "Leave blank for solid block" : "留空则为纯黑/纯白实心涂抹"}
                className="w-full text-xs p-2.5 rounded-xl bg-white dark:bg-darkbg-card border border-coconut-200 dark:border-darkbg-border outline-none"
              />
            </div>
            <p className="text-[11px] text-rose-700 dark:text-rose-300 leading-relaxed font-medium">
              {lang === "en"
                ? "⚡ True Physical Redaction: Redacted pages are raster-flattened at 200 DPI so underlying text coordinates are permanently destroyed and cannot be copied."
                : "⚡ 物理防穿透：含涂黑脱敏的页面将在底层执行位图熔合重绘，彻底销毁原 PDF 底层字符坐标，100% 杜绝鼠标选中复制穿透。"}
            </p>
          </div>
        )}

        {toolMode === "stamp" && (
          <div className="space-y-3 p-3.5 rounded-2xl bg-coconut-100/50 dark:bg-darkbg-subtle border border-coconut-200/70 dark:border-darkbg-border">
            <div className="flex flex-wrap gap-2">
              <label className="flex-1 py-2.5 px-3 rounded-xl bg-white dark:bg-darkbg-card border border-coconut-200 dark:border-darkbg-border text-xs font-bold text-coconut-900 dark:text-darkbg-text flex items-center justify-center gap-1.5 cursor-pointer hover:border-orange-500">
                <Upload className="w-3.5 h-3.5 text-orange-600" />
                <span>{lang === "en" ? "Upload Seal PNG" : "上传透明公章/签名图"}</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleStampUpload}
                  className="hidden"
                />
              </label>
              <button
                type="button"
                onClick={() => setShowSignPad((v) => !v)}
                className="py-2.5 px-3 rounded-xl bg-white dark:bg-darkbg-card border border-coconut-200 dark:border-darkbg-border text-xs font-bold text-coconut-900 dark:text-darkbg-text flex items-center justify-center gap-1.5 hover:border-orange-500"
              >
                <PenTool className="w-3.5 h-3.5 text-amber-600" />
                <span>{lang === "en" ? "Draw Signature" : "手写签名板"}</span>
              </button>
            </div>

            {showSignPad && (
              <div className="space-y-2 p-2.5 rounded-xl bg-white dark:bg-darkbg-card border border-coconut-200 dark:border-darkbg-border">
                <div className="text-[11px] font-bold text-coconut-700 dark:text-darkbg-muted">
                  {lang === "en" ? "Sign inside the box below:" : "在下方空白处按住鼠标手写签名："}
                </div>
                <canvas
                  ref={signCanvasRef}
                  width={320}
                  height={120}
                  onMouseDown={startSignDraw}
                  onMouseMove={moveSignDraw}
                  onMouseUp={endSignDraw}
                  onMouseLeave={endSignDraw}
                  className="w-full h-[120px] bg-coconut-50/70 rounded-lg border border-dashed border-coconut-300 cursor-crosshair"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={clearSignPad}
                    className="px-2.5 py-1 text-xs rounded-lg bg-coconut-100 text-coconut-700 font-semibold"
                  >
                    {lang === "en" ? "Clear" : "重写"}
                  </button>
                  <button
                    type="button"
                    onClick={confirmSignPad}
                    className="px-3 py-1 text-xs rounded-lg bg-orange-600 text-white font-bold"
                  >
                    {lang === "en" ? "Use Signature" : "确认使用该签名"}
                  </button>
                </div>
              </div>
            )}

            {stampBase64 && (
              <div className="flex items-center gap-3 p-2 rounded-xl bg-white/80 dark:bg-darkbg-card border border-coconut-200/70">
                <img
                  src={stampBase64}
                  alt="stamp preview"
                  className="h-10 w-auto object-contain rounded border border-coconut-200 bg-white px-1"
                />
                <span className="text-[11px] text-palm-700 dark:text-palm-300 font-semibold">
                  {lang === "en"
                    ? "Ready! Drag or click on the PDF page to place"
                    : "印章/签名已就绪！在右侧页面上拖拽或点击即可盖印"}
                </span>
              </div>
            )}
          </div>
        )}

        {toolMode === "annotation" && (
          <div className="space-y-3 p-3.5 rounded-2xl bg-coconut-100/50 dark:bg-darkbg-subtle border border-coconut-200/70 dark:border-darkbg-border">
            <div>
              <label className="block text-xs font-bold text-coconut-900 dark:text-darkbg-text mb-1">
                {lang === "en" ? "Annotation Text" : "批注文本内容"}
              </label>
              <input
                type="text"
                value={annotationText}
                onChange={(e) => setAnnotationText(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl bg-white dark:bg-darkbg-card border border-coconut-200 dark:border-darkbg-border outline-none"
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-coconut-800 dark:text-darkbg-muted">
                  {lang === "en" ? "Color" : "颜色"}
                </span>
                {["#DC2626", "#2563EB", "#059669", "#111827"].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setAnnotationColor(c)}
                    className={`w-5 h-5 rounded-full border-2 ${
                      annotationColor === c ? "border-orange-500 scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-coconut-800 dark:text-darkbg-muted">
                  {lang === "en" ? "Size" : "字号"}
                </span>
                <input
                  type="number"
                  min={10}
                  max={48}
                  value={annotationFontSize}
                  onChange={(e) => setAnnotationFontSize(Number(e.target.value) || 18)}
                  className="w-16 text-xs p-1.5 rounded-lg bg-white dark:bg-darkbg-card border border-coconut-200 text-center font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {/* 已添加操作清单 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-coconut-800 dark:text-darkbg-muted">
            <span>
              {lang === "en"
                ? `Operations Queue (${operations.length})`
                : `待执行标记队列 (${operations.length} 处)`}
            </span>
            {operations.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setOperations([]);
                  setResult(null);
                }}
                className="text-[11px] text-rose-600 hover:underline"
              >
                {lang === "en" ? "Clear All" : "清空全部"}
              </button>
            )}
          </div>
          <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
            {operations.length === 0 ? (
              <div className="text-xs text-coconut-500 dark:text-darkbg-muted py-4 text-center border border-dashed border-coconut-200 dark:border-darkbg-border rounded-xl">
                {lang === "en"
                  ? "Drag or click on the right PDF preview to add redactions, stamps, or notes"
                  : "在右侧 PDF 预览图上按住鼠标拉框（或直接点击）即可添加脱敏/签章/批注"}
              </div>
            ) : (
              operations.map((op, i) => (
                <div
                  key={op.id || i}
                  className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/80 dark:bg-darkbg-subtle border border-coconut-200/70 dark:border-darkbg-border text-xs"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-800 dark:text-amber-300 font-mono text-[10px] font-bold">
                      P{op.pageIndex + 1}
                    </span>
                    <span className="font-semibold text-coconut-900 dark:text-darkbg-text truncate">
                      {op.type === "redact"
                        ? lang === "en"
                          ? "Physical Redact"
                          : "物理涂黑脱敏"
                        : op.type === "stamp"
                          ? lang === "en"
                            ? "Seal / Signature"
                            : "印章/手写签名"
                          : `${lang === "en" ? "Note" : "批注"}: ${op.text}`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeOperation(op.id)}
                    className="text-coconut-400 hover:text-rose-600 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {error && (
          <div className="p-3 bg-toast-50 dark:bg-toast-950/40 border border-toast-200 rounded-2xl flex items-center gap-2 text-toast-700 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-toast-500" />
            <span>{error}</span>
          </div>
        )}

        {result ? (
          <div className="p-4 bg-accent-subtle border border-accent-border rounded-2xl space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-accent-gradient text-white flex items-center justify-center flex-shrink-0">
                <FileCheck className="w-5 h-5" />
              </div>
              <div className="truncate">
                <div className="text-xs font-bold text-coconut-950 dark:text-white truncate">
                  {result.filename}
                </div>
                <div className="text-[11px] text-orange-800 dark:text-amber-300 font-mono">
                  {formatBytes(result.size)} ·{" "}
                  {result.redactedPageCount > 0
                    ? `已物理销毁 ${result.redactedPageCount} 页底层文本流`
                    : "矢量签章合成完毕"}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                data-download-result="true"
                onClick={() => downloadBlob(result.blob, result.filename)}
                className="flex-1 py-2.5 px-4 rounded-xl btn-3d-sunset text-white font-bold text-xs flex items-center justify-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                <span>{lang === "en" ? "Download PDF" : "下载脱敏/签章后 PDF"}</span>
              </button>
              <button
                type="button"
                onClick={onReset}
                className="py-2.5 px-3 rounded-xl btn-3d-secondary text-xs font-bold flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            data-primary-action="true"
            onClick={handleExecute}
            disabled={executing || operations.length === 0}
            className={`w-full py-3.5 px-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
              executing || operations.length === 0
                ? "bg-coconut-100 dark:bg-darkbg-subtle text-coconut-400 cursor-not-allowed border border-coconut-200"
                : "btn-3d-sunset text-white cursor-pointer"
            }`}
          >
            {executing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>
                  {lang === "en"
                    ? "Applying Physical Redaction & Seals..."
                    : "正在执行底层脱敏熔合与签章合成..."}
                </span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 text-amber-200" />
                <span>
                  {lang === "en"
                    ? "Apply & Export PDF"
                    : "立即执行物理脱敏与签章导出"}
                </span>
              </>
            )}
          </button>
        )}
      </div>

      {/* 右侧交互画布预览区 */}
      <div className="lg:col-span-7 coconut-panel p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-coconut-900 dark:text-darkbg-text">
            {lang === "en"
              ? `Interactive Page Canvas (Page ${currentPage + 1} / ${Math.max(1, pages.length)})`
              : `页面可视化标注画布（第 ${currentPage + 1} / ${Math.max(1, pages.length)} 页）`}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage <= 0}
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              className="p-1.5 rounded-xl bg-coconut-100 dark:bg-darkbg-subtle disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono font-bold">
              {currentPage + 1} / {Math.max(1, pages.length)}
            </span>
            <button
              type="button"
              disabled={currentPage >= pages.length - 1}
              onClick={() => setCurrentPage((p) => Math.min(pages.length - 1, p + 1))}
              className="p-1.5 rounded-xl bg-coconut-100 dark:bg-darkbg-subtle disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {loadingPages ? (
          <div className="h-[520px] flex flex-col items-center justify-center gap-3 text-coconut-600">
            <Loader2 className="w-7 h-7 animate-spin text-orange-500" />
            <span className="text-xs font-semibold">
              {lang === "en" ? "Rendering high-DPI page preview..." : "正在调用本地引擎渲染高清页面预览..."}
            </span>
          </div>
        ) : activePageObj ? (
          <div className="flex justify-center bg-coconut-100/70 dark:bg-darkbg-subtle p-4 rounded-2xl border border-coconut-200/80 dark:border-darkbg-border overflow-auto max-h-[680px]">
            <div
              ref={containerRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              className="relative inline-block shadow-xl rounded-lg overflow-hidden select-none cursor-crosshair border border-coconut-300"
            >
              <img
                src={
                  activePageObj.imageBase64.startsWith("data:")
                    ? activePageObj.imageBase64
                    : `data:image/png;base64,${activePageObj.imageBase64}`
                }
                alt={`Page ${currentPage + 1}`}
                draggable={false}
                className="max-w-full h-auto block pointer-events-none"
                style={{ maxHeight: "620px" }}
              />

              {/* 已放置的当前页标记 */}
              {pageOps.map((op) => (
                <div
                  key={op.id}
                  style={{
                    left: `${op.xRatio * 100}%`,
                    top: `${op.yRatio * 100}%`,
                    width: `${op.wRatio * 100}%`,
                    height: `${op.hRatio * 100}%`,
                    backgroundColor:
                      op.type === "redact" ? op.color || "#000000" : "transparent",
                    borderColor:
                      op.type === "redact"
                        ? "#EF4444"
                        : op.type === "stamp"
                          ? "#F97316"
                          : "#F59E0B",
                  }}
                  className="absolute border-2 flex items-center justify-center group"
                >
                  {op.type === "redact" && op.text && (
                    <span className="text-[10px] font-bold text-white truncate px-1">
                      {op.text}
                    </span>
                  )}
                  {op.type === "stamp" && op.imageBase64 && (
                    <img
                      src={op.imageBase64}
                      alt="stamp"
                      className="w-full h-full object-contain pointer-events-none"
                    />
                  )}
                  {op.type === "annotation" && (
                    <span
                      style={{ color: op.color || "#DC2626" }}
                      className="text-xs font-bold leading-tight break-words w-full h-full flex items-start p-0.5 bg-amber-50/70"
                    >
                      {op.text}
                    </span>
                  )}
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      removeOperation(op.id);
                    }}
                    className="absolute -top-2.5 -right-2.5 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
                  >
                    ×
                  </button>
                </div>
              ))}

              {/* 正在拖拽的实时选框 */}
              {dragStart && dragCurrent && (
                <div
                  style={{
                    left: `${Math.min(dragStart.x, dragCurrent.x) * 100}%`,
                    top: `${Math.min(dragStart.y, dragCurrent.y) * 100}%`,
                    width: `${Math.abs(dragCurrent.x - dragStart.x) * 100}%`,
                    height: `${Math.abs(dragCurrent.y - dragStart.y) * 100}%`,
                  }}
                  className="absolute border-2 border-dashed border-orange-500 bg-orange-500/20 pointer-events-none"
                />
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
