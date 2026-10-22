"use client";

import React, { useState, useEffect, useRef, useMemo, useTransition } from "react";
import {
  Edit3,
  FileText,
  FileCode2,
  Combine,
  Scissors,
  Stamp,
  Lock,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Server,
  Image as ImageIcon,
  Music,
  Wrench,
  Sun,
  Moon,
  Menu,
  X,
  ChevronRight,
  ShieldCheck,
  Zap,
  Apple,
  RefreshCw,
  Maximize2,
  Film,
  Volume2,
  UserCheck,
  QrCode,
  GitCompare,
  Code2,
  Layers,
  ArrowRight,
  Shield,
  PanelLeft,
  Sliders,
  Download,
  RotateCcw,
  FileCheck,
  Minimize2,
  Eraser,
  FileSearch,
  Captions,
  Clock,
  Mic,
  Keyboard,
  Type,
  TableProperties,
  FolderTree,
  CopyCheck,
  FolderArchive,
  FileSpreadsheet,
  Search,
  Settings,
  Globe,
} from "lucide-react";
import CoconutLogo from "@/components/CoconutLogo";
import PdfToolbox, { PdfTabType } from "@/components/PdfToolbox";
import DocumentToolbox, { DocTabType } from "@/components/DocumentToolbox";
import SpreadsheetToolbox, { SpreadsheetTab } from "@/components/SpreadsheetToolbox";
import ImageToolbox from "@/components/ImageToolbox";
import AudioToolbox from "@/components/AudioToolbox";
import DailyToolbox from "@/components/DailyToolbox";
import UpdateModal from "@/components/UpdateModal";
import SettingsModal from "@/components/SettingsModal";
import ShortcutsModal from "@/components/ShortcutsModal";
import { shortcutBus } from "@/lib/shortcutBus";
import CatPawLogo from "@/components/CatPawLogo";
import { useI18n, getLocalizedTools } from "@/lib/i18n";
import {
  getSavedTheme,
  getSavedWhiteTheme,
  getSavedDarkTheme,
  applyCustomTheme,
  THEME_PRESETS,
  applyCustomFont,
  getSavedFont,
  CAT_PAW_PRESETS,
  getSavedCatPaw,
  saveCatPaw,
} from "@/lib/themeManager";
import {
  checkHealth,
  HealthStatus,
} from "@/lib/api";
import { toolBus, blobToFile } from "@/lib/toolBus";

type ImageTabType =
  | "compress"
  | "heic"
  | "convert"
  | "resize"
  | "exif"
  | "watermark";
type AudioTabType =
  | "trim"
  | "convert"
  | "merge"
  | "extract"
  | "volume"
  | "speed";
type DailyTabType = "idphoto" | "organize" | "duplicate" | "qrcode" | "diff";
type SpreadsheetTabType = "sheet-merge" | "sheet-split" | "table-encoding-fix";
type ModuleType = "pdf" | "document" | "spreadsheet" | "image" | "audio" | "utilities";

interface ToolItem {
  id: string;
  module: ModuleType;
  name: string;
  desc: string;
  badge?: string;
  icon: any;
  keywords: string[];
}

