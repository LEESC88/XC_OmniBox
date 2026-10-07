"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Scissors,
  Play,
  Pause,
  RotateCcw,
  Download,
  Loader2,
  UploadCloud,
  FileAudio,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";
import {
  decodeAudioFile,
  extractAudioPeaks,
  trimAudioBuffer,
  exportAudioBuffer,
  formatDuration,
  getAudioContext,
} from "@/lib/audioProcessor";
import { formatBytes } from "@/lib/imageProcessor";
import { downloadBlob } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import SendToButton from "@/components/SendToButton";
import { AudioStudioProps } from "./types";

export default function AudioTrimStudio({
  isActive = true,
  incomingFile,
  onIncomingFileHandled,
}: AudioStudioProps) {
  const { lang } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");

  const [trimFile, setTrimFile] = useState<File | null>(null);
  const [trimBuffer, setTrimBuffer] = useState<AudioBuffer | null>(null);
  const [peaks, setPeaks] = useState<number[]>([]);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(30);
  const [fadeIn, setFadeIn] = useState(0);
  const [fadeOut, setFadeOut] = useState(0);
  const [trimFormat, setTrimFormat] = useState<"mp3" | "wav">("mp3");
  const [trimKbps, setTrimKbps] = useState(320);
  const [trimResult, setTrimResult] = useState<{ blob: Blob; filename: string; duration: number; url: string } | null>(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [loopSelection, setLoopSelection] = useState(false);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const playStartTimeRef = useRef(0);
  const playStartOffsetRef = useRef(0);
  const animFrameRef = useRef<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDraggingHandle, setIsDraggingHandle] = useState<"start" | "end" | null>(null);

  const stopPlayback = () => {
    if (activeSourceRef.current) {
      try {
        activeSourceRef.current.stop();
      } catch (e) {}
      activeSourceRef.current = null;
    }
    setIsPlaying(false);
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  };

  // Edge Case 1: Stop playback and clean up audio node whenever tab is deactivated or component unmounts
  useEffect(() => {
    if (!isActive) {
      stopPlayback();
      setError(null);
    }
  }, [isActive]);

  useEffect(() => {
    return () => {
      stopPlayback();
      if (trimResult?.url) {
        URL.revokeObjectURL(trimResult.url);
      }
    };
  }, [trimResult?.url]);

  // Edge Case 2: Ingest external incomingFile safely
  useEffect(() => {
    if (isActive && incomingFile) {
      handleTrimFileSelected(incomingFile);
      onIncomingFileHandled?.();
    }
  }, [isActive, incomingFile]);

  // Load and decode audio file
  const handleTrimFileSelected = async (file: File) => {
    stopPlayback();
    setTrimFile(file);
    setIsProcessing(true);
    setProgressMsg(lang === "en" ? "Parsing and generating waveform..." : "正在解析并生成音频波形...");
    setError(null);

    try {
      const buffer = await decodeAudioFile(file);
      setTrimBuffer(buffer);
      const extracted = extractAudioPeaks(buffer, 350);
      setPeaks(extracted);
      setStartTime(0);
      setEndTime(Math.min(30, buffer.duration));
      setCurrentTime(0);
    } catch (err: any) {
      setError(err.message || (lang === "en" ? "Failed to load audio file" : "加载音频文件失败"));
    } finally {
      setIsProcessing(false);
      setProgressMsg("");
    }
  };

  // Play/pause selected range
  const togglePlaySelection = () => {
    if (!trimBuffer) return;

    if (isPlaying) {
      stopPlayback();
      return;
    }

    const ctx = getAudioContext();
    if (ctx.state === "suspended") {
      ctx.resume();
    }

    const source = ctx.createBufferSource();
    source.buffer = trimBuffer;
    source.connect(ctx.destination);

    const offset = currentTime >= startTime && currentTime < endTime ? currentTime : startTime;
    const duration = endTime - offset;

    source.start(0, offset, duration);
    activeSourceRef.current = source;
    playStartTimeRef.current = ctx.currentTime;
    playStartOffsetRef.current = offset;
    setIsPlaying(true);

    source.onended = () => {
      if (loopSelection) {
        setCurrentTime(startTime);
        togglePlaySelection();
      } else {
        setIsPlaying(false);
        setCurrentTime(startTime);
      }
    };

    const updatePlayhead = () => {
      if (!isPlaying && !activeSourceRef.current) return;
      const elapsed = ctx.currentTime - playStartTimeRef.current;
      const cur = playStartOffsetRef.current + elapsed;
      if (cur <= endTime) {
        setCurrentTime(cur);
        animFrameRef.current = requestAnimationFrame(updatePlayhead);
      } else {
        setCurrentTime(endTime);
      }
    };
    animFrameRef.current = requestAnimationFrame(updatePlayhead);
  };

  // Render waveform onto Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !trimBuffer || peaks.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    const duration = trimBuffer.duration;
    const startX = (startTime / duration) * width;
    const endX = (endTime / duration) * width;
    const playheadX = (currentTime / duration) * width;

    // 1. Draw unselected background waveform
    const barWidth = width / peaks.length;
    const centerY = height / 2;

    peaks.forEach((peak, i) => {
      const x = i * barWidth;
      const barH = Math.max(2, peak * (height * 0.8));
      const inSelection = x >= startX && x <= endX;

      ctx.fillStyle = inSelection ? "#3b82f6" : "rgba(148, 163, 184, 0.4)";
      ctx.fillRect(x, centerY - barH / 2, Math.max(1, barWidth - 1), barH);
    });

    // 2. Selection highlight mask
    ctx.fillStyle = "rgba(59, 130, 246, 0.08)";
    ctx.fillRect(startX, 0, endX - startX, height);

    // 3. Left handle
    ctx.fillStyle = "#2563eb";
    ctx.fillRect(startX - 2, 0, 4, height);
    ctx.beginPath();
    ctx.arc(startX, 12, 6, 0, Math.PI * 2);
    ctx.fill();

    // 4. Right handle
    ctx.fillRect(endX - 2, 0, 4, height);
    ctx.beginPath();
    ctx.arc(endX, height - 12, 6, 0, Math.PI * 2);
    ctx.fill();

    // 5. Playhead
    if (playheadX >= 0 && playheadX <= width) {
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(playheadX - 1, 0, 2, height);
    }
  }, [trimBuffer, peaks, startTime, endTime, currentTime]);

  // Waveform mouse drag handlers
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !trimBuffer) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const duration = trimBuffer.duration;

    const startX = (startTime / duration) * width;
    const endX = (endTime / duration) * width;

    if (Math.abs(clickX - startX) < 14) {
      setIsDraggingHandle("start");
    } else if (Math.abs(clickX - endX) < 14) {
      setIsDraggingHandle("end");
    } else {
      const clickTime = Math.max(0, Math.min(duration, (clickX / width) * duration));
      setCurrentTime(clickTime);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingHandle || !canvasRef.current || !trimBuffer) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const moveX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const newTime = (moveX / rect.width) * trimBuffer.duration;

    if (isDraggingHandle === "start") {
      setStartTime(Math.min(newTime, endTime - 0.5));
    } else if (isDraggingHandle === "end") {
      setEndTime(Math.max(newTime, startTime + 0.5));
    }
  };

  const handleCanvasMouseUp = () => {
    setIsDraggingHandle(null);
  };

  // Export trimmed audio
  const handleExportTrim = async () => {
    if (!trimBuffer || !trimFile) return;
    setIsProcessing(true);
    setProgressMsg(lang === "en" ? "Trimming and encoding audio..." : "正在裁剪并无损编码音频...");
    setError(null);

    try {
      const sliced = trimAudioBuffer(trimBuffer, startTime, endTime, fadeIn, fadeOut);
      const { blob, ext } = await exportAudioBuffer(sliced, trimFormat, trimKbps);
      const baseName = trimFile.name.replace(/\.[^/.]+$/, "");
      const outputFilename = `${baseName}_cut_${formatDuration(startTime).replace(":", "m")}-${formatDuration(
        endTime
      ).replace(":", "m")}.${ext}`;
      setTrimResult({
        blob,
        filename: outputFilename,
        duration: Math.max(0.1, +(endTime - startTime).toFixed(1)),
        url: URL.createObjectURL(blob),
      });
    } catch (err: any) {
      setError((lang === "en" ? "Trim export failed: " : "裁剪导出失败: ") + err.message);
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

      {!trimBuffer ? (
        <div
          onClick={() => document.getElementById("audio-trim-upload")?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
              handleTrimFileSelected(e.dataTransfer.files[0]);
            }
          }}
          className="group relative overflow-hidden border-2 border-dashed border-[#D2BCAB]/70 dark:border-[#4D392E]/60 hover:border-amber-500/70 dark:hover:border-amber-500/70 bg-gradient-to-b from-[#FBF8F4]/80 to-[#F5ECE1]/60 dark:from-[#211713]/70 dark:to-[#18110D]/70 hover:from-[#FFFDF9] hover:to-[#FDF4EB] dark:hover:from-[#291D17] dark:hover:to-[#1F1511] rounded-3xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-300 shadow-sm hover:shadow-lg hover:shadow-amber-900/5 select-none"
        >
          <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[radial-gradient(circle_at_50%_40%,rgba(245,158,11,0.08),transparent_65%)]" />
          <input
            id="audio-trim-upload"
            type="file"
            accept="audio/*"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleTrimFileSelected(e.target.files[0]);
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
                {lang === "en" ? "Click or drag audio file here to trim" : "点击或拖拽上传音频文件进行波形剪辑"}
              </div>
              <div className="text-xs text-coconut-600 dark:text-darkbg-muted mt-1 max-w-md mx-auto">
                {lang === "en"
                  ? "Supports MP3, WAV, FLAC, AAC, M4A, OGG and other audio formats"
                  : "支持 MP3, WAV, FLAC, AAC, M4A, OGG 等全部音乐格式"}
              </div>
            </div>
            <div className="flex items-center flex-wrap justify-center gap-2 pt-1 text-[11px] font-medium text-coconut-600 dark:text-darkbg-muted">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-coconut-100/70 dark:bg-darkbg-card border border-coconut-200/80 dark:border-darkbg-border">
                ⚡ WebAudio 毫秒级波形
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                100% 本地沙盒保密
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="coconut-panel p-5 sm:p-6 space-y-6">
          {/* File info and change audio */}
          <div className="flex items-center justify-between pb-4 border-b border-coconut-200/60 dark:border-darkbg-border">
            <div className="space-y-0.5">
              <div className="font-bold text-base text-coconut-900 dark:text-darkbg-text flex items-center space-x-2">
                <FileAudio className="w-5 h-5 text-toast-500" />
                <span>{trimFile?.name}</span>
              </div>
              <div className="text-xs text-coconut-600 dark:text-darkbg-muted font-mono">
                {lang === "en" ? "Duration: " : "总时长: "}
                {formatDuration(trimBuffer.duration)} · {lang === "en" ? "Sample Rate: " : "采样率: "}
                {trimBuffer.sampleRate} Hz · {lang === "en" ? "Channels: " : "声道: "}
                {trimBuffer.numberOfChannels}
              </div>
            </div>
            <button
              onClick={() => {
                stopPlayback();
                setTrimBuffer(null);
                setTrimFile(null);
              }}
              className="px-3.5 py-1.5 rounded-xl border border-coconut-200 dark:border-darkbg-border text-xs font-semibold text-coconut-700 dark:text-darkbg-muted hover:bg-coconut-100/60 dark:hover:bg-darkbg-elevated hover:dark:text-darkbg-text"
            >
              {lang === "en" ? "Change Audio" : "更换音频"}
            </button>
          </div>

          {/* Interactive waveform canvas */}
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs sm:text-sm text-coconut-600 dark:text-darkbg-muted font-mono bg-coconut-100/50 dark:bg-darkbg-subtle/50 p-2.5 rounded-xl border border-coconut-200/50 dark:border-darkbg-border">
              <div className="flex items-center space-x-1.5 flex-wrap gap-1">
                <span className="font-semibold text-coconut-900 dark:text-darkbg-text">
                  {lang === "en" ? `Start: ${formatDuration(startTime)}` : `起点: ${formatDuration(startTime)}`}
                </span>
                <div className="inline-flex rounded-lg border border-coconut-200 dark:border-darkbg-border overflow-hidden">
                  <button
                    onClick={() => setStartTime(Math.max(0, +(startTime - 0.5).toFixed(2)))}
                    className="px-1.5 py-0.5 hover:bg-coconut-200 dark:hover:bg-darkbg-hover text-[10px]"
                    title="-0.5s"
                  >
                    -0.5s
                  </button>
                  <button
                    onClick={() => setStartTime(Math.max(0, +(startTime - 0.1).toFixed(2)))}
                    className="px-1.5 py-0.5 hover:bg-coconut-200 dark:hover:bg-darkbg-hover text-[10px] border-l border-coconut-200 dark:border-darkbg-border"
                    title="-0.1s"
                  >
                    -0.1s
                  </button>
                  <button
                    onClick={() => setStartTime(Math.min(endTime - 0.1, +(startTime + 0.1).toFixed(2)))}
                    className="px-1.5 py-0.5 hover:bg-coconut-200 dark:hover:bg-darkbg-hover text-[10px] border-l border-coconut-200 dark:border-darkbg-border"
                    title="+0.1s"
                  >
                    +0.1s
                  </button>
                  <button
                    onClick={() => setStartTime(Math.min(endTime - 0.5, +(startTime + 0.5).toFixed(2)))}
                    className="px-1.5 py-0.5 hover:bg-coconut-200 dark:hover:bg-darkbg-hover text-[10px] border-l border-coconut-200 dark:border-darkbg-border"
                    title="+0.5s"
                  >
                    +0.5s
                  </button>
                </div>
              </div>

              <span className="text-coconut-900 dark:text-toast-400 font-bold self-center">
                {lang === "en"
                  ? `Selection: ${formatDuration(endTime - startTime)}`
                  : `截取时长: ${formatDuration(endTime - startTime)}`}
              </span>

              <div className="flex items-center space-x-1.5 justify-end flex-wrap gap-1">
                <span className="font-semibold text-coconut-900 dark:text-darkbg-text">
                  {lang === "en" ? `End: ${formatDuration(endTime)}` : `终点: ${formatDuration(endTime)}`}
                </span>
                <div className="inline-flex rounded-lg border border-coconut-200 dark:border-darkbg-border overflow-hidden">
                  <button
                    onClick={() => setEndTime(Math.max(startTime + 0.5, +(endTime - 0.5).toFixed(2)))}
                    className="px-1.5 py-0.5 hover:bg-coconut-200 dark:hover:bg-darkbg-hover text-[10px]"
                    title="-0.5s"
                  >
                    -0.5s
                  </button>
                  <button
                    onClick={() => setEndTime(Math.max(startTime + 0.1, +(endTime - 0.1).toFixed(2)))}
                    className="px-1.5 py-0.5 hover:bg-coconut-200 dark:hover:bg-darkbg-hover text-[10px] border-l border-coconut-200 dark:border-darkbg-border"
                    title="-0.1s"
                  >
                    -0.1s
                  </button>
                  <button
                    onClick={() => setEndTime(Math.min(trimBuffer.duration, +(endTime + 0.1).toFixed(2)))}
                    className="px-1.5 py-0.5 hover:bg-coconut-200 dark:hover:bg-darkbg-hover text-[10px] border-l border-coconut-200 dark:border-darkbg-border"
                    title="+0.1s"
                  >
                    +0.1s
                  </button>
                  <button
                    onClick={() => setEndTime(Math.min(trimBuffer.duration, +(endTime + 0.5).toFixed(2)))}
                    className="px-1.5 py-0.5 hover:bg-coconut-200 dark:hover:bg-darkbg-hover text-[10px] border-l border-coconut-200 dark:border-darkbg-border"
                    title="+0.5s"
                  >
                    +0.5s
                  </button>
                </div>
              </div>
            </div>

            <div className="relative w-full h-36 bg-[#0E0C0A] rounded-2xl overflow-hidden cursor-crosshair border border-coconut-900/60 dark:border-darkbg-border shadow-inner">
              <canvas
                ref={canvasRef}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                className="w-full h-full"
              />
            </div>
            <p className="text-xs text-coconut-600 dark:text-darkbg-muted text-center leading-relaxed">
              {lang === "en"
                ? "💡 Drag the highlighted handles at both ends to change start/end; click anywhere on waveform to preview"
                : "💡 拖动两端高亮滑块可直接改变截取起点与终点；点击波形内部任意处可直接跳到该位置试听"}
            </p>
          </div>

          {/* Quick presets */}
          <div className="flex items-center space-x-2.5 text-xs sm:text-sm flex-wrap gap-y-2">
            <span className="text-coconut-900 dark:text-darkbg-text font-semibold">
              {lang === "en" ? "Quick Ringtone Length:" : "快捷铃声长度:"}
            </span>
            {[
              { label: lang === "en" ? "First 15s" : "前 15 秒", s: 0, e: 15 },
              { label: lang === "en" ? "First 30s (Rec)" : "前 30 秒 (推荐)", s: 0, e: 30 },
              { label: lang === "en" ? "First 60s" : "前 60 秒", s: 0, e: 60 },
              { label: lang === "en" ? "Select All" : "全选", s: 0, e: trimBuffer.duration },
            ].map((preset) => (
              <button
                key={preset.label}
                onClick={() => {
                  setStartTime(preset.s);
                  setEndTime(Math.min(preset.e, trimBuffer.duration));
                  setCurrentTime(preset.s);
                }}
                className="px-3.5 py-1.5 bg-coconut-100/80 dark:bg-darkbg-subtle hover:bg-coconut-200/80 dark:hover:bg-darkbg-hover text-coconut-900 dark:text-darkbg-text border border-transparent dark:border-darkbg-border rounded-xl font-semibold transition-all active:scale-95"
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Playback & Fade Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-5 sm:p-6 bg-coconut-50/70 dark:bg-darkbg-subtle rounded-2xl border border-coconut-200/70 dark:border-darkbg-border">
            {/* Playback Controls */}
            <div className="flex items-center space-x-4">
              <button
                onClick={togglePlaySelection}
                className="w-12 h-12 rounded-full bg-gradient-to-r from-coconut-800 to-coconut-950 dark:from-white dark:to-zinc-100 text-coconut-50 dark:text-zinc-950 flex items-center justify-center shadow-coconut-md transition-all active:scale-95"
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </button>
              <div className="space-y-1">
                <div className="font-bold text-sm sm:text-base text-coconut-900 dark:text-darkbg-text">
                  {isPlaying
                    ? lang === "en"
                      ? "Playing selection..."
                      : "正在试听选区..."
                    : lang === "en"
                    ? "Play Selection"
                    : "试听选中片段"}
                </div>
                <div className="flex items-center space-x-3 text-xs sm:text-sm text-coconut-600 dark:text-darkbg-muted">
                  <label className="flex items-center space-x-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={loopSelection}
                      onChange={(e) => setLoopSelection(e.target.checked)}
                      className="rounded accent-palm-600 dark:accent-palm-400"
                    />
                    <span>{lang === "en" ? "Loop" : "循环试听"}</span>
                  </label>
                  <button
                    onClick={() => {
                      stopPlayback();
                      setCurrentTime(startTime);
                    }}
                    className="hover:text-palm-600 dark:hover:text-palm-400 flex items-center space-x-0.5"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>{lang === "en" ? "Restart" : "重头播放"}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Fade In & Out Controls */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs sm:text-sm text-coconut-900 dark:text-darkbg-text font-semibold">
                  <span>{lang === "en" ? "Fade In" : "开头淡入"}</span>
                  <span className="font-mono font-bold text-toast-500">{fadeIn}s</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.5"
                  value={fadeIn}
                  onChange={(e) => setFadeIn(parseFloat(e.target.value))}
                  className="w-full h-2 bg-coconut-200 dark:bg-darkbg-border rounded-lg appearance-none cursor-pointer accent-coconut-700 dark:accent-palm-400"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs sm:text-sm text-coconut-900 dark:text-darkbg-text font-semibold">
                  <span>{lang === "en" ? "Fade Out" : "结尾淡出"}</span>
                  <span className="font-mono font-bold text-toast-500">{fadeOut}s</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.5"
                  value={fadeOut}
                  onChange={(e) => setFadeOut(parseFloat(e.target.value))}
                  className="w-full h-2 bg-coconut-200 dark:bg-darkbg-border rounded-lg appearance-none cursor-pointer accent-coconut-700 dark:accent-palm-400"
                />
              </div>
            </div>
          </div>

          {/* Export config & Action button */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <div className="flex items-center space-x-3 text-sm">
              <span className="text-coconut-900 dark:text-darkbg-text font-bold">
                {lang === "en" ? "Export Format:" : "导出格式:"}
              </span>
              <div className="flex space-x-1.5">
                {(["mp3", "wav"] as const).map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => setTrimFormat(fmt)}
                    className={`px-3.5 py-1.5 rounded-xl font-bold uppercase transition-all active:scale-95 text-xs sm:text-sm ${
                      trimFormat === fmt
                        ? "bg-coconut-800 text-coconut-50 dark:bg-white dark:text-zinc-950 font-bold shadow-sm"
                        : "bg-coconut-100/80 dark:bg-darkbg-subtle text-coconut-700 dark:text-darkbg-muted hover:dark:text-darkbg-text border border-transparent dark:border-darkbg-border"
                    }`}
                  >
                    {fmt}
                  </button>
                ))}
              </div>

              {trimFormat === "mp3" && (
                <select
                  value={trimKbps}
                  onChange={(e) => setTrimKbps(parseInt(e.target.value))}
                  className="px-3.5 py-2 bg-white/70 dark:bg-darkbg-subtle border border-coconut-300/80 dark:border-darkbg-border rounded-xl font-mono text-sm text-coconut-900 dark:text-darkbg-text focus:outline-none focus:border-palm-500 shadow-2xs"
                >
                  <option value={320} className="dark:bg-darkbg-card dark:text-darkbg-text">
                    {lang === "en" ? "320 kbps (Highest Quality)" : "320 kbps (最高品质)"}
                  </option>
                  <option value={256} className="dark:bg-darkbg-card dark:text-darkbg-text">
                    {lang === "en" ? "256 kbps (High Fidelity)" : "256 kbps (高保真)"}
                  </option>
                  <option value={192} className="dark:bg-darkbg-card dark:text-darkbg-text">
                    {lang === "en" ? "192 kbps (Standard Music)" : "192 kbps (标准音乐)"}
                  </option>
                  <option value={128} className="dark:bg-darkbg-card dark:text-darkbg-text">
                    {lang === "en" ? "128 kbps (Compact Size)" : "128 kbps (省流小体积)"}
                  </option>
                </select>
              )}
            </div>

            <button
              onClick={handleExportTrim}
              data-primary-action="true"
              disabled={isProcessing}
              className={`w-full sm:w-auto px-7 py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center space-x-2 transition-all ${
                isProcessing
                  ? "bg-coconut-100 dark:bg-darkbg-subtle text-coconut-400 dark:text-darkbg-muted cursor-not-allowed border border-coconut-200 dark:border-darkbg-border"
                  : "btn-3d-sunset text-white"
              }`}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{lang === "en" ? "Exporting..." : "处理导出中..."}</span>
                </>
              ) : (
                <>
                  <Scissors className="w-4 h-4" />
                  <span>{lang === "en" ? "Export Trimmed Audio" : "立即导出截取音频"}</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Result preview & Download card */}
      {trimResult && (
        <div className="coconut-panel p-5 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between pb-3 border-b border-coconut-100 dark:border-darkbg-border">
            <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
              <CheckCircle2 className="w-4 h-4" />
              <span>{lang === "en" ? "Trimming Complete!" : "音频截取成功！"}</span>
            </div>
            <div className="flex items-center space-x-2">
              <SendToButton
                compact
                category="audio"
                payload={{
                  blob: trimResult.blob,
                  filename: trimResult.filename,
                  sourceTitle: lang === "en" ? "Audio Trim" : "音频截取",
                }}
                lang={lang}
              />
              <button
                onClick={() => downloadBlob(trimResult.blob, trimResult.filename)}
                data-download-result="true"
                className="px-4 py-2 btn-3d-sunset text-white rounded-xl text-xs font-bold flex items-center space-x-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{lang === "en" ? "Download Trimmed Audio" : "立即下载截取音频"}</span>
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs text-coconut-700 dark:text-darkbg-text font-mono">
              <span className="truncate max-w-[280px] sm:max-w-md font-semibold">{trimResult.filename}</span>
              <span>{formatDuration(trimResult.duration)} · {formatBytes(trimResult.blob.size)}</span>
            </div>
            <audio controls src={trimResult.url} className="w-full h-10 rounded-lg" />
          </div>
        </div>
      )}
    </div>
  );
}
