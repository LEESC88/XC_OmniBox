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
  Banknote,
  Wifi,
  Contact,
  ExternalLink,
  ShieldCheck,
  ScanLine,
  AlignLeft,
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
  decodeQrCodeFromImage,
  buildWifiQrString,
  buildVCardQrString,
  convertNumberToChineseRMB,
  analyzeTextStatistics,
  cleanTextFormatting,
  validateAndParseChineseId,
} from "@/lib/utilityProcessor";
import { downloadBlob } from "@/lib/api";
import { formatBytes } from "@/lib/imageProcessor";
import ScrollableTabNav from "@/components/ScrollableTabNav";
import { useI18n } from "@/lib/i18n";

type ToolTab = "idphoto" | "qrcode" | "diff" | "dev";
type DevSubTab = "rmb" | "stats" | "idcard" | "json" | "base64" | "hash" | "timestamp";

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
  const [targetKb, setTargetKb] = useState<number>(0); // 0 = 不限
  const [tolerance, setTolerance] = useState(32);
  const [feather, setFeather] = useState(16);
  const [processedPhotoBlob, setProcessedPhotoBlob] = useState<Blob | null>(null);
  const [processedPhotoUrl, setProcessedPhotoUrl] = useState<string | null>(null);
  const [processedPhotoSize, setProcessedPhotoSize] = useState<number>(0);
  const [processedPhotoDims, setProcessedPhotoDims] = useState<{ width: number; height: number }>({ width: 295, height: 413 });
  const [sheetResult, setSheetResult] = useState<{ blob: Blob; url: string; filename: string } | null>(null);

  const handlePhotoUpload = async (file: File) => {
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setError(null);
    await processPhotoBg(file, selectedBg, tolerance, feather, selectedSpec, targetKb);
  };

  const processPhotoBg = async (
    file: File,
    bgHex: string,
    tol: number,
    fea: number,
    spec: IdPhotoSpec = selectedSpec,
    kb: number = targetKb
  ) => {
    setIsProcessing(true);
    try {
      const res = await replacePhotoBackground(file, bgHex, tol, fea, spec, kb);
      setProcessedPhotoBlob(res.blob);
      setProcessedPhotoSize(res.size);
      setProcessedPhotoDims({ width: res.width, height: res.height });
      setProcessedPhotoUrl(URL.createObjectURL(res.blob));
      setSheetResult(null);
    } catch (err: any) {
      setError((lang === "en" ? "Background replacement failed: " : "换底色处理失败: ") + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // 重新换底与规格
  const handleBgChange = async (hex: string) => {
    setSelectedBg(hex);
    if (photoFile) {
      await processPhotoBg(photoFile, hex, tolerance, feather, selectedSpec, targetKb);
    }
  };

  const handleSpecChange = async (spec: IdPhotoSpec) => {
    setSelectedSpec(spec);
    if (photoFile) {
      await processPhotoBg(photoFile, selectedBg, tolerance, feather, spec, targetKb);
    }
  };

  const handleTargetKbChange = async (kb: number) => {
    setTargetKb(kb);
    if (photoFile) {
      await processPhotoBg(photoFile, selectedBg, tolerance, feather, selectedSpec, kb);
    }
  };

  // 生成 6 寸相纸排版大图预览
  const handleGenerateSheet = async () => {
    if (!processedPhotoBlob) return;
    setIsProcessing(true);
    try {
      const { blob, filename } = await generatePrintSheet(processedPhotoBlob, selectedSpec);
      setSheetResult({
        blob,
        filename,
        url: URL.createObjectURL(blob),
      });
    } catch (err: any) {
      setError((lang === "en" ? "Failed to generate print sheet: " : "生成相纸排版失败: ") + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // =======================================================
  // 2. 二维码工坊状态 (生成 + 本地离线解码)
  // =======================================================
  const [qrMode, setQrMode] = useState<"create" | "scan">("create");
  const [qrTemplate, setQrTemplate] = useState<"url" | "wifi" | "vcard" | "text">("url");

  // WiFi 专属字段
  const [wifiSsid, setWifiSsid] = useState("MyHome_WiFi_5G");
  const [wifiPassword, setWifiPassword] = useState("88888888");
  const [wifiEncryption, setWifiEncryption] = useState<"WPA" | "WEP" | "nopass">("WPA");
  const [wifiHidden, setWifiHidden] = useState(false);

  // vCard 电子名片专属字段
  const [vcardName, setVcardName] = useState("张经理");
  const [vcardPhone, setVcardPhone] = useState("13800138000");
  const [vcardCompany, setVcardCompany] = useState("科技创新发展有限公司");
  const [vcardTitle, setVcardTitle] = useState("业务总监");
  const [vcardEmail, setVcardEmail] = useState("contact@example.com");

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

  // 扫码解码状态
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [scanPreviewUrl, setScanPreviewUrl] = useState<string>("");
  const [scanResult, setScanResult] = useState<{ text: string; format: string } | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  // WiFi / vCard 模板变动自动同步生成文本
  useEffect(() => {
    if (qrTemplate === "wifi") {
      setQrText(buildWifiQrString(wifiSsid, wifiPassword, wifiEncryption, wifiHidden));
    } else if (qrTemplate === "vcard") {
      setQrText(buildVCardQrString({
        name: vcardName,
        phone: vcardPhone,
        company: vcardCompany,
        title: vcardTitle,
        email: vcardEmail,
      }));
    }
  }, [qrTemplate, wifiSsid, wifiPassword, wifiEncryption, wifiHidden, vcardName, vcardPhone, vcardCompany, vcardTitle, vcardEmail]);

  // 实时生成自定义二维码
  useEffect(() => {
    if (activeTab !== "qrcode" || qrMode !== "create" || !qrText.trim()) return;
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
  }, [activeTab, qrMode, qrText, qrFgColor, qrBgColor, qrGradient, qrGradColor, qrLogoFile, qrSize, qrDotStyle, qrMargin, qrBorderWidth, qrBorderColor, qrBorderRadius, qrErrorLevel]);

  // 处理图片二维码本地解码
  const handleScanQrFile = async (file: File) => {
    setScanFile(file);
    setScanPreviewUrl(URL.createObjectURL(file));
    setScanResult(null);
    setIsScanning(true);
    setError(null);
    try {
      const decoded = await decodeQrCodeFromImage(file);
      if (decoded) {
        setScanResult(decoded);
      } else {
        setError(lang === "en" ? "No QR code detected in image" : "未能在此图片中识别到清晰的二维码，请换一张清晰图片");
      }
    } catch (err: any) {
      setError((lang === "en" ? "QR decode error: " : "二维码识别出错: ") + err.message);
    } finally {
      setIsScanning(false);
    }
  };

  // =======================================================
  // 3. 文本 Diff 状态 (合同、文章与协议对比)
  // =======================================================
  const RENTAL_OLD_PRESET = `房屋租赁合同协议

一、出租方（甲方）：张先生
二、承租方（乙方）：王女士
三、租赁房屋坐落：北京市海淀区中关村南大街1号院2号楼501室。
四、租赁期限：自2026年10月01日起至2027年09月30日止，共计12个月。
五、租金标准：每月租金为人民币 4500 元整（大写：肆仟伍佰元整）。
六、押金条款：押一付三，押金为人民币 4500 元整。合同期满无违约原额退还。
七、水电燃气：租赁期间产生的水电费、燃气费由乙方按月据实自行缴纳。
八、违约责任：任何一方提前解除合同，应提前30天书面通知对方，并支付违约金 4500 元。`;

  const RENTAL_NEW_PRESET = `房屋租赁合同协议（房东增补修改版）

一、出租方（甲方）：张先生
二、承租方（乙方）：王女士
三、租赁房屋坐落：北京市海淀区中关村南大街1号院2号楼501室。
四、租赁期限：自2026年10月01日起至2028年09月30日止，共计24个月。
五、租金标准：每月租金为人民币 4800 元整（大写：肆仟捌佰元整，含物业费）。
六、押金条款：押二付三，押金为人民币 9600 元整。合同期满且验房无损后退还。
七、水电燃气及暖气：租赁期间产生的水电费、燃气费、冬季取暖费由乙方按月据实自行缴纳。
八、违约责任：任何一方提前解除合同，应提前60天书面通知对方，并支付违约金 9600 元。
九、转租限制：未经甲方书面许可，乙方严禁将房屋私自转租、分租给任何第三方。`;

  const [diffOriginal, setDiffOriginal] = useState(RENTAL_OLD_PRESET);
  const [diffModified, setDiffModified] = useState(RENTAL_NEW_PRESET);
  const [diffMode, setDiffMode] = useState<"lines" | "words">("lines");
  const [diffChangesOnly, setDiffChangesOnly] = useState(false);

  const diffResult = computeTextDiff(diffOriginal, diffModified, diffMode);

  // =======================================================
  // 4. 生活与财务实用工具 (中文金融大写 / 字数统计 / 身份证校验 / 常用开发)
  // =======================================================
  const [devTab, setDevTab] = useState<DevSubTab>("rmb");

  // 4.1 人民币财务大写
  const [rmbInput, setRmbInput] = useState("128500.68");
  const [rmbResult, setRmbResult] = useState(() => convertNumberToChineseRMB("128500.68"));

  useEffect(() => {
    setRmbResult(convertNumberToChineseRMB(rmbInput));
  }, [rmbInput]);

  // 4.2 字数统计与标点清洗
  const [statsText, setStatsText] = useState(
    "XC 万象箱（XC_OmniBox）是一个专为大众打造的全能效率工具箱。支持纯本地运行，保护用户隐私，杜绝任何云端泄漏。\n\n无论你是处理日常合同、换底证件照、连接WiFi，还是核对财务报销金额，都能在这里一键搞定！"
  );
  const statsMetrics = analyzeTextStatistics(statsText);

  // 4.3 居民身份证离线校验
  const [idCardInput, setIdCardInput] = useState("110101199003072379");
  const idCardAnalysis = validateAndParseChineseId(idCardInput);

  // 4.4 常用技术工具 (JSON / Base64 / Hash / 时间戳)
  const [jsonInput, setJsonInput] = useState('{\n  "name": "XC_OmniBox",\n  "status": "active"\n}');
  const [jsonErr, setJsonErr] = useState<string | null>(null);

  const [b64Text, setB64Text] = useState("XC 万象箱 - 极速全能本地工具箱");
  const [b64Result, setB64Result] = useState("");

  const [hashInput, setHashInput] = useState("XC_OmniBox_Secure_Hash_2026");
  const [hashes, setHashes] = useState({ md5: "", sha1: "", sha256: "", sha512: "" });

  const [currentTimestamp, setCurrentTimestamp] = useState(Math.floor(Date.now() / 1000));
  const [tsInput, setTsInput] = useState(Math.floor(Date.now() / 1000).toString());
  const [tsDateResult, setTsDateResult] = useState("");

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTimestamp(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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
            badge: lang === "en" ? "6-Inch Print / KB Limit" : "6寸排版/KB限容",
          },
          {
            id: "qrcode",
            label: lang === "en" ? "Artistic QR Code" : "艺术二维码与扫码识别",
            icon: QrCode,
            badge: lang === "en" ? "WiFi / vCard / Scan" : "WiFi/名片/离线识码",
          },
          {
            id: "diff",
            label: lang === "en" ? "Contract & Text Diff" : "合同协议差异对比",
            icon: GitCompare,
            badge: lang === "en" ? "Contract Check" : "合同核对/精细高亮",
          },
          {
            id: "dev",
            label: lang === "en" ? "Finance & Everyday Utils" : "财务大写与日常实用",
            icon: Banknote,
            badge: lang === "en" ? "RMB / Stats / ID" : "财务大写/字数统计",
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
                    <div className="flex justify-between items-center text-sm font-semibold text-coconut-900 dark:text-darkbg-text">
                      <span>{lang === "en" ? "Print Sheet Specs & Dimensions" : "全国考试与通用规格选择"}</span>
                      <span className="text-xs text-palm-600 dark:text-palm-400 font-mono font-bold">
                        {selectedSpec.width}×{selectedSpec.height} px
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {Object.values(ID_SPECS).map((sp) => (
                        <button
                          key={sp.name}
                          onClick={() => handleSpecChange(sp)}
                          className={`py-2 px-2 rounded-2xl border text-left transition-all active:scale-95 ${
                            selectedSpec.name === sp.name
                              ? "border-coconut-800 bg-coconut-800 dark:bg-white text-coconut-50 dark:text-zinc-950 shadow-coconut-sm font-bold"
                              : "bg-coconut-50/60 dark:bg-darkbg-subtle border-coconut-200/80 dark:border-darkbg-border text-coconut-700 dark:text-darkbg-muted hover:bg-coconut-100/50 dark:hover:bg-darkbg-elevated"
                          }`}
                        >
                          <div className="text-xs truncate font-bold" title={sp.name}>
                            {sp.name}
                          </div>
                          <div className="text-[10px] opacity-75 mt-0.5 font-mono whitespace-nowrap">
                            {sp.mmWidth}×{sp.mmHeight} mm · {sp.width}×{sp.height}px
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 3. 报名网站文件体积严格限制 (KB Limiter) */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm font-semibold text-coconut-900 dark:text-darkbg-text">
                      <span>{lang === "en" ? "File Size Limit (KB)" : "报名网站体积严格限制 (KB 限容)"}</span>
                      <span className="text-xs text-toast-500 font-mono font-bold">
                        {targetKb === 0 ? (lang === "en" ? "Unlimited (HD)" : "不限 (原画高清)") : `严格限制在 ${targetKb} KB 内`}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { kb: 0, label: lang === "en" ? "Unlimited" : "不限 (高清)" },
                        { kb: 50, label: lang === "en" ? "< 50 KB" : "极小 (<50KB)" },
                        { kb: 100, label: lang === "en" ? "30~100 KB" : "国考/社保 (<100KB)" },
                        { kb: 200, label: lang === "en" ? "< 200 KB" : "教资/考研 (<200KB)" },
                      ].map((item) => (
                        <button
                          key={item.kb}
                          onClick={() => handleTargetKbChange(item.kb)}
                          className={`py-2 px-1 rounded-xl border text-center text-xs font-semibold transition-all active:scale-95 ${
                            targetKb === item.kb
                              ? "bg-palm-600 text-white border-palm-600 shadow-sm font-bold"
                              : "bg-coconut-50/70 dark:bg-darkbg-subtle text-coconut-700 dark:text-darkbg-muted border-coconut-200 dark:border-darkbg-border hover:bg-coconut-100"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 4. 容差与边缘羽化微调 */}
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

                  {/* 5. 立即重新处理按钮 */}
                  <button
                    onClick={() => {
                      if (photoFile) processPhotoBg(photoFile, selectedBg, tolerance, feather, selectedSpec, targetKb);
                    }}
                    disabled={isProcessing}
                    className="w-full py-3.5 btn-3d-sunset text-white rounded-2xl text-sm font-bold flex items-center justify-center space-x-2"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{lang === "en" ? "Processing background..." : "正在处理换底与尺寸..."}</span>
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
                  <div className="p-4 bg-coconut-100/30 dark:bg-darkbg-subtle rounded-2xl border border-coconut-200/60 dark:border-darkbg-border flex flex-col items-center justify-center min-h-[300px] relative">
                    {processedPhotoBlob ? (
                      <div className="space-y-3 flex flex-col items-center">
                        <img
                          src={processedPhotoUrl || URL.createObjectURL(processedPhotoBlob)}
                          alt={lang === "en" ? "ID photo preview" : "证件照效果"}
                          className="max-h-64 object-contain rounded-xl shadow-md border border-coconut-200 dark:border-darkbg-border"
                        />
                        <div className="px-3 py-1 bg-white/80 dark:bg-darkbg-card rounded-full border border-coconut-200 dark:border-darkbg-border text-xs font-mono text-coconut-700 dark:text-darkbg-muted flex items-center space-x-2">
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">✓ {selectedSpec.width}×{selectedSpec.height} px</span>
                          <span>·</span>
                          <span className="font-bold text-toast-500">{formatBytes(processedPhotoSize)}</span>
                        </div>
                      </div>
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
                            downloadBlob(processedPhotoBlob, `id_photo_${selectedSpec.width}x${selectedSpec.height}_clean.jpg`);
                          }
                        }}
                        className="w-full py-3 btn-3d-sunset text-white rounded-2xl text-sm font-bold flex items-center justify-center space-x-2"
                      >
                        <Download className="w-4 h-4" />
                        <span>{lang === "en" ? "Download Single Photo" : "立即下载单张证件照"}</span>
                      </button>

                      <button
                        onClick={handleGenerateSheet}
                        disabled={isProcessing}
                        className="w-full py-3 btn-3d-secondary rounded-2xl text-sm font-bold flex items-center justify-center space-x-2"
                      >
                        <Printer className="w-4 h-4" />
                        <span>{lang === "en" ? "Generate 6-Inch Print Sheet" : "生成 6 寸相纸排版大图"}</span>
                      </button>

                      {sheetResult && (
                        <div className="p-4 bg-coconut-50 dark:bg-darkbg-card rounded-2xl border border-coconut-200 dark:border-darkbg-border space-y-3 animate-fade-in">
                          <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center space-x-1.5">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>{lang === "en" ? "6-Inch Print Sheet Ready!" : "6寸相纸 9 宫格排版生成成功！"}</span>
                          </div>
                          <img
                            src={sheetResult.url}
                            alt="Print Sheet"
                            className="w-full max-h-48 object-contain rounded-xl border border-coconut-200 dark:border-darkbg-border bg-white"
                          />
                          <button
                            onClick={() => downloadBlob(sheetResult.blob, sheetResult.filename)}
                            className="w-full py-2.5 btn-3d-sunset text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>{lang === "en" ? "Download Print Sheet Image" : "下载 6 寸相纸冲印图"}</span>
                          </button>
                        </div>
                      )}

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

      {/* ================= 2. 个性化二维码与扫码识别面板 ================= */}
      {activeTab === "qrcode" && (
        <div className="space-y-6">
          {/* 二维码模式切换 */}
          <div className="flex space-x-2 border-b border-coconut-200/60 dark:border-darkbg-border pb-3">
            <button
              onClick={() => setQrMode("create")}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center space-x-1.5 transition-all ${
                qrMode === "create"
                  ? "bg-coconut-800 text-coconut-50 dark:bg-white dark:text-zinc-950 shadow-sm"
                  : "bg-coconut-100 dark:bg-darkbg-subtle text-coconut-700 dark:text-darkbg-muted"
              }`}
            >
              <QrCode className="w-4 h-4" />
              <span>{lang === "en" ? "Create Custom QR" : "制作艺术二维码"}</span>
            </button>
            <button
              onClick={() => setQrMode("scan")}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center space-x-1.5 transition-all ${
                qrMode === "scan"
                  ? "bg-coconut-800 text-coconut-50 dark:bg-white dark:text-zinc-950 shadow-sm"
                  : "bg-coconut-100 dark:bg-darkbg-subtle text-coconut-700 dark:text-darkbg-muted"
              }`}
            >
              <ScanLine className="w-4 h-4" />
              <span>{lang === "en" ? "Scan / Decode Image" : "离线识码/解码图片"}</span>
            </button>
          </div>

          {qrMode === "scan" ? (
            <div className="coconut-panel p-5 sm:p-6 space-y-5">
              <div>
                <h3 className="text-base font-bold text-coconut-900 dark:text-darkbg-text flex items-center space-x-2">
                  <ScanLine className="w-5 h-5 text-palm-600 dark:text-palm-400" />
                  <span>{lang === "en" ? "Offline QR Code Scanner & Decoder" : "二维码离线智能识别与解码"}</span>
                </h3>
                <p className="text-xs text-coconut-600 dark:text-darkbg-muted mt-1 leading-relaxed">
                  {lang === "en"
                    ? "Drag or paste any QR code image. 100% offline local parsing with jsQR, zero data upload."
                    : "直接上传或拖拽电脑上的二维码截图、微信名片码、WiFi码等，100% 浏览器本地离线解析，无需掏出手机扫屏幕。"}
                </p>
              </div>

              {!scanFile ? (
                <div
                  onClick={() => document.getElementById("qr-scan-upload")?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleScanQrFile(e.dataTransfer.files[0]);
                    }
                  }}
                  className="border-2 border-dashed border-[#D2BCAB] dark:border-[#4D392E] hover:border-amber-500 dark:hover:border-amber-400 rounded-3xl p-10 text-center cursor-pointer transition-all bg-[#FAF1E8]/75 dark:bg-[#251E1A]/70 hover:bg-[#F4E6D8]/85"
                >
                  <input
                    id="qr-scan-upload"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleScanQrFile(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                  />
                  <ScanLine className="w-10 h-10 text-toast-500 mx-auto mb-2" />
                  <div className="text-sm sm:text-base font-bold text-coconut-900 dark:text-darkbg-text">
                    {lang === "en" ? "Click or drag QR code image here" : "点击或拖拽二维码图片至此处解码"}
                  </div>
                  <div className="text-xs text-coconut-600 dark:text-darkbg-muted mt-1">
                    {lang === "en" ? "Supports PNG, JPG, WebP screenshots" : "支持常见截图、照片、PNG、JPG 与 WebP 格式"}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-3 bg-coconut-50/70 dark:bg-darkbg-subtle rounded-2xl border border-coconut-200/70 dark:border-darkbg-border flex items-center justify-between">
                    <span className="text-xs font-semibold text-coconut-900 dark:text-darkbg-text truncate">
                      {scanFile.name}
                    </span>
                    <button
                      onClick={() => {
                        setScanFile(null);
                        setScanPreviewUrl("");
                        setScanResult(null);
                      }}
                      className="text-xs text-coconut-600 hover:text-coconut-900 dark:text-darkbg-muted dark:hover:text-darkbg-text"
                    >
                      {lang === "en" ? "Change Image" : "更换图片"}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                    <div className="md:col-span-4 flex justify-center p-3 bg-coconut-100/30 dark:bg-darkbg-subtle rounded-2xl border border-coconut-200/60 dark:border-darkbg-border">
                      <img src={scanPreviewUrl} alt="Scan QR" className="max-h-56 object-contain rounded-xl" />
                    </div>

                    <div className="md:col-span-8 space-y-3">
                      {isScanning ? (
                        <div className="p-6 text-center text-xs text-coconut-600 dark:text-darkbg-muted flex items-center justify-center space-x-2">
                          <Loader2 className="w-4 h-4 animate-spin text-palm-500" />
                          <span>{lang === "en" ? "Recognizing QR code in image..." : "正在极速识别图像中的二维码..."}</span>
                        </div>
                      ) : scanResult ? (
                        <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 space-y-3">
                          <div className="flex justify-between items-center text-xs font-bold text-emerald-800 dark:text-emerald-300">
                            <span className="flex items-center space-x-1.5">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              <span>{lang === "en" ? "QR Code Successfully Decoded!" : "二维码识别成功！"}</span>
                            </span>
                            <div className="flex space-x-2">
                              <button
                                onClick={() => copyToClipboard(scanResult.text)}
                                className="px-3 py-1 bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center space-x-1 active:scale-95 transition-all shadow-sm"
                              >
                                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                <span>{copied ? "已复制" : "复制文本"}</span>
                              </button>
                              {/^https?:\/\//i.test(scanResult.text) && (
                                <a
                                  href={scanResult.text}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-3 py-1 bg-palm-600 text-white rounded-xl text-xs font-bold flex items-center space-x-1 active:scale-95 transition-all shadow-sm"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  <span>{lang === "en" ? "Open URL" : "直接打开链接"}</span>
                                </a>
                              )}
                            </div>
                          </div>

                          <div className="p-3 bg-white dark:bg-darkbg-card rounded-xl border border-emerald-100 dark:border-emerald-900/30 font-mono text-xs text-coconut-900 dark:text-darkbg-text break-all select-all leading-relaxed max-h-48 overflow-y-auto">
                            {scanResult.text}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="coconut-panel p-5 sm:p-6">
              {/* 模板选择 */}
              <div className="flex items-center space-x-2 mb-4 pb-3 border-b border-coconut-100 dark:border-darkbg-border flex-wrap gap-y-2">
                <span className="text-xs font-semibold text-coconut-700 dark:text-darkbg-muted">{lang === "en" ? "Template:" : "快捷模板:"}</span>
                {[
                  { id: "url", label: lang === "en" ? "URL / Text" : "常用网址/文本", icon: ExternalLink },
                  { id: "wifi", label: lang === "en" ? "WiFi Quick Connect" : "WiFi 扫码一键连", icon: Wifi },
                  { id: "vcard", label: lang === "en" ? "Contact vCard" : "电子名片 (vCard)", icon: Contact },
                ].map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => setQrTemplate(tpl.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all active:scale-95 ${
                      qrTemplate === tpl.id
                        ? "bg-palm-600 text-white shadow-sm font-bold"
                        : "bg-coconut-100/80 dark:bg-darkbg-subtle text-coconut-700 dark:text-darkbg-muted hover:bg-coconut-200/80"
                    }`}
                  >
                    <tpl.icon className="w-3.5 h-3.5" />
                    <span>{tpl.label}</span>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
                {/* 左侧参数调节 */}
                <div className="md:col-span-7 space-y-4">
                  {/* 根据模板展示输入字段 */}
                  {qrTemplate === "wifi" ? (
                    <div className="p-4 bg-coconut-50/70 dark:bg-darkbg-subtle rounded-2xl border border-coconut-200/70 dark:border-darkbg-border space-y-3">
                      <div className="text-xs font-bold text-coconut-900 dark:text-darkbg-text flex items-center space-x-1.5">
                        <Wifi className="w-4 h-4 text-toast-500" />
                        <span>{lang === "en" ? "WiFi Network Details (Scan to connect directly)" : "WiFi 局域网参数 (扫码直接连入，免手动输密码)"}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="text-[11px] text-coconut-600 dark:text-darkbg-muted block mb-1">
                            {lang === "en" ? "WiFi Name (SSID)" : "WiFi 名称 (SSID)"}
                          </label>
                          <input
                            type="text"
                            value={wifiSsid}
                            onChange={(e) => setWifiSsid(e.target.value)}
                            className="w-full px-3 py-2 bg-white dark:bg-darkbg-card border border-coconut-200 dark:border-darkbg-border rounded-xl text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-coconut-600 dark:text-darkbg-muted block mb-1">
                            {lang === "en" ? "WiFi Password" : "WiFi 密码"}
                          </label>
                          <input
                            type="text"
                            value={wifiPassword}
                            onChange={(e) => setWifiPassword(e.target.value)}
                            className="w-full px-3 py-2 bg-white dark:bg-darkbg-card border border-coconut-200 dark:border-darkbg-border rounded-xl text-xs font-mono"
                          />
                        </div>
                      </div>
                      <div className="flex items-center space-x-3 text-xs pt-1">
                        <label className="text-coconut-600 dark:text-darkbg-muted">{lang === "en" ? "Encryption:" : "加密方式:"}</label>
                        {(["WPA", "WEP", "nopass"] as const).map((enc) => (
                          <label key={enc} className="flex items-center space-x-1 cursor-pointer">
                            <input
                              type="radio"
                              name="wifiEnc"
                              checked={wifiEncryption === enc}
                              onChange={() => setWifiEncryption(enc)}
                              className="accent-palm-600"
                            />
                            <span>{enc === "nopass" ? (lang === "en" ? "Open (None)" : "无密码") : enc}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : qrTemplate === "vcard" ? (
                    <div className="p-4 bg-coconut-50/70 dark:bg-darkbg-subtle rounded-2xl border border-coconut-200/70 dark:border-darkbg-border space-y-3">
                      <div className="text-xs font-bold text-coconut-900 dark:text-darkbg-text flex items-center space-x-1.5">
                        <Contact className="w-4 h-4 text-toast-500" />
                        <span>{lang === "en" ? "vCard Contact Details (Scan to save to phone)" : "电子名片参数 (扫码一键存入手机通讯录)"}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="text-[11px] text-coconut-600 dark:text-darkbg-muted block mb-1">姓名</label>
                          <input
                            type="text"
                            value={vcardName}
                            onChange={(e) => setVcardName(e.target.value)}
                            className="w-full px-3 py-2 bg-white dark:bg-darkbg-card border border-coconut-200 dark:border-darkbg-border rounded-xl text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-coconut-600 dark:text-darkbg-muted block mb-1">手机号码</label>
                          <input
                            type="text"
                            value={vcardPhone}
                            onChange={(e) => setVcardPhone(e.target.value)}
                            className="w-full px-3 py-2 bg-white dark:bg-darkbg-card border border-coconut-200 dark:border-darkbg-border rounded-xl text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-coconut-600 dark:text-darkbg-muted block mb-1">公司/机构</label>
                          <input
                            type="text"
                            value={vcardCompany}
                            onChange={(e) => setVcardCompany(e.target.value)}
                            className="w-full px-3 py-2 bg-white dark:bg-darkbg-card border border-coconut-200 dark:border-darkbg-border rounded-xl text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-coconut-600 dark:text-darkbg-muted block mb-1">电子邮箱</label>
                          <input
                            type="text"
                            value={vcardEmail}
                            onChange={(e) => setVcardEmail(e.target.value)}
                            className="w-full px-3 py-2 bg-white dark:bg-darkbg-card border border-coconut-200 dark:border-darkbg-border rounded-xl text-xs font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <span className="text-sm font-semibold text-coconut-900 dark:text-darkbg-text">
                        {lang === "en" ? "QR Code Content (URL / Text)" : "二维码内容 (网页链接或任意文字)"}
                      </span>
                      <textarea
                        rows={3}
                        value={qrText}
                        onChange={(e) => setQrText(e.target.value)}
                        placeholder="输入需要生成二维码的网页链接或任意文字..."
                        className="w-full p-3.5 text-sm bg-white/70 dark:bg-darkbg-subtle border border-coconut-300/80 dark:border-darkbg-border rounded-2xl font-mono text-coconut-900 dark:text-darkbg-text focus:outline-none focus:border-palm-500 shadow-2xs"
                      />
                    </div>
                  )}

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
        )}
      </div>
    )}

      {/* ================= 3. 文本与代码 Diff 对比面板 ================= */}
      {activeTab === "diff" && (
        <div className="coconut-panel p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-coconut-200/60 dark:border-darkbg-border">
            <div className="flex items-center space-x-3 flex-wrap gap-y-2">
              <span className="text-sm font-semibold text-coconut-900 dark:text-darkbg-text">
                {lang === "en" ? "Diff Mode:" : "对比模式:"}
              </span>
              <div className="flex space-x-1.5">
                {(["lines", "words"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setDiffMode(m)}
                    className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all active:scale-95 ${
                      diffMode === m
                        ? "bg-coconut-800 text-coconut-50 dark:bg-white dark:text-zinc-950 shadow-coconut-sm font-bold"
                        : "bg-coconut-100 dark:bg-darkbg-subtle text-coconut-700 dark:text-darkbg-muted hover:bg-coconut-200/60 dark:hover:text-darkbg-text"
                    }`}
                  >
                    {m === "lines"
                      ? lang === "en" ? "By Lines (Contract)" : "按行对比 (合同推荐)"
                      : lang === "en" ? "By Words (Fine)" : "按词精细高亮"}
                  </button>
                ))}
              </div>

              <label className="flex items-center space-x-1.5 text-xs text-coconut-700 dark:text-darkbg-muted cursor-pointer select-none ml-2">
                <input
                  type="checkbox"
                  checked={diffChangesOnly}
                  onChange={(e) => setDiffChangesOnly(e.target.checked)}
                  className="rounded accent-palm-600"
                />
                <span>{lang === "en" ? "Changes Only (Fold Unchanged)" : "仅看修改段落 (折叠未改动)"}</span>
              </label>
            </div>

            <div className="flex items-center space-x-3 text-xs sm:text-sm flex-wrap gap-y-1.5">
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
                <span>{lang === "en" ? "Swap" : "左右互换"}</span>
              </button>
              <button
                onClick={() => {
                  setDiffOriginal(RENTAL_OLD_PRESET);
                  setDiffModified(RENTAL_NEW_PRESET);
                }}
                className="px-2.5 py-1 rounded-xl bg-coconut-100 dark:bg-darkbg-elevated text-coconut-700 dark:text-darkbg-muted hover:text-coconut-900 text-xs font-semibold"
              >
                {lang === "en" ? "Load Rental Contract Example" : "载入租房合同示例"}
              </button>
            </div>
          </div>

          {/* 输入框双栏 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-sm font-semibold text-coconut-900 dark:text-darkbg-text font-mono">
                <span>{lang === "en" ? "Original Version (Contract A)" : "原始版本 (合同原件 / 甲版)"}</span>
                <button
                  onClick={() => setDiffOriginal("")}
                  className="text-xs text-coconut-400 hover:text-toast-500 font-sans"
                >
                  清空
                </button>
              </div>
              <textarea
                rows={7}
                value={diffOriginal}
                onChange={(e) => setDiffOriginal(e.target.value)}
                placeholder="粘贴原始合同或第一版文本..."
                className="w-full p-3.5 text-xs sm:text-sm bg-white/70 dark:bg-darkbg-subtle/80 border border-coconut-300/80 dark:border-darkbg-border rounded-2xl font-mono leading-relaxed text-coconut-900 dark:text-darkbg-text focus:outline-none focus:border-palm-500 shadow-2xs"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-sm font-semibold text-coconut-900 dark:text-darkbg-text font-mono">
                <span>{lang === "en" ? "Modified Version (Contract B)" : "修改后版本 (房东/对方增补后版本)"}</span>
                <button
                  onClick={() => setDiffModified("")}
                  className="text-xs text-coconut-400 hover:text-toast-500 font-sans"
                >
                  清空
                </button>
              </div>
              <textarea
                rows={7}
                value={diffModified}
                onChange={(e) => setDiffModified(e.target.value)}
                placeholder="粘贴修改后合同或第二版文本..."
                className="w-full p-3.5 text-xs sm:text-sm bg-white/70 dark:bg-darkbg-subtle/80 border border-coconut-300/80 dark:border-darkbg-border rounded-2xl font-mono leading-relaxed text-coconut-900 dark:text-darkbg-text focus:outline-none focus:border-palm-500 shadow-2xs"
              />
            </div>
          </div>

          {/* 差异可视化高亮输出 */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-sm font-semibold text-coconut-900 dark:text-darkbg-text">
              <span>{lang === "en" ? "Diff Highlight Visualizer" : "差异精准比对视图 (绿色代表新增/红色代表删除)"}</span>
              <span className="text-xs text-coconut-500 dark:text-darkbg-muted font-mono">
                {diffResult.changes.filter((c) => c.added || c.removed).length} 处修改差异
              </span>
            </div>
            <div className="p-4 bg-darkbg-canvas rounded-2xl border border-darkbg-border font-mono text-xs sm:text-sm leading-relaxed max-h-80 overflow-y-auto no-scrollbar">
              {diffResult.changes.map((part, index) => {
                if (diffChangesOnly && !part.added && !part.removed) {
                  const linesCount = (part.value.match(/\n/g) || []).length;
                  if (linesCount > 2) {
                    return (
                      <div key={index} className="py-1 px-3 bg-zinc-800/60 text-zinc-500 rounded my-1 text-center select-none text-[11px]">
                        ··· 此处跳过 {linesCount} 行未变动条款 ···
                      </div>
                    );
                  }
                }
                const color = part.added
                  ? "bg-emerald-950/80 text-emerald-300 border-l-2 border-emerald-500 pl-2 block my-0.5"
                  : part.removed
                  ? "bg-rose-950/80 text-rose-300 border-l-2 border-rose-500 pl-2 line-through opacity-80 block my-0.5"
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
              { id: "rmb", label: lang === "en" ? "RMB Capitalization" : "人民币财务大写", icon: Banknote },
              { id: "stats", label: lang === "en" ? "Word Stats & Clean" : "字数统计与清洗", icon: AlignLeft },
              { id: "idcard", label: lang === "en" ? "ID Card Validator" : "身份证离线校验", icon: ShieldCheck },
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

          {/* 4.1 人民币财务大写转换 */}
          {devTab === "rmb" && (
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm font-semibold text-coconut-900 dark:text-darkbg-text">
                  <span>{lang === "en" ? "Input Amount (Arabian Digits)" : "输入阿拉伯数字金额 (元)"}</span>
                  <div className="flex items-center space-x-1.5">
                    {[
                      { label: "1万", val: "10000" },
                      { label: "12.85万", val: "128500.68" },
                      { label: "100万", val: "1000000" },
                      { label: "1000万", val: "10000000.5" },
                      { label: "888.88", val: "888.88" },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        onClick={() => setRmbInput(preset.val)}
                        className="px-2 py-0.5 rounded-lg bg-coconut-100 dark:bg-darkbg-elevated text-coconut-700 dark:text-darkbg-muted hover:text-coconut-900 text-xs font-mono font-medium transition-colors"
                      >
                        {preset.label}
                      </button>
                    ))}
                    <button
                      onClick={() => setRmbInput("")}
                      className="text-xs text-coconut-400 hover:text-toast-500 font-sans ml-1"
                    >
                      清空
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-coconut-400 font-mono text-base font-bold">
                    ¥
                  </span>
                  <input
                    type="text"
                    value={rmbInput}
                    onChange={(e) => setRmbInput(e.target.value)}
                    placeholder="例如：128500.68"
                    className="w-full pl-8 pr-4 py-3 text-base sm:text-lg bg-white/70 dark:bg-darkbg-subtle/80 border border-coconut-300/80 dark:border-darkbg-border rounded-2xl font-mono font-semibold text-coconut-900 dark:text-darkbg-text focus:outline-none focus:border-palm-500 shadow-2xs"
                  />
                </div>
              </div>

              {/* 转换结果卡片 */}
              <div className="p-5 sm:p-6 rounded-2xl bg-palm-50/70 dark:bg-palm-950/30 border border-palm-200/60 dark:border-palm-900/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-palm-700 dark:text-palm-400">
                      {lang === "en" ? "Official PBOC Financial Standard" : "中国人民银行支付凭证规范大写"}
                    </span>
                    <span className="px-2 py-0.5 text-2xs rounded-full bg-palm-100 dark:bg-palm-900/60 text-palm-800 dark:text-palm-300 font-medium">
                      标准大写
                    </span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(rmbResult.capitalized)}
                    className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-palm-600 hover:bg-palm-700 text-white text-xs font-semibold shadow-2xs active:scale-95 transition-all"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? (lang === "en" ? "Copied" : "已复制") : (lang === "en" ? "Copy Capitalized" : "复制大写")}</span>
                  </button>
                </div>

                <div className="p-4 bg-white/90 dark:bg-darkbg-card rounded-xl border border-palm-200/50 dark:border-darkbg-border font-serif text-lg sm:text-2xl font-bold text-coconut-900 dark:text-darkbg-text select-all tracking-wide break-all">
                  {rmbResult.capitalized || "零元整"}
                </div>

                {rmbResult.error && (
                  <p className="text-xs text-toast-600 dark:text-toast-400 font-mono">
                    ⚠️ {rmbResult.error}
                  </p>
                )}
              </div>

              {/* 规范对照科普与防错指南 */}
              <div className="p-4 rounded-2xl bg-coconut-50 dark:bg-darkbg-subtle/40 border border-coconut-200/60 dark:border-darkbg-border space-y-2 text-xs text-coconut-600 dark:text-darkbg-muted">
                <div className="font-semibold text-coconut-800 dark:text-darkbg-text flex items-center space-x-1.5">
                  <Sparkles className="w-4 h-4 text-palm-500" />
                  <span>银行票据规范速查</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-2xs">
                  <div>0: 零 / 1: 壹 / 2: 贰</div>
                  <div>3: 叁 / 4: 肆 / 5: 伍</div>
                  <div>6: 陆 / 7: 柒 / 8: 捌</div>
                  <div>9: 玖 / 10: 拾 / 百: 佰 / 千: 仟</div>
                </div>
                <p className="text-2xs leading-relaxed text-coconut-500 dark:text-darkbg-muted">
                  * 遵循《正确填写票据和结算凭证的基本规定》：分之后不写“整”；元末尾有角无分可写可不写“整”；元位或整角位为0时严格遵守零字递进规则。
                </p>
              </div>
            </div>
          )}

          {/* 4.2 字数统计与标点排版清洗 */}
          {devTab === "stats" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-coconut-900 dark:text-darkbg-text">
                    {lang === "en" ? "Input or Paste Article / Manuscript" : "输入或粘贴待统计/排版稿件"}
                  </span>
                  <div className="flex items-center space-x-1.5 flex-wrap">
                    <button
                      onClick={() => setStatsText(cleanTextFormatting(statsText, { removeEmptyLines: true }))}
                      className="px-2.5 py-1 rounded-xl bg-coconut-100 dark:bg-darkbg-elevated text-coconut-700 dark:text-darkbg-muted hover:text-coconut-900 text-xs font-semibold"
                      title="清除多余的连续空白行"
                    >
                      清除空行
                    </button>
                    <button
                      onClick={() => setStatsText(cleanTextFormatting(statsText, { trimLines: true }))}
                      className="px-2.5 py-1 rounded-xl bg-coconut-100 dark:bg-darkbg-elevated text-coconut-700 dark:text-darkbg-muted hover:text-coconut-900 text-xs font-semibold"
                      title="清除每行前后的空格"
                    >
                      首尾去空
                    </button>
                    <button
                      onClick={() => setStatsText(cleanTextFormatting(statsText, { panguSpacing: true }))}
                      className="px-2.5 py-1 rounded-xl bg-coconut-100 dark:bg-darkbg-elevated text-coconut-700 dark:text-darkbg-muted hover:text-coconut-900 text-xs font-semibold"
                      title="在中英文、中文数字之间优雅插入盘古空格"
                    >
                      中英文排版空格
                    </button>
                    <button
                      onClick={() =>
                        setStatsText(
                          cleanTextFormatting(statsText, {
                            removeEmptyLines: true,
                            trimLines: true,
                            panguSpacing: true,
                          })
                        )
                      }
                      className="px-3 py-1 rounded-xl bg-palm-600 hover:bg-palm-700 text-white text-xs font-semibold shadow-2xs active:scale-95 transition-all"
                    >
                      一键全自动清洗
                    </button>
                    <button
                      onClick={() => setStatsText("")}
                      className="text-xs text-coconut-400 hover:text-toast-500 font-sans ml-1"
                    >
                      清空
                    </button>
                  </div>
                </div>

                <textarea
                  rows={8}
                  value={statsText}
                  onChange={(e) => setStatsText(e.target.value)}
                  placeholder="在此输入需要统计字数或排版清洗的文本..."
                  className="w-full p-4 text-xs sm:text-sm bg-white/70 dark:bg-darkbg-subtle/80 border border-coconut-300/80 dark:border-darkbg-border rounded-2xl font-mono leading-relaxed text-coconut-900 dark:text-darkbg-text focus:outline-none focus:border-palm-500 shadow-2xs"
                />
              </div>

              {/* 统计指标网格 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-coconut-100/50 dark:bg-darkbg-subtle/60 border border-coconut-200/60 dark:border-darkbg-border">
                  <div className="text-2xs text-coconut-500 dark:text-darkbg-muted">总字符数 (含空格)</div>
                  <div className="text-xl sm:text-2xl font-bold font-mono text-coconut-900 dark:text-darkbg-text mt-1">
                    {statsMetrics.totalChars}
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-coconut-100/50 dark:bg-darkbg-subtle/60 border border-coconut-200/60 dark:border-darkbg-border">
                  <div className="text-2xs text-coconut-500 dark:text-darkbg-muted">有效字符 (不含空格)</div>
                  <div className="text-xl sm:text-2xl font-bold font-mono text-palm-700 dark:text-palm-400 mt-1">
                    {statsMetrics.nonSpaceChars}
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-coconut-100/50 dark:bg-darkbg-subtle/60 border border-coconut-200/60 dark:border-darkbg-border">
                  <div className="text-2xs text-coconut-500 dark:text-darkbg-muted">中文字数 (汉字)</div>
                  <div className="text-xl sm:text-2xl font-bold font-mono text-coconut-900 dark:text-darkbg-text mt-1">
                    {statsMetrics.chineseChars}
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-coconut-100/50 dark:bg-darkbg-subtle/60 border border-coconut-200/60 dark:border-darkbg-border">
                  <div className="text-2xs text-coconut-500 dark:text-darkbg-muted">英文单词数</div>
                  <div className="text-xl sm:text-2xl font-bold font-mono text-coconut-900 dark:text-darkbg-text mt-1">
                    {statsMetrics.englishWords}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-coconut-100/50 dark:bg-darkbg-subtle/60 border border-coconut-200/60 dark:border-darkbg-border">
                  <div className="text-2xs text-coconut-500 dark:text-darkbg-muted">数字个数</div>
                  <div className="text-xl sm:text-2xl font-bold font-mono text-coconut-900 dark:text-darkbg-text mt-1">
                    {statsMetrics.numbers}
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-coconut-100/50 dark:bg-darkbg-subtle/60 border border-coconut-200/60 dark:border-darkbg-border">
                  <div className="text-2xs text-coconut-500 dark:text-darkbg-muted">标点符号</div>
                  <div className="text-xl sm:text-2xl font-bold font-mono text-coconut-900 dark:text-darkbg-text mt-1">
                    {statsMetrics.punctuation}
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-coconut-100/50 dark:bg-darkbg-subtle/60 border border-coconut-200/60 dark:border-darkbg-border">
                  <div className="text-2xs text-coconut-500 dark:text-darkbg-muted">预估朗读时间</div>
                  <div className="text-xl sm:text-2xl font-bold font-mono text-coconut-900 dark:text-darkbg-text mt-1">
                    {statsMetrics.speechMinutes} <span className="text-xs font-normal">分钟</span>
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-coconut-100/50 dark:bg-darkbg-subtle/60 border border-coconut-200/60 dark:border-darkbg-border">
                  <div className="text-2xs text-coconut-500 dark:text-darkbg-muted">预估默读时间</div>
                  <div className="text-xl sm:text-2xl font-bold font-mono text-coconut-900 dark:text-darkbg-text mt-1">
                    {statsMetrics.readingMinutes} <span className="text-xs font-normal">分钟</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center text-xs text-coconut-500 dark:text-darkbg-muted font-mono px-1">
                <span>{statsMetrics.lines} 行 · {statsMetrics.paragraphs} 个段落</span>
                <button
                  onClick={() => copyToClipboard(statsText)}
                  className="flex items-center space-x-1 hover:text-palm-600 transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-palm-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? "已复制清洗后文本" : "复制当前文本"}</span>
                </button>
              </div>
            </div>
          )}

          {/* 4.3 居民身份证离线校验 */}
          {devTab === "idcard" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm font-semibold text-coconut-900 dark:text-darkbg-text">
                  <span>{lang === "en" ? "18-Digit Resident ID Number" : "输入 18 位居民身份证号码"}</span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setIdCardInput("110101199003072379")}
                      className="px-2.5 py-1 rounded-xl bg-coconut-100 dark:bg-darkbg-elevated text-coconut-700 dark:text-darkbg-muted hover:text-coconut-900 text-xs font-semibold"
                    >
                      载入示例号 (北京市)
                    </button>
                    <button
                      onClick={() => setIdCardInput("")}
                      className="text-xs text-coconut-400 hover:text-toast-500 font-sans"
                    >
                      清空
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  maxLength={18}
                  value={idCardInput}
                  onChange={(e) => setIdCardInput(e.target.value.trim().toUpperCase())}
                  placeholder="请输入18位二代居民身份证号码 (末位支持 X)"
                  className="w-full p-3.5 text-base sm:text-lg bg-white/70 dark:bg-darkbg-subtle/80 border border-coconut-300/80 dark:border-darkbg-border rounded-2xl font-mono font-semibold tracking-wider text-coconut-900 dark:text-darkbg-text focus:outline-none focus:border-palm-500 shadow-2xs"
                />
              </div>

              {/* 校验与解析卡片 */}
              <div className="p-5 sm:p-6 rounded-2xl bg-coconut-50/70 dark:bg-darkbg-card border border-coconut-200/60 dark:border-darkbg-border space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center space-x-2">
                    {idCardAnalysis.valid ? (
                      <span className="flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-palm-100 text-palm-800 dark:bg-palm-950/80 dark:text-palm-300 text-xs sm:text-sm font-bold">
                        <CheckCircle2 className="w-4 h-4 text-palm-600 dark:text-palm-400" />
                        <span>校验有效 (符合 GB 11643-1999 国家标准)</span>
                      </span>
                    ) : (
                      <span className="flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-toast-100 text-toast-800 dark:bg-toast-950/80 dark:text-toast-300 text-xs sm:text-sm font-bold">
                        <AlertCircle className="w-4 h-4 text-toast-600 dark:text-toast-400" />
                        <span>{idCardAnalysis.message}</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-1 text-2xs text-coconut-500 dark:text-darkbg-muted">
                    <ShieldCheck className="w-3.5 h-3.5 text-palm-600" />
                    <span>纯浏览器离线计算 · 绝不上云 · 保护隐私</span>
                  </div>
                </div>

                {idCardAnalysis.valid && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                    <div className="p-3.5 rounded-xl bg-white dark:bg-darkbg-subtle/70 border border-coconut-200/40 dark:border-darkbg-border">
                      <div className="text-2xs text-coconut-500 dark:text-darkbg-muted">发证行政省市</div>
                      <div className="text-base font-bold text-coconut-900 dark:text-darkbg-text mt-1">
                        {idCardAnalysis.province || "未知"}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-white dark:bg-darkbg-subtle/70 border border-coconut-200/40 dark:border-darkbg-border">
                      <div className="text-2xs text-coconut-500 dark:text-darkbg-muted">出生日期</div>
                      <div className="text-base font-bold font-mono text-coconut-900 dark:text-darkbg-text mt-1">
                        {idCardAnalysis.birthday || "-"}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-white dark:bg-darkbg-subtle/70 border border-coconut-200/40 dark:border-darkbg-border">
                      <div className="text-2xs text-coconut-500 dark:text-darkbg-muted">法定性别</div>
                      <div className="text-base font-bold text-coconut-900 dark:text-darkbg-text mt-1">
                        {idCardAnalysis.gender || "-"}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-white dark:bg-darkbg-subtle/70 border border-coconut-200/40 dark:border-darkbg-border">
                      <div className="text-2xs text-coconut-500 dark:text-darkbg-muted">当前周岁</div>
                      <div className="text-base font-bold font-mono text-coconut-900 dark:text-darkbg-text mt-1">
                        {idCardAnalysis.age !== undefined ? `${idCardAnalysis.age} 岁` : "-"}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 算法科普 */}
              <div className="p-4 rounded-2xl bg-coconut-100/40 dark:bg-darkbg-subtle/40 border border-coconut-200/60 dark:border-darkbg-border text-2xs text-coconut-500 dark:text-darkbg-muted leading-relaxed space-y-1">
                <div className="font-semibold text-coconut-700 dark:text-darkbg-text">校验原理说明：</div>
                <p>
                  第二代居民身份证遵循国家 GB 11643-1999 标准。前 6 位为行政区划代码，第 7-14 位为公历出生年月日，第 15-17 位为顺序码（其中第 17 位奇数为男，偶数为女），第 18 位为根据 ISO 7064:1983.MOD 11-2 权重（7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2）模 11 计算生成的校验码。
                </p>
              </div>
            </div>
          )}

          {/* 4.4 JSON 格式化与语法校验 */}
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
