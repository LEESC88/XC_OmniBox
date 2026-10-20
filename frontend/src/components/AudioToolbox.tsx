"use client";

import React, { useState, useEffect } from "react";
import {
  Scissors,
  RefreshCw,
  Combine,
  Film,
  Volume2,
  Clock,
  Mic,
} from "lucide-react";
import ScrollableTabNav from "@/components/ScrollableTabNav";
import { useI18n } from "@/lib/i18n";
import {
  AudioToolTab,
  AudioTrimStudio,
  AudioConvertStudio,
  AudioMergeStudio,
  AudioExtractStudio,
  AudioVolumeStudio,
  AudioSpeedStudio,
} from "@/components/audio";

export type { AudioToolTab };

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

  useEffect(() => {
    if (currentTab && currentTab !== activeTab) {
      setActiveTab(currentTab);
    }
  }, [currentTab]);

  const handleTabSelect = (tab: AudioToolTab) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-5 animate-fade-in">
      <ScrollableTabNav
        tabs={[
          {
            id: "trim",
            label: lang === "en" ? "Trim Audio" : "音频剪辑",
            icon: Scissors,
          },
          {
            id: "convert",
            label: lang === "en" ? "Audio Converter" : "格式转换",
            icon: RefreshCw,
          },
          {
            id: "merge",
            label: lang === "en" ? "Merge Audio" : "音频合并",
            icon: Combine,
          },
          {
            id: "extract",
            label: lang === "en" ? "Extract Audio" : "提取视频音频",
            icon: Film,
          },
          {
            id: "volume",
            label: lang === "en" ? "Volume & Clarity" : "音量与降噪",
            icon: Volume2,
          },
          {
            id: "speed",
            label: lang === "en" ? "Playback Speed" : "音频变速",
            icon: Clock,
          },
        ]}
        activeTab={activeTab}
        onTabChange={(id) => handleTabSelect(id as AudioToolTab)}
      />

      {/* 当前音频工具标题与简介 (与 PDF / 图像工坊对齐) */}
      <div className="coconut-panel p-5 sm:p-6">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-md shadow-orange-500/25 flex items-center justify-center text-white flex-shrink-0">
            {activeTab === "trim" && <Scissors className="w-5 h-5 sm:w-6 sm:h-6" />}
            {activeTab === "convert" && <RefreshCw className="w-5 h-5 sm:w-6 sm:h-6" />}
            {activeTab === "merge" && <Combine className="w-5 h-5 sm:w-6 sm:h-6" />}
            {activeTab === "extract" && <Film className="w-5 h-5 sm:w-6 sm:h-6" />}
            {activeTab === "volume" && <Volume2 className="w-5 h-5 sm:w-6 sm:h-6" />}
            {activeTab === "speed" && <Clock className="w-5 h-5 sm:w-6 sm:h-6" />}
          </div>
          <div className="space-y-1">
            <h3 className="text-base sm:text-lg font-extrabold text-coconut-900 dark:text-darkbg-text tracking-tight">
              {activeTab === "trim" && (lang === "en" ? "Waveform Audio Trimmer" : "可视化音频波形剪辑")}
              {activeTab === "convert" && (lang === "en" ? "Universal Audio Converter" : "音频万能格式转码")}
              {activeTab === "merge" && (lang === "en" ? "Multi-Track Audio Stitcher" : "多音频无缝拼接与合并")}
              {activeTab === "extract" && (lang === "en" ? "Video to Audio Extractor" : "视频提取纯音频")}
              {activeTab === "volume" && (lang === "en" ? "Audio Volume Booster & Normalizer" : "音量放大与标准化")}
              {activeTab === "speed" && (lang === "en" ? "Audio Tempo & Speed Adjustment" : "音频播放速度与调速")}
            </h3>
            <p className="text-xs text-coconut-600 dark:text-darkbg-muted leading-relaxed max-w-xl">
              {activeTab === "trim" && (lang === "en" ? "Interactive waveform view with millisecond precision, fade in/out curves, and one-click ringtone export." : "可视化音频波形拖拽选取，毫秒级精细裁剪，支持淡入淡出曲线调节与手机铃声快速导出。")}
              {activeTab === "convert" && (lang === "en" ? "Batch convert between MP3, WAV, AAC, M4A, FLAC, and OGG formats with customizable bitrates." : "支持 MP3、WAV、AAC、M4A、FLAC、OGG 等常见音频格式批量互转，自由调节码率与采样率。")}
              {activeTab === "merge" && (lang === "en" ? "Join multiple songs or voice recordings sequentially with crossfade and custom ordering." : "多音频文件拖拽调序，首尾无缝平滑拼接，支持无损快速拼合成单一连续音轨。")}
              {activeTab === "extract" && (lang === "en" ? "Extract high quality audio tracks from MP4, MKV, MOV, and AVI videos without re-encoding." : "深入 MP4、MOV、MKV、AVI 等视频文件，免重编码无损分离并提取高清纯背景音乐或人声音频。")}
              {activeTab === "volume" && (lang === "en" ? "Normalize uneven volume levels across files, boost quiet speech, and prevent audio clipping." : "智能提升微弱录音人声音量，EBU R128 音量标准化均衡，自带动态峰值抗破音保护。")}
              {activeTab === "speed" && (lang === "en" ? "Adjust audio playback speed from 0.5x to 2.0x while preserving natural pitch." : "支持 0.5x 至 2.0x 变速播放与快速导出，智能音高修正保持人声自然不尖锐。")}
            </p>
          </div>
        </div>
      </div>

      {/* 1. Waveform Trim Studio */}
      <div className={activeTab === "trim" ? "block" : "hidden"}>
        <AudioTrimStudio
          isActive={activeTab === "trim"}
          incomingFile={incomingFile}
          onIncomingFileHandled={onIncomingFileHandled}
        />
      </div>

      {/* 2. Format Converter Studio */}
      <div className={activeTab === "convert" ? "block" : "hidden"}>
        <AudioConvertStudio
          isActive={activeTab === "convert"}
          incomingFile={incomingFile}
          onIncomingFileHandled={onIncomingFileHandled}
        />
      </div>

      {/* 3. Audio Track Merge Studio */}
      <div className={activeTab === "merge" ? "block" : "hidden"}>
        <AudioMergeStudio
          isActive={activeTab === "merge"}
          incomingFile={incomingFile}
          onIncomingFileHandled={onIncomingFileHandled}
        />
      </div>

      {/* 4. Video to Audio Extraction Studio */}
      <div className={activeTab === "extract" ? "block" : "hidden"}>
        <AudioExtractStudio
          isActive={activeTab === "extract"}
          incomingFile={incomingFile}
          onIncomingFileHandled={onIncomingFileHandled}
        />
      </div>

      {/* 5. Volume Normalization & Voice Clarity Studio */}
      <div className={activeTab === "volume" ? "block" : "hidden"}>
        <AudioVolumeStudio
          isActive={activeTab === "volume"}
          incomingFile={incomingFile}
          onIncomingFileHandled={onIncomingFileHandled}
        />
      </div>

      {/* 6. Speed Studio */}
      <div className={activeTab === "speed" ? "block" : "hidden"}>
        <AudioSpeedStudio
          isActive={activeTab === "speed"}
          incomingFile={incomingFile}
          onIncomingFileHandled={onIncomingFileHandled}
        />
      </div>
    </div>
  );
}
