"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Combine,
  ArrowUp,
  ArrowDown,
  Trash2,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Play,
  Square,
} from "lucide-react";
import {
  decodeAudioFile,
  concatAudioBuffers,
  exportAudioBuffer,
  formatDuration,
  getAudioContext,
} from "@/lib/audioProcessor";
import { formatBytes } from "@/lib/imageProcessor";
import { downloadBlob } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import SendToButton from "@/components/SendToButton";
import { BatchTaskItem, executeBatchQueue } from "@/lib/batchQueueManager";
import { MergeTrack, AudioStudioProps } from "./types";

export default function AudioMergeStudio({
  isActive = true,
  incomingFile,
  onIncomingFileHandled,
}: AudioStudioProps) {
  const { lang } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");

  const [mergeTracks, setMergeTracks] = useState<MergeTrack[]>([]);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const trackSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const [mergeFormat, setMergeFormat] = useState<"mp3" | "wav">("mp3");
  const [mergeKbps, setMergeKbps] = useState(320);
  const [mergeResult, setMergeResult] = useState<{ blob: Blob; filename: string; duration: number; url: string } | null>(null);

  // Clean up Object URL & Audio Source
  useEffect(() => {
    return () => {
      trackSourceRef.current?.stop();
      if (mergeResult?.url) {
        URL.revokeObjectURL(mergeResult.url);
      }
    };
  }, [mergeResult?.url]);

  const togglePlayTrack = (track: MergeTrack) => {
    if (playingTrackId === track.id) {
      trackSourceRef.current?.stop();
      trackSourceRef.current = null;
      setPlayingTrackId(null);
      return;
    }
    trackSourceRef.current?.stop();
    if (!track.buffer) return;
    const ctx = getAudioContext();
    if (ctx.state === "suspended") ctx.resume();
    const src = ctx.createBufferSource();
    src.buffer = track.buffer;
    src.connect(ctx.destination);
    src.onended = () => {
      setPlayingTrackId(null);
      trackSourceRef.current = null;
    };
    src.start(0);
    trackSourceRef.current = src;
    setPlayingTrackId(track.id);
  };

  // Handle incoming file
  useEffect(() => {
    if (isActive && incomingFile) {
      handleSingleIncomingFile(incomingFile);
      onIncomingFileHandled?.();
    }
  }, [isActive, incomingFile]);

  const handleSingleIncomingFile = async (file: File) => {
    setIsProcessing(true);
    setProgressMsg(lang === "en" ? "Decoding audio track..." : "正在解析音轨数据...");
    try {
      const buf = await decodeAudioFile(file);
      const newTrack: MergeTrack = {
        id: `track_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        file,
        name: file.name,
        size: file.size,
        duration: buf.duration,
        buffer: buf,
      };
      setMergeTracks((prev) => [...prev, newTrack]);
    } catch (err: any) {
      setError(err?.message || (lang === "en" ? "Failed to decode incoming audio" : "解析传入音频失败"));
    } finally {
      setIsProcessing(false);
      setProgressMsg("");
    }
  };

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
            accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac,.aac,.wma"
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
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (e.dataTransfer.files) {
                handleAddMergeTracks(e.dataTransfer.files);
              }
            }}
            className="border-2 border-dashed border-[#D2BCAB] dark:border-[#4D392E] hover:border-amber-500 dark:hover:border-amber-400 rounded-3xl p-10 text-center cursor-pointer transition-all bg-[#FAF1E8]/75 dark:bg-[#251E1A]/70 hover:bg-[#F4E6D8]/85"
          >
            <Combine className="w-8 h-8 text-coconut-400 dark:text-darkbg-muted mx-auto mb-2" />
            <div className="text-sm font-semibold text-coconut-800 dark:text-darkbg-text mb-1">
              {lang === "en" ? "Drag or click to add audio clips to merge" : "点击或拖拽添加两段或多段音频开始拼接"}
            </div>
            <div className="text-xs text-coconut-500 dark:text-darkbg-muted">
              {lang === "en" ? "Supports MP3, WAV, AAC, M4A, FLAC, OGG" : "支持 MP3, WAV, AAC, M4A, FLAC, OGG 等常见格式"}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {mergeTracks.map((track, idx) => (
              <div
                key={track.id}
                className="flex items-center justify-between p-3 bg-coconut-50/70 dark:bg-darkbg-subtle border border-coconut-200/70 dark:border-darkbg-border rounded-2xl"
              >
                <div className="flex items-center space-x-3 truncate pr-2">
                  <span className="w-5 h-5 rounded-full bg-coconut-200/80 dark:bg-darkbg-elevated text-coconut-800 dark:text-darkbg-text font-bold text-xs flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => togglePlayTrack(track)}
                    title={playingTrackId === track.id ? (lang === "en" ? "Stop" : "停止") : (lang === "en" ? "Audition Track" : "试听此音轨")}
                    className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all shrink-0 ${
                      playingTrackId === track.id
                        ? "bg-amber-500 text-white shadow-xs animate-pulse"
                        : "bg-coconut-200/70 dark:bg-darkbg-card hover:bg-coconut-300 dark:hover:bg-darkbg-hover text-coconut-800 dark:text-darkbg-text"
                    }`}
                  >
                    {playingTrackId === track.id ? (
                      <Square className="w-3.5 h-3.5 fill-current" />
                    ) : (
                      <Play className="w-3.5 h-3.5 ml-0.5 fill-current" />
                    )}
                  </button>
                  <div className="truncate">
                    <div className="text-xs font-semibold text-coconut-900 dark:text-darkbg-text truncate">{track.name}</div>
                    <div className="text-[10px] text-coconut-600 dark:text-darkbg-muted font-mono">
                      {lang === "en" ? "Duration: " : "时长: "}
                      {formatDuration(track.duration || 0)} · {lang === "en" ? "Size: " : "大小: "}
                      {formatBytes(track.size)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-1 shrink-0">
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
                    onClick={() => {
                      if (playingTrackId === track.id) {
                        trackSourceRef.current?.stop();
                        setPlayingTrackId(null);
                      }
                      setMergeTracks((prev) => prev.filter((_, i) => i !== idx));
                    }}
                    className="p-1 text-rose-400 hover:text-rose-600 ml-2"
                    title={lang === "en" ? "Remove" : "移除"}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            {/* 追加拖拽区 */}
            <div
              onClick={() => document.getElementById("merge-upload-input")?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (e.dataTransfer.files) {
                  handleAddMergeTracks(e.dataTransfer.files);
                }
              }}
              className="p-3 border border-dashed border-coconut-300/80 dark:border-darkbg-border hover:border-amber-500/80 rounded-2xl text-center text-xs text-coconut-600 dark:text-darkbg-muted cursor-pointer transition-all hover:bg-coconut-50/50 dark:hover:bg-darkbg-subtle"
            >
              + {lang === "en" ? "Drag or click to append more audio tracks" : "拖入或点击追加更多音频片段"}
            </div>

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
                  disabled={isProcessing || mergeTracks.length < 2}
                  className={`px-6 py-2.5 rounded-2xl text-xs font-bold flex items-center space-x-1.5 transition-all ${
                    isProcessing || mergeTracks.length < 2
                      ? "bg-coconut-100 dark:bg-darkbg-subtle text-coconut-400 dark:text-darkbg-muted cursor-not-allowed border border-coconut-200 dark:border-darkbg-border"
                      : "btn-3d-sunset text-white"
                  }`}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{lang === "en" ? "Merging..." : "正在合并中..."}</span>
                    </>
                  ) : mergeTracks.length < 2 ? (
                    <>
                      <Combine className="w-4 h-4" />
                      <span>{lang === "en" ? "Need at least 2 tracks" : "请至少添加 2 段音频"}</span>
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

      {/* Merged result card */}
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
  );
}
