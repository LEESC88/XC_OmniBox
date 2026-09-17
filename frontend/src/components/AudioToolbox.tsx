"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Scissors,
  RefreshCw,
  Combine,
  Film,
  Volume2,
  Play,
  Pause,
  RotateCcw,
  Download,
  Loader2,
  UploadCloud,
  FileAudio,
  Trash2,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Archive,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Clock,
  Music,
} from "lucide-react";
import {
  decodeAudioFile,
  extractAudioPeaks,
  trimAudioBuffer,
  concatAudioBuffers,
  adjustVolumeAndNormalize,
  exportAudioBuffer,
  formatDuration,
  getAudioContext,
} from "@/lib/audioProcessor";
import { formatBytes } from "@/lib/imageProcessor";
import { createZipBundle } from "@/lib/imageProcessor";
import { downloadBlob } from "@/lib/api";

type AudioToolTab = "trim" | "convert" | "merge" | "extract" | "volume";

interface MergeTrack {
  id: string;
  file: File;
  name: string;
  size: number;
  duration?: number;
  buffer?: AudioBuffer;
}

interface AudioResult {
  id: string;
  originalName: string;
  originalSize: number;
  newFilename: string;
  newSize: number;
  blob: Blob;
  duration: number;
}

export interface AudioToolboxProps {
  currentTab?: AudioToolTab;
  onTabChange?: (tab: AudioToolTab) => void;
}

