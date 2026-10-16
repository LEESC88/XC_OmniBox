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
  MousePointer,
  AlignLeft,
  Maximize2,
  Minimize2,
  Plus,
  Minus,
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

export const DOCUMENT_FONTS = [
  { value: "times", label: "Times New Roman (标注文档/合同/学术衬线)" },
  { value: "arial", label: "Arial (现代标准无衬线)" },
  { value: "calibri", label: "Calibri (商务/Office 常用体)" },
  { value: "georgia", label: "Georgia (典雅高易读衬线体)" },
  { value: "garamond", label: "Garamond (精美传统高雅衬线)" },
  { value: "verdana", label: "Verdana (宽大字怀清晰体)" },
  { value: "tahoma", label: "Tahoma (紧凑商务无衬线)" },
  { value: "courier", label: "Courier New (等宽/代码/表格)" },
  { value: "consolas", label: "Consolas (现代编程等宽)" },
  { value: "helvetica", label: "Helvetica (国际标准现代体)" },
];

const getFontFamilyCss = (family?: string) => {
  const fam = (family || "times").toLowerCase();
  if (fam === "times" || fam === "serif") return '"Times New Roman", Times, Georgia, serif';
  if (fam === "arial" || fam === "helvetica" || fam === "sans") return 'Arial, Helvetica, "Segoe UI", sans-serif';
  if (fam === "calibri") return 'Calibri, Candara, Segoe, "Segoe UI", Optima, Arial, sans-serif';
  if (fam === "georgia") return 'Georgia, "Times New Roman", serif';
  if (fam === "garamond") return 'Garamond, "EB Garamond", "Times New Roman", serif';
  if (fam === "verdana") return 'Verdana, Geneva, sans-serif';
  if (fam === "tahoma") return 'Tahoma, Verdana, Segoe, sans-serif';
  if (fam === "courier") return '"Courier New", Courier, monospace';
  if (fam === "consolas") return 'Consolas, Monaco, "Courier New", monospace';
  return '"Times New Roman", Times, serif';
};

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
  // 编辑粒度：'word' 单字精修 (默认，修改/加粗单字绝不影响整句) | 'line' 整行编辑 | 'draw' 自由画框
  const [editGranularity, setEditGranularity] = useState<"word" | "line" | "draw">("word");

  // 待应用修正补丁列表
  const [patches, setPatches] = useState<PdfTextPatch[]>([]);

  // 全屏沉浸工作台模式
  const [isFullscreen, setIsFullscreen] = useState(false);

  // 当前正在原地编辑的活跃项目 (Active Inline Editing Target)
  const [activeEditingItem, setActiveEditingItem] = useState<{
    id: string;
    isExistingPatch?: boolean;
    patchId?: string;
    originalText: string;
    newText: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    leftPercent: number;
    topPercent: number;
    widthPercent: number;
    heightPercent: number;
    fontFamily: string;
    displayFamily?: string;
    isBold: boolean;
    isItalic: boolean;
    detectedFont?: string;
    fontSize: number;
    colorHex: string;
    bgHex: string;
    autoFit: boolean;
  } | null>(null);

  // Esc 键退出全屏监听 (若当前没有正在打字原地修改)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen && !activeEditingItem) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen, activeEditingItem]);

  // 自由画框拖拽状态 (Drag-to-draw box)
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ xPct: number; yPct: number } | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<{ xPct: number; yPct: number } | null>(null);

  // 右侧辅助面板模式：'search' 全局搜索替换 | 'patches' 待修正清单
  const [sidePanelMode, setSidePanelMode] = useState<"patches" | "search">("patches");

  // 全文搜索替换状态
  const [searchQuery, setSearchQuery] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [searchFontFamily, setSearchFontFamily] = useState<"times" | "arial" | "calibri" | "georgia" | "garamond" | "verdana" | "tahoma" | "courier" | "consolas" | "helvetica" | "sans" | "serif">("times");
  const [searchTextColor, setSearchTextColor] = useState("#000000");
  const [searchBgColor, setSearchBgColor] = useState("#FFFFFF");

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

  // 当文件变动时自动触发后端探测
  useEffect(() => {
    if (!file) {
      setInspectResult(null);
      setPatches([]);
      setActiveEditingItem(null);
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
      setActiveEditingItem(null);
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

  // 当前页上可点击的目标集合（依据整行模式或单词模式自动切换）
  const selectableTargets = useMemo(() => {
    if (!currentPage) return [];
    if (editGranularity === "line") {
      return (currentPage.lines && currentPage.lines.length > 0)
        ? currentPage.lines
        : currentPage.items;
    }
    return currentPage.items;
  }, [currentPage, editGranularity]);

  // 当前页上应用的 patches
  const currentPagePatches = useMemo(() => {
    return patches.filter((p) => p.pageIndex === currentPageIndex);
  }, [patches, currentPageIndex]);

  // 全局搜索匹配项
  const searchMatches = useMemo(() => {
    if (!inspectResult || !searchQuery.trim()) return [];
    const query = searchQuery.trim().toLowerCase();
    const matches: { pageIndex: number; pageNumber: number; item: PdfInspectItem }[] = [];

    inspectResult.pages.forEach((page) => {
      const list = page.lines && page.lines.length > 0 ? page.lines : page.items;
      list.forEach((item) => {
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

  // 1. 点击任意文本块，直接在页面原地激活编辑
  const handleStartInplaceEdit = (target: PdfInspectItem) => {
    if (editGranularity === "draw") return;
    setActiveEditingItem({
      id: target.id,
      originalText: target.str,
      newText: target.str,
      x: target.x,
      y: target.y,
      width: target.width,
      height: target.height,
      leftPercent: target.leftPercent,
      topPercent: target.topPercent,
      widthPercent: target.widthPercent,
      heightPercent: target.heightPercent,
      fontFamily: target.fontFamily || "times",
      displayFamily: target.displayFamily || target.detectedFont || "Times New Roman",
      isBold: Boolean(target.isBold),
      isItalic: Boolean(target.isItalic),
      detectedFont: target.displayFamily || target.detectedFont || "Times New Roman",
      fontSize: target.fontSize || 12,
      colorHex: "#000000",
      bgHex: "#FFFFFF",
      autoFit: true,
    });
  };

  // 2. 点击已存在的 Patch，原地重新编辑
  const handleEditExistingPatch = (patch: PdfTextPatch) => {
    setActiveEditingItem({
      id: patch.id,
      isExistingPatch: true,
      patchId: patch.id,
      originalText: patch.originalText || "",
      newText: patch.newText,
      x: patch.x,
      y: patch.y,
      width: patch.width,
      height: patch.height,
      leftPercent: patch.leftPercent ?? 0,
      topPercent: patch.topPercent ?? 0,
      widthPercent: patch.widthPercent ?? 10,
      heightPercent: patch.heightPercent ?? 3,
      fontFamily: (patch.fontFamily as any) || "times",
      displayFamily: patch.displayFamily || patch.detectedFont || "Times New Roman",
      isBold: Boolean(patch.isBold),
      isItalic: Boolean(patch.isItalic),
      detectedFont: patch.displayFamily || patch.detectedFont || "Times New Roman",
      fontSize: patch.fontSize || 12,
      colorHex: patch.colorHex || "#000000",
      bgHex: patch.bgHex || "#FFFFFF",
      autoFit: patch.autoFit !== false,
    });
  };

  // 3. 提交并保存原地编辑项
  const handleCommitInplaceEdit = () => {
    if (!activeEditingItem || !currentPage) return;

    const newPatch: PdfTextPatch = {
      id: activeEditingItem.patchId || `patch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      pageIndex: currentPage.pageIndex,
      x: activeEditingItem.x ?? 0,
      y: activeEditingItem.y ?? 0,
      width: activeEditingItem.width ?? 0,
      height: activeEditingItem.height ?? 0,
      leftPercent: activeEditingItem.leftPercent,
      topPercent: activeEditingItem.topPercent,
      widthPercent: activeEditingItem.widthPercent,
      heightPercent: activeEditingItem.heightPercent,
      originalText: activeEditingItem.originalText,
      newText: activeEditingItem.newText,
      fontFamily: activeEditingItem.fontFamily,
      displayFamily: activeEditingItem.displayFamily,
      isBold: activeEditingItem.isBold,
      isItalic: activeEditingItem.isItalic,
      detectedFont: activeEditingItem.detectedFont,
      fontSize: activeEditingItem.fontSize,
      colorHex: activeEditingItem.colorHex,
      bgHex: activeEditingItem.bgHex,
      autoFit: activeEditingItem.autoFit,
    };

    setPatches((prev) => {
      // 移除原有的同位置或同 ID patch 并写入更新
      const filtered = prev.filter((p) => p.id !== newPatch.id);
      return [...filtered, newPatch];
    });

    setActiveEditingItem(null);
  };

  // 4. 取消原地编辑
  const handleCancelInplaceEdit = () => {
    setActiveEditingItem(null);
  };

  // 5. 删除当前正在编辑的 Patch
  const handleDeleteCurrentEditingPatch = () => {
    if (activeEditingItem && activeEditingItem.patchId) {
      setPatches((prev) => prev.filter((p) => p.id !== activeEditingItem.patchId));
    }
    setActiveEditingItem(null);
  };

  // 6. 自由画框事件处理 (Draw Mode)
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (editGranularity !== "draw" || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const xPct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const yPct = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    setIsDrawing(true);
    setDrawStart({ xPct, yPct });
    setDrawCurrent({ xPct, yPct });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const xPct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const yPct = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    setDrawCurrent({ xPct, yPct });
  };

  const handleCanvasMouseUp = () => {
    if (!isDrawing || !drawStart || !drawCurrent) {
      setIsDrawing(false);
      return;
    }
    setIsDrawing(false);

    const minX = Math.min(drawStart.xPct, drawCurrent.xPct);
    const maxX = Math.max(drawStart.xPct, drawCurrent.xPct);
    const minY = Math.min(drawStart.yPct, drawCurrent.yPct);
    const maxY = Math.max(drawStart.yPct, drawCurrent.yPct);
    const widthPct = maxX - minX;
    const heightPct = maxY - minY;

    setDrawStart(null);
    setDrawCurrent(null);

    // 只有拖拽尺寸大于 1% 时才生成画框
    if (widthPct > 1 && heightPct > 0.5) {
      setActiveEditingItem({
        id: `draw_${Date.now()}`,
        originalText: "（自由框选区域）",
        newText: "",
        leftPercent: Math.round(minX * 100) / 100,
        topPercent: Math.round(minY * 100) / 100,
        widthPercent: Math.round(widthPct * 100) / 100,
        heightPercent: Math.round(heightPct * 100) / 100,
        fontFamily: "times",
        displayFamily: "Times New Roman",
        isBold: false,
        isItalic: false,
        fontSize: Math.max(10, Math.round((heightPct / 100) * 800 * 0.7)),
        colorHex: "#000000",
        bgHex: "#FFFFFF",
        autoFit: true,
      });
      // 画框完成后自动恢复为整行模式
      setEditGranularity("line");
    }
  };

  // 一键替换所有搜索匹配项
  const handleApplyAllSearchMatches = () => {
    if (searchMatches.length === 0) return;

    const newPatches: PdfTextPatch[] = searchMatches.map((m) => {
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
        leftPercent: m.item.leftPercent,
        topPercent: m.item.topPercent,
        widthPercent: m.item.widthPercent,
        heightPercent: m.item.heightPercent,
        originalText: m.item.str,
        newText: modifiedStr,
        fontFamily: (m.item.fontFamily as any) || searchFontFamily,
        isBold: m.item.isBold,
        isItalic: m.item.isItalic,
        detectedFont: m.item.detectedFont,
        fontSize: m.item.fontSize,
        colorHex: searchTextColor,
        bgHex: searchBgColor,
        autoFit: true,
      };
    });

    setPatches((prev) => {
      const existing = [...prev];
      for (const np of newPatches) {
        const idx = existing.findIndex(
          (p) =>
            p.pageIndex === np.pageIndex &&
            Math.abs((p.leftPercent ?? 0) - (np.leftPercent ?? 0)) < 1 &&
            Math.abs((p.topPercent ?? 0) - (np.topPercent ?? 0)) < 1
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
    setSidePanelMode("patches");
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
    setActiveEditingItem(null);
    setExportSuccess(null);
    setInspectError(null);
    onFileClear?.();
  };

  // 初始空态
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
                  {lang === "en" ? "P0 Word-Like Visual Studio" : "所见即所得 · 像Word一样改"}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[#7D6B5D] dark:text-[#BCA89B]">
                {lang === "en"
                  ? "Click anywhere on the document to edit text in-place. Preserves 100% vectors, stamps, and layout."
                  : "直接在文档画面上点击或整行打字修改，无需转 Word，100% 保持原矢量排版与印章！"}
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
              <MousePointer className="w-4 h-4" />
              <span>{lang === "en" ? "Direct In-Place Editing" : "原地直接点击输入"}</span>
            </div>
            <p className="text-xs text-[#7D6B5D] dark:text-[#BCA89B]">
              {lang === "en"
                ? "Click any sentence or word directly on the page to trigger an inline editor like Word."
                : "点击页面文字直接激活原地输入框，支持整行编辑与单字微调，所见即所得。"}
            </p>
          </div>
          <div className="p-4 rounded-xl border border-[#D2BCAB]/30 dark:border-[#4D392E]/40 bg-white/40 dark:bg-[#201815]/40 space-y-1.5">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold text-xs sm:text-sm">
              <Search className="w-4 h-4" />
              <span>{lang === "en" ? "Global Search & Replace" : "全文搜索定位与批量替换"}</span>
            </div>
            <p className="text-xs text-[#7D6B5D] dark:text-[#BCA89B]">
              {lang === "en"
                ? "Batch replace keywords like dates, names, or amounts across all pages."
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
                : "自适应排版算法动态微调字号字距，修改更长文字也不会溢出破坏邻近布局。"}
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
            {lang === "en" ? "Analyzing PDF Vector & Typography..." : "正在反编译版面矢量与高精度文字排版..."}
          </h4>
          <p className="text-xs text-[#7D6B5D] dark:text-[#BCA89B]">
            {`正在以像素级精度解析《${file.name}》各页字符流与自然文本行...`}
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

  return (
    <div
      className={
        isFullscreen
          ? "fixed inset-0 z-[9999] w-screen h-screen bg-[#FDFCFB] dark:bg-[#150F0D] p-3 sm:p-5 flex flex-col overflow-hidden shadow-2xl"
          : "space-y-4"
      }
    >
      {/* 顶部控制栏 */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-[#D2BCAB]/30 dark:border-[#4D392E]/40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
            <Edit3 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm sm:text-base text-[#2D221E] dark:text-[#F5EBE6] truncate max-w-[260px] sm:max-w-[360px]">
                {file.name}
              </h3>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#D2BCAB]/25 dark:bg-[#4D392E]/30 text-[#7D6B5D] dark:text-[#BCA89B]">
                {formatBytes(file.size)}
              </span>
            </div>
            <p className="text-xs text-[#7D6B5D] dark:text-[#BCA89B]">
              {lang === "en"
                ? `Total ${inspectResult?.numPages || 1} pages | ${patches.length} pending patches`
                : `共 ${inspectResult?.numPages || 1} 页 | 当前已暂存 ${patches.length} 处修正`}
            </p>
          </div>
        </div>

        {/* 顶部工具栏：粒度切换 + 翻页 + 缩放 */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* 编辑粒度切换器：默认单字精修，绝不连带整句 */}
          <div className="flex items-center bg-[#D2BCAB]/20 dark:bg-[#4D392E]/30 p-1 rounded-xl">
            <button
              onClick={() => {
                setEditGranularity("word");
                setActiveEditingItem(null);
              }}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                editGranularity === "word"
                  ? "bg-white dark:bg-[#2D221E] text-amber-600 dark:text-amber-400 shadow-sm"
                  : "text-[#7D6B5D] dark:text-[#BCA89B] hover:text-[#2D221E]"
              }`}
              title="单字/单个词汇独立修改 (修改或加粗单字绝不波及整句)"
            >
              <Type className="w-3.5 h-3.5" />
              <span>单字精修 (默认)</span>
            </button>
            <button
              onClick={() => {
                setEditGranularity("line");
                setActiveEditingItem(null);
              }}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                editGranularity === "line"
                  ? "bg-white dark:bg-[#2D221E] text-amber-600 dark:text-amber-400 shadow-sm"
                  : "text-[#7D6B5D] dark:text-[#BCA89B] hover:text-[#2D221E]"
              }`}
              title="整行或完整句子同时编辑"
            >
              <AlignLeft className="w-3.5 h-3.5" />
              <span>整行编辑</span>
            </button>
            <button
              onClick={() => {
                setEditGranularity("draw");
                setActiveEditingItem(null);
              }}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                editGranularity === "draw"
                  ? "bg-amber-600 text-white shadow-sm"
                  : "text-[#7D6B5D] dark:text-[#BCA89B] hover:text-[#2D221E]"
              }`}
              title="自由画框涂抹编辑"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>自由画框</span>
            </button>
          </div>

          {/* 翻页器 */}
          {inspectResult && inspectResult.numPages > 1 && (
            <div className="flex items-center gap-1 bg-[#D2BCAB]/20 dark:bg-[#4D392E]/30 p-1 rounded-xl">
              <button
                disabled={currentPageIndex <= 0}
                onClick={() => {
                  setActiveEditingItem(null);
                  setCurrentPageIndex((p) => Math.max(0, p - 1));
                }}
                className="p-1 rounded-lg hover:bg-white dark:hover:bg-[#2D221E] disabled:opacity-40 transition-colors"
                title="上一页"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs px-2 font-mono font-semibold">
                {currentPageIndex + 1} / {inspectResult.numPages}
              </span>
              <button
                disabled={currentPageIndex >= inspectResult.numPages - 1}
                onClick={() => {
                  setActiveEditingItem(null);
                  setCurrentPageIndex((p) => Math.min(inspectResult.numPages - 1, p + 1));
                }}
                className="p-1 rounded-lg hover:bg-white dark:hover:bg-[#2D221E] disabled:opacity-40 transition-colors"
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
              className="p-1 rounded-lg hover:bg-white dark:hover:bg-[#2D221E] transition-colors"
              title="缩小"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono px-1.5">{Math.round(zoomScale * 100)}%</span>
            <button
              onClick={() => setZoomScale((s) => Math.min(2.0, s + 0.15))}
              className="p-1 rounded-lg hover:bg-white dark:hover:bg-[#2D221E] transition-colors"
              title="放大"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 全屏模式切换器 */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
              isFullscreen
                ? "bg-amber-500 text-white border-amber-600 shadow-sm"
                : "bg-white/80 dark:bg-[#2D221E] border-[#D2BCAB]/40 dark:border-[#4D392E]/60 text-[#2D221E] dark:text-[#F5EBE6] hover:bg-amber-50 dark:hover:bg-amber-950/20"
            }`}
            title={isFullscreen ? "退出全屏工作台 (Esc)" : "进入全屏工作台模式，享受更大视野与精细编辑"}
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5 text-white" />
                <span>退出全屏</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>全屏编辑</span>
              </>
            )}
          </button>

          <button
            onClick={handleReset}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold border border-[#D2BCAB]/40 dark:border-[#4D392E]/50 hover:bg-[#D2BCAB]/15 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>换文档</span>
          </button>
        </div>
      </div>

      {/* 导出成功与失败提示 */}
      {exportSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <div className="text-xs sm:text-sm">
              <span className="font-bold">局部文字修正完成并已自动下载！</span>
              <span className="block opacity-80">{exportSuccess.filename}</span>
            </div>
          </div>
          <button
            onClick={() => downloadBlob(exportSuccess.blob, exportSuccess.filename)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>再次下载</span>
          </button>
        </div>
      )}

      {exportError && (
        <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center gap-2.5 text-xs text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{exportError}</span>
        </div>
      )}

      {/* 主工作区 */}
      <div className={`grid grid-cols-1 lg:grid-cols-12 gap-5 items-start ${isFullscreen ? "flex-1 min-h-0 overflow-hidden" : ""}`}>
        {/* 左侧/中间：高精度所见即所得 PDF 交互画板 */}
        <div className={`lg:col-span-8 flex flex-col items-center ${isFullscreen ? "h-full overflow-hidden" : ""}`}>
          <div
            ref={canvasRef}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            className={`w-full bg-[#1A1412]/5 dark:bg-[#0F0B0A]/40 rounded-2xl p-4 sm:p-6 overflow-auto flex justify-center border border-[#D2BCAB]/20 dark:border-[#4D392E]/30 relative shadow-inner select-none ${
              isFullscreen ? "h-full max-h-none" : "max-h-[760px]"
            } ${editGranularity === "draw" ? "cursor-crosshair" : "cursor-default"}`}
          >
            {currentPage ? (() => {
              const baseWidth = Math.min(currentPage.viewWidth, 750);
              const canvasWidth = baseWidth * zoomScale;
              const canvasHeight = canvasWidth * (currentPage.height / currentPage.width);

              return (
              <div
                className="relative shadow-2xl transition-all duration-100 bg-white flex-shrink-0"
                style={{
                  width: `${canvasWidth}px`,
                  height: `${canvasHeight}px`,
                  aspectRatio: `${currentPage.width} / ${currentPage.height}`,
                }}
              >
                {/* 1. 底层高保真光栅渲染图 (按原生比例锁定，绝对禁止变形拉伸) */}
                <img
                  src={currentPage.image}
                  alt={`Page ${currentPage.pageNumber}`}
                  className="w-full h-full block pointer-events-none select-none"
                  style={{
                    aspectRatio: `${currentPage.width} / ${currentPage.height}`,
                    objectFit: "contain",
                  }}
                />

                {/* 2. 交互式文字探测层 (Hover & Click to Edit) */}
                {selectableTargets.map((target) => {
                  const isCurrentEditing = activeEditingItem?.id === target.id;
                  const isMatch =
                    searchQuery.trim().length > 0 &&
                    target.str.toLowerCase().includes(searchQuery.trim().toLowerCase());

                  if (isCurrentEditing) return null;

                  return (
                    <div
                      key={target.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartInplaceEdit(target);
                      }}
                      title={`点击原地修改此段文字: "${target.str}"${target.detectedFont ? ` (字体: ${target.detectedFont})` : ""}`}
                      className={`absolute cursor-text transition-all duration-100 rounded-[2px] ${
                        isMatch
                          ? "bg-indigo-500/35 border-2 border-indigo-600 z-20 animate-pulse"
                          : "hover:bg-blue-500/15 hover:border hover:border-blue-500/60 z-10"
                      }`}
                      style={{
                        left: `${target.leftPercent}%`,
                        top: `${target.topPercent}%`,
                        width: `${target.widthPercent}%`,
                        height: `${target.heightPercent}%`,
                      }}
                    />
                  );
                })}

                {/* 3. 已生效的 Patches 实时渲染层 (绝对不截断，完整展示实际更改) */}
                {currentPagePatches.map((patch) => {
                  const isBeingEdited = activeEditingItem?.patchId === patch.id;
                  if (isBeingEdited) return null;

                  return (
                    <div
                      key={patch.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditExistingPatch(patch);
                      }}
                      title={`点击重新编辑: "${patch.newText}"`}
                      className="absolute z-25 cursor-pointer flex items-center px-1 group hover:ring-2 hover:ring-amber-500 rounded-[2px]"
                      style={{
                        left: `${patch.leftPercent}%`,
                        top: `${patch.topPercent}%`,
                        minWidth: `${patch.widthPercent}%`,
                        width: "max-content",
                        maxWidth: `${Math.min(100 - (patch.leftPercent ?? 0), 96)}%`,
                        height: `${patch.heightPercent}%`,
                        backgroundColor: patch.bgHex || "#FFFFFF",
                        border: "1px dashed #F59E0B",
                      }}
                    >
                      <span
                        className="whitespace-nowrap leading-none select-none font-medium"
                        style={{
                          fontFamily: getFontFamilyCss(patch.fontFamily),
                          fontWeight: patch.isBold ? "bold" : "normal",
                          fontStyle: patch.isItalic ? "italic" : "normal",
                          color: patch.colorHex || "#000000",
                          fontSize: `${Math.max(9, (patch.fontSize || 12) * (canvasWidth / currentPage.width) * 0.95)}px`,
                        }}
                      >
                        {patch.newText || "（已涂白擦除）"}
                      </span>
                    </div>
                  );
                })}

                {/* 4. 原地直接编辑层 (Direct In-place Visual Editor - 像 Word 这样改，随输入动态扩展) */}
                {activeEditingItem && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute z-50 flex flex-col items-start"
                    style={{
                      left: `${activeEditingItem.leftPercent}%`,
                      top: `${activeEditingItem.topPercent}%`,
                      minWidth: `${Math.max(12, activeEditingItem.widthPercent)}%`,
                      width: "max-content",
                      maxWidth: `${Math.min(100 - (activeEditingItem.leftPercent ?? 0), 96)}%`,
                    }}
                  >
                    {/* 浮动微型排版工具栏 (Floating Mini Toolbar) */}
                    <div
                      className="absolute -top-11 left-0 flex items-center gap-1.5 p-1 bg-[#1A1412] text-white rounded-xl shadow-2xl border border-white/20 text-xs whitespace-nowrap z-50 animate-in fade-in zoom-in-95 duration-100"
                      style={{ transform: "translateY(-4px)" }}
                    >
                      {/* 原版字体自动匹配提示 */}
                      <div
                        className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 font-mono text-[11px] border border-amber-500/30"
                        title={`已自动匹配原版排版: ${activeEditingItem.displayFamily || activeEditingItem.detectedFont || "Times New Roman"} · ${activeEditingItem.fontSize}pt ${activeEditingItem.isBold ? "· 粗体" : ""} ${activeEditingItem.isItalic ? "· 斜体" : ""}`}
                      >
                        <span className="text-[10px] text-amber-400">✨ 自动匹配:</span>
                        <span className="font-bold text-white max-w-[120px] truncate">
                          {activeEditingItem.displayFamily || activeEditingItem.detectedFont || "Times New Roman"}
                        </span>
                        <span className="text-amber-200">· {activeEditingItem.fontSize}pt</span>
                        {activeEditingItem.isBold && <span className="font-bold text-amber-400 text-[10px]">B</span>}
                        {activeEditingItem.isItalic && <span className="italic text-amber-400 text-[10px]">I</span>}
                      </div>

                      {/* 字体选择 */}
                      <select
                        value={activeEditingItem.fontFamily}
                        onChange={(e: any) => {
                          const val = e.target.value;
                          const selected = DOCUMENT_FONTS.find((f) => f.value === val);
                          setActiveEditingItem((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  fontFamily: val,
                                  displayFamily: selected ? selected.label.split(" ")[0] : prev.displayFamily,
                                }
                              : null
                          );
                        }}
                        className="bg-[#2D221E] text-white px-2 py-0.5 rounded-lg text-[11px] border border-white/10 focus:outline-none"
                      >
                        {DOCUMENT_FONTS.map((f) => (
                          <option key={f.value} value={f.value}>
                            {f.label}
                          </option>
                        ))}
                      </select>

                      {/* 粗体与斜体开关 */}
                      <div className="flex items-center gap-0.5 bg-[#2D221E] p-0.5 rounded-lg">
                        <button
                          type="button"
                          onClick={() =>
                            setActiveEditingItem((prev) =>
                              prev ? { ...prev, isBold: !prev.isBold } : null
                            )
                          }
                          className={`w-5 h-5 flex items-center justify-center rounded font-bold text-xs transition-colors ${
                            activeEditingItem.isBold ? "bg-amber-500 text-black shadow-sm" : "text-white/70 hover:text-white"
                          }`}
                          title="切换粗体 (Bold)"
                        >
                          B
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setActiveEditingItem((prev) =>
                              prev ? { ...prev, isItalic: !prev.isItalic } : null
                            )
                          }
                          className={`w-5 h-5 flex items-center justify-center rounded italic font-serif text-xs transition-colors ${
                            activeEditingItem.isItalic ? "bg-amber-500 text-black shadow-sm" : "text-white/70 hover:text-white"
                          }`}
                          title="切换斜体 (Italic)"
                        >
                          I
                        </button>
                      </div>

                      {/* 字号加减 */}
                      <div className="flex items-center gap-0.5 bg-[#2D221E] px-1 py-0.5 rounded-lg">
                        <button
                          onClick={() =>
                            setActiveEditingItem((prev) =>
                              prev ? { ...prev, fontSize: Math.max(8, prev.fontSize - 1) } : null
                            )
                          }
                          className="hover:text-amber-400 p-0.5"
                          title="减小字号"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-[11px] font-mono px-1">
                          {activeEditingItem.fontSize}pt
                        </span>
                        <button
                          onClick={() =>
                            setActiveEditingItem((prev) =>
                              prev ? { ...prev, fontSize: Math.min(72, prev.fontSize + 1) } : null
                            )
                          }
                          className="hover:text-amber-400 p-0.5"
                          title="增大字号"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* 快捷颜色块 (解决蓝标题/红章/黑正文字色不匹配) */}
                      <div className="flex items-center gap-1 px-1">
                        {[
                          { color: "#000000", title: "经典黑" },
                          { color: "#1E3A8A", title: "商务深蓝" },
                          { color: "#DC2626", title: "醒目红" },
                          { color: "#4B5563", title: "深灰" },
                        ].map((c) => (
                          <button
                            key={c.color}
                            onClick={() =>
                              setActiveEditingItem((prev) =>
                                prev ? { ...prev, colorHex: c.color } : null
                              )
                            }
                            title={c.title}
                            className={`w-4 h-4 rounded-full border border-white/40 transition-transform ${
                              activeEditingItem.colorHex === c.color ? "scale-125 ring-2 ring-white" : ""
                            }`}
                            style={{ backgroundColor: c.color }}
                          />
                        ))}
                        <input
                          type="color"
                          value={activeEditingItem.colorHex}
                          onChange={(e) =>
                            setActiveEditingItem((prev) =>
                              prev ? { ...prev, colorHex: e.target.value } : null
                            )
                          }
                          className="w-4 h-4 rounded cursor-pointer border-none bg-transparent"
                          title="自定义文字颜色"
                        />
                      </div>

                      {/* 确认 / 放弃 / 删除 */}
                      <button
                        onClick={handleCommitInplaceEdit}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition-colors"
                        title="完成并暂存修正 (Enter)"
                      >
                        <Check className="w-3 h-3" />
                        <span>确定</span>
                      </button>
                      {activeEditingItem.isExistingPatch && (
                        <button
                          onClick={handleDeleteCurrentEditingPatch}
                          className="p-1 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
                          title="删除此修补项"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                      <button
                        onClick={handleCancelInplaceEdit}
                        className="p-1 rounded-lg hover:bg-white/20 text-white/70 transition-colors"
                        title="取消 (Esc)"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>

                    {/* 原地真实文本输入框 (Direct In-place Input - 真实字形渲染) */}
                    <div
                      className="w-full relative shadow-lg rounded-[2px]"
                      style={{
                        backgroundColor: activeEditingItem.bgHex || "#FFFFFF",
                        minHeight: "100%",
                      }}
                    >
                      <input
                        autoFocus
                        type="text"
                        value={activeEditingItem.newText}
                        onChange={(e) =>
                          setActiveEditingItem((prev) =>
                            prev ? { ...prev, newText: e.target.value } : null
                          )
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleCommitInplaceEdit();
                          } else if (e.key === "Escape") {
                            handleCancelInplaceEdit();
                          }
                        }}
                        className="w-full px-1 py-0.5 bg-transparent border-2 border-amber-500 rounded-[2px] focus:outline-none"
                        style={{
                          fontFamily: getFontFamilyCss(activeEditingItem.fontFamily),
                          fontWeight: activeEditingItem.isBold ? "bold" : "normal",
                          fontStyle: activeEditingItem.isItalic ? "italic" : "normal",
                          color: activeEditingItem.colorHex || "#000000",
                          fontSize: `${Math.max(10, activeEditingItem.fontSize * (canvasWidth / currentPage.width) * 0.95)}px`,
                          lineHeight: 1.2,
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* 5. 正在自由画框的选区预览 */}
                {isDrawing && drawStart && drawCurrent && (
                  <div
                    className="absolute z-40 border-2 border-dashed border-amber-600 bg-amber-500/20 pointer-events-none"
                    style={{
                      left: `${Math.min(drawStart.xPct, drawCurrent.xPct)}%`,
                      top: `${Math.min(drawStart.yPct, drawCurrent.yPct)}%`,
                      width: `${Math.abs(drawCurrent.xPct - drawStart.xPct)}%`,
                      height: `${Math.abs(drawCurrent.yPct - drawStart.yPct)}%`,
                    }}
                  />
                )}
              </div>
              );
            })() : null}          </div>

          <div className="mt-2.5 flex items-center justify-between w-full text-xs text-[#7D6B5D] dark:text-[#BCA89B] px-1">
            <div className="flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-amber-500" />
              <span>
                {editGranularity === "draw"
                  ? "画框模式：在画板上按住鼠标左键拖拽任意矩形，释放即可直接原位打字涂改。"
                  : "Word 模式：点击任意文字即可原地激活打字输入框，回车即可完成修改。"}
              </span>
            </div>
            <span className="text-[11px] opacity-75">
              提示：点击已修改的黄色虚线框可二次修改
            </span>
          </div>
        </div>

        {/* 右侧：全文搜索替换与待修补清单 */}
        <div className={`lg:col-span-4 space-y-4 ${isFullscreen ? "h-full overflow-y-auto pr-1" : ""}`}>
          {/* 右侧面板选项卡 */}
          <div className="flex bg-[#D2BCAB]/20 dark:bg-[#4D392E]/30 p-1 rounded-2xl">
            <button
              onClick={() => setSidePanelMode("patches")}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                sidePanelMode === "patches"
                  ? "bg-white dark:bg-[#2D221E] text-amber-600 dark:text-amber-400 shadow-sm"
                  : "text-[#7D6B5D] dark:text-[#BCA89B] hover:text-[#2D221E]"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>修改清单 ({patches.length})</span>
            </button>
            <button
              onClick={() => setSidePanelMode("search")}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                sidePanelMode === "search"
                  ? "bg-white dark:bg-[#2D221E] text-amber-600 dark:text-amber-400 shadow-sm"
                  : "text-[#7D6B5D] dark:text-[#BCA89B] hover:text-[#2D221E]"
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>全文搜索替换</span>
            </button>
          </div>

          {/* 模式一：待应用修改清单与最终导出 */}
          {sidePanelMode === "patches" && (
            <div className="coconut-panel p-4 sm:p-5 space-y-4 border border-[#D2BCAB]/30 dark:border-[#4D392E]/40">
              <div className="flex items-center justify-between pb-2 border-b border-[#D2BCAB]/20 dark:border-[#4D392E]/30">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-xs sm:text-sm text-[#2D221E] dark:text-[#F5EBE6]">
                    待生效修改项目
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-600">
                    {patches.length} 处
                  </span>
                </div>
                {patches.length > 0 && (
                  <button
                    onClick={() => setPatches([])}
                    className="text-[11px] text-red-500 hover:text-red-700 transition-colors flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>全部清空</span>
                  </button>
                )}
              </div>

              {patches.length === 0 ? (
                <div className="py-12 text-center space-y-2 text-[#7D6B5D]/70 dark:text-[#BCA89B]/60">
                  <Edit3 className="w-8 h-8 mx-auto opacity-30 text-amber-500" />
                  <p className="text-xs">
                    暂无待应用的修改项
                    <span className="block text-[11px] opacity-75 mt-1">
                      在左侧文档画面中直接点击文字开始修改
                    </span>
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {patches.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => handleEditExistingPatch(p)}
                      className="p-2.5 rounded-xl bg-white/70 dark:bg-[#201815]/70 border border-[#D2BCAB]/30 dark:border-[#4D392E]/40 hover:border-amber-500/60 cursor-pointer flex items-center justify-between gap-2 text-xs transition-colors"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-600">
                            第 {p.pageIndex + 1} 页
                          </span>
                          <span className="truncate line-through opacity-50 text-[11px]">
                            {p.originalText}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold truncate">
                          <CornerDownRight className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{p.newText || "（已涂白擦除）"}</span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPatches((prev) => prev.filter((it) => it.id !== p.id));
                        }}
                        className="p-1 rounded-lg hover:bg-red-500/10 text-red-500 transition-colors flex-shrink-0"
                        title="删除此项"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* 导出按钮 */}
              <button
                disabled={patches.length === 0 || applying}
                onClick={handleExportFixedPdf}
                className="w-full py-3 rounded-xl text-xs sm:text-sm font-bold bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 disabled:opacity-40 text-white transition-all shadow-md shadow-orange-600/25 flex items-center justify-center gap-2"
              >
                {applying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>正在原版高保真重绘导出...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>
                      {patches.length === 0
                        ? "请先在页面上修改文字"
                        : `🚀 确认应用并导出 PDF (${patches.length} 处修正)`}
                    </span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* 模式二：全文批量搜索替换 */}
          {sidePanelMode === "search" && (
            <div className="coconut-panel p-4 sm:p-5 space-y-4 border border-[#D2BCAB]/30 dark:border-[#4D392E]/40">
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#2D221E] dark:text-[#F5EBE6]">
                  查找原文字
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="例如：2025年 或 旧公司名称"
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
                  批量替换为
                </label>
                <input
                  type="text"
                  value={replaceText}
                  onChange={(e) => setReplaceText(e.target.value)}
                  placeholder="例如：2026年 或 新公司名称"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-[#201815] border border-[#D2BCAB]/40 dark:border-[#4D392E]/60 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-[#7D6B5D] dark:text-[#BCA89B]">
                    字体风格
                  </label>
                  <select
                    value={searchFontFamily}
                    onChange={(e: any) => setSearchFontFamily(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs rounded-xl bg-white dark:bg-[#201815] border border-[#D2BCAB]/40 dark:border-[#4D392E]/60 focus:outline-none"
                  >
                    {DOCUMENT_FONTS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-[#7D6B5D] dark:text-[#BCA89B]">
                    文字颜色
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
                <span>一键批量替换 ({searchMatches.length} 处匹配)</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
