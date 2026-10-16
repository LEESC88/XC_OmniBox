"use client";

import React, { useState, useEffect } from "react";
import {
  FileCode2,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Download,
  RotateCcw,
  Sparkles,
  Layers,
  FileCheck,
  ShieldAlert,
  Loader2,
  Table as TableIcon,
  ArrowRight,
  Info,
  Hash,
  Database,
  ExternalLink,
} from "lucide-react";

import Dropzone from "@/components/Dropzone";
import { formatBytes } from "@/lib/imageProcessor";
import {
  probeTableEncoding,
  convertTableEncoding,
  downloadBlob,
  TableEncodingProbeResult,
} from "@/lib/api";

interface TableEncodingFixStudioProps {
  incomingFile?: File | null;
  onFileClear?: () => void;
}

export default function TableEncodingFixStudio({
  incomingFile,
  onFileClear,
}: TableEncodingFixStudioProps) {
  const [file, setFile] = useState<File | null>(incomingFile || null);
  const [probing, setProbing] = useState<boolean>(false);
  const [probeResult, setProbeResult] = useState<TableEncodingProbeResult | null>(null);
  const [probeError, setProbeError] = useState<string | null>(null);

  // 用户手动覆盖的字符集与分隔符
  const [selectedEncoding, setSelectedEncoding] = useState<string>("");
  const [selectedDelimiter, setSelectedDelimiter] = useState<string>("");

  // 导出处理状态
  const [convertingFormat, setConvertingFormat] = useState<string | null>(null);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [convertSuccess, setConvertSuccess] = useState<{
    filename: string;
    targetFormat: string;
    totalRows: number;
  } | null>(null);

  // 当外部传入新文件时自动加载
  useEffect(() => {
    if (incomingFile) {
      setFile(incomingFile);
      setSelectedEncoding("");
      setSelectedDelimiter("");
      setConvertSuccess(null);
      setConvertError(null);
    }
  }, [incomingFile]);

  // 探测文件编码与结构
  useEffect(() => {
    if (!file) {
      setProbeResult(null);
      setProbeError(null);
      return;
    }

    let isMounted = true;
    setProbing(true);
    setProbeError(null);
    setConvertSuccess(null);

    probeTableEncoding(file, {
      overrideEncoding: selectedEncoding || undefined,
      overrideDelimiter: selectedDelimiter || undefined,
    })
      .then((res) => {
        if (!isMounted) return;
        setProbeResult(res);
        if (!selectedEncoding) {
          setSelectedEncoding(res.detectedEncoding.encoding);
        }
        if (!selectedDelimiter) {
          setSelectedDelimiter(res.detectedDelimiter);
        }
      })
      .catch((err: any) => {
        if (!isMounted) return;
        setProbeError(err.message || "表格编码解析失败，请检查文件格式");
      })
      .finally(() => {
        if (isMounted) setProbing(false);
      });

    return () => {
      isMounted = false;
    };
  }, [file, selectedEncoding, selectedDelimiter]);

  // 切换编码方案
  const handleSelectEncoding = (encodingId: string) => {
    setSelectedEncoding(encodingId);
  };

  // 切换分隔符
  const handleSelectDelimiter = (delim: string) => {
    setSelectedDelimiter(delim);
  };

  // 执行转码并导出
  const handleExport = async (targetFormat: "xlsx" | "csv-bom" | "csv-utf8") => {
    if (!file) return;
    setConvertingFormat(targetFormat);
    setConvertError(null);

    try {
      const res = await convertTableEncoding(file, {
        sourceEncoding: selectedEncoding || probeResult?.detectedEncoding.encoding,
        targetFormat,
        delimiter: selectedDelimiter || probeResult?.detectedDelimiter,
      });

      setConvertSuccess({
        filename: res.filename,
        targetFormat: res.targetFormat,
        totalRows: res.totalRows,
      });

      downloadBlob(res.blob, res.filename);
    } catch (err: any) {
      setConvertError(err.message || "表格转码导出失败，请重试");
    } finally {
      setConvertingFormat(null);
    }
  };

  // 重置工作区
  const handleReset = () => {
    setFile(null);
    setProbeResult(null);
    setProbeError(null);
    setSelectedEncoding("");
    setSelectedDelimiter("");
    setConvertSuccess(null);
    setConvertError(null);
    onFileClear?.();
  };

  return (
    <div className="space-y-6">
      {/* 1. 文件选择或拖拽区域 */}
      {!file ? (
        <div className="space-y-4">
          <Dropzone
            accept=".csv,.tsv,.txt"
            multiple={false}
            selectedFiles={file ? [file] : []}
            onFilesSelected={(acceptedFiles: File[]) => {
              if (acceptedFiles.length > 0) {
                setFile(acceptedFiles[0]);
                setSelectedEncoding("");
                setSelectedDelimiter("");
                setConvertSuccess(null);
              }
            }}
            onClear={() => {
              setFile(null);
              setProbeResult(null);
              setConvertSuccess(null);
              onFileClear?.();
            }}
            title="拖放或选择乱码 CSV / TSV / 文本表格"
            hint="支持国内网银流水、ERP财务导出、税控报表及各类双击打开出现“锟斤拷/烫烫烫”的表格"
            badge="智能编码拯救"
          />

          {/* 典型乱码痛点科普小贴士 */}
          <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 dark:bg-amber-500/10 space-y-2">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-xs sm:text-sm">
              <Sparkles className="w-4 h-4 flex-shrink-0" />
              <span>为什么银行/ERP导出的表格用 Excel 打开全是乱码？</span>
            </div>
            <p className="text-xs text-[#7D6B5D] dark:text-[#BCA89B] leading-relaxed">
              国内主流商业银行（工行、招行、建行等）与财务 ERP 系统常沿用 Windows ANSI (GBK/GB18030) 编码导出，而 Office Excel 或 Mac 默认按 UTF-8 解码，导致汉字出现著名的“锟斤拷 / 烫烫烫”乱码。本工具在本地自动嗅探原始字符集，并一键无损重建为双击必开的标杆 Excel (.xlsx) 或 Excel 兼容 UTF-8 表格。
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* 文件概览条 */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-white/70 dark:bg-[#201815]/70 border border-[#D2BCAB]/40 dark:border-[#4D392E]/50 shadow-sm backdrop-blur-md">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-sm text-[#2D221E] dark:text-[#F5EBE6] truncate max-w-[280px] sm:max-w-md">
                  {file.name}
                </h3>
                <div className="flex items-center gap-2 text-xs text-[#7D6B5D] dark:text-[#BCA89B]">
                  <span>{formatBytes(file.size)}</span>
                  {probeResult && (
                    <>
                      <span>·</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {probeResult.totalRows.toLocaleString()} 行数据
                      </span>
                      <span>·</span>
                      <span>{probeResult.totalCols} 列</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={handleReset}
              className="px-3 py-1.5 rounded-lg border border-[#D2BCAB]/50 dark:border-[#4D392E]/60 text-xs text-[#7D6B5D] dark:text-[#BCA89B] hover:text-[#2D221E] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>更换文件</span>
            </button>
          </div>

          {/* 探测加载状态 */}
          {probing && (
            <div className="py-12 flex flex-col items-center justify-center space-y-3 text-[#7D6B5D] dark:text-[#BCA89B]">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
              <p className="text-xs font-medium">正在深度嗅探字符编码与数据结构...</p>
            </div>
          )}

          {/* 探测错误提示 */}
          {probeError && (
            <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{probeError}</span>
            </div>
          )}

          {/* 2. 探测诊断与智能识别看板 */}
          {!probing && probeResult && (
            <div className="space-y-6">
              {/* 核心诊断卡片 */}
              <div className="p-4 sm:p-5 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-amber-500/10 space-y-3 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500 text-black shadow-sm flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>智能识别：{probeResult.detectedEncoding.label}</span>
                    </span>
                    <span className="text-xs text-amber-700 dark:text-amber-300 font-semibold">
                      (可信度 {Math.round(probeResult.detectedEncoding.confidence * 100)}%)
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-[#7D6B5D] dark:text-[#BCA89B]">
                    <span>分隔符：</span>
                    <span className="font-mono font-bold px-2 py-0.5 rounded bg-black/5 dark:bg-white/10 text-[#2D221E] dark:text-white">
                      {probeResult.activeDelimiter === ","
                        ? "逗号 (,)"
                        : probeResult.activeDelimiter === "\t"
                        ? "制表符 (Tab)"
                        : probeResult.activeDelimiter === ";"
                        ? "分号 (;)"
                        : `字符 (${probeResult.activeDelimiter})`}
                    </span>
                  </div>
                </div>

                {/* 诊断解释 */}
                <div className="text-xs text-[#7D6B5D] dark:text-[#BCA89B] leading-relaxed">
                  {probeResult.detectedEncoding.encoding === "gb18030" ? (
                    <p className="text-amber-800 dark:text-amber-200">
                      💡 <strong>诊断结论</strong>：文件为国内标准 <strong>GBK/GB18030</strong> 字符集。由于无 BOM 标头，原生 Excel 双击打开必然产生“锟斤拷”乱码。本工具已无损还原字符，请直接导出为标准 Excel 或带 BOM 的 CSV。
                    </p>
                  ) : probeResult.detectedEncoding.encoding === "utf-8" && !probeResult.detectedEncoding.hasBom ? (
                    <p className="text-amber-800 dark:text-amber-200">
                      💡 <strong>诊断结论</strong>：文件为 <strong>UTF-8（无 BOM）</strong> 字符集。中文版 Windows Excel 双击时会自动误判为 GBK 从而显示乱码（如“浜ゆ槗”）。建议导出为带 BOM 的 CSV 或标准 Excel (.xlsx)。
                    </p>
                  ) : (
                    <p className="text-emerald-700 dark:text-emerald-300">
                      ✅ <strong>诊断结论</strong>：文件采用 <strong>{probeResult.detectedEncoding.label}</strong> 编码，结构清晰完整。
                    </p>
                  )}
                </div>
              </div>

              {/* 3. 候选字符集快速切换对比 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-[#2D221E] dark:text-[#F5EBE6]">
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-amber-500" />
                    <span>若预览仍有乱码，可手动切换候选编码查看效果：</span>
                  </div>
                  <span className="text-[11px] font-normal text-[#7D6B5D] dark:text-[#BCA89B]">
                    点击即可实时刷新下方表格
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                  {probeResult.candidateEncodings.map((cand) => {
                    const isSelected = selectedEncoding === cand.id;
                    return (
                      <button
                        key={cand.id}
                        type="button"
                        onClick={() => handleSelectEncoding(cand.id)}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          isSelected
                            ? "border-amber-500 bg-amber-500/15 shadow-sm text-amber-900 dark:text-amber-200 font-bold"
                            : "border-[#D2BCAB]/30 dark:border-[#4D392E]/40 bg-white/40 dark:bg-black/20 hover:border-amber-500/60 text-[#7D6B5D] dark:text-[#BCA89B]"
                        }`}
                      >
                        <div className="text-xs truncate">{cand.label.split(" (")[0]}</div>
                        <div className="text-[10px] font-mono opacity-60 truncate mt-1">
                          {cand.snippet || "—"}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. 实时数据网格预览 (带前导零与数字校验) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-[#2D221E] dark:text-[#F5EBE6]">
                  <div className="flex items-center gap-1.5">
                    <TableIcon className="w-3.5 h-3.5 text-amber-500" />
                    <span>转码效果实时预览 (前 {probeResult.previewRows.length} 行)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-normal text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                      文字清晰即代表修正成功
                    </span>
                  </div>
                </div>

                <div className="w-full overflow-x-auto rounded-xl border border-[#D2BCAB]/40 dark:border-[#4D392E]/50 bg-white dark:bg-[#1E1714] shadow-inner max-h-[360px] scrollbar-thin">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="sticky top-0 bg-[#F5EBE6] dark:bg-[#2A201C] border-b border-[#D2BCAB]/40 dark:border-[#4D392E]/60 z-10">
                      <tr>
                        <th className="px-3 py-2 w-12 text-center text-[10px] text-[#7D6B5D]/60 dark:text-[#BCA89B]/60 font-mono border-r border-[#D2BCAB]/20">
                          #
                        </th>
                        {(probeResult.headers || []).map((header, idx) => (
                          <th
                            key={idx}
                            className="px-3 py-2 font-bold text-[#2D221E] dark:text-[#F5EBE6] whitespace-nowrap border-r border-[#D2BCAB]/20 last:border-r-0"
                          >
                            {header || `列 ${idx + 1}`}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#D2BCAB]/15 dark:divide-[#4D392E]/30 font-mono">
                      {probeResult.previewRows.map((row, rIdx) => (
                        <tr
                          key={rIdx}
                          className="hover:bg-amber-500/5 transition-colors odd:bg-transparent even:bg-black/[0.015] dark:even:bg-white/[0.015]"
                        >
                          <td className="px-3 py-1.5 text-center text-[10px] text-[#7D6B5D]/60 dark:text-[#BCA89B]/60 border-r border-[#D2BCAB]/20 select-none">
                            {rIdx + 1}
                          </td>
                          {row.map((cell, cIdx) => (
                            <td
                              key={cIdx}
                              className="px-3 py-1.5 whitespace-nowrap text-[#2D221E] dark:text-[#F5EBE6] border-r border-[#D2BCAB]/20 last:border-r-0 max-w-[320px] truncate"
                              title={cell}
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 5. 导出错误或成功提示 */}
              {convertError && (
                <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{convertError}</span>
                </div>
              )}

              {convertSuccess && (
                <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs flex items-center justify-between gap-2 animate-fadeIn">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-500" />
                    <span>
                      转码完成并已自动下载：<strong>{convertSuccess.filename}</strong>（共{" "}
                      {convertSuccess.totalRows.toLocaleString()} 行）
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-600">双击必开无乱码</span>
                </div>
              )}

              {/* 6. 三大一键无损导出方案卡片 */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold text-[#2D221E] dark:text-[#F5EBE6] flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5 text-amber-500" />
                  <span>请选择导出方案（点击即可立即转换并下载）：</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* 方案 A: 标准 Excel (.xlsx) - 强烈推荐 */}
                  <div className="p-4 rounded-2xl border-2 border-amber-500 bg-amber-500/10 flex flex-col justify-between space-y-4 shadow-sm relative overflow-hidden group">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-500 text-black uppercase">
                          首选推荐
                        </span>
                        <FileSpreadsheet className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                      </div>
                      <h5 className="font-bold text-sm text-[#2D221E] dark:text-white">
                        标准 Excel 工作簿 (.xlsx)
                      </h5>
                      <p className="text-xs text-[#7D6B5D] dark:text-[#BCA89B] leading-relaxed">
                        转换为原生 Office OpenXML 表格。<strong>绝无乱码</strong>
                        ，且智能锁定保护身份证、银行卡号与编码前导零（不会被 Excel 搞成 6.22E+18）。
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={convertingFormat !== null}
                      onClick={() => handleExport("xlsx")}
                      className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-400 text-black shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {convertingFormat === "xlsx" ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>正在转码生成...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          <span>一键导出 Excel (.xlsx)</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* 方案 B: 带 BOM 的 CSV (.csv) */}
                  <div className="p-4 rounded-2xl border border-[#D2BCAB]/40 dark:border-[#4D392E]/50 bg-white/60 dark:bg-[#201815]/60 flex flex-col justify-between space-y-4 shadow-sm hover:border-amber-500/50 transition-colors">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                          全平台双击兼容
                        </span>
                        <FileCheck className="w-5 h-5 text-emerald-500" />
                      </div>
                      <h5 className="font-bold text-sm text-[#2D221E] dark:text-white">
                        Excel 兼容 CSV (带 BOM)
                      </h5>
                      <p className="text-xs text-[#7D6B5D] dark:text-[#BCA89B] leading-relaxed">
                        添加标准的 UTF-8 BOM 标头。Windows 与 Mac Excel 双击直接打开，彻底告别“锟斤拷”。
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={convertingFormat !== null}
                      onClick={() => handleExport("csv-bom")}
                      className="w-full py-2.5 px-4 rounded-xl font-bold text-xs border border-[#D2BCAB]/60 dark:border-[#4D392E]/80 hover:border-amber-500 bg-white dark:bg-black/30 hover:bg-amber-500/10 text-[#2D221E] dark:text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {convertingFormat === "csv-bom" ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>正在转码生成...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          <span>导出带 BOM 的 CSV</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* 方案 C: 纯 UTF-8 CSV (无 BOM) */}
                  <div className="p-4 rounded-2xl border border-[#D2BCAB]/40 dark:border-[#4D392E]/50 bg-white/60 dark:bg-[#201815]/60 flex flex-col justify-between space-y-4 shadow-sm hover:border-amber-500/50 transition-colors">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/15 text-blue-600 dark:text-blue-400">
                          程序 / 数据库标准
                        </span>
                        <Database className="w-5 h-5 text-blue-500" />
                      </div>
                      <h5 className="font-bold text-sm text-[#2D221E] dark:text-white">
                        纯净 UTF-8 CSV (无 BOM)
                      </h5>
                      <p className="text-xs text-[#7D6B5D] dark:text-[#BCA89B] leading-relaxed">
                        标准的 Unix 纯 UTF-8 格式，适合导入 MySQL、PostgreSQL、Python Pandas 或各类服务端接口。
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={convertingFormat !== null}
                      onClick={() => handleExport("csv-utf8")}
                      className="w-full py-2.5 px-4 rounded-xl font-bold text-xs border border-[#D2BCAB]/60 dark:border-[#4D392E]/80 hover:border-amber-500 bg-white dark:bg-black/30 hover:bg-amber-500/10 text-[#2D221E] dark:text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {convertingFormat === "csv-utf8" ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>正在转码生成...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          <span>导出纯 UTF-8 CSV</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
