"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  UploadCloud,
  Download,
  Copy,
  Check,
  Trash2,
  Sliders,
  FileText,
  Layers,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Eye,
  Palette,
  Maximize2,
  ArrowRight,
  SplitSquareHorizontal,
  FileCheck,
  Zap,
  UserCheck,
} from "lucide-react";
import {
  removeBackgroundAI,
  recognizeTextOCR,
  enhanceAndUpscaleImage,
  OCR_LANGUAGES,
  OcrResult,
  BgRemovalEngine,
  EnhanceResult,
} from "@/lib/aiProcessor";
import { downloadBlob } from "@/lib/api";
import { formatBytes } from "@/lib/imageProcessor";
import ScrollableTabNav from "@/components/ScrollableTabNav";

export type AiTabType = "ai-bg-remove" | "ai-ocr" | "ai-upscale";

export interface AiToolboxProps {
  currentTab?: AiTabType;
  onTabChange?: (tab: AiTabType) => void;
  onNavigateToIdPhoto?: (photoFile: File) => void;
}

const BG_PRESETS = [
  { label: "透明底", value: "transparent", color: "transparent" },
  { label: "纯白底", value: "#ffffff", color: "#ffffff" },
  { label: "证件蓝", value: "#438EDB", color: "#438EDB" },
  { label: "证件红", value: "#D9001B", color: "#D9001B" },
  { label: "极简灰", value: "#E2E8F0", color: "#E2E8F0" },
  { label: "深邃黑", value: "#1E293B", color: "#1E293B" },
];

