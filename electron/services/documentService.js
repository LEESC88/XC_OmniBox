const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const { PDFDocument, rgb, degrees } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');
const { ZipArchive } = require('archiver');
const { encryptPDF } = require('@pdfsmaller/pdf-encrypt-lite');

// 按需懒加载重型 C++/WASM 渲染模块 (sharp, @napi-rs/canvas, pdfjs-dist)
let _sharp = null;
let _canvasModule = null;
let _pdfjs = null;
let _unzipper = null;

function getUnzipper() {
  if (!_unzipper) _unzipper = require('unzipper');
  return _unzipper;
}

function getSharp() {
  if (!_sharp) _sharp = require('sharp');
  return _sharp;
}

function getCanvasModule() {
  if (!_canvasModule) {
    _canvasModule = require('@napi-rs/canvas');
    if (typeof global.DOMMatrix === 'undefined') global.DOMMatrix = _canvasModule.DOMMatrix;
    if (typeof global.Path2D === 'undefined') global.Path2D = _canvasModule.Path2D;
    if (typeof global.ImageData === 'undefined') global.ImageData = _canvasModule.ImageData;
    // 预注册 Windows 常用中文字体，确保未内嵌字体的 PDF 与 Canvas 兜底字体正常映射渲染
    if (_canvasModule.GlobalFonts && process.platform === 'win32') {
      const winFontCandidates = [
        'C:/Windows/Fonts/msyh.ttc',
        'C:/Windows/Fonts/simsun.ttc',
        'C:/Windows/Fonts/simhei.ttf',
        'C:/Windows/Fonts/simkai.ttf',
        'C:/Windows/Fonts/simfang.ttf',
      ];
      for (const fp of winFontCandidates) {
        if (fs.existsSync(fp)) {
          try {
            _canvasModule.GlobalFonts.registerFromPath(fp);
          } catch (_) {}
        }
      }
    }
  }
  return _canvasModule;
}

function getPdfjsAssetPath(subDir) {
  try {
    const pkgPath = require.resolve('pdfjs-dist/package.json');
    const targetDir = path.join(path.dirname(pkgPath), subDir);
    if (fs.existsSync(targetDir)) return targetDir.replace(/\\/g, '/') + '/';
  } catch (_) {}
  const p1 = path.join(__dirname, '../node_modules/pdfjs-dist', subDir);
  if (fs.existsSync(p1)) return p1.replace(/\\/g, '/') + '/';
  const p2 = path.join(process.resourcesPath || '', 'app.asar.unpacked/node_modules/pdfjs-dist', subDir);
  if (fs.existsSync(p2)) return p2.replace(/\\/g, '/') + '/';
  return null;
}

function getPdfjs() {
  if (!_pdfjs) {
    getCanvasModule();
    _pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
  }
  return _pdfjs;
}

class NapiCanvasFactory {
  create(width, height) {
    const canvas = getCanvasModule().createCanvas(Math.max(1, Math.ceil(width)), Math.max(1, Math.ceil(height)));
    const context = canvas.getContext('2d');
    return { canvas, context };
  }
  reset(canvasAndContext, width, height) {
    if (canvasAndContext && canvasAndContext.canvas) {
      canvasAndContext.canvas.width = Math.max(1, Math.ceil(width));
      canvasAndContext.canvas.height = Math.max(1, Math.ceil(height));
    }
  }
  destroy(canvasAndContext) {
    if (canvasAndContext && canvasAndContext.canvas) {
      canvasAndContext.canvas.width = 0;
      canvasAndContext.canvas.height = 0;
      canvasAndContext.canvas = null;
      canvasAndContext.context = null;
    }
  }
}

class DocumentService {
  /**
   * 构造标准 pdfjs 加载任务，全量配置 CMaps/StandardFonts 并强制 disableFontFace 规避方框乱码
   */
  static getDocumentTask(buffer, extraOptions = {}) {
    const cMapUrl = getPdfjsAssetPath('cmaps');
    const standardFontDataUrl = getPdfjsAssetPath('standard_fonts');

    return getPdfjs().getDocument({
      data: new Uint8Array(buffer),
      cMapUrl: cMapUrl || undefined,
      cMapPacked: Boolean(cMapUrl),
      standardFontDataUrl: standardFontDataUrl || undefined,
      useSystemFonts: true,
      disableFontFace: true, // 核心：Node.js 环境下无 DOM @font-face，必须设为 true 让 pdfjs 直接按矢量路径渲染字形，彻底消除方框乱码 (Tofu)
      ...extraOptions,
    });
  }
  static _cachedCjkFontBytes = null;

  static getSystemCjkFontBytes() {
    if (DocumentService._cachedCjkFontBytes) {
      return DocumentService._cachedCjkFontBytes;
    }
    const candidateFonts = [
      'C:/Windows/Fonts/simhei.ttf',
      'C:/Windows/Fonts/msyh.ttc',
      'C:/Windows/Fonts/simsun.ttc',
    ];
    for (const fPath of candidateFonts) {
      if (fs.existsSync(fPath)) {
        try {
          DocumentService._cachedCjkFontBytes = fs.readFileSync(fPath);
          return DocumentService._cachedCjkFontBytes;
        } catch (_) {}
      }
    }
    return null;
  }

  /**
   * PDF 合并 (支持大文件长任务实时进度推送)
   */
  static async mergePdfs({ files }, onProgress) {
    if (!files || files.length < 2) {
      throw new Error('请至少上传 2 个 PDF 文件进行合并');
    }

    const mergedDoc = await PDFDocument.create();
    const total = files.length;

    for (let i = 0; i < total; i++) {
      const file = files[i];
      if (onProgress) {
        onProgress({
          task: 'document:merge-pdfs',
          current: i + 1,
          total,
          percent: Math.round(((i + 0.5) / total) * 85),
          message: `正在解析并合并文档 (${i + 1}/${total}): ${file.name || ''}`,
        });
      }
      const buffer = Buffer.isBuffer(file.buffer) ? file.buffer : Buffer.from(file.buffer);
      const srcDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      const indices = srcDoc.getPageIndices();
      if (indices.length > 0) {
        const copiedPages = await mergedDoc.copyPages(srcDoc, indices);
        copiedPages.forEach((p) => mergedDoc.addPage(p));
      }
    }

    if (onProgress) {
      onProgress({
        task: 'document:merge-pdfs',
        current: total,
        total,
        percent: 95,
        message: '正在优化合并对象流并导出文件...',
      });
    }

    const mergedBytes = await mergedDoc.save({ useObjectStreams: true });
    if (onProgress) {
      onProgress({
        task: 'document:merge-pdfs',
        current: total,
        total,
        percent: 100,
        message: '合并完成！',
      });
    }
    return {
      buffer: Buffer.from(mergedBytes),
      filename: 'merged_document.pdf',
    };
  }

  /**
   * PDF 拆分 / 页面提取
   */
  static async splitPdf({ fileBuffer, fileName = 'document.pdf', pageRanges }) {
    const buffer = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer);
    const srcDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const totalPages = srcDoc.getPageCount();
    const baseName = fileName.replace(/\.[^/.]+$/, '');

