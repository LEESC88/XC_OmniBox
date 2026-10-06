"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  UserCheck,
  QrCode,
  GitCompare,
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
  CheckCircle2,
  AlertCircle,
  Eye,
  Loader2,
  Wifi,
  Contact,
  ExternalLink,
  ScanLine,
  ShieldCheck,
  FolderTree,
  CopyCheck,
  FolderOpen,
  FileCheck2,
  Calendar,
  FileX,
  Layers,
} from "lucide-react";
import {
  ID_SPECS,
  BG_COLORS,
  IdPhotoSpec,
  replacePhotoBackground,
  generatePrintSheet,
  generateCustomQrCode,
  computeTextDiff,
  QrDotStyle,
  decodeQrCodeFromImage,
  buildWifiQrString,
  buildVCardQrString,
} from "@/lib/utilityProcessor";
import {
  FileItemMeta,
  OrganizeRuleType,
  OrganizePlanItem,
  DuplicateGroup,
  generateOrganizePlan,
  findDuplicatesFast,
  exportOrganizedZip,
} from "@/lib/organizerProcessor";
import { downloadBlob } from "@/lib/api";
import { formatBytes } from "@/lib/imageProcessor";
import ScrollableTabNav from "@/components/ScrollableTabNav";
import SendToButton from "@/components/SendToButton";
import { useI18n } from "@/lib/i18n";

export type ToolTab = "idphoto" | "organize" | "duplicate" | "qrcode" | "diff";

export interface DailyToolboxProps {
  currentTab?: ToolTab;
  onTabChange?: (tab: ToolTab) => void;
  initialPhotoFile?: File | null;
  onInitialPhotoHandled?: () => void;
  incomingDiffText?: { text: string; side: "original" | "modified" } | null;
  onIncomingDiffHandled?: () => void;
}

