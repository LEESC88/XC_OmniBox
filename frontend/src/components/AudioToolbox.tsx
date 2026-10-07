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
  AudioKaraokeStudio,
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
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* 7 Tab Navigation with scroll, drag, and buttons */}
      <ScrollableTabNav
        tabs={[
          {
            id: "trim",
            label: lang === "en" ? "Waveform Trim" : "可视化波形剪辑",
            icon: Scissors,
            badge: lang === "en" ? "Milliseconds / Ringtone" : "毫秒精度/做铃声",
          },
          {
            id: "convert",
            label: lang === "en" ? "Audio Converter" : "音频万能转码",
            icon: RefreshCw,
            badge: lang === "en" ? "Batch MP3/WAV" : "多格式并发转码",
          },
          {
            id: "merge",
            label: lang === "en" ? "Multi-Track Merge" : "音频无缝拼接",
            icon: Combine,
            badge: lang === "en" ? "Lossless Stitching" : "多曲混排首尾接",
          },
          {
            id: "extract",
            label: lang === "en" ? "Video to Audio" : "视频提取纯音频",
            icon: Film,
            badge: lang === "en" ? "Lossless Demux" : "MP4/MOV提音乐",
          },
          {
            id: "volume",
            label: lang === "en" ? "Normalize & Boost" : "音量放大与标准化",
            icon: Volume2,
            badge: lang === "en" ? "Anti-Clipping / Voice" : "抗破音/提人声",
          },
          {
            id: "speed",
            label: lang === "en" ? "Tempo & Reverse" : "音频变速与倒放",
            icon: Clock,
            badge: lang === "en" ? "0.5x~2.0x / Reverse" : "趣味逆放/倍速",
          },
          {
            id: "karaoke",
            label: lang === "en" ? "Vocal Remover" : "伴奏提取消人声",
            icon: Mic,
            badge: lang === "en" ? "Center Cancellation" : "立体声相位抵消",
          },
        ]}
        activeTab={activeTab}
        onTabChange={(id) => handleTabSelect(id as AudioToolTab)}
      />

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

      {/* 6. Speed & Reverse Playback Studio */}
      <div className={activeTab === "speed" ? "block" : "hidden"}>
        <AudioSpeedStudio
          isActive={activeTab === "speed"}
          incomingFile={incomingFile}
          onIncomingFileHandled={onIncomingFileHandled}
        />
      </div>

      {/* 7. Karaoke Accompaniment Separation Studio */}
      <div className={activeTab === "karaoke" ? "block" : "hidden"}>
        <AudioKaraokeStudio
          isActive={activeTab === "karaoke"}
          incomingFile={incomingFile}
          onIncomingFileHandled={onIncomingFileHandled}
        />
      </div>
    </div>
  );
}