    if (pageRanges && pageRanges.trim()) {
      // 提取指定页码范围并合并为单个 PDF
      const pageIndicesToExtract = new Set();
      const parts = pageRanges.split(',');

      for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed.includes('-')) {
          const [startStr, endStr] = trimmed.split('-');
          const start = parseInt(startStr, 10);
          const end = parseInt(endStr, 10);
          if (!isNaN(start) && !isNaN(end)) {
            for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
              if (i >= 1 && i <= totalPages) {
                pageIndicesToExtract.add(i - 1);
              }
            }
          }
        } else {
          const p = parseInt(trimmed, 10);
          if (!isNaN(p) && p >= 1 && p <= totalPages) {
            pageIndicesToExtract.add(p - 1);
          }
        }
      }

      const sortedIndices = Array.from(pageIndicesToExtract).sort((a, b) => a - b);
      if (sortedIndices.length === 0) {
        throw new Error('未提取到任何有效页面，请检查页码范围');
      }

      const newDoc = await PDFDocument.create();
      const copiedPages = await newDoc.copyPages(srcDoc, sortedIndices);
      copiedPages.forEach((p) => newDoc.addPage(p));
      const newBytes = await newDoc.save({ useObjectStreams: true });

      return {
        buffer: Buffer.from(newBytes),
        filename: `extracted_${fileName}`,
      };
    }

    // 全量拆分为单页并打包为 ZIP
    return new Promise(async (resolve, reject) => {
      try {
        const archive = new ZipArchive({ zlib: { level: 9 } });
        const chunks = [];

        archive.on('data', (chunk) => chunks.push(chunk));
        archive.on('end', () => {
          const zipBuffer = Buffer.concat(chunks);
          resolve({
            buffer: zipBuffer,
            filename: `${baseName}_all_pages.zip`,
          });
        });
        archive.on('error', (err) => reject(err));

        for (let i = 0; i < totalPages; i++) {
          const singleDoc = await PDFDocument.create();
          const [copiedPage] = await singleDoc.copyPages(srcDoc, [i]);
          singleDoc.addPage(copiedPage);
          const pageBytes = await singleDoc.save({ useObjectStreams: true });
          archive.append(Buffer.from(pageBytes), {
            name: `${baseName}_page_${i + 1}.pdf`,
          });
        }

        await archive.finalize();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * PDF 添加水印
   */
  static async addWatermark({
    fileBuffer,
    fileName = 'document.pdf',
    text = '内部机密 严禁外传',
    opacity = 0.3,
    angle = 45,
    layout = 'center',
  }) {
    const buffer = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer);
    const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    doc.registerFontkit(fontkit);

    // 优先加载 Windows 系统高清晰黑体/雅黑字体，保证中英字符均不乱码
    let font = null;
    const candidateFonts = [
      'C:/Windows/Fonts/simhei.ttf',
      'C:/Windows/Fonts/msyh.ttc',
      'C:/Windows/Fonts/simsun.ttc',
    ];
    for (const fPath of candidateFonts) {
      if (fs.existsSync(fPath)) {
        try {
          const fontBytes = fs.readFileSync(fPath);
          font = await doc.embedFont(fontBytes, { subset: true });
          break;
        } catch (_) {}
      }
    }

    const pages = doc.getPages();
    const watermarkText = text || '机密文件';
    const fontSize = 32;
    const parsedOpacity = Math.max(0.05, Math.min(1.0, Number(opacity) || 0.3));
    const parsedAngle = Number(angle) || 45;
    const isTile = String(layout).toLowerCase() === 'tile';

    for (const page of pages) {
      const { width, height } = page.getSize();

      if (isTile) {
        // 平铺网格
        const stepX = 220;
        const stepY = 160;
        for (let y = 60; y < height; y += stepY) {
          for (let x = 60; x < width; x += stepX) {
            page.drawText(watermarkText, {
              x,
              y,
              size: fontSize,
              font: font || undefined,
              color: rgb(0.5, 0.5, 0.5),
              opacity: parsedOpacity,
              rotate: degrees(parsedAngle),
            });
          }
        }
      } else {
        // 居中单水印
        const textWidth = font ? font.widthOfTextAtSize(watermarkText, fontSize) : fontSize * watermarkText.length * 0.8;
        page.drawText(watermarkText, {
          x: width / 2 - textWidth / 2,
          y: height / 2,
          size: fontSize,
          font: font || undefined,
          color: rgb(0.5, 0.5, 0.5),
          opacity: parsedOpacity,
          rotate: degrees(parsedAngle),
        });
      }
    }

    const outBytes = await doc.save({ useObjectStreams: true });
    return {
      buffer: Buffer.from(outBytes),
      filename: `watermarked_${fileName}`,
    };
  }

  /**
   * PDF 密码加密与权限保护 (支持同步抹除文档隐私元数据)
   */
  static async protectPdf({ fileBuffer, fileName = 'document.pdf', password, ownerPassword, cleanMetadata = false }) {
    if (!password) {
      throw new Error('请设置保护密码');
    }
    let buffer = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer);

    if (cleanMetadata) {
      try {
        const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
        doc.setTitle('');
        doc.setAuthor('');
        doc.setSubject('');
        doc.setKeywords([]);
        doc.setProducer('');
        doc.setCreator('');
        buffer = Buffer.from(await doc.save({ useObjectStreams: true }));
      } catch (_) {}
    }

    const encryptedBytes = await encryptPDF(buffer, password, ownerPassword || password);

    return {
      buffer: Buffer.from(encryptedBytes),
      filename: `protected_${fileName}`,
    };
  }

  /**
   * PDF 密码解除、权限解锁与隐私元数据清理
   */
  static async unlockPdf({ fileBuffer, fileName = 'document.pdf', password = '', cleanMetadata = false }) {
    const buffer = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer);

    // 1. 先尝试通过 pdf-lib 直接无损解除权限锁与复制页面
    try {
      const srcDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      const unlockedDoc = await PDFDocument.create();
      const indices = srcDoc.getPageIndices();
      if (indices.length > 0) {
        const copied = await unlockedDoc.copyPages(srcDoc, indices);
        for (const p of copied) unlockedDoc.addPage(p);
      }
      if (cleanMetadata) {
        unlockedDoc.setTitle('');
        unlockedDoc.setAuthor('');
        unlockedDoc.setSubject('');
        unlockedDoc.setKeywords([]);
        unlockedDoc.setProducer('');
        unlockedDoc.setCreator('');
      }
      const outBytes = await unlockedDoc.save({ useObjectStreams: true });
      // 如果原文件受打开密码加密，pdf-lib 忽略加密复制出的流可能无法正常解析，若有传入 password 则走 pdfjs 验证
      if (!password) {
        return {
          buffer: Buffer.from(outBytes),
          filename: `unlocked_${fileName}`,
        };
      }
    } catch (_) {
      // 若 pdf-lib 直接拷贝失败（如强流加密），进入下方 pdfjs 解密重绘管线
    }

    // 2. 使用 pdfjs-dist 验证密码并解密渲染页面重构为无密码 PDF
    const canvasFactory = new NapiCanvasFactory();
    let pdfDoc;
    try {
      const loadingTask = DocumentService.getDocumentTask(buffer, {
        password: password || undefined,
        canvasFactory,
      });
      pdfDoc = await loadingTask.promise;
    } catch (err) {
      throw new Error('密码错误或该文档受加密保护，请输入正确的打开密码');
    }

    const rebuiltDoc = await PDFDocument.create();
    const scale = 150 / 72;
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const origViewport = page.getViewport({ scale: 1.0 });
      const renderViewport = page.getViewport({ scale });
      const { canvas, context: ctx } = canvasFactory.create(renderViewport.width, renderViewport.height);
      await page.render({ canvasContext: ctx, viewport: renderViewport, canvasFactory }).promise;
      const pngBytes = canvas.toBuffer('image/png');
      const embeddedImg = await rebuiltDoc.embedPng(pngBytes);
      const newPage = rebuiltDoc.addPage([origViewport.width, origViewport.height]);
      newPage.drawImage(embeddedImg, {
        x: 0,
        y: 0,
        width: origViewport.width,
        height: origViewport.height,
      });
    }

    if (cleanMetadata) {
      rebuiltDoc.setTitle('');
      rebuiltDoc.setAuthor('');
      rebuiltDoc.setSubject('');
      rebuiltDoc.setKeywords([]);
      rebuiltDoc.setProducer('');
      rebuiltDoc.setCreator('');
    }

    const finalBytes = await rebuiltDoc.save({ useObjectStreams: true });
    return {
      buffer: Buffer.from(finalBytes),
      filename: `unlocked_${fileName}`,
    };
  }

  /**
   * PDF 压缩优化 (带防体积倒退保护与进度流)
   */
  static async compressPdf({ fileBuffer, fileName = 'document.pdf', level = 'medium' }, onProgress) {
    const buffer = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer);
    const originalSize = buffer.length;

    if (onProgress) {
      onProgress({ task: 'document:compress-pdf', current: 1, total: 3, percent: 30, message: '正在分析 PDF 对象树与交叉引用表...' });
    }

    const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });

    if (onProgress) {
      onProgress({ task: 'document:compress-pdf', current: 2, total: 3, percent: 75, message: '正在执行对象流重组与字典压缩...' });
    }

    const compressedBytes = await doc.save({
      useObjectStreams: true,
      addDefaultPage: false,
      preservePDFForm: level === 'low',
    });

    const candidateBuffer = Buffer.from(compressedBytes);
    // 防膨胀保护：若重组后体积未减小，保留原文档字节流
    const finalBuffer = candidateBuffer.length < originalSize ? candidateBuffer : buffer;

    if (onProgress) {
      onProgress({ task: 'document:compress-pdf', current: 3, total: 3, percent: 100, message: '压缩完成！' });
    }

    return {
      buffer: finalBuffer,
      filename: `compressed_${fileName}`,
      originalSize,
      compressedSize: finalBuffer.length,
    };
  }

  /**
   * 图片合成 PDF (带实时进度推送)
   */
  static async imagesToPdf({ files, pageSize = 'fit' }, onProgress) {
    if (!files || files.length === 0) {
      throw new Error('请至少上传一张图片进行合成');
    }

    const doc = await PDFDocument.create();
    const isA4 = String(pageSize).toLowerCase() === 'a4';
    const a4Width = 595.28;
    const a4Height = 841.89;
    const total = files.length;

    for (let i = 0; i < total; i++) {
      const f = files[i];
      if (onProgress) {
        onProgress({
          task: 'document:images-to-pdf',
          current: i + 1,
          total,
          percent: Math.round(((i + 0.5) / total) * 90),
          message: `正在转码并嵌入图像 (${i + 1}/${total}): ${f.name || ''}`,
        });
      }
      const buffer = Buffer.isBuffer(f.buffer) ? f.buffer : Buffer.from(f.buffer);

      // 通过 sharp 统一转为标准 PNG，解决各种奇特图片编码与色彩空间
      const pngBuffer = await getSharp()(buffer).rotate().png().toBuffer();
      const embeddedImg = await doc.embedPng(pngBuffer);
      const imgWidth = embeddedImg.width;
      const imgHeight = embeddedImg.height;

      if (isA4) {
        const page = doc.addPage([a4Width, a4Height]);
        const margin = 36;
        const maxW = a4Width - margin * 2;
        const maxH = a4Height - margin * 2;
        const scale = Math.min(maxW / imgWidth, maxH / imgHeight, 1.0);
        const w = imgWidth * scale;
        const h = imgHeight * scale;
        const x = (a4Width - w) / 2;
        const y = (a4Height - h) / 2;

        page.drawImage(embeddedImg, { x, y, width: w, height: h });
      } else {
        const page = doc.addPage([imgWidth, imgHeight]);
        page.drawImage(embeddedImg, { x: 0, y: 0, width: imgWidth, height: imgHeight });
      }
    }

    const pdfBytes = await doc.save({ useObjectStreams: true });
    if (onProgress) {
      onProgress({ task: 'document:images-to-pdf', current: total, total, percent: 100, message: '合成 PDF 完成！' });
    }
    return {
      buffer: Buffer.from(pdfBytes),
      filename: 'images_combined.pdf',
    };
  }

  /**
   * PDF 页面自由编排与旋转
   */
  static async organizePdf({ fileBuffer, fileName = 'document.pdf', pagesConfig }) {
    const buffer = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer);
    const srcDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const newDoc = await PDFDocument.create();

    const config = typeof pagesConfig === 'string' ? JSON.parse(pagesConfig) : pagesConfig;
    if (!Array.isArray(config)) {
      throw new Error('pagesConfig 必须是有效的数组结构');
    }

    for (const item of config) {
      const pageIdx = Number(item.page);
      if (pageIdx >= 0 && pageIdx < srcDoc.getPageCount()) {
        const [copiedPage] = await newDoc.copyPages(srcDoc, [pageIdx]);
        if (item.rotation) {
          const curAngle = copiedPage.getRotation().angle;
          copiedPage.setRotation(degrees((curAngle + Number(item.rotation)) % 360));
        }
        newDoc.addPage(copiedPage);
      }
    }

    const outBytes = await newDoc.save({ useObjectStreams: true });
    return {
      buffer: Buffer.from(outBytes),
      filename: `organized_${fileName}`,
    };
  }

  /**
   * 高保真渲染 PDF 每一页画面 (用于缩略图与原版预览)
   */
  static async renderPdfPages({ fileBuffer, fileName = 'document.pdf', dpi = 100, maxPages, extractWords = false }) {
    const buffer = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer);
    const canvasFactory = new NapiCanvasFactory();
    const loadingTask = DocumentService.getDocumentTask(buffer, {
      canvasFactory,
    });

    const doc = await loadingTask.promise;
    const numPages = doc.numPages;
    const limit = maxPages ? Math.min(numPages, Number(maxPages)) : numPages;
    const scale = (Number(dpi) || 100) / 72;
    const pages = [];

    for (let i = 1; i <= limit; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale });
      const { canvas, context: ctx } = canvasFactory.create(viewport.width, viewport.height);

      await page.render({
        canvasContext: ctx,
        viewport,
        canvasFactory,
      }).promise;

      const imgBase64 = `data:image/png;base64,${canvas.toBuffer('image/png').toString('base64')}`;

      let words = [];
      if (extractWords) {
        try {
          const textContent = await page.getTextContent();
          words = (textContent.items || []).map((item) => ({
            text: item.str,
            x0: Math.round(item.transform[4]),
            y0: Math.round(item.transform[5]),
            x1: Math.round(item.transform[4] + item.width),
            y1: Math.round(item.transform[5] + (item.height || 12)),
            fontSize: Math.round(item.height || 12),
          }));
        } catch (_) {}
      }

      pages.push({
        pageIndex: i - 1,
        width: Math.round(viewport.width),
        height: Math.round(viewport.height),
        image: imgBase64,
        words,
      });
    }

    return {
      title: fileName,
      numPages,
      pages,
    };
  }

  /**
   * 辅助：构建标准 OpenXML (.docx) 字节流 (零外部依赖兜底引擎)
   */
  static async buildDocxFromParagraphs(paragraphs) {
    return new Promise((resolve, reject) => {
      try {
        const archive = new ZipArchive({ zlib: { level: 9 } });
        const chunks = [];
        archive.on('data', (c) => chunks.push(c));
        archive.on('end', () => resolve(Buffer.concat(chunks)));
        archive.on('error', (err) => reject(err));

        const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

        const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

        const escapeXml = (str) =>
          String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');

        const bodyParagraphs = paragraphs
          .map((p) => `<w:p><w:r><w:t>${escapeXml(p)}</w:t></w:r></w:p>`)
          .join('');

        const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${bodyParagraphs}</w:body>
</w:document>`;

        archive.append(Buffer.from(contentTypesXml, 'utf8'), { name: '[Content_Types].xml' });
        archive.append(Buffer.from(relsXml, 'utf8'), { name: '_rels/.rels' });
        archive.append(Buffer.from(documentXml, 'utf8'), { name: 'word/document.xml' });
        archive.finalize();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Word 转 PDF (优先调用 Windows 原生 Word / WPS COM，无 Office 环境自动回退内置引擎)
   */
  static async wordToPdf({ fileBuffer, fileName = 'document.docx', quality = 'high' }) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xc_w2p_'));
    const inputDocx = path.join(tempDir, fileName);
    const outputPdf = path.join(tempDir, `${fileName.replace(/\.[^/.]+$/, '')}.pdf`);
    const psScriptPath = path.join(tempDir, 'convert.ps1');

    try {
      const buffer = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer);
      fs.writeFileSync(inputDocx, buffer);

      const optimizeCode = quality === 'low' ? '1' : '0';
      const psContent = [
        `$ErrorActionPreference = "Stop"`,
        `$word = $null`,
        `try { $word = New-Object -ComObject Word.Application } catch {`,
        `  try { $word = New-Object -ComObject KWPS.Application } catch { throw "NO_COM" }`,
        `}`,
        `$word.Visible = $false`,
        `$word.DisplayAlerts = 0`,
        `try {`,
        `  $doc = $word.Documents.Open("${inputDocx.replace(/\\/g, '\\\\')}", $false, $true)`,
        `  $doc.ExportAsFixedFormat("${outputPdf.replace(/\\/g, '\\\\')}", 17, $false, ${optimizeCode})`,
        `  $doc.Close($false)`,
        `} finally {`,
        `  if ($word) {`,
        `    $word.Quit()`,
        `    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null`,
        `  }`,
        `}`,
      ].join('\r\n');

      fs.writeFileSync(psScriptPath, psContent, 'utf8');

      try {
        execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${psScriptPath}"`, {
          timeout: 60000,
          windowsHide: true,
          stdio: 'ignore',
        });
      } catch (_) {}

      if (fs.existsSync(outputPdf)) {
        const pdfData = fs.readFileSync(outputPdf);
        return {
          buffer: pdfData,
          filename: path.basename(outputPdf),
        };
      }

      // 内置纯 Node.js 兜底渲染引擎 (当系统未安装 Office 或 COM 受限时保障可用)
      const doc = await PDFDocument.create();
      doc.registerFontkit(fontkit);
      let font = null;
      for (const fPath of ['C:/Windows/Fonts/simhei.ttf', 'C:/Windows/Fonts/msyh.ttc']) {
        if (fs.existsSync(fPath)) {
          try {
            font = await doc.embedFont(fs.readFileSync(fPath), { subset: true });
            break;
          } catch (_) {}
        }
      }
      const page = doc.addPage([595.28, 841.89]);
      const rawXml = buffer.toString('utf8');
      const matches = rawXml.match(/<w:t[^>]*>([^<]+)<\/w:t>/g) || [];
      const extractedText = matches.map((m) => m.replace(/<[^>]+>/g, '')).join(' ') || fileName;
      page.drawText(extractedText.slice(0, 1500), {
        x: 50,
        y: 780,
        size: 12,
        font: font || undefined,
        maxWidth: 495,
      });
      const fallbackBytes = await doc.save();
      return {
        buffer: Buffer.from(fallbackBytes),
        filename: path.basename(outputPdf),
      };
    } finally {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (_) {}
    }
  }

  /**
   * PDF 转 Word (优先调用 Windows Word / WPS COM 智能重排，无 COM 权限时自动回退 pdfjs + OpenXML 引擎)
   */
  static async pdfToWord({ fileBuffer, fileName = 'document.pdf' }) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xc_p2w_'));
    const inputPdf = path.join(tempDir, fileName);
    const outputDocx = path.join(tempDir, `${fileName.replace(/\.[^/.]+$/, '')}.docx`);
    const psScriptPath = path.join(tempDir, 'convert_p2w.ps1');

    try {
      const buffer = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer);
      fs.writeFileSync(inputPdf, buffer);

      const psContent = [
        `$ErrorActionPreference = "Stop"`,
        `$word = $null`,
        `try { $word = New-Object -ComObject Word.Application } catch {`,
        `  try { $word = New-Object -ComObject KWPS.Application } catch { throw "NO_COM" }`,
        `}`,
        `$word.Visible = $false`,
        `$word.DisplayAlerts = 0`,
        `try {`,
        `  $doc = $word.Documents.Open("${inputPdf.replace(/\\/g, '\\\\')}", $false, $true)`,
        `  $doc.SaveAs2("${outputDocx.replace(/\\/g, '\\\\')}", 16)`,
        `  $doc.Close($false)`,
        `} finally {`,
        `  if ($word) {`,
        `    $word.Quit()`,
        `    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null`,
        `  }`,
        `}`,
      ].join('\r\n');

      fs.writeFileSync(psScriptPath, psContent, 'utf8');

      try {
        execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${psScriptPath}"`, {
          timeout: 60000,
          windowsHide: true,
          stdio: 'ignore',
        });
      } catch (_) {}

      if (fs.existsSync(outputDocx)) {
        const docxData = fs.readFileSync(outputDocx);
        return {
          buffer: docxData,
          filename: path.basename(outputDocx),
        };
      }

      // 纯 Node.js pdfjs 文本提取 + OpenXML 组装兜底引擎
      const loadingTask = DocumentService.getDocumentTask(buffer);
      const pdfDoc = await loadingTask.promise;
      const paragraphs = [];
      for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const textContent = await page.getTextContent();
        const pageLines = (textContent.items || [])
          .map((it) => it.str)
          .filter(Boolean)
          .join(' ');
        if (pageLines) {
          paragraphs.push(pageLines);
        }
      }
      if (paragraphs.length === 0) {
        paragraphs.push(fileName);
      }

      const docxBuffer = await DocumentService.buildDocxFromParagraphs(paragraphs);
      return {
        buffer: docxBuffer,
        filename: path.basename(outputDocx),
      };
    } finally {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (_) {}
    }
  }

  /**
   * 双层可搜索可复制 PDF 合成引擎 (底层高清扫描图 + 顶层精确对齐透明中文字库层)
   * 彻底解决 Tesseract WASM 默认 PDF 导出丢失中文字形及字符间距错位问题
   */
  static async generateSearchablePdf({
    imageBuffer,
    fileName = 'scanned_document.png',
    words = [],
    lines = [],
    fullText = '',
    scaleRatio = 1.0,
  }) {
    const buffer = Buffer.isBuffer(imageBuffer) ? imageBuffer : Buffer.from(imageBuffer);
    const pngBuffer = await getSharp()(buffer).rotate().png().toBuffer();

    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);

    let font = null;
    const fontBytes = DocumentService.getSystemCjkFontBytes();
    if (fontBytes) {
      try {
        font = await doc.embedFont(fontBytes, { subset: true });
      } catch (_) {}
    }

    const embeddedImg = await doc.embedPng(pngBuffer);
    const pageW = embeddedImg.width;
    const pageH = embeddedImg.height;
    const page = doc.addPage([pageW, pageH]);

    // 1. 绘制底层高清原貌图像
    page.drawImage(embeddedImg, {
      x: 0,
      y: 0,
      width: pageW,
      height: pageH,
    });

    // 2. 绘制顶层精确坐标对齐的透明可搜索文字层 (opacity: 0.01 对肉眼不可见但对 PDF 检索引擎 100% 可选可搜)
    const ratio = Number(scaleRatio) > 0 ? Number(scaleRatio) : 1.0;
    const textItems = Array.isArray(words) && words.length > 0
      ? words
      : Array.isArray(lines) && lines.length > 0
        ? lines
        : [];

    if (textItems.length > 0) {
      for (const item of textItems) {
        const rawStr = String(item.text || '').trim();
        if (!rawStr || !item.bbox) continue;

        const x0 = Math.max(0, (Number(item.bbox.x0) || 0) * ratio);
        const y0 = Math.max(0, (Number(item.bbox.y0) || 0) * ratio);
        const x1 = Math.min(pageW, (Number(item.bbox.x1) || x0 + 12) * ratio);
        const y1 = Math.min(pageH, (Number(item.bbox.y1) || y0 + 12) * ratio);

        const boxW = Math.max(4, x1 - x0);
        const boxH = Math.max(6, y1 - y0);

        let fontSize = Math.max(6, boxH * 0.85);
        if (font) {
          try {
            const measuredW = font.widthOfTextAtSize(rawStr, fontSize);
            if (measuredW > 0) {
              // 依据检测框实际像素宽度动态校准字号，确保鼠标框选首尾严格对齐
              const calibrated = fontSize * (boxW / measuredW);
              fontSize = Math.max(boxH * 0.45, Math.min(boxH * 1.15, calibrated));
            }
          } catch (_) {}
        }

        // PDF 坐标系原点在左下角，基线位于检测框底部向上约 15% 高度处
        const pdfX = x0;
        const pdfY = Math.max(2, pageH - y1 + boxH * 0.15);

        try {
          page.drawText(rawStr, {
            x: pdfX,
            y: pdfY,
            size: fontSize,
            font: font || undefined,
            color: rgb(0, 0, 0),
            opacity: 0.01,
          });
        } catch (_) {}
      }
    } else if (fullText && String(fullText).trim()) {
      // 当未提供词级 bbox 时，按行均匀排布透明检索层
      const rawLines = String(fullText).replace(/\r\n/g, '\n').split('\n').filter((l) => l.trim());
      const stepY = Math.max(18, Math.min(36, Math.floor((pageH - 80) / Math.max(1, rawLines.length))));
      for (let i = 0; i < rawLines.length; i++) {
        const py = Math.max(20, pageH - 50 - i * stepY);
        try {
          page.drawText(rawLines[i].trim(), {
            x: 40,
            y: py,
            size: 14,
            font: font || undefined,
            color: rgb(0, 0, 0),
            opacity: 0.01,
          });
        } catch (_) {}
      }
    }

    const baseName = fileName.replace(/\.[^/.]+$/, '');
    const outBytes = await doc.save({ useObjectStreams: true });

    return {
      buffer: Buffer.from(outBytes),
      filename: `${baseName}_searchable.pdf`,
      text: fullText,
    };
  }

  /**
   * Office 多媒体资产一键无损提取 (Word / PPT / Excel 原图与音视频解构)
   * 零失真直接抽取 OpenXML 容器内的原始文件流，并统一重新命名与打包为 ZIP
   */
  static async extractOfficeMedia({ fileBuffer, fileName = 'document.docx', onProgress }) {
    const buffer = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer);
    const unzipper = getUnzipper();
    let directory;
    try {
      directory = await unzipper.Open.buffer(buffer);
    } catch (err) {
      throw new Error('无法解析该文件，请确保传入的是有效的 .docx、.pptx、.xlsx 或开放文档格式文件');
    }

    // 筛选出 media 目录或 Pictures 目录下的具体文件
    const rawEntries = directory.files.filter((file) => {
      if (file.type === 'Directory' || file.path.endsWith('/')) return false;
      return Boolean(file.path.match(/(?:word|ppt|xl)\/media\/|Pictures\//i));
    });

    const baseName = fileName.replace(/\.[^/.]+$/, '');
    const zipFilename = `${baseName}_原图素材包.zip`;

    if (rawEntries.length === 0) {
      if (onProgress) {
        onProgress({ task: 'document:extract-media', current: 0, total: 0, percent: 100, message: '未在文档中检测到内嵌的独立图片或媒体文件' });
      }
      return {
        success: true,
        count: 0,
        totalSize: 0,
        items: [],
        zipBuffer: Buffer.alloc(0),
        zipFilename,
        message: '文档中未检测到内嵌的独立图片或多媒体素材',
      };
    }

    const items = [];
    const filesToBundle = [];
    let totalSize = 0;

    for (let i = 0; i < rawEntries.length; i++) {
      const entry = rawEntries[i];
      const data = await entry.buffer();
      const originalName = path.basename(entry.path);
      const ext = path.extname(originalName).toLowerCase();
      const cleanExt = ext.replace('.', '') || 'bin';
      const indexStr = String(i + 1).padStart(2, '0');
      const safeName = `${indexStr}_${originalName}`;

      let mimeType = 'application/octet-stream';
      if (['.jpg', '.jpeg'].includes(ext)) mimeType = 'image/jpeg';
      else if (ext === '.png') mimeType = 'image/png';
      else if (ext === '.webp') mimeType = 'image/webp';
      else if (ext === '.svg') mimeType = 'image/svg+xml';
      else if (ext === '.gif') mimeType = 'image/gif';
      else if (ext === '.bmp') mimeType = 'image/bmp';
      else if (ext === '.mp3') mimeType = 'audio/mpeg';
      else if (ext === '.wav') mimeType = 'audio/wav';
      else if (ext === '.mp4') mimeType = 'video/mp4';

      let previewUrl = null;
      // 为常见网页支持的格式生成缩略预览 Base64
      if (mimeType.startsWith('image/') && !['.emf', '.wmf', '.tiff', '.tif'].includes(ext)) {
        if (data.length <= 4 * 1024 * 1024) {
          previewUrl = `data:${mimeType};base64,${data.toString('base64')}`;
        }
      }

      totalSize += data.length;
      items.push({
        id: `media_${i + 1}`,
        name: safeName,
        originalPath: entry.path,
        size: data.length,
        mimeType,
        extension: cleanExt,
        previewUrl,
      });

      filesToBundle.push({
        name: safeName,
        buffer: data,
      });

      if (onProgress) {
        onProgress({
          task: 'document:extract-media',
          current: i + 1,
          total: rawEntries.length,
          percent: Math.round(((i + 1) / rawEntries.length) * 80),
          message: `正在提取媒体素材 (${i + 1}/${rawEntries.length}): ${originalName}`,
        });
      }
    }

    // 将所有无损原图打包为 ZIP
    const outArchive = new ZipArchive({ zlib: { level: 6 } });
    const zipChunks = [];
    outArchive.on('data', (c) => zipChunks.push(c));

    for (const f of filesToBundle) {
      outArchive.append(f.buffer, { name: f.name });
    }
    outArchive.finalize();
    await new Promise((resolve) => outArchive.on('end', resolve));
    const zipBuffer = Buffer.concat(zipChunks);

    if (onProgress) {
      onProgress({
        task: 'document:extract-media',
        current: rawEntries.length,
        total: rawEntries.length,
        percent: 100,
        message: `成功提取 ${items.length} 个多媒体素材并完成打包！`,
      });
    }

    return {
      success: true,
      count: items.length,
      totalSize,
      items,
      zipBuffer,
      zipFilename,
    };
  }

  /**
   * PDF 局部文字原地修正前置探测：提取高精度版面文字元素与各页超清渲染图
   */
  static async inspectPdfText({ fileBuffer, fileName = 'document.pdf', dpi = 120, maxPages = 50 }) {
    if (!fileBuffer || (Buffer.isBuffer(fileBuffer) && fileBuffer.length === 0)) {
      throw new Error('未接收到有效的 PDF 文档数据');
    }
    const buffer = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer);
    const canvasFactory = new NapiCanvasFactory();
    const loadingTask = DocumentService.getDocumentTask(buffer, { canvasFactory });
    let doc = null;
    try {
      doc = await loadingTask.promise;
    } catch (err) {
      throw new Error(`PDF 解析失败: ${err.message || '文件损坏或受密码保护'}`);
    }

    const numPages = doc.numPages;
    const limit = maxPages ? Math.min(numPages, Number(maxPages)) : numPages;
    const scale = (Number(dpi) || 120) / 72;
    const pages = [];
    const pdfjs = getPdfjs();

    for (let i = 1; i <= limit; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale });
      const { canvas, context: ctx } = canvasFactory.create(viewport.width, viewport.height);

      await page.render({
        canvasContext: ctx,
        viewport,
        canvasFactory,
      }).promise;

      const imgBase64 = `data:image/png;base64,${canvas.toBuffer('image/png').toString('base64')}`;

      // 提取基准 1.0 比例尺寸与绝对矩阵变换 (基准视口完全承载旋转角度与真实宽高，杜绝多页拉伸变形)
      const baseViewport = page.getViewport({ scale: 1.0 });
      const renderWidth = baseViewport.width;
      const renderHeight = baseViewport.height;
      const pTransform = baseViewport.transform;

      const textContent = await page.getTextContent();
      const items = [];
      let itemIdx = 0;

      // 异步预加载并解析当前页所用字体的详细排版属性 (字族、衬线/无衬线、粗体、斜体)
      const fontMetaCache = new Map();
      const uniqueFontIds = [...new Set((textContent.items || []).map(it => it.fontName).filter(Boolean))];

      for (const fid of uniqueFontIds) {
        let rawName = '';
        let fallbackName = '';
        let bold = false;
        let italic = false;

        if (page.commonObjs && typeof page.commonObjs.get === 'function') {
          try {
            const fontObj = await new Promise((resolve) => {
              let settled = false;
              const timer = setTimeout(() => {
                if (!settled) {
                  settled = true;
                  resolve(null);
                }
              }, 120);
              page.commonObjs.get(fid, (obj) => {
                if (!settled) {
                  settled = true;
                  clearTimeout(timer);
                  resolve(obj);
                }
              });
            });

            if (fontObj) {
              rawName = fontObj.name || fontObj.loadedName || '';
              fallbackName = fontObj.fallbackName || '';
              bold = Boolean(fontObj.bold || /bold|black|heavy|semibold|bd/i.test(rawName));
              italic = Boolean(fontObj.italic || /italic|oblique|it/i.test(rawName));
            }
          } catch (_) {}
        }

        if (!rawName && textContent.styles && textContent.styles[fid]) {
          const style = textContent.styles[fid];
          fallbackName = style.fontFamily || '';
        }

        const lowerName = rawName.toLowerCase();
        let family = 'times';
        let displayFamily = 'Times New Roman';

        if (lowerName.includes('times') || lowerName.includes('roman')) {
          family = 'times';
          displayFamily = 'Times New Roman';
        } else if (lowerName.includes('arial')) {
          family = 'arial';
          displayFamily = 'Arial';
        } else if (lowerName.includes('calibri')) {
          family = 'calibri';
          displayFamily = 'Calibri';
        } else if (lowerName.includes('georgia')) {
          family = 'georgia';
          displayFamily = 'Georgia';
        } else if (lowerName.includes('garamond')) {
          family = 'garamond';
          displayFamily = 'Garamond';
        } else if (lowerName.includes('verdana')) {
          family = 'verdana';
          displayFamily = 'Verdana';
        } else if (lowerName.includes('tahoma')) {
          family = 'tahoma';
          displayFamily = 'Tahoma';
        } else if (lowerName.includes('courier')) {
          family = 'courier';
          displayFamily = 'Courier New';
        } else if (lowerName.includes('consola')) {
          family = 'consolas';
          displayFamily = 'Consolas';
        } else if (lowerName.includes('helvetica') || lowerName.includes('sans')) {
          family = 'arial';
          displayFamily = 'Arial';
        } else if (fallbackName === 'serif') {
          family = 'times';
          displayFamily = 'Times New Roman';
        } else if (fallbackName === 'monospace') {
          family = 'courier';
          displayFamily = 'Courier New';
        } else {
          family = 'times';
          displayFamily = 'Times New Roman';
        }

        fontMetaCache.set(fid, { family, displayFamily, isBold: bold, isItalic: italic, rawName });
      }

      const resolveFontMeta = (fontId) => {
        if (!fontId) return { family: 'times', displayFamily: 'Times New Roman', isBold: false, isItalic: false, rawName: '' };
        return fontMetaCache.get(fontId) || { family: 'times', displayFamily: 'Times New Roman', isBold: false, isItalic: false, rawName: '' };
      };

      for (const item of (textContent.items || [])) {
        const rawStr = item.str;
        if (!rawStr || !rawStr.trim()) continue;

        const tx = pdfjs.Util.transform(pTransform, item.transform);
        const fontHeight = Math.hypot(tx[2], tx[3]) || 12;
        const fontAscent = fontHeight * 0.82;
        const left = tx[4];
        const top = tx[5] - fontAscent;
        const fontMeta = resolveFontMeta(item.fontName);

        // 检测 item.str 是否包含多个以空格分隔的单词 (如 "favourite fruit is apple")
        // 若包含，拆解为独立单词词元 (Sub-word tokens)，使用户能精准点选/加粗/修改单字而绝不牵连整句
        const wordMatches = [];
        const regex = /\S+/g;
        let match;
        while ((match = regex.exec(rawStr)) !== null) {
          wordMatches.push({ word: match[0], index: match.index });
        }

        if (wordMatches.length >= 1 && ctx && typeof ctx.measureText === 'function') {
          const weightStr = fontMeta.isBold ? 'bold ' : '';
          const styleStr = fontMeta.isItalic ? 'italic ' : '';
          ctx.font = `${styleStr}${weightStr}${fontHeight}px ${fontMeta.displayFamily || 'Times New Roman'}`;
          const totalMeasured = ctx.measureText(rawStr).width || 1;
          const scaleFactor = (item.width || totalMeasured) / totalMeasured;

          for (const wm of wordMatches) {
            const prefix = rawStr.substring(0, wm.index);
            const prefixW = wm.index > 0 ? ctx.measureText(prefix).width * scaleFactor : 0;
            const wordW =
              wordMatches.length === 1 && rawStr === wm.word && item.width > 0
                ? item.width
                : ctx.measureText(wm.word).width * scaleFactor;

            const wordX = item.transform[4] + prefixW;
            const wordY = item.transform[5];
            const wordLeft = left + prefixW;
            const wordTop = top;

            const wLeftPercent = Math.max(0, Math.min(100, (wordLeft / renderWidth) * 100));
            const wTopPercent = Math.max(0, Math.min(100, (wordTop / renderHeight) * 100));
            const wWidthPercent = Math.max(0.2, Math.min(100 - wLeftPercent, (wordW / renderWidth) * 100));
            const wHeightPercent = Math.max(0.5, Math.min(100 - wTopPercent, (fontHeight / renderHeight) * 100));

            items.push({
              id: `p${i - 1}_i${itemIdx++}`,
              str: wm.word,
              x: Math.round(wordX * 100) / 100,
              y: Math.round(wordY * 100) / 100,
              width: Math.max(1.5, Math.round(wordW * 100) / 100),
              height: Math.max(6, Math.round(fontHeight * 100) / 100),
              fontSize: Math.round(fontHeight * 100) / 100,
              fontName: item.fontName || '',
              fontFamily: fontMeta.family,
              displayFamily: fontMeta.displayFamily,
              isBold: fontMeta.isBold,
              isItalic: fontMeta.isItalic,
              detectedFont: fontMeta.rawName || fontMeta.family,
              leftPercent: Math.round(wLeftPercent * 100) / 100,
              topPercent: Math.round(wTopPercent * 100) / 100,
              widthPercent: Math.round(wWidthPercent * 100) / 100,
              heightPercent: Math.round(wHeightPercent * 100) / 100,
            });
          }
        } else {
          const trimmedStr = rawStr.trim();
          const leftPercent = Math.max(0, Math.min(100, (left / renderWidth) * 100));
          const topPercent = Math.max(0, Math.min(100, (top / renderHeight) * 100));
          const widthPercent = Math.max(0.2, Math.min(100 - leftPercent, (item.width / renderWidth) * 100));
          const heightPercent = Math.max(0.5, Math.min(100 - topPercent, (fontHeight / renderHeight) * 100));

          items.push({
            id: `p${i - 1}_i${itemIdx++}`,
            str: trimmedStr,
            x: Math.round(item.transform[4] * 100) / 100,
            y: Math.round(item.transform[5] * 100) / 100,
            width: Math.max(1.5, Math.round(item.width * 100) / 100),
            height: Math.max(6, Math.round(fontHeight * 100) / 100),
            fontSize: Math.round(fontHeight * 100) / 100,
            fontName: item.fontName || '',
            fontFamily: fontMeta.family,
            displayFamily: fontMeta.displayFamily,
            isBold: fontMeta.isBold,
            isItalic: fontMeta.isItalic,
            detectedFont: fontMeta.rawName || fontMeta.family,
            leftPercent: Math.round(leftPercent * 100) / 100,
            topPercent: Math.round(topPercent * 100) / 100,
            widthPercent: Math.round(widthPercent * 100) / 100,
            heightPercent: Math.round(heightPercent * 100) / 100,
          });
        }
      }

      // 先对字元按行与水平 X 坐标排序，并缝合因 PDF 字距微调 (Kerning) 被切碎的同一单词碎片
      const rawSorted = [...items].sort((a, b) => (Math.abs(b.y - a.y) <= 3.5 ? a.x - b.x : b.y - a.y));
      const coalescedItems = [];
      for (const it of rawSorted) {
        const prev = coalescedItems.length > 0 ? coalescedItems[coalescedItems.length - 1] : null;
        const isSameBaseline = prev && Math.abs(prev.y - it.y) <= 3.5;
        const gap = prev ? it.x - (prev.x + prev.width) : 999;
        const maxKerningGap = Math.max(1.5, (it.fontSize || 12) * 0.14);
        const bothNonCjk = prev && !/[\u4e00-\u9fa5]/.test(prev.str) && !/[\u4e00-\u9fa5]/.test(it.str);

        if (isSameBaseline && bothNonCjk && gap >= -3.5 && gap <= maxKerningGap) {
          prev.str += it.str;
          const minX = Math.min(prev.x, it.x);
          const maxX = Math.max(prev.x + prev.width, it.x + it.width);
          prev.x = Math.round(minX * 100) / 100;
          prev.width = Math.round((maxX - minX) * 100) / 100;
          const minLeftPct = Math.min(prev.leftPercent, it.leftPercent);
          const maxRightPct = Math.max(prev.leftPercent + prev.widthPercent, it.leftPercent + it.widthPercent);
          prev.leftPercent = Math.round(minLeftPct * 100) / 100;
          prev.widthPercent = Math.round((maxRightPct - minLeftPct) * 100) / 100;
        } else {
          coalescedItems.push(it);
        }
      }
      coalescedItems.forEach((it, idx) => {
        it.id = `p${i - 1}_i${idx}`;
      });

      // 将同在一行 (Y 坐标差值 <= 3.5pt) 且水平紧密连续的字元聚合为自然文本块（超出间隙判定为表格跨列/独立单元格，严禁跨格串行）
      const lines = [];
      for (const it of coalescedItems) {
        const maxGap = Math.max(12, (it.fontSize || 12) * 1.65);
        const existingLine = lines.find((l) => {
          if (Math.abs(l.y - it.y) > 3.5) return false;
          const lastItem = l.items[l.items.length - 1];
          const gap = it.x - (lastItem.x + lastItem.width);
          return gap >= -4 && gap <= maxGap;
        });
        if (existingLine) {
          // 智能分词与空格保护：基于真实字符间距判定是否需要补空格，严禁粗暴盲目加空格破坏连字符/标点
          const prevItem = existingLine.items[existingLine.items.length - 1];
          const gap = prevItem ? it.x - (prevItem.x + prevItem.width) : 0;
          const needsSpace =
            gap > Math.max(1.5, (it.fontSize || 12) * 0.14) &&
            !prevItem.str.endsWith(' ') &&
            !it.str.startsWith(' ') &&
            !/^[-.,:;!?)\]}/]/.test(it.str) &&
            !/[-(\[{]$/.test(prevItem.str);

          existingLine.items.push(it);
          existingLine.str += (needsSpace ? ' ' : '') + it.str;
          const minX = Math.min(existingLine.x, it.x);
          const maxX = Math.max(existingLine.x + existingLine.width, it.x + it.width);
          existingLine.x = Math.round(minX * 100) / 100;
          existingLine.width = Math.round((maxX - minX) * 100) / 100;

          existingLine.fontFamily = it.fontFamily;
          existingLine.displayFamily = it.displayFamily;
          existingLine.isBold = Boolean(existingLine.isBold || it.isBold);
          existingLine.isItalic = Boolean(existingLine.isItalic || it.isItalic);
          existingLine.detectedFont = it.detectedFont || existingLine.detectedFont;

          const minLeftPct = Math.min(existingLine.leftPercent, it.leftPercent);
          const maxRightPct = Math.max(existingLine.leftPercent + existingLine.widthPercent, it.leftPercent + it.widthPercent);
          const minTopPct = Math.min(existingLine.topPercent, it.topPercent);
          const maxBottomPct = Math.max(existingLine.topPercent + existingLine.heightPercent, it.topPercent + it.heightPercent);

          existingLine.leftPercent = Math.round(minLeftPct * 100) / 100;
          existingLine.topPercent = Math.round(minTopPct * 100) / 100;
          existingLine.widthPercent = Math.round((maxRightPct - minLeftPct) * 100) / 100;
          existingLine.heightPercent = Math.round((maxBottomPct - minTopPct) * 100) / 100;
        } else {
          lines.push({
            id: `p${i - 1}_line${lines.length}`,
            str: it.str,
            y: it.y,
            x: it.x,
            width: it.width,
            height: it.height,
            fontSize: it.fontSize,
            fontName: it.fontName,
            fontFamily: it.fontFamily,
            displayFamily: it.displayFamily,
            isBold: it.isBold,
            isItalic: it.isItalic,
            detectedFont: it.detectedFont,
            leftPercent: it.leftPercent,
            topPercent: it.topPercent,
            widthPercent: it.widthPercent,
            heightPercent: it.heightPercent,
            items: [it],
          });
        }
      }

      // 为每个词元标记所属行 ID 与行内索引，支撑单字修改时的同行自动顺延重排 (Same-Line Reflow)
      for (const line of lines) {
        line.items.sort((a, b) => a.x - b.x);
        line.items.forEach((it, idx) => {
          it.lineId = line.id;
          it.wordIndex = idx;
        });
      }

      pages.push({
        pageIndex: i - 1,
        pageNumber: i,
        width: Math.round(renderWidth),
        height: Math.round(renderHeight),
        viewWidth: Math.round(viewport.width),
        viewHeight: Math.round(viewport.height),
        image: imgBase64,
        items: coalescedItems,
        lines,
      });
    }

    return {
      success: true,
      fileName,
      numPages,
      pages,
    };
  }

  /**
   * PDF 局部文字原地修正执行引擎：精细遮白原印迹 + 原字形嵌入重绘 + 边界自适应防溢出
   */
  static async applyPdfTextPatches({ fileBuffer, fileName = 'document.pdf', patches = [] }) {
    if (!fileBuffer || (Buffer.isBuffer(fileBuffer) && fileBuffer.length === 0)) {
      throw new Error('未接收到有效的 PDF 文档数据');
    }
    const rawPatches = Array.isArray(patches) ? patches : typeof patches === 'string' ? JSON.parse(patches) : [];
    if (!rawPatches || rawPatches.length === 0) {
      throw new Error('请至少指定 1 处需要原地修正的文字补丁');
    }

    const buffer = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer);
    const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    pdfDoc.registerFontkit(fontkit);

    const parseHex = (hex) => {
      if (!hex || typeof hex !== 'string') return rgb(0, 0, 0);
      const clean = hex.replace('#', '').trim();
      if (clean.length === 3) {
        return rgb(
          parseInt(clean[0] + clean[0], 16) / 255,
          parseInt(clean[1] + clean[1], 16) / 255,
          parseInt(clean[2] + clean[2], 16) / 255
        );
      }
      if (clean.length === 6) {
        return rgb(
          parseInt(clean.substring(0, 2), 16) / 255,
          parseInt(clean.substring(2, 4), 16) / 255,
          parseInt(clean.substring(4, 6), 16) / 255
        );
      }
      return rgb(0, 0, 0);
    };

    const isChineseText = (text) => /[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/.test(text);

    // 字体懒加载缓存
    const fontCache = new Map();
    const loadFont = async (family, isBold = false, isItalic = false, sampleText = '') => {
      const hasCjk = isChineseText(sampleText);
      const famKey = `${(family || 'times').toLowerCase()}_${isBold ? 'b' : 'n'}_${isItalic ? 'i' : 'n'}_${hasCjk ? 'cjk' : 'lat'}`;
      if (fontCache.has(famKey)) return fontCache.get(famKey);

      let font = null;
      const { StandardFonts } = require('pdf-lib');
      const fam = (family || 'times').toLowerCase();

      // 常见常用标准文档字体（优先加载 Windows 系统原生 TrueType 字体以达到 100% 原始笔触，不存在则回退至内置标准字体）
      const winFontMap = {
        times: {
          regular: 'C:/Windows/Fonts/times.ttf',
          bold: 'C:/Windows/Fonts/timesbd.ttf',
          italic: 'C:/Windows/Fonts/timesi.ttf',
          boldItalic: 'C:/Windows/Fonts/timesbi.ttf',
          stdRegular: StandardFonts.TimesRoman,
          stdBold: StandardFonts.TimesRomanBold,
          stdItalic: StandardFonts.TimesRomanItalic,
          stdBoldItalic: StandardFonts.TimesRomanBoldItalic,
        },
        arial: {
          regular: 'C:/Windows/Fonts/arial.ttf',
          bold: 'C:/Windows/Fonts/arialbd.ttf',
          italic: 'C:/Windows/Fonts/ariali.ttf',
          boldItalic: 'C:/Windows/Fonts/arialbi.ttf',
          stdRegular: StandardFonts.Helvetica,
          stdBold: StandardFonts.HelveticaBold,
          stdItalic: StandardFonts.HelveticaOblique,
          stdBoldItalic: StandardFonts.HelveticaBoldOblique,
        },
        calibri: {
          regular: 'C:/Windows/Fonts/calibri.ttf',
          bold: 'C:/Windows/Fonts/calibrib.ttf',
          italic: 'C:/Windows/Fonts/calibrii.ttf',
          boldItalic: 'C:/Windows/Fonts/calibriz.ttf',
          stdRegular: StandardFonts.Helvetica,
          stdBold: StandardFonts.HelveticaBold,
          stdItalic: StandardFonts.HelveticaOblique,
          stdBoldItalic: StandardFonts.HelveticaBoldOblique,
        },
        georgia: {
          regular: 'C:/Windows/Fonts/georgia.ttf',
          bold: 'C:/Windows/Fonts/georgiab.ttf',
          italic: 'C:/Windows/Fonts/georgiai.ttf',
          boldItalic: 'C:/Windows/Fonts/georgiaz.ttf',
          stdRegular: StandardFonts.TimesRoman,
          stdBold: StandardFonts.TimesRomanBold,
          stdItalic: StandardFonts.TimesRomanItalic,
          stdBoldItalic: StandardFonts.TimesRomanBoldItalic,
        },
        garamond: {
          regular: 'C:/Windows/Fonts/georgia.ttf',
          bold: 'C:/Windows/Fonts/georgiab.ttf',
          italic: 'C:/Windows/Fonts/georgiai.ttf',
          boldItalic: 'C:/Windows/Fonts/georgiaz.ttf',
          stdRegular: StandardFonts.TimesRoman,
          stdBold: StandardFonts.TimesRomanBold,
          stdItalic: StandardFonts.TimesRomanItalic,
          stdBoldItalic: StandardFonts.TimesRomanBoldItalic,
        },
        verdana: {
          regular: 'C:/Windows/Fonts/verdana.ttf',
          bold: 'C:/Windows/Fonts/verdanab.ttf',
          italic: 'C:/Windows/Fonts/verdanai.ttf',
          boldItalic: 'C:/Windows/Fonts/verdanaz.ttf',
          stdRegular: StandardFonts.Helvetica,
          stdBold: StandardFonts.HelveticaBold,
          stdItalic: StandardFonts.HelveticaOblique,
          stdBoldItalic: StandardFonts.HelveticaBoldOblique,
        },
        tahoma: {
          regular: 'C:/Windows/Fonts/tahoma.ttf',
          bold: 'C:/Windows/Fonts/tahomabd.ttf',
          italic: 'C:/Windows/Fonts/tahoma.ttf',
          boldItalic: 'C:/Windows/Fonts/tahomabd.ttf',
          stdRegular: StandardFonts.Helvetica,
          stdBold: StandardFonts.HelveticaBold,
          stdItalic: StandardFonts.HelveticaOblique,
          stdBoldItalic: StandardFonts.HelveticaBoldOblique,
        },
        courier: {
          regular: 'C:/Windows/Fonts/cour.ttf',
          bold: 'C:/Windows/Fonts/courbd.ttf',
          italic: 'C:/Windows/Fonts/couri.ttf',
          boldItalic: 'C:/Windows/Fonts/courbi.ttf',
          stdRegular: StandardFonts.Courier,
          stdBold: StandardFonts.CourierBold,
          stdItalic: StandardFonts.CourierOblique,
          stdBoldItalic: StandardFonts.CourierBoldOblique,
        },
        consolas: {
          regular: 'C:/Windows/Fonts/consola.ttf',
          bold: 'C:/Windows/Fonts/consolab.ttf',
          italic: 'C:/Windows/Fonts/consola.ttf',
          boldItalic: 'C:/Windows/Fonts/consolab.ttf',
          stdRegular: StandardFonts.Courier,
          stdBold: StandardFonts.CourierBold,
          stdItalic: StandardFonts.CourierOblique,
          stdBoldItalic: StandardFonts.CourierBoldOblique,
        },
        helvetica: {
          regular: 'C:/Windows/Fonts/arial.ttf',
          bold: 'C:/Windows/Fonts/arialbd.ttf',
          italic: 'C:/Windows/Fonts/ariali.ttf',
          boldItalic: 'C:/Windows/Fonts/arialbi.ttf',
          stdRegular: StandardFonts.Helvetica,
          stdBold: StandardFonts.HelveticaBold,
          stdItalic: StandardFonts.HelveticaOblique,
          stdBoldItalic: StandardFonts.HelveticaBoldOblique,
        },
      };

      const fontDef = winFontMap[fam] || winFontMap.times;

      if (!hasCjk) {
        const ttfPath = isBold && isItalic ? fontDef.boldItalic : isBold ? fontDef.bold : isItalic ? fontDef.italic : fontDef.regular;
        if (ttfPath && fs.existsSync(ttfPath)) {
          try {
            const fontBytes = fs.readFileSync(ttfPath);
            font = await pdfDoc.embedFont(fontBytes, { subset: true });
          } catch (_) {}
        }
        if (!font) {
          const stdFont = isBold && isItalic ? fontDef.stdBoldItalic : isBold ? fontDef.stdBold : isItalic ? fontDef.stdItalic : fontDef.stdRegular;
          font = await pdfDoc.embedFont(stdFont);
        }
      } else {
        // CJK 真实中文字体（优先使用 Windows 原生 TrueType 黑体/等线/宋体，启用 glyph 子集化嵌入，杜绝 TTC 报错）
        const cjkCandidates = isBold
          ? ['C:/Windows/Fonts/simsunb.ttf', 'C:/Windows/Fonts/simhei.ttf', 'C:/Windows/Fonts/Dengb.ttf', 'C:/Windows/Fonts/Deng.ttf']
          : ['C:/Windows/Fonts/simhei.ttf', 'C:/Windows/Fonts/Deng.ttf', 'C:/Windows/Fonts/simkai.ttf', 'C:/Windows/Fonts/simfang.ttf', 'C:/Windows/Fonts/simsunb.ttf'];
        for (const cjkPath of cjkCandidates) {
          if (fs.existsSync(cjkPath)) {
            try {
              const fontBytes = fs.readFileSync(cjkPath);
              font = await pdfDoc.embedFont(fontBytes, { subset: true });
              if (font) break;
            } catch (_) {}
          }
        }
        if (!font) {
          try {
            font = await pdfDoc.embedFont(isBold ? StandardFonts.TimesRomanBold : StandardFonts.TimesRoman);
          } catch (_) {}
        }
      }

      fontCache.set(famKey, font);
      return font;
    };

    const pageCount = pdfDoc.getPageCount();

    // 预处理：若收到未预挂载 reflowSegments 的单字修改补丁，自动关联所在行并构造同行后续词元重排队列
    let effectivePatches = [...rawPatches];
    const needsAutoLineReflow = effectivePatches.some(
      (p) =>
        !p.isHighlight &&
        !p.isMoved &&
        (!Array.isArray(p.reflowSegments) || p.reflowSegments.length === 0) &&
        typeof p.x === 'number' &&
        typeof p.y === 'number' &&
        (p.x !== 0 || p.y !== 0)
    );

    if (needsAutoLineReflow) {
      try {
        const maxTouchedPage = Math.min(
          pageCount,
          Math.max(...effectivePatches.map((p) => (Number(p.pageIndex) || 0) + 1), 1)
        );
        const layout = await DocumentService.inspectPdfText({
          fileBuffer: buffer,
          fileName,
          dpi: 72,
          maxPages: maxTouchedPage,
        });

        if (layout && Array.isArray(layout.pages)) {
          const rebuiltPatches = [];
          const consumedPatchIndices = new Set();

          for (const pageLayout of layout.pages) {
            const pIdx = pageLayout.pageIndex;
            const pageLines = pageLayout.lines || [];

            for (const line of pageLines) {
              if (!Array.isArray(line.items) || line.items.length === 0) continue;

              // 查找该行内匹配到的单字级补丁 (排除整行替换补丁)
              const matchedByItemIdx = new Map();
              effectivePatches.forEach((p, patchIdx) => {
                if (consumedPatchIndices.has(patchIdx)) return;
                if (Number(p.pageIndex) !== pIdx || p.isHighlight || p.isMoved) return;
                if (Array.isArray(p.reflowSegments) && p.reflowSegments.length > 0) return;

                // 若补丁明确标记为整行级补丁 (targetItemId 为行 ID 如 p0_l0，或宽度已覆盖整行)，不拆分为单字重排
                if (p.targetItemId && (p.targetItemId === line.id || /_l\d+$/.test(String(p.targetItemId)))) {
                  return;
                }
                if (!p.targetItemId && line.items.length > 1 && Number(p.width) >= line.width - 2.5) {
                  return;
                }

                const matchedIdx = line.items.findIndex((it) => {
                  if (p.targetItemId) return p.targetItemId === it.id;
                  return Math.abs(Number(p.y) - it.y) <= 3.5 && Math.abs(Number(p.x) - it.x) <= 3.0;
                });

                if (matchedIdx !== -1) {
                  matchedByItemIdx.set(matchedIdx, { patch: p, patchIdx });
                  consumedPatchIndices.add(patchIdx);
                }
              });

              if (matchedByItemIdx.size > 0) {
                const patchedIndices = [...matchedByItemIdx.keys()].sort((a, b) => a - b);
                const firstIdx = patchedIndices[0];
                const firstItem = line.items[firstIdx];
                const firstPatchEntry = matchedByItemIdx.get(firstIdx).patch;
                const prevItem = firstIdx > 0 ? line.items[firstIdx - 1] : null;
                const lastItem = line.items[line.items.length - 1];

                const reflowSegments = [];
                for (let m = firstIdx; m < line.items.length; m++) {
                  const it = line.items[m];
                  const matched = matchedByItemIdx.get(m)?.patch;
                  if (matched) {
                    reflowSegments.push({
                      text: typeof matched.newText === 'string' ? matched.newText : '',
                      origX: it.x,
                      origWidth: it.width,
                      fontFamily: matched.fontFamily || it.fontFamily || 'times',
                      fontSize: Number(matched.fontSize) > 0 ? Number(matched.fontSize) : it.fontSize,
                      isBold: Boolean(matched.isBold),
                      isItalic: Boolean(matched.isItalic),
                      colorHex: matched.colorHex || '#000000',
                      isPatched: true,
                    });
                  } else {
                    reflowSegments.push({
                      text: it.str,
                      origX: it.x,
                      origWidth: it.width,
                      fontFamily: it.fontFamily || 'times',
                      fontSize: it.fontSize || 12,
                      isBold: Boolean(it.isBold),
                      isItalic: Boolean(it.isItalic),
                      colorHex: '#000000',
                      isPatched: false,
                    });
                  }
                }

                rebuiltPatches.push({
                  ...firstPatchEntry,
                  x: firstItem.x,
                  y: firstItem.y,
                  width: firstItem.width,
                  height: firstItem.height,
                  minXConstraint: prevItem ? prevItem.x + prevItem.width : undefined,
                  origTailRight: lastItem.x + lastItem.width,
                  reflowSegments,
                });
              }
            }
          }

          effectivePatches.forEach((p, idx) => {
            if (!consumedPatchIndices.has(idx)) {
              rebuiltPatches.push(p);
            }
          });
          effectivePatches = rebuiltPatches;
        }
      } catch (reflowErr) {
        console.warn('[applyPdfTextPatches] auto line reflow fallback:', reflowErr.message);
      }
    }

    for (const patch of effectivePatches) {
      const pageIdx = Number(patch.pageIndex);
      if (isNaN(pageIdx) || pageIdx < 0 || pageIdx >= pageCount) continue;

      const page = pdfDoc.getPage(pageIdx);
      const { width: pWidth, height: pHeight } = page.getSize();
      let x = Number(patch.x);
      let y = Number(patch.y);
      let width = Number(patch.width);
      let height = Number(patch.height);
      let isBaseline = Boolean(patch.isBaseline !== false);

      const hasExactVectorCoords =
        typeof patch.x === 'number' &&
        typeof patch.y === 'number' &&
        (patch.x !== 0 || patch.y !== 0) &&
        !isNaN(patch.x) &&
        !isNaN(patch.y) &&
        patch.width > 0 &&
        patch.height > 0;

      if ((patch.isMoved || !hasExactVectorCoords) && patch.leftPercent !== undefined && patch.topPercent !== undefined) {
        x = (Number(patch.leftPercent) / 100) * pWidth;
        width = Math.max(2, (Number(patch.widthPercent) / 100) * pWidth);
        const top = (Number(patch.topPercent) / 100) * pHeight;
        height = Math.max(4, (Number(patch.heightPercent) / 100) * pHeight);
        y = pHeight - (top + height * 0.82);
        isBaseline = true;
      }

      x = isNaN(x) ? 0 : x;
      y = isNaN(y) ? 0 : y;
      width = Math.max(2, isNaN(width) ? 10 : width);
      height = Math.max(4, isNaN(height) ? 12 : height);

      const newText = typeof patch.newText === 'string' ? patch.newText : '';
      const bgHex = patch.bgHex !== undefined ? patch.bgHex : '#FFFFFF';
      const colorHex = patch.colorHex || '#000000';
      const padding = typeof patch.padding === 'number' ? patch.padding : 1.5;

      // 0. 荧光高亮笔标注模式 (Highlight Mode - 办公软件级 Multiply 半透明高亮，保留底层文字笔触)
      if (patch.isHighlight) {
        const { BlendMode } = require('pdf-lib');
        const hlColor = parseHex(patch.bgHex || patch.colorHex || '#FFD600');
        const hlPaddingX = typeof patch.padding === 'number' ? patch.padding : 1.5;
        const hlPaddingY = 1.0;
        const hlY = isBaseline ? (y - height * 0.22) - hlPaddingY : y - hlPaddingY;
        const hlH = height * 1.08 + hlPaddingY * 2;
        page.drawRectangle({
          x: x - hlPaddingX,
          y: hlY,
          width: width + hlPaddingX * 2,
          height: hlH,
          color: hlColor,
          opacity: 0.58,
          blendMode: BlendMode.Multiply,
        });
        continue;
      }

      // 0.5 单字修改同行自动顺延重排模式 (Same-Line Trailing Reflow - 自动保持空格并顺延后续单词，严防碰撞重叠)
      if (Array.isArray(patch.reflowSegments) && patch.reflowSegments.length > 0 && !patch.isMoved) {
        const segments = [];
        for (const seg of patch.reflowSegments) {
          const segText = typeof seg.text === 'string' ? seg.text.trim() : '';
          const segFontSize =
            Number(seg.fontSize) > 0
              ? Number(seg.fontSize)
              : Number(patch.fontSize) > 0
              ? Number(patch.fontSize)
              : Math.max(6, height * 0.85);
          const segBold = Boolean(seg.isBold);
          const segItalic = Boolean(seg.isItalic);
          const segFamily = seg.fontFamily || patch.fontFamily || 'times';
          const segColor = seg.colorHex || '#000000';
          const segFont = await loadFont(segFamily, segBold, segItalic, segText || ' ');
          let segWidth = 0;
          if (segText.length > 0 && segFont) {
            try {
              segWidth = segFont.widthOfTextAtSize(segText, segFontSize);
            } catch (_) {
              segWidth = Number(seg.origWidth) || segText.length * segFontSize * 0.5;
            }
          }
          segments.push({
            text: segText,
            origX: Number(seg.origX) || x,
            origWidth: Number(seg.origWidth) || 0,
            fontSize: segFontSize,
            font: segFont,
            colorHex: segColor,
            measuredWidth: segWidth,
          });
        }

        let cursorX = x;
        for (let sIdx = 0; sIdx < segments.length; sIdx++) {
          const curr = segments[sIdx];
          curr.drawX = cursorX;
          if (curr.text.length === 0) {
            continue;
          }
          if (sIdx < segments.length - 1) {
            const next = segments[sIdx + 1];
            let stdSpace = curr.fontSize * 0.25;
            if (curr.font) {
              try {
                stdSpace = curr.font.widthOfTextAtSize(' ', curr.fontSize) || stdSpace;
              } catch (_) {}
            }
            const origGap =
              next.origX > 0 && curr.origX > 0 ? next.origX - (curr.origX + curr.origWidth) : stdSpace;
            const isClosingPunct = /^[.,;:!?)\]}]/.test(next.text) || /[-(\[{]$/.test(curr.text);
            const gap = isClosingPunct
              ? Math.max(0, Math.min(origGap, stdSpace * 0.35))
              : origGap >= stdSpace * 0.9 && origGap <= stdSpace * 2.4
              ? Math.max(stdSpace, origGap)
              : stdSpace;
            cursorX += curr.measuredWidth + gap;
          } else {
            cursorX += curr.measuredWidth;
          }
        }

        if (bgHex && bgHex.toLowerCase() !== 'transparent') {
          const maskColor = parseHex(bgHex);
          const maxSegFontSize = Math.max(...segments.map((s) => s.fontSize), height * 0.85);
          const effectiveHeight = Math.max(height, maxSegFontSize * 1.08);
          const padY = 0.8;
          const maskH = effectiveHeight + padY * 2;
          const maskY = isBaseline ? y - effectiveHeight * 0.23 - padY : y - padY;

          const minLeft =
            typeof patch.minXConstraint === 'number' && !isNaN(patch.minXConstraint)
              ? Math.max(patch.minXConstraint + 0.4, x - 1.0)
              : x - padding;
          const origRight =
            typeof patch.origTailRight === 'number' && patch.origTailRight > x
              ? patch.origTailRight
              : x + width;
          const maskRight = Math.max(origRight, cursorX) + padding;
          const maskWidth = Math.max(2, maskRight - minLeft);

          page.drawRectangle({
            x: minLeft,
            y: maskY,
            width: maskWidth,
            height: maskH,
            color: maskColor,
          });
        }

        for (const seg of segments) {
          if (seg.text.length > 0 && seg.font) {
            const textColor = parseHex(seg.colorHex);
            const drawY = isBaseline ? y : y + (height - seg.fontSize) / 2 + seg.fontSize * 0.15;
            try {
              page.drawText(seg.text, {
                x: seg.drawX,
                y: drawY,
                size: seg.fontSize,
                font: seg.font,
                color: textColor,
              });
            } catch (drawErr) {
              console.warn('[applyPdfTextPatches] reflow drawText error:', drawErr.message);
            }
          }
        }
        continue;
      }

      // 1. 加载字体与计算文字真实渲染尺寸（确保 100% 保持原检测字号与加粗格式，严禁私自缩放字号）
      const isBold = Boolean(patch.isBold);
      const isItalic = Boolean(patch.isItalic);
      const targetFontSize = Number(patch.fontSize) > 0 ? Number(patch.fontSize) : Math.max(6, height * 0.85);
      const font = await loadFont(patch.fontFamily, isBold, isItalic, newText);

      let measuredWidth = width;
      if (newText.length > 0 && font) {
        try {
          measuredWidth = font.widthOfTextAtSize(newText, targetFontSize);
        } catch (_) {}
      }

      // 2. 涂白遮罩：覆盖原文字印迹并容纳新文字（若新文字更长，遮罩自适应向右扩展，保证彻底擦除底痕且绝不截断）
      if (bgHex && bgHex.toLowerCase() !== 'transparent') {
        const maskColor = parseHex(bgHex);
        const effectiveHeight = Math.max(height, targetFontSize * 1.15);
        const maskH = effectiveHeight + padding * 2;
        const maskY = isBaseline ? (y - effectiveHeight * 0.25) - padding : y - padding;
        const maskWidth = Math.max(width, measuredWidth) + padding * 2;

        page.drawRectangle({
          x: x - padding,
          y: maskY,
          width: maskWidth,
          height: maskH,
          color: maskColor,
        });
      }

      // 3. 原地绘制新文字（字号、粗体、斜体与字体系列 100% 严格执行，绝对不发生形变或缩小）
      if (newText.length > 0 && font) {
        const textColor = parseHex(colorHex);
        const drawY = isBaseline ? y : y + (height - targetFontSize) / 2 + targetFontSize * 0.15;
        try {
          page.drawText(newText, {
            x,
            y: drawY,
            size: targetFontSize,
            font,
            color: textColor,
          });
        } catch (drawErr) {
          console.warn('[applyPdfTextPatches] drawText error:', drawErr.message);
        }
      }
    }

    const modifiedBytes = await pdfDoc.save({ useObjectStreams: true });
    return {
      success: true,
      buffer: Buffer.from(modifiedBytes),
      filename: `fixed_${fileName.replace(/^fixed_/, '')}`,
      patchCount: rawPatches.length,
    };
  }
}

module.exports = DocumentService;
