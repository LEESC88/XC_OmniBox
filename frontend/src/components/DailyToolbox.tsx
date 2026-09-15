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
} from "@/lib/utilityProcessor";
import { downloadBlob } from "@/lib/api";
import { formatBytes } from "@/lib/imageProcessor";

type ToolTab = "idphoto" | "qrcode" | "diff" | "dev";
type DevSubTab = "json" | "base64" | "hash" | "timestamp";

export default function DailyToolbox() {
  const [activeTab, setActiveTab] = useState<ToolTab>("idphoto");
  const [copied, setCopied] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setError("换底色处理失败: " + err.message);
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
      setError("生成相纸排版失败: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // =======================================================
  // 2. 二维码工坊状态
  // =======================================================
  const [qrText, setQrText] = useState("https://github.com/LEESC88/XC_OmniBox");
  const [qrFgColor, setQrFgColor] = useState("#1e293b");
  const [qrBgColor, setQrBgColor] = useState("#ffffff");
  const [qrGradient, setQrGradient] = useState(true);
  const [qrGradColor, setQrGradColor] = useState("#2563eb");
  const [qrLogoFile, setQrLogoFile] = useState<File | null>(null);
  const [qrResultUrl, setQrResultUrl] = useState<string>("");
  const [qrResultBlob, setQrResultBlob] = useState<Blob | null>(null);

  // 实时更新二维码
  useEffect(() => {
    if (activeTab !== "qrcode" || !qrText.trim()) return;
    generateCustomQrCode({
      text: qrText,
      fgColor: qrFgColor,
      bgColor: qrBgColor,
      gradient: qrGradient,
      gradientColor: qrGradColor,
      logoFile: qrLogoFile || undefined,
    }).then(({ dataUrl, blob }) => {
      setQrResultUrl(dataUrl);
      setQrResultBlob(blob);
    });
  }, [activeTab, qrText, qrFgColor, qrBgColor, qrGradient, qrGradColor, qrLogoFile]);

  // =======================================================
  // 3. 文本 Diff 状态
  // =======================================================
  const [diffOriginal, setDiffOriginal] = useState(
    "const name = 'XC_OmniBox';\nconsole.log('Hello, ' + name);\nfunction calculate() {\n  return 10 * 20;\n}"
  );
  const [diffModified, setDiffModified] = useState(
    "const name = 'XC_OmniBox (万象箱)';\nconsole.log(`Hello, ${name}!`);\nfunction calculate(factor = 1) {\n  return 10 * 20 * factor;\n}"
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
  const [b64Text, setB64Text] = useState("XC 万象箱 - 极速全能本地工具箱");
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
      {/* 4 大功能 Tab 切换 */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2 border-b border-zinc-200 dark:border-zinc-800 scrollbar-none">
        {[
          { id: "idphoto", label: "证件照换底与相纸排版", icon: UserCheck, badge: "6寸打印级" },
          { id: "qrcode", label: "个性化艺术二维码", icon: QrCode, badge: "彩色/Logo" },
          { id: "diff", label: "文本代码差异对比", icon: GitCompare, badge: "双栏Diff" },
          { id: "dev", label: "开发与效率神器集", icon: Code2, badge: "JSON/Base64/Hash" },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as ToolTab);
                setError(null);
              }}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all whitespace-nowrap flex-shrink-0 ${
                isActive
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-500/25"
                  : "bg-zinc-100 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                  isActive
                    ? "bg-blue-500/50 text-white"
                    : "bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400"
                }`}
              >
                {tab.badge}
              </span>
            </button>
          );
        })}
      </div>

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
              className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-blue-500 rounded-2xl p-12 text-center cursor-pointer transition-all bg-zinc-50/50 dark:bg-zinc-900/40"
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
              <UploadCloud className="w-12 h-12 text-blue-500 mx-auto mb-3" />
              <div className="text-base font-semibold text-zinc-800 dark:text-zinc-200">
                点击或拖拽上传人像证件照
              </div>
              <div className="text-xs text-zinc-400 mt-1">
                支持白底、蓝底、红底或纯色背景自拍照，智能平滑替换底色并自动排版
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
                <div className="text-sm font-bold text-zinc-800 dark:text-zinc-200 flex items-center space-x-2">
                  <UserCheck className="w-5 h-5 text-blue-500" />
                  <span>证件照智能换底色工作台</span>
                </div>
                <button
                  onClick={() => {
                    setPhotoFile(null);
                    setPhotoPreview(null);
                    setProcessedPhotoBlob(null);
                  }}
                  className="text-xs text-zinc-400 hover:text-zinc-600"
                >
                  更换人像照片
                </button>
              </div>

              {/* 主体操作区：参数设置 vs 实时预览 */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                {/* 左侧参数配置 */}
                <div className="md:col-span-7 space-y-5">
                  {/* 1. 底色选择 */}
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      选择目标证件背景色
                    </span>
                    <div className="grid grid-cols-2 gap-2.5">
                      {BG_COLORS.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => handleBgChange(c.hex)}
                          className={`flex items-center space-x-2.5 p-2.5 rounded-xl border transition-all text-left ${
                            selectedBg === c.hex
                              ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300"
                              : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300"
                          }`}
                        >
                          <span
                            className="w-5 h-5 rounded-full border border-black/10 flex-shrink-0 shadow-sm"
                            style={{ backgroundColor: c.hex }}
                          />
                          <span className="text-xs font-medium truncate">{c.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 2. 冲印排版规格选择 */}
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      冲印相纸规格与尺寸
                    </span>
                    <div className="flex space-x-2">
                      {Object.values(ID_SPECS).map((sp) => (
                        <button
                          key={sp.name}
                          onClick={() => setSelectedSpec(sp)}
                          className={`flex-1 py-2 px-3 rounded-xl border text-xs font-medium transition-all ${
                            selectedSpec.name === sp.name
                              ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                              : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400"
                          }`}
                        >
                          <div>{sp.name}</div>
                          <div className="text-[10px] opacity-80 mt-0.5">
                            {sp.mmWidth}×{sp.mmHeight} mm
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 3. 容差与边缘羽化微调 */}
                  <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700/60 space-y-3 text-xs">
                    <div className="flex justify-between items-center text-zinc-600 dark:text-zinc-400">
                      <span>抠图颜色容差 (消除杂色背景)</span>
                      <span className="font-mono text-blue-600 font-bold">{tolerance}</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="60"
                      value={tolerance}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setTolerance(val);
                        if (photoFile) processPhotoBg(photoFile, selectedBg, val, feather);
                      }}
                      className="w-full accent-blue-600"
                    />

                    <div className="flex justify-between items-center text-zinc-600 dark:text-zinc-400 pt-1">
                      <span>边缘平滑羽化 (防止生硬锯齿)</span>
                      <span className="font-mono text-blue-600 font-bold">{feather}</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="30"
                      value={feather}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setFeather(val);
                        if (photoFile) processPhotoBg(photoFile, selectedBg, tolerance, val);
                      }}
                      className="w-full accent-blue-600"
                    />
                  </div>
                </div>

                {/* 右侧实时对比预览 */}
                <div className="md:col-span-5 flex flex-col items-center space-y-4">
                  <div className="text-xs font-semibold text-zinc-500">实时换底预览</div>
                  <div
                    className="relative w-48 h-64 rounded-xl overflow-hidden shadow-md border-2 border-zinc-200 dark:border-zinc-700 flex items-center justify-center"
                    style={{ backgroundColor: selectedBg }}
                  >
                    {isProcessing ? (
                      <div className="flex flex-col items-center space-y-2 text-zinc-500 text-xs">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                        <span>正在平滑换底...</span>
                      </div>
                    ) : processedPhotoUrl ? (
                      <img src={processedPhotoUrl} alt="换底效果" className="w-full h-full object-cover" />
                    ) : null}
                  </div>

                  <div className="w-full space-y-2">
                    <button
                      onClick={() => {
                        if (processedPhotoBlob) {
                          downloadBlob(processedPhotoBlob, `id_photo_${selectedSpec.name}_clean.jpg`);
                        }
                      }}
                      className="w-full py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>下载单张高清证件照</span>
                    </button>

                    <button
                      onClick={handleDownloadSheet}
                      disabled={isProcessing}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 shadow-md shadow-blue-500/20"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>🖨️ 生成 6寸相纸排版大图 (带裁切虚线)</span>
                    </button>
                    <p className="text-[10px] text-zinc-400 text-center leading-relaxed">
                      💡 生成的标准 6 寸相纸 (1200x1800 px) 可直接发给冲印店打印（通常仅需 0.3 元），沿虚线裁切即得整版证件照！
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= 2. 个性化二维码工坊面板 ================= */}
      {activeTab === "qrcode" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
              {/* 左侧参数调节 */}
              <div className="md:col-span-7 space-y-4">
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    二维码内容 (网址 / 文本 / Wi-Fi)
                  </span>
                  <textarea
                    rows={3}
                    value={qrText}
                    onChange={(e) => setQrText(e.target.value)}
                    placeholder="输入需要生成二维码的网页链接或任意文字..."
                    className="w-full p-3 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-xs text-zinc-500">前景色</span>
                    <div className="flex items-center space-x-2">
                      <input
                        type="color"
                        value={qrFgColor}
                        onChange={(e) => setQrFgColor(e.target.value)}
                        className="w-8 h-8 rounded border cursor-pointer"
                      />
                      <span className="text-xs font-mono">{qrFgColor}</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs text-zinc-500">背景色</span>
                    <div className="flex items-center space-x-2">
                      <input
                        type="color"
                        value={qrBgColor}
                        onChange={(e) => setQrBgColor(e.target.value)}
                        className="w-8 h-8 rounded border cursor-pointer"
                      />
                      <span className="text-xs font-mono">{qrBgColor}</span>
                    </div>
                  </div>
                </div>

                {/* 渐变色开关 */}
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
                  <label className="flex items-center space-x-2 text-xs font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={qrGradient}
                      onChange={(e) => setQrGradient(e.target.checked)}
                      className="rounded text-blue-600"
                    />
                    <span>开启炫彩渐变色效果</span>
                  </label>
                  {qrGradient && (
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-zinc-400">渐变尾色:</span>
                      <input
                        type="color"
                        value={qrGradColor}
                        onChange={(e) => setQrGradColor(e.target.value)}
                        className="w-7 h-7 rounded border cursor-pointer"
                      />
                    </div>
                  )}
                </div>

                {/* 嵌入 Logo */}
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    中心嵌入品牌 Logo (可选)
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
                      className="px-3.5 py-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200"
                    >
                      {qrLogoFile ? `已选: ${qrLogoFile.name}` : "选择透明 PNG / 图标"}
                    </button>
                    {qrLogoFile && (
                      <button
                        onClick={() => setQrLogoFile(null)}
                        className="text-xs text-red-500 hover:underline"
                      >
                        移除 Logo
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    嵌入 Logo 时将自动启用 High 纠错等级 (30%)，确保扫码 100% 秒开
                  </p>
                </div>
              </div>

              {/* 右侧实时渲染预览与下载 */}
              <div className="md:col-span-5 flex flex-col items-center space-y-4">
                <div className="text-xs font-semibold text-zinc-500">实时二维码效果</div>
                <div className="p-4 bg-white rounded-2xl shadow-md border border-zinc-200 flex items-center justify-center">
                  {qrResultUrl ? (
                    <img src={qrResultUrl} alt="生成的二维码" className="w-52 h-52 object-contain" />
                  ) : (
                    <div className="w-52 h-52 flex items-center justify-center text-xs text-zinc-400">
                      正在生成...
                    </div>
                  )}
                </div>

                <div className="flex space-x-3 w-full">
                  <button
                    onClick={() => {
                      if (qrResultBlob) {
                        downloadBlob(qrResultBlob, `qrcode_${Date.now()}.png`);
                      }
                    }}
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>下载高清 PNG</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= 3. 文本与代码 Diff 对比面板 ================= */}
      {activeTab === "diff" && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center space-x-3">
              <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">对比模式:</span>
              <div className="flex space-x-1">
                {(["lines", "words"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setDiffMode(m)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                      diffMode === m
                        ? "bg-blue-600 text-white"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    {m === "lines" ? "按行对比 (推荐)" : "按词精细对比"}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-3 text-xs">
              <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-600 font-mono font-bold">
                +{diffResult.addedCount} 新增
              </span>
              <span className="px-2 py-0.5 rounded bg-red-100 dark:bg-red-950 text-red-600 font-mono font-bold">
                -{diffResult.removedCount} 删除
              </span>
              <button
                onClick={() => {
                  const t = diffOriginal;
                  setDiffOriginal(diffModified);
                  setDiffModified(t);
                }}
                className="flex items-center space-x-1 text-zinc-500 hover:text-blue-500"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>左右交换</span>
              </button>
            </div>
          </div>

          {/* 输入框双栏 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="text-xs text-zinc-500 font-mono">原始版本 (Original)</span>
              <textarea
                rows={6}
                value={diffOriginal}
                onChange={(e) => setDiffOriginal(e.target.value)}
                className="w-full p-3 text-xs bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl font-mono leading-relaxed"
              />
            </div>

            <div className="space-y-1">
              <span className="text-xs text-zinc-500 font-mono">修改后版本 (Modified)</span>
              <textarea
                rows={6}
                value={diffModified}
                onChange={(e) => setDiffModified(e.target.value)}
                className="w-full p-3 text-xs bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl font-mono leading-relaxed"
              />
            </div>
          </div>

          {/* 差异可视化高亮输出 */}
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Diff 差异高亮视图 (带增删标记)
            </span>
            <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 font-mono text-xs leading-relaxed max-h-80 overflow-y-auto">
              {diffResult.changes.map((part, index) => {
                const color = part.added
                  ? "bg-emerald-950/80 text-emerald-300 border-l-2 border-emerald-500 pl-2 block my-0.5"
                  : part.removed
                  ? "bg-red-950/80 text-red-300 border-l-2 border-red-500 pl-2 line-through opacity-80 block my-0.5"
                  : "text-zinc-300 block my-0.5";
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
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-6">
          {/* 二级子 Tab */}
          <div className="flex space-x-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
            {[
              { id: "json", label: "JSON 格式化校验", icon: FileCode },
              { id: "base64", label: "Base64 编解码", icon: KeyRound },
              { id: "hash", label: "哈希计算 (SHA/MD5)", icon: Sparkles },
              { id: "timestamp", label: "Unix 时间戳互转", icon: Clock },
            ].map((sub) => {
              const Icon = sub.icon;
              const isCur = devTab === sub.id;
              return (
                <button
                  key={sub.id}
                  onClick={() => setDevTab(sub.id as DevSubTab)}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isCur
                      ? "bg-blue-600 text-white"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{sub.label}</span>
                </button>
              );
            })}
          </div>

          {/* 4.1 JSON 格式化与语法校验 */}
          {devTab === "json" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">输入未格式化的 JSON 字符串</span>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      const res = formatJson(jsonInput, 2);
                      if (res.success) {
                        setJsonInput(res.result);
                        setJsonErr(null);
                      } else {
                        setJsonErr(res.error || "语法错误");
                      }
                    }}
                    className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-medium"
                  >
                    格式化 (2空格)
                  </button>
                  <button
                    onClick={() => {
                      const res = formatJson(jsonInput, 0);
                      if (res.success) {
                        setJsonInput(JSON.stringify(JSON.parse(jsonInput)));
                        setJsonErr(null);
                      }
                    }}
                    className="px-3 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs"
                  >
                    压缩单行
                  </button>
                  <button
                    onClick={() => copyToClipboard(jsonInput)}
                    className="px-2.5 py-1 text-xs text-zinc-500 hover:text-blue-500 flex items-center space-x-1"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? "已复制" : "复制"}</span>
                  </button>
                </div>
              </div>

              {jsonErr && (
                <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-600">
                  ⚠️ JSON 校验错误: {jsonErr}
                </div>
              )}

              <textarea
                rows={12}
                value={jsonInput}
                onChange={(e) => {
                  setJsonInput(e.target.value);
                  setJsonErr(null);
                }}
                className="w-full p-3.5 text-xs bg-zinc-950 text-emerald-400 font-mono rounded-xl border border-zinc-800 leading-relaxed"
              />
            </div>
          )}

          {/* 4.2 Base64 编解码 */}
          {devTab === "base64" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs text-zinc-500">
                    <span>原始明文文本 (支持中文 UTF-8)</span>
                    <button
                      onClick={() => setB64Result(encodeBase64(b64Text))}
                      className="px-2.5 py-1 bg-blue-600 text-white rounded text-[11px]"
                    >
                      编码为 Base64 →
                    </button>
                  </div>
                  <textarea
                    rows={8}
                    value={b64Text}
                    onChange={(e) => setB64Text(e.target.value)}
                    className="w-full p-3 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs text-zinc-500">
                    <span>Base64 结果</span>
                    <button
                      onClick={() => {
                        try {
                          setB64Text(decodeBase64(b64Result));
                        } catch (e) {
                          setError("无效的 Base64 字符串");
                        }
                      }}
                      className="px-2.5 py-1 bg-zinc-800 text-white rounded text-[11px]"
                    >
                      ← 解码为明文
                    </button>
                  </div>
                  <textarea
                    rows={8}
                    value={b64Result}
                    onChange={(e) => setB64Result(e.target.value)}
                    className="w-full p-3 text-xs bg-zinc-950 text-zinc-300 border border-zinc-800 rounded-xl font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 4.3 哈希计算 */}
          {devTab === "hash" && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <span className="text-xs text-zinc-500">待哈希文本</span>
                <input
                  type="text"
                  value={hashInput}
                  onChange={(e) => setHashInput(e.target.value)}
                  className="w-full p-2.5 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-mono"
                />
              </div>

              <div className="space-y-3 pt-2">
                {[
                  { label: "MD5 (32位)", val: hashes.md5 },
                  { label: "SHA-256 (64位)", val: hashes.sha256 },
                  { label: "SHA-1 (40位)", val: hashes.sha1 },
                  { label: "SHA-512 (128位)", val: hashes.sha512 },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700 flex items-center justify-between"
                  >
                    <div className="space-y-0.5 truncate pr-2">
                      <div className="text-[11px] font-bold text-zinc-500">{item.label}</div>
                      <div className="text-xs font-mono text-zinc-800 dark:text-zinc-200 truncate select-all">
                        {item.val || "计算中..."}
                      </div>
                    </div>
                    <button
                      onClick={() => copyToClipboard(item.val)}
                      className="p-2 text-zinc-400 hover:text-blue-600 transition-colors"
                      title="复制哈希"
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
              <div className="p-4 bg-blue-50/60 dark:bg-blue-950/30 rounded-xl border border-blue-200/60 dark:border-blue-900/60 flex items-center justify-between">
                <div className="space-y-1">
                  <div className="text-xs text-zinc-500">当前实时 Unix 时间戳 (秒级):</div>
                  <div className="text-xl font-bold font-mono text-blue-600 dark:text-blue-400">
                    {currentTimestamp}
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <div className="text-xs text-zinc-500">北京时间:</div>
                  <div className="text-xs font-mono text-zinc-700 dark:text-zinc-300">
                    {new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700 space-y-3">
                  <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    时间戳 $\rightarrow$ 日期时间
                  </div>
                  <div className="flex space-x-2">
                    <input
                      type="number"
                      value={tsInput}
                      onChange={(e) => setTsInput(e.target.value)}
                      placeholder="秒或毫秒时间戳"
                      className="flex-1 p-2 text-xs bg-white dark:bg-zinc-800 border rounded-lg font-mono"
                    />
                    <button
                      onClick={() => {
                        const val = parseInt(tsInput);
                        const ms = tsInput.length === 10 ? val * 1000 : val;
                        setTsDateResult(new Date(ms).toLocaleString("zh-CN"));
                      }}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs"
                    >
                      转换
                    </button>
                  </div>
                  {tsDateResult && (
                    <div className="text-xs font-mono text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-950 p-2 rounded">
                      {tsDateResult}
                    </div>
                  )}
                </div>

                <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700 space-y-3">
                  <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    当前常用快捷时间戳
                  </div>
                  <div className="space-y-1.5 text-xs font-mono text-zinc-500">
                    <div className="flex justify-between">
                      <span>今日零点:</span>
                      <span className="text-zinc-700 dark:text-zinc-300">
                        {Math.floor(new Date(new Date().setHours(0, 0, 0, 0)).getTime() / 1000)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>毫秒级时间戳:</span>
                      <span className="text-zinc-700 dark:text-zinc-300">{Date.now()}</span>
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
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-center space-x-3 text-red-600 dark:text-red-400 text-sm animate-shake">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
