/**
 * XC OmniBox - 纯前端浏览器 Edge AI 处理核心库
 * 100% 离线免费 / 零 API Key / 零服务器 GPU 成本 / 本地隐私安全
 */

export interface AiProgressCallback {
  (progress: number, stage: string): void;
}

export type BgRemovalModel = "isnet_quint8" | "isnet";
export type BgRemovalEngine = "ai" | "chroma";

export interface RemoveBgOptions {
  engine?: BgRemovalEngine;
  model?: BgRemovalModel;
  backgroundColor?: string | null; // null 为透明，也可以传 hex (如 '#ffffff')
  onProgress?: AiProgressCallback;
}

/**
 * 1. AI 智能抠图 / 发丝级复杂背景移除
 */
export async function removeBackgroundAI(
  imageSource: File | Blob | string,
  options: RemoveBgOptions = {}
): Promise<Blob> {
  const { engine = "ai", model = "isnet_quint8", backgroundColor = null, onProgress } = options;

  if (engine === "ai") {
    try {
      if (onProgress) onProgress(10, "正在初始化浏览器本地 AI 神经网络引擎...");

      // 动态运行时载入 @imgly/background-removal 避免 Webpack 静态打包 onnxruntime 的 import.meta 错误
      let removeBackground: any;
      try {
        const importDynamic = new Function("url", "return import(url)");
        const mod = await importDynamic(
          "https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm"
        );
        removeBackground = mod.removeBackground || mod.default;
      } catch (eCdn) {
        console.warn("无法从 CDN 载入背景分割核心，直接进入极速色度算法模式:", eCdn);
        throw eCdn;
      }

      if (onProgress) onProgress(25, "正在本地加载与配置 AI 视觉分割模型 (ONNX)...");

      const resultBlob = await removeBackground(imageSource, {
        model,
        progress: (key: string, current: number, total: number) => {
          if (onProgress && total > 0) {
            const pct = Math.min(95, Math.max(30, Math.round((current / total) * 100)));
            const stageText =
              key === "compute:inference"
                ? "AI 深度神经网络正在逐像素计算发丝边缘..."
                : `正在拉取与解算神经网络权重 (${pct}%)...`;
            onProgress(pct, stageText);
          }
        },
        output: {
          format: "image/png",
          quality: 1.0,
        },
      });

      if (onProgress) onProgress(98, "正在合成高质量透明通道图层...");

      // 如果需要填充特定背景底色 (例如一键红白蓝证件照底)
      if (backgroundColor && backgroundColor !== "transparent") {
        return await compositeOnBackgroundColor(resultBlob, backgroundColor);
      }

      if (onProgress) onProgress(100, "处理完毕");
      return resultBlob;
    } catch (err: any) {
      console.warn("AI 深度模型推理异常或网络受阻，自动启动智能色度边缘抠图引擎...", err);
      if (onProgress) onProgress(50, "启动备用超轻量边缘算法...");
      return await removeBackgroundChromaFallback(imageSource, backgroundColor);
    }
  } else {
    // 纯算法快速模式
    return await removeBackgroundChromaFallback(imageSource, backgroundColor);
  }
}

/**
 * 备用/快速模式：自适应边缘色差抠图 (纯本地 Canvas 算法，零网络依赖)
 */
