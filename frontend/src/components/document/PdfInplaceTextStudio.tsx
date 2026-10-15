"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Edit3,
  Search,
  Replace,
  Check,
  Trash2,
  Download,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Type,
  Palette,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Layers,
  Sliders,
  X,
  FileText,
  CornerDownRight,
  HelpCircle,
} from "lucide-react";
import Dropzone from "@/components/Dropzone";
import {
  inspectPdfForEdit,
  applyPdfTextPatches,
  PdfInspectResult,
  PdfInspectPage,
  PdfInspectItem,
  PdfTextPatch,
  downloadBlob,
} from "@/lib/api";
import { formatBytes } from "@/lib/imageProcessor";
import { useI18n } from "@/lib/i18n";

interface PdfInplaceTextStudioProps {
  incomingFile?: File;
  onFileClear?: () => void;
}

export default function PdfInplaceTextStudio({
  incomingFile,
  onFileClear,
}: PdfInplaceTextStudioProps) {
  const { lang } = useI18n();

  // 基础文件与探测状态
  const [file, setFile] = useState<File | null>(incomingFile || null);
  const [inspecting, setInspecting] = useState(false);
  const [inspectResult, setInspectResult] = useState<PdfInspectResult | null>(null);
  const [inspectError, setInspectError] = useState<string | null>(null);

  // 页面导航与缩放
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [zoomScale, setZoomScale] = useState(1.0);

  // 修正模式：'search' 全局搜索替换 | 'click' 点选精细修正
  const [activeMode, setActiveMode] = useState<"search" | "click">("search");

  // 待应用修正补丁列表
  const [patches, setPatches] = useState<PdfTextPatch[]>([]);

  // 搜索替换状态
  const [searchQuery, setSearchQuery] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [searchFontFamily, setSearchFontFamily] = useState<"sans" | "serif" | "kai" | "fang" | "helvetica" | "times">("sans");
  const [searchTextColor, setSearchTextColor] = useState("#000000");
  const [searchBgColor, setSearchBgColor] = useState("#FFFFFF");

  // 点选选中项与编辑状态
  const [selectedItem, setSelectedItem] = useState<PdfInspectItem | null>(null);
  const [clickNewText, setClickNewText] = useState("");
  const [clickFontFamily, setClickFontFamily] = useState<"sans" | "serif" | "kai" | "fang" | "helvetica" | "times">("sans");
  const [clickFontSize, setClickFontSize] = useState<number>(14);
  const [clickTextColor, setClickTextColor] = useState("#000000");
  const [clickBgColor, setClickBgColor] = useState("#FFFFFF");
  const [clickAutoFit, setClickAutoFit] = useState(true);

  // 导出状态
  const [applying, setApplying] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState<{ filename: string; blob: Blob } | null>(null);

  // 处理传入文件变动
  useEffect(() => {
    if (incomingFile) {
      setFile(incomingFile);
    }
  }, [incomingFile]);

  // 当文件变动时，自动触发后端探测
  useEffect(() => {
    if (!file) {
      setInspectResult(null);
      setPatches([]);
      setSelectedItem(null);
      setExportSuccess(null);
      setInspectError(null);
      return;
    }

    let isMounted = true;
    const runInspect = async () => {
      setInspecting(true);
      setInspectError(null);
      setInspectResult(null);
      setPatches([]);
      setSelectedItem(null);
      setExportSuccess(null);
      setCurrentPageIndex(0);

      try {
        const result = await inspectPdfForEdit(file, { dpi: 120, maxPages: 50 });
        if (isMounted) {
          setInspectResult(result);
        }
      } catch (err: any) {
        if (isMounted) {
          setInspectError(err.message || "PDF 解析失败，请确认文档未损坏");
        }
      } finally {
        if (isMounted) {
          setInspecting(false);
        }
      }
    };

    runInspect();
    return () => {
      isMounted = false;
    };
  }, [file]);

  const currentPage: PdfInspectPage | null = useMemo(() => {
    if (!inspectResult || !inspectResult.pages || inspectResult.pages.length === 0) return null;
    return inspectResult.pages[currentPageIndex] || inspectResult.pages[0];
  }, [inspectResult, currentPageIndex]);

  // 全局搜索匹配项
  const searchMatches = useMemo(() => {
    if (!inspectResult || !searchQuery.trim()) return [];
    const query = searchQuery.trim().toLowerCase();
    const matches: { pageIndex: number; pageNumber: number; item: PdfInspectItem }[] = [];

    inspectResult.pages.forEach((page) => {
      page.items.forEach((item) => {
        if (item.str.toLowerCase().includes(query)) {
          matches.push({
            pageIndex: page.pageIndex,
            pageNumber: page.pageNumber,
            item,
          });
        }
      });
    });

    return matches;
  }, [inspectResult, searchQuery]);

  // 当点选某个页面文字时，激活右侧点选面板
  const handleItemSelect = (item: PdfInspectItem) => {
    setSelectedItem(item);
    setClickNewText(item.str);
    setClickFontSize(item.fontSize || 14);
    setActiveMode("click");
  };

  // 添加单项点选修正
  const handleAddClickPatch = () => {
    if (!selectedItem || !currentPage) return;
    const newPatch: PdfTextPatch = {
      id: `patch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      pageIndex: currentPage.pageIndex,
      x: selectedItem.x,
      y: selectedItem.y,
      width: selectedItem.width,
      height: selectedItem.height,
      originalText: selectedItem.str,
      newText: clickNewText,
      fontFamily: clickFontFamily,
      fontSize: clickFontSize,
      colorHex: clickTextColor,
      bgHex: clickBgColor,
      autoFit: clickAutoFit,
    };

    // 避免对同区域重复添加
    setPatches((prev) => [
      ...prev.filter(
        (p) =>
          !(
            p.pageIndex === newPatch.pageIndex &&
            Math.abs(p.x - newPatch.x) < 2 &&
            Math.abs(p.y - newPatch.y) < 2
          )
      ),
      newPatch,
    ]);

    setSelectedItem(null);
  };

  // 一键替换所有搜索匹配项
  const handleApplyAllSearchMatches = () => {
    if (searchMatches.length === 0) return;

    const newPatches: PdfTextPatch[] = searchMatches.map((m) => {
      // 替换文字：若原文字包含搜索词，整体进行替换
      const modifiedStr = m.item.str.replace(
        new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
        replaceText
      );

      return {
        id: `search_patch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        pageIndex: m.pageIndex,
        x: m.item.x,
        y: m.item.y,
        width: m.item.width,
        height: m.item.height,
        originalText: m.item.str,
        newText: modifiedStr,
        fontFamily: searchFontFamily,
        fontSize: m.item.fontSize,
        colorHex: searchTextColor,
        bgHex: searchBgColor,
        autoFit: true,
      };
    });

    setPatches((prev) => {
      // 去重添加
      const existing = [...prev];
      for (const np of newPatches) {
        const idx = existing.findIndex(
          (p) =>
            p.pageIndex === np.pageIndex &&
            Math.abs(p.x - np.x) < 2 &&
            Math.abs(p.y - np.y) < 2
        );
        if (idx !== -1) {
          existing[idx] = np;
        } else {
          existing.push(np);
        }
      }
      return existing;
    });

    setSearchQuery("");
    setReplaceText("");
  };

  // 移除单个 Patch
  const handleRemovePatch = (patchId: string) => {
    setPatches((prev) => prev.filter((p) => p.id !== patchId));
  };

  // 清空所有 Patches
  const handleClearPatches = () => {
    setPatches([]);
    setExportSuccess(null);
    setExportError(null);
  };

  // 提交并生成修正后的 PDF
  const handleExportFixedPdf = async () => {
    if (!file || patches.length === 0) return;
    setApplying(true);
    setExportError(null);
    setExportSuccess(null);

    try {
      const res = await applyPdfTextPatches(file, patches);
      setExportSuccess({
        filename: res.filename,
        blob: res.blob,
      });
      // 自动触发下载
      downloadBlob(res.blob, res.filename);
    } catch (err: any) {
      setExportError(err.message || "原地修正导出失败，请重试");
    } finally {
      setApplying(false);
    }
  };

  // 重置工作区
  const handleReset = () => {
    setFile(null);
    setInspectResult(null);
    setPatches([]);
    setSelectedItem(null);
    setExportSuccess(null);
    setInspectError(null);
    onFileClear?.();
  };

  // 初始空态：未选择 PDF 文档
  if (!file) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#D2BCAB]/30 dark:border-[#4D392E]/40">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-md shadow-amber-500/25 flex items-center justify-center text-white flex-shrink-0">
              <Edit3 className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-bold tracking-tight text-[#2D221E] dark:text-[#F5EBE6]">
                  {lang === "en" ? "PDF In-place Text Fix" : "PDF 局部文字原地修正"}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300">
                  {lang === "en" ? "P0 High-Precision" : "高精度排版保持"}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[#7D6B5D] dark:text-[#BCA89B]">
                {lang === "en"
                  ? "Fix contract typos, dates, or amounts directly without converting back to Word. Preserves 100% layout, vectors and fonts."
                  : "针对合同错别字、签署日期、金额填错等高频痛点，无需重转 Word 即可原地涂白重绘修正，100% 保持原版面与矢量印章！"}
              </p>
            </div>
          </div>
        </div>

        <Dropzone
          accept=".pdf"
          selectedFiles={[]}
          onFilesSelected={(newFiles) => {
            if (newFiles.length > 0) setFile(newFiles[0]);
          }}
          onClear={() => {}}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          <div className="p-4 rounded-xl border border-[#D2BCAB]/30 dark:border-[#4D392E]/40 bg-white/40 dark:bg-[#201815]/40 space-y-1.5">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-semibold text-xs sm:text-sm">
              <Sparkles className="w-4 h-4" />
              <span>{lang === "en" ? "100% Layout Integrity" : "原文档零损伤排版保持"}</span>
            </div>
            <p className="text-xs text-[#7D6B5D] dark:text-[#BCA89B]">
              {lang === "en"
                ? "Keeps all vector logos, official stamps, tables and lines completely intact."
                : "杜绝因转 Word 造成的表格错位、印章图片偏移与页码变形，原版高保真输出。"}
            </p>
          </div>
          <div className="p-4 rounded-xl border border-[#D2BCAB]/30 dark:border-[#4D392E]/40 bg-white/40 dark:bg-[#201815]/40 space-y-1.5">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold text-xs sm:text-sm">
              <Search className="w-4 h-4" />
              <span>{lang === "en" ? "Global Search & Replace" : "全文搜索定位与批量替换"}</span>
            </div>
            <p className="text-xs text-[#7D6B5D] dark:text-[#BCA89B]">
              {lang === "en"
                ? "Search keywords like '2025' or company names and batch replace across all pages."
                : "快速定位跨页的年份、公司名称或固定数值，支持一键批量原地修正。"}
            </p>
          </div>
          <div className="p-4 rounded-xl border border-[#D2BCAB]/30 dark:border-[#4D392E]/40 bg-white/40 dark:bg-[#201815]/40 space-y-1.5">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-xs sm:text-sm">
              <Sliders className="w-4 h-4" />
              <span>{lang === "en" ? "Auto-Fit Width Protection" : "智能自适应防溢出"}</span>
            </div>
            <p className="text-xs text-[#7D6B5D] dark:text-[#BCA89B]">
              {lang === "en"
                ? "Automatically calculates font metrics to avoid overlapping adjacent text."
                : "当修改后的文字更长时，自适应算法会自动微调字号字距，杜绝侵入邻近段落。"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 探测中状态
  if (inspecting) {
    return (
      <div className="coconut-panel p-10 flex flex-col items-center justify-center space-y-4 text-center">
        <Loader2 className="w-10 h-10 animate-spin text-amber-500" />
        <div className="space-y-1">
          <h4 className="text-base font-bold text-[#2D221E] dark:text-[#F5EBE6]">
            {lang === "en" ? "Inspecting PDF Layout & Vectors..." : "正在反编译版面矢量与高精度文字坐标..."}
          </h4>
          <p className="text-xs text-[#7D6B5D] dark:text-[#BCA89B]">
            {lang === "en"
              ? "Rendering high-res page canvas and indexing word geometries..."
              : `正在高保真渲染《${file.name}》各页画面并提取毫米级文字坐标，请稍候...`}
          </p>
        </div>
      </div>
    );
  }

  // 探测失败状态
  if (inspectError) {
    return (
      <div className="coconut-panel p-8 space-y-4">
        <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
          <AlertCircle className="w-6 h-6 flex-shrink-0" />
          <div className="space-y-0.5">
            <h4 className="font-bold text-sm sm:text-base">
              {lang === "en" ? "PDF Inspection Failed" : "PDF 版面解析失败"}
            </h4>
            <p className="text-xs text-[#7D6B5D] dark:text-[#BCA89B]">{inspectError}</p>
          </div>
        </div>
        <button
          onClick={handleReset}
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#8B5E3C] text-white hover:bg-[#70482B] transition-colors"
        >
          {lang === "en" ? "Choose Another Document" : "重新选择文档"}
        </button>
      </div>
    );
  }

  // 当前页上应用的 patches
  const currentPagePatches = patches.filter((p) => p.pageIndex === currentPageIndex);

  return (
    <div className="space-y-5">
      {/* 顶部工具栏与文档信息 */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-[#D2BCAB]/30 dark:border-[#4D392E]/40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
            <Edit3 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm sm:text-base text-[#2D221E] dark:text-[#F5EBE6] truncate max-w-[280px] sm:max-w-[400px]">
                {file.name}
              </h3>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#D2BCAB]/25 dark:bg-[#4D392E]/30 text-[#7D6B5D] dark:text-[#BCA89B]">
                {formatBytes(file.size)}
              </span>
            </div>
            <p className="text-xs text-[#7D6B5D] dark:text-[#BCA89B]">
              {lang === "en"
                ? `Total ${inspectResult?.numPages || 1} pages | ${patches.length} pending patches`
                : `共 ${inspectResult?.numPages || 1} 页 | 当前已配置 ${patches.length} 处修正`}
            </p>
          </div>
        </div>

        {/* 顶部操作区 */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* 翻页器 */}
          {inspectResult && inspectResult.numPages > 1 && (
            <div className="flex items-center gap-1 bg-[#D2BCAB]/20 dark:bg-[#4D392E]/30 p-1 rounded-xl">
              <button
                disabled={currentPageIndex <= 0}
                onClick={() => setCurrentPageIndex((p) => Math.max(0, p - 1))}
                className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-[#2D221E] disabled:opacity-40 transition-colors"
                title="上一页"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs px-2 font-mono font-semibold">
                {currentPageIndex + 1} / {inspectResult.numPages}
              </span>
              <button
                disabled={currentPageIndex >= inspectResult.numPages - 1}
                onClick={() => setCurrentPageIndex((p) => Math.min(inspectResult.numPages - 1, p + 1))}
                className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-[#2D221E] disabled:opacity-40 transition-colors"
                title="下一页"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* 缩放控制器 */}
          <div className="flex items-center gap-1 bg-[#D2BCAB]/20 dark:bg-[#4D392E]/30 p-1 rounded-xl">
            <button
              onClick={() => setZoomScale((s) => Math.max(0.6, s - 0.15))}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-[#2D221E] transition-colors"
              title="缩小"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono px-1.5">{Math.round(zoomScale * 100)}%</span>
            <button
              onClick={() => setZoomScale((s) => Math.min(2.0, s + 0.15))}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-[#2D221E] transition-colors"
              title="放大"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-[#D2BCAB]/40 dark:border-[#4D392E]/50 hover:bg-[#D2BCAB]/15 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{lang === "en" ? "Change Doc" : "换文档"}</span>
          </button>
        </div>
      </div>

      {/* 导出成功提示卡片 */}
      {exportSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <div className="text-xs sm:text-sm">
              <span className="font-bold">
                {lang === "en" ? "Fixed PDF successfully generated!" : "局部文字修正完成并已自动下载！"}
              </span>
              <span className="block opacity-80">{exportSuccess.filename}</span>
            </div>
          </div>
          <button
            onClick={() => downloadBlob(exportSuccess.blob, exportSuccess.filename)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{lang === "en" ? "Download Again" : "再次下载"}</span>
          </button>
        </div>
      )}

      {/* 导出失败提示 */}
      {exportError && (
        <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center gap-2.5 text-xs text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{exportError}</span>
        </div>
      )}

      {/* 工作区主体：左/中 Canvas 预览 + 右侧修正控制器 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* 左侧/中间：交互式 PDF 预览画板 */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col items-center">
          <div className="w-full bg-[#1A1412]/5 dark:bg-[#0F0B0A]/40 rounded-2xl p-4 sm:p-6 overflow-auto max-h-[750px] flex justify-center border border-[#D2BCAB]/20 dark:border-[#4D392E]/30 relative shadow-inner">
            {currentPage ? (
              <div
                className="relative shadow-2xl transition-all duration-150 select-none bg-white"
                style={{
                  width: `${currentPage.viewWidth * zoomScale}px`,
                  height: `${currentPage.viewHeight * zoomScale}px`,
                }}
              >
                {/* 底层原版高保真光栅渲染图 */}
                <img
                  src={currentPage.image}
                  alt={`Page ${currentPage.pageNumber}`}
                  className="w-full h-full object-contain pointer-events-none"
                />

                {/* 文字元素交互探测层 */}
                {currentPage.items.map((item) => {
                  const isSelected = selectedItem?.id === item.id;
                  const isMatch =
                    searchQuery.trim().length > 0 &&
                    item.str.toLowerCase().includes(searchQuery.trim().toLowerCase());

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleItemSelect(item)}
                      title={`点击原地修正: "${item.str}"`}
                      className={`absolute cursor-pointer transition-colors duration-150 rounded-[2px] ${
                        isSelected
                          ? "bg-amber-500/30 border-2 border-amber-600 z-30 ring-2 ring-amber-500/50"
                          : isMatch
                          ? "bg-indigo-500/35 border border-indigo-600 z-20 animate-pulse"
                          : "hover:bg-blue-500/15 hover:border hover:border-blue-500/60 z-10"
                      }`}
                      style={{
                        left: `${item.vx * zoomScale}px`,
                        top: `${item.vy * zoomScale}px`,
                        width: `${item.vw * zoomScale}px`,
                        height: `${item.vh * zoomScale}px`,
                      }}
                    />
                  );
                })}

                {/* 实时所见即所得：渲染已配置的 Patches 遮罩层与新文字 */}
                {currentPagePatches.map((patch) => {
                  // 计算在当前页面上的对应 Viewport 位置
                  // scale = (dpi 120) / 72 = 1.6667
                  const ratio = (120 / 72) * zoomScale;
                  // PDF points 坐标转换回 Viewport 像素
                  const patchLeft = (patch.x * (120 / 72)) * zoomScale;
                  const patchTop = (currentPage.viewHeight - ((patch.y + patch.height) * (120 / 72))) * zoomScale;
                  const patchW = Math.max(10, patch.width * (120 / 72) * zoomScale);
                  const patchH = Math.max(12, patch.height * (120 / 72) * zoomScale);

                  return (
                    <div
                      key={patch.id}
                      className="absolute z-40 flex items-center px-0.5 overflow-hidden shadow-sm"
                      style={{
                        left: `${patchLeft}px`,
                        top: `${patchTop}px`,
                        width: `${patchW}px`,
                        height: `${patchH}px`,
                        backgroundColor: patch.bgHex || "#FFFFFF",
                        border: "1px dashed #F59E0B",
                      }}
                    >
                      <span
                        className="truncate leading-tight font-sans"
                        style={{
                          color: patch.colorHex || "#000000",
                          fontSize: `${Math.max(8, (patch.fontSize || 12) * ratio * 0.55)}px`,
                        }}
                      >
                        {patch.newText}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-20 text-xs text-[#7D6B5D]">
                {lang === "en" ? "No page loaded" : "未加载页面"}
              </div>
            )}
          </div>
          <div className="mt-2.5 flex items-center gap-2 text-xs text-[#7D6B5D] dark:text-[#BCA89B]">
            <HelpCircle className="w-3.5 h-3.5 text-amber-500" />
            <span>
              {lang === "en"
                ? "Tip: Hover and click any text box on the page to modify it in-place."
                : "提示：鼠标悬停并点击画面中任意文字块，即可在右侧输入框中直接进行原地修正与涂白替换。"}
            </span>
          </div>
        </div>

        {/* 右侧：双模式修正配置与待修补清单 */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-4">
          {/* 模式选择 Tab */}
          <div className="flex bg-[#D2BCAB]/20 dark:bg-[#4D392E]/30 p-1 rounded-2xl">
            <button
              onClick={() => setActiveMode("search")}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                activeMode === "search"
                  ? "bg-white dark:bg-[#2D221E] text-amber-600 dark:text-amber-400 shadow-sm"
                  : "text-[#7D6B5D] dark:text-[#BCA89B] hover:text-[#2D221E]"
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>{lang === "en" ? "Search & Replace" : "全文搜索替换"}</span>
            </button>
            <button
              onClick={() => setActiveMode("click")}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                activeMode === "click"
                  ? "bg-white dark:bg-[#2D221E] text-amber-600 dark:text-amber-400 shadow-sm"
                  : "text-[#7D6B5D] dark:text-[#BCA89B] hover:text-[#2D221E]"
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{lang === "en" ? "Click to Edit" : "点选精确修正"}</span>
              {selectedItem && (
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              )}
            </button>
          </div>

          {/* 模式一：搜索替换面板 */}
          {activeMode === "search" && (
            <div className="coconut-panel p-4 sm:p-5 space-y-4 border border-[#D2BCAB]/30 dark:border-[#4D392E]/40">
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#2D221E] dark:text-[#F5EBE6]">
                  {lang === "en" ? "Find Text" : "查找原文字"}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={lang === "en" ? "e.g. 2025" : "输入需修正的原词，如：2025年"}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-[#201815] border border-[#D2BCAB]/40 dark:border-[#4D392E]/60 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                  {searchQuery && (
                    <span className="absolute right-2.5 top-2 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 font-semibold">
                      {searchMatches.length} 处匹配
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#2D221E] dark:text-[#F5EBE6]">
                  {lang === "en" ? "Replace With" : "替换为新文字"}
                </label>
                <input
                  type="text"
                  value={replaceText}
                  onChange={(e) => setReplaceText(e.target.value)}
                  placeholder={lang === "en" ? "e.g. 2026" : "输入替换后的新文字，如：2026年"}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-[#201815] border border-[#D2BCAB]/40 dark:border-[#4D392E]/60 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>

              {/* 字体与风格调整 */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-[#7D6B5D] dark:text-[#BCA89B]">
                    {lang === "en" ? "Font Family" : "中文字体风格"}
                  </label>
                  <select
                    value={searchFontFamily}
                    onChange={(e: any) => setSearchFontFamily(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-xl bg-white dark:bg-[#201815] border border-[#D2BCAB]/40 dark:border-[#4D392E]/60 focus:outline-none"
                  >
                    <option value="sans">黑体 / 微软雅黑 (Sans)</option>
                    <option value="serif">宋体 (Serif)</option>
                    <option value="kai">楷体 (KaiTi)</option>
                    <option value="fang">仿宋 (FangSong)</option>
                    <option value="helvetica">西文 Helvetica</option>
                    <option value="times">西文 Times</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-[#7D6B5D] dark:text-[#BCA89B]">
                    {lang === "en" ? "Text Color" : "文字颜色"}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={searchTextColor}
                      onChange={(e) => setSearchTextColor(e.target.value)}
                      className="w-7 h-7 rounded-lg cursor-pointer border border-[#D2BCAB]/40"
                    />
                    <span className="text-xs font-mono">{searchTextColor}</span>
                  </div>
                </div>
              </div>

              <button
                disabled={!searchQuery.trim() || searchMatches.length === 0}
                onClick={handleApplyAllSearchMatches}
                className="w-full py-2.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white transition-all shadow-md shadow-amber-600/20 flex items-center justify-center gap-2"
              >
                <Replace className="w-3.5 h-3.5" />
                <span>
                  {lang === "en"
                    ? `Replace All (${searchMatches.length} Matches)`
                    : `一键替换全部 (${searchMatches.length} 处)`}
                </span>
              </button>
            </div>
          )}

          {/* 模式二：点选精细修正面板 */}
          {activeMode === "click" && (
            <div className="coconut-panel p-4 sm:p-5 space-y-4 border border-[#D2BCAB]/30 dark:border-[#4D392E]/40">
              {selectedItem ? (
                <>
                  <div className="p-2.5 rounded-xl bg-[#D2BCAB]/15 dark:bg-[#4D392E]/25 space-y-1">
                    <div className="text-[10px] font-semibold text-[#7D6B5D] dark:text-[#BCA89B] uppercase tracking-wider">
                      {lang === "en" ? "Selected Original Text" : "已选中的原文字块"}
                    </div>
                    <div className="text-xs font-mono font-bold text-[#2D221E] dark:text-[#F5EBE6] break-all">
                      "{selectedItem.str}"
                    </div>
                    <div className="text-[10px] text-[#7D6B5D] dark:text-[#BCA89B]">
                      坐标: ({selectedItem.x}, {selectedItem.y}) | 原字号: {selectedItem.fontSize}pt
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#2D221E] dark:text-[#F5EBE6]">
                      {lang === "en" ? "New Text" : "原地修正为"}
                    </label>
                    <textarea
                      rows={2}
                      value={clickNewText}
                      onChange={(e) => setClickNewText(e.target.value)}
                      placeholder="输入修改后的新文字（清空则视为原地涂白抹除）"
                      className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-[#201815] border border-[#D2BCAB]/40 dark:border-[#4D392E]/60 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-[#7D6B5D] dark:text-[#BCA89B]">
                        {lang === "en" ? "Font Family" : "字体风格"}
                      </label>
                      <select
                        value={clickFontFamily}
                        onChange={(e: any) => setClickFontFamily(e.target.value)}
                        className="w-full px-2 py-1.5 text-xs rounded-xl bg-white dark:bg-[#201815] border border-[#D2BCAB]/40 dark:border-[#4D392E]/60 focus:outline-none"
                      >
                        <option value="sans">黑体 / 微软雅黑</option>
                        <option value="serif">宋体</option>
                        <option value="kai">楷体</option>
                        <option value="fang">仿宋</option>
                        <option value="helvetica">西文 Helvetica</option>
                        <option value="times">西文 Times</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-[#7D6B5D] dark:text-[#BCA89B]">
                        {lang === "en" ? "Font Size (pt)" : "微调字号 (pt)"}
                      </label>
                      <input
                        type="number"
                        min={6}
                        max={72}
                        value={clickFontSize}
                        onChange={(e) => setClickFontSize(Number(e.target.value) || 12)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-xl bg-white dark:bg-[#201815] border border-[#D2BCAB]/40 dark:border-[#4D392E]/60"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={clickAutoFit}
                        onChange={(e) => setClickAutoFit(e.target.checked)}
                        className="rounded border-[#D2BCAB] text-amber-600 focus:ring-amber-500"
                      />
                      <span className="text-[#7D6B5D] dark:text-[#BCA89B]">
                        {lang === "en" ? "Auto-fit width (prevent overlap)" : "智能自适应字宽 (防文字溢出)"}
                      </span>
                    </label>
                  </div>

                  <button
                    onClick={handleAddClickPatch}
                    className="w-full py-2.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition-all shadow-md shadow-amber-600/20 flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{lang === "en" ? "Stage This In-place Patch" : "确认加入待修补清单"}</span>
                  </button>
                </>
              ) : (
                <div className="py-8 text-center space-y-2 text-[#7D6B5D] dark:text-[#BCA89B]">
                  <Edit3 className="w-8 h-8 mx-auto opacity-40 text-amber-500" />
                  <p className="text-xs">
                    {lang === "en"
                      ? "Click any text box on the left page canvas to begin editing."
                      : "请在左侧预览画板上直接点击需要修正的原文字块"}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 待修补清单与最终导出 */}
          <div className="coconut-panel p-4 sm:p-5 space-y-3.5 border border-[#D2BCAB]/30 dark:border-[#4D392E]/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-600" />
                <h4 className="font-bold text-xs sm:text-sm text-[#2D221E] dark:text-[#F5EBE6]">
                  {lang === "en" ? "Staged Patches" : "待应用修正清单"}
                </h4>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-600">
                  {patches.length}
                </span>
              </div>
              {patches.length > 0 && (
                <button
                  onClick={handleClearPatches}
                  className="text-[11px] text-red-500 hover:text-red-700 transition-colors flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>{lang === "en" ? "Clear" : "清空"}</span>
                </button>
              )}
            </div>

            {patches.length === 0 ? (
              <div className="py-5 text-center text-xs text-[#7D6B5D]/70 dark:text-[#BCA89B]/60">
                {lang === "en" ? "No patches added yet" : "暂无待应用的修改项"}
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {patches.map((p, idx) => (
                  <div
                    key={p.id}
                    className="p-2.5 rounded-xl bg-white/70 dark:bg-[#201815]/70 border border-[#D2BCAB]/30 dark:border-[#4D392E]/40 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600">
                          P.{p.pageIndex + 1}
                        </span>
                        <span className="truncate line-through opacity-50 text-[11px]">
                          {p.originalText}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold truncate">
                        <CornerDownRight className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{p.newText || "（纯遮白抹除）"}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemovePatch(p.id)}
                      className="p-1 rounded-lg hover:bg-red-500/10 text-red-500 transition-colors flex-shrink-0"
                      title="删除此项"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* 最终生成与导出按钮 */}
            <button
              disabled={patches.length === 0 || applying}
              onClick={handleExportFixedPdf}
              className="w-full py-3 rounded-xl text-xs sm:text-sm font-bold bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 disabled:opacity-40 text-white transition-all shadow-md shadow-orange-600/25 flex items-center justify-center gap-2"
            >
              {applying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{lang === "en" ? "Applying Patches..." : "正在精细重绘并生成 PDF..."}</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>
                    {lang === "en"
                      ? `Export Fixed PDF (${patches.length} Changes)`
                      : `🚀 确认应用并导出 PDF (${patches.length} 处修正)`}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
