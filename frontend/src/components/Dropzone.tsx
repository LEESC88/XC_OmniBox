"use client";

import React, { useState, useRef } from "react";
import {
  UploadCloud,
  FileText,
  File as FileIcon,
  Image as ImageIcon,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  Zap,
  Sparkles,
  X,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface DropzoneProps {
  accept: string;
  multiple?: boolean;
  onFilesSelected: (files: File[]) => void;
  selectedFiles: File[];
  onClear: () => void;
  title?: string;
  hint?: string;
  badge?: string;
}

export default function Dropzone({
  accept,
  multiple = false,
  onFilesSelected,
  selectedFiles,
  onClear,
  title,
  hint,
  badge,
}: DropzoneProps) {
  const { t, lang } = useI18n();
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isPdf = accept.includes(".pdf");
  const isDoc = accept.includes(".doc");
  const isImg = accept.includes("image");

  const formatTag = isPdf
    ? "PDF"
    : isDoc
    ? "DOCX / DOC"
    : isImg
    ? "IMAGE"
    : "DOC";

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      onFilesSelected(multiple ? files : [files[0]]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      onFilesSelected(multiple ? files : [files[0]]);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  };

  const displayTitle = title ?? t.dropzone.defaultTitle;
  const displayHint = hint ?? t.dropzone.defaultHint;

  return (
    <div className="w-full">
      {selectedFiles.length === 0 ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`group relative rounded-3xl border-2 border-dashed p-8 sm:p-12 text-center cursor-pointer transition-all duration-300 select-none overflow-hidden ${
            isDragOver
              ? "border-amber-500 bg-amber-500/10 dark:bg-amber-500/15 scale-[0.992] shadow-[0_16px_48px_rgba(245,158,11,0.22)] ring-4 ring-amber-500/20"
              : "border-[#D2BCAB] dark:border-[#4D392E] hover:border-amber-500 dark:hover:border-amber-400/90 bg-gradient-to-b from-[#FAF1E8]/75 via-[#F7EDE2]/60 to-[#F2E3D4]/85 dark:from-[#261E1A]/85 dark:via-[#201915]/90 dark:to-[#181310] hover:shadow-[0_14px_40px_-10px_rgba(245,158,11,0.14)] dark:hover:shadow-[0_14px_40px_-10px_rgba(245,158,11,0.10)]"
          }`}
        >
          {/* 装饰性中心环境微光圈 */}
          <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-gradient-to-br from-amber-500/12 to-orange-500/5 blur-3xl opacity-50 group-hover:opacity-100 group-hover:scale-125 transition-all duration-700" />

          <input
            ref={inputRef}
            type="file"
            accept={accept}
            multiple={multiple}
            onChange={handleFileInput}
            className="hidden"
          />

          <div className="relative z-10 flex flex-col items-center justify-center space-y-4">
            {/* 顶栏微标签 (若有外部传入或格式识别) */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase bg-white/90 dark:bg-[#30251F] text-coconut-800 dark:text-amber-400 border border-[#D2BCAB]/70 dark:border-[#523E33] shadow-2xs group-hover:border-amber-500/40 transition-colors">
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>{badge || formatTag}</span>
            </div>

            {/* 核心双层微质感主图标 */}
            <div className="relative">
              {/* 图标环境光晕 */}
              <div className="absolute -inset-1.5 rounded-3xl bg-gradient-to-tr from-amber-500/25 to-orange-500/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-400" />
              <div
                className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl flex items-center justify-center transition-all duration-300 shadow-md ${
                  isDragOver
                    ? "bg-amber-500 text-white scale-110 shadow-lg shadow-amber-500/30"
                    : "bg-white/95 dark:bg-[#342821] text-amber-600 dark:text-amber-400 border border-white dark:border-[#523E33] group-hover:scale-105 group-hover:-translate-y-1 group-hover:shadow-lg"
                }`}
              >
                <UploadCloud className="w-8 h-8 sm:w-10 sm:h-10 transition-transform duration-300 group-hover:scale-110" />
              </div>
            </div>

            {/* 标题与交互指引 */}
            <div className="space-y-1.5 max-w-lg mx-auto">
              <p className="text-base sm:text-lg font-bold text-coconut-900 dark:text-darkbg-text tracking-tight flex items-center justify-center flex-wrap gap-1">
                <span>
                  {isDragOver
                    ? t.dropzone.releaseToUpload || "松开鼠标立即加载文档"
                    : t.dropzone.dragOrClick || "拖拽文件至此区域，或"}
                </span>
                {!isDragOver && (
                  <span className="text-amber-600 dark:text-amber-400 underline decoration-amber-500/40 underline-offset-4 group-hover:decoration-amber-500 transition-colors font-semibold">
                    {t.dropzone.clickToBrowse || "点击浏览本地文件"}
                  </span>
                )}
              </p>
              <p className="text-xs sm:text-sm text-coconut-600 dark:text-darkbg-muted leading-relaxed">
                {displayHint}
              </p>
            </div>

            {/* 企业级特性微标识行 */}
            <div className="flex items-center justify-center flex-wrap gap-2 pt-1 text-[11px] font-medium text-coconut-600 dark:text-darkbg-muted">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-coconut-200/50 dark:bg-darkbg-subtle/80 border border-coconut-300/40 dark:border-darkbg-border">
                <FileText className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                <span>{accept.replace(/\*/g, "")}</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-coconut-200/50 dark:bg-darkbg-subtle/80 border border-coconut-300/40 dark:border-darkbg-border">
                <Zap className="w-3 h-3 text-amber-500" />
                <span>{t.dropzone.localSandbox || "本地毫秒级解析"}</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-coconut-200/50 dark:bg-darkbg-subtle/80 border border-coconut-300/40 dark:border-darkbg-border">
                <ShieldCheck className="w-3 h-3 text-emerald-500" />
                <span>{t.dropzone.privacyNotice || "100% 隐私安全"}</span>
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* 文件已就绪状态卡片 */
        <div className="bg-gradient-to-b from-white/95 via-[#FAF1E8]/70 to-[#F4E6D8]/80 dark:from-[#281F1A] dark:via-[#221A15] dark:to-[#1A1410] border border-[#D2BCAB] dark:border-[#4D392E] rounded-3xl p-5 sm:p-6 shadow-coconut-md backdrop-blur-md space-y-4">
          <div className="flex items-center justify-between pb-1 border-b border-[#D2BCAB]/40 dark:border-[#4D392E]/60">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>
                {t.dropzone.selectedFiles.replace(
                  "{n}",
                  String(selectedFiles.length)
                )}
              </span>
            </div>
            <button
              onClick={onClear}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/60 hover:bg-rose-100/90 dark:hover:bg-rose-950/60 transition-all shadow-2xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{t.dropzone.reselect}</span>
            </button>
          </div>

          <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
            {selectedFiles.map((file, idx) => {
              const fileIsPdf = file.name.toLowerCase().endsWith(".pdf");
              const fileIsWord =
                file.name.toLowerCase().endsWith(".docx") ||
                file.name.toLowerCase().endsWith(".doc");

              return (
                <div
                  key={idx}
                  className="group relative flex items-center justify-between p-3.5 sm:p-4 bg-white/95 dark:bg-[#30251F] rounded-2xl border border-[#E8DDCE] dark:border-[#44342A] hover:border-amber-500/50 dark:hover:border-amber-500/40 shadow-2xs transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${
                        fileIsPdf
                          ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                          : fileIsWord
                          ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                          : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                      }`}
                    >
                      {fileIsPdf ? (
                        <FileText className="w-5 h-5" />
                      ) : fileIsWord ? (
                        <FileIcon className="w-5 h-5" />
                      ) : (
                        <ImageIcon className="w-5 h-5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-coconut-900 dark:text-darkbg-text text-xs sm:text-sm truncate">
                        {file.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="px-1.5 py-0.5 rounded bg-coconut-100 dark:bg-[#251E1A] text-[10px] font-mono font-semibold text-coconut-600 dark:text-darkbg-muted">
                          {formatSize(file.size)}
                        </span>
                        <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{t.dropzone.readyBadge || "准备就绪"}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
