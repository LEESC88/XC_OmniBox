"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Images,
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  ArrowRightLeft,
  FileCheck,
  Download,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Maximize2,
  FileText,
  Sparkles,
} from "lucide-react";
import { formatBytes } from "@/lib/imageProcessor";
import { downloadBlob } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export type ImagePageSize = "fit" | "a4";

interface ImagesToPdfStudioProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  onConvert: (pageSize: ImagePageSize) => Promise<void>;
  loading: boolean;
  error: string | null;
  successMsg: string | null;
  executionResult: { blob: Blob; filename: string; size: number } | null;
  onReset: () => void;
  onClearFiles: () => void;
}

export default function ImagesToPdfStudio({
  files,
  onFilesChange,
  onConvert,
  loading,
  error,
  successMsg,
  executionResult,
  onReset,
  onClearFiles,
}: ImagesToPdfStudioProps) {
  const { lang } = useI18n();
  const [pageSize, setPageSize] = useState<ImagePageSize>("fit");

  // Memoized ObjectURLs with strict lifecycle revocation to prevent memory leaks
  const previewUrls = useMemo(() => {
    return files.map((f) => URL.createObjectURL(f));
  }, [files]);

  useEffect(() => {
    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previewUrls]);

  // 上移
  const moveUp = (index: number) => {
    if (index === 0) return;
    const next = [...files];
    const temp = next[index];
    next[index] = next[index - 1];
    next[index - 1] = temp;
    onFilesChange(next);
  };

  // 下移
  const moveDown = (index: number) => {
    if (index === files.length - 1) return;
    const next = [...files];
    const temp = next[index];
    next[index] = next[index + 1];
    next[index + 1] = temp;
    onFilesChange(next);
  };

  // 移除
  const removeFile = (index: number) => {
    const next = files.filter((_, i) => i !== index);
    onFilesChange(next);
  };

  // 反转
  const reverseOrder = () => {
    onFilesChange([...files].reverse());
  };

  // 追加更多文件
  const handleAppendFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const appended = Array.from(e.target.files);
    onFilesChange([...files, ...appended]);
    e.target.value = "";
  };

  const totalSize = files.reduce((acc, f) => acc + f.size, 0);

  return (
    <div className="space-y-6">
      {/* 顶部工具栏与规格切换 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-coconut-200/80 dark:border-darkbg-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
            <Images className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-coconut-950 dark:text-darkbg-text">
              {lang === "en" ? "Images to PDF Studio" : "多图一键合成 PDF 工坊"}
            </h3>
            <p className="text-xs text-coconut-600 dark:text-darkbg-muted mt-0.5">
              {lang === "en"
                ? `Total ${files.length} images (${formatBytes(totalSize)}) · Drag or sort to define page order`
                : `共选中 ${files.length} 张图片 (${formatBytes(totalSize)}) · 可上下移动调整每页顺序`}
            </p>
          </div>
        </div>

        {/* 排版规格胶囊切换 */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="p-1 rounded-2xl bg-coconut-100 dark:bg-darkbg-subtle border border-coconut-200 dark:border-darkbg-border flex items-center gap-1">
            <button
              onClick={() => setPageSize("fit")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                pageSize === "fit"
                  ? "bg-accent-gradient text-white shadow-2xs"
                  : "text-coconut-700 dark:text-darkbg-muted hover:text-coconut-950 dark:hover:text-white"
              }`}
            >
              {lang === "en" ? "Fit Image (No Border)" : "原图自适应 (无白边)"}
            </button>
            <button
              onClick={() => setPageSize("a4")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                pageSize === "a4"
                  ? "bg-accent-gradient text-white shadow-2xs"
                  : "text-coconut-700 dark:text-darkbg-muted hover:text-coconut-950 dark:hover:text-white"
              }`}
            >
              {lang === "en" ? "Standard A4 Page" : "标准 A4 规格排版"}
            </button>
          </div>

          <button
            onClick={reverseOrder}
            className="p-2 rounded-xl text-coconut-700 dark:text-darkbg-muted hover:bg-coconut-100 dark:hover:bg-darkbg-subtle transition-colors flex items-center gap-1 text-xs font-semibold"
            title={lang === "en" ? "Reverse Order" : "反转全部顺序"}
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span className="hidden md:inline">{lang === "en" ? "Reverse" : "倒序"}</span>
          </button>

          <label className="p-2 rounded-xl text-coconut-700 dark:text-darkbg-muted hover:bg-coconut-100 dark:hover:bg-darkbg-subtle transition-colors flex items-center gap-1 text-xs font-semibold cursor-pointer">
            <Plus className="w-4 h-4 text-palm-600" />
            <span className="hidden md:inline">{lang === "en" ? "Add More" : "加图"}</span>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleAppendFiles}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* 图片卡片列表 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {files.map((file, idx) => {
          const previewUrl = previewUrls[idx];
          return (
            <div
              key={`${file.name}_${idx}`}
              className="group relative bg-white dark:bg-darkbg-card rounded-2xl border border-coconut-200/80 dark:border-darkbg-border overflow-hidden shadow-2xs hover:shadow-coconut-sm transition-all flex flex-col"
            >
              {/* 页码徽标 */}
              <div className="absolute top-2 left-2 z-10 w-6 h-6 rounded-full bg-black/60 backdrop-blur-md text-white font-mono text-[11px] font-bold flex items-center justify-center shadow-xs">
                {idx + 1}
              </div>

              {/* 快捷操作浮层 */}
              <div className="absolute top-2 right-2 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => moveUp(idx)}
                  disabled={idx === 0}
                  className="w-6 h-6 rounded-lg bg-black/60 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/80 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="上移"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => moveDown(idx)}
                  disabled={idx === files.length - 1}
                  className="w-6 h-6 rounded-lg bg-black/60 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/80 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="下移"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => removeFile(idx)}
                  className="w-6 h-6 rounded-lg bg-rose-600/80 backdrop-blur-md text-white flex items-center justify-center hover:bg-rose-700"
                  title="删除"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>

              {/* 缩略图 */}
              <div className="aspect-[3/4] w-full bg-coconut-100/50 dark:bg-darkbg-subtle/50 flex items-center justify-center overflow-hidden p-1.5">
                <img
                  src={previewUrl}
                  alt={file.name}
                  className="w-full h-full object-contain rounded-lg"
                  loading="lazy"
                />
              </div>

              {/* 底部信息 */}
              <div className="p-2 border-t border-coconut-100 dark:border-darkbg-border bg-coconut-50/40 dark:bg-darkbg-subtle/30">
                <div className="text-[11px] font-bold text-coconut-950 dark:text-darkbg-text truncate">
                  {file.name}
                </div>
                <div className="text-[10px] text-coconut-500 dark:text-darkbg-muted font-mono mt-0.5">
                  {formatBytes(file.size)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

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
                  {lang === "en" ? `Combined from ${files.length} images` : `已成功将 ${files.length} 张图片合成为单一 PDF`}
                </p>
              </div>
            </div>

            <span className="hidden sm:inline-block px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-900 dark:text-amber-200 border border-amber-500/30 flex-shrink-0">
              {lang === "en" ? "✓ Combined · Ready" : "✓ 合成完成 · 已就绪"}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              onClick={() => downloadBlob(executionResult.blob, executionResult.filename)}
              className="flex-1 py-3 px-4 rounded-xl btn-3d-sunset text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-coconut-sm"
            >
              <Download className="w-4 h-4" />
              <span>{lang === "en" ? "Download Combined PDF" : "立即下载合成后的 PDF"}</span>
            </button>

            <button
              onClick={onReset}
              className="py-3 px-4 rounded-xl btn-3d-secondary font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{lang === "en" ? "Reorder or Add" : "重新排版"}</span>
            </button>
          </div>
        </div>
      ) : (
        /* 执行合成按钮 */
        <button
          onClick={() => onConvert(pageSize)}
          disabled={loading || files.length === 0}
          className={`w-full py-3.5 px-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
            loading || files.length === 0
              ? "bg-coconut-100 dark:bg-darkbg-subtle text-coconut-400 dark:text-darkbg-muted cursor-not-allowed border border-coconut-200 dark:border-darkbg-border"
              : "btn-3d-sunset text-white"
          }`}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{lang === "en" ? "Combining images to PDF..." : "正在将图片极速写入 PDF，请稍候..."}</span>
            </>
          ) : (
            <>
              <Images className="w-4 h-4 text-amber-200" />
              <span>
                {lang === "en"
                  ? `Combine ${files.length} images into PDF (${pageSize === "a4" ? "A4" : "Fit"})`
                  : `开始将 ${files.length} 张图片合成导出为 PDF (${pageSize === "a4" ? "标准 A4" : "原图自适应"})`}
              </span>
            </>
          )}
        </button>
      )}
    </div>
  );
}
