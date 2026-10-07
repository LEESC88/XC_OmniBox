"use client";

import React from "react";
import { useI18n } from "@/lib/i18n";
import { ImagePresetItem } from "./types";

export type ResizeMode = "percent" | "custom" | "preset";
export type ResizeFitMode = "crop" | "pad" | "stretch";

export interface ResizeSettingsProps {
  resizeMode: ResizeMode;
  onResizeModeChange: (mode: ResizeMode) => void;
  resizePercent: number;
  onResizePercentChange: (percent: number) => void;
  customWidth: number | "";
  onCustomWidthChange: (width: number | "") => void;
  customHeight: number | "";
  onCustomHeightChange: (height: number | "") => void;
  lockAspect: boolean;
  onLockAspectChange: (lock: boolean) => void;
  selectedPreset: ImagePresetItem;
  onSelectedPresetChange: (preset: ImagePresetItem) => void;
  presets: readonly ImagePresetItem[];
  fitMode?: ResizeFitMode;
  onFitModeChange?: (mode: ResizeFitMode) => void;
  padBgColor?: string;
  onPadBgColorChange?: (color: string) => void;
}

export default function ResizeSettings({
  resizeMode,
  onResizeModeChange,
  resizePercent,
  onResizePercentChange,
  customWidth,
  onCustomWidthChange,
  customHeight,
  onCustomHeightChange,
  lockAspect,
  onLockAspectChange,
  selectedPreset,
  onSelectedPresetChange,
  presets,
  fitMode = "crop",
  onFitModeChange,
  padBgColor = "#FFFFFF",
  onPadBgColorChange,
}: ResizeSettingsProps) {
  const { lang } = useI18n();

  return (
    <div className="space-y-4 pt-1">
      <div className="flex space-x-3">
        {[
          { id: "percent" as const, label: lang === "en" ? "By Percentage" : "按百分比缩放" },
          {
            id: "preset" as const,
            label: lang === "en" ? "Specification Presets (ID/Social)" : "常用规格预设 (证件照/社交)",
          },
          { id: "custom" as const, label: lang === "en" ? "Custom Pixels (px)" : "自定义精确像素 (px)" },
        ].map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onResizeModeChange(m.id)}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all active:scale-95 ${
              resizeMode === m.id
                ? "bg-coconut-800 text-coconut-50 dark:bg-white dark:text-zinc-950 font-bold shadow-sm"
                : "bg-coconut-100/70 dark:bg-darkbg-subtle text-coconut-700 dark:text-darkbg-muted hover:bg-coconut-200/70 dark:hover:bg-darkbg-hover hover:dark:text-darkbg-text border border-transparent dark:border-darkbg-border"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {resizeMode === "percent" && (
        <div className="flex items-center space-x-3">
          {[25, 50, 75, 150, 200].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onResizePercentChange(p)}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all active:scale-95 ${
                resizePercent === p
                  ? "bg-coconut-800 text-coconut-50 dark:bg-white dark:text-zinc-950 font-bold shadow-sm"
                  : "bg-coconut-100/70 dark:bg-darkbg-subtle text-coconut-700 dark:text-darkbg-muted hover:bg-coconut-200/60 dark:hover:bg-darkbg-hover hover:dark:text-darkbg-text border border-transparent dark:border-darkbg-border"
              }`}
            >
              {p}% {lang === "en" ? "Scale" : "比例"}
            </button>
          ))}
        </div>
      )}

      {resizeMode === "preset" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {presets.map((pst) => (
            <button
              key={pst.name}
              type="button"
              onClick={() => onSelectedPresetChange(pst)}
              className={`text-left p-4 rounded-2xl border transition-all active:scale-[0.99] ${
                selectedPreset.name === pst.name
                  ? "border-palm-600 dark:border-palm-400 bg-palm-50/60 dark:bg-palm-950/30 text-coconut-900 dark:text-darkbg-text ring-2 ring-palm-500/20 shadow-coconut-sm"
                  : "border-coconut-200 dark:border-darkbg-border text-coconut-700 dark:text-darkbg-muted hover:border-coconut-300 dark:hover:border-darkbg-borderLight"
              }`}
            >
              <div className="font-bold text-sm text-coconut-900 dark:text-darkbg-text">
                {lang === "en" ? pst.nameEn : pst.name}
              </div>
              <div className="text-xs font-mono text-coconut-600 dark:text-darkbg-muted mt-1">
                {pst.width} × {pst.height} px
              </div>
              <div className="text-xs text-coconut-500 dark:text-darkbg-subtext mt-1">
                {lang === "en" ? pst.descEn : pst.desc}
              </div>
            </button>
          ))}
        </div>
      )}

      {resizeMode === "custom" && (
        <div className="flex items-center space-x-4 flex-wrap gap-y-3">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-coconut-900 dark:text-darkbg-text font-semibold">
              {lang === "en" ? "Width:" : "宽:"}
            </span>
            <input
              type="number"
              placeholder={lang === "en" ? "e.g. 800" : "例如 800"}
              value={customWidth}
              onChange={(e) => onCustomWidthChange(e.target.value ? parseInt(e.target.value) : "")}
              className="w-32 px-3.5 py-2 text-sm bg-white/70 dark:bg-darkbg-subtle border border-coconut-300/80 dark:border-darkbg-border rounded-xl text-coconut-900 dark:text-darkbg-text focus:outline-none focus:border-palm-500 shadow-2xs"
            />
            <span className="text-sm text-coconut-600 dark:text-darkbg-muted font-mono">px</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-coconut-900 dark:text-darkbg-text font-semibold">
              {lang === "en" ? "Height:" : "高:"}
            </span>
            <input
              type="number"
              placeholder={lang === "en" ? "e.g. 600" : "例如 600"}
              value={customHeight}
              onChange={(e) => onCustomHeightChange(e.target.value ? parseInt(e.target.value) : "")}
              className="w-32 px-3.5 py-2 text-sm bg-white/70 dark:bg-darkbg-subtle border border-coconut-300/80 dark:border-darkbg-border rounded-xl text-coconut-900 dark:text-darkbg-text focus:outline-none focus:border-palm-500 shadow-2xs"
            />
            <span className="text-sm text-coconut-600 dark:text-darkbg-muted font-mono">px</span>
          </div>
          <label className="flex items-center space-x-2 text-sm text-coconut-900 dark:text-darkbg-text cursor-pointer select-none">
            <input
              type="checkbox"
              checked={lockAspect}
              onChange={(e) => onLockAspectChange(e.target.checked)}
              className="rounded accent-palm-600 dark:accent-palm-400"
            />
            <span>{lang === "en" ? "Lock Aspect Ratio (Prevent distortion)" : "锁定等比例缩放 (防止变形)"}</span>
          </label>
        </div>
      )}

      {/* 缩放适应模式（防拉伸变形保护） */}
      {(resizeMode === "preset" || resizeMode === "custom") && (
        <div className="p-3.5 bg-coconut-100/50 dark:bg-darkbg-subtle rounded-2xl border border-coconut-200/80 dark:border-darkbg-border space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-coconut-900 dark:text-darkbg-text">
              {lang === "en" ? "Aspect Ratio Adaptation (Anti-Distortion)" : "比例适应策略 (杜绝画面变形拉伸)"}
            </span>
            <span className="text-[11px] text-palm-700 dark:text-palm-400 font-medium">
              {fitMode === "crop"
                ? lang === "en" ? "Cover Crop (No Distortion, Fills Frame)" : "居中裁切充满 (无畸变，满画幅)"
                : fitMode === "pad"
                ? lang === "en" ? "Contain Padding (No Distortion, Letterboxed)" : "等比留白 (无畸变，画面完整)"
                : lang === "en" ? "Forced Stretch (May distort)" : "强制拉伸充满 (注意：人物可能变形)"}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              {
                id: "crop" as const,
                label: lang === "en" ? "Crop (Cover)" : "等比裁切 (推荐)",
                desc: lang === "en" ? "Best for avatars & ID photos" : "头像/证件照推荐，无黑边无变形",
              },
              {
                id: "pad" as const,
                label: lang === "en" ? "Pad (Contain)" : "等比留白 (居中)",
                desc: lang === "en" ? "Preserves full image content" : "完整保留画面，边缘居中填充",
              },
              {
                id: "stretch" as const,
                label: lang === "en" ? "Stretch (Fill)" : "强制拉伸",
                desc: lang === "en" ? "Distorts to exact size" : "强行撑满指定宽高，可能变形",
              },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onFitModeChange?.(opt.id)}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  fitMode === opt.id
                    ? "bg-white dark:bg-darkbg-elevated border-palm-600 dark:border-palm-400 text-coconut-900 dark:text-darkbg-text ring-1 ring-palm-500/20 shadow-xs"
                    : "bg-transparent border-coconut-200/60 dark:border-darkbg-border text-coconut-600 dark:text-darkbg-muted hover:border-coconut-300"
                }`}
              >
                <div className="font-bold text-xs">{opt.label}</div>
                <div className="text-[10px] opacity-75 mt-0.5 line-clamp-1">{opt.desc}</div>
              </button>
            ))}
          </div>

          {fitMode === "pad" && (
            <div className="flex items-center space-x-2.5 pt-1">
              <span className="text-xs text-coconut-800 dark:text-darkbg-muted font-medium">
                {lang === "en" ? "Padding Fill Color:" : "留白底色:"}
              </span>
              <input
                type="color"
                value={padBgColor}
                onChange={(e) => onPadBgColorChange?.(e.target.value)}
                className="w-7 h-7 rounded-md border border-coconut-300 dark:border-darkbg-border cursor-pointer bg-transparent"
              />
              <span className="text-xs font-mono font-semibold text-coconut-700 dark:text-darkbg-muted">
                {padBgColor}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
