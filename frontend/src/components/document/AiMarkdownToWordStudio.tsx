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

通过引入原生 \`OpenXML (ECMA-376)\` 编译内核与双轨中西文字体映射机制，实现文档排版准确度 $P \\ge 99.5\\%$，彻底告别手工调格式的繁琐流程。

> [!IMPORTANT]
> 各单位需在 2026 年第二季度前完成办公规范对齐，确保所有外发材料符合标准版式要求。

### （一） 核心建设指标对照表

| 评估维度 | 传统网页直接粘贴 | XC OmniBox 标准引擎 | 提升效果 |
| :--- | :--- | :--- | ---: |
| 表格边框与列宽 | 边框丢失、窄列变成一字一行竖排 | **智能防挤压列宽** + 标准网格/三线表 | +300% |
| 标题与大纲层级 | 变成普通粗体、无目录大纲级别 | 原生 \`Heading 1~3\` + 自动防孤行 | 100% 还原 |
| 中西文混排字体 | 英文变宋体等宽丑字、单词断行 | 中文仿宋/雅黑 + 西文 Times/Arial | 完美双轨 |

## 二、 重点任务分解清单

1. 全面推广党政/企事业标准红头公文版式（GB/T 9704 规范）；
2. 落地现代商务咨询报告模板（深蓝表头与斑马纹交替数据行）；
3. 支持学术论文与技术白皮书规范三线表一键编译。

各部门执行自查打勾项：

- [x] 已完成 AI 原始材料智能去寒暄与结构清洗
- [x] 已启用中英文双轨字体与动态页码域代码
- [ ] 待完成季度归档材料批量转换

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
  return \`\${Math.floor(outSeconds / 3600)}h\`;
}
\`\`\`

希望以上内容对您有所帮助！如果您需要进一步修改，请随时告诉我。`;

const SAMPLE_EN_MARKDOWN = `# Annual Artificial Intelligence & Digital Workspace Transformation Report 2026

To all departments, business units, and global subsidiaries:

To accelerate enterprise-wide digital operations and address the common pain points when copying AI-generated content from **DeepSeek**, **Kimi**, and **ChatGPT** into Word—such as *broken tables*, *lost heading outlines*, and ==disrupted line spacing==—we hereby establish the following standardized documentation guidelines:

## 1. Core Strategic Objectives

By deploying a native \`OpenXML (ECMA-376)\` compilation engine and dual-script typography mapping (Times New Roman / Arial + CJK fonts), we achieve an automated layout precision $P \\ge 99.5\\%$, complete with formula rendering like $\\Delta t = t_1 \\times \\alpha + \\beta$.

> [!IMPORTANT]
> All teams must align outbound client deliverables with these formatting standards by Q2 2026.

### 1.1 Performance Benchmark Matrix

| Evaluation Dimension | Legacy Copy-Paste | XC OmniBox Standard Engine | Improvement |
| :--- | :--- | :--- | ---: |
| Table Borders & Width | Borders stripped, 1-character vertical columns | **Smart Anti-Squeeze Width** + Authentic Tables | +300% |
| Heading Hierarchy | Flat bold text without outline levels | Native \`Heading 1~3\` + Orphan-line protection | 100% Retained |
| Dual-Script Fonts | Monospaced Latin glitching and mid-word splits | Professional Latin + CJK typeface pairing | Seamless |

## 2. Implementation Deliverables

Phase 1 Priorities (ordered sequence starting at 1):

1. Deploy Executive Red-Header and Business Report templates;
2. Standardize Academic Three-Line Table rendering;
3. Embed native \`PAGE / NUMPAGES\` dynamic pagination in document footers.

Department Self-Inspection Checklist:

- [x] Verified automated stripping of conversational AI pleasantries
- [x] Validated IDE-style multi-color code block syntax highlighting
- [ ] Schedule cross-departmental rollout training

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

  // 1. Obtain standard shift start time and clip early arrivals
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

  // Compute maximum between shift standard and actual punch
  const effectiveStartSeconds = Math.max(stdInSeconds, actualInSeconds);

  const [outH, outM, outS = 0] = String(clockOut).split(':').map(Number);
  const outSeconds = outH * 3600 + outM * 60 + outS;
  return \`\${Math.floor(outSeconds / 3600)}h\`;
}
\`\`\``;

