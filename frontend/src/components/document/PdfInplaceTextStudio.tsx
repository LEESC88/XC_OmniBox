"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
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
  Highlighter,
  Undo2,
  Redo2,
  ArrowUp,
  ArrowDown,
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

export const HIGHLIGHT_COLORS = [
  { value: "#FFD600", label: "经典荧光黄", bgClass: "bg-[#FFD600]" },
  { value: "#00E676", label: "鲜艳荧光绿", bgClass: "bg-[#00E676]" },
  { value: "#00B0FF", label: "亮丽荧光蓝", bgClass: "bg-[#00B0FF]" },
  { value: "#FF2D70", label: "荧光玫粉", bgClass: "bg-[#FF2D70]" },
  { value: "#FF6D00", label: "鲜亮暖橙", bgClass: "bg-[#FF6D00]" },
  { value: "#A855F7", label: "荧光香芋紫", bgClass: "bg-[#A855F7]" },
];

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
  // 编辑粒度：'word' 单字精修 | 'line' 整行编辑 | 'draw' 自由画框 | 'highlight' 荧光高亮笔标注
  const [editGranularity, setEditGranularity] = useState<"word" | "line" | "draw" | "highlight">("word");
  const [currentHighlightColor, setCurrentHighlightColor] = useState<string>("#FFD600");
  // 高亮目标粒度：'word' 单字高亮 | 'line' 整句/单元格高亮
  const [highlightScope, setHighlightScope] = useState<"word" | "line">("word");

  // 待应用修正补丁列表
  const [patches, setPatches] = useState<PdfTextPatch[]>([]);

  // 多级撤销/重做历史栈 (Undo/Redo Stack)
  const [history, setHistory] = useState<PdfTextPatch[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // 磁吸对齐辅助虚线状态
  const [snapLines, setSnapLines] = useState<{ vertical?: number; horizontal?: number } | null>(null);

  // 浮动工具栏智能上下位置自适应
  const [toolbarPlacement, setToolbarPlacement] = useState<"auto" | "above" | "below">("auto");

  // 压入历史栈快照
  const pushHistory = (newPatches: PdfTextPatch[]) => {
    setHistory((prev) => {
      const next = prev.slice(0, historyIndex + 1);
      next.push(newPatches);
      if (next.length > 50) next.shift();
      return next;
    });
    setHistoryIndex((prev) => Math.min(prev + 1, 49));
    setPatches(newPatches);
  };

  // 撤销 (Undo)
  const handleUndo = () => {
    if (historyIndex > 0) {
      const targetIndex = historyIndex - 1;
      setHistoryIndex(targetIndex);
      setPatches(history[targetIndex]);
      setActiveEditingItem(null);
    }
  };

  // 重做 (Redo)
  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const targetIndex = historyIndex + 1;
      setHistoryIndex(targetIndex);
      setPatches(history[targetIndex]);
      setActiveEditingItem(null);
    }
  };

  // 全屏沉浸工作台模式
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleFullscreen = async () => {
    if (!isFullscreen) {
      setIsFullscreen(true);
      try {
        if (document.documentElement && !document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        }
      } catch (_) {}
    } else {
      setIsFullscreen(false);
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        }
      } catch (_) {}
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [isFullscreen]);

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
    isMoved?: boolean;
  } | null>(null);

  const exportRef = useRef<() => void>();

  // 全局快捷键与快捷导航监听 (Esc 退出全屏，Ctrl+Z 撤销，Ctrl+Y 重做，Ctrl+S 快速导出)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen && !activeEditingItem) {
        setIsFullscreen(false);
      }
      const activeTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const isInputFocused = activeTag === "input" || activeTag === "textarea";

      // Ctrl+S / Cmd+S: 快速导出当前修正好的 PDF
      if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        exportRef.current?.();
        return;
      }

      // Ctrl+Z / Cmd+Z: 撤销
      if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z") && !e.shiftKey) {
        if (!isInputFocused) {
          e.preventDefault();
          handleUndo();
        }
      }

      // Ctrl+Y / Cmd+Y / Ctrl+Shift+Z: 重做
      if (
        ((e.ctrlKey || e.metaKey) && (e.key === "y" || e.key === "Y")) ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "z" || e.key === "Z"))
      ) {
        if (!isInputFocused) {
          e.preventDefault();
          handleRedo();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen, activeEditingItem, historyIndex, history]);

  // 当进入原地编辑时，自动平滑滚动至视口中心，避免放大后找不到内容或被裁切
  useEffect(() => {
    if (activeEditingItem && pageRef.current) {
      const timer = setTimeout(() => {
        const inputEl = pageRef.current?.querySelector('input[type="text"]');
        if (inputEl) {
          inputEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [activeEditingItem]);

  // 自由画框拖拽状态 (Drag-to-draw box)
  const canvasRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
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

  // 当前页上可点击的目标集合（依据整行模式、单词模式或高亮模式自动切换）
  const selectableTargets = useMemo(() => {
    if (!currentPage) return [];
    if (editGranularity === "highlight") {
      return highlightScope === "line"
        ? (currentPage.lines && currentPage.lines.length > 0 ? currentPage.lines : currentPage.items)
        : currentPage.items;
    }
    if (editGranularity === "line") {
      return (currentPage.lines && currentPage.lines.length > 0)
        ? currentPage.lines
        : currentPage.items;
    }
    return currentPage.items;
  }, [currentPage, editGranularity, highlightScope]);

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

  // 1. 点击任意文本块，直接在页面原地激活编辑或高亮标注
  const handleStartInplaceEdit = (target: PdfInspectItem) => {
    if (editGranularity === "draw") return;

    // 荧光高亮笔标注模式 (Highlight Mode)：点击文字直接施加深色高亮，自动匹配字号边界；再次点击同色文字可取消
    if (editGranularity === "highlight") {
      const existingIdx = patches.findIndex(
        (p) =>
          p.isHighlight &&
          p.pageIndex === (currentPage?.pageIndex ?? 0) &&
          Math.abs((p.leftPercent ?? 0) - target.leftPercent) < 0.35 &&
          Math.abs((p.topPercent ?? 0) - target.topPercent) < 0.35
      );

      if (existingIdx !== -1) {
        const existing = patches[existingIdx];
        if (existing.bgHex === currentHighlightColor) {
          // 再次点击同色直接取消高亮
          pushHistory(patches.filter((_, idx) => idx !== existingIdx));
        } else {
          // 点击不同颜色则原地更换高亮色
          const updated = [...patches];
          updated[existingIdx] = { ...existing, bgHex: currentHighlightColor };
          pushHistory(updated);
        }
        return;
      }

      const newHighlightPatch: PdfTextPatch = {
        id: `highlight_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        pageIndex: currentPage?.pageIndex ?? 0,
        x: target.x,
        y: target.y,
        width: target.width,
        height: target.height,
        leftPercent: target.leftPercent,
        topPercent: target.topPercent,
        widthPercent: target.widthPercent,
        heightPercent: target.heightPercent,
        originalText: target.str,
        newText: "",
        colorHex: "transparent",
        bgHex: currentHighlightColor,
        isHighlight: true,
      };
      pushHistory([...patches, newHighlightPatch]);
      return;
    }

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
      isMoved: Boolean(patch.isMoved),
    });
  };

  // 3. 提交并保存原地编辑项
  const handleCommitInplaceEdit = () => {
    if (!activeEditingItem || !currentPage) return;

    const isDrawnOrMoved =
      !activeEditingItem.x ||
      !activeEditingItem.y ||
      activeEditingItem.id.startsWith("draw_") ||
      Boolean(activeEditingItem.isMoved);

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
      isMoved: isDrawnOrMoved,
    };

    const filtered = patches.filter((p) => p.id !== newPatch.id);
    pushHistory([...filtered, newPatch]);
    setActiveEditingItem(null);
  };

  // 4. 取消原地编辑
  const handleCancelInplaceEdit = () => {
    setActiveEditingItem(null);
  };

  // 5. 删除当前正在编辑的 Patch
  const handleDeleteCurrentEditingPatch = () => {
    if (activeEditingItem && activeEditingItem.patchId) {
      const filtered = patches.filter((p) => p.id !== activeEditingItem.patchId);
      pushHistory(filtered);
    }
    setActiveEditingItem(null);
  };

  // 5.1 直接删除指定 Patch
  const handleDeletePatch = (patchId: string) => {
    const filtered = patches.filter((p) => p.id !== patchId);
    pushHistory(filtered);
    if (activeEditingItem?.patchId === patchId) {
      setActiveEditingItem(null);
    }
  };

  // 5.2 一键去除留白/自适应贴合文字内容 (Fit Text)
  const handleAutoFitPatch = (patch: PdfTextPatch) => {
    if (!currentPage) return;
    const textLen = (patch.newText || "").length || 1;
    const fontPt = patch.fontSize || 12;
    const charWidthPx = fontPt * 0.58;
    const estimatedWidthPx = textLen * charWidthPx + 14;
    const estimatedHeightPx = fontPt * 1.35;
    const fittedWidthPct = Math.min(95, Math.max(2, (estimatedWidthPx / currentPage.width) * 100));
    const fittedHeightPct = Math.min(80, Math.max(1.2, (estimatedHeightPx / currentPage.height) * 100));

    const updated = patches.map((p) =>
      p.id === patch.id
        ? {
            ...p,
            widthPercent: Math.round(fittedWidthPct * 100) / 100,
            heightPercent: Math.round(fittedHeightPct * 100) / 100,
            autoFit: true,
            isMoved: true,
          }
        : p
    );
    pushHistory(updated);
  };

  // 6. 自由画框事件处理 (Draw Mode only - 严禁在画框中混用高亮，高亮统一用文字点选自适应贴合)
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (editGranularity !== "draw" || !pageRef.current) return;
    const rect = pageRef.current.getBoundingClientRect();
    const xPct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const yPct = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    setIsDrawing(true);
    setDrawStart({ xPct, yPct });
    setDrawCurrent({ xPct, yPct });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !pageRef.current) return;
    const rect = pageRef.current.getBoundingClientRect();
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

    if (widthPct > 0.5 && heightPct > 0.5) {
      // 自由画框模式：默认高度紧密贴合字号，防止上下留白过大
      const calculatedFontSize = Math.min(20, Math.max(10, Math.round((heightPct / 100) * (currentPage?.height || 800) * 0.65)));
      const pageH = currentPage?.height || 800;
      // 紧密字号高度百分比 (让框高度与文字紧密贴合，彻底根治上下间距太大)
      const fittedHeightPct = Math.max(1.8, Math.round(((calculatedFontSize * 1.35) / pageH) * 1000) / 10);
      const actualHeightPct = Math.min(heightPct, fittedHeightPct);

      setActiveEditingItem({
        id: `draw_${Date.now()}`,
        originalText: "（自由框选区域）",
        newText: "",
        leftPercent: Math.round(minX * 100) / 100,
        topPercent: Math.round(minY * 100) / 100,
        widthPercent: Math.round(widthPct * 100) / 100,
        heightPercent: Math.round(actualHeightPct * 100) / 100,
        fontFamily: "times",
        displayFamily: "Times New Roman",
        isBold: false,
        isItalic: false,
        fontSize: calculatedFontSize,
        colorHex: "#000000",
        bgHex: "transparent",
        autoFit: true,
      });
      setEditGranularity("line");
    }
  };

  // 7. 拖拽已放置的 Patch 任意调整位置 (带磁吸对齐辅助虚线)
  const handlePatchMouseDown = (e: React.MouseEvent, patch: PdfTextPatch) => {
    if (editGranularity === "highlight" && patch.isHighlight) {
      e.stopPropagation();
      e.preventDefault();
      if (patch.bgHex === currentHighlightColor) {
        handleDeletePatch(patch.id);
      } else {
        const updated = patches.map((p) =>
          p.id === patch.id ? { ...p, bgHex: currentHighlightColor } : p
        );
        pushHistory(updated);
      }
      return;
    }
    if (editGranularity === "draw" || editGranularity === "highlight") return;
    e.stopPropagation();
    e.preventDefault();

    const startX = e.clientX;
    const startY = e.clientY;
    const startLeftPct = patch.leftPercent ?? 0;
    const startTopPct = patch.topPercent ?? 0;
    let hasMoved = false;
    let finalLeft = startLeftPct;
    let finalTop = startTopPct;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!pageRef.current) return;
      const rect = pageRef.current.getBoundingClientRect();
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      if (Math.hypot(deltaX, deltaY) > 3) {
        hasMoved = true;
        const deltaXPct = (deltaX / rect.width) * 100;
        const deltaYPct = (deltaY / rect.height) * 100;

        let candidateLeft = Math.max(0, Math.min(100 - (patch.widthPercent ?? 4), startLeftPct + deltaXPct));
        let candidateTop = Math.max(0, Math.min(100 - (patch.heightPercent ?? 2), startTopPct + deltaYPct));

        // 磁吸阈值与目标检测 (Snap Threshold ~0.8%)
        const snapThreshold = 0.8;
        let snapV: number | undefined = undefined;
        let snapH: number | undefined = undefined;

        const xTargets = [5, 50, 95];
        const yTargets: number[] = [];

        currentPagePatches.forEach((other) => {
          if (other.id !== patch.id) {
            xTargets.push(other.leftPercent ?? 0);
            xTargets.push((other.leftPercent ?? 0) + (other.widthPercent ?? 0));
            yTargets.push(other.topPercent ?? 0);
            yTargets.push((other.topPercent ?? 0) + (other.heightPercent ?? 0));
          }
        });

        for (const targetX of xTargets) {
          if (Math.abs(candidateLeft - targetX) < snapThreshold) {
            candidateLeft = targetX;
            snapV = targetX;
            break;
          }
        }

        for (const targetY of yTargets) {
          if (Math.abs(candidateTop - targetY) < snapThreshold) {
            candidateTop = targetY;
            snapH = targetY;
            break;
          }
        }

        setSnapLines(snapV !== undefined || snapH !== undefined ? { vertical: snapV, horizontal: snapH } : null);

        finalLeft = Math.round(candidateLeft * 100) / 100;
        finalTop = Math.round(candidateTop * 100) / 100;

        setPatches((prev) =>
          prev.map((p) =>
            p.id === patch.id
              ? {
                  ...p,
                  leftPercent: finalLeft,
                  topPercent: finalTop,
                  isMoved: true,
                }
              : p
          )
        );
      }
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      setSnapLines(null);

      if (hasMoved) {
        setPatches((current) => {
          pushHistory(current);
          return current;
        });
      } else {
        handleEditExistingPatch(patch);
      }
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  // 8. 自由多方向独立缩放手柄 (Independent 4-Side & 4-Corner Resizing)
  const handlePatchResizeMouseDown = (
    e: React.MouseEvent,
    patch: PdfTextPatch,
    handle: "n" | "s" | "w" | "e" | "nw" | "ne" | "sw" | "se"
  ) => {
    e.stopPropagation();
    e.preventDefault();
    if (!pageRef.current) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const startLeftPct = patch.leftPercent ?? 0;
    const startTopPct = patch.topPercent ?? 0;
    const startWidthPct = patch.widthPercent ?? 10;
    const startHeightPct = patch.heightPercent ?? 3;
    const startFontSize = patch.fontSize || 12;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!pageRef.current) return;
      const rect = pageRef.current.getBoundingClientRect();
      const deltaXPct = ((moveEvent.clientX - startX) / rect.width) * 100;
      const deltaYPct = ((moveEvent.clientY - startY) / rect.height) * 100;

      let newLeft = startLeftPct;
      let newTop = startTopPct;
      let newWidth = startWidthPct;
      let newHeight = startHeightPct;
      let newFontSize = startFontSize;

      // 左右独立宽度调节
      if (handle === "e" || handle === "se" || handle === "ne") {
        newWidth = Math.max(1.5, Math.min(100 - startLeftPct, startWidthPct + deltaXPct));
      } else if (handle === "w" || handle === "sw" || handle === "nw") {
        const potentialLeft = startLeftPct + deltaXPct;
        const boundedLeft = Math.max(0, Math.min(startLeftPct + startWidthPct - 1.5, potentialLeft));
        newWidth = startWidthPct + (startLeftPct - boundedLeft);
        newLeft = boundedLeft;
      }

      // 上下独立高度调节 (轻松收紧顶部/底部间距，根除上下留白过大)
      if (handle === "s" || handle === "se" || handle === "sw") {
        newHeight = Math.max(1.0, Math.min(100 - startTopPct, startHeightPct + deltaYPct));
      } else if (handle === "n" || handle === "ne" || handle === "nw") {
        const potentialTop = startTopPct + deltaYPct;
        const boundedTop = Math.max(0, Math.min(startTopPct + startHeightPct - 1.0, potentialTop));
        newHeight = startHeightPct + (startTopPct - boundedTop);
        newTop = boundedTop;
      }

      // 四角拖拽联动字号
      if (handle === "se" || handle === "sw" || handle === "ne" || handle === "nw") {
        const scale = newHeight / Math.max(0.5, startHeightPct);
        newFontSize = Math.min(72, Math.max(6, Math.round(startFontSize * scale)));
      }

      setPatches((prev) =>
        prev.map((p) =>
          p.id === patch.id
            ? {
                ...p,
                leftPercent: Math.round(newLeft * 100) / 100,
                topPercent: Math.round(newTop * 100) / 100,
                widthPercent: Math.round(newWidth * 100) / 100,
                heightPercent: Math.round(newHeight * 100) / 100,
                fontSize: newFontSize,
                isMoved: true,
                autoFit: false,
              }
            : p
        )
      );
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      setPatches((current) => {
        pushHistory(current);
        return current;
      });
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
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
        displayFamily: m.item.displayFamily || m.item.detectedFont || "Times New Roman",
        isBold: m.item.isBold,
        isItalic: m.item.isItalic,
        detectedFont: m.item.detectedFont,
        fontSize: m.item.fontSize,
        colorHex: searchTextColor,
        bgHex: searchBgColor,
        autoFit: true,
      };
    });

    const merged = [...patches];
    for (const np of newPatches) {
      const idx = merged.findIndex(
        (p) =>
          p.pageIndex === np.pageIndex &&
          Math.abs((p.leftPercent ?? 0) - (np.leftPercent ?? 0)) < 1 &&
          Math.abs((p.topPercent ?? 0) - (np.topPercent ?? 0)) < 1
      );
      if (idx !== -1) {
        merged[idx] = np;
      } else {
        merged.push(np);
      }
    }
    pushHistory(merged);

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

  exportRef.current = handleExportFixedPdf;

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

  const studioContent = (
    <div
      className={
        isFullscreen
          ? "fixed inset-0 z-[999999] w-screen h-screen bg-[#140F0D] text-[#F5EBE6] p-3 sm:p-5 flex flex-col overflow-hidden shadow-2xl"
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
          {/* 撤销 / 重做按钮组 */}
          <div className="flex items-center bg-[#D2BCAB]/20 dark:bg-[#4D392E]/30 p-1 rounded-xl">
            <button
              type="button"
              disabled={historyIndex <= 0}
              onClick={handleUndo}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-[#2D221E] disabled:opacity-30 transition-colors"
              title="撤销 (Ctrl+Z)"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={historyIndex >= history.length - 1}
              onClick={handleRedo}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-[#2D221E] disabled:opacity-30 transition-colors"
              title="重做 (Ctrl+Y)"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 编辑粒度与高亮标注切换器 */}
          <div className="flex items-center bg-[#D2BCAB]/20 dark:bg-[#4D392E]/30 p-1 rounded-xl gap-0.5">
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
              <span>单字</span>
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
              <span>整行</span>
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
              <span>画框</span>
            </button>
            <button
              onClick={() => {
                setEditGranularity("highlight");
                setActiveEditingItem(null);
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                editGranularity === "highlight"
                  ? "bg-amber-600 text-white shadow-sm"
                  : "text-[#7D6B5D] dark:text-[#BCA89B] hover:text-[#2D221E]"
              }`}
              title="荧光高亮笔标注 (点击任意文字/单元格自动贴合高亮)"
            >
              <Highlighter className="w-3.5 h-3.5" />
              <span>高亮</span>
              <span
                className="w-2.5 h-2.5 rounded-full border border-black/20 shadow-inner flex-shrink-0"
                style={{ backgroundColor: currentHighlightColor }}
              />
            </button>

            {/* 荧光高亮笔调色与单字/整句单元格切换 */}
            {editGranularity === "highlight" && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-black/15 dark:bg-black/40 rounded-lg ml-1">
                <div className="flex items-center gap-1 mr-1 border-r border-white/20 pr-1.5">
                  <button
                    type="button"
                    onClick={() => setHighlightScope("word")}
                    className={`px-1.5 py-0.5 text-[10px] font-bold rounded transition-colors ${
                      highlightScope === "word"
                        ? "bg-amber-500 text-black shadow-sm"
                        : "text-[#7D6B5D] dark:text-[#BCA89B] hover:text-[#2D221E]"
                    }`}
                    title="点击单字高亮"
                  >
                    单字
                  </button>
                  <button
                    type="button"
                    onClick={() => setHighlightScope("line")}
                    className={`px-1.5 py-0.5 text-[10px] font-bold rounded transition-colors ${
                      highlightScope === "line"
                        ? "bg-amber-500 text-black shadow-sm"
                        : "text-[#7D6B5D] dark:text-[#BCA89B] hover:text-[#2D221E]"
                    }`}
                    title="点击整句或表格单元格高亮"
                  >
                    整句/单格
                  </button>
                </div>
                {HIGHLIGHT_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setCurrentHighlightColor(c.value)}
                    className={`w-3.5 h-3.5 rounded-full border transition-transform ${
                      currentHighlightColor === c.value
                        ? "scale-125 border-white ring-2 ring-amber-400 shadow-sm"
                        : "border-black/20 opacity-75 hover:opacity-100"
                    }`}
                    style={{ backgroundColor: c.value }}
                    title={c.label}
                  />
                ))}
              </div>
            )}
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

          {/* 顶部一键导出按钮 */}
          <button
            disabled={applying || patches.length === 0}
            onClick={handleExportFixedPdf}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white transition-all shadow-sm"
            title="应用当前全部补丁并保存下载 PDF"
          >
            {applying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            <span>{applying ? "正在重绘..." : `导出 PDF (${patches.length})`}</span>
          </button>

          {/* 全屏模式切换器 */}
          <button
            onClick={toggleFullscreen}
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
                <span>退出全屏 (Esc)</span>
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
            className={`w-full bg-[#1A1412]/5 dark:bg-[#0F0B0A]/40 rounded-2xl p-4 sm:p-6 overflow-auto border border-[#D2BCAB]/20 dark:border-[#4D392E]/30 relative shadow-inner select-none ${
              isFullscreen ? "h-full max-h-none" : "max-h-[760px]"
            } ${editGranularity === "draw" ? "cursor-crosshair" : editGranularity === "highlight" ? "cursor-pointer" : "cursor-default"}`}
          >
            {currentPage ? (() => {
              const baseWidth = Math.min(currentPage.viewWidth, 750);
              const canvasWidth = baseWidth * zoomScale;
              const canvasHeight = canvasWidth * (currentPage.height / currentPage.width);

              return (
              <div
                ref={pageRef}
                className="relative shadow-2xl transition-all duration-100 bg-white flex-shrink-0 mx-auto"
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

                {/* 1.1 磁吸对齐辅助虚线 */}
                {snapLines && (
                  <>
                    {snapLines.vertical !== undefined && (
                      <div
                        className="absolute top-0 bottom-0 pointer-events-none z-35 border-l border-dashed border-amber-500 shadow-sm"
                        style={{ left: `${snapLines.vertical}%` }}
                      />
                    )}
                    {snapLines.horizontal !== undefined && (
                      <div
                        className="absolute left-0 right-0 pointer-events-none z-35 border-t border-dashed border-amber-500 shadow-sm"
                        style={{ top: `${snapLines.horizontal}%` }}
                      />
                    )}
                  </>
                )}

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
                      title={
                        editGranularity === "highlight"
                          ? `点击为 "${target.str}" 施加荧光高亮 (再次点击同色文字可取消)`
                          : `点击原地修改此段文字: "${target.str}"${target.detectedFont ? ` (字体: ${target.detectedFont})` : ""}`
                      }
                      className={`absolute transition-all duration-100 rounded-[2px] ${
                        isMatch
                          ? "bg-indigo-500/35 border-2 border-indigo-600 z-20 animate-pulse cursor-pointer"
                          : editGranularity === "highlight"
                          ? "hover:ring-2 hover:ring-amber-400 z-10 cursor-pointer"
                          : "hover:bg-blue-500/15 hover:border hover:border-blue-500/60 z-10 cursor-text"
                      }`}
                      style={{
                        left: `${target.leftPercent}%`,
                        top: `${target.topPercent}%`,
                        width: `${target.widthPercent}%`,
                        height: `${target.heightPercent}%`,
                        ...(editGranularity === "highlight"
                          ? { backgroundColor: `${currentHighlightColor}40` }
                          : {}),
                      }}
                    />
                  );
                })}

                {/* 3. 已生效的 Patches 实时渲染层 (支持点击编辑、拖拽移动与8向独立缩放) */}
                {currentPagePatches.map((patch) => {
                  const isBeingEdited = activeEditingItem?.patchId === patch.id;
                  if (isBeingEdited) return null;

                  // 荧光笔高亮标注渲染 (自动贴合字体，深色饱和高亮)
                  if (patch.isHighlight) {
                    return (
                      <div
                        key={patch.id}
                        onMouseDown={(e) => handlePatchMouseDown(e, patch)}
                        title="荧光高亮 (点击可更换颜色或删除，按住可拖动微调)"
                        className="absolute z-20 cursor-pointer group hover:ring-2 hover:ring-amber-500 rounded-[2px] transition-shadow"
                        style={{
                          left: `${patch.leftPercent}%`,
                          top: `${patch.topPercent}%`,
                          width: `${patch.widthPercent}%`,
                          height: `${patch.heightPercent}%`,
                          backgroundColor: patch.bgHex || "#FFD600",
                          opacity: 0.65,
                          mixBlendMode: "multiply",
                        }}
                      >
                        {/* 8方向调整手柄 */}
                        <div
                          onMouseDown={(e) => handlePatchResizeMouseDown(e, patch, "n")}
                          title="向上拉伸/压缩高亮范围"
                          className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-1.5 bg-amber-500 hover:bg-amber-400 border border-white rounded-full cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity z-30"
                        />
                        <div
                          onMouseDown={(e) => handlePatchResizeMouseDown(e, patch, "s")}
                          title="向下拉伸/压缩高亮范围"
                          className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-1.5 bg-amber-500 hover:bg-amber-400 border border-white rounded-full cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity z-30"
                        />
                        <div
                          onMouseDown={(e) => handlePatchResizeMouseDown(e, patch, "w")}
                          title="向左拉伸/压缩高亮范围"
                          className="absolute top-1/2 -translate-y-1/2 -left-1 w-1.5 h-3 bg-amber-500 hover:bg-amber-400 border border-white rounded-full cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity z-30"
                        />
                        <div
                          onMouseDown={(e) => handlePatchResizeMouseDown(e, patch, "e")}
                          title="向右拉伸/压缩高亮范围"
                          className="absolute top-1/2 -translate-y-1/2 -right-1 w-1.5 h-3 bg-amber-500 hover:bg-amber-400 border border-white rounded-full cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity z-30"
                        />
                        <div
                          onMouseDown={(e) => handlePatchResizeMouseDown(e, patch, "nw")}
                          className="absolute -top-1 -left-1 w-2.5 h-2.5 bg-amber-500 hover:bg-amber-400 border border-white rounded-sm cursor-nwse-resize opacity-0 group-hover:opacity-100 z-30"
                        />
                        <div
                          onMouseDown={(e) => handlePatchResizeMouseDown(e, patch, "ne")}
                          className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 hover:bg-amber-400 border border-white rounded-sm cursor-nesw-resize opacity-0 group-hover:opacity-100 z-30"
                        />
                        <div
                          onMouseDown={(e) => handlePatchResizeMouseDown(e, patch, "sw")}
                          className="absolute -bottom-1 -left-1 w-2.5 h-2.5 bg-amber-500 hover:bg-amber-400 border border-white rounded-sm cursor-nesw-resize opacity-0 group-hover:opacity-100 z-30"
                        />
                        <div
                          onMouseDown={(e) => handlePatchResizeMouseDown(e, patch, "se")}
                          className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-amber-500 hover:bg-amber-400 border border-white rounded-sm cursor-nwse-resize opacity-0 group-hover:opacity-100 z-30"
                        />
                      </div>
                    );
                  }

                  // 正常文字修补 Patch
                  return (
                    <div
                      key={patch.id}
                      onMouseDown={(e) => handlePatchMouseDown(e, patch)}
                      title={`点击编辑，按住可拖动位置: "${patch.newText || '已擦除'}"`}
                      className="absolute z-25 cursor-move flex items-center px-0.5 group hover:ring-2 hover:ring-amber-500 rounded-[2px] transition-shadow"
                      style={{
                        left: `${patch.leftPercent}%`,
                        top: `${patch.topPercent}%`,
                        ...(patch.autoFit !== false
                          ? { width: "max-content" }
                          : { width: `${patch.widthPercent}%` }),
                        maxWidth: `${Math.min(100 - (patch.leftPercent ?? 0), 98)}%`,
                        height: `${patch.heightPercent}%`,
                        backgroundColor: patch.bgHex === "transparent" ? "transparent" : (patch.bgHex || "#FFFFFF"),
                        border: "1px dashed #F59E0B",
                      }}
                    >
                      <span
                        className="whitespace-nowrap leading-none select-none font-medium pointer-events-none"
                        style={{
                          fontFamily: getFontFamilyCss(patch.fontFamily),
                          fontWeight: patch.isBold ? "bold" : "normal",
                          fontStyle: patch.isItalic ? "italic" : "normal",
                          color: patch.colorHex || "#000000",
                          fontSize: `${Math.max(6, (patch.fontSize || 12) * (canvasWidth / currentPage.width))}px`,
                        }}
                      >
                        {patch.newText || "（已涂白擦除）"}
                      </span>

                      {/* 8方向独立缩放手柄 (Independent 4-Side & 4-Corner Resizing) */}
                      {/* 上、下、左、右独立单边手柄 */}
                      <div
                        onMouseDown={(e) => handlePatchResizeMouseDown(e, patch, "n")}
                        title="向上拉伸/压缩上间距 (根除留白)"
                        className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-1.5 bg-amber-500 hover:bg-amber-400 border border-black/30 rounded-full cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity z-30 shadow-sm"
                      />
                      <div
                        onMouseDown={(e) => handlePatchResizeMouseDown(e, patch, "s")}
                        title="向下拉伸/压缩下间距 (根除留白)"
                        className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-1.5 bg-amber-500 hover:bg-amber-400 border border-black/30 rounded-full cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity z-30 shadow-sm"
                      />
                      <div
                        onMouseDown={(e) => handlePatchResizeMouseDown(e, patch, "w")}
                        title="向左拉伸/压缩左边距"
                        className="absolute top-1/2 -translate-y-1/2 -left-1 w-1.5 h-3 bg-amber-500 hover:bg-amber-400 border border-black/30 rounded-full cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity z-30 shadow-sm"
                      />
                      <div
                        onMouseDown={(e) => handlePatchResizeMouseDown(e, patch, "e")}
                        title="向右拉伸/压缩右边距"
                        className="absolute top-1/2 -translate-y-1/2 -right-1 w-1.5 h-3 bg-amber-500 hover:bg-amber-400 border border-black/30 rounded-full cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity z-30 shadow-sm"
                      />

                      {/* 4个对角手柄 (同步联动字号) */}
                      <div
                        onMouseDown={(e) => handlePatchResizeMouseDown(e, patch, "nw")}
                        title="左上角缩放"
                        className="absolute -top-1 -left-1 w-2.5 h-2.5 bg-amber-500 hover:bg-amber-400 border border-black/30 rounded-sm cursor-nwse-resize opacity-0 group-hover:opacity-100 transition-opacity z-30 shadow-sm"
                      />
                      <div
                        onMouseDown={(e) => handlePatchResizeMouseDown(e, patch, "ne")}
                        title="右上角缩放"
                        className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 hover:bg-amber-400 border border-black/30 rounded-sm cursor-nesw-resize opacity-0 group-hover:opacity-100 transition-opacity z-30 shadow-sm"
                      />
                      <div
                        onMouseDown={(e) => handlePatchResizeMouseDown(e, patch, "sw")}
                        title="左下角缩放"
                        className="absolute -bottom-1 -left-1 w-2.5 h-2.5 bg-amber-500 hover:bg-amber-400 border border-black/30 rounded-sm cursor-nesw-resize opacity-0 group-hover:opacity-100 transition-opacity z-30 shadow-sm"
                      />
                      <div
                        onMouseDown={(e) => handlePatchResizeMouseDown(e, patch, "se")}
                        title="右下角缩放 (联动字号)"
                        className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-amber-500 hover:bg-amber-400 border border-black/30 rounded-sm cursor-nwse-resize opacity-0 group-hover:opacity-100 transition-opacity z-30 shadow-sm"
                      />
                    </div>
                  );
                })}

                {/* 4. 原地直接编辑层 (Direct In-place Visual Editor - 像 Word 这样改) */}
                {activeEditingItem && (() => {
                  const wordWidthPx = (activeEditingItem.widthPercent / 100) * canvasWidth;

                  return (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute z-40 flex items-center"
                      style={{
                        left: `${activeEditingItem.leftPercent}%`,
                        top: `${activeEditingItem.topPercent}%`,
                        width: "max-content",
                        maxWidth: `${Math.min(100 - (activeEditingItem.leftPercent ?? 0), 96)}%`,
                        height: `${activeEditingItem.heightPercent}%`,
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
                        className="h-full px-1 py-0 bg-white text-black border border-amber-500 rounded-[2px] shadow-sm focus:outline-none focus:ring-1 focus:ring-amber-500 leading-none"
                        style={{
                          fontFamily: getFontFamilyCss(activeEditingItem.fontFamily),
                          fontWeight: activeEditingItem.isBold ? "bold" : "normal",
                          fontStyle: activeEditingItem.isItalic ? "italic" : "normal",
                          color: activeEditingItem.colorHex || "#000000",
                          fontSize: `${Math.max(6, (activeEditingItem.fontSize || 12) * (canvasWidth / currentPage.width))}px`,
                          width: `${Math.max(28, (activeEditingItem.newText.length + 1) * (activeEditingItem.fontSize * 0.65))}px`,
                        }}
                      />
                    </div>
                  );
                })()}

                {/* 4.1 智能防溢出浮动微型排版工具栏 (Smart Clamped Mini Toolbar - 绝对不超出画板边缘) */}
                {activeEditingItem && (() => {
                  const wordLeftPx = (activeEditingItem.leftPercent / 100) * canvasWidth;
                  const wordTopPx = (activeEditingItem.topPercent / 100) * canvasHeight;
                  const wordWidthPx = (activeEditingItem.widthPercent / 100) * canvasWidth;
                  const wordHeightPx = (activeEditingItem.heightPercent / 100) * canvasHeight;

                  const approxToolbarWidth = 520;
                  // 将工具栏严格限制在画板左右内侧 [8px, canvasWidth - 528px]，动态自适应绝不超出
                  const clampedLeft = Math.max(8, Math.min(canvasWidth - approxToolbarWidth - 8, wordLeftPx + (wordWidthPx / 2) - (approxToolbarWidth / 2)));
                  
                  // 支持用户手动切换上下位置，避免遮挡上一行文字
                  let showBelow = false;
                  if (toolbarPlacement === "below") {
                    showBelow = true;
                  } else if (toolbarPlacement === "above") {
                    showBelow = false;
                  } else {
                    showBelow = wordTopPx < 48;
                  }
                  const clampedTop = showBelow ? wordTopPx + wordHeightPx + 6 : Math.max(6, wordTopPx - 42);

                  return (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute z-50 flex items-center gap-1.5 px-2.5 py-1 bg-[#1A1412]/95 backdrop-blur-md text-white rounded-xl shadow-2xl border border-white/20 text-xs whitespace-nowrap animate-in fade-in zoom-in-95 duration-100"
                      style={{
                        left: `${clampedLeft}px`,
                        top: `${clampedTop}px`,
                        width: "max-content",
                        maxWidth: `${Math.max(280, canvasWidth - 16)}px`,
                      }}
                    >
                      {/* 紧凑版自动匹配指示标签 */}
                      <span
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] border border-amber-500/30 flex-shrink-0 cursor-default"
                        title={`已自动匹配原版排版: ${activeEditingItem.displayFamily || "Times New Roman"} · ${activeEditingItem.fontSize}pt ${activeEditingItem.isBold ? "· 粗体" : ""} ${activeEditingItem.isItalic ? "· 斜体" : ""}`}
                      >
                        <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                        <span className="max-w-[70px] truncate font-semibold text-white">
                          {activeEditingItem.displayFamily || "Times"}
                        </span>
                        <span className="text-amber-200">{activeEditingItem.fontSize}pt</span>
                      </span>

                      {/* 字体选择下拉框 */}
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
                                  displayFamily: selected ? selected.label.split(" (")[0] : prev.displayFamily,
                                }
                              : null
                          );
                        }}
                        className="bg-[#2A201C] text-white px-2 py-0.5 rounded-lg text-[11px] border border-white/10 focus:outline-none max-w-[110px] truncate flex-shrink-0"
                        title="选择字体"
                      >
                        {DOCUMENT_FONTS.map((f) => (
                          <option key={f.value} value={f.value}>
                            {f.label.split(" (")[0]}
                          </option>
                        ))}
                      </select>

                      {/* 粗体与斜体 */}
                      <div className="flex items-center gap-0.5 bg-[#2A201C] p-0.5 rounded-lg flex-shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setActiveEditingItem((prev) =>
                              prev ? { ...prev, isBold: !prev.isBold } : null
                            )
                          }
                          className={`w-5 h-5 flex items-center justify-center rounded text-xs font-bold transition-colors ${
                            activeEditingItem.isBold ? "bg-amber-500 text-black shadow-sm font-extrabold" : "text-white/70 hover:text-white"
                          }`}
                          title="粗体 (Bold)"
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
                          title="斜体 (Italic)"
                        >
                          I
                        </button>
                      </div>

                      {/* 字号加减 (同步缩放画框高度) */}
                      <div className="flex items-center gap-0.5 bg-[#2A201C] px-1 py-0.5 rounded-lg text-[11px] font-mono flex-shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setActiveEditingItem((prev) => {
                              if (!prev) return null;
                              const currentSize = prev.fontSize || 12;
                              const newSize = Math.max(6, currentSize - 1);
                              const ratio = newSize / currentSize;
                              return {
                                ...prev,
                                fontSize: newSize,
                                heightPercent: Math.max(1.5, Math.round(prev.heightPercent * ratio * 100) / 100),
                              };
                            })
                          }
                          className="hover:text-amber-400 p-0.5"
                          title="减小字号 (同步缩小边框)"
                        >
                          <Minus className="w-2.5 h-2.5" />
                        </button>
                        <span className="w-5 text-center">{activeEditingItem.fontSize}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setActiveEditingItem((prev) => {
                              if (!prev) return null;
                              const currentSize = prev.fontSize || 12;
                              const newSize = Math.min(72, currentSize + 1);
                              const ratio = newSize / currentSize;
                              return {
                                ...prev,
                                fontSize: newSize,
                                heightPercent: Math.max(1.5, Math.round(prev.heightPercent * ratio * 100) / 100),
                              };
                            })
                          }
                          className="hover:text-amber-400 p-0.5"
                          title="增大字号 (同步放大边框)"
                        >
                          <Plus className="w-2.5 h-2.5" />
                        </button>
                      </div>

                      {/* 底色透明/白色遮罩切换 */}
                      <button
                        type="button"
                        onClick={() =>
                          setActiveEditingItem((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  bgHex: prev.bgHex === "transparent" ? "#FFFFFF" : "transparent",
                                }
                              : null
                          )
                        }
                        className={`px-1.5 py-0.5 rounded-lg text-[10px] font-medium transition-colors border flex-shrink-0 ${
                          activeEditingItem.bgHex === "transparent"
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                            : "bg-white/20 text-white border-white/30"
                        }`}
                        title={
                          activeEditingItem.bgHex === "transparent"
                            ? "当前为透明底色（点击切换为白色遮罩）"
                            : "当前为白色遮罩（点击切换为透明底色）"
                        }
                      >
                        {activeEditingItem.bgHex === "transparent" ? "底:透明" : "底:遮白"}
                      </button>

                      {/* 颜色选择球 */}
                      <label
                        className="w-5 h-5 rounded-full border border-white/40 cursor-pointer overflow-hidden flex-shrink-0 relative shadow-inner inline-block"
                        style={{ backgroundColor: activeEditingItem.colorHex || "#000000" }}
                        title="自定义文字颜色"
                      >
                        <input
                          type="color"
                          value={activeEditingItem.colorHex || "#000000"}
                          onChange={(e) =>
                            setActiveEditingItem((prev) =>
                              prev ? { ...prev, colorHex: e.target.value } : null
                            )
                          }
                          className="opacity-0 absolute inset-0 cursor-pointer w-full h-full"
                        />
                      </label>

                      {/* 一键紧密贴合按钮 (去除多余留白) */}
                      {activeEditingItem.isExistingPatch && activeEditingItem.patchId && (
                        <button
                          type="button"
                          onClick={() => {
                            const p = patches.find((x) => x.id === activeEditingItem.patchId);
                            if (p) handleAutoFitPatch(p);
                          }}
                          className="px-1.5 py-0.5 rounded-lg text-[10px] bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 transition-colors"
                          title="一键收紧四周间距，去除多余留白"
                        >
                          贴合
                        </button>
                      )}

                      {/* 工具栏上下翻转按钮 (避免挡住上面一行文字) */}
                      <button
                        type="button"
                        onClick={() =>
                          setToolbarPlacement((prev) => (prev === "below" ? "above" : "below"))
                        }
                        className="p-1 rounded-lg hover:bg-white/20 text-white/70 hover:text-white transition-colors flex-shrink-0"
                        title={showBelow ? "将工具栏移到上方" : "将工具栏移到下方（避免遮挡上文）"}
                      >
                        {showBelow ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                      </button>

                      {/* 确认 / 放弃 / 删除 */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={handleCommitInplaceEdit}
                          className="flex items-center gap-0.5 px-2.5 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition-colors shadow-sm"
                          title="完成并暂存修正 (Enter)"
                        >
                          <Check className="w-3 h-3" />
                          <span>确定</span>
                        </button>
                        {activeEditingItem.isExistingPatch && (
                          <button
                            type="button"
                            onClick={handleDeleteCurrentEditingPatch}
                            className="p-1 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
                            title="删除此修补项"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleCancelInplaceEdit}
                          className="p-1 rounded-lg hover:bg-white/20 text-white/70 transition-colors"
                          title="取消 (Esc)"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* 5. 正在自由画框的选区预览 */}
                {isDrawing && drawStart && drawCurrent && (
                  <div
                    className={`absolute z-40 border-2 border-dashed pointer-events-none ${
                      editGranularity === "highlight"
                        ? "border-yellow-500 bg-yellow-400/30"
                        : "border-amber-600 bg-amber-500/20"
                    }`}
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
                {editGranularity === "highlight"
                  ? "高亮模式：直接点击文字或表格单元格自动贴合高亮，再次点击同色文字可取消。"
                  : editGranularity === "draw"
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
                    onClick={() => pushHistory([])}
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
                          {p.isHighlight ? (
                            <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-500">
                              <Highlighter className="w-3 h-3" />
                              <span>荧光笔高亮标注</span>
                            </span>
                          ) : (
                            <span className="truncate line-through opacity-50 text-[11px]">
                              {p.originalText}
                            </span>
                          )}
                        </div>
                        {!p.isHighlight && (
                          <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold truncate">
                            <CornerDownRight className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{p.newText || "（已涂白擦除）"}</span>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePatch(p.id);
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

  return isFullscreen && mounted ? createPortal(studioContent, document.body) : studioContent;
}
