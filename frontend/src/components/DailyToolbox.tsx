"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  UserCheck,
  QrCode,
  GitCompare,
  Code2,
  UploadCloud,
  Download,
  Copy,
  Check,
  Trash2,
  ArrowRightLeft,
  Sparkles,
  Sliders,
  Printer,
  FileText,
  Clock,
  KeyRound,
  FileCode,
  CheckCircle2,
  AlertCircle,
  Eye,
  Loader2,
} from "lucide-react";
import {
  ID_SPECS,
  BG_COLORS,
  IdPhotoSpec,
  replacePhotoBackground,
  generatePrintSheet,
  generateCustomQrCode,
  computeTextDiff,
  calculateHash,
  calculateMD5,
  encodeBase64,
  decodeBase64,
  formatJson,
  QrDotStyle,
} from "@/lib/utilityProcessor";
import { downloadBlob } from "@/lib/api";
import { formatBytes } from "@/lib/imageProcessor";
import ScrollableTabNav from "@/components/ScrollableTabNav";
import { useI18n } from "@/lib/i18n";

type ToolTab = "idphoto" | "qrcode" | "diff" | "dev";
type DevSubTab = "json" | "base64" | "hash" | "timestamp";

export interface DailyToolboxProps {
  currentTab?: ToolTab;
  onTabChange?: (tab: ToolTab) => void;
  initialPhotoFile?: File | null;
}

