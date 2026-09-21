"use client";

import React, { useState, useEffect } from "react";
import {
  Scissors,
  CheckSquare,
  Square,
  ZoomIn,
  X,
  FileCheck,
  Download,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  Loader2,
  FileText,
  Sparkles,
  Layers,
  ArrowRight,
} from "lucide-react";
import { formatBytes } from "@/lib/imageProcessor";
import { renderPdfPages, downloadBlob } from "@/lib/api";

interface PdfSplitStudioProps {
  file: File;
  onSplit: (pageRanges?: string) => Promise<void>;
  loading: boolean;
  error: string | null;
  successMsg: string | null;
  executionResult: { blob: Blob; filename: string; size: number } | null;
  onReset: () => void;
  onClearFile: () => void;
}

interface PageData {
  pageIndex: number;
  width: number;
  height: number;
  image: string;
}

// 辅助函数：将页码集合压缩为标准范围字符串 (如 [1, 2, 3, 5, 7, 8] -> "1-3, 5, 7-8")
function formatPageSetToRanges(pageNumbers: number[]): string {
  if (pageNumbers.length === 0) return "";
  const sorted = Array.from(new Set(pageNumbers)).sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0];
  let end = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i];
    } else {
      ranges.push(start === end ? `${start}` : `${start}-${end}`);
      start = sorted[i];
      end = sorted[i];
    }
  }
  ranges.push(start === end ? `${start}` : `${start}-${end}`);
  return ranges.join(", ");
}