export default function AiToolbox({
  currentTab = "ai-bg-remove",
  onTabChange,
  onNavigateToIdPhoto,
}: AiToolboxProps) {
  const [activeTab, setActiveTab] = useState<AiTabType>(currentTab);

  useEffect(() => {
    if (currentTab && currentTab !== activeTab) {
      setActiveTab(currentTab);
    }
  }, [currentTab]);

  const handleTabChange = (tab: AiTabType) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  // =========================================================================
  // 1. AI 智能抠图状态
  // =========================================================================
  const [bgFile, setBgFile] = useState<File | null>(null);
  const [bgPreviewUrl, setBgPreviewUrl] = useState<string | null>(null);
  const [bgResultBlob, setBgResultBlob] = useState<Blob | null>(null);
  const [bgResultUrl, setBgResultUrl] = useState<string | null>(null);
  const [bgEngine, setBgEngine] = useState<BgRemovalEngine>("ai");
  const [selectedBgColor, setSelectedBgColor] = useState<string>("transparent");
  const [bgLoading, setBgLoading] = useState(false);
  const [bgProgress, setBgProgress] = useState(0);
  const [bgStage, setBgStage] = useState("");
  const [bgError, setBgError] = useState<string | null>(null);
  const [bgCompareSlider, setBgCompareSlider] = useState(50); // 0 ~ 100

  const handleBgFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBgFile(file);
    setBgPreviewUrl(URL.createObjectURL(file));
    setBgResultBlob(null);
    setBgResultUrl(null);
    setBgError(null);
    setBgProgress(0);
  };

  const handleExecuteBgRemoval = async () => {
    if (!bgFile) return;
    setBgLoading(true);
    setBgError(null);
    setBgProgress(5);
    setBgStage("正在准备模型...");

    try {
      const blob = await removeBackgroundAI(bgFile, {
        engine: bgEngine,
        backgroundColor: selectedBgColor === "transparent" ? null : selectedBgColor,
        onProgress: (pct, stage) => {
          setBgProgress(pct);
          setBgStage(stage);
        },
      });

      setBgResultBlob(blob);
      setBgResultUrl(URL.createObjectURL(blob));
      setBgProgress(100);
      setBgStage("抠图完成！");
    } catch (err: any) {
      setBgError(err.message || "智能抠图失败，请重试或尝试切换为快速算法模式");
    } finally {
      setBgLoading(false);
    }
  };

  // 更改背景底色后重新合成
  const handleChangeBgColor = async (color: string) => {
    setSelectedBgColor(color);
    if (!bgResultBlob && !bgFile) return;
    // 如果已经抠好了透明图，实时在画布上合成或重新渲染
    if (bgResultBlob && color !== "transparent") {
      try {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext("2d")!;
          ctx.fillStyle = color;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          canvas.toBlob((b) => {
            if (b) {
              setBgResultUrl(URL.createObjectURL(b));
            }
          }, "image/png");
        };
        img.src = URL.createObjectURL(bgResultBlob);
      } catch (e) {
        console.error(e);
      }
    } else if (bgResultBlob && color === "transparent") {
      setBgResultUrl(URL.createObjectURL(bgResultBlob));
    }
  };

  const handleDownloadBgResult = () => {
    if (!bgResultUrl) return;
    const a = document.createElement("a");
    a.href = bgResultUrl;
    a.download = `XC_AI_Matting_${Date.now()}.png`;
    a.click();
  };

  const handleSendToIdPhoto = () => {
    if (!bgResultBlob && !bgFile) return;
    const blobToUse = bgResultBlob || bgFile;
    if (!blobToUse) return;
    const photoFile = new File([blobToUse], "ai_matting_portrait.png", { type: "image/png" });
    if (onNavigateToIdPhoto) {
      onNavigateToIdPhoto(photoFile);
    }
  };

  // =========================================================================
  // 2. AI 离线 OCR 文字识别状态
  // =========================================================================
  const [ocrFile, setOcrFile] = useState<File | null>(null);
  const [ocrPreviewUrl, setOcrPreviewUrl] = useState<string | null>(null);
  const [ocrLang, setOcrLang] = useState<string>("chi_sim+eng");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStage, setOcrStage] = useState("");
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [ocrEditableText, setOcrEditableText] = useState("");
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrCopied, setOcrCopied] = useState(false);

  const handleOcrFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setOcrFile(file);
    setOcrPreviewUrl(URL.createObjectURL(file));
    setOcrResult(null);
    setOcrEditableText("");
    setOcrError(null);
    setOcrProgress(0);
  };

  const handleExecuteOcr = async () => {
    if (!ocrFile) return;
    setOcrLoading(true);
    setOcrError(null);
    setOcrProgress(5);
    setOcrStage("启动 OCR 离线识别...");

    try {
      const result = await recognizeTextOCR(ocrFile, ocrLang, (pct, stage) => {
        setOcrProgress(pct);
        setOcrStage(stage);
      });

      setOcrResult(result);
      setOcrEditableText(result.text);
      setOcrProgress(100);
      setOcrStage("识别完成！");
    } catch (err: any) {
      setOcrError(err.message || "OCR 识别异常，请尝试换用更清晰的图片");
    } finally {
      setOcrLoading(false);
    }
  };

  const handleCopyOcrText = () => {
    if (!ocrEditableText) return;
    navigator.clipboard.writeText(ocrEditableText);
    setOcrCopied(true);
    setTimeout(() => setOcrCopied(false), 2000);
  };

  const handleDownloadOcrTxt = () => {
    if (!ocrEditableText) return;
    const blob = new Blob([ocrEditableText], { type: "text/plain;charset=utf-8" });
    downloadBlob(blob, `XC_OCR_${Date.now()}.txt`);
  };

  // =========================================================================
  // 3. AI 模糊图片高清修复与超分辨率状态
  // =========================================================================
  const [upscaleFile, setUpscaleFile] = useState<File | null>(null);
  const [upscalePreviewUrl, setUpscalePreviewUrl] = useState<string | null>(null);
  const [upscaleScale, setUpscaleScale] = useState<1 | 2 | 4>(2);
  const [upscaleSharpness, setUpscaleSharpness] = useState<number>(1.2);
  const [upscaleDenoise, setUpscaleDenoise] = useState<boolean>(true);
  const [upscaleContrast, setUpscaleContrast] = useState<boolean>(true);
  const [upscaleLoading, setUpscaleLoading] = useState(false);
  const [upscaleProgress, setUpscaleProgress] = useState(0);
  const [upscaleStage, setUpscaleStage] = useState("");
  const [upscaleResult, setUpscaleResult] = useState<EnhanceResult | null>(null);
  const [upscaleResultUrl, setUpscaleResultUrl] = useState<string | null>(null);
  const [upscaleError, setUpscaleError] = useState<string | null>(null);
  const [upscaleSlider, setUpscaleSlider] = useState(50);

  const handleUpscaleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUpscaleFile(file);
    setUpscalePreviewUrl(URL.createObjectURL(file));
    setUpscaleResult(null);
    setUpscaleResultUrl(null);
    setUpscaleError(null);
    setUpscaleProgress(0);
  };

  const handleExecuteUpscale = async () => {
    if (!upscaleFile) return;
    setUpscaleLoading(true);
    setUpscaleError(null);
    setUpscaleProgress(5);
    setUpscaleStage("初始化超清增强算法...");

    try {
      const res = await enhanceAndUpscaleImage(upscaleFile, {
        scale: upscaleScale,
        sharpness: upscaleSharpness,
        denoise: upscaleDenoise,
        enhanceContrast: upscaleContrast,
        onProgress: (pct, stage) => {
          setUpscaleProgress(pct);
          setUpscaleStage(stage);
        },
      });

      setUpscaleResult(res);
      setUpscaleResultUrl(URL.createObjectURL(res.blob));
      setUpscaleProgress(100);
      setUpscaleStage("修复增强完成！");
    } catch (err: any) {
      setUpscaleError(err.message || "超分辨率修复失败，请重试");
    } finally {
      setUpscaleLoading(false);
    }
  };

  const handleDownloadUpscaleResult = () => {
    if (!upscaleResult) return;
    downloadBlob(upscaleResult.blob, `XC_UltraClear_${upscaleResult.scaleFactor}x_${Date.now()}.png`);
  };

  return (
    <div className="space-y-6">
      {/* 顶部三栏切换 Tab (支持滚轮横移、鼠标拖拽与左右翻页箭头) */}
      <ScrollableTabNav
        tabs={[
          {
            id: "ai-bg-remove",
            label: "AI 发丝级智能抠图",
            icon: Sparkles,
            badge: "无痕透底",
          },
          {
            id: "ai-ocr",
            label: "AI 文字提取 (OCR)",
            icon: FileText,
            badge: "多语言",
          },
          {
            id: "ai-upscale",
            label: "AI 模糊图片高清修复",
            icon: Maximize2,
            badge: "2x/4x超清",
          },
        ]}
        activeTab={activeTab}
        onTabChange={(id) => handleTabChange(id as AiTabType)}
      />

      {/* ========================================================================= */}
      {/* 模块 1: AI 发丝级智能抠图                                                   */}
      {/* ========================================================================= */}
      {activeTab === "ai-bg-remove" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* 左侧控制台 */}
          <div className="lg:col-span-5 coconut-panel p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-coconut-200/80 dark:border-darkbg-border">
              <div className="flex items-center gap-2 text-sm font-bold text-coconut-950 dark:text-darkbg-text">
                <Sliders className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                <span>抠图引擎与配置</span>
              </div>
            </div>

            {/* 引擎切换 */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-coconut-900 dark:text-darkbg-text">
                算法引擎模式
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setBgEngine("ai")}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    bgEngine === "ai"
                      ? "border-orange-500 bg-orange-50/70 dark:bg-orange-950/40 text-coconut-950 dark:text-darkbg-text shadow-sm ring-1 ring-orange-400/30"
                      : "border-coconut-200 dark:border-darkbg-border text-coconut-700 dark:text-darkbg-muted hover:bg-coconut-100/50 dark:hover:bg-darkbg-subtle"
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold mb-1">
                    <Sparkles className="w-4 h-4 text-orange-600" />
                    <span>AI 神经网络</span>
                  </div>
                  <p className="text-xs text-coconut-600 dark:text-darkbg-muted leading-relaxed">
                    发丝级精细分割，自动识别复杂人像与主体
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setBgEngine("chroma")}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    bgEngine === "chroma"
                      ? "border-orange-500 bg-orange-50/70 dark:bg-orange-950/40 text-coconut-950 dark:text-darkbg-text shadow-sm ring-1 ring-orange-400/30"
                      : "border-coconut-200 dark:border-darkbg-border text-coconut-700 dark:text-darkbg-muted hover:bg-coconut-100/50 dark:hover:bg-darkbg-subtle"
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold mb-1">
                    <Zap className="w-4 h-4 text-amber-600" />
                    <span>极速色度算法</span>
                  </div>
                  <p className="text-xs text-coconut-600 dark:text-darkbg-muted leading-relaxed">
                    瞬时处理，适合纯色或单色背景图片
                  </p>
                </button>
              </div>
            </div>

            {/* 背景底色预设 */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-coconut-900 dark:text-darkbg-text">
                输出背景底色
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {BG_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => handleChangeBgColor(preset.value)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs sm:text-sm font-semibold transition-all ${
                      selectedBgColor === preset.value
                        ? "border-orange-500 bg-orange-50/80 dark:bg-orange-950/50 text-orange-900 dark:text-orange-200 font-bold shadow-xs ring-1 ring-orange-400/30"
                        : "border-coconut-200 dark:border-darkbg-border text-coconut-800 dark:text-darkbg-muted hover:bg-coconut-100/50"
                    }`}
                  >
                    <span
                      className="w-4 h-4 rounded-full border border-coconut-300 shadow-inner flex-shrink-0"
                      style={{
                        backgroundColor: preset.value === "transparent" ? "transparent" : preset.color,
                        backgroundImage:
                          preset.value === "transparent"
                            ? "conic-gradient(#ccc 0.25turn, white 0.25turn 0.5turn, #ccc 0.5turn 0.75turn, white 0.75turn)"
                            : "none",
                        backgroundSize: "6px 6px",
                      }}
                    />
                    <span className="truncate">{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 证件照联动快捷入口 */}
            <div className="p-4 bg-coconut-100/70 dark:bg-darkbg-subtle/80 border border-coconut-200 dark:border-darkbg-border rounded-2xl space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-bold text-coconut-950 dark:text-darkbg-text">
                <FileCheck className="w-4 h-4 text-orange-600" />
                <span>联动证件照排版</span>
              </div>
              <p className="text-xs text-coconut-700 dark:text-darkbg-muted leading-relaxed">
                扣除背景后，可直接点击一键转入【证件照排版】，自动生成 1寸 / 2寸 冲印模板。
              </p>
            </div>

            {/* 立即执行按钮 */}
            <button
              onClick={handleExecuteBgRemoval}
              disabled={bgLoading || !bgFile}
              className="w-full py-3.5 px-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 btn-3d-sunset active:scale-95"
            >
              {bgLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>正在处理抠图 ({bgProgress}%)...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-200" />
                  <span>立即开始智能抠图</span>
                </>
              )}
            </button>
          </div>

          {/* 右侧展示与对比工作台 */}
          <div className="lg:col-span-7 space-y-5">
            {/* 上传区域 */}
            {!bgFile ? (
              <div className="bg-[#FAF1E8]/75 dark:bg-[#251E1A]/70 border-2 border-dashed border-[#D2BCAB] dark:border-[#4D392E] hover:border-amber-500 dark:hover:border-amber-400 rounded-3xl p-10 text-center transition-all cursor-pointer relative group">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/bmp"
                  onChange={handleBgFileSelect}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="w-14 h-14 mx-auto rounded-2xl bg-coconut-100/80 dark:bg-darkbg-subtle flex items-center justify-center text-coconut-600 dark:text-darkbg-muted group-hover:scale-110 group-hover:text-amber-600 transition-all mb-4">
                  <UploadCloud className="w-7 h-7" />
                </div>
                <h4 className="text-sm font-bold text-coconut-900 dark:text-darkbg-text mb-1">
                  拖入需要抠图的图片，或点击选择
                </h4>
                <p className="text-xs text-coconut-500 dark:text-darkbg-muted max-w-sm mx-auto">
                  支持人像、证件照自拍、宠物毛发、静物电商图（JPG, PNG, WebP），100% 本地运算不上传
                </p>
              </div>
            ) : (
              <div className="coconut-panel p-5 sm:p-6 space-y-4">
                {/* 状态栏 */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-coconut-100 dark:border-darkbg-border text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-coconut-900 dark:text-darkbg-text">
                      {bgFile.name}
                    </span>
                    <span className="text-coconut-400 font-mono">
                      ({formatBytes(bgFile.size)})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-coconut-600 dark:text-darkbg-muted hover:text-palm-600 cursor-pointer font-medium">
                      更换图片
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleBgFileSelect}
                        className="hidden"
                      />
                    </label>
                    <button
                      onClick={() => {
                        setBgFile(null);
                        setBgPreviewUrl(null);
                        setBgResultBlob(null);
                        setBgResultUrl(null);
                      }}
                      className="text-toast-500 hover:text-toast-600 flex items-center gap-1 font-medium"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>清空</span>
                    </button>
                  </div>
                </div>

                {/* 处理进度条 */}
                {bgLoading && (
                  <div className="p-4 bg-coconut-50 dark:bg-darkbg-subtle rounded-2xl border border-coconut-200 dark:border-darkbg-border space-y-2">
                    <div className="flex justify-between text-xs text-coconut-700 dark:text-darkbg-muted">
                      <span className="font-medium flex items-center gap-1.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-palm-600" />
                        <span>{bgStage || "深度神经网络逐像素分割中..."}</span>
                      </span>
                      <span className="font-mono font-bold text-orange-600 dark:text-orange-400">{bgProgress}%</span>
                    </div>
                    <div className="w-full h-3 bg-coconut-200/80 dark:bg-darkbg-border rounded-full overflow-hidden p-0.5 shadow-inner">
                      <div
                        className="h-full rounded-full progress-sunset-striped transition-all duration-300 shadow-sm"
                        style={{ width: `${Math.max(5, bgProgress)}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* 错误提示 */}
                {bgError && (
                  <div className="p-3 bg-toast-50 dark:bg-toast-950/40 border border-toast-200 dark:border-toast-900/60 rounded-2xl flex items-center gap-2 text-toast-700 dark:text-toast-300 text-xs">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 text-toast-500" />
                    <span>{bgError}</span>
                  </div>
                )}

                {/* 视图画布区域 */}
                <div className="relative w-full min-h-[360px] max-h-[540px] flex items-center justify-center rounded-2xl overflow-hidden border border-coconut-200/80 dark:border-darkbg-border bg-[#121212]/5 dark:bg-darkbg-subtle">
                  {/* 背景棋盘格纹理 */}
                  <div
                    className="absolute inset-0 z-0 pointer-events-none opacity-40"
                    style={{
                      backgroundImage:
                        "conic-gradient(#e2e8f0 0.25turn, transparent 0.25turn 0.5turn, #e2e8f0 0.5turn 0.75turn, transparent 0.75turn)",
                      backgroundSize: "16px 16px",
                    }}
                  />

                  {/* 尚未生成结果时：显示原图 */}
                  {!bgResultUrl && bgPreviewUrl && (
                    <img
                      src={bgPreviewUrl}
                      alt="原图预览"
                      className="relative z-10 max-w-full max-h-[500px] object-contain shadow-md rounded-lg"
                    />
                  )}

                  {/* 已生成抠图结果：支持滑动条对比 */}
                  {bgResultUrl && bgPreviewUrl && (
                    <div className="relative z-10 w-full h-[480px] select-none overflow-hidden flex items-center justify-center">
                      {/* 底层：原图 */}
                      <img
                        src={bgPreviewUrl}
                        alt="原图"
                        className="absolute max-h-[460px] max-w-full object-contain"
                      />

                      {/* 顶层：抠图后透明效果（通过 clip-path 实现滑动对比） */}
                      <div
                        className="absolute inset-0 flex items-center justify-center overflow-hidden"
                        style={{
                          clipPath: `polygon(0 0, ${bgCompareSlider}% 0, ${bgCompareSlider}% 100%, 0 100%)`,
                        }}
                      >
                        <img
                          src={bgResultUrl}
                          alt="抠图效果"
                          className="max-h-[460px] max-w-full object-contain"
                        />
                      </div>

                      {/* 中间分割线 */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-md z-20 pointer-events-none"
                        style={{ left: `${bgCompareSlider}%` }}
                      >
                        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-7 h-7 bg-white dark:bg-coconut-900 border border-coconut-300 rounded-full flex items-center justify-center shadow-lg text-[10px] text-coconut-700 dark:text-darkbg-text font-bold">
                          <SplitSquareHorizontal className="w-3.5 h-3.5" />
                        </div>
                      </div>

                      {/* 标尺角标 */}
                      <div className="absolute top-3 left-3 px-2.5 py-1 rounded-xl bg-black/60 text-white text-[10px] font-mono backdrop-blur-sm z-20">
                        抠图效果 ({bgCompareSlider}%)
                      </div>
                      <div className="absolute top-3 right-3 px-2.5 py-1 rounded-xl bg-black/60 text-white text-[10px] font-mono backdrop-blur-sm z-20">
                        原始图片
                      </div>
                    </div>
                  )}
                </div>

                {/* 对比滑块控制器 */}
                {bgResultUrl && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-xs text-coconut-600 dark:text-darkbg-muted">
                      <span>左右滑动对比抠图边缘与原图</span>
                      <span className="font-mono">{bgCompareSlider}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={bgCompareSlider}
                      onChange={(e) => setBgCompareSlider(parseInt(e.target.value))}
                      className="w-full accent-palm-600 cursor-pointer"
                    />
                  </div>
                )}

                {/* 底部功能下载与联动操作区 */}
                {bgResultUrl && (
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-coconut-100 dark:border-darkbg-border">
                    <button
                      onClick={handleSendToIdPhoto}
                      className="flex items-center gap-2 py-2.5 px-4 rounded-2xl bg-palm-100 dark:bg-palm-950/80 text-palm-800 dark:text-palm-300 border border-palm-300/60 dark:border-palm-800/80 font-bold text-xs transition-all hover:bg-palm-200/80 active:scale-95 shadow-sm"
                    >
                      <UserCheck className="w-4 h-4 text-palm-600" />
                      <span>转入 6 寸证件照排版 🚀</span>
                    </button>

                    <button
                      onClick={handleDownloadBgResult}
                      className="flex items-center gap-2 py-2.5 px-5 rounded-2xl btn-3d-sunset text-white text-xs font-bold shadow-coconut-sm"
                    >
                      <Download className="w-4 h-4" />
                      <span>下载无损透明 PNG</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 模块 2: AI 离线 OCR 文字提取                                                */}
      {/* ========================================================================= */}
      {activeTab === "ai-ocr" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* 左侧控制台 */}
          <div className="lg:col-span-5 coconut-panel p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-coconut-200/80 dark:border-darkbg-border">
              <div className="flex items-center gap-2 text-sm font-bold text-coconut-950 dark:text-darkbg-text">
                <Sliders className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                <span>OCR 识别语言选择</span>
              </div>
            </div>

            {/* 语言选择 */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-coconut-900 dark:text-darkbg-text">
                文字识别语言字库
              </label>
              <div className="space-y-2.5">
                {OCR_LANGUAGES.map((lang) => (
                  <button
                    key={lang.id}
                    type="button"
                    onClick={() => setOcrLang(lang.id)}
                    className={`w-full text-left p-3 rounded-2xl border transition-all ${
                      ocrLang === lang.id
                        ? "border-orange-500 bg-orange-50/70 dark:bg-orange-950/40 text-coconut-950 dark:text-darkbg-text shadow-sm ring-1 ring-orange-400/30"
                        : "border-coconut-200 dark:border-darkbg-border text-coconut-700 dark:text-darkbg-muted hover:bg-coconut-100/50"
                    }`}
                  >
                    <div className="text-sm font-bold text-coconut-950 dark:text-white">{lang.label}</div>
                    <div className="text-xs text-coconut-600 dark:text-darkbg-muted mt-0.5 leading-relaxed">
                      {lang.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 立即识别按钮 */}
            <button
              onClick={handleExecuteOcr}
              disabled={ocrLoading || !ocrFile}
              className="w-full py-3.5 px-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 btn-3d-sunset active:scale-95"
            >
              {ocrLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>正在识别提取 ({ocrProgress}%)...</span>
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 text-amber-200" />
                  <span>立即开始文字提取</span>
                </>
              )}
            </button>
          </div>

          {/* 右侧展示与文字编辑区域 */}
          <div className="lg:col-span-7 space-y-5">
            {!ocrFile ? (
              <div className="bg-[#FAF1E8]/75 dark:bg-[#251E1A]/70 border-2 border-dashed border-[#D2BCAB] dark:border-[#4D392E] hover:border-amber-500 dark:hover:border-amber-400 rounded-3xl p-10 text-center transition-all cursor-pointer relative group">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/bmp"
                  onChange={handleOcrFileSelect}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="w-14 h-14 mx-auto rounded-2xl bg-coconut-100/80 dark:bg-darkbg-subtle flex items-center justify-center text-coconut-600 dark:text-darkbg-muted group-hover:scale-110 group-hover:text-amber-600 transition-all mb-4">
                  <UploadCloud className="w-7 h-7" />
                </div>
                <h4 className="text-sm font-bold text-coconut-900 dark:text-darkbg-text mb-1">
                  拖入需要识别的图片或截图，或点击上传
                </h4>
                <p className="text-xs text-coconut-500 dark:text-darkbg-muted max-w-sm mx-auto">
                  支持拍照合同、教材书籍、电子发票、证件单据与网页截图
                </p>
              </div>
            ) : (
              <div className="coconut-panel p-5 sm:p-6 space-y-4">
                {/* 状态与切换 */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-coconut-100 dark:border-darkbg-border text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-coconut-900 dark:text-darkbg-text">
                      {ocrFile.name}
                    </span>
                    <span className="text-coconut-400 font-mono">
                      ({formatBytes(ocrFile.size)})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-coconut-600 dark:text-darkbg-muted hover:text-palm-600 cursor-pointer font-medium">
                      更换图片
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleOcrFileSelect}
                        className="hidden"
                      />
                    </label>
                    <button
                      onClick={() => {
                        setOcrFile(null);
                        setOcrPreviewUrl(null);
                        setOcrResult(null);
                        setOcrEditableText("");
                      }}
                      className="text-toast-500 hover:text-toast-600 flex items-center gap-1 font-medium"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>清空</span>
                    </button>
                  </div>
                </div>

                {/* 进度指示 */}
                {ocrLoading && (
                  <div className="p-4 bg-coconut-50 dark:bg-darkbg-subtle rounded-2xl border border-coconut-200 dark:border-darkbg-border space-y-2">
                    <div className="flex justify-between text-xs text-coconut-700 dark:text-darkbg-muted">
                      <span className="font-medium flex items-center gap-1.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-palm-600" />
                        <span>{ocrStage || "正在解析文字排版..."}</span>
                      </span>
                      <span className="font-mono font-bold text-palm-600">{ocrProgress}%</span>
                    </div>
                    <div className="w-full h-2.5 bg-coconut-200 dark:bg-darkbg-border rounded-full overflow-hidden p-0.5">
                      <div
                        className="h-full progress-sunset-striped rounded-full transition-all duration-300"
                        style={{ width: `${ocrProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {ocrError && (
                  <div className="p-3 bg-toast-50 dark:bg-toast-950/40 border border-toast-200 dark:border-toast-900/60 rounded-2xl flex items-center gap-2 text-toast-700 dark:text-toast-300 text-xs">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 text-toast-500" />
                    <span>{ocrError}</span>
                  </div>
                )}

                {/* 上下双栏或左右并列：左边图片缩略图，右边编辑文本框 */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                  {/* 原图缩略预览 */}
                  <div className="md:col-span-4 bg-coconut-100/50 dark:bg-darkbg-subtle p-2 rounded-2xl border border-coconut-200/60 dark:border-darkbg-border flex flex-col items-center">
                    <div className="text-[11px] font-semibold text-coconut-700 dark:text-darkbg-muted mb-2 self-start">
                      原图参考
                    </div>
                    {ocrPreviewUrl && (
                      <img
                        src={ocrPreviewUrl}
                        alt="待识别图片"
                        className="max-h-[360px] w-auto rounded-xl object-contain shadow-sm border border-coconut-200 dark:border-darkbg-border"
                      />
                    )}
                  </div>

                  {/* 识别文字与在线编辑器 */}
                  <div className="md:col-span-8 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-coconut-900 dark:text-darkbg-text">
                        提取结果与在线编辑
                      </span>
                      {ocrResult && (
                        <div className="flex items-center gap-2 text-[11px] text-coconut-500 dark:text-darkbg-muted font-mono">
                          <span>字数: {ocrResult.characterCount}</span>
                          <span>·</span>
                          <span>行数: {ocrResult.linesCount}</span>
                          <span>·</span>
                          <span className="text-palm-600 font-semibold">
                            置信度: {ocrResult.confidence}%
                          </span>
                        </div>
                      )}
                    </div>

                    <textarea
                      value={ocrEditableText}
                      onChange={(e) => setOcrEditableText(e.target.value)}
                      placeholder={
                        ocrLoading
                          ? "AI 正在识别中，文字提取后将自动填充在此处..."
                          : "点击左侧【立即开始文字提取】即可在此查看与直接编辑内容..."
                      }
                      rows={12}
                      className="w-full text-sm font-mono p-4 bg-white/70 dark:bg-darkbg-subtle border border-coconut-200 dark:border-darkbg-border rounded-2xl outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-coconut-950 dark:text-darkbg-text leading-relaxed resize-none shadow-inner font-medium"
                    />

                    {/* 操作按钮组 */}
                    {ocrEditableText && (
                      <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                        <button
                          onClick={handleCopyOcrText}
                          className="flex items-center gap-1.5 py-2 px-3.5 rounded-xl border border-coconut-200 dark:border-darkbg-border bg-white dark:bg-darkbg-card hover:bg-coconut-50 text-coconut-700 dark:text-darkbg-text text-xs font-semibold transition-all active:scale-95"
                        >
                          {ocrCopied ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-palm-500" />
                              <span className="text-palm-600">已复制到剪贴板</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>一键复制全文</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={handleDownloadOcrTxt}
                          className="btn-3d-sunset flex items-center gap-1.5 py-2 px-3.5 rounded-xl text-white text-xs font-semibold"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>导出为 TXT 文件</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 模块 3: AI 模糊图片高清修复与超分辨率                                       */}
      {/* ========================================================================= */}
      {activeTab === "ai-upscale" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* 左侧控制台 */}
          <div className="lg:col-span-5 coconut-panel p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-coconut-200/80 dark:border-darkbg-border">
              <div className="flex items-center gap-2 text-sm font-bold text-coconut-950 dark:text-darkbg-text">
                <Sliders className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                <span>修复与增强倍率</span>
              </div>
            </div>

            {/* 放大倍率选择 */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-coconut-900 dark:text-darkbg-text">
                分辨率超清放大倍率
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { scale: 2 as const, label: "2x 超清放大", badge: "推荐" },
                  { scale: 4 as const, label: "4x 极致超清", badge: "大图" },
                  { scale: 1 as const, label: "1x 原图锐化", badge: "去模糊" },
                ].map((item) => (
                  <button
                    key={item.scale}
                    type="button"
                    onClick={() => setUpscaleScale(item.scale)}
                    className={`py-3 px-2 rounded-2xl border text-center transition-all ${
                      upscaleScale === item.scale
                        ? "border-orange-500 bg-orange-50/70 dark:bg-orange-950/40 text-coconut-950 dark:text-darkbg-text font-bold shadow-sm ring-1 ring-orange-400/30"
                        : "border-coconut-200 dark:border-darkbg-border text-coconut-700 dark:text-darkbg-muted hover:bg-coconut-100/50"
                    }`}
                  >
                    <div className="text-xs sm:text-sm font-bold">{item.label}</div>
                    <div className="text-xs text-orange-600 dark:text-orange-400 mt-0.5 font-mono font-semibold">
                      {item.badge}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 锐化强度滑块 */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm font-semibold text-coconut-900 dark:text-darkbg-text">
                <span>边缘与纹理锐化强度</span>
                <span className="font-mono font-bold text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded-lg bg-orange-500/10 border border-orange-500/20">{upscaleSharpness.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="2.0"
                step="0.1"
                value={upscaleSharpness}
                onChange={(e) => setUpscaleSharpness(parseFloat(e.target.value))}
                className="w-full accent-orange-600 cursor-pointer h-2 bg-coconut-200 dark:bg-darkbg-border rounded-lg appearance-none"
              />
              <div className="flex justify-between text-xs text-coconut-500 dark:text-darkbg-muted font-medium">
                <span>柔和自然</span>
                <span>平衡清晰</span>
                <span>极致锋利</span>
              </div>
            </div>

            {/* 降噪与对比度开关 */}
            <div className="space-y-3 pt-2 border-t border-coconut-100 dark:border-darkbg-border">
              <label className="flex items-center justify-between text-sm font-semibold cursor-pointer text-coconut-900 dark:text-darkbg-text">
                <span>JPEG 噪点与伪影消除</span>
                <input
                  type="checkbox"
                  checked={upscaleDenoise}
                  onChange={(e) => setUpscaleDenoise(e.target.checked)}
                  className="rounded text-orange-600 focus:ring-orange-500 w-4 h-4 cursor-pointer accent-orange-600"
                />
              </label>

              <label className="flex items-center justify-between text-sm font-semibold cursor-pointer text-coconut-900 dark:text-darkbg-text">
                <span>智能去雾与通透感拉伸</span>
                <input
                  type="checkbox"
                  checked={upscaleContrast}
                  onChange={(e) => setUpscaleContrast(e.target.checked)}
                  className="rounded text-orange-600 focus:ring-orange-500 w-4 h-4 cursor-pointer accent-orange-600"
                />
              </label>
            </div>

            {/* 修复执行按钮 */}
            <button
              onClick={handleExecuteUpscale}
              disabled={upscaleLoading || !upscaleFile}
              className={`w-full py-3.5 px-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                upscaleLoading || !upscaleFile
                  ? "bg-coconut-100 dark:bg-darkbg-subtle text-coconut-400 dark:text-darkbg-muted cursor-not-allowed border border-coconut-200 dark:border-darkbg-border"
                  : "btn-3d-sunset text-white"
              }`}
            >
              {upscaleLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>正在超清重采样 ({upscaleProgress}%)...</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-4 h-4 text-amber-200" />
                  <span>立即执行 AI 高清修复增强</span>
                </>
              )}
            </button>
          </div>

          {/* 右侧展示与对比工作台 */}
          <div className="lg:col-span-7 space-y-5">
            {!upscaleFile ? (
              <div className="bg-[#FAF1E8]/75 dark:bg-[#251E1A]/70 border-2 border-dashed border-[#D2BCAB] dark:border-[#4D392E] hover:border-amber-500 dark:hover:border-amber-400 rounded-3xl p-10 text-center transition-all cursor-pointer relative group">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/bmp"
                  onChange={handleUpscaleFileSelect}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="w-14 h-14 mx-auto rounded-2xl bg-coconut-100/80 dark:bg-darkbg-subtle flex items-center justify-center text-coconut-600 dark:text-darkbg-muted group-hover:scale-110 group-hover:text-amber-600 transition-all mb-4">
                  <UploadCloud className="w-7 h-7" />
                </div>
                <h4 className="text-sm font-bold text-coconut-900 dark:text-darkbg-text mb-1">
                  拖入模糊或低清晰度图片，或点击上传
                </h4>
                <p className="text-xs text-coconut-500 dark:text-darkbg-muted max-w-sm mx-auto">
                  支持老照片、低清头像、微信压缩糊图、游戏截图与图标锐化
                </p>
              </div>
            ) : (
              <div className="coconut-panel p-5 sm:p-6 space-y-4">
                {/* 状态栏 */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-coconut-100 dark:border-darkbg-border text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-coconut-900 dark:text-darkbg-text">
                      {upscaleFile.name}
                    </span>
                    <span className="text-coconut-400 font-mono">
                      ({formatBytes(upscaleFile.size)})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-coconut-600 dark:text-darkbg-muted hover:text-palm-600 cursor-pointer font-medium">
                      更换图片
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleUpscaleFileSelect}
                        className="hidden"
                      />
                    </label>
                    <button
                      onClick={() => {
                        setUpscaleFile(null);
                        setUpscalePreviewUrl(null);
                        setUpscaleResult(null);
                        setUpscaleResultUrl(null);
                      }}
                      className="text-toast-500 hover:text-toast-600 flex items-center gap-1 font-medium"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>清空</span>
                    </button>
                  </div>
                </div>

                {/* 进度指示 */}
                {upscaleLoading && (
                  <div className="p-4 bg-coconut-50 dark:bg-darkbg-subtle rounded-2xl border border-coconut-200 dark:border-darkbg-border space-y-2">
                    <div className="flex justify-between text-xs text-coconut-700 dark:text-darkbg-muted">
                      <span className="font-medium flex items-center gap-1.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-palm-600" />
                        <span>{upscaleStage || "正在逐像素超分辨率渲染..."}</span>
                      </span>
                      <span className="font-mono font-bold text-palm-600">{upscaleProgress}%</span>
                    </div>
                    <div className="w-full h-2.5 bg-coconut-200 dark:bg-darkbg-border rounded-full overflow-hidden p-0.5">
                      <div
                        className="h-full progress-sunset-striped rounded-full transition-all duration-300"
                        style={{ width: `${upscaleProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {upscaleError && (
                  <div className="p-3 bg-toast-50 dark:bg-toast-950/40 border border-toast-200 dark:border-toast-900/60 rounded-2xl flex items-center gap-2 text-toast-700 dark:text-toast-300 text-xs">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 text-toast-500" />
                    <span>{upscaleError}</span>
                  </div>
                )}

                {/* 对比展示画布 */}
                <div className="relative w-full min-h-[360px] max-h-[520px] flex items-center justify-center rounded-2xl overflow-hidden border border-coconut-200/80 dark:border-darkbg-border bg-[#121212]/5 dark:bg-darkbg-subtle">
                  {!upscaleResultUrl && upscalePreviewUrl && (
                    <img
                      src={upscalePreviewUrl}
                      alt="原图预览"
                      className="max-w-full max-h-[480px] object-contain shadow-md rounded-lg"
                    />
                  )}

                  {upscaleResultUrl && upscalePreviewUrl && (
                    <div className="relative w-full h-[460px] select-none overflow-hidden flex items-center justify-center">
                      {/* 底层：原图 */}
                      <img
                        src={upscalePreviewUrl}
                        alt="原图"
                        className="absolute max-h-[440px] max-w-full object-contain"
                      />

                      {/* 顶层：修复后效果 */}
                      <div
                        className="absolute inset-0 flex items-center justify-center overflow-hidden"
                        style={{
                          clipPath: `polygon(0 0, ${upscaleSlider}% 0, ${upscaleSlider}% 100%, 0 100%)`,
                        }}
                      >
                        <img
                          src={upscaleResultUrl}
                          alt="超清修复效果"
                          className="max-h-[440px] max-w-full object-contain"
                        />
                      </div>

                      {/* 中间分割线 */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-md z-20 pointer-events-none"
                        style={{ left: `${upscaleSlider}%` }}
                      >
                        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-7 h-7 bg-white dark:bg-coconut-900 border border-coconut-300 rounded-full flex items-center justify-center shadow-lg text-[10px] text-coconut-700 dark:text-darkbg-text font-bold">
                          <SplitSquareHorizontal className="w-3.5 h-3.5" />
                        </div>
                      </div>

                      <div className="absolute top-3 left-3 px-2.5 py-1 rounded-xl bg-palm-900/80 text-palm-200 text-[10px] font-mono backdrop-blur-sm z-20">
                        修复后超清效果 ({upscaleResult?.newWidth}×{upscaleResult?.newHeight})
                      </div>
                      <div className="absolute top-3 right-3 px-2.5 py-1 rounded-xl bg-black/60 text-white text-[10px] font-mono backdrop-blur-sm z-20">
                        原始低清 ({upscaleResult?.originalWidth}×{upscaleResult?.originalHeight})
                      </div>
                    </div>
                  )}
                </div>

                {/* 对比滑块 */}
                {upscaleResultUrl && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-xs text-coconut-600 dark:text-darkbg-muted">
                      <span>滑动分割线对比超清修复前后细节</span>
                      <span className="font-mono">{upscaleSlider}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={upscaleSlider}
                      onChange={(e) => setUpscaleSlider(parseInt(e.target.value))}
                      className="w-full accent-palm-600 cursor-pointer"
                    />
                  </div>
                )}

                {/* 底部下载 */}
                {upscaleResult && (
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-coconut-100 dark:border-darkbg-border">
                    <div className="text-xs text-coconut-600 dark:text-darkbg-muted">
                      <span>输出分辨率: </span>
                      <span className="font-mono font-bold text-coconut-900 dark:text-darkbg-text">
                        {upscaleResult.newWidth} × {upscaleResult.newHeight} px
                      </span>
                      <span className="text-coconut-400 ml-1">
                        ({formatBytes(upscaleResult.blob.size)})
                      </span>
                    </div>

                    <button
                      onClick={handleDownloadUpscaleResult}
                      className="btn-3d-sunset flex items-center gap-2 py-2.5 px-5 rounded-2xl text-white font-bold text-xs shadow-coconut-sm"
                    >
                      <Download className="w-4 h-4" />
                      <span>下载无损超清图 ({upscaleResult.scaleFactor}x PNG)</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
