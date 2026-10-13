"use client";

import React, { useState, useEffect } from "react";
import {
  FileText,
  UploadCloud,
  Download,
  Copy,
  Check,
  Trash2,
  Sliders,
  AlertCircle,
  Loader2,
  FileSearch,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import {
  recognizeTextOCR,
  generateSearchablePdf,
  OCR_LANGUAGES,
  OcrResult,
} from "@/lib/aiProcessor";
import { downloadBlob } from "@/lib/api";
import { formatBytes } from "@/lib/imageProcessor";
import ScrollableTabNav from "@/components/ScrollableTabNav";
import { useI18n } from "@/lib/i18n";
import SendToButton from "@/components/SendToButton";

export type AiTabType = "ai-ocr" | "ai-searchable-pdf";

export interface AiToolboxProps {
  currentTab?: AiTabType;
  onTabChange?: (tab: AiTabType) => void;
  incomingFile?: File | null;
  onIncomingFileHandled?: () => void;
  hideSubTabs?: boolean;
}

export default function AiToolbox({
  currentTab = "ai-ocr",
  onTabChange,
  incomingFile,
  onIncomingFileHandled,
  hideSubTabs = false,
}: AiToolboxProps) {
  const { lang } = useI18n();
  const [activeTab, setActiveTab] = useState<AiTabType>(currentTab);

  const localizeAiStage = (stage: string) => {
    if (lang !== "en" || !stage) return stage;
    if (stage.includes("启动 OCR") || stage.includes("WebAssembly")) return "Initializing OCR engine...";
    if (stage.includes("OCR 离线核心") || stage.includes("载入 OCR")) return "Loading OCR offline engine...";
    if (stage.includes("字库字典") || stage.includes("语言字库")) return "Loading language dictionary...";
    if (stage.includes("光学识别") || stage.includes("分析文字") || stage.includes("排版")) return "Analyzing text lines and layout...";
    if (stage.includes("深度扫描")) return "Scanning image features...";
    if (stage.includes("识别完成")) return "Recognition complete!";
    if (stage.includes("字形拓扑") || stage.includes("双层") || stage.includes("可搜索 PDF")) return "Generating dual-layer searchable PDF...";
    if (stage.includes("处理中") || stage.includes("正在")) return "Processing...";
    return stage;
  };

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
  // 1. 离线 OCR 文字识别状态
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
    setOcrStage(lang === "en" ? "Starting offline OCR recognition..." : "启动 OCR 离线识别...");

    try {
      const result = await recognizeTextOCR(ocrFile, ocrLang, (pct, stage) => {
        setOcrProgress(pct);
        setOcrStage(stage);
      });

      setOcrResult(result);
      setOcrEditableText(result.text);
      setOcrProgress(100);
      setOcrStage(lang === "en" ? "Recognition complete!" : "识别完成！");
    } catch (err: any) {
      setOcrError(
        err.message ||
          (lang === "en"
            ? "OCR recognition error, please try using a clearer image"
            : "OCR 识别异常，请尝试换用更清晰的图片")
      );
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
  // 2. 双层可搜索 PDF 制作 (Umi-OCR / Tesseract PDF 渲染引擎)
  // =========================================================================
  const [searchablePdfFile, setSearchablePdfFile] = useState<File | null>(null);
  const [searchablePdfPreviewUrl, setSearchablePdfPreviewUrl] = useState<string | null>(null);
  const [searchablePdfLang, setSearchablePdfLang] = useState<string>("chi_sim");
  const [searchablePdfLoading, setSearchablePdfLoading] = useState(false);
  const [searchablePdfProgress, setSearchablePdfProgress] = useState(0);
  const [searchablePdfStage, setSearchablePdfStage] = useState("");
  const [searchablePdfError, setSearchablePdfError] = useState<string | null>(null);
  const [searchablePdfResult, setSearchablePdfResult] = useState<{
    blob: Blob;
    filename: string;
    text: string;
  } | null>(null);
  const [searchablePdfCopied, setSearchablePdfCopied] = useState(false);

  const handleSearchablePdfFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSearchablePdfFile(file);
    setSearchablePdfPreviewUrl(URL.createObjectURL(file));
    setSearchablePdfResult(null);
    setSearchablePdfError(null);
    setSearchablePdfProgress(0);
  };

  const handleExecuteSearchablePdf = async () => {
    if (!searchablePdfFile) return;
    setSearchablePdfLoading(true);
    setSearchablePdfError(null);
    setSearchablePdfProgress(5);
    setSearchablePdfStage(lang === "en" ? "Initializing OCR & PDF layout engine..." : "初始化 OCR 与 PDF 排版合成引擎...");

    try {
      const res = await generateSearchablePdf(searchablePdfFile, searchablePdfLang, (pct, stage) => {
        setSearchablePdfProgress(pct);
        setSearchablePdfStage(stage);
      });
      setSearchablePdfResult(res);
      setSearchablePdfProgress(100);
      setSearchablePdfStage(lang === "en" ? "Dual-layer searchable PDF created!" : "双层可搜索 PDF 制作完成！");
    } catch (err: any) {
      setSearchablePdfError(err.message || (lang === "en" ? "Failed to create searchable PDF" : "双层可搜索 PDF 生成失败"));
    } finally {
      setSearchablePdfLoading(false);
    }
  };

  const handleDownloadSearchablePdf = () => {
    if (!searchablePdfResult) return;
    downloadBlob(searchablePdfResult.blob, searchablePdfResult.filename);
  };

  const handleCopySearchablePdfText = () => {
    if (!searchablePdfResult?.text) return;
    navigator.clipboard.writeText(searchablePdfResult.text);
    setSearchablePdfCopied(true);
    setTimeout(() => setSearchablePdfCopied(false), 2000);
  };

  // Cross-tool incoming file bus
  useEffect(() => {
    if (incomingFile) {
      if (activeTab === "ai-ocr") {
        handleOcrFileSelect({ target: { files: [incomingFile] } } as any);
      } else if (activeTab === "ai-searchable-pdf") {
        handleSearchablePdfFileSelect({ target: { files: [incomingFile] } } as any);
      }
      onIncomingFileHandled?.();
    }
  }, [incomingFile, activeTab]);

  return (
    <div className="space-y-6">
      {/* 顶部标签切换 */}
      {!hideSubTabs && (
        <ScrollableTabNav
          tabs={[
            {
              id: "ai-ocr",
              label: lang === "en" ? "Offline Text OCR" : "离线文字提取 (OCR)",
              icon: FileText,
              badge: lang === "en" ? "Multi-language" : "多语言",
            },
            {
              id: "ai-searchable-pdf",
              label: lang === "en" ? "Searchable PDF" : "双层可搜索 PDF 制作",
              icon: FileSearch,
              badge: lang === "en" ? "Dual-Layer" : "双层PDF",
            },
          ]}
          activeTab={activeTab}
          onTabChange={(id) => handleTabChange(id as AiTabType)}
        />
      )}

      {/* 模块 1: 离线 OCR 文字提取 */}
      {activeTab === "ai-ocr" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* 左侧控制台 */}
          <div className="lg:col-span-5 coconut-panel p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-coconut-200/80 dark:border-darkbg-border">
              <div className="flex items-center gap-2 text-sm font-bold text-coconut-950 dark:text-darkbg-text">
                <Sliders className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                <span>{lang === "en" ? "OCR Language Selection" : "OCR 识别语言选择"}</span>
              </div>
            </div>

            {/* 语言选择 */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-coconut-900 dark:text-darkbg-text">
                {lang === "en" ? "OCR Language Thesaurus" : "文字识别语言字库"}
              </label>
              <div className="space-y-2.5">
                {OCR_LANGUAGES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setOcrLang(item.id)}
                    className={`w-full text-left p-3 rounded-2xl border transition-all ${
                      ocrLang === item.id
                        ? "border-orange-500 bg-orange-50/70 dark:bg-orange-950/40 text-coconut-950 dark:text-darkbg-text shadow-sm ring-1 ring-orange-400/30"
                        : "border-coconut-200 dark:border-darkbg-border text-coconut-700 dark:text-darkbg-muted hover:bg-coconut-100/50"
                    }`}
                  >
                    <div className="text-sm font-bold text-coconut-950 dark:text-white">
                      {lang === "en" ? item.labelEn || item.label : item.label}
                    </div>
                    <div className="text-xs text-coconut-600 dark:text-darkbg-muted mt-0.5 leading-relaxed">
                      {lang === "en" ? item.descEn || item.desc : item.desc}
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
                  <span>
                    {lang === "en"
                      ? `Recognizing Text (${ocrProgress}%)...`
                      : `正在识别提取 (${ocrProgress}%)...`}
                  </span>
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 text-amber-200" />
                  <span>{lang === "en" ? "Start Text Extraction" : "立即开始文字提取"}</span>
                </>
              )}
            </button>
          </div>

          {/* 右侧展示与文字编辑区域 */}
          <div className="lg:col-span-7 space-y-5">
            {!ocrFile ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleOcrFileSelect({ target: { files: [file] } } as any);
                }}
                className="bg-[#FAF1E8]/75 dark:bg-[#251E1A]/70 border-2 border-dashed border-[#D2BCAB] dark:border-[#4D392E] hover:border-amber-500 dark:hover:border-amber-400 rounded-3xl p-10 text-center transition-all cursor-pointer relative group"
              >
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
                  {lang === "en"
                    ? "Drag image or screenshot here, or click to upload"
                    : "拖入需要识别的图片或截图，或点击上传"}
                </h4>
                <p className="text-xs text-coconut-500 dark:text-darkbg-muted max-w-sm mx-auto">
                  {lang === "en"
                    ? "Supports scanned contracts, textbooks, e-invoices, receipts, and web screenshots"
                    : "支持拍照合同、教材书籍、电子发票、证件单据与网页截图"}
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
                      {lang === "en" ? "Change Image" : "更换图片"}
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
                      <span>{lang === "en" ? "Clear" : "清空"}</span>
                    </button>
                  </div>
                </div>

                {/* 进度指示 */}
                {ocrLoading && (
                  <div className="p-4 bg-coconut-50 dark:bg-darkbg-subtle rounded-2xl border border-coconut-200 dark:border-darkbg-border space-y-2">
                    <div className="flex justify-between text-xs text-coconut-700 dark:text-darkbg-muted">
                      <span className="font-medium flex items-center gap-1.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-palm-600" />
                        <span>
                          {localizeAiStage(ocrStage) ||
                            (lang === "en" ? "Parsing text layout..." : "正在解析文字排版...")}
                        </span>
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
                      {lang === "en" ? "Original Reference" : "原图参考"}
                    </div>
                    {ocrPreviewUrl && (
                      <img
                        src={ocrPreviewUrl}
                        alt={lang === "en" ? "Image for Recognition" : "待识别图片"}
                        className="max-h-[360px] w-auto rounded-xl object-contain shadow-sm border border-coconut-200 dark:border-darkbg-border"
                      />
                    )}
                  </div>

                  {/* 识别文字与在线编辑器 */}
                  <div className="md:col-span-8 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-coconut-900 dark:text-darkbg-text">
                        {lang === "en" ? "Extracted Text & Editor" : "提取结果与在线编辑"}
                      </span>
                      {ocrResult && (
                        <div className="flex items-center gap-2 text-[11px] text-coconut-500 dark:text-darkbg-muted font-mono">
                          <span>{lang === "en" ? `Characters: ${ocrResult.characterCount}` : `字数: ${ocrResult.characterCount}`}</span>
                          <span>·</span>
                          <span>{lang === "en" ? `Lines: ${ocrResult.linesCount}` : `行数: ${ocrResult.linesCount}`}</span>
                          <span>·</span>
                          <span className="text-palm-600 font-semibold">
                            {lang === "en" ? `Confidence: ${ocrResult.confidence}%` : `置信度: ${ocrResult.confidence}%`}
                          </span>
                        </div>
                      )}
                    </div>

                    <textarea
                      value={ocrEditableText}
                      onChange={(e) => setOcrEditableText(e.target.value)}
                      placeholder={
                        ocrLoading
                          ? (lang === "en"
                              ? "Recognizing text, results will populate here automatically..."
                              : "正在离线识别中，文字提取后将自动填充在此处...")
                          : (lang === "en"
                              ? "Click [Start Text Extraction] on the left to view and edit text here..."
                              : "点击左侧【立即开始文字提取】即可在此查看与直接编辑内容...")
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
                              <span className="text-palm-600">{lang === "en" ? "Copied to Clipboard" : "已复制到剪贴板"}</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>{lang === "en" ? "Copy Full Text" : "一键复制全文"}</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={handleDownloadOcrTxt}
                          className="btn-3d-sunset flex items-center gap-1.5 py-2 px-3.5 rounded-xl text-white text-xs font-semibold"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>{lang === "en" ? "Export as TXT" : "导出为 TXT 文件"}</span>
                        </button>

                        <SendToButton
                          category="text"
                          payload={{
                            text: ocrEditableText,
                            sourceTitle: "离线文字提取 (OCR)",
                          }}
                          lang={lang}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 模块 2: 双层可搜索可复制 PDF 制作 */}
      {activeTab === "ai-searchable-pdf" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* 左侧控制台 */}
          <div className="lg:col-span-5 coconut-panel p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-coconut-200/80 dark:border-darkbg-border">
              <div className="flex items-center gap-2 text-sm font-bold text-coconut-950 dark:text-darkbg-text">
                <FileSearch className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                <span>{lang === "en" ? "Dual-Layer PDF Settings" : "双层可搜索 PDF 配置"}</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold">
                Umi-OCR Layering
              </span>
            </div>

            {/* 识别语言 */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-coconut-900 dark:text-darkbg-text">
                {lang === "en" ? "Document Recognition Language" : "排版对齐识别语言"}
              </label>
              <select
                value={searchablePdfLang}
                onChange={(e) => setSearchablePdfLang(e.target.value)}
                className="w-full coconut-input text-xs font-semibold py-2.5 px-3 rounded-xl bg-white dark:bg-darkbg-elevated border border-coconut-200 dark:border-darkbg-border"
              >
                {OCR_LANGUAGES.map((item) => (
                  <option key={item.id} value={item.id}>
                    {lang === "en" ? item.labelEn : item.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 功能原理介绍提示卡 */}
            <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 space-y-2">
              <div className="flex items-center gap-2 font-bold text-xs text-amber-900 dark:text-amber-200">
                <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{lang === "en" ? "How Dual-Layer PDF Works" : "双层 PDF 核心优势"}</span>
              </div>
              <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300/90">
                {lang === "en"
                  ? "Maintains 100% of the original scanned document's appearance on the visual layer, while injecting an invisible, pixel-aligned vector text layer underneath. Enables full-text search (Ctrl+F) and precise cursor selection & copying."
                  : "在图像表面保持 100% 原始扫描件或证件外观，同时在其底层精准注入字形像素对齐的透明文字排版层。生成的标准 PDF 支持浏览器与 Adobe Reader 划词复制、关键词极速搜索 (Ctrl+F)。"}
              </p>
            </div>

            {/* 执行制作按钮 */}
            <button
              onClick={handleExecuteSearchablePdf}
              disabled={searchablePdfLoading || !searchablePdfFile}
              className={`w-full py-3.5 px-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                searchablePdfLoading || !searchablePdfFile
                  ? "bg-coconut-100 dark:bg-darkbg-subtle text-coconut-400 dark:text-darkbg-muted cursor-not-allowed border border-coconut-200 dark:border-darkbg-border"
                  : "btn-3d-sunset text-white active:scale-95"
              }`}
            >
              {searchablePdfLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{lang === "en" ? "Synthesizing PDF layout..." : "正在排版合成双层 PDF..."}</span>
                </>
              ) : (
                <>
                  <FileSearch className="w-4 h-4" />
                  <span>{lang === "en" ? "Generate Searchable PDF" : "制作双层可搜索 PDF"}</span>
                </>
              )}
            </button>

            {/* 进度指示 */}
            {(searchablePdfLoading || searchablePdfProgress > 0) && (
              <div className="space-y-2 pt-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-coconut-700 dark:text-darkbg-muted flex items-center gap-1.5">
                    {searchablePdfLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-600" />}
                    {localizeAiStage(searchablePdfStage)}
                  </span>
                  <span className="font-mono text-orange-600 dark:text-orange-400 font-bold">{searchablePdfProgress}%</span>
                </div>
                <div className="w-full h-2.5 bg-coconut-200/80 dark:bg-darkbg-border rounded-full overflow-hidden p-0.5">
                  <div
                    className="h-full bg-gradient-to-r from-orange-500 via-amber-500 to-palm-500 rounded-full transition-all duration-300 shadow-sm"
                    style={{ width: `${searchablePdfProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* 错误提示 */}
            {searchablePdfError && (
              <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-400 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{searchablePdfError}</span>
              </div>
            )}
          </div>

          {/* 右侧工作台 */}
          <div className="lg:col-span-7 coconut-panel p-5 sm:p-6 space-y-4">
            {!searchablePdfFile ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleSearchablePdfFileSelect({ target: { files: [file] } } as any);
                }}
                className="border-2 border-dashed border-coconut-300/80 dark:border-darkbg-border rounded-3xl p-10 flex flex-col items-center justify-center text-center hover:border-orange-500 transition-colors bg-coconut-50/50 dark:bg-darkbg-subtle relative min-h-[380px]"
              >
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleSearchablePdfFileSelect}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="w-16 h-16 rounded-3xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4 shadow-sm">
                  <FileSearch className="w-8 h-8" />
                </div>
                <h3 className="font-bold text-base text-coconut-900 dark:text-darkbg-text mb-1">
                  {lang === "en" ? "Upload Scanned Document or Image" : "上传扫描件、纸质文档照片或图书页面"}
                </h3>
                <p className="text-xs text-coconut-600 dark:text-darkbg-muted max-w-sm mb-4">
                  {lang === "en"
                    ? "Supports PNG, JPG, WEBP. The engine will extract all text geometry and produce a dual-layer PDF."
                    : "支持常见图片。引擎将智能分析字形拓扑并注入底层透明文字，输出支持划词搜索的双层 PDF。"}
                </p>
                <span className="btn-3d-sunset text-xs py-2 px-5 rounded-2xl text-white font-bold pointer-events-none">
                  {lang === "en" ? "Select Scanned Document" : "选择扫描件图片"}
                </span>
              </div>
            ) : (
              <div className="space-y-4">
                {/* 文件信息 */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-coconut-50 dark:bg-darkbg-subtle border border-coconut-200/60 dark:border-darkbg-border">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0">
                      SCAN
                    </div>
                    <div className="truncate">
                      <div className="text-xs font-bold text-coconut-900 dark:text-darkbg-text truncate">
                        {searchablePdfFile.name}
                      </div>
                      <div className="text-[11px] text-coconut-500 font-mono">{formatBytes(searchablePdfFile.size)}</div>
                    </div>
                  </div>
                  <label className="cursor-pointer text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40">
                    {lang === "en" ? "Replace" : "更换文件"}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleSearchablePdfFileSelect}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* 预览与结果输出 */}
                {!searchablePdfResult ? (
                  <div className="relative w-full rounded-2xl overflow-hidden border border-coconut-200 dark:border-darkbg-border bg-coconut-100/50 dark:bg-darkbg-subtle flex items-center justify-center min-h-[360px] max-h-[500px]">
                    <img
                      src={searchablePdfPreviewUrl!}
                      alt={lang === "en" ? "Preview" : "预览"}
                      className="max-h-[480px] max-w-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* 制作成功信息卡 */}
                    <div className="p-4 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        <div>
                          <div className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                            {lang === "en" ? "Searchable Dual-Layer PDF Ready!" : "双层可搜索 PDF 制作完成！"}
                          </div>
                          <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-mono">
                            {searchablePdfResult.filename} ({formatBytes(searchablePdfResult.blob.size)})
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-200 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-bold">
                        {lang === "en" ? "Selectable Text" : "可划词复制"}
                      </span>
                    </div>

                    {/* 底层提取文本预览框 */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs font-semibold text-coconut-800 dark:text-darkbg-muted">
                        <span>{lang === "en" ? "Injected Invisible Text Layer (Preview)" : "注入的底层透明文字层 (文本预览)"}</span>
                        <button
                          onClick={handleCopySearchablePdfText}
                          className="flex items-center gap-1 text-[11px] text-orange-600 hover:text-orange-700 font-bold"
                        >
                          {searchablePdfCopied ? <Check className="w-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          <span>{searchablePdfCopied ? (lang === "en" ? "Copied!" : "已复制！") : (lang === "en" ? "Copy Text" : "复制全部文本")}</span>
                        </button>
                      </div>
                      <textarea
                        readOnly
                        rows={8}
                        value={searchablePdfResult.text}
                        className="w-full coconut-input font-mono text-xs p-3 rounded-2xl bg-white dark:bg-darkbg-elevated border border-coconut-200 dark:border-darkbg-border resize-none"
                      />
                    </div>

                    {/* 底部下载按钮 */}
                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-coconut-100 dark:border-darkbg-border">
                      <button
                        onClick={handleDownloadSearchablePdf}
                        className="btn-3d-sunset flex items-center gap-2 py-2.5 px-6 rounded-2xl text-white font-bold text-xs shadow-coconut-sm"
                      >
                        <Download className="w-4 h-4" />
                        <span>{lang === "en" ? "Download Searchable PDF" : "下载双层可搜索 PDF"}</span>
                      </button>
                    </div>
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