export default function PdfSplitStudio({
  file,
  onSplit,
  loading,
  error,
  successMsg,
  executionResult,
  onReset,
  onClearFile,
}: PdfSplitStudioProps) {
  const [pages, setPages] = useState<PageData[]>([]);
  const [numPages, setNumPages] = useState<number>(0);
  const [renderingPages, setRenderingPages] = useState<boolean>(true);
  const [renderError, setRenderError] = useState<string | null>(null);

  // 模式：extract (提取选中页) | split-all (拆分为单页压缩包)
  const [splitMode, setSplitMode] = useState<"extract" | "split-all">("extract");

  // 选中的页码 (1-based index)
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());

  // 放大预览的单页
  const [zoomedPage, setZoomedPage] = useState<PageData | null>(null);

  // 加载文档所有页面的缩略图
  useEffect(() => {
    let isCancelled = false;
    setRenderingPages(true);
    setRenderError(null);
    setPages([]);
    setSelectedPages(new Set());

    // 采用 80 DPI 快速渲染缩略图，跳过文本块提取
    renderPdfPages(file, 80, undefined, false)
      .then((res) => {
        if (!isCancelled) {
          setPages(res.pages);
          setNumPages(res.numPages);
          // 默认全选前 1 页方便即开即用
          setSelectedPages(new Set([1]));
          setRenderingPages(false);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          setRenderError(err.message || "解析 PDF 页面缩略图失败");
          setRenderingPages(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [file]);

  // 点击单张卡片切换选中
  const togglePageSelection = (pageNum: number) => {
    setSelectedPages((prev) => {
      const next = new Set(prev);
      if (next.has(pageNum)) {
        next.delete(pageNum);
      } else {
        next.add(pageNum);
      }
      return next;
    });
  };

  // 全选
  const handleSelectAll = () => {
    const all = new Set<number>();
    for (let i = 1; i <= numPages; i++) {
      all.add(i);
    }
    setSelectedPages(all);
  };

  // 清空选择
  const handleDeselectAll = () => {
    setSelectedPages(new Set());
  };

  // 反选
  const handleInvertSelection = () => {
    const next = new Set<number>();
    for (let i = 1; i <= numPages; i++) {
      if (!selectedPages.has(i)) {
        next.add(i);
      }
    }
    setSelectedPages(next);
  };

  // 奇数页
  const handleSelectOdd = () => {
    const odds = new Set<number>();
    for (let i = 1; i <= numPages; i += 2) {
      odds.add(i);
    }
    setSelectedPages(odds);
  };

  // 偶数页
  const handleSelectEven = () => {
    const evens = new Set<number>();
    for (let i = 2; i <= numPages; i += 2) {
      evens.add(i);
    }
    setSelectedPages(evens);
  };

  // 触发拆分/提取
  const handleTriggerSplit = () => {
    if (splitMode === "split-all") {
      onSplit(undefined);
    } else {
      const pageList = Array.from(selectedPages);
      if (pageList.length === 0) return;
      const rangeStr = formatPageSetToRanges(pageList);
      onSplit(rangeStr);
    }
  };

  const selectedCount = selectedPages.size;
  const currentRangeStr = formatPageSetToRanges(Array.from(selectedPages));

  return (
    <div className="space-y-6">
      {/* 顶部文件概要与模式切换 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-coconut-200/80 dark:border-darkbg-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center flex-shrink-0">
            <Scissors className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-coconut-950 dark:text-darkbg-text truncate max-w-sm">
                {file.name}
              </h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-coconut-200/70 dark:bg-darkbg-subtle text-coconut-700 dark:text-darkbg-muted font-mono">
                {formatBytes(file.size)}
              </span>
            </div>
            <p className="text-xs text-coconut-600 dark:text-darkbg-muted mt-0.5">
              {renderingPages
                ? "正在载入整篇文档缩略图..."
                : `整本文档共 ${numPages} 页 · 点击下方任意页面即可直接点选`}
            </p>
          </div>
        </div>

        {/* 模式切换胶囊 */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="p-1 rounded-2xl bg-coconut-100 dark:bg-darkbg-subtle border border-coconut-200 dark:border-darkbg-border flex items-center gap-1">
            <button
              onClick={() => setSplitMode("extract")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                splitMode === "extract"
                  ? "bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-2xs"
                  : "text-coconut-700 dark:text-darkbg-muted hover:text-coconut-950 dark:hover:text-white"
              }`}
            >
              提取选中页面为新 PDF
            </button>
            <button
              onClick={() => setSplitMode("split-all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                splitMode === "split-all"
                  ? "bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-2xs"
                  : "text-coconut-700 dark:text-darkbg-muted hover:text-coconut-950 dark:hover:text-white"
              }`}
            >
              拆分为单页压缩包
            </button>
          </div>

          <button
            onClick={onClearFile}
            className="p-2 rounded-xl text-coconut-500 hover:text-rose-600 hover:bg-rose-500/10 transition-colors"
            title="更换其他文件"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 提取模式下的可视化控制条 */}
      {splitMode === "extract" && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-coconut-50/70 dark:bg-darkbg-subtle/50 rounded-2xl border border-coconut-200/60 dark:border-darkbg-border">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-coconut-800 dark:text-darkbg-text mr-1">
              快捷选择：
            </span>
            <button
              onClick={handleSelectAll}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-darkbg-card border border-coconut-200 dark:border-darkbg-border hover:border-orange-500 text-coconut-800 dark:text-darkbg-text transition-all active:scale-95 shadow-2xs"
            >
              全选
            </button>
            <button
              onClick={handleDeselectAll}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-darkbg-card border border-coconut-200 dark:border-darkbg-border hover:border-orange-500 text-coconut-800 dark:text-darkbg-text transition-all active:scale-95 shadow-2xs"
            >
              清空
            </button>
            <button
              onClick={handleInvertSelection}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-darkbg-card border border-coconut-200 dark:border-darkbg-border hover:border-orange-500 text-coconut-800 dark:text-darkbg-text transition-all active:scale-95 shadow-2xs"
            >
              反选
            </button>
            <button
              onClick={handleSelectOdd}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-darkbg-card border border-coconut-200 dark:border-darkbg-border hover:border-orange-500 text-coconut-800 dark:text-darkbg-text transition-all active:scale-95 shadow-2xs"
            >
              奇数页
            </button>
            <button
              onClick={handleSelectEven}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-darkbg-card border border-coconut-200 dark:border-darkbg-border hover:border-orange-500 text-coconut-800 dark:text-darkbg-text transition-all active:scale-95 shadow-2xs"
            >
              偶数页
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs font-medium">
            <span className="text-coconut-600 dark:text-darkbg-muted">
              已选中：
            </span>
            <span className="px-2.5 py-0.5 rounded-full font-bold font-mono bg-gradient-to-r from-amber-500/15 to-orange-500/15 text-orange-950 dark:text-orange-200 border border-orange-500/30">
              {selectedCount} / {numPages} 页
            </span>
            {currentRangeStr && (
              <span className="hidden sm:inline text-coconut-500 font-mono text-[11px] truncate max-w-xs">
                ({currentRangeStr})
              </span>
            )}
          </div>
        </div>
      )}

      {/* 全文档可视化页面缩略图网格 */}
      {renderingPages ? (
        <div className="p-12 text-center space-y-3 rounded-2xl border border-dashed border-coconut-300 dark:border-darkbg-border bg-white/40 dark:bg-darkbg-card/40">
          <Loader2 className="w-8 h-8 mx-auto text-orange-500 animate-spin" />
          <p className="text-sm font-semibold text-coconut-900 dark:text-white">
            正在生成整篇 PDF 页面交互缩略图...
          </p>
          <p className="text-xs text-coconut-500 dark:text-darkbg-muted">
            无需手动输入繁琐页码，即将呈现可点选的页面网格
          </p>
        </div>
      ) : renderError ? (
        <div className="p-6 bg-toast-50 dark:bg-toast-950/40 border border-toast-200 dark:border-toast-900/60 rounded-2xl flex items-center gap-3 text-toast-700 dark:text-toast-300 text-xs">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-toast-500" />
          <div>
            <div className="font-bold">缩略图解析失败</div>
            <div className="mt-1">{renderError}</div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4 max-h-[520px] overflow-y-auto p-1 pr-2 no-scrollbar">
          {pages.map((p) => {
            const pageNum = p.pageIndex + 1;
            const isSelected = selectedPages.has(pageNum);

            return (
              <div
                key={p.pageIndex}
                onClick={() => {
                  if (splitMode === "extract") {
                    togglePageSelection(pageNum);
                  }
                }}
                className={`group relative rounded-2xl border-2 transition-all duration-200 overflow-hidden select-none cursor-pointer flex flex-col bg-white dark:bg-darkbg-card shadow-2xs hover:shadow-coconut-sm ${
                  splitMode === "split-all"
                    ? "border-coconut-200 dark:border-darkbg-border opacity-90 hover:opacity-100"
                    : isSelected
                    ? "border-orange-500 ring-2 ring-orange-500/20 shadow-coconut-sm scale-[1.02] bg-orange-50/30 dark:bg-orange-950/20"
                    : "border-coconut-200 dark:border-darkbg-border hover:border-orange-300 dark:hover:border-orange-600/50 hover:scale-[1.01]"
                }`}
              >
                {/* 页面顶部状态条：勾选框 + 放大图标 */}
                <div className="p-2 flex items-center justify-between bg-coconut-50/80 dark:bg-darkbg-subtle/80 border-b border-coconut-100 dark:border-darkbg-border">
                  <div className="flex items-center gap-1.5">
                    {splitMode === "extract" && (
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center transition-all ${
                          isSelected
                            ? "bg-gradient-to-br from-amber-500 to-orange-600 text-white"
                            : "border border-coconut-300 dark:border-darkbg-border bg-white dark:bg-darkbg-subtle"
                        }`}
                      >
                        {isSelected && <CheckSquare className="w-3.5 h-3.5" />}
                      </div>
                    )}
                    <span className="text-[11px] font-bold font-mono text-coconut-900 dark:text-darkbg-text">
                      P.{pageNum}
                    </span>
                  </div>

                  {/* 放大镜单页查看按钮 */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setZoomedPage(p);
                    }}
                    title="点击放大查看该页"
                    className="p-1 rounded-md text-coconut-500 hover:text-orange-600 hover:bg-orange-500/10 transition-colors"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* 页面真实缩略图画面 */}
                <div className="relative aspect-[1/1.414] w-full bg-coconut-100/50 dark:bg-darkbg-subtle/50 flex items-center justify-center overflow-hidden">
                  <img
                    src={p.image}
                    alt={`Page ${pageNum}`}
                    className="w-full h-full object-contain p-1"
                    loading="lazy"
                  />
                  {/* 未选中时的轻微遮罩 */}
                  {splitMode === "extract" && !isSelected && (
                    <div className="absolute inset-0 bg-white/40 dark:bg-black/40 transition-opacity" />
                  )}
                </div>

                {/* 底部文字 */}
                <div className="py-1 px-2 text-center text-[10px] font-semibold text-coconut-600 dark:text-darkbg-muted bg-coconut-50/50 dark:bg-darkbg-subtle/50 border-t border-coconut-100 dark:border-darkbg-border">
                  {splitMode === "split-all"
                    ? "将拆分为独立文件"
                    : isSelected
                    ? "✓ 已选中导出"
                    : "点击选中"}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 放大预览模态框 */}
      {zoomedPage && (
        <div
          onClick={() => setZoomedPage(null)}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-2xl w-full max-h-[90vh] bg-white dark:bg-darkbg-canvas rounded-3xl overflow-hidden flex flex-col shadow-2xl border border-coconut-200 dark:border-darkbg-border"
          >
            <div className="p-4 border-b border-coconut-200 dark:border-darkbg-border flex items-center justify-between bg-coconut-50/90 dark:bg-darkbg-card">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-coconut-950 dark:text-white">
                  单页高清预览 · 第 {zoomedPage.pageIndex + 1} 页
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-coconut-200/80 dark:bg-darkbg-subtle text-coconut-700 dark:text-darkbg-muted font-mono">
                  {Math.round(zoomedPage.width)} × {Math.round(zoomedPage.height)} px
                </span>
              </div>
              <button
                onClick={() => setZoomedPage(null)}
                className="p-1.5 rounded-xl hover:bg-coconut-200/80 dark:hover:bg-darkbg-subtle transition-colors text-coconut-600 dark:text-darkbg-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-coconut-100/40 dark:bg-darkbg-canvas">
              <img
                src={zoomedPage.image}
                alt={`Zoomed Page ${zoomedPage.pageIndex + 1}`}
                className="max-h-[75vh] w-auto object-contain rounded-xl shadow-md border border-coconut-200 dark:border-darkbg-border"
              />
            </div>

            <div className="p-3 border-t border-coconut-200 dark:border-darkbg-border flex items-center justify-between bg-white dark:bg-darkbg-card">
              <button
                onClick={() => {
                  togglePageSelection(zoomedPage.pageIndex + 1);
                }}
                className={`py-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  selectedPages.has(zoomedPage.pageIndex + 1)
                    ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30"
                    : "btn-3d-sunset text-white"
                }`}
              >
                {selectedPages.has(zoomedPage.pageIndex + 1)
                  ? "取消选中该页"
                  : "✓ 勾选此页加入提取"}
              </button>
              <button
                onClick={() => setZoomedPage(null)}
                className="py-2 px-4 rounded-xl text-xs font-semibold text-coconut-700 dark:text-darkbg-muted hover:bg-coconut-100 dark:hover:bg-darkbg-subtle"
              >
                关闭预览
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 提示与错误 */}
      {error && (
        <div className="p-3 bg-toast-50 dark:bg-toast-950/40 border border-toast-200 dark:border-toast-900/60 rounded-2xl flex items-center gap-2 text-toast-700 dark:text-toast-300 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-toast-500" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-palm-50 dark:bg-palm-950/40 border border-palm-200 dark:border-palm-900/60 rounded-2xl flex items-center gap-2 text-palm-700 dark:text-palm-300 text-xs">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-palm-500" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* 结果卡片 (严格点击才下载) */}
      {executionResult ? (
        <div className="p-5 bg-gradient-to-br from-amber-500/12 via-orange-500/10 to-rose-500/10 dark:from-orange-950/40 dark:via-amber-950/30 dark:to-rose-950/30 border border-amber-300/80 dark:border-amber-600/60 rounded-2xl space-y-4 shadow-coconut-sm animate-fade-in backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 truncate">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                <FileCheck className="w-5 h-5 text-white" />
              </div>
              <div className="truncate">
                <h4 className="text-sm font-bold text-coconut-950 dark:text-white truncate">
                  {executionResult.filename}
                </h4>
                <p className="text-xs text-orange-800 dark:text-amber-300 font-mono font-medium">
                  {formatBytes(executionResult.size)} · 拆分提取成功已就绪
                </p>
              </div>
            </div>
            <span className="hidden sm:inline-block px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-900 dark:text-amber-200 border border-amber-500/30 flex-shrink-0">
              ✓ 就绪 · 点击下载
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              onClick={() => downloadBlob(executionResult.blob, executionResult.filename)}
              className="flex-1 py-3 px-4 rounded-xl btn-3d-sunset text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-coconut-sm"
            >
              <Download className="w-4 h-4" />
              <span>立即下载该文件</span>
            </button>

            <button
              onClick={onReset}
              className="py-3 px-4 rounded-xl btn-3d-secondary font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>重新选择页面提取</span>
            </button>
          </div>
        </div>
      ) : (
        /* 开始执行提取按钮 */
        <button
          onClick={handleTriggerSplit}
          disabled={loading || (splitMode === "extract" && selectedCount === 0)}
          className={`w-full py-3.5 px-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
            loading || (splitMode === "extract" && selectedCount === 0)
              ? "bg-coconut-100 dark:bg-darkbg-subtle text-coconut-400 dark:text-darkbg-muted cursor-not-allowed border border-coconut-200 dark:border-darkbg-border"
              : "btn-3d-sunset text-white"
          }`}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>正在提取拆分中，请稍候...</span>
            </>
          ) : (
            <>
              <Scissors className="w-4 h-4 text-amber-200" />
              <span>
                {splitMode === "split-all"
                  ? `开始拆分为 ${numPages} 份独立单页压缩包`
                  : `开始提取选中的 ${selectedCount} 个页面为新 PDF`}
              </span>
            </>
          )}
        </button>
      )}
    </div>
  );
}