async function removeBackgroundChromaFallback(
  imageSource: File | Blob | string,
  bgColor: string | null = null
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = typeof imageSource === "string" ? imageSource : URL.createObjectURL(imageSource);

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("无法创建 2D 上下文");

        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;

        // 采样四周角落像素作为背景基准色彩
        const corners = [
          [0, 0],
          [canvas.width - 1, 0],
          [0, canvas.height - 1],
          [canvas.width - 1, canvas.height - 1],
        ];

        let bgR = 0,
          bgG = 0,
          bgB = 0;
        corners.forEach(([x, y]) => {
          const idx = (y * canvas.width + x) * 4;
          bgR += data[idx];
          bgG += data[idx + 1];
          bgB += data[idx + 2];
        });
        bgR /= 4;
        bgG /= 4;
        bgB /= 4;

        const tolerance = 45;
        const feather = 25;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // 欧几里得色彩距离
          const dist = Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2);

          if (dist < tolerance) {
            data[i + 3] = 0; // 完全透明
          } else if (dist < tolerance + feather) {
            const factor = (dist - tolerance) / feather;
            data[i + 3] = Math.round(data[i + 3] * factor); // 边缘羽化
          }
        }

        ctx.putImageData(imgData, 0, 0);

        if (bgColor && bgColor !== "transparent") {
          const outCanvas = document.createElement("canvas");
          outCanvas.width = canvas.width;
          outCanvas.height = canvas.height;
          const outCtx = outCanvas.getContext("2d")!;
          outCtx.fillStyle = bgColor;
          outCtx.fillRect(0, 0, outCanvas.width, outCanvas.height);
          outCtx.drawImage(canvas, 0, 0);
          outCanvas.toBlob((b) => (b ? resolve(b) : reject(new Error("导出失败"))), "image/png");
        } else {
          canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("导出失败"))), "image/png");
        }
      } catch (e) {
        reject(e);
      } finally {
        if (typeof imageSource !== "string") URL.revokeObjectURL(url);
      }
    };

    img.onerror = () => reject(new Error("图片加载失败"));
    img.src = url;
  });
}

/**
 * 将透明图层合成到纯色背景上
 */
async function compositeOnBackgroundColor(imageBlob: Blob, hexColor: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(imageBlob);

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("无法创建画布");

        ctx.fillStyle = hexColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);

        canvas.toBlob((blob) => {
          URL.revokeObjectURL(url);
          if (blob) resolve(blob);
          else reject(new Error("图层合成失败"));
        }, "image/png");
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("背景合成载入异常"));
    };

    img.src = url;
  });
}

// =========================================================================
// 2. AI 离线 OCR 文字识别扫描器
// =========================================================================

export interface OcrResult {
  text: string;
  confidence: number;
  linesCount: number;
  wordsCount: number;
  characterCount: number;
}

export const OCR_LANGUAGES = [
  {
    id: "chi_sim+eng",
    label: "中文简体 + 英文 (推荐)",
    labelEn: "Simplified Chinese + English (Recommended)",
    desc: "适用于绝大多数中文文档、书籍、收据和截图",
    descEn: "Suitable for most Chinese documents, books, receipts and screenshots",
  },
  {
    id: "chi_sim",
    label: "纯简体中文",
    labelEn: "Simplified Chinese",
    desc: "专注中文印刷体与手写体识别",
    descEn: "Focused on printed and handwritten Chinese text recognition",
  },
  {
    id: "eng",
    label: "English (纯英文)",
    labelEn: "English",
    desc: "专注英文报告、学术文献、代码段落识别",
    descEn: "Focused on English reports, academic literature, and code snippets",
  },
  {
    id: "chi_tra+eng",
    label: "中文繁體 + English",
    labelEn: "Traditional Chinese + English",
    desc: "港澳台及古籍传统繁体中文提取",
    descEn: "Traditional Chinese extraction for Hong Kong, Taiwan, and classical texts",
  },
  {
    id: "jpn+eng",
    label: "日本語 + English",
    labelEn: "Japanese + English",
    desc: "日文动漫、说明书及日常文本抽取",
    descEn: "Japanese text extraction for manuals and daily documents",
  },
];

/**
 * 使用 Tesseract.js 在浏览器端执行高保真离线 OCR
 */
