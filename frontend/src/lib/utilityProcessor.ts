import QRCode from "qrcode";
import { diffLines, diffWordsWithSpace, Change } from "diff";
import jsQR from "jsqr";
import { loadImageFromFile } from "./imageProcessor";

// ==========================================
// 1. 证件照换底色与 6寸相纸 9 宫格排版
// ==========================================

export interface IdPhotoSpec {
  name: string;
  nameEn?: string;
  width: number;
  height: number;
  mmWidth: number;
  mmHeight: number;
  suggestKb?: string;
}

export const ID_SPECS: Record<string, IdPhotoSpec> = {
  ONE_INCH: { name: "标准 1 寸 (简历/驾照/学生证)", nameEn: "Standard 1-Inch", width: 295, height: 413, mmWidth: 25, mmHeight: 35 },
  TWO_INCH: { name: "标准 2 寸 (毕业证/资格证书)", nameEn: "Standard 2-Inch", width: 413, height: 579, mmWidth: 35, mmHeight: 49 },
  SMALL_TWO: { name: "小 2 寸 (护照/港澳通行证/签证)", nameEn: "Small 2-Inch (Passport/Visa)", width: 390, height: 567, mmWidth: 33, mmHeight: 48 },
  TEACHER: { name: "教师资格证考试 (295x413, <200KB)", nameEn: "Teacher Qualification", width: 295, height: 413, mmWidth: 25, mmHeight: 35, suggestKb: "200" },
  CIVIL_SERVANT: { name: "国家公务员考试 (国考 30~100KB)", nameEn: "Civil Servant Exam", width: 295, height: 413, mmWidth: 25, mmHeight: 35, suggestKb: "100" },
  CET: { name: "全国英语四六级 (CET 240x320)", nameEn: "CET 4/6 Exam", width: 240, height: 320, mmWidth: 20, mmHeight: 27, suggestKb: "200" },
  NCRE: { name: "全国计算机二级 (NCRE 144x192)", nameEn: "NCRE Exam", width: 144, height: 192, mmWidth: 12, mmHeight: 16, suggestKb: "100" },
  SOCIAL_SECURITY: { name: "电子社保卡 / 医保凭证 (358x441)", nameEn: "Social Security Card", width: 358, height: 441, mmWidth: 26, mmHeight: 32, suggestKb: "100" },
  DRIVER: { name: "驾驶证申领 (260x378)", nameEn: "Driver's License", width: 260, height: 378, mmWidth: 22, mmHeight: 32 },
};

export const BG_COLORS = [
  { id: "white", name: "标准白底 (日常/驾照/简历)", nameEn: "White (Driver's / Resume)", hex: "#FFFFFF" },
  { id: "blue", name: "标准蓝底 (毕业证/社保卡/考试)", nameEn: "Blue (Diploma / Social / Exam)", hex: "#438EDB" },
  { id: "red", name: "标准红底 (结婚登记/党政/工会)", nameEn: "Red (Official / Marriage / Union)", hex: "#D92B2B" },
  { id: "sky", name: "清爽天蓝 (求职简历/形象照)", nameEn: "Sky Blue (Resume / Profile)", hex: "#7EC4F8" },
  { id: "darkblue", name: "深蓝沉稳 (资格认证/外企)", nameEn: "Navy Blue (Certification)", hex: "#1B4F8B" },
  { id: "gray", name: "高级商务灰 (形象/职场/领英)", nameEn: "Business Gray (Profile / LinkedIn)", hex: "#8E9EAB" },
];

/**
 * 目标 KB 大小智能压缩 (二分逼近)
 */
export async function compressCanvasToTargetKb(
  canvas: HTMLCanvasElement,
  targetKb: number = 0
): Promise<{ blob: Blob; size: number; quality: number }> {
  if (!targetKb || targetKb <= 0) {
    const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/jpeg", 0.95));
    return { blob, size: blob.size, quality: 0.95 };
  }

  const targetBytes = targetKb * 1024;
  let minQ = 0.05;
  let maxQ = 0.98;
  let bestBlob: Blob | null = null;
  let bestQuality = 0.85;

  for (let i = 0; i < 7; i++) {
    const q = (minQ + maxQ) / 2;
    const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/jpeg", q));
    bestBlob = blob;
    bestQuality = q;
    if (blob.size > targetBytes) {
      maxQ = q;
    } else {
      minQ = q;
    }
  }

  return { blob: bestBlob!, size: bestBlob!.size, quality: +bestQuality.toFixed(2) };
}

