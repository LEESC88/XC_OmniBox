"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  RefreshCw,
  UploadCloud,
  Download,
  CheckCircle2,
  AlertCircle,
  Archive,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import {
  decodeAudioFile,
  exportAudioBuffer,
  formatDuration,
} from "@/lib/audioProcessor";
import { formatBytes } from "@/lib/imageProcessor";
import { downloadBlob } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import BatchQueueProgress from "@/components/BatchQueueProgress";
import SendToButton from "@/components/SendToButton";
import {
  BatchTaskItem,
  BatchProgressSummary,
  executeBatchQueue,
  exportBatchFiles,
} from "@/lib/batchQueueManager";
import { AudioResult, AudioStudioProps } from "./types";

export default function AudioConvertStudio({
  isActive = true,
  incomingFile,
  onIncomingFileHandled,
}: AudioStudioProps) {
  const { lang } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const [convertFiles, setConvertFiles] = useState<File[]>([]);
  const [convertTargetFormat, setConvertTargetFormat] = useState<"mp3" | "wav">("mp3");
  const [convertKbps, setConvertKbps] = useState(320);
  const [convertResults, setConvertResults] = useState<AudioResult[]>([]);
  const [convertConcurrency, setConvertConcurrency] = useState(3);
  const [convertQueueItems, setConvertQueueItems] = useState<BatchTaskItem<File, AudioResult>[]>([]);
  const [convertQueueSummary, setConvertQueueSummary] = useState<BatchProgressSummary>({
    total: 0,
    completed: 0,
    failed: 0,
    active: 0,
    waiting: 0,
    percent: 0,
    etaSeconds: null,
  });
  const convertAbortCtrlRef = useRef<AbortController | null>(null);

  // Edge Case 3: Abort queue processing if unmounted or deactivated
  useEffect(() => {
    return () => {
      if (convertAbortCtrlRef.current) {
        convertAbortCtrlRef.current.abort();
      }
    };
  }, []);

  // Edge Case 2: Ingest incomingFile safely
  useEffect(() => {
    if (isActive && incomingFile) {
      setConvertFiles((prev) => [...prev, incomingFile]);
      onIncomingFileHandled?.();
    }
  }, [isActive, incomingFile]);

  const processSingleAudio = async (
    item: BatchTaskItem<File, AudioResult>,
    reportProgress: (pct: number) => void
  ): Promise<AudioResult> => {
    const file = item.raw;
    reportProgress(20);
    const buffer = await decodeAudioFile(file);
    reportProgress(60);
    const { blob, ext } = await exportAudioBuffer(buffer, convertTargetFormat, convertKbps);
    reportProgress(100);
    const baseName = file.name.replace(/\.[^/.]+$/, "");
    return {
      id: `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      originalName: file.name,
      originalSize: file.size,
      newFilename: `${baseName}.${ext}`,
      newSize: blob.size,
      blob,
      duration: buffer.duration,
    };
  };

  const runConvertPipeline = async (tasks: BatchTaskItem<File, AudioResult>[]) => {
    setIsProcessing(true);
    setError(null);
    const abortCtrl = new AbortController();
    convertAbortCtrlRef.current = abortCtrl;

    try {
      const { items: updatedItems } = await executeBatchQueue(tasks, processSingleAudio, {
        concurrency: convertConcurrency,
        signal: abortCtrl.signal,
        onProgress: (sum) => setConvertQueueSummary({ ...sum }),
        onItemUpdate: (updated) => {
          setConvertQueueItems((prev) => prev.map((it) => (it.id === updated.id ? { ...updated } : it)));
        },
      });

      const completed = updatedItems
        .filter((it) => it.status === "completed" && it.result)
        .map((it) => it.result!);
      setConvertResults(completed);
    } catch (err: any) {
      setError(err?.message || (lang === "en" ? "Batch convert failed" : "批量格式转码失败"));
    } finally {
      setIsProcessing(false);
      convertAbortCtrlRef.current = null;
    }
  };

  const handleExecuteConvert = async () => {
    if (convertFiles.length === 0) return;
    const tasks: BatchTaskItem<File, AudioResult>[] = convertFiles.map((file, i) => ({
      id: `audio_task_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 7)}`,
      name: file.name,
      size: file.size,
      raw: file,
      status: "waiting",
      progress: 0,
    }));
    setConvertQueueItems(tasks);
    await runConvertPipeline(tasks);
  };

  const handleRetryConvertItem = async (itemId: string) => {
    const updated = convertQueueItems.map((it) =>
      it.id === itemId ? { ...it, status: "waiting" as const, error: undefined, progress: 0 } : it
    );
    setConvertQueueItems(updated);
    await runConvertPipeline(updated);
  };

  const handleRetryAllFailedConvert = async () => {
    const updated = convertQueueItems.map((it) =>
      it.status === "error" || it.status === "cancelled"
        ? { ...it, status: "waiting" as const, error: undefined, progress: 0 }
        : it
    );
    setConvertQueueItems(updated);
    await runConvertPipeline(updated);
  };

  const handleCancelConvertQueue = () => {
    if (convertAbortCtrlRef.current) {
      convertAbortCtrlRef.current.abort();
    }
    setIsProcessing(false);
  };

  const handleExportConvertAll = async () => {
    if (convertResults.length === 0) return;
    try {
      const items = convertResults.map((r) => ({ blob: r.blob, filename: r.newFilename }));
      const zipName = `XC_Converted_Audio_${Date.now()}.zip`;
      await exportBatchFiles(items, { zipName, lang });
    } catch (err: any) {
      setError((lang === "en" ? "Failed to export audio files: " : "导出音频文件失败: ") + err.message);
    }
  };

  return (
    <div className="space-y-5">
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center space-x-2 text-sm animate-fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="coconut-panel p-5 sm:p-6 space-y-4">
        <div className="font-bold text-sm text-coconut-900 dark:text-darkbg-text flex items-center space-x-2">
          <RefreshCw className="w-4 h-4 text-toast-500" />
          <span>{lang === "en" ? "Target Conversion Settings" : "设置批量转换目标参数"}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <span className="text-sm text-coconut-900 dark:text-darkbg-text font-semibold">
              {lang === "en" ? "Target Audio Format" : "目标音频格式"}
            </span>
            <div className="flex space-x-2">
              {(["mp3", "wav"] as const).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => setConvertTargetFormat(fmt)}
                  className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold uppercase transition-all active:scale-95 ${
                    convertTargetFormat === fmt
                      ? "bg-coconut-800 text-coconut-50 dark:bg-white dark:text-zinc-950 font-bold shadow-sm"
                      : "bg-coconut-100/70 dark:bg-darkbg-subtle text-coconut-700 dark:text-darkbg-muted hover:dark:text-darkbg-text border border-transparent dark:border-darkbg-border"
                  }`}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>

          {convertTargetFormat === "mp3" && (
            <div className="space-y-1.5">
              <span className="text-sm text-coconut-900 dark:text-darkbg-text font-semibold">
                {lang === "en" ? "MP3 Bitrate" : "MP3 压缩比特率"}
              </span>
              <select
                value={convertKbps}
                onChange={(e) => setConvertKbps(parseInt(e.target.value))}
                className="w-full px-3.5 py-2.5 text-sm bg-white/70 dark:bg-darkbg-subtle border border-coconut-300/80 dark:border-darkbg-border rounded-xl text-coconut-900 dark:text-darkbg-text focus:outline-none focus:border-palm-500 shadow-2xs"
              >
                <option value={320} className="dark:bg-darkbg-card dark:text-darkbg-text">
                  {lang === "en" ? "320 kbps (Studio Master Music)" : "320 kbps (录音室母带级音乐)"}
                </option>
                <option value={256} className="dark:bg-darkbg-card dark:text-darkbg-text">
                  {lang === "en" ? "256 kbps (High Fidelity Music)" : "256 kbps (高保真音乐)"}
                </option>
                <option value={192} className="dark:bg-darkbg-card dark:text-darkbg-text">
                  {lang === "en" ? "192 kbps (Standard CD Quality)" : "192 kbps (通用标准 CD 级)"}
                </option>
                <option value={128} className="dark:bg-darkbg-card dark:text-darkbg-text">
                  {lang === "en" ? "128 kbps (Compact Podcast)" : "128 kbps (网络播客省流)"}
                </option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Drag & drop upload area */}
      <div
        onClick={() => document.getElementById("audio-convert-upload")?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files) {
            setConvertFiles((prev) => [...prev, ...Array.from(e.dataTransfer.files)]);
          }
        }}
        className="group relative overflow-hidden border-2 border-dashed border-[#D2BCAB]/70 dark:border-[#4D392E]/60 hover:border-amber-500/70 dark:hover:border-amber-500/70 bg-gradient-to-b from-[#FBF8F4]/80 to-[#F5ECE1]/60 dark:from-[#211713]/70 dark:to-[#18110D]/70 hover:from-[#FFFDF9] hover:to-[#FDF4EB] dark:hover:from-[#291D17] dark:hover:to-[#1F1511] rounded-3xl p-8 sm:p-11 text-center cursor-pointer transition-all duration-300 shadow-sm hover:shadow-lg hover:shadow-amber-900/5 select-none"
      >
        <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[radial-gradient(circle_at_50%_40%,rgba(245,158,11,0.08),transparent_65%)]" />
        <input
          id="audio-convert-upload"
          type="file"
          multiple
          accept="audio/*"
          onChange={(e) => {
            if (e.target.files) {
              setConvertFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
            }
          }}
          className="hidden"
        />
        <div className="relative flex flex-col items-center space-y-3.5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center group-hover:scale-105 group-hover:-translate-y-0.5 transition-all duration-300 shadow-md shadow-orange-500/25">
            <UploadCloud className="w-7 h-7" />
          </div>
          <div>
            <div className="text-base font-bold text-coconut-900 dark:text-darkbg-text tracking-tight group-hover:text-amber-800 dark:group-hover:text-amber-300 transition-colors">
              {lang === "en" ? "Click or drag audio files here" : "点击或拖拽多个音频文件至此处"}
            </div>
            <div className="text-xs text-coconut-600 dark:text-darkbg-muted mt-1 max-w-md mx-auto">
              {lang === "en"
                ? "Supports MP3, WAV, AAC, M4A, OGG, FLAC and more (Batch queue ready)"
                : "支持 MP3, WAV, AAC, M4A, OGG, FLAC 等全部音频格式（支持并发批量转码）"}
            </div>
          </div>
          <div className="flex items-center flex-wrap justify-center gap-2 pt-1 text-[11px] font-medium text-coconut-600 dark:text-darkbg-muted">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-coconut-100/70 dark:bg-darkbg-card border border-coconut-200/80 dark:border-darkbg-border">
              ⚡ 多线程并发流水线
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              100% 本地沙盒保密
            </span>
          </div>
        </div>
      </div>

      {/* Files pending list */}
      {convertFiles.length > 0 && (
        <div className="coconut-panel p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-bold text-xs text-coconut-900 dark:text-darkbg-text">
              {lang === "en" ? `Pending Audio (${convertFiles.length})` : `待转码音频 (${convertFiles.length} 首)`}
            </span>
            <button
              onClick={() => {
                if (convertAbortCtrlRef.current) convertAbortCtrlRef.current.abort();
                setConvertFiles([]);
                setConvertQueueItems([]);
                setConvertResults([]);
                setConvertQueueSummary({ total: 0, completed: 0, failed: 0, active: 0, waiting: 0, percent: 0, etaSeconds: null });
              }}
              className="text-xs text-rose-500 hover:text-rose-600 font-medium"
            >
              {lang === "en" ? "Clear List" : "清空列表"}
            </button>
          </div>

          {/* Queue monitor */}
          {convertQueueItems.length > 0 && (
            <BatchQueueProgress
              summary={convertQueueSummary}
              items={convertQueueItems}
              isProcessing={isProcessing}
              concurrency={convertConcurrency}
              onConcurrencyChange={setConvertConcurrency}
              onCancel={handleCancelConvertQueue}
              onRetryItem={handleRetryConvertItem}
              onRetryAllFailed={handleRetryAllFailedConvert}
              onExportAll={handleExportConvertAll}
              exportLabel={lang === "en" ? "Export All" : "一键导出全部音频"}
              title={lang === "en" ? "Audio Transcoding Queue" : "音频批量转码队列"}
              lang={lang}
            />
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {convertFiles.map((f, i) => (
              <div
                key={`${f.name}_${i}`}
                className="p-2.5 bg-coconut-50/70 dark:bg-darkbg-subtle rounded-xl border border-coconut-200/70 dark:border-darkbg-border flex items-center justify-between"
              >
                <div className="truncate text-xs font-semibold text-coconut-900 dark:text-darkbg-text pr-2">
                  {f.name}
                </div>
                <span className="text-[10px] text-coconut-600 dark:text-darkbg-muted font-mono">{formatBytes(f.size)}</span>
              </div>
            ))}
          </div>

          {!isProcessing && (
            <div className="flex justify-end pt-2">
              <button
                onClick={handleExecuteConvert}
                className="px-6 py-3 rounded-2xl text-xs font-bold flex items-center space-x-2 transition-all btn-3d-sunset text-white"
              >
                <Sparkles className="w-4 h-4 text-amber-200" />
                <span>
                  {convertQueueItems.length > 0
                    ? lang === "en"
                      ? `Re-transcode All (${convertFiles.length} files)`
                      : `重新并发转码全部 (${convertFiles.length} 首)`
                    : lang === "en"
                    ? `Start Batch Transcoding (${convertFiles.length} files)`
                    : `开始批量并发转码 (${convertFiles.length} 首)`}
                </span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Convert results */}
      {convertResults.length > 0 && (
        <div className="coconut-panel p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-coconut-100 dark:border-darkbg-border">
            <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {lang === "en"
                  ? `Transcode Complete! Generated ${convertResults.length} audio files`
                  : `转码完成！共生成 ${convertResults.length} 首高保真音频`}
              </span>
            </div>
            <button
              onClick={handleExportConvertAll}
              className="px-4 py-2 btn-3d-sunset text-white rounded-xl text-xs font-bold flex items-center space-x-1.5"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>{lang === "en" ? "Export All" : "一键导出全部"}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {convertResults.map((res) => (
              <div
                key={res.id}
                className="p-3 bg-coconut-50/60 dark:bg-darkbg-subtle border border-coconut-200/70 dark:border-darkbg-border rounded-xl flex items-center justify-between"
              >
                <div className="space-y-0.5 truncate pr-2">
                  <div className="text-xs font-semibold text-coconut-900 dark:text-darkbg-text truncate">
                    {res.newFilename}
                  </div>
                  <div className="text-[10px] text-coconut-600 dark:text-darkbg-muted font-mono">
                    {lang === "en" ? "Duration: " : "时长: "}
                    {formatDuration(res.duration)} · {formatBytes(res.newSize)}
                  </div>
                </div>
                <div className="flex items-center space-x-1.5 flex-shrink-0">
                  <SendToButton
                    compact
                    category="audio"
                    payload={{
                      blob: res.blob,
                      filename: res.newFilename,
                      sourceTitle: lang === "en" ? "Audio Transcode" : "音频转码",
                    }}
                    lang={lang}
                  />
                  <button
                    onClick={() => downloadBlob(res.blob, res.newFilename)}
                    className="p-2 rounded-xl bg-coconut-100 dark:bg-darkbg-elevated text-coconut-700 dark:text-darkbg-text hover:bg-coconut-800 hover:text-coconut-50 dark:hover:bg-white dark:hover:text-zinc-950 transition-all active:scale-95"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