export default function DailyToolbox({
  currentTab,
  onTabChange,
  initialPhotoFile,
}: DailyToolboxProps = {}) {
  const { lang } = useI18n();
  const [activeTab, setActiveTab] = useState<ToolTab>(currentTab || "idphoto");
  const [copied, setCopied] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (currentTab && currentTab !== activeTab) {
      setActiveTab(currentTab);
      setError(null);
    }
  }, [currentTab]);

  useEffect(() => {
    if (initialPhotoFile) {
      setActiveTab("idphoto");
      handlePhotoUpload(initialPhotoFile);
    }
  }, [initialPhotoFile]);

  const handleTabSelect = (tab: ToolTab) => {
    setActiveTab(tab);
    setError(null);
    onTabChange?.(tab);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // =======================================================
  // 1. 证件照换底与 6 寸排版状态
  // =======================================================
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [selectedBg, setSelectedBg] = useState(BG_COLORS[0].hex);
  const [selectedSpec, setSelectedSpec] = useState<IdPhotoSpec>(ID_SPECS.ONE_INCH);
  const [tolerance, setTolerance] = useState(32);
  const [feather, setFeather] = useState(16);
  const [processedPhotoBlob, setProcessedPhotoBlob] = useState<Blob | null>(null);
  const [processedPhotoUrl, setProcessedPhotoUrl] = useState<string | null>(null);

  const handlePhotoUpload = async (file: File) => {
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setError(null);
    await processPhotoBg(file, selectedBg, tolerance, feather);
  };

  const processPhotoBg = async (file: File, bgHex: string, tol: number, fea: number) => {
    setIsProcessing(true);
    try {
      const blob = await replacePhotoBackground(file, bgHex, tol, fea);
      setProcessedPhotoBlob(blob);
      setProcessedPhotoUrl(URL.createObjectURL(blob));
    } catch (err: any) {
      setError((lang === "en" ? "Background replacement failed: " : "换底色处理失败: ") + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // 重新换底
  const handleBgChange = async (hex: string) => {
    setSelectedBg(hex);
    if (photoFile) {
      await processPhotoBg(photoFile, hex, tolerance, feather);
    }
  };

  // 下载 6 寸相纸排版大图
  const handleDownloadSheet = async () => {
    if (!processedPhotoBlob) return;
    setIsProcessing(true);
    try {
      const { blob, filename } = await generatePrintSheet(processedPhotoBlob, selectedSpec);
      downloadBlob(blob, filename);
    } catch (err: any) {
      setError((lang === "en" ? "Failed to generate print sheet: " : "生成相纸排版失败: ") + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // =======================================================
  // 2. 二维码工坊状态
  // =======================================================
  const [qrText, setQrText] = useState("https://github.com/LEESC88/XC_OmniBox");
  const [qrFgColor, setQrFgColor] = useState("#2b1e16");
  const [qrBgColor, setQrBgColor] = useState("#FAF1E8");
  const [qrGradient, setQrGradient] = useState(true);
  const [qrGradColor, setQrGradColor] = useState("#15803d");
  const [qrLogoFile, setQrLogoFile] = useState<File | null>(null);
  const [qrResultUrl, setQrResultUrl] = useState<string>("");
  const [qrResultBlob, setQrResultBlob] = useState<Blob | null>(null);
  const [qrSize, setQrSize] = useState(512);
  const [qrDotStyle, setQrDotStyle] = useState<QrDotStyle>("square");
  const [qrMargin, setQrMargin] = useState(2);
  const [qrBorderWidth, setQrBorderWidth] = useState(0);
  const [qrBorderColor, setQrBorderColor] = useState("#2b1e16");
  const [qrBorderRadius, setQrBorderRadius] = useState(0);
  const [qrErrorLevel, setQrErrorLevel] = useState<"L" | "M" | "Q" | "H">("M");

  // 实时更新二维码
  useEffect(() => {
    if (activeTab !== "qrcode" || !qrText.trim()) return;
    generateCustomQrCode({
      text: qrText,
      size: qrSize,
      fgColor: qrFgColor,
      bgColor: qrBgColor,
      gradient: qrGradient,
      gradientColor: qrGradColor,
      logoFile: qrLogoFile || undefined,
      errorCorrection: qrErrorLevel,
      dotStyle: qrDotStyle,
      margin: qrMargin,
      borderWidth: qrBorderWidth,
      borderColor: qrBorderColor,
      borderRadius: qrBorderRadius,
    }).then(({ dataUrl, blob }) => {
      setQrResultUrl(dataUrl);
      setQrResultBlob(blob);
    });
  }, [activeTab, qrText, qrFgColor, qrBgColor, qrGradient, qrGradColor, qrLogoFile, qrSize, qrDotStyle, qrMargin, qrBorderWidth, qrBorderColor, qrBorderRadius, qrErrorLevel]);

  // =======================================================
  // 3. 文本 Diff 状态
  // =======================================================
  const [diffOriginal, setDiffOriginal] = useState(
    "const name = 'XC_OmniBox';\nconsole.log('Hello, ' + name);\nfunction calculate() {\n  return 10 * 20;\n}"
  );
  const [diffModified, setDiffModified] = useState(
    "const name = 'XC_OmniBox (Universal)';\nconsole.log(`Hello, ${name}!`);\nfunction calculate(factor = 1) {\n  return 10 * 20 * factor;\n}"
  );
  const [diffMode, setDiffMode] = useState<"lines" | "words">("lines");
  const [diffViewMode, setDiffViewMode] = useState<"split" | "unified">("split");

  const diffResult = computeTextDiff(diffOriginal, diffModified, diffMode);

  // =======================================================
  // 4. 开发者利器状态 (JSON / Base64 / Hash / 时间戳)
  // =======================================================
  const [devTab, setDevTab] = useState<DevSubTab>("json");

  // JSON
  const [jsonInput, setJsonInput] = useState(
    '{\n  "project": "XC_OmniBox",\n  "version": "1.0.0",\n  "author": "souchen",\n  "features": ["PDF", "Image", "Audio", "Utilities"]\n}'
  );
  const [jsonOutput, setJsonOutput] = useState("");
  const [jsonErr, setJsonErr] = useState<string | null>(null);

  // Base64
  const [b64Text, setB64Text] = useState(
    lang === "en" ? "XC OmniBox - High-Speed All-in-One Local Toolbox" : "XC 万象箱 - 极速全能本地工具箱"
  );
  const [b64Result, setB64Result] = useState("");

  // Hash
  const [hashInput, setHashInput] = useState("XC_OmniBox_Secure_Hash_2026");
  const [hashes, setHashes] = useState({ md5: "", sha1: "", sha256: "", sha512: "" });

  // Timestamp
  const [currentTimestamp, setCurrentTimestamp] = useState(Math.floor(Date.now() / 1000));
  const [tsInput, setTsInput] = useState(Math.floor(Date.now() / 1000).toString());
  const [tsDateResult, setTsDateResult] = useState("");

  // 时钟跳动
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTimestamp(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 哈希计算响应
  useEffect(() => {
    if (activeTab === "dev" && devTab === "hash") {
      const runHashes = async () => {
        const md5Val = calculateMD5(hashInput);
        const sha1Val = await calculateHash(hashInput, "SHA-1");
        const sha256Val = await calculateHash(hashInput, "SHA-256");
        const sha512Val = await calculateHash(hashInput, "SHA-512");
        setHashes({ md5: md5Val, sha1: sha1Val, sha256: sha256Val, sha512: sha512Val });
      };
      runHashes();
    }
  }, [activeTab, devTab, hashInput]);

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* 4 大功能 Tab 切换 (支持鼠标滚轮横移、鼠标拖拽滑动、专属微滑轨与左右翻页箭头) */}
      <ScrollableTabNav
        tabs={[
          {
            id: "idphoto",
            label: lang === "en" ? "ID Photo Studio" : "证件照换底与相纸排版",
            icon: UserCheck,
            badge: lang === "en" ? "6-Inch Print" : "6寸打印级",
          },
          {
            id: "qrcode",
            label: lang === "en" ? "Artistic QR Code" : "个性化艺术二维码",
            icon: QrCode,
            badge: lang === "en" ? "Color / Logo" : "彩色/Logo",
          },
          {
            id: "diff",
            label: lang === "en" ? "Text & Code Diff" : "文本代码差异对比",
            icon: GitCompare,
            badge: lang === "en" ? "Dual-Pane Diff" : "双栏Diff",
          },
          {
            id: "dev",
            label: lang === "en" ? "Dev & Efficiency Toolkit" : "开发与效率神器集",
            icon: Code2,
            badge: "JSON/Base64/Hash",
          },
        ]}
        activeTab={activeTab}
        onTabChange={(id) => handleTabSelect(id as ToolTab)}
      />

      {/* ================= 1. 证件照换底色与排版面板 ================= */}
      {activeTab === "idphoto" && (
        <div className="space-y-6">
          {!photoPreview ? (
            <div
              onClick={() => document.getElementById("photo-upload-input")?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handlePhotoUpload(e.dataTransfer.files[0]);
                }
              }}
              className="border-2 border-dashed border-coconut-300 dark:border-darkbg-border hover:border-palm-500 rounded-3xl p-10 sm:p-12 text-center cursor-pointer transition-all bg-coconut-100/30 dark:bg-darkbg-card/40 hover:bg-palm-50/20 dark:hover:bg-palm-950/20"
            >
              <input
                id="photo-upload-input"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handlePhotoUpload(e.target.files[0]);
                  }
                }}
                className="hidden"
              />
              <UploadCloud className="w-12 h-12 text-palm-600 dark:text-palm-400 mx-auto mb-3" />
              <div className="text-base font-semibold text-coconut-900 dark:text-darkbg-text">
                {lang === "en" ? "Click or drag portrait photo here" : "点击或拖拽上传人像证件照"}
              </div>
              <div className="text-xs text-coconut-500 dark:text-darkbg-muted mt-1">
                {lang === "en"
                  ? "Supports white, blue, red or plain color background portraits. Smart replacement and automatic layout"
                  : "支持白底、蓝底、红底或纯色背景自拍照，智能平滑替换底色并自动排版"}
              </div>
            </div>
          ) : (
            <div className="coconut-panel p-5 sm:p-6 space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-coconut-200/60 dark:border-darkbg-border">
                <div className="text-sm font-bold text-coconut-900 dark:text-darkbg-text flex items-center space-x-2">
                  <UserCheck className="w-5 h-5 text-palm-600 dark:text-palm-400" />
                  <span>{lang === "en" ? "ID Photo Background Studio" : "证件照智能换底色工作台"}</span>
                </div>
                <button
                  onClick={() => {
                    setPhotoFile(null);
                    setPhotoPreview(null);
                    setProcessedPhotoBlob(null);
                  }}
                  className="text-xs text-coconut-500 hover:text-palm-600 dark:text-darkbg-muted dark:hover:text-palm-400 transition-colors"
                >
                  {lang === "en" ? "Change Portrait Photo" : "更换人像照片"}
                </button>
              </div>

              {/* 主体操作区：参数设置 vs 实时预览 */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                {/* 左侧参数配置 */}
                <div className="md:col-span-7 space-y-5">
                  {/* 1. 底色选择 */}
                  <div className="space-y-2">
                    <span className="text-sm font-semibold text-coconut-900 dark:text-darkbg-text">
                      {lang === "en" ? "Select Target Background Color" : "选择目标证件背景色"}
                    </span>
                    <div className="grid grid-cols-2 gap-2.5">
                      {BG_COLORS.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => handleBgChange(c.hex)}
                          className={`flex items-center space-x-2.5 p-3 rounded-2xl border transition-all text-left active:scale-95 ${
                            selectedBg === c.hex
                              ? "border-palm-600 bg-palm-50/70 dark:bg-palm-950/40 text-palm-800 dark:text-palm-200 ring-2 ring-palm-500/20 font-bold"
                              : "border-coconut-200/80 dark:border-darkbg-border text-coconut-800 dark:text-darkbg-muted hover:border-coconut-300 dark:hover:border-darkbg-border"
                          }`}
                        >
                          <span
                            className="w-5 h-5 rounded-full border border-black/10 flex-shrink-0 shadow-sm"
                            style={{ backgroundColor: c.hex }}
                          />
                          <span className="text-xs sm:text-sm font-semibold truncate">
                            {lang === "en" ? c.nameEn || c.name : c.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 2. 冲印排版规格选择 */}
                  <div className="space-y-2">
                    <span className="text-sm font-semibold text-coconut-900 dark:text-darkbg-text">
                      {lang === "en" ? "Print Sheet Specs & Dimensions" : "冲印相纸规格与尺寸"}
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      {Object.values(ID_SPECS).map((sp) => (
                        <button
                          key={sp.name}
                          onClick={() => setSelectedSpec(sp)}
                          className={`py-2 px-1.5 rounded-2xl border text-center transition-all active:scale-95 ${
                            selectedSpec.name === sp.name
                              ? "border-coconut-800 bg-coconut-800 dark:bg-white text-coconut-50 dark:text-zinc-950 shadow-coconut-sm font-bold"
                              : "border-coconut-200/80 dark:border-darkbg-border text-coconut-700 dark:text-darkbg-muted hover:bg-coconut-100/50 dark:hover:bg-darkbg-elevated"
                          }`}
                        >
                          <div className="text-xs truncate font-bold" title={lang === "en" ? sp.nameEn || sp.name : sp.name}>
                            {lang === "en" ? sp.nameEn || sp.name : sp.name}
                          </div>
                          <div className="text-[11px] opacity-80 mt-0.5 font-mono whitespace-nowrap">
                            {sp.mmWidth}×{sp.mmHeight} mm
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 3. 容差与边缘羽化微调 */}
                  <div className="p-4 bg-coconut-100/40 dark:bg-darkbg-subtle rounded-2xl border border-coconut-200/60 dark:border-darkbg-border space-y-3 text-xs sm:text-sm">
                    <div className="flex justify-between items-center text-coconut-900 dark:text-darkbg-text font-semibold">
                      <span>{lang === "en" ? "Tolerance Threshold" : "抠图容差阈值 (Tolerance)"}</span>
                      <span className="font-mono text-palm-700 dark:text-palm-400 font-bold">{tolerance}</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="80"
                      value={tolerance}
                      onChange={(e) => setTolerance(Number(e.target.value))}
                      className="w-full h-2 bg-coconut-200 dark:bg-darkbg-border rounded-lg appearance-none cursor-pointer accent-palm-600 dark:accent-palm-400"
                    />

                    <div className="flex justify-between items-center text-coconut-900 dark:text-darkbg-text font-semibold pt-1">
                      <span>{lang === "en" ? "Edge Feathering" : "边缘羽化模糊度 (Feather)"}</span>
                      <span className="font-mono text-palm-700 dark:text-palm-400 font-bold">{feather} px</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="10"
                      value={feather}
                      onChange={(e) => setFeather(Number(e.target.value))}
                      className="w-full h-2 bg-coconut-200 dark:bg-darkbg-border rounded-lg appearance-none cursor-pointer accent-palm-600 dark:accent-palm-400"
                    />
                  </div>

                  {/* 4. 立即重新处理按钮 */}
                  <button
                    onClick={() => {
                      if (photoFile) processPhotoBg(photoFile, selectedBg, tolerance, feather);
                    }}
                    disabled={isProcessing}
                    className="w-full py-3.5 btn-3d-sunset text-white rounded-2xl text-sm font-bold flex items-center justify-center space-x-2"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{lang === "en" ? "Processing background..." : "正在处理换底..."}</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>{lang === "en" ? "Re-apply & Generate" : "应用参数重新生成"}</span>
                      </>
                    )}
                  </button>
                </div>

                {/* 右侧渲染与预览区 */}
                <div className="md:col-span-5 space-y-4">
                  <div className="p-4 bg-coconut-100/30 dark:bg-darkbg-subtle rounded-2xl border border-coconut-200/60 dark:border-darkbg-border flex flex-col items-center justify-center min-h-[300px]">
                    {processedPhotoBlob ? (
                      <img
                        src={URL.createObjectURL(processedPhotoBlob)}
                        alt={lang === "en" ? "ID photo preview" : "证件照效果"}
                        className="max-h-64 object-contain rounded-xl shadow-md border border-coconut-200 dark:border-darkbg-border"
                      />
                    ) : photoPreview ? (
                      <img
                        src={photoPreview}
                        alt={lang === "en" ? "Original preview" : "原图预览"}
                        className="max-h-64 object-contain rounded-xl shadow-md opacity-70"
                      />
                    ) : null}
                  </div>

                  {processedPhotoBlob && (
                    <div className="w-full space-y-2.5">
                      <button
                        onClick={() => {
                          if (processedPhotoBlob) {
                            downloadBlob(processedPhotoBlob, `id_photo_${selectedSpec.name}_clean.jpg`);
                          }
                        }}
                        className="w-full py-3 btn-3d-sunset text-white rounded-2xl text-sm font-bold flex items-center justify-center space-x-2"
                      >
                        <Download className="w-4 h-4" />
                        <span>{lang === "en" ? "Download Single HD Photo" : "下载单张高清证件照"}</span>
                      </button>

                      <button
                        onClick={handleDownloadSheet}
                        disabled={isProcessing}
                        className="w-full py-3 btn-3d-secondary rounded-2xl text-sm font-bold flex items-center justify-center space-x-2"
                      >
                        <Printer className="w-4 h-4" />
                        <span>{lang === "en" ? "🖨️ Generate 6-Inch Print Sheet (with crop lines)" : "🖨️ 生成 6寸相纸排版大图 (带裁切虚线)"}</span>
                      </button>
                      <p className="text-xs text-coconut-600 dark:text-darkbg-muted text-center leading-relaxed">
                        {lang === "en"
                          ? "💡 Standard 6-inch photo paper can be directly sent to print shops; cut along dashed lines for standard photos"
                          : "💡 标准 6 寸相纸可直接发给冲印店打印，沿虚线裁切即得整版证件照"}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= 2. 个性化二维码工坊面板 ================= */}
      {activeTab === "qrcode" && (
        <div className="space-y-6">
          <div className="coconut-panel p-5 sm:p-6">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
              {/* 左侧参数调节 */}
              <div className="md:col-span-7 space-y-4">
                <div className="space-y-1.5">
                  <span className="text-sm font-semibold text-coconut-900 dark:text-darkbg-text">
                    {lang === "en" ? "QR Code Content (URL / Text / Wi-Fi)" : "二维码内容 (网址 / 文本 / Wi-Fi)"}
                  </span>
                  <textarea
                    rows={3}
                    value={qrText}
                    onChange={(e) => setQrText(e.target.value)}
                    placeholder={
                      lang === "en"
                        ? "Enter URL, text, or any content to encode..."
                        : "输入需要生成二维码的网页链接或任意文字..."
                    }
                    className="w-full p-3.5 text-sm bg-white/70 dark:bg-darkbg-subtle border border-coconut-300/80 dark:border-darkbg-border rounded-2xl font-mono text-coconut-900 dark:text-darkbg-text focus:outline-none focus:border-palm-500 shadow-2xs"
                  />
                </div>

                {/* 颜色 + 输出尺寸 */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <span className="text-sm font-semibold text-coconut-900 dark:text-darkbg-text">
                      {lang === "en" ? "Foreground Color" : "前景色"}
                    </span>
                    <div className="flex items-center space-x-2.5">
                      <input
                        type="color"
                        value={qrFgColor}
                        onChange={(e) => setQrFgColor(e.target.value)}
                        className="w-9 h-9 rounded-lg border border-coconut-300 dark:border-darkbg-border cursor-pointer bg-transparent"
                      />
                      <span className="text-sm font-mono font-semibold text-coconut-800 dark:text-darkbg-muted">{qrFgColor}</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-sm font-semibold text-coconut-900 dark:text-darkbg-text">
                      {lang === "en" ? "Background Color" : "背景色"}
                    </span>
                    <div className="flex items-center space-x-2.5">
                      <input
                        type="color"
                        value={qrBgColor}
                        onChange={(e) => setQrBgColor(e.target.value)}
                        className="w-9 h-9 rounded-lg border border-coconut-300 dark:border-darkbg-border cursor-pointer bg-transparent"
                      />
                      <span className="text-sm font-mono font-semibold text-coconut-800 dark:text-darkbg-muted">{qrBgColor}</span>
                    </div>
                  </div>
                </div>

                {/* 输出尺寸 */}
                <div className="space-y-1.5">
                  <span className="text-sm font-semibold text-coconut-900 dark:text-darkbg-text">
                    {lang === "en" ? "Output Size" : "输出尺寸"}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {[256, 512, 768, 1024].map((s) => (
                      <button
                        key={s}
                        onClick={() => setQrSize(s)}
                        className={`px-3.5 py-1.5 text-xs font-bold rounded-xl border transition-all active:scale-95 ${
                          qrSize === s
                            ? "bg-palm-500 text-white border-palm-500 shadow-sm"
                            : "bg-coconut-50/80 dark:bg-darkbg-subtle text-coconut-700 dark:text-darkbg-muted border-coconut-200 dark:border-darkbg-border hover:bg-coconut-100"
                        }`}
                      >
                        {s}×{s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 码点样式 */}
                <div className="space-y-1.5">
                  <span className="text-sm font-semibold text-coconut-900 dark:text-darkbg-text">
                    {lang === "en" ? "Dot Style" : "码点样式"}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {([
                      { id: "square" as QrDotStyle, label: lang === "en" ? "■ Square" : "■ 方块" },
                      { id: "rounded" as QrDotStyle, label: lang === "en" ? "▢ Rounded" : "▢ 圆角" },
                      { id: "dot" as QrDotStyle, label: lang === "en" ? "● Dots" : "● 圆点" },
                    ]).map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setQrDotStyle(s.id)}
                        className={`px-3.5 py-1.5 text-xs font-bold rounded-xl border transition-all active:scale-95 ${
                          qrDotStyle === s.id
                            ? "bg-palm-500 text-white border-palm-500 shadow-sm"
                            : "bg-coconut-50/80 dark:bg-darkbg-subtle text-coconut-700 dark:text-darkbg-muted border-coconut-200 dark:border-darkbg-border hover:bg-coconut-100"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 纠错等级 */}
                <div className="space-y-1.5">
                  <span className="text-sm font-semibold text-coconut-900 dark:text-darkbg-text">
                    {lang === "en" ? "Error Correction" : "纠错等级"}{" "}
                    {qrLogoFile && (
                      <span className="text-xs text-palm-600 font-normal">
                        ({lang === "en" ? "Locked to H for Logo" : "Logo 已锁定为 H"})
                      </span>
                    )}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {([
                      { id: "L" as const, label: lang === "en" ? "L Low (7%)" : "L 低 (7%)", desc: lang === "en" ? "Smallest size" : "尺寸最小" },
                      { id: "M" as const, label: lang === "en" ? "M Mid (15%)" : "M 中 (15%)", desc: lang === "en" ? "Recommended" : "推荐" },
                      { id: "Q" as const, label: lang === "en" ? "Q High (25%)" : "Q 高 (25%)", desc: lang === "en" ? "Complex conditions" : "复杂场景" },
                      { id: "H" as const, label: lang === "en" ? "H Ultra (30%)" : "H 极高 (30%)", desc: lang === "en" ? "Embedded Logo" : "嵌入Logo" },
                    ]).map((lv) => (
                      <button
                        key={lv.id}
                        onClick={() => !qrLogoFile && setQrErrorLevel(lv.id)}
                        disabled={!!qrLogoFile}
                        className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all active:scale-95 ${
                          (qrLogoFile ? "H" : qrErrorLevel) === lv.id
                            ? "bg-palm-500 text-white border-palm-500 shadow-sm"
                            : "bg-coconut-50/80 dark:bg-darkbg-subtle text-coconut-700 dark:text-darkbg-muted border-coconut-200 dark:border-darkbg-border hover:bg-coconut-100"
                        } ${qrLogoFile ? "opacity-60 cursor-not-allowed" : ""}`}
                      >
                        {lv.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 边距 & 边框粗细 */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <span className="text-sm font-semibold text-coconut-900 dark:text-darkbg-text">
                      {lang === "en" ? "Margin" : "边距"}{" "}
                      <span className="text-xs text-coconut-500 dark:text-darkbg-muted font-normal">({qrMargin})</span>
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={6}
                      value={qrMargin}
                      onChange={(e) => setQrMargin(Number(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none bg-coconut-200 dark:bg-darkbg-border accent-palm-500 cursor-pointer"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-sm font-semibold text-coconut-900 dark:text-darkbg-text">
                      {lang === "en" ? "Border Width" : "边框粗细"}{" "}
                      <span className="text-xs text-coconut-500 dark:text-darkbg-muted font-normal">({qrBorderWidth}px)</span>
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={12}
                      value={qrBorderWidth}
                      onChange={(e) => setQrBorderWidth(Number(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none bg-coconut-200 dark:bg-darkbg-border accent-palm-500 cursor-pointer"
                    />
                  </div>
                </div>

                {/* 边框圆滑度 (圆角) 与 颜色 */}
                <div className="p-3.5 bg-coconut-100/40 dark:bg-darkbg-subtle/50 rounded-2xl border border-coconut-200/60 dark:border-darkbg-border space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-coconut-900 dark:text-darkbg-text">
                      {lang === "en" ? "Corner Smoothness / Radius" : "边框圆滑度 / 圆角"}
                    </span>
                    <span className="text-xs font-mono font-semibold text-palm-600 dark:text-palm-400">
                      {qrBorderRadius === 0 ? (lang === "en" ? "Square (0px)" : "直角 (0px)") : `${qrBorderRadius}px`}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {[
                      { r: 0, label: lang === "en" ? "Square" : "直角" },
                      { r: 12, label: lang === "en" ? "Subtle (12px)" : "微圆 (12px)" },
                      { r: 24, label: lang === "en" ? "Smooth (24px)" : "圆滑 (24px)" },
                      { r: 36, label: lang === "en" ? "Round (36px)" : "大圆 (36px)" },
                      { r: 48, label: lang === "en" ? "Pill (48px)" : "超圆 (48px)" },
                    ].map((item) => (
                      <button
                        key={item.r}
                        type="button"
                        onClick={() => setQrBorderRadius(item.r)}
                        className={`px-3 py-1 text-xs font-bold rounded-xl border transition-all active:scale-95 ${
                          qrBorderRadius === item.r
                            ? "bg-palm-500 text-white border-palm-500 shadow-sm"
                            : "bg-white/80 dark:bg-darkbg-subtle text-coconut-700 dark:text-darkbg-muted border-coconut-200 dark:border-darkbg-border hover:bg-coconut-100"
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>

                  <div className="pt-1">
                    <input
                      type="range"
                      min={0}
                      max={56}
                      step={2}
                      value={qrBorderRadius}
                      onChange={(e) => setQrBorderRadius(Number(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none bg-coconut-200 dark:bg-darkbg-border accent-palm-500 cursor-pointer"
                    />
                  </div>

                  {/* 边框颜色 (仅在有边框粗细时提供选色) */}
                  {qrBorderWidth > 0 && (
                    <div className="flex items-center justify-between pt-2 border-t border-coconut-200/50 dark:border-darkbg-border">
                      <span className="text-xs font-semibold text-coconut-800 dark:text-darkbg-text">
                        {lang === "en" ? "Border Color:" : "边框描边颜色:"}
                      </span>
                      <div className="flex items-center space-x-2">
                        <input
                          type="color"
                          value={qrBorderColor}
                          onChange={(e) => setQrBorderColor(e.target.value)}
                          className="w-7 h-7 rounded-lg border border-coconut-300 dark:border-darkbg-border cursor-pointer bg-transparent"
                        />
                        <span className="text-xs font-mono font-semibold text-coconut-800 dark:text-darkbg-muted">{qrBorderColor}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 渐变色开关 */}
                <div className="p-3.5 bg-coconut-100/40 dark:bg-darkbg-subtle/50 rounded-2xl border border-coconut-200/60 dark:border-darkbg-border flex items-center justify-between">
                  <label className="flex items-center space-x-2 text-sm font-medium text-coconut-900 dark:text-darkbg-text cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={qrGradient}
                      onChange={(e) => setQrGradient(e.target.checked)}
                      className="rounded accent-palm-600 text-palm-600"
                    />
                    <span>{lang === "en" ? "Enable Color Gradient" : "开启炫彩渐变色效果"}</span>
                  </label>
                  {qrGradient && (
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-coconut-600 dark:text-darkbg-muted">
                        {lang === "en" ? "Gradient End Color:" : "渐变尾色:"}
                      </span>
                      <input
                        type="color"
                        value={qrGradColor}
                        onChange={(e) => setQrGradColor(e.target.value)}
                        className="w-7 h-7 rounded-md border border-coconut-200 dark:border-darkbg-border cursor-pointer"
                      />
                    </div>
                  )}
                </div>

                {/* 嵌入 Logo */}
                <div className="space-y-1.5">
                  <span className="text-sm font-semibold text-coconut-900 dark:text-darkbg-text">
                    {lang === "en" ? "Embed Brand Logo in Center (Optional)" : "中心嵌入品牌 Logo (可选)"}
                  </span>
                  <div className="flex items-center space-x-3">
                    <input
                      id="qr-logo-input"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setQrLogoFile(e.target.files[0]);
                        }
                      }}
                      className="hidden"
                    />
                    <button
                      onClick={() => document.getElementById("qr-logo-input")?.click()}
                      className="px-4 py-2 bg-coconut-100/80 dark:bg-darkbg-subtle border border-coconut-200 dark:border-darkbg-border rounded-2xl text-xs sm:text-sm font-semibold text-coconut-900 dark:text-darkbg-text hover:bg-coconut-200/60 transition-all active:scale-95"
                    >
                      {qrLogoFile
                        ? lang === "en"
                          ? `Selected: ${qrLogoFile.name}`
                          : `已选: ${qrLogoFile.name}`
                        : lang === "en"
                        ? "Choose Transparent PNG / Icon"
                        : "选择透明 PNG / 图标"}
                    </button>
                    {qrLogoFile && (
                      <button
                        onClick={() => setQrLogoFile(null)}
                        className="text-xs text-toast-600 hover:text-toast-700 transition-colors"
                      >
                        {lang === "en" ? "Remove Logo" : "移除 Logo"}
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-coconut-600 dark:text-darkbg-muted leading-relaxed">
                    {lang === "en"
                      ? "High error correction (30%) is automatically enabled when embedding a logo to ensure instant scanning"
                      : "嵌入 Logo 时将自动启用 High 纠错等级 (30%)，确保扫码秒开"}
                  </p>
                </div>
              </div>

              {/* 右侧实时渲染预览与下载 */}
              <div className="md:col-span-5 flex flex-col items-center space-y-4">
                <div className="text-sm font-semibold text-coconut-900 dark:text-darkbg-text">
                  {lang === "en" ? "Real-time QR Preview" : "实时二维码效果"}
                </div>
                <div className="p-4 bg-white dark:bg-darkbg-subtle rounded-3xl shadow-coconut-md border border-coconut-200/70 dark:border-darkbg-border flex items-center justify-center">
                  {qrResultUrl ? (
                    <img src={qrResultUrl} alt={lang === "en" ? "Generated QR Code" : "生成的二维码"} className="w-52 h-52 object-contain" />
                  ) : (
                    <div className="w-52 h-52 flex items-center justify-center text-xs text-coconut-400 dark:text-darkbg-muted">
                      {lang === "en" ? "Generating..." : "正在生成..."}
                    </div>
                  )}
                </div>

                <div className="w-full text-center">
                  <span className="text-xs text-coconut-500 dark:text-darkbg-muted">
                    {lang === "en" ? "Output: " : "输出: "}
                    {qrSize}×{qrSize}px · {qrLogoFile ? "H" : qrErrorLevel}{" "}
                    {lang === "en" ? "EC" : "纠错"} ·{" "}
                    {qrDotStyle === "square"
                      ? lang === "en" ? "Square" : "方块"
                      : qrDotStyle === "rounded"
                      ? lang === "en" ? "Rounded" : "圆角"
                      : lang === "en" ? "Dots" : "圆点"} ·{" "}
                    {qrBorderWidth > 0
                      ? qrBorderRadius > 0
                        ? lang === "en" ? `Smooth Border(${qrBorderRadius}px)` : `圆滑边框(${qrBorderRadius}px)`
                        : lang === "en" ? "Square Border" : "直角边框"
                      : qrBorderRadius > 0
                      ? lang === "en" ? `Rounded Card(${qrBorderRadius}px)` : `圆角卡片(${qrBorderRadius}px)`
                      : lang === "en" ? "No Border" : "无边框"}
                  </span>
                </div>

                <div className="flex space-x-3 w-full">
                  <button
                    onClick={() => {
                      if (qrResultBlob) {
                        downloadBlob(qrResultBlob, `qrcode_${Date.now()}.png`);
                      }
                    }}
                    className="w-full py-3 btn-3d-sunset text-white rounded-2xl text-sm font-bold flex items-center justify-center space-x-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>{lang === "en" ? "Download High-Res PNG" : "下载高清 PNG"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= 3. 文本与代码 Diff 对比面板 ================= */}
      {activeTab === "diff" && (
        <div className="coconut-panel p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-coconut-200/60 dark:border-darkbg-border">
            <div className="flex items-center space-x-3">
              <span className="text-sm font-semibold text-coconut-900 dark:text-darkbg-text">
                {lang === "en" ? "Diff Mode:" : "对比模式:"}
              </span>
              <div className="flex space-x-1.5">
                {(["lines", "words"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setDiffMode(m)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all active:scale-95 ${
                      diffMode === m
                        ? "bg-coconut-800 text-coconut-50 dark:bg-white dark:text-zinc-950 shadow-coconut-sm font-bold"
                        : "bg-coconut-100 dark:bg-darkbg-subtle text-coconut-700 dark:text-darkbg-muted hover:bg-coconut-200/60 dark:hover:text-darkbg-text"
                    }`}
                  >
                    {m === "lines"
                      ? lang === "en" ? "By Lines (Recommended)" : "按行对比 (推荐)"
                      : lang === "en" ? "By Words" : "按词精细对比"}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-3 text-xs sm:text-sm">
              <span className="px-3 py-1 rounded-xl bg-palm-100/80 dark:bg-palm-950/60 text-palm-700 dark:text-palm-300 font-mono font-bold border border-palm-200/50 dark:border-palm-900/40">
                +{diffResult.addedCount} {lang === "en" ? "Added" : "新增"}
              </span>
              <span className="px-3 py-1 rounded-xl bg-toast-100/80 dark:bg-toast-950/60 text-toast-700 dark:text-toast-300 font-mono font-bold border border-toast-200/50 dark:border-toast-900/40">
                -{diffResult.removedCount} {lang === "en" ? "Removed" : "删除"}
              </span>
              <button
                onClick={() => {
                  const t = diffOriginal;
                  setDiffOriginal(diffModified);
                  setDiffModified(t);
                }}
                className="flex items-center space-x-1 text-coconut-600 hover:text-palm-600 dark:text-darkbg-muted dark:hover:text-palm-400 transition-colors font-semibold"
              >
                <ArrowRightLeft className="w-4 h-4" />
                <span>{lang === "en" ? "Swap Sides" : "左右交换"}</span>
              </button>
            </div>
          </div>

          {/* 输入框双栏 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <span className="text-sm font-semibold text-coconut-900 dark:text-darkbg-text font-mono">
                {lang === "en" ? "Original Version" : "原始版本 (Original)"}
              </span>
              <textarea
                rows={6}
                value={diffOriginal}
                onChange={(e) => setDiffOriginal(e.target.value)}
                className="w-full p-3.5 text-sm bg-white/70 dark:bg-darkbg-subtle/80 border border-coconut-300/80 dark:border-darkbg-border rounded-2xl font-mono leading-relaxed text-coconut-900 dark:text-darkbg-text focus:outline-none focus:border-palm-500 shadow-2xs"
              />
            </div>

            <div className="space-y-1.5">
              <span className="text-sm font-semibold text-coconut-900 dark:text-darkbg-text font-mono">
                {lang === "en" ? "Modified Version" : "修改后版本 (Modified)"}
              </span>
              <textarea
                rows={6}
                value={diffModified}
                onChange={(e) => setDiffModified(e.target.value)}
                className="w-full p-3.5 text-sm bg-white/70 dark:bg-darkbg-subtle/80 border border-coconut-300/80 dark:border-darkbg-border rounded-2xl font-mono leading-relaxed text-coconut-900 dark:text-darkbg-text focus:outline-none focus:border-palm-500 shadow-2xs"
              />
            </div>
          </div>

          {/* 差异可视化高亮输出 */}
          <div className="space-y-1.5">
            <span className="text-sm font-semibold text-coconut-900 dark:text-darkbg-text">
              {lang === "en"
                ? "Diff Visualizer (with additions & deletions highlighted)"
                : "Diff 差异高亮视图 (带增删标记)"}
            </span>
            <div className="p-4 bg-darkbg-canvas rounded-2xl border border-darkbg-border font-mono text-xs sm:text-sm leading-relaxed max-h-80 overflow-y-auto no-scrollbar">
              {diffResult.changes.map((part, index) => {
                const color = part.added
                  ? "bg-palm-950/80 text-palm-300 border-l-2 border-palm-500 pl-2 block my-0.5"
                  : part.removed
                  ? "bg-toast-950/80 text-toast-300 border-l-2 border-toast-500 pl-2 line-through opacity-80 block my-0.5"
                  : "text-coconut-300 dark:text-darkbg-muted block my-0.5";
                return (
                  <span key={index} className={color}>
                    {part.value}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ================= 4. 开发者与日常必备利器面板 ================= */}
      {activeTab === "dev" && (
        <div className="coconut-panel p-5 sm:p-6 space-y-6">
          {/* 二级子 Tab (支持滚轮横向滚动) */}
          <div
            onWheel={(e) => {
              if (e.deltaY !== 0) {
                e.currentTarget.scrollLeft += e.deltaY * 0.9;
              }
            }}
            className="flex space-x-2 border-b border-coconut-200/60 dark:border-darkbg-border pb-3 overflow-x-auto tab-scrollbar snap-x touch-pan-x"
          >
            {[
              { id: "json", label: lang === "en" ? "JSON Formatter" : "JSON 格式化校验", icon: FileCode },
              { id: "base64", label: lang === "en" ? "Base64 Codec" : "Base64 编解码", icon: KeyRound },
              { id: "hash", label: lang === "en" ? "Hash Generator" : "哈希计算 (SHA/MD5)", icon: Sparkles },
              { id: "timestamp", label: lang === "en" ? "Unix Timestamp" : "Unix 时间戳互转", icon: Clock },
            ].map((sub) => {
              const Icon = sub.icon;
              const isCur = devTab === sub.id;
              return (
                <button
                  key={sub.id}
                  onClick={() => setDevTab(sub.id as DevSubTab)}
                  className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all snap-start active:scale-95 whitespace-nowrap ${
                    isCur
                      ? "bg-coconut-800 text-coconut-50 dark:bg-white dark:text-zinc-950 shadow-coconut-sm font-bold"
                      : "bg-coconut-100/70 dark:bg-darkbg-subtle text-coconut-700 dark:text-darkbg-muted hover:bg-coconut-200/60 dark:hover:bg-darkbg-elevated hover:dark:text-darkbg-text border border-coconut-200/40 dark:border-darkbg-border"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{sub.label}</span>
                </button>
              );
            })}
          </div>

          {/* 4.1 JSON 格式化与语法校验 */}
          {devTab === "json" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-sm font-semibold text-coconut-900 dark:text-darkbg-text">
                  {lang === "en" ? "Input raw JSON string" : "输入未格式化的 JSON 字符串"}
                </span>
                <div className="flex items-center space-x-2 flex-wrap">
                  <button
                    onClick={() => {
                      const res = formatJson(jsonInput, 2);
                      if (res.success) {
                        setJsonInput(res.result);
                        setJsonErr(null);
                      } else {
                        setJsonErr(res.error || (lang === "en" ? "Syntax Error" : "语法错误"));
                      }
                    }}
                    className="px-3.5 py-1.5 bg-gradient-to-r from-palm-600 to-palm-700 hover:from-palm-700 hover:to-palm-800 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-coconut-sm active:scale-95 transition-all"
                  >
                    {lang === "en" ? "Format (2 Spaces)" : "格式化 (2空格)"}
                  </button>
                  <button
                    onClick={() => {
                      const res = formatJson(jsonInput, 0);
                      if (res.success) {
                        setJsonInput(JSON.stringify(JSON.parse(jsonInput)));
                        setJsonErr(null);
                      }
                    }}
                    className="px-3.5 py-1.5 bg-coconut-100 dark:bg-darkbg-subtle text-coconut-800 dark:text-darkbg-text hover:bg-coconut-200/60 rounded-xl text-xs sm:text-sm font-semibold border border-coconut-200/50 dark:border-darkbg-border active:scale-95 transition-all"
                  >
                    {lang === "en" ? "Minify" : "压缩单行"}
                  </button>
                  <button
                    onClick={() => copyToClipboard(jsonInput)}
                    className="px-3 py-1.5 text-xs sm:text-sm text-coconut-700 hover:text-palm-600 dark:text-darkbg-muted dark:hover:text-palm-400 flex items-center space-x-1 active:scale-95 transition-colors font-semibold"
                  >
                    {copied ? <Check className="w-4 h-4 text-palm-500" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? (lang === "en" ? "Copied" : "已复制") : (lang === "en" ? "Copy" : "复制")}</span>
                  </button>
                </div>
              </div>

              {jsonErr && (
                <div className="p-3.5 bg-toast-50 dark:bg-toast-950/40 border border-toast-200 dark:border-toast-900/60 rounded-2xl text-xs sm:text-sm text-toast-700 dark:text-toast-300 font-mono">
                  ⚠️ {lang === "en" ? "JSON Syntax Error: " : "JSON 校验错误: "}{jsonErr}
                </div>
              )}

              <textarea
                rows={12}
                value={jsonInput}
                onChange={(e) => {
                  setJsonInput(e.target.value);
                  setJsonErr(null);
                }}
                className="w-full p-4 text-xs sm:text-sm bg-darkbg-canvas text-palm-300 font-mono rounded-2xl border border-darkbg-border leading-relaxed focus:outline-none focus:ring-2 focus:ring-palm-500/20 no-scrollbar"
              />
            </div>
          )}

          {/* 4.2 Base64 编解码 */}
          {devTab === "base64" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-sm font-semibold text-coconut-900 dark:text-darkbg-text">
                    <span>{lang === "en" ? "Plaintext (UTF-8)" : "原始明文文本 (支持中文 UTF-8)"}</span>
                    <button
                      onClick={() => setB64Result(encodeBase64(b64Text))}
                      className="px-3 py-1 bg-palm-600 hover:bg-palm-700 text-white rounded-xl text-xs sm:text-sm font-semibold active:scale-95 transition-all"
                    >
                      {lang === "en" ? "Encode to Base64 →" : "编码为 Base64 →"}
                    </button>
                  </div>
                  <textarea
                    rows={8}
                    value={b64Text}
                    onChange={(e) => setB64Text(e.target.value)}
                    className="w-full p-3.5 text-sm bg-white/70 dark:bg-darkbg-subtle border border-coconut-300/80 dark:border-darkbg-border rounded-2xl font-mono text-coconut-900 dark:text-darkbg-text focus:outline-none focus:border-palm-500 shadow-2xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-sm font-semibold text-coconut-900 dark:text-darkbg-text">
                    <span>{lang === "en" ? "Base64 Result" : "Base64 结果"}</span>
                    <button
                      onClick={() => {
                        try {
                          setB64Text(decodeBase64(b64Result));
                        } catch (e) {
                          setError(lang === "en" ? "Invalid Base64 string" : "无效的 Base64 字符串");
                        }
                      }}
                      className="px-3 py-1 bg-coconut-800 hover:bg-coconut-900 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 text-coconut-50 rounded-xl text-xs sm:text-sm font-semibold active:scale-95 transition-all shadow-sm"
                    >
                      {lang === "en" ? "← Decode to Plaintext" : "← 解码为明文"}
                    </button>
                  </div>
                  <textarea
                    rows={8}
                    value={b64Result}
                    onChange={(e) => setB64Result(e.target.value)}
                    className="w-full p-3.5 text-sm bg-darkbg-canvas text-coconut-800 dark:text-darkbg-text border border-darkbg-border rounded-2xl font-mono focus:outline-none focus:ring-2 focus:ring-palm-500/20 shadow-inner"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 4.3 哈希计算 */}
          {devTab === "hash" && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <span className="text-sm font-semibold text-coconut-900 dark:text-darkbg-text">
                  {lang === "en" ? "Text to Hash" : "待哈希文本"}
                </span>
                <input
                  type="text"
                  value={hashInput}
                  onChange={(e) => setHashInput(e.target.value)}
                  className="w-full p-3.5 text-sm bg-white/70 dark:bg-darkbg-subtle border border-coconut-300/80 dark:border-darkbg-border rounded-2xl font-mono text-coconut-900 dark:text-darkbg-text focus:outline-none focus:border-palm-500 shadow-2xs"
                />
              </div>

              <div className="space-y-3 pt-2">
                {[
                  { label: lang === "en" ? "MD5 (32-bit)" : "MD5 (32位)", val: hashes.md5 },
                  { label: lang === "en" ? "SHA-256 (64-bit)" : "SHA-256 (64位)", val: hashes.sha256 },
                  { label: lang === "en" ? "SHA-1 (40-bit)" : "SHA-1 (40位)", val: hashes.sha1 },
                  { label: lang === "en" ? "SHA-512 (128-bit)" : "SHA-512 (128位)", val: hashes.sha512 },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="p-4 bg-coconut-100/40 dark:bg-darkbg-subtle/50 rounded-2xl border border-coconut-200/60 dark:border-darkbg-border flex items-center justify-between"
                  >
                    <div className="space-y-0.5 truncate pr-2">
                      <div className="text-xs font-bold text-coconut-600 dark:text-darkbg-muted">{item.label}</div>
                      <div className="text-sm font-mono text-coconut-900 dark:text-darkbg-text truncate select-all font-medium">
                        {item.val || (lang === "en" ? "Calculating..." : "计算中...")}
                      </div>
                    </div>
                    <button
                      onClick={() => copyToClipboard(item.val)}
                      className="p-2 text-coconut-500 hover:text-palm-600 dark:text-darkbg-muted dark:hover:text-palm-400 transition-colors"
                      title={lang === "en" ? "Copy Hash" : "复制哈希"}
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4.4 Unix 时间戳互转 */}
          {devTab === "timestamp" && (
            <div className="space-y-5">
              <div className="p-5 sm:p-6 bg-palm-50/70 dark:bg-palm-950/30 rounded-2xl border border-palm-200/60 dark:border-palm-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-xs sm:text-sm text-coconut-600 dark:text-darkbg-muted font-medium">
                    {lang === "en" ? "Current Unix Timestamp (seconds):" : "当前实时 Unix 时间戳 (秒级):"}
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold font-mono text-palm-700 dark:text-palm-400">
                    {currentTimestamp}
                  </div>
                </div>
                <div className="text-left sm:text-right space-y-1">
                  <div className="text-xs sm:text-sm text-coconut-600 dark:text-darkbg-muted font-medium">
                    {lang === "en" ? "Local Time (UTC+8):" : "北京时间:"}
                  </div>
                  <div className="text-sm font-mono font-semibold text-coconut-900 dark:text-darkbg-text">
                    {new Date().toLocaleString(lang === "en" ? "en-US" : "zh-CN", { timeZone: "Asia/Shanghai" })}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 bg-coconut-100/40 dark:bg-darkbg-subtle/50 rounded-2xl border border-coconut-200/60 dark:border-darkbg-border space-y-3">
                  <div className="text-sm font-semibold text-coconut-900 dark:text-darkbg-text">
                    {lang === "en" ? "Timestamp → Date & Time" : "时间戳 → 日期时间"}
                  </div>
                  <div className="flex space-x-2">
                    <input
                      type="number"
                      value={tsInput}
                      onChange={(e) => setTsInput(e.target.value)}
                      placeholder={lang === "en" ? "Timestamp in seconds or ms" : "秒或毫秒时间戳"}
                      className="flex-1 p-2.5 text-sm bg-white/70 dark:bg-darkbg-card border border-coconut-300/80 dark:border-darkbg-border rounded-xl font-mono text-coconut-900 dark:text-darkbg-text focus:outline-none focus:border-palm-500 shadow-2xs"
                    />
                    <button
                      onClick={() => {
                        const val = parseInt(tsInput);
                        const ms = tsInput.length === 10 ? val * 1000 : val;
                        setTsDateResult(new Date(ms).toLocaleString(lang === "en" ? "en-US" : "zh-CN"));
                      }}
                      className="px-4 py-2 bg-gradient-to-r from-palm-600 to-palm-700 hover:from-palm-700 hover:to-palm-800 text-white rounded-xl text-xs sm:text-sm font-bold shadow-coconut-sm active:scale-95 transition-all"
                    >
                      {lang === "en" ? "Convert" : "转换"}
                    </button>
                  </div>
                  {tsDateResult && (
                    <div className="text-sm font-mono text-palm-700 dark:text-palm-300 font-bold bg-palm-100/80 dark:bg-palm-950/60 p-3 rounded-xl border border-palm-200/50 dark:border-palm-900/40">
                      {tsDateResult}
                    </div>
                  )}
                </div>

                <div className="p-5 bg-coconut-100/40 dark:bg-darkbg-subtle/50 rounded-2xl border border-coconut-200/60 dark:border-darkbg-border space-y-3">
                  <div className="text-sm font-semibold text-coconut-900 dark:text-darkbg-text">
                    {lang === "en" ? "Common Preset Timestamps" : "当前常用快捷时间戳"}
                  </div>
                  <div className="space-y-2 text-xs sm:text-sm font-mono text-coconut-600 dark:text-darkbg-muted">
                    <div className="flex justify-between">
                      <span>{lang === "en" ? "Today 00:00:" : "今日零点:"}</span>
                      <span className="text-coconut-900 dark:text-darkbg-text font-semibold">
                        {Math.floor(new Date(new Date().setHours(0, 0, 0, 0)).getTime() / 1000)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>{lang === "en" ? "Millisecond Timestamp:" : "毫秒级时间戳:"}</span>
                      <span className="text-coconut-900 dark:text-darkbg-text font-semibold">{Date.now()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="p-4 rounded-2xl bg-toast-50 dark:bg-toast-950/40 border border-toast-200 dark:border-toast-900/60 flex items-center space-x-3 text-toast-700 dark:text-toast-400 text-sm animate-shake">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