/**
 * 证件照智能换底色 (基于边缘主色取样与容差羽化，支持目标尺寸裁切与目标 KB 限制)
 */
export async function replacePhotoBackground(
  file: File,
  targetBgHex: string,
  tolerance: number = 30, // 容差阈值
  feather: number = 15, // 羽化宽度
  spec?: IdPhotoSpec,
  targetKb?: number
): Promise<{ blob: Blob; size: number; quality: number; width: number; height: number }> {
  const img = await loadImageFromFile(file);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法初始化画布");

  ctx.drawImage(img, 0, 0);
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;

  // 1. 取样四个角的平均颜色作为原背景色
  const samples = [
    [0, 0],
    [canvas.width - 1, 0],
    [0, Math.min(20, canvas.height - 1)],
    [canvas.width - 1, Math.min(20, canvas.height - 1)],
  ];
  let bgR = 0,
    bgG = 0,
    bgB = 0;
  for (const [sx, sy] of samples) {
    const idx = (sy * canvas.width + sx) * 4;
    bgR += data[idx];
    bgG += data[idx + 1];
    bgB += data[idx + 2];
  }
  bgR /= samples.length;
  bgG /= samples.length;
  bgB /= samples.length;

  // 解析目标颜色 HEX
  const parseHex = (hex: string) => {
    const c = hex.replace("#", "");
    return [parseInt(c.substring(0, 2), 16), parseInt(c.substring(2, 4), 16), parseInt(c.substring(4, 6), 16)];
  };
  const [targR, targG, targB] = parseHex(targetBgHex);

  // 2. 遍历每个像素，计算欧氏颜色距离与平滑羽化权重
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const dist = Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2);

    if (dist < tolerance) {
      // 完全属于背景色
      data[i] = targR;
      data[i + 1] = targG;
      data[i + 2] = targB;
    } else if (dist < tolerance + feather) {
      // 边缘羽化过渡区
      const ratio = (dist - tolerance) / feather; // 0 (背景) -> 1 (前景)
      data[i] = Math.round(targR * (1 - ratio) + r * ratio);
      data[i + 1] = Math.round(targG * (1 - ratio) + g * ratio);
      data[i + 2] = Math.round(targB * (1 - ratio) + b * ratio);
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // 如果指定了规格，按照居中裁切缩放到指定尺寸
  let outCanvas = canvas;
  if (spec && (spec.width !== canvas.width || spec.height !== canvas.height)) {
    outCanvas = document.createElement("canvas");
    outCanvas.width = spec.width;
    outCanvas.height = spec.height;
    const outCtx = outCanvas.getContext("2d");
    if (!outCtx) throw new Error("无法初始化目标规格画布");

    // cover 居中缩放
    const scale = Math.max(spec.width / canvas.width, spec.height / canvas.height);
    const sw = spec.width / scale;
    const sh = spec.height / scale;
    const sx = (canvas.width - sw) / 2;
    const sy = Math.max(0, (canvas.height - sh) * 0.2); // 人像顶部略微保留更多留白

    outCtx.drawImage(canvas, sx, sy, sw, sh, 0, 0, spec.width, spec.height);
  }

  const { blob, size, quality } = await compressCanvasToTargetKb(outCanvas, targetKb || 0);
  return { blob, size, quality, width: outCanvas.width, height: outCanvas.height };
}

/**
 * 生成 6 寸冲印相纸 (1200 x 1800 px, 300 DPI) 排版大图 (含裁切辅助线)
 */
