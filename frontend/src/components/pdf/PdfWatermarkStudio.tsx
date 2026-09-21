"use client";

import React, { useState, useEffect } from "react";
import {
  Stamp,
  Sliders,
  ChevronLeft,
  ChevronRight,
  Eye,
  Download,
  RotateCcw,
  FileCheck,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Sparkles,
  X,
  FileText,
} from "lucide-react";
import { formatBytes } from "@/lib/imageProcessor";
import { renderPdfPages, downloadBlob } from "@/lib/api";

interface PdfWatermarkStudioProps {
  file: File;
  onExecute: (text: string, opacity: number, angle: number) => Promise<void>;
  loading: boolean;
  error: string | null;
  successMsg: string | null;
  executionResult: { blob: Blob; filename: string; size: number } | null;
  onReset: () => void;
  onClearFile: () => void;
}

interface PageData {
  pageIndex: number;
  width: number;
  height: number;
  image: string;
}

const PRESET_TEXTS = [
  "内部机密 严禁外传",
  "仅供内部审阅",
  "草稿文件 请勿外泄",
  "样本草稿 DRAFT",
  "绝密文件 CONFIDENTIAL",
  "专属归档 仅供参考",
];

const PRESET_ANGLES = [
  { label: "水平 (0°)", val: 0 },
  { label: "轻斜 (30°)", val: 30 },
  { label: "经典 (45°)", val: 45 },
  { label: "垂直 (90°)", val: 90 },
];

const PRESET_OPACITIES = [
  { label: "淡雅 15%", val: 0.15 },
  { label: "标准 30%", val: 0.3 },
  { label: "清晰 50%", val: 0.5 },
  { label: "醒目 75%", val: 0.75 },
];

