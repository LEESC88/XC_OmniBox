"use client";

import React, { useState, useEffect, useRef } from "react";
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
  Search,
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
  PanelLeftClose,
  PanelLeft,
  Sliders,
  Download,
  RotateCcw,
  FileCheck,
} from "lucide-react";
import CoconutLogo from "@/components/CoconutLogo";
import Dropzone from "@/components/Dropzone";
import InPlacePdfEditor from "@/components/InPlacePdfEditor";
import ImageToolbox from "@/components/ImageToolbox";
import AudioToolbox from "@/components/AudioToolbox";
import DailyToolbox from "@/components/DailyToolbox";
import AiToolbox, { AiTabType } from "@/components/AiToolbox";
import PdfMergeStudio from "@/components/pdf/PdfMergeStudio";
import PdfSplitStudio from "@/components/pdf/PdfSplitStudio";
import PdfWatermarkStudio from "@/components/pdf/PdfWatermarkStudio";
import { formatBytes } from "@/lib/imageProcessor";
import {
  checkHealth,
  convertPdfToWord,
  convertWordToPdf,
  mergePdfs,
  splitPdf,
  addWatermark,
  protectPdf,
  renderPdfPages,
  downloadBlob,
  HealthStatus,
} from "@/lib/api";

type DocTabType =
  | "pdf-edit"
  | "pdf-to-word"
  | "word-to-pdf"
  | "pdf-merge"
  | "pdf-split"
  | "pdf-watermark"
  | "pdf-protect";

type ImageTabType = "compress" | "heic" | "convert" | "resize" | "exif" | "watermark";
type AudioTabType = "trim" | "convert" | "merge" | "extract" | "volume";
type DailyTabType = "idphoto" | "qrcode" | "diff" | "dev";
type ModuleType = "document" | "image" | "audio" | "utilities" | "ai";

interface ToolItem {
  id: string;
  module: ModuleType;
  name: string;
  desc: string;
  badge?: string;
  icon: any;
  keywords: string[];
}

const TOOLS_REGISTRY: { category: string; module: ModuleType; icon: any; tools: ToolItem[] }[] = [
  {
    category: "文档处理与 PDF",
    module: "document",
    icon: FileText,
    tools: [
      { id: "pdf-edit", module: "document", name: "PDF 在线原位编辑", desc: "1:1 原版排版就地改字与图层修改", badge: "Word级", icon: Edit3, keywords: ["pdf", "编辑", "改字", "修改", "word"] },
      { id: "pdf-to-word", module: "document", name: "PDF 逆向转 Word", desc: "高保真提取表格与文本排版", badge: "推荐", icon: FileText, keywords: ["pdf", "转word", "提取", "转换", "docx"] },
      { id: "word-to-pdf", module: "document", name: "Word 转超清 PDF", desc: "打印级矢量无损输出保留清晰度", badge: "300DPI", icon: FileCode2, keywords: ["word", "转pdf", "超清", "无损", "打印"] },
      { id: "pdf-merge", module: "document", name: "多 PDF 拼合合并", desc: "多文件按需排序混编整合", badge: "多选", icon: Combine, keywords: ["pdf", "合并", "拼接", "多文件"] },
      { id: "pdf-split", module: "document", name: "PDF 拆分与范围提取", desc: "按页码区间抽取指定页面", badge: "范围", icon: Scissors, keywords: ["pdf", "拆分", "提取", "截取", "分割"] },
      { id: "pdf-watermark", module: "document", name: "PDF 文字印章水印", desc: "倾斜半透明防伪防盗用标记", badge: "水印", icon: Stamp, keywords: ["pdf", "水印", "文字", "印章", "防伪"] },
      { id: "pdf-protect", module: "document", name: "文档密码权限保护", desc: "AES 高强度加密限制阅读打印", badge: "安全", icon: Lock, keywords: ["pdf", "密码", "加密", "保护", "权限"] },
    ],
  },
  {
    category: "图片与视觉工坊",
    module: "image",
    icon: ImageIcon,
    tools: [
      { id: "compress", module: "image", name: "智能极速压缩", desc: "TinyPNG 级高质量无损减容", badge: "省90%", icon: Zap, keywords: ["图片", "压缩", "缩小", "体积", "tinypng"] },
      { id: "heic", module: "image", name: "苹果 HEIC 秒转", desc: "iPhone 实况与原图转 JPEG/PNG", badge: "苹果", icon: Apple, keywords: ["heic", "苹果", "iphone", "照片", "转jpg"] },
      { id: "convert", module: "image", name: "万能格式互转", desc: "WebP / JPG / PNG / ICO 任意互转", badge: "全格式", icon: RefreshCw, keywords: ["图片", "格式", "转换", "webp", "ico", "png"] },
      { id: "resize", module: "image", name: "尺寸精细缩放", desc: "证件照、社媒封面与壁纸预设", badge: "预设", icon: Maximize2, keywords: ["图片", "缩放", "尺寸", "分辨率", "裁剪"] },
      { id: "exif", module: "image", name: "EXIF 隐私抹除", desc: "抹去 GPS 位置与相机设备信息", badge: "防泄密", icon: ShieldCheck, keywords: ["exif", "隐私", "gps", "定位", "元数据"] },
      { id: "watermark", module: "image", name: "批量防盗水印", desc: "文字满铺与品牌 Logo 贴图盖章", badge: "防盗", icon: Stamp, keywords: ["图片", "水印", "logo", "版权", "盖章"] },
    ],
  },
  {
    category: "音频与声学工坊",
    module: "audio",
    icon: Music,
    tools: [
      { id: "trim", module: "audio", name: "无损音频剪辑", desc: "毫秒级波形试听裁剪与铃声制作", badge: "波形", icon: Scissors, keywords: ["音频", "剪切", "剪辑", "音乐", "铃声"] },
      { id: "convert", module: "audio", name: "音频格式转码", desc: "MP3 / WAV / FLAC / AAC / OGG", badge: "320K", icon: RefreshCw, keywords: ["音频", "转码", "格式", "mp3", "wav", "flac"] },
      { id: "merge", module: "audio", name: "多音频无缝拼接", desc: "多音轨按顺序无缝混流串烧", badge: "串烧", icon: Combine, keywords: ["音频", "拼接", "合并", "混流", "串烧"] },
      { id: "extract", module: "audio", name: "视频提取纯音频", desc: "MP4 / MKV 秒级提取高音质 MP3", badge: "秒提", icon: Film, keywords: ["视频", "提取", "伴奏", "mp4", "音频"] },
      { id: "volume", module: "audio", name: "音量平衡增益", desc: "0%~300% 动态无损增益防爆音", badge: "增益", icon: Volume2, keywords: ["音量", "放大", "增益", "响度", "标准化"] },
    ],
  },
  {
    category: "实用与开发工坊",
    module: "utilities",
    icon: Wrench,
    tools: [
      { id: "idphoto", module: "utilities", name: "证件照换底排版", desc: "红白蓝灰智能换底与 6 寸打印排版", badge: "6寸打印", icon: UserCheck, keywords: ["证件照", "换底", "排版", "冲印", "相纸"] },
      { id: "qrcode", module: "utilities", name: "个性化艺术二维码", desc: "炫彩渐变色与中心嵌入 Logo", badge: "Logo", icon: QrCode, keywords: ["二维码", "qr", "扫码", "生成", "渐变"] },
      { id: "diff", module: "utilities", name: "文本代码双栏 Diff", desc: "增删变动实时高亮与字符精细对比", badge: "双栏", icon: GitCompare, keywords: ["diff", "对比", "文本", "代码", "差异"] },
      { id: "dev", module: "utilities", name: "开发与编码利器", desc: "JSON 校验、Base64、Hash、时间戳", badge: "神器", icon: Code2, keywords: ["json", "base64", "hash", "时间戳", "开发"] },
    ],
  },
  {
    category: "AI 智能工坊",
    module: "ai",
    icon: Sparkles,
    tools: [
      { id: "ai-bg-remove", module: "ai", name: "AI 发丝级智能抠图", desc: "逐像素分离人像与复杂背景，支持一键证件照换底排版", badge: "AI抠图", icon: Sparkles, keywords: ["抠图", "去除背景", "透明底", "人像", "发丝", "ai"] },
      { id: "ai-ocr", module: "ai", name: "AI 文字提取 (OCR)", desc: "高精提取中英文、书籍、发票及表格字形，支持一键复制与 TXT 导出", badge: "多语言", icon: FileText, keywords: ["ocr", "文字提取", "识别", "扫描", "文字识别", "ai"] },
      { id: "ai-upscale", module: "ai", name: "AI 模糊图片高清修复", desc: "2x / 4x 超分辨率重建与边缘锐化，让低清模糊图焕发新生", badge: "超分辨率", icon: Maximize2, keywords: ["超清", "修复", "高清", "放大", "清晰度", "降噪", "ai"] },
    ],
  },
];

