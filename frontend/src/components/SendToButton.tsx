import React, { useState, useRef, useEffect } from "react";
import {
  Share2,
  ChevronDown,
  Sparkles,
  Image as ImageIcon,
  FileText,
  Volume2,
  Scissors,
  RefreshCw,
  Stamp,
  Maximize2,
  UserCheck,
  Captions,
  Diff,
  Layers,
  Mic,
} from "lucide-react";
import { toolBus, ToolTarget, ToolTransferPayload } from "../lib/toolBus";

interface SendToButtonProps {
  payload: ToolTransferPayload;
  category: "image" | "audio" | "text";
  compact?: boolean;
  className?: string;
  lang?: "zh" | "en";
}

interface DestinationOption {
  label: string;
  labelEn: string;
  desc: string;
  descEn: string;
  icon: React.ComponentType<{ className?: string }>;
  target: ToolTarget;
}

export default function SendToButton({
  payload,
  category,
  compact = false,
  className = "",
  lang = "zh",
}: SendToButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const imageOptions: DestinationOption[] = [
    {
      label: "证件照工坊 (智能换底)",
      labelEn: "ID Photo Studio",
      desc: "一键更换红白蓝底色与尺寸规格",
      descEn: "Change background color and specs",
      icon: UserCheck,
      target: { module: "utilities", tab: "idphoto" },
    },
    {
      label: "智能图片压缩",
      labelEn: "Smart Image Compression",
      desc: "体积瘦身并保留超清画质",
      descEn: "Reduce file size with high visual quality",
      icon: ImageIcon,
      target: { module: "image", tab: "compress" },
    },
    {
      label: "格式批量转换",
      labelEn: "Format Converter",
      desc: "转为 WebP, PNG, JPG, ICO 等",
      descEn: "Convert to WebP, PNG, JPG, ICO",
      icon: RefreshCw,
      target: { module: "image", tab: "convert" },
    },
    {
      label: "AI 消除笔 / 智能修图",
      labelEn: "AI Inpaint / Erase",
      desc: "无痕擦除水印、杂物与路人",
      descEn: "Erase watermarks, objects and passersby",
      icon: Sparkles,
      target: { module: "ai", tab: "ai-inpaint" },
    },
    {
      label: "AI 模糊图片高清修复",
      labelEn: "AI Image Upscale",
      desc: "2x / 4x 超分辨率重建与锐化",
      descEn: "2x / 4x super-resolution and sharpening",
      icon: Maximize2,
      target: { module: "ai", tab: "ai-upscale" },
    },
    {
      label: "AI 智能抠图",
      labelEn: "AI Background Removal",
      desc: "发丝级人像与主体透明提取",
      descEn: "Transparent portrait and subject cutout",
      icon: Scissors,
      target: { module: "ai", tab: "ai-bg-remove" },
    },
    {
      label: "批量水印工坊",
      labelEn: "Batch Watermark",
      desc: "添加防盗水印与专属品牌 Logo",
      descEn: "Add copyright watermarks and logo stamps",
      icon: Stamp,
      target: { module: "image", tab: "watermark" },
    },
  ];

  const audioOptions: DestinationOption[] = [
    {
      label: "音频波形精细裁剪",
      labelEn: "Audio Precision Trim",
      desc: "微秒级裁剪与淡入淡出",
      descEn: "Millisecond trim with fade in/out",
      icon: Scissors,
      target: { module: "audio", tab: "trim" },
    },
    {
      label: "音频多段无缝拼接",
      labelEn: "Multi-Track Audio Merge",
      desc: "自动对其采样率并合并多音轨",
      descEn: "Align sample rates and merge clips",
      icon: Layers,
      target: { module: "audio", tab: "merge" },
    },
    {
      label: "音频格式转码 (MP3/WAV)",
      labelEn: "Audio Format Transcode",
      desc: "调整比特率与导出标准格式",
      descEn: "Adjust bitrate and export MP3/WAV",
      icon: RefreshCw,
      target: { module: "audio", tab: "convert" },
    },
    {
      label: "人声与伴奏分离 (Karaoke)",
      labelEn: "Vocal / Accompaniment Split",
      desc: "中心声道对消提取伴奏与人声",
      descEn: "Center channel cancellation for karaoke",
      icon: Mic,
      target: { module: "audio", tab: "karaoke" },
    },
    {
      label: "音量均衡与增益增强",
      labelEn: "Volume Normalizer",
      desc: "响度均衡与防爆音限幅",
      descEn: "Loudness normalization & soft clipping",
      icon: Volume2,
      target: { module: "audio", tab: "volume" },
    },
    {
      label: "AI 音视频字幕断句",
      labelEn: "AI Subtitle Generator",
      desc: "能量检测切片并导出 SRT/VTT",
      descEn: "VAD energy slicing to SRT/VTT",
      icon: Captions,
      target: { module: "ai", tab: "ai-subtitle" },
    },
  ];

  const textOptions: DestinationOption[] = [
    {
      label: "文章对比 (发送至左侧原件)",
      labelEn: "Article Diff (Original / Left)",
      desc: "置于左侧作为比对基准",
      descEn: "Set as baseline text on left side",
      icon: Diff,
      target: { module: "utilities", tab: "diff", targetSide: "original" },
    },
    {
      label: "文章对比 (发送至右侧修改稿)",
      labelEn: "Article Diff (Modified / Right)",
      desc: "置于右侧查看修订与差异",
      descEn: "Set as revised text to see changes",
      icon: FileText,
      target: { module: "utilities", tab: "diff", targetSide: "modified" },
    },
  ];

  const currentOptions =
    category === "image"
      ? imageOptions
      : category === "audio"
      ? audioOptions
      : textOptions;

  const handleSelect = (dest: DestinationOption) => {
    toolBus.emit(dest.target, payload);
    setIsOpen(false);
  };

  return (
    <div className={`relative inline-block ${className}`} ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`rounded-xl flex items-center space-x-1.5 font-bold transition-all shadow-xs active:scale-95 ${
          compact
            ? "px-2.5 py-1.5 text-xs bg-coconut-100 hover:bg-coconut-200 dark:bg-darkbg-elevated dark:hover:bg-darkbg-border text-coconut-800 dark:text-darkbg-text"
            : "px-3.5 py-2 text-xs bg-palm-100/90 hover:bg-palm-200 dark:bg-palm-950/70 dark:hover:bg-palm-900/80 text-palm-800 dark:text-palm-300"
        }`}
        title={lang === "en" ? "Send to other tools" : "流转至其他工具继续处理"}
      >
        <Share2 className="w-3.5 h-3.5 text-palm-600 dark:text-palm-400" />
        <span>{lang === "en" ? "Send to..." : "发送至..."}</span>
        <ChevronDown className="w-3 h-3 text-coconut-500 dark:text-darkbg-muted" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 sm:w-80 rounded-2xl bg-white dark:bg-darkbg-card border border-coconut-200/90 dark:border-darkbg-border shadow-xl z-50 p-1.5 animate-scale-up">
          <div className="px-3 py-2 border-b border-coconut-100 dark:border-darkbg-border text-[11px] font-bold text-coconut-500 dark:text-darkbg-muted flex items-center justify-between">
            <span>{lang === "en" ? "Seamless Pipeline Chaining" : "跨工具流水线直达"}</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-palm-100 dark:bg-palm-950 text-palm-700 dark:text-palm-300 font-mono font-normal">
              0-Copy
            </span>
          </div>

          <div className="max-h-64 overflow-y-auto py-1 space-y-0.5">
            {currentOptions.map((opt, i) => {
              const Icon = opt.icon;
              return (
                <button
                  key={i}
                  onClick={() => handleSelect(opt)}
                  className="w-full text-left p-2 rounded-xl hover:bg-coconut-50 dark:hover:bg-darkbg-subtle transition-colors flex items-center space-x-2.5 group"
                >
                  <div className="w-7 h-7 rounded-lg bg-coconut-100 dark:bg-darkbg-elevated flex items-center justify-center text-coconut-700 dark:text-darkbg-text group-hover:bg-palm-500 group-hover:text-white transition-colors flex-shrink-0">
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-coconut-900 dark:text-darkbg-text truncate">
                      {lang === "en" ? opt.labelEn : opt.label}
                    </div>
                    <div className="text-[10px] text-coconut-500 dark:text-darkbg-muted truncate">
                      {lang === "en" ? opt.descEn : opt.desc}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
