"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Mic,
  Music,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Play,
  Square,
  Sparkles,
} from "lucide-react";
import {
  getAudioContext,
  decodeAudioFile,
  extractKaraokeAccompaniment,
  exportAudioBuffer,
  formatDuration,
} from "@/lib/audioProcessor";
import { formatBytes } from "@/lib/imageProcessor";
import { downloadBlob } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import SendToButton from "@/components/SendToButton";
import { AudioStudioProps } from "./types";

export default function AudioKaraokeStudio({
  isActive = true,
  incomingFile,
  onIncomingFileHandled,
}: AudioStudioProps) {
  const { lang } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");

  const [karaokeFile, setKaraokeFile] = useState<File | null>(null);
  const [karaokeBuffer, setKaraokeBuffer] = useState<AudioBuffer | null>(null);
  const [isMonoAudio, setIsMonoAudio] = useState(false);
  const [karaokeBassHz, setKaraokeBassHz] = useState<number>(180);
  const [karaokeFormat, setKaraokeFormat] = useState<"mp3" | "wav">("mp3");
  const [karaokeKbps, setKaraokeKbps] = useState(320);
  const [karaokeResult, setKaraokeResult] = useState<{ blob: Blob; filename: string; duration: number; url: string } | null>(null);

  // Live preview state
  const [isPlaying, setIsPlaying] = useState(false);
  const [previewMode, setPreviewMode] = useState<"karaoke" | "original">("karaoke");
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

  const stopPreview = () => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      } catch {}
      sourceNodeRef.current = null;
    }
    setIsPlaying(false);
  };

  const startPreview = (mode = previewMode) => {
    if (!karaokeBuffer) return;
    stopPreview();
    const ctx = getAudioContext();
    if (ctx.state === "suspended") {
      ctx.resume();
    }
    const targetBuffer = mode === "karaoke"
      ? extractKaraokeAccompaniment(karaokeBuffer, karaokeBassHz)
      : karaokeBuffer;

    const source = ctx.createBufferSource();
    source.buffer = targetBuffer;
    source.connect(ctx.destination);
    source.onended = () => {
      setIsPlaying(false);
    };
    source.start(0);
    sourceNodeRef.current = source;
    setIsPlaying(true);
  };

  const togglePreview = () => {
    if (isPlaying) {
      stopPreview();
    } else {
      startPreview(previewMode);
    }
  };

  const switchPreview = (mode: "karaoke" | "original") => {
    setPreviewMode(mode);
    if (isPlaying) {
      startPreview(mode);
    }
  };

  // Re-render preview if bass cutoff changes while playing karaoke mode
  useEffect(() => {
    if (isPlaying && previewMode === "karaoke") {
      startPreview("karaoke");
    }
  }, [karaokeBassHz]);

  // Clean up Object URL and preview playback
  useEffect(() => {
    return () => {
      stopPreview();
      if (karaokeResult?.url) {
        URL.revokeObjectURL(karaokeResult.url);
      }
    };
  }, [karaokeResult?.url]);

  // Handle incoming file
  useEffect(() => {
    if (isActive && incomingFile) {
      handleKaraokeFileSelected(incomingFile);
      onIncomingFileHandled?.();
    }
  }, [isActive, incomingFile]);

  const handleKaraokeFileSelected = async (file: File) => {
    stopPreview();
    setKaraokeFile(file);
    setKaraokeResult(null);
    setIsProcessing(true);
    setProgressMsg(lang === "en" ? "Analyzing audio stereo phase..." : "正在解析立体声声场与中央声道...");
    try {
      const buf = await decodeAudioFile(file);
      setKaraokeBuffer(buf);
      const isMono = buf.numberOfChannels < 2;
      setIsMonoAudio(isMono);
      if (isMono) {
        setError(
          lang === "en"
            ? "Mono audio detected. Central vocal removal requires stereo channels and cannot process mono files."
            : "检测到单声道音频。消除人声依赖立体声左右声道相位差分，单声道文件无法分离伴奏。"
        );
      } else {
        setError(null);
      }
    } catch (err: any) {
      setError((lang === "en" ? "Failed to load song: " : "加载歌曲失败: ") + err.message);
    } finally {
      setIsProcessing(false);
      setProgressMsg("");
    }
  };

  const handleExecuteKaraoke = async () => {
    if (!karaokeBuffer || !karaokeFile || isMonoAudio) return;
    setIsProcessing(true);
    setProgressMsg(lang === "en" ? "Isolating accompaniment & suppressing vocals..." : "正在消除正中央人声并保留低频鼓点与贝斯...");
    setError(null);

    try {
      const accompaniment = extractKaraokeAccompaniment(karaokeBuffer, karaokeBassHz);
      const { blob, ext } = await exportAudioBuffer(accompaniment, karaokeFormat, karaokeKbps);
      const baseName = karaokeFile.name.replace(/\.[^/.]+$/, "");
      const outputFilename = `${baseName}_karaoke_bgm.${ext}`;
      setKaraokeResult({
        blob,
        filename: outputFilename,
        duration: accompaniment.duration,
        url: URL.createObjectURL(blob),
      });
    } catch (err: any) {
      setError((lang === "en" ? "Karaoke vocal removal failed: " : "伴奏提取/消人声失败: ") + err.message);
    } finally {
      setIsProcessing(false);
      setProgressMsg("");
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

      {isProcessing && progressMsg && (
        <div className="p-4 bg-toast-500/10 border border-toast-500/20 text-toast-600 dark:text-toast-400 rounded-2xl flex items-center space-x-2 text-sm animate-fade-in">
          <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
          <span>{progressMsg}</span>
        </div>
      )}

      <div className="coconut-panel p-5 sm:p-6 space-y-5">
        <div>
          <h3 className="text-base font-bold text-coconut-900 dark:text-darkbg-text">
            {lang === "en" ? "Vocal Cut & Accompaniment Extractor" : "伴奏提取与立体声消人声"}
          </h3>
          <p className="text-xs text-coconut-600 dark:text-darkbg-muted mt-1 leading-relaxed">
            {lang === "en"
              ? "Uses stereo center-channel phase cancellation to eliminate centered lead vocals while preserving stereo instruments and adding back low-frequency drums and bass."
              : "基于专业立体声中心相位抵消技术（Center Channel Cancellation），精准消除位于正中央的主唱人声，同时保留左右声道的乐器和声，并通过低通滤波器保护低频底鼓与贝斯。"}
          </p>
        </div>

        {!karaokeBuffer ? (
          <div
            onClick={() => document.getElementById("karaoke-upload-input")?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const f = e.dataTransfer.files?.[0];
              if (f) handleKaraokeFileSelected(f);
            }}
            className="border-2 border-dashed border-[#D2BCAB] dark:border-[#4D392E] hover:border-amber-500 dark:hover:border-amber-400 rounded-3xl p-10 text-center cursor-pointer transition-all bg-[#FAF1E8]/75 dark:bg-[#251E1A]/70 hover:bg-[#F4E6D8]/85"
          >
            <input
              id="karaoke-upload-input"
              type="file"
              accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac,.aac,.wma"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleKaraokeFileSelected(e.target.files[0]);
                }
              }}
              className="hidden"
            />
            <Mic className="w-10 h-10 text-toast-500 mx-auto mb-2" />
            <div className="text-sm sm:text-base font-bold text-coconut-900 dark:text-darkbg-text">
              {lang === "en" ? "Click or drag stereo song here for vocal removal" : "点击或拖拽立体声歌曲至此处消人声"}
            </div>
            <div className="text-xs text-coconut-600 dark:text-darkbg-muted mt-1">
              {lang === "en"
                ? "Best for standard stereo mixed songs with lead vocals mixed in the center"
                : "适用于立体声混音歌曲（主唱位于中央，伴奏分布于左右声道的歌曲效果最佳）"}
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="p-3 bg-coconut-50/70 dark:bg-darkbg-subtle rounded-2xl border border-coconut-200/70 dark:border-darkbg-border flex items-center justify-between">
              <div className="truncate pr-2">
                <span className="text-xs font-semibold text-coconut-900 dark:text-darkbg-text truncate block">
                  {karaokeFile?.name}
                </span>
                <span className="text-[10px] text-coconut-600 dark:text-darkbg-muted font-mono">
                  {karaokeFile && formatBytes(karaokeFile.size)} · {formatDuration(karaokeBuffer.duration)}
                </span>
              </div>
              <button
                onClick={() => {
                  setKaraokeBuffer(null);
                  setKaraokeFile(null);
                  setKaraokeResult(null);
                }}
                className="text-xs text-coconut-600 hover:text-coconut-900 dark:text-darkbg-muted dark:hover:text-darkbg-text flex-shrink-0"
              >
                {lang === "en" ? "Change Song" : "更换歌曲"}
              </button>
            </div>

            {isMonoAudio && (
              <div className="p-3.5 bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-400 rounded-2xl flex items-start space-x-2.5 text-xs animate-fade-in">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block mb-0.5">
                    {lang === "en" ? "Mono Audio Detected (1 Channel)" : "检测到单声道音频 (Mono 单声道)"}
                  </span>
                  <span>
                    {lang === "en"
                      ? "Central vocal removal relies on Left-Right stereo phase cancellation. Mono audio cannot be processed to isolate backing tracks. Please supply a stereo music file."
                      : "消人声伴奏算法依赖立体声左右声道 (L/R) 相位差分抵消。此音频仅包含单声道，中央人声与伴奏在物理上已完全混叠，无法分离伴奏。请更换为双声道立体声音乐。"}
                  </span>
                </div>
              </div>
            )}

            {/* Bass preservation slider */}
            <div className="space-y-3 p-4 bg-coconut-50/60 dark:bg-darkbg-subtle rounded-2xl border border-coconut-200/60 dark:border-darkbg-border">
              <div className="flex justify-between items-center text-xs sm:text-sm font-semibold text-coconut-900 dark:text-darkbg-text">
                <span>{lang === "en" ? "Bass & Drum Preservation Frequency:" : "底鼓与贝斯低频保护阈值:"}</span>
                <span className="font-mono text-sm font-bold text-toast-500">{karaokeBassHz} Hz</span>
              </div>
              <input
                type="range"
                min="80"
                max="300"
                step="10"
                value={karaokeBassHz}
                onChange={(e) => setKaraokeBassHz(parseInt(e.target.value))}
                disabled={isMonoAudio}
                className="w-full h-2 bg-coconut-200 dark:bg-darkbg-border rounded-lg appearance-none cursor-pointer accent-coconut-700 dark:accent-palm-400"
              />
              <p className="text-[11px] text-coconut-600 dark:text-darkbg-muted leading-relaxed">
                {lang === "en"
                  ? "💡 Preserves lower frequencies (<180Hz) to keep the rhythm section and bassline punchy, avoiding a hollow or tinny backing track."
                  : "💡 避免单纯相消导致伴奏发空变薄。系统会自动提取此频率以下的低频低音并混合回伴奏，保留强劲节拍感。"}
              </p>
            </div>

            {/* Live Karaoke Preview Player */}
            {!isMonoAudio && (
              <div className="p-4 bg-coconut-50/70 dark:bg-darkbg-subtle rounded-2xl border border-coconut-200/60 dark:border-darkbg-border flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={togglePreview}
                    className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all active:scale-95 ${
                      isPlaying
                        ? "bg-rose-500 text-white shadow-sm"
                        : "bg-coconut-800 text-coconut-50 dark:bg-white dark:text-zinc-950 shadow-sm"
                    }`}
                  >
                    {isPlaying ? (
                      <>
                        <Square className="w-3.5 h-3.5 fill-current" />
                        <span>{lang === "en" ? "Stop Preview" : "停止试听"}</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>{lang === "en" ? "Preview Accompaniment" : "实时伴奏试听"}</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center bg-coconut-200/60 dark:bg-darkbg-elevated p-1 rounded-xl text-xs">
                    <button
                      type="button"
                      onClick={() => switchPreview("karaoke")}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                        previewMode === "karaoke"
                          ? "bg-white dark:bg-zinc-800 text-coconut-900 dark:text-darkbg-text shadow-xs"
                          : "text-coconut-600 dark:text-darkbg-muted"
                      }`}
                    >
                      {lang === "en" ? "Accompaniment" : "伴奏效果"}
                    </button>
                    <button
                      type="button"
                      onClick={() => switchPreview("original")}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                        previewMode === "original"
                          ? "bg-white dark:bg-zinc-800 text-coconut-900 dark:text-darkbg-text shadow-xs"
                          : "text-coconut-600 dark:text-darkbg-muted"
                      }`}
                    >
                      {lang === "en" ? "Original Song" : "原曲对比"}
                    </button>
                  </div>
                </div>

                <span className="text-[11px] text-coconut-500 dark:text-darkbg-muted font-mono">
                  {isPlaying
                    ? (previewMode === "karaoke" ? "🎧 试听中: 实时消除人声伴奏" : "🎧 试听中: 原始歌曲完整声场")
                    : "💡 调节低频滑块可在试听中即时调整鼓点饱满度"}
                </span>
              </div>
            )}

            {/* Export format & button */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
              <div className="flex items-center space-x-3 text-sm">
                <span className="text-coconut-900 dark:text-darkbg-text font-bold">
                  {lang === "en" ? "Export Format:" : "导出格式:"}
                </span>
                {(["mp3", "wav"] as const).map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => setKaraokeFormat(fmt)}
                    className={`px-3.5 py-1.5 rounded-xl font-bold uppercase transition-all active:scale-95 text-xs sm:text-sm ${
                      karaokeFormat === fmt
                        ? "bg-coconut-800 text-coconut-50 dark:bg-white dark:text-zinc-950 font-bold shadow-sm"
                        : "bg-coconut-100/70 dark:bg-darkbg-subtle text-coconut-700 dark:text-darkbg-muted hover:dark:text-darkbg-text border border-transparent dark:border-darkbg-border"
                    }`}
                  >
                    {fmt}
                  </button>
                ))}
              </div>

              <button
                onClick={handleExecuteKaraoke}
                disabled={isProcessing || isMonoAudio}
                className={`w-full sm:w-auto px-7 py-3 rounded-2xl text-xs font-bold flex items-center justify-center space-x-2 transition-all ${
                  isProcessing || isMonoAudio
                    ? "bg-coconut-100 dark:bg-darkbg-subtle text-coconut-400 dark:text-darkbg-muted cursor-not-allowed border border-coconut-200 dark:border-darkbg-border"
                    : "btn-3d-sunset text-white"
                }`}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{lang === "en" ? "Isolating accompaniment..." : "正在消除人声分离伴奏..."}</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4" />
                    <span>{lang === "en" ? "Extract Accompaniment" : "开始提取伴奏"}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Karaoke result card */}
      {karaokeResult && (
        <div className="coconut-panel p-5 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between pb-3 border-b border-coconut-100 dark:border-darkbg-border">
            <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
              <CheckCircle2 className="w-4 h-4" />
              <span>{lang === "en" ? "Accompaniment Extracted Successfully!" : "伴奏提取消人声完成！"}</span>
            </div>
            <div className="flex items-center space-x-2">
              <SendToButton
                compact
                category="audio"
                payload={{
                  blob: karaokeResult.blob,
                  filename: karaokeResult.filename,
                  sourceTitle: lang === "en" ? "Karaoke Accompaniment" : "卡拉OK伴奏提取",
                }}
                lang={lang}
              />
              <button
                onClick={() => downloadBlob(karaokeResult.blob, karaokeResult.filename)}
                className="px-4 py-2 btn-3d-sunset text-white rounded-xl text-xs font-bold flex items-center space-x-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{lang === "en" ? "Download Accompaniment" : "立即下载纯伴奏"}</span>
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs text-coconut-700 dark:text-darkbg-text font-mono">
              <span className="truncate max-w-[280px] sm:max-w-md font-semibold">{karaokeResult.filename}</span>
              <span>{formatDuration(karaokeResult.duration)} · {formatBytes(karaokeResult.blob.size)}</span>
            </div>
            <audio controls src={karaokeResult.url} className="w-full h-10 rounded-lg" />
          </div>
        </div>
      )}
    </div>
  );
}