export default function AudioToolbox({ currentTab, onTabChange }: AudioToolboxProps = {}) {
  const [activeTab, setActiveTab] = useState<AudioToolTab>(currentTab || "trim");
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");

  useEffect(() => {
    if (currentTab && currentTab !== activeTab) {
      setActiveTab(currentTab);
      setError(null);
    }
  }, [currentTab]);

  const handleTabSelect = (tab: AudioToolTab) => {
    setActiveTab(tab);
    setError(null);
    onTabChange?.(tab);
  };

  // ================= 1. 波形剪辑状态 =================
  const [trimFile, setTrimFile] = useState<File | null>(null);
  const [trimBuffer, setTrimBuffer] = useState<AudioBuffer | null>(null);
  const [peaks, setPeaks] = useState<number[]>([]);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(30);
  const [fadeIn, setFadeIn] = useState(0);
  const [fadeOut, setFadeOut] = useState(0);
  const [trimFormat, setTrimFormat] = useState<"mp3" | "wav">("mp3");
  const [trimKbps, setTrimKbps] = useState(320);

  // 播放状态
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [loopSelection, setLoopSelection] = useState(false);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const playStartTimeRef = useRef(0);
  const playStartOffsetRef = useRef(0);
  const animFrameRef = useRef<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDraggingHandle, setIsDraggingHandle] = useState<"start" | "end" | null>(null);

  // ================= 2. 格式转码状态 =================
  const [convertFiles, setConvertFiles] = useState<File[]>([]);
  const [convertTargetFormat, setConvertTargetFormat] = useState<"mp3" | "wav">("mp3");
  const [convertKbps, setConvertKbps] = useState(320);
  const [convertResults, setConvertResults] = useState<AudioResult[]>([]);

  // ================= 3. 音频合并状态 =================
  const [mergeTracks, setMergeTracks] = useState<MergeTrack[]>([]);
  const [mergeFormat, setMergeFormat] = useState<"mp3" | "wav">("mp3");
  const [mergeKbps, setMergeKbps] = useState(320);

  // ================= 4. 视频提取音频状态 =================
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [extractFormat, setExtractFormat] = useState<"mp3" | "wav">("mp3");
  const [extractKbps, setExtractKbps] = useState(320);

  // ================= 5. 音量调节状态 =================
  const [volumeFile, setVolumeFile] = useState<File | null>(null);
  const [volumeBuffer, setVolumeBuffer] = useState<AudioBuffer | null>(null);
  const [volumeMode, setVolumeMode] = useState<"normalize" | "gain">("normalize");
  const [gainPercent, setGainPercent] = useState(150); // 150%

  // 停止播放辅助
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

  // 切换选项卡时停止声音
  useEffect(() => {
    stopPlayback();
    setError(null);
  }, [activeTab]);

  // 组件卸载时释放
  useEffect(() => {
    return () => {
      stopPlayback();
    };
  }, []);

  // --- 加载剪辑音频 ---
  const handleTrimFileSelected = async (file: File) => {
    stopPlayback();
    setTrimFile(file);
    setIsProcessing(true);
    setProgressMsg("正在解析并生成音频波形...");
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
      setError(err.message || "加载音频文件失败");
    } finally {
      setIsProcessing(false);
      setProgressMsg("");
    }
  };

  // --- 播放 / 暂停选区 ---
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

    // 游标推进动画
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

  // --- 绘制波形 Canvas ---
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

    // 1. 绘制暗色背景波形 (未选中区域)
    const barWidth = width / peaks.length;
    const centerY = height / 2;

    peaks.forEach((peak, i) => {
      const x = i * barWidth;
      const barH = Math.max(2, peak * (height * 0.8));
      const inSelection = x >= startX && x <= endX;

      ctx.fillStyle = inSelection ? "#3b82f6" : "rgba(148, 163, 184, 0.4)";
      ctx.fillRect(x, centerY - barH / 2, Math.max(1, barWidth - 1), barH);
    });

    // 2. 选区高亮遮罩
    ctx.fillStyle = "rgba(59, 130, 246, 0.08)";
    ctx.fillRect(startX, 0, endX - startX, height);

    // 3. 左滑块
    ctx.fillStyle = "#2563eb";
    ctx.fillRect(startX - 2, 0, 4, height);
    ctx.beginPath();
    ctx.arc(startX, 12, 6, 0, Math.PI * 2);
    ctx.fill();

    // 4. 右滑块
    ctx.fillRect(endX - 2, 0, 4, height);
    ctx.beginPath();
    ctx.arc(endX, height - 12, 6, 0, Math.PI * 2);
    ctx.fill();

    // 5. 播放游标
    if (playheadX >= 0 && playheadX <= width) {
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(playheadX - 1, 0, 2, height);
    }
  }, [trimBuffer, peaks, startTime, endTime, currentTime]);

  // --- 波形鼠标拖拽选区交互 ---
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
      // 点击直接跳定位并播放
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

  // --- 执行剪辑导出 ---
  const handleExportTrim = async () => {
    if (!trimBuffer || !trimFile) return;
    setIsProcessing(true);
    setProgressMsg("正在裁剪并无损编码音频...");
    setError(null);

    try {
      const sliced = trimAudioBuffer(trimBuffer, startTime, endTime, fadeIn, fadeOut);
      const { blob, ext } = await exportAudioBuffer(sliced, trimFormat, trimKbps);
      const baseName = trimFile.name.replace(/\.[^/.]+$/, "");
      const outputFilename = `${baseName}_cut_${formatDuration(startTime).replace(":", "m")}-${formatDuration(
        endTime
      ).replace(":", "m")}.${ext}`;
      downloadBlob(blob, outputFilename);
    } catch (err: any) {
      setError("裁剪导出失败: " + err.message);
    } finally {
      setIsProcessing(false);
      setProgressMsg("");
    }
  };

  // ================= 2. 格式批量转码 =================
  const handleExecuteConvert = async () => {
    if (convertFiles.length === 0) return;
    setIsProcessing(true);
    setError(null);
    const results: AudioResult[] = [];

    try {
      for (let i = 0; i < convertFiles.length; i++) {
        const file = convertFiles[i];
        setProgressMsg(`正在转码 (${i + 1}/${convertFiles.length}): ${file.name}`);
        const buffer = await decodeAudioFile(file);
        const { blob, ext } = await exportAudioBuffer(buffer, convertTargetFormat, convertKbps);
        const baseName = file.name.replace(/\.[^/.]+$/, "");
        results.push({
          id: `conv_${Date.now()}_${i}`,
          originalName: file.name,
          originalSize: file.size,
          newFilename: `${baseName}.${ext}`,
          newSize: blob.size,
          blob,
          duration: buffer.duration,
        });
      }
      setConvertResults(results);
    } catch (err: any) {
      setError("批量格式转码失败: " + err.message);
    } finally {
      setIsProcessing(false);
      setProgressMsg("");
    }
  };

  // ================= 3. 音频多段拼接 =================
  const handleAddMergeTracks = async (files: FileList | null) => {
    if (!files) return;
    setIsProcessing(true);
    setProgressMsg("正在解析音轨数据...");
    const incoming: MergeTrack[] = [];

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      try {
        const buf = await decodeAudioFile(f);
        incoming.push({
          id: `track_${Date.now()}_${Math.random()}`,
          file: f,
          name: f.name,
          size: f.size,
          duration: buf.duration,
          buffer: buf,
        });
      } catch (err) {
        console.error("加载片段失败", f.name);
      }
    }

    setMergeTracks((prev) => [...prev, ...incoming]);
    setIsProcessing(false);
    setProgressMsg("");
  };

  const handleExecuteMerge = async () => {
    if (mergeTracks.length < 2) {
      setError("请至少添加两个音频片段进行拼接");
      return;
    }
    setIsProcessing(true);
    setProgressMsg("正在无缝对齐采样率并合并多音轨...");
    setError(null);

    try {
      const buffers = mergeTracks.map((t) => t.buffer!).filter(Boolean);
      const merged = concatAudioBuffers(buffers);
      const { blob, ext } = await exportAudioBuffer(merged, mergeFormat, mergeKbps);
      const outputFilename = `XC_Merged_Audio_${Date.now()}.${ext}`;
      downloadBlob(blob, outputFilename);
    } catch (err: any) {
      setError("音频合并失败: " + err.message);
    } finally {
      setIsProcessing(false);
      setProgressMsg("");
    }
  };

  // ================= 4. 视频提取纯音频 =================
  const handleExecuteExtract = async () => {
    if (!videoFile) return;
    setIsProcessing(true);
    setProgressMsg("正在从本地视频提取纯净音轨 (无需上传服务器)...");
    setError(null);

    try {
      const buffer = await decodeAudioFile(videoFile);
      const { blob, ext } = await exportAudioBuffer(buffer, extractFormat, extractKbps);
      const baseName = videoFile.name.replace(/\.[^/.]+$/, "");
      downloadBlob(blob, `${baseName}_audio.${ext}`);
    } catch (err: any) {
      setError("视频提取音频失败，请确认视频包含有效声轨: " + err.message);
    } finally {
      setIsProcessing(false);
      setProgressMsg("");
    }
  };

  // ================= 5. 音量调节与标准化 =================
  const handleVolumeFileSelected = async (file: File) => {
    setVolumeFile(file);
    setIsProcessing(true);
    setProgressMsg("正在分析音频电平...");
    try {
      const buf = await decodeAudioFile(file);
      setVolumeBuffer(buf);
    } catch (err: any) {
      setError("加载音频失败: " + err.message);
    } finally {
      setIsProcessing(false);
      setProgressMsg("");
    }
  };

  const handleExecuteVolume = async () => {
    if (!volumeBuffer || !volumeFile) return;
    setIsProcessing(true);
    setProgressMsg("正在重构增益电平与防失真计算...");
    setError(null);

    try {
      const factor = volumeMode === "gain" ? gainPercent / 100 : 1.0;
      const isNorm = volumeMode === "normalize";
      const adjusted = adjustVolumeAndNormalize(volumeBuffer, factor, isNorm);
      const { blob, ext } = await exportAudioBuffer(adjusted, "mp3", 320);
      const baseName = volumeFile.name.replace(/\.[^/.]+$/, "");
      const tag = isNorm ? "normalized" : `gain_${gainPercent}pct`;
      downloadBlob(blob, `${baseName}_${tag}.${ext}`);
    } catch (err: any) {
      setError("音量处理失败: " + err.message);
    } finally {
      setIsProcessing(false);
      setProgressMsg("");
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* 5 大功能 Tab 切换 (横向平滑手势滑动) */}
      <div className="w-full flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 border-b border-coconut-200/80 dark:border-darkbg-border snap-x snap-mandatory touch-pan-x">
        {[
          { id: "trim", label: "波形剪辑与铃声", icon: Scissors, badge: "毫秒级试听" },
          { id: "convert", label: "音频万能转码", icon: RefreshCw, badge: "MP3/WAV/FLAC" },
          { id: "merge", label: "多音频无缝拼接", icon: Combine, badge: "多轨合并" },
          { id: "extract", label: "视频提取纯音频", icon: Film, badge: "MP4秒提MP3" },
          { id: "volume", label: "音量放大与标准化", icon: Volume2, badge: "自动防破音" },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabSelect(tab.id as AudioToolTab)}
              className={`flex items-center space-x-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap flex-shrink-0 snap-start active:scale-95 ${
                isActive
                  ? "bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white font-bold shadow-coconut-sm scale-[1.02]"
                  : "bg-white/80 dark:bg-darkbg-card text-coconut-700 dark:text-darkbg-muted border border-coconut-200/80 dark:border-darkbg-border hover:bg-coconut-100/60 dark:hover:bg-darkbg-elevated hover:dark:text-darkbg-text"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                  isActive
                    ? "bg-white/25 text-white"
                    : "bg-coconut-200/80 dark:bg-darkbg-elevated text-coconut-700 dark:text-darkbg-muted"
                }`}
              >
                {tab.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* 提示与状态条 */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-coconut-100/70 dark:bg-darkbg-card border border-coconut-200/80 dark:border-darkbg-border rounded-2xl text-xs text-coconut-900 dark:text-darkbg-text shadow-coconut-sm">
        <div className="flex items-center space-x-2">
          <Music className="w-4 h-4 text-toast-500" />
          <span>纯前端 Web Audio API 毫秒级多线程运算 · 免装外部庞大 FFmpeg · 零服务器流量消耗</span>
        </div>
        <span className="font-mono text-palm-700 dark:text-palm-400 font-bold">100% 隐私安全</span>
      </div>

      {/* ================= 1. 波形可视化剪辑与铃声面板 ================= */}
      {activeTab === "trim" && (
        <div className="space-y-5">
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
              className="border-2 border-dashed border-coconut-300 dark:border-darkbg-border hover:border-coconut-500 dark:hover:border-palm-500 bg-coconut-50/40 dark:bg-darkbg-card hover:bg-coconut-100/40 dark:hover:bg-darkbg-elevated rounded-3xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-300 shadow-coconut-sm select-none"
            >
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
              <div className="flex flex-col items-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-coconut-100 dark:bg-darkbg-elevated text-coconut-700 dark:text-toast-400 flex items-center justify-center shadow-inner">
                  <UploadCloud className="w-7 h-7" />
                </div>
                <div className="font-bold text-coconut-900 dark:text-darkbg-text">
                  点击或拖拽上传音频文件进行波形剪辑
                </div>
                <div className="text-xs text-coconut-600 dark:text-darkbg-muted">
                  支持 MP3, WAV, FLAC, AAC, M4A, OGG 等全部音乐格式
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white/95 dark:bg-darkbg-card border border-coconut-200/90 dark:border-darkbg-border rounded-3xl p-5 sm:p-6 shadow-coconut-sm space-y-6 backdrop-blur-md">
              {/* 文件信息与重新选择 */}
              <div className="flex items-center justify-between pb-4 border-b border-coconut-100 dark:border-darkbg-border">
                <div className="space-y-0.5">
                  <div className="font-bold text-base text-coconut-900 dark:text-darkbg-text flex items-center space-x-2">
                    <FileAudio className="w-5 h-5 text-toast-500" />
                    <span>{trimFile?.name}</span>
                  </div>
                  <div className="text-xs text-coconut-600 dark:text-darkbg-muted font-mono">
                    总时长: {formatDuration(trimBuffer.duration)} · 采样率: {trimBuffer.sampleRate} Hz · 声道:{" "}
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
                  更换音频
                </button>
              </div>

              {/* 交互式波形画布 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-coconut-600 dark:text-darkbg-muted font-mono">
                  <span>起点: {formatDuration(startTime)}</span>
                  <span className="text-coconut-900 dark:text-toast-400 font-bold">
                    截取时长: {formatDuration(endTime - startTime)}
                  </span>
                  <span>终点: {formatDuration(endTime)}</span>
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
                <p className="text-[11px] text-coconut-600 dark:text-darkbg-muted text-center">
                  💡 拖动两端高亮滑块可直接改变截取起点与终点；点击波形内部任意处可直接跳到该位置试听
                </p>
              </div>

              {/* 快捷选区预设 */}
              <div className="flex items-center space-x-2 text-xs flex-wrap gap-y-2">
                <span className="text-coconut-800 dark:text-darkbg-text font-semibold">快捷铃声长度:</span>
                {[
                  { label: "前 15 秒", s: 0, e: 15 },
                  { label: "前 30 秒 (推荐)", s: 0, e: 30 },
                  { label: "前 60 秒", s: 0, e: 60 },
                  { label: "全选", s: 0, e: trimBuffer.duration },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => {
                      setStartTime(preset.s);
                      setEndTime(Math.min(preset.e, trimBuffer.duration));
                      setCurrentTime(preset.s);
                    }}
                    className="px-3 py-1.5 bg-coconut-100/80 dark:bg-darkbg-subtle hover:bg-coconut-200/80 dark:hover:bg-darkbg-hover text-coconut-800 dark:text-darkbg-text border border-transparent dark:border-darkbg-border rounded-xl font-semibold transition-all"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* 播放控制与淡入淡出参数 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 sm:p-5 bg-coconut-50/70 dark:bg-darkbg-subtle rounded-2xl border border-coconut-200/70 dark:border-darkbg-border">
                {/* 试听控制 */}
                <div className="flex items-center space-x-4">
                  <button
                    onClick={togglePlaySelection}
                    className="w-12 h-12 rounded-full bg-gradient-to-r from-coconut-800 to-coconut-950 dark:from-white dark:to-zinc-100 text-coconut-50 dark:text-zinc-950 flex items-center justify-center shadow-coconut-md transition-all active:scale-95"
                  >
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                  </button>
                  <div className="space-y-1">
                    <div className="font-bold text-sm text-coconut-900 dark:text-darkbg-text">
                      {isPlaying ? "正在试听选区..." : "试听选中片段"}
                    </div>
                    <div className="flex items-center space-x-3 text-xs text-coconut-600 dark:text-darkbg-muted">
                      <label className="flex items-center space-x-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={loopSelection}
                          onChange={(e) => setLoopSelection(e.target.checked)}
                          className="rounded accent-palm-600 dark:accent-palm-400"
                        />
                        <span>循环试听</span>
                      </label>
                      <button
                        onClick={() => {
                          stopPlayback();
                          setCurrentTime(startTime);
                        }}
                        className="hover:text-palm-600 dark:hover:text-palm-400 flex items-center space-x-0.5"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>重头播放</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* 自然淡入淡出调节 */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-coconut-800 dark:text-darkbg-text font-semibold">
                      <span>开头淡入</span>
                      <span className="font-mono font-bold text-coconut-900 dark:text-toast-400">{fadeIn}s</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="5"
                      step="0.5"
                      value={fadeIn}
                      onChange={(e) => setFadeIn(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-coconut-200 dark:bg-darkbg-border rounded-lg appearance-none cursor-pointer accent-coconut-700 dark:accent-palm-400"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-coconut-800 dark:text-darkbg-text font-semibold">
                      <span>结尾淡出</span>
                      <span className="font-mono font-bold text-coconut-900 dark:text-toast-400">{fadeOut}s</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="5"
                      step="0.5"
                      value={fadeOut}
                      onChange={(e) => setFadeOut(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-coconut-200 dark:bg-darkbg-border rounded-lg appearance-none cursor-pointer accent-coconut-700 dark:accent-palm-400"
                    />
                  </div>
                </div>
              </div>

              {/* 导出配置与按钮 */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                <div className="flex items-center space-x-3 text-xs">
                  <span className="text-coconut-800 dark:text-darkbg-text font-bold">导出格式:</span>
                  <div className="flex space-x-1">
                    {(["mp3", "wav"] as const).map((fmt) => (
                      <button
                        key={fmt}
                        onClick={() => setTrimFormat(fmt)}
                        className={`px-3 py-1.5 rounded-xl font-bold uppercase transition-all ${
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
                      className="px-2.5 py-1.5 bg-coconut-50 dark:bg-darkbg-subtle border border-coconut-200 dark:border-darkbg-border rounded-xl font-mono text-coconut-900 dark:text-darkbg-text focus:outline-none focus:border-palm-500"
                    >
                      <option value={320} className="dark:bg-darkbg-card dark:text-darkbg-text">320 kbps (最高品质)</option>
                      <option value={256} className="dark:bg-darkbg-card dark:text-darkbg-text">256 kbps (高保真)</option>
                      <option value={192} className="dark:bg-darkbg-card dark:text-darkbg-text">192 kbps (标准音乐)</option>
                      <option value={128} className="dark:bg-darkbg-card dark:text-darkbg-text">128 kbps (省流小体积)</option>
                    </select>
                  )}
                </div>

                <button
                  onClick={handleExportTrim}
                  disabled={isProcessing}
                  className={`w-full sm:w-auto px-6 py-3 rounded-2xl text-sm font-bold flex items-center justify-center space-x-2 transition-all ${
                    isProcessing
                      ? "bg-coconut-100 dark:bg-darkbg-subtle text-coconut-400 dark:text-darkbg-muted cursor-not-allowed border border-coconut-200 dark:border-darkbg-border"
                      : "btn-3d-sunset text-white"
                  }`}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>处理导出中...</span>
                    </>
                  ) : (
                    <>
                      <Scissors className="w-4 h-4" />
                      <span>立即导出截取音频</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= 2. 音频万能转码面板 ================= */}
      {activeTab === "convert" && (
        <div className="space-y-5">
          <div className="bg-white/95 dark:bg-darkbg-card border border-coconut-200/90 dark:border-darkbg-border rounded-3xl p-5 sm:p-6 shadow-coconut-sm space-y-4 backdrop-blur-md">
            <div className="font-bold text-sm text-coconut-900 dark:text-darkbg-text flex items-center space-x-2">
              <RefreshCw className="w-4 h-4 text-toast-500" />
              <span>设置批量转换目标参数</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <span className="text-xs text-coconut-800 dark:text-darkbg-text font-semibold">目标音频格式</span>
                <div className="flex space-x-2">
                  {(["mp3", "wav"] as const).map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => setConvertTargetFormat(fmt)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase transition-all ${
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
                  <span className="text-xs text-coconut-800 dark:text-darkbg-text font-semibold">MP3 压缩比特率</span>
                  <select
                    value={convertKbps}
                    onChange={(e) => setConvertKbps(parseInt(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-coconut-50/70 dark:bg-darkbg-subtle border border-coconut-200 dark:border-darkbg-border rounded-xl text-coconut-900 dark:text-darkbg-text focus:outline-none focus:border-palm-500"
                  >
                    <option value={320} className="dark:bg-darkbg-card dark:text-darkbg-text">320 kbps (录音室母带级音乐)</option>
                    <option value={256} className="dark:bg-darkbg-card dark:text-darkbg-text">256 kbps (高保真音乐)</option>
                    <option value={192} className="dark:bg-darkbg-card dark:text-darkbg-text">192 kbps (通用标准 CD 级)</option>
                    <option value={128} className="dark:bg-darkbg-card dark:text-darkbg-text">128 kbps (网络播客省流)</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* 拖拽上传 */}
          <div
            onClick={() => document.getElementById("audio-convert-upload")?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files) {
                setConvertFiles((prev) => [...prev, ...Array.from(e.dataTransfer.files)]);
              }
            }}
            className="border-2 border-dashed border-coconut-300 dark:border-darkbg-border hover:border-coconut-500 dark:hover:border-palm-500 bg-coconut-50/40 dark:bg-darkbg-card hover:bg-coconut-100/40 dark:hover:bg-darkbg-elevated rounded-3xl p-8 text-center cursor-pointer transition-all duration-300 shadow-coconut-sm select-none"
          >
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
            <div className="flex flex-col items-center space-y-2.5">
              <UploadCloud className="w-8 h-8 text-toast-500" />
              <div className="text-sm font-bold text-coconut-900 dark:text-darkbg-text">
                点击或拖拽多个音频文件至此处
              </div>
              <div className="text-xs text-coconut-600 dark:text-darkbg-muted">支持 MP3, WAV, AAC, M4A, OGG, FLAC 等</div>
            </div>
          </div>

          {/* 待转码文件列表 */}
          {convertFiles.length > 0 && (
            <div className="bg-white/95 dark:bg-darkbg-card border border-coconut-200/90 dark:border-darkbg-border rounded-3xl p-5 shadow-coconut-sm space-y-4 backdrop-blur-md">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-coconut-900 dark:text-darkbg-text">
                  待转码音频 ({convertFiles.length} 首)
                </span>
                <button
                  onClick={() => {
                    setConvertFiles([]);
                    setConvertResults([]);
                  }}
                  className="text-xs text-rose-500 hover:text-rose-600 font-medium"
                >
                  清空列表
                </button>
              </div>

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

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleExecuteConvert}
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
                      <span>正在并行转码中...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-200" />
                      <span>开始批量转码</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* 转码结果展示 */}
          {convertResults.length > 0 && (
            <div className="bg-white/95 dark:bg-darkbg-card border border-coconut-200/90 dark:border-darkbg-border rounded-3xl p-5 shadow-coconut-sm space-y-4 backdrop-blur-md">
              <div className="flex items-center justify-between pb-3 border-b border-coconut-100 dark:border-darkbg-border">
                <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>转码完成！共生成 {convertResults.length} 首高保真音频</span>
                </div>
                <button
                  onClick={async () => {
                    const items = convertResults.map((r) => ({ blob: r.blob, filename: r.newFilename }));
                    const { blob, filename } = await createZipBundle(items, `XC_Converted_Audio_${Date.now()}.zip`);
                    downloadBlob(blob, filename);
                  }}
                  className="px-4 py-2 btn-3d-sunset text-white rounded-xl text-xs font-bold flex items-center space-x-1.5"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>一键打包下载 (ZIP)</span>
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
                        时长: {formatDuration(res.duration)} · {formatBytes(res.newSize)}
                      </div>
                    </div>
                    <button
                      onClick={() => downloadBlob(res.blob, res.newFilename)}
                      className="p-2 rounded-xl bg-coconut-100 dark:bg-darkbg-elevated text-coconut-700 dark:text-darkbg-text hover:bg-coconut-800 hover:text-coconut-50 dark:hover:bg-white dark:hover:text-zinc-950 transition-all active:scale-95"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= 3. 多音频无缝拼接合并面板 ================= */}
      {activeTab === "merge" && (
        <div className="space-y-5">
          <div className="bg-white/95 dark:bg-darkbg-card border border-coconut-200/90 dark:border-darkbg-border rounded-3xl p-5 sm:p-6 shadow-coconut-sm space-y-4 backdrop-blur-md">
            <div className="flex items-center justify-between pb-3 border-b border-coconut-100 dark:border-darkbg-border">
              <div>
                <h3 className="text-sm font-bold text-coconut-900 dark:text-darkbg-text">
                  多段音频拼接队列 ({mergeTracks.length} 段)
                </h3>
                <p className="text-xs text-coconut-600 dark:text-darkbg-muted mt-0.5">
                  上下调整音频先后顺序，算法将自动统一对齐重采样无缝首尾连接
                </p>
              </div>
              <input
                id="merge-upload-input"
                type="file"
                multiple
                accept="audio/*"
                onChange={(e) => handleAddMergeTracks(e.target.files)}
                className="hidden"
              />
              <button
                onClick={() => document.getElementById("merge-upload-input")?.click()}
                className="px-3.5 py-1.5 bg-coconut-100 dark:bg-darkbg-subtle text-coconut-800 dark:text-darkbg-text hover:bg-coconut-200 dark:hover:bg-darkbg-hover border border-transparent dark:border-darkbg-border rounded-xl text-xs font-bold transition-all"
              >
                + 添加音频片段
              </button>
            </div>

            {mergeTracks.length === 0 ? (
              <div
                onClick={() => document.getElementById("merge-upload-input")?.click()}
                className="border-2 border-dashed border-coconut-300 dark:border-darkbg-border hover:border-coconut-500 dark:hover:border-palm-500 rounded-3xl p-10 text-center cursor-pointer transition-all bg-coconut-50/40 dark:bg-darkbg-card"
              >
                <Combine className="w-8 h-8 text-coconut-400 dark:text-darkbg-muted mx-auto mb-2" />
                <div className="text-xs text-coconut-600 dark:text-darkbg-muted">点击添加两段或多段音频开始拼接</div>
              </div>
            ) : (
              <div className="space-y-2">
                {mergeTracks.map((track, idx) => (
                  <div
                    key={track.id}
                    className="flex items-center justify-between p-3 bg-coconut-50/70 dark:bg-darkbg-subtle border border-coconut-200/70 dark:border-darkbg-border rounded-2xl"
                  >
                    <div className="flex items-center space-x-3">
                      <span className="w-5 h-5 rounded-full bg-coconut-200/80 dark:bg-darkbg-elevated text-coconut-800 dark:text-darkbg-text font-bold text-xs flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="text-xs font-semibold text-coconut-900 dark:text-darkbg-text">{track.name}</div>
                        <div className="text-[10px] text-coconut-600 dark:text-darkbg-muted font-mono">
                          时长: {formatDuration(track.duration || 0)} · 大小: {formatBytes(track.size)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1">
                      <button
                        disabled={idx === 0}
                        onClick={() => {
                          const arr = [...mergeTracks];
                          const temp = arr[idx - 1];
                          arr[idx - 1] = arr[idx];
                          arr[idx] = temp;
                          setMergeTracks(arr);
                        }}
                        className="p-1 text-coconut-400 dark:text-darkbg-muted hover:text-coconut-700 dark:hover:text-darkbg-text disabled:opacity-30"
                        title="上移"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        disabled={idx === mergeTracks.length - 1}
                        onClick={() => {
                          const arr = [...mergeTracks];
                          const temp = arr[idx + 1];
                          arr[idx + 1] = arr[idx];
                          arr[idx] = temp;
                          setMergeTracks(arr);
                        }}
                        className="p-1 text-coconut-400 dark:text-darkbg-muted hover:text-coconut-700 dark:hover:text-darkbg-text disabled:opacity-30"
                        title="下移"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setMergeTracks((prev) => prev.filter((_, i) => i !== idx))}
                        className="p-1 text-rose-400 hover:text-rose-600 ml-2"
                        title="移除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}

                <div className="flex items-center justify-between pt-4 border-t border-coconut-100 dark:border-darkbg-border">
                  <div className="text-xs text-coconut-600 dark:text-darkbg-muted font-mono">
                    合并总时长预计:{" "}
                    <span className="font-bold text-coconut-900 dark:text-toast-400">
                      {formatDuration(mergeTracks.reduce((acc, t) => acc + (t.duration || 0), 0))}
                    </span>
                  </div>

                  <div className="flex items-center space-x-3">
                    <select
                      value={mergeFormat}
                      onChange={(e) => setMergeFormat(e.target.value as any)}
                      className="px-2.5 py-1.5 bg-coconut-100 dark:bg-darkbg-subtle border border-coconut-200 dark:border-darkbg-border rounded-xl text-xs font-bold uppercase text-coconut-900 dark:text-darkbg-text focus:outline-none focus:border-palm-500"
                    >
                      <option value="mp3" className="dark:bg-darkbg-card dark:text-darkbg-text">MP3 (320kbps)</option>
                      <option value="wav" className="dark:bg-darkbg-card dark:text-darkbg-text">WAV (CD级无损)</option>
                    </select>

                    <button
                      onClick={handleExecuteMerge}
                      disabled={isProcessing}
                      className={`px-6 py-2.5 rounded-2xl text-xs font-bold flex items-center space-x-1.5 transition-all ${
                        isProcessing
                          ? "bg-coconut-100 dark:bg-darkbg-subtle text-coconut-400 dark:text-darkbg-muted cursor-not-allowed border border-coconut-200 dark:border-darkbg-border"
                          : "btn-3d-sunset text-white"
                      }`}
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>正在合并中...</span>
                        </>
                      ) : (
                        <>
                          <Combine className="w-4 h-4" />
                          <span>一键合并并下载</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= 4. 视频提取纯音频面板 ================= */}
      {activeTab === "extract" && (
        <div className="space-y-5">
          <div className="bg-white/95 dark:bg-darkbg-card border border-coconut-200/90 dark:border-darkbg-border rounded-3xl p-5 sm:p-6 shadow-coconut-sm space-y-4 backdrop-blur-md">
            <div>
              <h3 className="text-base font-bold text-coconut-900 dark:text-darkbg-text">
                本地视频秒级剥离提取纯音频
              </h3>
              <p className="text-xs text-coconut-600 dark:text-darkbg-muted mt-1">
                直接拖入数十兆或数百兆的 MP4, MOV, WebM, MKV 视频，浏览器纯本地解码提取音轨，
                <strong>无需将视频上传到服务器</strong>，瞬间获得高保真 MP3/WAV 音乐文件！
              </p>
            </div>

            <div
              onClick={() => document.getElementById("video-extract-upload")?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  setVideoFile(e.dataTransfer.files[0]);
                }
              }}
              className="border-2 border-dashed border-coconut-300 dark:border-darkbg-border hover:border-coconut-500 dark:hover:border-palm-500 rounded-3xl p-10 text-center cursor-pointer transition-all bg-coconut-50/40 dark:bg-darkbg-card"
            >
              <input
                id="video-extract-upload"
                type="file"
                accept="video/*"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setVideoFile(e.target.files[0]);
                  }
                }}
                className="hidden"
              />
              <Film className="w-10 h-10 text-toast-500 mx-auto mb-2" />
              <div className="text-sm font-bold text-coconut-900 dark:text-darkbg-text">
                {videoFile ? `已选视频: ${videoFile.name} (${formatBytes(videoFile.size)})` : "点击或拖拽视频文件至此处"}
              </div>
              <div className="text-xs text-coconut-600 dark:text-darkbg-muted mt-1">支持 MP4, MOV, WebM, MKV 等常见视频格式</div>
            </div>

            {videoFile && (
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center space-x-3 text-xs">
                  <span className="text-coconut-800 dark:text-darkbg-text font-bold">导出音频格式:</span>
                  {(["mp3", "wav"] as const).map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => setExtractFormat(fmt)}
                      className={`px-3 py-1.5 rounded-xl font-bold uppercase transition-all ${
                        extractFormat === fmt
                          ? "bg-coconut-800 text-coconut-50 dark:bg-white dark:text-zinc-950 font-bold shadow-sm"
                          : "bg-coconut-100/70 dark:bg-darkbg-subtle text-coconut-700 dark:text-darkbg-muted hover:dark:text-darkbg-text border border-transparent dark:border-darkbg-border"
                      }`}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleExecuteExtract}
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
                      <span>正在极速剥离提取中...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>提取并下载纯音频</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= 5. 音量放大与标准化面板 ================= */}
      {activeTab === "volume" && (
        <div className="space-y-5">
          <div className="bg-white/95 dark:bg-darkbg-card border border-coconut-200/90 dark:border-darkbg-border rounded-3xl p-5 sm:p-6 shadow-coconut-sm space-y-5 backdrop-blur-md">
            <div>
              <h3 className="text-base font-bold text-coconut-900 dark:text-darkbg-text">
                音频音量智能增强与防破音标准化
              </h3>
              <p className="text-xs text-coconut-600 dark:text-darkbg-muted mt-1">
                解决手机录音、网课授课、采访录音声音太小的问题。支持自动峰值标准化（消除破音）或手动倍数放大。
              </p>
            </div>

            {!volumeBuffer ? (
              <div
                onClick={() => document.getElementById("volume-upload-input")?.click()}
                className="border-2 border-dashed border-coconut-300 dark:border-darkbg-border hover:border-coconut-500 dark:hover:border-palm-500 rounded-3xl p-10 text-center cursor-pointer transition-all bg-coconut-50/40 dark:bg-darkbg-card"
              >
                <input
                  id="volume-upload-input"
                  type="file"
                  accept="audio/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleVolumeFileSelected(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />
                <Volume2 className="w-10 h-10 text-toast-500 mx-auto mb-2" />
                <div className="text-xs text-coconut-600 dark:text-darkbg-muted">点击或拖拽上传音频文件调节音量</div>
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
                    更换文件
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
                    <div className="font-bold text-sm text-coconut-900 dark:text-darkbg-text">自动峰值标准化 (Peak Normalization)</div>
                    <p className="text-xs text-coconut-600 dark:text-darkbg-muted mt-1">
                      全曲电平扫描并拉满至 -0.1 dB 极限音量，保证声音最大化的同时绝对不破音失真（推荐）。
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
                      <span>手动强力增益放大</span>
                      <span className="font-mono text-coconut-900 dark:text-toast-400 font-bold">{gainPercent}%</span>
                    </div>
                    <input
                      type="range"
                      min="100"
                      max="300"
                      step="10"
                      value={gainPercent}
                      onChange={(e) => setGainPercent(parseInt(e.target.value))}
                      disabled={volumeMode !== "gain"}
                      className="w-full mt-3 h-2 bg-coconut-200 dark:bg-darkbg-border rounded-lg appearance-none cursor-pointer accent-coconut-700 dark:accent-palm-400"
                    />
                  </label>
                </div>

                <div className="flex justify-end pt-2">
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
                        <span>正在增益处理...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>应用并下载增强音频</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 报错提醒 */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50/90 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center space-x-3 text-rose-700 dark:text-rose-300 text-sm shadow-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-500" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
