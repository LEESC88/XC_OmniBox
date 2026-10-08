"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Film,
  Download,
  Loader2,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Play,
  Pause,
  Clock,
  ShieldCheck,
} from "lucide-react";
import {
  decodeAudioFile,
  trimAudioBuffer,
  exportAudioBuffer,
  formatDuration,
} from "@/lib/audioProcessor";
import { formatBytes } from "@/lib/imageProcessor";
import { downloadBlob } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import SendToButton from "@/components/SendToButton";
import { AudioStudioProps } from "./types";

export default function AudioExtractStudio({
  isActive = true,
  incomingFile,
  onIncomingFileHandled,
}: AudioStudioProps) {
  const { lang } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [hasAudioTrack, setHasAudioTrack] = useState(true);
  const [isPlayingClip, setIsPlayingClip] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [extractRangeMode, setExtractRangeMode] = useState<"full" | "clip">("full");
  const [extractStartTime, setExtractStartTime] = useState(0);
  const [extractEndTime, setExtractEndTime] = useState(0);
  const [extractFormat, setExtractFormat] = useState<"mp3" | "wav">("mp3");
  const [extractKbps, setExtractKbps] = useState(320);
  const [extractResult, setExtractResult] = useState<{ blob: Blob; filename: string; duration: number; url: string } | null>(null);

  // Clean up Object URLs
  useEffect(() => {
    return () => {
      if (videoPreviewUrl) {
        URL.revokeObjectURL(videoPreviewUrl);
      }
      if (extractResult?.url) {
        URL.revokeObjectURL(extractResult.url);
      }
    };
  }, [videoPreviewUrl, extractResult?.url]);

  // Video clip preview monitor
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      if (isPlayingClip && video.currentTime >= extractEndTime) {
        video.pause();
        setIsPlayingClip(false);
      }
    };

    const handleEndedOrPause = () => {
      setIsPlayingClip(false);
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("pause", handleEndedOrPause);
    video.addEventListener("ended", handleEndedOrPause);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("pause", handleEndedOrPause);
      video.removeEventListener("ended", handleEndedOrPause);
    };
  }, [isPlayingClip, extractEndTime]);

  // Handle incoming file
  useEffect(() => {
    if (isActive && incomingFile) {
      handleVideoFileSelected(incomingFile);
      onIncomingFileHandled?.();
    }
  }, [isActive, incomingFile]);

  const handleVideoFileSelected = async (file: File) => {
    setVideoFile(file);
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    setVideoPreviewUrl(URL.createObjectURL(file));
    setExtractResult(null);
    setError(null);
    setIsProcessing(true);
    setProgressMsg(lang === "en" ? "Analyzing video soundtrack..." : "正在分析视频音频流与时长...");
    try {
      const buf = await decodeAudioFile(file);
      if (!buf || buf.duration <= 0) {
        throw new Error(lang === "en" ? "Empty or silent audio track detected" : "未检测到有效声音轨道");
      }
      setHasAudioTrack(true);
      setVideoDuration(buf.duration);
      setExtractStartTime(0);
      setExtractEndTime(+buf.duration.toFixed(1));
    } catch (err: any) {
      console.warn("Could not pre-decode video audio", err);
      setHasAudioTrack(false);
      setVideoDuration(0);
      setError(
        lang === "en"
          ? "No playable audio track found in this video file (it may be a muted video or the audio codec is unsupported)."
          : "该视频未检测到可播放的有效声轨（可能为静音视频或音频编码格式不支持），已阻断提取。"
      );
    } finally {
      setIsProcessing(false);
      setProgressMsg("");
    }
  };

  const togglePlayClip = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlayingClip) {
      video.pause();
      setIsPlayingClip(false);
    } else {
      video.currentTime = Math.max(0, Math.min(extractStartTime, videoDuration));
      video.play().then(() => {
        setIsPlayingClip(true);
      }).catch((err) => {
        console.warn("Auto-play failed:", err);
      });
    }
  };

  const handleSetStartTimeFromVideo = () => {
    const video = videoRef.current;
    if (!video) return;
    const cur = +video.currentTime.toFixed(1);
    setExtractStartTime(Math.max(0, Math.min(cur, Math.max(0, extractEndTime - 0.5))));
  };

  const handleSetEndTimeFromVideo = () => {
    const video = videoRef.current;
    if (!video) return;
    const cur = +video.currentTime.toFixed(1);
    const validCur = Math.min(videoDuration > 0 ? videoDuration : cur, cur);
    setExtractEndTime(Math.max(extractStartTime + 0.5, validCur));
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
            className="group relative overflow-hidden border-2 border-dashed border-[#D2BCAB]/70 dark:border-[#4D392E]/60 hover:border-amber-500/70 dark:hover:border-amber-500/70 bg-gradient-to-b from-[#FBF8F4]/80 to-[#F5ECE1]/60 dark:from-[#211713]/70 dark:to-[#18110D]/70 hover:from-[#FFFDF9] hover:to-[#FDF4EB] dark:hover:from-[#291D17] dark:hover:to-[#1F1511] rounded-3xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-300 shadow-sm hover:shadow-lg hover:shadow-amber-900/5 select-none"
          >
            <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[radial-gradient(circle_at_50%_40%,rgba(245,158,11,0.08),transparent_65%)]" />
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
            <div className="relative flex flex-col items-center space-y-3.5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center group-hover:scale-105 group-hover:-translate-y-0.5 transition-all duration-300 shadow-md shadow-orange-500/25">
                <Film className="w-7 h-7" />
              </div>
              <div>
                <div className="text-base font-bold text-coconut-900 dark:text-darkbg-text tracking-tight group-hover:text-amber-800 dark:group-hover:text-amber-300 transition-colors">
                  {lang === "en" ? "Click or drag video file here" : "点击或拖拽视频文件至此处"}
                </div>
                <div className="text-xs text-coconut-600 dark:text-darkbg-muted mt-1 max-w-md mx-auto">
                  {lang === "en"
                    ? "Supports MP4, MOV, WebM, MKV and other common video formats"
                    : "支持 MP4, MOV, WebM, MKV 等常见视频格式"}
                </div>
              </div>
              <div className="flex items-center flex-wrap justify-center gap-2 pt-1 text-[11px] font-medium text-coconut-600 dark:text-darkbg-muted">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-coconut-100/70 dark:bg-darkbg-card border border-coconut-200/80 dark:border-darkbg-border">
                  ⚡ 原生无损音轨解复用
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  100% 本地沙盒保密
                </span>
              </div>
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
                  if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
                  setVideoPreviewUrl(null);
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
                  ref={videoRef}
                  src={videoPreviewUrl}
                  controls
                  className="w-full max-h-64 object-contain"
                />
              </div>
            )}

            {!hasAudioTrack && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 rounded-xl flex items-center space-x-2 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  {lang === "en"
                    ? "Notice: This video has no valid audio track. Audio extraction is disabled."
                    : "提示：该视频未检测到有效声音轨道（纯静音视频或编码不兼容），提取已自动阻断。"}
                </span>
              </div>
            )}

            {/* Extraction range controls */}
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
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-coconut-700 dark:text-darkbg-muted font-mono">
                    <span>{lang === "en" ? "Start: " : "起点: "}{formatDuration(extractStartTime)}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-toast-500 font-bold">
                        {lang === "en" ? "Clip: " : "截取: "}{formatDuration(Math.max(0, extractEndTime - extractStartTime))}
                      </span>
                      <button
                        type="button"
                        onClick={togglePlayClip}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-sans font-medium bg-coconut-200/70 dark:bg-darkbg-elevated text-coconut-800 dark:text-darkbg-text hover:bg-toast-500/20 active:scale-95 transition-all"
                        title={lang === "en" ? "Preview this clip in video player" : "在播放器中试听截取区间"}
                      >
                        {isPlayingClip ? <Pause className="w-3 h-3 text-toast-500" /> : <Play className="w-3 h-3 text-toast-500" />}
                        <span>{isPlayingClip ? (lang === "en" ? "Pause" : "暂停") : (lang === "en" ? "Preview Clip" : "区间试听")}</span>
                      </button>
                    </div>
                    <span>{lang === "en" ? "End: " : "终点: "}{formatDuration(extractEndTime)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] text-coconut-600 dark:text-darkbg-muted">
                          {lang === "en" ? "Start (seconds)" : "开始秒数"}
                        </label>
                        <button
                          type="button"
                          onClick={handleSetStartTimeFromVideo}
                          className="text-[10px] text-toast-600 dark:text-toast-400 hover:underline flex items-center gap-0.5"
                          title={lang === "en" ? "Sync from video current playhead" : "吸附视频当前播放点"}
                        >
                          <Clock className="w-2.5 h-2.5" />
                          <span>{lang === "en" ? "Current Time" : "设为当前时刻"}</span>
                        </button>
                      </div>
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
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] text-coconut-600 dark:text-darkbg-muted">
                          {lang === "en" ? "End (seconds)" : "结束秒数"}
                        </label>
                        <button
                          type="button"
                          onClick={handleSetEndTimeFromVideo}
                          className="text-[10px] text-toast-600 dark:text-toast-400 hover:underline flex items-center gap-0.5"
                          title={lang === "en" ? "Sync from video current playhead" : "吸附视频当前播放点"}
                        >
                          <Clock className="w-2.5 h-2.5" />
                          <span>{lang === "en" ? "Current Time" : "设为当前时刻"}</span>
                        </button>
                      </div>
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
                disabled={isProcessing || !hasAudioTrack || !!error}
                className={`px-6 py-3 rounded-2xl text-xs font-bold flex items-center space-x-2 transition-all ${
                  isProcessing || !hasAudioTrack || !!error
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

      {/* Extract result card */}
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
  );
}
