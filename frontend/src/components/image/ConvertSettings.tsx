"use client";

import React from "react";
import { useI18n } from "@/lib/i18n";

export type ConvertTargetFormat = "webp" | "avif" | "png" | "jpg" | "ico" | "bmp";

export interface ConvertSettingsProps {
  convertTarget: ConvertTargetFormat;
  onConvertTargetChange: (target: ConvertTargetFormat) => void;
  convertQuality: number;
  onConvertQualityChange: (quality: number) => void;
  convertBgColor: string;
  onConvertBgColorChange: (color: string) => void;
}

const SUPPORTED_FORMATS: readonly ConvertTargetFormat[] = ["webp", "avif", "png", "jpg", "ico", "bmp"];

export default function ConvertSettings({
  convertTarget,
  onConvertTargetChange,
  convertQuality,
  onConvertQualityChange,
  convertBgColor,
  onConvertBgColorChange,
}: ConvertSettingsProps) {
  const { lang } = useI18n();

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-1">
      <div className="space-y-2">
        <span className="text-sm text-coconut-900 dark:text-darkbg-text font-semibold">
          {lang === "en" ? "Target Output Format" : "目标输出格式"}
        </span>
        <div className="grid grid-cols-3 gap-2">
          {SUPPORTED_FORMATS.map((fmt) => (
            <button
              key={fmt}
              type="button"
              onClick={() => onConvertTargetChange(fmt)}
              className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold uppercase transition-all active:scale-95 ${
                convertTarget === fmt
                  ? "bg-coconut-800 text-coconut-50 dark:bg-white dark:text-zinc-950 font-bold shadow-sm"
                  : "bg-coconut-100/70 dark:bg-darkbg-subtle text-coconut-700 dark:text-darkbg-muted hover:bg-coconut-200/70 dark:hover:bg-darkbg-hover hover:dark:text-darkbg-text border border-transparent dark:border-darkbg-border"
              }`}
            >
              {fmt}
            </button>
          ))}
        </div>
        <p className="text-xs text-coconut-600 dark:text-darkbg-muted leading-relaxed">
          {convertTarget === "ico" &&
            (lang === "en"
              ? "Generates standard ICO favicon for Windows / websites"
              : "自动生成 Windows 软件/网站 favicon 标准 ICO 图标")}
          {convertTarget === "webp" &&
            (lang === "en"
              ? "Next-gen web format, half the size of JPG"
              : "下一代高压缩率网络图片格式，体积仅为 JPG 的一半")}
          {convertTarget === "avif" &&
            (lang === "en"
              ? "Cutting-edge AV1 image format, 20-30% smaller than WebP"
              : "新一代 AV1 图像格式，同等画质下比 WebP 再小 20%-30%")}
          {convertTarget === "png" &&
            (lang === "en" ? "Lossless high-fidelity transparent image" : "无损高保真透明图")}
          {convertTarget === "jpg" &&
            (lang === "en" ? "Universal web & print format" : "通用网络与打印图片")}
          {convertTarget === "bmp" &&
            (lang === "en" ? "Standard Windows uncompressed bitmap" : "标准 Windows 位图格式")}
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-coconut-900 dark:text-darkbg-text font-semibold">
            {lang === "en" ? "Output Quality" : "输出画质"}
          </span>
          <span className="text-coconut-900 dark:text-toast-400 font-bold">{Math.round(convertQuality * 100)}%</span>
        </div>
        <input
          type="range"
          min="0.3"
          max="1.0"
          step="0.05"
          value={convertQuality}
          onChange={(e) => onConvertQualityChange(parseFloat(e.target.value))}
          className="w-full h-2 bg-coconut-200 dark:bg-darkbg-border rounded-lg appearance-none cursor-pointer accent-coconut-700 dark:accent-palm-400"
        />
        <p className="text-xs text-coconut-600 dark:text-darkbg-muted leading-relaxed">
          {lang === "en" ? "Applies to WebP / JPG formats" : "对 WebP / JPG 格式生效"}
        </p>
      </div>

      <div className="space-y-2">
        <span className="text-sm text-coconut-900 dark:text-darkbg-text font-semibold">
          {lang === "en" ? "Transparency & Background" : "透明通道与填色"}
        </span>
        {convertTarget === "jpg" || convertTarget === "bmp" ? (
          <>
            <div className="flex items-center space-x-3">
              <input
                type="color"
                value={convertBgColor}
                onChange={(e) => onConvertBgColorChange(e.target.value)}
                className="w-9 h-9 rounded-lg border border-coconut-300 dark:border-darkbg-border cursor-pointer bg-transparent"
              />
              <span className="text-sm font-mono font-semibold text-coconut-800 dark:text-darkbg-muted">{convertBgColor}</span>
            </div>
            <p className="text-xs text-coconut-600 dark:text-darkbg-muted leading-relaxed">
              {lang === "en"
                ? "JPG / BMP do not support transparency; transparent areas will be filled with this color"
                : "JPG / BMP 不支持透明通道，透明区域将自动填充此底色"}
            </p>
          </>
        ) : (
          <div className="p-3 rounded-xl bg-palm-50/60 dark:bg-palm-950/30 border border-palm-200/60 dark:border-palm-900/40">
            <div className="text-xs font-semibold text-palm-700 dark:text-palm-300 flex items-center gap-1.5">
              <span>✨</span>
              <span>{lang === "en" ? "Alpha Transparency Preserved" : "原生保留透明通道"}</span>
            </div>
            <p className="text-[11px] text-coconut-600 dark:text-darkbg-muted mt-1 leading-relaxed">
              {lang === "en"
                ? `${convertTarget.toUpperCase()} supports native transparency; transparent backgrounds are preserved losslessly.`
                : `${convertTarget.toUpperCase()} 原生支持透明通道，原图的透明背景将完整保留，不填充底色。`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
