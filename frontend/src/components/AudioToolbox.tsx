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