export async function generatePrintSheet(
  photoBlob: Blob,
  spec: IdPhotoSpec
): Promise<{ blob: Blob; filename: string }> {
  const photo = await loadImageFromFile(photoBlob);

  // 6寸冲印标准规格 (4×6英寸，300 DPI = 1200 × 1800 px 竖版)
  const sheetW = 1200;
  const sheetH = 1800;

  const canvas = document.createElement("canvas");
  canvas.width = sheetW;
  canvas.height = sheetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法初始化相纸画布");

  // 底色纯白 (相纸白底)
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, sheetW, sheetH);

  let rows = 4;
  let cols = 2; // 默认 2列 × 4行 = 8张 (适合 1寸)

  if (spec.width === ID_SPECS.TWO_INCH.width) {
    // 2寸：2列 × 2行 = 4张
    rows = 2;
    cols = 2;
  } else if (spec.width === ID_SPECS.ONE_INCH.width) {
    // 1寸：3列 × 3行 = 9张
    rows = 3;
    cols = 3;
  }

  const pw = spec.width;
  const ph = spec.height;

  // 计算居中间距
  const totalPhotosW = cols * pw;
  const totalPhotosH = rows * ph;
  const gapX = Math.floor((sheetW - totalPhotosW) / (cols + 1));
  const gapY = Math.floor((sheetH - totalPhotosH) / (rows + 1));

  // 绘制照片与裁切辅助线
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = gapX + c * (pw + gapX);
      const y = gapY + r * (ph + gapY);

      // 绘制照片主体
      ctx.drawImage(photo, 0, 0, photo.naturalWidth, photo.naturalHeight, x, y, pw, ph);

      // 绘制照片四周裁切浅灰色辅助线
      ctx.strokeStyle = "rgba(180, 180, 180, 0.7)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]); // 虚线
      ctx.strokeRect(x, y, pw, ph);

      // 拐角十字剪切标记 (Crop marks)
      ctx.setLineDash([]);
      ctx.strokeStyle = "rgba(120, 120, 120, 0.5)";
      const markLen = 8;
      // 左上
      ctx.beginPath();
      ctx.moveTo(x - markLen, y);
      ctx.lineTo(x, y);
      ctx.moveTo(x, y - markLen);
      ctx.lineTo(x, y);
      // 右下
      ctx.moveTo(x + pw, y + ph);
      ctx.lineTo(x + pw + markLen, y + ph);
      ctx.moveTo(x + pw, y + ph);
      ctx.lineTo(x + pw, y + ph + markLen);
      ctx.stroke();
    }
  }

  // 相纸底边打印级水印提示
  ctx.fillStyle = "#94a3b8";
  ctx.font = "bold 20px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(
    `XC_OmniBox · 6寸冲印排版 (${cols * rows}张 ${spec.name}) · 300 DPI 打印级冲印相纸`,
    sheetW / 2,
    sheetH - 30
  );

  const resultBlob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), "image/jpeg", 0.98));
  return {
    blob: resultBlob,
    filename: `6inch_print_sheet_${spec.name.replace(/\s+/g, "")}_${cols * rows}pcs.jpg`,
  };
}

// ==========================================
// 2. 个性化艺术二维码生成器
// ==========================================

/** 解析 hex 颜色为 RGB 分量 */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

/** 在两个 RGB 颜色之间线性插值 */
function lerpColor(
  c1: [number, number, number],
  c2: [number, number, number],
  t: number
): string {
  const r = Math.round(c1[0] + (c2[0] - c1[0]) * t);
  const g = Math.round(c1[1] + (c2[1] - c1[1]) * t);
  const b = Math.round(c1[2] + (c2[2] - c1[2]) * t);
  return `rgb(${r},${g},${b})`;
}

export type QrDotStyle = "square" | "rounded" | "dot";

