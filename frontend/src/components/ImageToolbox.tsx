"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Image as ImageIcon,
  Apple,
  Zap,
  RefreshCw,
  Maximize2,
  ShieldCheck,
  Stamp,
  UploadCloud,
  FileImage,
  Trash2,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Archive,
  ArrowRight,
  Sliders,
  Sparkles,
} from "lucide-react";
import {
  formatBytes,
  convertHeic,
  compressImage,
  convertFormat,
  resizeImage,
  stripExif,
  applyWatermark,
  createZipBundle,
} from "@/lib/imageProcessor";
import { downloadBlob } from "@/lib/api";

type ImageToolTab = "heic" | "compress" | "convert" | "resize" | "exif" | "watermark";

interface ProcessedResult {
  id: string;
  originalName: string;
  originalSize: number;
  newFilename: string;
  newSize: number;
  blob: Blob;
  previewUrl: string;
  extraInfo?: string;
}

const PRESETS = [
  { name: "1寸证件照", width: 295, height: 413, desc: "标准1寸 (25x35mm, 300DPI)" },
  { name: "2寸证件照", width: 413, height: 579, desc: "标准2寸 (35x49mm, 300DPI)" },
  { name: "微信头像 / 正方形", width: 500, height: 500, desc: "1:1 正方形头像" },
  { name: "小红书封面配图", width: 1242, height: 1656, desc: "3:4 竖屏高清规格" },
  { name: "公众号文章首图", width: 900, height: 383, desc: "2.35:1 横屏横幅" },
  { name: "1080P 高清壁纸", width: 1920, height: 1080, desc: "16:9 全高清显示" },
];

export interface ImageToolboxProps {
  currentTab?: ImageToolTab;
  onTabChange?: (tab: ImageToolTab) => void;
}

