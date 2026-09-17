"use client";

import React, { useState, useEffect } from "react";
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
    category: "AI 智能工坊 (纯离线免费)",
    module: "ai",
    icon: Sparkles,
    tools: [
      { id: "ai-bg-remove", module: "ai", name: "AI 发丝级智能抠图", desc: "本地神经网络逐像素分离主体与复杂背景，支持一键证件照换底排版", badge: "100%本地", icon: Sparkles, keywords: ["抠图", "去除背景", "透明底", "人像", "发丝", "ai"] },
      { id: "ai-ocr", module: "ai", name: "AI 离线 OCR 文字提取", desc: "高精提取中英文、书籍、发票及表格字形，支持一键复制与 TXT 导出", badge: "多语言", icon: FileText, keywords: ["ocr", "文字提取", "识别", "扫描", "文字识别", "离线", "ai"] },
      { id: "ai-upscale", module: "ai", name: "AI 模糊图片高清修复", desc: "2x / 4x 超分辨率重建与边缘去雾锐化，让低清模糊图焕发新生", badge: "2x/4x", icon: Maximize2, keywords: ["超清", "修复", "高清", "放大", "清晰度", "降噪", "ai"] },
    ],
  },
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
];

export default function Home() {
  const [activeModule, setActiveModule] = useState<ModuleType>("document");
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

      downloadBlob(resultBlob, resultFilename);
      setSuccessMsg(`处理完成！已为你自动触发下载: ${resultFilename}`);
    } catch (err: any) {
      setError(err.message || "处理过程出现异常");
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
    <div className="flex h-screen w-screen overflow-hidden bg-coconut-50/70 dark:bg-darkbg-canvas text-coconut-900 dark:text-darkbg-text antialiased">
      {/* 移动端侧边抽屉遮罩 */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 lg:hidden animate-fade-in"
        />
      )}

      {/* ===================== 左侧 PRO 侧边栏 ===================== */}
      {/* ===================== 左侧 PRO 侧边栏 ===================== */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 flex flex-col bg-white/95 dark:bg-darkbg-card/95 border-r border-coconut-200/80 dark:border-darkbg-border backdrop-blur-xl transition-all duration-300 ${
          mobileMenuOpen ? "translate-x-0 w-80 max-w-[85vw]" : "-translate-x-full lg:translate-x-0"
        } ${sidebarCollapsed ? "lg:w-20" : "lg:w-72"}`}
      >
        {/* 顶部品牌 */}
        <div className={`border-b border-coconut-100 dark:border-darkbg-border flex items-center transition-all ${
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
                  <p className="text-[11px] text-coconut-500 dark:text-darkbg-muted truncate">
                    全能本地离线多媒体工作台
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
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索 22 项工具 (如抠图、压缩、转Word)..."
                className="w-full pl-9 pr-8 py-2 text-xs bg-coconut-50/80 dark:bg-darkbg-subtle border border-coconut-200/80 dark:border-darkbg-border rounded-xl text-coconut-900 dark:text-darkbg-text placeholder-coconut-400 dark:placeholder-darkbg-muted focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 text-coconut-400 hover:text-coconut-700 dark:text-darkbg-muted"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* 导航工具树：折叠态仅展示 5 个核心分类大图标，展开态为手风琴仅展开当前分类 */}
        <div className="flex-1 overflow-y-auto p-2 space-y-3 no-scrollbar">
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
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono ${
                          isCur ? "bg-white/20 text-white" : "bg-coconut-200/60 dark:bg-darkbg-subtle text-coconut-700 dark:text-darkbg-muted"
                        }`}>
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
              {TOOLS_REGISTRY.map((group) => {
                const GroupIcon = group.icon;
                const isGroupActive = activeModule === group.module;
                const shortLabel =
                  group.module === "ai"
                    ? "AI"
                    : group.module === "document"
                    ? "文档"
                    : group.module === "image"
                    ? "图片"
                    : group.module === "audio"
                    ? "音频"
                    : "日常";

                return (
                  <button
                    key={group.module}
                    onClick={() => setActiveModule(group.module)}
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
            /* ================= 展开模式 (w-72)：手风琴分类导航，只有点击选中的分类才展开列出全部工具 ================= */
            TOOLS_REGISTRY.map((group) => {
              const GroupIcon = group.icon;
              const isGroupActive = activeModule === group.module;
              return (
                <div key={group.category} className="space-y-1">
                  {/* 分类标题卡片：点击激活该模块并展开其全部工具 */}
                  <button
                    onClick={() => setActiveModule(group.module)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-2xl text-xs font-bold transition-all select-none active:scale-[0.99] ${
                      isGroupActive
                        ? "bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-rose-500/10 text-orange-950 dark:text-orange-200 border border-orange-300/60 dark:border-orange-500/30 shadow-xs"
                        : "text-coconut-700 dark:text-darkbg-muted hover:bg-coconut-100/70 dark:hover:bg-darkbg-elevated hover:text-coconut-900 dark:hover:text-darkbg-text"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div className={`p-1.5 rounded-xl flex-shrink-0 ${
                        isGroupActive
                          ? "bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-xs"
                          : "bg-coconut-200/60 dark:bg-darkbg-subtle text-coconut-700 dark:text-darkbg-muted"
                      }`}>
                        <GroupIcon className="w-4 h-4" />
                      </div>
                      <span className="tracking-tight truncate">{group.category}</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-coconut-200/50 dark:bg-darkbg-subtle font-mono text-coconut-600 dark:text-darkbg-muted">
                        {group.tools.length}
                      </span>
                      <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${
                        isGroupActive ? "rotate-90 text-orange-500 font-bold" : "text-coconut-400 opacity-60"
                      }`} />
                    </div>
                  </button>

                  {/* 仅当前选中的分类才展开其具体工具列表 */}
                  {isGroupActive && (
                    <div className="pl-3 pr-1 py-1 space-y-1 animate-in fade-in slide-in-from-top-2 duration-200 border-l-2 border-orange-500/40 ml-3.5">
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
                            className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-xs transition-all active:scale-[0.98] ${
                              isCur
                                ? "bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white font-bold shadow-3d-sunset scale-[1.02]"
                                : "text-coconut-700 dark:text-darkbg-muted hover:bg-coconut-100/70 dark:hover:bg-darkbg-elevated hover:text-coconut-900 dark:hover:text-darkbg-text"
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isCur ? "text-amber-100" : "text-coconut-500 dark:text-darkbg-muted"}`} />
                              <span className="truncate">{t.name}</span>
                            </div>
                            {t.badge && (
                              <span
                                className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono font-medium transition-colors ${
                                  isCur
                                    ? "bg-white/25 text-white"
                                    : "bg-coconut-200/60 dark:bg-darkbg-subtle text-coconut-600 dark:text-darkbg-muted"
                                }`}
                              >
                                {t.badge}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* 侧边栏底部：标准深浅模式切换与引擎状态 */}
        <div className="p-3 border-t border-coconut-100 dark:border-darkbg-border space-y-2 bg-coconut-50/50 dark:bg-darkbg-card/50">
          {/* 明暗模式标准切换 */}
          <button
            onClick={toggleTheme}
            className={`w-full flex items-center gap-2 p-2 rounded-xl border border-coconut-200/80 dark:border-darkbg-border bg-white dark:bg-darkbg-subtle text-xs font-medium text-coconut-700 dark:text-darkbg-text hover:bg-coconut-100/80 dark:hover:bg-darkbg-elevated transition-all active:scale-95 shadow-2xs ${
              sidebarCollapsed ? "justify-center" : "justify-between"
            }`}
          >
            <div className="flex items-center gap-2">
              {isDark ? (
                <Sun className="w-4 h-4 text-toast-500 animate-spin-subtle" />
              ) : (
                <Moon className="w-4 h-4 text-coconut-600" />
              )}
              {!sidebarCollapsed && <span>{isDark ? "浅色模式" : "深色模式"}</span>}
            </div>
            {!sidebarCollapsed && (
              <span className="text-[10px] text-coconut-400 dark:text-darkbg-muted font-mono">
                {isDark ? "Light" : "Dark"}
              </span>
            )}
          </button>

          {/* 状态指示 */}
          {!sidebarCollapsed && (
            <div className="flex items-center justify-between px-2 py-1 text-[11px] text-coconut-500 dark:text-darkbg-muted">
              <div className="flex items-center gap-1.5 truncate">
                <span className="w-2 h-2 rounded-full bg-palm-500 animate-pulse flex-shrink-0" />
                <span className="truncate">本地离线纯算力引擎</span>
              </div>
              <span className="font-mono text-[10px] text-palm-700 dark:text-palm-400 font-semibold">
                Ready
              </span>
            </div>
          )}
        </div>
      </aside>

      {/* ===================== 右侧沉浸式主工作台 ===================== */}
      <div className="flex-1 h-full flex flex-col overflow-hidden min-w-0 relative">
        {/* 顶部工具栏与面包屑 */}
        <header className="h-14 border-b border-coconut-200/80 dark:border-darkbg-border bg-white/80 dark:bg-darkbg-card/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between flex-shrink-0 gap-3 z-10">
          {/* 左侧：移动端菜单按钮 + 面包屑 */}
          <div className="flex items-center gap-3 truncate">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl text-coconut-600 dark:text-darkbg-muted hover:bg-coconut-100 dark:hover:bg-darkbg-elevated transition-colors"
              aria-label="打开侧边导航"
            >
              <Menu className="w-5 h-5" />
            </button>

            <nav className="flex items-center gap-1.5 text-xs text-coconut-500 dark:text-darkbg-muted truncate">
              <span>工作台</span>
              <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-coconut-400" />
              <span className="font-medium text-coconut-700 dark:text-darkbg-text">
                {currentCategory?.category}
              </span>
              <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-coconut-400" />
              <span className="font-semibold text-coconut-900 dark:text-white truncate">
                {currentActiveTool?.name}
              </span>
            </nav>
          </div>

          {/* 右侧：4 大分类快速切换芯片 + 模式切换 */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div className="hidden sm:flex items-center bg-coconut-100/80 dark:bg-darkbg-subtle p-1 rounded-2xl border border-coconut-200/60 dark:border-darkbg-border gap-1">
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
                    onClick={() => setActiveModule(m.id as any)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                      isCur
                        ? "bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white shadow-3d-sunset"
                        : "text-coconut-600 dark:text-darkbg-muted hover:text-coconut-900 dark:hover:text-darkbg-text"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>

            {/* 顶栏独立快速深浅模式 */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl border border-coconut-200/80 dark:border-darkbg-border bg-white dark:bg-darkbg-subtle text-coconut-600 dark:text-darkbg-text hover:bg-coconut-100 dark:hover:bg-darkbg-elevated transition-colors active:scale-95 shadow-2xs"
              title={isDark ? "切换为浅色模式" : "切换为深色模式"}
            >
              {isDark ? <Sun className="w-4 h-4 text-toast-500" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* 主工作区滚动容器 */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 no-scrollbar space-y-6">
          {/* 工具专属顶部说明条 */}
          <div className="bg-white/80 dark:bg-darkbg-card/90 border border-coconut-200/70 dark:border-darkbg-border rounded-3xl p-5 sm:p-6 shadow-coconut-sm backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-coconut-900 dark:text-darkbg-text tracking-tight">
                  {currentActiveTool?.name}
                </h2>
                {currentActiveTool?.badge && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-palm-100 dark:bg-palm-950/80 text-palm-800 dark:text-palm-300 border border-palm-300/50 dark:border-palm-800/60 font-mono font-semibold">
                    {currentActiveTool.badge}
                  </span>
                )}
              </div>
              <p className="text-xs text-coconut-600 dark:text-darkbg-muted leading-relaxed max-w-2xl">
                {currentActiveTool?.desc}
              </p>
            </div>

            <div className="flex items-center gap-2 self-start md:self-center">
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-coconut-100/70 dark:bg-darkbg-subtle border border-coconut-200/60 dark:border-darkbg-border text-xs text-coconut-700 dark:text-darkbg-muted font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-palm-600 dark:text-palm-400" />
                <span>纯本地无损处理 · 零泄密</span>
              </span>
            </div>
          </div>

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
                <div className="bg-white/80 dark:bg-darkbg-card/90 border border-coconut-200/70 dark:border-darkbg-border rounded-3xl p-6 sm:p-8 shadow-coconut-sm backdrop-blur-md space-y-6">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-coconut-900 dark:text-darkbg-text">
                      PDF 1:1 原版排版在线工作台
                    </h3>
                    <p className="text-xs text-coconut-500 dark:text-darkbg-muted">
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
              ) : ["pdf-watermark", "pdf-split", "pdf-protect"].includes(activeDocTab) ? (
                /* 双栏 Studio 工作台：左侧控制台 + 右侧投放画布 */
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* 左侧：参数控制台 */}
                  <div className="lg:col-span-5 bg-white/80 dark:bg-darkbg-card/90 border border-coconut-200/70 dark:border-darkbg-border rounded-3xl p-5 sm:p-6 shadow-coconut-sm space-y-4 backdrop-blur-md">
                    <div className="flex items-center gap-2 pb-3 border-b border-coconut-100 dark:border-darkbg-border text-xs font-bold text-coconut-900 dark:text-darkbg-text">
                      <Sliders className="w-4 h-4 text-palm-600 dark:text-palm-400" />
                      <span>工作台参数微调</span>
                    </div>

                    {activeDocTab === "pdf-watermark" && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-semibold text-coconut-800 dark:text-darkbg-text mb-1.5">
                            水印文字内容
                          </label>
                          <input
                            type="text"
                            value={watermarkText}
                            onChange={(e) => setWatermarkText(e.target.value)}
                            className="w-full text-xs p-3 bg-coconut-50 dark:bg-darkbg-subtle border border-coconut-200 dark:border-darkbg-border rounded-2xl outline-none focus:ring-2 focus:ring-palm-500/20 focus:border-palm-500 text-coconut-900 dark:text-darkbg-text"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between items-center text-xs text-coconut-700 dark:text-darkbg-muted mb-1.5">
                            <span>半透明度</span>
                            <span className="font-mono font-bold text-palm-600 dark:text-palm-400">{watermarkOpacity}</span>
                          </div>
                          <input
                            type="range"
                            min="0.1"
                            max="0.8"
                            step="0.05"
                            value={watermarkOpacity}
                            onChange={(e) => setWatermarkOpacity(parseFloat(e.target.value))}
                            className="w-full accent-palm-600"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-coconut-800 dark:text-darkbg-text mb-1.5">
                            水印旋转倾斜角度
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { label: "水平 (0°)", val: 0 },
                              { label: "轻斜 (30°)", val: 30 },
                              { label: "经典 (45°)", val: 45 },
                              { label: "垂直 (90°)", val: 90 },
                            ].map((ang) => (
                              <button
                                key={ang.val}
                                onClick={() => setWatermarkAngle(ang.val)}
                                className={`py-2 px-2.5 rounded-xl text-xs font-medium border transition-all active:scale-95 ${
                                  watermarkAngle === ang.val
                                    ? "bg-coconut-800 text-coconut-50 dark:bg-white dark:text-zinc-950 font-bold border-transparent shadow-coconut-sm"
                                    : "border-coconut-200 dark:border-darkbg-border text-coconut-700 dark:text-darkbg-muted hover:bg-coconut-100/60 dark:hover:bg-darkbg-elevated dark:hover:text-darkbg-text"
                                }`}
                              >
                                {ang.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {activeDocTab === "pdf-split" && (
                      <div className="space-y-3">
                        <label className="block text-xs font-semibold text-coconut-800 dark:text-darkbg-text mb-1">
                          提取页码范围 (留空则默认拆分为独立单页)
                        </label>
                        <input
                          type="text"
                          placeholder="例如: 1-3, 5, 8-10"
                          value={pageRanges}
                          onChange={(e) => setPageRanges(e.target.value)}
                          className="w-full text-xs p-3 bg-coconut-50 dark:bg-darkbg-subtle border border-coconut-200 dark:border-darkbg-border rounded-2xl outline-none focus:ring-2 focus:ring-palm-500/20 focus:border-palm-500 text-coconut-900 dark:text-darkbg-text font-mono"
                        />
                        <p className="text-[11px] text-coconut-500 dark:text-darkbg-muted leading-relaxed">
                          提示：逗号分隔单个页码，短横线表示范围，支持逆序如 5-1。
                        </p>
                      </div>
                    )}

                    {activeDocTab === "pdf-protect" && (
                      <div className="space-y-3">
                        <label className="block text-xs font-semibold text-coconut-800 dark:text-darkbg-text mb-1">
                          设置访问查看密码
                        </label>
                        <input
                          type="password"
                          placeholder="请输入加密密码"
                          value={protectPassword}
                          onChange={(e) => setProtectPassword(e.target.value)}
                          className="w-full text-xs p-3 bg-coconut-50 dark:bg-darkbg-subtle border border-coconut-200 dark:border-darkbg-border rounded-2xl outline-none focus:ring-2 focus:ring-palm-500/20 focus:border-palm-500 text-coconut-900 dark:text-darkbg-text"
                        />
                        <p className="text-[11px] text-coconut-500 dark:text-darkbg-muted leading-relaxed">
                          采用 AES-128 工业级高强度加密，无密码者无法打开、阅读或打印文档。
                        </p>
                      </div>
                    )}
                  </div>

                  {/* 右侧：投放主舞台与执行 */}
                  <div className="lg:col-span-7 bg-white/80 dark:bg-darkbg-card/90 border border-coconut-200/70 dark:border-darkbg-border rounded-3xl p-5 sm:p-6 shadow-coconut-sm space-y-5 backdrop-blur-md">
                    <div className="text-xs font-bold text-coconut-900 dark:text-darkbg-text">
                      投放待处理文档
                    </div>

                    <Dropzone
                      accept=".pdf"
                      multiple={false}
                      selectedFiles={files}
                      onFilesSelected={setFiles}
                      onClear={() => setFiles([])}
                      title="拖入 PDF 文档 (.pdf)，或点击选择"
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
                      <div className="p-5 bg-palm-50/80 dark:bg-palm-950/40 border border-palm-300 dark:border-palm-800/80 rounded-2xl space-y-4 shadow-sm animate-fade-in">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 truncate">
                            <div className="w-10 h-10 rounded-xl bg-palm-500/20 text-palm-700 dark:text-palm-300 flex items-center justify-center flex-shrink-0">
                              <FileCheck className="w-5 h-5 text-palm-600 dark:text-palm-400" />
                            </div>
                            <div className="truncate">
                              <h4 className="text-sm font-bold text-coconut-900 dark:text-darkbg-text truncate">
                                {executionResult.filename}
                              </h4>
                              <p className="text-xs text-palm-700 dark:text-palm-400 font-mono">
                                {formatBytes(executionResult.size)} · 生成成功
                              </p>
                            </div>
                          </div>
                          <span className="hidden sm:inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold bg-palm-200/80 dark:bg-palm-900/80 text-palm-800 dark:text-palm-200 flex-shrink-0">
                            已自动触发下载
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 pt-1">
                          <button
                            onClick={() => downloadBlob(executionResult.blob, executionResult.filename)}
                            className="flex-1 py-3 px-4 rounded-xl btn-3d-palm text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all"
                          >
                            <Download className="w-4 h-4" />
                            <span>再次下载此文件</span>
                          </button>

                          <button
                            onClick={() => {
                              setFiles([]);
                              setExecutionResult(null);
                              setSuccessMsg(null);
                              setError(null);
                            }}
                            className="py-3 px-4 rounded-xl border border-coconut-300 dark:border-darkbg-border bg-white dark:bg-darkbg-subtle hover:bg-coconut-100/70 dark:hover:bg-darkbg-card text-coconut-800 dark:text-darkbg-text font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all active:scale-95"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>处理新文件</span>
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
                            <span>正在处理中，请稍候...</span>
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
                </div>
              ) : (
                /* 单宽幅 Studio 工作台：转Word、转PDF、合并 */
                <div className="bg-white/80 dark:bg-darkbg-card/90 border border-coconut-200/70 dark:border-darkbg-border rounded-3xl p-6 sm:p-8 shadow-coconut-sm backdrop-blur-md space-y-6">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-coconut-900 dark:text-darkbg-text">
                      {activeDocTab === "pdf-merge"
                        ? "多文件批量选择合并"
                        : activeDocTab === "word-to-pdf"
                        ? "Word 文档格式转换"
                        : "PDF 逆向格式转换"}
                    </h3>
                    <p className="text-xs text-coconut-500 dark:text-darkbg-muted">
                      {activeDocTab === "pdf-merge"
                        ? "支持选中多个 PDF 批量上传，按顺序无损重排拼合成单一完整文档。"
                        : activeDocTab === "word-to-pdf"
                        ? "支持 .docx、.doc 格式，100% 打印级矢量超清渲染，公式与表格精准保留。"
                        : "基于专业重构引擎，精准还原表格、文本排版与内嵌高清图片。"}
                    </p>
                  </div>

                  <Dropzone
                    accept={activeDocTab === "word-to-pdf" ? ".docx,.doc" : ".pdf"}
                    multiple={activeDocTab === "pdf-merge"}
                    selectedFiles={files}
                    onFilesSelected={setFiles}
                    onClear={() => setFiles([])}
                    title={
                      activeDocTab === "pdf-merge"
                        ? "拖入多个 PDF 文件（按 Ctrl 多选），或点击选择"
                        : activeDocTab === "word-to-pdf"
                        ? "拖入 Word 文档 (.docx, .doc)，或点击选择"
                        : "拖入 PDF 文档 (.pdf)，或点击选择"
                    }
                    hint={
                      activeDocTab === "word-to-pdf"
                        ? "支持 .docx 或 .doc 格式"
                        : activeDocTab === "pdf-merge"
                        ? "支持选中多个 PDF 批量合并"
                        : "支持标准 PDF 文档"
                    }
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
                    <div className="p-5 bg-palm-50/80 dark:bg-palm-950/40 border border-palm-300 dark:border-palm-800/80 rounded-2xl space-y-4 shadow-sm animate-fade-in">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 truncate">
                          <div className="w-10 h-10 rounded-xl bg-palm-500/20 text-palm-700 dark:text-palm-300 flex items-center justify-center flex-shrink-0">
                            <FileCheck className="w-5 h-5 text-palm-600 dark:text-palm-400" />
                          </div>
                          <div className="truncate">
                            <h4 className="text-sm font-bold text-coconut-900 dark:text-darkbg-text truncate">
                              {executionResult.filename}
                            </h4>
                            <p className="text-xs text-palm-700 dark:text-palm-400 font-mono">
                              {formatBytes(executionResult.size)} · 生成成功
                            </p>
                          </div>
                        </div>
                        <span className="hidden sm:inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold bg-palm-200/80 dark:bg-palm-900/80 text-palm-800 dark:text-palm-200 flex-shrink-0">
                          已自动触发下载
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 pt-1">
                        <button
                          onClick={() => downloadBlob(executionResult.blob, executionResult.filename)}
                          className="flex-1 py-3 px-4 rounded-xl btn-3d-palm text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all"
                        >
                          <Download className="w-4 h-4" />
                          <span>再次下载此文件</span>
                        </button>

                        <button
                          onClick={() => {
                            setFiles([]);
                            setExecutionResult(null);
                            setSuccessMsg(null);
                            setError(null);
                          }}
                          className="py-3 px-4 rounded-xl border border-coconut-300 dark:border-darkbg-border bg-white dark:bg-darkbg-subtle hover:bg-coconut-100/70 dark:hover:bg-darkbg-card text-coconut-800 dark:text-darkbg-text font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all active:scale-95"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>处理新文件</span>
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
                          <span>正在处理中，请稍候...</span>
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

          {/* 底部极简版权与隐私声明 */}
          <footer className="py-6 text-center text-xs text-coconut-400 dark:text-darkbg-muted border-t border-coconut-200/50 dark:border-darkbg-border space-y-1">
            <p>🔒 隐私保证：所有任务均在浏览器本地及受保护的临时沙箱中执行，零数据驻留</p>
            <p className="font-mono text-[11px]">XC OmniBox Studio v2.0 · 离线全能创作工具箱</p>
          </footer>
        </main>
      </div>
    </div>
  );
}