export async function generateCustomQrCode(options: {
  text: string;
  size?: number;
  fgColor?: string;
  bgColor?: string;
  gradient?: boolean;
  gradientColor?: string;
  logoFile?: File;
  errorCorrection?: "L" | "M" | "Q" | "H";
  dotStyle?: QrDotStyle;
  margin?: number;
  borderWidth?: number;
  borderColor?: string;
  borderRadius?: number;
}): Promise<{ dataUrl: string; blob: Blob }> {
  const size = options.size || 512;
  const fgColor = options.fgColor || "#000000";
  const bgColor = options.bgColor || "#FFFFFF";
  const dotStyle = options.dotStyle || "square";
  const margin = options.margin ?? 2;
  const borderWidth = options.borderWidth ?? 0;
  const borderColor = options.borderColor || fgColor;
  const borderRadius = Math.max(0, options.borderRadius ?? 0);
  const ecLevel = options.logoFile ? "H" : options.errorCorrection || "M";

  // 1. 使用 QRCode.create() 获取模块矩阵数据
  const qrData = QRCode.create(options.text, { errorCorrectionLevel: ecLevel });
  const modules = qrData.modules;
  const moduleCount = modules.size; // 模块行/列数
  const data = modules.data; // Uint8Array, 1 = dark, 0 = light

  // 2. 计算绘制参数
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法初始化二维码画布");

  // 每个模块的像素大小
  const totalModules = moduleCount + margin * 2;
  const moduleSize = size / totalModules;
  const offsetX = margin * moduleSize;
  const offsetY = margin * moduleSize;

  // 3. 绘制背景 (支持圆角/圆滑外框裁剪)
  if (borderRadius > 0) {
    ctx.beginPath();
    ctx.roundRect(0, 0, size, size, borderRadius);
    ctx.fillStyle = bgColor;
    ctx.fill();
    // 限制绘制区域，防止四周码点超出圆角边缘
    ctx.save();
    ctx.clip();
  } else {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, size, size);
  }

  // 4. 渐变色预计算
  const useGradient = options.gradient && options.gradientColor;
  let fgRgb: [number, number, number] | null = null;
  let gradRgb: [number, number, number] | null = null;
  if (useGradient) {
    fgRgb = hexToRgb(fgColor);
    gradRgb = hexToRgb(options.gradientColor!);
  }

  // 5. 逐模块绘制 (修复渐变: 只对 dark modules 着色)
  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      const isDark = data[row * moduleCount + col];
      if (!isDark) continue;

      const x = offsetX + col * moduleSize;
      const y = offsetY + row * moduleSize;

      // 计算该模块的颜色
      if (useGradient && fgRgb && gradRgb) {
        // 对角线方向渐变: 左上 → 右下
        const t = (row + col) / (2 * (moduleCount - 1));
        ctx.fillStyle = lerpColor(fgRgb, gradRgb, t);
      } else {
        ctx.fillStyle = fgColor;
      }

      // 根据样式绘制
      const gap = moduleSize * 0.05; // 微小间隙让码点独立
      const drawSize = moduleSize - gap;

      if (dotStyle === "dot") {
        // 圆形码点
        const radius = drawSize / 2;
        ctx.beginPath();
        ctx.arc(x + moduleSize / 2, y + moduleSize / 2, radius, 0, Math.PI * 2);
        ctx.fill();
      } else if (dotStyle === "rounded") {
        // 圆角方块
        const r = drawSize * 0.35;
        ctx.beginPath();
        ctx.roundRect(x + gap / 2, y + gap / 2, drawSize, drawSize, r);
        ctx.fill();
      } else {
        // 默认方块
        ctx.fillRect(x, y, moduleSize, moduleSize);
      }
    }
  }

  // 恢复画布裁剪状态
  if (borderRadius > 0) {
    ctx.restore();
  }

  // 6. 绘制边框 (支持圆滑圆角)
  if (borderWidth > 0) {
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = borderWidth;
    const bHalf = borderWidth / 2;
    const bSize = size - borderWidth;
    if (borderRadius > 0) {
      const r = Math.max(0, borderRadius - bHalf);
      ctx.beginPath();
      ctx.roundRect(bHalf, bHalf, bSize, bSize, r);
      ctx.stroke();
    } else {
      ctx.strokeRect(bHalf, bHalf, bSize, bSize);
    }
  }

  // 7. 如果嵌入 Logo
  if (options.logoFile) {
    const logo = await loadImageFromFile(options.logoFile);
    const logoSize = Math.floor(size * 0.22); // 占 22%
    const lx = (size - logoSize) / 2;
    const ly = (size - logoSize) / 2;

    // 白色圆角衬底
    const pad = 6;
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.roundRect(lx - pad, ly - pad, logoSize + pad * 2, logoSize + pad * 2, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.1)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // 绘制 Logo
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(lx, ly, logoSize, logoSize, 6);
    ctx.clip();
    ctx.drawImage(logo, lx, ly, logoSize, logoSize);
    ctx.restore();
  }

  const dataUrl = canvas.toDataURL("image/png");
  const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), "image/png"));
  return { dataUrl, blob };
}

// ==========================================
// 3. 文本与代码 Diff 对比算法
// ==========================================

export function computeTextDiff(
  oldText: string,
  newText: string,
  mode: "lines" | "words" = "lines"
): { changes: Change[]; addedCount: number; removedCount: number } {
  const changes = mode === "lines" ? diffLines(oldText, newText) : diffWordsWithSpace(oldText, newText);

  let addedCount = 0;
  let removedCount = 0;

  for (const c of changes) {
    if (c.added) addedCount += c.count || 1;
    if (c.removed) removedCount += c.count || 1;
  }

  return { changes, addedCount, removedCount };
}

