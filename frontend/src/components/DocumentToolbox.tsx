"use client";

import React, { useState, useEffect } from "react";
import {
  Edit3,
  FileText,
  FileCode2,
  Combine,
  Scissors,
  Layers,
  Stamp,
  Minimize2,
  Lock,
  ShieldCheck,
  Type,
  Eraser,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ArrowRight,
  Sliders,
  Zap,
  Image as ImageIcon,
  FileCheck,
  Download,
  RotateCcw,
  X,
  Eye,
  EyeOff,
  Unlock,
  FileSearch,
  Sparkles,
  FolderArchive,
} from "lucide-react";

import Dropzone from "@/components/Dropzone";
import ScrollableTabNav from "@/components/ScrollableTabNav";
import PdfMergeStudio from "@/components/pdf/PdfMergeStudio";
import PdfSplitStudio from "@/components/pdf/PdfSplitStudio";
import PdfWatermarkStudio from "@/components/pdf/PdfWatermarkStudio";
import PdfCompressStudio from "@/components/pdf/PdfCompressStudio";
import ImagesToPdfStudio from "@/components/pdf/ImagesToPdfStudio";
import PdfOrganizeStudio from "@/components/pdf/PdfOrganizeStudio";
import OfficeMediaExtractStudio from "@/components/document/OfficeMediaExtractStudio";
import PdfInplaceTextStudio from "@/components/document/PdfInplaceTextStudio";
import AiToolbox from "@/components/AiToolbox";

import { useI18n } from "@/lib/i18n";
import { formatBytes } from "@/lib/imageProcessor";
import {
  convertPdfToWord,
  convertWordToPdf,
  mergePdfs,
  splitPdf,
  addWatermark,
  protectPdf,
  unlockPdf,
  compressPdf,
  convertImagesToPdf,
  organizePdfPages,
  renderPdfPages,
  downloadBlob,
} from "@/lib/api";

export type DocTabType =
  | "pdf-to-word"
  | "word-to-pdf"
  | "pdf-merge"
  | "pdf-split"
  | "pdf-organize"
  | "pdf-watermark"
  | "pdf-compress"
  | "images-to-pdf"
  | "pdf-protect"
  | "pdf-inplace-edit"
  | "office-media-extract"
  | "ai-ocr"
  | "ai-searchable-pdf";

export interface DocumentToolboxProps {
  currentTab?: DocTabType;
  onTabChange?: (tab: DocTabType) => void;
  incomingFiles?: File[];
  onIncomingFilesHandled?: () => void;
}

