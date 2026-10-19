"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  FileText,
  Sparkles,
  Download,
  ClipboardPaste,
  Upload,
  Trash2,
  CheckCircle2,
  Loader2,
  Table as TableIcon,
  ListChecks,
  Heading,
  Code2,
  Eye,
  Sliders,
  Award,
  BookOpen,
  Briefcase,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
} from "lucide-react";
import {
  inspectMarkdown,
  convertMarkdownToWord,
  downloadBlob,
  MarkdownInspectResult,
  WordTemplateType,
} from "@/lib/api";
import { useI18n } from "@/lib/i18n";

interface AiMarkdownToWordStudioProps {
  incomingFiles?: File[];
  onIncomingFilesHandled?: () => void;
}

const SAMPLE_ZH_MARKDOWN = `好的，为您起草一份关于2026年度全集团数字化与人工智能转型专项工作报告：

# 关于推进2026年度人工智能与数字化办公提效专项行动的通知

各部门、各直属业务中心：

为全面落实集团数字化升级战略，解决日常办公中从 **DeepSeek**、**Kimi**、**ChatGPT** 等大模型复制材料至 Word 时出现的*表格崩坏*、*标题失序*及==行距混乱==问题，现就专项行动有关事项通知如下：

## 一、 总体建设目标

通过引入原生 \`OpenXML (ECMA-376)\` 编译内核与双轨中西文字体映射机制，实现文档排版准确度 $P \\ge 99.5\\%$，公式如 $\\Delta t = t_1 \\times \\alpha + \\beta$ 自动美化。

> [!IMPORTANT]
> 各单位需在 2026 年第二季度前完成全员办公规范对齐，确保所有材料符合标准版式要求。

### （一） 核心建设指标对照表

| 评估维度 | 传统网页直接粘贴 | XC OmniBox 标准引擎 | 提升幅度 |
| :--- | :--- | :--- | ---: |
| 表格边框与列宽 | 边框丢失、窄列竖排挤压 | **智能防挤压列宽** + 标准网格/三线表 | +300% |
| 标题与大纲层级 | 变成普通粗体、无大纲级别 | 原生 \`Heading 1~3\` + 自动防孤行 | 100% 还原 |
| 中西文混排字体 | 英文变宋体等宽丑字 | 中文仿宋/雅黑 + 西文 Times/Arial | 完美双轨 |

## 二、 核心算法与自动化脚本

各业务系统已集成如下打卡工时裁剪核心逻辑：

\`\`\`typescript
private calculatedDuration(
  clockIn: string | null,
  clockOut: string | null,
  workingTime?: string | null,
  employmentType: string = 'Full-Time',
  lunchBreak?: string | null,
): string {
  if (!clockIn || !clockOut || clockIn === '-' || clockOut === '-')
    return '-';

  // 1. 获取班次标准上班时间，做早到截断（与前端一致）
  const shiftStr =
    workingTime && workingTime !== '-' ? workingTime : '08:00 - 17:30';
  const cleanTime = shiftStr.replace(/:/g, '');
  const shiftStart = cleanTime.split(' - ')[0] || '0800';

  let stdInH = parseInt(shiftStart.substring(0, 2), 10);
  let stdInM = parseInt(shiftStart.substring(2, 4), 10);
  if (isNaN(stdInH)) stdInH = 8;
  if (isNaN(stdInM)) stdInM = 0;
  const stdInSeconds = stdInH * 3600 + stdInM * 60;

  const [inH, inM, inS = 0] = String(clockIn).split(':').map(Number);
  const actualInSeconds = inH * 3600 + inM * 60 + inS;

  // 起算点取标准班次与实际打卡的最大值（防早到蹭工时）
  const effectiveStartSeconds = Math.max(stdInSeconds, actualInSeconds);

  const [outH, outM, outS = 0] = String(clockOut).split(':').map(Number);
  const outSeconds = outH * 3600 + outM * 60 + outS;
  return cleanTime;
}
\`\`\`

## 三、 重点推进事项自查打勾清单

- [x] 已完成本地无头 Node.js 编译引擎部署
- [x] 已完成 VS Code IDE 高亮着色与代码块暗色主题适配
- [x] 已通过本地 Microsoft Word COM 真实打开检验
- [ ] 待启动全集团数字化办公模板推广培训

希望以上内容对您有所帮助！如果您需要进一步修改，请随时告诉我。`;