export default function Home() {
  const [activeModule, setActiveModule] = useState<ModuleType>("document");
  const [expandedModule, setExpandedModule] = useState<ModuleType | null>("document");
  const [activeDocTab, setActiveDocTab] = useState<DocTabType>("pdf-edit");
  const [activeImageTab, setActiveImageTab] = useState<ImageTabType>("compress");
  const [activeAudioTab, setActiveAudioTab] = useState<AudioTabType>("trim");
  const [activeDailyTab, setActiveDailyTab] = useState<DailyTabType>("idphoto");
  const [activeAiTab, setActiveAiTab] = useState<AiTabType>("ai-bg-remove");
  const [incomingIdPhotoFile, setIncomingIdPhotoFile] = useState<File | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [isDark, setIsDark] = useState<boolean>(false);
  const [executionResult, setExecutionResult] = useState<{
    blob: Blob;
    filename: string;
    size: number;
  } | null>(null);

  // 初始化深色模式状态并同步 DOM
  useEffect(() => {
    const isDarkMode = document.documentElement.classList.contains("dark");
    setIsDark(isDarkMode);
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("xc_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("xc_theme", "light");
    }
  };

  // 搜索框引用与全局快捷键 Ctrl+K / ⌘K
  const searchInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSidebarCollapsed(false);
        setTimeout(() => {
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        }, 50);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // 1:1 原版 PDF 编辑器状态
  const [editorData, setEditorData] = useState<{
    file: File;
    title: string;
    numPages: number;
    pages: any[];
  } | null>(null);
  const [parsingEditor, setParsingEditor] = useState(false);

  // 参数状态
  const [startPage, setStartPage] = useState<number>(0);
  const [pageRanges, setPageRanges] = useState<string>("");
  const [watermarkText, setWatermarkText] = useState<string>("内部机密 严禁外传");
  const [watermarkOpacity, setWatermarkOpacity] = useState<number>(0.3);
  const [watermarkAngle, setWatermarkAngle] = useState<number>(45);
  const [protectPassword, setProtectPassword] = useState<string>("");

  // PDF 转 Word 缩略图预览状态
  const [pdfToWordThumb, setPdfToWordThumb] = useState<{
    url?: string;
    numPages?: number;
    loading: boolean;
  } | null>(null);

  useEffect(() => {
    if (activeDocTab === "pdf-to-word" && files.length > 0) {
      setPdfToWordThumb({ loading: true });
      renderPdfPages(files[0], 70, 1, false)
        .then((res) => {
          setPdfToWordThumb({
            url: res.pages[0]?.image,
            numPages: res.numPages,
            loading: false,
          });
        })
        .catch(() => {
          setPdfToWordThumb({ loading: false });
        });
    } else {
      setPdfToWordThumb(null);
    }
  }, [activeDocTab, files]);

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
    setFiles([]);
    setError(null);
    setSuccessMsg(null);
    setEditorData(null);
    setExecutionResult(null);
  };

  const handleSelectTool = (item: ToolItem) => {
    setActiveModule(item.module);
    setExpandedModule(item.module);
    if (item.module === "document") {
      setActiveDocTab(item.id as DocTabType);
      setFiles([]);
      setError(null);
      setSuccessMsg(null);
      setEditorData(null);
      setExecutionResult(null);
    } else if (item.module === "image") {
      setActiveImageTab(item.id as ImageTabType);
    } else if (item.module === "audio") {
      setActiveAudioTab(item.id as AudioTabType);
    } else if (item.module === "utilities") {
      setActiveDailyTab(item.id as DailyTabType);
    } else if (item.module === "ai") {
      setActiveAiTab(item.id as AiTabType);
    }
    setSearchQuery("");
    setMobileMenuOpen(false);
  };

  // 启动 1:1 原版在线编辑工作台
  const handleStartEditor = async () => {
    if (files.length === 0) {
      setError("请先上传需要编辑的 PDF 文件");
      return;
    }
    setParsingEditor(true);
    setError(null);
    try {
      const data = await renderPdfPages(files[0]);
      setEditorData({
        file: files[0],
        title: data.title || files[0].name.replace(/\.[^/.]+$/, ""),
        numPages: data.numPages,
        pages: data.pages,
      });
    } catch (err: any) {
      setError(err.message || "解析原版 PDF 失败");
    } finally {
      setParsingEditor(false);
    }
  };

  const getActionBtnText = () => {
    switch (activeDocTab) {
      case "pdf-to-word":
        return "开始逆向转换为 Word (.docx)";
      case "word-to-pdf":
        return "开始转换为高保真超清 PDF";
      case "pdf-merge":
        return `开始合并选中的 ${files.length} 个 PDF 文件`;
      case "pdf-split":
        return "开始提取并拆分 PDF";
      case "pdf-watermark":
        return "开始添加文字水印并导出";
      case "pdf-protect":
        return "开始加密并导出受保护 PDF";
      default:
        return "开始执行转换任务";
    }
  };

  const handleExecute = async () => {
    if (files.length === 0) {
      setError("请先上传需要处理的文件");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    setExecutionResult(null);

    try {
      let resultBlob: Blob;
      let resultFilename: string;

      if (activeDocTab === "pdf-to-word") {
        const res = await convertPdfToWord(files[0], startPage);
        resultBlob = res.blob;
        resultFilename = res.filename;
      } else if (activeDocTab === "word-to-pdf") {
        const res = await convertWordToPdf(files[0]);
        resultBlob = res.blob;
        resultFilename = res.filename;
      } else if (activeDocTab === "pdf-merge") {
        if (files.length < 2) {
          throw new Error("合并至少需要选择 2 个 PDF 文件");
        }
        const res = await mergePdfs(files);
        resultBlob = res.blob;
        resultFilename = res.filename;
      } else if (activeDocTab === "pdf-split") {
        const res = await splitPdf(files[0], pageRanges || undefined);
        resultBlob = res.blob;
        resultFilename = res.filename;
      } else if (activeDocTab === "pdf-watermark") {
        const res = await addWatermark(
          files[0],
          watermarkText,
          watermarkOpacity,
          watermarkAngle
        );
        resultBlob = res.blob;
        resultFilename = res.filename;
      } else if (activeDocTab === "pdf-protect") {
        if (!protectPassword) {
          throw new Error("请输入要设置的密码");
        }
        const res = await protectPdf(files[0], protectPassword);
        resultBlob = res.blob;
        resultFilename = res.filename;
      } else {
        throw new Error("未知的处理任务类型");
      }

      setExecutionResult({
        blob: resultBlob,
        filename: resultFilename,
        size: resultBlob.size,
      });

      setSuccessMsg(`处理完成！已生成 ${resultFilename}，请点击下方按钮下载保存`);
    } catch (err: any) {
      setError(err.message || "处理过程出现异常");
    } finally {
      setLoading(false);
    }
  };

  // 拆分可视化 Studio 专用执行函数
  const handleSplitExecute = async (customRanges?: string) => {
    if (files.length === 0) {
      setError("请先上传需要拆分的 PDF 文件");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    setExecutionResult(null);

    try {
      const res = await splitPdf(files[0], customRanges || undefined);
      setExecutionResult({
        blob: res.blob,
        filename: res.filename,
        size: res.blob.size,
      });
      setSuccessMsg(`拆分提取成功！已生成 ${res.filename}，请点击下方按钮下载保存`);
    } catch (err: any) {
      setError(err.message || "拆分提取失败");
    } finally {
      setLoading(false);
    }
  };

  // 水印实时预览 Studio 专用执行函数
  const handleWatermarkExecute = async (text: string, opacity: number, angle: number) => {
    if (files.length === 0) {
      setError("请先上传需要添加水印的 PDF 文件");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    setExecutionResult(null);

    try {
      const res = await addWatermark(files[0], text, opacity, angle);
      setExecutionResult({
        blob: res.blob,
        filename: res.filename,
        size: res.blob.size,
      });
      setSuccessMsg(`水印添加成功！已生成 ${res.filename}，请点击下方按钮下载保存`);
    } catch (err: any) {
      setError(err.message || "添加水印失败");
    } finally {
      setLoading(false);
    }
  };

  // 如果处于在线编辑工作台模式，全屏展示 A4 拟真编辑器
  if (activeModule === "document" && activeDocTab === "pdf-edit" && editorData) {
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

  const allTools = TOOLS_REGISTRY.flatMap((g) => g.tools);
  const filteredTools = searchQuery.trim()
    ? allTools.filter(
        (t) =>
          t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.keywords.some((k) => k.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : [];

  const currentCategory = TOOLS_REGISTRY.find((g) => g.module === activeModule) || TOOLS_REGISTRY[0];
  const currentActiveTool =
    activeModule === "document"
      ? allTools.find((t) => t.id === activeDocTab)
      : activeModule === "image"
      ? allTools.find((t) => t.id === activeImageTab)
      : activeModule === "audio"
      ? allTools.find((t) => t.id === activeAudioTab)
      : activeModule === "utilities"
      ? allTools.find((t) => t.id === activeDailyTab)
      : allTools.find((t) => t.id === activeAiTab);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-transparent text-coconut-900 dark:text-darkbg-text antialiased">
      {/* 移动端侧边抽屉遮罩 */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 lg:hidden animate-fade-in"
        />
      )}

      {/* ===================== 左侧 PRO 侧边栏 ===================== */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 flex flex-col bg-[#F2E5D8]/95 dark:bg-[#251E1A]/95 border-r border-[#D2BCAB] dark:border-[#4D392E] backdrop-blur-xl transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          mobileMenuOpen ? "translate-x-0 w-80 max-w-[85vw]" : "-translate-x-full lg:translate-x-0"
        } ${sidebarCollapsed ? "lg:w-20" : "lg:w-72"}`}
      >
        {/* 顶部品牌 */}
        <div className={`border-b border-coconut-100 dark:border-darkbg-border flex items-center transition-all duration-300 ${
          sidebarCollapsed ? "p-3 justify-center" : "p-4 justify-between"
        }`}>
          {sidebarCollapsed ? (
            /* 折叠态：居中单个椰子 Logo 按钮，点击直接切换展开侧边栏，杜绝重叠 */
            <button
              onClick={() => setSidebarCollapsed(false)}
              className="p-1.5 rounded-2xl hover:bg-coconut-100 dark:hover:bg-darkbg-elevated transition-transform active:scale-95 group relative flex items-center justify-center"
              title="点击展开侧边栏"
            >
              <CoconutLogo size={36} />
              <span className="sr-only">展开侧边栏</span>
            </button>
          ) : (
            /* 展开态：左侧椰子 Logo + 品牌名，右侧折叠按钮 */
            <>
              <div className="flex items-center gap-2.5 truncate">
                <CoconutLogo size={36} />
                <div className="truncate">
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-base tracking-tight text-coconut-950 dark:text-white">
                      XC OmniBox
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white font-mono font-bold shadow-xs">
                      Studio
                    </span>
                  </div>
                  <p className="text-xs text-coconut-600 dark:text-darkbg-muted truncate mt-0.5">
                    轻盈全能多媒体工作台
                  </p>
                </div>
              </div>

              {/* 桌面端折叠按钮 / 移动端关闭按钮 */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setSidebarCollapsed(true)}
                  className="hidden lg:flex p-1.5 rounded-xl text-coconut-500 hover:text-coconut-800 dark:text-darkbg-muted dark:hover:text-darkbg-text hover:bg-coconut-100 dark:hover:bg-darkbg-elevated transition-colors"
                  title="收起侧边栏"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="lg:hidden p-1.5 rounded-xl text-coconut-500 hover:text-coconut-800 dark:text-darkbg-muted hover:bg-coconut-100 dark:hover:bg-darkbg-elevated"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </>
          )}
        </div>

        {/* 快速搜索框 (仅在展开态显示) */}
        {!sidebarCollapsed && (
          <div className="p-3 border-b border-coconut-100 dark:border-darkbg-border">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-coconut-400 dark:text-darkbg-muted absolute left-3 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索 22 项工具 (如抠图, 转Word)..."
                className="w-full pl-9 pr-14 py-2 text-xs bg-white/80 dark:bg-darkbg-subtle border border-coconut-200/80 dark:border-darkbg-border rounded-xl text-coconut-900 dark:text-darkbg-text placeholder-coconut-400 dark:placeholder-darkbg-muted focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all font-medium"
              />
              {!searchQuery ? (
                <div className="absolute right-2.5 flex items-center pointer-events-none">
                  <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-bold text-coconut-500 dark:text-darkbg-muted bg-coconut-100 dark:bg-darkbg-card border border-coconut-200 dark:border-darkbg-border rounded shadow-2xs">
                    ⌘K
                  </kbd>
                </div>
              ) : (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 text-coconut-400 hover:text-coconut-700 dark:text-darkbg-muted p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* 导航工具树：折叠态仅展示 5 个核心分类大图标，展开态为手风琴仅展开当前分类 */}
        <div className="flex-1 overflow-y-auto p-2 space-y-3 custom-main-scrollbar overscroll-contain">
          {searchQuery.trim() ? (
            /* 搜索模式：直接匹配搜索结果 */
            <div className="space-y-1">
              <div className="text-[11px] font-semibold text-coconut-400 dark:text-darkbg-muted px-2 py-1">
                搜索结果 ({filteredTools.length})
              </div>
              {filteredTools.length === 0 ? (
                <div className="p-6 text-center text-xs text-coconut-400 dark:text-darkbg-muted">
                  未匹配到相关工具
                </div>
              ) : (
                filteredTools.map((t) => {
                  const Icon = t.icon;
                  const isCur =
                    activeModule === t.module &&
                    ((t.module === "document" && activeDocTab === t.id) ||
                      (t.module === "image" && activeImageTab === t.id) ||
                      (t.module === "audio" && activeAudioTab === t.id) ||
                      (t.module === "utilities" && activeDailyTab === t.id) ||
                      (t.module === "ai" && activeAiTab === t.id));
                  return (
                    <button
                      key={t.id}
                      onClick={() => handleSelectTool(t)}
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left text-xs transition-all active:scale-[0.98] ${
                        isCur
                          ? "bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white font-bold shadow-3d-sunset"
                          : "text-coconut-700 dark:text-darkbg-muted hover:bg-coconut-100/80 dark:hover:bg-darkbg-elevated hover:dark:text-darkbg-text"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Icon className={`w-4 h-4 flex-shrink-0 ${isCur ? "text-amber-100" : ""}`} />
                        <span className="truncate">{t.name}</span>
                      </div>
                      {t.badge && (
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold transition-colors ${
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
                })
              )}
            </div>
          ) : sidebarCollapsed ? (
            /* ================= 折叠模式 (w-20)：仅显示 5 个分类大图标，告别 22 个小图标长串 ================= */
            <div className="py-2 flex flex-col items-center space-y-3">
              {/* 快捷搜索按钮 (点击展开并聚焦搜索) */}
              <button
                onClick={() => {
                  setSidebarCollapsed(false);
                  setTimeout(() => {
                    searchInputRef.current?.focus();
                  }, 50);
                }}
                className="w-10 h-10 rounded-2xl flex items-center justify-center text-coconut-600 dark:text-darkbg-muted hover:bg-coconut-100/80 dark:hover:bg-darkbg-elevated hover:text-coconut-950 dark:hover:text-darkbg-text transition-all active:scale-95 border border-transparent hover:border-coconut-200 dark:hover:border-darkbg-border"
                title="搜索工具 (Ctrl + K / ⌘K)"
              >
                <Search className="w-4 h-4" />
              </button>
              <div className="w-8 h-[1px] bg-coconut-200/60 dark:bg-darkbg-border" />

              {TOOLS_REGISTRY.map((group) => {
                const GroupIcon = group.icon;
                const isGroupActive = activeModule === group.module;
                const shortLabel =
                  group.module === "document"
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
                    title={`${group.category} (共 ${group.tools.length} 项工具)`}
                    className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center transition-all relative group active:scale-95 ${
                      isGroupActive
                        ? "bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 text-white shadow-3d-sunset scale-105"
                        : "text-coconut-600 dark:text-darkbg-muted hover:bg-coconut-100/80 dark:hover:bg-darkbg-elevated hover:text-coconut-950 dark:hover:text-darkbg-text"
                    }`}
                  >
                    <GroupIcon className="w-5 h-5" />
                    <span className="text-[9px] font-bold mt-0.5 tracking-tight">
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
            TOOLS_REGISTRY.map((group) => {
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
                    title={isGroupExpanded ? "点击收回折叠全部工具" : "点击展开全部工具"}
                    className={`w-full flex items-center justify-between p-2.5 rounded-2xl text-sm font-bold transition-all select-none active:scale-[0.99] ${
                      isGroupActive
                        ? "bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-rose-500/10 text-orange-950 dark:text-orange-200 border border-orange-300/60 dark:border-orange-500/30 shadow-xs"
                        : "text-coconut-800 dark:text-darkbg-muted hover:bg-coconut-100/70 dark:hover:bg-darkbg-elevated hover:text-coconut-950 dark:hover:text-darkbg-text"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <div className={`p-2 rounded-xl flex-shrink-0 transition-transform ${
                        isGroupActive
                          ? "bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-xs scale-105"
                          : "bg-coconut-200/60 dark:bg-darkbg-subtle text-coconut-700 dark:text-darkbg-muted"
                      }`}>
                        <GroupIcon className="w-4 h-4" />
                      </div>
                      <span className="tracking-tight truncate">{group.category}</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-coconut-200/60 dark:bg-darkbg-subtle font-mono text-coconut-700 dark:text-darkbg-muted font-semibold">
                        {group.tools.length}
                      </span>
                      <ChevronRight className={`w-4 h-4 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                        isGroupExpanded ? "rotate-90 text-orange-600 font-bold" : "text-coconut-400 opacity-60"
                      }`} />
                    </div>
                  </button>

                  {/* 丝滑手风琴抽屉动画：CSS Grid 无级平滑展开收起 */}
                  <div
                    className={`grid transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden ${
                      isGroupExpanded ? "grid-rows-[1fr] opacity-100 mt-1" : "grid-rows-[0fr] opacity-0 mt-0 pointer-events-none"
                    }`}
                  >
                    <div className="min-h-0 pl-3 pr-1 py-1 space-y-1 border-l-2 border-orange-500/50 ml-3.5">
                      {group.tools.map((t) => {
                        const Icon = t.icon;
                        const isCur =
                          activeModule === t.module &&
                          ((t.module === "document" && activeDocTab === t.id) ||
                            (t.module === "image" && activeImageTab === t.id) ||
                            (t.module === "audio" && activeAudioTab === t.id) ||
                            (t.module === "utilities" && activeDailyTab === t.id) ||
                            (t.module === "ai" && activeAiTab === t.id));

                        return (
                          <button
                            key={t.id}
                            onClick={() => handleSelectTool(t)}
                            className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left text-xs sm:text-sm transition-all active:scale-[0.98] ${
                              isCur
                                ? "bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white font-bold shadow-3d-sunset scale-[1.01]"
                                : "text-coconut-800 dark:text-darkbg-muted hover:bg-coconut-100/70 dark:hover:bg-darkbg-elevated hover:text-coconut-950 dark:hover:text-darkbg-text font-medium"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 truncate">
                              <Icon className={`w-4 h-4 flex-shrink-0 ${isCur ? "text-amber-100" : "text-coconut-600 dark:text-darkbg-muted"}`} />
                              <span className="truncate">{t.name}</span>
                            </div>
                            {t.badge && (
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold transition-colors ${
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

        {/* 侧边栏底部：深浅模式切换 (升级为触感 iOS/macOS Pill 滑动开关) */}
        <div className="p-3 border-t border-coconut-100 dark:border-darkbg-border bg-coconut-50/50 dark:bg-darkbg-card/50 flex items-center justify-center">
          {sidebarCollapsed ? (
            <button
              onClick={toggleTheme}
              className="w-12 h-12 rounded-2xl border border-coconut-200/80 dark:border-darkbg-border bg-white/90 dark:bg-darkbg-subtle flex items-center justify-center text-coconut-800 dark:text-darkbg-text hover:bg-coconut-100 dark:hover:bg-darkbg-elevated transition-all active:scale-95 shadow-2xs group"
              title={`切换外观主题 (当前: ${isDark ? "曜黑暗夜" : "暖椰润肤"})`}
            >
              {isDark ? (
                <Sun className="w-5 h-5 text-amber-500 transition-transform duration-300 group-hover:rotate-45" />
              ) : (
                <Moon className="w-5 h-5 text-coconut-700 transition-transform duration-300 group-hover:-rotate-12" />
              )}
            </button>
          ) : (
            <button
              onClick={toggleTheme}
              className="w-full flex items-center justify-between p-2.5 px-3 rounded-2xl border border-coconut-200/80 dark:border-darkbg-border bg-white/90 dark:bg-darkbg-subtle text-xs sm:text-sm font-semibold text-coconut-800 dark:text-darkbg-text hover:bg-coconut-100/70 dark:hover:bg-darkbg-elevated transition-all active:scale-[0.98] shadow-2xs cursor-pointer group"
              title="切换界面外观主题"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-xl bg-coconut-100 dark:bg-darkbg-card flex items-center justify-center border border-coconut-200/60 dark:border-darkbg-border text-coconut-700 dark:text-darkbg-muted">
                  {isDark ? (
                    <Sun className="w-4 h-4 text-amber-500" />
                  ) : (
                    <Moon className="w-4 h-4 text-coconut-700" />
                  )}
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-coconut-900 dark:text-white leading-tight">
                    {isDark ? "曜黑暗夜模式" : "暖椰润肤模式"}
                  </div>
                  <div className="text-[10px] text-coconut-500 dark:text-darkbg-muted font-mono leading-tight mt-0.5">
                    {isDark ? "Dark Appearance" : "Light Appearance"}
                  </div>
                </div>
              </div>

              {/* iOS / macOS 触感滑动 Pill 开关 */}
              <div
                className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-300 flex items-center ${
                  isDark
                    ? "bg-gradient-to-r from-orange-500 to-rose-500 shadow-inner"
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
          )}
        </div>
      </aside>

      {/* ===================== 右侧沉浸式主工作台 ===================== */}
      <div className="flex-1 h-full flex flex-col overflow-hidden min-w-0 relative">
        {/* 顶部工具栏与面包屑 */}
        <header className="h-14 border-b border-[#D2BCAB] dark:border-[#4D392E] bg-[#F2E5D8]/92 dark:bg-[#251E1A]/92 backdrop-blur-xl px-4 sm:px-6 flex items-center justify-between flex-shrink-0 gap-3 z-10">
          {/* 左侧：移动端菜单按钮 + 面包屑 */}
          <div className="flex items-center gap-3 truncate">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl text-coconut-600 dark:text-darkbg-muted hover:bg-coconut-100 dark:hover:bg-darkbg-elevated transition-colors"
              aria-label="打开侧边导航"
            >
              <Menu className="w-5 h-5" />
            </button>

            <nav className="flex items-center gap-2 text-xs sm:text-sm text-coconut-700 dark:text-darkbg-muted truncate">
              <span className="hover:text-coconut-950 dark:hover:text-white transition-colors">工作台</span>
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
              { id: "document", label: "文档", icon: FileText },
              { id: "image", label: "图片", icon: ImageIcon },
              { id: "audio", label: "音频", icon: Music },
              { id: "utilities", label: "日常", icon: Wrench },
              { id: "ai", label: "AI工坊", icon: Sparkles },
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
                      ? "bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white shadow-3d-sunset scale-[1.02]"
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
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 text-white flex items-center justify-center flex-shrink-0 shadow-3d-sunset">
                      <ToolIcon className="w-6 h-6" />
                    </div>
                  )}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h2 className="text-lg sm:text-xl font-extrabold text-coconut-950 dark:text-darkbg-text tracking-tight">
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

          {/* 模块路由内容渲染 */}
          {activeModule === "image" ? (
            <ImageToolbox currentTab={activeImageTab} onTabChange={setActiveImageTab} />
          ) : activeModule === "audio" ? (
            <AudioToolbox currentTab={activeAudioTab} onTabChange={setActiveAudioTab} />
          ) : activeModule === "utilities" ? (
            <DailyToolbox
              currentTab={activeDailyTab}
              onTabChange={setActiveDailyTab}
              initialPhotoFile={incomingIdPhotoFile}
            />
          ) : activeModule === "ai" ? (
            <AiToolbox
              currentTab={activeAiTab}
              onTabChange={setActiveAiTab}
              onNavigateToIdPhoto={(photoFile) => {
                setIncomingIdPhotoFile(photoFile);
                setActiveModule("utilities");
                setActiveDailyTab("idphoto");
              }}
            />
          ) : (
            /* ===================== 文档处理与 PDF 工作台 ===================== */
            <div className="space-y-6">
              {/* PDF 在线直接编辑卡片 */}
              {activeDocTab === "pdf-edit" ? (
                <div className="coconut-panel p-6 sm:p-8 space-y-6">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-coconut-900 dark:text-darkbg-text">
                      PDF 1:1 原版排版在线工作台
                    </h3>
                    <p className="text-xs text-coconut-600 dark:text-darkbg-muted">
                      拖入需要就地修改的 PDF 文件，即可进入原位文字改字、遮盖涂抹与新增段落模式，完全锁定原版排版绝不跑偏。
                    </p>
                  </div>

                  <Dropzone
                    accept=".pdf"
                    multiple={false}
                    selectedFiles={files}
                    onFilesSelected={setFiles}
                    onClear={() => setFiles([])}
                    title="拖入待编辑的 PDF 文件，点击即可进入在线工作台"
                    hint="支持标准 PDF 文档"
                  />

                  {error && (
                    <div className="p-3 bg-toast-50 dark:bg-toast-950/40 border border-toast-200 dark:border-toast-900/60 rounded-2xl flex items-center gap-2 text-toast-700 dark:text-toast-300 text-xs">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 text-toast-500" />
                      <span>{error}</span>
                    </div>
                  )}

                  <button
                    onClick={handleStartEditor}
                    disabled={parsingEditor || files.length === 0}
                    className={`w-full py-3.5 px-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                      parsingEditor || files.length === 0
                        ? "bg-coconut-100 dark:bg-darkbg-subtle text-coconut-400 dark:text-darkbg-muted cursor-not-allowed border border-coconut-200 dark:border-darkbg-border"
                        : "btn-3d-sunset text-white"
                    }`}
                  >
                    {parsingEditor ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>正在深度解析 PDF 页面排版，请稍候...</span>
                      </>
                    ) : (
                      <>
                        <Edit3 className="w-4 h-4 text-amber-100" />
                        <span>进入在线 Word 级编辑工作台</span>
                      </>
                    )}
                  </button>
                </div>
              ) : activeDocTab === "pdf-merge" ? (
                /* PDF 多文件调序合并 Studio */
                files.length > 0 ? (
                  <div className="coconut-panel p-6 sm:p-8">
                    <PdfMergeStudio
                      files={files}
                      onFilesChange={setFiles}
                      onExecute={handleExecute}
                      loading={loading}
                      error={error}
                      successMsg={successMsg}
                      executionResult={executionResult}
                      onReset={() => {
                        setFiles([]);
                        setExecutionResult(null);
                        setSuccessMsg(null);
                        setError(null);
                      }}
                    />
                  </div>
                ) : (
                  <div className="coconut-panel p-6 sm:p-8 space-y-6">
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-coconut-900 dark:text-darkbg-text">
                        多文件批量选择合并
                      </h3>
                      <p className="text-xs text-coconut-600 dark:text-darkbg-muted">
                        支持选中多个 PDF 批量上传，系统将自动读取首页缩略图预览，支持自由上下移动调序、追加文件后一键无损拼合。
                      </p>
                    </div>

                    <Dropzone
                      accept=".pdf"
                      multiple={true}
                      selectedFiles={files}
                      onFilesSelected={setFiles}
                      onClear={() => setFiles([])}
                      title="拖入多个 PDF 文件（按 Ctrl 多选），或点击选择"
                      hint="支持选中多个 PDF 批量合并"
                    />
                  </div>
                )
              ) : activeDocTab === "pdf-split" ? (
                /* PDF 全文档点选拆分 Studio */
                files.length > 0 ? (
                  <div className="coconut-panel p-6 sm:p-8">
                    <PdfSplitStudio
                      file={files[0]}
                      onSplit={handleSplitExecute}
                      loading={loading}
                      error={error}
                      successMsg={successMsg}
                      executionResult={executionResult}
                      onReset={() => {
                        setExecutionResult(null);
                        setSuccessMsg(null);
                        setError(null);
                      }}
                      onClearFile={() => {
                        setFiles([]);
                        setExecutionResult(null);
                        setSuccessMsg(null);
                        setError(null);
                      }}
                    />
                  </div>
                ) : (
                  <div className="coconut-panel p-6 sm:p-8 space-y-6">
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-coconut-900 dark:text-darkbg-text">
                        PDF 全文档可视化点选拆分
                      </h3>
                      <p className="text-xs text-coconut-600 dark:text-darkbg-muted">
                        拖入 PDF 文档后自动生成整篇文档的页面缩略图网格，无需记忆输入页码，直接点击卡片即可多选抽取或拆分为单页压缩包。
                      </p>
                    </div>

                    <Dropzone
                      accept=".pdf"
                      multiple={false}
                      selectedFiles={files}
                      onFilesSelected={setFiles}
                      onClear={() => setFiles([])}
                      title="拖入待拆分的 PDF 文档 (.pdf)，或点击选择"
                      hint="支持标准 PDF 文档"
                    />
                  </div>
                )
              ) : activeDocTab === "pdf-watermark" ? (
                /* PDF 实时效果动态预览水印 Studio */
                files.length > 0 ? (
                  <div className="coconut-panel p-6 sm:p-8">
                    <PdfWatermarkStudio
                      file={files[0]}
                      onExecute={handleWatermarkExecute}
                      loading={loading}
                      error={error}
                      successMsg={successMsg}
                      executionResult={executionResult}
                      onReset={() => {
                        setExecutionResult(null);
                        setSuccessMsg(null);
                        setError(null);
                      }}
                      onClearFile={() => {
                        setFiles([]);
                        setExecutionResult(null);
                        setSuccessMsg(null);
                        setError(null);
                      }}
                    />
                  </div>
                ) : (
                  <div className="coconut-panel p-6 sm:p-8 space-y-6">
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-coconut-900 dark:text-darkbg-text">
                        PDF 真实底图实时水印工作室
                      </h3>
                      <p className="text-xs text-coconut-600 dark:text-darkbg-muted">
                        拖入 PDF 文档后自动加载真实页面底图，调节水印文字、透明度与旋转角度时右侧画面实时响应随动，所见即所得。
                      </p>
                    </div>

                    <Dropzone
                      accept=".pdf"
                      multiple={false}
                      selectedFiles={files}
                      onFilesSelected={setFiles}
                      onClear={() => setFiles([])}
                      title="拖入待添加水印的 PDF 文档 (.pdf)，或点击选择"
                      hint="支持标准 PDF 文档"
                    />
                  </div>
                )
              ) : activeDocTab === "pdf-protect" ? (
                /* PDF 权限密码保护双栏 Studio */
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  <div className="lg:col-span-5 coconut-panel p-5 sm:p-6 space-y-5">
                    <div className="flex items-center gap-2 pb-3 border-b border-coconut-200/80 dark:border-darkbg-border text-sm font-bold text-coconut-950 dark:text-darkbg-text">
                      <Lock className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                      <span>加密权限设置</span>
                    </div>

                    <div className="space-y-3">
                      <label className="block text-sm font-semibold text-coconut-900 dark:text-darkbg-text mb-1">
                        设置访问查看密码
                      </label>
                      <input
                        type="password"
                        placeholder="请输入加密密码"
                        value={protectPassword}
                        onChange={(e) => setProtectPassword(e.target.value)}
                        className="w-full text-sm p-3.5 bg-white/80 dark:bg-darkbg-subtle border border-[#CBB09C] dark:border-darkbg-border rounded-2xl outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-coconut-950 dark:text-darkbg-text font-medium"
                      />
                      <p className="text-xs text-coconut-700 dark:text-darkbg-muted leading-relaxed">
                        采用高强度加密算法，未输入正确密码者无法打开、阅读或打印文档。
                      </p>
                    </div>
                  </div>

                  <div className="lg:col-span-7 coconut-panel p-5 sm:p-6 space-y-5">
                    <div className="text-xs font-bold text-coconut-900 dark:text-darkbg-text">
                      投放待加密文档
                    </div>

                    <Dropzone
                      accept=".pdf"
                      multiple={false}
                      selectedFiles={files}
                      onFilesSelected={setFiles}
                      onClear={() => setFiles([])}
                      title="拖入待加密的 PDF 文档 (.pdf)，或点击选择"
                      hint="支持标准 PDF 文档"
                    />

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

                    {executionResult ? (
                      <div className="p-5 bg-gradient-to-br from-amber-500/12 via-orange-500/10 to-rose-500/10 dark:from-orange-950/40 dark:via-amber-950/30 dark:to-rose-950/30 border border-amber-300/80 dark:border-amber-600/60 rounded-2xl space-y-4 shadow-coconut-sm animate-fade-in backdrop-blur-sm">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 truncate">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                              <FileCheck className="w-5 h-5 text-white" />
                            </div>
                            <div className="truncate">
                              <h4 className="text-sm font-bold text-coconut-950 dark:text-white truncate">
                                {executionResult.filename}
                              </h4>
                              <p className="text-xs text-orange-800 dark:text-amber-300 font-mono font-medium">
                                {formatBytes(executionResult.size)} · 加密成功已就绪
                              </p>
                            </div>
                          </div>
                          <span className="hidden sm:inline-block px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-900 dark:text-amber-200 border border-amber-500/30 flex-shrink-0">
                            ✓ 就绪 · 点击下载
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 pt-1">
                          <button
                            onClick={() => downloadBlob(executionResult.blob, executionResult.filename)}
                            className="flex-1 py-3 px-4 rounded-xl btn-3d-sunset text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-coconut-sm"
                          >
                            <Download className="w-4 h-4" />
                            <span>立即下载该文件</span>
                          </button>

                          <button
                            onClick={() => {
                              setFiles([]);
                              setExecutionResult(null);
                              setSuccessMsg(null);
                              setError(null);
                            }}
                            className="py-3 px-4 rounded-xl btn-3d-secondary font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>加密新文件</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={handleExecute}
                        disabled={loading || files.length === 0 || !protectPassword}
                        className={`w-full py-3.5 px-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                          loading || files.length === 0 || !protectPassword
                            ? "bg-coconut-100 dark:bg-darkbg-subtle text-coconut-400 dark:text-darkbg-muted cursor-not-allowed border border-coconut-200 dark:border-darkbg-border"
                            : "btn-3d-sunset text-white"
                        }`}
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>正在加密中，请稍候...</span>
                          </>
                        ) : (
                          <>
                            <Lock className="w-4 h-4 text-amber-200" />
                            <span>开始加密并导出受保护 PDF</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                /* PDF 转 Word 或 Word 转 PDF */
                <div className="coconut-panel p-6 sm:p-8 space-y-6">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-coconut-900 dark:text-darkbg-text">
                      {activeDocTab === "word-to-pdf"
                        ? "Word 文档格式转换"
                        : "PDF 逆向格式转换 (.docx)"}
                    </h3>
                    <p className="text-xs text-coconut-600 dark:text-darkbg-muted">
                      {activeDocTab === "word-to-pdf"
                        ? "支持 .docx、.doc 格式，100% 打印级矢量超清渲染，公式与表格精准保留。"
                        : "基于专业重构引擎，精准还原表格、文本排版与内嵌高清图片。"}
                    </p>
                  </div>

                  {/* 如果是 PDF 转 Word 且已选择文件，展示专属第一页缩略图预览卡片 */}
                  {activeDocTab === "pdf-to-word" && files.length > 0 ? (
                    <div className="p-4 rounded-2xl bg-coconut-50/80 dark:bg-darkbg-subtle border border-coconut-200 dark:border-darkbg-border flex flex-col sm:flex-row items-center gap-4">
                      <div className="w-16 h-22 rounded-xl overflow-hidden border border-coconut-300 dark:border-darkbg-border bg-white dark:bg-darkbg-card flex items-center justify-center flex-shrink-0 shadow-xs">
                        {pdfToWordThumb?.url ? (
                          <img
                            src={pdfToWordThumb.url}
                            alt="PDF Preview"
                            className="w-full h-full object-cover"
                          />
                        ) : pdfToWordThumb?.loading ? (
                          <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
                        ) : (
                          <FileText className="w-7 h-7 text-coconut-400" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0 text-center sm:text-left">
                        <h4 className="text-sm font-bold text-coconut-950 dark:text-white truncate">
                          {files[0].name}
                        </h4>
                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-1 text-xs text-coconut-600 dark:text-darkbg-muted">
                          <span className="font-mono">{formatBytes(files[0].size)}</span>
                          <span>·</span>
                          <span>{pdfToWordThumb?.numPages ? `共 ${pdfToWordThumb.numPages} 页` : "PDF 格式"}</span>
                        </div>

                        {/* 起始页微调 */}
                        <div className="flex items-center gap-2 mt-2.5">
                          <label className="text-xs font-semibold text-coconut-800 dark:text-darkbg-text whitespace-nowrap">
                            起始转换页码:
                          </label>
                          <input
                            type="number"
                            min="1"
                            max={pdfToWordThumb?.numPages || 999}
                            value={startPage + 1}
                            onChange={(e) => setStartPage(Math.max(0, (parseInt(e.target.value) || 1) - 1))}
                            className="w-16 px-2 py-1 text-xs font-mono font-bold bg-white dark:bg-darkbg-card border border-coconut-300 dark:border-darkbg-border rounded-lg text-center"
                          />
                          <span className="text-[11px] text-coconut-500">（默认从第 1 页开始）</span>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setFiles([]);
                          setPdfToWordThumb(null);
                        }}
                        className="p-2 rounded-xl text-coconut-500 hover:text-rose-600 hover:bg-rose-500/10 transition-colors"
                        title="更换文件"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <Dropzone
                      accept={activeDocTab === "word-to-pdf" ? ".docx,.doc" : ".pdf"}
                      multiple={false}
                      selectedFiles={files}
                      onFilesSelected={setFiles}
                      onClear={() => setFiles([])}
                      title={
                        activeDocTab === "word-to-pdf"
                          ? "拖入 Word 文档 (.docx, .doc)，或点击选择"
                          : "拖入 PDF 文档 (.pdf)，或点击选择"
                      }
                      hint={
                        activeDocTab === "word-to-pdf"
                          ? "支持 .docx 或 .doc 格式"
                          : "支持标准 PDF 文档"
                      }
                    />
                  )}

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

                  {executionResult ? (
                    <div className="p-5 bg-gradient-to-br from-amber-500/12 via-orange-500/10 to-rose-500/10 dark:from-orange-950/40 dark:via-amber-950/30 dark:to-rose-950/30 border border-amber-300/80 dark:border-amber-600/60 rounded-2xl space-y-4 shadow-coconut-sm animate-fade-in backdrop-blur-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 truncate">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                            <FileCheck className="w-5 h-5 text-white" />
                          </div>
                          <div className="truncate">
                            <h4 className="text-sm font-bold text-coconut-950 dark:text-white truncate">
                              {executionResult.filename}
                            </h4>
                            <p className="text-xs text-orange-800 dark:text-amber-300 font-mono font-medium">
                              {formatBytes(executionResult.size)} · 转换成功已就绪
                            </p>
                          </div>
                        </div>
                        <span className="hidden sm:inline-block px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-900 dark:text-amber-200 border border-amber-500/30 flex-shrink-0">
                          ✓ 就绪 · 点击下载
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 pt-1">
                        <button
                          onClick={() => downloadBlob(executionResult.blob, executionResult.filename)}
                          className="flex-1 py-3 px-4 rounded-xl btn-3d-sunset text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-coconut-sm"
                        >
                          <Download className="w-4 h-4" />
                          <span>立即下载该文件</span>
                        </button>

                        <button
                          onClick={() => {
                            setFiles([]);
                            setExecutionResult(null);
                            setSuccessMsg(null);
                            setError(null);
                          }}
                          className="py-3 px-4 rounded-xl btn-3d-secondary font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>转换新文件</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={handleExecute}
                      disabled={loading || files.length === 0}
                      className={`w-full py-3.5 px-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                        loading || files.length === 0
                          ? "bg-coconut-100 dark:bg-darkbg-subtle text-coconut-400 dark:text-darkbg-muted cursor-not-allowed border border-coconut-200 dark:border-darkbg-border"
                          : "btn-3d-sunset text-white"
                      }`}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>正在转换中，请稍候...</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4 text-amber-200" />
                          <span>{getActionBtnText()}</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 底部极简版权 */}
          <footer className="py-6 text-center text-xs text-coconut-500 dark:text-darkbg-muted border-t border-coconut-200/50 dark:border-darkbg-border space-y-1">
            <p className="font-mono text-xs font-medium">XC OmniBox Studio · 全能创作效率平台</p>
          </footer>
        </main>
      </div>
    </div>
  );
}
