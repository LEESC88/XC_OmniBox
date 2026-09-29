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
  Mic,
  VolumeX,
  Plus,
  Minus,
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
  enhanceVoiceClarity,
  changeAudioSpeed,
  reverseAudioBuffer,
  extractKaraokeAccompaniment,
} from "@/lib/audioProcessor";
import { formatBytes } from "@/lib/imageProcessor";
import { createZipBundle } from "@/lib/imageProcessor";
import { downloadBlob } from "@/lib/api";
import ScrollableTabNav from "@/components/ScrollableTabNav";
import { useI18n } from "@/lib/i18n";
import BatchQueueProgress from "@/components/BatchQueueProgress";
import SendToButton from "@/components/SendToButton";
import {
  BatchTaskItem,
  BatchProgressSummary,
  executeBatchQueue,
  exportBatchFiles,
} from "@/lib/batchQueueManager";

export type AudioToolTab = "trim" | "convert" | "merge" | "extract" | "volume" | "speed" | "karaoke";

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
  incomingFile?: File | null;
  onIncomingFileHandled?: () => void;
}

export default function AudioToolbox({
  currentTab,
  onTabChange,
  incomingFile,
  onIncomingFileHandled,
}: AudioToolboxProps = {}) {
  const { lang } = useI18n();
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
  const [trimResult, setTrimResult] = useState<{ blob: Blob; filename: string; duration: number; url: string } | null>(null);

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

  // ================= 3. 音频合并状态 =================
  const [mergeTracks, setMergeTracks] = useState<MergeTrack[]>([]);
  const [mergeFormat, setMergeFormat] = useState<"mp3" | "wav">("mp3");
  const [mergeKbps, setMergeKbps] = useState(320);
  const [mergeResult, setMergeResult] = useState<{ blob: Blob; filename: string; duration: number; url: string } | null>(null);

  // ================= 4. 视频提取音频状态 =================
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [extractRangeMode, setExtractRangeMode] = useState<"full" | "clip">("full");
  const [extractStartTime, setExtractStartTime] = useState(0);
  const [extractEndTime, setExtractEndTime] = useState(0);
  const [extractFormat, setExtractFormat] = useState<"mp3" | "wav">("mp3");
  const [extractKbps, setExtractKbps] = useState(320);
  const [extractResult, setExtractResult] = useState<{ blob: Blob; filename: string; duration: number; url: string } | null>(null);
  const videoPlayerRef = useRef<HTMLVideoElement | null>(null);

  // ================= 5. 音量调节与清晰度状态 =================
  const [volumeFile, setVolumeFile] = useState<File | null>(null);
  const [volumeBuffer, setVolumeBuffer] = useState<AudioBuffer | null>(null);
  const [volumeMode, setVolumeMode] = useState<"normalize" | "gain">("normalize");
  const [gainPercent, setGainPercent] = useState(150);
  const [filterRumble, setFilterRumble] = useState(true);
  const [boostPresence, setBoostPresence] = useState(true);
  const [compressDynamics, setCompressDynamics] = useState(true);
  const [volumeResult, setVolumeResult] = useState<{ blob: Blob; filename: string; duration: number; url: string } | null>(null);

  // ================= 6. 音频倍速与倒放状态 =================
  const [speedFile, setSpeedFile] = useState<File | null>(null);
  const [speedBuffer, setSpeedBuffer] = useState<AudioBuffer | null>(null);
  const [speedPlaybackRate, setSpeedPlaybackRate] = useState<number>(1.25);
  const [speedIsReversed, setSpeedIsReversed] = useState<boolean>(false);
  const [speedFormat, setSpeedFormat] = useState<"mp3" | "wav">("mp3");
  const [speedKbps, setSpeedKbps] = useState(320);
  const [speedResult, setSpeedResult] = useState<{ blob: Blob; filename: string; duration: number; url: string } | null>(null);

  // ================= 7. 卡拉OK伴奏提取状态 =================
  const [karaokeFile, setKaraokeFile] = useState<File | null>(null);
  const [karaokeBuffer, setKaraokeBuffer] = useState<AudioBuffer | null>(null);
  const [karaokeBassHz, setKaraokeBassHz] = useState<number>(180);
  const [karaokeFormat, setKaraokeFormat] = useState<"mp3" | "wav">("mp3");
  const [karaokeKbps, setKaraokeKbps] = useState(320);
  const [karaokeResult, setKaraokeResult] = useState<{ blob: Blob; filename: string; duration: number; url: string } | null>(null);

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

  // ================= 2. 格式批量转码 (并发队列与错误隔离) =================
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

  // ================= 3. 音频多段拼接 (并发解析音轨) =================
  const handleAddMergeTracks = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsProcessing(true);
    setProgressMsg(lang === "en" ? "Decoding audio tracks in parallel..." : "正在并发解析音轨数据...");
    const fileArray = Array.from(files);
    const incoming: MergeTrack[] = [];

    const trackTasks: BatchTaskItem<File, MergeTrack>[] = fileArray.map((f, i) => ({
      id: `merge_item_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 7)}`,
      name: f.name,
      size: f.size,
      raw: f,
      status: "waiting",
      progress: 0,
    }));

    await executeBatchQueue(
      trackTasks,
      async (item) => {
        const buf = await decodeAudioFile(item.raw);
        return {
          id: `track_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          file: item.raw,
          name: item.raw.name,
          size: item.raw.size,
          duration: buf.duration,
          buffer: buf,
        };
      },
      {
        concurrency: 3,
        onProgress: (sum) => {
          setProgressMsg(
            lang === "en"
              ? `Decoding audio tracks (${sum.completed}/${sum.total})...`
              : `正在并行解码音轨 (${sum.completed}/${sum.total})...`
          );
        },
      }
    );

    for (const t of trackTasks) {
      if (t.status === "completed" && t.result) {
        incoming.push(t.result);
      }
    }

    setMergeTracks((prev) => [...prev, ...incoming]);
    setIsProcessing(false);
    setProgressMsg("");
  };

  const handleExecuteMerge = async () => {
    if (mergeTracks.length < 2) {
      setError(lang === "en" ? "Please add at least 2 audio clips to merge" : "请至少添加两个音频片段进行拼接");
      return;
    }
    setIsProcessing(true);
    setProgressMsg(lang === "en" ? "Aligning sample rates and merging tracks..." : "正在无缝对齐采样率并合并多音轨...");
    setError(null);

    try {
      const buffers = mergeTracks.map((t) => t.buffer!).filter(Boolean);
      const merged = concatAudioBuffers(buffers);
      const { blob, ext } = await exportAudioBuffer(merged, mergeFormat, mergeKbps);
      const outputFilename = `XC_Merged_Audio_${Date.now()}.${ext}`;
      setMergeResult({
        blob,
        filename: outputFilename,
        duration: merged.duration,
        url: URL.createObjectURL(blob),
      });
    } catch (err: any) {
      setError((lang === "en" ? "Audio merge failed: " : "音频合并失败: ") + err.message);
    } finally {
      setIsProcessing(false);
      setProgressMsg("");
    }
  };

  // ================= 4. 视频提取纯音频 =================
  const handleVideoFileSelected = async (file: File) => {
    setVideoFile(file);
    setVideoPreviewUrl(URL.createObjectURL(file));
    setExtractResult(null);
    setIsProcessing(true);
    setProgressMsg(lang === "en" ? "Analyzing video soundtrack..." : "正在分析视频音频流与时长...");
    try {
      const buf = await decodeAudioFile(file);
      setVideoDuration(buf.duration);
      setExtractStartTime(0);
      setExtractEndTime(+buf.duration.toFixed(1));
    } catch (err: any) {
      console.warn("Could not pre-decode video audio", err);
    } finally {
      setIsProcessing(false);
      setProgressMsg("");
    }
  };

  const handleExecuteExtract = async () => {
    if (!videoFile) return;
    setIsProcessing(true);
    setProgressMsg(lang === "en" ? "Extracting audio track from local video (no upload needed)..." : "正在从本地视频提取纯净音轨 (无需上传服务器)...");
    setError(null);

    try {
      let buffer = await decodeAudioFile(videoFile);
      if (extractRangeMode === "clip" && extractEndTime > extractStartTime) {
        buffer = trimAudioBuffer(buffer, extractStartTime, extractEndTime);
      }
      const { blob, ext } = await exportAudioBuffer(buffer, extractFormat, extractKbps);
      const baseName = videoFile.name.replace(/\.[^/.]+$/, "");
      const outputFilename = extractRangeMode === "clip"
        ? `${baseName}_clip_${formatDuration(extractStartTime).replace(":", "m")}-${formatDuration(extractEndTime).replace(":", "m")}.${ext}`
        : `${baseName}_audio.${ext}`;
      setExtractResult({
        blob,
        filename: outputFilename,
        duration: buffer.duration,
        url: URL.createObjectURL(blob),
      });
    } catch (err: any) {
      setError((lang === "en" ? "Video audio extraction failed: " : "视频提取音频失败，请确认视频包含有效声轨: ") + err.message);
    } finally {
      setIsProcessing(false);
      setProgressMsg("");
    }
  };

  // ================= 5. 音量调节与清晰度 =================
  const handleVolumeFileSelected = async (file: File) => {
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

      const { blob, ext } = await exportAudioBuffer(adjusted, "mp3", 320);
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

  // ================= 6. 音频倍速与倒放处理 =================
  const handleSpeedFileSelected = async (file: File) => {
    setSpeedFile(file);
    setSpeedResult(null);
    setIsProcessing(true);
    setProgressMsg(lang === "en" ? "Loading audio for tempo/speed..." : "正在载入音频波形...");
    try {
      const buf = await decodeAudioFile(file);
      setSpeedBuffer(buf);
    } catch (err: any) {
      setError((lang === "en" ? "Failed to load audio: " : "加载音频失败: ") + err.message);
    } finally {
      setIsProcessing(false);
      setProgressMsg("");
    }
  };

  const handleExecuteSpeed = async () => {
    if (!speedBuffer || !speedFile) return;
    setIsProcessing(true);
    setProgressMsg(lang === "en" ? "Applying speed adjustment & rendering..." : "正在进行离线硬件级音频倍速与倒放渲染...");
    setError(null);

    try {
      let processed = await changeAudioSpeed(speedBuffer, speedPlaybackRate);
      if (speedIsReversed) {
        processed = reverseAudioBuffer(processed);
      }
      const { blob, ext } = await exportAudioBuffer(processed, speedFormat, speedKbps);
      const baseName = speedFile.name.replace(/\.[^/.]+$/, "");
      const tag = `${speedPlaybackRate}x${speedIsReversed ? "_reversed" : ""}`;
      const outputFilename = `${baseName}_${tag}.${ext}`;
      setSpeedResult({
        blob,
        filename: outputFilename,
        duration: processed.duration,
        url: URL.createObjectURL(blob),
      });
    } catch (err: any) {
      setError((lang === "en" ? "Speed change failed: " : "音频变速/倒放失败: ") + err.message);
    } finally {
      setIsProcessing(false);
      setProgressMsg("");
    }
  };

  // ================= 7. 卡拉OK伴奏提取处理 =================
  const handleKaraokeFileSelected = async (file: File) => {
    setKaraokeFile(file);
    setKaraokeResult(null);
    setIsProcessing(true);
    setProgressMsg(lang === "en" ? "Analyzing audio stereo phase..." : "正在解析立体声声场与中央声道...");
    try {
      const buf = await decodeAudioFile(file);
      setKaraokeBuffer(buf);
    } catch (err: any) {
      setError((lang === "en" ? "Failed to load song: " : "加载歌曲失败: ") + err.message);
    } finally {
      setIsProcessing(false);
      setProgressMsg("");
    }
  };

  useEffect(() => {
    if (incomingFile) {
      if (activeTab === "convert") {
        setConvertFiles((prev) => [...prev, incomingFile]);
      } else if (activeTab === "trim") {
        handleTrimFileSelected(incomingFile);
      } else if (activeTab === "extract") {
        handleVideoFileSelected(incomingFile);
      } else if (activeTab === "volume") {
        handleVolumeFileSelected(incomingFile);
      } else if (activeTab === "speed") {
        handleSpeedFileSelected(incomingFile);
      } else if (activeTab === "karaoke") {
        handleKaraokeFileSelected(incomingFile);
      }
      onIncomingFileHandled?.();
    }
  }, [incomingFile, activeTab]);

  const handleExecuteKaraoke = async () => {
    if (!karaokeBuffer || !karaokeFile) return;
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
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* 7 大功能 Tab 切换 (支持鼠标滚轮横移、鼠标拖拽滑动、专属微滑轨与左右翻页箭头) */}
      <ScrollableTabNav
        tabs={[
          {
            id: "trim",
            label: lang === "en" ? "Waveform Trim & Ringtone" : "波形剪辑与铃声",
            icon: Scissors,
            badge: lang === "en" ? "Precise Preview" : "毫秒级试听",
          },
          {
            id: "convert",
            label: lang === "en" ? "Audio Converter" : "音频万能转码",
            icon: RefreshCw,
            badge: "MP3/WAV/FLAC",
          },
          {
            id: "merge",
            label: lang === "en" ? "Audio Merger" : "多音频无缝拼接",
            icon: Combine,
            badge: lang === "en" ? "Multi-track" : "多轨合并",
          },
          {
            id: "extract",
            label: lang === "en" ? "Extract from Video" : "视频提取纯音频",
            icon: Film,
            badge: lang === "en" ? "Video to MP3" : "MP4秒提MP3",
          },
          {
            id: "volume",
            label: lang === "en" ? "Volume & Voice Clarity" : "音量放大与人声增强",
            icon: Volume2,
            badge: lang === "en" ? "Anti-clipping & Clear" : "防破音&清晰化",
          },
          {
            id: "speed",
            label: lang === "en" ? "Speed & Reverse" : "变速变调与倒放",
            icon: Clock,
            badge: "0.5x-2.0x / Reverse",
          },
          {
            id: "karaoke",
            label: lang === "en" ? "Vocal Cut (Karaoke)" : "伴奏提取与消人声",
            icon: Mic,
            badge: lang === "en" ? "Stereo Cut" : "立体声消人声",
          },
        ]}
        activeTab={activeTab}
        onTabChange={(id) => handleTabSelect(id as AudioToolTab)}
      />

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
                  {lang === "en" ? "Click or drag audio file here to trim" : "点击或拖拽上传音频文件进行波形剪辑"}
                </div>
                <div className="text-xs text-coconut-600 dark:text-darkbg-muted">
                  {lang === "en"
                    ? "Supports MP3, WAV, FLAC, AAC, M4A, OGG and other audio formats"
                    : "支持 MP3, WAV, FLAC, AAC, M4A, OGG 等全部音乐格式"}
                </div>
              </div>
            </div>
          ) : (
            <div className="coconut-panel p-5 sm:p-6 space-y-6">
              {/* 文件信息与重新选择 */}
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

              {/* 交互式波形画布 */}
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

              {/* 快捷选区预设 */}
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

              {/* 播放控制与淡入淡出参数 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-5 sm:p-6 bg-coconut-50/70 dark:bg-darkbg-subtle rounded-2xl border border-coconut-200/70 dark:border-darkbg-border">
                {/* 试听控制 */}
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

                {/* 自然淡入淡出调节 */}
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

              {/* 导出配置与按钮 */}
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

          {/* 截取试听与下载卡片 */}
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
      )}

      {/* ================= 2. 音频万能转码面板 ================= */}
      {activeTab === "convert" && (
        <div className="space-y-5">
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
            className="border-2 border-dashed border-[#D2BCAB] dark:border-[#4D392E] hover:border-amber-500 dark:hover:border-amber-400 bg-[#FAF1E8]/75 dark:bg-[#251E1A]/70 hover:bg-[#F4E6D8]/85 dark:hover:bg-[#2E2520] rounded-3xl p-8 text-center cursor-pointer transition-all duration-300 shadow-2xs select-none"
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
                {lang === "en" ? "Click or drag audio files here" : "点击或拖拽多个音频文件至此处"}
              </div>
              <div className="text-xs text-coconut-600 dark:text-darkbg-muted">
                {lang === "en"
                  ? "Supports MP3, WAV, AAC, M4A, OGG, FLAC, etc."
                  : "支持 MP3, WAV, AAC, M4A, OGG, FLAC 等"}
              </div>
            </div>
          </div>

          {/* 待转码文件列表 */}
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

              {/* 批量并发队列进度监控面板 */}
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

          {/* 转码结果展示 */}
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
      )}

      {/* ================= 3. 多音频无缝拼接合并面板 ================= */}
      {activeTab === "merge" && (
        <div className="space-y-5">
          <div className="coconut-panel p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-coconut-200/60 dark:border-darkbg-border">
              <div>
                <h3 className="text-sm font-bold text-coconut-900 dark:text-darkbg-text">
                  {lang === "en"
                    ? `Audio Merge Queue (${mergeTracks.length} tracks)`
                    : `多段音频拼接队列 (${mergeTracks.length} 段)`}
                </h3>
                <p className="text-xs text-coconut-600 dark:text-darkbg-muted mt-0.5">
                  {lang === "en"
                    ? "Reorder audio clips as needed. Audio streams will be seamlessly concatenated and resampled."
                    : "上下调整音频先后顺序，算法将自动统一对齐重采样无缝首尾连接"}
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
                {lang === "en" ? "+ Add Audio Clips" : "+ 添加音频片段"}
              </button>
            </div>

            {mergeTracks.length === 0 ? (
              <div
                onClick={() => document.getElementById("merge-upload-input")?.click()}
                className="border-2 border-dashed border-[#D2BCAB] dark:border-[#4D392E] hover:border-amber-500 dark:hover:border-amber-400 rounded-3xl p-10 text-center cursor-pointer transition-all bg-[#FAF1E8]/75 dark:bg-[#251E1A]/70 hover:bg-[#F4E6D8]/85"
              >
                <Combine className="w-8 h-8 text-coconut-400 dark:text-darkbg-muted mx-auto mb-2" />
                <div className="text-xs text-coconut-600 dark:text-darkbg-muted">
                  {lang === "en" ? "Click to add two or more audio clips to merge" : "点击添加两段或多段音频开始拼接"}
                </div>
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
                          {lang === "en" ? "Duration: " : "时长: "}
                          {formatDuration(track.duration || 0)} · {lang === "en" ? "Size: " : "大小: "}
                          {formatBytes(track.size)}
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
                        title={lang === "en" ? "Move Up" : "上移"}
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
                        title={lang === "en" ? "Move Down" : "下移"}
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setMergeTracks((prev) => prev.filter((_, i) => i !== idx))}
                        className="p-1 text-rose-400 hover:text-rose-600 ml-2"
                        title={lang === "en" ? "Remove" : "移除"}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}

                <div className="flex items-center justify-between pt-4 border-t border-coconut-100 dark:border-darkbg-border">
                  <div className="text-xs text-coconut-600 dark:text-darkbg-muted font-mono">
                    {lang === "en" ? "Estimated Total Duration: " : "合并总时长预计: "}
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
                      <option value="wav" className="dark:bg-darkbg-card dark:text-darkbg-text">
                        {lang === "en" ? "WAV (Lossless CD)" : "WAV (CD级无损)"}
                      </option>
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
                          <span>{lang === "en" ? "Merging..." : "正在合并中..."}</span>
                        </>
                      ) : (
                        <>
                          <Combine className="w-4 h-4" />
                          <span>{lang === "en" ? "Start Merge" : "开始无损合并"}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 合并试听与下载卡片 */}
          {mergeResult && (
            <div className="coconut-panel p-5 space-y-4 animate-fade-in">
              <div className="flex items-center justify-between pb-3 border-b border-coconut-100 dark:border-darkbg-border">
                <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{lang === "en" ? "Audio Merging Complete!" : "音频拼接合并成功！"}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <SendToButton
                    compact
                    category="audio"
                    payload={{
                      blob: mergeResult.blob,
                      filename: mergeResult.filename,
                      sourceTitle: lang === "en" ? "Audio Merge" : "音频拼接",
                    }}
                    lang={lang}
                  />
                  <button
                    onClick={() => downloadBlob(mergeResult.blob, mergeResult.filename)}
                    className="px-4 py-2 btn-3d-sunset text-white rounded-xl text-xs font-bold flex items-center space-x-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{lang === "en" ? "Download Merged Audio" : "立即下载合并音频"}</span>
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs text-coconut-700 dark:text-darkbg-text font-mono">
                  <span className="truncate max-w-[280px] sm:max-w-md font-semibold">{mergeResult.filename}</span>
                  <span>{formatDuration(mergeResult.duration)} · {formatBytes(mergeResult.blob.size)}</span>
                </div>
                <audio controls src={mergeResult.url} className="w-full h-10 rounded-lg" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= 4. 视频提取纯音频面板 ================= */}
      {activeTab === "extract" && (
        <div className="space-y-5">
          <div className="coconut-panel p-5 sm:p-6 space-y-4">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-coconut-900 dark:text-darkbg-text">
                {lang === "en" ? "Extract Audio from Video" : "视频提取纯音频"}
              </h3>
              <p className="text-xs sm:text-sm text-coconut-600 dark:text-darkbg-muted mt-1 leading-relaxed">
                {lang === "en"
                  ? "Supports MP4, MOV, WebM, MKV and other video formats. Rapidly extract high-fidelity MP3 / WAV audio tracks."
                  : "支持 MP4, MOV, WebM, MKV 等常见视频格式，快速提取高保真 MP3 / WAV 纯音频音轨。"}
              </p>
            </div>

            {!videoFile ? (
              <div
                onClick={() => document.getElementById("video-extract-upload")?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleVideoFileSelected(e.dataTransfer.files[0]);
                  }
                }}
                className="border-2 border-dashed border-[#D2BCAB] dark:border-[#4D392E] hover:border-amber-500 dark:hover:border-amber-400 rounded-3xl p-10 text-center cursor-pointer transition-all bg-[#FAF1E8]/75 dark:bg-[#251E1A]/70 hover:bg-[#F4E6D8]/85"
              >
                <input
                  id="video-extract-upload"
                  type="file"
                  accept="video/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleVideoFileSelected(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />
                <Film className="w-10 h-10 text-toast-500 mx-auto mb-2" />
                <div className="text-sm sm:text-base font-bold text-coconut-900 dark:text-darkbg-text">
                  {lang === "en" ? "Click or drag video file here" : "点击或拖拽视频文件至此处"}
                </div>
                <div className="text-xs text-coconut-600 dark:text-darkbg-muted mt-1">
                  {lang === "en"
                    ? "Supports MP4, MOV, WebM, MKV and other common video formats"
                    : "支持 MP4, MOV, WebM, MKV 等常见视频格式"}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3 bg-coconut-50/70 dark:bg-darkbg-subtle rounded-2xl border border-coconut-200/70 dark:border-darkbg-border flex items-center justify-between">
                  <div className="truncate pr-2">
                    <span className="text-xs font-semibold text-coconut-900 dark:text-darkbg-text truncate block">
                      {videoFile.name}
                    </span>
                    <span className="text-[10px] text-coconut-600 dark:text-darkbg-muted font-mono">
                      {formatBytes(videoFile.size)}
                      {videoDuration > 0 && ` · ${formatDuration(videoDuration)}`}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setVideoFile(null);
                      setVideoPreviewUrl("");
                      setVideoDuration(0);
                      setExtractResult(null);
                    }}
                    className="text-xs text-coconut-600 hover:text-coconut-900 dark:text-darkbg-muted dark:hover:text-darkbg-text flex-shrink-0"
                  >
                    {lang === "en" ? "Change Video" : "更换视频"}
                  </button>
                </div>

                {videoPreviewUrl && (
                  <div className="rounded-2xl overflow-hidden bg-black/90 max-h-64 flex items-center justify-center border border-coconut-200 dark:border-darkbg-border">
                    <video
                      src={videoPreviewUrl}
                      controls
                      className="w-full max-h-64 object-contain"
                    />
                  </div>
                )}

                {/* 提取范围选择 */}
                <div className="space-y-3 p-4 bg-coconut-50/60 dark:bg-darkbg-subtle rounded-2xl border border-coconut-200/60 dark:border-darkbg-border">
                  <div className="flex items-center justify-between text-xs sm:text-sm font-semibold text-coconut-900 dark:text-darkbg-text">
                    <span>{lang === "en" ? "Extraction Range:" : "音频提取范围:"}</span>
                    <div className="flex space-x-1.5">
                      <button
                        onClick={() => setExtractRangeMode("full")}
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                          extractRangeMode === "full"
                            ? "bg-coconut-800 text-coconut-50 dark:bg-white dark:text-zinc-950 shadow-sm"
                            : "bg-coconut-100 dark:bg-darkbg-elevated text-coconut-700 dark:text-darkbg-muted"
                        }`}
                      >
                        {lang === "en" ? "Full Video" : "完整音轨"}
                      </button>
                      <button
                        onClick={() => setExtractRangeMode("clip")}
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                          extractRangeMode === "clip"
                            ? "bg-coconut-800 text-coconut-50 dark:bg-white dark:text-zinc-950 shadow-sm"
                            : "bg-coconut-100 dark:bg-darkbg-elevated text-coconut-700 dark:text-darkbg-muted"
                        }`}
                      >
                        {lang === "en" ? "Custom Clip" : "截取片段"}
                      </button>
                    </div>
                  </div>

                  {extractRangeMode === "clip" && videoDuration > 0 && (
                    <div className="space-y-2 pt-2 border-t border-coconut-100 dark:border-darkbg-border">
                      <div className="flex justify-between text-xs text-coconut-700 dark:text-darkbg-muted font-mono">
                        <span>{lang === "en" ? "Start: " : "起点: "}{formatDuration(extractStartTime)}</span>
                        <span className="text-toast-500 font-bold">
                          {lang === "en" ? "Clip Length: " : "截取时长: "}{formatDuration(Math.max(0, extractEndTime - extractStartTime))}
                        </span>
                        <span>{lang === "en" ? "End: " : "终点: "}{formatDuration(extractEndTime)}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] text-coconut-600 dark:text-darkbg-muted block mb-1">
                            {lang === "en" ? "Start (seconds)" : "开始秒数"}
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={videoDuration}
                            step="0.5"
                            value={extractStartTime}
                            onChange={(e) => setExtractStartTime(Math.max(0, Math.min(parseFloat(e.target.value) || 0, extractEndTime - 0.5)))}
                            className="w-full px-3 py-1.5 bg-white dark:bg-darkbg-card border border-coconut-200 dark:border-darkbg-border rounded-xl text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-coconut-600 dark:text-darkbg-muted block mb-1">
                            {lang === "en" ? "End (seconds)" : "结束秒数"}
                          </label>
                          <input
                            type="number"
                            min={extractStartTime + 0.5}
                            max={videoDuration}
                            step="0.5"
                            value={extractEndTime}
                            onChange={(e) => setExtractEndTime(Math.min(videoDuration, Math.max(extractStartTime + 0.5, parseFloat(e.target.value) || videoDuration)))}
                            className="w-full px-3 py-1.5 bg-white dark:bg-darkbg-card border border-coconut-200 dark:border-darkbg-border rounded-xl text-xs font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center space-x-3 text-sm">
                    <span className="text-coconut-900 dark:text-darkbg-text font-bold">
                      {lang === "en" ? "Export Audio Format:" : "导出音频格式:"}
                    </span>
                    {(["mp3", "wav"] as const).map((fmt) => (
                      <button
                        key={fmt}
                        onClick={() => setExtractFormat(fmt)}
                        className={`px-3.5 py-1.5 rounded-xl font-bold uppercase transition-all active:scale-95 text-xs sm:text-sm ${
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
                        <span>{lang === "en" ? "Extracting audio track..." : "正在极速剥离提取中..."}</span>
                      </>
                    ) : (
                      <>
                        <Film className="w-4 h-4" />
                        <span>{lang === "en" ? "Extract Audio Track" : "提取纯音频音轨"}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 视频提取试听与下载卡片 */}
          {extractResult && (
            <div className="coconut-panel p-5 space-y-4 animate-fade-in">
              <div className="flex items-center justify-between pb-3 border-b border-coconut-100 dark:border-darkbg-border">
                <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{lang === "en" ? "Audio Extraction Complete!" : "视频音频剥离成功！"}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <SendToButton
                    compact
                    category="audio"
                    payload={{
                      blob: extractResult.blob,
                      filename: extractResult.filename,
                      sourceTitle: lang === "en" ? "Video Audio Extract" : "视频音频剥离",
                    }}
                    lang={lang}
                  />
                  <button
                    onClick={() => downloadBlob(extractResult.blob, extractResult.filename)}
                    className="px-4 py-2 btn-3d-sunset text-white rounded-xl text-xs font-bold flex items-center space-x-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{lang === "en" ? "Download Audio" : "立即下载音频"}</span>
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs text-coconut-700 dark:text-darkbg-text font-mono">
                  <span className="truncate max-w-[280px] sm:max-w-md font-semibold">{extractResult.filename}</span>
                  <span>{formatDuration(extractResult.duration)} · {formatBytes(extractResult.blob.size)}</span>
                </div>
                <audio controls src={extractResult.url} className="w-full h-10 rounded-lg" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= 5. 音量放大与标准化面板 ================= */}
      {activeTab === "volume" && (
        <div className="space-y-5">
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
                      <span>{lang === "en" ? "Manual Gain Boost" : "手动强力增益放大"}</span>
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

                {/* 播客/会议人声清晰度增强与杂音过滤 */}
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
                        <span>{lang === "en" ? "Applying enhancement..." : "正在处理增强..."}</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-4 h-4" />
                        <span>{lang === "en" ? "Enhance Audio" : "开始增强处理"}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 音量与清晰度处理结果卡片 */}
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
      )}

      {/* ================= 6. 音频倍速与倒放处理面板 ================= */}
      {activeTab === "speed" && (
        <div className="space-y-5">
          <div className="coconut-panel p-5 sm:p-6 space-y-5">
            <div>
              <h3 className="text-base font-bold text-coconut-900 dark:text-darkbg-text">
                {lang === "en" ? "Audio Speed & Reverse Playback" : "音频变速变调与倒放处理"}
              </h3>
              <p className="text-xs text-coconut-600 dark:text-darkbg-muted mt-1">
                {lang === "en"
                  ? "Change tempo/playback speed (0.5x to 2.0x) or reverse the entire audio for creative sound design and meme effects."
                  : "支持 0.5x 到 2.0x 任意倍速调节，或将整首歌曲/人声从尾到头逆向倒放，制作趣味反向音效。"}
              </p>
            </div>

            {!speedBuffer ? (
              <div
                onClick={() => document.getElementById("speed-upload-input")?.click()}
                className="border-2 border-dashed border-[#D2BCAB] dark:border-[#4D392E] hover:border-amber-500 dark:hover:border-amber-400 rounded-3xl p-10 text-center cursor-pointer transition-all bg-[#FAF1E8]/75 dark:bg-[#251E1A]/70 hover:bg-[#F4E6D8]/85"
              >
                <input
                  id="speed-upload-input"
                  type="file"
                  accept="audio/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleSpeedFileSelected(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />
                <Clock className="w-10 h-10 text-toast-500 mx-auto mb-2" />
                <div className="text-sm sm:text-base font-bold text-coconut-900 dark:text-darkbg-text">
                  {lang === "en" ? "Click or drag audio file here for speed/reverse" : "点击或拖拽上传音频调节倍速/倒放"}
                </div>
                <div className="text-xs text-coconut-600 dark:text-darkbg-muted mt-1">
                  {lang === "en" ? "Supports MP3, WAV, AAC, OGG, FLAC and more" : "支持 MP3, WAV, AAC, OGG, FLAC 等主流音频格式"}
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="p-3 bg-coconut-50/70 dark:bg-darkbg-subtle rounded-2xl border border-coconut-200/70 dark:border-darkbg-border flex items-center justify-between">
                  <div className="truncate pr-2">
                    <span className="text-xs font-semibold text-coconut-900 dark:text-darkbg-text truncate block">
                      {speedFile?.name}
                    </span>
                    <span className="text-[10px] text-coconut-600 dark:text-darkbg-muted font-mono">
                      {speedFile && formatBytes(speedFile.size)} · {formatDuration(speedBuffer.duration)}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setSpeedBuffer(null);
                      setSpeedFile(null);
                      setSpeedResult(null);
                    }}
                    className="text-xs text-coconut-600 hover:text-coconut-900 dark:text-darkbg-muted dark:hover:text-darkbg-text flex-shrink-0"
                  >
                    {lang === "en" ? "Change File" : "更换文件"}
                  </button>
                </div>

                {/* 速度调节 */}
                <div className="space-y-3 p-4 bg-coconut-50/60 dark:bg-darkbg-subtle rounded-2xl border border-coconut-200/60 dark:border-darkbg-border">
                  <div className="flex justify-between items-center text-xs sm:text-sm font-semibold text-coconut-900 dark:text-darkbg-text">
                    <span>{lang === "en" ? "Playback Speed / Tempo:" : "播放倍速调节:"}</span>
                    <span className="font-mono text-sm font-bold text-toast-500">{speedPlaybackRate.toFixed(2)}x</span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {[0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0].map((rate) => (
                      <button
                        key={rate}
                        onClick={() => setSpeedPlaybackRate(rate)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                          speedPlaybackRate === rate
                            ? "bg-coconut-800 text-coconut-50 dark:bg-white dark:text-zinc-950 shadow-sm"
                            : "bg-white dark:bg-darkbg-card border border-coconut-200 dark:border-darkbg-border text-coconut-700 dark:text-darkbg-muted"
                        }`}
                      >
                        {rate}x
                      </button>
                    ))}
                  </div>

                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.05"
                    value={speedPlaybackRate}
                    onChange={(e) => setSpeedPlaybackRate(parseFloat(e.target.value))}
                    className="w-full h-2 bg-coconut-200 dark:bg-darkbg-border rounded-lg appearance-none cursor-pointer accent-coconut-700 dark:accent-palm-400"
                  />
                  <div className="flex justify-between text-[10px] text-coconut-600 dark:text-darkbg-muted font-mono">
                    <span>0.5x ({lang === "en" ? "Slow" : "慢速"})</span>
                    <span>1.0x ({lang === "en" ? "Original" : "原速"})</span>
                    <span>2.0x ({lang === "en" ? "Fast" : "快速"})</span>
                  </div>
                </div>

                {/* 倒放选项 */}
                <label className="flex items-center space-x-3 p-4 rounded-2xl bg-coconut-50/60 dark:bg-darkbg-subtle border border-coconut-200/60 dark:border-darkbg-border cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={speedIsReversed}
                    onChange={(e) => setSpeedIsReversed(e.target.checked)}
                    className="rounded accent-palm-600 dark:accent-palm-400 w-4 h-4"
                  />
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-coconut-900 dark:text-darkbg-text">
                      {lang === "en" ? "Reverse Audio (Play Backwards)" : "音频完全倒放 (Reverse Audio)"}
                    </div>
                    <div className="text-[11px] text-coconut-600 dark:text-darkbg-muted mt-0.5">
                      {lang === "en"
                        ? "Inverts the entire audio timeline from end to beginning. Can be combined with speed changes."
                        : "将整段音频时间轴从结尾逆向颠倒至开头，适合趣味搞怪、解密音效或反转倒放效果制作。"}
                    </div>
                  </div>
                </label>

                {/* 导出配置与按钮 */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                  <div className="flex items-center space-x-3 text-sm">
                    <span className="text-coconut-900 dark:text-darkbg-text font-bold">
                      {lang === "en" ? "Export Format:" : "导出格式:"}
                    </span>
                    {(["mp3", "wav"] as const).map((fmt) => (
                      <button
                        key={fmt}
                        onClick={() => setSpeedFormat(fmt)}
                        className={`px-3.5 py-1.5 rounded-xl font-bold uppercase transition-all active:scale-95 text-xs sm:text-sm ${
                          speedFormat === fmt
                            ? "bg-coconut-800 text-coconut-50 dark:bg-white dark:text-zinc-950 font-bold shadow-sm"
                            : "bg-coconut-100/70 dark:bg-darkbg-subtle text-coconut-700 dark:text-darkbg-muted hover:dark:text-darkbg-text border border-transparent dark:border-darkbg-border"
                        }`}
                      >
                        {fmt}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={handleExecuteSpeed}
                    disabled={isProcessing}
                    className={`w-full sm:w-auto px-7 py-3 rounded-2xl text-xs font-bold flex items-center justify-center space-x-2 transition-all ${
                      isProcessing
                        ? "bg-coconut-100 dark:bg-darkbg-subtle text-coconut-400 dark:text-darkbg-muted cursor-not-allowed border border-coconut-200 dark:border-darkbg-border"
                        : "btn-3d-sunset text-white"
                    }`}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{lang === "en" ? "Rendering audio..." : "正在高速渲染中..."}</span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-4 h-4" />
                        <span>{lang === "en" ? "Render Speed / Reverse" : "开始倍速/倒放处理"}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 倍速/倒放结果卡片 */}
          {speedResult && (
            <div className="coconut-panel p-5 space-y-4 animate-fade-in">
              <div className="flex items-center justify-between pb-3 border-b border-coconut-100 dark:border-darkbg-border">
                <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{lang === "en" ? "Speed / Reverse Processing Complete!" : "倍速/倒放音频生成完成！"}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <SendToButton
                    compact
                    category="audio"
                    payload={{
                      blob: speedResult.blob,
                      filename: speedResult.filename,
                      sourceTitle: lang === "en" ? "Audio Speed" : "音频变速",
                    }}
                    lang={lang}
                  />
                  <button
                    onClick={() => downloadBlob(speedResult.blob, speedResult.filename)}
                    className="px-4 py-2 btn-3d-sunset text-white rounded-xl text-xs font-bold flex items-center space-x-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{lang === "en" ? "Download Audio" : "立即下载音频"}</span>
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs text-coconut-700 dark:text-darkbg-text font-mono">
                  <span className="truncate max-w-[280px] sm:max-w-md font-semibold">{speedResult.filename}</span>
                  <span>{formatDuration(speedResult.duration)} · {formatBytes(speedResult.blob.size)}</span>
                </div>
                <audio controls src={speedResult.url} className="w-full h-10 rounded-lg" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= 7. 卡拉OK伴奏提取面板 ================= */}
      {activeTab === "karaoke" && (
        <div className="space-y-5">
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
                className="border-2 border-dashed border-[#D2BCAB] dark:border-[#4D392E] hover:border-amber-500 dark:hover:border-amber-400 rounded-3xl p-10 text-center cursor-pointer transition-all bg-[#FAF1E8]/75 dark:bg-[#251E1A]/70 hover:bg-[#F4E6D8]/85"
              >
                <input
                  id="karaoke-upload-input"
                  type="file"
                  accept="audio/*"
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

                {/* 低频保真调节 */}
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
                    className="w-full h-2 bg-coconut-200 dark:bg-darkbg-border rounded-lg appearance-none cursor-pointer accent-coconut-700 dark:accent-palm-400"
                  />
                  <p className="text-[11px] text-coconut-600 dark:text-darkbg-muted leading-relaxed">
                    {lang === "en"
                      ? "💡 Preserves lower frequencies (<180Hz) to keep the rhythm section and bassline punchy, avoiding a hollow or tinny backing track."
                      : "💡 避免单纯相消导致伴奏发空变薄。系统会自动提取此频率以下的低频低音并混合回伴奏，保留强劲节拍感。"}
                  </p>
                </div>

                {/* 导出配置与按钮 */}
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
                    disabled={isProcessing}
                    className={`w-full sm:w-auto px-7 py-3 rounded-2xl text-xs font-bold flex items-center justify-center space-x-2 transition-all ${
                      isProcessing
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

          {/* 卡拉OK伴奏结果卡片 */}
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
