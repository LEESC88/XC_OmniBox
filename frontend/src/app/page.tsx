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
} from "lucide-react";
import CoconutLogo from "@/components/CoconutLogo";
import DocumentToolbox, { DocTabType } from "@/components/DocumentToolbox";
import InPlacePdfEditor from "@/components/InPlacePdfEditor";
import SpreadsheetToolbox, { SpreadsheetTab } from "@/components/SpreadsheetToolbox";
import ImageToolbox from "@/components/ImageToolbox";
import AudioToolbox from "@/components/AudioToolbox";
import DailyToolbox from "@/components/DailyToolbox";
import AiToolbox, { AiTabType } from "@/components/AiToolbox";
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
  | "speed"
  | "karaoke";
type DailyTabType = "idphoto" | "organize" | "duplicate" | "qrcode" | "diff";
type SpreadsheetTabType = "sheet-merge" | "sheet-split";
type ModuleType = "document" | "spreadsheet" | "image" | "audio" | "utilities" | "ai";

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
    category: "文档处理与 PDF",
    module: "document",
    icon: FileText,
    tools: [
      {
        id: "pdf-edit",
        module: "document",
        name: "PDF 在线原位编辑",
        desc: "1:1 原版排版就地改字与图层修改",
        badge: "Word级",
        icon: Edit3,
        keywords: ["pdf", "编辑", "改字", "修改", "word"],
      },
      {
        id: "pdf-to-word",
        module: "document",
        name: "PDF 逆向转 Word",
        desc: "高保真提取表格与文本排版",
        badge: "推荐",
        icon: FileText,
        keywords: ["pdf", "转word", "提取", "转换", "docx"],
      },
      {
        id: "word-to-pdf",
        module: "document",
        name: "Word 转超清 PDF",
        desc: "打印级矢量无损输出保留清晰度",
        badge: "300DPI",
        icon: FileCode2,
        keywords: ["word", "转pdf", "超清", "无损", "打印"],
      },
      {
        id: "pdf-merge",
        module: "document",
        name: "多 PDF 拼合合并",
        desc: "多文件按需排序混编整合",
        badge: "多选",
        icon: Combine,
        keywords: ["pdf", "合并", "拼接", "多文件"],
      },
      {
        id: "pdf-split",
        module: "document",
        name: "PDF 拆分与范围提取",
        desc: "按页码区间抽取指定页面",
        badge: "范围",
        icon: Scissors,
        keywords: ["pdf", "拆分", "提取", "截取", "分割"],
      },
      {
        id: "pdf-organize",
        module: "document",
        name: "PDF 页面可视化调度",
        desc: "拖拽调序、单页独立旋转 90°/180°、剔除废页",
        badge: "画板",
        icon: Layers,
        keywords: ["pdf", "页面", "排序", "调序", "旋转", "删减", "画板"],
      },
      {
        id: "pdf-watermark",
        module: "document",
        name: "PDF 文字印章水印",
        desc: "倾斜半透明防伪防盗用标记",
        badge: "水印",
        icon: Stamp,
        keywords: ["pdf", "水印", "文字", "印章", "防伪"],
      },
      {
        id: "pdf-compress",
        module: "document",
        name: "PDF 智能极限压缩",
        desc: "消除冗余流与高保真图像下采样，大幅瘦身体积",
        badge: "省80%",
        icon: Minimize2,
        keywords: ["pdf", "压缩", "瘦身", "减小", "体积", "优化"],
      },
      {
        id: "images-to-pdf",
        module: "document",
        name: "多图一键合成 PDF",
        desc: "多张图片拖拽排序，自由合成单页或 A4 标准文档",
        badge: "高保真",
        icon: Combine,
        keywords: ["图片", "jpg", "png", "转pdf", "合成", "相册"],
      },
      {
        id: "pdf-protect",
        module: "document",
        name: "文档密码权限保护",
        desc: "AES 高强度加密限制阅读打印",
        badge: "安全",
        icon: Lock,
        keywords: ["pdf", "密码", "加密", "保护", "权限"],
      },
    ],
  },
  {
    category: "表格与数据整理",
    module: "spreadsheet",
    icon: TableProperties,
    tools: [
      {
        id: "sheet-merge",
        module: "spreadsheet",
        name: "多表智能拼接",
        desc: "自动对齐表头列名，缺失字段留空补位，批量拼合总表",
        badge: "自动对齐",
        icon: Combine,
        keywords: ["excel", "合并", "拼接", "表格", "汇总", "merge", "sheet", "csv"],
      },
      {
        id: "sheet-split",
        module: "spreadsheet",
        name: "大表按列拆分",
        desc: "指定关键列字段（如部门/月份），一键拆分为多个文件并打包",
        badge: "按列分拆",
        icon: Scissors,
        keywords: ["excel", "拆分", "分表", "分组", "split", "sheet", "csv"],
      },
    ],
  },
  {
    category: "图片与视觉工坊",
    module: "image",
    icon: ImageIcon,
    tools: [
      {
        id: "compress",
        module: "image",
        name: "智能极速压缩",
        desc: "TinyPNG 级高质量无损减容",
        badge: "省90%",
        icon: Zap,
        keywords: ["图片", "压缩", "缩小", "体积", "tinypng"],
      },
      {
        id: "heic",
        module: "image",
        name: "苹果 HEIC 秒转",
        desc: "iPhone 实况与原图转 JPEG/PNG",
        badge: "苹果",
        icon: Apple,
        keywords: ["heic", "苹果", "iphone", "照片", "转jpg"],
      },
      {
        id: "convert",
        module: "image",
        name: "万能格式互转",
        desc: "WebP / JPG / PNG / ICO 任意互转",
        badge: "全格式",
        icon: RefreshCw,
        keywords: ["图片", "格式", "转换", "webp", "ico", "png"],
      },
      {
        id: "resize",
        module: "image",
        name: "尺寸精细缩放",
        desc: "证件照、社媒封面与壁纸预设",
        badge: "预设",
        icon: Maximize2,
        keywords: ["图片", "缩放", "尺寸", "分辨率", "裁剪"],
      },
      {
        id: "exif",
        module: "image",
        name: "EXIF 隐私抹除",
        desc: "抹去 GPS 位置与相机设备信息",
        badge: "防泄密",
        icon: ShieldCheck,
        keywords: ["exif", "隐私", "gps", "定位", "元数据"],
      },
      {
        id: "watermark",
        module: "image",
        name: "批量防盗水印",
        desc: "文字满铺与品牌 Logo 贴图盖章",
        badge: "防盗",
        icon: Stamp,
        keywords: ["图片", "水印", "logo", "版权", "盖章"],
      },
    ],
  },
  {
    category: "音频与声学工坊",
    module: "audio",
    icon: Music,
    tools: [
      {
        id: "trim",
        module: "audio",
        name: "无损音频剪辑",
        desc: "毫秒级波形试听裁剪、卡点与铃声制作",
        badge: "波形",
        icon: Scissors,
        keywords: ["音频", "剪切", "剪辑", "音乐", "铃声"],
      },
      {
        id: "convert",
        module: "audio",
        name: "音频格式转码",
        desc: "MP3 / WAV 高保真音频批量互转",
        badge: "320K",
        icon: RefreshCw,
        keywords: ["音频", "转码", "格式", "mp3", "wav", "flac"],
      },
      {
        id: "merge",
        module: "audio",
        name: "多音频无缝拼接",
        desc: "多音轨按顺序无缝混流串烧",
        badge: "串烧",
        icon: Combine,
        keywords: ["音频", "拼接", "合并", "混流", "串烧"],
      },
      {
        id: "extract",
        module: "audio",
        name: "视频原声提取",
        desc: "MP4 / MKV 视频画面预览并按需截取原声",
        badge: "声画同步",
        icon: Film,
        keywords: ["视频", "提取", "伴奏", "mp4", "音频"],
      },
      {
        id: "volume",
        module: "audio",
        name: "音量与人声清晰化",
        desc: "0%~300% 动态放大、滤除空调杂音底噪与广播级防爆音",
        badge: "清晰化",
        icon: Volume2,
        keywords: ["音量", "放大", "增益", "降噪", "去杂音"],
      },
      {
        id: "speed",
        module: "audio",
        name: "音频倍速与倒放",
        desc: "0.5x~2.0x 变速不变调与短视频趣味倒放",
        badge: "倍速/倒放",
        icon: Clock,
        keywords: ["变速", "倍速", "倒放", "快放", "慢放"],
      },
      {
        id: "karaoke",
        module: "audio",
        name: "卡拉OK伴奏提取",
        desc: "中央声道人声消除与低音保留，一键做伴奏",
        badge: "一键伴奏",
        icon: Mic,
        keywords: ["伴奏", "消人声", "卡拉ok", "ktv", "人声提取"],
      },
    ],
  },
  {
    category: "日常与便民工坊",
    module: "utilities",
    icon: Wrench,
    tools: [
      {
        id: "idphoto",
        module: "utilities",
        name: "证件照换底排版",
        desc: "红白蓝灰智能换底与 6 寸打印排版",
        badge: "6寸打印",
        icon: UserCheck,
        keywords: ["证件照", "换底", "排版", "冲印", "相纸"],
      },
      {
        id: "organize",
        module: "utilities",
        name: "目录智能归类大师",
        desc: "按格式类型/修改年月快速归档与空文件清理，带变更预览",
        badge: "智能归类",
        icon: FolderTree,
        keywords: ["整理", "归类", "归档", "格式", "分类", "年月", "organize"],
      },
      {
        id: "duplicate",
        module: "utilities",
        name: "重复文件极速排重",
        desc: "三级阶梯哈希精准比对，智能推荐标记与安全移入回收站",
        badge: "极速查重",
        icon: CopyCheck,
        keywords: ["重复", "查重", "排重", "清理", "哈希", "duplicate"],
      },
      {
        id: "qrcode",
        module: "utilities",
        name: "个性化艺术二维码",
        desc: "炫彩渐变色与中心嵌入 Logo",
        badge: "Logo",
        icon: QrCode,
        keywords: ["二维码", "qr", "扫码", "生成", "渐变"],
      },
      {
        id: "diff",
        module: "utilities",
        name: "文章与文本对比",
        desc: "文章段落与文本增删变动实时高亮与精细对比",
        badge: "文章对比",
        icon: GitCompare,
        keywords: ["diff", "对比", "文章", "文本", "差异"],
      },
    ],
  },
  {
    category: "AI 智能工坊",
    module: "ai",
    icon: Sparkles,
    tools: [
      {
        id: "ai-bg-remove",
        module: "ai",
        name: "AI 发丝级智能抠图",
        desc: "逐像素分离人像与复杂背景，支持一键证件照换底排版",
        badge: "AI抠图",
        icon: Sparkles,
        keywords: ["抠图", "去除背景", "透明底", "人像", "发丝", "ai"],
      },
      {
        id: "ai-inpaint",
        module: "ai",
        name: "AI 消除笔 / 去水印",
        desc: "智能涂抹消除画面杂物、路人、水印与瑕疵，边缘平滑修补",
        badge: "智能涂抹",
        icon: Eraser,
        keywords: ["消除", "去水印", "橡皮擦", "涂抹", "擦除", "inpaint", "ai"],
      },
      {
        id: "ai-searchable-pdf",
        module: "ai",
        name: "双层可搜索 PDF 制作",
        desc: "将扫描件/图像注入底层透明文字排版层，实现极速检索与精准划词复制",
        badge: "双层PDF",
        icon: FileSearch,
        keywords: [
          "可搜索pdf",
          "双层pdf",
          "扫描件",
          "ocr",
          "复制文字",
          "pdf",
          "ai",
        ],
      },
      {
        id: "ai-subtitle",
        module: "ai",
        name: "音视频智能断句字幕",
        desc: "离线硬件级音频能量切片，毫秒对齐语音时间轴，一键导出 SRT/VTT 字幕",
        badge: "字幕提取",
        icon: Captions,
        keywords: ["字幕", "断句", "vad", "srt", "vtt", "音频", "视频", "ai"],
      },
      {
        id: "ai-ocr",
        module: "ai",
        name: "AI 文字提取 (OCR)",
        desc: "高精提取中英文、书籍、发票及表格字形，支持一键复制与 TXT 导出",
        badge: "多语言",
        icon: FileText,
        keywords: ["ocr", "文字提取", "识别", "扫描", "文字识别", "ai"],
      },
      {
        id: "ai-upscale",
        module: "ai",
        name: "AI 模糊图片高清修复",
        desc: "2x / 4x 超分辨率重建与边缘锐化，让低清模糊图焕发新生",
        badge: "超分辨率",
        icon: Maximize2,
        keywords: ["超清", "修复", "高清", "放大", "清晰度", "降噪", "ai"],
      },
    ],
  },
];