export default function AiMarkdownToWordStudio({
  incomingFiles,
  onIncomingFilesHandled,
}: AiMarkdownToWordStudioProps) {
  const { lang } = useI18n();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [content, setContent] = useState<string>(() =>
    lang === "en" ? SAMPLE_EN_MARKDOWN : SAMPLE_ZH_MARKDOWN
  );
  const [template, setTemplate] = useState<WordTemplateType>("gov-redhead");
  const [documentTitle, setDocumentTitle] = useState<string>("");
  const [enableRedHeader, setEnableRedHeader] = useState<boolean>(true);
  const [redHeaderOrg, setRedHeaderOrg] = useState<string>(() =>
    lang === "en" ? "XC Executive Office Document" : "XC 万象集团办公厅文件"
  );
  const [docNumber, setDocNumber] = useState<string>(() =>
    lang === "en" ? "DOC-2026-01" : "万象办发〔2026〕01号"
  );
  const [firstLineIndent, setFirstLineIndent] = useState<boolean>(true);
  const [includePageNumbers, setIncludePageNumbers] = useState<boolean>(true);
  const [headerText, setHeaderText] = useState<string>("");
  const [cleanAiArtifacts, setCleanAiArtifacts] = useState<boolean>(true);
  const [showSettings, setShowSettings] = useState<boolean>(false);

  const [inspectResult, setInspectResult] = useState<MarkdownInspectResult | null>(null);
  const [inspecting, setInspecting] = useState<boolean>(false);
  const [converting, setConverting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastExported, setLastExported] = useState<{
    filename: string;
    size: number;
    blob: Blob;
  } | null>(null);

  // 语言变动时，若用户尚未修改默认示例与公文参数，则平滑自动同步切换为当前语言环境
  useEffect(() => {
    if (content === SAMPLE_ZH_MARKDOWN && lang === "en") {
      setContent(SAMPLE_EN_MARKDOWN);
    } else if (content === SAMPLE_EN_MARKDOWN && lang === "zh") {
      setContent(SAMPLE_ZH_MARKDOWN);
    }
    if (lang === "en" && redHeaderOrg === "XC 万象集团办公厅文件") {
      setRedHeaderOrg("XC Executive Office Document");
    } else if (lang === "zh" && redHeaderOrg === "XC Executive Office Document") {
      setRedHeaderOrg("XC 万象集团办公厅文件");
    }
    if (lang === "en" && docNumber === "万象办发〔2026〕01号") {
      setDocNumber("DOC-2026-01");
    } else if (lang === "zh" && docNumber === "DOC-2026-01") {
      setDocNumber("万象办发〔2026〕01号");
    }
  }, [lang]);

  // 处理外部拖入或传入的 .md / .txt 文件
  useEffect(() => {
    if (incomingFiles && incomingFiles.length > 0) {
      handleFileSelect(incomingFiles[0]);
      onIncomingFilesHandled?.();
    }
  }, [incomingFiles]);

  // 防抖调用后端 inspectMarkdown 解析结构与预览
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
          lang,
        });
        setInspectResult(res);
        setError(null);
      } catch (err: any) {
        setError(err?.message || (lang === "en" ? "Failed to parse preview" : "解析预览失败"));
      } finally {
        setInspecting(false);
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [content, cleanAiArtifacts, lang]);

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
        } catch (_) {
          // 降级使用 readText
        }
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
        redHeaderOrg:
          redHeaderOrg.trim() ||
          (lang === "en" ? "XC Executive Office Document" : "XC 万象集团办公厅文件"),
        docNumber: docNumber.trim() || (lang === "en" ? "DOC-2026-01" : "万象办发〔2026〕01号"),
        firstLineIndent,
        includePageNumbers,
        headerText: headerText.trim() || undefined,
        cleanAiArtifacts,
        lang,
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
          (lang === "en" ? "Failed to generate Word document" : "生成 Word 文档失败")
      );
    } finally {
      setConverting(false);
    }
  };

  const templateCards: Array<{
    id: WordTemplateType;
    title: string;
    subtitle: string;
    badge: string;
    icon: React.ReactNode;
    accentClass: string;
  }> = [
    {
      id: "gov-redhead",
      title: lang === "en" ? "Official Red-Header (GB/T 9704)" : "标准红头公文 (GB/T 9704)",
      subtitle:
        lang === "en"
          ? "Red header banner + double rule + FangSong 16pt / 28pt line spacing"
          : "自带发文红头 + 文武双红线 + 仿宋三号 28磅标准行距 + 规范表格",
      badge: lang === "en" ? "Gov / Enterprise" : "公文标准",
      icon: <Award className="w-5 h-5 text-red-600 dark:text-red-400" />,
      accentClass:
        template === "gov-redhead"
          ? "border-red-500 bg-red-50/70 dark:bg-red-950/30 ring-2 ring-red-500/25 shadow-sm"
          : "border-coconut-200/90 dark:border-darkbg-border bg-white dark:bg-darkbg-card hover:border-red-300",
    },
    {
      id: "business-report",
      title: lang === "en" ? "Modern Business Report" : "现代商务报告 / 咨询研报",
      subtitle:
        lang === "en"
          ? "Blue accent headers + YaHei/Arial dual-script + Navy zebra tables"
          : "商务蓝左饰条标题 + 微软雅黑/Arial 双轨混排 + 深蓝表头斑马纹表格",
      badge: lang === "en" ? "Business" : "职场汇报",
      icon: <Briefcase className="w-5 h-5 text-blue-600 dark:text-blue-400" />,
      accentClass:
        template === "business-report"
          ? "border-blue-500 bg-blue-50/70 dark:bg-blue-950/30 ring-2 ring-blue-500/25 shadow-sm"
          : "border-coconut-200/90 dark:border-darkbg-border bg-white dark:bg-darkbg-card hover:border-blue-300",
    },
    {
      id: "academic-paper",
      title: lang === "en" ? "Academic Three-Line Table" : "学术论文 / 规范三线表",
      subtitle:
        lang === "en"
          ? "SimSun + Times New Roman + Standard Academic Three-Line Tables"
          : "宋体 + Times New Roman 双轨 + 标准学术顶底三线表 + 灰底等宽代码块",
      badge: lang === "en" ? "Academic / Tech" : "学术标准",
      icon: <BookOpen className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />,
      accentClass:
        template === "academic-paper"
          ? "border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30 ring-2 ring-emerald-500/25 shadow-sm"
          : "border-coconut-200/90 dark:border-darkbg-border bg-white dark:bg-darkbg-card hover:border-emerald-300",
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 1. 顶部宽裕卡片：版式选择与快捷定制 */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-darkbg-card border border-coconut-200/80 dark:border-darkbg-border shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#D2BCAB]/30 dark:border-[#4D392E]/40">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-red-500 to-amber-500 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-coconut-900 dark:text-darkbg-text">
                {lang === "en"
                  ? "AI / Markdown to Standard Word (.docx)"
                  : "AI / Markdown 材料一键转带样式标准 Word (.docx)"}
              </h3>
              <p className="text-xs sm:text-sm text-coconut-600 dark:text-darkbg-muted mt-1 leading-relaxed">
                {lang === "en"
                  ? "Paste DeepSeek, Kimi, or ChatGPT output directly. Automatically formats official red headers, anti-squeeze tables, IDE code syntax colors, and dual-script fonts."
                  : "直接粘贴 DeepSeek、Kimi、ChatGPT 生成的公文、报告或表格，自动剥离首尾寒暄，编译为带规范红头、防挤压表格、IDE 多彩代码与中英双轨字体的标准 .docx。"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className="self-start sm:self-center px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-coconut-100/80 hover:bg-coconut-200 dark:bg-darkbg-subtle dark:text-darkbg-text flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>
              {lang === "en"
                ? showSettings
                  ? "Hide Options"
                  : "More Options"
                : showSettings
                  ? "收起细节"
                  : "细节参数"}
            </span>
            {showSettings ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* 3 套模板选择卡片（更开阔的呼吸感设计） */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {templateCards.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => {
                setTemplate(card.id);
                if (card.id === "gov-redhead") {
                  setFirstLineIndent(true);
                }
              }}
              className={`text-left p-4 sm:p-4.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${card.accentClass}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  {card.icon}
                  <span className="text-sm font-bold text-coconut-900 dark:text-darkbg-text">
                    {card.title}
                  </span>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/90 dark:bg-darkbg-card text-coconut-700 dark:text-darkbg-muted border border-coconut-200/60 dark:border-darkbg-border">
                  {card.badge}
                </span>
              </div>
              <p className="text-xs text-coconut-600 dark:text-darkbg-muted leading-relaxed">
                {card.subtitle}
              </p>
            </button>
          ))}
        </div>

        {/* 可折叠的版式参数定制区（避免默认视觉拥挤） */}
        {showSettings && (
          <div className="pt-4 border-t border-coconut-100 dark:border-darkbg-border space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {template === "gov-redhead" && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-coconut-700 dark:text-darkbg-muted mb-1.5">
                      {lang === "en" ? "Red Header Organization" : "红头发文机关名称"}
                    </label>
                    <input
                      type="text"
                      value={redHeaderOrg}
                      disabled={!enableRedHeader}
                      onChange={(e) => setRedHeaderOrg(e.target.value)}
                      placeholder={
                        lang === "en" ? "e.g. XC Global Executive Office" : "如：XC 万象集团办公厅文件"
                      }
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-coconut-200 dark:border-darkbg-border bg-coconut-50/50 dark:bg-darkbg-subtle text-coconut-900 dark:text-darkbg-text focus:outline-none focus:border-red-500 disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-coconut-700 dark:text-darkbg-muted mb-1.5">
                      {lang === "en" ? "Document Issue Number" : "发文字号 (文武红线上方)"}
                    </label>
                    <input
                      type="text"
                      value={docNumber}
                      disabled={!enableRedHeader}
                      onChange={(e) => setDocNumber(e.target.value)}
                      placeholder={lang === "en" ? "e.g. DOC-2026-01" : "如：万象办发〔2026〕01号"}
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-coconut-200 dark:border-darkbg-border bg-coconut-50/50 dark:bg-darkbg-subtle text-coconut-900 dark:text-darkbg-text focus:outline-none focus:border-red-500 disabled:opacity-50"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-semibold text-coconut-700 dark:text-darkbg-muted mb-1.5">
                  {lang === "en" ? "Override Main Title" : "指定文档主标题 (留空自动提取)"}
                </label>
                <input
                  type="text"
                  value={documentTitle}
                  onChange={(e) => setDocumentTitle(e.target.value)}
                  placeholder={
                    inspectResult?.detectedTitle ||
                    (lang === "en" ? "Auto-extract first heading" : "自动提取首个一级标题")
                  }
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-coconut-200 dark:border-darkbg-border bg-coconut-50/50 dark:bg-darkbg-subtle text-coconut-900 dark:text-darkbg-text focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-coconut-700 dark:text-darkbg-muted mb-1.5">
                  {lang === "en" ? "Header Text (Right-aligned)" : "页眉文字 (靠右对齐)"}
                </label>
                <input
                  type="text"
                  value={headerText}
                  onChange={(e) => setHeaderText(e.target.value)}
                  placeholder={
                    lang === "en" ? "e.g. CONFIDENTIAL · DO NOT DISTRIBUTE" : "如：内部绝密 · 严禁外传"
                  }
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-coconut-200 dark:border-darkbg-border bg-coconut-50/50 dark:bg-darkbg-subtle text-coconut-900 dark:text-darkbg-text focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-5 pt-2">
              {template === "gov-redhead" && (
                <label className="inline-flex items-center gap-2 text-xs text-coconut-800 dark:text-darkbg-text cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={enableRedHeader}
                    onChange={(e) => setEnableRedHeader(e.target.checked)}
                    className="rounded text-red-600 focus:ring-red-500 w-4 h-4"
                  />
                  <span>{lang === "en" ? "Enable Red Header Banner" : "启用规范红头版头"}</span>
                </label>
              )}
              <label className="inline-flex items-center gap-2 text-xs text-coconut-800 dark:text-darkbg-text cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={firstLineIndent}
                  onChange={(e) => setFirstLineIndent(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <span>{lang === "en" ? "First-Line 2-Char Indent" : "正文首行缩进 2 字符"}</span>
              </label>
              <label className="inline-flex items-center gap-2 text-xs text-coconut-800 dark:text-darkbg-text cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includePageNumbers}
                  onChange={(e) => setIncludePageNumbers(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <span>
                  {lang === "en"
                    ? "Dynamic Page Numbers (Page X of Y)"
                    : "页脚动态页码 (第X页/共Y页)"}
                </span>
              </label>
              <label className="inline-flex items-center gap-2 text-xs text-coconut-800 dark:text-darkbg-text cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={cleanAiArtifacts}
                  onChange={(e) => setCleanAiArtifacts(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <span>{lang === "en" ? "Auto-strip AI Chatter" : "自动过滤 AI 首尾寒暄客套语"}</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* 2. 宽绰左右双栏工作台：左侧输入/粘贴，右侧仿真 Word A4 纸张排版 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
        {/* 左栏：输入与编辑区 */}
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
          {/* 工具条（更舒适的间距与触控体验） */}
          <div className="px-5 py-3.5 bg-coconut-50/70 dark:bg-darkbg-subtle border-b border-coconut-200/70 dark:border-darkbg-border flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <FileText className="w-4 h-4 text-coconut-700 dark:text-darkbg-muted" />
              <span className="text-xs sm:text-sm font-bold text-coconut-900 dark:text-darkbg-text">
                {lang === "en" ? "Markdown / AI Source" : "AI 原始内容 / Markdown 编辑区"}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handlePasteFromClipboard}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 flex items-center gap-1.5 transition-colors cursor-pointer"
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
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-coconut-100 text-coconut-800 hover:bg-coconut-200 dark:bg-darkbg-card dark:text-darkbg-text flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{lang === "en" ? "Import File" : "导入文件"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setContent(lang === "en" ? SAMPLE_EN_MARKDOWN : SAMPLE_ZH_MARKDOWN);
                  setLastExported(null);
                }}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{lang === "en" ? "Sample" : "载入示例"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setContent("");
                  setInspectResult(null);
                  setLastExported(null);
                }}
                className="p-1.5 rounded-xl text-coconut-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                title={lang === "en" ? "Clear" : "清空"}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 文本输入框 */}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={
              lang === "en"
                ? "Paste AI-generated text or Markdown here (supports tables, code blocks, checklists), or drag & drop a .md / .txt file..."
                : "在此直接粘贴从 DeepSeek、Kimi、ChatGPT 复制的文字或 Markdown（支持复杂表格、代码块、勾选项），或将 .md / .txt 文件拖入此处..."
            }
            className="w-full flex-1 min-h-[500px] p-5 sm:p-6 text-xs sm:text-sm font-mono leading-relaxed bg-transparent text-coconut-900 dark:text-darkbg-text focus:outline-none resize-none"
          />

          {/* 底部结构解析统计条 */}
          <div className="px-5 py-3 bg-coconut-50/70 dark:bg-darkbg-subtle border-t border-coconut-200/70 dark:border-darkbg-border flex flex-wrap items-center justify-between gap-3 text-xs text-coconut-600 dark:text-darkbg-muted">
            <div className="flex items-center gap-4 flex-wrap">
              <span>
                {lang === "en" ? "Words:" : "字数:"}{" "}
                <strong className="text-coconut-900 dark:text-darkbg-text font-mono">
                  {inspectResult?.stats.wordCount ?? 0}
                </strong>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Heading className="w-3.5 h-3.5 text-blue-500" />
                {lang === "en" ? "Headings:" : "标题:"}{" "}
                <strong className="text-coconut-900 dark:text-darkbg-text font-mono">
                  {inspectResult?.stats.headingCount ?? 0}
                </strong>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <TableIcon className="w-3.5 h-3.5 text-emerald-500" />
                {lang === "en" ? "Tables:" : "表格:"}{" "}
                <strong className="text-coconut-900 dark:text-darkbg-text font-mono">
                  {inspectResult?.stats.tableCount ?? 0}
                </strong>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ListChecks className="w-3.5 h-3.5 text-amber-500" />
                {lang === "en" ? "List items:" : "列表:"}{" "}
                <strong className="text-coconut-900 dark:text-darkbg-text font-mono">
                  {inspectResult?.stats.listItemCount ?? 0}
                </strong>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Code2 className="w-3.5 h-3.5 text-purple-500" />
                {lang === "en" ? "Code blocks:" : "代码块:"}{" "}
                <strong className="text-coconut-900 dark:text-darkbg-text font-mono">
                  {inspectResult?.stats.codeBlockCount ?? 0}
                </strong>
              </span>
            </div>
            {inspecting && (
              <span className="inline-flex items-center gap-1.5 text-blue-600 font-medium">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{lang === "en" ? "Parsing structure..." : "智能排版解析中..."}</span>
              </span>
            )}
          </div>
        </div>

        {/* 右栏：仿真 Word A4 纸张排版实时预览 */}
        <div className="lg:col-span-6 flex flex-col rounded-3xl bg-slate-100/90 dark:bg-darkbg-subtle border border-coconut-200/80 dark:border-darkbg-border shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 bg-white dark:bg-darkbg-card border-b border-coconut-200/70 dark:border-darkbg-border flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Eye className="w-4 h-4 text-red-600 dark:text-red-400" />
              <span className="text-xs sm:text-sm font-bold text-coconut-900 dark:text-darkbg-text">
                {lang === "en"
                  ? "Live Simulated Word A4 Page Preview"
                  : "仿真 Word A4 纸张版式实时预览"}
              </span>
            </div>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-coconut-100 dark:bg-darkbg-subtle text-coconut-700 dark:text-darkbg-muted">
              {template === "gov-redhead"
                ? lang === "en"
                  ? "GB/T 9704 Red-Header"
                  : "GB/T 9704 公文"
                : template === "business-report"
                  ? lang === "en"
                    ? "Business Report"
                    : "现代商务研报"
                  : lang === "en"
                    ? "Academic Three-Line Table"
                    : "学术三线表"}
            </span>
          </div>

          {/* 仿真 A4 纸张（宽敞自然的阅读画布） */}
          <div className="flex-1 p-5 sm:p-7 overflow-y-auto max-h-[550px] flex justify-center">
            <div className="w-full max-w-[560px] bg-white text-slate-900 rounded-2xl shadow-xl ring-1 ring-slate-900/5 p-7 sm:p-9 space-y-4 text-xs leading-relaxed">
              {/* 页眉预览 */}
              {headerText && (
                <div className="pb-2 border-b border-slate-200 text-right text-[10px] text-slate-400 font-serif">
                  {headerText}
                </div>
              )}

              {/* 1. 红头公文版头预览 */}
              {template === "gov-redhead" && enableRedHeader && (
                <div className="text-center pb-3 mb-3 border-b-4 border-double border-[#D40000]">
                  <div className="text-xl sm:text-2xl font-black tracking-widest text-[#D40000] font-serif">
                    {redHeaderOrg ||
                      (lang === "en" ? "XC Executive Office Document" : "XC 万象集团办公厅文件")}
                  </div>
                  <div className="text-xs text-slate-700 mt-2 font-serif">
                    {docNumber || (lang === "en" ? "DOC-2026-01" : "万象办发〔2026〕01号")}
                  </div>
                </div>
              )}

              {/* 2. 主标题预览 */}
              {(documentTitle.trim() || inspectResult?.detectedTitle) && (
                <div
                  className={
                    template === "business-report"
                      ? "text-base sm:text-lg font-bold text-slate-900 pb-2.5 border-b-2 border-blue-600 leading-snug"
                      : "text-center text-base sm:text-lg font-bold text-slate-900 py-1.5 font-serif leading-snug"
                  }
                >
                  {documentTitle.trim() || inspectResult?.detectedTitle}
                </div>
              )}

              {/* 3. 内容块预览 */}
              {!inspectResult || inspectResult.previewBlocks.length === 0 ? (
                <div className="py-24 text-center text-slate-400 text-xs sm:text-sm">
                  {lang === "en"
                    ? "Paste AI or Markdown content on the left to preview Word layout"
                    : "请在左侧粘贴 AI 生成的文本或拖入 .md 文件，此处将实时呈现 Word 排版效果"}
                </div>
              ) : (
                inspectResult.previewBlocks.map((b, idx) => {
                  // 跳过已被提升为主标题的首个 H1
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
                          className="pl-3 py-1.5 bg-blue-50 border-l-4 border-blue-600 font-bold text-blue-950 text-xs sm:text-sm mt-4 rounded-r-lg"
                        >
                          {b.text}
                        </div>
                      );
                    }
                    if (template === "business-report" && lvl === 2) {
                      return (
                        <div
                          key={idx}
                          className="font-bold text-slate-900 text-xs sm:text-sm mt-3 pb-1 border-b border-slate-200"
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
                        className={`px-3.5 py-2.5 rounded-r-xl border-l-4 text-[11px] leading-relaxed ${
                          template === "gov-redhead"
                            ? "border-[#D40000] bg-red-50/70 text-slate-800"
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
                      <div key={idx} className="my-3 overflow-x-auto">
                        <table
                          className={`w-full text-[11px] border-collapse ${
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
                                  className={`px-2.5 py-2 font-bold ${
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

                  {/* 4. IDE 级多彩高亮代码块预览（100% 还原用户图片效果） */}
                  if (b.type === "code") {
                    const tokenized = b.tokenizedLines || [];
                    const displayLang = b.language || "Code";
                    return (
                      <div
                        key={idx}
                        className="my-3 rounded-2xl bg-[#1E1E1E] text-[#D4D4D4] border border-[#333333] shadow-md overflow-hidden text-left"
                      >
                        {/* IDE 窗口标题栏 */}
                        <div className="px-4 py-2 bg-[#252526] border-b border-[#333333] flex items-center justify-between text-[11px] select-none">
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F56]" />
                              <span className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
                              <span className="w-2.5 h-2.5 rounded-full bg-[#27C93F]" />
                            </div>
                            <span className="font-mono text-slate-400 font-semibold uppercase text-[10px] tracking-wide ml-1">
                              {displayLang}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {tokenized.length > 0 ? `${tokenized.length} lines` : ""}
                          </span>
                        </div>

                        {/* 代码高亮主体 */}
                        <div className="p-4 overflow-x-auto border-l-4 border-[#007ACC] font-mono text-[11px] leading-relaxed">
                          {tokenized.length > 0 ? (
                            tokenized.map((lineTokens, lIdx) => (
                              <div key={lIdx} className="whitespace-pre">
                                {lineTokens.map((tok, tIdx) => (
                                  <span
                                    key={tIdx}
                                    style={{ color: `#${tok.color}` }}
                                    className={tok.italic ? "italic" : ""}
                                  >
                                    {tok.text}
                                  </span>
                                ))}
                              </div>
                            ))
                          ) : (
                            <pre className="whitespace-pre">
                              {(b.lines || []).join("\n")}
                            </pre>
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

              {/* 页脚动态页码预览 */}
              {includePageNumbers && (
                <div className="pt-4 mt-4 border-t border-slate-100 text-center text-[10px] text-slate-400 font-serif">
                  {lang === "en" ? "— Page 1 of 1 —" : "— 第 1 页 / 共 1 页 —"}
                </div>
              )}
            </div>
          </div>

          {/* 底部一键生成与下载动作栏（更开阔与醒目） */}
          <div className="p-5 sm:p-6 bg-white dark:bg-darkbg-card border-t border-coconut-200/80 dark:border-darkbg-border flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs sm:text-sm text-coconut-600 dark:text-darkbg-muted">
              {error ? (
                <span className="text-red-600 font-semibold">{error}</span>
              ) : lastExported ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {lang === "en" ? "Exported:" : "已生成标准 Word:"} {lastExported.filename}
                  </span>
                </span>
              ) : (
                <span>
                  {lang === "en"
                    ? "100% offline Node.js OpenXML engine · Zero formatting collapse"
                    : "纯本地 Node.js 原生编译 OpenXML (.docx) · 双击必开绝不崩版"}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleConvertAndDownload}
              disabled={!content.trim() || converting}
              className="w-full sm:w-auto px-7 py-3 rounded-2xl text-xs sm:text-sm font-bold bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white shadow-md shadow-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 transition-all cursor-pointer"
            >
              {converting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{lang === "en" ? "Compiling DOCX..." : "正在编译标准 Word..."}</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>
                    {lang === "en"
                      ? "Export Standard Word (.docx)"
                      : "一键生成带样式标准 Word (.docx)"}
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
