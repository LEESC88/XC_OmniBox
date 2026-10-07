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
  SlidersHorizontal,
} from "lucide-react";
import {
  formatBytes,
  convertHeic,
  generateHeicThumbnail,
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
import ImageCompareModal, { ImageCompareItem } from "@/components/ImageCompareModal";
import BatchQueueProgress from "@/components/BatchQueueProgress";
import SendToButton from "@/components/SendToButton";
import {
  BatchTaskItem,
  BatchProgressSummary,
  executeBatchQueue,
  exportBatchFiles,
} from "@/lib/batchQueueManager";
import {
  PRESETS,
  CompressSettings,
  HeicSettings,
  ConvertSettings,
  ResizeSettings,
  ResizeFitMode,
  ExifSettings,
  WatermarkSettings,
} from "@/components/image";

type ImageToolTab = "heic" | "compress" | "convert" | "resize" | "exif" | "watermark";

interface ProcessedResult {
  id: string;
  originalName: string;
  originalSize: number;
  newFilename: string;
  newSize: number;
  blob: Blob;
  previewUrl: string;
  originalUrl?: string;
  extraInfo?: string;
}


export interface ImageToolboxProps {
  currentTab?: ImageToolTab;
  onTabChange?: (tab: ImageToolTab) => void;
  incomingFiles?: File[];
  onIncomingFilesHandled?: () => void;
}

export default function ImageToolbox({
  currentTab,
  onTabChange,
  incomingFiles,
  onIncomingFilesHandled,
}: ImageToolboxProps = {}) {
  const { lang } = useI18n();
  const [activeTab, setActiveTab] = useState<ImageToolTab>(currentTab || "compress");
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressText, setProgressText] = useState("");
  const [results, setResults] = useState<ProcessedResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [compareItem, setCompareItem] = useState<ImageCompareItem | null>(null);

  useEffect(() => {
    if (incomingFiles && incomingFiles.length > 0) {
      setFiles((prev) => [...prev, ...incomingFiles]);
      onIncomingFilesHandled?.();
    }
  }, [incomingFiles]);

  // --- 并发队列与进度状态 ---
  const [concurrency, setConcurrency] = useState(3);
  const [queueItems, setQueueItems] = useState<BatchTaskItem<File, ProcessedResult>[]>([]);
  const [queueSummary, setQueueSummary] = useState<BatchProgressSummary>({
    total: 0,
    completed: 0,
    failed: 0,
    active: 0,
    waiting: 0,
    percent: 0,
    etaSeconds: null,
  });
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (currentTab && currentTab !== activeTab) {
      setActiveTab(currentTab);
      setResults([]);
      setQueueItems([]);
      setQueueSummary({ total: 0, completed: 0, failed: 0, active: 0, waiting: 0, percent: 0, etaSeconds: null });
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
  const [convertTarget, setConvertTarget] = useState<"webp" | "avif" | "png" | "jpg" | "ico" | "bmp">("webp");
  const [convertQuality, setConvertQuality] = useState(0.9);
  const [convertBgColor, setConvertBgColor] = useState("#FFFFFF");

  // --- 尺寸缩放参数 ---
  const [resizeMode, setResizeMode] = useState<"percent" | "custom" | "preset">("percent");
  const [resizePercent, setResizePercent] = useState(50);
  const [customWidth, setCustomWidth] = useState<number | "">("");
  const [customHeight, setCustomHeight] = useState<number | "">("");
  const [lockAspect, setLockAspect] = useState(true);
  const [selectedPreset, setSelectedPreset] = useState(PRESETS[0]);
  const [resizeFitMode, setResizeFitMode] = useState<ResizeFitMode>("crop");
  const [resizePadBgColor, setResizePadBgColor] = useState("#FFFFFF");

  // --- 水印参数 ---
  const [watermarkType, setWatermarkType] = useState<"text" | "logo">("text");
  const [watermarkText, setWatermarkText] = useState("XC_OmniBox");
  const [watermarkTextColor, setWatermarkTextColor] = useState("#FFFFFF");
  const [watermarkFontSize, setWatermarkFontSize] = useState(24);
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.4);
  const [watermarkRotation, setWatermarkRotation] = useState(-25);
  const [watermarkPos, setWatermarkPos] = useState<"center" | "bottom-right" | "bottom-left" | "top-right" | "tile">("tile");
  const [watermarkLogoFile, setWatermarkLogoFile] = useState<File | null>(null);

  // --- 待处理图片缩略图映射 (消除 HEIC 与批量图片盲选黑盒) ---
  const [fileThumbnails, setFileThumbnails] = useState<Record<string, string>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 严格且大小写不敏感的 HEIC 后缀与类型识别
  const isHeicFile = (f: File) =>
    /\.(heic|heif)$/i.test(f.name) ||
    f.type.toLowerCase().includes("heic") ||
    f.type.toLowerCase().includes("heif");

  // 支持的文件后缀
  const acceptTypes =
    activeTab === "heic"
      ? ".heic,.heif,.HEIC,.HEIF,image/heic,image/heif"
      : "image/*,.heic,.heif,.HEIC,.HEIF,.svg,.ico";

  // 异步渲染上传文件列表缩略图 (HEIC 串行解析避免内存溢出，普通图片瞬时载入)
  useEffect(() => {
    let active = true;

    const loadThumbnails = async () => {
      for (const f of files) {
        const key = `${f.name}_${f.size}_${f.lastModified}`;
        if (fileThumbnails[key]) continue;

        if (isHeicFile(f)) {
          try {
            const thumbUrl = await generateHeicThumbnail(f);
            if (active && thumbUrl) {
              setFileThumbnails((prev) => ({ ...prev, [key]: thumbUrl }));
            }
          } catch {
            // 忽略单张损坏
          }
        } else if (f.type.startsWith("image/") || /\.(jpg|jpeg|png|webp|avif|bmp|svg|ico)$/i.test(f.name)) {
          try {
            const url = URL.createObjectURL(f);
            if (active) {
              setFileThumbnails((prev) => ({ ...prev, [key]: url }));
            }
          } catch {
            // 忽略单张读取失败
          }
        }
      }
    };

    if (files.length > 0) {
      loadThumbnails();
    }

    return () => {
      active = false;
    };
  }, [files]);

  // 添加文件
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      let incoming = Array.from(e.target.files);
      if (activeTab === "heic") {
        incoming = incoming.filter(isHeicFile);
        if (incoming.length === 0) {
          setError(lang === "en" ? "Only .HEIC and .HEIF formats are supported here" : "此处仅支持上传苹果 .HEIC / .HEIF 格式照片");
          return;
        }
      }
      setFiles((prev) => [...prev, ...incoming]);
      setError(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      let incoming = Array.from(e.dataTransfer.files);
      if (activeTab === "heic") {
        incoming = incoming.filter(isHeicFile);
        if (incoming.length === 0) {
          setError(lang === "en" ? "Only .HEIC and .HEIF formats are supported here" : "此处仅支持上传苹果 .HEIC / .HEIF 格式照片");
          return;
        }
      }
      setFiles((prev) => [...prev, ...incoming]);
      setError(null);
    }
  };

  const removeFile = (index: number) => {
    const fileToRemove = files[index];
    setFiles((prev) => prev.filter((_, i) => i !== index));
    if (fileToRemove) {
      setQueueItems((prev) => prev.filter((it) => it.name !== fileToRemove.name));
    }
  };

  const clearAllFiles = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    // 释放预览 Blob URL
    Object.values(fileThumbnails).forEach((url) => {
      if (url.startsWith("blob:")) URL.revokeObjectURL(url);
    });
    setFileThumbnails({});
    setFiles([]);
    setQueueItems([]);
    setResults([]);
    setError(null);
    setQueueSummary({ total: 0, completed: 0, failed: 0, active: 0, waiting: 0, percent: 0, etaSeconds: null });
  };

  // 处理单个图片任务的核心函数（具备错误隔离能力）
  const processSingleImage = async (
    item: BatchTaskItem<File, ProcessedResult>,
    reportProgress: (pct: number) => void
  ): Promise<ProcessedResult> => {
    const file = item.raw;
    reportProgress(20);

    if (activeTab === "heic") {
      const { blob, filename } = await convertHeic(file, heicTargetFormat, heicQuality);
      reportProgress(100);
      return {
        id: `res_${Date.now()}_${Math.random()}`,
        originalName: file.name,
        originalSize: file.size,
        originalUrl: URL.createObjectURL(file),
        newFilename: filename,
        newSize: blob.size,
        blob,
        previewUrl: URL.createObjectURL(blob),
      };
    } else if (activeTab === "compress") {
      const { blob, filename, originalSize, compressedSize, isOptimizedAlready } = await compressImage(file, {
        quality: compressQuality,
        maxWidthOrHeight: compressMaxResolution,
        maxSizeMB: compressTargetSizeMB,
      });
      reportProgress(100);
      return {
        id: `res_${Date.now()}_${Math.random()}`,
        originalName: file.name,
        originalSize,
        originalUrl: URL.createObjectURL(file),
        newFilename: filename,
        newSize: compressedSize,
        blob,
        previewUrl: URL.createObjectURL(blob),
        extraInfo: isOptimizedAlready
          ? lang === "en"
            ? "Optimal size preserved (No degradation)"
            : "原图已达最优体积，自动保留原图最佳画质"
          : undefined,
      };
    } else if (activeTab === "convert") {
      const { blob, filename, previewBlob } = await convertFormat(file, convertTarget, convertQuality, convertBgColor);
      reportProgress(100);
      return {
        id: `res_${Date.now()}_${Math.random()}`,
        originalName: file.name,
        originalSize: file.size,
        originalUrl: URL.createObjectURL(file),
        newFilename: filename,
        newSize: blob.size,
        blob,
        previewUrl: URL.createObjectURL(previewBlob || blob),
        extraInfo: lang === "en" ? `Target: ${convertTarget.toUpperCase()}` : `目标: ${convertTarget.toUpperCase()}`,
      };
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
          fitMode: resizeFitMode,
          padBgColor: resizePadBgColor,
        }
      );
      reportProgress(100);
      return {
        id: `res_${Date.now()}_${Math.random()}`,
        originalName: file.name,
        originalSize: file.size,
        originalUrl: URL.createObjectURL(file),
        newFilename: filename,
        newSize: blob.size,
        blob,
        previewUrl: URL.createObjectURL(blob),
        extraInfo: `${originalWidth}x${originalHeight} → ${targetWidth}x${targetHeight}`,
      };
    } else if (activeTab === "exif") {
      const { blob, filename, originalSize, newSize } = await stripExif(file);
      reportProgress(100);
      return {
        id: `res_${Date.now()}_${Math.random()}`,
        originalName: file.name,
        originalSize,
        originalUrl: URL.createObjectURL(file),
        newFilename: filename,
        newSize,
        blob,
        previewUrl: URL.createObjectURL(blob),
        extraInfo: lang === "en" ? "GPS & camera metadata stripped" : "已完全清除 GPS 定位与拍摄元数据",
      };
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
      reportProgress(100);
      return {
        id: `res_${Date.now()}_${Math.random()}`,
        originalName: file.name,
        originalSize: file.size,
        originalUrl: URL.createObjectURL(file),
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
      };
    }
    throw new Error("Unsupported image action");
  };

  // 执行并发任务管线 (HEIC 强制单线程串行防假死)
  const runPipeline = async (tasks: BatchTaskItem<File, ProcessedResult>[]) => {
    setIsProcessing(true);
    setError(null);
    const abortCtrl = new AbortController();
    abortControllerRef.current = abortCtrl;
    const effectiveConcurrency = activeTab === "heic" ? 1 : concurrency;

    try {
      const { items: updatedItems } = await executeBatchQueue(tasks, processSingleImage, {
        concurrency: effectiveConcurrency,
        signal: abortCtrl.signal,
        onProgress: (sum) => setQueueSummary({ ...sum }),
        onItemUpdate: (updated) => {
          setQueueItems((prev) => prev.map((it) => (it.id === updated.id ? { ...updated } : it)));
        },
      });

      const completed = updatedItems
        .filter((it) => it.status === "completed" && it.result)
        .map((it) => it.result!);
      setResults(completed);
    } catch (err: any) {
      setError(err?.message || (lang === "en" ? "Batch queue execution error" : "批量队列处理发生异常"));
    } finally {
      setIsProcessing(false);
      abortControllerRef.current = null;
    }
  };

  // 执行或重头启动批量处理
  const handleExecuteBatch = async () => {
    if (files.length === 0) {
      setError(lang === "en" ? "Please select or drop images to process" : "请先选择或拖拽上传需要处理的图片");
      return;
    }

    const tasks: BatchTaskItem<File, ProcessedResult>[] = files.map((file, i) => ({
      id: `task_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 7)}`,
      name: file.name,
      size: file.size,
      raw: file,
      status: "waiting",
      progress: 0,
    }));

    setQueueItems(tasks);
    await runPipeline(tasks);
  };

  // 单项重试
  const handleRetryItem = async (itemId: string) => {
    const updated = queueItems.map((it) =>
      it.id === itemId ? { ...it, status: "waiting" as const, error: undefined, progress: 0 } : it
    );
    setQueueItems(updated);
    await runPipeline(updated);
  };

  // 重试所有失败/取消项
  const handleRetryAllFailed = async () => {
    const updated = queueItems.map((it) =>
      it.status === "error" || it.status === "cancelled"
        ? { ...it, status: "waiting" as const, error: undefined, progress: 0 }
        : it
    );
    setQueueItems(updated);
    await runPipeline(updated);
  };

  // 中途取消队列
  const handleCancelQueue = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsProcessing(false);
  };

  // 统一批量导出 (Electron 直接落盘，浏览器无缝降级 ZIP 打包下载)
  const handleExportAll = async () => {
    if (results.length === 0) return;
    try {
      const items = results.map((r) => ({ blob: r.blob, filename: r.newFilename }));
      const zipName = `XC_${activeTab}_images_${Date.now()}.zip`;
      await exportBatchFiles(items, { zipName, lang });
    } catch (err: any) {
      setError((lang === "en" ? "Failed to export files: " : "导出文件失败: ") + err.message);
    }
  };

  const handleDownloadAllZip = handleExportAll;

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
          <CompressSettings
            compressQuality={compressQuality}
            onCompressQualityChange={setCompressQuality}
            compressMaxResolution={compressMaxResolution}
            onCompressMaxResolutionChange={setCompressMaxResolution}
            compressTargetSizeMB={compressTargetSizeMB}
            onCompressTargetSizeMBChange={setCompressTargetSizeMB}
          />
        )}

        {/* 2. 苹果 HEIC 转换面板 */}
        {activeTab === "heic" && (
          <HeicSettings
            heicTargetFormat={heicTargetFormat}
            onHeicTargetFormatChange={setHeicTargetFormat}
            heicQuality={heicQuality}
            onHeicQualityChange={setHeicQuality}
          />
        )}

        {/* 3. 万能格式互转面板 */}
        {activeTab === "convert" && (
          <ConvertSettings
            convertTarget={convertTarget}
            onConvertTargetChange={setConvertTarget}
            convertQuality={convertQuality}
            onConvertQualityChange={setConvertQuality}
            convertBgColor={convertBgColor}
            onConvertBgColorChange={setConvertBgColor}
          />
        )}

        {/* 4. 尺寸缩放与预设面板 */}
        {activeTab === "resize" && (
          <ResizeSettings
            resizeMode={resizeMode}
            onResizeModeChange={setResizeMode}
            resizePercent={resizePercent}
            onResizePercentChange={setResizePercent}
            customWidth={customWidth}
            onCustomWidthChange={setCustomWidth}
            customHeight={customHeight}
            onCustomHeightChange={setCustomHeight}
            lockAspect={lockAspect}
            onLockAspectChange={setLockAspect}
            selectedPreset={selectedPreset}
            onSelectedPresetChange={setSelectedPreset}
            presets={PRESETS}
            fitMode={resizeFitMode}
            onFitModeChange={setResizeFitMode}
            padBgColor={resizePadBgColor}
            onPadBgColorChange={setResizePadBgColor}
          />
        )}

        {/* 5. EXIF 隐私抹除面板 */}
        {activeTab === "exif" && <ExifSettings />}

        {/* 6. 批量水印面板 */}
        {activeTab === "watermark" && (
          <WatermarkSettings
            watermarkType={watermarkType}
            onWatermarkTypeChange={setWatermarkType}
            watermarkText={watermarkText}
            onWatermarkTextChange={setWatermarkText}
            watermarkTextColor={watermarkTextColor}
            onWatermarkTextColorChange={setWatermarkTextColor}
            watermarkFontSize={watermarkFontSize}
            onWatermarkFontSizeChange={setWatermarkFontSize}
            watermarkOpacity={watermarkOpacity}
            onWatermarkOpacityChange={setWatermarkOpacity}
            watermarkPos={watermarkPos}
            onWatermarkPosChange={setWatermarkPos}
            watermarkLogoFile={watermarkLogoFile}
            onWatermarkLogoFileChange={setWatermarkLogoFile}
          />
        )}
      </div>

      {/* 拖拽批量上传区域 */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className="group relative overflow-hidden border-2 border-dashed border-[#D2BCAB]/70 dark:border-[#4D392E]/60 hover:border-amber-500/70 dark:hover:border-amber-500/70 bg-gradient-to-b from-[#FBF8F4]/80 to-[#F5ECE1]/60 dark:from-[#211713]/70 dark:to-[#18110D]/70 hover:from-[#FFFDF9] hover:to-[#FDF4EB] dark:hover:from-[#291D17] dark:hover:to-[#1F1511] rounded-3xl p-8 sm:p-11 text-center cursor-pointer transition-all duration-300 shadow-sm hover:shadow-lg hover:shadow-amber-900/5 select-none"
      >
        <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[radial-gradient(circle_at_50%_40%,rgba(245,158,11,0.08),transparent_65%)]" />
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptTypes}
          onChange={handleFileChange}
          className="hidden"
        />
        <div className="relative flex flex-col items-center space-y-3.5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center group-hover:scale-105 group-hover:-translate-y-0.5 transition-all duration-300 shadow-md shadow-orange-500/25">
            <UploadCloud className="w-7 h-7" />
          </div>
          <div>
            <p className="text-base font-bold text-coconut-900 dark:text-darkbg-text tracking-tight group-hover:text-amber-800 dark:group-hover:text-amber-300 transition-colors">
              {lang === "en"
                ? "Click or drag images here (Batch processing supported)"
                : "点击选择或拖拽图片到此处（支持多图批量处理）"}
            </p>
            <p className="text-xs text-coconut-600 dark:text-darkbg-muted mt-1 max-w-md mx-auto">
              {activeTab === "heic"
                ? lang === "en"
                  ? "Supports Apple iPhone / iPad formats: .HEIC, .HEIF"
                  : "支持苹果 iPhone / iPad 原图实拍格式: .HEIC, .HEIF"
                : lang === "en"
                ? "Supports image formats: JPG, PNG, WebP, AVIF, BMP, SVG, HEIC, etc."
                : "支持主流图片格式: JPG, PNG, WebP, AVIF, BMP, SVG, HEIC 等"}
            </p>
          </div>
          <div className="flex items-center flex-wrap justify-center gap-2 pt-1 text-[11px] font-medium text-coconut-600 dark:text-darkbg-muted">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-coconut-100/70 dark:bg-darkbg-card border border-coconut-200/80 dark:border-darkbg-border">
              ⚡ 本地硬件加速
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              100% 本地沙盒保密
            </span>
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
            {files.map((file, idx) => {
              const key = `${file.name}_${file.size}_${file.lastModified}`;
              const thumb = fileThumbnails[key];
              return (
                <div
                  key={idx}
                  className="relative group bg-coconut-50/80 dark:bg-darkbg-subtle rounded-xl p-2 border border-coconut-200/80 dark:border-darkbg-border flex flex-col items-center text-center space-y-1"
                >
                  <button
                    onClick={() => removeFile(idx)}
                    className="absolute -top-1.5 -right-1.5 p-1 rounded-full bg-rose-500 text-white shadow-xs opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  <div className="w-10 h-10 rounded-lg bg-coconut-100 dark:bg-darkbg-elevated flex items-center justify-center text-coconut-600 dark:text-darkbg-muted overflow-hidden relative">
                    {thumb ? (
                      <img src={thumb} alt={file.name} className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <FileImage className="w-5 h-5" />
                    )}
                  </div>
                  <span className="text-[11px] font-medium text-coconut-800 dark:text-darkbg-text truncate w-full" title={file.name}>
                    {file.name}
                  </span>
                  <span className="text-[10px] text-coconut-500 dark:text-darkbg-muted font-mono">{formatBytes(file.size)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 批量并发队列进度监控面板 */}
      {queueItems.length > 0 && (
        <BatchQueueProgress
          summary={queueSummary}
          items={queueItems}
          isProcessing={isProcessing}
          concurrency={activeTab === "heic" ? 1 : concurrency}
          onConcurrencyChange={(c) => {
            if (activeTab !== "heic") setConcurrency(c);
          }}
          onCancel={handleCancelQueue}
          onRetryItem={handleRetryItem}
          onRetryAllFailed={handleRetryAllFailed}
          onExportAll={handleExportAll}
          exportLabel={lang === "en" ? "Export All" : "一键导出全部"}
          title={
            activeTab === "heic"
              ? lang === "en"
                ? "HEIC Batch Queue (Single-thread Memory Guard)"
                : "HEIC 批量转换队列 (串行内存保护模式)"
              : lang === "en"
              ? "Image Batch Processing Queue"
              : "图片批量并发队列"
          }
          lang={lang}
        />
      )}

      {/* 执行主按钮 */}
      {files.length > 0 && !isProcessing && (
        <button
          onClick={handleExecuteBatch}
          data-primary-action="true"
          className="w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center space-x-2 transition-all shadow-coconut-sm btn-3d-sunset text-white"
        >
          <Sparkles className="w-5 h-5 text-amber-200" />
          <span>
            {queueItems.length > 0
              ? lang === "en"
                ? `Re-process All (${files.length} files)`
                : `重新并发处理全部 (${files.length} 个文件)`
              : lang === "en"
              ? `Start Processing (${files.length} files)`
              : `立即开始并发处理 (${files.length} 个文件)`}
          </span>
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
              onClick={handleExportAll}
              data-download-result="true"
              className="px-4 py-2 btn-3d-sunset text-white rounded-xl text-xs font-bold flex items-center space-x-1.5"
            >
              <Archive className="w-4 h-4" />
              <span>{lang === "en" ? "Export All" : "一键导出全部"}</span>
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
                      {activeTab === "compress" && (
                        isSmaller ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-palm-100 dark:bg-palm-950/80 text-palm-700 dark:text-palm-300 font-bold">
                            {diffPercent}%
                          </span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-bold">
                            {lang === "en" ? "Optimal" : "已最优"}
                          </span>
                        )
                      )}
                    </div>

                    {res.extraInfo && <div className="text-[10px] text-palm-600 dark:text-palm-400 font-medium">{res.extraInfo}</div>}
                  </div>

                  <div className="flex items-center space-x-1.5 flex-shrink-0">
                    {res.previewUrl && res.originalUrl && (
                      <button
                        onClick={() =>
                          setCompareItem({
                            id: res.id,
                            originalName: res.originalName,
                            originalSize: res.originalSize,
                            originalUrl: res.originalUrl!,
                            newFilename: res.newFilename,
                            newSize: res.newSize,
                            previewUrl: res.previewUrl,
                            blob: res.blob,
                            extraInfo: res.extraInfo,
                          })
                        }
                        className="px-2.5 py-2 rounded-xl bg-palm-100/80 dark:bg-palm-950/60 text-palm-700 dark:text-palm-300 hover:bg-palm-600 hover:text-white dark:hover:bg-palm-500 dark:hover:text-zinc-950 transition-all flex items-center space-x-1 text-xs font-semibold active:scale-95 shadow-xs"
                        title={lang === "en" ? "Compare Quality (Squoosh Mode)" : "画质微距对比 (Before / After)"}
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{lang === "en" ? "Compare" : "画质对比"}</span>
                      </button>
                    )}

                    <button
                      onClick={() => downloadBlob(res.blob, res.newFilename)}
                      className="p-2 rounded-xl bg-coconut-100 dark:bg-darkbg-elevated text-coconut-700 dark:text-darkbg-text hover:bg-coconut-800 hover:text-coconut-50 dark:hover:bg-white dark:hover:text-zinc-950 transition-all active:scale-95"
                      title={lang === "en" ? "Download image" : "下载单张"}
                    >
                      <Download className="w-4 h-4" />
                    </button>

                    <SendToButton
                      compact
                      category="image"
                      payload={{
                        blob: res.blob,
                        filename: res.newFilename,
                        sourceTitle: `图片工坊 (${res.newFilename})`,
                      }}
                      lang={lang}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Squoosh 风格画质微距对比弹窗 */}
      <ImageCompareModal
        isOpen={!!compareItem}
        onClose={() => setCompareItem(null)}
        item={compareItem}
      />
    </div>
  );
}
