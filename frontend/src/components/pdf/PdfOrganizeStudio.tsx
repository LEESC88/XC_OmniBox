"use client";

import React, { useState, useEffect } from "react";
import {
  Layers,
  RotateCw,
  RotateCcw,
  ArrowLeft,
  ArrowRight,
  Trash2,
  Maximize2,
  X,
  FileCheck,
  Download,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ArrowRightLeft,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { formatBytes } from "@/lib/imageProcessor";
import { renderPdfPages, downloadBlob } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export interface PageItem {
  id: string;
  originalIndex: number; // 0-based
  rotation: number; // 0, 90, 180, 270
  image: string;
  width: number;
  height: number;
}

interface PdfOrganizeStudioProps {
  file: File;
  onOrganize: (pagesConfig: Array<{ page: number; rotation: number }>) => Promise<void>;
  loading: boolean;
  error: string | null;
  successMsg: string | null;
  executionResult: { blob: Blob; filename: string; size: number } | null;
  onReset: () => void;
  onClearFile: () => void;
}

export default function PdfOrganizeStudio({
  file,
  onOrganize,
  loading,
  error,
  successMsg,
  executionResult,
  onReset,
  onClearFile,
}: PdfOrganizeStudioProps) {
  const { lang } = useI18n();
  const [pages, setPages] = useState<PageItem[]>([]);
  const [originalCount, setOriginalCount] = useState<number>(0);
  const [renderingPages, setRenderingPages] = useState<boolean>(true);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [zoomedItem, setZoomedItem] = useState<{ page: PageItem; index: number } | null>(null);
  const [recentlyDeleted, setRecentlyDeleted] = useState<{ item: PageItem; index: number } | null>(null);
  const [visibleCount, setVisibleCount] = useState<number>(36);

  // 解析并渲染整篇文档缩略图
  useEffect(() => {
    let isCancelled = false;
    setRenderingPages(true);
    setRenderError(null);
    setRecentlyDeleted(null);
    setVisibleCount(36);

    renderPdfPages(file, 85, undefined, false)
      .then((res) => {
        if (!isCancelled) {
          const items: PageItem[] = res.pages.map((p, idx) => ({
            id: `page_${idx}_${Date.now()}`,
            originalIndex: p.pageIndex,
            rotation: 0,
            image: p.image,
            width: p.width,
            height: p.height,
          }));
          setPages(items);
          setOriginalCount(res.numPages);
          setRenderingPages(false);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          setRenderError(err.message || (lang === "en" ? "Failed to render PDF pages" : "解析 PDF 页面失败"));
          setRenderingPages(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [file]);

  // 左移
  const moveLeft = (index: number) => {
    if (index === 0) return;
    const next = [...pages];
    const temp = next[index];
    next[index] = next[index - 1];
    next[index - 1] = temp;
    setPages(next);
  };

  // 右移
  const moveRight = (index: number) => {
    if (index === pages.length - 1) return;
    const next = [...pages];
    const temp = next[index];
    next[index] = next[index + 1];
    next[index + 1] = temp;
    setPages(next);
  };

  // 单页顺时针旋转 +90°
  const rotatePageCw = (index: number) => {
    const next = [...pages];
    next[index] = {
      ...next[index],
      rotation: (next[index].rotation + 90) % 360,
    };
    setPages(next);
  };

  // 单页逆时针旋转 -90°
  const rotatePageCcw = (index: number) => {
    const next = [...pages];
    next[index] = {
      ...next[index],
      rotation: (next[index].rotation - 90 + 360) % 360,
    };
    setPages(next);
  };

  // 剔除单页 (防呆支持撤销)
  const deletePage = (index: number) => {
    const deleted = pages[index];
    setRecentlyDeleted({ item: deleted, index });
    setPages(pages.filter((_, i) => i !== index));
  };

  // 撤销剔除单页
  const handleUndoDelete = () => {
    if (!recentlyDeleted) return;
    const next = [...pages];
    next.splice(recentlyDeleted.index, 0, recentlyDeleted.item);
    setPages(next);
    setRecentlyDeleted(null);
  };

  // 全局顺时针旋转 +90°
  const rotateAllCw = () => {
    setPages(pages.map((p) => ({ ...p, rotation: (p.rotation + 90) % 360 })));
  };

  // 全局逆时针旋转 -90°
  const rotateAllCcw = () => {
    setPages(pages.map((p) => ({ ...p, rotation: (p.rotation - 90 + 360) % 360 })));
  };

  // 倒序排列
  const reverseAll = () => {
    setPages([...pages].reverse());
  };

  // 重置回原始状态
  const resetToOriginal = () => {
    setRenderingPages(true);
    renderPdfPages(file, 85, undefined, false)
      .then((res) => {
        const items: PageItem[] = res.pages.map((p, idx) => ({
          id: `page_${idx}_${Date.now()}`,
          originalIndex: p.pageIndex,
          rotation: 0,
          image: p.image,
          width: p.width,
          height: p.height,
        }));
        setPages(items);
        setRenderingPages(false);
      })
      .catch(() => setRenderingPages(false));
  };

  // 提交导出
  const handleExport = () => {
    if (pages.length === 0) return;
    const config = pages.map((p) => ({
      page: p.originalIndex,
      rotation: p.rotation,
    }));
    onOrganize(config);
  };

  return (
    <div className="space-y-6">
      {/* 顶部文件概要与批量操作工具栏 */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-coconut-200/80 dark:border-darkbg-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
            <Layers className="w-5 h-5" />
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
                ? (lang === "en" ? "Loading full document pages..." : "正在载入整篇文档缩略图...")
                : (lang === "en"
                    ? `Current ${pages.length} pages (Original: ${originalCount}) · Reorder or rotate as needed`
                    : `当前保留 ${pages.length} 页 (原文档共 ${originalCount} 页) · 支持拖拽调序、旋转与删减`)}
            </p>
          </div>
        </div>

        {/* 顶部批量操作快捷栏 */}
        <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
          <button
            onClick={rotateAllCcw}
            disabled={renderingPages || pages.length === 0}
            className="py-1.5 px-3 rounded-xl bg-white/80 dark:bg-darkbg-subtle border border-coconut-200 dark:border-darkbg-border text-xs font-semibold text-coconut-700 dark:text-darkbg-muted hover:text-coconut-950 dark:hover:text-white transition-all flex items-center gap-1.5 shadow-2xs"
            title={lang === "en" ? "Rotate All -90°" : "整篇向左旋转 90°"}
          >
            <RotateCcw className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
            <span>{lang === "en" ? "All -90°" : "全篇左转"}</span>
          </button>

          <button
            onClick={rotateAllCw}
            disabled={renderingPages || pages.length === 0}
            className="py-1.5 px-3 rounded-xl bg-white/80 dark:bg-darkbg-subtle border border-coconut-200 dark:border-darkbg-border text-xs font-semibold text-coconut-700 dark:text-darkbg-muted hover:text-coconut-950 dark:hover:text-white transition-all flex items-center gap-1.5 shadow-2xs"
            title={lang === "en" ? "Rotate All +90°" : "整篇向右旋转 90°"}
          >
            <RotateCw className="w-3.5 h-3.5 text-palm-600 dark:text-palm-400" />
            <span>{lang === "en" ? "All +90°" : "全篇右转"}</span>
          </button>

          <button
            onClick={reverseAll}
            disabled={renderingPages || pages.length === 0}
            className="py-1.5 px-3 rounded-xl bg-white/80 dark:bg-darkbg-subtle border border-coconut-200 dark:border-darkbg-border text-xs font-semibold text-coconut-700 dark:text-darkbg-muted hover:text-coconut-950 dark:hover:text-white transition-all flex items-center gap-1.5 shadow-2xs"
            title={lang === "en" ? "Reverse All Pages" : "整篇页面顺序倒序"}
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>{lang === "en" ? "Reverse" : "倒序"}</span>
          </button>

          <button
            onClick={resetToOriginal}
            disabled={renderingPages}
            className="py-1.5 px-3 rounded-xl bg-white/80 dark:bg-darkbg-subtle border border-coconut-200 dark:border-darkbg-border text-xs font-semibold text-coconut-700 dark:text-darkbg-muted hover:text-coconut-950 dark:hover:text-white transition-all flex items-center gap-1.5 shadow-2xs"
            title={lang === "en" ? "Reset All Adjustments" : "重置所有调整回初始"}
          >
            <RefreshCw className="w-3.5 h-3.5 text-coconut-500" />
            <span>{lang === "en" ? "Reset" : "重置"}</span>
          </button>

          <button
            onClick={onClearFile}
            className="p-1.5 rounded-xl text-coconut-500 hover:text-rose-600 hover:bg-rose-500/10 transition-colors"
            title={lang === "en" ? "Change File" : "更换其他文件"}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 加载与错误提示 */}
      {renderingPages && (
        <div className="py-16 flex flex-col items-center justify-center gap-3 text-coconut-600 dark:text-darkbg-muted animate-fade-in">
          <Loader2 className="w-8 h-8 animate-spin text-palm-500" />
          <span className="text-sm font-semibold">
            {lang === "en" ? "Parsing and loading page thumbnails..." : "正在高速解析生成页面缩略图..."}
          </span>
        </div>
      )}

      {renderError && (
        <div className="p-4 bg-toast-50 dark:bg-toast-950/40 border border-toast-200 dark:border-toast-900/60 rounded-2xl flex items-center gap-2 text-toast-700 dark:text-toast-300 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-toast-500" />
          <span>{renderError}</span>
        </div>
      )}

      {/* 撤销删除操作浮层 */}
      {recentlyDeleted && (
        <div className="p-3 bg-amber-500/15 border border-amber-500/30 rounded-2xl flex items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200 animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <span>
              {lang === "en"
                ? `Removed page (Original #${recentlyDeleted.item.originalIndex + 1})`
                : `已从调度序列中剔除页面 (原第 ${recentlyDeleted.item.originalIndex + 1} 页)`}
            </span>
          </div>
          <button
            type="button"
            onClick={handleUndoDelete}
            className="py-1 px-3 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold transition-colors shadow-2xs"
          >
            {lang === "en" ? "Undo Restore" : "撤销恢复"}
          </button>
        </div>
      )}

      {/* 页面网格画板 */}
      {!renderingPages && pages.length > 0 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
            {pages.slice(0, visibleCount).map((p, idx) => {
            const hasRotation = p.rotation !== 0;
            return (
              <div
                key={p.id}
                className="group relative bg-white dark:bg-darkbg-card rounded-2xl border border-coconut-200/80 dark:border-darkbg-border overflow-hidden shadow-2xs hover:shadow-coconut-sm transition-all flex flex-col"
              >
                {/* 顶部序号与角度指示 */}
                <div className="absolute top-2 left-2 z-10 flex items-center gap-1">
                  <span className="w-6 h-6 rounded-full bg-black/65 backdrop-blur-md text-white font-mono text-[11px] font-extrabold flex items-center justify-center shadow-xs">
                    {idx + 1}
                  </span>
                  {hasRotation && (
                    <span className="px-1.5 py-0.5 rounded-full bg-palm-600/90 text-white font-mono text-[9px] font-bold shadow-xs">
                      {p.rotation}°
                    </span>
                  )}
                </div>

                {/* 快捷操作浮层 */}
                <div className="absolute top-2 right-2 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => setZoomedItem({ page: p, index: idx })}
                    className="w-6 h-6 rounded-lg bg-black/60 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/80 transition-colors"
                    title={lang === "en" ? "Zoom" : "放大预览"}
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => deletePage(idx)}
                    className="w-6 h-6 rounded-lg bg-rose-600/80 backdrop-blur-md text-white flex items-center justify-center hover:bg-rose-700 transition-colors"
                    title={lang === "en" ? "Delete Page" : "剔除本页"}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* 缩略图视口 (带平滑 CSS 旋转动画) */}
                <div className="aspect-[3/4] w-full bg-coconut-100/50 dark:bg-darkbg-subtle/50 flex items-center justify-center overflow-hidden p-2">
                  <img
                    src={p.image}
                    alt={`Page ${idx + 1}`}
                    style={{
                      transform: `rotate(${p.rotation}deg)`,
                      transition: "transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                    }}
                    className="w-full h-full object-contain"
                    loading="lazy"
                  />
                </div>

                {/* 底部微调动作栏 */}
                <div className="p-1.5 border-t border-coconut-100 dark:border-darkbg-border bg-coconut-50/50 dark:bg-darkbg-subtle/40 flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => moveLeft(idx)}
                      disabled={idx === 0}
                      className="p-1 rounded-lg hover:bg-coconut-200/80 dark:hover:bg-darkbg-border text-coconut-700 dark:text-darkbg-muted disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                      title={lang === "en" ? "Move Left" : "向左移"}
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => moveRight(idx)}
                      disabled={idx === pages.length - 1}
                      className="p-1 rounded-lg hover:bg-coconut-200/80 dark:hover:bg-darkbg-border text-coconut-700 dark:text-darkbg-muted disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                      title={lang === "en" ? "Move Right" : "向右移"}
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <span className="text-[10px] text-coconut-500 dark:text-darkbg-muted font-mono">
                    原第 {p.originalIndex + 1} 页
                  </span>

                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => rotatePageCcw(idx)}
                      className="p-1 rounded-lg hover:bg-coconut-200/80 dark:hover:bg-darkbg-border text-orange-600 dark:text-orange-400 transition-colors"
                      title={lang === "en" ? "Rotate Left 90°" : "向左旋转 90°"}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => rotatePageCw(idx)}
                      className="p-1 rounded-lg hover:bg-coconut-200/80 dark:hover:bg-darkbg-border text-palm-600 dark:text-palm-400 transition-colors"
                      title={lang === "en" ? "Rotate Right 90°" : "向右旋转 90°"}
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          </div>

          {/* 大文档分页加载更多按钮 */}
          {pages.length > visibleCount && (
            <div className="flex items-center justify-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => setVisibleCount((prev) => prev + 36)}
                className="py-2 px-4 rounded-xl btn-3d-secondary text-xs font-bold shadow-2xs hover:border-orange-400"
              >
                {lang === "en"
                  ? `Load Next 36 Pages (${visibleCount} of ${pages.length} shown)`
                  : `加载后续 36 页缩略图 (已显示 ${visibleCount} / ${pages.length} 页)`}
              </button>
              <button
                type="button"
                onClick={() => setVisibleCount(pages.length)}
                className="py-2 px-3 text-xs text-coconut-600 dark:text-darkbg-muted hover:text-orange-600 underline font-medium"
              >
                {lang === "en" ? "Show All Pages" : "展开全部页面"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 放大预览模态框 */}
      {zoomedItem && (
        <div
          onClick={() => setZoomedItem(null)}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-2xl w-full max-h-[90vh] bg-white dark:bg-darkbg-canvas rounded-3xl overflow-hidden flex flex-col shadow-2xl border border-coconut-200 dark:border-darkbg-border"
          >
            <div className="p-4 border-b border-coconut-200 dark:border-darkbg-border flex items-center justify-between bg-coconut-50/90 dark:bg-darkbg-card">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-coconut-950 dark:text-white">
                  {lang === "en"
                    ? `Page Preview · #${zoomedItem.index + 1} (Original Page ${zoomedItem.page.originalIndex + 1})`
                    : `单页全览 · 第 ${zoomedItem.index + 1} 页 (原第 ${zoomedItem.page.originalIndex + 1} 页)`}
                </span>
                {zoomedItem.page.rotation !== 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-palm-500/20 text-palm-800 dark:text-palm-300 font-mono">
                    旋转 {zoomedItem.page.rotation}°
                  </span>
                )}
              </div>
              <button
                onClick={() => setZoomedItem(null)}
                className="p-1.5 rounded-xl hover:bg-coconut-200/80 dark:hover:bg-darkbg-subtle transition-colors text-coconut-600 dark:text-darkbg-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-coconut-100/40 dark:bg-darkbg-canvas">
              <img
                src={zoomedItem.page.image}
                alt="Zoomed"
                style={{
                  transform: `rotate(${zoomedItem.page.rotation}deg)`,
                  transition: "transform 0.25s ease",
                }}
                className="max-h-[70vh] w-auto object-contain rounded-xl shadow-md border border-coconut-200 dark:border-darkbg-border"
              />
            </div>

            <div className="p-3 border-t border-coconut-200 dark:border-darkbg-border flex items-center justify-between bg-white dark:bg-darkbg-card">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => rotatePageCcw(zoomedItem.index)}
                  className="py-2 px-3 rounded-xl bg-coconut-100 dark:bg-darkbg-subtle text-xs font-bold flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>左转 90°</span>
                </button>
                <button
                  onClick={() => rotatePageCw(zoomedItem.index)}
                  className="py-2 px-3 rounded-xl bg-coconut-100 dark:bg-darkbg-subtle text-xs font-bold flex items-center gap-1.5"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>右转 90°</span>
                </button>
              </div>

              <button
                onClick={() => setZoomedItem(null)}
                className="py-2 px-4 rounded-xl text-xs font-semibold text-coconut-700 dark:text-darkbg-muted hover:bg-coconut-100 dark:hover:bg-darkbg-subtle"
              >
                {lang === "en" ? "Close" : "完成关闭"}
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
        <div className="p-5 bg-accent-subtle border border-accent-border rounded-2xl space-y-4 shadow-coconut-sm animate-fade-in backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 truncate">
              <div className="w-10 h-10 rounded-xl bg-accent-gradient text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                <FileCheck className="w-5 h-5 text-white" />
              </div>
              <div className="truncate">
                <h4 className="text-sm font-bold text-coconut-950 dark:text-white truncate">
                  {executionResult.filename}
                </h4>
                <p className="text-xs text-orange-900 dark:text-amber-300 font-mono font-medium">
                  {formatBytes(executionResult.size)} ·{" "}
                  {lang === "en" ? "Reordered and rotated successfully" : `已成功重新编排 ${pages.length} 个页面并导出`}
                </p>
              </div>
            </div>

            <span className="hidden sm:inline-block px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-900 dark:text-amber-200 border border-amber-500/30 flex-shrink-0">
              {lang === "en" ? "✓ Organized · Ready" : "✓ 编排就绪 · 点击下载"}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              onClick={() => downloadBlob(executionResult.blob, executionResult.filename)}
              className="flex-1 py-3 px-4 rounded-xl btn-3d-sunset text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-coconut-sm"
            >
              <Download className="w-4 h-4" />
              <span>{lang === "en" ? "Download Organized PDF" : "立即下载编排后的 PDF"}</span>
            </button>

            <button
              onClick={onReset}
              className="py-3 px-4 rounded-xl btn-3d-secondary font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{lang === "en" ? "Continue Organizing" : "继续调整页面"}</span>
            </button>
          </div>
        </div>
      ) : (
        /* 导出新 PDF 按钮 */
        <button
          onClick={handleExport}
          disabled={loading || pages.length === 0}
          className={`w-full py-3.5 px-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
            loading || pages.length === 0
              ? "bg-coconut-100 dark:bg-darkbg-subtle text-coconut-400 dark:text-darkbg-muted cursor-not-allowed border border-coconut-200 dark:border-darkbg-border"
              : "btn-3d-sunset text-white"
          }`}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{lang === "en" ? "Exporting organized PDF, please wait..." : "正在导出重新编排后的 PDF，请稍候..."}</span>
            </>
          ) : (
            <>
              <Layers className="w-4 h-4 text-amber-200" />
              <span>
                {lang === "en"
                  ? `Export Organized PDF (${pages.length} Pages)`
                  : `导出重新编排后的 PDF (共 ${pages.length} 页)`}
              </span>
            </>
          )}
        </button>
      )}
    </div>
  );
}