// ==========================================
// 4. 开发者实用算法 (Hash / Base64 / Timestamp)
// ==========================================

/**
 * 原生 Web Crypto 计算 SHA-256 / SHA-512 / SHA-1
 */
export async function calculateHash(
  textOrBuffer: string | ArrayBuffer,
  algorithm: "SHA-256" | "SHA-512" | "SHA-1"
): Promise<string> {
  let buffer: ArrayBuffer;
  if (typeof textOrBuffer === "string") {
    buffer = new TextEncoder().encode(textOrBuffer).buffer;
  } else {
    buffer = textOrBuffer;
  }

  const hashBuffer = await crypto.subtle.digest(algorithm, buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * 纯 JS 极速 MD5 算法 (免额外依赖)
 */
export function calculateMD5(string: string): string {
  function md5cycle(x: any, k: any) {
    let a = x[0],
      b = x[1],
      c = x[2],
      d = x[3];
    a = ff(a, b, c, d, k[0], 7, -680876936);
    d = ff(d, a, b, c, k[1], 12, -389564586);
    c = ff(c, d, a, b, k[2], 17, 606105819);
    b = ff(b, c, d, a, k[3], 22, -1044525330);
    a = ff(a, b, c, d, k[4], 7, -176418897);
    d = ff(d, a, b, c, k[5], 12, 1200080426);
    c = ff(c, d, a, b, k[6], 17, -1473231341);
    b = ff(b, c, d, a, k[7], 22, -45705983);
    a = ff(a, b, c, d, k[8], 7, 1770035416);
    d = ff(d, a, b, c, k[9], 12, -1958414417);
    c = ff(c, d, a, b, k[10], 17, -42063);
    b = ff(b, c, d, a, k[11], 22, -1990404162);
    a = ff(a, b, c, d, k[12], 7, 1804603682);
    d = ff(d, a, b, c, k[13], 12, -40341101);
    c = ff(c, d, a, b, k[14], 17, -1502002290);
    b = ff(b, c, d, a, k[15], 22, 1236535329);

    a = gg(a, b, c, d, k[1], 5, -165796510);
    d = gg(d, a, b, c, k[6], 9, -1069501632);
    c = gg(c, d, a, b, k[11], 14, 643717713);
    b = gg(b, c, d, a, k[0], 20, -373897302);
    a = gg(a, b, c, d, k[5], 5, -701558691);
    d = gg(d, a, b, c, k[10], 9, 38016083);
    c = gg(c, d, a, b, k[15], 14, -660478335);
    b = gg(b, c, d, a, k[4], 20, -405537848);
    a = gg(a, b, c, d, k[9], 5, 568446438);
    d = gg(d, a, b, c, k[14], 9, -1019803690);
    c = gg(c, d, a, b, k[3], 14, -187363961);
    b = gg(b, c, d, a, k[8], 20, 1163531501);
    a = gg(a, b, c, d, k[13], 5, -1444681467);
    d = gg(d, a, b, c, k[2], 9, -51403784);
    c = gg(c, d, a, b, k[7], 14, 1735328473);
    b = gg(b, c, d, a, k[12], 20, -1926607734);

    a = hh(a, b, c, d, k[5], 4, -378558);
    d = hh(d, a, b, c, k[8], 11, -2022574463);
    c = hh(c, d, a, b, k[11], 16, 1839030562);
    b = hh(b, c, d, a, k[14], 23, -35309556);
    a = hh(a, b, c, d, k[1], 4, -1530992060);
    d = hh(d, a, b, c, k[4], 11, 1272893353);
    c = hh(c, d, a, b, k[7], 16, -155497632);
    b = hh(b, c, d, a, k[10], 23, -1094730640);
    a = hh(a, b, c, d, k[13], 4, 681279174);
    d = hh(d, a, b, c, k[0], 11, -358537222);
    c = hh(c, d, a, b, k[3], 16, -722521979);
    b = hh(b, c, d, a, k[6], 23, 76029189);
    a = hh(a, b, c, d, k[9], 4, -640364487);
    d = hh(d, a, b, c, k[12], 11, -421815835);
    c = hh(c, d, a, b, k[15], 16, 530742520);
    b = hh(b, c, d, a, k[2], 23, -995338651);

    a = ii(a, b, c, d, k[0], 6, -198630844);
    d = ii(d, a, b, c, k[7], 10, 1126891415);
    c = ii(c, d, a, b, k[14], 15, -1416354905);
    b = ii(b, c, d, a, k[5], 21, -57434055);
    a = ii(a, b, c, d, k[12], 6, 1700485571);
    d = ii(d, a, b, c, k[3], 10, -1894986606);
    c = ii(c, d, a, b, k[10], 15, -1051523);
    b = ii(b, c, d, a, k[1], 21, -2054922799);
    a = ii(a, b, c, d, k[8], 6, 1873313359);
    d = ii(d, a, b, c, k[15], 10, -30611744);
    c = ii(c, d, a, b, k[6], 15, -1560198380);
    b = ii(b, c, d, a, k[13], 21, 1309151649);
    a = ii(a, b, c, d, k[4], 6, -145523070);
    d = ii(d, a, b, c, k[11], 10, -1120210379);
    c = ii(c, d, a, b, k[2], 15, 718787259);
    b = ii(b, c, d, a, k[9], 21, -343485551);

    x[0] = add32(a, x[0]);
    x[1] = add32(b, x[1]);
    x[2] = add32(c, x[2]);
    x[3] = add32(d, x[3]);
  }
  function cmn(q: any, a: any, b: any, x: any, s: any, t: any) {
    a = add32(add32(a, q), add32(x, t));
    return add32((a << s) | (a >>> (32 - s)), b);
  }
  function ff(a: any, b: any, c: any, d: any, x: any, s: any, t: any) {
    return cmn((b & c) | (~b & d), a, b, x, s, t);
  }
  function gg(a: any, b: any, c: any, d: any, x: any, s: any, t: any) {
    return cmn((b & d) | (c & ~d), a, b, x, s, t);
  }
  function hh(a: any, b: any, c: any, d: any, x: any, s: any, t: any) {
    return cmn(b ^ c ^ d, a, b, x, s, t);
  }
  function ii(a: any, b: any, c: any, d: any, x: any, s: any, t: any) {
    return cmn(c ^ (b | ~d), a, b, x, s, t);
  }
  function add32(a: any, b: any) {
    return (a + b) & 0xffffffff;
  }

  const s = unescape(encodeURIComponent(string));
  const n = s.length;
  const state = [1732584193, -271733879, -1732584194, 271733878];
  let i;
  for (i = 64; i <= n; i += 64) {
    md5cycle(state, md5blk(s.substring(i - 64, i)));
  }
  const tail = s.substring(i - 64);
  const words = Array(16).fill(0);
  for (let j = 0; j < tail.length; j++) {
    words[j >> 2] |= tail.charCodeAt(j) << (j % 4 << 3);
  }
  words[tail.length >> 2] |= 0x80 << (tail.length % 4 << 3);
  if (tail.length > 55) {
    md5cycle(state, words);
    words.fill(0);
  }
  words[14] = n * 8;
  md5cycle(state, words);

  function md5blk(str: string) {
    const blk = Array(16).fill(0);
    for (let j = 0; j < 64; j++) {
      blk[j >> 2] |= str.charCodeAt(j) << (j % 4 << 3);
    }
    return blk;
  }

  return state
    .map((v) => {
      let hex = (v >>> 0).toString(16);
      while (hex.length < 8) hex = "0" + hex;
      return hex.match(/../g)!.reverse().join("");
    })
    .join("");
}

/**
 * UTF-8 安全 Base64 编解码
 */
export function encodeBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin);
}