export default function Home() {
  const { lang, setLang, t } = useI18n();
  const toolsRegistry = useMemo(
    () => getLocalizedTools(TOOLS_REGISTRY, lang),
    [lang],
  );
  const [activeModule, setActiveModuleState] = useState<ModuleType>("document");
  const [visitedModules, setVisitedModules] = useState<Set<ModuleType>>(
    () => new Set<ModuleType>(["document"])
  );
  const setActiveModule = (mod: ModuleType) => {
    setVisitedModules((prev) => {
      if (prev.has(mod)) return prev;
      const next = new Set(prev);
      next.add(mod);
      return next;
    });
    setActiveModuleState(mod);
  };
  const [expandedModule, setExpandedModule] = useState<ModuleType | null>(null);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [activeDocTab, setActiveDocTab] = useState<DocTabType>("pdf-edit");
  const [editorData, setEditorData] = useState<{
    file: File;
    title: string;
    numPages: number;
    pages: any[];
  } | null>(null);
  const [activeImageTab, setActiveImageTab] =
    useState<ImageTabType>("compress");
  const [activeAudioTab, setActiveAudioTab] = useState<AudioTabType>("trim");
  const [activeDailyTab, setActiveDailyTab] = useState<DailyTabType>("idphoto");
  const [activeSpreadsheetTab, setActiveSpreadsheetTab] =
    useState<SpreadsheetTabType>("sheet-merge");
  const [activeAiTab, setActiveAiTab] = useState<AiTabType>("ai-bg-remove");
  const [incomingDocFiles, setIncomingDocFiles] = useState<File[]>([]);
  const [incomingIdPhotoFile, setIncomingIdPhotoFile] = useState<File | null>(
    null,
  );
  const [incomingSpreadsheetFiles, setIncomingSpreadsheetFiles] = useState<File[]>([]);
  const [incomingImageFiles, setIncomingImageFiles] = useState<File[]>([]);
  const [incomingAudioFile, setIncomingAudioFile] = useState<File | null>(null);
  const [incomingAiFile, setIncomingAiFile] = useState<File | null>(null);
  const [incomingDiffText, setIncomingDiffText] = useState<{
    text: string;
    side: "original" | "modified";
  } | null>(null);

  // 跨工具总线监听：无损内存零拷贝流转
  useEffect(() => {
    const unsubscribe = toolBus.subscribe(({ target, payload }) => {
      setActiveModule(target.module);
      if (target.module === "spreadsheet") {
        setActiveSpreadsheetTab(target.tab as SpreadsheetTabType);
        const f = blobToFile(payload.blob || payload.file, payload.filename);
        if (f) {
          setIncomingSpreadsheetFiles([f]);
        }
      } else if (target.module === "image") {
        setActiveImageTab(target.tab as ImageTabType);
        const f = blobToFile(payload.blob || payload.file, payload.filename);
        if (f) {
          setIncomingImageFiles([f]);
        }
      } else if (target.module === "audio") {
        setActiveAudioTab(target.tab as AudioTabType);
        const f = blobToFile(payload.blob || payload.file, payload.filename);
        if (f) {
          setIncomingAudioFile(f);
        }
      } else if (target.module === "ai") {
        setActiveAiTab(target.tab as AiTabType);
        const f = blobToFile(payload.blob || payload.file, payload.filename);
        if (f) {
          setIncomingAiFile(f);
        }
      } else if (target.module === "utilities") {
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
      } else if (target.module === "document") {
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
  const [appVersion, setAppVersion] = useState<string>("1.5.4");

  // 快捷键指南弹窗状态与全局提示
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ id: number; message: string } | null>(null);

  const showToast = (message: string) => {
    const id = Date.now();
    setToastMsg({ id, message });
    setTimeout(() => {
      setToastMsg((curr) => (curr?.id === id ? null : curr));
    }, 2500);
  };

  // 全局快捷键监听 (Ctrl+Enter, Ctrl+S, Ctrl+,, Ctrl+/, Ctrl+1~5, Esc)
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

        if (!isEditable && ["1", "2", "3", "4", "5"].includes(e.key)) {
          e.preventDefault();
          const moduleMap: Record<string, ModuleType> = {
            "1": "document",
            "2": "image",
            "3": "audio",
            "4": "utilities",
            "5": "ai",
          };
          const targetMod = moduleMap[e.key];
          if (targetMod) {
            setActiveModule(targetMod);
            showToast(
              lang === "en"
                ? `Switched to ${targetMod.toUpperCase()}`
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
            showToast(lang === "en" ? "Action triggered via Ctrl+Enter" : "已通过 Ctrl+Enter 触发执行");
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
            showToast(lang === "en" ? "Downloaded via Ctrl+S" : "已通过 Ctrl+S 触发快捷下载");
          } else {
            shortcutBus.emit("download-result");
          }
          return;
        }
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [shortcutsModalOpen, settingsModalOpen, updateModalOpen, lang]);

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
                    ? "Image pasted into Image Studio"
                    : "已从剪贴板接收图片至图像工坊"
                );
              } else if (activeModule === "ai") {
                setIncomingAiFile(namedFile);
                showToast(
                  lang === "en"
                    ? "Image pasted into AI Studio"
                    : "已从剪贴板接收图片至 AI 创意工坊"
                );
              } else if (activeModule === "utilities" && activeDailyTab === "idphoto") {
                setIncomingIdPhotoFile(namedFile);
                showToast(
                  lang === "en"
                    ? "Photo pasted into ID Photo Studio"
                    : "已从剪贴板接收照片至证件照工坊"
                );
              } else if (activeModule === "document" && activeDocTab === "images-to-pdf") {
                setIncomingDocFiles((prev) => [...prev, namedFile]);
                showToast(
                  lang === "en"
                    ? "Image added to PDF queue"
                    : "已从剪贴板添加图片至 PDF 队列"
                );
              } else {
                setActiveModule("image");
                setActiveImageTab("compress");
                setIncomingImageFiles([namedFile]);
                showToast(
                  lang === "en"
                    ? "Image recognized! Switched to Image Studio"
                    : "识别到剪贴板图片！已自动切换至图像工坊"
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
              ? "Pasted text into Article Diff (Original)"
              : "已从剪贴板导入文本至文章对比（原版）"
          );
        }
      }
    };

    window.addEventListener("paste", handleGlobalPaste);
    return () => window.removeEventListener("paste", handleGlobalPaste);
  }, [activeModule, activeDocTab, activeDailyTab, lang]);

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
    const interval = setInterval(fetchHealth, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleDocTabChange = (tab: DocTabType) => {
    setActiveDocTab(tab);
  };

  const handleSelectTool = (item: ToolItem) => {
    setActiveModule(item.module);
    setExpandedModule(item.module);
    if (item.module === "document") {
      setActiveDocTab(item.id as DocTabType);
    } else if (item.module === "spreadsheet") {
      setActiveSpreadsheetTab(item.id as SpreadsheetTabType);
    } else if (item.module === "image") {
      setActiveImageTab(item.id as ImageTabType);
    } else if (item.module === "audio") {
      setActiveAudioTab(item.id as AudioTabType);
    } else if (item.module === "utilities") {
      setActiveDailyTab(item.id as DailyTabType);
    } else if (item.module === "ai") {
      setActiveAiTab(item.id as AiTabType);
    }
    setMobileMenuOpen(false);
  };




  const allTools = toolsRegistry.flatMap((g) => g.tools);

  const currentCategory =
    toolsRegistry.find((g) => g.module === activeModule) || toolsRegistry[0];
  const currentActiveTool =
    activeModule === "document"
      ? allTools.find((t) => t.id === activeDocTab)
      : activeModule === "spreadsheet"
        ? allTools.find((t) => t.id === activeSpreadsheetTab)
        : activeModule === "image"
          ? allTools.find((t) => t.id === activeImageTab)
          : activeModule === "audio"
            ? allTools.find((t) => t.id === activeAudioTab)
            : activeModule === "utilities"
              ? allTools.find((t) => t.id === activeDailyTab)
              : allTools.find((t) => t.id === activeAiTab);

  // 如果处于在线编辑工作台模式，全屏展示 A4 拟真编辑器 (零布局位移、无遮挡)
  if (
    activeModule === "document" &&
    activeDocTab === "pdf-edit" &&
    editorData
  ) {
    return (
      <main className="h-screen w-screen overflow-hidden bg-coconut-100/60 dark:bg-darkbg-canvas flex flex-col p-2 sm:p-4">
        <InPlacePdfEditor
          originalFile={editorData.file}
          docTitle={editorData.title}
          numPages={editorData.numPages}
          pages={editorData.pages}
          onExit={() => setEditorData(null)}
        />
      </main>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-transparent text-coconut-900 dark:text-darkbg-text subpixel-antialiased">
      {/* 移动端侧边抽屉遮罩 */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 lg:hidden animate-fade-in"
        />
      )}

      {/* ===================== 左侧 PRO 侧边栏 ===================== */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 flex flex-col bg-[var(--color-sidebar-bg)] border-r border-[var(--color-border)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          mobileMenuOpen
            ? "translate-x-0 w-80 max-w-[85vw]"
            : "-translate-x-full lg:translate-x-0"
        } ${sidebarCollapsed ? "lg:w-20" : "lg:w-72"}`}
      >
        {/* 顶部品牌 */}
        <div
          className={`border-b border-coconut-200/80 dark:border-darkbg-border flex items-center transition-all duration-300 ${
            sidebarCollapsed ? "p-3 justify-center" : "p-4 justify-between"
          }`}
        >
          {sidebarCollapsed ? (
            /* 折叠态：居中猫肉球 Logo 按钮，点击直接展开侧边栏 */
            <button
              onClick={() => setSidebarCollapsed(false)}
              className="p-1 rounded-2xl hover:bg-coconut-100 dark:hover:bg-darkbg-elevated transition-transform active:scale-95 group relative flex items-center justify-center cursor-pointer"
              title={
                lang === "en" ? "Click to expand sidebar" : "点击展开侧边栏"
              }
            >
              <CatPawLogo size={40} />
              <span className="sr-only">
                {lang === "en" ? "Expand sidebar" : "展开侧边栏"}
              </span>
            </button>
          ) : (
            /* 展开态：左侧治愈系猫肉球 Logo (点击即可收起侧边栏) + 品牌名 */
            <>
              <div className="flex items-center gap-3 truncate">
                <button
                  onClick={() => setSidebarCollapsed(true)}
                  className="p-1 rounded-2xl hover:bg-coconut-100 dark:hover:bg-darkbg-elevated transition-transform active:scale-95 cursor-pointer flex-shrink-0"
                  title={
                    lang === "en"
                      ? "Click to collapse sidebar"
                      : "点击收起侧边栏"
                  }
                >
                  <CatPawLogo size={40} />
                </button>
                <div className="truncate select-none">
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-base text-coconut-950 dark:text-white">
                      XC OmniBox
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent-gradient text-white font-mono font-bold shadow-xs">
                      Studio
                    </span>
                  </div>
                  <p className="text-xs text-coconut-600 dark:text-darkbg-muted truncate mt-0.5">
                    {t.sidebar.subTitle}
                  </p>
                </div>
              </div>

              {/* 移动端保留关闭抽屉按钮 */}
              <div className="flex items-center gap-1 lg:hidden">
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 rounded-xl text-coconut-500 hover:text-coconut-800 dark:text-darkbg-muted hover:bg-coconut-100 dark:hover:bg-darkbg-elevated"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </>
          )}
        </div>

        {/* 导航工具树：折叠态仅展示 5 个核心分类大图标，展开态为手风琴手感 */}
        <div className="flex-1 overflow-y-auto p-2 space-y-3 custom-main-scrollbar overscroll-contain">
          {sidebarCollapsed ? (
            /* ================= 折叠模式 (w-20)：仅显示 5 个分类大图标 ================= */
            <div className="py-2 flex flex-col items-center space-y-3">
              {toolsRegistry.map((group) => {
                const GroupIcon = group.icon;
                const isGroupActive = activeModule === group.module;
                const shortLabel =
                  lang === "en"
                    ? group.module === "document"
                      ? "Docs"
                      : group.module === "image"
                        ? "Image"
                        : group.module === "audio"
                          ? "Audio"
                          : group.module === "utilities"
                            ? "Utils"
                            : "AI"
                    : group.module === "document"
                      ? "文档"
                      : group.module === "image"
                        ? "图片"
                        : group.module === "audio"
                          ? "音频"
                          : group.module === "utilities"
                            ? "日常"
                            : "AI工坊";

                return (
                  <button
                    key={group.module}
                    onClick={() => {
                      setActiveModule(group.module);
                      setExpandedModule(group.module);
                    }}
                    title={`${group.category} (${lang === "en" ? `${group.tools.length} tools` : `共 ${group.tools.length} 项工具`})`}
                    className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center transition-all relative group active:scale-95 cursor-pointer ${
                      isGroupActive
                        ? "bg-accent-gradient text-white shadow-3d-sunset scale-105"
                        : "text-coconut-600 dark:text-darkbg-muted hover:bg-coconut-100/80 dark:hover:bg-darkbg-elevated hover:text-coconut-950 dark:hover:text-darkbg-text"
                    }`}
                  >
                    <GroupIcon className="w-5.5 h-5.5" />
                    <span className="text-[9px] font-bold mt-0.5">
                      {shortLabel}
                    </span>
                    {isGroupActive && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-white dark:ring-darkbg-card animate-pulse" />
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            /* ================= 展开模式 (w-72)：手风琴分类导航，支持点击展开与再次点击收回 ================= */
            toolsRegistry.map((group) => {
              const GroupIcon = group.icon;
              const isGroupActive = activeModule === group.module;
              const isGroupExpanded = expandedModule === group.module;
              return (
                <div key={group.category} className="space-y-1">
                  {/* 分类标题卡片：点击展开/收回手风琴；如果收回状态点击则同时激活该模块 */}
                  <button
                    onClick={() => {
                      if (isGroupExpanded) {
                        setExpandedModule(null); // 点了再次点击收回！
                      } else {
                        setExpandedModule(group.module); // 点了才打开，并激活该分类
                        setActiveModule(group.module);
                      }
                    }}
                    title={
                      isGroupExpanded
                        ? lang === "en"
                          ? "Click to collapse all tools"
                          : "点击收回折叠全部工具"
                        : lang === "en"
                          ? "Click to expand all tools"
                          : "点击展开全部工具"
                    }
                    className={`w-full flex items-center justify-between p-2.5 rounded-2xl text-sm font-bold transition-all select-none active:scale-[0.99] ${
                      isGroupActive
                        ? "bg-accent-subtle text-coconut-950 dark:text-white border border-accent-border shadow-xs"
                        : "text-coconut-800 dark:text-darkbg-muted hover:bg-coconut-100/70 dark:hover:bg-darkbg-elevated hover:text-coconut-950 dark:hover:text-darkbg-text"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <div
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform shadow-2xs ${
                          isGroupActive
                            ? "bg-accent-gradient text-white shadow-xs scale-105"
                            : "bg-coconut-200/70 dark:bg-darkbg-subtle text-coconut-800 dark:text-darkbg-text"
                        }`}
                      >
                        <GroupIcon className="w-5 h-5" />
                      </div>
                      <span className="truncate">{group.category}</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-coconut-200/60 dark:bg-darkbg-subtle font-mono text-coconut-700 dark:text-darkbg-muted font-semibold">
                        {group.tools.length}
                      </span>
                      <ChevronRight
                        className={`w-4 h-4 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                          isGroupExpanded
                            ? "rotate-90 text-orange-600 font-bold"
                            : "text-coconut-400 opacity-60"
                        }`}
                      />
                    </div>
                  </button>

                  {/* 丝滑手风琴抽屉动画：CSS Grid 无级平滑展开收起 */}
                  <div
                    className={`grid transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden ${
                      isGroupExpanded
                        ? "grid-rows-[1fr] opacity-100 mt-1"
                        : "grid-rows-[0fr] opacity-0 mt-0 pointer-events-none"
                    }`}
                  >
                    <div className="min-h-0 pl-3 pr-1 py-1 space-y-1 border-l-2 border-orange-500/50 ml-3.5">
                      {group.tools.map((t) => {
                        const Icon = t.icon;
                        const isCur =
                          activeModule === t.module &&
                          ((t.module === "document" && activeDocTab === t.id) ||
                            (t.module === "spreadsheet" && activeSpreadsheetTab === t.id) ||
                            (t.module === "image" && activeImageTab === t.id) ||
                            (t.module === "audio" && activeAudioTab === t.id) ||
                            (t.module === "utilities" &&
                              activeDailyTab === t.id) ||
                            (t.module === "ai" && activeAiTab === t.id));

                        return (
                          <button
                            key={t.id}
                            onClick={() => handleSelectTool(t)}
                            className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left text-xs sm:text-sm transition-all active:scale-[0.98] ${
                              isCur
                                ? "bg-accent-gradient text-white font-bold shadow-3d-sunset scale-[1.01]"
                                : "text-coconut-800 dark:text-darkbg-muted hover:bg-coconut-100/70 dark:hover:bg-darkbg-elevated hover:text-coconut-950 dark:hover:text-darkbg-text font-medium"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 truncate min-w-0 flex-1">
                              <Icon
                                className={`w-4 h-4 flex-shrink-0 ${isCur ? "text-amber-100" : "text-coconut-600 dark:text-darkbg-muted"}`}
                              />
                              <span className="truncate">{t.name}</span>
                            </div>
                            {t.badge && (
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold transition-colors flex-shrink-0 ml-1.5 ${
                                  isCur
                                    ? "bg-white/25 text-white"
                                    : "bg-coconut-200/70 dark:bg-darkbg-subtle text-coconut-700 dark:text-darkbg-muted"
                                }`}
                              >
                                {t.badge}
                              </span>
                            )}
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

        {/* 侧边栏底部：偏好设置、深浅模式切换与软件更新中心 */}
        <div className="p-3 border-t border-coconut-100 dark:border-darkbg-border bg-coconut-50/50 dark:bg-darkbg-card/50 flex flex-col gap-2 items-center justify-center">
          {sidebarCollapsed ? (
            <>
              {/* 折叠态偏好设置按钮 */}
              <button
                onClick={() => setSettingsModalOpen(true)}
                className="w-12 h-12 rounded-2xl border border-coconut-200/80 dark:border-darkbg-border bg-white/90 dark:bg-darkbg-subtle flex items-center justify-center text-coconut-800 dark:text-darkbg-text hover:bg-coconut-100 dark:hover:bg-darkbg-elevated transition-all active:scale-95 shadow-2xs group cursor-pointer"
                title={
                  lang === "en"
                    ? "System Preferences (Tray / Auto-start / Formats / Storage)"
                    : "系统偏好设置 (托盘行为/开机自启/格式转换/文件存储)"
                }
              >
                <CoconutLogo size={32} variant="settings" />
              </button>

              <button
                onClick={toggleTheme}
                className="w-12 h-12 rounded-2xl border border-coconut-200/80 dark:border-darkbg-border bg-white/90 dark:bg-darkbg-subtle flex items-center justify-center text-coconut-800 dark:text-darkbg-text hover:bg-coconut-100 dark:hover:bg-darkbg-elevated transition-all active:scale-95 shadow-2xs group cursor-pointer"
                title={
                  lang === "en"
                    ? `Switch theme (Current: ${isDark ? "Dark" : "Light"})`
                    : `切换外观主题 (当前: ${isDark ? "曜黑暗夜" : "暖椰润肤"})`
                }
              >
                {isDark ? (
                  <Sun className="w-6 h-6 text-amber-500 transition-transform duration-300 group-hover:rotate-45" />
                ) : (
                  <Moon className="w-6 h-6 text-coconut-800 transition-transform duration-300 group-hover:-rotate-12" />
                )}
              </button>

              <button
                onClick={() => setUpdateModalOpen(true)}
                className="w-12 h-12 rounded-2xl border border-coconut-200/80 dark:border-darkbg-border bg-white/90 dark:bg-darkbg-subtle flex items-center justify-center text-coconut-800 dark:text-darkbg-text hover:bg-coconut-100 dark:hover:bg-darkbg-elevated transition-all active:scale-95 shadow-2xs relative group cursor-pointer"
                title={
                  lang === "en"
                    ? "Check software version & updates"
                    : "检查软件版本与更新"
                }
              >
                <Sparkles className="w-6 h-6 text-orange-500 transition-transform duration-300 group-hover:scale-110" />
                {hasUpdate && (
                  <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-white dark:ring-darkbg-card animate-ping" />
                )}
              </button>

              <button
                onClick={() => setShortcutsModalOpen(true)}
                className="w-12 h-12 rounded-2xl border border-coconut-200/80 dark:border-darkbg-border bg-white/90 dark:bg-darkbg-subtle flex items-center justify-center text-coconut-800 dark:text-darkbg-text hover:bg-coconut-100 dark:hover:bg-darkbg-elevated transition-all active:scale-95 shadow-2xs group cursor-pointer"
                title={lang === "en" ? "Shortcuts Guide (Ctrl + /)" : "快捷键指南 (Ctrl + /)"}
              >
                <Keyboard className="w-5 h-5 text-amber-500 group-hover:scale-110 transition-transform" />
              </button>
            </>
          ) : (
            <>
              {/* 展开态：全局偏好设置卡片按钮 (大图标对齐猫肉球尺寸) */}
              <button
                onClick={() => setSettingsModalOpen(true)}
                className="w-full flex items-center justify-between p-2.5 px-3.5 rounded-2xl border border-coconut-200/90 dark:border-darkbg-border bg-white/90 dark:bg-darkbg-subtle text-xs font-semibold text-coconut-800 dark:text-darkbg-text hover:bg-coconut-100/70 dark:hover:bg-darkbg-elevated transition-all active:scale-[0.98] shadow-2xs cursor-pointer group"
                title={
                  lang === "en"
                    ? "System Preferences (Tray / Auto-start / Engine / Storage / Cache)"
                    : "系统偏好设置 (托盘行为/开机自启/格式引擎/文件路径/缓存清理)"
                }
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-11 h-11 rounded-2xl bg-orange-50/90 dark:bg-[#2A1F19] flex items-center justify-center border border-orange-200/80 dark:border-[#4A372C] flex-shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                    <CoconutLogo size={34} variant="settings" />
                  </div>
                  <div className="text-left min-w-0 flex-1">
                    <div className="text-xs sm:text-sm font-bold text-coconut-950 dark:text-white leading-tight flex items-center gap-1.5">
                      <span className="truncate">{t.sidebar.preferences}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-950/80 dark:text-orange-300 font-mono font-bold flex-shrink-0">
                        Settings
                      </span>
                    </div>
                    <div className="text-[11px] text-coconut-600 dark:text-darkbg-muted leading-tight mt-0.5 truncate">
                      {t.sidebar.preferencesSub}
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-coconut-400 group-hover:translate-x-0.5 transition-transform flex-shrink-0 ml-1.5" />
              </button>

              {/* 外观模式切换卡片按钮 (大图标) */}
              <button
                onClick={toggleTheme}
                className="w-full flex items-center justify-between p-2.5 px-3.5 rounded-2xl border border-coconut-200/90 dark:border-darkbg-border bg-white/90 dark:bg-darkbg-subtle text-xs sm:text-sm font-semibold text-coconut-800 dark:text-darkbg-text hover:bg-coconut-100/70 dark:hover:bg-darkbg-elevated transition-all active:scale-[0.98] shadow-2xs cursor-pointer group"
                title={
                  lang === "en" ? "Switch interface theme" : "切换界面外观主题"
                }
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-11 h-11 rounded-2xl bg-amber-50/90 dark:bg-[#2A1F19] flex items-center justify-center border border-amber-200/80 dark:border-[#4A372C] flex-shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                    {isDark ? (
                      <Sun className="w-6 h-6 text-amber-500 transition-transform duration-300 group-hover:rotate-45" />
                    ) : (
                      <Moon className="w-6 h-6 text-coconut-800 transition-transform duration-300 group-hover:-rotate-12" />
                    )}
                  </div>
                  <div className="text-left min-w-0 flex-1">
                    <div className="text-xs sm:text-sm font-bold text-coconut-950 dark:text-white leading-tight truncate">
                      {isDark
                        ? t.sidebar.darkAppearance
                        : t.sidebar.lightAppearance}
                    </div>
                    <div className="text-[11px] text-coconut-600 dark:text-darkbg-muted font-mono leading-tight mt-0.5 truncate">
                      {lang === "en"
                        ? isDark
                          ? "OLED Dark Mode"
                          : "Warm Coconut Aesthetic"
                        : isDark
                          ? "Dark Appearance"
                          : "Light Appearance"}
                    </div>
                  </div>
                </div>

                {/* iOS / macOS 触感滑动 Pill 开关 */}
                <div
                  className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-300 flex items-center flex-shrink-0 ${
                    isDark
                      ? "bg-accent-gradient shadow-inner"
                      : "bg-coconut-300/80 dark:bg-darkbg-border"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-300 flex items-center justify-center ${
                      isDark ? "translate-x-5" : "translate-x-0"
                    }`}
                  >
                    {isDark ? (
                      <Moon className="w-2.5 h-2.5 text-orange-600" />
                    ) : (
                      <Sun className="w-2.5 h-2.5 text-amber-500" />
                    )}
                  </div>
                </div>
              </button>

              {/* 软件更新中心卡片按钮 (大图标) */}
              <button
                onClick={() => setUpdateModalOpen(true)}
                className="w-full flex items-center justify-between p-2.5 px-3.5 rounded-2xl border border-coconut-200/90 dark:border-darkbg-border bg-white/90 dark:bg-darkbg-subtle text-xs font-semibold text-coconut-800 dark:text-darkbg-text hover:bg-coconut-100/70 dark:hover:bg-darkbg-elevated transition-all active:scale-[0.98] shadow-2xs cursor-pointer group"
                title={t.sidebar.checkUpdate}
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-orange-100/80 dark:bg-[#2A1F19] flex items-center justify-center border border-orange-200/80 dark:border-[#4A372C] text-orange-600 dark:text-orange-400 flex-shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                    <Sparkles className="w-6 h-6 text-orange-500 transition-transform duration-300 group-hover:scale-110" />
                  </div>
                  <span className="text-xs sm:text-sm font-bold text-coconut-950 dark:text-white">
                    {t.sidebar.updateCenter}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {hasUpdate ? (
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-rose-500 text-white rounded-full animate-pulse">
                      {lang === "en" ? "NEW" : "发现新版"}
                    </span>
                  ) : (
                    <span className="text-xs font-mono font-bold text-coconut-600 dark:text-darkbg-muted">
                      v{appVersion}
                    </span>
                  )}
                </div>
              </button>

              {/* 快捷键指南卡片按钮 */}
              <button
                onClick={() => setShortcutsModalOpen(true)}
                className="w-full flex items-center justify-between p-2.5 px-3.5 rounded-2xl border border-coconut-200/90 dark:border-darkbg-border bg-white/90 dark:bg-darkbg-subtle text-xs font-semibold text-coconut-800 dark:text-darkbg-text hover:bg-coconut-100/70 dark:hover:bg-darkbg-elevated transition-all active:scale-[0.98] shadow-2xs cursor-pointer group"
                title={lang === "en" ? "Shortcuts Guide (Ctrl + /)" : "快捷键指南 (Ctrl + /)"}
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-amber-50/90 dark:bg-[#2A2318] flex items-center justify-center border border-amber-200/80 dark:border-[#4A3E26] text-amber-600 dark:text-amber-400 flex-shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                    <Keyboard className="w-5 h-5 text-amber-500 transition-transform duration-300 group-hover:scale-110" />
                  </div>
                  <span className="text-xs sm:text-sm font-bold text-coconut-950 dark:text-white">
                    {lang === "en" ? "Shortcuts" : "快捷键指南"}
                  </span>
                </div>
                <kbd className="px-2 py-0.5 text-[10px] font-mono font-bold bg-coconut-100 dark:bg-darkbg-elevated text-coconut-600 dark:text-darkbg-muted rounded border border-coconut-200 dark:border-darkbg-border">
                  Ctrl + /
                </kbd>
              </button>
            </>
          )}
        </div>
      </aside>

      {/* ===================== 右侧沉浸式主工作台 ===================== */}
      <div className="flex-1 h-full flex flex-col overflow-hidden min-w-0 relative">
        {/* 顶部工具栏与面包屑 */}
        <header className="h-14 border-b border-[var(--color-border)] bg-[var(--color-sidebar-bg)] px-4 sm:px-6 flex items-center justify-between flex-shrink-0 gap-3 z-10">
          {/* 左侧：移动端菜单按钮 + 面包屑 */}
          <div className="flex items-center gap-3 truncate">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl text-coconut-600 dark:text-darkbg-muted hover:bg-coconut-100 dark:hover:bg-darkbg-elevated transition-colors"
              aria-label={
                lang === "en" ? "Open sidebar navigation" : "打开侧边导航"
              }
            >
              <Menu className="w-5 h-5" />
            </button>

            <nav className="flex items-center gap-2 text-xs sm:text-sm text-coconut-700 dark:text-darkbg-muted truncate">
              <span className="hover:text-coconut-950 dark:hover:text-white transition-colors">
                {t.workspace}
              </span>
              <ChevronRight className="w-4 h-4 flex-shrink-0 text-coconut-400" />
              <span className="font-semibold text-coconut-800 dark:text-darkbg-text">
                {currentCategory?.category}
              </span>
              <ChevronRight className="w-4 h-4 flex-shrink-0 text-coconut-400" />
              <span className="font-bold text-coconut-950 dark:text-white truncate">
                {currentActiveTool?.name}
              </span>
            </nav>
          </div>

          {/* 右侧：5 大分类快速切换芯片 (自适应横向滚动，支持鼠标滚轮横移) */}
          <div
            onWheel={(e) => {
              if (e.deltaY !== 0) {
                e.currentTarget.scrollLeft += e.deltaY * 0.9;
              }
            }}
            className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-[65vw] sm:max-w-none bg-coconut-100/80 dark:bg-darkbg-subtle p-1 rounded-2xl border border-coconut-200/80 dark:border-darkbg-border flex-shrink-0 touch-pan-x"
          >
            {[
              { id: "document", label: t.modules.document, icon: FileText },
              { id: "spreadsheet", label: t.modules.spreadsheet, icon: TableProperties },
              { id: "image", label: t.modules.image, icon: ImageIcon },
              { id: "audio", label: t.modules.audio, icon: Music },
              { id: "utilities", label: t.modules.utilities, icon: Wrench },
              { id: "ai", label: t.modules.ai, icon: Sparkles },
            ].map((m) => {
              const Icon = m.icon;
              const isCur = activeModule === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    setActiveModule(m.id as any);
                    setExpandedModule(m.id as any);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap flex-shrink-0 active:scale-95 ${
                    isCur
                      ? "bg-accent-gradient text-white shadow-3d-sunset scale-[1.02]"
                      : "text-coconut-800 dark:text-darkbg-muted hover:text-coconut-950 dark:hover:text-darkbg-text hover:bg-coconut-200/50"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>
        </header>

        {/* 主工作区滚动容器：极速 120fps 原生流畅滚动 + 优雅定制微滑轨 + 防链式抖动 */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 custom-main-scrollbar space-y-6 overscroll-contain">
          {/* 工具专属顶部说明条 (带环境色 3D 图标勋章) */}
          {(() => {
            const ToolIcon = currentActiveTool?.icon;
            return (
              <div className="coconut-panel p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-4">
                  {ToolIcon && (
                    <div className="w-12 h-12 rounded-2xl bg-accent-gradient text-white flex items-center justify-center flex-shrink-0 shadow-3d-sunset">
                      <ToolIcon className="w-6 h-6" />
                    </div>
                  )}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h2 className="text-lg sm:text-xl font-extrabold text-coconut-950 dark:text-darkbg-text">
                        {currentActiveTool?.name}
                      </h2>
                      {currentActiveTool?.badge && (
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-900 dark:text-amber-200 border border-amber-500/30 font-semibold font-mono">
                          {currentActiveTool.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-coconut-700 dark:text-darkbg-muted leading-relaxed max-w-3xl font-medium">
                      {currentActiveTool?.desc}
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* 文档处理与 PDF (Keep-Alive 存活驻留：访问过则保留 DOM，0ms 瞬切且不丢失工作现场) */}
          {(visitedModules.has("document") || activeModule === "document") && (
            <div className={activeModule === "document" ? "block animate-fade-in" : "hidden"}>
              <DocumentToolbox
                currentTab={activeDocTab}
                onTabChange={setActiveDocTab}
                incomingFiles={incomingDocFiles}
                onIncomingFilesHandled={() => setIncomingDocFiles([])}
                onOpenEditor={setEditorData}
              />
            </div>
          )}

          {/* 表格工坊 (Keep-Alive 存活驻留：访问过则保留 DOM，0ms 瞬切且不丢失工作现场) */}
          {(visitedModules.has("spreadsheet") || activeModule === "spreadsheet") && (
            <div className={activeModule === "spreadsheet" ? "block animate-fade-in" : "hidden"}>
              <SpreadsheetToolbox
                currentTab={activeSpreadsheetTab}
                onTabChange={setActiveSpreadsheetTab}
                incomingFiles={incomingSpreadsheetFiles}
                onIncomingFilesHandled={() => setIncomingSpreadsheetFiles([])}
              />
            </div>
          )}

          {/* 图像工坊 (Keep-Alive 存活驻留：访问过则保留 DOM，0ms 瞬切且不丢失工作现场) */}
          {(visitedModules.has("image") || activeModule === "image") && (
            <div className={activeModule === "image" ? "block animate-fade-in" : "hidden"}>
              <ImageToolbox
                currentTab={activeImageTab}
                onTabChange={setActiveImageTab}
                incomingFiles={incomingImageFiles}
                onIncomingFilesHandled={() => setIncomingImageFiles([])}
              />
            </div>
          )}

          {/* 音频工坊 (Keep-Alive 存活驻留) */}
          {(visitedModules.has("audio") || activeModule === "audio") && (
            <div className={activeModule === "audio" ? "block animate-fade-in" : "hidden"}>
              <AudioToolbox
                currentTab={activeAudioTab}
                onTabChange={setActiveAudioTab}
                incomingFile={incomingAudioFile}
                onIncomingFileHandled={() => setIncomingAudioFile(null)}
              />
            </div>
          )}

          {/* 实用工具 (Keep-Alive 存活驻留) */}
          {(visitedModules.has("utilities") || activeModule === "utilities") && (
            <div className={activeModule === "utilities" ? "block animate-fade-in" : "hidden"}>
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

          {/* AI 创意工坊 (Keep-Alive 存活驻留) */}
          {(visitedModules.has("ai") || activeModule === "ai") && (
            <div className={activeModule === "ai" ? "block animate-fade-in" : "hidden"}>
              <AiToolbox
                currentTab={activeAiTab}
                onTabChange={setActiveAiTab}
                incomingFile={incomingAiFile}
                onIncomingFileHandled={() => setIncomingAiFile(null)}
                onNavigateToIdPhoto={(photoFile) => {
                  setIncomingIdPhotoFile(photoFile);
                  setActiveModule("utilities");
                  setActiveDailyTab("idphoto");
                }}
              />
            </div>
          )}

          {/* 底部极简版权 */}
          <footer className="py-6 text-center text-xs text-coconut-700 dark:text-neutral-400 border-t border-coconut-200/80 dark:border-darkbg-border space-y-1">
            <p className="font-mono text-xs font-medium">XC OmniBox Studio</p>
          </footer>
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

      {/* 快捷键与智能粘贴全局浮层 Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-2xl bg-coconut-900/90 dark:bg-darkbg-elevated/95 backdrop-blur-md text-white text-xs font-semibold shadow-2xl border border-white/10 flex items-center gap-2.5 animate-slide-up pointer-events-none">
          <Sparkles className="w-4 h-4 text-amber-400 animate-pulse flex-shrink-0" />
          <span>{toastMsg.message}</span>
        </div>
      )}
    </div>
  );
}