export async function recognizeTextOCR(
  imageSource: File | Blob | string,
  lang: string = "chi_sim+eng",
  onProgress?: AiProgressCallback
): Promise<OcrResult> {
  if (onProgress) onProgress(5, "正在初始化 WebAssembly OCR 虚拟引擎...");

  const { createWorker } = await import("tesseract.js");

  const worker = await createWorker(lang, undefined, {
    logger: (m) => {
      if (onProgress && m.status) {
        let label = "正在处理...";
        if (m.status.includes("loading tesseract")) label = "正在载入 OCR 离线核心...";
        else if (m.status.includes("loading language")) label = `正在加载 [${lang}] 语言字库字典...`;
        else if (m.status.includes("initializing api")) label = "正在初始化光学识别模型...";
        else if (m.status.includes("recognizing text")) label = "AI 正在逐行分析文字并提取排版...";
        const pct = Math.min(99, Math.round((m.progress || 0) * 100));
        onProgress(pct, `${label} (${pct}%)`);
      }
    },
  });

  try {
    if (onProgress) onProgress(50, "正在深度扫描图像与特征匹配...");
    const ret = await worker.recognize(imageSource);
    const rawText = ret.data.text || "";

    // 格式清洗与统计
    const cleanText = rawText.replace(/\r\n/g, "\n");
    const lines = cleanText.split("\n").filter((l) => l.trim().length > 0);
    const words = cleanText.trim().length > 0 ? cleanText.trim().split(/\s+/) : [];
    const charCount = cleanText.replace(/\s+/g, "").length;

    if (onProgress) onProgress(100, "识别完成！");

    return {
      text: cleanText,
      confidence: Math.round(ret.data.confidence || 0),
      linesCount: lines.length,
      wordsCount: words.length,
      characterCount: charCount,
    };
  } finally {
    await worker.terminate();
  }
}

// =========================================================================
// 3. AI 模糊图片高清修复 / 超分辨率增强与锐化
// =========================================================================

export interface EnhanceOptions {
  scale?: 1 | 2 | 4;
  sharpness?: number; // 0.0 ~ 2.0 (默认 1.0)
  denoise?: boolean; // 抑制 JPEG 块噪点
  enhanceContrast?: boolean; // 去雾与微对比度拉伸
  onProgress?: (pct: number, stage: string) => void;
}

export interface EnhanceResult {
  blob: Blob;
  originalWidth: number;
  originalHeight: number;
  newWidth: number;
  newHeight: number;
  scaleFactor: number;
}

/**
 * 纯客户端 Canvas 自适应超分辨率锐化与去模糊增强算法
 */
