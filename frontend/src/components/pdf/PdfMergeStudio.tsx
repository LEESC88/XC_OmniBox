"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Combine,
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  RotateCcw,
  Download,
  FileCheck,
  AlertCircle,
  CheckCircle2,
  Loader2,
  FileText,
  Sparkles,
} from "lucide-react";
import { formatBytes } from "@/lib/imageProcessor";
import { renderPdfPages, downloadBlob } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

interface PdfMergeStudioProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  onExecute: () => void;
  loading: boolean;
  error: string | null;
  successMsg: string | null;
  executionResult: { blob: Blob; filename: string; size: number } | null;
  onReset: () => void;
}

interface FileThumbnailInfo {
  thumbnailUrl?: string;
  numPages?: number;
  loading: boolean;
}

export default function PdfMergeStudio({
  files,
  onFilesChange,
  onExecute,
  loading,
  error,
  successMsg,
  executionResult,
  onReset,
}: PdfMergeStudioProps) {
  const { lang } = useI18n();
  const [thumbnails, setThumbnails] = useState<Record<string, FileThumbnailInfo>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 为新加入的文件异步加载第一页封面缩略图 (轻量级 70 DPI, 仅第 1 页)
  useEffect(() => {
    files.forEach((file) => {
      const key = `${file.name}_${file.size}_${file.lastModified}`;
      if (!thumbnails[key]) {
        setThumbnails((prev) => ({
          ...prev,
          [key]: { loading: true },
        }));

        renderPdfPages(file, 70, 1, false)
          .then((res) => {
            const page0 = res.pages[0];
            setThumbnails((prev) => ({
              ...prev,
              [key]: {
                thumbnailUrl: page0 ? page0.image : undefined,
                numPages: res.numPages,
                loading: false,
              },
            }));
          })
          .catch(() => {
            setThumbnails((prev) => ({
              ...prev,
              [key]: { loading: false },
            }));
          });
      }
    });
  }, [files]);

  // 上移
  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    const nextFiles = [...files];
    const temp = nextFiles[index - 1];
    nextFiles[index - 1] = nextFiles[index];
    nextFiles[index] = temp;
    onFilesChange(nextFiles);
  };

  // 下移
  const handleMoveDown = (index: number) => {
    if (index >= files.length - 1) return;
    const nextFiles = [...files];
    const temp = nextFiles[index + 1];
    nextFiles[index + 1] = nextFiles[index];
    nextFiles[index] = temp;
    onFilesChange(nextFiles);
  };

  // 移除
  const handleRemove = (index: number) => {
    const nextFiles = files.filter((_, i) => i !== index);
    onFilesChange(nextFiles);
  };

  // 逆序
  const handleReverse = () => {
    onFilesChange([...files].reverse());
  };

  // 追加文件
  const handleAddMoreFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files).filter((f) =>
        f.name.toLowerCase().endsWith(".pdf")
      );
      if (newFiles.length > 0) {
        onFilesChange([...files, ...newFiles]);
      }
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      {/* 隐藏的添加文件 input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleAddMoreFiles}
        accept=".pdf"
        multiple
        className="hidden"
      />

      {/* 顶部标题与说明 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-coconut-200/80 dark:border-darkbg-border">
        <div>
          <h3 className="text-base font-bold text-coconut-950 dark:text-darkbg-text flex items-center gap-2">
            <Combine className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            <span>
              {lang === "en" ? "PDF Free Reorder & Merge Studio" : "PDF 自由调序合并工作台"}
            </span>
          </h3>
          <p className="text-xs text-coconut-600 dark:text-darkbg-muted mt-1">
            {lang === "en"
              ? `${files.length} files uploaded · Final document will merge strictly in top-to-bottom order`
              : `已上传 ${files.length} 个文件 · 最终合并文档将严格按照当前从上至下的次序拼合`}
          </p>
        </div>

        {/* 顶部快捷操作 */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-darkbg-card border border-coconut-300 dark:border-darkbg-border hover:border-orange-500 text-coconut-800 dark:text-darkbg-text hover:text-orange-600 transition-all flex items-center gap-1.5 shadow-2xs active:scale-95"
          >
            <Plus className="w-3.5 h-3.5 text-orange-600" />
            <span>{lang === "en" ? "Append More PDFs" : "追加更多 PDF"}</span>
          </button>
          {files.length > 1 && (
            <button
              onClick={handleReverse}
              className="px-3 py-1.5 rounded-xl text-xs font-medium bg-coconut-100/70 dark:bg-darkbg-subtle text-coconut-700 dark:text-darkbg-muted hover:text-coconut-950 dark:hover:text-white transition-all flex items-center gap-1 active:scale-95"
              title={lang === "en" ? "Reverse order of all files" : "一键颠倒全部文件的合并顺序"}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{lang === "en" ? "Reverse Order" : "翻转顺序"}</span>
            </button>
          )}
          <button
            onClick={() => onFilesChange([])}
            className="px-3 py-1.5 rounded-xl text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-all flex items-center gap-1 active:scale-95"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{lang === "en" ? "Clear All" : "清空全部"}</span>
          </button>
        </div>
      </div>

      {/* 待合并文件卡片列表 */}
      <div className="space-y-3">
        {files.map((file, idx) => {
          const key = `${file.name}_${file.size}_${file.lastModified}`;
          const thumb = thumbnails[key];

          return (
            <div
              key={key}
              className="group relative flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl bg-white/90 dark:bg-darkbg-card border border-coconut-200/90 dark:border-darkbg-border shadow-2xs hover:shadow-coconut-sm hover:border-orange-400/60 dark:hover:border-orange-500/40 transition-all"
            >
              {/* 顺序序号徽标 */}
              <div className="flex-shrink-0 flex flex-col items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-accent-subtle border border-accent-border text-accent font-mono font-bold text-xs sm:text-sm">
                #{idx + 1}
              </div>

              {/* 首页微型预览图 */}
              <div className="w-12 h-16 sm:w-14 sm:h-20 flex-shrink-0 rounded-lg overflow-hidden border border-coconut-200 dark:border-darkbg-border bg-coconut-50 dark:bg-darkbg-subtle relative flex items-center justify-center shadow-xs">
                {thumb?.thumbnailUrl ? (
                  <img
                    src={thumb.thumbnailUrl}
                    alt={`Page 1 of ${file.name}`}
                    className="w-full h-full object-cover"
                  />
                ) : thumb?.loading ? (
                  <Loader2 className="w-4 h-4 text-orange-500 animate-spin" />
                ) : (
                  <FileText className="w-6 h-6 text-coconut-400 dark:text-darkbg-muted" />
                )}
                {thumb?.numPages && (
                  <span className="absolute bottom-1 right-1 text-[9px] px-1 py-0.2 rounded bg-black/60 text-white font-mono leading-tight">
                    {thumb.numPages}P
                  </span>
                )}
              </div>

              {/* 文件元数据信息 */}
              <div className="flex-1 min-w-0">
                <h4 className="text-xs sm:text-sm font-bold text-coconut-950 dark:text-darkbg-text truncate group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                  {file.name}
                </h4>
                <div className="flex items-center gap-2 mt-1 text-[11px] text-coconut-600 dark:text-darkbg-muted font-medium">
                  <span className="font-mono">{formatBytes(file.size)}</span>
                  <span>·</span>
                  <span>
                    {thumb?.numPages
                      ? (lang === "en" ? `${thumb.numPages} pages` : `共 ${thumb.numPages} 页`)
                      : (lang === "en" ? "PDF format" : "PDF 格式")}
                  </span>
                  <span className="hidden sm:inline">·</span>
                  <span className="hidden sm:inline text-orange-700 dark:text-orange-300">
                    {lang === "en" ? `#${idx + 1} in sequence` : `第 ${idx + 1} 位参与拼合`}
                  </span>
                </div>
              </div>

              {/* 顺序调换操作按钮组 */}
              <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => handleMoveUp(idx)}
                  disabled={idx === 0}
                  title={lang === "en" ? "Move up (merge earlier)" : "上移此文件 (提前合并)"}
                  className={`p-1.5 sm:p-2 rounded-xl border transition-all active:scale-90 ${
                    idx === 0
                      ? "opacity-30 cursor-not-allowed border-transparent text-coconut-400"
                      : "border-coconut-200 dark:border-darkbg-border hover:border-orange-500 hover:bg-orange-500/10 text-coconut-800 dark:text-darkbg-text"
                  }`}
                >
                  <ArrowUp className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => handleMoveDown(idx)}
                  disabled={idx === files.length - 1}
                  title={lang === "en" ? "Move down (merge later)" : "下移此文件 (靠后合并)"}
                  className={`p-1.5 sm:p-2 rounded-xl border transition-all active:scale-90 ${
                    idx === files.length - 1
                      ? "opacity-30 cursor-not-allowed border-transparent text-coconut-400"
                      : "border-coconut-200 dark:border-darkbg-border hover:border-orange-500 hover:bg-orange-500/10 text-coconut-800 dark:text-darkbg-text"
                  }`}
                >
                  <ArrowDown className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => handleRemove(idx)}
                  title={lang === "en" ? "Remove from merge list" : "从合并列表中移除"}
                  className="p-1.5 sm:p-2 rounded-xl border border-transparent hover:border-rose-300 dark:hover:border-rose-900/60 hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 transition-all active:scale-90 ml-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 提示与错误 */}
      {files.length < 2 && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-2 text-amber-900 dark:text-amber-200 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-600" />
          <span>
            {lang === "en"
              ? "Merging requires at least 2 PDF files. Please click 'Append More PDFs' above or drag more files in."
              : "合并至少需要 2 个 PDF 文件，请点击上方“追加更多 PDF”或继续拖入文件"}
          </span>
        </div>
      )}

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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 truncate">
              <div className="w-10 h-10 rounded-xl bg-accent-gradient text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                <FileCheck className="w-5 h-5 text-white" />
              </div>
              <div className="truncate">
                <h4 className="text-sm font-bold text-coconut-950 dark:text-white truncate">
                  {executionResult.filename}
                </h4>
                <p className="text-xs text-orange-800 dark:text-amber-300 font-mono font-medium">
                  {formatBytes(executionResult.size)} ·{" "}
                  {lang === "en"
                    ? `Successfully merged ${files.length} files`
                    : `成功合并 ${files.length} 个文件`}
                </p>
              </div>
            </div>
            <span className="hidden sm:inline-block px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-900 dark:text-amber-200 border border-amber-500/30 flex-shrink-0">
              {lang === "en" ? "✓ Ready · Click to Download" : "✓ 就绪 · 点击下载"}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              onClick={() => downloadBlob(executionResult.blob, executionResult.filename)}
              className="flex-1 py-3 px-4 rounded-xl btn-3d-sunset text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-coconut-sm"
            >
              <Download className="w-4 h-4" />
              <span>{lang === "en" ? "Download Merged PDF" : "立即下载该文件"}</span>
            </button>

            <button
              onClick={onReset}
              className="py-3 px-4 rounded-xl btn-3d-secondary font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{lang === "en" ? "Merge Other Files" : "合并其它文件"}</span>
            </button>
          </div>
        </div>
      ) : (
        /* 开始执行按钮 */
        <button
          onClick={onExecute}
          disabled={loading || files.length < 2}
          className={`w-full py-3.5 px-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
            loading || files.length < 2
              ? "bg-coconut-100 dark:bg-darkbg-subtle text-coconut-400 dark:text-darkbg-muted cursor-not-allowed border border-coconut-200 dark:border-darkbg-border"
              : "btn-3d-sunset text-white"
          }`}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{lang === "en" ? "Merging losslessly, please wait..." : "正在无损拼合中，请稍候..."}</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-amber-200" />
              <span>
                {lang === "en"
                  ? `Merge ${files.length} Selected PDF Files`
                  : `开始合并选中的 ${files.length} 个 PDF 文件`}
              </span>
            </>
          )}
        </button>
      )}
    </div>
  );
}