export default function PdfWatermarkStudio({
  file,
  onExecute,
  loading,
  error,
  successMsg,
  executionResult,
  onReset,
  onClearFile,
}: PdfWatermarkStudioProps) {
  const [watermarkText, setWatermarkText] = useState<string>("内部机密 严禁外传");
  const [watermarkOpacity, setWatermarkOpacity] = useState<number>(0.3);
  const [watermarkAngle, setWatermarkAngle] = useState<number>(45);

  const [pages, setPages] = useState<PageData[]>([]);
  const [numPages, setNumPages] = useState<number>(1);
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const [renderingPreview, setRenderingPreview] = useState<boolean>(true);
  const [renderError, setRenderError] = useState<string | null>(null);

  // 渲染前 5 页用于翻页预览 (72 DPI 快速渲染)
  useEffect(() => {
    let isCancelled = false;
    setRenderingPreview(true);
    setRenderError(null);
    setCurrentPageIndex(0);

    renderPdfPages(file, 90, 5, false)
      .then((res) => {
        if (!isCancelled) {
          setPages(res.pages);
          setNumPages(res.numPages);
          setRenderingPreview(false);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          setRenderError(err.message || "无法渲染 PDF 预览背景图");
          setRenderingPreview(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [file]);

  const currentPage = pages[currentPageIndex];

  const handlePrevPage = () => {
    setCurrentPageIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPageIndex((prev) => Math.min(pages.length - 1, prev + 1));
  };

  const handleSubmit = () => {
    onExecute(watermarkText.trim() || "内部机密", watermarkOpacity, watermarkAngle);
  };

  return (
    <div className="space-y-6">
      {/* 顶部文件标题与更换按钮 */}
      <div className="flex items-center justify-between pb-3 border-b border-coconut-200/80 dark:border-darkbg-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center flex-shrink-0">
            <Stamp className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-coconut-950 dark:text-darkbg-text truncate max-w-sm">
                {file.name}
              </h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-coconut-200/70 dark:bg-darkbg-subtle text-coconut-700 dark:text-darkbg-muted font-mono">
                {formatBytes(file.size)}
              </span>
            </div>
            <p className="text-xs text-coconut-600 dark:text-darkbg-muted mt-0.5">
              总计 {numPages} 页 · 调节左侧参数，右侧画布 1:1 动态实时预览呈现
            </p>
          </div>
        </div>

        <button
          onClick={onClearFile}
          className="p-2 rounded-xl text-coconut-500 hover:text-rose-600 hover:bg-rose-500/10 transition-colors flex items-center gap-1 text-xs font-semibold"
          title="更换其他文件"
        >
          <X className="w-4 h-4" />
          <span className="hidden sm:inline">更换文件</span>
        </button>
      </div>

      {/* 双栏 Studio 工作台：左侧控制台 + 右侧实时渲染舞台 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* 左侧：参数控制面板 */}
        <div className="lg:col-span-5 coconut-panel p-5 sm:p-6 space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-coconut-200/80 dark:border-darkbg-border text-sm font-bold text-coconut-950 dark:text-darkbg-text">
            <Sliders className="w-4 h-4 text-orange-600 dark:text-orange-400" />
            <span>水印参数微调</span>
          </div>

          {/* 水印文字 */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-coconut-900 dark:text-darkbg-text">
              水印文字内容
            </label>
            <input
              type="text"
              value={watermarkText}
              onChange={(e) => setWatermarkText(e.target.value)}
              placeholder="请输入防伪/防盗水印文字"
              className="w-full text-sm p-3 bg-white/90 dark:bg-darkbg-subtle border border-[#CBB09C] dark:border-darkbg-border rounded-xl outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-coconut-950 dark:text-darkbg-text font-medium"
            />

            {/* 常用预设词快捷点击 */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              {PRESET_TEXTS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setWatermarkText(t)}
                  className={`text-[11px] px-2 py-0.5 rounded-lg border transition-all active:scale-95 ${
                    watermarkText === t
                      ? "bg-orange-500/15 text-orange-800 dark:text-orange-200 border-orange-500/40 font-bold"
                      : "bg-white/60 dark:bg-darkbg-subtle border-coconut-200 dark:border-darkbg-border text-coconut-700 dark:text-darkbg-muted hover:border-orange-400"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* 半透明度滑块 */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs font-bold text-coconut-900 dark:text-darkbg-text">
              <span>半透明度 (Opacity)</span>
              <span className="font-mono font-bold text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded-lg bg-orange-500/10 border border-orange-500/20">
                {Math.round(watermarkOpacity * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.05"
              max="0.85"
              step="0.05"
              value={watermarkOpacity}
              onChange={(e) => setWatermarkOpacity(parseFloat(e.target.value))}
              className="w-full accent-orange-600 cursor-pointer h-2 bg-coconut-200 dark:bg-darkbg-border rounded-lg appearance-none"
            />

            {/* 透明度快捷档位 */}
            <div className="grid grid-cols-4 gap-1.5 pt-1">
              {PRESET_OPACITIES.map((item) => (
                <button
                  key={item.val}
                  type="button"
                  onClick={() => setWatermarkOpacity(item.val)}
                  className={`text-[10px] py-1 px-1 rounded-lg border font-semibold text-center transition-all active:scale-95 ${
                    Math.abs(watermarkOpacity - item.val) < 0.02
                      ? "bg-accent-gradient text-white border-transparent"
                      : "bg-white/60 dark:bg-darkbg-subtle border-coconut-200 dark:border-darkbg-border text-coconut-700 dark:text-darkbg-muted hover:border-orange-400"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* 旋转角度 */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-coconut-900 dark:text-darkbg-text">
              水印旋转倾斜角度
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PRESET_ANGLES.map((ang) => (
                <button
                  key={ang.val}
                  type="button"
                  onClick={() => setWatermarkAngle(ang.val)}
                  className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all active:scale-95 text-center ${
                    watermarkAngle === ang.val
                      ? "bg-accent-gradient text-white border-transparent shadow-xs"
                      : "bg-white/60 dark:bg-darkbg-subtle border-coconut-200 dark:border-darkbg-border text-coconut-800 dark:text-darkbg-muted hover:border-orange-400"
                  }`}
                >
                  {ang.label}
                </button>
              ))}
            </div>
          </div>

          {/* 错误提示 */}
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

          {/* 结果下载卡片 (严格点击才下载) */}
          {executionResult ? (
            <div className="p-4 bg-accent-subtle border border-accent-border rounded-2xl space-y-3 shadow-coconut-sm animate-fade-in backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-accent-gradient text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                  <FileCheck className="w-4 h-4 text-white" />
                </div>
                <div className="truncate">
                  <h4 className="text-xs font-bold text-coconut-950 dark:text-white truncate">
                    {executionResult.filename}
                  </h4>
                  <p className="text-[11px] text-orange-800 dark:text-amber-300 font-mono font-medium">
                    {formatBytes(executionResult.size)} · 水印已成功注入
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => downloadBlob(executionResult.blob, executionResult.filename)}
                  className="flex-1 py-2.5 px-3 rounded-xl btn-3d-sunset text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-coconut-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>立即下载该文件</span>
                </button>

                <button
                  onClick={onReset}
                  className="py-2.5 px-3 rounded-xl btn-3d-secondary font-bold text-xs flex items-center justify-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>处理新文件</span>
                </button>
              </div>
            </div>
          ) : (
            /* 提交执行加水印按钮 */
            <button
              onClick={handleSubmit}
              disabled={loading || !watermarkText.trim()}
              className={`w-full py-3.5 px-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                loading || !watermarkText.trim()
                  ? "bg-coconut-100 dark:bg-darkbg-subtle text-coconut-400 dark:text-darkbg-muted cursor-not-allowed border border-coconut-200 dark:border-darkbg-border"
                  : "btn-3d-sunset text-white"
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>正在添加水印并导出，请稍候...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-200" />
                  <span>开始添加文字水印并导出</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* 右侧：1:1 真实文档动态效果预览舞台 */}
        <div className="lg:col-span-7 coconut-panel p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-coconut-200/80 dark:border-darkbg-border">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              <span className="text-xs font-bold text-coconut-900 dark:text-darkbg-text">
                真实页面实时渲染舞台 (所见即所得)
              </span>
            </div>

            {/* 多页文档翻页控制器 */}
            {pages.length > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handlePrevPage}
                  disabled={currentPageIndex === 0}
                  className="p-1 rounded-lg border border-coconut-200 dark:border-darkbg-border hover:bg-coconut-100 dark:hover:bg-darkbg-subtle disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] font-mono font-bold text-coconut-800 dark:text-darkbg-text px-1">
                  第 {currentPageIndex + 1} / {numPages} 页
                </span>
                <button
                  type="button"
                  onClick={handleNextPage}
                  disabled={currentPageIndex >= pages.length - 1}
                  className="p-1 rounded-lg border border-coconut-200 dark:border-darkbg-border hover:bg-coconut-100 dark:hover:bg-darkbg-subtle disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* 拟真纸张舞台 */}
          <div className="relative w-full aspect-[1/1.414] max-h-[560px] mx-auto bg-white rounded-2xl shadow-xl border border-coconut-300 dark:border-darkbg-border overflow-hidden flex items-center justify-center">
            {renderingPreview ? (
              <div className="text-center space-y-2">
                <Loader2 className="w-7 h-7 mx-auto text-orange-500 animate-spin" />
                <p className="text-xs text-coconut-600 dark:text-darkbg-muted font-medium">
                  正在提取文档页面作为预览底图...
                </p>
              </div>
            ) : renderError || !currentPage ? (
              <div className="p-4 text-center text-xs text-coconut-500">
                <FileText className="w-8 h-8 mx-auto text-coconut-400 mb-2" />
                <span>无法提取页面底图，将使用白底画布预览</span>
              </div>
            ) : (
              /* 原版页面真实底图 */
              <img
                src={currentPage.image}
                alt="Document Preview"
                className="w-full h-full object-contain pointer-events-none select-none"
              />
            )}

            {/* 实时动态水印图层：绝对居中、实时旋转、实时半透明度 */}
            <div
              className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden"
              aria-hidden="true"
            >
              <div
                style={{
                  transform: `rotate(-${watermarkAngle}deg)`,
                  opacity: watermarkOpacity,
                  color: "#6b7280",
                }}
                className="text-center font-bold tracking-widest whitespace-nowrap select-none transition-transform duration-150 ease-out"
              >
                <span className="text-xl sm:text-2xl md:text-3xl lg:text-4xl drop-shadow-2xs">
                  {watermarkText.trim() || "内部机密"}
                </span>
              </div>
            </div>

            {/* 右下角比例徽章 */}
            <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-xs text-[10px] text-white font-mono">
              100% 矢量居中 · 实时渲染
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
