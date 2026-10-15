"use client";

import React, { useState, useEffect } from "react";
import {
  FolderArchive,
  FileCheck,
  Download,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
  FileText,
  FileSpreadsheet,
  Presentation,
  Image as ImageIcon,
  Sparkles,
  Zap,
  PackageOpen,
  Film,
  Music,
} from "lucide-react";
import Dropzone from "@/components/Dropzone";
import { formatBytes } from "@/lib/imageProcessor";
import {
  extractOfficeMedia,
  ExtractMediaResult,
  ExtractedMediaItem,
  downloadBlob,
  onTaskProgress,
  TaskProgressEvent,
} from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export interface OfficeMediaExtractStudioProps {
  initialFile?: File | null;
  onClearInitialFile?: () => void;
}

export default function OfficeMediaExtractStudio({
  initialFile,
  onClearInitialFile,
}: OfficeMediaExtractStudioProps) {
  const { lang } = useI18n();

  const [file, setFile] = useState<File | null>(initialFile || null);
  const [loading, setLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<{ percent: number; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractMediaResult | null>(null);

  // Sync initial incoming file
  useEffect(() => {
    if (initialFile) {
      setFile(initialFile);
      setResult(null);
      setError(null);
    }
  }, [initialFile]);

  // Listen to IPC long task progress
  useEffect(() => {
    const unsub = onTaskProgress((ev: TaskProgressEvent) => {
      if (ev.task === "document:extract-media") {
        setProgress({
          percent: ev.percent,
          message:
            ev.percent >= 100
              ? lang === "en"
                ? "Packaging complete!"
                : "解构并打包完成！"
              : lang === "en"
                ? `Extracting media (${ev.current}/${ev.total})...`
                : `正在解构提取 (${ev.current}/${ev.total})...`,
        });
      }
    });
    return unsub;
  }, [lang]);

  // Handle files selected via dropzone
  const handleFilesDrop = (incoming: File[]) => {
    if (incoming.length > 0) {
      setFile(incoming[0]);
      setResult(null);
      setError(null);
      setProgress(null);
    }
  };

  // Execute extraction
  const handleExtract = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setProgress({
      percent: 5,
      message: lang === "en" ? "Unpacking OpenXML container..." : "正在解构 OpenXML 媒体容器...",
    });

    try {
      const res = await extractOfficeMedia(file);
      setResult(res);
      if (res.count === 0) {
        setError(res.message || (lang === "en" ? "No embedded media files found." : "未在该文档中发现独立内嵌的高清图片或媒体文件"));
      }
    } catch (err: any) {
      setError(err.message || (lang === "en" ? "Failed to extract media." : "多媒体资产提取失败，请重试"));
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  // Reset all
  const handleReset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    setProgress(null);
    onClearInitialFile?.();
  };

  // Single item download
  const handleDownloadSingle = (item: ExtractedMediaItem) => {
    if (!item.previewUrl) return;
    // Download via data URL
    const a = document.createElement("a");
    a.href = item.previewUrl;
    a.download = item.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Download all as ZIP
  const handleDownloadAll = () => {
    if (result && result.zipBlob) {
      downloadBlob(result.zipBlob, result.zipFilename);
    }
  };

  // Determine file format icon
  const getDocIcon = (filename: string) => {
    const ext = filename.split(".").pop()?.toLowerCase();
    if (["docx", "docm", "dotx", "odt"].includes(ext || "")) {
      return <FileText className="w-6 h-6 text-blue-500" />;
    }
    if (["pptx", "pptm", "potx", "odp"].includes(ext || "")) {
      return <Presentation className="w-6 h-6 text-orange-500" />;
    }
    if (["xlsx", "xlsm", "xltx", "ods"].includes(ext || "")) {
      return <FileSpreadsheet className="w-6 h-6 text-emerald-500" />;
    }
    return <PackageOpen className="w-6 h-6 text-amber-500" />;
  };

  return (
    <div className="space-y-6">
      {/* 顶部标题栏与说明 */}
      <div className="coconut-panel p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#D2BCAB]/30 dark:border-[#4D392E]/40">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-md shadow-orange-500/25 flex items-center justify-center text-white flex-shrink-0">
              <FolderArchive className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center flex-wrap gap-2">
                <h3 className="text-base sm:text-lg font-extrabold text-coconut-900 dark:text-darkbg-text tracking-tight">
                  {lang === "en" ? "Office Media Asset Extractor" : "Office 媒体资产一键提取"}
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 tracking-wider uppercase">
                  {lang === "en" ? "Lossless Original" : "无损原图解构"}
                </span>
              </div>
              <p className="text-xs text-coconut-600 dark:text-darkbg-muted leading-relaxed max-w-xl">
                {lang === "en"
                  ? "Extract 100% original, uncompressed images, photos and audio/video embedded inside Word (.docx), PPT (.pptx), and Excel (.xlsx) files without opening Office."
                  : "免装 Office，一键深入 Word (.docx)、PPT (.pptx)、Excel (.xlsx) 容器底层，无损萃取所有未被压缩、未被裁剪的高清原图与多媒体素材。"}
              </p>
            </div>
          </div>

          {file && (
            <button
              onClick={handleReset}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#D2BCAB]/40 dark:border-[#4D392E]/60 text-xs font-semibold text-coconut-700 dark:text-darkbg-text hover:bg-black/5 dark:hover:bg-white/5 transition-all self-start sm:self-center"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{lang === "en" ? "Change File" : "更换文档"}</span>
            </button>
          )}
        </div>

        {/* 未选择文件：Dropzone 状态 */}
        {!file && (
          <div className="space-y-4">
            <Dropzone
              accept=".docx,.pptx,.xlsx,.docm,.pptm,.xlsm,.odt,.odp,.ods"
              multiple={false}
              selectedFiles={file ? [file] : []}
              onFilesSelected={handleFilesDrop}
              onClear={() => setFile(null)}
              title={lang === "en" ? "Drop Word, PPT or Excel file here" : "拖入 Word、PPT 或 Excel 文件"}
              hint={
                lang === "en"
                  ? "Supports .docx, .pptx, .xlsx, .docm, .pptm, .odt"
                  : "支持 .docx、.pptx、.xlsx、.docm、.pptm、.xlsm、.odt 等标准格式"
              }
              badge="无损解构"
            />

            {/* 核心亮点标签 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="p-3.5 rounded-2xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/15 flex items-center gap-3">
                <Sparkles className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <div className="text-[11px] leading-tight text-coconut-800 dark:text-darkbg-text">
                  <span className="font-bold block">{lang === "en" ? "Zero Re-compression" : "绝不二次压缩"}</span>
                  <span className="text-coconut-500 dark:text-darkbg-muted">100% 原始分辨率原图</span>
                </div>
              </div>
              <div className="p-3.5 rounded-2xl bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/15 flex items-center gap-3">
                <Zap className="w-4 h-4 text-blue-500 flex-shrink-0" />
                <div className="text-[11px] leading-tight text-coconut-800 dark:text-darkbg-text">
                  <span className="font-bold block">{lang === "en" ? "Milliseconds Speed" : "毫秒级极速解构"}</span>
                  <span className="text-coconut-500 dark:text-darkbg-muted">纯本地进程内解包</span>
                </div>
              </div>
              <div className="p-3.5 rounded-2xl bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/15 flex items-center gap-3">
                <PackageOpen className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <div className="text-[11px] leading-tight text-coconut-800 dark:text-darkbg-text">
                  <span className="font-bold block">{lang === "en" ? "ZIP One-Click Download" : "一键打包为 ZIP"}</span>
                  <span className="text-coconut-500 dark:text-darkbg-muted">自动排版并序列化编号</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 已选择文件：待解构状态卡片 */}
        {file && !result && (
          <div className="space-y-6">
            <div className="p-4 sm:p-5 rounded-2xl bg-[#F5ECE4]/70 dark:bg-[#34241B]/50 border border-[#D2BCAB]/40 dark:border-[#4D392E]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-white dark:bg-[#2A1D16] border border-[#D2BCAB]/30 dark:border-[#4D392E]/40 flex items-center justify-center flex-shrink-0 shadow-sm">
                  {getDocIcon(file.name)}
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm sm:text-base font-bold text-coconut-900 dark:text-darkbg-text truncate">
                    {file.name}
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-coconut-500 dark:text-darkbg-muted mt-0.5">
                    <span>{formatBytes(file.size)}</span>
                    <span>•</span>
                    <span className="font-mono uppercase">{file.name.split(".").pop()} 容器</span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleExtract}
                disabled={loading}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold text-sm shadow-md shadow-orange-500/20 disabled:opacity-50 disabled:pointer-events-none transition-all flex items-center justify-center gap-2 flex-shrink-0"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{progress?.message || (lang === "en" ? "Extracting..." : "正在提取素材...")}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>{lang === "en" ? "Extract All Original Media" : "一键解构提取所有原图"}</span>
                  </>
                )}
              </button>
            </div>

            {/* 实时进度条 */}
            {loading && progress && (
              <div className="space-y-2 p-4 rounded-xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 animate-pulse">
                <div className="flex justify-between text-xs text-coconut-700 dark:text-darkbg-text font-medium">
                  <span>{progress.message}</span>
                  <span className="font-bold">{progress.percent}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-300 rounded-full"
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* 错误提示 */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed">{error}</div>
          </div>
        )}

        {/* 提取结果展示区 */}
        {result && result.count > 0 && (
          <div className="space-y-6 pt-2">
            {/* 成功状态摘要面板 */}
            <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-emerald-500/25">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm sm:text-base font-extrabold text-coconut-900 dark:text-darkbg-text">
                    {lang === "en"
                      ? `Extracted ${result.count} Original Media Assets`
                      : `成功解构 ${result.count} 个无损多媒体素材`}
                  </h4>
                  <p className="text-xs text-coconut-600 dark:text-darkbg-muted mt-0.5">
                    {lang === "en"
                      ? `Total media payload size: ${formatBytes(result.totalSize)}`
                      : `素材总容量大小：${formatBytes(result.totalSize)} • 格式原样保留`}
                  </p>
                </div>
              </div>

              <button
                onClick={handleDownloadAll}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 flex-shrink-0"
              >
                <Download className="w-4 h-4" />
                <span>{lang === "en" ? "Download All (ZIP)" : "一键下载全部素材包 (ZIP)"}</span>
              </button>
            </div>

            {/* 素材网格卡片 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-coconut-600 dark:text-darkbg-muted px-1">
                <span className="font-semibold">
                  {lang === "en" ? "Extracted Media Preview" : "素材预览清单（按文档出现顺序排列）"}
                </span>
                <span>{result.count} 个文件</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
                {result.items.map((item, idx) => (
                  <div
                    key={item.id}
                    className="group relative rounded-2xl bg-white dark:bg-[#2A1D16] border border-[#D2BCAB]/40 dark:border-[#4D392E]/60 overflow-hidden shadow-sm hover:shadow-md hover:border-amber-500/50 transition-all flex flex-col"
                  >
                    {/* 图片预览区或多媒体占位图 */}
                    <div className="relative w-full aspect-square bg-[#FAF4EE] dark:bg-[#20150F] flex items-center justify-center overflow-hidden">
                      {item.previewUrl ? (
                        <img
                          src={item.previewUrl}
                          alt={item.name}
                          className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-1.5 text-coconut-400 dark:text-darkbg-muted">
                          {item.mimeType.startsWith("video/") ? (
                            <Film className="w-8 h-8 text-indigo-500" />
                          ) : item.mimeType.startsWith("audio/") ? (
                            <Music className="w-8 h-8 text-pink-500" />
                          ) : (
                            <ImageIcon className="w-8 h-8 text-amber-500" />
                          )}
                          <span className="text-[10px] uppercase font-mono font-bold tracking-wider">
                            .{item.extension}
                          </span>
                        </div>
                      )}

                      {/* 悬浮下载单图快捷按钮 */}
                      {item.previewUrl && (
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button
                            onClick={() => handleDownloadSingle(item)}
                            className="p-2 rounded-xl bg-white text-coconut-900 shadow-lg hover:scale-110 active:scale-95 transition-all text-xs font-bold flex items-center gap-1"
                            title={lang === "en" ? "Save image" : "保存单张"}
                          >
                            <Download className="w-3.5 h-3.5 text-amber-600" />
                          </button>
                        </div>
                      )}

                      {/* 序号标牌 */}
                      <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-black/60 text-white font-mono text-[9px] font-bold">
                        #{idx + 1}
                      </span>
                    </div>

                    {/* 卡片底栏信息 */}
                    <div className="p-2.5 space-y-1 bg-white/80 dark:bg-[#2A1D16]/80 flex-1 flex flex-col justify-between">
                      <div className="text-[11px] font-semibold text-coconut-800 dark:text-darkbg-text truncate" title={item.name}>
                        {item.name}
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-coconut-500 dark:text-darkbg-muted">
                        <span className="font-mono uppercase">{item.extension}</span>
                        <span>{formatBytes(item.size)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
