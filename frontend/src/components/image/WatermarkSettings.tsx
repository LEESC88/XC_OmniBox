"use client";

import React, { useRef } from "react";
import { Trash2, Upload } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export type WatermarkType = "text" | "logo";
export type WatermarkPosition = "center" | "bottom-right" | "bottom-left" | "top-right" | "tile";

export interface WatermarkSettingsProps {
  watermarkType: WatermarkType;
  onWatermarkTypeChange: (type: WatermarkType) => void;
  watermarkText: string;
  onWatermarkTextChange: (text: string) => void;
  watermarkTextColor: string;
  onWatermarkTextColorChange: (color: string) => void;
  watermarkFontSize?: number;
  onWatermarkFontSizeChange?: (size: number) => void;
  watermarkOpacity: number;
  onWatermarkOpacityChange: (opacity: number) => void;
  watermarkPos: WatermarkPosition;
  onWatermarkPosChange: (pos: WatermarkPosition) => void;
  watermarkLogoFile: File | null;
  onWatermarkLogoFileChange: (file: File | null) => void;
}

export default function WatermarkSettings({
  watermarkType,
  onWatermarkTypeChange,
  watermarkText,
  onWatermarkTextChange,
  watermarkTextColor,
  onWatermarkTextColorChange,
  watermarkFontSize = 24,
  onWatermarkFontSizeChange,
  watermarkOpacity,
  onWatermarkOpacityChange,
  watermarkPos,
  onWatermarkPosChange,
  watermarkLogoFile,
  onWatermarkLogoFileChange,
}: WatermarkSettingsProps) {
  const { lang } = useI18n();
  const logoInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-4 pt-1">
      <div className="flex space-x-3">
        <button
          type="button"
          onClick={() => onWatermarkTypeChange("text")}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all active:scale-95 ${
            watermarkType === "text"
              ? "bg-coconut-800 text-coconut-50 dark:bg-white dark:text-zinc-950 font-bold shadow-sm"
              : "bg-coconut-100/70 dark:bg-darkbg-subtle text-coconut-700 dark:text-darkbg-muted hover:dark:text-darkbg-text border border-transparent dark:border-darkbg-border"
          }`}
        >
          {lang === "en" ? "Text Watermark" : "文字水印"}
        </button>
        <button
          type="button"
          onClick={() => onWatermarkTypeChange("logo")}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all active:scale-95 ${
            watermarkType === "logo"
              ? "bg-coconut-800 text-coconut-50 dark:bg-white dark:text-zinc-950 font-bold shadow-sm"
              : "bg-coconut-100/70 dark:bg-darkbg-subtle text-coconut-700 dark:text-darkbg-muted hover:dark:text-darkbg-text border border-transparent dark:border-darkbg-border"
          }`}
        >
          {lang === "en" ? "Logo Image Watermark" : "Logo 图片水印"}
        </button>
      </div>

      {watermarkType === "text" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-4">
          <div className="space-y-1.5">
            <span className="text-sm text-coconut-900 dark:text-darkbg-text font-semibold">
              {lang === "en" ? "Watermark Text" : "水印文字"}
            </span>
            <input
              type="text"
              value={watermarkText}
              onChange={(e) => onWatermarkTextChange(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-white/70 dark:bg-darkbg-subtle border border-coconut-300/80 dark:border-darkbg-border rounded-xl text-coconut-900 dark:text-darkbg-text focus:outline-none focus:border-palm-500 shadow-2xs"
            />
          </div>
          <div className="space-y-1.5">
            <span className="text-sm text-coconut-900 dark:text-darkbg-text font-semibold">
              {lang === "en" ? "Text Color" : "文字颜色"}
            </span>
            <div className="flex items-center space-x-2.5">
              <input
                type="color"
                value={watermarkTextColor}
                onChange={(e) => onWatermarkTextColorChange(e.target.value)}
                className="w-9 h-9 rounded-lg border border-coconut-300 dark:border-darkbg-border cursor-pointer bg-transparent"
              />
              <span className="text-sm font-mono font-semibold text-coconut-800 dark:text-darkbg-muted">{watermarkTextColor}</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm text-coconut-900 dark:text-darkbg-text font-semibold">
              <span>{lang === "en" ? "Adaptive Size" : "自适应字号"}</span>
              <span className="font-mono text-toast-500 font-bold">{watermarkFontSize}px</span>
            </div>
            <input
              type="range"
              min="14"
              max="64"
              step="2"
              value={watermarkFontSize}
              onChange={(e) => onWatermarkFontSizeChange?.(parseInt(e.target.value))}
              className="w-full h-2 bg-coconut-200 dark:bg-darkbg-border rounded-lg appearance-none cursor-pointer accent-coconut-700 dark:accent-palm-400"
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm text-coconut-900 dark:text-darkbg-text font-semibold">
              <span>{lang === "en" ? "Opacity" : "透明度"}</span>
              <span className="font-mono text-toast-500 font-bold">{Math.round(watermarkOpacity * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={watermarkOpacity}
              onChange={(e) => onWatermarkOpacityChange(parseFloat(e.target.value))}
              className="w-full h-2 bg-coconut-200 dark:bg-darkbg-border rounded-lg appearance-none cursor-pointer accent-coconut-700 dark:accent-palm-400"
            />
          </div>
          <div className="space-y-1.5">
            <span className="text-sm text-coconut-900 dark:text-darkbg-text font-semibold">
              {lang === "en" ? "Layout" : "水印布局"}
            </span>
            <select
              value={watermarkPos}
              onChange={(e) => onWatermarkPosChange(e.target.value as WatermarkPosition)}
              className="w-full px-3.5 py-2 text-sm bg-white/70 dark:bg-darkbg-subtle border border-coconut-300/80 dark:border-darkbg-border rounded-xl text-coconut-900 dark:text-darkbg-text focus:outline-none focus:border-palm-500 shadow-2xs"
            >
              <option value="tile" className="dark:bg-darkbg-card dark:text-darkbg-text">
                {lang === "en" ? "Tiled (Recommended)" : "全图平铺防盗 (推荐)"}
              </option>
              <option value="bottom-right" className="dark:bg-darkbg-card dark:text-darkbg-text">
                {lang === "en" ? "Bottom Right" : "右下角"}
              </option>
              <option value="bottom-left" className="dark:bg-darkbg-card dark:text-darkbg-text">
                {lang === "en" ? "Bottom Left" : "左下角"}
              </option>
              <option value="center" className="dark:bg-darkbg-card dark:text-darkbg-text">
                {lang === "en" ? "Center" : "正中央"}
              </option>
              <option value="top-right" className="dark:bg-darkbg-card dark:text-darkbg-text">
                {lang === "en" ? "Top Right" : "右上角"}
              </option>
            </select>
          </div>
        </div>
      ) : (
        <div className="flex items-center space-x-4 flex-wrap gap-y-3">
          <input
            type="file"
            ref={logoInputRef}
            accept="image/png,image/jpeg,image/svg+xml"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                onWatermarkLogoFileChange(e.target.files[0]);
              }
            }}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => logoInputRef.current?.click()}
            className="px-4 py-2.5 bg-coconut-100/80 dark:bg-darkbg-elevated border border-coconut-300 dark:border-darkbg-border rounded-xl text-xs sm:text-sm font-semibold text-coconut-900 dark:text-darkbg-text hover:bg-coconut-200/80 dark:hover:bg-darkbg-hover active:scale-95 transition-all"
          >
            {watermarkLogoFile
              ? lang === "en"
                ? `Selected: ${watermarkLogoFile.name}`
                : `已选 Logo: ${watermarkLogoFile.name}`
              : lang === "en"
              ? "Choose Transparent PNG Logo"
              : "选择透明 PNG Logo"}
          </button>
          {watermarkLogoFile && (
            <button
              type="button"
              onClick={() => {
                onWatermarkLogoFileChange(null);
                if (logoInputRef.current) logoInputRef.current.value = "";
              }}
              className="px-3 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 transition-colors flex items-center gap-1.5 text-xs font-semibold"
              title={lang === "en" ? "Remove Logo" : "清除 Logo"}
            >
              <Trash2 className="w-4 h-4" />
              <span>{lang === "en" ? "Remove" : "清除 Logo"}</span>
            </button>
          )}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-coconut-900 dark:text-darkbg-text font-semibold">
              {lang === "en" ? "Position:" : "位置:"}
            </span>
            <select
              value={watermarkPos}
              onChange={(e) => onWatermarkPosChange(e.target.value as WatermarkPosition)}
              className="px-3.5 py-2 text-sm bg-white/70 dark:bg-darkbg-subtle border border-coconut-300/80 dark:border-darkbg-border rounded-xl text-coconut-900 dark:text-darkbg-text focus:outline-none focus:border-palm-500 shadow-2xs"
            >
              <option value="bottom-right" className="dark:bg-darkbg-card dark:text-darkbg-text">
                {lang === "en" ? "Bottom Right" : "右下角"}
              </option>
              <option value="bottom-left" className="dark:bg-darkbg-card dark:text-darkbg-text">
                {lang === "en" ? "Bottom Left" : "左下角"}
              </option>
              <option value="center" className="dark:bg-darkbg-card dark:text-darkbg-text">
                {lang === "en" ? "Center" : "正中央"}
              </option>
              <option value="top-right" className="dark:bg-darkbg-card dark:text-darkbg-text">
                {lang === "en" ? "Top Right" : "右上角"}
              </option>
            </select>
          </div>
          <div className="flex items-center space-x-2.5">
            <span className="text-sm text-coconut-900 dark:text-darkbg-text font-semibold">
              {lang === "en" ? "Opacity:" : "透明度:"}
            </span>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={watermarkOpacity}
              onChange={(e) => onWatermarkOpacityChange(parseFloat(e.target.value))}
              className="w-28 h-2 bg-coconut-200 dark:bg-darkbg-border rounded-lg appearance-none cursor-pointer accent-coconut-700 dark:accent-palm-400"
            />
            <span className="text-sm font-mono font-bold text-toast-500">{Math.round(watermarkOpacity * 100)}%</span>
          </div>
        </div>
      )}
    </div>
  );
}