export function decodeBase64(b64: string): string {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * 格式化 JSON 字符串
 */
export function formatJson(
  input: string,
  indent: number = 2
): { success: boolean; result: string; error?: string } {
  try {
    const parsed = JSON.parse(input);
    return { success: true, result: JSON.stringify(parsed, null, indent) };
  } catch (err: any) {
    return { success: false, result: input, error: err.message };
  }
}

// ==========================================
// 5. 离线二维码扫描与解码 (基于 jsQR 纯本地)
// ==========================================

export async function decodeQrCodeFromImage(file: File): Promise<{
  text: string;
  format: string;
} | null> {
  const img = await loadImageFromFile(file);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const code = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: "attemptBoth",
  });
  if (code && code.data) {
    return { text: code.data, format: "QR_CODE" };
  }
  return null;
}

export function buildWifiQrString(
  ssid: string,
  password: string,
  encryption: "WPA" | "WEP" | "nopass" = "WPA",
  hidden: boolean = false
): string {
  const enc = encryption === "nopass" ? "nopass" : encryption;
  const passPart = encryption === "nopass" ? "" : `P:${password};`;
  const hidPart = hidden ? "H:true;" : "";
  return `WIFI:T:${enc};S:${ssid};${passPart}${hidPart};`;
}

export function buildVCardQrString(info: {
  name: string;
  phone: string;
  company?: string;
  title?: string;
  email?: string;
  website?: string;
}): string {
  let vcard = "BEGIN:VCARD\nVERSION:3.0\n";
  if (info.name) vcard += `FN:${info.name}\nN:${info.name};;;;\n`;
  if (info.phone) vcard += `TEL;TYPE=CELL:${info.phone}\n`;
  if (info.company) vcard += `ORG:${info.company}\n`;
  if (info.title) vcard += `TITLE:${info.title}\n`;
  if (info.email) vcard += `EMAIL:${info.email}\n`;
  if (info.website) vcard += `URL:${info.website}\n`;
  vcard += "END:VCARD";
  return vcard;
}

