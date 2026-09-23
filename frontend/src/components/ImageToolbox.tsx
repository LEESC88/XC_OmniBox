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
  X,
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
import ScrollableTabNav from "@/components/ScrollableTabNav";
import { useI18n } from "@/lib/i18n";

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
  { name: "1寸证件照", nameEn: "1-inch ID Photo", width: 295, height: 413, desc: "标准1寸 (25x35mm, 300DPI)", descEn: "Standard 1-inch (25x35mm, 300DPI)" },
  { name: "2寸证件照", nameEn: "2-inch ID Photo", width: 413, height: 579, desc: "标准2寸 (35x49mm, 300DPI)", descEn: "Standard 2-inch (35x49mm, 300DPI)" },
  { name: "微信头像 / 正方形", nameEn: "Square Avatar", width: 500, height: 500, desc: "1:1 正方形头像", descEn: "1:1 Square Avatar" },
  { name: "小红书封面配图", nameEn: "Social Media Cover", width: 1242, height: 1656, desc: "3:4 竖屏高清规格", descEn: "3:4 Portrait HD" },
  { name: "公众号文章首图", nameEn: "Article Banner", width: 900, height: 383, desc: "2.35:1 横屏横幅", descEn: "2.35:1 Landscape Banner" },
  { name: "1080P 高清壁纸", nameEn: "1080P Wallpaper", width: 1920, height: 1080, desc: "16:9 全高清显示", descEn: "16:9 Full HD" },
];

export interface ImageToolboxProps {
  currentTab?: ImageToolTab;
  onTabChange?: (tab: ImageToolTab) => void;
}