const TOOLS_REGISTRY: {
  category: string;
  module: ModuleType;
  icon: any;
  tools: ToolItem[];
}[] = [
  {
    category: "PDF 工具",
    module: "pdf",
    icon: FileText,
    tools: [
      {
        id: "pdf-to-word",
        module: "pdf",
        name: "PDF 转 Word",
        desc: "提取 PDF 表格与段落文本，转换为可编辑的 Word 文档",
        icon: FileText,
        keywords: ["pdf", "转word", "提取", "转换", "docx"],
      },
      {
        id: "word-to-pdf",
        module: "pdf",
        name: "Word 转 PDF",
        desc: "保留原始排版与矢量清晰度，导出标准 PDF 文档",
        icon: FileCode2,
        keywords: ["word", "转pdf", "超清", "无损", "打印"],
      },
      {
        id: "images-to-pdf",
        module: "pdf",
        name: "图片转 PDF",
        desc: "多张图片自由排序，合并导出为单页或标准 A4 文档",
        icon: Combine,
        keywords: ["图片", "jpg", "png", "转pdf", "合成", "相册"],
      },
      {
        id: "pdf-merge",
        module: "pdf",
        name: "PDF 合并",
        desc: "将多份 PDF 文档按自定义顺序拼接整合为单份文件",
        icon: Combine,
        keywords: ["pdf", "合并", "拼接", "多文件"],
      },
      {
        id: "pdf-split",
        module: "pdf",
        name: "PDF 拆分",
        desc: "按页码区间或点选页面，单独提取或拆分为多份 PDF",
        icon: Scissors,
        keywords: ["pdf", "拆分", "提取", "截取", "分割"],
      },
      {
        id: "pdf-organize",
        module: "pdf",
        name: "页面管理",
        desc: "可视化拖拽调整页面顺序、单页独立旋转与删除多余页",
        icon: Layers,
        keywords: ["pdf", "页面", "排序", "调序", "旋转", "删减", "画板"],
      },
      {
        id: "pdf-watermark",
        module: "pdf",
        name: "PDF 水印",
        desc: "为 PDF 文档添加自定义倾斜角度与透明度的文字水印",
        icon: Stamp,
        keywords: ["pdf", "水印", "文字", "印章", "防伪"],
      },
      {
        id: "pdf-compress",
        module: "pdf",
        name: "PDF 压缩",
        desc: "优化图像与冗余数据流，有效缩减 PDF 文件体积",
        icon: Minimize2,
        keywords: ["pdf", "压缩", "瘦身", "减小", "体积", "优化"],
      },
      {
        id: "pdf-protect",
        module: "pdf",
        name: "加密与解密",
        desc: "为 PDF 设置访问密码、解除已知密码保护或清理元数据",
        icon: Lock,
        keywords: ["pdf", "密码", "加密", "解密", "解锁", "保护", "权限"],
      },
      {
        id: "pdf-inplace-edit",
        module: "pdf",
        name: "PDF 文字修改",
        desc: "在原版面上直接替换修改文字、日期或金额，保持原有样式",
        icon: Edit3,
        keywords: ["pdf", "修改文字", "原地修改", "错别字", "替换", "合同", "账单", "金额", "日期", "edit", "fix"],
      },
      {
        id: "ai-searchable-pdf",
        module: "pdf",
        name: "可搜索 PDF",
        desc: "为扫描件注入透明文字层，支持全文检索与划词复制",
        icon: FileSearch,
        keywords: ["可搜索pdf", "双层pdf", "扫描件", "ocr", "复制文字", "pdf"],
      },
    ],
  },
  {
    category: "文档办公",
    module: "document",
    icon: FileCode2,
    tools: [
      {
        id: "ai-md-to-word",
        module: "document",
        name: "Markdown 转 Word",
        desc: "将 Markdown 或文本笔记转换为带标准样式、三线表与代码高亮的 .docx",
        icon: FileCode2,
        keywords: ["markdown", "md", "word", "docx", "ai", "deepseek", "kimi", "chatgpt", "红头文件", "公文", "三线表", "排版"],
      },
      {
        id: "office-media-extract",
        module: "document",
        name: "Office 媒体提取",
        desc: "批量提取 Word、PPT、Excel 文档内嵌的原始图片与音视频文件",
        icon: FolderArchive,
        keywords: ["word", "ppt", "excel", "提取图片", "图片提取", "原图", "解构", "docx", "pptx", "xlsx", "media"],
      },
      {
        id: "ai-ocr",
        module: "document",
        name: "文字识别 (OCR)",
        desc: "离线识别图片、扫描件与票据中的中英文文字，支持复制与导出",
        icon: Sparkles,
        keywords: ["ocr", "文字提取", "识别", "扫描", "文字识别"],
      },
    ],
  },
  {
    category: "表格数据",
    module: "spreadsheet",
    icon: TableProperties,
    tools: [
      {
        id: "sheet-merge",
        module: "spreadsheet",
        name: "表格合并",
        desc: "自动对齐多份表格的表头列名，批量纵向合并为总表",
        icon: Combine,
        keywords: ["excel", "合并", "拼接", "表格", "汇总", "merge", "sheet", "csv"],
      },
      {
        id: "sheet-split",
        module: "spreadsheet",
        name: "表格拆分",
        desc: "按指定列字段（如部门、地区、月份）将大表拆分为多个独立文件",
        icon: Scissors,
        keywords: ["excel", "拆分", "分表", "分组", "split", "sheet", "csv"],
      },
      {
        id: "table-encoding-fix",
        module: "spreadsheet",
        name: "表格乱码修复",
        desc: "自动识别 GBK/ANSI/UTF-8 编码，修复 CSV 与文本表格打开乱码问题",
        icon: FileSpreadsheet,
        keywords: ["csv", "乱码", "转码", "excel", "锟斤拷", "烫烫烫", "gbk", "gb18030", "utf8", "bom", "网银", "erp", "表格修复"],
      },
    ],
  },
  {
    category: "图像处理",
    module: "image",
    icon: ImageIcon,
    tools: [
      {
        id: "compress",
        module: "image",
        name: "图片压缩",
        desc: "在保持视觉清晰度的前提下大幅缩减图片文件体积",
        icon: Zap,
        keywords: ["图片", "压缩", "缩小", "体积", "tinypng"],
      },
      {
        id: "heic",
        module: "image",
        name: "HEIC 转换",
        desc: "将苹果 iPhone 拍摄的 HEIC/HEIF 照片批量转换为 JPG 或 PNG",
        icon: Apple,
        keywords: ["heic", "苹果", "iphone", "照片", "转jpg"],
      },
      {
        id: "convert",
        module: "image",
        name: "格式转换",
        desc: "支持 WebP、PNG、JPG、ICO 等常见图像格式批量互转",
        icon: RefreshCw,
        keywords: ["图片", "格式", "转换", "webp", "ico", "png"],
      },
      {
        id: "resize",
        module: "image",
        name: "尺寸调整",
        desc: "按百分比、指定像素或常用尺寸预设批量缩放图片",
        icon: Maximize2,
        keywords: ["图片", "缩放", "尺寸", "分辨率", "裁剪"],
      },
      {
        id: "exif",
        module: "image",
        name: "抹除拍摄信息",
        desc: "清理照片中的 GPS 定位坐标、相机型号与拍摄时间等隐私信息",
        icon: ShieldCheck,
        keywords: ["exif", "隐私", "gps", "定位", "元数据"],
      },
      {
        id: "watermark",
        module: "image",
        name: "图片水印",
        desc: "为图片批量添加平铺文字水印或自定义 Logo 角标",
        icon: Stamp,
        keywords: ["图片", "水印", "logo", "版权", "盖章"],
      },
    ],
  },
  {
    category: "音频处理",
    module: "audio",
    icon: Music,
    tools: [
      {
        id: "trim",
        module: "audio",
        name: "音频剪辑",
        desc: "可视化波形预览，精准截取音频片段并支持淡入淡出",
        icon: Scissors,
        keywords: ["音频", "剪切", "剪辑", "音乐", "铃声"],
      },
      {
        id: "convert",
        module: "audio",
        name: "格式转换",
        desc: "MP3、WAV、FLAC、AAC、OGG 等主流音频格式批量转换",
        icon: RefreshCw,
        keywords: ["音频", "转码", "格式", "mp3", "wav", "flac"],
      },
      {
        id: "merge",
        module: "audio",
        name: "音频合并",
        desc: "将多段音轨按顺序无缝拼接为单个音频文件",
        icon: Combine,
        keywords: ["音频", "拼接", "合并", "混流", "串烧"],
      },
      {
        id: "extract",
        module: "audio",
        name: "提取视频音频",
        desc: "从 MP4、MKV、MOV 等视频文件中直接提取原声音频",
        icon: Film,
        keywords: ["视频", "提取", "伴奏", "mp4", "音频"],
      },
      {
        id: "volume",
        module: "audio",
        name: "音量与降噪",
        desc: "调节音量增益、响度均衡与环境底噪滤除",
        icon: Volume2,
        keywords: ["音量", "放大", "增益", "降噪", "去杂音"],
      },
      {
        id: "speed",
        module: "audio",
        name: "音频变速",
        desc: "支持 0.5x 至 2.0x 播放速度调节与导出",
        icon: Clock,
        keywords: ["变速", "倍速", "快放", "慢放", "调速"],
      },
    ],
  },
  {
    category: "实用工具",
    module: "utilities",
    icon: Wrench,
    tools: [
      {
        id: "idphoto",
        module: "utilities",
        name: "证件照制作",
        desc: "更换红、白、蓝等标准底色，支持导出 6 寸冲印排版相纸",
        icon: UserCheck,
        keywords: ["证件照", "换底", "排版", "冲印", "相纸"],
      },
      {
        id: "organize",
        module: "utilities",
        name: "文件夹整理",
        desc: "按文件类型或修改年月自动归档目录，提供移动前预览",
        icon: FolderTree,
        keywords: ["整理", "归类", "归档", "格式", "分类", "年月", "organize"],
      },
      {
        id: "duplicate",
        module: "utilities",
        name: "重复文件清理",
        desc: "快速扫描目录中的重复文件，安全移入系统回收站",
        icon: CopyCheck,
        keywords: ["重复", "查重", "排重", "清理", "哈希", "duplicate"],
      },
      {
        id: "qrcode",
        module: "utilities",
        name: "二维码生成",
        desc: "生成自定义配色与中心 Logo 的二维码，或离线识别二维码图片",
        icon: QrCode,
        keywords: ["二维码", "qr", "扫码", "生成", "渐变"],
      },
      {
        id: "diff",
        module: "utilities",
        name: "文本差异对比",
        desc: "双栏并排对比两段文本或代码，高亮标注增删修改之处",
        icon: GitCompare,
        keywords: ["diff", "对比", "文章", "文本", "差异"],
      },
    ],
  },
];