// ==========================================
// 6. 生活与财务实用工具 (中文金融大写 / 字数统计 / 身份证校验)
// ==========================================

export interface ChineseRMBResult {
  capitalized: string;
  error?: string;
}

/**
 * 人民币金额数字转合规财务大写 (中国人民银行凭证标准)
 */
export function convertNumberToChineseRMB(money: number | string): ChineseRMBResult {
  if (typeof money === "string" && !money.trim()) {
    return { capitalized: "零元整" };
  }
  const num = typeof money === "string" ? parseFloat(money) : money;
  if (isNaN(num)) return { capitalized: "零元整", error: "请输入有效的数字金额" };
  if (num === 0) return { capitalized: "零元整" };
  if (num > 999999999999.99) {
    return { capitalized: "超出支持范围", error: "金额过大，超出支持范围 (9999亿上限)" };
  }

  const isNegative = num < 0;
  const absVal = Math.abs(num);
  const digit = ["零", "壹", "贰", "叁", "肆", "伍", "陆", "柒", "捌", "玖"];
  const unit = [
    ["元", "万", "亿"],
    ["", "拾", "佰", "仟"],
  ];

  let head = isNegative ? "负" : "";
  let s = "";

  const [intPartStr, decPartStr = ""] = absVal.toFixed(2).split(".");
  const jiao = parseInt(decPartStr[0] || "0", 10);
  const fen = parseInt(decPartStr[1] || "0", 10);

  let decResult = "";
  if (jiao === 0 && fen === 0) {
    decResult = "整";
  } else {
    if (jiao > 0) decResult += digit[jiao] + "角";
    else if (parseInt(intPartStr, 10) > 0) decResult += "零";
    if (fen > 0) decResult += digit[fen] + "分";
  }

  let intNum = parseInt(intPartStr, 10);
  if (intNum === 0) {
    return { capitalized: head + (decResult === "整" ? "零元整" : decResult) };
  }

  for (let i = 0; i < unit[0].length && intNum > 0; i++) {
    let p = "";
    for (let j = 0; j < unit[1].length && intNum > 0; j++) {
      p = digit[intNum % 10] + unit[1][j] + p;
      intNum = Math.floor(intNum / 10);
    }
    s = p.replace(/(零.)*零$/, "").replace(/^$/, "零") + unit[0][i] + s;
  }

  s = s
    .replace(/(零.)*零元/, "元")
    .replace(/(零.)+/g, "零")
    .replace(/^整$/, "零元整");

  return { capitalized: head + s + decResult };
}

export interface TextStatistics {
  totalChars: number;
  charsNoSpaces: number;
  nonSpaceChars: number;
  chineseChars: number;
  englishWords: number;
  numbers: number;
  punctuation: number;
  lines: number;
  paragraphs: number;
  readTimeMin: number;
  readingMinutes: number;
  speakTimeMin: number;
  speechMinutes: number;
}