const SAMPLE_EN_MARKDOWN = `# Comprehensive Technical Evaluation & Q2 Digital Transformation Roadmap

Executive Leadership Team & Department Heads:

To accelerate enterprise-wide engineering efficiency and resolve common formatting breakdowns when copying reports, tables, or code from **DeepSeek**, **Kimi**, and **ChatGPT** into Microsoft Word, this directive establishes the technical specifications for standard document compilation.

## 1. Executive Summary & Core Objectives

By implementing a native \`OpenXML (ECMA-376)\` AST compiler with dual-script font mapping, document layout accuracy reaches $P \\ge 99.5\\%$. Inline equations such as $\\Delta t = t_1 \\times \\alpha + \\beta$ are automatically refined into high-contrast mathematical typography.

> [!IMPORTANT]
> All departments are expected to align documentation output with this standard format by Q2 2026.

### Benchmark Comparison Matrix

| Evaluation Dimension | Legacy Direct Web Paste | XC OmniBox Standard Engine | Improvement |
| :--- | :--- | :--- | ---: |
| Table Borders & Width | Borders ruined, narrow columns stacked | **Dynamic anti-squeeze column width** + Three-line tables | +300% |
| Heading Hierarchy | Flat bold text, missing TOC outline | Native \`Heading 1~3\` with auto-orphan prevention | 100% Preserved |
| Typography & Scripts | Monospaced distorted CJK mixing | Dual-script Times/Arial + YaHei/SimSun | Enterprise Grade |

## 2. Core Implementation Logic

The following TypeScript snippet demonstrates the automated shift timestamp normalization and boundary calculation:

\`\`\`typescript
private calculatedDuration(
  clockIn: string | null,
  clockOut: string | null,
  workingTime?: string | null,
  employmentType: string = 'Full-Time',
  lunchBreak?: string | null,
): string {
  if (!clockIn || !clockOut || clockIn === '-' || clockOut === '-')
    return '-';

  // 1. Calculate standard shift timestamps
  const shiftStr =
    workingTime && workingTime !== '-' ? workingTime : '08:00 - 17:30';
  const cleanTime = shiftStr.replace(/:/g, '');
  const shiftStart = cleanTime.split(' - ')[0] || '0800';

  let stdInH = parseInt(shiftStart.substring(0, 2), 10);
  let stdInM = parseInt(shiftStart.substring(2, 4), 10);
  if (isNaN(stdInH)) stdInH = 8;
  if (isNaN(stdInM)) stdInM = 0;
  const stdInSeconds = stdInH * 3600 + stdInM * 60;

  const [inH, inM, inS = 0] = String(clockIn).split(':').map(Number);
  const actualInSeconds = inH * 3600 + inM * 60 + inS;

  // Maximum bound to prevent early clock-in padding
  const effectiveStartSeconds = Math.max(stdInSeconds, actualInSeconds);

  const [outH, outM, outS = 0] = String(clockOut).split(':').map(Number);
  const outSeconds = outH * 3600 + outM * 60 + outS;
  return cleanTime;
}
\`\`\`

## 3. Deployment Checklist

- [x] Native Node.js OpenXML compilation pipeline verified
- [x] IDE syntax highlighting with dark theme verified
- [x] Standard academic three-line table borders confirmed
- [ ] Enterprise-wide document template migration complete`;

