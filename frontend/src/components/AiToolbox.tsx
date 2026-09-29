"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  UploadCloud,
  Download,
  Copy,
  Check,
  Trash2,
  Sliders,
  FileText,
  Layers,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Eye,
  Palette,
  Maximize2,
  ArrowRight,
  SplitSquareHorizontal,
  FileCheck,
  Zap,
  UserCheck,
  SlidersHorizontal,
  Eraser,
  FileSearch,
  Captions,
  Undo2,
  Play,
  Pause,
  Volume2,
  Plus,
  RotateCcw,
} from "lucide-react";
import {
  removeBackgroundAI,
  recognizeTextOCR,
  enhanceAndUpscaleImage,
  generateSearchablePdf,
  analyzeMediaSpeechSegments,
  exportToSrt,
  exportToVtt,
  formatSrtTimestamp,
  SubtitleItem,
  OCR_LANGUAGES,
  OcrResult,
  BgRemovalEngine,
  EnhanceResult,
} from "@/lib/aiProcessor";
import { downloadBlob, inpaintImage } from "@/lib/api";
import { formatBytes } from "@/lib/imageProcessor";
import ScrollableTabNav from "@/components/ScrollableTabNav";
import { useI18n } from "@/lib/i18n";
import ImageCompareModal, { ImageCompareItem } from "@/components/ImageCompareModal";
import SendToButton from "@/components/SendToButton";

export type AiTabType = "ai-bg-remove" | "ai-inpaint" | "ai-searchable-pdf" | "ai-subtitle" | "ai-ocr" | "ai-upscale";

export interface AiToolboxProps {
  currentTab?: AiTabType;
  onTabChange?: (tab: AiTabType) => void;
  onNavigateToIdPhoto?: (photoFile: File) => void;
  incomingFile?: File | null;
  onIncomingFileHandled?: () => void;
}

const BG_PRESETS = [
  { label: "透明底", labelEn: "Transparent", value: "transparent", color: "transparent" },
  { label: "纯白底", labelEn: "White", value: "#ffffff", color: "#ffffff" },
  { label: "证件蓝", labelEn: "ID Blue", value: "#438EDB", color: "#438EDB" },
  { label: "证件红", labelEn: "ID Red", value: "#D9001B", color: "#D9001B" },
  { label: "极简灰", labelEn: "Light Gray", value: "#E2E8F0", color: "#E2E8F0" },
  { label: "深邃黑", labelEn: "Dark Slate", value: "#1E293B", color: "#1E293B" },
];

