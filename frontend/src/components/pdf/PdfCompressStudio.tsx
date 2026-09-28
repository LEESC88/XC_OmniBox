"use client";

import React, { useState, useEffect } from "react";
import {
  Minimize2,
  FileCheck,
  Download,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
  FileText,
  Sparkles,
  Zap,
  ShieldCheck,
  Flame,
} from "lucide-react";
import { formatBytes } from "@/lib/imageProcessor";
import { renderPdfPages, downloadBlob } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export type CompressLevel = "low" | "medium" | "high";

interface PdfCompressStudioProps {
  file: File;
  onCompress: (level: CompressLevel) => Promise<void>;
  loading: boolean;
  error: string | null;
  successMsg: string | null;
  executionResult: {
    blob: Blob;
    filename: string;
    size: number;
    originalSize?: number;
  } | null;
  onReset: () => void;
  onClearFile: () => void;
}

export default function PdfCompressStudio({
  file,
  onCompress,
  loading,
  error,
  successMsg,
  executionResult,
  onReset,
  onClearFile,
}: PdfCompressStudioProps) {
  const { lang } = useI18n();
  const [level, setLevel] = useState<CompressLevel>("medium");
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(1);
  const [loadingThumb, setLoadingThumb] = useState<boolean>(true);

  // 加载首页缩略图用于文件验证与视觉反馈
  useEffect(() => {
    let isCancelled = false;
    setLoadingThumb(true);
    setThumbUrl(null);

    renderPdfPages(file, 90, 1, false)
      .then((res) => {
        if (!isCancelled && res.pages && res.pages.length > 0) {
          setThumbUrl(res.pages[0].image);
          setNumPages(res.numPages);
          setLoadingThumb(false);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setLoadingThumb(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [file]);

  const levelOptions: {
    id: CompressLevel;
    nameZh: string;
    nameEn: string;
    descZh: string;
    descEn: string;
    badgeZh: string;
    badgeEn: string;
    icon: any;
  }[] = [
    {
      id: "low",
      nameZh: "轻度优化 (高保真)",
      nameEn: "Light (Lossless-like)",
      descZh: "清除死对象与冗余流，仅适度微调，文字与高清线条最锐利",
      descEn: "Remove redundant streams, highest fidelity for vectors & text",
      badgeZh: "质量优先",
      badgeEn: "Quality",
      icon: ShieldCheck,
    },
    {
      id: "medium",
      nameZh: "平衡推荐 (办公首选)",
      nameEn: "Balanced (Recommended)",
      descZh: "下采样大图至 1400px，压缩比与清晰度达到黄金平衡，适合邮箱与政务网",
      descEn: "Downscale images to 1400px, optimal for email and upload limits",
      badgeZh: "省 40%~70%",
      badgeEn: "Save 50%+",
      icon: Zap,
    },
    {
      id: "high",
      nameZh: "强力瘦身 (极限减容)",
      nameEn: "Extreme (Maximum Compression)",
      descZh: "高强度下采样至 1000px 并深度压缩位图，榨干多余体积至最小",
      descEn: "Aggressive downsampling and high-ratio compression for tiny sizes",
      badgeZh: "极限瘦身",
      badgeEn: "Smallest",
      icon: Flame,
    },
  ];

  // 计算节省体积
  const origSize = executionResult?.originalSize ?? file.size;
  const savedBytes = executionResult
    ? Math.max(0, origSize - executionResult.size)
    : 0;
  const savedPercent =
    executionResult && origSize > 0
      ? Math.round((savedBytes / origSize) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* 顶部文件概要 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-coconut-200/80 dark:border-darkbg-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center flex-shrink-0">
            <Minimize2 className="w-5 h-5" />
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
              {lang === "en"
                ? `Total ${numPages} pages · Ready for intelligent volume slimming`
                : `整本文档共 ${numPages} 页 · 准备进行智能体积瘦身`}
            </p>
          </div>
        </div>

        <button
          onClick={onClearFile}
          className="p-2 rounded-xl text-coconut-500 hover:text-rose-600 hover:bg-rose-500/10 transition-colors self-start sm:self-auto"
          title={lang === "en" ? "Change File" : "更换其他文件"}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 缩略图与压缩级别选择面板 */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* 左侧：首页缩略图预览卡片 */}
        <div className="md:col-span-4 flex flex-col items-center">
          <div className="w-full aspect-[3/4] max-w-[240px] bg-coconut-100/60 dark:bg-darkbg-subtle/50 rounded-2xl border border-coconut-200/80 dark:border-darkbg-border flex items-center justify-center overflow-hidden shadow-2xs relative group">
            {loadingThumb ? (
              <div className="flex flex-col items-center gap-2 text-coconut-400 dark:text-darkbg-muted">
                <Loader2 className="w-6 h-6 animate-spin text-palm-500" />
                <span className="text-xs">{lang === "en" ? "Generating preview..." : "正在生成预览..."}</span>
              </div>
            ) : thumbUrl ? (
              <img
                src={thumbUrl}
                alt="Document Cover"
                className="w-full h-full object-contain p-2"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-coconut-400 dark:text-darkbg-muted">
                <FileText className="w-10 h-10 stroke-[1.5]" />
                <span className="text-xs">{lang === "en" ? "PDF Document" : "PDF 预览已就绪"}</span>
              </div>
            )}
            <div className="absolute bottom-2 left-2 right-2 px-2 py-1 bg-black/60 backdrop-blur-md rounded-xl text-center text-[10px] text-white font-medium">
              {lang === "en" ? "First Page Preview" : "第 1 页 封面图"}
            </div>
          </div>
        </div>

        {/* 右侧：压缩档位卡片 */}
        <div className="md:col-span-8 space-y-3">
          <div className="text-xs font-bold text-coconut-800 dark:text-darkbg-muted uppercase tracking-wider">
            {lang === "en" ? "Select Compression Preset" : "选择压缩瘦身档位"}
          </div>

          <div className="space-y-2.5">
            {levelOptions.map((opt) => {
              const IconComp = opt.icon;
              const isSelected = level === opt.id;
              return (
                <div
                  key={opt.id}
                  onClick={() => setLevel(opt.id)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? "bg-accent-subtle/80 border-orange-500/60 shadow-coconut-xs dark:border-orange-500/50"
                      : "bg-white/60 dark:bg-darkbg-subtle/50 border-coconut-200/70 dark:border-darkbg-border hover:bg-coconut-50/70 dark:hover:bg-darkbg-card"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                        isSelected
                          ? "bg-accent-gradient text-white shadow-2xs"
                          : "bg-coconut-200/60 dark:bg-darkbg-border text-coconut-600 dark:text-darkbg-muted"
                      }`}
                    >
                      <IconComp className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-coconut-950 dark:text-white">
                          {lang === "en" ? opt.nameEn : opt.nameZh}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            isSelected
                              ? "bg-orange-500/20 text-orange-800 dark:text-amber-200"
                              : "bg-coconut-150 dark:bg-darkbg-border text-coconut-600 dark:text-darkbg-muted"
                          }`}
                        >
                          {lang === "en" ? opt.badgeEn : opt.badgeZh}
                        </span>
                      </div>
                      <p className="text-xs text-coconut-600 dark:text-darkbg-muted mt-0.5">
                        {lang === "en" ? opt.descEn : opt.descZh}
                      </p>
                    </div>
                  </div>

                  <input
                    type="radio"
                    name="compress-level"
                    checked={isSelected}
                    onChange={() => setLevel(opt.id)}
                    className="accent-palm-500 w-4 h-4 flex-shrink-0 cursor-pointer"
                  />
                </div>
              );
            })}
          </div>
        </div>
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
                <div className="flex items-center gap-2 mt-0.5 text-xs">
                  <span className="text-coconut-500 line-through">
                    {formatBytes(origSize)}
                  </span>
                  <span className="text-orange-900 dark:text-amber-300 font-bold font-mono">
                    ➜ {formatBytes(executionResult.size)}
                  </span>
                  {savedPercent > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-palm-500/20 text-palm-700 dark:text-palm-300 border border-palm-500/30">
                      -{savedPercent}%
                    </span>
                  )}
                </div>
              </div>
            </div>

            <span className="hidden sm:inline-block px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-900 dark:text-amber-200 border border-amber-500/30 flex-shrink-0">
              {lang === "en" ? "✓ Compressed · Ready" : "✓ 压缩完成 · 已就绪"}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              onClick={() => downloadBlob(executionResult.blob, executionResult.filename)}
              className="flex-1 py-3 px-4 rounded-xl btn-3d-sunset text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-coconut-sm"
            >
              <Download className="w-4 h-4" />
              <span>{lang === "en" ? "Download Compressed PDF" : "立即下载压缩版 PDF"}</span>
            </button>

            <button
              onClick={onReset}
              className="py-3 px-4 rounded-xl btn-3d-secondary font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{lang === "en" ? "Try Other Level" : "换个档位再压"}</span>
            </button>
          </div>
        </div>
      ) : (
        /* 执行压缩按钮 */
        <button
          onClick={() => onCompress(level)}
          disabled={loading}
          className={`w-full py-3.5 px-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
            loading
              ? "bg-coconut-100 dark:bg-darkbg-subtle text-coconut-400 dark:text-darkbg-muted cursor-not-allowed border border-coconut-200 dark:border-darkbg-border"
              : "btn-3d-sunset text-white"
          }`}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{lang === "en" ? "Compressing PDF, please wait..." : "正在深度分析压缩 PDF，请稍候..."}</span>
            </>
          ) : (
            <>
              <Minimize2 className="w-4 h-4 text-amber-200" />
              <span>
                {lang === "en"
                  ? `Start Compression (${levelOptions.find((l) => l.id === level)?.nameEn})`
                  : `开始压缩 (${levelOptions.find((l) => l.id === level)?.nameZh})`}
              </span>
            </>
          )}
        </button>
      )}
    </div>
  );
}