export default function Home() {
  const { lang, setLang, t } = useI18n();
  const [, startTransition] = useTransition();
  const toolsRegistry = useMemo(
    () => getLocalizedTools(TOOLS_REGISTRY, lang),
    [lang],
  );
  const [activeModule, setActiveModuleState] = useState<ModuleType>("pdf");
  const [visitedModules, setVisitedModules] = useState<Set<ModuleType>>(
    () => new Set<ModuleType>(["pdf"])
  );
  const setActiveModule = (mod: ModuleType) => {
    startTransition(() => {
      setVisitedModules((prev) => {
        if (prev.has(mod)) return prev;
        const next = new Set(prev);
        next.add(mod);
        return next;
      });
      setActiveModuleState(mod);
    });
  };
  const [expandedModule, setExpandedModule] = useState<ModuleType | null>("pdf");
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [activePdfTab, setActivePdfTab] = useState<PdfTabType>("pdf-to-word");
  const [activeDocTab, setActiveDocTab] = useState<DocTabType>("ai-md-to-word");
  const [activeImageTab, setActiveImageTab] =
    useState<ImageTabType>("compress");
  const [activeAudioTab, setActiveAudioTab] = useState<AudioTabType>("trim");
  const [activeDailyTab, setActiveDailyTab] = useState<DailyTabType>("idphoto");
  const [activeSpreadsheetTab, setActiveSpreadsheetTab] =
    useState<SpreadsheetTabType>("sheet-merge");
  const [incomingPdfFiles, setIncomingPdfFiles] = useState<File[]>([]);
  const [incomingDocFiles, setIncomingDocFiles] = useState<File[]>([]);
  const [incomingIdPhotoFile, setIncomingIdPhotoFile] = useState<File | null>(
    null,
  );
  const [incomingSpreadsheetFiles, setIncomingSpreadsheetFiles] = useState<File[]>([]);
  const [incomingImageFiles, setIncomingImageFiles] = useState<File[]>([]);
  const [incomingAudioFile, setIncomingAudioFile] = useState<File | null>(null);
  const [incomingDiffText, setIncomingDiffText] = useState<{
    text: string;
    side: "original" | "modified";
  } | null>(null);

  // 跨工具总线监听：无损内存零拷贝流转
  useEffect(() => {
    const unsubscribe = toolBus.subscribe(({ target, payload }) => {
      const normalizedModule: ModuleType =
        target.module === "ai" ? "document" : (target.module as ModuleType);
      setActiveModule(normalizedModule);
      setExpandedModule(normalizedModule);
      if (normalizedModule === "pdf") {
        setActivePdfTab(target.tab as PdfTabType);
        const f = blobToFile(payload.blob || payload.file, payload.filename);
        if (f) {
          setIncomingPdfFiles([f]);
        }
      } else if (normalizedModule === "spreadsheet") {
        setActiveSpreadsheetTab(target.tab as SpreadsheetTabType);
        const f = blobToFile(payload.blob || payload.file, payload.filename);
        if (f) {
          setIncomingSpreadsheetFiles([f]);
        }
      } else if (normalizedModule === "image") {
        setActiveImageTab(target.tab as ImageTabType);
        const f = blobToFile(payload.blob || payload.file, payload.filename);
        if (f) {
          setIncomingImageFiles([f]);
        }
      } else if (normalizedModule === "audio") {
        setActiveAudioTab(target.tab as AudioTabType);
        const f = blobToFile(payload.blob || payload.file, payload.filename);
        if (f) {
          setIncomingAudioFile(f);
        }
      } else if (normalizedModule === "utilities") {
        setActiveDailyTab(target.tab as DailyTabType);
        if (target.tab === "idphoto") {
          const f = blobToFile(payload.blob || payload.file, payload.filename);
          if (f) {
            setIncomingIdPhotoFile(f);
          }
        } else if (target.tab === "diff") {
          setIncomingDiffText({
            text: payload.text || "",
            side: target.targetSide || "original",
          });
        }
      } else if (normalizedModule === "document") {
        setActiveDocTab(target.tab as DocTabType);
        const f = blobToFile(payload.blob || payload.file, payload.filename);
        if (f) {
          setIncomingDocFiles([f]);
        }
      }
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [isDark, setIsDark] = useState<boolean>(false);

  // 客户端自动更新弹窗状态与版本感知
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [hasUpdate, setHasUpdate] = useState(false);
  const [appVersion, setAppVersion] = useState<string>("1.7.1");

  // 快捷键指南弹窗状态与全局提示
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ id: number; message: string } | null>(null);

  const showToast = (message: string) => {
    const id = Date.now();
    setToastMsg({ id, message });
    setTimeout(() => {
      setToastMsg((curr) => (curr?.id === id ? null : curr));
    }, 2200);
  };

  // 一键轮换治愈系猫肉球挂件样式
  const cycleCatPaw = () => {
    const currentId = getSavedCatPaw();
    const idx = CAT_PAW_PRESETS.findIndex((p) => p.id === currentId);
    const nextPaw = CAT_PAW_PRESETS[(idx + 1) % CAT_PAW_PRESETS.length];
    saveCatPaw(nextPaw.id);
    showToast(
      lang === "en"
        ? `🐾 Paw style: ${nextPaw.nameEn || nextPaw.name}`
        : `🐾 已切换肉球：${nextPaw.name}`
    );
  };

  // 全局快捷键监听 (Ctrl+K, Ctrl+Enter, Ctrl+S, Ctrl+,, Ctrl+/, Ctrl+1~6, Esc)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      const target = e.target as HTMLElement | null;
      const isEditable =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if (e.key === "Escape") {
        if (searchQuery) {
          setSearchQuery("");
          return;
        }
        if (shortcutsModalOpen) {
          setShortcutsModalOpen(false);
          e.preventDefault();
          return;
        }
        if (settingsModalOpen) {
          setSettingsModalOpen(false);
          e.preventDefault();
          return;
        }
        if (updateModalOpen) {
          setUpdateModalOpen(false);
          e.preventDefault();
          return;
        }
      }

      if (isCtrlOrCmd) {
        if (e.key.toLowerCase() === "k") {
          e.preventDefault();
          if (sidebarCollapsed) setSidebarCollapsed(false);
          setTimeout(() => searchInputRef.current?.focus(), 50);
          return;
        }

        if (e.key === "/") {
          e.preventDefault();
          setShortcutsModalOpen((prev) => !prev);
          return;
        }

        if (e.key === ",") {
          e.preventDefault();
          setSettingsModalOpen(true);
          return;
        }

        if (!isEditable && ["1", "2", "3", "4", "5", "6"].includes(e.key)) {
          e.preventDefault();
          const moduleMap: Record<string, ModuleType> = {
            "1": "pdf",
            "2": "document",
            "3": "spreadsheet",
            "4": "image",
            "5": "audio",
            "6": "utilities",
          };
          const targetMod = moduleMap[e.key];
          if (targetMod) {
            setActiveModule(targetMod);
            setExpandedModule(targetMod);
            showToast(
              lang === "en"
                ? `Switched to ${CATEGORY_TRANSLATIONS_INLINE[targetMod] || targetMod}`
                : `已切换至「${TOOLS_REGISTRY.find((r) => r.module === targetMod)?.category || targetMod}」`
            );
          }
          return;
        }

        if (e.key === "Enter") {
          e.preventDefault();
          const primaryBtn = document.querySelector<HTMLButtonElement>(
            '[data-primary-action="true"]'
          );
          if (primaryBtn && !primaryBtn.disabled) {
            primaryBtn.click();
            showToast(lang === "en" ? "Action triggered" : "已触发执行");
          } else {
            shortcutBus.emit("execute-primary");
          }
          return;
        }

        if (e.key.toLowerCase() === "s") {
          e.preventDefault();
          const downloadBtn = document.querySelector<HTMLButtonElement>(
            '[data-download-result="true"]'
          );
          if (downloadBtn && !downloadBtn.disabled) {
            downloadBtn.click();
            showToast(lang === "en" ? "Export triggered" : "已触发导出");
          } else {
            shortcutBus.emit("download-result");
          }
          return;
        }
      }
    };

    const CATEGORY_TRANSLATIONS_INLINE: Record<string, string> = {
      pdf: "PDF Tools",
      document: "Documents",
      spreadsheet: "Spreadsheets",
      image: "Images",
      audio: "Audio",
      utilities: "Utilities",
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [shortcutsModalOpen, settingsModalOpen, updateModalOpen, sidebarCollapsed, searchQuery, lang]);

  // 全局智能剪贴板粘贴监听 (Ctrl+V 粘贴图片/文本至当前工具)
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditable =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if (isEditable) return;

      const items = e.clipboardData?.items;
      if (items && items.length > 0) {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.type.startsWith("image/")) {
            const file = item.getAsFile();
            if (file) {
              e.preventDefault();
              const namedFile = new File(
                [file],
                `pasted_image_${Date.now()}.${file.type.split("/")[1] || "png"}`,
                { type: file.type, lastModified: Date.now() }
              );

              if (activeModule === "image") {
                setIncomingImageFiles([namedFile]);
                showToast(
                  lang === "en"
                    ? "Image pasted into Image tools"
                    : "已从剪贴板导入图片"
                );
              } else if (
                activeModule === "pdf" &&
                (activePdfTab === "ai-searchable-pdf" || activePdfTab === "images-to-pdf")
              ) {
                setIncomingPdfFiles([namedFile]);
                showToast(
                  lang === "en"
                    ? "Image pasted into PDF tools"
                    : "已从剪贴板导入图片至 PDF 工具"
                );
              } else if (activeModule === "document" && activeDocTab === "ai-ocr") {
                setIncomingDocFiles([namedFile]);
                showToast(
                  lang === "en"
                    ? "Image pasted into OCR"
                    : "已从剪贴板导入图片至文字识别"
                );
              } else if (activeModule === "utilities" && activeDailyTab === "idphoto") {
                setIncomingIdPhotoFile(namedFile);
                showToast(
                  lang === "en"
                    ? "Photo pasted into ID Photo"
                    : "已从剪贴板导入照片至证件照工具"
                );
              } else {
                setActiveModule("image");
                setActiveImageTab("compress");
                setIncomingImageFiles([namedFile]);
                showToast(
                  lang === "en"
                    ? "Image pasted · Switched to Images"
                    : "已粘贴图片并切换至图像处理"
                );
              }
              return;
            }
          }
        }
      }

      const text = e.clipboardData?.getData("text/plain");
      if (text && text.trim().length > 0) {
        if (activeModule === "utilities" && activeDailyTab === "diff") {
          e.preventDefault();
          setIncomingDiffText({ text, side: "original" });
          showToast(
            lang === "en"
              ? "Pasted text into Text Diff"
              : "已从剪贴板导入文本至差异对比"
          );
        }
      }
    };

    window.addEventListener("paste", handleGlobalPaste);
    return () => window.removeEventListener("paste", handleGlobalPaste);
  }, [activeModule, activePdfTab, activeDocTab, activeDailyTab, lang]);

  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).electronAPI) {
      const api = (window as any).electronAPI;
      if (api.getAppVersion) {
        api.getAppVersion().then((v: string) => {
          if (v) setAppVersion(v);
        }).catch(() => {});
      }
      const unsubscribe = api.onUpdateStatus(
        (data: any) => {
          if (data.status === "available" || data.status === "ready") {
            setHasUpdate(true);
          }
        },
      );
      return () => {
        if (typeof unsubscribe === "function") unsubscribe();
      };
    }
  }, []);

  // 初始化深色模式、自定义配色与字体偏好
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      (window as any).electronAPI?.getDesktopConfig
    ) {
      (window as any).electronAPI.getDesktopConfig().then((c: any) => {
        if (c?.customTheme) {
          applyCustomTheme(c.customTheme);
          setIsDark(c.customTheme.isDark);
        } else {
          const saved = getSavedTheme();
          if (saved) {
            applyCustomTheme(saved);
            setIsDark(saved.isDark);
          }
        }
        if (c?.customFont) {
          applyCustomFont(c.customFont);
        }
      });
    } else {
      const saved = getSavedTheme();
      if (saved) {
        applyCustomTheme(saved);
        setIsDark(saved.isDark);
      } else {
        const isDarkMode = document.documentElement.classList.contains("dark");
        setIsDark(isDarkMode);
      }

      const savedFont = getSavedFont();
      if (savedFont) {
        applyCustomFont(savedFont);
      }
    }
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    const targetPreset = nextDark ? getSavedDarkTheme() : getSavedWhiteTheme();
    applyCustomTheme(targetPreset);
  };

  // 轮询检查后端状态
  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const data = await checkHealth();
        setHealth(data);
      } catch (e) {
        setHealth(null);
      }
    };
    fetchHealth();
    const interval = setInterval(fetchHealth, 12000);
    return () => clearInterval(interval);
  }, []);

  const handleSelectTool = (item: ToolItem) => {
    setActiveModule(item.module);
    setExpandedModule(item.module);
    startTransition(() => {
      if (item.module === "pdf") {
        setActivePdfTab(item.id as PdfTabType);
      } else if (item.module === "document") {
        setActiveDocTab(item.id as DocTabType);
      } else if (item.module === "spreadsheet") {
        setActiveSpreadsheetTab(item.id as SpreadsheetTabType);
      } else if (item.module === "image") {
        setActiveImageTab(item.id as ImageTabType);
      } else if (item.module === "audio") {
        setActiveAudioTab(item.id as AudioTabType);
      } else if (item.module === "utilities") {
        setActiveDailyTab(item.id as DailyTabType);
      }
    });
    setSearchQuery("");
    setMobileMenuOpen(false);
  };

  const allTools = useMemo(
    () => toolsRegistry.flatMap((g) => g.tools),
    [toolsRegistry]
  );

  const filteredSearchTools = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return allTools.filter(
      (tool) =>
        tool.name.toLowerCase().includes(q) ||
        tool.desc.toLowerCase().includes(q) ||
        tool.keywords.some((k) => k.toLowerCase().includes(q))
    );
  }, [allTools, searchQuery]);

  const currentCategory =
    toolsRegistry.find((g) => g.module === activeModule) || toolsRegistry[0];
  const currentActiveTool =
    activeModule === "pdf"
      ? allTools.find((t) => t.id === activePdfTab)
      : activeModule === "document"
        ? allTools.find((t) => t.id === activeDocTab)
        : activeModule === "spreadsheet"
          ? allTools.find((t) => t.id === activeSpreadsheetTab)
          : activeModule === "image"
            ? allTools.find((t) => t.id === activeImageTab)
            : activeModule === "audio"
              ? allTools.find((t) => t.id === activeAudioTab)
              : allTools.find((t) => t.id === activeDailyTab);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-transparent text-coconut-900 dark:text-darkbg-text subpixel-antialiased">
      {/* 移动端侧边抽屉遮罩 */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/35 backdrop-blur-xs z-40 lg:hidden animate-fade-in"
        />
      )}

      {/* ===================== 左侧极简现代侧边栏 ===================== */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 flex flex-col bg-[var(--color-sidebar-bg)] border-r border-[var(--color-border)] transition-[width,transform] duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          mobileMenuOpen
            ? "translate-x-0 w-72 max-w-[85vw]"
            : "-translate-x-full lg:translate-x-0"
        } ${sidebarCollapsed ? "lg:w-[72px]" : "lg:w-64"}`}
      >
        {/* 顶部品牌与治愈系猫肉球区域 */}
        <div
          className={`h-16 border-b border-[var(--color-border)] flex items-center flex-shrink-0 ${
            sidebarCollapsed ? "px-2 justify-center" : "px-4 justify-between"
          }`}
        >
          {sidebarCollapsed ? (
            <button
              onClick={() => setSidebarCollapsed(false)}
              onContextMenu={(e) => {
                e.preventDefault();
                cycleCatPaw();
              }}
              className="p-1.5 rounded-2xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-transform active:scale-95 flex items-center justify-center cursor-pointer"
              title={
                lang === "en"
                  ? "Click to expand sidebar · Right-click to switch Cat Paw"
                  : "左键展开侧边栏 · 右键切换猫肉球款式"
              }
            >
              <CatPawLogo size={38} />
            </button>
          ) : (
            <>
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  onClick={() => setSidebarCollapsed(true)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    cycleCatPaw();
                  }}
                  className="p-1 rounded-2xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-transform active:scale-95 cursor-pointer flex-shrink-0"
                  title={
                    lang === "en"
                      ? "Click to collapse sidebar · Right-click to switch Cat Paw"
                      : "左键收起侧边栏 · 右键切换猫肉球款式"
                  }
                >
                  <CatPawLogo size={36} />
                </button>
                <div className="truncate select-none">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-[15px] tracking-tight text-coconut-950 dark:text-white">
                      XC OmniBox
                    </span>
                    <button
                      type="button"
                      onClick={cycleCatPaw}
                      className="text-[11px] px-1.5 py-0.5 rounded-md bg-black/[0.04] dark:bg-white/[0.06] hover:bg-accent-subtle text-coconut-600 dark:text-darkbg-muted hover:text-accent transition-colors cursor-pointer"
                      title={
                        lang === "en"
                          ? "Tap to switch Cat Paw style"
                          : "点击切换猫肉球挂件款式"
                      }
                    >
                      🐾
                    </button>
                  </div>
                  <p className="text-[11px] text-coconut-500 dark:text-darkbg-muted truncate">
                    {lang === "en" ? "Desktop Toolkit" : "桌面效率工具箱"}
                  </p>
                </div>
              </div>

              {/* 移动端关闭按钮 */}
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="lg:hidden p-1.5 rounded-xl text-coconut-500 hover:text-coconut-800 dark:text-darkbg-muted hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {/* 展开态：极速工具检索框 (Ctrl + K) */}
        {!sidebarCollapsed && (
          <div className="px-3 pt-3 pb-1 flex-shrink-0">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-coconut-400 dark:text-darkbg-muted absolute left-3 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={lang === "en" ? "Find tool... (Ctrl+K)" : "搜索工具... (Ctrl+K)"}
                className="w-full pl-8 pr-7 py-1.5 rounded-xl text-xs bg-black/[0.035] dark:bg-white/[0.04] border border-transparent focus:border-[var(--color-border)] focus:bg-white dark:focus:bg-[#221E1B] text-coconut-900 dark:text-white placeholder:text-coconut-400 dark:placeholder:text-darkbg-muted/70 focus:outline-none transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 p-0.5 rounded-md text-coconut-400 hover:text-coconut-700 dark:hover:text-white cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* 导航列表：纯净无小红点、无冗余营销标签 */}
        <div className="flex-1 overflow-y-auto px-2.5 py-2 space-y-1.5 custom-main-scrollbar overscroll-contain">
          {sidebarCollapsed ? (
            /* ================= 折叠模式：纯净分类图标栏 (去除小红点) ================= */
            <div className="py-1 flex flex-col items-center space-y-2">
              {toolsRegistry.map((group) => {
                const GroupIcon = group.icon;
                const isGroupActive = activeModule === group.module;
                const shortLabel =
                  lang === "en"
                    ? group.module === "pdf"
                      ? "PDF"
                      : group.module === "document"
                        ? "Docs"
                        : group.module === "spreadsheet"
                          ? "Sheet"
                          : group.module === "image"
                            ? "Image"
                            : group.module === "audio"
                              ? "Audio"
                              : "Utils"
                    : group.module === "pdf"
                      ? "PDF"
                      : group.module === "document"
                        ? "文档"
                        : group.module === "spreadsheet"
                          ? "表格"
                          : group.module === "image"
                            ? "图像"
                            : group.module === "audio"
                              ? "音频"
                              : "实用";

                return (
                  <button
                    key={group.module}
                    onClick={() => {
                      setActiveModule(group.module);
                      setExpandedModule(group.module);
                    }}
                    title={`${group.category} (${group.tools.length})`}
                    className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center transition-all relative group active:scale-95 cursor-pointer ${
                      isGroupActive
                        ? "bg-white dark:bg-[#2A2421] text-accent shadow-xs ring-1 ring-black/[0.06] dark:ring-white/[0.08]"
                        : "text-coconut-600 dark:text-darkbg-muted hover:bg-black/[0.04] dark:hover:bg-white/[0.05] hover:text-coconut-950 dark:hover:text-white"
                    }`}
                  >
                    {isGroupActive && (
                      <span className="absolute left-0 top-3.5 bottom-3.5 w-1 rounded-r-full bg-accent" />
                    )}
                    <GroupIcon className="w-5 h-5" />
                    <span className="text-[10px] font-medium mt-0.5">
                      {shortLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : searchQuery.trim().length > 0 ? (
            /* ================= 搜索过滤结果直达列表 ================= */
            <div className="space-y-1 pt-1">
              {filteredSearchTools.length === 0 ? (
                <div className="py-8 text-center text-xs text-coconut-400 dark:text-darkbg-muted">
                  {t.noResults}
                </div>
              ) : (
                filteredSearchTools.map((tool) => {
                  const Icon = tool.icon;
                  return (
                    <button
                      key={`${tool.module}-${tool.id}`}
                      onClick={() => handleSelectTool(tool)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs hover:bg-white dark:hover:bg-[#2A2421] text-coconut-800 dark:text-darkbg-text transition-colors cursor-pointer group"
                    >
                      <Icon className="w-4 h-4 text-accent flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold truncate text-coconut-950 dark:text-white">
                          {tool.name}
                        </div>
                        <div className="text-[11px] text-coconut-500 dark:text-darkbg-muted truncate">
                          {tool.desc}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          ) : (
            /* ================= 展开模式：清爽手风琴导航 ================= */
            toolsRegistry.map((group) => {
              const GroupIcon = group.icon;
              const isGroupActive = activeModule === group.module;
              const isGroupExpanded = expandedModule === group.module;
              return (
                <div key={group.module} className="space-y-0.5">
                  <button
                    onClick={() => {
                      if (isGroupExpanded && isGroupActive) {
                        setExpandedModule(null);
                      } else {
                        setExpandedModule(group.module);
                        setActiveModule(group.module);
                      }
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all select-none cursor-pointer ${
                      isGroupActive
                        ? "bg-white dark:bg-[#26211E] text-coconut-950 dark:text-white shadow-2xs ring-1 ring-black/[0.05] dark:ring-white/[0.07]"
                        : "text-coconut-700 dark:text-darkbg-muted hover:bg-black/[0.035] dark:hover:bg-white/[0.04] hover:text-coconut-950 dark:hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <GroupIcon
                        className={`w-4 h-4 flex-shrink-0 transition-colors ${
                          isGroupActive
                            ? "text-accent"
                            : "text-coconut-500 dark:text-darkbg-muted"
                        }`}
                      />
                      <span className="truncate">{group.category}</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-[11px] font-mono text-coconut-400 dark:text-darkbg-muted/70">
                        {group.tools.length}
                      </span>
                      <ChevronRight
                        className={`w-3.5 h-3.5 transition-transform duration-200 ${
                          isGroupExpanded
                            ? "rotate-90 text-coconut-700 dark:text-white"
                            : "text-coconut-400 opacity-60"
                        }`}
                      />
                    </div>
                  </button>

                  {/* 子工具列表 */}
                  <div
                    className={`grid transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] overflow-hidden ${
                      isGroupExpanded
                        ? "grid-rows-[1fr] opacity-100 pt-0.5 pb-1"
                        : "grid-rows-[0fr] opacity-0 pointer-events-none"
                    }`}
                  >
                    <div className="min-h-0 pl-3.5 pr-1 space-y-0.5 border-l border-[var(--color-border)] ml-4">
                      {group.tools.map((tool) => {
                        const Icon = tool.icon;
                        const isCur =
                          activeModule === tool.module &&
                          ((tool.module === "pdf" && activePdfTab === tool.id) ||
                            (tool.module === "document" && activeDocTab === tool.id) ||
                            (tool.module === "spreadsheet" && activeSpreadsheetTab === tool.id) ||
                            (tool.module === "image" && activeImageTab === tool.id) ||
                            (tool.module === "audio" && activeAudioTab === tool.id) ||
                            (tool.module === "utilities" && activeDailyTab === tool.id));

                        return (
                          <button
                            key={tool.id}
                            onClick={() => handleSelectTool(tool)}
                            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs transition-all cursor-pointer ${
                              isCur
                                ? "bg-accent-subtle text-accent font-semibold"
                                : "text-coconut-600 dark:text-darkbg-muted hover:bg-black/[0.03] dark:hover:bg-white/[0.04] hover:text-coconut-950 dark:hover:text-white font-normal"
                            }`}
                          >
                            <Icon
                              className={`w-3.5 h-3.5 flex-shrink-0 ${
                                isCur ? "text-accent" : "text-coconut-400 dark:text-darkbg-muted/80"
                              }`}
                            />
                            <span className="truncate">{tool.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 侧边栏底部：紧凑型一体式控制栏 (告别 4 张大卡片堆叠拥挤) */}
        <div className="p-2.5 border-t border-[var(--color-border)] flex-shrink-0">
          {sidebarCollapsed ? (
            <div className="flex flex-col items-center gap-1.5">
              <button
                onClick={toggleTheme}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-coconut-600 dark:text-darkbg-muted hover:bg-black/[0.04] dark:hover:bg-white/[0.06] hover:text-coconut-950 dark:hover:text-white transition-colors cursor-pointer"
                title={lang === "en" ? "Switch Theme" : "切换深浅外观"}
              >
                {isDark ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setShortcutsModalOpen(true)}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-coconut-600 dark:text-darkbg-muted hover:bg-black/[0.04] dark:hover:bg-white/[0.06] hover:text-coconut-950 dark:hover:text-white transition-colors cursor-pointer"
                title={lang === "en" ? "Shortcuts (Ctrl + /)" : "快捷键指南 (Ctrl + /)"}
              >
                <Keyboard className="w-4 h-4" />
              </button>
              <button
                onClick={() => setSettingsModalOpen(true)}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-coconut-600 dark:text-darkbg-muted hover:bg-black/[0.04] dark:hover:bg-white/[0.06] hover:text-coconut-950 dark:hover:text-white transition-colors cursor-pointer"
                title={t.sidebar.preferences}
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-1 px-1">
              {/* 版本与检查更新 */}
              <button
                onClick={() => setUpdateModalOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-mono text-coconut-600 dark:text-darkbg-muted hover:bg-black/[0.04] dark:hover:bg-white/[0.06] hover:text-coconut-950 dark:hover:text-white transition-colors cursor-pointer"
                title={t.sidebar.checkUpdate}
              >
                <span>v{appVersion}</span>
                {hasUpdate && (
                  <span className="px-1.5 py-0.5 text-[9px] font-sans font-bold bg-accent text-white rounded-full">
                    NEW
                  </span>
                )}
              </button>

              {/* 快捷图标组：语言 / 主题 / 快捷键 / 设置 */}
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => setLang(lang === "en" ? "zh" : "en")}
                  className="px-2 py-1.5 rounded-xl text-[11px] font-bold text-coconut-600 dark:text-darkbg-muted hover:bg-black/[0.04] dark:hover:bg-white/[0.06] hover:text-coconut-950 dark:hover:text-white transition-colors cursor-pointer"
                  title={lang === "en" ? "切换到中文" : "Switch to English"}
                >
                  {lang === "en" ? "中" : "EN"}
                </button>
                <button
                  onClick={toggleTheme}
                  className="p-2 rounded-xl text-coconut-600 dark:text-darkbg-muted hover:bg-black/[0.04] dark:hover:bg-white/[0.06] hover:text-coconut-950 dark:hover:text-white transition-colors cursor-pointer"
                  title={lang === "en" ? "Switch Theme" : "切换深浅外观"}
                >
                  {isDark ? (
                    <Sun className="w-4 h-4 text-amber-500" />
                  ) : (
                    <Moon className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={() => setShortcutsModalOpen(true)}
                  className="p-2 rounded-xl text-coconut-600 dark:text-darkbg-muted hover:bg-black/[0.04] dark:hover:bg-white/[0.06] hover:text-coconut-950 dark:hover:text-white transition-colors cursor-pointer"
                  title={lang === "en" ? "Shortcuts (Ctrl + /)" : "快捷键指南 (Ctrl + /)"}
                >
                  <Keyboard className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setSettingsModalOpen(true)}
                  className="p-2 rounded-xl text-coconut-600 dark:text-darkbg-muted hover:bg-black/[0.04] dark:hover:bg-white/[0.06] hover:text-coconut-950 dark:hover:text-white transition-colors cursor-pointer"
                  title={t.sidebar.preferences}
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ===================== 右侧清爽主工作台 ===================== */}
      <div className="flex-1 h-full flex flex-col overflow-hidden min-w-0 relative">
        {/* 顶部一体化工作台栏：左侧当前工具标题与简介 + 右侧分段式模块切换 */}
        <header className="h-16 border-b border-[var(--color-border)] bg-[var(--color-sidebar-bg)] px-4 sm:px-6 flex items-center justify-between flex-shrink-0 gap-4 z-10">
          {/* 左侧：移动端菜单按钮 + 当前激活工具标题与一句话说明 */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl text-coconut-600 dark:text-darkbg-muted hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
              aria-label={lang === "en" ? "Open navigation" : "打开侧边导航"}
            >
              <Menu className="w-5 h-5" />
            </button>

            {(() => {
              const ToolIcon = currentActiveTool?.icon;
              return (
                <div className="flex items-center gap-3 min-w-0">
                  {ToolIcon && (
                    <div className="w-9 h-9 rounded-xl bg-accent-subtle text-accent flex items-center justify-center flex-shrink-0">
                      <ToolIcon className="w-4.5 h-4.5" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h1 className="text-sm sm:text-base font-bold text-coconut-950 dark:text-white truncate">
                        {currentActiveTool?.name}
                      </h1>
                      <span className="hidden md:inline-block text-xs text-coconut-300 dark:text-darkbg-border">
                        ·
                      </span>
                      <span className="hidden md:inline-block text-xs text-coconut-500 dark:text-darkbg-muted truncate">
                        {currentCategory?.category}
                      </span>
                    </div>
                    <p className="text-xs text-coconut-500 dark:text-darkbg-muted truncate">
                      {currentActiveTool?.desc}
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* 右侧：6 大工作台分段快速切换器 */}
          <div
            onWheel={(e) => {
              if (e.deltaY !== 0) {
                e.currentTarget.scrollLeft += e.deltaY * 0.9;
              }
            }}
            className="hidden sm:flex items-center gap-1 overflow-x-auto no-scrollbar bg-black/[0.035] dark:bg-white/[0.04] p-1 rounded-xl border border-[var(--color-border)] flex-shrink-0"
          >
            {[
              { id: "pdf", label: t.modules.pdf, icon: FileText },
              { id: "document", label: t.modules.document, icon: FileCode2 },
              { id: "spreadsheet", label: t.modules.spreadsheet, icon: TableProperties },
              { id: "image", label: t.modules.image, icon: ImageIcon },
              { id: "audio", label: t.modules.audio, icon: Music },
              { id: "utilities", label: t.modules.utilities, icon: Wrench },
            ].map((m) => {
              const Icon = m.icon;
              const isCur = activeModule === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    setActiveModule(m.id as ModuleType);
                    setExpandedModule(m.id as ModuleType);
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all whitespace-nowrap flex-shrink-0 cursor-pointer ${
                    isCur
                      ? "bg-white dark:bg-[#2A2421] text-coconut-950 dark:text-white font-semibold shadow-2xs ring-1 ring-black/[0.05] dark:ring-white/[0.08]"
                      : "text-coconut-600 dark:text-darkbg-muted hover:text-coconut-950 dark:hover:text-white font-medium"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isCur ? "text-accent" : ""}`} />
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>
        </header>

        {/* 主工作区滚动容器：去除冗余横幅卡片，直接呈现核心工具画布 */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:px-8 lg:py-6 custom-main-scrollbar space-y-5 overscroll-contain">
          {/* PDF 工具 (Keep-Alive content-visibility 加速) */}
          {(visitedModules.has("pdf") || activeModule === "pdf") && (
            <div className={activeModule === "pdf" ? "keep-alive-active animate-fade-in" : "keep-alive-inactive"}>
              <PdfToolbox
                currentTab={activePdfTab}
                onTabChange={setActivePdfTab}
                incomingFiles={incomingPdfFiles}
                onIncomingFilesHandled={() => setIncomingPdfFiles([])}
              />
            </div>
          )}

          {/* 文档办公 (Keep-Alive content-visibility 加速) */}
          {(visitedModules.has("document") || activeModule === "document") && (
            <div className={activeModule === "document" ? "keep-alive-active animate-fade-in" : "keep-alive-inactive"}>
              <DocumentToolbox
                currentTab={activeDocTab}
                onTabChange={setActiveDocTab}
                incomingFiles={incomingDocFiles}
                onIncomingFilesHandled={() => setIncomingDocFiles([])}
              />
            </div>
          )}

          {/* 表格数据 (Keep-Alive content-visibility 加速) */}
          {(visitedModules.has("spreadsheet") || activeModule === "spreadsheet") && (
            <div className={activeModule === "spreadsheet" ? "keep-alive-active animate-fade-in" : "keep-alive-inactive"}>
              <SpreadsheetToolbox
                currentTab={activeSpreadsheetTab}
                onTabChange={setActiveSpreadsheetTab}
                incomingFiles={incomingSpreadsheetFiles}
                onIncomingFilesHandled={() => setIncomingSpreadsheetFiles([])}
              />
            </div>
          )}

          {/* 图像处理 (Keep-Alive content-visibility 加速) */}
          {(visitedModules.has("image") || activeModule === "image") && (
            <div className={activeModule === "image" ? "keep-alive-active animate-fade-in" : "keep-alive-inactive"}>
              <ImageToolbox
                currentTab={activeImageTab}
                onTabChange={setActiveImageTab}
                incomingFiles={incomingImageFiles}
                onIncomingFilesHandled={() => setIncomingImageFiles([])}
              />
            </div>
          )}

          {/* 音频处理 (Keep-Alive content-visibility 加速) */}
          {(visitedModules.has("audio") || activeModule === "audio") && (
            <div className={activeModule === "audio" ? "keep-alive-active animate-fade-in" : "keep-alive-inactive"}>
              <AudioToolbox
                currentTab={activeAudioTab}
                onTabChange={setActiveAudioTab}
                incomingFile={incomingAudioFile}
                onIncomingFileHandled={() => setIncomingAudioFile(null)}
              />
            </div>
          )}

          {/* 实用工具 (Keep-Alive content-visibility 加速) */}
          {(visitedModules.has("utilities") || activeModule === "utilities") && (
            <div className={activeModule === "utilities" ? "keep-alive-active animate-fade-in" : "keep-alive-inactive"}>
              <DailyToolbox
                currentTab={activeDailyTab}
                onTabChange={setActiveDailyTab}
                initialPhotoFile={incomingIdPhotoFile}
                onInitialPhotoHandled={() => setIncomingIdPhotoFile(null)}
                incomingDiffText={incomingDiffText}
                onIncomingDiffHandled={() => setIncomingDiffText(null)}
              />
            </div>
          )}
        </main>
      </div>

      {/* 软件版本与自动更新弹窗 */}
      <UpdateModal
        isOpen={updateModalOpen}
        onClose={() => setUpdateModalOpen(false)}
      />

      {/* 全局偏好与系统设置中心 */}
      <SettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        onOpenUpdateModal={() => setUpdateModalOpen(true)}
      />

      {/* 全局快捷键指南速查面板 */}
      <ShortcutsModal
        isOpen={shortcutsModalOpen}
        onClose={() => setShortcutsModalOpen(false)}
        lang={lang}
      />

      {/* 全局轻提示 Toast */}
      {toastMsg && (
        <div className="fixed bottom-5 right-5 z-50 px-3.5 py-2 rounded-xl bg-coconut-950/90 dark:bg-[#26221F]/95 backdrop-blur-md text-white text-xs font-medium shadow-lg border border-white/10 flex items-center gap-2 animate-fade-in pointer-events-none">
          <span>{toastMsg.message}</span>
        </div>
      )}
    </div>
  );
}