export default function AiToolbox({
  currentTab = "ai-bg-remove",
  onTabChange,
  onNavigateToIdPhoto,
  incomingFile,
  onIncomingFileHandled,
}: AiToolboxProps) {
  const { lang } = useI18n();
  const [activeTab, setActiveTab] = useState<AiTabType>(currentTab);
  const [compareModalItem, setCompareModalItem] = useState<ImageCompareItem | null>(null);


  const localizeAiStage = (stage: string) => {
    if (lang !== "en" || !stage) return stage;
    if (stage.includes("准备模型")) return "Preparing model...";
    if (stage.includes("抠图完成")) return "Cutout complete!";
    if (stage.includes("发丝边缘") || stage.includes("逐像素计算")) return "Neural network computing pixel edges...";
    if (stage.includes("神经网络") || stage.includes("分割") || stage.includes("分割中")) return "Segmenting image with AI neural network...";
    if (stage.includes("启动备用") || stage.includes("色度")) return "Running chroma edge algorithm...";
    if (stage.includes("合成高质量") || stage.includes("透明通道")) return "Compositing transparent layer...";
    if (stage.includes("启动 OCR") || stage.includes("WebAssembly")) return "Initializing OCR engine...";
    if (stage.includes("OCR 离线核心") || stage.includes("载入 OCR")) return "Loading OCR offline engine...";
    if (stage.includes("字库字典") || stage.includes("语言字库")) return "Loading language dictionary...";
    if (stage.includes("光学识别") || stage.includes("分析文字") || stage.includes("排版")) return "AI analyzing text lines and layout...";
    if (stage.includes("深度扫描")) return "Scanning image features...";
    if (stage.includes("识别完成")) return "Recognition complete!";
    if (stage.includes("初始化超清")) return "Initializing upscale enhancement...";
    if (stage.includes("像素拓扑")) return "Computing pixel topology...";
    if (stage.includes("超分辨率重采样") || stage.includes("双三次") || stage.includes("重采样")) return "Executing super-resolution resampling...";
    if (stage.includes("锐化") || stage.includes("高频")) return "Extracting edge features and adaptive sharpening...";
    if (stage.includes("色彩增强")) return "Executing color enhancement...";
    if (stage.includes("生成超清") || stage.includes("修复完成") || stage.includes("修复增强完成")) return "Enhancement complete!";
    if (stage.includes("消除") || stage.includes("修补") || stage.includes("杂物") || stage.includes("去水印")) return "Inpainting objects & blemishes...";
    if (stage.includes("字形拓扑") || stage.includes("双层") || stage.includes("可搜索 PDF")) return "Generating dual-layer searchable PDF...";
    if (stage.includes("音频流") || stage.includes("PCM") || stage.includes("解密")) return "Decoding audio PCM stream...";
    if (stage.includes("能量包络") || stage.includes("VAD") || stage.includes("断句")) return "Computing acoustic energy envelope (VAD)...";
    if (stage.includes("字幕轴") || stage.includes("时间轴")) return "Generating millisecond subtitle timestamps...";
    if (stage.includes("处理中") || stage.includes("正在")) return "Processing...";
    return stage;
  };

  useEffect(() => {
    if (currentTab && currentTab !== activeTab) {
      setActiveTab(currentTab);
    }
  }, [currentTab]);

  const handleTabChange = (tab: AiTabType) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  // =========================================================================
  // 1. AI 智能抠图状态
  // =========================================================================
  const [bgFile, setBgFile] = useState<File | null>(null);
  const [bgPreviewUrl, setBgPreviewUrl] = useState<string | null>(null);
  const [bgResultBlob, setBgResultBlob] = useState<Blob | null>(null);
  const [bgResultUrl, setBgResultUrl] = useState<string | null>(null);
  const [bgEngine, setBgEngine] = useState<BgRemovalEngine>("ai");
  const [selectedBgColor, setSelectedBgColor] = useState<string>("transparent");
  const [bgLoading, setBgLoading] = useState(false);
  const [bgProgress, setBgProgress] = useState(0);
  const [bgStage, setBgStage] = useState("");
  const [bgError, setBgError] = useState<string | null>(null);
  const [bgCompareSlider, setBgCompareSlider] = useState(50); // 0 ~ 100

  const handleBgFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBgFile(file);
    setBgPreviewUrl(URL.createObjectURL(file));
    setBgResultBlob(null);
    setBgResultUrl(null);
    setBgError(null);
    setBgProgress(0);
  };

  const handleExecuteBgRemoval = async () => {
    if (!bgFile) return;
    setBgLoading(true);
    setBgError(null);
    setBgProgress(5);
    setBgStage(lang === "en" ? "Preparing model..." : "正在准备模型...");

    try {
      const blob = await removeBackgroundAI(bgFile, {
        engine: bgEngine,
        backgroundColor: selectedBgColor === "transparent" ? null : selectedBgColor,
        onProgress: (pct, stage) => {
          setBgProgress(pct);
          setBgStage(stage);
        },
      });

      setBgResultBlob(blob);
      setBgResultUrl(URL.createObjectURL(blob));
      setBgProgress(100);
      setBgStage(lang === "en" ? "Cutout complete!" : "抠图完成！");
    } catch (err: any) {
      setBgError(
        err.message ||
          (lang === "en"
            ? "AI cutout failed, please retry or try switching to Rapid Chroma Algorithm mode"
            : "智能抠图失败，请重试或尝试切换为快速算法模式")
      );
    } finally {
      setBgLoading(false);
    }
  };

  // 更改背景底色后重新合成
  const handleChangeBgColor = async (color: string) => {
    setSelectedBgColor(color);
    if (!bgResultBlob && !bgFile) return;
    // 如果已经抠好了透明图，实时在画布上合成或重新渲染
    if (bgResultBlob && color !== "transparent") {
      try {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext("2d")!;
          ctx.fillStyle = color;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          canvas.toBlob((b) => {
            if (b) {
              setBgResultUrl(URL.createObjectURL(b));
            }
          }, "image/png");
        };
        img.src = URL.createObjectURL(bgResultBlob);
      } catch (e) {
        console.error(e);
      }
    } else if (bgResultBlob && color === "transparent") {
      setBgResultUrl(URL.createObjectURL(bgResultBlob));
    }
  };

  const handleDownloadBgResult = () => {
    if (!bgResultUrl) return;
    const a = document.createElement("a");
    a.href = bgResultUrl;
    a.download = `XC_AI_Matting_${Date.now()}.png`;
    a.click();
  };

  const handleSendToIdPhoto = () => {
    if (!bgResultBlob && !bgFile) return;
    const blobToUse = bgResultBlob || bgFile;
    if (!blobToUse) return;
    const photoFile = new File([blobToUse], "ai_matting_portrait.png", { type: "image/png" });
    if (onNavigateToIdPhoto) {
      onNavigateToIdPhoto(photoFile);
    }
  };

  // =========================================================================
  // 2. AI 离线 OCR 文字识别状态
  // =========================================================================
  const [ocrFile, setOcrFile] = useState<File | null>(null);
  const [ocrPreviewUrl, setOcrPreviewUrl] = useState<string | null>(null);
  const [ocrLang, setOcrLang] = useState<string>("chi_sim+eng");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStage, setOcrStage] = useState("");
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [ocrEditableText, setOcrEditableText] = useState("");
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrCopied, setOcrCopied] = useState(false);

  const handleOcrFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setOcrFile(file);
    setOcrPreviewUrl(URL.createObjectURL(file));
    setOcrResult(null);
    setOcrEditableText("");
    setOcrError(null);
    setOcrProgress(0);
  };

  const handleExecuteOcr = async () => {
    if (!ocrFile) return;
    setOcrLoading(true);
    setOcrError(null);
    setOcrProgress(5);
    setOcrStage(lang === "en" ? "Starting offline OCR recognition..." : "启动 OCR 离线识别...");

    try {
      const result = await recognizeTextOCR(ocrFile, ocrLang, (pct, stage) => {
        setOcrProgress(pct);
        setOcrStage(stage);
      });

      setOcrResult(result);
      setOcrEditableText(result.text);
      setOcrProgress(100);
      setOcrStage(lang === "en" ? "Recognition complete!" : "识别完成！");
    } catch (err: any) {
      setOcrError(
        err.message ||
          (lang === "en"
            ? "OCR recognition error, please try using a clearer image"
            : "OCR 识别异常，请尝试换用更清晰的图片")
      );
    } finally {
      setOcrLoading(false);
    }
  };

  const handleCopyOcrText = () => {
    if (!ocrEditableText) return;
    navigator.clipboard.writeText(ocrEditableText);
    setOcrCopied(true);
    setTimeout(() => setOcrCopied(false), 2000);
  };

  const handleDownloadOcrTxt = () => {
    if (!ocrEditableText) return;
    const blob = new Blob([ocrEditableText], { type: "text/plain;charset=utf-8" });
    downloadBlob(blob, `XC_OCR_${Date.now()}.txt`);
  };

  // =========================================================================
  // 3. AI 模糊图片高清修复与超分辨率状态
  // =========================================================================
  const [upscaleFile, setUpscaleFile] = useState<File | null>(null);
  const [upscalePreviewUrl, setUpscalePreviewUrl] = useState<string | null>(null);
  const [upscaleScale, setUpscaleScale] = useState<1 | 2 | 4>(2);
  const [upscaleSharpness, setUpscaleSharpness] = useState<number>(1.2);
  const [upscaleDenoise, setUpscaleDenoise] = useState<boolean>(true);
  const [upscaleContrast, setUpscaleContrast] = useState<boolean>(true);
  const [upscaleLoading, setUpscaleLoading] = useState(false);
  const [upscaleProgress, setUpscaleProgress] = useState(0);
  const [upscaleStage, setUpscaleStage] = useState("");
  const [upscaleResult, setUpscaleResult] = useState<EnhanceResult | null>(null);
  const [upscaleResultUrl, setUpscaleResultUrl] = useState<string | null>(null);
  const [upscaleError, setUpscaleError] = useState<string | null>(null);
  const [upscaleSlider, setUpscaleSlider] = useState(50);

  const handleUpscaleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUpscaleFile(file);
    setUpscalePreviewUrl(URL.createObjectURL(file));
    setUpscaleResult(null);
    setUpscaleResultUrl(null);
    setUpscaleError(null);
    setUpscaleProgress(0);
  };

  const handleExecuteUpscale = async () => {
    if (!upscaleFile) return;
    setUpscaleLoading(true);
    setUpscaleError(null);
    setUpscaleProgress(5);
    setUpscaleStage(
      lang === "en" ? "Initializing ultra-clear enhancement algorithm..." : "初始化超清增强算法..."
    );

    try {
      const res = await enhanceAndUpscaleImage(upscaleFile, {
        scale: upscaleScale,
        sharpness: upscaleSharpness,
        denoise: upscaleDenoise,
        enhanceContrast: upscaleContrast,
        onProgress: (pct, stage) => {
          setUpscaleProgress(pct);
          setUpscaleStage(stage);
        },
      });

      setUpscaleResult(res);
      setUpscaleResultUrl(URL.createObjectURL(res.blob));
      setUpscaleProgress(100);
      setUpscaleStage(lang === "en" ? "Enhancement complete!" : "修复增强完成！");
    } catch (err: any) {
      setUpscaleError(
        err.message ||
          (lang === "en" ? "Super-resolution enhancement failed, please retry" : "超分辨率修复失败，请重试")
      );
    } finally {
      setUpscaleLoading(false);
    }
  };

  const handleDownloadUpscaleResult = () => {
    if (!upscaleResult) return;
    downloadBlob(upscaleResult.blob, `XC_UltraClear_${upscaleResult.scaleFactor}x_${Date.now()}.png`);
  };

  // =========================================================================
  // 4. AI 消除笔 / 智能去水印 / 杂物擦除 (参考 IOPaint C++ Telea/Navier-Stokes)
  // =========================================================================
  const [inpaintFile, setInpaintFile] = useState<File | null>(null);
  const [inpaintPreviewUrl, setInpaintPreviewUrl] = useState<string | null>(null);
  const [inpaintResultBlob, setInpaintResultBlob] = useState<Blob | null>(null);
  const [inpaintResultUrl, setInpaintResultUrl] = useState<string | null>(null);
  const [brushSize, setBrushSize] = useState<number>(28);
  const [inpaintMethod, setInpaintMethod] = useState<"telea" | "ns">("telea");
  const [inpaintRadius, setInpaintRadius] = useState<number>(4);
  const [inpaintLoading, setInpaintLoading] = useState(false);
  const [inpaintProgress, setInpaintProgress] = useState(0);
  const [inpaintStage, setInpaintStage] = useState("");
  const [inpaintError, setInpaintError] = useState<string | null>(null);
  const [inpaintCompareSlider, setInpaintCompareSlider] = useState(50);
  const [maskUndoAvailable, setMaskUndoAvailable] = useState(false);
  const [hasDrawnMask, setHasDrawnMask] = useState(false);

  const inpaintImageCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const inpaintMaskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const inpaintMaskHistory = useRef<ImageData[]>([]);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  const handleInpaintFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setInpaintFile(file);
    setInpaintPreviewUrl(URL.createObjectURL(file));
    setInpaintResultBlob(null);
    setInpaintResultUrl(null);
    setInpaintError(null);
    setInpaintProgress(0);
    setHasDrawnMask(false);
    setMaskUndoAvailable(false);
    inpaintMaskHistory.current = [];
  };

  useEffect(() => {
    if (!inpaintPreviewUrl) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const imgCanvas = inpaintImageCanvasRef.current;
      const maskCanvas = inpaintMaskCanvasRef.current;
      if (!imgCanvas || !maskCanvas) return;
      imgCanvas.width = img.naturalWidth;
      imgCanvas.height = img.naturalHeight;
      maskCanvas.width = img.naturalWidth;
      maskCanvas.height = img.naturalHeight;

      const imgCtx = imgCanvas.getContext("2d");
      if (imgCtx) {
        imgCtx.drawImage(img, 0, 0);
      }
      const maskCtx = maskCanvas.getContext("2d");
      if (maskCtx) {
        maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
      }
      inpaintMaskHistory.current = [];
      setMaskUndoAvailable(false);
      setHasDrawnMask(false);
    };
    img.src = inpaintPreviewUrl;
  }, [inpaintPreviewUrl]);

  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = inpaintMaskCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startInpaintDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const maskCanvas = inpaintMaskCanvasRef.current;
    if (!maskCanvas) return;
    const maskCtx = maskCanvas.getContext("2d");
    if (!maskCtx) return;

    const currentState = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    if (inpaintMaskHistory.current.length >= 10) {
      inpaintMaskHistory.current.shift();
    }
    inpaintMaskHistory.current.push(currentState);
    setMaskUndoAvailable(true);

    isDrawingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const pt = getCanvasCoords(e);
    lastPointRef.current = pt;

    const rect = maskCanvas.getBoundingClientRect();
    const scale = maskCanvas.width / rect.width;
    const actualBrush = brushSize * scale;

    maskCtx.beginPath();
    maskCtx.arc(pt.x, pt.y, actualBrush / 2, 0, Math.PI * 2);
    maskCtx.fillStyle = "rgba(239, 68, 68, 0.72)";
    maskCtx.fill();
    setHasDrawnMask(true);
  };

  const drawInpaint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const maskCanvas = inpaintMaskCanvasRef.current;
    if (!maskCanvas) return;
    const maskCtx = maskCanvas.getContext("2d");
    if (!maskCtx || !lastPointRef.current) return;

    const pt = getCanvasCoords(e);
    const rect = maskCanvas.getBoundingClientRect();
    const scale = maskCanvas.width / rect.width;
    const actualBrush = brushSize * scale;

    maskCtx.lineWidth = actualBrush;
    maskCtx.lineCap = "round";
    maskCtx.lineJoin = "round";
    maskCtx.strokeStyle = "rgba(239, 68, 68, 0.72)";

    maskCtx.beginPath();
    maskCtx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    maskCtx.lineTo(pt.x, pt.y);
    maskCtx.stroke();

    lastPointRef.current = pt;
    setHasDrawnMask(true);
  };

  const stopInpaintDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    lastPointRef.current = null;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  const handleInpaintUndo = () => {
    const maskCanvas = inpaintMaskCanvasRef.current;
    if (!maskCanvas || inpaintMaskHistory.current.length === 0) return;
    const maskCtx = maskCanvas.getContext("2d");
    if (!maskCtx) return;
    const prevState = inpaintMaskHistory.current.pop();
    if (prevState) {
      maskCtx.putImageData(prevState, 0, 0);
    }
    setMaskUndoAvailable(inpaintMaskHistory.current.length > 0);
  };

  const handleInpaintClearMask = () => {
    const maskCanvas = inpaintMaskCanvasRef.current;
    if (!maskCanvas) return;
    const maskCtx = maskCanvas.getContext("2d");
    if (maskCtx) {
      maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    }
    inpaintMaskHistory.current = [];
    setMaskUndoAvailable(false);
    setHasDrawnMask(false);
  };

  const handleExecuteInpaint = async () => {
    if (!inpaintFile || !hasDrawnMask) return;
    const maskCanvas = inpaintMaskCanvasRef.current;
    if (!maskCanvas) return;

    setInpaintLoading(true);
    setInpaintError(null);
    setInpaintProgress(15);
    setInpaintStage(lang === "en" ? "Extracting mask coordinates..." : "提取涂抹蒙版拓扑坐标...");

    try {
      const offscreen = document.createElement("canvas");
      offscreen.width = maskCanvas.width;
      offscreen.height = maskCanvas.height;
      const offCtx = offscreen.getContext("2d");
      if (!offCtx) throw new Error("无法初始化离屏蒙版画布");

      offCtx.fillStyle = "#000000";
      offCtx.fillRect(0, 0, offscreen.width, offscreen.height);

      const maskCtx = maskCanvas.getContext("2d");
      if (!maskCtx) throw new Error("无法读取蒙版图层");

      const maskData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
      const outData = offCtx.createImageData(offscreen.width, offscreen.height);
      const src = maskData.data;
      const dst = outData.data;

      let whiteCount = 0;
      for (let i = 0; i < src.length; i += 4) {
        if (src[i + 3] > 15) {
          dst[i] = 255;
          dst[i + 1] = 255;
          dst[i + 2] = 255;
          dst[i + 3] = 255;
          whiteCount++;
        } else {
          dst[i] = 0;
          dst[i + 1] = 0;
          dst[i + 2] = 0;
          dst[i + 3] = 255;
        }
      }

      if (whiteCount === 0) {
        throw new Error(
          lang === "en" ? "Please paint over the area you want to erase first" : "请先在图片上涂抹想要消除的区域"
        );
      }

      offCtx.putImageData(outData, 0, 0);

      setInpaintProgress(40);
      setInpaintStage(lang === "en" ? "Executing IOPaint inpainting algorithm..." : "启动 IOPaint 高性能纹理平滑修补...");

      const maskBlob = await new Promise<Blob>((resolve) => offscreen.toBlob((b) => resolve(b!), "image/png"));

      const res = await inpaintImage(inpaintFile, maskBlob, inpaintRadius, inpaintMethod);

      setInpaintResultBlob(res.blob);
      setInpaintResultUrl(URL.createObjectURL(res.blob));
      setInpaintProgress(100);
      setInpaintStage(lang === "en" ? "Inpaint blemish removal complete!" : "消除与纹理修补完成！");
    } catch (err: any) {
      setInpaintError(err.message || (lang === "en" ? "Inpainting failed, please try again" : "消除处理失败，请重试"));
    } finally {
      setInpaintLoading(false);
    }
  };

  const handleContinueWithInpaintResult = () => {
    if (!inpaintResultBlob || !inpaintFile) return;
    const baseName = inpaintFile.name.replace(/\.[^/.]+$/, "");
    const newFile = new File([inpaintResultBlob], `${baseName}_inpainted.png`, { type: "image/png" });
    setInpaintFile(newFile);
    setInpaintPreviewUrl(URL.createObjectURL(newFile));
    setInpaintResultBlob(null);
    setInpaintResultUrl(null);
    setInpaintProgress(0);
    handleInpaintClearMask();
  };

  const handleDownloadInpaintResult = () => {
    if (!inpaintResultBlob || !inpaintFile) return;
    const baseName = inpaintFile.name.replace(/\.[^/.]+$/, "");
    downloadBlob(inpaintResultBlob, `${baseName}_inpainted.png`);
  };

  // =========================================================================
  // 5. 双层可搜索 PDF 制作 (参考 Umi-OCR / Tesseract PDF 渲染引擎)
  // =========================================================================
  const [searchablePdfFile, setSearchablePdfFile] = useState<File | null>(null);
  const [searchablePdfPreviewUrl, setSearchablePdfPreviewUrl] = useState<string | null>(null);
  const [searchablePdfLang, setSearchablePdfLang] = useState<string>("chi_sim");
  const [searchablePdfLoading, setSearchablePdfLoading] = useState(false);
  const [searchablePdfProgress, setSearchablePdfProgress] = useState(0);
  const [searchablePdfStage, setSearchablePdfStage] = useState("");
  const [searchablePdfError, setSearchablePdfError] = useState<string | null>(null);
  const [searchablePdfResult, setSearchablePdfResult] = useState<{
    blob: Blob;
    filename: string;
    text: string;
  } | null>(null);
  const [searchablePdfCopied, setSearchablePdfCopied] = useState(false);

  const handleSearchablePdfFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSearchablePdfFile(file);
    setSearchablePdfPreviewUrl(URL.createObjectURL(file));
    setSearchablePdfResult(null);
    setSearchablePdfError(null);
    setSearchablePdfProgress(0);
  };

  const handleExecuteSearchablePdf = async () => {
    if (!searchablePdfFile) return;
    setSearchablePdfLoading(true);
    setSearchablePdfError(null);
    setSearchablePdfProgress(5);
    setSearchablePdfStage(lang === "en" ? "Initializing OCR & PDF layout engine..." : "初始化 OCR 与 PDF 排版合成引擎...");

    try {
      const res = await generateSearchablePdf(searchablePdfFile, searchablePdfLang, (pct, stage) => {
        setSearchablePdfProgress(pct);
        setSearchablePdfStage(stage);
      });
      setSearchablePdfResult(res);
      setSearchablePdfProgress(100);
      setSearchablePdfStage(lang === "en" ? "Dual-layer searchable PDF created!" : "双层可搜索 PDF 制作完成！");
    } catch (err: any) {
      setSearchablePdfError(err.message || (lang === "en" ? "Failed to create searchable PDF" : "双层可搜索 PDF 生成失败"));
    } finally {
      setSearchablePdfLoading(false);
    }
  };

  const handleDownloadSearchablePdf = () => {
    if (!searchablePdfResult) return;
    downloadBlob(searchablePdfResult.blob, searchablePdfResult.filename);
  };

  const handleCopySearchablePdfText = () => {
    if (!searchablePdfResult?.text) return;
    navigator.clipboard.writeText(searchablePdfResult.text);
    setSearchablePdfCopied(true);
    setTimeout(() => setSearchablePdfCopied(false), 2000);
  };

  // =========================================================================
  // 6. 音视频智能断句与字幕提取生成器 (参考 Buzz 离线硬件级 VAD 能量切片)
  // =========================================================================
  const [subtitleFile, setSubtitleFile] = useState<File | null>(null);
  const [subtitleMediaUrl, setSubtitleMediaUrl] = useState<string | null>(null);
  const [subtitleLoading, setSubtitleLoading] = useState(false);
  const [subtitleProgress, setSubtitleProgress] = useState(0);
  const [subtitleStage, setSubtitleStage] = useState("");
  const [subtitleError, setSubtitleError] = useState<string | null>(null);
  const [subtitleDuration, setSubtitleDuration] = useState(0);
  const [subtitleItems, setSubtitleItems] = useState<SubtitleItem[]>([]);
  const [subtitleCopied, setSubtitleCopied] = useState(false);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  const handleSubtitleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubtitleFile(file);
    setSubtitleMediaUrl(URL.createObjectURL(file));
    setSubtitleItems([]);
    setSubtitleDuration(0);
    setSubtitleError(null);
    setSubtitleProgress(0);
  };

  useEffect(() => {
    if (incomingFile) {
      if (activeTab === "ai-bg-remove") {
        handleBgFileSelect({ target: { files: [incomingFile] } } as any);
      } else if (activeTab === "ai-inpaint") {
        handleInpaintFileSelect({ target: { files: [incomingFile] } } as any);
      } else if (activeTab === "ai-upscale") {
        handleUpscaleFileSelect({ target: { files: [incomingFile] } } as any);
      } else if (activeTab === "ai-ocr") {
        handleOcrFileSelect({ target: { files: [incomingFile] } } as any);
      } else if (activeTab === "ai-subtitle") {
        handleSubtitleFileSelect({ target: { files: [incomingFile] } } as any);
      }
      onIncomingFileHandled?.();
    }
  }, [incomingFile, activeTab]);

  const handleExecuteSubtitle = async () => {
    if (!subtitleFile) return;
    setSubtitleLoading(true);
    setSubtitleError(null);
    setSubtitleProgress(5);
    setSubtitleStage(lang === "en" ? "Analyzing audio signal PCM..." : "正在解析音视频高保真 PCM 信号...");

    try {
      const res = await analyzeMediaSpeechSegments(subtitleFile, (pct, stage) => {
        setSubtitleProgress(pct);
        setSubtitleStage(stage);
      });
      setSubtitleDuration(res.duration);
      setSubtitleItems(res.items);
      setSubtitleProgress(100);
      setSubtitleStage(
        lang === "en"
          ? `Segmented ${res.items.length} speech lines!`
          : `智能切分 ${res.items.length} 段对话时间轴！`
      );
    } catch (err: any) {
      setSubtitleError(err.message || (lang === "en" ? "Audio VAD segmentation failed" : "音频智能断句切片失败"));
    } finally {
      setSubtitleLoading(false);
    }
  };

  const handleUpdateSubtitleText = (id: number, text: string) => {
    setSubtitleItems((prev) => prev.map((item) => (item.id === id ? { ...item, text } : item)));
  };

  const handleDeleteSubtitleItem = (id: number) => {
    setSubtitleItems((prev) =>
      prev
        .filter((item) => item.id !== id)
        .map((item, idx) => ({ ...item, id: idx + 1 }))
    );
  };

  const handleAddSubtitleItem = () => {
    const lastItem = subtitleItems[subtitleItems.length - 1];
    const newStart = lastItem ? lastItem.end + 0.5 : 0;
    const newEnd = newStart + 3.0;
    const newItem: SubtitleItem = {
      id: subtitleItems.length + 1,
      start: +newStart.toFixed(2),
      end: +newEnd.toFixed(2),
      startFormatted: formatSrtTimestamp(newStart),
      endFormatted: formatSrtTimestamp(newEnd),
      text: "",
    };
    setSubtitleItems((prev) => [...prev, newItem]);
  };

  const handlePlaySubtitleSegment = (start: number) => {
    if (!audioPlayerRef.current) return;
    audioPlayerRef.current.currentTime = start;
    audioPlayerRef.current.play().catch(() => {});
  };

  const handleExportSrt = () => {
    if (subtitleItems.length === 0 || !subtitleFile) return;
    const srtContent = exportToSrt(subtitleItems);
    const blob = new Blob([srtContent], { type: "text/plain;charset=utf-8" });
    const baseName = subtitleFile.name.replace(/\.[^/.]+$/, "");
    downloadBlob(blob, `${baseName}.srt`);
  };

  const handleExportVtt = () => {
    if (subtitleItems.length === 0 || !subtitleFile) return;
    const vttContent = exportToVtt(subtitleItems);
    const blob = new Blob([vttContent], { type: "text/vtt;charset=utf-8" });
    const baseName = subtitleFile.name.replace(/\.[^/.]+$/, "");
    downloadBlob(blob, `${baseName}.vtt`);
  };

  const handleExportTxt = () => {
    if (subtitleItems.length === 0 || !subtitleFile) return;
    const txtContent = subtitleItems.map((item) => item.text || "").join("\n");
    const blob = new Blob([txtContent], { type: "text/plain;charset=utf-8" });
    const baseName = subtitleFile.name.replace(/\.[^/.]+$/, "");
    downloadBlob(blob, `${baseName}_transcript.txt`);
  };

  const handleCopySubtitles = () => {
    if (subtitleItems.length === 0) return;
    const srtContent = exportToSrt(subtitleItems);
    navigator.clipboard.writeText(srtContent);
    setSubtitleCopied(true);
    setTimeout(() => setSubtitleCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* 顶部六栏切换 Tab (支持滚轮横移、鼠标拖拽与左右翻页箭头) */}
      <ScrollableTabNav
        tabs={[
          {
            id: "ai-bg-remove",
            label: lang === "en" ? "AI Smart Cutout" : "AI 发丝级智能抠图",
            icon: Sparkles,
            badge: lang === "en" ? "Transparent" : "无痕透底",
          },
          {
            id: "ai-inpaint",
            label: lang === "en" ? "AI Magic Eraser" : "AI 消除笔 / 去水印",
            icon: Eraser,
            badge: lang === "en" ? "Inpaint" : "智能涂抹",
          },
          {
            id: "ai-searchable-pdf",
            label: lang === "en" ? "Searchable PDF" : "双层可搜索 PDF 制作",
            icon: FileSearch,
            badge: lang === "en" ? "Dual-Layer" : "双层PDF",
          },
          {
            id: "ai-subtitle",
            label: lang === "en" ? "Subtitle Studio" : "音视频智能断句字幕",
            icon: Captions,
            badge: lang === "en" ? "VAD Timestamps" : "语音切片",
          },
          {
            id: "ai-ocr",
            label: lang === "en" ? "AI Text OCR" : "AI 文字提取 (OCR)",
            icon: FileText,
            badge: lang === "en" ? "Multi-language" : "多语言",
          },
          {
            id: "ai-upscale",
            label: lang === "en" ? "AI Image Upscaler" : "AI 模糊图片高清修复",
            icon: Maximize2,
            badge: lang === "en" ? "2x/4x HD" : "2x/4x超清",
          },
        ]}
        activeTab={activeTab}
        onTabChange={(id) => handleTabChange(id as AiTabType)}
      />

      {/* ========================================================================= */}
      {/* 模块 1: AI 发丝级智能抠图                                                   */}
      {/* ========================================================================= */}
      {activeTab === "ai-bg-remove" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* 左侧控制台 */}
          <div className="lg:col-span-5 coconut-panel p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-coconut-200/80 dark:border-darkbg-border">
              <div className="flex items-center gap-2 text-sm font-bold text-coconut-950 dark:text-darkbg-text">
                <Sliders className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                <span>{lang === "en" ? "Cutout Engine & Settings" : "抠图引擎与配置"}</span>
              </div>
            </div>

            {/* 引擎切换 */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-coconut-900 dark:text-darkbg-text">
                {lang === "en" ? "Algorithm Engine Mode" : "算法引擎模式"}
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setBgEngine("ai")}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    bgEngine === "ai"
                      ? "border-orange-500 bg-orange-50/70 dark:bg-orange-950/40 text-coconut-950 dark:text-darkbg-text shadow-sm ring-1 ring-orange-400/30"
                      : "border-coconut-200 dark:border-darkbg-border text-coconut-700 dark:text-darkbg-muted hover:bg-coconut-100/50 dark:hover:bg-darkbg-subtle"
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold mb-1">
                    <Sparkles className="w-4 h-4 text-orange-600" />
                    <span>{lang === "en" ? "AI Neural Network" : "AI 神经网络"}</span>
                  </div>
                  <p className="text-xs text-coconut-600 dark:text-darkbg-muted leading-relaxed">
                    {lang === "en"
                      ? "Hair-level fine segmentation, auto-identifies complex subjects"
                      : "发丝级精细分割，自动识别复杂人像与主体"}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setBgEngine("chroma")}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    bgEngine === "chroma"
                      ? "border-orange-500 bg-orange-50/70 dark:bg-orange-950/40 text-coconut-950 dark:text-darkbg-text shadow-sm ring-1 ring-orange-400/30"
                      : "border-coconut-200 dark:border-darkbg-border text-coconut-700 dark:text-darkbg-muted hover:bg-coconut-100/50 dark:hover:bg-darkbg-subtle"
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold mb-1">
                    <Zap className="w-4 h-4 text-amber-600" />
                    <span>{lang === "en" ? "Rapid Chroma Algorithm" : "极速色度算法"}</span>
                  </div>
                  <p className="text-xs text-coconut-600 dark:text-darkbg-muted leading-relaxed">
                    {lang === "en"
                      ? "Instant processing, ideal for solid or uniform backgrounds"
                      : "瞬时处理，适合纯色或单色背景图片"}
                  </p>
                </button>
              </div>
            </div>

            {/* 背景底色预设 */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-coconut-900 dark:text-darkbg-text">
                {lang === "en" ? "Output Background Color" : "输出背景底色"}
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {BG_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => handleChangeBgColor(preset.value)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs sm:text-sm font-semibold transition-all ${
                      selectedBgColor === preset.value
                        ? "border-orange-500 bg-orange-50/80 dark:bg-orange-950/50 text-orange-900 dark:text-orange-200 font-bold shadow-xs ring-1 ring-orange-400/30"
                        : "border-coconut-200 dark:border-darkbg-border text-coconut-800 dark:text-darkbg-muted hover:bg-coconut-100/50"
                    }`}
                  >
                    <span
                      className="w-4 h-4 rounded-full border border-coconut-300 shadow-inner flex-shrink-0"
                      style={{
                        backgroundColor: preset.value === "transparent" ? "transparent" : preset.color,
                        backgroundImage:
                          preset.value === "transparent"
                            ? "conic-gradient(#ccc 0.25turn, white 0.25turn 0.5turn, #ccc 0.5turn 0.75turn, white 0.75turn)"
                            : "none",
                        backgroundSize: "6px 6px",
                      }}
                    />
                    <span className="truncate">{lang === "en" ? preset.labelEn : preset.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 证件照联动快捷入口 */}
            <div className="p-4 bg-coconut-100/70 dark:bg-darkbg-subtle/80 border border-coconut-200 dark:border-darkbg-border rounded-2xl space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-bold text-coconut-950 dark:text-darkbg-text">
                <FileCheck className="w-4 h-4 text-orange-600" />
                <span>{lang === "en" ? "Link to ID Photo Studio" : "联动证件照排版"}</span>
              </div>
              <p className="text-xs text-coconut-700 dark:text-darkbg-muted leading-relaxed">
                {lang === "en"
                  ? "After removing background, click one button to jump to [ID Photo Studio] and generate 1-inch/2-inch print templates."
                  : "扣除背景后，可直接点击一键转入【证件照排版】，自动生成 1寸 / 2寸 冲印模板。"}
              </p>
            </div>

            {/* 立即执行按钮 */}
            <button
              onClick={handleExecuteBgRemoval}
              data-primary-action="true"
              disabled={bgLoading || !bgFile}
              className="w-full py-3.5 px-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 btn-3d-sunset active:scale-95"
            >
              {bgLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>
                    {lang === "en"
                      ? `Processing Cutout (${bgProgress}%)...`
                      : `正在处理抠图 (${bgProgress}%)...`}
                  </span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-200" />
                  <span>{lang === "en" ? "Start AI Smart Cutout" : "立即开始智能抠图"}</span>
                </>
              )}
            </button>
          </div>

          {/* 右侧展示与对比工作台 */}
          <div className="lg:col-span-7 space-y-5">
            {/* 上传区域 */}
            {!bgFile ? (
              <div className="bg-[#FAF1E8]/75 dark:bg-[#251E1A]/70 border-2 border-dashed border-[#D2BCAB] dark:border-[#4D392E] hover:border-amber-500 dark:hover:border-amber-400 rounded-3xl p-10 text-center transition-all cursor-pointer relative group">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/bmp"
                  onChange={handleBgFileSelect}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="w-14 h-14 mx-auto rounded-2xl bg-coconut-100/80 dark:bg-darkbg-subtle flex items-center justify-center text-coconut-600 dark:text-darkbg-muted group-hover:scale-110 group-hover:text-amber-600 transition-all mb-4">
                  <UploadCloud className="w-7 h-7" />
                </div>
                <h4 className="text-sm font-bold text-coconut-900 dark:text-darkbg-text mb-1">
                  {lang === "en"
                    ? "Drag image here to remove background, or click to upload"
                    : "拖入需要抠图的图片，或点击选择"}
                </h4>
                <p className="text-xs text-coconut-500 dark:text-darkbg-muted max-w-sm mx-auto">
                  {lang === "en"
                    ? "Supports portraits, ID selfies, pets, and e-commerce products (JPG, PNG, WebP). 100% processed locally."
                    : "支持人像、证件照自拍、宠物毛发、静物电商图（JPG, PNG, WebP），100% 本地运算不上传"}
                </p>
              </div>
            ) : (
              <div className="coconut-panel p-5 sm:p-6 space-y-4">
                {/* 状态栏 */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-coconut-100 dark:border-darkbg-border text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-coconut-900 dark:text-darkbg-text">
                      {bgFile.name}
                    </span>
                    <span className="text-coconut-400 font-mono">
                      ({formatBytes(bgFile.size)})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-coconut-600 dark:text-darkbg-muted hover:text-palm-600 cursor-pointer font-medium">
                      {lang === "en" ? "Change Image" : "更换图片"}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleBgFileSelect}
                        className="hidden"
                      />
                    </label>
                    <button
                      onClick={() => {
                        setBgFile(null);
                        setBgPreviewUrl(null);
                        setBgResultBlob(null);
                        setBgResultUrl(null);
                      }}
                      className="text-toast-500 hover:text-toast-600 flex items-center gap-1 font-medium"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{lang === "en" ? "Clear" : "清空"}</span>
                    </button>
                  </div>
                </div>

                {/* 处理进度条 */}
                {bgLoading && (
                  <div className="p-4 bg-coconut-50 dark:bg-darkbg-subtle rounded-2xl border border-coconut-200 dark:border-darkbg-border space-y-2">
                    <div className="flex justify-between text-xs text-coconut-700 dark:text-darkbg-muted">
                      <span className="font-medium flex items-center gap-1.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-palm-600" />
                        <span>
                          {localizeAiStage(bgStage) ||
                            (lang === "en"
                              ? "Deep neural network segmenting pixels..."
                              : "深度神经网络逐像素分割中...")}
                        </span>
                      </span>
                      <span className="font-mono font-bold text-orange-600 dark:text-orange-400">{bgProgress}%</span>
                    </div>
                    <div className="w-full h-3 bg-coconut-200/80 dark:bg-darkbg-border rounded-full overflow-hidden p-0.5 shadow-inner">
                      <div
                        className="h-full rounded-full progress-sunset-striped transition-all duration-300 shadow-sm"
                        style={{ width: `${Math.max(5, bgProgress)}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* 错误提示 */}
                {bgError && (
                  <div className="p-3 bg-toast-50 dark:bg-toast-950/40 border border-toast-200 dark:border-toast-900/60 rounded-2xl flex items-center gap-2 text-toast-700 dark:text-toast-300 text-xs">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 text-toast-500" />
                    <span>{bgError}</span>
                  </div>
                )}

                {/* 视图画布区域 */}
                <div className="relative w-full min-h-[360px] max-h-[540px] flex items-center justify-center rounded-2xl overflow-hidden border border-coconut-200/80 dark:border-darkbg-border bg-[#121212]/5 dark:bg-darkbg-subtle">
                  {/* 背景棋盘格纹理 */}
                  <div
                    className="absolute inset-0 z-0 pointer-events-none opacity-40"
                    style={{
                      backgroundImage:
                        "conic-gradient(#e2e8f0 0.25turn, transparent 0.25turn 0.5turn, #e2e8f0 0.5turn 0.75turn, transparent 0.75turn)",
                      backgroundSize: "16px 16px",
                    }}
                  />

                  {/* 尚未生成结果时：显示原图 */}
                  {!bgResultUrl && bgPreviewUrl && (
                    <img
                      src={bgPreviewUrl}
                      alt={lang === "en" ? "Original Preview" : "原图预览"}
                      className="relative z-10 max-w-full max-h-[500px] object-contain shadow-md rounded-lg"
                    />
                  )}

                  {/* 已生成抠图结果：支持滑动条对比 */}
                  {bgResultUrl && bgPreviewUrl && (
                    <div className="relative z-10 w-full h-[480px] select-none overflow-hidden flex items-center justify-center">
                      {/* 底层：原图 */}
                      <img
                        src={bgPreviewUrl}
                        alt={lang === "en" ? "Original" : "原图"}
                        className="absolute max-h-[460px] max-w-full object-contain"
                      />

                      {/* 顶层：抠图后透明效果（通过 clip-path 实现滑动对比） */}
                      <div
                        className="absolute inset-0 flex items-center justify-center overflow-hidden"
                        style={{
                          clipPath: `polygon(0 0, ${bgCompareSlider}% 0, ${bgCompareSlider}% 100%, 0 100%)`,
                        }}
                      >
                        <img
                          src={bgResultUrl}
                          alt={lang === "en" ? "Cutout Result" : "抠图效果"}
                          className="max-h-[460px] max-w-full object-contain"
                        />
                      </div>

                      {/* 中间分割线 */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-md z-20 pointer-events-none"
                        style={{ left: `${bgCompareSlider}%` }}
                      >
                        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-7 h-7 bg-white dark:bg-coconut-900 border border-coconut-300 rounded-full flex items-center justify-center shadow-lg text-[10px] text-coconut-700 dark:text-darkbg-text font-bold">
                          <SplitSquareHorizontal className="w-3.5 h-3.5" />
                        </div>
                      </div>

                      {/* 标尺角标 */}
                      <div className="absolute top-3 left-3 px-2.5 py-1 rounded-xl bg-black/60 text-white text-[10px] font-mono backdrop-blur-sm z-20">
                        {lang === "en" ? `Cutout Effect (${bgCompareSlider}%)` : `抠图效果 (${bgCompareSlider}%)`}
                      </div>
                      <div className="absolute top-3 right-3 px-2.5 py-1 rounded-xl bg-black/60 text-white text-[10px] font-mono backdrop-blur-sm z-20">
                        {lang === "en" ? "Original" : "原始图片"}
                      </div>
                    </div>
                  )}
                </div>

                {/* 对比滑块控制器 */}
                {bgResultUrl && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-xs text-coconut-600 dark:text-darkbg-muted">
                      <span>{lang === "en" ? "Slide to compare cutout edges with original" : "左右滑动对比抠图边缘与原图"}</span>
                      <span className="font-mono">{bgCompareSlider}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={bgCompareSlider}
                      onChange={(e) => setBgCompareSlider(parseInt(e.target.value))}
                      className="w-full accent-palm-600 cursor-pointer"
                    />
                  </div>
                )}

                {/* 底部功能下载与联动操作区 */}
                {bgResultUrl && (
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-coconut-100 dark:border-darkbg-border">
                    <button
                      onClick={handleSendToIdPhoto}
                      className="flex items-center gap-2 py-2.5 px-4 rounded-2xl bg-palm-100 dark:bg-palm-950/80 text-palm-800 dark:text-palm-300 border border-palm-300/60 dark:border-palm-800/80 font-bold text-xs transition-all hover:bg-palm-200/80 active:scale-95 shadow-sm"
                    >
                      <UserCheck className="w-4 h-4 text-palm-600" />
                      <span>{lang === "en" ? "Jump to 6\" ID Photo Layout 🚀" : "转入 6 寸证件照排版 🚀"}</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          if (!bgFile || !bgPreviewUrl || !bgResultUrl) return;
                          setCompareModalItem({
                            originalName: bgFile.name,
                            originalSize: bgFile.size,
                            originalUrl: bgPreviewUrl,
                            newFilename: `XC_Cutout_${bgFile.name.replace(/\.[^/.]+$/, "")}.png`,
                            newSize: bgResultBlob?.size || 0,
                            previewUrl: bgResultUrl,
                            blob: bgResultBlob || undefined,
                            extraInfo: lang === "en" ? "AI Smart Cutout" : "发丝级智能抠图",
                          });
                        }}
                        className="flex items-center gap-1.5 py-2.5 px-3.5 rounded-2xl bg-coconut-100 dark:bg-darkbg-elevated text-coconut-800 dark:text-darkbg-text font-bold text-xs transition-all hover:bg-coconut-200 active:scale-95 shadow-sm"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5 text-palm-600" />
                        <span>{lang === "en" ? "Interactive Inspection" : "微距画质对比"}</span>
                      </button>

                      <button
                        onClick={handleDownloadBgResult}
                        className="flex items-center gap-2 py-2.5 px-5 rounded-2xl btn-3d-sunset text-white text-xs font-bold shadow-coconut-sm"
                      >
                        <Download className="w-4 h-4" />
                        <span>{lang === "en" ? "Download Lossless Transparent PNG" : "下载无损透明 PNG"}</span>
                      </button>

                      {bgResultBlob && bgFile && (
                        <SendToButton
                          category="image"
                          payload={{
                            blob: bgResultBlob,
                            filename: `XC_Cutout_${bgFile.name.replace(/\.[^/.]+$/, "")}.png`,
                            sourceTitle: "AI 智能抠图",
                          }}
                          lang={lang}
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 模块 2: AI 消除笔 / 智能去水印 / 杂物擦除 (IOPaint C++ Telea/Navier-Stokes)  */}
      {/* ========================================================================= */}
      {activeTab === "ai-inpaint" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* 左侧控制台 */}
          <div className="lg:col-span-5 coconut-panel p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-coconut-200/80 dark:border-darkbg-border">
              <div className="flex items-center gap-2 text-sm font-bold text-coconut-950 dark:text-darkbg-text">
                <Eraser className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                <span>{lang === "en" ? "Inpaint & Brush Settings" : "消除涂抹参数配置"}</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 font-bold">
                IOPaint Fast C++
              </span>
            </div>

            {/* 笔刷粗细调节 */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm font-semibold text-coconut-900 dark:text-darkbg-text">
                <span>{lang === "en" ? "Brush Size" : "涂抹笔刷粗细"}</span>
                <span className="font-mono text-xs text-orange-600 dark:text-orange-400 font-bold">{brushSize} px</span>
              </div>
              <input
                type="range"
                min="6"
                max="80"
                value={brushSize}
                onChange={(e) => setBrushSize(parseInt(e.target.value))}
                className="w-full accent-orange-600 cursor-pointer"
              />
              <div className="flex items-center justify-center py-2 bg-coconut-50 dark:bg-darkbg-subtle rounded-xl border border-coconut-100 dark:border-darkbg-border">
                <div
                  className="rounded-full bg-red-500/70 border border-red-600 shadow-sm transition-all"
                  style={{ width: `${brushSize}px`, height: `${brushSize}px` }}
                />
              </div>
            </div>

            {/* 修复算法选择 */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-coconut-900 dark:text-darkbg-text">
                {lang === "en" ? "Inpainting Algorithm" : "修补算法核心"}
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setInpaintMethod("telea")}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    inpaintMethod === "telea"
                      ? "border-orange-500 bg-orange-50/50 dark:bg-orange-950/30 ring-2 ring-orange-500/20 shadow-sm"
                      : "border-coconut-200 dark:border-darkbg-border hover:bg-coconut-50 dark:hover:bg-darkbg-subtle"
                  }`}
                >
                  <div className="font-bold text-xs text-coconut-900 dark:text-darkbg-text">
                    {lang === "en" ? "Telea (Fast)" : "Telea 快速行进法"}
                  </div>
                  <div className="text-[11px] text-coconut-600 dark:text-darkbg-muted mt-1">
                    {lang === "en" ? "Best for text, lines, small blemishes" : "适合文字、水印与细小杂物"}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setInpaintMethod("ns")}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    inpaintMethod === "ns"
                      ? "border-orange-500 bg-orange-50/50 dark:bg-orange-950/30 ring-2 ring-orange-500/20 shadow-sm"
                      : "border-coconut-200 dark:border-darkbg-border hover:bg-coconut-50 dark:hover:bg-darkbg-subtle"
                  }`}
                >
                  <div className="font-bold text-xs text-coconut-900 dark:text-darkbg-text">
                    {lang === "en" ? "Navier-Stokes" : "Navier-Stokes 流体"}
                  </div>
                  <div className="text-[11px] text-coconut-600 dark:text-darkbg-muted mt-1">
                    {lang === "en" ? "Best for textures and larger areas" : "适合平滑渐变与较大范围擦除"}
                  </div>
                </button>
              </div>
            </div>

            {/* 采样半径调节 */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs font-semibold text-coconut-800 dark:text-darkbg-muted">
                <span>{lang === "en" ? "Inpaint Edge Radius" : "边缘纹理采样半径"}</span>
                <span className="font-mono text-coconut-900 dark:text-darkbg-text font-bold">{inpaintRadius} px</span>
              </div>
              <input
                type="range"
                min="1"
                max="15"
                value={inpaintRadius}
                onChange={(e) => setInpaintRadius(parseInt(e.target.value))}
                className="w-full accent-orange-600 cursor-pointer"
              />
            </div>

            {/* 画板撤销与清空工具栏 */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleInpaintUndo}
                disabled={!maskUndoAvailable || inpaintLoading}
                className="flex-1 py-2 px-3 rounded-xl border border-coconut-200 dark:border-darkbg-border bg-white dark:bg-darkbg-elevated text-xs font-bold text-coconut-800 dark:text-darkbg-text flex items-center justify-center gap-1.5 transition-all hover:bg-coconut-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span>{lang === "en" ? "Undo Stroke" : "撤销涂抹"}</span>
              </button>
              <button
                type="button"
                onClick={handleInpaintClearMask}
                disabled={!hasDrawnMask || inpaintLoading}
                className="flex-1 py-2 px-3 rounded-xl border border-coconut-200 dark:border-darkbg-border bg-white dark:bg-darkbg-elevated text-xs font-bold text-coconut-800 dark:text-darkbg-text flex items-center justify-center gap-1.5 transition-all hover:bg-coconut-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{lang === "en" ? "Clear Mask" : "清空重绘"}</span>
              </button>
            </div>

            {/* 执行消除按钮 */}
            <button
              onClick={handleExecuteInpaint}
              disabled={inpaintLoading || !inpaintFile || !hasDrawnMask}
              className={`w-full py-3.5 px-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                inpaintLoading || !inpaintFile || !hasDrawnMask
                  ? "bg-coconut-100 dark:bg-darkbg-subtle text-coconut-400 dark:text-darkbg-muted cursor-not-allowed border border-coconut-200 dark:border-darkbg-border"
                  : "btn-3d-sunset text-white active:scale-95"
              }`}
            >
              {inpaintLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{lang === "en" ? "Inpainting in progress..." : "AI 正在消除与修补纹理..."}</span>
                </>
              ) : (
                <>
                  <Eraser className="w-4 h-4" />
                  <span>{lang === "en" ? "Erase Marked Objects" : "开始智能消除修补"}</span>
                </>
              )}
            </button>

            {/* 进度条 */}
            {(inpaintLoading || inpaintProgress > 0) && (
              <div className="space-y-2 pt-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-coconut-700 dark:text-darkbg-muted flex items-center gap-1.5">
                    {inpaintLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-600" />}
                    {localizeAiStage(inpaintStage)}
                  </span>
                  <span className="font-mono text-orange-600 dark:text-orange-400 font-bold">{inpaintProgress}%</span>
                </div>
                <div className="w-full h-2.5 bg-coconut-200/80 dark:bg-darkbg-border rounded-full overflow-hidden p-0.5">
                  <div
                    className="h-full bg-gradient-to-r from-orange-500 via-amber-500 to-palm-500 rounded-full transition-all duration-300 shadow-sm"
                    style={{ width: `${inpaintProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* 错误警告 */}
            {inpaintError && (
              <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-400 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{inpaintError}</span>
              </div>
            )}
          </div>

          {/* 右侧工作台 */}
          <div className="lg:col-span-7 coconut-panel p-5 sm:p-6 space-y-4">
            {!inpaintFile ? (
              <div className="border-2 border-dashed border-coconut-300/80 dark:border-darkbg-border rounded-3xl p-10 flex flex-col items-center justify-center text-center hover:border-orange-500 transition-colors bg-coconut-50/50 dark:bg-darkbg-subtle relative min-h-[380px]">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleInpaintFileSelect}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="w-16 h-16 rounded-3xl bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 flex items-center justify-center mb-4 shadow-sm">
                  <Eraser className="w-8 h-8" />
                </div>
                <h3 className="font-bold text-base text-coconut-900 dark:text-darkbg-text mb-1">
                  {lang === "en" ? "Upload Image to Erase Objects" : "上传需要消除杂物/去水印的图片"}
                </h3>
                <p className="text-xs text-coconut-600 dark:text-darkbg-muted max-w-sm mb-4">
                  {lang === "en"
                    ? "Supports PNG, JPG, WEBP. Paint over unwanted areas to seamlessly inpaint with surrounding textures."
                    : "支持常见图片格式。直接在画面上涂抹红罩，AI 算法将依据周边纹理毫秒级无缝填补。"}
                </p>
                <span className="btn-3d-sunset text-xs py-2 px-5 rounded-2xl text-white font-bold pointer-events-none">
                  {lang === "en" ? "Select Local Image" : "选择本地图片"}
                </span>
              </div>
            ) : (
              <div className="space-y-4">
                {/* 图片信息栏 */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-coconut-50 dark:bg-darkbg-subtle border border-coconut-200/60 dark:border-darkbg-border">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold text-xs shrink-0">
                      IMG
                    </div>
                    <div className="truncate">
                      <div className="text-xs font-bold text-coconut-900 dark:text-darkbg-text truncate">
                        {inpaintFile.name}
                      </div>
                      <div className="text-[11px] text-coconut-500 font-mono">{formatBytes(inpaintFile.size)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer text-xs font-bold text-orange-600 dark:text-orange-400 hover:underline px-2.5 py-1 rounded-xl bg-orange-50 dark:bg-orange-950/40">
                      {lang === "en" ? "Change Image" : "更换图片"}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleInpaintFileSelect}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* 涂抹画布区或对比区 */}
                {!inpaintResultUrl ? (
                  <div className="space-y-2">
                    <div className="text-[11px] text-coconut-600 dark:text-darkbg-muted flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-orange-500" />
                      <span>{lang === "en" ? "Click & drag on the image to paint the red mask over objects to erase" : "🖱️ 提示：按住鼠标或触控在画面上涂抹红色半透明遮罩，标定需要擦除的物体或水印"}</span>
                    </div>

                    <div className="relative w-full rounded-2xl overflow-hidden border border-coconut-200 dark:border-darkbg-border bg-checkerboard flex items-center justify-center min-h-[380px] max-h-[520px]">
                      {/* 底层原始图画板 */}
                      <canvas
                        ref={inpaintImageCanvasRef}
                        className="max-h-[500px] max-w-full object-contain pointer-events-none block"
                      />
                      {/* 顶层交互涂抹蒙版画板 */}
                      <canvas
                        ref={inpaintMaskCanvasRef}
                        onPointerDown={startInpaintDrawing}
                        onPointerMove={drawInpaint}
                        onPointerUp={stopInpaintDrawing}
                        onPointerLeave={stopInpaintDrawing}
                        className="absolute inset-0 w-full h-full object-contain cursor-crosshair touch-none"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* 对比视窗 */}
                    <div className="relative w-full rounded-2xl overflow-hidden border border-coconut-200 dark:border-darkbg-border bg-checkerboard flex items-center justify-center min-h-[380px] max-h-[500px] select-none">
                      {/* 底层原图 */}
                      <img
                        src={inpaintPreviewUrl!}
                        alt={lang === "en" ? "Original" : "原图"}
                        className="absolute max-h-[480px] max-w-full object-contain"
                      />

                      {/* 顶层消除修补结果图 (滑动对比) */}
                      <div
                        className="absolute inset-0 flex items-center justify-center overflow-hidden"
                        style={{
                          clipPath: `polygon(0 0, ${inpaintCompareSlider}% 0, ${inpaintCompareSlider}% 100%, 0 100%)`,
                        }}
                      >
                        <img
                          src={inpaintResultUrl}
                          alt={lang === "en" ? "Inpainted Result" : "消除修补效果"}
                          className="max-h-[480px] max-w-full object-contain"
                        />
                      </div>

                      {/* 分割线 */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-md z-20 pointer-events-none"
                        style={{ left: `${inpaintCompareSlider}%` }}
                      >
                        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-7 h-7 bg-white dark:bg-coconut-900 border border-coconut-300 rounded-full flex items-center justify-center shadow-lg text-[10px] text-coconut-700 dark:text-darkbg-text font-bold">
                          <SplitSquareHorizontal className="w-3.5 h-3.5" />
                        </div>
                      </div>

                      {/* 角标 */}
                      <div className="absolute top-3 left-3 px-2.5 py-1 rounded-xl bg-black/60 text-white text-[10px] font-mono backdrop-blur-sm z-20">
                        {lang === "en" ? `Inpainted (${inpaintCompareSlider}%)` : `消除效果 (${inpaintCompareSlider}%)`}
                      </div>
                      <div className="absolute top-3 right-3 px-2.5 py-1 rounded-xl bg-black/60 text-white text-[10px] font-mono backdrop-blur-sm z-20">
                        {lang === "en" ? "Original" : "原始图片"}
                      </div>
                    </div>

                    {/* 对比滑块 */}
                    <div className="space-y-1 pt-1">
                      <div className="flex justify-between text-xs text-coconut-600 dark:text-darkbg-muted">
                        <span>{lang === "en" ? "Slide to compare before & after inpainting" : "滑动分割线对比消除修补前后效果"}</span>
                        <span className="font-mono">{inpaintCompareSlider}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={inpaintCompareSlider}
                        onChange={(e) => setInpaintCompareSlider(parseInt(e.target.value))}
                        className="w-full accent-orange-600 cursor-pointer"
                      />
                    </div>

                    {/* 底部操作与下载栏 */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-coconut-100 dark:border-darkbg-border">
                      <button
                        onClick={handleContinueWithInpaintResult}
                        className="flex items-center gap-1.5 py-2.5 px-3.5 rounded-2xl bg-orange-50 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800 font-bold text-xs transition-all hover:bg-orange-100 active:scale-95 shadow-sm"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>{lang === "en" ? "Continue Erasing on Result" : "在此结果上继续涂抹消除"}</span>
                      </button>

                      <div className="flex items-center gap-2">
                        {inpaintPreviewUrl && inpaintResultUrl && (
                          <button
                            onClick={() => {
                              if (!inpaintFile || !inpaintPreviewUrl || !inpaintResultUrl || !inpaintResultBlob) return;
                              setCompareModalItem({
                                originalName: inpaintFile.name,
                                originalSize: inpaintFile.size,
                                originalUrl: inpaintPreviewUrl,
                                newFilename: `${inpaintFile.name.replace(/\.[^/.]+$/, "")}_inpainted.png`,
                                newSize: inpaintResultBlob.size,
                                previewUrl: inpaintResultUrl,
                                blob: inpaintResultBlob,
                                extraInfo: lang === "en" ? "AI IOPaint Object Removal" : "AI 智能杂物擦除与纹理平滑",
                              });
                            }}
                            className="flex items-center gap-1.5 py-2.5 px-3.5 rounded-2xl bg-coconut-100 dark:bg-darkbg-elevated text-coconut-800 dark:text-darkbg-text font-bold text-xs transition-all hover:bg-coconut-200 active:scale-95 shadow-sm"
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5 text-palm-600" />
                            <span>{lang === "en" ? "Micro Inspection" : "微距画质对比"}</span>
                          </button>
                        )}

                        <button
                          onClick={handleDownloadInpaintResult}
                          className="btn-3d-sunset flex items-center gap-2 py-2.5 px-5 rounded-2xl text-white font-bold text-xs shadow-coconut-sm"
                        >
                          <Download className="w-4 h-4" />
                          <span>{lang === "en" ? "Download Inpainted Image" : "下载消除后图片"}</span>
                        </button>

                        {inpaintResultBlob && inpaintFile && (
                          <SendToButton
                            category="image"
                            payload={{
                              blob: inpaintResultBlob,
                              filename: `${inpaintFile.name.replace(/\.[^/.]+$/, "")}_inpainted.png`,
                              sourceTitle: "AI 消除笔",
                            }}
                            lang={lang}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 模块 3: 双层可搜索可复制 PDF 制作 (Umi-OCR / Tesseract PDF 渲染引擎)         */}
      {/* ========================================================================= */}
      {activeTab === "ai-searchable-pdf" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* 左侧控制台 */}
          <div className="lg:col-span-5 coconut-panel p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-coconut-200/80 dark:border-darkbg-border">
              <div className="flex items-center gap-2 text-sm font-bold text-coconut-950 dark:text-darkbg-text">
                <FileSearch className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                <span>{lang === "en" ? "Dual-Layer PDF Settings" : "双层可搜索 PDF 配置"}</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold">
                Umi-OCR Layering
              </span>
            </div>

            {/* 识别语言 */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-coconut-900 dark:text-darkbg-text">
                {lang === "en" ? "Document Recognition Language" : "排版对齐识别语言"}
              </label>
              <select
                value={searchablePdfLang}
                onChange={(e) => setSearchablePdfLang(e.target.value)}
                className="w-full coconut-input text-xs font-semibold py-2.5 px-3 rounded-xl bg-white dark:bg-darkbg-elevated border border-coconut-200 dark:border-darkbg-border"
              >
                {OCR_LANGUAGES.map((item) => (
                  <option key={item.id} value={item.id}>
                    {lang === "en" ? item.labelEn : item.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 功能原理介绍提示卡 */}
            <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 space-y-2">
              <div className="flex items-center gap-2 font-bold text-xs text-amber-900 dark:text-amber-200">
                <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{lang === "en" ? "How Dual-Layer PDF Works" : "双层 PDF 核心优势"}</span>
              </div>
              <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300/90">
                {lang === "en"
                  ? "Maintains 100% of the original scanned document's appearance on the visual layer, while injecting an invisible, pixel-aligned vector text layer underneath. Enables full-text search (Ctrl+F) and precise cursor selection & copying."
                  : "在图像表面保持 100% 原始扫描件或证件外观，同时在其底层精准注入字形像素对齐的透明文字排版层。生成的标准 PDF 支持浏览器与 Adobe Reader 划词复制、关键词极速搜索 (Ctrl+F)。"}
              </p>
            </div>

            {/* 执行制作按钮 */}
            <button
              onClick={handleExecuteSearchablePdf}
              disabled={searchablePdfLoading || !searchablePdfFile}
              className={`w-full py-3.5 px-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                searchablePdfLoading || !searchablePdfFile
                  ? "bg-coconut-100 dark:bg-darkbg-subtle text-coconut-400 dark:text-darkbg-muted cursor-not-allowed border border-coconut-200 dark:border-darkbg-border"
                  : "btn-3d-sunset text-white active:scale-95"
              }`}
            >
              {searchablePdfLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{lang === "en" ? "Synthesizing PDF layout..." : "正在排版合成双层 PDF..."}</span>
                </>
              ) : (
                <>
                  <FileSearch className="w-4 h-4" />
                  <span>{lang === "en" ? "Generate Searchable PDF" : "制作双层可搜索 PDF"}</span>
                </>
              )}
            </button>

            {/* 进度指示 */}
            {(searchablePdfLoading || searchablePdfProgress > 0) && (
              <div className="space-y-2 pt-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-coconut-700 dark:text-darkbg-muted flex items-center gap-1.5">
                    {searchablePdfLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-600" />}
                    {localizeAiStage(searchablePdfStage)}
                  </span>
                  <span className="font-mono text-orange-600 dark:text-orange-400 font-bold">{searchablePdfProgress}%</span>
                </div>
                <div className="w-full h-2.5 bg-coconut-200/80 dark:bg-darkbg-border rounded-full overflow-hidden p-0.5">
                  <div
                    className="h-full bg-gradient-to-r from-orange-500 via-amber-500 to-palm-500 rounded-full transition-all duration-300 shadow-sm"
                    style={{ width: `${searchablePdfProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* 错误提示 */}
            {searchablePdfError && (
              <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-400 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{searchablePdfError}</span>
              </div>
            )}
          </div>

          {/* 右侧工作台 */}
          <div className="lg:col-span-7 coconut-panel p-5 sm:p-6 space-y-4">
            {!searchablePdfFile ? (
              <div className="border-2 border-dashed border-coconut-300/80 dark:border-darkbg-border rounded-3xl p-10 flex flex-col items-center justify-center text-center hover:border-orange-500 transition-colors bg-coconut-50/50 dark:bg-darkbg-subtle relative min-h-[380px]">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleSearchablePdfFileSelect}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="w-16 h-16 rounded-3xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4 shadow-sm">
                  <FileSearch className="w-8 h-8" />
                </div>
                <h3 className="font-bold text-base text-coconut-900 dark:text-darkbg-text mb-1">
                  {lang === "en" ? "Upload Scanned Document or Image" : "上传扫描件、纸质文档照片或图书页面"}
                </h3>
                <p className="text-xs text-coconut-600 dark:text-darkbg-muted max-w-sm mb-4">
                  {lang === "en"
                    ? "Supports PNG, JPG, WEBP. The engine will extract all text geometry and produce a dual-layer PDF."
                    : "支持常见图片。引擎将智能分析字形拓扑并注入底层透明文字，输出支持划词搜索的双层 PDF。"}
                </p>
                <span className="btn-3d-sunset text-xs py-2 px-5 rounded-2xl text-white font-bold pointer-events-none">
                  {lang === "en" ? "Select Scanned Document" : "选择扫描件图片"}
                </span>
              </div>
            ) : (
              <div className="space-y-4">
                {/* 文件信息 */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-coconut-50 dark:bg-darkbg-subtle border border-coconut-200/60 dark:border-darkbg-border">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0">
                      SCAN
                    </div>
                    <div className="truncate">
                      <div className="text-xs font-bold text-coconut-900 dark:text-darkbg-text truncate">
                        {searchablePdfFile.name}
                      </div>
                      <div className="text-[11px] text-coconut-500 font-mono">{formatBytes(searchablePdfFile.size)}</div>
                    </div>
                  </div>
                  <label className="cursor-pointer text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40">
                    {lang === "en" ? "Replace" : "更换文件"}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleSearchablePdfFileSelect}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* 预览与结果输出 */}
                {!searchablePdfResult ? (
                  <div className="relative w-full rounded-2xl overflow-hidden border border-coconut-200 dark:border-darkbg-border bg-coconut-100/50 dark:bg-darkbg-subtle flex items-center justify-center min-h-[360px] max-h-[500px]">
                    <img
                      src={searchablePdfPreviewUrl!}
                      alt={lang === "en" ? "Preview" : "预览"}
                      className="max-h-[480px] max-w-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* 制作成功信息卡 */}
                    <div className="p-4 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        <div>
                          <div className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                            {lang === "en" ? "Searchable Dual-Layer PDF Ready!" : "双层可搜索 PDF 制作完成！"}
                          </div>
                          <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-mono">
                            {searchablePdfResult.filename} ({formatBytes(searchablePdfResult.blob.size)})
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-200 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-bold">
                        {lang === "en" ? "Selectable Text" : "可划词复制"}
                      </span>
                    </div>

                    {/* 底层提取文本预览框 */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs font-semibold text-coconut-800 dark:text-darkbg-muted">
                        <span>{lang === "en" ? "Injected Invisible Text Layer (Preview)" : "注入的底层透明文字层 (文本预览)"}</span>
                        <button
                          onClick={handleCopySearchablePdfText}
                          className="flex items-center gap-1 text-[11px] text-orange-600 hover:text-orange-700 font-bold"
                        >
                          {searchablePdfCopied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          <span>{searchablePdfCopied ? (lang === "en" ? "Copied!" : "已复制！") : (lang === "en" ? "Copy Text" : "复制全部文本")}</span>
                        </button>
                      </div>
                      <textarea
                        readOnly
                        rows={8}
                        value={searchablePdfResult.text}
                        className="w-full coconut-input font-mono text-xs p-3 rounded-2xl bg-white dark:bg-darkbg-elevated border border-coconut-200 dark:border-darkbg-border resize-none"
                      />
                    </div>

                    {/* 底部下载按钮 */}
                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-coconut-100 dark:border-darkbg-border">
                      <button
                        onClick={handleDownloadSearchablePdf}
                        className="btn-3d-sunset flex items-center gap-2 py-2.5 px-6 rounded-2xl text-white font-bold text-xs shadow-coconut-sm"
                      >
                        <Download className="w-4 h-4" />
                        <span>{lang === "en" ? "Download Searchable PDF" : "下载双层可搜索 PDF"}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 模块 4: 音视频智能断句与字幕提取生成器 (Buzz 离线硬件级 VAD 能量切片)        */}
      {/* ========================================================================= */}
      {activeTab === "ai-subtitle" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* 左侧控制台 */}
          <div className="lg:col-span-5 coconut-panel p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-coconut-200/80 dark:border-darkbg-border">
              <div className="flex items-center gap-2 text-sm font-bold text-coconut-950 dark:text-darkbg-text">
                <Captions className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                <span>{lang === "en" ? "Subtitle Studio & VAD" : "智能字幕与声学断句"}</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 font-bold">
                Buzz WebAudio VAD
              </span>
            </div>

            {/* 音频播放预览 */}
            {subtitleMediaUrl && (
              <div className="space-y-2 p-3.5 rounded-2xl bg-coconut-50 dark:bg-darkbg-subtle border border-coconut-200/60 dark:border-darkbg-border">
                <div className="flex items-center gap-2 text-xs font-bold text-coconut-900 dark:text-darkbg-text">
                  <Volume2 className="w-4 h-4 text-orange-600" />
                  <span>{lang === "en" ? "Audio Playback & Calibration" : "音频原声播放校对"}</span>
                </div>
                <audio
                  ref={audioPlayerRef}
                  controls
                  src={subtitleMediaUrl}
                  className="w-full h-8 accent-orange-600"
                />
              </div>
            )}

            {/* 原理提示 */}
            <div className="p-4 rounded-2xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200/80 dark:border-sky-800/60 space-y-2">
              <div className="flex items-center gap-2 font-bold text-xs text-sky-900 dark:text-sky-200">
                <ShieldCheck className="w-4 h-4 text-sky-600 shrink-0" />
                <span>{lang === "en" ? "Offline PCM Signal Processing" : "离线音频信号处理"}</span>
              </div>
              <p className="text-[11px] leading-relaxed text-sky-800 dark:text-sky-300/90">
                {lang === "en"
                  ? "Uses Web Audio API to decode media directly in browser memory without uploading to any cloud. RMS energy envelope algorithm detects voice activity, speech bursts, and breath pauses with millisecond precision."
                  : "通过 Web Audio API 本地硬件级离线解码音频流，零数据上传。自适应 RMS 能量包络算法毫秒级捕捉语音起止与停顿，自动划分句段并生成 SRT/VTT 标准时间轴。"}
              </p>
            </div>

            {/* 执行断句按钮 */}
            <button
              onClick={handleExecuteSubtitle}
              disabled={subtitleLoading || !subtitleFile}
              className={`w-full py-3.5 px-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                subtitleLoading || !subtitleFile
                  ? "bg-coconut-100 dark:bg-darkbg-subtle text-coconut-400 dark:text-darkbg-muted cursor-not-allowed border border-coconut-200 dark:border-darkbg-border"
                  : "btn-3d-sunset text-white active:scale-95"
              }`}
            >
              {subtitleLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{lang === "en" ? "Segmenting audio VAD..." : "正在计算能量包络与断句..."}</span>
                </>
              ) : (
                <>
                  <Captions className="w-4 h-4" />
                  <span>{lang === "en" ? "Extract Speech Timeline (VAD)" : "智能声学断句切片"}</span>
                </>
              )}
            </button>

            {/* 进度指示 */}
            {(subtitleLoading || subtitleProgress > 0) && (
              <div className="space-y-2 pt-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-coconut-700 dark:text-darkbg-muted flex items-center gap-1.5">
                    {subtitleLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-600" />}
                    {localizeAiStage(subtitleStage)}
                  </span>
                  <span className="font-mono text-orange-600 dark:text-orange-400 font-bold">{subtitleProgress}%</span>
                </div>
                <div className="w-full h-2.5 bg-coconut-200/80 dark:bg-darkbg-border rounded-full overflow-hidden p-0.5">
                  <div
                    className="h-full bg-gradient-to-r from-orange-500 via-amber-500 to-palm-500 rounded-full transition-all duration-300 shadow-sm"
                    style={{ width: `${subtitleProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* 错误提示 */}
            {subtitleError && (
              <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-400 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{subtitleError}</span>
              </div>
            )}
          </div>

          {/* 右侧工作台 */}
          <div className="lg:col-span-7 coconut-panel p-5 sm:p-6 space-y-4">
            {!subtitleFile ? (
              <div className="border-2 border-dashed border-coconut-300/80 dark:border-darkbg-border rounded-3xl p-10 flex flex-col items-center justify-center text-center hover:border-orange-500 transition-colors bg-coconut-50/50 dark:bg-darkbg-subtle relative min-h-[380px]">
                <input
                  type="file"
                  accept="audio/*,video/*,.mp3,.wav,.m4a,.aac,.flac,.ogg,.mp4,.webm,.mkv"
                  onChange={handleSubtitleFileSelect}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="w-16 h-16 rounded-3xl bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center mb-4 shadow-sm">
                  <Captions className="w-8 h-8" />
                </div>
                <h3 className="font-bold text-base text-coconut-900 dark:text-darkbg-text mb-1">
                  {lang === "en" ? "Upload Audio or Video Media" : "上传音频或视频文件"}
                </h3>
                <p className="text-xs text-coconut-600 dark:text-darkbg-muted max-w-sm mb-4">
                  {lang === "en"
                    ? "Supports MP3, WAV, AAC, M4A, FLAC, MP4, WEBM. Fast offline speech timestamp segmentation."
                    : "支持常见音视频。纯前端离线提取语音停顿与时间戳，导出标准 SRT / VTT 字幕文件。"}
                </p>
                <span className="btn-3d-sunset text-xs py-2 px-5 rounded-2xl text-white font-bold pointer-events-none">
                  {lang === "en" ? "Select Audio / Video" : "选择音视频文件"}
                </span>
              </div>
            ) : (
              <div className="space-y-4">
                {/* 文件信息 */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-coconut-50 dark:bg-darkbg-subtle border border-coconut-200/60 dark:border-darkbg-border">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold text-xs shrink-0">
                      MEDIA
                    </div>
                    <div className="truncate">
                      <div className="text-xs font-bold text-coconut-900 dark:text-darkbg-text truncate">
                        {subtitleFile.name}
                      </div>
                      <div className="text-[11px] text-coconut-500 font-mono">{formatBytes(subtitleFile.size)}</div>
                    </div>
                  </div>
                  <label className="cursor-pointer text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline px-2.5 py-1 rounded-xl bg-sky-50 dark:bg-sky-950/40">
                    {lang === "en" ? "Change Media" : "更换媒体"}
                    <input
                      type="file"
                      accept="audio/*,video/*,.mp3,.wav,.m4a,.aac,.flac,.ogg,.mp4,.webm,.mkv"
                      onChange={handleSubtitleFileSelect}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* 句段列表与导出 */}
                {subtitleItems.length === 0 ? (
                  <div className="p-10 rounded-2xl bg-coconut-50/50 dark:bg-darkbg-subtle border border-coconut-200/60 dark:border-darkbg-border text-center flex flex-col items-center justify-center space-y-3 min-h-[320px]">
                    <div className="w-12 h-12 rounded-2xl bg-orange-100 dark:bg-orange-950/60 text-orange-600 flex items-center justify-center">
                      <Volume2 className="w-6 h-6" />
                    </div>
                    <p className="text-xs font-bold text-coconut-800 dark:text-darkbg-text">
                      {lang === "en"
                        ? "Click 'Extract Speech Timeline' on the left to begin VAD segmentation"
                        : "点击左侧“智能声学断句切片”，AI 算法将根据语音能量自动划分字幕轴"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* 句段统计与控制 */}
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-coconut-900 dark:text-darkbg-text">
                        <span>{lang === "en" ? "Detected Segments: " : "已定位语音句段: "}</span>
                        <span className="font-mono text-orange-600 font-bold">{subtitleItems.length}</span>
                        <span className="text-coconut-500 ml-1">
                          ({lang === "en" ? "Total " : "总时长 "}{subtitleDuration.toFixed(1)}s)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleAddSubtitleItem}
                          className="flex items-center gap-1 py-1.5 px-3 rounded-xl bg-white dark:bg-darkbg-elevated border border-coconut-200 dark:border-darkbg-border text-xs font-bold text-coconut-800 dark:text-darkbg-text hover:bg-coconut-50"
                        >
                          <Plus className="w-3.5 h-3.5 text-palm-600" />
                          <span>{lang === "en" ? "Add Row" : "添加句段"}</span>
                        </button>
                        <button
                          onClick={handleCopySubtitles}
                          className="flex items-center gap-1 py-1.5 px-3 rounded-xl bg-white dark:bg-darkbg-elevated border border-coconut-200 dark:border-darkbg-border text-xs font-bold text-coconut-800 dark:text-darkbg-text hover:bg-coconut-50"
                        >
                          {subtitleCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{subtitleCopied ? (lang === "en" ? "Copied!" : "已复制！") : (lang === "en" ? "Copy SRT" : "复制SRT")}</span>
                        </button>
                      </div>
                    </div>

                    {/* 字幕轴列表 */}
                    <div className="max-h-[360px] overflow-y-auto space-y-2 pr-1 rounded-2xl border border-coconut-200/80 dark:border-darkbg-border p-2 bg-coconut-50/30 dark:bg-darkbg-subtle">
                      {subtitleItems.map((item) => (
                        <div
                          key={item.id}
                          className="p-3 rounded-xl bg-white dark:bg-darkbg-elevated border border-coconut-100 dark:border-darkbg-border shadow-2xs space-y-2"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-coconut-100 dark:bg-darkbg-border text-coconut-700 dark:text-darkbg-text flex items-center justify-center font-mono font-bold text-[10px]">
                                {item.id}
                              </span>
                              <span className="font-mono text-[11px] text-orange-600 dark:text-orange-400 font-semibold">
                                {item.startFormatted} → {item.endFormatted}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handlePlaySubtitleSegment(item.start)}
                                title={lang === "en" ? "Play this segment" : "试听此片段"}
                                className="p-1 rounded-lg hover:bg-coconut-100 dark:hover:bg-darkbg-border text-coconut-600 dark:text-darkbg-muted"
                              >
                                <Play className="w-3.5 h-3.5 text-palm-600" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteSubtitleItem(item.id)}
                                title={lang === "en" ? "Delete segment" : "删除此片段"}
                                className="p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-coconut-400 hover:text-red-600"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <input
                            type="text"
                            value={item.text}
                            onChange={(e) => handleUpdateSubtitleText(item.id, e.target.value)}
                            placeholder={lang === "en" ? "Type subtitle transcript here (optional)..." : "在此输入或校对本句台词文本 (选填)..."}
                            className="w-full coconut-input text-xs py-1.5 px-2.5 rounded-lg bg-coconut-50/50 dark:bg-darkbg-subtle border border-coconut-200/80 dark:border-darkbg-border"
                          />
                        </div>
                      ))}
                    </div>

                    {/* 底部导出按钮栏 */}
                    <div className="flex flex-wrap items-center justify-end gap-2.5 pt-3 border-t border-coconut-100 dark:border-darkbg-border">
                      <button
                        onClick={handleExportTxt}
                        className="py-2.5 px-3.5 rounded-2xl bg-coconut-100 dark:bg-darkbg-elevated text-coconut-800 dark:text-darkbg-text font-bold text-xs hover:bg-coconut-200"
                      >
                        <span>{lang === "en" ? "Export TXT" : "导出纯文本 (.txt)"}</span>
                      </button>
                      <button
                        onClick={handleExportVtt}
                        className="py-2.5 px-3.5 rounded-2xl bg-coconut-100 dark:bg-darkbg-elevated text-coconut-800 dark:text-darkbg-text font-bold text-xs hover:bg-coconut-200"
                      >
                        <span>{lang === "en" ? "Export WebVTT" : "导出 WebVTT (.vtt)"}</span>
                      </button>
                      <button
                        onClick={handleExportSrt}
                        className="btn-3d-sunset flex items-center gap-1.5 py-2.5 px-5 rounded-2xl text-white font-bold text-xs shadow-coconut-sm"
                      >
                        <Download className="w-4 h-4" />
                        <span>{lang === "en" ? "Export Subtitles (.srt)" : "导出标准字幕 (.srt)"}</span>
                      </button>

                      {subtitleItems.length > 0 && (
                        <SendToButton
                          category="text"
                          payload={{
                            text: exportToSrt(subtitleItems),
                            sourceTitle: "AI 音视频字幕",
                          }}
                          lang={lang}
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 模块 5: AI 离线 OCR 文字提取                                                */}
      {/* ========================================================================= */}
      {activeTab === "ai-ocr" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* 左侧控制台 */}
          <div className="lg:col-span-5 coconut-panel p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-coconut-200/80 dark:border-darkbg-border">
              <div className="flex items-center gap-2 text-sm font-bold text-coconut-950 dark:text-darkbg-text">
                <Sliders className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                <span>{lang === "en" ? "OCR Language Selection" : "OCR 识别语言选择"}</span>
              </div>
            </div>

            {/* 语言选择 */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-coconut-900 dark:text-darkbg-text">
                {lang === "en" ? "OCR Language Thesaurus" : "文字识别语言字库"}
              </label>
              <div className="space-y-2.5">
                {OCR_LANGUAGES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setOcrLang(item.id)}
                    className={`w-full text-left p-3 rounded-2xl border transition-all ${
                      ocrLang === item.id
                        ? "border-orange-500 bg-orange-50/70 dark:bg-orange-950/40 text-coconut-950 dark:text-darkbg-text shadow-sm ring-1 ring-orange-400/30"
                        : "border-coconut-200 dark:border-darkbg-border text-coconut-700 dark:text-darkbg-muted hover:bg-coconut-100/50"
                    }`}
                  >
                    <div className="text-sm font-bold text-coconut-950 dark:text-white">
                      {lang === "en" ? item.labelEn || item.label : item.label}
                    </div>
                    <div className="text-xs text-coconut-600 dark:text-darkbg-muted mt-0.5 leading-relaxed">
                      {lang === "en" ? item.descEn || item.desc : item.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 立即识别按钮 */}
            <button
              onClick={handleExecuteOcr}
              disabled={ocrLoading || !ocrFile}
              className="w-full py-3.5 px-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 btn-3d-sunset active:scale-95"
            >
              {ocrLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>
                    {lang === "en"
                      ? `Recognizing Text (${ocrProgress}%)...`
                      : `正在识别提取 (${ocrProgress}%)...`}
                  </span>
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 text-amber-200" />
                  <span>{lang === "en" ? "Start Text Extraction" : "立即开始文字提取"}</span>
                </>
              )}
            </button>
          </div>

          {/* 右侧展示与文字编辑区域 */}
          <div className="lg:col-span-7 space-y-5">
            {!ocrFile ? (
              <div className="bg-[#FAF1E8]/75 dark:bg-[#251E1A]/70 border-2 border-dashed border-[#D2BCAB] dark:border-[#4D392E] hover:border-amber-500 dark:hover:border-amber-400 rounded-3xl p-10 text-center transition-all cursor-pointer relative group">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/bmp"
                  onChange={handleOcrFileSelect}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="w-14 h-14 mx-auto rounded-2xl bg-coconut-100/80 dark:bg-darkbg-subtle flex items-center justify-center text-coconut-600 dark:text-darkbg-muted group-hover:scale-110 group-hover:text-amber-600 transition-all mb-4">
                  <UploadCloud className="w-7 h-7" />
                </div>
                <h4 className="text-sm font-bold text-coconut-900 dark:text-darkbg-text mb-1">
                  {lang === "en"
                    ? "Drag image or screenshot here, or click to upload"
                    : "拖入需要识别的图片或截图，或点击上传"}
                </h4>
                <p className="text-xs text-coconut-500 dark:text-darkbg-muted max-w-sm mx-auto">
                  {lang === "en"
                    ? "Supports scanned contracts, textbooks, e-invoices, receipts, and web screenshots"
                    : "支持拍照合同、教材书籍、电子发票、证件单据与网页截图"}
                </p>
              </div>
            ) : (
              <div className="coconut-panel p-5 sm:p-6 space-y-4">
                {/* 状态与切换 */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-coconut-100 dark:border-darkbg-border text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-coconut-900 dark:text-darkbg-text">
                      {ocrFile.name}
                    </span>
                    <span className="text-coconut-400 font-mono">
                      ({formatBytes(ocrFile.size)})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-coconut-600 dark:text-darkbg-muted hover:text-palm-600 cursor-pointer font-medium">
                      {lang === "en" ? "Change Image" : "更换图片"}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleOcrFileSelect}
                        className="hidden"
                      />
                    </label>
                    <button
                      onClick={() => {
                        setOcrFile(null);
                        setOcrPreviewUrl(null);
                        setOcrResult(null);
                        setOcrEditableText("");
                      }}
                      className="text-toast-500 hover:text-toast-600 flex items-center gap-1 font-medium"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{lang === "en" ? "Clear" : "清空"}</span>
                    </button>
                  </div>
                </div>

                {/* 进度指示 */}
                {ocrLoading && (
                  <div className="p-4 bg-coconut-50 dark:bg-darkbg-subtle rounded-2xl border border-coconut-200 dark:border-darkbg-border space-y-2">
                    <div className="flex justify-between text-xs text-coconut-700 dark:text-darkbg-muted">
                      <span className="font-medium flex items-center gap-1.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-palm-600" />
                        <span>
                          {localizeAiStage(ocrStage) ||
                            (lang === "en" ? "Parsing text layout..." : "正在解析文字排版...")}
                        </span>
                      </span>
                      <span className="font-mono font-bold text-palm-600">{ocrProgress}%</span>
                    </div>
                    <div className="w-full h-2.5 bg-coconut-200 dark:bg-darkbg-border rounded-full overflow-hidden p-0.5">
                      <div
                        className="h-full progress-sunset-striped rounded-full transition-all duration-300"
                        style={{ width: `${ocrProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {ocrError && (
                  <div className="p-3 bg-toast-50 dark:bg-toast-950/40 border border-toast-200 dark:border-toast-900/60 rounded-2xl flex items-center gap-2 text-toast-700 dark:text-toast-300 text-xs">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 text-toast-500" />
                    <span>{ocrError}</span>
                  </div>
                )}

                {/* 上下双栏或左右并列：左边图片缩略图，右边编辑文本框 */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                  {/* 原图缩略预览 */}
                  <div className="md:col-span-4 bg-coconut-100/50 dark:bg-darkbg-subtle p-2 rounded-2xl border border-coconut-200/60 dark:border-darkbg-border flex flex-col items-center">
                    <div className="text-[11px] font-semibold text-coconut-700 dark:text-darkbg-muted mb-2 self-start">
                      {lang === "en" ? "Original Reference" : "原图参考"}
                    </div>
                    {ocrPreviewUrl && (
                      <img
                        src={ocrPreviewUrl}
                        alt={lang === "en" ? "Image for Recognition" : "待识别图片"}
                        className="max-h-[360px] w-auto rounded-xl object-contain shadow-sm border border-coconut-200 dark:border-darkbg-border"
                      />
                    )}
                  </div>

                  {/* 识别文字与在线编辑器 */}
                  <div className="md:col-span-8 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-coconut-900 dark:text-darkbg-text">
                        {lang === "en" ? "Extracted Text & Editor" : "提取结果与在线编辑"}
                      </span>
                      {ocrResult && (
                        <div className="flex items-center gap-2 text-[11px] text-coconut-500 dark:text-darkbg-muted font-mono">
                          <span>{lang === "en" ? `Characters: ${ocrResult.characterCount}` : `字数: ${ocrResult.characterCount}`}</span>
                          <span>·</span>
                          <span>{lang === "en" ? `Lines: ${ocrResult.linesCount}` : `行数: ${ocrResult.linesCount}`}</span>
                          <span>·</span>
                          <span className="text-palm-600 font-semibold">
                            {lang === "en" ? `Confidence: ${ocrResult.confidence}%` : `置信度: ${ocrResult.confidence}%`}
                          </span>
                        </div>
                      )}
                    </div>

                    <textarea
                      value={ocrEditableText}
                      onChange={(e) => setOcrEditableText(e.target.value)}
                      placeholder={
                        ocrLoading
                          ? (lang === "en"
                              ? "AI recognizing text, results will populate here automatically..."
                              : "AI 正在识别中，文字提取后将自动填充在此处...")
                          : (lang === "en"
                              ? "Click [Start Text Extraction] on the left to view and edit text here..."
                              : "点击左侧【立即开始文字提取】即可在此查看与直接编辑内容...")
                      }
                      rows={12}
                      className="w-full text-sm font-mono p-4 bg-white/70 dark:bg-darkbg-subtle border border-coconut-200 dark:border-darkbg-border rounded-2xl outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-coconut-950 dark:text-darkbg-text leading-relaxed resize-none shadow-inner font-medium"
                    />

                    {/* 操作按钮组 */}
                    {ocrEditableText && (
                      <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                        <button
                          onClick={handleCopyOcrText}
                          className="flex items-center gap-1.5 py-2 px-3.5 rounded-xl border border-coconut-200 dark:border-darkbg-border bg-white dark:bg-darkbg-card hover:bg-coconut-50 text-coconut-700 dark:text-darkbg-text text-xs font-semibold transition-all active:scale-95"
                        >
                          {ocrCopied ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-palm-500" />
                              <span className="text-palm-600">{lang === "en" ? "Copied to Clipboard" : "已复制到剪贴板"}</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>{lang === "en" ? "Copy Full Text" : "一键复制全文"}</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={handleDownloadOcrTxt}
                          className="btn-3d-sunset flex items-center gap-1.5 py-2 px-3.5 rounded-xl text-white text-xs font-semibold"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>{lang === "en" ? "Export as TXT" : "导出为 TXT 文件"}</span>
                        </button>

                        <SendToButton
                          category="text"
                          payload={{
                            text: ocrEditableText,
                            sourceTitle: "AI 文字提取 (OCR)",
                          }}
                          lang={lang}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 模块 3: AI 模糊图片高清修复与超分辨率                                       */}
      {/* ========================================================================= */}
      {activeTab === "ai-upscale" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* 左侧控制台 */}
          <div className="lg:col-span-5 coconut-panel p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-coconut-200/80 dark:border-darkbg-border">
              <div className="flex items-center gap-2 text-sm font-bold text-coconut-950 dark:text-darkbg-text">
                <Sliders className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                <span>{lang === "en" ? "Enhance & Upscale Scale" : "修复与增强倍率"}</span>
              </div>
            </div>

            {/* 放大倍率选择 */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-coconut-900 dark:text-darkbg-text">
                {lang === "en" ? "Upscale Resolution Scale" : "分辨率超清放大倍率"}
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  {
                    scale: 2 as const,
                    label: lang === "en" ? "2x Upscale" : "2x 超清放大",
                    badge: lang === "en" ? "Recommended" : "推荐",
                  },
                  {
                    scale: 4 as const,
                    label: lang === "en" ? "4x Ultra HD" : "4x 极致超清",
                    badge: lang === "en" ? "Large" : "大图",
                  },
                  {
                    scale: 1 as const,
                    label: lang === "en" ? "1x Sharpen" : "1x 原图锐化",
                    badge: lang === "en" ? "Deblur" : "去模糊",
                  },
                ].map((item) => (
                  <button
                    key={item.scale}
                    type="button"
                    onClick={() => setUpscaleScale(item.scale)}
                    className={`py-3 px-2 rounded-2xl border text-center transition-all ${
                      upscaleScale === item.scale
                        ? "border-orange-500 bg-orange-50/70 dark:bg-orange-950/40 text-coconut-950 dark:text-darkbg-text font-bold shadow-sm ring-1 ring-orange-400/30"
                        : "border-coconut-200 dark:border-darkbg-border text-coconut-700 dark:text-darkbg-muted hover:bg-coconut-100/50"
                    }`}
                  >
                    <div className="text-xs sm:text-sm font-bold">{item.label}</div>
                    <div className="text-xs text-orange-600 dark:text-orange-400 mt-0.5 font-mono font-semibold">
                      {item.badge}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 锐化强度滑块 */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm font-semibold text-coconut-900 dark:text-darkbg-text">
                <span>{lang === "en" ? "Edge & Texture Sharpening" : "边缘与纹理锐化强度"}</span>
                <span className="font-mono font-bold text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded-lg bg-orange-500/10 border border-orange-500/20">{upscaleSharpness.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="2.0"
                step="0.1"
                value={upscaleSharpness}
                onChange={(e) => setUpscaleSharpness(parseFloat(e.target.value))}
                className="w-full accent-orange-600 cursor-pointer h-2 bg-coconut-200 dark:bg-darkbg-border rounded-lg appearance-none"
              />
              <div className="flex justify-between text-xs text-coconut-500 dark:text-darkbg-muted font-medium">
                <span>{lang === "en" ? "Soft Natural" : "柔和自然"}</span>
                <span>{lang === "en" ? "Balanced Clear" : "平衡清晰"}</span>
                <span>{lang === "en" ? "Ultra Sharp" : "极致锋利"}</span>
              </div>
            </div>

            {/* 降噪与对比度开关 */}
            <div className="space-y-3 pt-2 border-t border-coconut-100 dark:border-darkbg-border">
              <label className="flex items-center justify-between text-sm font-semibold cursor-pointer text-coconut-900 dark:text-darkbg-text">
                <span>{lang === "en" ? "JPEG Noise & Artifact Reduction" : "JPEG 噪点与伪影消除"}</span>
                <input
                  type="checkbox"
                  checked={upscaleDenoise}
                  onChange={(e) => setUpscaleDenoise(e.target.checked)}
                  className="rounded text-orange-600 focus:ring-orange-500 w-4 h-4 cursor-pointer accent-orange-600"
                />
              </label>

              <label className="flex items-center justify-between text-sm font-semibold cursor-pointer text-coconut-900 dark:text-darkbg-text">
                <span>{lang === "en" ? "Auto De-haze & Contrast Stretch" : "智能去雾与通透感拉伸"}</span>
                <input
                  type="checkbox"
                  checked={upscaleContrast}
                  onChange={(e) => setUpscaleContrast(e.target.checked)}
                  className="rounded text-orange-600 focus:ring-orange-500 w-4 h-4 cursor-pointer accent-orange-600"
                />
              </label>
            </div>

            {/* 修复执行按钮 */}
            <button
              onClick={handleExecuteUpscale}
              disabled={upscaleLoading || !upscaleFile}
              className={`w-full py-3.5 px-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                upscaleLoading || !upscaleFile
                  ? "bg-coconut-100 dark:bg-darkbg-subtle text-coconut-400 dark:text-darkbg-muted cursor-not-allowed border border-coconut-200 dark:border-darkbg-border"
                  : "btn-3d-sunset text-white"
              }`}
            >
              {upscaleLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>
                    {lang === "en"
                      ? `Resampling in Ultra HD (${upscaleProgress}%)...`
                      : `正在超清重采样 (${upscaleProgress}%)...`}
                  </span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-4 h-4 text-amber-200" />
                  <span>{lang === "en" ? "Start AI HD Upscale & Enhance" : "立即执行 AI 高清修复增强"}</span>
                </>
              )}
            </button>
          </div>

          {/* 右侧展示与对比工作台 */}
          <div className="lg:col-span-7 space-y-5">
            {!upscaleFile ? (
              <div className="bg-[#FAF1E8]/75 dark:bg-[#251E1A]/70 border-2 border-dashed border-[#D2BCAB] dark:border-[#4D392E] hover:border-amber-500 dark:hover:border-amber-400 rounded-3xl p-10 text-center transition-all cursor-pointer relative group">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/bmp"
                  onChange={handleUpscaleFileSelect}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="w-14 h-14 mx-auto rounded-2xl bg-coconut-100/80 dark:bg-darkbg-subtle flex items-center justify-center text-coconut-600 dark:text-darkbg-muted group-hover:scale-110 group-hover:text-amber-600 transition-all mb-4">
                  <UploadCloud className="w-7 h-7" />
                </div>
                <h4 className="text-sm font-bold text-coconut-900 dark:text-darkbg-text mb-1">
                  {lang === "en"
                    ? "Drag blurry or low-res image here, or click to upload"
                    : "拖入模糊或低清晰度图片，或点击上传"}
                </h4>
                <p className="text-xs text-coconut-500 dark:text-darkbg-muted max-w-sm mx-auto">
                  {lang === "en"
                    ? "Supports old photos, low-res avatars, compressed blurry images, game screenshots, and icon sharpening"
                    : "支持老照片、低清头像、微信压缩糊图、游戏截图与图标锐化"}
                </p>
              </div>
            ) : (
              <div className="coconut-panel p-5 sm:p-6 space-y-4">
                {/* 状态栏 */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-coconut-100 dark:border-darkbg-border text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-coconut-900 dark:text-darkbg-text">
                      {upscaleFile.name}
                    </span>
                    <span className="text-coconut-400 font-mono">
                      ({formatBytes(upscaleFile.size)})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-coconut-600 dark:text-darkbg-muted hover:text-palm-600 cursor-pointer font-medium">
                      {lang === "en" ? "Change Image" : "更换图片"}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleUpscaleFileSelect}
                        className="hidden"
                      />
                    </label>
                    <button
                      onClick={() => {
                        setUpscaleFile(null);
                        setUpscalePreviewUrl(null);
                        setUpscaleResult(null);
                        setUpscaleResultUrl(null);
                      }}
                      className="text-toast-500 hover:text-toast-600 flex items-center gap-1 font-medium"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{lang === "en" ? "Clear" : "清空"}</span>
                    </button>
                  </div>
                </div>

                {/* 进度指示 */}
                {upscaleLoading && (
                  <div className="p-4 bg-coconut-50 dark:bg-darkbg-subtle rounded-2xl border border-coconut-200 dark:border-darkbg-border space-y-2">
                    <div className="flex justify-between text-xs text-coconut-700 dark:text-darkbg-muted">
                      <span className="font-medium flex items-center gap-1.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-palm-600" />
                        <span>
                          {localizeAiStage(upscaleStage) ||
                            (lang === "en" ? "Rendering ultra-resolution pixels..." : "正在逐像素超分辨率渲染...")}
                        </span>
                      </span>
                      <span className="font-mono font-bold text-palm-600">{upscaleProgress}%</span>
                    </div>
                    <div className="w-full h-2.5 bg-coconut-200 dark:bg-darkbg-border rounded-full overflow-hidden p-0.5">
                      <div
                        className="h-full progress-sunset-striped rounded-full transition-all duration-300"
                        style={{ width: `${upscaleProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {upscaleError && (
                  <div className="p-3 bg-toast-50 dark:bg-toast-950/40 border border-toast-200 dark:border-toast-900/60 rounded-2xl flex items-center gap-2 text-toast-700 dark:text-toast-300 text-xs">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 text-toast-500" />
                    <span>{upscaleError}</span>
                  </div>
                )}

                {/* 对比展示画布 */}
                <div className="relative w-full min-h-[360px] max-h-[520px] flex items-center justify-center rounded-2xl overflow-hidden border border-coconut-200/80 dark:border-darkbg-border bg-[#121212]/5 dark:bg-darkbg-subtle">
                  {!upscaleResultUrl && upscalePreviewUrl && (
                    <img
                      src={upscalePreviewUrl}
                      alt={lang === "en" ? "Original Preview" : "原图预览"}
                      className="max-w-full max-h-[480px] object-contain shadow-md rounded-lg"
                    />
                  )}

                  {upscaleResultUrl && upscalePreviewUrl && (
                    <div className="relative w-full h-[460px] select-none overflow-hidden flex items-center justify-center">
                      {/* 底层：原图 */}
                      <img
                        src={upscalePreviewUrl}
                        alt={lang === "en" ? "Original" : "原图"}
                        className="absolute max-h-[440px] max-w-full object-contain"
                      />

                      {/* 顶层：修复后效果 */}
                      <div
                        className="absolute inset-0 flex items-center justify-center overflow-hidden"
                        style={{
                          clipPath: `polygon(0 0, ${upscaleSlider}% 0, ${upscaleSlider}% 100%, 0 100%)`,
                        }}
                      >
                        <img
                          src={upscaleResultUrl}
                          alt={lang === "en" ? "Ultra HD Result" : "超清修复效果"}
                          className="max-h-[440px] max-w-full object-contain"
                        />
                      </div>

                      {/* 中间分割线 */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-md z-20 pointer-events-none"
                        style={{ left: `${upscaleSlider}%` }}
                      >
                        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-7 h-7 bg-white dark:bg-coconut-900 border border-coconut-300 rounded-full flex items-center justify-center shadow-lg text-[10px] text-coconut-700 dark:text-darkbg-text font-bold">
                          <SplitSquareHorizontal className="w-3.5 h-3.5" />
                        </div>
                      </div>

                      <div className="absolute top-3 left-3 px-2.5 py-1 rounded-xl bg-palm-900/80 text-palm-200 text-[10px] font-mono backdrop-blur-sm z-20">
                        {lang === "en"
                          ? `Ultra HD Result (${upscaleResult?.newWidth}×${upscaleResult?.newHeight})`
                          : `修复后超清效果 (${upscaleResult?.newWidth}×${upscaleResult?.newHeight})`}
                      </div>
                      <div className="absolute top-3 right-3 px-2.5 py-1 rounded-xl bg-black/60 text-white text-[10px] font-mono backdrop-blur-sm z-20">
                        {lang === "en"
                          ? `Original Low-Res (${upscaleResult?.originalWidth}×${upscaleResult?.originalHeight})`
                          : `原始低清 (${upscaleResult?.originalWidth}×${upscaleResult?.originalHeight})`}
                      </div>
                    </div>
                  )}
                </div>

                {/* 对比滑块 */}
                {upscaleResultUrl && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-xs text-coconut-600 dark:text-darkbg-muted">
                      <span>{lang === "en" ? "Slide to compare before and after details" : "滑动分割线对比超清修复前后细节"}</span>
                      <span className="font-mono">{upscaleSlider}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={upscaleSlider}
                      onChange={(e) => setUpscaleSlider(parseInt(e.target.value))}
                      className="w-full accent-palm-600 cursor-pointer"
                    />
                  </div>
                )}

                {/* 底部下载 */}
                {upscaleResult && (
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-coconut-100 dark:border-darkbg-border">
                    <div className="text-xs text-coconut-600 dark:text-darkbg-muted">
                      <span>{lang === "en" ? "Output Resolution: " : "输出分辨率: "}</span>
                      <span className="font-mono font-bold text-coconut-900 dark:text-darkbg-text">
                        {upscaleResult.newWidth} × {upscaleResult.newHeight} px
                      </span>
                      <span className="text-coconut-400 ml-1">
                        ({formatBytes(upscaleResult.blob.size)})
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {upscalePreviewUrl && upscaleResultUrl && (
                        <button
                          onClick={() => {
                            if (!upscaleFile || !upscalePreviewUrl || !upscaleResultUrl || !upscaleResult) return;
                            setCompareModalItem({
                              originalName: upscaleFile.name,
                              originalSize: upscaleFile.size,
                              originalUrl: upscalePreviewUrl,
                              newFilename: `XC_UltraClear_${upscaleResult.scaleFactor}x_${upscaleFile.name.replace(/\.[^/.]+$/, "")}.png`,
                              newSize: upscaleResult.blob.size,
                              previewUrl: upscaleResultUrl,
                              blob: upscaleResult.blob,
                              extraInfo: `${upscaleResult.originalWidth}×${upscaleResult.originalHeight} → ${upscaleResult.newWidth}×${upscaleResult.newHeight} (${upscaleResult.scaleFactor}x HD)`,
                            });
                          }}
                          className="flex items-center gap-1.5 py-2.5 px-3.5 rounded-2xl bg-coconut-100 dark:bg-darkbg-elevated text-coconut-800 dark:text-darkbg-text font-bold text-xs transition-all hover:bg-coconut-200 active:scale-95 shadow-sm"
                        >
                          <SlidersHorizontal className="w-3.5 h-3.5 text-palm-600" />
                          <span>{lang === "en" ? "Interactive Inspection" : "微距画质对比"}</span>
                        </button>
                      )}

                      <button
                        onClick={handleDownloadUpscaleResult}
                        className="btn-3d-sunset flex items-center gap-2 py-2.5 px-5 rounded-2xl text-white font-bold text-xs shadow-coconut-sm"
                      >
                        <Download className="w-4 h-4" />
                        <span>
                          {lang === "en"
                            ? `Download Lossless HD (${upscaleResult.scaleFactor}x PNG)`
                            : `下载无损超清图 (${upscaleResult.scaleFactor}x PNG)`}
                        </span>
                      </button>

                      {upscaleResult && upscaleFile && (
                        <SendToButton
                          category="image"
                          payload={{
                            blob: upscaleResult.blob,
                            filename: `XC_UltraClear_${upscaleResult.scaleFactor}x_${upscaleFile.name.replace(/\.[^/.]+$/, "")}.png`,
                            sourceTitle: "AI 高清修复",
                          }}
                          lang={lang}
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Squoosh 风格画质微距对比弹窗 */}
      <ImageCompareModal
        isOpen={!!compareModalItem}
        onClose={() => setCompareModalItem(null)}
        item={compareModalItem}
      />
    </div>
  );
}
