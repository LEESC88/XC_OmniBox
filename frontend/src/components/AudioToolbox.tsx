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

export default function AudioToolbox() {
  const [activeTab, setActiveTab] = useState<AudioToolTab>("trim");
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");

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
      {/* 5 大功能 Tab 切换 */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2 border-b border-zinc-200 dark:border-zinc-800 scrollbar-none">
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
              onClick={() => setActiveTab(tab.id as AudioToolTab)}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all whitespace-nowrap flex-shrink-0 ${
                isActive
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-500/25"
                  : "bg-zinc-100 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                  isActive
                    ? "bg-blue-500/50 text-white"
                    : "bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400"
                }`}
              >
                {tab.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* 提示与状态条 */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-900/50 rounded-xl text-xs text-blue-700 dark:text-blue-300">
        <div className="flex items-center space-x-2">
          <Music className="w-4 h-4 text-blue-500" />
          <span>纯前端 Web Audio API 毫秒级多线程运算 · 免装外部庞大 FFmpeg · 零服务器流量消耗</span>
        </div>
        <span className="font-mono text-emerald-600 dark:text-emerald-400 font-medium">100% 隐私安全</span>
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
              className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-blue-500 bg-zinc-50/50 dark:bg-zinc-900/40 rounded-2xl p-12 text-center cursor-pointer transition-all"
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
                <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center">
                  <UploadCloud className="w-7 h-7" />
                </div>
                <div className="font-semibold text-zinc-800 dark:text-zinc-200">
                  点击或拖拽上传音频文件进行波形剪辑
                </div>
                <div className="text-xs text-zinc-400">
                  支持 MP3, WAV, FLAC, AAC, M4A, OGG 等全部音乐格式
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-6">
              {/* 文件信息与重新选择 */}
              <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
                <div className="space-y-0.5">
                  <div className="font-bold text-base text-zinc-900 dark:text-zinc-100 flex items-center space-x-2">
                    <FileAudio className="w-5 h-5 text-blue-600" />
                    <span>{trimFile?.name}</span>
                  </div>
                  <div className="text-xs text-zinc-400 font-mono">
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
                  className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100"
                >
                  更换音频
                </button>
              </div>

              {/* 交互式波形画布 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-zinc-500 font-mono">
                  <span>起点: {formatDuration(startTime)}</span>
                  <span className="text-blue-600 dark:text-blue-400 font-bold">
                    截取时长: {formatDuration(endTime - startTime)}
                  </span>
                  <span>终点: {formatDuration(endTime)}</span>
                </div>

                <div className="relative w-full h-36 bg-zinc-950 rounded-xl overflow-hidden cursor-crosshair border border-zinc-800">
                  <canvas
                    ref={canvasRef}
                    onMouseDown={handleCanvasMouseDown}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseUp={handleCanvasMouseUp}
                    className="w-full h-full"
                  />
                </div>
                <p className="text-[11px] text-zinc-400 text-center">
                  💡 拖动两端蓝点可直接改变截取起点与终点；点击波形内部任意处可直接跳到该位置试听
                </p>
              </div>

              {/* 快捷选区预设 */}
              <div className="flex items-center space-x-2 text-xs">
                <span className="text-zinc-500">快捷铃声长度:</span>
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
                    className="px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-zinc-700 dark:text-zinc-300 rounded-lg transition-all"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* 播放控制与淡入淡出参数 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700/60">
                {/* 试听控制 */}
                <div className="flex items-center space-x-4">
                  <button
                    onClick={togglePlaySelection}
                    className="w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-md transition-all active:scale-95"
                  >
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                  </button>
                  <div className="space-y-1">
                    <div className="font-semibold text-sm text-zinc-800 dark:text-zinc-200">
                      {isPlaying ? "正在试听选区..." : "试听选中片段"}
                    </div>
                    <div className="flex items-center space-x-3 text-xs text-zinc-500">
                      <label className="flex items-center space-x-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={loopSelection}
                          onChange={(e) => setLoopSelection(e.target.checked)}
                          className="rounded text-blue-600"
                        />
                        <span>循环试听</span>
                      </label>
                      <button
                        onClick={() => {
                          stopPlayback();
                          setCurrentTime(startTime);
                        }}
                        className="hover:text-blue-500 flex items-center space-x-0.5"
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
                    <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400">
                      <span>开头淡入</span>
                      <span className="font-mono font-bold text-blue-600">{fadeIn}s</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="5"
                      step="0.5"
                      value={fadeIn}
                      onChange={(e) => setFadeIn(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400">
                      <span>结尾淡出</span>
                      <span className="font-mono font-bold text-blue-600">{fadeOut}s</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="5"
                      step="0.5"
                      value={fadeOut}
                      onChange={(e) => setFadeOut(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                  </div>
                </div>
              </div>

              {/* 导出配置与按钮 */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                <div className="flex items-center space-x-3 text-xs">
                  <span className="text-zinc-500 font-medium">导出格式:</span>
                  <div className="flex space-x-1">
                    {(["mp3", "wav"] as const).map((fmt) => (
                      <button
                        key={fmt}
                        onClick={() => setTrimFormat(fmt)}
                        className={`px-3 py-1.5 rounded-lg font-bold uppercase transition-all ${
                          trimFormat === fmt
                            ? "bg-blue-600 text-white"
                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
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
                      className="px-2.5 py-1.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg font-mono"
                    >
                      <option value={320}>320 kbps (最高品质)</option>
                      <option value={256}>256 kbps (高保真)</option>
                      <option value={192}>192 kbps (标准音乐)</option>
                      <option value={128}>128 kbps (省流小体积)</option>
                    </select>
                  )}
                </div>

                <button
                  onClick={handleExportTrim}
                  disabled={isProcessing}
                  className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center space-x-2 shadow-sm shadow-blue-500/25 transition-all"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>处理导出中...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>立即导出剪辑音频</span>
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
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">转码参数配置</span>
              <span className="text-[11px] text-zinc-400">支持批量多文件互转</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <span className="text-xs text-zinc-500">目标音频格式</span>
                <div className="flex space-x-2">
                  {(["mp3", "wav"] as const).map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => setConvertTargetFormat(fmt)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase transition-all ${
                        convertTargetFormat === fmt
                          ? "bg-blue-600 text-white"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                      }`}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>

              {convertTargetFormat === "mp3" && (
                <div className="space-y-1.5">
                  <span className="text-xs text-zinc-500">MP3 压缩比特率</span>
                  <select
                    value={convertKbps}
                    onChange={(e) => setConvertKbps(parseInt(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl"
                  >
                    <option value={320}>320 kbps (录音室母带级音乐)</option>
                    <option value={256}>256 kbps (高保真音乐)</option>
                    <option value={192}>192 kbps (通用标准 CD 级)</option>
                    <option value={128}>128 kbps (网络播客省流)</option>
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
            className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-blue-500 bg-zinc-50/50 dark:bg-zinc-900/40 rounded-2xl p-8 text-center cursor-pointer transition-all"
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
            <div className="flex flex-col items-center space-y-2">
              <UploadCloud className="w-8 h-8 text-blue-500" />
              <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                点击或拖拽多个音频文件至此处
              </div>
              <div className="text-xs text-zinc-400">支持 MP3, WAV, AAC, M4A, OGG, FLAC 等</div>
            </div>
          </div>

          {/* 待转码文件列表 */}
          {convertFiles.length > 0 && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-zinc-700 dark:text-zinc-300">
                  待转码音频 ({convertFiles.length} 首)
                </span>
                <button
                  onClick={() => {
                    setConvertFiles([]);
                    setConvertResults([]);
                  }}
                  className="text-xs text-red-500 hover:underline"
                >
                  清空列表
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {convertFiles.map((f, i) => (
                  <div
                    key={`${f.name}_${i}`}
                    className="p-2.5 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700 flex items-center justify-between"
                  >
                    <div className="truncate text-xs font-medium text-zinc-700 dark:text-zinc-300 pr-2">
                      {f.name}
                    </div>
                    <span className="text-[10px] text-zinc-400 font-mono">{formatBytes(f.size)}</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleExecuteConvert}
                  disabled={isProcessing}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center space-x-2 shadow-sm"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>正在并行转码中...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>开始批量转码</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* 转码结果展示 */}
          {convertResults.length > 0 && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
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
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-sm"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>一键打包下载 (ZIP)</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {convertResults.map((res) => (
                  <div
                    key={res.id}
                    className="p-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl flex items-center justify-between"
                  >
                    <div className="space-y-0.5 truncate pr-2">
                      <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                        {res.newFilename}
                      </div>
                      <div className="text-[10px] text-zinc-400 font-mono">
                        时长: {formatDuration(res.duration)} · {formatBytes(res.newSize)}
                      </div>
                    </div>
                    <button
                      onClick={() => downloadBlob(res.blob, res.newFilename)}
                      className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 hover:bg-blue-600 hover:text-white transition-all"
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
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div>
                <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  多段音频拼接队列 ({mergeTracks.length} 段)
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
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
                className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white rounded-lg text-xs font-semibold transition-all"
              >
                + 添加音频片段
              </button>
            </div>

            {mergeTracks.length === 0 ? (
              <div
                onClick={() => document.getElementById("merge-upload-input")?.click()}
                className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-blue-500 rounded-2xl p-10 text-center cursor-pointer transition-all"
              >
                <Combine className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
                <div className="text-xs text-zinc-500">点击添加两段或多段音频开始拼接</div>
              </div>
            ) : (
              <div className="space-y-2">
                {mergeTracks.map((track, idx) => (
                  <div
                    key={track.id}
                    className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 rounded-xl"
                  >
                    <div className="flex items-center space-x-3">
                      <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold text-xs flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="text-xs font-medium text-zinc-800 dark:text-zinc-200">{track.name}</div>
                        <div className="text-[10px] text-zinc-400 font-mono">
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
                        className="p-1 text-zinc-400 hover:text-zinc-700 disabled:opacity-30"
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
                        className="p-1 text-zinc-400 hover:text-zinc-700 disabled:opacity-30"
                        title="下移"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setMergeTracks((prev) => prev.filter((_, i) => i !== idx))}
                        className="p-1 text-red-400 hover:text-red-600 ml-2"
                        title="移除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}

                <div className="flex items-center justify-between pt-4 border-t border-zinc-100 dark:border-zinc-800">
                  <div className="text-xs text-zinc-500 font-mono">
                    合并总时长预计:{" "}
                    <span className="font-bold text-blue-600">
                      {formatDuration(mergeTracks.reduce((acc, t) => acc + (t.duration || 0), 0))}
                    </span>
                  </div>

                  <div className="flex items-center space-x-3">
                    <select
                      value={mergeFormat}
                      onChange={(e) => setMergeFormat(e.target.value as any)}
                      className="px-2.5 py-1.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-bold uppercase"
                    >
                      <option value="mp3">MP3 (320kbps)</option>
                      <option value="wav">WAV (CD级无损)</option>
                    </select>

                    <button
                      onClick={handleExecuteMerge}
                      disabled={isProcessing}
                      className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 shadow-sm"
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
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-5">
            <div>
              <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-200">
                本地视频秒级剥离提取纯音频
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
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
              className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-blue-500 rounded-2xl p-10 text-center cursor-pointer transition-all bg-zinc-50/50 dark:bg-zinc-900/40"
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
              <Film className="w-10 h-10 text-blue-500 mx-auto mb-2" />
              <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                {videoFile ? `已选视频: ${videoFile.name} (${formatBytes(videoFile.size)})` : "点击或拖拽视频文件至此处"}
              </div>
              <div className="text-xs text-zinc-400 mt-1">支持 MP4, MOV, WebM, MKV 等常见视频格式</div>
            </div>

            {videoFile && (
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center space-x-3 text-xs">
                  <span className="text-zinc-500">导出音频格式:</span>
                  {(["mp3", "wav"] as const).map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => setExtractFormat(fmt)}
                      className={`px-3 py-1.5 rounded-lg font-bold uppercase transition-all ${
                        extractFormat === fmt
                          ? "bg-blue-600 text-white"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                      }`}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleExecuteExtract}
                  disabled={isProcessing}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center space-x-2 shadow-sm"
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
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-5">
            <div>
              <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-200">
                音频音量智能增强与防破音标准化
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                解决手机录音、网课授课、采访录音声音太小的问题。支持自动峰值标准化（消除破音）或手动倍数放大。
              </p>
            </div>

            {!volumeBuffer ? (
              <div
                onClick={() => document.getElementById("volume-upload-input")?.click()}
                className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-blue-500 rounded-2xl p-10 text-center cursor-pointer transition-all"
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
                <Volume2 className="w-10 h-10 text-blue-500 mx-auto mb-2" />
                <div className="text-xs text-zinc-500">点击或拖拽上传音频文件调节音量</div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate">
                    {volumeFile?.name}
                  </span>
                  <button
                    onClick={() => {
                      setVolumeBuffer(null);
                      setVolumeFile(null);
                    }}
                    className="text-xs text-zinc-400 hover:text-zinc-700"
                  >
                    更换文件
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label
                    onClick={() => setVolumeMode("normalize")}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      volumeMode === "normalize"
                        ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300"
                        : "border-zinc-200 dark:border-zinc-700"
                    }`}
                  >
                    <div className="font-semibold text-sm">自动峰值标准化 (Peak Normalization)</div>
                    <p className="text-xs text-zinc-400 mt-1">
                      全曲电平扫描并拉满至 -0.1 dB 极限音量，保证声音最大化的同时绝对不破音失真（推荐）。
                    </p>
                  </label>

                  <label
                    onClick={() => setVolumeMode("gain")}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      volumeMode === "gain"
                        ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300"
                        : "border-zinc-200 dark:border-zinc-700"
                    }`}
                  >
                    <div className="flex justify-between items-center font-semibold text-sm">
                      <span>手动强力增益放大</span>
                      <span className="font-mono text-blue-600 font-bold">{gainPercent}%</span>
                    </div>
                    <input
                      type="range"
                      min="100"
                      max="300"
                      step="10"
                      value={gainPercent}
                      onChange={(e) => setGainPercent(parseInt(e.target.value))}
                      disabled={volumeMode !== "gain"}
                      className="w-full mt-3 accent-blue-600"
                    />
                  </label>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleExecuteVolume}
                    disabled={isProcessing}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center space-x-2 shadow-sm"
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
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-center space-x-3 text-red-600 dark:text-red-400 text-sm animate-shake">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
