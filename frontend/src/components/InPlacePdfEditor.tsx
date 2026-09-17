"use client";

import React, { useState, useRef } from "react";
import {
  ArrowLeft,
  Edit3,
  Eraser,
  Type,
  Undo2,
  Download,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Check,
  X,
  Sparkles,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { applyPdfModifications, downloadBlob } from "@/lib/api";

interface Block {
  id: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  text: string;
  fontSize: number;
}

interface PageData {
  pageIndex: number;
  width: number;
  height: number;
  image: string;
  blocks: Block[];
}

interface InPlacePdfEditorProps {
  originalFile: File;
  docTitle: string;
  numPages: number;
  pages: PageData[];
  onExit: () => void;
}

type EditMode = "replace" | "whiteout" | "addText";

interface Modification {
  id: string;
  type: EditMode;
  pageIndex: number;
  x0?: number;
  y0?: number;
  x1?: number;
  y1?: number;
  x?: number;
  y?: number;
  newText?: string;
  text?: string;
  fontSize?: number;
  color?: string;
}

export default function InPlacePdfEditor({
  originalFile,
  docTitle,
  numPages,
  pages,
  onExit,
}: InPlacePdfEditorProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [scale, setScale] = useState(1.0); // 缩放比例
  const [mode, setMode] = useState<EditMode>("replace");
  const [modifications, setModifications] = useState<Modification[]>([]);
  const [loadingExport, setLoadingExport] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // 原位替换弹窗状态
  const [activeReplaceBlock, setActiveReplaceBlock] = useState<Block | null>(null);
  const [replaceText, setReplaceText] = useState("");
  const [replaceFontSize, setReplaceFontSize] = useState(12);
  const [replaceColor, setReplaceColor] = useState("#000000");

  // 涂抹框选拖拽状态
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [currentDrag, setCurrentDrag] = useState<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // 新增文字输入框
  const [newTextDialog, setNewTextDialog] = useState<{ x: number; y: number } | null>(null);
  const [addedText, setAddedText] = useState("");

  const page = pages[currentPage] || pages[0];

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  // 点击原位文字块进行替换
  const handleBlockClick = (block: Block) => {
    if (mode !== "replace") return;
    setActiveReplaceBlock(block);
    setReplaceText(block.text);
    setReplaceFontSize(block.fontSize || 12);
    setReplaceColor("#000000");
  };

  // 确认原位改字
  const handleConfirmReplace = () => {
    if (!activeReplaceBlock) return;
    const newMod: Modification = {
      id: `mod_${Date.now()}`,
      type: "replace",
      pageIndex: currentPage,
      x0: activeReplaceBlock.x0,
      y0: activeReplaceBlock.y0,
      x1: activeReplaceBlock.x1,
      y1: activeReplaceBlock.y1,
      newText: replaceText,
      fontSize: replaceFontSize,
      color: replaceColor,
    };
    setModifications((prev) => [...prev, newMod]);
    setActiveReplaceBlock(null);
    showToast("success", "已就地替换文字");
  };

  // 涂抹拖拽逻辑
  const handleMouseDown = (e: React.MouseEvent) => {
    if (mode === "whiteout" && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const clickX = (e.clientX - rect.left) / scale;
      const clickY = (e.clientY - rect.top) / scale;
      setDragStart({ x: clickX, y: clickY });
      setCurrentDrag({ x: clickX, y: clickY });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (mode === "whiteout" && dragStart && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const clickX = (e.clientX - rect.left) / scale;
      const clickY = (e.clientY - rect.top) / scale;
      setCurrentDrag({ x: clickX, y: clickY });
    }
  };

  const handleMouseUp = () => {
    if (mode === "whiteout" && dragStart && currentDrag) {
      const x0 = Math.min(dragStart.x, currentDrag.x);
      const y0 = Math.min(dragStart.y, currentDrag.y);
      const x1 = Math.max(dragStart.x, currentDrag.x);
      const y1 = Math.max(dragStart.y, currentDrag.y);

      // 仅当选区有一定大小时记录
      if (x1 - x0 > 4 && y1 - y0 > 4) {
        const newMod: Modification = {
          id: `mod_${Date.now()}`,
          type: "whiteout",
          pageIndex: currentPage,
          x0,
          y0,
          x1,
          y1,
        };
        setModifications((prev) => [...prev, newMod]);
        showToast("success", "已涂抹遮白所选区域");
      }
      setDragStart(null);
      setCurrentDrag(null);
    }
  };

  // 点击空白处新增文字
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (mode === "addText" && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / scale;
      const y = (e.clientY - rect.top) / scale;
      setNewTextDialog({ x, y });
      setAddedText("");
    }
  };

  const handleConfirmAddText = () => {
    if (!newTextDialog || !addedText.trim()) {
      setNewTextDialog(null);
      return;
    }
    const newMod: Modification = {
      id: `mod_${Date.now()}`,
      type: "addText",
      pageIndex: currentPage,
      x: newTextDialog.x,
      y: newTextDialog.y,
      text: addedText.trim(),
      fontSize: 12,
      color: "#000000",
    };
    setModifications((prev) => [...prev, newMod]);
    setNewTextDialog(null);
    showToast("success", "已成功插入新文字");
  };

  const handleUndo = () => {
    if (modifications.length === 0) return;
    setModifications((prev) => prev.slice(0, prev.length - 1));
    showToast("success", "已撤销最近修改");
  };

  // 导出原子级修改后的 PDF
  const handleExport = async () => {
    setLoadingExport(true);
    try {
      const { blob, filename } = await applyPdfModifications(originalFile, modifications);
      downloadBlob(blob, filename);
      showToast("success", "已生成并下载 100% 原版不跑偏 PDF！");
    } catch (err: any) {
      showToast("error", err.message || "导出失败");
    } finally {
      setLoadingExport(false);
    }
  };

  // 当前页的修改项
  const currentPageMods = modifications.filter((m) => m.pageIndex === currentPage);

  return (
    <div className="w-full flex flex-col items-center bg-coconut-100/60 dark:bg-darkbg-canvas rounded-3xl border border-coconut-200/80 dark:border-darkbg-border overflow-hidden shadow-coconut-md">
      {/* 顶部工具栏 */}
      <div className="w-full bg-white/90 dark:bg-darkbg-card/90 backdrop-blur-md border-b border-coconut-200/70 dark:border-darkbg-border px-4 py-3 sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 shadow-coconut-sm">
        {/* 左侧：返回与标题 */}
        <div className="flex items-center gap-3">
          <button
            onClick={onExit}
            className="p-2 rounded-xl text-coconut-600 dark:text-darkbg-muted hover:text-coconut-900 dark:hover:text-darkbg-text hover:bg-coconut-100 dark:hover:bg-darkbg-elevated transition-colors active:scale-95"
            title="返回重选"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h3 className="text-sm font-bold text-coconut-900 dark:text-darkbg-text flex items-center gap-2 truncate max-w-[200px] sm:max-w-xs">
              <span>{docTitle}.pdf</span>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-toast-100 dark:bg-toast-950/60 text-toast-800 dark:text-toast-300 font-semibold border border-toast-200/60 dark:border-toast-900/50">
                1:1 原版模式
              </span>
            </h3>
            <p className="text-[11px] text-coconut-500 dark:text-darkbg-muted">
              已就地修改 {modifications.length} 处 · 原版排版 100% 绝不跑偏
            </p>
          </div>
        </div>

        {/* 中间：三大就地编辑模式切换 */}
        <div className="flex items-center bg-coconut-100/70 dark:bg-darkbg-subtle p-1 rounded-2xl border border-coconut-200/60 dark:border-darkbg-border text-xs">
          <button
            onClick={() => {
              setMode("replace");
              setActiveReplaceBlock(null);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium transition-all active:scale-95 ${
              mode === "replace"
                ? "bg-coconut-800 dark:bg-white text-coconut-50 dark:text-zinc-950 shadow-coconut-sm font-bold"
                : "text-coconut-700 dark:text-darkbg-muted hover:text-coconut-900 dark:hover:text-darkbg-text"
            }`}
          >
            <Edit3 className={`w-3.5 h-3.5 ${mode === "replace" ? "text-palm-300 dark:text-palm-700" : "text-coconut-600 dark:text-darkbg-muted"}`} />
            <span>原位改字</span>
          </button>

          <button
            onClick={() => {
              setMode("whiteout");
              setActiveReplaceBlock(null);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium transition-all active:scale-95 ${
              mode === "whiteout"
                ? "bg-coconut-800 dark:bg-white text-coconut-50 dark:text-zinc-950 shadow-coconut-sm font-bold"
                : "text-coconut-700 dark:text-darkbg-muted hover:text-coconut-900 dark:hover:text-darkbg-text"
            }`}
          >
            <Eraser className="w-3.5 h-3.5 text-toast-500" />
            <span>修正带涂抹</span>
          </button>

          <button
            onClick={() => {
              setMode("addText");
              setActiveReplaceBlock(null);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium transition-all active:scale-95 ${
              mode === "addText"
                ? "bg-coconut-800 dark:bg-white text-coconut-50 dark:text-zinc-950 shadow-coconut-sm font-bold"
                : "text-coconut-700 dark:text-darkbg-muted hover:text-coconut-900 dark:hover:text-darkbg-text"
            }`}
          >
            <Type className="w-3.5 h-3.5 text-palm-500" />
            <span>新增文字</span>
          </button>
        </div>

        {/* 右侧：缩放、撤销与导出 */}
        <div className="flex items-center gap-2">
          {/* 撤销 */}
          <button
            onClick={handleUndo}
            disabled={modifications.length === 0}
            className="p-2 rounded-xl border border-coconut-200 dark:border-darkbg-border text-coconut-700 dark:text-darkbg-muted hover:bg-coconut-100 dark:hover:bg-darkbg-elevated disabled:opacity-30 active:scale-95 transition-all"
            title="撤销上一步"
          >
            <Undo2 className="w-4 h-4" />
          </button>

          {/* 缩放 */}
          <div className="hidden sm:flex items-center border border-coconut-200 dark:border-darkbg-border rounded-xl overflow-hidden text-xs text-coconut-700 dark:text-darkbg-muted bg-coconut-50/50 dark:bg-darkbg-subtle">
            <button
              onClick={() => setScale((s) => Math.max(0.6, s - 0.15))}
              className="px-2.5 py-1.5 hover:bg-coconut-100 dark:hover:bg-darkbg-elevated border-r border-coconut-200 dark:border-darkbg-border transition-colors"
              title="缩小"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-2.5 py-1.5 font-mono">{Math.round(scale * 100)}%</span>
            <button
              onClick={() => setScale((s) => Math.min(1.8, s + 0.15))}
              className="px-2.5 py-1.5 hover:bg-coconut-100 dark:hover:bg-darkbg-elevated transition-colors"
              title="放大"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 导出大按钮 */}
          <button
            onClick={handleExport}
            disabled={loadingExport}
            className="px-4 py-2 rounded-2xl btn-3d-sunset text-white text-xs font-bold flex items-center gap-1.5"
          >
            {loadingExport ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>导出修改后 PDF</span>
          </button>
        </div>
      </div>

      {/* 状态通知浮层 */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl shadow-lg border flex items-center gap-2 text-xs font-medium animate-in fade-in slide-in-from-top-3 ${
            toast.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600" />
          )}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* 居中真实 PDF 原版页面画布 */}
      <div className="w-full overflow-auto py-8 px-4 flex justify-center min-h-[600px] max-h-[calc(100vh-180px)] select-none">
        <div
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onClick={handleCanvasClick}
          className="relative bg-white shadow-xl shadow-slate-300/60 rounded-sm border border-slate-300 cursor-crosshair transition-transform origin-top"
          style={{
            width: `${page.width * scale}px`,
            height: `${page.height * scale}px`,
          }}
        >
          {/* 1. 底层：原版 PDF 高保真渲染图 (100% 原始背景、线条、表格原汁原味) */}
          <img
            src={page.image}
            alt={`Page ${currentPage + 1}`}
            className="w-full h-full pointer-events-none object-contain block"
          />

          {/* 2. 中层：原位已修改项覆层渲染 (白块遮盖与新文字覆写) */}
          {currentPageMods.map((mod) => {
            if (mod.type === "replace") {
              const left = (mod.x0! / page.width) * 100;
              const top = (mod.y0! / page.height) * 100;
              const width = ((mod.x1! - mod.x0!) / page.width) * 100;
              const height = ((mod.y1! - mod.y0!) / page.height) * 100;
              return (
                <div
                  key={mod.id}
                  className="absolute bg-white flex items-center px-0.5 border border-emerald-400/40 rounded-xs"
                  style={{
                    left: `${left}%`,
                    top: `${top}%`,
                    minWidth: `${width}%`,
                    minHeight: `${height}%`,
                    fontSize: `${(mod.fontSize || 12) * scale}px`,
                    color: mod.color || "#000000",
                    lineHeight: 1.2,
                  }}
                >
                  <span className="font-sans whitespace-pre">{mod.newText}</span>
                </div>
              );
            } else if (mod.type === "whiteout") {
              const left = (mod.x0! / page.width) * 100;
              const top = (mod.y0! / page.height) * 100;
              const width = ((mod.x1! - mod.x0!) / page.width) * 100;
              const height = ((mod.y1! - mod.y0!) / page.height) * 100;
              return (
                <div
                  key={mod.id}
                  className="absolute bg-white border border-slate-200"
                  style={{
                    left: `${left}%`,
                    top: `${top}%`,
                    width: `${width}%`,
                    height: `${height}%`,
                  }}
                />
              );
            } else if (mod.type === "addText") {
              const left = (mod.x! / page.width) * 100;
              const top = (mod.y! / page.height) * 100;
              return (
                <div
                  key={mod.id}
                  className="absolute bg-white/95 px-1 border border-palm-400/50 rounded-xs font-sans whitespace-pre text-coconut-900 shadow-xs"
                  style={{
                    left: `${left}%`,
                    top: `${top}%`,
                    fontSize: `${(mod.fontSize || 12) * scale}px`,
                    color: mod.color || "#000000",
                  }}
                >
                  {mod.text}
                </div>
              );
            }
            return null;
          })}

          {/* 3. 正在拖拽中的修正带预览框 */}
          {dragStart && currentDrag && (
            <div
              className="absolute bg-palm-100/40 border-2 border-dashed border-palm-500 pointer-events-none"
              style={{
                left: `${Math.min(dragStart.x, currentDrag.x) * scale}px`,
                top: `${Math.min(dragStart.y, currentDrag.y) * scale}px`,
                width: `${Math.abs(currentDrag.x - dragStart.x) * scale}px`,
                height: `${Math.abs(currentDrag.y - dragStart.y) * scale}px`,
              }}
            />
          )}

          {/* 4. 顶层：原位文字交互热区 (原位改字模式下悬停高亮) */}
          {mode === "replace" &&
            page.blocks.map((b) => {
              const left = (b.x0 / page.width) * 100;
              const top = (b.y0 / page.height) * 100;
              const width = ((b.x1 - b.x0) / page.width) * 100;
              const height = ((b.y1 - b.y0) / page.height) * 100;
              return (
                <div
                  key={b.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleBlockClick(b);
                  }}
                  className="absolute hover:border-2 hover:border-palm-500 hover:bg-palm-500/15 cursor-pointer rounded-xs transition-colors group"
                  style={{
                    left: `${left}%`,
                    top: `${top}%`,
                    width: `${width}%`,
                    height: `${height}%`,
                  }}
                  title="点击原地替换文字"
                >
                  <span className="hidden group-hover:flex absolute -top-6 left-0 bg-palm-700 text-white text-[10px] px-2 py-0.5 rounded-md shadow-coconut-sm whitespace-nowrap items-center gap-1 z-30 font-medium">
                    <Edit3 className="w-2.5 h-2.5" /> 点击就地改字
                  </span>
                </div>
              );
            })}
        </div>
      </div>

      {/* 原位文字替换弹窗 */}
      {activeReplaceBlock && (
        <div className="fixed inset-0 bg-coconut-950/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-darkbg-card rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-coconut-lg border border-coconut-200 dark:border-darkbg-border animate-fade-in">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-coconut-100 dark:border-darkbg-border">
              <span className="text-xs font-bold text-coconut-900 dark:text-darkbg-text flex items-center gap-1.5">
                <Edit3 className="w-4 h-4 text-palm-600 dark:text-palm-400" /> 原位替换文字 (保持原位置不跑偏)
              </span>
              <button
                onClick={() => setActiveReplaceBlock(null)}
                className="text-coconut-400 hover:text-coconut-600 dark:text-darkbg-muted dark:hover:text-darkbg-text"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] text-coconut-500 dark:text-darkbg-muted mb-1 font-medium">原文字内容：</label>
                <div className="text-xs p-2.5 bg-coconut-50 dark:bg-darkbg-subtle rounded-xl text-coconut-600 dark:text-darkbg-muted border border-coconut-200/60 dark:border-darkbg-border max-h-20 overflow-y-auto font-mono">
                  {activeReplaceBlock.text}
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-coconut-800 dark:text-darkbg-text mb-1 font-semibold">修改后的新文字：</label>
                <textarea
                  rows={3}
                  value={replaceText}
                  onChange={(e) => setReplaceText(e.target.value)}
                  className="w-full text-xs p-3 bg-coconut-50 dark:bg-darkbg-subtle border border-coconut-200 dark:border-darkbg-border rounded-xl outline-none focus:ring-2 focus:ring-palm-500/20 focus:border-palm-500 font-sans text-coconut-900 dark:text-darkbg-text"
                  placeholder="在此输入新的文字内容..."
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-coconut-700 dark:text-darkbg-muted mb-1">字号大小 ({replaceFontSize} pt)</label>
                  <input
                    type="number"
                    min="6"
                    max="48"
                    value={replaceFontSize}
                    onChange={(e) => setReplaceFontSize(Number(e.target.value))}
                    className="w-full text-xs p-2 bg-coconut-50 dark:bg-darkbg-subtle border border-coconut-200 dark:border-darkbg-border rounded-xl outline-none text-coconut-900 dark:text-darkbg-text"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-coconut-700 dark:text-darkbg-muted mb-1">文字颜色</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={replaceColor}
                      onChange={(e) => setReplaceColor(e.target.value)}
                      className="w-8 h-8 rounded-lg border border-coconut-300 dark:border-darkbg-border cursor-pointer bg-transparent"
                    />
                    <span className="text-xs font-mono text-coconut-700 dark:text-darkbg-muted">{replaceColor}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-coconut-100 dark:border-darkbg-border">
                <button
                  onClick={() => setActiveReplaceBlock(null)}
                  className="px-3.5 py-2 text-xs text-coconut-600 dark:text-darkbg-muted hover:bg-coconut-100 dark:hover:bg-darkbg-elevated rounded-xl font-medium transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleConfirmReplace}
                  className="px-4 py-2 text-xs bg-gradient-to-r from-palm-600 to-palm-700 hover:from-palm-700 hover:to-palm-800 text-white rounded-xl font-semibold shadow-coconut-sm flex items-center gap-1 active:scale-95 transition-all"
                >
                  <Check className="w-3.5 h-3.5" /> 确认替换
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 任意处新增文字输入弹窗 */}
      {newTextDialog && (
        <div className="fixed inset-0 bg-coconut-950/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-darkbg-card rounded-3xl p-5 sm:p-6 max-w-sm w-full shadow-coconut-lg border border-coconut-200 dark:border-darkbg-border animate-fade-in">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-coconut-100 dark:border-darkbg-border">
              <span className="text-xs font-bold text-coconut-900 dark:text-darkbg-text flex items-center gap-1.5">
                <Type className="w-4 h-4 text-palm-600 dark:text-palm-400" /> 在选定位置插入文字
              </span>
              <button
                onClick={() => setNewTextDialog(null)}
                className="text-coconut-400 hover:text-coconut-600 dark:text-darkbg-muted dark:hover:text-darkbg-text"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              type="text"
              value={addedText}
              onChange={(e) => setAddedText(e.target.value)}
              placeholder="请输入需要添加的文字..."
              className="w-full text-xs p-2.5 bg-coconut-50 dark:bg-darkbg-subtle border border-coconut-200 dark:border-darkbg-border rounded-xl outline-none focus:ring-2 focus:ring-palm-500/20 focus:border-palm-500 mb-4 text-coconut-900 dark:text-darkbg-text"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setNewTextDialog(null)}
                className="px-3.5 py-2 text-xs text-coconut-600 dark:text-darkbg-muted hover:bg-coconut-100 dark:hover:bg-darkbg-elevated rounded-xl font-medium transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleConfirmAddText}
                className="px-4 py-2 text-xs bg-gradient-to-r from-palm-600 to-palm-700 hover:from-palm-700 hover:to-palm-800 text-white rounded-xl font-semibold shadow-coconut-sm active:scale-95 transition-all"
              >
                确认插入
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 底部浮动翻页条 */}
      <div className="w-full bg-white/90 dark:bg-darkbg-card/90 backdrop-blur-md border-t border-coconut-200/70 dark:border-darkbg-border py-2.5 px-6 flex items-center justify-between text-xs text-coconut-600 dark:text-darkbg-muted">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-palm-500"></span>
          <span>1:1 原版物理层锁定 · 格式与间距 100% 不跑偏</span>
        </div>

        {/* 翻页器 */}
        {numPages > 1 && (
          <div className="flex items-center gap-2 bg-coconut-100/80 dark:bg-darkbg-subtle px-3 py-1 rounded-full border border-coconut-200/70 dark:border-darkbg-border">
            <button
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="p-1 hover:text-coconut-900 dark:hover:text-darkbg-text disabled:opacity-30"
              title="上一页"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono text-xs font-semibold text-coconut-800 dark:text-darkbg-text">
              第 {currentPage + 1} / {numPages} 页
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(numPages - 1, p + 1))}
              disabled={currentPage >= numPages - 1}
              className="p-1 hover:text-coconut-900 dark:hover:text-darkbg-text disabled:opacity-30"
              title="下一页"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        <span className="hidden sm:inline text-coconut-400 dark:text-darkbg-muted font-mono">
          原始尺寸: {page.width} x {page.height} pt
        </span>
      </div>
    </div>
  );
}
