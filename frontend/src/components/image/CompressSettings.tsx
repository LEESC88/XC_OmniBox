"use client";

import React from "react";
import { useI18n } from "@/lib/i18n";

export interface CompressSettingsProps {
  compressQuality: number;
  onCompressQualityChange: (quality: number) => void;
  compressMaxResolution: number;
  onCompressMaxResolutionChange: (resolution: number) => void;
  compressTargetSizeMB: number;
  onCompressTargetSizeMBChange: (sizeMB: number) => void;
}

export default function CompressSettings({
  compressQuality,
  onCompressQualityChange,
  compressMaxResolution,
  onCompressMaxResolutionChange,
  compressTargetSizeMB,
  onCompressTargetSizeMBChange,
}: CompressSettingsProps) {
  const { lang } = useI18n();

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-1">
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-coconut-900 dark:text-darkbg-text font-semibold">
            {lang === "en" ? "Compression Quality" : "压缩质量"}
          </span>
          <span className="text-coconut-900 dark:text-toast-400 font-bold">
            {Math.round(compressQuality * 100)}%
          </span>
        </div>
        <input
          type="range"
          min="0.1"
          max="0.95"
          step="0.05"
          value={compressQuality}
          onChange={(e) => onCompressQualityChange(parseFloat(e.target.value))}
          className="w-full h-2 bg-coconut-200 dark:bg-darkbg-border rounded-lg appearance-none cursor-pointer accent-coconut-700 dark:accent-palm-400"
        />
        <p className="text-xs text-coconut-600 dark:text-darkbg-muted leading-relaxed">
          {lang === "en"
            ? "Recommended 70%~85%, visually indistinguishable, reduces size by 60%~80%"
            : "推荐 70%~85%，肉眼几乎无失真，体积降低 60%~80%"}
        </p>
      </div>

      <div className="space-y-2">
        <span className="text-sm text-coconut-900 dark:text-darkbg-text font-semibold">
          {lang === "en" ? "Max Resolution Limit" : "最大分辨率限制"}
        </span>
        <select
          value={compressMaxResolution}
          onChange={(e) => onCompressMaxResolutionChange(parseInt(e.target.value))}
          className="w-full px-3.5 py-2 text-sm bg-white/70 dark:bg-darkbg-subtle border border-coconut-300/80 dark:border-darkbg-border rounded-xl text-coconut-900 dark:text-darkbg-text focus:outline-none focus:border-palm-500 shadow-2xs"
        >
          <option value={4096} className="dark:bg-darkbg-card dark:text-darkbg-text">
            {lang === "en" ? "Original Size (Max 4096px)" : "保持原图大尺寸 (最大 4096px)"}
          </option>
          <option value={2560} className="dark:bg-darkbg-card dark:text-darkbg-text">
            {lang === "en" ? "2K Common Large (Max 2560px)" : "2K 常见大图 (最大 2560px)"}
          </option>
          <option value={1920} className="dark:bg-darkbg-card dark:text-darkbg-text">
            {lang === "en" ? "1080P Full HD (Max 1920px)" : "1080P 高清 (最大 1920px)"}
          </option>
          <option value={1280} className="dark:bg-darkbg-card dark:text-darkbg-text">
            {lang === "en" ? "Fast Web Loading (Max 1280px)" : "网页极速加载 (最大 1280px)"}
          </option>
        </select>
        <p className="text-xs text-coconut-600 dark:text-darkbg-muted leading-relaxed">
          {lang === "en"
            ? "Auto-resampled proportionally when exceeding this limit"
            : "超过此分辨率将自动等比例重采样"}
        </p>
      </div>

      <div className="space-y-2">
        <span className="text-sm text-coconut-900 dark:text-darkbg-text font-semibold">
          {lang === "en" ? "Target File Size Cap" : "目标体积上限"}
        </span>
        <select
          value={compressTargetSizeMB}
          onChange={(e) => onCompressTargetSizeMBChange(parseFloat(e.target.value))}
          className="w-full px-3.5 py-2 text-sm bg-white/70 dark:bg-darkbg-subtle border border-coconut-300/80 dark:border-darkbg-border rounded-xl text-coconut-900 dark:text-darkbg-text focus:outline-none focus:border-palm-500 shadow-2xs"
        >
          <option value={0.5} className="dark:bg-darkbg-card dark:text-darkbg-text">
            {lang === "en" ? "Ultra Compact (≤ 500 KB)" : "极度精简 (≤ 500 KB)"}
          </option>
          <option value={1} className="dark:bg-darkbg-card dark:text-darkbg-text">
            {lang === "en" ? "Daily Sharing (≤ 1 MB)" : "日常分享 (≤ 1 MB)"}
          </option>
          <option value={2} className="dark:bg-darkbg-card dark:text-darkbg-text">
            {lang === "en" ? "Standard HD (≤ 2 MB)" : "标准高清 (≤ 2 MB)"}
          </option>
          <option value={5} className="dark:bg-darkbg-card dark:text-darkbg-text">
            {lang === "en" ? "Print Quality (≤ 5 MB)" : "大图印刷 (≤ 5 MB)"}
          </option>
        </select>
        <p className="text-xs text-coconut-600 dark:text-darkbg-muted leading-relaxed">
          {lang === "en" ? "Prioritizes size constraint" : "优先兼顾文件大小上限约束"}
        </p>
      </div>
    </div>
  );
}
