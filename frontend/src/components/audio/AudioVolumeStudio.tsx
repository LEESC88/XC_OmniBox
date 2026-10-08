"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Volume2,
  Sparkles,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Play,
  Square,
  VolumeX,
} from "lucide-react";
import {
  getAudioContext,
  decodeAudioFile,
  adjustVolumeAndNormalize,
  enhanceVoiceClarity,
  exportAudioBuffer,
  formatDuration,
} from "@/lib/audioProcessor";
import { formatBytes } from "@/lib/imageProcessor";
import { downloadBlob } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import SendToButton from "@/components/SendToButton";
import { AudioStudioProps } from "./types";

export default function AudioVolumeStudio({
  isActive = true,
  incomingFile,
  onIncomingFileHandled,
}: AudioStudioProps) {
  const { lang } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");

  const [volumeFile, setVolumeFile] = useState<File | null>(null);
  const [volumeBuffer, setVolumeBuffer] = useState<AudioBuffer | null>(null);
  const [volumeMode, setVolumeMode] = useState<"normalize" | "gain">("normalize");
  const [gainPercent, setGainPercent] = useState(100);
  const [outputFormat, setOutputFormat] = useState<"mp3" | "wav">("mp3");
  const [filterRumble, setFilterRumble] = useState(true);
  const [boostPresence, setBoostPresence] = useState(true);
  const [compressDynamics, setCompressDynamics] = useState(true);
  const [volumeResult, setVolumeResult] = useState<{ blob: Blob; filename: string; duration: number; url: string } | null>(null);

  // Live A/B preview state
  const [isPlaying, setIsPlaying] = useState(false);
  const [previewAB, setPreviewAB] = useState<"effect" | "original">("effect");
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  const getTargetGain = (
    ab: "effect" | "original",
    mode: "normalize" | "gain",
    gain: number,
    buf: AudioBuffer | null
  ) => {
    if (ab === "original") return 1.0;
    if (mode === "gain") return Math.max(0, gain / 100);
    if (!buf) return 1.0;
    let peak = 0.0001;
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const data = buf.getChannelData(c);
      const step = Math.max(1, Math.floor(data.length / 5000));
      for (let i = 0; i < data.length; i += step) {
        const v = Math.abs(data[i]);
        if (v > peak) peak = v;
      }
    }
    return Math.min(10.0, 0.98 / peak);
  };

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

  const startPreview = (abMode = previewAB) => {
    if (!volumeBuffer) return;
    stopPreview();
    const ctx = getAudioContext();
    if (ctx.state === "suspended") {
      ctx.resume();
    }
    const source = ctx.createBufferSource();
    source.buffer = volumeBuffer;
    const gainNode = ctx.createGain();
    const targetGain = getTargetGain(abMode, volumeMode, gainPercent, volumeBuffer);
    gainNode.gain.setValueAtTime(targetGain, ctx.currentTime);
    source.connect(gainNode);
    gainNode.connect(ctx.destination);
    source.onended = () => {
      setIsPlaying(false);
    };
    source.start(0);
    sourceNodeRef.current = source;
    gainNodeRef.current = gainNode;
    setIsPlaying(true);
  };

  const togglePreview = () => {
    if (isPlaying) {
      stopPreview();
    } else {
      startPreview(previewAB);
    }
  };

  const switchPreviewAB = (target: "effect" | "original") => {
    setPreviewAB(target);
    if (gainNodeRef.current && isPlaying) {
      const ctx = getAudioContext();
      const g = getTargetGain(target, volumeMode, gainPercent, volumeBuffer);
      gainNodeRef.current.gain.setValueAtTime(g, ctx.currentTime);
    }
  };

  // Sync live gain changes while playing
  useEffect(() => {
    if (gainNodeRef.current && isPlaying && previewAB === "effect") {
      const ctx = getAudioContext();
      const g = getTargetGain("effect", volumeMode, gainPercent, volumeBuffer);
      gainNodeRef.current.gain.setValueAtTime(g, ctx.currentTime);
    }
  }, [gainPercent, volumeMode, isPlaying, previewAB, volumeBuffer]);

  // Clean up Object URL and audio playback on unmount
  useEffect(() => {
    return () => {
      stopPreview();
      if (volumeResult?.url) {
        URL.revokeObjectURL(volumeResult.url);
      }
    };
  }, [volumeResult?.url]);

  // Handle incoming file
  useEffect(() => {
    if (isActive && incomingFile) {
      handleVolumeFileSelected(incomingFile);
      onIncomingFileHandled?.();
    }
  }, [isActive, incomingFile]);

  const handleVolumeFileSelected = async (file: File) => {
    stopPreview();
    setVolumeFile(file);
    setVolumeResult(null);
    setIsProcessing(true);
    setProgressMsg(lang === "en" ? "Analyzing audio levels..." : "正在分析音频电平...");
    try {
      const buf = await decodeAudioFile(file);
      setVolumeBuffer(buf);
    } catch (err: any) {
      setError((lang === "en" ? "Failed to load audio: " : "加载音频失败: ") + err.message);
    } finally {
      setIsProcessing(false);
      setProgressMsg("");
    }
  };

  const handleExecuteVolume = async () => {
    if (!volumeBuffer || !volumeFile) return;
    setIsProcessing(true);
    setProgressMsg(lang === "en" ? "Processing gain levels, noise filtering & normalization..." : "正在计算增益、人声降噪与防破音处理...");
    setError(null);

    try {
      const factor = volumeMode === "gain" ? gainPercent / 100 : 1.0;
      const isNorm = volumeMode === "normalize";
      let adjusted = adjustVolumeAndNormalize(volumeBuffer, factor, isNorm);

      if (filterRumble || boostPresence || compressDynamics) {
        adjusted = await enhanceVoiceClarity(adjusted, {
          filterRumble,
          boostPresence,
          compressDynamics,
        });
      }

      const { blob, ext } = await exportAudioBuffer(adjusted, outputFormat, 320);
      const baseName = volumeFile.name.replace(/\.[^/.]+$/, "");
      const tag = isNorm ? "normalized" : `gain_${gainPercent}pct`;
      setVolumeResult({
        blob,
        filename: `${baseName}_${tag}_clear.${ext}`,
        duration: adjusted.duration,
        url: URL.createObjectURL(blob),
      });
    } catch (err: any) {
      setError((lang === "en" ? "Volume adjustment failed: " : "音量处理失败: ") + err.message);
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
            {lang === "en" ? "Audio Volume Normalizer & Booster" : "音频音量智能增强与防破音标准化"}
          </h3>
          <p className="text-xs text-coconut-600 dark:text-darkbg-muted mt-1">
            {lang === "en"
              ? "Fix quiet phone recordings, lectures, or interviews. Supports peak normalization (anti-clipping) or manual gain boost."
              : "解决手机录音、网课授课、采访录音声音太小的问题。支持自动峰值标准化（消除破音）或手动倍数放大。"}
          </p>
        </div>

        {!volumeBuffer ? (
          <div
            onClick={() => document.getElementById("volume-upload-input")?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const f = e.dataTransfer.files?.[0];
              if (f) handleVolumeFileSelected(f);
            }}
            className="border-2 border-dashed border-coconut-300 dark:border-darkbg-border hover:border-coconut-500 dark:hover:border-palm-500 rounded-3xl p-10 text-center cursor-pointer transition-all bg-coconut-50/40 dark:bg-darkbg-card"
          >
            <input
              id="volume-upload-input"
              type="file"
              accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac,.aac,.wma"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleVolumeFileSelected(e.target.files[0]);
                }
              }}
              className="hidden"
            />
            <Volume2 className="w-10 h-10 text-toast-500 mx-auto mb-2" />
            <div className="text-xs text-coconut-600 dark:text-darkbg-muted">
              {lang === "en" ? "Click or drag audio file here to adjust volume" : "点击或拖拽上传音频文件调节音量"}
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="p-3 bg-coconut-50/70 dark:bg-darkbg-subtle rounded-2xl border border-coconut-200/70 dark:border-darkbg-border flex items-center justify-between">
              <span className="text-xs font-semibold text-coconut-900 dark:text-darkbg-text truncate">
                {volumeFile?.name}
              </span>
              <button
                onClick={() => {
                  setVolumeBuffer(null);
                  setVolumeFile(null);
                }}
                className="text-xs text-coconut-600 hover:text-coconut-900 dark:text-darkbg-muted dark:hover:text-darkbg-text"
              >
                {lang === "en" ? "Change File" : "更换文件"}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label
                onClick={() => setVolumeMode("normalize")}
                className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                  volumeMode === "normalize"
                    ? "border-palm-600 dark:border-palm-400 bg-palm-50/60 dark:bg-palm-950/30 text-coconut-900 dark:text-darkbg-text ring-2 ring-palm-500/20 shadow-coconut-sm"
                    : "border-coconut-200 dark:border-darkbg-border text-coconut-700 dark:text-darkbg-muted hover:border-coconut-300 dark:hover:border-darkbg-borderLight"
                }`}
              >
                <div className="font-bold text-sm text-coconut-900 dark:text-darkbg-text">
                  {lang === "en" ? "Peak Normalization (Auto Anti-Clipping)" : "自动峰值标准化 (Peak Normalization)"}
                </div>
                <p className="text-xs text-coconut-600 dark:text-darkbg-muted mt-1">
                  {lang === "en"
                    ? "Scans whole track and normalizes to -0.1 dB ceiling, maximizing loudness without any clipping distortion (Recommended)."
                    : "全曲电平扫描并拉满至 -0.1 dB 极限音量，保证声音最大化的同时绝对不破音失真（推荐）。"}
                </p>
              </label>

              <label
                onClick={() => setVolumeMode("gain")}
                className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                  volumeMode === "gain"
                    ? "border-palm-600 dark:border-palm-400 bg-palm-50/60 dark:bg-palm-950/30 text-coconut-900 dark:text-darkbg-text ring-2 ring-palm-500/20 shadow-coconut-sm"
                    : "border-coconut-200 dark:border-darkbg-border text-coconut-700 dark:text-darkbg-muted hover:border-coconut-300 dark:hover:border-darkbg-borderLight"
                }`}
              >
                <div className="flex justify-between items-center font-bold text-sm text-coconut-900 dark:text-darkbg-text">
                  <span>{lang === "en" ? "Manual Volume Adjustment" : "手动音量调节 (衰减与增益)"}</span>
                  <span className="font-mono text-coconut-900 dark:text-toast-400 font-bold text-xs sm:text-sm">
                    {gainPercent}% {gainPercent < 100 ? (lang === "en" ? "(Attenuate)" : "(降低衰减)") : gainPercent === 100 ? (lang === "en" ? "(Original)" : "(原始保持)") : (lang === "en" ? "(Boosted)" : "(增益放大)")}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="300"
                  step="5"
                  value={gainPercent}
                  onChange={(e) => setGainPercent(parseInt(e.target.value))}
                  disabled={volumeMode !== "gain"}
                  className="w-full mt-3 h-2 bg-coconut-200 dark:bg-darkbg-border rounded-lg appearance-none cursor-pointer accent-coconut-700 dark:accent-palm-400"
                />
                <div className="flex justify-between text-[10px] text-coconut-500 dark:text-darkbg-muted mt-1 font-mono">
                  <span>0% (静音)</span>
                  <span>50% (-6dB)</span>
                  <span>100% (原声)</span>
                  <span>200% (+6dB)</span>
                  <span>300% (+9.5dB)</span>
                </div>
              </label>
            </div>

            {/* Voice clarity options */}
            <div className="space-y-3 p-4 bg-coconut-50/60 dark:bg-darkbg-subtle rounded-2xl border border-coconut-200/60 dark:border-darkbg-border">
              <div className="text-xs sm:text-sm font-semibold text-coconut-900 dark:text-darkbg-text flex items-center space-x-1.5">
                <Sparkles className="w-4 h-4 text-toast-500" />
                <span>{lang === "en" ? "Voice Clarity & Acoustic Polish" : "人声清晰度与声学降噪增强"}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="flex items-start space-x-2.5 p-3 rounded-xl bg-white dark:bg-darkbg-card border border-coconut-200 dark:border-darkbg-border cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={filterRumble}
                    onChange={(e) => setFilterRumble(e.target.checked)}
                    className="mt-0.5 rounded accent-palm-600 dark:accent-palm-400"
                  />
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-coconut-900 dark:text-darkbg-text">
                      {lang === "en" ? "De-Rumble (<100Hz)" : "低频滤除 (<100Hz)"}
                    </div>
                    <div className="text-[10px] text-coconut-600 dark:text-darkbg-muted leading-tight">
                      {lang === "en" ? "Cuts AC hum and mic wind rumble" : "滤除空调嗡鸣、桌台碰撞与风噪"}
                    </div>
                  </div>
                </label>

                <label className="flex items-start space-x-2.5 p-3 rounded-xl bg-white dark:bg-darkbg-card border border-coconut-200 dark:border-darkbg-border cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={boostPresence}
                    onChange={(e) => setBoostPresence(e.target.checked)}
                    className="mt-0.5 rounded accent-palm-600 dark:accent-palm-400"
                  />
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-coconut-900 dark:text-darkbg-text">
                      {lang === "en" ? "Presence Boost (+3.5dB)" : "人声清脆 (+3.5dB)"}
                    </div>
                    <div className="text-[10px] text-coconut-600 dark:text-darkbg-muted leading-tight">
                      {lang === "en" ? "Highlights 3kHz speech clarity" : "提亮3000Hz人声泛音，发音更清晰"}
                    </div>
                  </div>
                </label>

                <label className="flex items-start space-x-2.5 p-3 rounded-xl bg-white dark:bg-darkbg-card border border-coconut-200 dark:border-darkbg-border cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={compressDynamics}
                    onChange={(e) => setCompressDynamics(e.target.checked)}
                    className="mt-0.5 rounded accent-palm-600 dark:accent-palm-400"
                  />
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-coconut-900 dark:text-darkbg-text">
                      {lang === "en" ? "Dynamic Compressor" : "广播动态压缩"}
                    </div>
                    <div className="text-[10px] text-coconut-600 dark:text-darkbg-muted leading-tight">
                      {lang === "en" ? "Balances quiet and loud spoken parts" : "自动压低大声、提升细语，音量均衡"}
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Live A/B Comparison Player */}
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
                      <span>{lang === "en" ? "Preview Live Audio" : "实时试听播放"}</span>
                    </>
                  )}
                </button>

                <div className="flex items-center bg-coconut-200/60 dark:bg-darkbg-elevated p-1 rounded-xl text-xs">
                  <button
                    type="button"
                    onClick={() => switchPreviewAB("effect")}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                      previewAB === "effect"
                        ? "bg-white dark:bg-zinc-800 text-coconut-900 dark:text-darkbg-text shadow-xs"
                        : "text-coconut-600 dark:text-darkbg-muted"
                    }`}
                  >
                    {lang === "en" ? "B: Processed" : "B: 效果音"}
                  </button>
                  <button
                    type="button"
                    onClick={() => switchPreviewAB("original")}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                      previewAB === "original"
                        ? "bg-white dark:bg-zinc-800 text-coconut-900 dark:text-darkbg-text shadow-xs"
                        : "text-coconut-600 dark:text-darkbg-muted"
                    }`}
                  >
                    {lang === "en" ? "A: Original" : "A: 原始原声"}
                  </button>
                </div>
              </div>

              <span className="text-[11px] text-coconut-500 dark:text-darkbg-muted font-mono">
                {isPlaying
                  ? (previewAB === "effect" ? "🎧 试听中: 调节后增益效果" : "🎧 试听中: 原始未处理音质")
                  : "💡 支持播放中即时 A/B 无缝切换对比"}
              </span>
            </div>

            {/* Export and Format Selector */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center space-x-2.5 text-sm">
                <span className="text-coconut-900 dark:text-darkbg-text font-bold text-xs sm:text-sm">
                  {lang === "en" ? "Export Format:" : "导出格式:"}
                </span>
                {(["mp3", "wav"] as const).map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => setOutputFormat(fmt)}
                    className={`px-3 py-1.5 rounded-xl font-bold uppercase transition-all active:scale-95 text-xs ${
                      outputFormat === fmt
                        ? "bg-coconut-800 text-coconut-50 dark:bg-white dark:text-zinc-950 shadow-sm"
                        : "bg-coconut-100/70 dark:bg-darkbg-subtle text-coconut-700 dark:text-darkbg-muted hover:dark:text-darkbg-text border border-transparent dark:border-darkbg-border"
                    }`}
                  >
                    {fmt === "mp3" ? "MP3 (320k)" : "WAV (无损)"}
                  </button>
                ))}
              </div>

              <button
                onClick={handleExecuteVolume}
                disabled={isProcessing}
                className={`px-6 py-3 rounded-2xl text-xs font-bold flex items-center space-x-2 transition-all ${
                  isProcessing
                    ? "bg-coconut-100 dark:bg-darkbg-subtle text-coconut-400 dark:text-darkbg-muted cursor-not-allowed border border-coconut-200 dark:border-darkbg-border"
                    : "btn-3d-sunset text-white"
                }`}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{lang === "en" ? "Applying enhancement..." : "正在处理增强..."}</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-4 h-4" />
                    <span>{lang === "en" ? "Enhance & Export" : "开始处理并导出"}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Volume result card */}
      {volumeResult && (
        <div className="coconut-panel p-5 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between pb-3 border-b border-coconut-100 dark:border-darkbg-border">
            <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
              <CheckCircle2 className="w-4 h-4" />
              <span>{lang === "en" ? "Audio Enhancement Complete!" : "音量与人声增强完成！"}</span>
            </div>
            <div className="flex items-center space-x-2">
              <SendToButton
                compact
                category="audio"
                payload={{
                  blob: volumeResult.blob,
                  filename: volumeResult.filename,
                  sourceTitle: lang === "en" ? "Audio Enhance" : "音量增强",
                }}
                lang={lang}
              />
              <button
                onClick={() => downloadBlob(volumeResult.blob, volumeResult.filename)}
                className="px-4 py-2 btn-3d-sunset text-white rounded-xl text-xs font-bold flex items-center space-x-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{lang === "en" ? "Download Enhanced Audio" : "立即下载增强音频"}</span>
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs text-coconut-700 dark:text-darkbg-text font-mono">
              <span className="truncate max-w-[280px] sm:max-w-md font-semibold">{volumeResult.filename}</span>
              <span>{formatDuration(volumeResult.duration)} · {formatBytes(volumeResult.blob.size)}</span>
            </div>
            <audio controls src={volumeResult.url} className="w-full h-10 rounded-lg" />
          </div>
        </div>
      )}
    </div>
  );
}