export default function ImageToolbox({ currentTab, onTabChange }: ImageToolboxProps = {}) {
  const [activeTab, setActiveTab] = useState<ImageToolTab>(currentTab || "compress");
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressText, setProgressText] = useState("");
  const [results, setResults] = useState<ProcessedResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (currentTab && currentTab !== activeTab) {
      setActiveTab(currentTab);
      setResults([]);
      setError(null);
    }
  }, [currentTab]);

  const handleTabSelect = (tab: ImageToolTab) => {
    setActiveTab(tab);
    setResults([]);
    setError(null);
    onTabChange?.(tab);
  };

  // --- HEIC 转换参数 ---
  const [heicTargetFormat, setHeicTargetFormat] = useState<"image/jpeg" | "image/png">("image/jpeg");
  const [heicQuality, setHeicQuality] = useState(0.92);

  // --- 图片压缩参数 ---
  const [compressQuality, setCompressQuality] = useState(0.75);
  const [compressMaxResolution, setCompressMaxResolution] = useState(2560);
  const [compressTargetSizeMB, setCompressTargetSizeMB] = useState(2);

  // --- 格式转换参数 ---
  const [convertTarget, setConvertTarget] = useState<"jpg" | "png" | "webp" | "ico" | "bmp">("webp");
  const [convertQuality, setConvertQuality] = useState(0.9);
  const [convertBgColor, setConvertBgColor] = useState("#FFFFFF");

  // --- 尺寸缩放参数 ---
  const [resizeMode, setResizeMode] = useState<"percent" | "custom" | "preset">("percent");
  const [resizePercent, setResizePercent] = useState(50);
  const [customWidth, setCustomWidth] = useState<number | "">("");
  const [customHeight, setCustomHeight] = useState<number | "">("");
  const [lockAspect, setLockAspect] = useState(true);
  const [selectedPreset, setSelectedPreset] = useState(PRESETS[0]);

  // --- 水印参数 ---
  const [watermarkType, setWatermarkType] = useState<"text" | "logo">("text");
  const [watermarkText, setWatermarkText] = useState("XC_OmniBox");
  const [watermarkTextColor, setWatermarkTextColor] = useState("#FFFFFF");
  const [watermarkFontSize, setWatermarkFontSize] = useState(24);
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.4);
  const [watermarkRotation, setWatermarkRotation] = useState(-25);
  const [watermarkPos, setWatermarkPos] = useState<"center" | "bottom-right" | "bottom-left" | "top-right" | "tile">("tile");
  const [watermarkLogoFile, setWatermarkLogoFile] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // 支持的文件后缀
  const acceptTypes =
    activeTab === "heic"
      ? ".heic,.heif,.HEIC,.HEIF"
      : "image/*,.heic,.heif,.svg,.ico";

  // 添加文件
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const incoming = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...incoming]);
      setError(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      const incoming = Array.from(e.dataTransfer.files);
      setFiles((prev) => [...prev, ...incoming]);
      setError(null);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const clearAllFiles = () => {
    setFiles([]);
    setResults([]);
    setError(null);
  };

  // 执行批量处理
  const handleExecuteBatch = async () => {
    if (files.length === 0) {
      setError("请先选择或拖拽上传需要处理的图片");
      return;
    }

    setIsProcessing(true);
    setError(null);
    const newResults: ProcessedResult[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProgressText(`正在处理 (${i + 1}/${files.length}): ${file.name}`);

        if (activeTab === "heic") {
          const { blob, filename } = await convertHeic(file, heicTargetFormat, heicQuality);
          newResults.push({
            id: `res_${Date.now()}_${i}`,
            originalName: file.name,
            originalSize: file.size,
            newFilename: filename,
            newSize: blob.size,
            blob,
            previewUrl: URL.createObjectURL(blob),
          });
        } else if (activeTab === "compress") {
          const { blob, filename, originalSize, compressedSize } = await compressImage(file, {
            quality: compressQuality,
            maxWidthOrHeight: compressMaxResolution,
            maxSizeMB: compressTargetSizeMB,
          });
          newResults.push({
            id: `res_${Date.now()}_${i}`,
            originalName: file.name,
            originalSize,
            newFilename: filename,
            newSize: compressedSize,
            blob,
            previewUrl: URL.createObjectURL(blob),
          });
        } else if (activeTab === "convert") {
          const { blob, filename } = await convertFormat(file, convertTarget, convertQuality, convertBgColor);
          newResults.push({
            id: `res_${Date.now()}_${i}`,
            originalName: file.name,
            originalSize: file.size,
            newFilename: filename,
            newSize: blob.size,
            blob,
            previewUrl: convertTarget === "ico" ? "" : URL.createObjectURL(blob),
            extraInfo: `目标: ${convertTarget.toUpperCase()}`,
          });
        } else if (activeTab === "resize") {
          let tW = typeof customWidth === "number" ? customWidth : undefined;
          let tH = typeof customHeight === "number" ? customHeight : undefined;
          if (resizeMode === "preset") {
            tW = selectedPreset.width;
            tH = selectedPreset.height;
          }

          const { blob, filename, originalWidth, originalHeight, targetWidth, targetHeight } = await resizeImage(
            file,
            {
              mode: resizeMode,
              percent: resizePercent,
              targetWidth: tW,
              targetHeight: tH,
              maintainAspectRatio: lockAspect,
            }
          );
          newResults.push({
            id: `res_${Date.now()}_${i}`,
            originalName: file.name,
            originalSize: file.size,
            newFilename: filename,
            newSize: blob.size,
            blob,
            previewUrl: URL.createObjectURL(blob),
            extraInfo: `${originalWidth}x${originalHeight} → ${targetWidth}x${targetHeight}`,
          });
        } else if (activeTab === "exif") {
          const { blob, filename, originalSize, newSize } = await stripExif(file);
          newResults.push({
            id: `res_${Date.now()}_${i}`,
            originalName: file.name,
            originalSize,
            newFilename: filename,
            newSize,
            blob,
            previewUrl: URL.createObjectURL(blob),
            extraInfo: "已完全清除 GPS 定位与拍摄元数据",
          });
        } else if (activeTab === "watermark") {
          const { blob, filename } = await applyWatermark(file, {
            type: watermarkType,
            text: watermarkText,
            textColor: watermarkTextColor,
            fontSize: watermarkFontSize,
            opacity: watermarkOpacity,
            rotation: watermarkRotation,
            position: watermarkPos,
            logoFile: watermarkLogoFile || undefined,
          });
          newResults.push({
            id: `res_${Date.now()}_${i}`,
            originalName: file.name,
            originalSize: file.size,
            newFilename: filename,
            newSize: blob.size,
            blob,
            previewUrl: URL.createObjectURL(blob),
            extraInfo: watermarkType === "text" ? `文字水印: ${watermarkText}` : "Logo 贴图水印",
          });
        }
      }

      setResults(newResults);
      setProgressText("");
    } catch (err: any) {
      setError(err.message || "批量处理图片时发生错误");
    } finally {
      setIsProcessing(false);
    }
  };

  // 打包全部为 ZIP
  const handleDownloadAllZip = async () => {
    if (results.length === 0) return;
    try {
      const items = results.map((r) => ({ blob: r.blob, filename: r.newFilename }));
      const zipName = `XC_${activeTab}_images_${Date.now()}.zip`;
      const { blob, filename } = await createZipBundle(items, zipName);
      downloadBlob(blob, filename);
    } catch (err: any) {
      setError("生成 ZIP 打包文件失败: " + err.message);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* 6 大子功能 Tab 切换条 (横向平滑手势滑动) */}
      <div className="w-full flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 border-b border-coconut-200/80 dark:border-darkbg-border snap-x snap-mandatory touch-pan-x">
        {[
          { id: "compress", label: "智能图片压缩", icon: Zap, badge: "TinyPNG级" },
          { id: "heic", label: "苹果 HEIC 秒转", icon: Apple, badge: "iPhone原图" },
          { id: "convert", label: "万能格式互转", icon: RefreshCw, badge: "WebP/ICO/PNG" },
          { id: "resize", label: "尺寸缩放与预设", icon: Maximize2, badge: "证件/社交图" },
          { id: "exif", label: "EXIF 隐私抹除", icon: ShieldCheck, badge: "防GPS泄露" },
          { id: "watermark", label: "批量防盗水印", icon: Stamp, badge: "文字/Logo" },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabSelect(tab.id as ImageToolTab)}
              className={`flex items-center space-x-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap flex-shrink-0 snap-start active:scale-95 ${
                isActive
                  ? "bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white font-bold shadow-coconut-sm scale-[1.02]"
                  : "bg-white/80 dark:bg-darkbg-card text-coconut-700 dark:text-darkbg-muted border border-coconut-200/80 dark:border-darkbg-border hover:bg-coconut-100/60 dark:hover:bg-darkbg-elevated hover:dark:text-darkbg-text"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                  isActive
                    ? "bg-white/25 text-white"
                    : "bg-coconut-200/80 dark:bg-darkbg-elevated text-coconut-700 dark:text-darkbg-muted"
                }`}
              >
                {tab.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* 参数控制面板 (根据 activeTab 变化) */}
      <div className="bg-white/95 dark:bg-darkbg-card border border-coconut-200/90 dark:border-darkbg-border rounded-3xl p-5 sm:p-6 shadow-coconut-sm space-y-4 backdrop-blur-md">
        <div className="flex items-center justify-between pb-3 border-b border-coconut-100 dark:border-darkbg-border">
          <div className="flex items-center space-x-2 text-coconut-900 dark:text-darkbg-text font-bold text-sm">
            <Sliders className="w-4 h-4 text-toast-500" />
            <span>
              {activeTab === "compress" && "压缩选项设置 (智能重采样 & 体积优化)"}
              {activeTab === "heic" && "苹果 HEIC/HEIF 转换目标格式"}
              {activeTab === "convert" && "万能格式转换目标与填色"}
              {activeTab === "resize" && "尺寸缩放比例与规格预设"}
              {activeTab === "exif" && "隐私保护与地理定位清理"}
              {activeTab === "watermark" && "水印样式、透明度与排布"}
            </span>
          </div>
          <span className="text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200/50 dark:border-emerald-800/50 font-medium">
            纯本地 Canvas/WASM 极速运算 · 零流量上传
          </span>
        </div>

        {/* 1. 智能压缩面板 */}
        {activeTab === "compress" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-1">
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-coconut-800 dark:text-darkbg-text font-semibold">压缩质量</span>
                <span className="text-coconut-900 dark:text-toast-400 font-bold">{Math.round(compressQuality * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="0.95"
                step="0.05"
                value={compressQuality}
                onChange={(e) => setCompressQuality(parseFloat(e.target.value))}
                className="w-full h-2 bg-coconut-200 dark:bg-darkbg-border rounded-lg appearance-none cursor-pointer accent-coconut-700 dark:accent-palm-400"
              />
              <p className="text-[11px] text-coconut-600 dark:text-darkbg-muted">推荐 70%~85%，肉眼几乎无失真，体积降低 60%~80%</p>
            </div>

            <div className="space-y-2">
              <span className="text-xs text-coconut-800 dark:text-darkbg-text font-semibold">最大分辨率限制</span>
              <select
                value={compressMaxResolution}
                onChange={(e) => setCompressMaxResolution(parseInt(e.target.value))}
                className="w-full px-3 py-1.5 text-xs bg-coconut-50/70 dark:bg-darkbg-subtle border border-coconut-200 dark:border-darkbg-border rounded-xl text-coconut-900 dark:text-darkbg-text focus:outline-none focus:border-palm-500"
              >
                <option value={4096} className="dark:bg-darkbg-card dark:text-darkbg-text">保持原图大尺寸 (最大 4096px)</option>
                <option value={2560} className="dark:bg-darkbg-card dark:text-darkbg-text">2K 常见大图 (最大 2560px)</option>
                <option value={1920} className="dark:bg-darkbg-card dark:text-darkbg-text">1080P 高清 (最大 1920px)</option>
                <option value={1280} className="dark:bg-darkbg-card dark:text-darkbg-text">网页极速加载 (最大 1280px)</option>
              </select>
              <p className="text-[11px] text-coconut-600 dark:text-darkbg-muted">超过此分辨率将自动等比例重采样</p>
            </div>

            <div className="space-y-2">
              <span className="text-xs text-coconut-800 dark:text-darkbg-text font-semibold">目标体积上限</span>
              <select
                value={compressTargetSizeMB}
                onChange={(e) => setCompressTargetSizeMB(parseFloat(e.target.value))}
                className="w-full px-3 py-1.5 text-xs bg-coconut-50/70 dark:bg-darkbg-subtle border border-coconut-200 dark:border-darkbg-border rounded-xl text-coconut-900 dark:text-darkbg-text focus:outline-none focus:border-palm-500"
              >
                <option value={0.5} className="dark:bg-darkbg-card dark:text-darkbg-text">极度精简 (≤ 500 KB)</option>
                <option value={1} className="dark:bg-darkbg-card dark:text-darkbg-text">日常分享 (≤ 1 MB)</option>
                <option value={2} className="dark:bg-darkbg-card dark:text-darkbg-text">标准高清 (≤ 2 MB)</option>
                <option value={5} className="dark:bg-darkbg-card dark:text-darkbg-text">大图印刷 (≤ 5 MB)</option>
              </select>
              <p className="text-[11px] text-coconut-600 dark:text-darkbg-muted">优先兼顾文件大小上限约束</p>
            </div>
          </div>
        )}

        {/* 2. 苹果 HEIC 转换面板 */}
        {activeTab === "heic" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
            <div className="space-y-2">
              <span className="text-xs text-coconut-800 dark:text-darkbg-text font-semibold">转换目标格式</span>
              <div className="flex space-x-3">
                {[
                  { value: "image/jpeg", label: "JPG / JPEG", desc: "兼容性最高，文件较小" },
                  { value: "image/png", label: "PNG 原图", desc: "无损保留透明度与极清细节" },
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
                        onChange={() => setHeicTargetFormat(opt.value as any)}
                        className="accent-palm-600 dark:accent-palm-400"
                      />
                      <span className="font-semibold text-sm text-coconut-900 dark:text-darkbg-text">{opt.label}</span>
                    </div>
                    <span className="text-[11px] text-coconut-600 dark:text-darkbg-muted mt-1">{opt.desc}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-coconut-800 dark:text-darkbg-text font-semibold">输出画质清晰度</span>
                <span className="text-coconut-900 dark:text-toast-400 font-bold">{Math.round(heicQuality * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="1.0"
                step="0.05"
                value={heicQuality}
                onChange={(e) => setHeicQuality(parseFloat(e.target.value))}
                className="w-full h-2 bg-coconut-200 dark:bg-darkbg-border rounded-lg appearance-none cursor-pointer accent-coconut-700 dark:accent-palm-400"
              />
              <p className="text-[11px] text-coconut-600 dark:text-darkbg-muted">苹果 iPhone 实拍 HEIC 照片直接在本地解压渲染，秒级转码</p>
            </div>
          </div>
        )}

        {/* 3. 万能格式互转面板 */}
        {activeTab === "convert" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-1">
            <div className="space-y-2">
              <span className="text-xs text-coconut-800 dark:text-darkbg-text font-semibold">目标输出格式</span>
              <div className="grid grid-cols-3 gap-2">
                {(["webp", "png", "jpg", "ico", "bmp"] as const).map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => setConvertTarget(fmt)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold uppercase transition-all ${
                      convertTarget === fmt
                        ? "bg-coconut-800 text-coconut-50 dark:bg-white dark:text-zinc-950 font-bold shadow-sm"
                        : "bg-coconut-100/70 dark:bg-darkbg-subtle text-coconut-700 dark:text-darkbg-muted hover:bg-coconut-200/70 dark:hover:bg-darkbg-hover hover:dark:text-darkbg-text border border-transparent dark:border-darkbg-border"
                    }`}
                  >
                    {fmt}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-coconut-600 dark:text-darkbg-muted">
                {convertTarget === "ico" && "自动生成 Windows 软件/网站 favicon 标准 ICO 图标"}
                {convertTarget === "webp" && "下一代高压缩率网络图片格式，体积仅为 JPG 的一半"}
                {convertTarget === "png" && "无损高保真透明图"}
                {convertTarget === "jpg" && "通用网络与打印图片"}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-coconut-800 dark:text-darkbg-text font-semibold">输出画质</span>
                <span className="text-coconut-900 dark:text-toast-400 font-bold">{Math.round(convertQuality * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.3"
                max="1.0"
                step="0.05"
                value={convertQuality}
                onChange={(e) => setConvertQuality(parseFloat(e.target.value))}
                className="w-full h-2 bg-coconut-200 dark:bg-darkbg-border rounded-lg appearance-none cursor-pointer accent-coconut-700 dark:accent-palm-400"
              />
              <p className="text-[11px] text-coconut-600 dark:text-darkbg-muted">对 WebP / JPG 格式生效</p>
            </div>

            <div className="space-y-2">
              <span className="text-xs text-coconut-800 dark:text-darkbg-text font-semibold">透明背景填色</span>
              <div className="flex items-center space-x-3">
                <input
                  type="color"
                  value={convertBgColor}
                  onChange={(e) => setConvertBgColor(e.target.value)}
                  className="w-8 h-8 rounded-lg border border-coconut-300 dark:border-darkbg-border cursor-pointer bg-transparent"
                />
                <span className="text-xs font-mono text-coconut-700 dark:text-darkbg-muted">{convertBgColor}</span>
              </div>
              <p className="text-[11px] text-coconut-600 dark:text-darkbg-muted">当透明 PNG 转为不支持透明的 JPG/BMP 时填充此底色</p>
            </div>
          </div>
        )}

        {/* 4. 尺寸缩放与预设面板 */}
        {activeTab === "resize" && (
          <div className="space-y-4 pt-1">
            <div className="flex space-x-3">
              {[
                { id: "percent", label: "按百分比缩放" },
                { id: "preset", label: "常用规格预设 (证件照/社交)" },
                { id: "custom", label: "自定义精确像素 (px)" },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setResizeMode(m.id as any)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
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
                    onClick={() => setResizePercent(p)}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                      resizePercent === p
                        ? "bg-coconut-800 text-coconut-50 dark:bg-white dark:text-zinc-950 font-bold shadow-sm"
                        : "bg-coconut-100/70 dark:bg-darkbg-subtle text-coconut-700 dark:text-darkbg-muted hover:bg-coconut-200/60 dark:hover:bg-darkbg-hover hover:dark:text-darkbg-text border border-transparent dark:border-darkbg-border"
                    }`}
                  >
                    {p}% 比例
                  </button>
                ))}
              </div>
            )}

            {resizeMode === "preset" && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {PRESETS.map((pst) => (
                  <button
                    key={pst.name}
                    onClick={() => setSelectedPreset(pst)}
                    className={`text-left p-3.5 rounded-2xl border transition-all ${
                      selectedPreset.name === pst.name
                        ? "border-palm-600 dark:border-palm-400 bg-palm-50/60 dark:bg-palm-950/30 text-coconut-900 dark:text-darkbg-text ring-2 ring-palm-500/20 shadow-coconut-sm"
                        : "border-coconut-200 dark:border-darkbg-border text-coconut-700 dark:text-darkbg-muted hover:border-coconut-300 dark:hover:border-darkbg-borderLight"
                    }`}
                  >
                    <div className="font-bold text-xs text-coconut-900 dark:text-darkbg-text">{pst.name}</div>
                    <div className="text-[11px] font-mono text-coconut-600 dark:text-darkbg-muted mt-0.5">
                      {pst.width} × {pst.height} px
                    </div>
                    <div className="text-[10px] text-coconut-500 dark:text-darkbg-subtext mt-1">{pst.desc}</div>
                  </button>
                ))}
              </div>
            )}

            {resizeMode === "custom" && (
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-coconut-800 dark:text-darkbg-text font-semibold">宽:</span>
                  <input
                    type="number"
                    placeholder="例如 800"
                    value={customWidth}
                    onChange={(e) => setCustomWidth(e.target.value ? parseInt(e.target.value) : "")}
                    className="w-28 px-2.5 py-1.5 text-xs bg-coconut-50/70 dark:bg-darkbg-subtle border border-coconut-200 dark:border-darkbg-border rounded-xl text-coconut-900 dark:text-darkbg-text focus:outline-none focus:border-palm-500"
                  />
                  <span className="text-xs text-coconut-500 dark:text-darkbg-muted">px</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-coconut-800 dark:text-darkbg-text font-semibold">高:</span>
                  <input
                    type="number"
                    placeholder="例如 600"
                    value={customHeight}
                    onChange={(e) => setCustomHeight(e.target.value ? parseInt(e.target.value) : "")}
                    className="w-28 px-2.5 py-1.5 text-xs bg-coconut-50/70 dark:bg-darkbg-subtle border border-coconut-200 dark:border-darkbg-border rounded-xl text-coconut-900 dark:text-darkbg-text focus:outline-none focus:border-palm-500"
                  />
                  <span className="text-xs text-coconut-500 dark:text-darkbg-muted">px</span>
                </div>
                <label className="flex items-center space-x-2 text-xs text-coconut-800 dark:text-darkbg-text cursor-pointer">
                  <input
                    type="checkbox"
                    checked={lockAspect}
                    onChange={(e) => setLockAspect(e.target.checked)}
                    className="rounded accent-palm-600 dark:accent-palm-400"
                  />
                  <span>锁定等比例缩放 (防止变形)</span>
                </label>
              </div>
            )}
          </div>
        )}

        {/* 5. EXIF 隐私抹除面板 */}
        {activeTab === "exif" && (
          <div className="p-4 sm:p-5 bg-palm-50/60 dark:bg-palm-950/20 border border-palm-200/60 dark:border-palm-900/60 rounded-2xl space-y-2 text-xs">
            <div className="font-bold text-palm-800 dark:text-palm-300 flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-palm-600 dark:text-palm-400" />
              <span>100% 抹除隐私定位与拍摄硬件特征</span>
            </div>
            <p className="text-palm-700 dark:text-palm-300/90 leading-relaxed">
              手机（尤其是 iPhone、华为、小米等）与数码单反所拍的照片，内部包含敏感的 <strong>EXIF 交换元数据</strong>，
              包括<strong>拍摄经纬度 GPS 坐标（能精确到具体单元楼门牌）</strong>、拍摄详细时间、手机具体型号、镜头光圈快门等。
              本工具通过纯前端 Canvas 像素流重构技术，在<strong>不降低清晰度</strong>的前提下完全剥离任何非像素元数据，让您在社交网络放心发布原图！
            </p>
          </div>
        )}

        {/* 6. 批量水印面板 */}
        {activeTab === "watermark" && (
          <div className="space-y-4 pt-1">
            <div className="flex space-x-3">
              <button
                onClick={() => setWatermarkType("text")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  watermarkType === "text"
                    ? "bg-coconut-800 text-coconut-50 dark:bg-white dark:text-zinc-950 font-bold shadow-sm"
                    : "bg-coconut-100/70 dark:bg-darkbg-subtle text-coconut-700 dark:text-darkbg-muted hover:dark:text-darkbg-text border border-transparent dark:border-darkbg-border"
                }`}
              >
                文字水印
              </button>
              <button
                onClick={() => setWatermarkType("logo")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  watermarkType === "logo"
                    ? "bg-coconut-800 text-coconut-50 dark:bg-white dark:text-zinc-950 font-bold shadow-sm"
                    : "bg-coconut-100/70 dark:bg-darkbg-subtle text-coconut-700 dark:text-darkbg-muted hover:dark:text-darkbg-text border border-transparent dark:border-darkbg-border"
                }`}
              >
                Logo 图片水印
              </button>
            </div>

            {watermarkType === "text" ? (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <span className="text-xs text-coconut-800 dark:text-darkbg-text font-semibold">水印文字</span>
                  <input
                    type="text"
                    value={watermarkText}
                    onChange={(e) => setWatermarkText(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-coconut-50/70 dark:bg-darkbg-subtle border border-coconut-200 dark:border-darkbg-border rounded-xl text-coconut-900 dark:text-darkbg-text focus:outline-none focus:border-palm-500"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-coconut-800 dark:text-darkbg-text font-semibold">文字颜色</span>
                  <div className="flex items-center space-x-2">
                    <input
                      type="color"
                      value={watermarkTextColor}
                      onChange={(e) => setWatermarkTextColor(e.target.value)}
                      className="w-8 h-8 rounded border border-coconut-300 dark:border-darkbg-border cursor-pointer bg-transparent"
                    />
                    <span className="text-xs font-mono text-coconut-700 dark:text-darkbg-muted">{watermarkTextColor}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-coconut-800 dark:text-darkbg-text font-semibold">
                    <span>透明度</span>
                    <span>{Math.round(watermarkOpacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={watermarkOpacity}
                    onChange={(e) => setWatermarkOpacity(parseFloat(e.target.value))}
                    className="w-full h-2 bg-coconut-200 dark:bg-darkbg-border rounded-lg appearance-none cursor-pointer accent-coconut-700 dark:accent-palm-400"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-coconut-800 dark:text-darkbg-text font-semibold">水印布局</span>
                  <select
                    value={watermarkPos}
                    onChange={(e) => setWatermarkPos(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 text-xs bg-coconut-50/70 dark:bg-darkbg-subtle border border-coconut-200 dark:border-darkbg-border rounded-xl text-coconut-900 dark:text-darkbg-text focus:outline-none focus:border-palm-500"
                  >
                    <option value="tile" className="dark:bg-darkbg-card dark:text-darkbg-text">全图平铺防盗 (推荐)</option>
                    <option value="bottom-right" className="dark:bg-darkbg-card dark:text-darkbg-text">右下角</option>
                    <option value="bottom-left" className="dark:bg-darkbg-card dark:text-darkbg-text">左下角</option>
                    <option value="center" className="dark:bg-darkbg-card dark:text-darkbg-text">正中央</option>
                    <option value="top-right" className="dark:bg-darkbg-card dark:text-darkbg-text">右上角</option>
                  </select>
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-4">
                <input
                  type="file"
                  ref={logoInputRef}
                  accept="image/png,image/jpeg,image/svg+xml"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setWatermarkLogoFile(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />
                <button
                  onClick={() => logoInputRef.current?.click()}
                  className="px-3.5 py-2 bg-coconut-100/80 dark:bg-darkbg-elevated border border-coconut-300 dark:border-darkbg-border rounded-xl text-xs font-semibold text-coconut-800 dark:text-darkbg-text hover:bg-coconut-200/80 dark:hover:bg-darkbg-hover"
                >
                  {watermarkLogoFile ? `已选 Logo: ${watermarkLogoFile.name}` : "选择透明 PNG Logo"}
                </button>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-coconut-800 dark:text-darkbg-text font-semibold">位置:</span>
                  <select
                    value={watermarkPos}
                    onChange={(e) => setWatermarkPos(e.target.value as any)}
                    className="px-2.5 py-1.5 text-xs bg-coconut-50/70 dark:bg-darkbg-subtle border border-coconut-200 dark:border-darkbg-border rounded-xl text-coconut-900 dark:text-darkbg-text focus:outline-none focus:border-palm-500"
                  >
                    <option value="bottom-right" className="dark:bg-darkbg-card dark:text-darkbg-text">右下角</option>
                    <option value="bottom-left" className="dark:bg-darkbg-card dark:text-darkbg-text">左下角</option>
                    <option value="center" className="dark:bg-darkbg-card dark:text-darkbg-text">正中央</option>
                    <option value="top-right" className="dark:bg-darkbg-card dark:text-darkbg-text">右上角</option>
                  </select>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-coconut-800 dark:text-darkbg-text font-semibold">透明度:</span>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={watermarkOpacity}
                    onChange={(e) => setWatermarkOpacity(parseFloat(e.target.value))}
                    className="w-24 h-2 bg-coconut-200 dark:bg-darkbg-border rounded-lg appearance-none cursor-pointer accent-coconut-700 dark:accent-palm-400"
                  />
                  <span className="text-xs font-mono text-coconut-700 dark:text-darkbg-muted">{Math.round(watermarkOpacity * 100)}%</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 拖拽批量上传区域 */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className="group relative border-2 border-dashed border-coconut-300 dark:border-darkbg-border hover:border-coconut-500 dark:hover:border-palm-500 bg-coconut-50/40 dark:bg-darkbg-card hover:bg-coconut-100/40 dark:hover:bg-darkbg-elevated rounded-3xl p-6 sm:p-10 text-center cursor-pointer transition-all duration-300 shadow-coconut-sm select-none"
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptTypes}
          onChange={handleFileChange}
          className="hidden"
        />
        <div className="flex flex-col items-center space-y-3.5">
          <div className="w-14 h-14 rounded-2xl bg-coconut-100 dark:bg-darkbg-elevated text-coconut-700 dark:text-toast-400 flex items-center justify-center group-hover:scale-105 transition-transform shadow-inner">
            <UploadCloud className="w-7 h-7" />
          </div>
          <div>
            <p className="text-base font-bold text-coconut-900 dark:text-darkbg-text tracking-tight">
              点击选择或拖拽图片到此处（支持多图批量处理）
            </p>
            <p className="text-xs text-coconut-600 dark:text-darkbg-muted mt-1">
              {activeTab === "heic"
                ? "支持苹果 iPhone / iPad 原图实拍格式: .HEIC, .HEIF"
                : "支持主流图片格式: JPG, PNG, WebP, AVIF, BMP, SVG, HEIC 等"}
            </p>
          </div>
        </div>
      </div>

      {/* 待处理文件预览列表 */}
      {files.length > 0 && (
        <div className="bg-white/95 dark:bg-darkbg-card border border-coconut-200/90 dark:border-darkbg-border rounded-3xl p-5 sm:p-6 shadow-coconut-sm space-y-4 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FileImage className="w-4 h-4 text-toast-500" />
              <span className="font-bold text-sm text-coconut-900 dark:text-darkbg-text">
                已选图片 ({files.length} 张 · 总大小 {formatBytes(files.reduce((acc, f) => acc + f.size, 0))})
              </span>
            </div>
            <button
              onClick={clearAllFiles}
              className="text-xs text-rose-500 hover:text-rose-600 flex items-center space-x-1 font-medium px-2.5 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>清空全部</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-64 overflow-y-auto pr-1">
            {files.map((file, idx) => (
              <div
                key={`${file.name}_${idx}`}
                className="group relative bg-coconut-50/70 dark:bg-darkbg-subtle border border-coconut-200/70 dark:border-darkbg-border rounded-2xl p-3 flex flex-col justify-between"
              >
                <div className="truncate text-xs font-semibold text-coconut-900 dark:text-darkbg-text" title={file.name}>
                  {file.name}
                </div>
                <div className="text-[10px] text-coconut-600 dark:text-darkbg-muted font-mono mt-1">{formatBytes(file.size)}</div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(idx);
                  }}
                  className="absolute top-1.5 right-1.5 p-1 rounded-full bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          {/* 执行按钮 */}
          <div className="pt-2 flex items-center justify-between">
            <div className="text-xs text-coconut-600 dark:text-darkbg-muted">{progressText}</div>
            <button
              onClick={handleExecuteBatch}
              disabled={isProcessing}
              className={`px-6 py-3 rounded-2xl text-sm font-bold flex items-center space-x-2 transition-all ${
                isProcessing
                  ? "bg-coconut-100 dark:bg-darkbg-subtle text-coconut-400 dark:text-darkbg-muted cursor-not-allowed border border-coconut-200 dark:border-darkbg-border"
                  : "btn-3d-sunset text-white"
              }`}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>正在批量处理中...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-toast-300 dark:text-palm-700" />
                  <span>开始批量处理 ({files.length} 张)</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* 报错提醒 */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50/90 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center space-x-3 text-rose-700 dark:text-rose-300 text-sm shadow-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      {/* 处理完成结果展示与一键打包下载 */}
      {results.length > 0 && (
        <div className="bg-white/95 dark:bg-darkbg-card border border-coconut-200/90 dark:border-darkbg-border rounded-3xl p-5 sm:p-6 shadow-coconut-sm space-y-4 backdrop-blur-md">
          <div className="flex items-center justify-between pb-3 border-b border-coconut-100 dark:border-darkbg-border">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-palm-500" />
              <span className="font-bold text-sm text-coconut-900 dark:text-darkbg-text">
                处理已完成 ({results.length} 个文件)
              </span>
            </div>
            <button
              onClick={handleDownloadAllZip}
              className="px-4 py-2 btn-3d-sunset text-white rounded-xl text-xs font-bold flex items-center space-x-1.5"
            >
              <Archive className="w-4 h-4" />
              <span>一键打包下载全部 (ZIP)</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {results.map((res) => {
              const diffPercent = Math.round(((res.newSize - res.originalSize) / res.originalSize) * 100);
              const isSmaller = res.newSize < res.originalSize;

              return (
                <div
                  key={res.id}
                  className="bg-coconut-50/60 dark:bg-darkbg-subtle border border-coconut-200/70 dark:border-darkbg-border rounded-2xl p-3.5 flex items-center space-x-4 shadow-sm"
                >
                  {res.previewUrl ? (
                    <img
                      src={res.previewUrl}
                      alt={res.newFilename}
                      className="w-16 h-16 object-cover rounded-xl border border-coconut-200 dark:border-darkbg-border flex-shrink-0 bg-coconut-100 dark:bg-darkbg-elevated"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-coconut-100 dark:bg-darkbg-elevated flex items-center justify-center flex-shrink-0 text-coconut-500 dark:text-darkbg-muted">
                      <ImageIcon className="w-6 h-6" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="text-xs font-bold text-coconut-900 dark:text-darkbg-text truncate" title={res.newFilename}>
                      {res.newFilename}
                    </div>

                    <div className="flex items-center space-x-2 text-[11px] text-coconut-600 dark:text-darkbg-muted font-mono">
                      <span>{formatBytes(res.originalSize)}</span>
                      <ArrowRight className="w-3 h-3 text-coconut-400 dark:text-darkbg-subtext" />
                      <span className="font-bold text-coconut-900 dark:text-darkbg-text">{formatBytes(res.newSize)}</span>
                      {activeTab === "compress" && isSmaller && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-palm-100 dark:bg-palm-950/80 text-palm-700 dark:text-palm-300 font-bold">
                          {diffPercent}%
                        </span>
                      )}
                    </div>

                    {res.extraInfo && <div className="text-[10px] text-palm-600 dark:text-palm-400 font-medium">{res.extraInfo}</div>}
                  </div>

                  <button
                    onClick={() => downloadBlob(res.blob, res.newFilename)}
                    className="p-2 rounded-xl bg-coconut-100 dark:bg-darkbg-elevated text-coconut-700 dark:text-darkbg-text hover:bg-coconut-800 hover:text-coconut-50 dark:hover:bg-white dark:hover:text-zinc-950 transition-all flex-shrink-0 active:scale-95"
                    title="下载单张"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