export default function DocumentToolbox({
  currentTab,
  onTabChange,
  incomingFiles,
  onIncomingFilesHandled,
}: DocumentToolboxProps) {
  const { lang, t } = useI18n();

  // Active sub-tab state
  const [activeTab, setActiveTab] = useState<DocTabType>(
    currentTab || "pdf-to-word",
  );

  // File queue & execution status states
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [executionResult, setExecutionResult] = useState<{
    blob: Blob;
    filename: string;
    size: number;
    originalSize?: number;
  } | null>(null);

  // Parameter states
  const [startPage, setStartPage] = useState<number>(0);
  const [endPage, setEndPage] = useState<number | null>(null);
  const [conversionPhase, setConversionPhase] = useState<string>("");
  const [pageRanges, setPageRanges] = useState<string>("");
  const [watermarkText, setWatermarkText] = useState<string>(() =>
    lang === "en" ? "CONFIDENTIAL" : "内部机密 严禁外传",
  );
  const [watermarkOpacity, setWatermarkOpacity] = useState<number>(0.3);
  const [watermarkAngle, setWatermarkAngle] = useState<number>(45);
  const [protectMode, setProtectMode] = useState<"encrypt" | "unlock">("encrypt");
  const [cleanMetadata, setCleanMetadata] = useState<boolean>(true);
  const [protectPassword, setProtectPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [conversionQuality, setConversionQuality] = useState<
    "light" | "standard" | "high"
  >("high");

  // PDF to Word thumbnail preview state
  const [pdfToWordThumb, setPdfToWordThumb] = useState<{
    url?: string;
    numPages?: number;
    loading: boolean;
  } | null>(null);

  // Synchronize language changes for default watermark text
  useEffect(() => {
    if (lang === "en" && watermarkText === "内部机密 严禁外传") {
      setWatermarkText("CONFIDENTIAL");
    } else if (lang === "zh" && watermarkText === "CONFIDENTIAL") {
      setWatermarkText("内部机密 严禁外传");
    }
  }, [lang]);

  // Synchronize external tab switches
  useEffect(() => {
    if (currentTab && currentTab !== activeTab) {
      setActiveTab(currentTab);
      setFiles([]);
      setError(null);
      setSuccessMsg(null);
      setExecutionResult(null);
    }
  }, [currentTab]);

  // Handle incoming files from clipboard / cross-tool bus
  useEffect(() => {
    if (incomingFiles && incomingFiles.length > 0) {
      if (activeTab === "images-to-pdf" || activeTab === "pdf-merge") {
        setFiles((prev) => [...prev, ...incomingFiles]);
      } else {
        setFiles([incomingFiles[0]]);
      }
      setError(null);
      setSuccessMsg(null);
      setExecutionResult(null);
      onIncomingFilesHandled?.();
    }
  }, [incomingFiles]);

  // Fetch thumbnail preview for PDF to Word
  useEffect(() => {
    if (activeTab === "pdf-to-word" && files.length > 0) {
      setPdfToWordThumb({ loading: true });
      renderPdfPages(files[0], 70, 1, false)
        .then((res) => {
          setPdfToWordThumb({
            url: res.pages[0]?.image,
            numPages: res.numPages,
            loading: false,
          });
          setEndPage(res.numPages);
        })
        .catch(() => {
          setPdfToWordThumb({ loading: false });
        });
    } else {
      setPdfToWordThumb(null);
      setStartPage(0);
      setEndPage(null);
    }
  }, [activeTab, files]);

  // Internal tab switch handler
  const handleTabSelect = (tabId: DocTabType) => {
    setActiveTab(tabId);
    setFiles([]);
    setError(null);
    setSuccessMsg(null);
    setExecutionResult(null);
    setProtectPassword("");
    setConfirmPassword("");
    setStartPage(0);
    setEndPage(null);
    onTabChange?.(tabId);
  };

  // Action button label resolution
  const getActionBtnText = () => {
    switch (activeTab) {
      case "pdf-to-word":
        return t.common.actionPdfToWord;
      case "word-to-pdf":
        return t.common.actionWordToPdf;
      case "pdf-merge":
        return t.common.actionPdfMerge.replace("{n}", String(files.length));
      case "pdf-split":
        return t.common.actionPdfSplit;
      case "pdf-watermark":
        return t.common.actionPdfWatermark;
      case "pdf-protect":
        return t.common.actionPdfProtect;
      default:
        return t.common.startConvert;
    }
  };

  // Multi-phase progress feedback for lengthy conversions (PDF to Word)
  useEffect(() => {
    let timer1: NodeJS.Timeout;
    let timer2: NodeJS.Timeout;
    if (loading && activeTab === "pdf-to-word") {
      setConversionPhase(
        lang === "en"
          ? "Analyzing document layout..."
          : "正在逆向解析 PDF 版面结构...",
      );
      timer1 = setTimeout(() => {
        setConversionPhase(
          lang === "en"
            ? "Extracting vectors, tables & text..."
            : "正在提取文字、表格与矢量排版...",
        );
      }, 3500);
      timer2 = setTimeout(() => {
        setConversionPhase(
          lang === "en"
            ? "Reconstructing high-fidelity Word document..."
            : "正在重构高保真 Word 格式并生成...",
        );
      }, 8500);
    } else {
      setConversionPhase("");
    }
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [loading, activeTab, lang]);

  // Standard execution handler for PDF to Word, Word to PDF, Merge, Split, Watermark, Protect
  const handleExecute = async () => {
    if (files.length === 0) {
      setError(t.common.pleaseUpload);
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    setExecutionResult(null);

    try {
      let resultBlob: Blob;
      let resultFilename: string;

      if (activeTab === "pdf-to-word") {
        if (endPage !== null && endPage < startPage + 1) {
          throw new Error(
            lang === "en"
              ? "Ending page cannot be smaller than starting page"
              : "结束页码不能小于起始页码",
          );
        }
        const res = await convertPdfToWord(
          files[0],
          startPage,
          endPage !== null ? endPage : undefined,
        );
        resultBlob = res.blob;
        resultFilename = res.filename;
      } else if (activeTab === "word-to-pdf") {
        const res = await convertWordToPdf(files[0], conversionQuality);
        resultBlob = res.blob;
        resultFilename = res.filename;
      } else if (activeTab === "pdf-merge") {
        if (files.length < 2) {
          throw new Error(t.common.mergeAtLeastTwo);
        }
        const res = await mergePdfs(files);
        resultBlob = res.blob;
        resultFilename = res.filename;
      } else if (activeTab === "pdf-split") {
        const res = await splitPdf(files[0], pageRanges || undefined);
        resultBlob = res.blob;
        resultFilename = res.filename;
      } else if (activeTab === "pdf-watermark") {
        const res = await addWatermark(
          files[0],
          watermarkText,
          watermarkOpacity,
          watermarkAngle,
        );
        resultBlob = res.blob;
        resultFilename = res.filename;
      } else if (activeTab === "pdf-protect") {
        if (protectMode === "encrypt") {
          if (!protectPassword.trim()) {
            throw new Error(
              lang === "en" ? "Please enter a protection password" : "请先输入保护密码",
            );
          }
          if (protectPassword.length < 4) {
            throw new Error(
              lang === "en"
                ? "Password must be at least 4 characters"
                : "密码长度不能少于 4 位",
            );
          }
          if (protectPassword !== confirmPassword) {
            throw new Error(
              lang === "en"
                ? "Passwords do not match, please verify"
                : "两次输入的密码不一致，请重新检查确认",
            );
          }
          const res = await protectPdf(files[0], protectPassword, cleanMetadata);
          resultBlob = res.blob;
          resultFilename = res.filename;
        } else {
          const res = await unlockPdf(files[0], protectPassword.trim(), cleanMetadata);
          resultBlob = res.blob;
          resultFilename = res.filename;
        }
      } else {
        throw new Error(t.common.errorOccurred);
      }

      setExecutionResult({
        blob: resultBlob,
        filename: resultFilename,
        size: resultBlob.size,
      });

      setSuccessMsg(
        lang === "en"
          ? `Finished! Generated ${resultFilename}, click below to download.`
          : `处理完成！已生成 ${resultFilename}，请点击下方按钮下载保存`,
      );
    } catch (err: any) {
      setError(err.message || t.common.errorOccurred);
    } finally {
      setLoading(false);
    }
  };

  // Dedicated execution handler for PdfSplitStudio
  const handleSplitExecute = async (customRanges?: string) => {
    if (files.length === 0) {
      setError(t.common.uploadSplitPdfFirst);
      return;
    }
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    setExecutionResult(null);

    try {
      const res = await splitPdf(files[0], customRanges || undefined);
      setExecutionResult({
        blob: res.blob,
        filename: res.filename,
        size: res.blob.size,
      });
      setSuccessMsg(
        lang === "en"
          ? `Split & extracted! Generated ${res.filename}, click below to download.`
          : `拆分提取成功！已生成 ${res.filename}，请点击下方按钮下载保存`,
      );
    } catch (err: any) {
      setError(err.message || t.common.errorOccurred);
    } finally {
      setLoading(false);
    }
  };

  // Dedicated execution handler for PdfWatermarkStudio
  const handleWatermarkExecute = async (
    text: string,
    opacity: number,
    angle: number,
    layout: "center" | "tile" = "center",
  ) => {
    if (files.length === 0) {
      setError(t.common.uploadWatermarkPdfFirst);
      return;
    }
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    setExecutionResult(null);

    try {
      const res = await addWatermark(files[0], text, opacity, angle, layout);
      setExecutionResult({
        blob: res.blob,
        filename: res.filename,
        size: res.blob.size,
      });
      setSuccessMsg(
        lang === "en"
          ? `Watermark applied! Generated ${res.filename}, click below to download.`
          : `水印添加成功！已生成 ${res.filename}，请点击下方按钮下载保存`,
      );
    } catch (err: any) {
      setError(err.message || t.common.errorOccurred);
    } finally {
      setLoading(false);
    }
  };

  // Dedicated execution handler for PdfCompressStudio
  const handleCompressExecute = async (level: "low" | "medium" | "high") => {
    if (files.length === 0) {
      setError(
        lang === "en"
          ? "Please upload a PDF file to compress first"
          : "请先上传需要压缩的 PDF 文件",
      );
      return;
    }
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    setExecutionResult(null);

    try {
      const res = await compressPdf(files[0], level);
      setExecutionResult({
        blob: res.blob,
        filename: res.filename,
        size: res.compressedSize,
        originalSize: res.originalSize,
      });
      setSuccessMsg(
        lang === "en"
          ? `Compression finished! Generated ${res.filename}, click below to download.`
          : `压缩完成！已生成 ${res.filename}，请点击下方按钮下载保存`,
      );
    } catch (err: any) {
      setError(err.message || t.common.errorOccurred);
    } finally {
      setLoading(false);
    }
  };

  // Dedicated execution handler for ImagesToPdfStudio
  const handleImagesToPdfExecute = async (pageSize: "fit" | "a4") => {
    if (files.length === 0) {
      setError(
        lang === "en"
          ? "Please select at least one image to combine"
          : "请至少选择一张图片进行合成",
      );
      return;
    }
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    setExecutionResult(null);

    try {
      const res = await convertImagesToPdf(files, pageSize);
      setExecutionResult({
        blob: res.blob,
        filename: res.filename,
        size: res.blob.size,
      });
      setSuccessMsg(
        lang === "en"
          ? `Combined successfully! Generated ${res.filename}, click below to download.`
          : `合成成功！已生成 ${res.filename}，请点击下方按钮下载保存`,
      );
    } catch (err: any) {
      setError(err.message || t.common.errorOccurred);
    } finally {
      setLoading(false);
    }
  };

  // Dedicated execution handler for PdfOrganizeStudio
  const handleOrganizeExecute = async (
    pagesConfig: Array<{ page: number; rotation: number }>,
  ) => {
    if (files.length === 0) {
      setError(
        lang === "en"
          ? "Please upload a PDF file to organize first"
          : "请先上传需要编排的 PDF 文件",
      );
      return;
    }
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    setExecutionResult(null);

    try {
      const res = await organizePdfPages(files[0], pagesConfig);
      setExecutionResult({
        blob: res.blob,
        filename: res.filename,
        size: res.blob.size,
      });
      setSuccessMsg(
        lang === "en"
          ? `Organized successfully! Generated ${res.filename}, click below to download.`
          : `编排完成！已生成 ${res.filename}，请点击下方按钮下载保存`,
      );
    } catch (err: any) {
      setError(err.message || t.common.errorOccurred);
    } finally {
      setLoading(false);
    }
  };

  // Tab definitions with localized labels and badges
  const docTabs = [
    {
      id: "pdf-to-word",
      label: lang === "en" ? "PDF to Word (Reverse)" : "PDF 逆向转 Word",
      icon: FileText,
      badge: lang === "en" ? "Recommended" : "推荐",
    },
    {
      id: "word-to-pdf",
      label: lang === "en" ? "Word to Ultra PDF" : "Word 转超清 PDF",
      icon: FileCode2,
      badge: "300DPI",
    },
    {
      id: "pdf-merge",
      label: lang === "en" ? "Merge PDF Documents" : "多 PDF 拼合合并",
      icon: Combine,
      badge: lang === "en" ? "Multi-select" : "多选",
    },
    {
      id: "pdf-split",
      label: lang === "en" ? "Split & Extract PDF" : "PDF 拆分与范围提取",
      icon: Scissors,
      badge: lang === "en" ? "Range" : "范围",
    },
    {
      id: "pdf-organize",
      label: lang === "en" ? "PDF Page Organizer" : "PDF 页面可视化调度",
      icon: Layers,
      badge: lang === "en" ? "Canvas" : "画板",
    },
    {
      id: "pdf-watermark",
      label: lang === "en" ? "PDF Stamp & Watermark" : "PDF 文字印章水印",
      icon: Stamp,
      badge: lang === "en" ? "Watermark" : "水印",
    },
    {
      id: "pdf-compress",
      label: lang === "en" ? "PDF Smart Compression" : "PDF 智能极限压缩",
      icon: Minimize2,
      badge: lang === "en" ? "Save 80%" : "省80%",
    },
    {
      id: "images-to-pdf",
      label: lang === "en" ? "Images to PDF Studio" : "多图一键合成 PDF",
      icon: Combine,
      badge: lang === "en" ? "Lossless" : "高保真",
    },
    {
      id: "pdf-protect",
      label: lang === "en" ? "PDF Encrypt & Unlock" : "PDF 加密解密与权限管理",
      icon: Lock,
      badge: lang === "en" ? "Encrypt/Unlock" : "加密/解密",
    },
    {
      id: "pdf-inplace-edit",
      label: lang === "en" ? "PDF In-place Text Fix" : "PDF 局部文字原地修正",
      icon: Edit3,
      badge: lang === "en" ? "In-place" : "原地涂改",
    },
    {
      id: "office-media-extract",
      label: lang === "en" ? "Office Media Extractor" : "Office 媒体资产提取",
      icon: FolderArchive,
      badge: lang === "en" ? "Lossless" : "原图解构",
    },
    {
      id: "ai-ocr",
      label: lang === "en" ? "Offline OCR Text" : "离线文字提取 (OCR)",
      icon: Sparkles,
      badge: lang === "en" ? "Offline" : "离线引擎",
    },
    {
      id: "ai-searchable-pdf",
      label: lang === "en" ? "Dual-Layer Searchable PDF" : "双层可搜索 PDF 制作",
      icon: FileSearch,
      badge: lang === "en" ? "Dual-Layer" : "双层合成",
    },
  ];

  return (
    <div className="space-y-6">
      {/* 11 Document & Text Workshop Horizontal Sub-tabs Nav */}
      <ScrollableTabNav
        tabs={docTabs}
        activeTab={activeTab}
        onTabChange={(id) => handleTabSelect(id as DocTabType)}
      />

      {activeTab === "pdf-merge" ? (
        /* PDF Multi-File Merge Studio */
        files.length > 0 ? (
          <div className="coconut-panel p-6 sm:p-8">
            <PdfMergeStudio
              files={files}
              onFilesChange={setFiles}
              onExecute={handleExecute}
              loading={loading}
              error={error}
              successMsg={successMsg}
              executionResult={executionResult}
              onReset={() => {
                setFiles([]);
                setExecutionResult(null);
                setSuccessMsg(null);
                setError(null);
              }}
            />
          </div>
        ) : (
          <div className="coconut-panel p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#D2BCAB]/30 dark:border-[#4D392E]/40">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 shadow-md shadow-indigo-500/25 flex items-center justify-center text-white flex-shrink-0">
                  <Combine className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center flex-wrap gap-2">
                    <h3 className="text-base sm:text-lg font-extrabold text-coconut-900 dark:text-darkbg-text tracking-tight">
                      {t.pdfMerge.title}
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 tracking-wider uppercase">
                      多文件无损拼合
                    </span>
                  </div>
                  <p className="text-xs text-coconut-600 dark:text-darkbg-muted leading-relaxed max-w-xl">
                    {t.pdfMerge.desc}
                  </p>
                </div>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold self-start sm:self-auto flex-shrink-0">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>{t.pdfEdit?.privacyGuarantee || "100% 本地沙盒 · 零云端上传"}</span>
              </div>
            </div>

            <Dropzone
              accept=".pdf"
              multiple={true}
              selectedFiles={files}
              onFilesSelected={setFiles}
              onClear={() => setFiles([])}
              title={t.pdfMerge.dropzoneTitle}
              hint={t.pdfMerge.dropzoneHint}
            />
          </div>
        )
      ) : activeTab === "pdf-split" ? (
        /* PDF Visual Page Split Studio */
        files.length > 0 ? (
          <div className="coconut-panel p-6 sm:p-8">
            <PdfSplitStudio
              file={files[0]}
              onSplit={handleSplitExecute}
              loading={loading}
              error={error}
              successMsg={successMsg}
              executionResult={executionResult}
              onReset={() => {
                setExecutionResult(null);
                setSuccessMsg(null);
                setError(null);
              }}
              onClearFile={() => {
                setFiles([]);
                setExecutionResult(null);
                setSuccessMsg(null);
                setError(null);
              }}
            />
          </div>
        ) : (
          <div className="coconut-panel p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#D2BCAB]/30 dark:border-[#4D392E]/40">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 shadow-md shadow-rose-500/25 flex items-center justify-center text-white flex-shrink-0">
                  <Scissors className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center flex-wrap gap-2">
                    <h3 className="text-base sm:text-lg font-extrabold text-coconut-900 dark:text-darkbg-text tracking-tight">
                      {t.pdfSplit.title}
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-rose-500/10 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30 tracking-wider uppercase">
                      全文档点选拆分
                    </span>
                  </div>
                  <p className="text-xs text-coconut-600 dark:text-darkbg-muted leading-relaxed max-w-xl">
                    {t.pdfSplit.desc}
                  </p>
                </div>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold self-start sm:self-auto flex-shrink-0">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>{t.pdfEdit?.privacyGuarantee || "100% 本地沙盒 · 零云端上传"}</span>
              </div>
            </div>

            <Dropzone
              accept=".pdf"
              multiple={false}
              selectedFiles={files}
              onFilesSelected={setFiles}
              onClear={() => setFiles([])}
              title={t.pdfSplit.dropzoneTitle}
              hint={t.pdfSplit.dropzoneHint}
            />
          </div>
        )
      ) : activeTab === "pdf-organize" ? (
        /* PDF Page Visual Organizer Studio */
        files.length > 0 ? (
          <div className="coconut-panel p-6 sm:p-8">
            <PdfOrganizeStudio
              file={files[0]}
              onOrganize={handleOrganizeExecute}
              loading={loading}
              error={error}
              successMsg={successMsg}
              executionResult={executionResult}
              onReset={() => {
                setExecutionResult(null);
                setSuccessMsg(null);
                setError(null);
              }}
              onClearFile={() => {
                setFiles([]);
                setExecutionResult(null);
                setSuccessMsg(null);
                setError(null);
              }}
            />
          </div>
        ) : (
          <div className="coconut-panel p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#D2BCAB]/30 dark:border-[#4D392E]/40">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-md shadow-violet-500/25 flex items-center justify-center text-white flex-shrink-0">
                  <Sliders className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center flex-wrap gap-2">
                    <h3 className="text-base sm:text-lg font-extrabold text-coconut-900 dark:text-darkbg-text tracking-tight">
                      {t.pdfOrganize?.title || "PDF 页面可视化调度与编排"}
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-violet-500/10 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 border border-violet-500/30 tracking-wider uppercase">
                      页面调序旋转
                    </span>
                  </div>
                  <p className="text-xs text-coconut-600 dark:text-darkbg-muted leading-relaxed max-w-xl">
                    {t.pdfOrganize?.desc ||
                      "自由拖拽调整页面顺序、单页独立旋转 90°/180°、剔除多余页面，一键导出定制新版 PDF。"}
                  </p>
                </div>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold self-start sm:self-auto flex-shrink-0">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>{t.pdfEdit?.privacyGuarantee || "100% 本地沙盒 · 零云端上传"}</span>
              </div>
            </div>

            <Dropzone
              accept=".pdf"
              multiple={false}
              selectedFiles={files}
              onFilesSelected={setFiles}
              onClear={() => setFiles([])}
              title={
                t.pdfOrganize?.dropzoneTitle ||
                "拖入待编排调度的 PDF 文档 (.pdf)，或点击选择"
              }
              hint={
                t.pdfOrganize?.dropzoneHint ||
                "支持标准 PDF 文档，全本地处理"
              }
            />
          </div>
        )
      ) : activeTab === "pdf-watermark" ? (
        /* PDF Realtime Dynamic Watermark Studio */
        files.length > 0 ? (
          <div className="coconut-panel p-6 sm:p-8">
            <PdfWatermarkStudio
              file={files[0]}
              onExecute={handleWatermarkExecute}
              loading={loading}
              error={error}
              successMsg={successMsg}
              executionResult={executionResult}
              onReset={() => {
                setExecutionResult(null);
                setSuccessMsg(null);
                setError(null);
              }}
              onClearFile={() => {
                setFiles([]);
                setExecutionResult(null);
                setSuccessMsg(null);
                setError(null);
              }}
            />
          </div>
        ) : (
          <div className="coconut-panel p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#D2BCAB]/30 dark:border-[#4D392E]/40">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 shadow-md shadow-teal-500/25 flex items-center justify-center text-white flex-shrink-0">
                  <Stamp className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center flex-wrap gap-2">
                    <h3 className="text-base sm:text-lg font-extrabold text-coconut-900 dark:text-darkbg-text tracking-tight">
                      {t.pdfWatermark.title}
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-teal-500/10 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 border border-teal-500/30 tracking-wider uppercase">
                      真底图动态水印
                    </span>
                  </div>
                  <p className="text-xs text-coconut-600 dark:text-darkbg-muted leading-relaxed max-w-xl">
                    {t.pdfWatermark.desc}
                  </p>
                </div>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold self-start sm:self-auto flex-shrink-0">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>{t.pdfEdit?.privacyGuarantee || "100% 本地沙盒 · 零云端上传"}</span>
              </div>
            </div>

            <Dropzone
              accept=".pdf"
              multiple={false}
              selectedFiles={files}
              onFilesSelected={setFiles}
              onClear={() => setFiles([])}
              title={t.pdfWatermark.dropzoneTitle}
              hint={t.pdfWatermark.dropzoneHint}
            />
          </div>
        )
      ) : activeTab === "pdf-compress" ? (
        /* PDF Smart Compression Studio */
        files.length > 0 ? (
          <div className="coconut-panel p-6 sm:p-8">
            <PdfCompressStudio
              file={files[0]}
              onCompress={handleCompressExecute}
              loading={loading}
              error={error}
              successMsg={successMsg}
              executionResult={executionResult}
              onReset={() => {
                setExecutionResult(null);
                setSuccessMsg(null);
                setError(null);
              }}
              onClearFile={() => {
                setFiles([]);
                setExecutionResult(null);
                setSuccessMsg(null);
                setError(null);
              }}
            />
          </div>
        ) : (
          <div className="coconut-panel p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#D2BCAB]/30 dark:border-[#4D392E]/40">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 shadow-md shadow-emerald-500/25 flex items-center justify-center text-white flex-shrink-0">
                  <Zap className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center flex-wrap gap-2">
                    <h3 className="text-base sm:text-lg font-extrabold text-coconut-900 dark:text-darkbg-text tracking-tight">
                      {t.pdfCompress?.title || "PDF 智能极限体积瘦身"}
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 tracking-wider uppercase">
                      极限智能瘦身
                    </span>
                  </div>
                  <p className="text-xs text-coconut-600 dark:text-darkbg-muted leading-relaxed max-w-xl">
                    {t.pdfCompress?.desc ||
                      "支持轻度、平衡、极限三档优化，清除孤立死对象并智能下采样高清大图，压缩比可达 50%~80%。"}
                  </p>
                </div>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold self-start sm:self-auto flex-shrink-0">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>{t.pdfEdit?.privacyGuarantee || "100% 本地沙盒 · 零云端上传"}</span>
              </div>
            </div>

            <Dropzone
              accept=".pdf"
              multiple={false}
              selectedFiles={files}
              onFilesSelected={setFiles}
              onClear={() => setFiles([])}
              title={
                t.pdfCompress?.dropzoneTitle ||
                "拖入待压缩瘦身的 PDF 文档 (.pdf)，或点击选择"
              }
              hint={
                t.pdfCompress?.dropzoneHint ||
                "支持标准 PDF 文档，完全本地处理无隐私泄露"
              }
            />
          </div>
        )
      ) : activeTab === "images-to-pdf" ? (
        /* Images to PDF Studio */
        files.length > 0 ? (
          <div className="coconut-panel p-6 sm:p-8">
            <ImagesToPdfStudio
              files={files}
              onFilesChange={setFiles}
              onConvert={handleImagesToPdfExecute}
              loading={loading}
              error={error}
              successMsg={successMsg}
              executionResult={executionResult}
              onReset={() => {
                setExecutionResult(null);
                setSuccessMsg(null);
                setError(null);
              }}
              onClearFiles={() => {
                setFiles([]);
                setExecutionResult(null);
                setSuccessMsg(null);
                setError(null);
              }}
            />
          </div>
        ) : (
          <div className="coconut-panel p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#D2BCAB]/30 dark:border-[#4D392E]/40">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-md shadow-cyan-500/25 flex items-center justify-center text-white flex-shrink-0">
                  <ImageIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center flex-wrap gap-2">
                    <h3 className="text-base sm:text-lg font-extrabold text-coconut-900 dark:text-darkbg-text tracking-tight">
                      {t.imagesToPdf?.title || "多图片一键拼合转高清 PDF"}
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 tracking-wider uppercase">
                      批量自适应拼合
                    </span>
                  </div>
                  <p className="text-xs text-coconut-600 dark:text-darkbg-muted leading-relaxed max-w-xl">
                    {t.imagesToPdf?.desc ||
                      "支持选中多张照片或扫描件批量上传，自由上下拖拽调整排版顺序，支持原图自适应与标准 A4 规格导出。"}
                  </p>
                </div>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold self-start sm:self-auto flex-shrink-0">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>{t.pdfEdit?.privacyGuarantee || "100% 本地沙盒 · 零云端上传"}</span>
              </div>
            </div>

            <Dropzone
              accept="image/*"
              multiple={true}
              selectedFiles={files}
              onFilesSelected={setFiles}
              onClear={() => setFiles([])}
              title={
                t.imagesToPdf?.dropzoneTitle ||
                "拖入多张图片（按 Ctrl 多选），或点击选择"
              }
              hint={
                t.imagesToPdf?.dropzoneHint ||
                "支持 JPG / PNG / WebP / BMP / TIFF 格式"
              }
            />
          </div>
        )
      ) : activeTab === "pdf-inplace-edit" ? (
        <PdfInplaceTextStudio
          incomingFile={files[0] || undefined}
          onFileClear={() => setFiles([])}
        />
      ) : activeTab === "office-media-extract" ? (
        <OfficeMediaExtractStudio
          initialFile={files[0] || null}
          onClearInitialFile={() => setFiles([])}
        />
      ) : activeTab === "ai-ocr" || activeTab === "ai-searchable-pdf" ? (
        <AiToolbox
          currentTab={activeTab}
          onTabChange={(id) => handleTabSelect(id as DocTabType)}
          incomingFile={files[0] || null}
          onIncomingFileHandled={() => setFiles([])}
          hideSubTabs={true}
        />
      ) : activeTab === "pdf-protect" ? (
        /* PDF Encrypt, Unlock & Permission Management Dual-Column Studio */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 coconut-panel p-5 sm:p-6 space-y-5">
            <div className="flex items-center gap-3 pb-3 border-b border-coconut-200/80 dark:border-darkbg-border">
              <div
                className={`w-10 h-10 rounded-xl shadow-sm flex items-center justify-center text-white flex-shrink-0 ${
                  protectMode === "encrypt"
                    ? "bg-gradient-to-br from-rose-600 to-red-700"
                    : "bg-gradient-to-br from-emerald-600 to-teal-700"
                }`}
              >
                {protectMode === "encrypt" ? (
                  <Lock className="w-5 h-5" />
                ) : (
                  <Unlock className="w-5 h-5" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-coconut-950 dark:text-darkbg-text">
                    {lang === "en"
                      ? "PDF Encrypt & Unlock Studio"
                      : "PDF 加密解密与权限管理"}
                  </h3>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      protectMode === "encrypt"
                        ? "bg-rose-500/10 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/30"
                        : "bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                    }`}
                  >
                    {protectMode === "encrypt"
                      ? lang === "en"
                        ? "AES Encrypt"
                        : "AES 工业级加密"
                      : lang === "en"
                        ? "Unlock & Scrub"
                        : "权限解除/脱敏"}
                  </span>
                </div>
              </div>
            </div>

            {/* 模式切换器：加密上锁 vs 密码解除与权限净化 */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-coconut-100/80 dark:bg-darkbg-subtle rounded-2xl border border-coconut-200/80 dark:border-darkbg-border">
              <button
                type="button"
                onClick={() => {
                  setProtectMode("encrypt");
                  setError(null);
                  setSuccessMsg(null);
                  setExecutionResult(null);
                }}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  protectMode === "encrypt"
                    ? "bg-white dark:bg-darkbg-card text-rose-700 dark:text-rose-300 shadow-sm border border-rose-500/20"
                    : "text-coconut-600 dark:text-darkbg-muted hover:text-coconut-900"
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>{lang === "en" ? "Encrypt & Lock" : "加密上锁保护"}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setProtectMode("unlock");
                  setError(null);
                  setSuccessMsg(null);
                  setExecutionResult(null);
                }}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  protectMode === "unlock"
                    ? "bg-white dark:bg-darkbg-card text-emerald-700 dark:text-emerald-300 shadow-sm border border-emerald-500/20"
                    : "text-coconut-600 dark:text-darkbg-muted hover:text-coconut-900"
                }`}
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>{lang === "en" ? "Unlock & Strip" : "解密与权限解除"}</span>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-coconut-900 dark:text-darkbg-text mb-1.5">
                  {protectMode === "encrypt"
                    ? t.pdfProtect.label
                    : lang === "en"
                      ? "Document Password (Optional for Owner-Locked PDF)"
                      : "已知打开密码（仅移除打印/复制权限限制可留空）"}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder={
                      protectMode === "encrypt"
                        ? t.pdfProtect.placeholder
                        : lang === "en"
                          ? "Enter password if required to open"
                          : "若文档有打开密码请输入，仅解除编辑/打印锁可留空"
                    }
                    value={protectPassword}
                    onChange={(e) => setProtectPassword(e.target.value)}
                    className="w-full text-sm p-3.5 pr-11 bg-white/80 dark:bg-darkbg-subtle border border-[#CBB09C] dark:border-darkbg-border rounded-2xl outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-coconut-950 dark:text-darkbg-text font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-coconut-500 hover:text-coconut-800 dark:hover:text-darkbg-text transition-colors p-1"
                    title={showPassword ? "隐藏密码" : "显示明文"}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {protectMode === "encrypt" && (
                <div>
                  <label className="block text-xs font-bold text-coconut-900 dark:text-darkbg-text mb-1.5">
                    {lang === "en" ? "Confirm Password" : "确认加密密码"}
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder={
                        lang === "en"
                          ? "Re-enter the same password"
                          : "请再次输入相同的密码核对"
                      }
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`w-full text-sm p-3.5 pr-11 bg-white/80 dark:bg-darkbg-subtle border rounded-2xl outline-none focus:ring-2 transition-all font-medium text-coconut-950 dark:text-darkbg-text ${
                        confirmPassword && protectPassword !== confirmPassword
                          ? "border-rose-400 focus:ring-rose-500/20 focus:border-rose-500"
                          : "border-[#CBB09C] dark:border-darkbg-border focus:ring-orange-500/20 focus:border-orange-500"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-coconut-500 hover:text-coconut-800 dark:hover:text-darkbg-text transition-colors p-1"
                      title={showConfirmPassword ? "隐藏密码" : "显示明文"}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {confirmPassword && protectPassword !== confirmPassword && (
                    <p className="text-[11px] font-bold text-rose-500 mt-1.5 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>
                        {lang === "en"
                          ? "Passwords do not match"
                          : "两次输入的密码不一致"}
                      </span>
                    </p>
                  )}
                  {protectPassword && protectPassword.length < 4 && (
                    <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400 mt-1.5">
                      {lang === "en"
                        ? "Password must be at least 4 characters"
                        : "建议密码长度不少于 4 位字符"}
                    </p>
                  )}
                </div>
              )}

              {/* 隐私元数据清理开关 */}
              <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-coconut-100/60 dark:bg-darkbg-subtle border border-coconut-200/70 dark:border-darkbg-border cursor-pointer">
                <input
                  type="checkbox"
                  checked={cleanMetadata}
                  onChange={(e) => setCleanMetadata(e.target.checked)}
                  className="mt-0.5 rounded border-coconut-300 text-orange-600 focus:ring-orange-500"
                />
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-coconut-900 dark:text-darkbg-text">
                    {lang === "en"
                      ? "Scrub Hidden Privacy Metadata"
                      : "同步抹除文档隐藏隐私元数据"}
                  </div>
                  <div className="text-[11px] text-coconut-600 dark:text-darkbg-muted leading-relaxed">
                    {lang === "en"
                      ? "Clears Author, Title, Producer, Creator and Subject tags."
                      : "自动清空作者 (Author)、制作软件 (Creator/Producer) 与主题记录。"}
                  </div>
                </div>
              </label>

              {/* 安全提示卡片 */}
              <div className="p-3 bg-amber-500/10 dark:bg-amber-950/30 border border-amber-500/30 rounded-2xl flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-200">
                <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-bold">
                    {protectMode === "encrypt"
                      ? lang === "en"
                        ? "Permanent Security Notice"
                        : "不可逆加密提醒"
                      : lang === "en"
                        ? "Authorized Unlock Notice"
                        : "本地无痕解密说明"}
                  </div>
                  <div className="text-[11px] leading-relaxed text-amber-900/80 dark:text-amber-300/80">
                    {protectMode === "encrypt"
                      ? lang === "en"
                        ? "Please write down or record your password carefully. Encrypted PDFs cannot be recovered without it."
                        : "请务必妥善记录设置的密码。文档完成 AES 加密后，无任何找回后门。"
                      : lang === "en"
                        ? "Removes owner print/copy locks or decrypts password-protected PDFs with your known password locally."
                        : "支持一键移除所有者打印/复制权限锁，或凭已知密码将受保护 PDF 转为无密码自由文档。"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 coconut-panel p-5 sm:p-6 space-y-5">
            <div className="text-xs font-bold text-coconut-900 dark:text-darkbg-text">
              {t.pdfProtect.dropzoneHeader}
            </div>

            <Dropzone
              accept=".pdf"
              multiple={false}
              selectedFiles={files}
              onFilesSelected={setFiles}
              onClear={() => setFiles([])}
              title={t.pdfProtect.dropzoneTitle}
              hint={t.pdfProtect.dropzoneHint}
            />

            {error && (
              <div className="p-3 bg-toast-50 dark:bg-toast-950/40 border border-toast-200 dark:border-toast-900/60 rounded-2xl flex items-center gap-2 text-toast-700 dark:text-toast-300 text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-toast-500" />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-palm-50 dark:bg-palm-950/40 border border-palm-200 dark:border-palm-900/60 rounded-2xl flex items-center gap-2 text-palm-700 dark:text-palm-300 text-xs">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-palm-500" />
                <span>{successMsg}</span>
              </div>
            )}

            {executionResult ? (
              <div className="p-5 bg-accent-subtle border border-accent-border rounded-2xl space-y-4 shadow-coconut-sm animate-fade-in backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 truncate">
                    <div className="w-10 h-10 rounded-xl bg-accent-gradient text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                      <FileCheck className="w-5 h-5 text-white" />
                    </div>
                    <div className="truncate">
                      <h4 className="text-sm font-bold text-coconut-950 dark:text-white truncate">
                        {executionResult.filename}
                      </h4>
                      <p className="text-xs text-orange-800 dark:text-amber-300 font-mono font-medium">
                        {formatBytes(executionResult.size)} ·{" "}
                        {t.pdfProtect.readyText}
                      </p>
                    </div>
                  </div>
                  <span className="hidden sm:inline-block px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-900 dark:text-amber-200 border border-amber-500/30 flex-shrink-0">
                    {t.pdfProtect.readyBadge}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    onClick={() =>
                      downloadBlob(
                        executionResult.blob,
                        executionResult.filename,
                      )
                    }
                    className="flex-1 py-3 px-4 rounded-xl btn-3d-sunset text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-coconut-sm"
                  >
                    <Download className="w-4 h-4" />
                    <span>{t.pdfProtect.downloadNow}</span>
                  </button>

                  <button
                    onClick={() => {
                      setFiles([]);
                      setExecutionResult(null);
                      setSuccessMsg(null);
                      setError(null);
                      setProtectPassword("");
                      setConfirmPassword("");
                    }}
                    className="py-3 px-4 rounded-xl btn-3d-secondary font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>
                      {protectMode === "encrypt"
                        ? t.pdfProtect.encryptAnother
                        : lang === "en"
                          ? "Unlock Another"
                          : "继续解锁其他文档"}
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={handleExecute}
                disabled={
                  loading ||
                  files.length === 0 ||
                  (protectMode === "encrypt" &&
                    (!protectPassword.trim() ||
                      !confirmPassword.trim() ||
                      protectPassword !== confirmPassword ||
                      protectPassword.length < 4))
                }
                className={`w-full py-3.5 px-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                  loading ||
                  files.length === 0 ||
                  (protectMode === "encrypt" &&
                    (!protectPassword.trim() ||
                      !confirmPassword.trim() ||
                      protectPassword !== confirmPassword ||
                      protectPassword.length < 4))
                    ? "bg-coconut-100 dark:bg-darkbg-subtle text-coconut-400 dark:text-darkbg-muted cursor-not-allowed border border-coconut-200 dark:border-darkbg-border"
                    : "btn-3d-sunset text-white cursor-pointer"
                }`}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t.pdfProtect.processing}</span>
                  </>
                ) : protectMode === "encrypt" ? (
                  <>
                    <Lock className="w-4 h-4 text-amber-200" />
                    <span>{t.pdfProtect.launchBtn}</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-4 h-4 text-amber-200" />
                    <span>
                      {lang === "en"
                        ? "Unlock & Export Clean PDF"
                        : "立即解除密码与权限限制"}
                    </span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      ) : (
        /* PDF to Word or Word to PDF Workbench */
        <div className="coconut-panel p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#D2BCAB]/30 dark:border-[#4D392E]/40">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-md shadow-orange-500/25 flex items-center justify-center text-white flex-shrink-0">
                <FileText className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center flex-wrap gap-2">
                  <h3 className="text-base sm:text-lg font-extrabold text-coconut-900 dark:text-darkbg-text tracking-tight">
                    {activeTab === "word-to-pdf"
                      ? t.common.wordConversion
                      : t.common.pdfConversion}
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 tracking-wider uppercase">
                    {activeTab === "word-to-pdf" ? "300 DPI 打印级" : "高保真逆向还原"}
                  </span>
                </div>
                <p className="text-xs text-coconut-600 dark:text-darkbg-muted leading-relaxed max-w-xl">
                  {activeTab === "word-to-pdf"
                    ? t.common.wordDesc
                    : t.common.pdfDesc}
                </p>
              </div>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold self-start sm:self-auto flex-shrink-0">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>{t.pdfEdit.privacyGuarantee || "100% 本地沙盒 · 零云端上传"}</span>
            </div>
          </div>

          {/* Quality selector for Word to PDF */}
          {activeTab === "word-to-pdf" && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-coconut-800 dark:text-darkbg-text">
                {t.quality.label}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    key: "light" as const,
                    label: t.quality.light,
                    icon: "📄",
                    dpi: t.quality.lightDpi,
                    desc: t.quality.lightDesc,
                    size: t.quality.lightSize,
                  },
                  {
                    key: "standard" as const,
                    label: t.quality.standard,
                    icon: "📋",
                    dpi: t.quality.standardDpi,
                    desc: t.quality.standardDesc,
                    size: t.quality.standardSize,
                  },
                  {
                    key: "high" as const,
                    label: t.quality.high,
                    icon: "🖨️",
                    dpi: t.quality.highDpi,
                    desc: t.quality.highDesc,
                    size: t.quality.highSize,
                  },
                ].map((q) => (
                  <button
                    key={q.key}
                    onClick={() => setConversionQuality(q.key)}
                    className={`relative p-3 rounded-xl border-2 text-left transition-all ${
                      conversionQuality === q.key
                        ? "border-accent-solid bg-accent-subtle shadow-sm"
                        : "border-coconut-200 dark:border-darkbg-border bg-coconut-50/50 dark:bg-darkbg-subtle hover:border-coconut-300 dark:hover:border-darkbg-border/80"
                    }`}
                  >
                    <div className="text-base leading-none mb-1">
                      {q.icon}
                    </div>
                    <div
                      className={`text-xs font-bold ${conversionQuality === q.key ? "text-accent-solid" : "text-coconut-900 dark:text-darkbg-text"}`}
                    >
                      {q.label}
                    </div>
                    <div className="text-[10px] font-mono text-coconut-500 dark:text-darkbg-muted mt-0.5">
                      {q.dpi}
                    </div>
                    <div className="text-[10px] text-coconut-400 dark:text-darkbg-muted">
                      {q.size}
                    </div>
                    {conversionQuality === q.key && (
                      <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-accent-solid text-white flex items-center justify-center">
                        <svg
                          className="w-2.5 h-2.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* First page thumbnail preview card for PDF to Word */}
          {activeTab === "pdf-to-word" && files.length > 0 ? (
            <div className="p-4 rounded-2xl bg-coconut-50/80 dark:bg-darkbg-subtle border border-coconut-200 dark:border-darkbg-border flex flex-col sm:flex-row items-center gap-4">
              <div className="w-16 h-22 rounded-xl overflow-hidden border border-coconut-300 dark:border-darkbg-border bg-white dark:bg-darkbg-card flex items-center justify-center flex-shrink-0 shadow-xs">
                {pdfToWordThumb?.url ? (
                  <img
                    src={pdfToWordThumb.url}
                    alt="PDF Preview"
                    className="w-full h-full object-cover"
                  />
                ) : pdfToWordThumb?.loading ? (
                  <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
                ) : (
                  <FileText className="w-7 h-7 text-coconut-400" />
                )}
              </div>

              <div className="flex-1 min-w-0 text-center sm:text-left">
                <h4 className="text-sm font-bold text-coconut-950 dark:text-white truncate">
                  {files[0].name}
                </h4>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-1 text-xs text-coconut-600 dark:text-darkbg-muted">
                  <span className="font-mono">
                    {formatBytes(files[0].size)}
                  </span>
                  <span>·</span>
                  <span>
                    {pdfToWordThumb?.numPages
                      ? t.common.pdfPageCount.replace(
                          "{n}",
                          String(pdfToWordThumb.numPages),
                        )
                      : t.common.pdfFormat}
                  </span>
                </div>

                {/* Page range selector (Start & End) */}
                <div className="flex flex-wrap items-center gap-2 mt-2.5">
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs font-semibold text-coconut-800 dark:text-darkbg-text whitespace-nowrap">
                      {lang === "en" ? "From Page:" : "起始页:"}
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={endPage || pdfToWordThumb?.numPages || 999}
                      value={startPage + 1}
                      onChange={(e) =>
                        setStartPage(
                          Math.max(
                            0,
                            (parseInt(e.target.value) || 1) - 1,
                          ),
                        )
                      }
                      className="w-14 px-2 py-1 text-xs font-mono font-bold bg-white dark:bg-darkbg-card border border-coconut-300 dark:border-darkbg-border rounded-lg text-center"
                    />
                  </div>

                  <div className="flex items-center gap-1.5">
                    <label className="text-xs font-semibold text-coconut-800 dark:text-darkbg-text whitespace-nowrap">
                      {lang === "en" ? "To Page:" : "结束页:"}
                    </label>
                    <input
                      type="number"
                      min={startPage + 1}
                      max={pdfToWordThumb?.numPages || 999}
                      value={endPage !== null ? endPage : (pdfToWordThumb?.numPages || 1)}
                      onChange={(e) =>
                        setEndPage(
                          Math.max(
                            startPage + 1,
                            parseInt(e.target.value) || (startPage + 1),
                          ),
                        )
                      }
                      className="w-14 px-2 py-1 text-xs font-mono font-bold bg-white dark:bg-darkbg-card border border-coconut-300 dark:border-darkbg-border rounded-lg text-center"
                    />
                  </div>

                  <span className="text-[11px] text-coconut-500 font-mono">
                    {lang === "en"
                      ? `(${Math.max(1, (endPage ?? (pdfToWordThumb?.numPages || 1)) - startPage)} pages)`
                      : `(共截取 ${Math.max(1, (endPage ?? (pdfToWordThumb?.numPages || 1)) - startPage)} 页)`}
                  </span>
                </div>
              </div>

              <button
                onClick={() => {
                  setFiles([]);
                  setPdfToWordThumb(null);
                }}
                className="p-2 rounded-xl text-coconut-500 hover:text-rose-600 hover:bg-rose-500/10 transition-colors"
                title={t.common.changeFile}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Dropzone
              accept={
                activeTab === "word-to-pdf" ? ".docx,.doc" : ".pdf"
              }
              multiple={false}
              selectedFiles={files}
              onFilesSelected={setFiles}
              onClear={() => setFiles([])}
              title={
                activeTab === "word-to-pdf"
                  ? t.common.uploadWordHint
                  : t.common.uploadPdfHint
              }
              hint={
                activeTab === "word-to-pdf"
                  ? t.common.supportsWord
                  : t.common.supportsPdf
              }
            />
          )}

          {error && (
            <div className="p-3 bg-toast-50 dark:bg-toast-950/40 border border-toast-200 dark:border-toast-900/60 rounded-2xl flex items-center gap-2 text-toast-700 dark:text-toast-300 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-toast-500" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-palm-50 dark:bg-palm-950/40 border border-palm-200 dark:border-palm-900/60 rounded-2xl flex items-center gap-2 text-palm-700 dark:text-palm-300 text-xs">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-palm-500" />
              <span>{successMsg}</span>
            </div>
          )}

          {executionResult ? (
            <div className="p-5 bg-accent-subtle border border-accent-border rounded-2xl space-y-4 shadow-coconut-sm animate-fade-in backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 truncate">
                  <div className="w-10 h-10 rounded-xl bg-accent-gradient text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                    <FileCheck className="w-5 h-5 text-white" />
                  </div>
                  <div className="truncate">
                    <h4 className="text-sm font-bold text-coconut-950 dark:text-white truncate">
                      {executionResult.filename}
                    </h4>
                    <p className="text-xs text-orange-800 dark:text-amber-300 font-mono font-medium">
                      {formatBytes(executionResult.size)} ·{" "}
                      {t.common.readyForDownload}
                    </p>
                  </div>
                </div>
                <span className="hidden sm:inline-block px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-900 dark:text-amber-200 border border-amber-500/30 flex-shrink-0">
                  {t.common.readyBadge}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  onClick={() =>
                    downloadBlob(
                      executionResult.blob,
                      executionResult.filename,
                    )
                  }
                  data-download-result="true"
                  className="flex-1 py-3 px-4 rounded-xl btn-3d-sunset text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-coconut-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>{t.common.downloadNow}</span>
                </button>

                <button
                  onClick={() => {
                    setFiles([]);
                    setExecutionResult(null);
                    setSuccessMsg(null);
                    setError(null);
                  }}
                  className="py-3 px-4 rounded-xl btn-3d-secondary font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{t.common.convertAnother}</span>
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleExecute}
              data-primary-action="true"
              disabled={loading}
              className={`w-full py-3.5 px-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                loading
                  ? "bg-coconut-100 dark:bg-darkbg-subtle text-coconut-400 dark:text-darkbg-muted cursor-not-allowed border border-coconut-200 dark:border-darkbg-border"
                  : "btn-3d-sunset text-white cursor-pointer"
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>
                    {activeTab === "pdf-to-word" && conversionPhase
                      ? conversionPhase
                      : t.common.processing}
                  </span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 text-amber-200" />
                  <span>{getActionBtnText()}</span>
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