export default function DailyToolbox({
  currentTab,
  onTabChange,
  initialPhotoFile,
  onInitialPhotoHandled,
  incomingDiffText,
  onIncomingDiffHandled,
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
      onInitialPhotoHandled?.();
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
  // 3. 文本 Diff 状态 (文章与文本对比)
  // =======================================================
  const ARTICLE_ZH_OLD = `人工智能在现代软件开发中的实践

人工智能技术正在深刻改变现代软件工程的开发模式。过去，工程师需要花费大量时间编写样板代码、排查基础语法错误并手动编写单元测试。

随着大语言模型和智能代码助手的出现，自动化代码补全和实时重构已经成为日常开发的标准配置。据统计，采用智能辅助后，核心模块的交付周期缩短了约 30%，同时开发人员可以将更多精力投入到系统架构设计与业务逻辑的创新上。

然而，过度依赖自动化生成也带来了代码可维护性和安全漏洞的新挑战。团队仍需坚持严格的人工审查与自动化集成测试。`;

  const ARTICLE_ZH_NEW = `人工智能在现代软件开发中的深度实践与未来演进

人工智能与大语言模型正在全方位重构现代软件工程的生命周期。过去，工程师需要耗费数倍时间编写冗余样板代码、排查底层类型错误并手动设计单元测试用例。

随着自主代码智能体（Coding Agents）与深层语义理解工具的普及，自动化代码生成、全库架构重构与端到端测试已成为工业级开发的全新基准。最新行业实践表明，工程交付效率整体提升了 45% 以上，促使软件工程师加速转型为系统架构设计师与产品思考者。

然而，生成式代码也伴随着逻辑幻觉、架构一致性衰减以及供应链安全的新隐患。因此，建立完善的自动化回归校验、代码审计规范与人机协同防御体系，是企业规模化落地的核心前提。`;

  const ARTICLE_EN_OLD = `The Evolution of Modern Software Engineering

Artificial intelligence is rapidly transforming the landscape of modern software engineering. In previous decades, developers dedicated substantial effort to writing repetitive boilerplate code, fixing minor syntax errors, and manually authoring unit tests.

With the advent of intelligent code completion and automated refactoring, developer velocity has increased significantly. Studies indicate that engineering teams deliver features up to 30% faster, freeing engineers to focus on architectural design and business innovation.

Nevertheless, relying solely on automated generation introduces challenges regarding long-term maintainability and potential security vulnerabilities. Rigorous peer review remains essential.`;

  const ARTICLE_EN_NEW = `The Evolution of Modern Software Engineering: From Tools to Autonomous Agents

Artificial intelligence and autonomous agents are fundamentally redefining every phase of the software engineering lifecycle. In previous decades, developers dedicated immense manual effort to writing repetitive boilerplate code, debugging subtle type mismatches, and crafting basic test fixtures.

With the mainstream adoption of autonomous coding agents and deep semantic codebase understanding, full-repository refactoring and self-healing test pipelines have established a new industry standard. Recent empirical reports show delivery velocity improvements exceeding 45%, shifting the engineer's primary role toward architectural governance and strategic product decisions.

Nevertheless, synthetic code introduces critical risks around logical hallucinations, subtle regressions, and software supply chain integrity. Consequently, establishing multi-stage automated verification, strict architectural contracts, and resilient human-in-the-loop oversight is paramount.`;

  const [diffOriginal, setDiffOriginal] = useState(() => lang === "en" ? ARTICLE_EN_OLD : ARTICLE_ZH_OLD);
  const [diffModified, setDiffModified] = useState(() => lang === "en" ? ARTICLE_EN_NEW : ARTICLE_ZH_NEW);
  const [diffMode, setDiffMode] = useState<"lines" | "words">("lines");
  const [diffChangesOnly, setDiffChangesOnly] = useState(false);

  useEffect(() => {
    if (incomingDiffText) {
      setActiveTab("diff");
      if (incomingDiffText.side === "original") {
        setDiffOriginal(incomingDiffText.text);
      } else {
        setDiffModified(incomingDiffText.text);
      }
      onIncomingDiffHandled?.();
    }
  }, [incomingDiffText, onIncomingDiffHandled]);

  const handleLoadArticleExample = () => {
    if (lang === "en") {
      setDiffOriginal(ARTICLE_EN_OLD);
      setDiffModified(ARTICLE_EN_NEW);
    } else {
      setDiffOriginal(ARTICLE_ZH_OLD);
      setDiffModified(ARTICLE_ZH_NEW);
    }
  };

  const diffResult = computeTextDiff(diffOriginal, diffModified, diffMode);

  // =======================================================
  // 4. 目录智能归类大师状态与逻辑
  // =======================================================
  const [organizeFolderPath, setOrganizeFolderPath] = useState<string>("");
  const [organizeFiles, setOrganizeFiles] = useState<FileItemMeta[]>([]);
  const [organizeRule, setOrganizeRule] = useState<OrganizeRuleType>("by-type");
  const [isScanningOrganize, setIsScanningOrganize] = useState<boolean>(false);
  const [isExecutingOrganize, setIsExecutingOrganize] = useState<boolean>(false);
  const [organizeSuccessMsg, setOrganizeSuccessMsg] = useState<string | null>(null);
  const [organizeSearch, setOrganizeSearch] = useState<string>("");
  const organizeFolderInputRef = useRef<HTMLInputElement>(null);

  const organizePlan = React.useMemo(() => {
    return generateOrganizePlan(organizeFiles, organizeRule, organizeFolderPath);
  }, [organizeFiles, organizeRule, organizeFolderPath]);

  const filteredOrganizePlan = React.useMemo(() => {
    if (!organizeSearch.trim()) return organizePlan;
    const q = organizeSearch.toLowerCase();
    return organizePlan.filter(
      (p) =>
        p.fileName.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.targetSubDir.toLowerCase().includes(q)
    );
  }, [organizePlan, organizeSearch]);

  const organizeStats = React.useMemo(() => {
    const totalCount = organizePlan.length;
    const totalBytes = organizePlan.reduce((acc, cur) => acc + cur.size, 0);
    const catSet = new Set(organizePlan.map((p) => p.category));
    return { totalCount, totalBytes, categoryCount: catSet.size };
  }, [organizePlan]);

  const handleSelectOrganizeFolder = async () => {
    setError(null);
    setOrganizeSuccessMsg(null);
    if (typeof window !== "undefined" && (window as any).electronAPI?.selectFolder) {
      const folder = await (window as any).electronAPI.selectFolder();
      if (folder) {
        setOrganizeFolderPath(folder);
        setIsScanningOrganize(true);
        try {
          const res = await (window as any).electronAPI.scanFolder({ folderPath: folder, maxDepth: 4 });
          if (res?.success && res.files) {
            setOrganizeFiles(res.files);
          } else {
            setError(lang === "en" ? "Failed to scan folder" : "扫描目录失败");
          }
        } catch (err: any) {
          setError(err?.message || (lang === "en" ? "Scan failed" : "目录扫描出错"));
        } finally {
          setIsScanningOrganize(false);
        }
      }
    } else {
      organizeFolderInputRef.current?.click();
    }
  };

  const handleOrganizeWebFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fileList = Array.from(files);
    const firstRel = fileList[0]?.webkitRelativePath || "";
    const folderRoot = firstRel ? firstRel.split("/")[0] : "Folder";
    setOrganizeFolderPath(folderRoot);
    const metas: FileItemMeta[] = fileList.map((f) => ({
      path: f.webkitRelativePath || f.name,
      name: f.name,
      size: f.size,
      mtime: f.lastModified,
      ext: "." + (f.name.split(".").pop() || ""),
      fileObj: f,
      relPath: f.webkitRelativePath,
    }));
    setOrganizeFiles(metas);
    setOrganizeSuccessMsg(null);
  };

  const handleExecuteOrganize = async () => {
    if (organizePlan.length === 0) return;
    setIsExecutingOrganize(true);
    setError(null);
    setOrganizeSuccessMsg(null);
    try {
      if (typeof window !== "undefined" && (window as any).electronAPI?.organizeExecute && organizeFolderPath) {
        const tasks = organizePlan.map((p) => ({
          sourcePath: p.sourcePath,
          targetPath: p.targetFullPath || `${organizeFolderPath}/${p.targetRelativePath}`,
        }));
        const res = await (window as any).electronAPI.organizeExecute({ tasks });
        if (res?.success) {
          setOrganizeSuccessMsg(
            lang === "en"
              ? `Successfully organized ${res.count} files into categories!`
              : `已成功整理并归纳 ${res.count} 个文件！`
          );
          const refresh = await (window as any).electronAPI.scanFolder({
            folderPath: organizeFolderPath,
            maxDepth: 4,
          });
          if (refresh?.success) {
            setOrganizeFiles(refresh.files);
          }
        }
      } else {
        const zipBlob = await exportOrganizedZip(organizePlan);
        downloadBlob(zipBlob, `organized_${organizeRule}_${Date.now()}.zip`);
        setOrganizeSuccessMsg(
          lang === "en"
            ? "Successfully generated organized directory ZIP archive!"
            : "已将整理后的目录结构打包下载为 ZIP 压缩包！"
        );
      }
    } catch (err: any) {
      setError(err?.message || (lang === "en" ? "Failed to organize" : "整理执行失败"));
    } finally {
      setIsExecutingOrganize(false);
    }
  };

  // =======================================================
  // 5. 重复文件极速排重状态与逻辑
  // =======================================================
  const [dupFolderPath, setDupFolderPath] = useState<string>("");
  const [dupGroups, setDupGroups] = useState<DuplicateGroup[]>([]);
  const [dupSelectedPaths, setDupSelectedPaths] = useState<Set<string>>(new Set());
  const [isScanningDup, setIsScanningDup] = useState<boolean>(false);
  const [isTrashingDup, setIsTrashingDup] = useState<boolean>(false);
  const [dupProgress, setDupProgress] = useState<{ stage: string; current: number; total: number } | null>(null);
  const [dupSuccessMsg, setDupSuccessMsg] = useState<string | null>(null);
  const dupFolderInputRef = useRef<HTMLInputElement>(null);

  const dupStats = React.useMemo(() => {
    let duplicateFileCount = 0;
    let reclaimableBytes = 0;
    dupGroups.forEach((g) => {
      const duplicates = g.files.slice(1);
      duplicateFileCount += duplicates.length;
      reclaimableBytes += duplicates.reduce((acc, f) => acc + f.size, 0);
    });
    return {
      groupCount: dupGroups.length,
      duplicateFileCount,
      reclaimableBytes,
      selectedCount: dupSelectedPaths.size,
    };
  }, [dupGroups, dupSelectedPaths]);

  const runDuplicateScan = async (files: FileItemMeta[]) => {
    setIsScanningDup(true);
    setDupSuccessMsg(null);
    setError(null);
    setDupGroups([]);
    setDupSelectedPaths(new Set());
    try {
      const groups = await findDuplicatesFast(files, (p) => setDupProgress(p));
      setDupGroups(groups);
      const initialSelected = new Set<string>();
      groups.forEach((g) => {
        g.files.forEach((f) => {
          if (f.isSuggestedDelete) {
            initialSelected.add(f.path);
          }
        });
      });
      setDupSelectedPaths(initialSelected);
    } catch (err: any) {
      setError(err?.message || (lang === "en" ? "Deduplication error" : "查重分析出错"));
    } finally {
      setIsScanningDup(false);
      setDupProgress(null);
    }
  };

  const handleSelectDupFolder = async () => {
    setError(null);
    setDupSuccessMsg(null);
    if (typeof window !== "undefined" && (window as any).electronAPI?.selectFolder) {
      const folder = await (window as any).electronAPI.selectFolder();
      if (folder) {
        setDupFolderPath(folder);
        setIsScanningDup(true);
        setDupProgress({ stage: lang === "en" ? "Scanning folder files..." : "正在扫描目录内文件...", current: 0, total: 100 });
        try {
          const res = await (window as any).electronAPI.scanFolder({ folderPath: folder, maxDepth: 6 });
          if (res?.success && res.files) {
            await runDuplicateScan(res.files);
          } else {
            setError(lang === "en" ? "Failed to scan folder" : "扫描目录失败");
            setIsScanningDup(false);
          }
        } catch (err: any) {
          setError(err?.message || (lang === "en" ? "Scan failed" : "目录扫描出错"));
          setIsScanningDup(false);
        }
      }
    } else {
      dupFolderInputRef.current?.click();
    }
  };

  const handleDupWebFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fileList = Array.from(files);
    const firstRel = fileList[0]?.webkitRelativePath || "";
    const folderRoot = firstRel ? firstRel.split("/")[0] : "Folder";
    setDupFolderPath(folderRoot);
    const metas: FileItemMeta[] = fileList.map((f) => ({
      path: f.webkitRelativePath || f.name,
      name: f.name,
      size: f.size,
      mtime: f.lastModified,
      ext: "." + (f.name.split(".").pop() || ""),
      fileObj: f,
      relPath: f.webkitRelativePath,
    }));
    await runDuplicateScan(metas);
  };

  const toggleSelectDupPath = (path: string) => {
    setDupSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const selectAllSuggestedDups = () => {
    const selected = new Set<string>();
    dupGroups.forEach((g) => {
      g.files.forEach((f) => {
        if (f.isSuggestedDelete) selected.add(f.path);
      });
    });
    setDupSelectedPaths(selected);
  };

  const deselectAllDups = () => {
    setDupSelectedPaths(new Set());
  };

  const handleTrashDuplicates = async () => {
    if (dupSelectedPaths.size === 0) return;
    setIsTrashingDup(true);
    setError(null);
    setDupSuccessMsg(null);
    const targets = Array.from(dupSelectedPaths);

    try {
      if (typeof window !== "undefined" && (window as any).electronAPI?.trashItems) {
        const res = await (window as any).electronAPI.trashItems({ paths: targets });
        if (res?.success) {
          setDupSuccessMsg(
            lang === "en"
              ? `Safely moved ${res.trashedCount} replica files to the Recycle Bin!`
              : `已将 ${res.trashedCount} 个重复副本安全移入系统回收站！`
          );
          const trashedSet = new Set(targets);
          setDupGroups((prevGroups) =>
            prevGroups
              .map((group) => ({
                ...group,
                files: group.files.filter((f) => !trashedSet.has(f.path)),
              }))
              .filter((group) => group.files.length > 1)
          );
          setDupSelectedPaths(new Set());
        }
      } else {
        const trashedSet = new Set(targets);
        setDupGroups((prevGroups) =>
          prevGroups
            .map((group) => ({
              ...group,
              files: group.files.filter((f) => !trashedSet.has(f.path)),
            }))
            .filter((group) => group.files.length > 1)
        );
        setDupSelectedPaths(new Set());
        setDupSuccessMsg(
          lang === "en"
            ? `Removed ${targets.length} duplicates from preview.`
            : `已从预览列表中剔除 ${targets.length} 个重复副本文件。`
        );
      }
    } catch (err: any) {
      setError(err?.message || (lang === "en" ? "Failed to delete files" : "删除文件失败"));
    } finally {
      setIsTrashingDup(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* 5 大功能 Tab 切换 */}
      <ScrollableTabNav
        tabs={[
          {
            id: "idphoto",
            label: lang === "en" ? "ID Photo Studio" : "证件照换底与相纸排版",
            icon: UserCheck,
            badge: lang === "en" ? "6-Inch Print / KB Limit" : "6寸排版/KB限容",
          },
          {
            id: "organize",
            label: lang === "en" ? "Smart Organizer" : "目录智能归类大师",
            icon: FolderTree,
            badge: lang === "en" ? "Dry Run / Rules" : "变更试运行/智能归类",
          },
          {
            id: "duplicate",
            label: lang === "en" ? "Fast Deduplicator" : "重复文件极速排重",
            icon: CopyCheck,
            badge: lang === "en" ? "Tiered Hash / Trash" : "三级哈希/安全回收站",
          },
          {
            id: "qrcode",
            label: lang === "en" ? "Artistic QR Code" : "艺术二维码与扫码识别",
            icon: QrCode,
            badge: lang === "en" ? "WiFi / vCard / Scan" : "WiFi/名片/离线识码",
          },
          {
            id: "diff",
            label: lang === "en" ? "Article & Text Diff" : "文章与文本对比",
            icon: GitCompare,
            badge: lang === "en" ? "Article Diff" : "文章对比/精细高亮",
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
              className="group relative overflow-hidden border-2 border-dashed border-[#D2BCAB]/70 dark:border-[#4D392E]/60 hover:border-amber-500/70 dark:hover:border-amber-500/70 bg-gradient-to-b from-[#FBF8F4]/80 to-[#F5ECE1]/60 dark:from-[#211713]/70 dark:to-[#18110D]/70 hover:from-[#FFFDF9] hover:to-[#FDF4EB] dark:hover:from-[#291D17] dark:hover:to-[#1F1511] rounded-3xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-300 shadow-sm hover:shadow-lg hover:shadow-amber-900/5 select-none"
            >
              <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[radial-gradient(circle_at_50%_40%,rgba(245,158,11,0.08),transparent_65%)]" />
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
              <div className="relative flex flex-col items-center space-y-3.5">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center group-hover:scale-105 group-hover:-translate-y-0.5 transition-all duration-300 shadow-md shadow-orange-500/25">
                  <UploadCloud className="w-7 h-7" />
                </div>
                <div>
                  <div className="text-base font-bold text-coconut-900 dark:text-darkbg-text tracking-tight group-hover:text-amber-800 dark:group-hover:text-amber-300 transition-colors">
                    {lang === "en" ? "Click or drag portrait photo here" : "点击或拖拽上传人像证件照"}
                  </div>
                  <div className="text-xs text-coconut-600 dark:text-darkbg-muted mt-1 max-w-md mx-auto">
                    {lang === "en"
                      ? "Supports white, blue, red or plain color background portraits. Smart replacement and automatic layout"
                      : "支持白底、蓝底、红底或纯色背景自拍照，智能平滑替换底色并自动排版"}
                  </div>
                </div>
                <div className="flex items-center flex-wrap justify-center gap-2 pt-1 text-[11px] font-medium text-coconut-600 dark:text-darkbg-muted">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-coconut-100/70 dark:bg-darkbg-card border border-coconut-200/80 dark:border-darkbg-border">
                    ⚡ 边缘羽化抠图算法
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-semibold">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                    100% 本地沙盒保密
                  </span>
                </div>
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
                      <div className="flex items-center space-x-2">
                        <SendToButton
                          category="image"
                          payload={{
                            blob: processedPhotoBlob,
                            filename: `id_photo_${selectedSpec.width}x${selectedSpec.height}_clean.jpg`,
                            sourceTitle: lang === "en" ? "ID Photo Studio" : "证件照工坊",
                          }}
                          lang={lang}
                        />
                        <button
                          onClick={() => {
                            if (processedPhotoBlob) {
                              downloadBlob(processedPhotoBlob, `id_photo_${selectedSpec.width}x${selectedSpec.height}_clean.jpg`);
                            }
                          }}
                          data-download-result="true"
                          className="flex-1 py-3 btn-3d-sunset text-white rounded-2xl text-sm font-bold flex items-center justify-center space-x-2"
                        >
                          <Download className="w-4 h-4" />
                          <span>{lang === "en" ? "Download Single Photo" : "立即下载单张证件照"}</span>
                        </button>
                      </div>

                      <button
                        onClick={handleGenerateSheet}
                        data-primary-action="true"
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
                          <div className="flex items-center space-x-2">
                            <SendToButton
                              compact
                              category="image"
                              payload={{
                                blob: sheetResult.blob,
                                filename: sheetResult.filename,
                                sourceTitle: lang === "en" ? "Print Sheet" : "相纸排版",
                              }}
                              lang={lang}
                            />
                            <button
                              onClick={() => downloadBlob(sheetResult.blob, sheetResult.filename)}
                              className="flex-1 py-2.5 btn-3d-sunset text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>{lang === "en" ? "Download Print Sheet Image" : "下载 6 寸相纸冲印图"}</span>
                            </button>
                          </div>
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

      {/* ================= 2. 目录智能归类大师 ================= */}
      {activeTab === "organize" && (
        <div className="space-y-6">
          <input
            ref={organizeFolderInputRef}
            type="file"
            multiple
            {...({ webkitdirectory: "", directory: "" } as any)}
            onChange={(e) => handleOrganizeWebFiles(e.target.files)}
            className="hidden"
          />

          {!organizeFolderPath ? (
            <div
              onClick={handleSelectOrganizeFolder}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  handleOrganizeWebFiles(e.dataTransfer.files);
                }
              }}
              className="group relative overflow-hidden border-2 border-dashed border-[#D2BCAB]/70 dark:border-[#4D392E]/60 hover:border-amber-500/70 dark:hover:border-amber-500/70 bg-gradient-to-b from-[#FBF8F4]/80 to-[#F5ECE1]/60 dark:from-[#211713]/70 dark:to-[#18110D]/70 hover:from-[#FFFDF9] hover:to-[#FDF4EB] dark:hover:from-[#291D17] dark:hover:to-[#1F1511] rounded-3xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-300 shadow-sm hover:shadow-lg hover:shadow-amber-900/5 select-none"
            >
              <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[radial-gradient(circle_at_50%_40%,rgba(245,158,11,0.08),transparent_65%)]" />
              <div className="relative flex flex-col items-center space-y-3.5">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 text-white flex items-center justify-center group-hover:scale-105 group-hover:-translate-y-0.5 transition-all duration-300 shadow-md shadow-amber-600/25">
                  <FolderTree className="w-7 h-7" />
                </div>
                <div>
                  <div className="text-base font-bold text-coconut-900 dark:text-darkbg-text tracking-tight group-hover:text-amber-800 dark:group-hover:text-amber-300 transition-colors">
                    {lang === "en" ? "Select or Drop Directory to Organize" : "选择或拖拽需要规整的混乱目录"}
                  </div>
                  <div className="text-xs text-coconut-600 dark:text-darkbg-muted mt-1 max-w-md mx-auto">
                    {lang === "en"
                      ? "Ideal for cluttered Desktop and Downloads. Auto classify into Documents, Images, Media, Archives with safe Dry-Run."
                      : "专为桌面、下载文件夹量身打造，按文档、图片、音视频、压缩包自动分流归档，提供变更试运行预演"}
                  </div>
                </div>
                <div className="flex items-center flex-wrap justify-center gap-2 pt-1 text-[11px] font-medium text-coconut-600 dark:text-darkbg-muted">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-coconut-100/70 dark:bg-darkbg-card border border-coconut-200/80 dark:border-darkbg-border">
                    ⚡ 变更试运行预演 (Dry Run)
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-coconut-100/70 dark:bg-darkbg-card border border-coconut-200/80 dark:border-darkbg-border">
                    🛡️ 重名冲突自动追加序号
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-semibold">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                    100% 本地极速处理
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="coconut-panel p-5 sm:p-6 space-y-6">
              {/* 顶部路径与操作栏 */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-coconut-200/60 dark:border-darkbg-border">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <FolderOpen className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs text-coconut-500 dark:text-darkbg-muted font-medium">
                      {lang === "en" ? "Target Working Directory" : "当前整理目录"}
                    </div>
                    <div className="text-sm font-bold text-coconut-900 dark:text-darkbg-text truncate max-w-sm sm:max-w-md" title={organizeFolderPath}>
                      {organizeFolderPath}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleSelectOrganizeFolder}
                    disabled={isScanningOrganize || isExecutingOrganize}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-coconut-100 hover:bg-coconut-200 dark:bg-darkbg-subtle dark:hover:bg-darkbg-border text-coconut-800 dark:text-darkbg-text transition-colors flex items-center space-x-1.5"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>{lang === "en" ? "Change Folder" : "切换目录"}</span>
                  </button>
                  <button
                    onClick={() => {
                      setOrganizeFolderPath("");
                      setOrganizeFiles([]);
                      setOrganizeSuccessMsg(null);
                    }}
                    className="p-1.5 rounded-xl text-coconut-400 hover:text-red-500 dark:text-darkbg-muted dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                    title={lang === "en" ? "Reset" : "重置"}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* 归类策略切换卡片 */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-coconut-800 dark:text-darkbg-text flex items-center space-x-1.5">
                  <Sliders className="w-3.5 h-3.5 text-amber-500" />
                  <span>{lang === "en" ? "Organization Rule Preset" : "智能归档预设规则"}</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setOrganizeRule("by-type")}
                    className={`p-3.5 rounded-2xl text-left border transition-all ${
                      organizeRule === "by-type"
                        ? "border-amber-500 bg-amber-50/50 dark:bg-amber-950/20 shadow-sm"
                        : "border-coconut-200 dark:border-darkbg-border bg-white dark:bg-darkbg-subtle hover:border-coconut-300 dark:hover:border-darkbg-muted"
                    }`}
                  >
                    <div className="flex items-center space-x-2 text-sm font-bold text-coconut-900 dark:text-darkbg-text">
                      <Layers className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      <span>{lang === "en" ? "By File Format" : "按格式类型归类"}</span>
                    </div>
                    <div className="text-[11px] text-coconut-500 dark:text-darkbg-muted mt-1 leading-relaxed">
                      {lang === "en"
                        ? "Auto sort into Documents, Images, Videos, Archives, Installers, Code"
                        : "按文档、图片、视频、音频、压缩包、安装包与代码自动收纳"}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOrganizeRule("by-date")}
                    className={`p-3.5 rounded-2xl text-left border transition-all ${
                      organizeRule === "by-date"
                        ? "border-amber-500 bg-amber-50/50 dark:bg-amber-950/20 shadow-sm"
                        : "border-coconut-200 dark:border-darkbg-border bg-white dark:bg-darkbg-subtle hover:border-coconut-300 dark:hover:border-darkbg-muted"
                    }`}
                  >
                    <div className="flex items-center space-x-2 text-sm font-bold text-coconut-900 dark:text-darkbg-text">
                      <Calendar className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      <span>{lang === "en" ? "By Modification Date" : "按修改时间归类"}</span>
                    </div>
                    <div className="text-[11px] text-coconut-500 dark:text-darkbg-muted mt-1 leading-relaxed">
                      {lang === "en"
                        ? "Chronologically nest files into 'YYYY/MM' folders by last modified time"
                        : "依据文件最后修改时间，自动按「年份/月份」时间轴建立目录"}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOrganizeRule("clean-empty")}
                    className={`p-3.5 rounded-2xl text-left border transition-all ${
                      organizeRule === "clean-empty"
                        ? "border-amber-500 bg-amber-50/50 dark:bg-amber-950/20 shadow-sm"
                        : "border-coconut-200 dark:border-darkbg-border bg-white dark:bg-darkbg-subtle hover:border-coconut-300 dark:hover:border-darkbg-muted"
                    }`}
                  >
                    <div className="flex items-center space-x-2 text-sm font-bold text-coconut-900 dark:text-darkbg-text">
                      <FileX className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      <span>{lang === "en" ? "Isolate 0KB Files" : "隔离 0KB 空文件"}</span>
                    </div>
                    <div className="text-[11px] text-coconut-500 dark:text-darkbg-muted mt-1 leading-relaxed">
                      {lang === "en"
                        ? "Isolate zero-byte corrupted or blank files into a dedicated directory"
                        : "精准找出大小为 0 字节的无效幽灵文件并收纳到隔离目录"}
                    </div>
                  </button>
                </div>
              </div>

              {/* 统计指标卡 */}
              <div className="grid grid-cols-3 gap-3 p-3.5 rounded-2xl bg-coconut-50/70 dark:bg-darkbg-card border border-coconut-200/60 dark:border-darkbg-border">
                <div className="text-center">
                  <div className="text-[11px] text-coconut-500 dark:text-darkbg-muted font-medium">
                    {lang === "en" ? "Pending Files" : "待处理文件"}
                  </div>
                  <div className="text-base sm:text-lg font-extrabold text-coconut-900 dark:text-darkbg-text mt-0.5">
                    {organizeStats.totalCount}
                  </div>
                </div>
                <div className="text-center border-x border-coconut-200/60 dark:border-darkbg-border">
                  <div className="text-[11px] text-coconut-500 dark:text-darkbg-muted font-medium">
                    {lang === "en" ? "Target Categories" : "生成分类目录"}
                  </div>
                  <div className="text-base sm:text-lg font-extrabold text-amber-600 dark:text-amber-400 mt-0.5">
                    {organizeStats.categoryCount}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-[11px] text-coconut-500 dark:text-darkbg-muted font-medium">
                    {lang === "en" ? "Total Size" : "总涉及容量"}
                  </div>
                  <div className="text-base sm:text-lg font-extrabold text-coconut-900 dark:text-darkbg-text mt-0.5">
                    {formatBytes(organizeStats.totalBytes)}
                  </div>
                </div>
              </div>

              {/* 变更试运行预演表格 (Dry Run Preview) */}
              <div className="space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="text-xs font-bold text-coconut-800 dark:text-darkbg-text flex items-center space-x-1.5">
                    <FileCheck2 className="w-3.5 h-3.5 text-palm-600 dark:text-palm-400" />
                    <span>{lang === "en" ? "Dry Run Preview (Changes Overview)" : "试运行预演清单 (拟移动路径)"}</span>
                    <span className="text-[11px] font-normal text-coconut-500">
                      ({filteredOrganizePlan.length} / {organizePlan.length})
                    </span>
                  </div>
                  <input
                    type="text"
                    value={organizeSearch}
                    onChange={(e) => setOrganizeSearch(e.target.value)}
                    placeholder={lang === "en" ? "Filter by name or category..." : "搜索文件名称或分类..."}
                    className="px-3 py-1 text-xs rounded-xl border border-coconut-200 dark:border-darkbg-border bg-white dark:bg-darkbg-card text-coconut-900 dark:text-darkbg-text placeholder-coconut-400 dark:placeholder-darkbg-muted focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div className="max-h-72 overflow-y-auto rounded-2xl border border-coconut-200/70 dark:border-darkbg-border bg-white dark:bg-darkbg-card divide-y divide-coconut-100 dark:divide-darkbg-border">
                  {filteredOrganizePlan.length === 0 ? (
                    <div className="py-12 text-center text-xs text-coconut-400 dark:text-darkbg-muted">
                      {lang === "en" ? "No matching files for this rule." : "当前规则下没有符合条件的文件"}
                    </div>
                  ) : (
                    filteredOrganizePlan.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 sm:px-4 flex items-center justify-between gap-3 text-xs hover:bg-coconut-50/50 dark:hover:bg-darkbg-subtle/50 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-coconut-900 dark:text-darkbg-text truncate" title={item.fileName}>
                            {item.fileName}
                          </div>
                          <div className="text-[11px] text-coconut-500 dark:text-darkbg-muted flex items-center space-x-2 mt-0.5 truncate">
                            <span className="text-amber-600 dark:text-amber-400 font-medium">➜ {item.targetRelativePath}</span>
                          </div>
                        </div>
                        <div className="shrink-0 flex items-center space-x-2">
                          <span className="px-2 py-0.5 rounded-md bg-coconut-100 dark:bg-darkbg-subtle text-coconut-700 dark:text-darkbg-muted text-[10px] font-medium">
                            {item.category}
                          </span>
                          <span className="text-coconut-400 dark:text-darkbg-muted font-mono text-[11px]">
                            {formatBytes(item.size)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 成功 / 错误提示 */}
              {organizeSuccessMsg && (
                <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300 text-xs flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{organizeSuccessMsg}</span>
                </div>
              )}
              {error && (
                <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 text-red-800 dark:text-red-300 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* 底部执行按钮 */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-[11px] text-coconut-500 dark:text-darkbg-muted flex items-center space-x-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>
                    {typeof window !== "undefined" && (window as any).electronAPI?.organizeExecute
                      ? (lang === "en" ? "Native rename & move: atomic, zero duplication" : "原生目录秒级重命名移动，原子操作无损防丢失")
                      : (lang === "en" ? "Browser mode: exports new folder tree as a ZIP archive" : "浏览器模式：将整理后的目录结构导出为 ZIP 压缩包")}
                  </span>
                </div>

                <button
                  onClick={handleExecuteOrganize}
                  disabled={organizePlan.length === 0 || isExecutingOrganize}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-2xl text-xs sm:text-sm font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-md shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 transition-all"
                >
                  {isExecutingOrganize ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{lang === "en" ? "Organizing..." : "正在规整目录..."}</span>
                    </>
                  ) : (
                    <>
                      <FolderTree className="w-4 h-4" />
                      <span>
                        {typeof window !== "undefined" && (window as any).electronAPI?.organizeExecute
                          ? (lang === "en" ? `Execute Organization (${organizePlan.length} files)` : `确认执行智能归档 (${organizePlan.length} 个文件)`)
                          : (lang === "en" ? `Export Organized ZIP (${organizePlan.length} files)` : `导出规整压缩包 ZIP (${organizePlan.length} 个文件)`)}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= 3. 重复文件极速排重 ================= */}
      {activeTab === "duplicate" && (
        <div className="space-y-6">
          <input
            ref={dupFolderInputRef}
            type="file"
            multiple
            {...({ webkitdirectory: "", directory: "" } as any)}
            onChange={(e) => handleDupWebFiles(e.target.files)}
            className="hidden"
          />

          {!dupFolderPath && dupGroups.length === 0 && !isScanningDup ? (
            <div
              onClick={handleSelectDupFolder}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  handleDupWebFiles(e.dataTransfer.files);
                }
              }}
              className="group relative overflow-hidden border-2 border-dashed border-[#D2BCAB]/70 dark:border-[#4D392E]/60 hover:border-rose-500/70 dark:hover:border-rose-500/70 bg-gradient-to-b from-[#FBF8F4]/80 to-[#F5ECE1]/60 dark:from-[#211713]/70 dark:to-[#18110D]/70 hover:from-[#FFFDF9] hover:to-[#FDF4EB] dark:hover:from-[#291D17] dark:hover:to-[#1F1511] rounded-3xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-300 shadow-sm hover:shadow-lg hover:shadow-rose-900/5 select-none"
            >
              <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[radial-gradient(circle_at_50%_40%,rgba(244,63,94,0.08),transparent_65%)]" />
              <div className="relative flex flex-col items-center space-y-3.5">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 text-white flex items-center justify-center group-hover:scale-105 group-hover:-translate-y-0.5 transition-all duration-300 shadow-md shadow-rose-500/25">
                  <CopyCheck className="w-7 h-7" />
                </div>
                <div>
                  <div className="text-base font-bold text-coconut-900 dark:text-darkbg-text tracking-tight group-hover:text-rose-800 dark:group-hover:text-rose-300 transition-colors">
                    {lang === "en" ? "Select Directory to Scan Duplicates" : "选择需要极速查重的目标目录"}
                  </div>
                  <div className="text-xs text-coconut-600 dark:text-darkbg-muted mt-1 max-w-md mx-auto">
                    {lang === "en"
                      ? "Tiered short-circuit hashing engine. Rapidly scans duplicates and safely moves replicas to Recycle Bin."
                      : "对标 czkawka 三级阶梯哈希引擎，秒级识别相同文件，智能建议清理并安全移入系统回收站"}
                  </div>
                </div>
                <div className="flex items-center flex-wrap justify-center gap-2 pt-1 text-[11px] font-medium text-coconut-600 dark:text-darkbg-muted">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-coconut-100/70 dark:bg-darkbg-card border border-coconut-200/80 dark:border-darkbg-border">
                    ⚡ 三级阶梯短路哈希 (Level 1-3)
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-coconut-100/70 dark:bg-darkbg-card border border-coconut-200/80 dark:border-darkbg-border">
                    🛡️ 原件/副本智能区分标注
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/10 dark:bg-rose-500/15 border border-rose-500/20 text-rose-700 dark:text-rose-400 font-semibold">
                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                    系统回收站防误删保障
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="coconut-panel p-5 sm:p-6 space-y-6">
              {/* 顶部路径与操作栏 */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-coconut-200/60 dark:border-darkbg-border">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                    <FolderOpen className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs text-coconut-500 dark:text-darkbg-muted font-medium">
                      {lang === "en" ? "Scanned Directory" : "查重扫描目录"}
                    </div>
                    <div className="text-sm font-bold text-coconut-900 dark:text-darkbg-text truncate max-w-sm sm:max-w-md" title={dupFolderPath}>
                      {dupFolderPath}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleSelectDupFolder}
                    disabled={isScanningDup || isTrashingDup}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-coconut-100 hover:bg-coconut-200 dark:bg-darkbg-subtle dark:hover:bg-darkbg-border text-coconut-800 dark:text-darkbg-text transition-colors flex items-center space-x-1.5"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>{lang === "en" ? "Rescan Folder" : "重新扫描目录"}</span>
                  </button>
                  <button
                    onClick={() => {
                      setDupFolderPath("");
                      setDupGroups([]);
                      setDupSelectedPaths(new Set());
                      setDupSuccessMsg(null);
                    }}
                    className="p-1.5 rounded-xl text-coconut-400 hover:text-red-500 dark:text-darkbg-muted dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                    title={lang === "en" ? "Reset" : "重置"}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* 扫描进行中状态展示 */}
              {isScanningDup && (
                <div className="p-6 rounded-2xl bg-coconut-50/70 dark:bg-darkbg-card border border-coconut-200/60 dark:border-darkbg-border text-center space-y-3">
                  <Loader2 className="w-8 h-8 text-rose-500 animate-spin mx-auto" />
                  <div className="text-sm font-bold text-coconut-900 dark:text-darkbg-text">
                    {dupProgress?.stage || (lang === "en" ? "Scanning duplicates..." : "正在进行三级哈希比对...")}
                  </div>
                  {dupProgress && dupProgress.total > 0 && (
                    <div className="max-w-xs mx-auto space-y-1">
                      <div className="w-full bg-coconut-200 dark:bg-darkbg-border h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-rose-500 h-full transition-all duration-200"
                          style={{ width: `${Math.round((dupProgress.current / dupProgress.total) * 100)}%` }}
                        />
                      </div>
                      <div className="text-[11px] text-coconut-500 dark:text-darkbg-muted font-mono">
                        {dupProgress.current} / {dupProgress.total}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 查重结果展示 */}
              {!isScanningDup && (
                <>
                  {dupGroups.length === 0 ? (
                    <div className="py-12 text-center space-y-2">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <div className="text-sm font-bold text-coconut-900 dark:text-darkbg-text">
                        {lang === "en" ? "No duplicate files found!" : "太棒了！未发现任何重复文件"}
                      </div>
                      <div className="text-xs text-coconut-500 dark:text-darkbg-muted">
                        {lang === "en" ? "The directory is clean and well-organized." : "该目录下所有文件内容均互不相同，目录健康整洁"}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* 指标卡 */}
                      <div className="grid grid-cols-3 gap-3 p-3.5 rounded-2xl bg-coconut-50/70 dark:bg-darkbg-card border border-coconut-200/60 dark:border-darkbg-border">
                        <div className="text-center">
                          <div className="text-[11px] text-coconut-500 dark:text-darkbg-muted font-medium">
                            {lang === "en" ? "Duplicate Groups" : "重复文件簇"}
                          </div>
                          <div className="text-base sm:text-lg font-extrabold text-coconut-900 dark:text-darkbg-text mt-0.5">
                            {dupStats.groupCount}
                          </div>
                        </div>
                        <div className="text-center border-x border-coconut-200/60 dark:border-darkbg-border">
                          <div className="text-[11px] text-coconut-500 dark:text-darkbg-muted font-medium">
                            {lang === "en" ? "Replicas Found" : "可清理副本"}
                          </div>
                          <div className="text-base sm:text-lg font-extrabold text-rose-600 dark:text-rose-400 mt-0.5">
                            {dupStats.duplicateFileCount}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-[11px] text-coconut-500 dark:text-darkbg-muted font-medium">
                            {lang === "en" ? "Reclaimable Space" : "预计释放空间"}
                          </div>
                          <div className="text-base sm:text-lg font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
                            {formatBytes(dupStats.reclaimableBytes)}
                          </div>
                        </div>
                      </div>

                      {/* 快捷批量选择条 */}
                      <div className="flex items-center justify-between gap-2 px-1">
                        <div className="text-xs text-coconut-600 dark:text-darkbg-muted flex items-center space-x-2">
                          <span>{lang === "en" ? "Selection:" : "当前勾选:"}</span>
                          <span className="font-bold text-rose-600 dark:text-rose-400">
                            {dupStats.selectedCount} {lang === "en" ? "files" : "个副本"}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={selectAllSuggestedDups}
                            className="text-xs text-palm-600 dark:text-palm-400 hover:underline font-medium"
                          >
                            {lang === "en" ? "Select All Suggested" : "全选建议清理项"}
                          </button>
                          <span className="text-coconut-300 dark:text-darkbg-border">|</span>
                          <button
                            type="button"
                            onClick={deselectAllDups}
                            className="text-xs text-coconut-500 dark:text-darkbg-muted hover:underline font-medium"
                          >
                            {lang === "en" ? "Deselect All" : "取消全选"}
                          </button>
                        </div>
                      </div>

                      {/* 重复文件列表 */}
                      <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                        {dupGroups.map((group, groupIdx) => (
                          <div
                            key={group.id}
                            className="rounded-2xl border border-coconut-200/80 dark:border-darkbg-border bg-white dark:bg-darkbg-card overflow-hidden"
                          >
                            <div className="px-3.5 py-2 bg-coconut-50/80 dark:bg-darkbg-subtle/60 border-b border-coconut-100 dark:border-darkbg-border flex items-center justify-between text-xs">
                              <div className="flex items-center space-x-2 font-medium text-coconut-700 dark:text-darkbg-text">
                                <span className="font-bold text-rose-600 dark:text-rose-400">#{groupIdx + 1}</span>
                                <span>{lang === "en" ? "Cluster" : "重复组"}</span>
                                <span className="text-coconut-400">·</span>
                                <span className="font-mono text-coconut-500">{formatBytes(group.size)} /份</span>
                              </div>
                              <span className="text-[11px] text-coconut-400 font-mono">
                                MD5: {group.hash.slice(0, 10)}...
                              </span>
                            </div>

                            <div className="divide-y divide-coconut-100 dark:divide-darkbg-border">
                              {group.files.map((file, fIdx) => {
                                const isOriginal = fIdx === 0;
                                const isChecked = dupSelectedPaths.has(file.path);

                                return (
                                  <div
                                    key={file.path || fIdx}
                                    className={`p-3 flex items-center justify-between gap-3 text-xs transition-colors ${
                                      isOriginal
                                        ? "bg-emerald-50/20 dark:bg-emerald-950/10"
                                        : isChecked
                                        ? "bg-rose-50/30 dark:bg-rose-950/20"
                                        : ""
                                    }`}
                                  >
                                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                                      {!isOriginal ? (
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => toggleSelectDupPath(file.path)}
                                          className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 dark:bg-darkbg-card border-coconut-300 dark:border-darkbg-border cursor-pointer shrink-0"
                                        />
                                      ) : (
                                        <div className="w-4 h-4 flex items-center justify-center shrink-0">
                                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                                        </div>
                                      )}
                                      <div className="min-w-0 flex-1">
                                        <div className="font-semibold text-coconut-900 dark:text-darkbg-text truncate" title={file.name}>
                                          {file.name}
                                        </div>
                                        <div className="text-[11px] text-coconut-500 dark:text-darkbg-muted truncate mt-0.5" title={file.path}>
                                          {file.path}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="shrink-0 flex items-center space-x-2">
                                      {isOriginal ? (
                                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                                          {lang === "en" ? "Keep Original" : "保留原件"}
                                        </span>
                                      ) : (
                                        <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-[10px] font-bold">
                                          {lang === "en" ? "Replica" : "冗余副本"}
                                        </span>
                                      )}
                                      <span className="text-[11px] text-coconut-400 font-mono hidden sm:inline">
                                        {new Date(file.mtime).toLocaleDateString()}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* 成功 / 错误提示 */}
                      {dupSuccessMsg && (
                        <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300 text-xs flex items-center space-x-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>{dupSuccessMsg}</span>
                        </div>
                      )}
                      {error && (
                        <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 text-red-800 dark:text-red-300 text-xs flex items-center space-x-2">
                          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                          <span>{error}</span>
                        </div>
                      )}

                      {/* 底部执行按钮 */}
                      <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div className="text-[11px] text-coconut-500 dark:text-darkbg-muted flex items-center space-x-1.5">
                          <Trash2 className="w-4 h-4 text-rose-500 shrink-0" />
                          <span>
                            {lang === "en"
                              ? "Safely moved to OS Recycle Bin. Can be restored at any time if needed."
                              : "移入系统回收站而非永久物理抹除，支持随时打开回收站原路还原"}
                          </span>
                        </div>

                        <button
                          onClick={handleTrashDuplicates}
                          disabled={dupSelectedPaths.size === 0 || isTrashingDup}
                          className="w-full sm:w-auto px-6 py-2.5 rounded-2xl text-xs sm:text-sm font-bold bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white shadow-md shadow-rose-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 transition-all"
                        >
                          {isTrashingDup ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>{lang === "en" ? "Moving to Trash..." : "正在移入回收站..."}</span>
                            </>
                          ) : (
                            <>
                              <Trash2 className="w-4 h-4" />
                              <span>
                                {lang === "en"
                                  ? `Safely Move ${dupSelectedPaths.size} Replicas to Recycle Bin`
                                  : `安全移入回收站 (已选 ${dupSelectedPaths.size} 个副本)`}
                              </span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ================= 4. 个性化二维码与扫码识别面板 ================= */}
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
                      ? lang === "en" ? "By Lines (Paragraphs)" : "按行对比 (段落推荐)"
                      : lang === "en" ? "By Words (Fine Highlight)" : "按词精细高亮"}
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
                className="flex items-center space-x-1 text-coconut-600 hover:text-palm-600 dark:text-darkbg-muted dark:hover:text-palm-400 transition-colors font-semibold cursor-pointer"
              >
                <ArrowRightLeft className="w-4 h-4" />
                <span>{lang === "en" ? "Swap" : "左右互换"}</span>
              </button>
              <button
                onClick={handleLoadArticleExample}
                className="px-2.5 py-1 rounded-xl bg-coconut-100 dark:bg-darkbg-elevated text-coconut-700 dark:text-darkbg-muted hover:text-coconut-900 text-xs font-semibold cursor-pointer"
              >
                {lang === "en" ? "Load Article Example" : "载入文章对比示例"}
              </button>
            </div>
          </div>

          {/* 输入框双栏 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-sm font-semibold text-coconut-900 dark:text-darkbg-text font-mono">
                <span>{lang === "en" ? "Original Version (Draft A)" : "原始版本 (文章初稿 / 初版)"}</span>
                <button
                  onClick={() => setDiffOriginal("")}
                  className="text-xs text-coconut-400 hover:text-toast-500 font-sans cursor-pointer"
                >
                  {lang === "en" ? "Clear" : "清空"}
                </button>
              </div>
              <textarea
                rows={7}
                value={diffOriginal}
                onChange={(e) => setDiffOriginal(e.target.value)}
                placeholder={lang === "en" ? "Paste original article or draft..." : "粘贴原始文章或初稿文本..."}
                className="w-full p-3.5 text-xs sm:text-sm bg-white/70 dark:bg-darkbg-subtle/80 border border-coconut-300/80 dark:border-darkbg-border rounded-2xl font-mono leading-relaxed text-coconut-900 dark:text-darkbg-text focus:outline-none focus:border-palm-500 shadow-2xs"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-sm font-semibold text-coconut-900 dark:text-darkbg-text font-mono">
                <span>{lang === "en" ? "Revised Version (Draft B)" : "修改后版本 (文章修订稿 / 终稿)"}</span>
                <button
                  onClick={() => setDiffModified("")}
                  className="text-xs text-coconut-400 hover:text-toast-500 font-sans cursor-pointer"
                >
                  {lang === "en" ? "Clear" : "清空"}
                </button>
              </div>
              <textarea
                rows={7}
                value={diffModified}
                onChange={(e) => setDiffModified(e.target.value)}
                placeholder={lang === "en" ? "Paste revised article or draft..." : "粘贴修改后文章或修订版文本..."}
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
