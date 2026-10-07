"use client";

import React from "react";
import { useI18n } from "@/lib/i18n";

export interface HeicSettingsProps {
  heicTargetFormat: "image/jpeg" | "image/png";
  onHeicTargetFormatChange: (format: "image/jpeg" | "image/png") => void;
  heicQuality: number;
  onHeicQualityChange: (quality: number) => void;
}

export default function HeicSettings({
  heicTargetFormat,
  onHeicTargetFormatChange,
  heicQuality,
  onHeicQualityChange,
}: HeicSettingsProps) {
  const { lang } = useI18n();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
      <div className="space-y-2">
        <span className="text-sm text-coconut-900 dark:text-darkbg-text font-semibold">
          {lang === "en" ? "Target Format" : "转换目标格式"}
        </span>
        <div className="flex space-x-3">
          {[
            {
              value: "image/jpeg" as const,
              label: "JPG / JPEG",
              desc: lang === "en" ? "Maximum compatibility, smaller size" : "兼容性最高，文件较小",
            },
            {
              value: "image/png" as const,
              label: lang === "en" ? "PNG Native" : "PNG 原图",
              desc: lang === "en" ? "Lossless, preserves transparency & crisp details" : "无损保留透明度与极清细节",
            },
          ].map((opt) => (
            <label
              key={opt.value}
              className={`flex-1 flex flex-col p-3.5 rounded-2xl border cursor-pointer transition-all ${
                heicTargetFormat === opt.value
                  ? "border-palm-600 dark:border-palm-400 bg-palm-50/50 dark:bg-palm-950/30 text-coconut-950 dark:text-darkbg-text ring-2 ring-palm-500/20 shadow-coconut-sm"
                  : "border-coconut-200 dark:border-darkbg-border text-coconut-700 dark:text-darkbg-muted hover:border-coconut-300 dark:hover:border-darkbg-borderLight"
              }`}
            >
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  name="heicFormat"
                  checked={heicTargetFormat === opt.value}
                  onChange={() => onHeicTargetFormatChange(opt.value)}
                  className="accent-palm-600 dark:accent-palm-400"
                />
                <span className="font-semibold text-sm text-coconut-900 dark:text-darkbg-text">{opt.label}</span>
              </div>
              <span className="text-xs text-coconut-600 dark:text-darkbg-muted mt-1 leading-relaxed">{opt.desc}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-coconut-900 dark:text-darkbg-text font-semibold">
            {lang === "en" ? "Output Quality Clarity" : "输出画质清晰度"}
          </span>
          <span className="text-coconut-900 dark:text-toast-400 font-bold">{Math.round(heicQuality * 100)}%</span>
        </div>
        <input
          type="range"
          min="0.5"
          max="1.0"
          step="0.05"
          value={heicQuality}
          onChange={(e) => onHeicQualityChange(parseFloat(e.target.value))}
          className="w-full h-2 bg-coconut-200 dark:bg-darkbg-border rounded-lg appearance-none cursor-pointer accent-coconut-700 dark:accent-palm-400"
        />
        <p className="text-xs text-coconut-600 dark:text-darkbg-muted leading-relaxed">
          {lang === "en"
            ? "Directly decompresses & transcodes iPhone HEIC photos locally in seconds"
            : "苹果 iPhone 实拍 HEIC 照片直接在本地解压渲染，秒级转码"}
        </p>
      </div>
    </div>
  );
}