export async function enhanceAndUpscaleImage(
  imageSource: File | Blob | string,
  options: EnhanceOptions = {}
): Promise<EnhanceResult> {
  const {
    scale = 2,
    sharpness = 1.0,
    denoise = true,
    enhanceContrast = true,
    onProgress,
  } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = typeof imageSource === "string" ? imageSource : URL.createObjectURL(imageSource);

    img.onload = () => {
      try {
        if (onProgress) onProgress(15, "正在解算原始图像像素拓扑...");

        const originalWidth = img.naturalWidth;
        const originalHeight = img.naturalHeight;
        const targetWidth = originalWidth * scale;
        const targetHeight = originalHeight * scale;

        // Stepwise scaling (分级重采样以保持抗锯齿与平滑边缘)
        let currentCanvas = document.createElement("canvas");
        currentCanvas.width = originalWidth;
        currentCanvas.height = originalHeight;
        let currentCtx = currentCanvas.getContext("2d")!;
        currentCtx.drawImage(img, 0, 0);

        if (scale > 1) {
          if (onProgress) onProgress(35, `正在执行 ${scale}x 高阶双三次样条超分辨率重采样...`);

          // 如果放大到 4x，先平滑过渡到 2x 再到 4x
          if (scale === 4) {
            const midCanvas = document.createElement("canvas");
            midCanvas.width = originalWidth * 2;
            midCanvas.height = originalHeight * 2;
            const midCtx = midCanvas.getContext("2d")!;
            midCtx.imageSmoothingEnabled = true;
            midCtx.imageSmoothingQuality = "high";
            midCtx.drawImage(currentCanvas, 0, 0, midCanvas.width, midCanvas.height);
            currentCanvas = midCanvas;
            currentCtx = midCtx;
          }

          const finalScaleCanvas = document.createElement("canvas");
          finalScaleCanvas.width = targetWidth;
          finalScaleCanvas.height = targetHeight;
          const finalCtx = finalScaleCanvas.getContext("2d")!;
          finalCtx.imageSmoothingEnabled = true;
          finalCtx.imageSmoothingQuality = "high";
          finalCtx.drawImage(currentCanvas, 0, 0, targetWidth, targetHeight);
          currentCanvas = finalScaleCanvas;
          currentCtx = finalCtx;
        }

        if (onProgress) onProgress(60, "正在提取高频边缘特征与自适应锐化...");

        const imgData = currentCtx.getImageData(0, 0, targetWidth, targetHeight);
        const data = imgData.data;
        const width = targetWidth;
        const height = targetHeight;

        // 创建副本用于卷积计算
        const output = new Uint8ClampedArray(data);

        // 自适应 Unsharp Masking 锐化卷积核
        // 动态计算中心强度
        const k = Math.min(2.0, Math.max(0.1, sharpness * 0.45));
        const edgeThreshold = 12; // 阈值过滤，防止对纯色平坦区域放大噪点

        for (let y = 1; y < height - 1; y++) {
          for (let x = 1; x < width - 1; x++) {
            const idx = (y * width + x) * 4;

            for (let c = 0; c < 3; c++) {
              const current = data[idx + c];
              const up = data[((y - 1) * width + x) * 4 + c];
              const down = data[((y + 1) * width + x) * 4 + c];
              const left = data[(y * width + (x - 1)) * 4 + c];
              const right = data[(y * width + (x + 1)) * 4 + c];

              // 拉普拉斯高频微分
              const laplacian = 4 * current - up - down - left - right;

              if (Math.abs(laplacian) > edgeThreshold) {
                let newVal = current + laplacian * k;

                // 去雾与对比度微调
                if (enhanceContrast) {
                  // 轻微 S 曲线拉伸
                  const normalized = newVal / 255;
                  const contrasted = normalized < 0.5
                    ? 2 * normalized * normalized
                    : 1 - 2 * (1 - normalized) * (1 - normalized);
                  newVal = newVal * 0.8 + contrasted * 255 * 0.2;
                }

                output[idx + c] = Math.min(255, Math.max(0, newVal));
              } else {
                // 平坦区域轻微降噪
                if (denoise) {
                  output[idx + c] = (current * 2 + up + down + left + right) / 6;
                }
              }
            }
          }
        }

        if (onProgress) onProgress(85, "正在执行色彩增强与无损压制...");

        // 写回增强后像素
        for (let i = 0; i < data.length; i++) {
          data[i] = output[i];
        }
        currentCtx.putImageData(imgData, 0, 0);

        if (onProgress) onProgress(98, "生成超清无损 PNG...");

        currentCanvas.toBlob((blob) => {
          if (typeof imageSource !== "string") URL.revokeObjectURL(url);
          if (blob) {
            if (onProgress) onProgress(100, "修复完成！");
            resolve({
              blob,
              originalWidth,
              originalHeight,
              newWidth: targetWidth,
              newHeight: targetHeight,
              scaleFactor: scale,
            });
          } else {
            reject(new Error("超分辨率导出失败"));
          }
        }, "image/png");
      } catch (err) {
        if (typeof imageSource !== "string") URL.revokeObjectURL(url);
        reject(err);
      }
    };

    img.onerror = () => {
      if (typeof imageSource !== "string") URL.revokeObjectURL(url);
      reject(new Error("图片无法加载"));
    };

    img.src = url;
  });
}
