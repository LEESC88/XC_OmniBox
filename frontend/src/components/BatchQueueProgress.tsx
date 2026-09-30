import React, { useState } from "react";
import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Ban,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Download,
  Sliders,
  FolderDown,
} from "lucide-react";
import { BatchProgressSummary, BatchTaskItem, formatEta } from "../lib/batchQueueManager";

interface BatchQueueProgressProps {
  summary: BatchProgressSummary;
  items: BatchTaskItem<any, any>[];
  isProcessing: boolean;
  concurrency: number;
  onConcurrencyChange?: (c: number) => void;
  onCancel?: () => void;
  onRetryItem?: (id: string) => void;
  onRetryAllFailed?: () => void;
  onExportAll?: () => void;
  exportLabel?: string;
  title?: string;
  lang?: "zh" | "en";
}

export default function BatchQueueProgress({
  summary,
  items,
  isProcessing,
  concurrency,
  onConcurrencyChange,
  onCancel,
  onRetryItem,
  onRetryAllFailed,
  onExportAll,
  exportLabel,
  title,
  lang = "zh",
}: BatchQueueProgressProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (summary.total === 0) return null;

  const isAllCompleted = summary.completed === summary.total && summary.total > 0;
  const hasErrors = summary.failed > 0;

  return (
    <div className="coconut-panel p-4 sm:p-5 space-y-4 border border-coconut-200 dark:border-darkbg-border bg-white/90 dark:bg-darkbg-card shadow-sm transition-all">
      {/* 头部摘要与操作栏 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2.5">
          {isProcessing ? (
            <div className="w-8 h-8 rounded-xl bg-palm-100 dark:bg-palm-950/80 flex items-center justify-center text-palm-600 dark:text-palm-400">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          ) : isAllCompleted ? (
            <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          ) : hasErrors ? (
            <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/80 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-xl bg-coconut-100 dark:bg-darkbg-elevated flex items-center justify-center text-coconut-700 dark:text-darkbg-text">
              <Clock className="w-4 h-4" />
            </div>
          )}

          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold text-coconut-900 dark:text-darkbg-text">
                {title || (lang === "en" ? "Batch Processing Queue" : "批量并发处理队列")}
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold bg-coconut-100 dark:bg-darkbg-elevated text-coconut-700 dark:text-darkbg-muted">
                {summary.completed}/{summary.total}
              </span>
            </div>

            <div className="flex items-center space-x-3 text-xs text-coconut-600 dark:text-darkbg-muted mt-0.5">
              {isProcessing && summary.etaSeconds !== null && (
                <span className="flex items-center space-x-1 text-palm-600 dark:text-palm-400 font-medium">
                  <Clock className="w-3 h-3" />
                  <span>
                    {lang === "en" ? "ETA: " : "预计剩余: "}
                    {formatEta(summary.etaSeconds, lang)}
                  </span>
                </span>
              )}
              {summary.failed > 0 && (
                <span className="text-rose-600 dark:text-rose-400 font-semibold">
                  {lang === "en" ? `${summary.failed} failed` : `${summary.failed} 项失败`}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 控件区：并发调节与批量操作 */}
        <div className="flex items-center space-x-2">
          {/* 并发度控制 */}
          {onConcurrencyChange && (
            <div className="flex items-center space-x-1 bg-coconut-100 dark:bg-darkbg-elevated px-2 py-1 rounded-xl text-xs">
              <Sliders className="w-3.5 h-3.5 text-coconut-500 dark:text-darkbg-muted" />
              <span className="text-[11px] text-coconut-700 dark:text-darkbg-muted font-medium">
                {lang === "en" ? "Threads:" : "并发:"}
              </span>
              <select
                value={concurrency}
                disabled={isProcessing}
                onChange={(e) => onConcurrencyChange(Number(e.target.value))}
                className="bg-transparent text-xs font-bold text-coconut-900 dark:text-darkbg-text outline-none cursor-pointer disabled:opacity-60"
              >
                <option value={1}>1x</option>
                <option value={2}>2x</option>
                <option value={3}>3x</option>
                <option value={4}>4x</option>
                <option value={6}>6x</option>
              </select>
            </div>
          )}

          {/* 取消队列 */}
          {isProcessing && onCancel && (
            <button
              onClick={onCancel}
              className="px-3 py-1.5 rounded-xl border border-rose-300 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-xs font-bold flex items-center space-x-1 transition-all"
            >
              <Ban className="w-3.5 h-3.5" />
              <span>{lang === "en" ? "Cancel" : "取消队列"}</span>
            </button>
          )}

          {/* 重试失败项 */}
          {!isProcessing && hasErrors && onRetryAllFailed && (
            <button
              onClick={onRetryAllFailed}
              className="px-3 py-1.5 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-xs font-bold flex items-center space-x-1 transition-all shadow-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{lang === "en" ? "Retry Failed" : "重试失败项"}</span>
            </button>
          )}

          {/* 一键导出/打包全部 */}
          {onExportAll && summary.completed > 0 && !isProcessing && (
            <button
              onClick={onExportAll}
              className="px-3.5 py-1.5 rounded-xl btn-3d-sunset text-white text-xs font-bold flex items-center space-x-1.5 shadow-sm active:scale-95 transition-all"
            >
              <FolderDown className="w-3.5 h-3.5" />
              <span>{exportLabel || (lang === "en" ? "Export All" : "导出全部")}</span>
            </button>
          )}

          {/* 折叠/展开任务列表 */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-xl hover:bg-coconut-100 dark:hover:bg-darkbg-elevated text-coconut-600 dark:text-darkbg-muted transition-colors"
            title={isExpanded ? (lang === "en" ? "Collapse" : "折叠列表") : (lang === "en" ? "Expand" : "展开列表")}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 总体进度条 */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-coconut-700 dark:text-darkbg-muted font-medium">
            {isProcessing
              ? lang === "en"
                ? `Running (${summary.active} active)...`
                : `正在并发处理 (${summary.active} 线程)...`
              : isAllCompleted
              ? lang === "en"
                ? "All tasks completed"
                : "所有任务已处理完毕"
              : lang === "en"
              ? "Queue finished with issues"
              : "队列已停止"}
          </span>
          <span className="font-bold text-coconut-900 dark:text-darkbg-text">{summary.percent}%</span>
        </div>
        <div className="w-full h-2.5 bg-coconut-100 dark:bg-darkbg-elevated rounded-full overflow-hidden relative">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              hasErrors && !isProcessing
                ? "bg-amber-500"
                : isAllCompleted
                ? "bg-emerald-500"
                : "bg-gradient-to-r from-palm-500 to-amber-500"
            }`}
            style={{ width: `${summary.percent}%` }}
          />
        </div>
      </div>

      {/* 展开的单项任务详情列表 */}
      {isExpanded && items.length > 0 && (
        <div className="max-h-60 overflow-y-auto space-y-2 pr-1 border-t border-coconut-100 dark:border-darkbg-border pt-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="virtual-scroll-item flex items-center justify-between p-2.5 rounded-xl bg-coconut-50/70 dark:bg-darkbg-subtle border border-coconut-200/50 dark:border-darkbg-border/60 text-xs transition-colors"
            >
              <div className="flex items-center space-x-2.5 min-w-0 flex-1 pr-2">
                {/* 状态徽标 */}
                {item.status === "processing" ? (
                  <Loader2 className="w-4 h-4 text-palm-500 animate-spin flex-shrink-0" />
                ) : item.status === "completed" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                ) : item.status === "error" ? (
                  <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0" />
                ) : item.status === "cancelled" ? (
                  <Ban className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                ) : (
                  <Clock className="w-4 h-4 text-coconut-400 dark:text-darkbg-muted flex-shrink-0" />
                )}

                {/* 文件名称与状态文本 */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-coconut-900 dark:text-darkbg-text truncate max-w-[200px] sm:max-w-xs" title={item.name}>
                      {item.name}
                    </span>
                    {item.size ? (
                      <span className="text-[10px] text-coconut-400 dark:text-darkbg-subtext font-mono">
                        {(item.size / 1024).toFixed(1)} KB
                      </span>
                    ) : null}
                  </div>

                  {item.status === "error" && item.error && (
                    <p className="text-[11px] text-rose-500 dark:text-rose-400 truncate mt-0.5" title={item.error}>
                      {item.error}
                    </p>
                  )}

                  {item.status === "processing" && (
                    <div className="w-32 sm:w-48 h-1 bg-coconut-200 dark:bg-darkbg-border rounded-full mt-1.5 overflow-hidden">
                      <div
                        className="h-full bg-palm-500 transition-all duration-200"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* 单项操作 */}
              <div className="flex items-center space-x-2 flex-shrink-0">
                {item.status === "completed" && item.durationMs ? (
                  <span className="text-[10px] text-coconut-400 dark:text-darkbg-muted font-mono">
                    {item.durationMs < 1000 ? `${item.durationMs}ms` : `${(item.durationMs / 1000).toFixed(1)}s`}
                  </span>
                ) : null}

                {(item.status === "error" || item.status === "cancelled") && onRetryItem && !isProcessing && (
                  <button
                    onClick={() => onRetryItem(item.id)}
                    className="p-1 rounded-lg hover:bg-coconut-200 dark:hover:bg-darkbg-elevated text-coconut-700 dark:text-darkbg-text transition-colors"
                    title={lang === "en" ? "Retry this item" : "重试该项"}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
