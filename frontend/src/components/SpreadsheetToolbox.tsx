"use client";

import React, { useState, useEffect } from "react";
import {
  TableProperties,
  Combine,
  Scissors,
  ShieldCheck,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Layers,
  ArrowRight,
  Filter,
  Columns,
  Check,
  Archive,
} from "lucide-react";
import Dropzone from "@/components/Dropzone";
import ScrollableTabNav from "@/components/ScrollableTabNav";
import { useI18n } from "@/lib/i18n";
import { downloadBlob } from "@/lib/api";
import { formatBytes } from "@/lib/imageProcessor";
import {
  probeSpreadsheet,
  mergeSpreadsheets,
  splitSpreadsheet,
  SheetProbeResult,
  MergeResult,
  SplitResult,
} from "@/lib/spreadsheetProcessor";

export type SpreadsheetTab = "sheet-merge" | "sheet-split";

export interface SpreadsheetToolboxProps {
  currentTab?: SpreadsheetTab;
  onTabChange?: (tab: SpreadsheetTab) => void;
  incomingFiles?: File[];
  onIncomingFilesHandled?: () => void;
}

export default function SpreadsheetToolbox({
  currentTab,
  onTabChange,
  incomingFiles,
  onIncomingFilesHandled,
}: SpreadsheetToolboxProps = {}) {
  const { lang, t } = useI18n();
  const [activeTab, setActiveTab] = useState<SpreadsheetTab>(currentTab || "sheet-merge");

  // 多表合并状态
  const [mergeFiles, setMergeFiles] = useState<File[]>([]);
  const [mergeMode, setMergeMode] = useState<"union" | "intersection">("union");
  const [appendSourceCol, setAppendSourceCol] = useState(true);
  const [sourceColName, setSourceColName] = useState(lang === "en" ? "Source_File" : "数据来源文件");
  const [deduplicate, setDeduplicate] = useState(false);
  const [mergeProbe, setMergeProbe] = useState<SheetProbeResult | null>(null);
  const [isMerging, setIsMerging] = useState(false);
  const [mergeProgressText, setMergeProgressText] = useState("");
  const [mergeResult, setMergeResult] = useState<MergeResult | null>(null);

  // 单表拆分状态
  const [splitFile, setSplitFile] = useState<File | null>(null);
  const [splitProbe, setSplitProbe] = useState<SheetProbeResult | null>(null);
  const [splitColIndex, setSplitColIndex] = useState<number>(0);
  const [includeHeader, setIncludeHeader] = useState(true);
  const [prefixWithOriginalName, setPrefixWithOriginalName] = useState(true);
  const [isSplitting, setIsSplitting] = useState(false);
  const [splitProgressText, setSplitProgressText] = useState("");
  const [splitResult, setSplitResult] = useState<SplitResult | null>(null);

  const [error, setError] = useState<string | null>(null);

  // 响应外部传入 Tab 切换
  useEffect(() => {
    if (currentTab && currentTab !== activeTab) {
      setActiveTab(currentTab);
      setError(null);
    }
  }, [currentTab]);

  // 响应外部拖入/关联文件
  useEffect(() => {
    if (incomingFiles && incomingFiles.length > 0) {
      if (activeTab === "sheet-merge") {
        setMergeFiles((prev) => [...prev, ...incomingFiles]);
      } else {
        setSplitFile(incomingFiles[0]);
      }
      onIncomingFilesHandled?.();
    }
  }, [incomingFiles]);

  const handleTabSelect = (tabId: SpreadsheetTab) => {
    setActiveTab(tabId);
    setError(null);
    onTabChange?.(tabId);
  };

  // 探测多表合并首个文件的表头
  useEffect(() => {
    if (mergeFiles.length > 0) {
      probeSpreadsheet(mergeFiles[0])
        .then((res) => setMergeProbe(res))
        .catch(() => setMergeProbe(null));
    } else {
      setMergeProbe(null);
      setMergeResult(null);
    }
  }, [mergeFiles]);

  // 探测拆分文件的表头与列
  useEffect(() => {
    if (splitFile) {
      probeSpreadsheet(splitFile)
        .then((res) => {
          setSplitProbe(res);
          setSplitColIndex(0);
        })
        .catch((err) => {
          setSplitProbe(null);
          setError(err?.message || "解析表格失败");
        });
    } else {
      setSplitProbe(null);
      setSplitResult(null);
    }
  }, [splitFile]);

  // 执行多表合并
  const handleExecuteMerge = async () => {
    if (mergeFiles.length === 0) {
      setError(lang === "en" ? "Please select at least 1 Excel/CSV file" : "请先选择需要合并的 Excel/CSV 文件");
      return;
    }
    setError(null);
    setIsMerging(true);
    setMergeResult(null);

    try {
      const result = await mergeSpreadsheets(
        mergeFiles,
        {
          mode: mergeMode,
          appendSourceCol,
          sourceColName,
          deduplicate,
          headerRowIndex: 0,
        },
        (progress) => {
          setMergeProgressText(`[${progress.current}/${progress.total}] ${progress.currentFile}`);
        }
      );
      setMergeResult(result);
    } catch (err: any) {
      setError(err?.message || (lang === "en" ? "Failed to merge sheets" : "合并表格失败"));
    } finally {
      setIsMerging(false);
      setMergeProgressText("");
    }
  };

  // 执行单表拆分
  const handleExecuteSplit = async () => {
    if (!splitFile) {
      setError(lang === "en" ? "Please select an Excel/CSV file to split" : "请先选择待拆分的 Excel/CSV 文件");
      return;
    }
    setError(null);
    setIsSplitting(true);
    setSplitResult(null);

    try {
      const result = await splitSpreadsheet(
        splitFile,
        {
          splitColumnIndex: splitColIndex,
          headerRowIndex: 0,
          includeHeader,
          prefixWithOriginalName,
        },
        (progress) => {
          setSplitProgressText(`[${progress.current}/${progress.total}] 正在生成分组: ${progress.currentKey}`);
        }
      );
      setSplitResult(result);
    } catch (err: any) {
      setError(err?.message || (lang === "en" ? "Failed to split sheet" : "拆分表格失败"));
    } finally {
      setIsSplitting(false);
      setSplitProgressText("");
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* 顶栏 Tab 切换 */}
      <ScrollableTabNav
        tabs={[
          {
            id: "sheet-merge",
            label: t.spreadsheet.mergeTab,
            icon: Combine,
            badge: t.spreadsheet.badgeMerge,
          },
          {
            id: "sheet-split",
            label: t.spreadsheet.splitTab,
            icon: Scissors,
            badge: t.spreadsheet.badgeSplit,
          },
        ]}
        activeTab={activeTab}
        onTabChange={(id) => handleTabSelect(id as SpreadsheetTab)}
      />

      {/* 错误提示条 */}
      {error && (
        <div className="p-4 bg-toast-50 dark:bg-toast-950/40 border border-toast-200 dark:border-toast-900/60 rounded-2xl flex items-center gap-3 text-toast-700 dark:text-toast-300 text-xs sm:text-sm animate-fade-in">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-toast-500" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* ================= 1. 多表智能纵向拼合面板 ================= */}
      {activeTab === "sheet-merge" && (
        <div className="space-y-6">
          <div className="coconut-panel p-6 sm:p-8 space-y-6">
            {/* 企业级顶栏 */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#D2BCAB]/30 dark:border-[#4D392E]/40">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md shadow-emerald-500/25 flex items-center justify-center text-white flex-shrink-0">
                  <TableProperties className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center flex-wrap gap-2">
                    <h3 className="text-base sm:text-lg font-extrabold text-coconut-900 dark:text-darkbg-text tracking-tight">
                      {t.spreadsheet.mergeTab}
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 tracking-wider uppercase">
                      {t.spreadsheet.badgeMerge}
                    </span>
                  </div>
                  <p className="text-xs text-coconut-600 dark:text-darkbg-muted leading-relaxed max-w-xl">
                    {lang === "en"
                      ? "Automatically detect headers across multiple files, align missing columns, and merge into one unified sheet."
                      : "自动跨文件探测表头，智能列名重排对齐，缺失字段自动留空补位，秒级拼接为一份完整总表。"}
                  </p>
                </div>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold self-start sm:self-auto flex-shrink-0">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>100% 本地沙盒 · 零云端上传</span>
              </div>
            </div>

            {/* 拖拽上传区 */}
            <Dropzone
              accept=".xlsx,.xls,.csv"
              multiple={true}
              selectedFiles={mergeFiles}
              onFilesSelected={(newFiles) => setMergeFiles((prev) => [...prev, ...newFiles])}
              onClear={() => {
                setMergeFiles([]);
                setMergeResult(null);
              }}
              title={t.spreadsheet.dropzoneMergeTitle}
              hint={t.spreadsheet.dropzoneMergeHint}
            />

            {/* 合并高级参数配置 */}
            {mergeFiles.length > 0 && (
              <div className="p-5 sm:p-6 bg-coconut-100/40 dark:bg-darkbg-subtle/40 border border-coconut-200/80 dark:border-darkbg-border rounded-2xl space-y-5">
                <div className="flex items-center gap-2 text-sm font-bold text-coconut-900 dark:text-darkbg-text">
                  <Columns className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>{lang === "en" ? "Merge Pipeline Options" : "合并管线参数配置"}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* 对齐模式 */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-coconut-800 dark:text-darkbg-text">
                      {t.spreadsheet.mergeMode}
                    </label>
                    <select
                      value={mergeMode}
                      onChange={(e) => setMergeMode(e.target.value as any)}
                      className="w-full px-3.5 py-2 text-xs sm:text-sm bg-white/90 dark:bg-darkbg-card border border-coconut-300 dark:border-darkbg-border rounded-xl text-coconut-900 dark:text-darkbg-text focus:outline-none focus:border-emerald-500 shadow-2xs"
                    >
                      <option value="union">{t.spreadsheet.modeUnion}</option>
                      <option value="intersection">{t.spreadsheet.modeIntersection}</option>
                    </select>
                  </div>

                  {/* 来源文件名列 */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-coconut-800 dark:text-darkbg-text">
                        {t.spreadsheet.appendSourceCol}
                      </label>
                      <input
                        type="checkbox"
                        checked={appendSourceCol}
                        onChange={(e) => setAppendSourceCol(e.target.checked)}
                        className="rounded accent-emerald-600 cursor-pointer"
                      />
                    </div>
                    <input
                      type="text"
                      disabled={!appendSourceCol}
                      value={sourceColName}
                      onChange={(e) => setSourceColName(e.target.value)}
                      placeholder={t.spreadsheet.sourceColName}
                      className="w-full px-3.5 py-2 text-xs sm:text-sm bg-white/90 dark:bg-darkbg-card border border-coconut-300 dark:border-darkbg-border rounded-xl text-coconut-900 dark:text-darkbg-text disabled:opacity-50 focus:outline-none focus:border-emerald-500 shadow-2xs"
                    />
                  </div>

                  {/* 整行去重 */}
                  <div className="space-y-1.5 flex flex-col justify-end">
                    <label className="flex items-center gap-2 p-2 bg-white/90 dark:bg-darkbg-card border border-coconut-300 dark:border-darkbg-border rounded-xl cursor-pointer text-xs sm:text-sm font-semibold text-coconut-900 dark:text-darkbg-text select-none">
                      <input
                        type="checkbox"
                        checked={deduplicate}
                        onChange={(e) => setDeduplicate(e.target.checked)}
                        className="rounded accent-emerald-600"
                      />
                      <span>{t.spreadsheet.deduplicate}</span>
                    </label>
                  </div>
                </div>

                {/* 表头探针与微芯片预览 */}
                {mergeProbe && mergeProbe.headers.length > 0 && (
                  <div className="pt-3 border-t border-coconut-200/60 dark:border-darkbg-border space-y-2.5">
                    <div className="flex items-center justify-between text-xs text-coconut-600 dark:text-darkbg-muted">
                      <span className="font-semibold text-coconut-800 dark:text-darkbg-text">
                        {lang === "en"
                          ? `Sample Headers from "${mergeProbe.fileName}" (${mergeProbe.headers.length} columns):`
                          : `首个文件表头采样 (${mergeProbe.headers.length} 个字段):`}
                      </span>
                      <span>数据行约 {mergeProbe.totalRows} 行</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 bg-white/60 dark:bg-darkbg-card/60 rounded-xl border border-coconut-200/50 dark:border-darkbg-border/60">
                      {mergeProbe.headers.map((h, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 text-[11px] font-mono bg-coconut-100 dark:bg-darkbg-subtle text-coconut-800 dark:text-darkbg-text rounded-md border border-coconut-200/60 dark:border-darkbg-border"
                        >
                          {h}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 行动按钮 */}
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-xs text-coconut-600 dark:text-darkbg-muted">
                    已选 {mergeFiles.length} 个文件 · 总大小{" "}
                    {formatBytes(mergeFiles.reduce((acc, f) => acc + f.size, 0))}
                  </div>

                  <button
                    onClick={handleExecuteMerge}
                    disabled={isMerging}
                    className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-md shadow-emerald-600/25 disabled:opacity-50 flex items-center justify-center gap-2 transition-all active:scale-95"
                  >
                    {isMerging ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{mergeProgressText || "正在流式拼合并写..."}</span>
                      </>
                    ) : (
                      <>
                        <Combine className="w-4 h-4" />
                        <span>{t.spreadsheet.startMergeBtn}</span>
                        <ArrowRight className="w-4 h-4 opacity-70" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* 合并成果下载展示卡片 */}
            {mergeResult && (
              <div className="p-5 sm:p-6 bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl space-y-4 animate-fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-emerald-200/70 dark:border-emerald-800/40">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm flex-shrink-0">
                      <Check className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-emerald-950 dark:text-emerald-200">
                        {mergeResult.filename}
                      </h4>
                      <p className="text-xs text-emerald-700 dark:text-emerald-400">
                        成功合并 {mergeResult.totalMergedRows} 行数据 · 包含 {mergeResult.columnCount} 列字段
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => downloadBlob(mergeResult.blob, mergeResult.filename)}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm flex items-center justify-center gap-2 transition-all"
                  >
                    <Download className="w-4 h-4" />
                    <span>立即保存合并表格</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= 2. 单表大文件按列字段快速拆分面板 ================= */}
      {activeTab === "sheet-split" && (
        <div className="space-y-6">
          <div className="coconut-panel p-6 sm:p-8 space-y-6">
            {/* 企业级顶栏 */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#D2BCAB]/30 dark:border-[#4D392E]/40">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-md shadow-indigo-500/25 flex items-center justify-center text-white flex-shrink-0">
                  <Scissors className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center flex-wrap gap-2">
                    <h3 className="text-base sm:text-lg font-extrabold text-coconut-900 dark:text-darkbg-text tracking-tight">
                      {t.spreadsheet.splitTab}
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 tracking-wider uppercase">
                      {t.spreadsheet.badgeSplit}
                    </span>
                  </div>
                  <p className="text-xs text-coconut-600 dark:text-darkbg-muted leading-relaxed max-w-xl">
                    {lang === "en"
                      ? "Pick a column as grouping key (e.g. Department, Month, City) to split tens of thousands of rows into separate files."
                      : "任选指定数据列（如部门、业务员、月份或城市），一键将上万行大表流式拆解为数十个独立 Excel 并打包。"}
                  </p>
                </div>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold self-start sm:self-auto flex-shrink-0">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>100% 本地沙盒 · 零云端上传</span>
              </div>
            </div>

            {/* 拖拽上传区 */}
            <Dropzone
              accept=".xlsx,.xls,.csv"
              multiple={false}
              selectedFiles={splitFile ? [splitFile] : []}
              onFilesSelected={(newFiles) => {
                if (newFiles.length > 0) setSplitFile(newFiles[0]);
              }}
              onClear={() => {
                setSplitFile(null);
                setSplitResult(null);
              }}
              title={t.spreadsheet.dropzoneSplitTitle}
              hint={t.spreadsheet.dropzoneSplitHint}
            />

            {/* 拆分配置面板 */}
            {splitFile && splitProbe && (
              <div className="p-5 sm:p-6 bg-coconut-100/40 dark:bg-darkbg-subtle/40 border border-coconut-200/80 dark:border-darkbg-border rounded-2xl space-y-5">
                <div className="flex items-center gap-2 text-sm font-bold text-coconut-900 dark:text-darkbg-text">
                  <Filter className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>{lang === "en" ? "Split Grouping Configuration" : "拆分分组条件设置"}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* 分组键选择 */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-coconut-800 dark:text-darkbg-text">
                      {t.spreadsheet.splitColLabel}
                    </label>
                    <select
                      value={splitColIndex}
                      onChange={(e) => setSplitColIndex(parseInt(e.target.value))}
                      className="w-full px-3.5 py-2 text-xs sm:text-sm bg-white/90 dark:bg-darkbg-card border border-coconut-300 dark:border-darkbg-border rounded-xl text-coconut-900 dark:text-darkbg-text focus:outline-none focus:border-indigo-500 shadow-2xs font-medium"
                    >
                      {splitProbe.headers.map((h, i) => (
                        <option key={i} value={i}>
                          第 {i + 1} 列 · {h}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 保留表头 */}
                  <div className="space-y-1.5 flex flex-col justify-end">
                    <label className="flex items-center gap-2 p-2 bg-white/90 dark:bg-darkbg-card border border-coconut-300 dark:border-darkbg-border rounded-xl cursor-pointer text-xs sm:text-sm font-semibold text-coconut-900 dark:text-darkbg-text select-none">
                      <input
                        type="checkbox"
                        checked={includeHeader}
                        onChange={(e) => setIncludeHeader(e.target.checked)}
                        className="rounded accent-indigo-600"
                      />
                      <span>{t.spreadsheet.includeHeader}</span>
                    </label>
                  </div>

                  {/* 前缀带原表名 */}
                  <div className="space-y-1.5 flex flex-col justify-end">
                    <label className="flex items-center gap-2 p-2 bg-white/90 dark:bg-darkbg-card border border-coconut-300 dark:border-darkbg-border rounded-xl cursor-pointer text-xs sm:text-sm font-semibold text-coconut-900 dark:text-darkbg-text select-none">
                      <input
                        type="checkbox"
                        checked={prefixWithOriginalName}
                        onChange={(e) => setPrefixWithOriginalName(e.target.checked)}
                        className="rounded accent-indigo-600"
                      />
                      <span>{t.spreadsheet.prefixFileName}</span>
                    </label>
                  </div>
                </div>

                {/* 启动拆分按钮 */}
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-xs text-coconut-600 dark:text-darkbg-muted">
                    当前文件: {splitFile.name} ({formatBytes(splitFile.size)}) · 约 {splitProbe.totalRows} 行数据
                  </div>

                  <button
                    onClick={handleExecuteSplit}
                    disabled={isSplitting}
                    className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm shadow-md shadow-indigo-600/25 disabled:opacity-50 flex items-center justify-center gap-2 transition-all active:scale-95"
                  >
                    {isSplitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{splitProgressText || "正在流式分组拆解..."}</span>
                      </>
                    ) : (
                      <>
                        <Scissors className="w-4 h-4" />
                        <span>{t.spreadsheet.startSplitBtn}</span>
                        <ArrowRight className="w-4 h-4 opacity-70" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* 拆分产物下载卡片 */}
            {splitResult && (
              <div className="p-5 sm:p-6 bg-indigo-50/80 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/40 rounded-2xl space-y-4 animate-fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-indigo-200/70 dark:border-indigo-800/40">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm flex-shrink-0">
                      <Archive className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-indigo-950 dark:text-indigo-200">
                        {splitResult.zipFilename}
                      </h4>
                      <p className="text-xs text-indigo-700 dark:text-indigo-400">
                        成功分拆为 {splitResult.items.length} 个独立子表格文件
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => downloadBlob(splitResult.zipBlob, splitResult.zipFilename)}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-sm flex items-center justify-center gap-2 transition-all"
                  >
                    <Download className="w-4 h-4" />
                    <span>打包下载全部 (ZIP)</span>
                  </button>
                </div>

                {/* 拆分明细清单 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto pr-1">
                  {splitResult.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-white/90 dark:bg-darkbg-card rounded-xl border border-indigo-200/60 dark:border-darkbg-border flex items-center justify-between gap-2 shadow-2xs"
                    >
                      <div className="truncate">
                        <div className="text-xs font-bold text-coconut-900 dark:text-darkbg-text truncate">
                          {item.key}
                        </div>
                        <div className="text-[11px] text-coconut-500 dark:text-darkbg-muted">
                          {item.rowCount} 行
                        </div>
                      </div>
                      <button
                        onClick={() => downloadBlob(item.blob, item.filename)}
                        title="下载此单表"
                        className="p-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
