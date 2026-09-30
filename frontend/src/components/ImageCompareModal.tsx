"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  X,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Columns,
  ChevronsLeftRight,
  Maximize2,
  Sparkles,
  ArrowRight,
  Info,
} from "lucide-react";
import { formatBytes } from "@/lib/imageProcessor";
import { downloadBlob } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export interface ImageCompareItem {
  id?: string;
  originalName: string;
  originalSize: number;
  originalUrl: string;
  newFilename: string;
  newSize: number;
  previewUrl: string;
  blob?: Blob;
  extraInfo?: string;
}

interface ImageCompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ImageCompareItem | null;
}

export default function ImageCompareModal({
  isOpen,
  onClose,
  item,
}: ImageCompareModalProps) {
  const { lang } = useI18n();
  const [splitPos, setSplitPos] = useState<number>(50); // 百分比 0 ~ 100
  const [viewMode, setViewMode] = useState<"slider" | "side-by-side">("slider");
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDraggingSlider, setIsDraggingSlider] = useState<boolean>(false);
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const panStartRef = useRef<{ startX: number; startY: number; initPanX: number; initPanY: number }>({
    startX: 0,
    startY: 0,
    initPanX: 0,
    initPanY: 0,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const rafIdRef = useRef<number | null>(null);
  const panRafRef = useRef<number | null>(null);

  // 清理未完成的帧动画
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
      if (panRafRef.current !== null) cancelAnimationFrame(panRafRef.current);
    };
  }, []);

  // 重置状态
  useEffect(() => {
    if (isOpen) {
      setSplitPos(50);
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
  }, [isOpen, item]);

  // 键盘快捷键监听
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setSplitPos((prev) => Math.max(0, prev - (e.shiftKey ? 10 : 2)));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setSplitPos((prev) => Math.min(100, prev + (e.shiftKey ? 10 : 2)));
      } else if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        handleZoomIn();
      } else if (e.key === "-") {
        e.preventDefault();
        handleZoomOut();
      } else if (e.key === "0") {
        e.preventDefault();
        handleResetView();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // 移动分割线位置 (通过 RAF 节流对齐 60/120/144Hz 屏幕刷新率，杜绝高回报率鼠标引起 React 抖动)
  const updateSplitFromPointer = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }
    rafIdRef.current = requestAnimationFrame(() => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width <= 0) return;
      const offset = clientX - rect.left;
      const percentage = Math.max(0, Math.min(100, (offset / rect.width) * 100));
      setSplitPos(percentage);
      rafIdRef.current = null;
    });
  }, []);

  // 分割拖动事件
  const handleSliderPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDraggingSlider(true);
    updateSplitFromPointer(e.clientX);
  };

  const handleSliderPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingSlider) return;
    updateSplitFromPointer(e.clientX);
  };

  const handleSliderPointerUp = (e: React.PointerEvent) => {
    if (isDraggingSlider) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
      setIsDraggingSlider(false);
    }
  };

  // 画面平移拖动事件 (当 zoom > 1 时)
  const handleContainerPointerDown = (e: React.PointerEvent) => {
    // 如果点在滑块上，由滑块处理
    if (isDraggingSlider) return;

    if (e.button === 0 && zoom > 1) {
      setIsPanning(true);
      panStartRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        initPanX: pan.x,
        initPanY: pan.y,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } else if (viewMode === "slider" && zoom === 1) {
      // 在 100% 模式下，直接点击画布任意位置移动分割线
      updateSplitFromPointer(e.clientX);
      setIsDraggingSlider(true);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const handleContainerPointerMove = (e: React.PointerEvent) => {
    if (isDraggingSlider) {
      updateSplitFromPointer(e.clientX);
      return;
    }

    if (isPanning && zoom > 1) {
      const clientX = e.clientX;
      const clientY = e.clientY;
      if (panRafRef.current !== null) {
        cancelAnimationFrame(panRafRef.current);
      }
      panRafRef.current = requestAnimationFrame(() => {
        const dx = clientX - panStartRef.current.startX;
        const dy = clientY - panStartRef.current.startY;
        setPan({
          x: panStartRef.current.initPanX + dx,
          y: panStartRef.current.initPanY + dy,
        });
        panRafRef.current = null;
      });
    }
  };

  const handleContainerPointerUp = (e: React.PointerEvent) => {
    if (isPanning) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      setIsPanning(false);
    }
    if (isDraggingSlider) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      setIsDraggingSlider(false);
    }
  };

  // 滚轮缩放
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    setZoom((prev) => {
      const nextZoom = Math.min(4, Math.max(0.5, prev * zoomFactor));
      if (nextZoom === 1) setPan({ x: 0, y: 0 });
      return nextZoom;
    });
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(4, +(prev + 0.25).toFixed(2)));
  };

  const handleZoomOut = () => {
    setZoom((prev) => {
      const next = Math.max(0.5, +(prev - 0.25).toFixed(2));
      if (next <= 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };

  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSplitPos(50);
  };

  if (!isOpen || !item) return null;

  // 计算体积差异
  const diffBytes = item.newSize - item.originalSize;
  const diffPercent = item.originalSize > 0
    ? (((item.newSize - item.originalSize) / item.originalSize) * 100).toFixed(1)
    : "0";
  const isSmaller = diffBytes < 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="gpu-layer relative w-full max-w-6xl max-h-[95vh] flex flex-col bg-[#FDFBF7] dark:bg-[#1C1613] border border-coconut-300 dark:border-darkbg-border rounded-3xl shadow-2xl overflow-hidden">
        
        {/* 顶部 Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-coconut-200/80 dark:border-darkbg-border bg-coconut-100/50 dark:bg-darkbg-subtle flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-accent-gradient flex items-center justify-center text-white shadow-md flex-shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base sm:text-lg font-extrabold text-coconut-950 dark:text-darkbg-text">
                  {lang === "en" ? "Interactive Quality Inspection" : "画质细节微距对比 (Squoosh 模式)"}
                </h3>
                {isSmaller ? (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300/40">
                    {lang === "en" ? `Saved ${Math.abs(Number(diffPercent))}%` : `体积减少 ${Math.abs(Number(diffPercent))}% (-${formatBytes(Math.abs(diffBytes))})`}
                  </span>
                ) : (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-300/40">
                    {lang === "en" ? `+${diffPercent}%` : `体积增加 +${diffPercent}% (+${formatBytes(diffBytes)})`}
                  </span>
                )}
              </div>
              <p className="text-xs text-coconut-600 dark:text-darkbg-muted mt-0.5 truncate max-w-md">
                {item.originalName} → {item.newFilename} {item.extraInfo ? `(${item.extraInfo})` : ""}
              </p>
            </div>
          </div>

          {/* 右侧控制项 */}
          <div className="flex items-center space-x-2">
            {/* 视图模式切换 */}
            <div className="hidden sm:flex bg-coconut-200/60 dark:bg-darkbg-elevated p-1 rounded-xl text-xs">
              <button
                onClick={() => setViewMode("slider")}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  viewMode === "slider"
                    ? "bg-white dark:bg-zinc-800 text-coconut-900 dark:text-white shadow-sm"
                    : "text-coconut-600 dark:text-darkbg-muted hover:text-coconut-900 dark:hover:text-white"
                }`}
              >
                {lang === "en" ? "Slider" : "滑块对比"}
              </button>
              <button
                onClick={() => setViewMode("side-by-side")}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  viewMode === "side-by-side"
                    ? "bg-white dark:bg-zinc-800 text-coconut-900 dark:text-white shadow-sm"
                    : "text-coconut-600 dark:text-darkbg-muted hover:text-coconut-900 dark:hover:text-white"
                }`}
              >
                {lang === "en" ? "Side by Side" : "左右并排"}
              </button>
            </div>

            {/* 关闭按钮 */}
            <button
              onClick={onClose}
              className="p-2 text-coconut-400 hover:text-coconut-800 dark:hover:text-white rounded-full hover:bg-coconut-200/50 dark:hover:bg-darkbg-hover transition-colors"
              title={lang === "en" ? "Close (Esc)" : "关闭 (Esc)"}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 主体画布展示区域 */}
        <div className="relative flex-1 min-h-[380px] sm:min-h-[500px] max-h-[68vh] overflow-hidden bg-zinc-950 flex items-center justify-center select-none">
          {/* 细腻棋盘格底纹 (透视透明背景) */}
          <div
            className="absolute inset-0 pointer-events-none opacity-20"
            style={{
              backgroundImage:
                "conic-gradient(#888 90deg, transparent 90deg 180deg, #888 180deg 270deg, transparent 270deg)",
              backgroundSize: "24px 24px",
            }}
          />

          {viewMode === "slider" ? (
            /* 1. 滑块对比模式 (Squoosh 核心交互) */
            <div
              ref={containerRef}
              onPointerDown={handleContainerPointerDown}
              onPointerMove={handleContainerPointerMove}
              onPointerUp={handleContainerPointerUp}
              onWheel={handleWheel}
              className={`relative w-full h-full flex items-center justify-center overflow-hidden ${
                zoom > 1
                  ? isPanning
                    ? "cursor-grabbing"
                    : "cursor-grab"
                  : "cursor-ew-resize"
              }`}
            >
              {/* 图像渲染层容器 (带平移缩放) */}
              <div
                className="relative w-full h-full flex items-center justify-center transition-transform duration-75"
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: "center center",
                }}
              >
                {/* 底层：处理后图像 (After) */}
                <img
                  src={item.previewUrl}
                  alt="Processed Output"
                  className="absolute max-w-[90%] max-h-[90%] w-auto h-auto object-contain pointer-events-none select-none drop-shadow-md"
                  draggable={false}
                />

                {/* 顶层：原始图像 (Before) - 使用 polygon clip-path 精准裁剪 */}
                <img
                  src={item.originalUrl}
                  alt="Original"
                  className="absolute max-w-[90%] max-h-[90%] w-auto h-auto object-contain pointer-events-none select-none drop-shadow-md"
                  draggable={false}
                  style={{
                    clipPath: `polygon(0 0, ${splitPos}% 0, ${splitPos}% 100%, 0 100%)`,
                  }}
                />
              </div>

              {/* 垂直分割线与居中抓手 */}
              <div
                onPointerDown={handleSliderPointerDown}
                onPointerMove={handleSliderPointerMove}
                onPointerUp={handleSliderPointerUp}
                className="absolute top-0 bottom-0 z-20 flex items-center justify-center cursor-ew-resize group"
                style={{
                  left: `${splitPos}%`,
                  transform: "translateX(-50%)",
                }}
              >
                {/* 分割光纤细线 */}
                <div className="w-0.5 h-full bg-white shadow-[0_0_8px_rgba(0,0,0,0.8)] group-hover:bg-palm-400 group-hover:w-1 transition-all" />

                {/* 居中拖拽手柄 pill */}
                <div className="absolute w-8 h-8 rounded-full bg-white dark:bg-zinc-900 border-2 border-palm-500 shadow-2xl flex items-center justify-center group-hover:scale-115 active:scale-95 transition-transform text-palm-600 dark:text-palm-400">
                  <ChevronsLeftRight className="w-4 h-4" />
                </div>
              </div>

              {/* 左上角与右上角浮动状态指示牌 */}
              <div className="absolute top-4 left-4 z-20 pointer-events-none">
                <div className="px-3 py-1.5 rounded-xl bg-black/65 backdrop-blur-md border border-white/10 text-white shadow-lg space-y-0.5">
                  <div className="text-[10px] uppercase font-bold text-zinc-400 flex items-center gap-1">
                    <span>{lang === "en" ? "Original" : "原图"}</span>
                  </div>
                  <div className="text-xs font-mono font-semibold">
                    {formatBytes(item.originalSize)}
                  </div>
                </div>
              </div>

              <div className="absolute top-4 right-4 z-20 pointer-events-none">
                <div className="px-3 py-1.5 rounded-xl bg-palm-950/80 backdrop-blur-md border border-palm-500/30 text-white shadow-lg space-y-0.5 text-right">
                  <div className="text-[10px] uppercase font-bold text-palm-300 flex items-center justify-end gap-1">
                    <span>{lang === "en" ? "Processed" : "处理后"}</span>
                  </div>
                  <div className="text-xs font-mono font-semibold text-palm-200">
                    {formatBytes(item.newSize)}
                  </div>
                </div>
              </div>

              {/* 底部滑块位置提示 */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
                <div className="px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-zinc-300 text-[11px] font-mono">
                  {Math.round(splitPos)}%
                </div>
              </div>
            </div>
          ) : (
            /* 2. 左右并排模式 */
            <div
              onWheel={handleWheel}
              className="w-full h-full grid grid-cols-2 divide-x divide-zinc-800 p-4 gap-4 overflow-hidden"
            >
              <div className="relative flex flex-col items-center justify-center h-full overflow-hidden bg-black/30 rounded-2xl p-2">
                <div className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-lg bg-black/70 text-white text-xs font-mono">
                  {lang === "en" ? "Original: " : "原始: "} {formatBytes(item.originalSize)}
                </div>
                <div
                  className="w-full h-full flex items-center justify-center transition-transform"
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  }}
                >
                  <img
                    src={item.originalUrl}
                    alt="Original"
                    className="max-w-full max-h-full object-contain pointer-events-none"
                    draggable={false}
                  />
                </div>
              </div>

              <div className="relative flex flex-col items-center justify-center h-full overflow-hidden bg-black/30 rounded-2xl p-2">
                <div className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-lg bg-palm-900/80 text-palm-200 text-xs font-mono font-bold">
                  {lang === "en" ? "Output: " : "处理后: "} {formatBytes(item.newSize)}
                </div>
                <div
                  className="w-full h-full flex items-center justify-center transition-transform"
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  }}
                >
                  <img
                    src={item.previewUrl}
                    alt="Processed"
                    className="max-w-full max-h-full object-contain pointer-events-none"
                    draggable={false}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 底部控制工具栏 */}
        <div className="flex flex-wrap items-center justify-between px-5 py-3 border-t border-coconut-200/80 dark:border-darkbg-border bg-coconut-50 dark:bg-darkbg-elevated gap-3 flex-shrink-0">
          {/* 左侧：缩放控制 */}
          <div className="flex items-center space-x-1.5 text-xs text-coconut-700 dark:text-darkbg-muted">
            <button
              onClick={handleZoomOut}
              className="p-1.5 rounded-lg hover:bg-coconut-200 dark:hover:bg-darkbg-hover text-coconut-800 dark:text-darkbg-text transition-colors"
              title={lang === "en" ? "Zoom Out (-)" : "缩小 (-)"}
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="font-mono font-bold w-12 text-center text-coconut-900 dark:text-darkbg-text">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              className="p-1.5 rounded-lg hover:bg-coconut-200 dark:hover:bg-darkbg-hover text-coconut-800 dark:text-darkbg-text transition-colors"
              title={lang === "en" ? "Zoom In (+)" : "放大 (+)"}
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={handleResetView}
              className="p-1.5 rounded-lg hover:bg-coconut-200 dark:hover:bg-darkbg-hover text-coconut-800 dark:text-darkbg-text transition-colors ml-1"
              title={lang === "en" ? "Reset View (0)" : "重置视角 (0)"}
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <span className="hidden sm:inline-block text-[11px] text-coconut-400 dark:text-darkbg-subtext ml-2">
              {lang === "en"
                ? "Tip: Drag divider or scroll to zoom, drag to pan when zoomed"
                : "提示: 左右拖动分割线对比画质，滚轮可缩放，放大后按住可平移"}
            </span>
          </div>

          {/* 右侧：下载与关闭操作 */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                if (item.blob) {
                  downloadBlob(item.blob, item.newFilename);
                } else if (item.previewUrl) {
                  const a = document.createElement("a");
                  a.href = item.previewUrl;
                  a.download = item.newFilename;
                  a.click();
                }
              }}
              className="px-4 py-2 rounded-xl bg-accent-gradient hover:opacity-95 text-white font-bold text-xs shadow-md transition-all active:scale-95 flex items-center space-x-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{lang === "en" ? "Download File" : "下载处理后图片"}</span>
              <span className="text-[10px] opacity-80 font-mono">({formatBytes(item.newSize)})</span>
            </button>

            <button
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl bg-coconut-200/70 hover:bg-coconut-300 dark:bg-darkbg-subtle dark:hover:bg-darkbg-hover text-coconut-800 dark:text-darkbg-text font-bold text-xs transition-colors"
            >
              {lang === "en" ? "Close" : "关闭"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
