import QRCode from "qrcode";
import { diffLines, diffWordsWithSpace, Change } from "diff";
import { loadImageFromFile } from "./imageProcessor";

// ==========================================
// 1. 证件照换底色与 6寸相纸 9 宫格排版
// ==========================================

export interface IdPhotoSpec {
  name: string;
  width: number;
  height: number;
  mmWidth: number;
  mmHeight: number;
}

export const ID_SPECS = {
  ONE_INCH: { name: "标准 1 寸", width: 295, height: 413, mmWidth: 25, mmHeight: 35 },
  TWO_INCH: { name: "标准 2 寸", width: 413, height: 579, mmWidth: 35, mmHeight: 49 },
  SMALL_TWO: { name: "小 2 寸 (护照/签证)", width: 390, height: 567, mmWidth: 33, mmHeight: 48 },
};

export const BG_COLORS = [
  { id: "white", name: "标准白底 (驾照/求职/日常)", hex: "#FFFFFF" },
  { id: "blue", name: "标准蓝底 (毕业证/社保卡/考试)", hex: "#438EDB" },
  { id: "red", name: "标准红底 (党政/结婚登记/工会)", hex: "#D92B2B" },
  { id: "gray", name: "高级商务灰 (形象/职场/领英)", hex: "#8E9EAB" },
];

/**
 * 证件照智能换底色 (基于边缘主色取样与容差羽化)
 */
export async function replacePhotoBackground(
  file: File,
  targetBgHex: string,
  tolerance: number = 30, // 容差阈值
  feather: number = 15 // 羽化宽度
): Promise<Blob> {
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

  return new Promise((res, rej) => {
    canvas.toBlob(
      (b) => {
        if (b) res(b);
        else rej(new Error("更换背景导出失败"));
      },
      "image/jpeg",
      0.95
    );
  });
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

export async function generateCustomQrCode(options: {
  text: string;
  size?: number;
  fgColor?: string;
  bgColor?: string;
  gradient?: boolean;
  gradientColor?: string;
  logoFile?: File;
  errorCorrection?: "L" | "M" | "Q" | "H";
}): Promise<{ dataUrl: string; blob: Blob }> {
  const size = options.size || 500;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  // 1. 生成基础二维码
  await QRCode.toCanvas(canvas, options.text, {
    width: size,
    margin: 2,
    color: {
      dark: options.fgColor || "#000000",
      light: options.bgColor || "#FFFFFF",
    },
    errorCorrectionLevel: options.logoFile ? "H" : options.errorCorrection || "M",
  });

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法初始化二维码画布");

  // 2. 如果开启渐变色
  if (options.gradient && options.gradientColor) {
    const qrData = ctx.getImageData(0, 0, size, size);
    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, options.fgColor || "#2563eb");
    grad.addColorStop(1, options.gradientColor);

    // 绘制覆盖
    ctx.globalCompositeOperation = "source-in";
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = options.bgColor || "#FFFFFF";
    ctx.fillRect(0, 0, size, size);
    ctx.globalCompositeOperation = "source-over";
  }

  // 3. 如果嵌入 Logo
  if (options.logoFile) {
    const logo = await loadImageFromFile(options.logoFile);
    const logoSize = Math.floor(size * 0.22); // 占 22%
    const lx = (size - logoSize) / 2;
    const ly = (size - logoSize) / 2;

    // 白色圆角衬底
    const pad = 6;
    ctx.fillStyle = options.bgColor || "#FFFFFF";
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
