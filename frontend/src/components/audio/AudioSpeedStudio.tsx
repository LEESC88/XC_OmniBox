"use client";

import React, { useState, useEffect } from "react";
import {
  Clock,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import {
  decodeAudioFile,
  changeAudioSpeed,
  reverseAudioBuffer,
  exportAudioBuffer,
  formatDuration,
} from "@/lib/audioProcessor";
import { formatBytes } from "@/lib/imageProcessor";
import { downloadBlob } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import SendToButton from "@/components/SendToButton";
import { AudioStudioProps } from "./types";

export default function AudioSpeedStudio({
  isActive = true,
  incomingFile,
  onIncomingFileHandled,
}: AudioStudioProps) {
  const { lang } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");

  const [speedFile, setSpeedFile] = useState<File | null>(null);
  const [speedBuffer, setSpeedBuffer] = useState<AudioBuffer | null>(null);
  const [speedPlaybackRate, setSpeedPlaybackRate] = useState<number>(1.25);
  const [speedIsReversed, setSpeedIsReversed] = useState<boolean>(false);
  const [speedFormat, setSpeedFormat] = useState<"mp3" | "wav">("mp3");
  const [speedKbps, setSpeedKbps] = useState(320);
  const [speedResult, setSpeedResult] = useState<{ blob: Blob; filename: string; duration: number; url: string } | null>(null);

  // Clean up Object URL
  useEffect(() => {
    return () => {
      if (speedResult?.url) {
        URL.revokeObjectURL(speedResult.url);
      }
    };
  }, [speedResult?.url]);

  // Handle incoming file
  useEffect(() => {
    if (isActive && incomingFile) {
      handleSpeedFileSelected(incomingFile);
      onIncomingFileHandled?.();
    }
  }, [isActive, incomingFile]);

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

            {/* Speed rate controls */}
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

            {/* Reverse playback option */}
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

            {/* Export format & Action button */}
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

      {/* Speed result card */}
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
  );
}