export default function ImageToolbox({ currentTab, onTabChange }: ImageToolboxProps = {}) {
  const { lang } = useI18n();
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
      setError(lang === "en" ? "Please select or drop images to process" : "请先选择或拖拽上传需要处理的图片");
      return;
    }

    setIsProcessing(true);
    setError(null);
    const newResults: ProcessedResult[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProgressText(
          lang === "en"
            ? `Processing (${i + 1}/${files.length}): ${file.name}`
            : `正在处理 (${i + 1}/${files.length}): ${file.name}`
        );

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
            extraInfo: lang === "en" ? `Target: ${convertTarget.toUpperCase()}` : `目标: ${convertTarget.toUpperCase()}`,
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
            extraInfo: lang === "en" ? "GPS & camera metadata stripped" : "已完全清除 GPS 定位与拍摄元数据",
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
            extraInfo:
              watermarkType === "text"
                ? lang === "en"
                  ? `Text Watermark: ${watermarkText}`
                  : `文字水印: ${watermarkText}`
                : lang === "en"
                ? "Logo Stamp Watermark"
                : "Logo 贴图水印",
          });
        }
      }

      setResults(newResults);
      setProgressText("");
    } catch (err: any) {
      setError(err.message || (lang === "en" ? "An error occurred while batch processing images" : "批量处理图片时发生错误"));
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
      setError((lang === "en" ? "Failed to create ZIP bundle: " : "生成 ZIP 打包文件失败: ") + err.message);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* 6 大子功能 Tab 切换条 (支持鼠标滚轮横移、鼠标拖拽滑动、专属微滑轨与左右翻页箭头) */}
      <ScrollableTabNav
        tabs={[
          {
            id: "compress",
            label: lang === "en" ? "Smart Image Compression" : "智能图片压缩",
            icon: Zap,
            badge: lang === "en" ? "TinyPNG Level" : "TinyPNG级",
          },
          {
            id: "heic",
            label: lang === "en" ? "Apple HEIC Converter" : "苹果 HEIC 秒转",
            icon: Apple,
            badge: lang === "en" ? "iPhone Native" : "iPhone原图",
          },
          {
            id: "convert",
            label: lang === "en" ? "Universal Format Convert" : "万能格式互转",
            icon: RefreshCw,
            badge: "WebP/ICO/PNG",
          },
          {
            id: "resize",
            label: lang === "en" ? "Resize & Presets" : "尺寸缩放与预设",
            icon: Maximize2,
            badge: lang === "en" ? "ID/Social" : "证件/社交图",
          },
          {
            id: "exif",
            label: lang === "en" ? "EXIF Privacy Scrubber" : "EXIF 隐私抹除",
            icon: ShieldCheck,
            badge: lang === "en" ? "Anti-leak" : "防GPS泄露",
          },
          {
            id: "watermark",
            label: lang === "en" ? "Batch Watermark" : "批量防盗水印",
            icon: Stamp,
            badge: lang === "en" ? "Text/Logo" : "文字/Logo",
          },
        ]}
        activeTab={activeTab}
        onTabChange={(id) => handleTabSelect(id as ImageToolTab)}
      />

      {/* 参数控制面板 (根据 activeTab 变化) */}
      <div className="coconut-panel p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-coconut-200/60 dark:border-darkbg-border">
          <div className="flex items-center space-x-2 text-coconut-900 dark:text-darkbg-text font-bold text-sm">
            <Sliders className="w-4 h-4 text-toast-500" />
            <span>
              {activeTab === "compress" &&
                (lang === "en"
                  ? "Compression Options (Smart Resampling & Size Optimization)"
                  : "压缩选项设置 (智能重采样 & 体积优化)")}
              {activeTab === "heic" &&
                (lang === "en" ? "Apple HEIC/HEIF Target Format" : "苹果 HEIC/HEIF 转换目标格式")}
              {activeTab === "convert" &&
                (lang === "en"
                  ? "Universal Conversion Target & Background Fill"
                  : "万能格式转换目标与填色")}
              {activeTab === "resize" &&
                (lang === "en"
                  ? "Scale Percentage & Specification Presets"
                  : "尺寸缩放比例与规格预设")}
              {activeTab === "exif" &&
                (lang === "en"
                  ? "Privacy Protection & Geo-Location Stripping"
                  : "隐私保护与地理定位清理")}
              {activeTab === "watermark" &&
                (lang === "en" ? "Watermark Style, Opacity & Layout" : "水印样式、透明度与排布")}
            </span>
          </div>
        </div>

        {/* 1. 智能压缩面板 */}
        {activeTab === "compress" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-1">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-coconut-900 dark:text-darkbg-text font-semibold">
                  {lang === "en" ? "Compression Quality" : "压缩质量"}
                </span>
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
                onChange={(e) => setCompressMaxResolution(parseInt(e.target.value))}
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
                {lang === "en" ? "Auto-resampled proportionally when exceeding this limit" : "超过此分辨率将自动等比例重采样"}
              </p>
            </div>

            <div className="space-y-2">
              <span className="text-sm text-coconut-900 dark:text-darkbg-text font-semibold">
                {lang === "en" ? "Target File Size Cap" : "目标体积上限"}
              </span>
              <select
                value={compressTargetSizeMB}
                onChange={(e) => setCompressTargetSizeMB(parseFloat(e.target.value))}
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
        )}

        {/* 2. 苹果 HEIC 转换面板 */}
        {activeTab === "heic" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
            <div className="space-y-2">
              <span className="text-sm text-coconut-900 dark:text-darkbg-text font-semibold">
                {lang === "en" ? "Target Format" : "转换目标格式"}
              </span>
              <div className="flex space-x-3">
                {[
                  {
                    value: "image/jpeg",
                    label: "JPG / JPEG",
                    desc: lang === "en" ? "Maximum compatibility, smaller size" : "兼容性最高，文件较小",
                  },
                  {
                    value: "image/png",
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
                        onChange={() => setHeicTargetFormat(opt.value as any)}
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
                onChange={(e) => setHeicQuality(parseFloat(e.target.value))}
                className="w-full h-2 bg-coconut-200 dark:bg-darkbg-border rounded-lg appearance-none cursor-pointer accent-coconut-700 dark:accent-palm-400"
              />
              <p className="text-xs text-coconut-600 dark:text-darkbg-muted leading-relaxed">
                {lang === "en"
                  ? "Directly decompresses & transcodes iPhone HEIC photos locally in seconds"
                  : "苹果 iPhone 实拍 HEIC 照片直接在本地解压渲染，秒级转码"}
              </p>
            </div>
          </div>
        )}

        {/* 3. 万能格式互转面板 */}
        {activeTab === "convert" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-1">
            <div className="space-y-2">
              <span className="text-sm text-coconut-900 dark:text-darkbg-text font-semibold">
                {lang === "en" ? "Target Output Format" : "目标输出格式"}
              </span>
              <div className="grid grid-cols-3 gap-2">
                {(["webp", "png", "jpg", "ico", "bmp"] as const).map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => setConvertTarget(fmt)}
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
                {convertTarget === "png" &&
                  (lang === "en" ? "Lossless high-fidelity transparent image" : "无损高保真透明图")}
                {convertTarget === "jpg" &&
                  (lang === "en" ? "Universal web & print format" : "通用网络与打印图片")}
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
                onChange={(e) => setConvertQuality(parseFloat(e.target.value))}
                className="w-full h-2 bg-coconut-200 dark:bg-darkbg-border rounded-lg appearance-none cursor-pointer accent-coconut-700 dark:accent-palm-400"
              />
              <p className="text-xs text-coconut-600 dark:text-darkbg-muted leading-relaxed">
                {lang === "en" ? "Applies to WebP / JPG formats" : "对 WebP / JPG 格式生效"}
              </p>
            </div>

            <div className="space-y-2">
              <span className="text-sm text-coconut-900 dark:text-darkbg-text font-semibold">
                {lang === "en" ? "Background Fill Color" : "透明背景填色"}
              </span>
              <div className="flex items-center space-x-3">
                <input
                  type="color"
                  value={convertBgColor}
                  onChange={(e) => setConvertBgColor(e.target.value)}
                  className="w-9 h-9 rounded-lg border border-coconut-300 dark:border-darkbg-border cursor-pointer bg-transparent"
                />
                <span className="text-sm font-mono font-semibold text-coconut-800 dark:text-darkbg-muted">{convertBgColor}</span>
              </div>
              <p className="text-xs text-coconut-600 dark:text-darkbg-muted leading-relaxed">
                {lang === "en"
                  ? "Fills transparent areas when converting PNG to JPG/BMP"
                  : "当透明 PNG 转为不支持透明的 JPG/BMP 时填充此底色"}
              </p>
            </div>
          </div>
        )}

        {/* 4. 尺寸缩放与预设面板 */}
        {activeTab === "resize" && (
          <div className="space-y-4 pt-1">
            <div className="flex space-x-3">
              {[
                { id: "percent", label: lang === "en" ? "By Percentage" : "按百分比缩放" },
                {
                  id: "preset",
                  label: lang === "en" ? "Specification Presets (ID/Social)" : "常用规格预设 (证件照/社交)",
                },
                { id: "custom", label: lang === "en" ? "Custom Pixels (px)" : "自定义精确像素 (px)" },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setResizeMode(m.id as any)}
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
                    onClick={() => setResizePercent(p)}
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
                {PRESETS.map((pst) => (
                  <button
                    key={pst.name}
                    onClick={() => setSelectedPreset(pst)}
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
                    onChange={(e) => setCustomWidth(e.target.value ? parseInt(e.target.value) : "")}
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
                    onChange={(e) => setCustomHeight(e.target.value ? parseInt(e.target.value) : "")}
                    className="w-32 px-3.5 py-2 text-sm bg-white/70 dark:bg-darkbg-subtle border border-coconut-300/80 dark:border-darkbg-border rounded-xl text-coconut-900 dark:text-darkbg-text focus:outline-none focus:border-palm-500 shadow-2xs"
                  />
                  <span className="text-sm text-coconut-600 dark:text-darkbg-muted font-mono">px</span>
                </div>
                <label className="flex items-center space-x-2 text-sm text-coconut-900 dark:text-darkbg-text cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={lockAspect}
                    onChange={(e) => setLockAspect(e.target.checked)}
                    className="rounded accent-palm-600 dark:accent-palm-400"
                  />
                  <span>{lang === "en" ? "Lock Aspect Ratio (Prevent distortion)" : "锁定等比例缩放 (防止变形)"}</span>
                </label>
              </div>
            )}
          </div>
        )}

        {/* 5. EXIF 隐私抹除面板 */}
        {activeTab === "exif" && (
          <div className="p-5 sm:p-6 bg-palm-50/70 dark:bg-palm-950/20 border border-palm-200/70 dark:border-palm-900/60 rounded-2xl space-y-2.5 text-xs sm:text-sm">
            <div className="font-bold text-sm sm:text-base text-palm-900 dark:text-palm-300 flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 text-palm-600 dark:text-palm-400" />
              <span>{lang === "en" ? "Strip Location & Device Metadata" : "抹除拍摄定位与硬件元数据"}</span>
            </div>
            <p className="text-palm-800 dark:text-palm-300/90 leading-relaxed">
              {lang === "en" ? (
                <>
                  Photos taken with phones or cameras typically contain <strong>EXIF metadata</strong>, including{" "}
                  <strong>GPS coordinates</strong>, exact timestamps, device models, aperture and shutter speeds. This
                  tool reconstructs the pixel stream purely in the browser to strip non-pixel metadata without{" "}
                  <strong>any quality loss</strong>, safeguarding your privacy.
                </>
              ) : (
                <>
                  手机或相机拍摄的照片通常包含 <strong>EXIF 元数据</strong>，包括
                  <strong>拍摄地理位置 GPS 坐标</strong>、拍摄详细时间、设备型号与镜头光圈快门等。
                  本工具通过纯前端重构像素流，在<strong>不降低清晰度</strong>的前提下完全剥离任何非像素元数据，保护您的隐私安全。
                </>
              )}
            </p>
          </div>
        )}

        {/* 6. 批量水印面板 */}
        {activeTab === "watermark" && (
          <div className="space-y-4 pt-1">
            <div className="flex space-x-3">
              <button
                onClick={() => setWatermarkType("text")}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all active:scale-95 ${
                  watermarkType === "text"
                    ? "bg-coconut-800 text-coconut-50 dark:bg-white dark:text-zinc-950 font-bold shadow-sm"
                    : "bg-coconut-100/70 dark:bg-darkbg-subtle text-coconut-700 dark:text-darkbg-muted hover:dark:text-darkbg-text border border-transparent dark:border-darkbg-border"
                }`}
              >
                {lang === "en" ? "Text Watermark" : "文字水印"}
              </button>
              <button
                onClick={() => setWatermarkType("logo")}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                <div className="space-y-1.5">
                  <span className="text-sm text-coconut-900 dark:text-darkbg-text font-semibold">
                    {lang === "en" ? "Watermark Text" : "水印文字"}
                  </span>
                  <input
                    type="text"
                    value={watermarkText}
                    onChange={(e) => setWatermarkText(e.target.value)}
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
                      onChange={(e) => setWatermarkTextColor(e.target.value)}
                      className="w-9 h-9 rounded-lg border border-coconut-300 dark:border-darkbg-border cursor-pointer bg-transparent"
                    />
                    <span className="text-sm font-mono font-semibold text-coconut-800 dark:text-darkbg-muted">{watermarkTextColor}</span>
                  </div>
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
                    onChange={(e) => setWatermarkOpacity(parseFloat(e.target.value))}
                    className="w-full h-2 bg-coconut-200 dark:bg-darkbg-border rounded-lg appearance-none cursor-pointer accent-coconut-700 dark:accent-palm-400"
                  />
                </div>
                <div className="space-y-1.5">
                  <span className="text-sm text-coconut-900 dark:text-darkbg-text font-semibold">
                    {lang === "en" ? "Layout" : "水印布局"}
                  </span>
                  <select
                    value={watermarkPos}
                    onChange={(e) => setWatermarkPos(e.target.value as any)}
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
                      setWatermarkLogoFile(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />
                <button
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
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-coconut-900 dark:text-darkbg-text font-semibold">
                    {lang === "en" ? "Position:" : "位置:"}
                  </span>
                  <select
                    value={watermarkPos}
                    onChange={(e) => setWatermarkPos(e.target.value as any)}
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
                    onChange={(e) => setWatermarkOpacity(parseFloat(e.target.value))}
                    className="w-28 h-2 bg-coconut-200 dark:bg-darkbg-border rounded-lg appearance-none cursor-pointer accent-coconut-700 dark:accent-palm-400"
                  />
                  <span className="text-sm font-mono font-bold text-toast-500">{Math.round(watermarkOpacity * 100)}%</span>
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
              {lang === "en"
                ? "Click or drag images here (Batch processing supported)"
                : "点击选择或拖拽图片到此处（支持多图批量处理）"}
            </p>
            <p className="text-xs text-coconut-600 dark:text-darkbg-muted mt-1">
              {activeTab === "heic"
                ? lang === "en"
                  ? "Supports Apple iPhone / iPad formats: .HEIC, .HEIF"
                  : "支持苹果 iPhone / iPad 原图实拍格式: .HEIC, .HEIF"
                : lang === "en"
                ? "Supports image formats: JPG, PNG, WebP, AVIF, BMP, SVG, HEIC, etc."
                : "支持主流图片格式: JPG, PNG, WebP, AVIF, BMP, SVG, HEIC 等"}
            </p>
          </div>
        </div>
      </div>

      {/* 待处理文件预览列表 */}
      {files.length > 0 && (
        <div className="coconut-panel p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FileImage className="w-4 h-4 text-toast-500" />
              <span className="font-bold text-sm text-coconut-900 dark:text-darkbg-text">
                {lang === "en"
                  ? `Selected Images (${files.length} · Total ${formatBytes(files.reduce((acc, f) => acc + f.size, 0))})`
                  : `已选图片 (${files.length} 张 · 总大小 ${formatBytes(files.reduce((acc, f) => acc + f.size, 0))})`}
              </span>
            </div>
            <button
              onClick={clearAllFiles}
              className="text-xs text-rose-500 hover:text-rose-600 flex items-center space-x-1 font-medium px-2.5 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{lang === "en" ? "Clear All" : "清空全部"}</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 max-h-60 overflow-y-auto pr-1">
            {files.map((file, idx) => (
              <div
                key={idx}
                className="relative group bg-coconut-50/80 dark:bg-darkbg-subtle rounded-xl p-2 border border-coconut-200/80 dark:border-darkbg-border flex flex-col items-center text-center space-y-1"
              >
                <button
                  onClick={() => removeFile(idx)}
                  className="absolute -top-1.5 -right-1.5 p-1 rounded-full bg-rose-500 text-white shadow-xs opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
                <div className="w-10 h-10 rounded-lg bg-coconut-100 dark:bg-darkbg-elevated flex items-center justify-center text-coconut-600 dark:text-darkbg-muted">
                  <FileImage className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-medium text-coconut-800 dark:text-darkbg-text truncate w-full" title={file.name}>
                  {file.name}
                </span>
                <span className="text-[10px] text-coconut-500 dark:text-darkbg-muted font-mono">{formatBytes(file.size)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 执行主按钮 */}
      {files.length > 0 && results.length === 0 && (
        <button
          onClick={handleExecuteBatch}
          disabled={isProcessing}
          className={`w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center space-x-2 transition-all shadow-coconut-sm ${
            isProcessing
              ? "bg-coconut-100 dark:bg-darkbg-subtle text-coconut-400 dark:text-darkbg-muted cursor-not-allowed border border-coconut-200 dark:border-darkbg-border"
              : "btn-3d-sunset text-white"
          }`}
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>{progressText || (lang === "en" ? "Batch processing in progress..." : "正在批量处理中...")}</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5 text-amber-200" />
              <span>{lang === "en" ? `Start Processing (${files.length} files)` : `立即开始执行 (${files.length} 个文件)`}</span>
            </>
          )}
        </button>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50/90 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center space-x-3 text-rose-700 dark:text-rose-300 text-sm shadow-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      {/* 处理完成结果展示与一键打包下载 */}
      {results.length > 0 && (
        <div className="coconut-panel p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-coconut-200/60 dark:border-darkbg-border">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-palm-500" />
              <span className="font-bold text-sm text-coconut-900 dark:text-darkbg-text">
                {lang === "en" ? `Processing Complete (${results.length} files)` : `处理已完成 (${results.length} 个文件)`}
              </span>
            </div>
            <button
              onClick={handleDownloadAllZip}
              className="px-4 py-2 btn-3d-sunset text-white rounded-xl text-xs font-bold flex items-center space-x-1.5"
            >
              <Archive className="w-4 h-4" />
              <span>{lang === "en" ? "Download All as ZIP" : "一键打包下载全部 (ZIP)"}</span>
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
                    title={lang === "en" ? "Download image" : "下载单张"}
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