export default function AiMarkdownToWordStudio({
  incomingFiles,
  onIncomingFilesHandled,
}: AiMarkdownToWordStudioProps) {
  const { lang } = useI18n();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 根据当前系统语言自动初始化中/英文示例材料
  const [content, setContent] = useState<string>(() =>
    lang === "en" ? SAMPLE_EN_MARKDOWN : SAMPLE_ZH_MARKDOWN
  );
  const [template, setTemplate] = useState<WordTemplateType>("gov-redhead");
  const [documentTitle, setDocumentTitle] = useState<string>("");
  const [enableRedHeader, setEnableRedHeader] = useState<boolean>(true);
  const [redHeaderOrg, setRedHeaderOrg] = useState<string>(() =>
    lang === "en" ? "OFFICIAL EXECUTIVE DIRECTIVE" : "XC 万象集团办公厅文件"
  );
  const [docNumber, setDocNumber] = useState<string>(() =>
    lang === "en" ? "DOC-2026-001" : "万象办发〔2026〕01号"
  );
  const [firstLineIndent, setFirstLineIndent] = useState<boolean>(true);
  const [includePageNumbers, setIncludePageNumbers] = useState<boolean>(true);
  const [headerText, setHeaderText] = useState<string>("");
  const [cleanAiArtifacts, setCleanAiArtifacts] = useState<boolean>(true);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState<boolean>(false);
  const [copiedCodeIdx, setCopiedCodeIdx] = useState<number | null>(null);

  const [inspectResult, setInspectResult] = useState<MarkdownInspectResult | null>(null);
  const [inspecting, setInspecting] = useState<boolean>(false);
  const [converting, setConverting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastExported, setLastExported] = useState<{
    filename: string;
    size: number;
    blob: Blob;
  } | null>(null);

  // 语言切换时自动更新默认红头文头名称
  useEffect(() => {
    if (lang === "en") {
      if (redHeaderOrg === "XC 万象集团办公厅文件") {
        setRedHeaderOrg("OFFICIAL EXECUTIVE DIRECTIVE");
      }
      if (docNumber === "万象办发〔2026〕01号") {
        setDocNumber("DOC-2026-001");
      }
    } else {
      if (redHeaderOrg === "OFFICIAL EXECUTIVE DIRECTIVE") {
        setRedHeaderOrg("XC 万象集团办公厅文件");
      }
      if (docNumber === "DOC-2026-001") {
        setDocNumber("万象办发〔2026〕01号");
      }
    }
  }, [lang]);

  // 处理外部拖入或传入的 .md / .txt 文件
  useEffect(() => {
    if (incomingFiles && incomingFiles.length > 0) {
      handleFileSelect(incomingFiles[0]);
      onIncomingFilesHandled?.();
    }
  }, [incomingFiles]);

  // 防抖调用后端 inspectMarkdown 解析结构与高亮
  useEffect(() => {
    if (!content.trim()) {
      setInspectResult(null);
      return;
    }
    const timer = setTimeout(async () => {
      setInspecting(true);
      try {
        const res = await inspectMarkdown({
          content,
          cleanAiArtifacts,
        });
        setInspectResult(res);
        setError(null);
      } catch (err: any) {
        setError(err?.message || "解析预览失败");
      } finally {
        setInspecting(false);
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [content, cleanAiArtifacts]);

  const handleFileSelect = async (file: File) => {
    setInspecting(true);
    setError(null);
    try {
      const res = await inspectMarkdown({
        file,
        cleanAiArtifacts,
      });
      setContent(res.normalizedMarkdown);
      setInspectResult(res);
      setLastExported(null);
    } catch (err: any) {
      setError(err?.message || "读取文件失败");
    } finally {
      setInspecting(false);
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.read) {
        try {
          const items = await navigator.clipboard.read();
          for (const item of items) {
            if (item.types.includes("text/html")) {
              const htmlBlob = await item.getType("text/html");
              const htmlText = await htmlBlob.text();
              if (htmlText && htmlText.includes("<table")) {
                const res = await inspectMarkdown({
                  content: htmlText,
                  cleanAiArtifacts,
                });
                setContent(res.normalizedMarkdown);
                setInspectResult(res);
                setLastExported(null);
                return;
              }
            }
          }
        } catch (_) {}
      }
      const clipText = await navigator.clipboard.readText();
      if (clipText) {
        setContent(clipText);
        setLastExported(null);
      }
    } catch (err: any) {
      setError(
        lang === "en"
          ? "Clipboard read failed, please press Ctrl+V in the editor."
          : "无法直接读取剪贴板，请在左侧编辑框按 Ctrl+V 粘贴"
      );
    }
  };

  const handleConvertAndDownload = async () => {
    if (!content.trim()) return;
    setConverting(true);
    setError(null);
    try {
      const res = await convertMarkdownToWord({
        content,
        template,
        documentTitle: documentTitle.trim() || undefined,
        enableRedHeader: template === "gov-redhead" ? enableRedHeader : false,
        redHeaderOrg,
        docNumber,
        firstLineIndent,
        includePageNumbers,
        headerText: headerText.trim() || undefined,
        cleanAiArtifacts,
      });

      setLastExported({
        filename: res.filename,
        size: res.blob.size,
        blob: res.blob,
      });
      downloadBlob(res.blob, res.filename);
    } catch (err: any) {
      setError(
        err?.message ||
          (lang === "en"
            ? "Failed to generate Word document"
            : "生成 Word 文档失败")
      );
    } finally {
      setConverting(false);
    }
  };

  const handleCopyCode = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedCodeIdx(idx);
    setTimeout(() => setCopiedCodeIdx(null), 2000);
  };

  const templateOptions: Array<{
    id: WordTemplateType;
    label: string;
    sub: string;
    icon: React.ReactNode;
  }> = [
    {
      id: "gov-redhead",
      label: lang === "en" ? "Official Red-Header (GB/T 9704)" : "标准红头公文 (GB/T 9704)",
      sub: lang === "en" ? "Red banner + 28pt line spacing" : "红头文武双线 · 仿宋三号 28磅",
      icon: <Award className="w-4 h-4 text-red-600 dark:text-red-400" />,
    },
    {
      id: "business-report",
      label: lang === "en" ? "Modern Business Report" : "现代商务报告 / 研报",
      sub: lang === "en" ? "Blue accents + YaHei/Arial" : "商务蓝饰条 · 雅黑/Arial 双轨",
      icon: <Briefcase className="w-4 h-4 text-blue-600 dark:text-blue-400" />,
    },
    {
      id: "academic-paper",
      label: lang === "en" ? "Academic Three-Line Table" : "学术论文 / 规范三线表",
      sub: lang === "en" ? "Three-line tables + SimSun" : "学术标准三线表 · 宋体/Times",
      icon: <BookOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
    },
  ];

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* 1. 顶部宽敞现代控制栏：版式分段切换器 + 参数抽屉 */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-darkbg-card border border-coconut-200/80 dark:border-darkbg-border shadow-xs space-y-4">
        {/* 顶部标题与模板分段选择器 */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-red-500 to-amber-500 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-coconut-900 dark:text-darkbg-text">
                  {lang === "en"
                    ? "AI / Markdown to Standard Styled Word"
                    : "AI / Markdown 转带样式标准 Word"}
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                  {lang === "en" ? "IDE Highlight & Tables" : "IDE 代码着色 · 真实表格"}
                </span>
              </div>
              <p className="text-xs text-coconut-600 dark:text-darkbg-muted mt-0.5">
                {lang === "en"
                  ? "Transform AI text into publication-ready .docx with syntax-highlighted code, smart tables & dual-script fonts."
                  : "直接粘贴 AI 材料，自动剔除首尾寒暄并编译为带 IDE 代码高亮、智能防挤压表格的标准 Word 文档。"}
              </p>
            </div>
          </div>

          {/* 3 套版式分段胶囊按钮（取代臃肿大卡片，界面宽敞轻盈） */}
          <div className="inline-flex p-1 rounded-2xl bg-coconut-100/70 dark:bg-darkbg-subtle border border-coconut-200/70 dark:border-darkbg-border flex-wrap gap-1">
            {templateOptions.map((opt) => {
              const active = template === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setTemplate(opt.id);
                    if (opt.id === "gov-redhead") setFirstLineIndent(true);
                  }}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    active
                      ? "bg-white dark:bg-darkbg-card text-coconut-900 dark:text-darkbg-text shadow-sm"
                      : "text-coconut-600 dark:text-darkbg-muted hover:text-coconut-900 dark:hover:text-darkbg-text"
                  }`}
                >
                  {opt.icon}
                  <div className="text-left">
                    <div className="leading-tight">{opt.label}</div>
                    <div className="text-[10px] font-normal opacity-70">
                      {opt.sub}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 细节设置展开开关与快速配置项 */}
        <div className="pt-2 border-t border-coconut-100 dark:border-darkbg-border flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 flex-wrap">
            {template === "gov-redhead" && (
              <label className="inline-flex items-center gap-1.5 text-coconut-800 dark:text-darkbg-text cursor-pointer select-none font-medium">
                <input
                  type="checkbox"
                  checked={enableRedHeader}
                  onChange={(e) => setEnableRedHeader(e.target.checked)}
                  className="rounded text-red-600 focus:ring-red-500"
                />
                <span>{lang === "en" ? "Red Header Banner" : "启用红头版头"}</span>
              </label>
            )}

            <label className="inline-flex items-center gap-1.5 text-coconut-800 dark:text-darkbg-text cursor-pointer select-none font-medium">
              <input
                type="checkbox"
                checked={firstLineIndent}
                onChange={(e) => setFirstLineIndent(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span>{lang === "en" ? "2-Char Indentation" : "首行缩进 2 字符"}</span>
            </label>

            <label className="inline-flex items-center gap-1.5 text-coconut-800 dark:text-darkbg-text cursor-pointer select-none font-medium">
              <input
                type="checkbox"
                checked={includePageNumbers}
                onChange={(e) => setIncludePageNumbers(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span>{lang === "en" ? "Dynamic Page Numbers" : "动态页码域"}</span>
            </label>

            <label className="inline-flex items-center gap-1.5 text-coconut-800 dark:text-darkbg-text cursor-pointer select-none font-medium">
              <input
                type="checkbox"
                checked={cleanAiArtifacts}
                onChange={(e) => setCleanAiArtifacts(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-emerald-500"
              />
              <span>{lang === "en" ? "Strip AI Chatter" : "过滤 AI 首尾寒暄"}</span>
            </label>
          </div>

          <button
            type="button"
            onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
            className="inline-flex items-center gap-1.5 text-coconut-600 dark:text-darkbg-muted hover:text-coconut-900 dark:hover:text-darkbg-text font-semibold cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>
              {lang === "en"
                ? showAdvancedSettings
                  ? "Hide Detailed Settings"
                  : "Customize Title & Header"
                : showAdvancedSettings
                  ? "收起高级设置"
                  : "微调标题与发文字号"}
            </span>
            {showAdvancedSettings ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* 展开的微调输入框抽屉 */}
        {showAdvancedSettings && (
          <div className="p-4 rounded-2xl bg-coconut-50/70 dark:bg-darkbg-subtle border border-coconut-200/60 dark:border-darkbg-border grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in duration-200">
            {template === "gov-redhead" ? (
              <>
                <div>
                  <label className="block text-[11px] font-semibold text-coconut-700 dark:text-darkbg-muted mb-1">
                    {lang === "en" ? "Red Header Organization" : "发文机关红头名称"}
                  </label>
                  <input
                    type="text"
                    value={redHeaderOrg}
                    disabled={!enableRedHeader}
                    onChange={(e) => setRedHeaderOrg(e.target.value)}
                    placeholder="如：XC 万象集团办公厅文件"
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-coconut-200 dark:border-darkbg-border bg-white dark:bg-darkbg-card text-coconut-900 dark:text-darkbg-text focus:outline-none focus:border-red-500 disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-coconut-700 dark:text-darkbg-muted mb-1">
                    {lang === "en" ? "Issue Number" : "发文字号 (文武双红线上方)"}
                  </label>
                  <input
                    type="text"
                    value={docNumber}
                    disabled={!enableRedHeader}
                    onChange={(e) => setDocNumber(e.target.value)}
                    placeholder="如：万象办发〔2026〕01号"
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-coconut-200 dark:border-darkbg-border bg-white dark:bg-darkbg-card text-coconut-900 dark:text-darkbg-text focus:outline-none focus:border-red-500 disabled:opacity-50"
                  />
                </div>
              </>
            ) : (
              <div>
                <label className="block text-[11px] font-semibold text-coconut-700 dark:text-darkbg-muted mb-1">
                  {lang === "en" ? "Document Header Text" : "页眉文字 (右上角)"}
                </label>
                <input
                  type="text"
                  value={headerText}
                  onChange={(e) => setHeaderText(e.target.value)}
                  placeholder={lang === "en" ? "e.g. Confidential Report" : "如：内部工作规范"}
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-coconut-200 dark:border-darkbg-border bg-white dark:bg-darkbg-card text-coconut-900 dark:text-darkbg-text focus:outline-none focus:border-blue-500"
                />
              </div>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-coconut-700 dark:text-darkbg-muted mb-1">
                {lang === "en" ? "Override Main Title" : "自定义文档主标题 (留空自动提取)"}
              </label>
              <input
                type="text"
                value={documentTitle}
                onChange={(e) => setDocumentTitle(e.target.value)}
                placeholder={inspectResult?.detectedTitle || "自动提取一级标题"}
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-coconut-200 dark:border-darkbg-border bg-white dark:bg-darkbg-card text-coconut-900 dark:text-darkbg-text focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* 2. 宽敞左右双栏工作台 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* 左栏：输入区 */}
        <div
          className="lg:col-span-6 flex flex-col rounded-3xl bg-white dark:bg-darkbg-card border border-coconut-200/80 dark:border-darkbg-border shadow-xs overflow-hidden"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              handleFileSelect(e.dataTransfer.files[0]);
            }
          }}
        >
          {/* 左栏头部快捷工具条 */}
          <div className="px-5 py-3.5 bg-coconut-50/60 dark:bg-darkbg-subtle border-b border-coconut-200/60 dark:border-darkbg-border flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-coconut-600 dark:text-darkbg-muted" />
              <span className="text-xs font-bold text-coconut-900 dark:text-darkbg-text">
                {lang === "en" ? "AI Content / Markdown" : "AI 内容 / Markdown 源码"}
              </span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={handlePasteFromClipboard}
                className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                <span>{lang === "en" ? "Paste" : "一键粘贴"}</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".md,.markdown,.txt,.html"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileSelect(f);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-coconut-100 text-coconut-800 hover:bg-coconut-200 dark:bg-darkbg-card dark:text-darkbg-text flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{lang === "en" ? "Import .md" : "导入文件"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setContent(lang === "en" ? SAMPLE_EN_MARKDOWN : SAMPLE_ZH_MARKDOWN);
                  setLastExported(null);
                }}
                className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{lang === "en" ? "Sample" : "示例材料"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setContent("");
                  setInspectResult(null);
                  setLastExported(null);
                }}
                className="p-1.5 rounded-xl text-coconut-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                title={lang === "en" ? "Clear" : "清空"}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 宽松舒适的文本编辑区 */}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={
              lang === "en"
                ? "Paste AI-generated text or Markdown here, or drag & drop a .md file..."
                : "在此直接粘贴从 DeepSeek、Kimi、ChatGPT 复制的文本或 Markdown..."
            }
            className="w-full flex-1 min-h-[520px] p-5 text-xs sm:text-sm font-mono leading-relaxed bg-transparent text-coconut-900 dark:text-darkbg-text focus:outline-none resize-none"
          />

          {/* 底部统计栏 */}
          <div className="px-5 py-3 bg-coconut-50/60 dark:bg-darkbg-subtle border-t border-coconut-200/60 dark:border-darkbg-border flex flex-wrap items-center justify-between gap-3 text-xs text-coconut-600 dark:text-darkbg-muted">
            <div className="flex items-center gap-3.5 flex-wrap">
              <span>
                {lang === "en" ? "Words:" : "字数:"}{" "}
                <strong className="text-coconut-900 dark:text-darkbg-text">
                  {inspectResult?.stats.wordCount ?? 0}
                </strong>
              </span>
              <span className="inline-flex items-center gap-1">
                <Heading className="w-3.5 h-3.5 text-blue-500" />
                {lang === "en" ? "Headings:" : "章节:"}{" "}
                <strong className="text-coconut-900 dark:text-darkbg-text">
                  {inspectResult?.stats.headingCount ?? 0}
                </strong>
              </span>
              <span className="inline-flex items-center gap-1">
                <TableIcon className="w-3.5 h-3.5 text-emerald-500" />
                {lang === "en" ? "Tables:" : "表格:"}{" "}
                <strong className="text-coconut-900 dark:text-darkbg-text">
                  {inspectResult?.stats.tableCount ?? 0}
                </strong>
              </span>
              <span className="inline-flex items-center gap-1">
                <Code2 className="w-3.5 h-3.5 text-purple-500" />
                {lang === "en" ? "Code:" : "代码块:"}{" "}
                <strong className="text-coconut-900 dark:text-darkbg-text">
                  {inspectResult?.stats.codeBlockCount ?? 0}
                </strong>
              </span>
            </div>
            {inspecting && (
              <span className="inline-flex items-center gap-1.5 text-blue-600 font-medium">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{lang === "en" ? "Parsing..." : "智能解析中..."}</span>
              </span>
            )}
          </div>
        </div>

        {/* 右栏：仿真 A4 纸张排版预览区 */}
        <div className="lg:col-span-6 flex flex-col rounded-3xl bg-coconut-100/60 dark:bg-darkbg-subtle border border-coconut-200/80 dark:border-darkbg-border shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 bg-white dark:bg-darkbg-card border-b border-coconut-200/60 dark:border-darkbg-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-red-600 dark:text-red-400" />
              <span className="text-xs font-bold text-coconut-900 dark:text-darkbg-text">
                {lang === "en"
                  ? "Live Word A4 Page Preview"
                  : "仿真 Word A4 纸张排版预览"}
              </span>
            </div>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-coconut-100 dark:bg-darkbg-subtle text-coconut-700 dark:text-darkbg-muted">
              {template === "gov-redhead"
                ? "GB/T 9704 红头公文"
                : template === "business-report"
                  ? "现代商务研报"
                  : "学术规范三线表"}
            </span>
          </div>

          {/* 仿真 A4 纸张滚动视口 */}
          <div className="flex-1 p-5 sm:p-6 overflow-y-auto min-h-[520px] max-h-[640px] flex justify-center">
            <div className="w-full max-w-[540px] bg-white text-slate-900 rounded-2xl shadow-md border border-slate-200/80 p-7 sm:p-9 space-y-4 text-xs leading-relaxed">
              {/* 红头公文版头 */}
              {template === "gov-redhead" && enableRedHeader && (
                <div className="text-center pb-3 mb-4 border-b-4 border-double border-[#D40000]">
                  <div className="text-xl sm:text-2xl font-black tracking-widest text-[#D40000] font-serif">
                    {redHeaderOrg || "XC 万象集团办公厅文件"}
                  </div>
                  <div className="text-xs text-slate-700 mt-2 font-serif">
                    {docNumber || "万象办发〔2026〕01号"}
                  </div>
                </div>
              )}

              {/* 文档主标题 */}
              {(documentTitle.trim() || inspectResult?.detectedTitle) && (
                <div
                  className={
                    template === "business-report"
                      ? "text-base font-bold text-slate-900 pb-2 border-b-2 border-blue-600"
                      : "text-center text-base font-bold text-slate-900 py-1 font-serif"
                  }
                >
                  {documentTitle.trim() || inspectResult?.detectedTitle}
                </div>
              )}

              {/* 正文块预览 */}
              {!inspectResult || inspectResult.previewBlocks.length === 0 ? (
                <div className="py-24 text-center text-slate-400 text-xs">
                  {lang === "en"
                    ? "Paste AI text on the left to preview formatted Word document"
                    : "在左侧粘贴材料，此处将实时渲染仿真 Word 排版效果"}
                </div>
              ) : (
                inspectResult.previewBlocks.map((b, idx) => {
                  if (
                    idx === 0 &&
                    b.type === "heading" &&
                    b.level === 1 &&
                    !documentTitle.trim() &&
                    b.text === inspectResult.detectedTitle
                  ) {
                    return null;
                  }

                  if (b.type === "heading") {
                    const lvl = b.level || 1;
                    if (template === "business-report" && lvl === 1) {
                      return (
                        <div
                          key={idx}
                          className="pl-3 py-1.5 bg-blue-50/80 border-l-4 border-blue-600 font-bold text-blue-950 text-xs sm:text-sm mt-4 rounded-r"
                        >
                          {b.text}
                        </div>
                      );
                    }
                    return (
                      <div
                        key={idx}
                        className={`font-bold text-slate-900 mt-3 ${
                          lvl === 1 ? "text-xs sm:text-sm" : "text-xs"
                        } ${template === "gov-redhead" && firstLineIndent ? "indent-6 font-serif" : ""}`}
                      >
                        {b.text}
                      </div>
                    );
                  }

                  if (b.type === "paragraph") {
                    return (
                      <p
                        key={idx}
                        className={`text-slate-800 leading-relaxed text-justify ${
                          firstLineIndent ? "indent-6" : ""
                        } ${template !== "business-report" ? "font-serif" : ""}`}
                      >
                        {b.text}
                      </p>
                    );
                  }

                  if (b.type === "blockquote") {
                    return (
                      <div
                        key={idx}
                        className={`px-3.5 py-2.5 rounded-r-xl border-l-4 text-xs ${
                          template === "gov-redhead"
                            ? "border-[#D40000] bg-red-50/60 text-slate-800"
                            : "border-blue-500 bg-slate-50 text-slate-700"
                        }`}
                      >
                        {b.text}
                      </div>
                    );
                  }

                  if (b.type === "table" && b.headers) {
                    const isThreeLine = template === "academic-paper";
                    const isBusiness = template === "business-report";
                    return (
                      <div key={idx} className="my-2.5 overflow-x-auto">
                        <table
                          className={`w-full text-xs border-collapse ${
                            isThreeLine
                              ? "border-t-2 border-b-2 border-slate-900"
                              : "border border-slate-300"
                          }`}
                        >
                          <thead>
                            <tr
                              className={
                                isBusiness
                                  ? "bg-[#1E3A8A] text-white"
                                  : isThreeLine
                                    ? "border-b border-slate-800 bg-white text-slate-900"
                                    : "bg-slate-100 text-slate-900"
                              }
                            >
                              {b.headers.map((h, cIdx) => (
                                <th
                                  key={cIdx}
                                  className={`px-2.5 py-1.5 font-bold whitespace-nowrap ${
                                    isThreeLine ? "" : "border border-slate-300"
                                  }`}
                                >
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {(b.rows || []).map((row, rIdx) => (
                              <tr
                                key={rIdx}
                                className={
                                  isBusiness && rIdx % 2 === 1 ? "bg-slate-50" : "bg-white"
                                }
                              >
                                {row.map((cell, cIdx) => (
                                  <td
                                    key={cIdx}
                                    className={`px-2.5 py-1.5 text-slate-800 ${
                                      isThreeLine ? "" : "border border-slate-300"
                                    }`}
                                  >
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  }

                  if (b.type === "list" && b.items) {
                    return (
                      <div key={idx} className="space-y-1.5 pl-4">
                        {b.items.map((it, iIdx) => (
                          <div key={iIdx} className="flex items-start gap-2 text-slate-800">
                            <span className="font-semibold text-slate-600 select-none">
                              {it.checked !== null && it.checked !== undefined
                                ? it.checked
                                  ? "☑"
                                  : "☐"
                                : it.ordered
                                  ? `${iIdx + 1}.`
                                  : "•"}
                            </span>
                            <span>{it.text}</span>
                          </div>
                        ))}
                      </div>
                    );
                  }

                  // 🎯 VS Code IDE 风格高亮代码块预览
                  if (b.type === "code") {
                    const rawCode = b.lines ? b.lines.join("\n") : b.text || "";
                    const hlLines = b.highlightedLines;
                    return (
                      <div
                        key={idx}
                        className="my-3 rounded-2xl bg-[#1E1E1E] border border-[#333333] shadow-inner overflow-hidden text-[11px] font-mono"
                      >
                        {/* IDE 窗口标题栏 */}
                        <div className="px-3 py-1.5 bg-[#252526] border-b border-[#333333] flex items-center justify-between text-slate-400 select-none">
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5">
                              <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F56]" />
                              <div className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
                              <div className="w-2.5 h-2.5 rounded-full bg-[#27C93F]" />
                            </div>
                            <span className="text-[10px] uppercase font-bold text-slate-300 ml-1">
                              {b.language || "code"}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopyCode(rawCode, idx)}
                            className="p-1 hover:text-white transition-colors cursor-pointer"
                            title="Copy code"
                          >
                            {copiedCodeIdx === idx ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>

                        {/* 代码逐行彩色高亮内容 */}
                        <div className="p-3.5 overflow-x-auto leading-relaxed text-[#D4D4D4]">
                          {hlLines && hlLines.length > 0 ? (
                            hlLines.map((ln, lIdx) => (
                              <div key={lIdx} className="whitespace-pre">
                                {ln.length > 0 ? (
                                  ln.map((seg, sIdx) => (
                                    <span
                                      key={sIdx}
                                      style={{ color: `#${seg.color}` }}
                                      className={seg.bold ? "font-bold" : ""}
                                    >
                                      {seg.text}
                                    </span>
                                  ))
                                ) : (
                                  <span>&nbsp;</span>
                                )}
                              </div>
                            ))
                          ) : (
                            <pre className="whitespace-pre">{rawCode}</pre>
                          )}
                        </div>
                      </div>
                    );
                  }

                  if (b.type === "hr") {
                    return <hr key={idx} className="border-slate-200 my-3" />;
                  }

                  return null;
                })
              )}

              {/* 动态页码域 */}
              {includePageNumbers && (
                <div className="pt-5 mt-5 border-t border-slate-100 text-center text-[10px] text-slate-400 font-serif">
                  — 第 1 页 / 共 1 页 —
                </div>
              )}
            </div>
          </div>

          {/* 底部执行生成栏 */}
          <div className="p-4 bg-white dark:bg-darkbg-card border-t border-coconut-200/80 dark:border-darkbg-border flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-coconut-600 dark:text-darkbg-muted">
              {error ? (
                <span className="text-red-600 font-semibold">{error}</span>
              ) : lastExported ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {lang === "en" ? "Exported:" : "已成功生成:"}{" "}
                    {lastExported.filename}
                  </span>
                </span>
              ) : (
                <span>
                  {lang === "en"
                    ? "Pure local Node.js compilation · Zero formatting loss"
                    : "纯本地 Node.js 编译 OpenXML (.docx) · 双击必开绝不乱码"}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleConvertAndDownload}
              disabled={!content.trim() || converting}
              className="w-full sm:w-auto px-6 py-2.5 rounded-2xl text-xs sm:text-sm font-bold bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white shadow-md shadow-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {converting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>
                    {lang === "en" ? "Compiling..." : "正在编译标准 Word..."}
                  </span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>
                    {lang === "en"
                      ? "Export Standard Word (.docx)"
                      : "一键导出带样式标准 Word (.docx)"}
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