export function analyzeTextStatistics(text: string): TextStatistics {
  const totalChars = text.length;
  const charsNoSpaces = text.replace(/\s+/g, "").length;
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const englishWords = (text.match(/[a-zA-Z0-9_-]+/g) || []).length;
  const numbers = (text.match(/\d/g) || []).length;
  const punctuation = (text.match(/[^\w\s\u4e00-\u9fa5]/g) || []).length;
  const lines = text ? text.split(/\r\n|\r|\n/).length : 0;
  const paragraphs = text
    ? text.split(/\n+/).filter((p) => p.trim().length > 0).length
    : 0;
  const effectiveWords = chineseChars + englishWords;
  const readTimeMin = +(effectiveWords / 450).toFixed(1);
  const speakTimeMin = +(effectiveWords / 260).toFixed(1);

  return {
    totalChars,
    charsNoSpaces,
    nonSpaceChars: charsNoSpaces,
    chineseChars,
    englishWords,
    numbers,
    punctuation,
    lines,
    paragraphs,
    readTimeMin: Math.max(0.1, readTimeMin),
    readingMinutes: Math.max(0.1, readTimeMin),
    speakTimeMin: Math.max(0.1, speakTimeMin),
    speechMinutes: Math.max(0.1, speakTimeMin),
  };
}

export function cleanTextFormatting(
  text: string,
  options: {
    removeEmptyLines?: boolean;
    trimLines?: boolean;
    panguSpacing?: boolean;
  }
): string {
  let res = text;
  if (options.trimLines) {
    res = res.split("\n").map((l) => l.trim()).join("\n");
  }
  if (options.removeEmptyLines) {
    res = res.replace(/\n\s*\n+/g, "\n");
  }
  if (options.panguSpacing) {
    res = res.replace(/([\u4e00-\u9fa5])([a-zA-Z0-9])/g, "$1 $2");
    res = res.replace(/([a-zA-Z0-9])([\u4e00-\u9fa5])/g, "$1 $2");
  }
  return res;
}

export function validateAndParseChineseId(idCard: string): {
  valid: boolean;
  errorMsg?: string;
  message?: string;
  province?: string;
  birthday?: string;
  gender?: "男" | "女";
  age?: number;
} {
  const trimmed = idCard.trim().toUpperCase();
  if (!/^\d{17}[\dX]$/.test(trimmed)) {
    const errorMsg = "身份证必须为18位数字或末位为X";
    return { valid: false, errorMsg, message: errorMsg };
  }

  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const checkCodes = ["1", "0", "X", "9", "8", "7", "6", "5", "4", "3", "2"];
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    sum += parseInt(trimmed[i], 10) * weights[i];
  }
  const expectedCheck = checkCodes[sum % 11];
  if (trimmed[17] !== expectedCheck) {
    const errorMsg = `校验码错误（输入末位为 ${trimmed[17]}，标准应为 ${expectedCheck}）`;
    return { valid: false, errorMsg, message: errorMsg };
  }

  const year = parseInt(trimmed.substring(6, 10), 10);
  const month = parseInt(trimmed.substring(10, 12), 10);
  const day = parseInt(trimmed.substring(12, 14), 10);
  const birthDate = new Date(year, month - 1, day);
  if (birthDate.getFullYear() !== year || birthDate.getMonth() + 1 !== month || birthDate.getDate() !== day) {
    const errorMsg = "出生日期非法";
    return { valid: false, errorMsg, message: errorMsg };
  }

  const gender = parseInt(trimmed[16], 10) % 2 === 1 ? "男" : "女";
  const now = new Date();
  let age = now.getFullYear() - year;
  if (now.getMonth() < month - 1 || (now.getMonth() === month - 1 && now.getDate() < day)) {
    age--;
  }

  const provMap: Record<string, string> = {
    "11": "北京", "12": "天津", "13": "河北", "14": "山西", "15": "内蒙古",
    "21": "辽宁", "22": "吉林", "23": "黑龙江", "31": "上海", "32": "江苏",
    "33": "浙江", "34": "安徽", "35": "福建", "36": "江西", "37": "山东",
    "41": "河南", "42": "湖北", "43": "湖南", "44": "广东", "45": "广西",
    "46": "海南", "50": "重庆", "51": "四川", "52": "贵州", "53": "云南",
    "54": "西藏", "61": "陕西", "62": "甘肃", "63": "青海", "64": "宁夏",
    "65": "新疆", "71": "台湾", "81": "香港", "82": "澳门"
  };
  const province = provMap[trimmed.substring(0, 2)] || "中国大陆";

  return {
    valid: true,
    message: "校验有效 (符合 GB 11643-1999 国家标准)",
    province,
    birthday: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    gender,
    age: Math.max(0, age),
  };
}
