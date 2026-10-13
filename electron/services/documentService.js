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
  }
  return _canvasModule;
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
      const loadingTask = getPdfjs().getDocument({
        data: new Uint8Array(buffer),
        password: password || undefined,
        useSystemFonts: true,
        disableFontFace: false,
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
    const loadingTask = getPdfjs().getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
      disableFontFace: false,
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
      const loadingTask = getPdfjs().getDocument({
        data: new Uint8Array(buffer),
        useSystemFonts: true,
      });
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
   * 辅助方法：解析十六进制颜色为 RGB [0..1] 或 CSS 颜色字符串
   */
  static parseHexColor(hex = '#000000') {
    const clean = String(hex || '#000000').replace('#', '').trim();
    if (clean.length === 6) {
      const r = parseInt(clean.slice(0, 2), 16) || 0;
      const g = parseInt(clean.slice(2, 4), 16) || 0;
      const b = parseInt(clean.slice(4, 6), 16) || 0;
      return { r, g, b, pdfRgb: rgb(r / 255, g / 255, b / 255), css: `#${clean}` };
    }
    return { r: 0, g: 0, b: 0, pdfRgb: rgb(0, 0, 0), css: '#000000' };
  }

  /**
   * 工具 A：PDF 签章、批注与物理涂黑脱敏 (Sign & Redact)
   * - 包含涂黑脱敏 (redact) 的页面：执行底层光栅化重绘，将敏感区域直接熔合覆写进位图像素并替换原页面指令流，100% 物理销毁底层文字坐标，杜绝复制穿透。
   * - 仅含签章 (stamp) 或文字批注 (annotation) 的页面：保留原矢量文字流，无损叠加透明 PNG 印章/手写签名与中文矢量批注。
   */
  static async signAndRedactPdf(
    {
      fileBuffer,
      fileName = 'document.pdf',
      operations = [],
      dpi = 200,
    },
    onProgress
  ) {
    const buffer = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer);
    const srcDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const totalPages = srcDoc.getPageCount();
    if (totalPages === 0) {
      throw new Error('PDF 文档不包含任何页面');
    }

    const outDoc = await PDFDocument.create();
    outDoc.registerFontkit(fontkit);

    // 按页分组操作项 (pageIndex: 0-based)
    const opsByPage = new Map();
    for (const op of Array.isArray(operations) ? operations : []) {
      const pIdx = Number(op.pageIndex);
      if (Number.isNaN(pIdx) || pIdx < 0 || pIdx >= totalPages) continue;
      if (!opsByPage.has(pIdx)) opsByPage.set(pIdx, []);
      opsByPage.get(pIdx).push(op);
    }

    const anyPageNeedsRasterRedact = Array.from(opsByPage.values()).some((list) =>
      list.some((op) => op.type === 'redact')
    );

    let pdfjsDoc = null;
    const canvasFactory = new NapiCanvasFactory();
    if (anyPageNeedsRasterRedact) {
      const loadingTask = getPdfjs().getDocument({
        data: new Uint8Array(buffer),
        useSystemFonts: true,
        disableFontFace: false,
        canvasFactory,
      });
      pdfjsDoc = await loadingTask.promise;
    }

    let cjkFont = null;
    const ensureCjkFont = async () => {
      if (cjkFont) return cjkFont;
      const fontBytes = DocumentService.getSystemCjkFontBytes();
      if (fontBytes) {
        try {
          cjkFont = await outDoc.embedFont(fontBytes, { subset: true });
        } catch (_) {}
      }
      return cjkFont;
    };

    const validDpi = Math.max(120, Math.min(300, Number(dpi) || 200));
    const baseScale = validDpi / 72;

    for (let pIdx = 0; pIdx < totalPages; pIdx++) {
      const pageOps = opsByPage.get(pIdx) || [];
      const hasRedact = pageOps.some((op) => op.type === 'redact');
      const srcPage = srcDoc.getPage(pIdx);
      const { width: origW, height: origH } = srcPage.getSize();

      if (hasRedact && pdfjsDoc) {
        // 物理级光栅化脱敏：渲染为高分辨率位图 -> 像素级实心遮盖 + 签章/批注合成 -> 销毁原文本图层
        const pdfPage = await pdfjsDoc.getPage(pIdx + 1);
        const rawVp = pdfPage.getViewport({ scale: 1.0 });
        const maxSide = Math.max(rawVp.width * baseScale, rawVp.height * baseScale);
        const effectiveScale = maxSide > 3600 ? (3600 / Math.max(rawVp.width, rawVp.height)) : baseScale;
        const viewport = pdfPage.getViewport({ scale: effectiveScale });

        const canvasAndCtx = canvasFactory.create(viewport.width, viewport.height);
        await pdfPage.render({
          canvasContext: canvasAndCtx.context,
          viewport,
          canvasFactory,
        }).promise;

        const ctx = canvasAndCtx.context;
        const cw = canvasAndCtx.canvas.width;
        const ch = canvasAndCtx.canvas.height;

        for (const op of pageOps) {
          const rx = Math.max(0, Math.min(cw, (Number(op.xRatio) || 0) * cw));
          const ry = Math.max(0, Math.min(ch, (Number(op.yRatio) || 0) * ch));
          const rw = Math.max(4, Math.min(cw - rx, (Number(op.wRatio) || 0.15) * cw));
          const rh = Math.max(4, Math.min(ch - ry, (Number(op.hRatio) || 0.05) * ch));

          if (op.type === 'redact') {
            const { css, r, g, b } = DocumentService.parseHexColor(op.color || '#000000');
            ctx.save();
            ctx.fillStyle = css;
            ctx.fillRect(rx, ry, rw, rh);
            if (op.text && String(op.text).trim()) {
              const luma = 0.299 * r + 0.587 * g + 0.114 * b;
              ctx.fillStyle = luma < 128 ? '#FFFFFF' : '#000000';
              const fSize = Math.max(10, Math.min(rh * 0.65, 28));
              ctx.font = `bold ${Math.round(fSize)}px "Microsoft YaHei", sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(String(op.text).trim(), rx + rw / 2, ry + rh / 2, rw - 6);
            }
            ctx.restore();
          } else if (op.type === 'stamp') {
            try {
              let rawImgBuf = null;
              if (op.imageBuffer) {
                rawImgBuf = Buffer.isBuffer(op.imageBuffer) ? op.imageBuffer : Buffer.from(op.imageBuffer);
              } else if (op.imageBase64) {
                const b64 = String(op.imageBase64).replace(/^data:image\/\w+;base64,/, '');
                rawImgBuf = Buffer.from(b64, 'base64');
              }
              if (rawImgBuf && rawImgBuf.length > 0) {
                const resizedPng = await getSharp()(rawImgBuf)
                  .resize(Math.max(1, Math.round(rw)), Math.max(1, Math.round(rh)), {
                    fit: 'contain',
                    background: { r: 0, g: 0, b: 0, alpha: 0 },
                  })
                  .png()
                  .toBuffer();
                const imgObj = await getCanvasModule().loadImage(resizedPng);
                ctx.drawImage(imgObj, rx, ry, rw, rh);
              }
            } catch (_) {}
          } else if (op.type === 'annotation' && op.text) {
            const { css } = DocumentService.parseHexColor(op.color || '#DC2626');
            const fSize = Math.max(10, Math.round((Number(op.fontSize) || 16) * effectiveScale));
            ctx.save();
            ctx.fillStyle = css;
            ctx.font = `bold ${fSize}px "Microsoft YaHei", sans-serif`;
            ctx.textBaseline = 'top';
            const lines = String(op.text).split(/\r?\n/);
            lines.forEach((line, idx) => {
              ctx.fillText(line, rx, ry + idx * (fSize * 1.25));
            });
            ctx.restore();
          }
        }

        const flatPngBuf = canvasAndCtx.canvas.toBuffer('image/png');
        canvasFactory.destroy(canvasAndCtx);

        const embeddedFlat = await outDoc.embedPng(flatPngBuf);
        const newPage = outDoc.addPage([origW, origH]);
        newPage.drawImage(embeddedFlat, {
          x: 0,
          y: 0,
          width: origW,
          height: origH,
        });
      } else {
        // 无脱敏操作：直接无损拷贝原矢量页，并在顶层叠加签章或文字批注
        const [copiedPage] = await outDoc.copyPages(srcDoc, [pIdx]);
        outDoc.addPage(copiedPage);

        if (pageOps.length > 0) {
          for (const op of pageOps) {
            const bx = Math.max(0, (Number(op.xRatio) || 0) * origW);
            const bw = Math.max(8, (Number(op.wRatio) || 0.18) * origW);
            const bh = Math.max(8, (Number(op.hRatio) || 0.08) * origH);
            const by = Math.max(0, origH - ((Number(op.yRatio) || 0) * origH) - bh);

            if (op.type === 'stamp') {
              try {
                let rawImgBuf = null;
                if (op.imageBuffer) {
                  rawImgBuf = Buffer.isBuffer(op.imageBuffer) ? op.imageBuffer : Buffer.from(op.imageBuffer);
                } else if (op.imageBase64) {
                  const b64 = String(op.imageBase64).replace(/^data:image\/\w+;base64,/, '');
                  rawImgBuf = Buffer.from(b64, 'base64');
                }
                if (rawImgBuf && rawImgBuf.length > 0) {
                  const pngBuf = await getSharp()(rawImgBuf).png().toBuffer();
                  const embeddedStamp = await outDoc.embedPng(pngBuf);
                  copiedPage.drawImage(embeddedStamp, {
                    x: bx,
                    y: by,
                    width: bw,
                    height: bh,
                  });
                }
              } catch (_) {}
            } else if (op.type === 'annotation' && op.text) {
              const font = await ensureCjkFont();
              const { pdfRgb } = DocumentService.parseHexColor(op.color || '#DC2626');
              const fSize = Math.max(8, Math.min(72, Number(op.fontSize) || 16));
              const lines = String(op.text).split(/\r?\n/);
              const topY = origH - (Number(op.yRatio) || 0) * origH - fSize;
              lines.forEach((line, idx) => {
                if (!line.trim()) return;
                try {
                  copiedPage.drawText(line, {
                    x: bx,
                    y: Math.max(4, topY - idx * (fSize * 1.25)),
                    size: fSize,
                    font: font || undefined,
                    color: pdfRgb,
                  });
                } catch (_) {}
              });
            }
          }
        }
      }

      if (onProgress) {
        const pct = Math.round(((pIdx + 1) / totalPages) * 95);
        onProgress({
          task: 'document:sign-and-redact',
          current: pIdx + 1,
          total: totalPages,
          percent: pct,
          message: `正在处理第 ${pIdx + 1}/${totalPages} 页${hasRedact ? ' (底层光栅涂黑脱敏)' : ''}...`,
        });
      }
    }

    const baseName = fileName.replace(/\.[^/.]+$/, '');
    const outBytes = await outDoc.save({ useObjectStreams: true });
    if (onProgress) {
      onProgress({
        task: 'document:sign-and-redact',
        current: totalPages,
        total: totalPages,
        percent: 100,
        message: '签章与脱敏处理完成！',
      });
    }

    return {
      buffer: Buffer.from(outBytes),
      filename: `${baseName}_signed_redacted.pdf`,
      totalPages,
      redactedPageCount: Array.from(opsByPage.values()).filter((list) =>
        list.some((op) => op.type === 'redact')
      ).length,
    };
  }

  /**
   * 工具 B：PDF 转高清长图与切片导出 (PDF to Images)
   * - mode === 'zip': 逐页 300DPI 光栅化导出为 PNG/JPG 并打包为高清图片 ZIP。
   * - mode === 'long-image': 使用 sharp 纵向拼接为“一图流”超清长图，内置 15500px 高度溢出自动分卷保护，杜绝内存与编码器溢出。
   */
  static async pdfToImages(
    {
      fileBuffer,
      fileName = 'document.pdf',
      mode = 'zip',
      format = 'png',
      dpi = 300,
      quality = 92,
      pageRanges = '',
    },
    onProgress
  ) {
    const buffer = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer);
    const canvasFactory = new NapiCanvasFactory();
    const loadingTask = getPdfjs().getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
      disableFontFace: false,
      canvasFactory,
    });
    const pdfjsDoc = await loadingTask.promise;
    const totalPages = pdfjsDoc.numPages;
    if (totalPages === 0) {
      throw new Error('PDF 文档不包含任何页面');
    }

    let indices = [];
    if (pageRanges && String(pageRanges).trim()) {
      indices = DocumentService.parsePageRanges(pageRanges, totalPages);
    } else {
      indices = Array.from({ length: totalPages }, (_, i) => i);
    }
    if (indices.length === 0) {
      throw new Error('未匹配到有效的页码范围');
    }

    const validDpi = Math.max(72, Math.min(300, Number(dpi) || 300));
    const baseScale = validDpi / 72;
    const fmt = String(format || 'png').toLowerCase() === 'jpeg' || String(format || 'png').toLowerCase() === 'jpg'
      ? 'jpg'
      : 'png';
    const q = Math.max(40, Math.min(100, Number(quality) || 92));
    const baseName = fileName.replace(/\.[^/.]+$/, '');

    // 1. 逐页光栅化并立即回收 Canvas 原生内存
    const renderedPages = [];
    for (let i = 0; i < indices.length; i++) {
      const pageNum = indices[i] + 1;
      const page = await pdfjsDoc.getPage(pageNum);
      const rawVp = page.getViewport({ scale: 1.0 });
      // 单页最大边长安全保护 (3600px)，防止超大工程图纸在 300DPI 下引发内存峰值
      const maxDim = Math.max(rawVp.width * baseScale, rawVp.height * baseScale);
      const effectiveScale = maxDim > 3600 ? (3600 / Math.max(rawVp.width, rawVp.height)) : baseScale;
      const viewport = page.getViewport({ scale: effectiveScale });

      const canvasAndCtx = canvasFactory.create(viewport.width, viewport.height);
      await page.render({
        canvasContext: canvasAndCtx.context,
        viewport,
        canvasFactory,
      }).promise;

      const rawPng = canvasAndCtx.canvas.toBuffer('image/png');
      const w = canvasAndCtx.canvas.width;
      const h = canvasAndCtx.canvas.height;
      canvasFactory.destroy(canvasAndCtx);

      renderedPages.push({
        pageNum,
        rawPng,
        width: w,
        height: h,
      });

      if (onProgress) {
        const pct = Math.round(((i + 1) / indices.length) * 75);
        onProgress({
          task: 'document:pdf-to-images',
          current: i + 1,
          total: indices.length,
          percent: pct,
          message: `正在高精度光栅化第 ${pageNum} 页 (${i + 1}/${indices.length})...`,
        });
      }
    }

    // 2A. 纵向拼接“一图流”超清长图（带高度溢出分卷保护）
    if (mode === 'long-image') {
      const MAX_VOLUME_HEIGHT = 15500; // 严格低于 libvips/WebP 16383px 硬上限与 Buffer 安全阈值
      const DIVIDER_HEIGHT = 8;
      const targetWidth = Math.max(...renderedPages.map((p) => p.width));

      // 归一化所有页面宽度至 targetWidth
      const normalizedPages = [];
      for (const p of renderedPages) {
        if (p.width !== targetWidth) {
          const resizedBuf = await getSharp()(p.rawPng)
            .resize({ width: targetWidth })
            .png()
            .toBuffer();
          const meta = await getSharp()(resizedBuf).metadata();
          normalizedPages.push({
            pageNum: p.pageNum,
            buffer: resizedBuf,
            width: targetWidth,
            height: meta.height || p.height,
          });
        } else {
          normalizedPages.push({
            pageNum: p.pageNum,
            buffer: p.rawPng,
            width: p.width,
            height: p.height,
          });
        }
      }

      // 按高度上限自动切分卷 (Volumes)
      const volumes = [];
      let currentVol = [];
      let currentHeight = 0;

      for (const p of normalizedPages) {
        const addedH = currentVol.length === 0 ? p.height : p.height + DIVIDER_HEIGHT;
        if (currentVol.length > 0 && currentHeight + addedH > MAX_VOLUME_HEIGHT) {
          volumes.push({ pages: currentVol, totalHeight: currentHeight });
          currentVol = [p];
          currentHeight = p.height;
        } else {
          currentVol.push(p);
          currentHeight += addedH;
        }
      }
      if (currentVol.length > 0) {
        volumes.push({ pages: currentVol, totalHeight: currentHeight });
      }

      const volumeOutputs = [];
      for (let vIdx = 0; vIdx < volumes.length; vIdx++) {
        const vol = volumes[vIdx];
        let yOffset = 0;
        const composites = [];
        for (const p of vol.pages) {
          composites.push({
            input: p.buffer,
            top: yOffset,
            left: 0,
          });
          yOffset += p.height + DIVIDER_HEIGHT;
        }

        let stitchPipeline = getSharp()({
          create: {
            width: targetWidth,
            height: vol.totalHeight,
            channels: 4,
            background: { r: 232, g: 226, b: 220, alpha: 1 },
          },
        }).composite(composites);

        const volBuf = fmt === 'jpg'
          ? await stitchPipeline.jpeg({ quality: q, mozjpeg: true }).toBuffer()
          : await stitchPipeline.png({ compressionLevel: 8 }).toBuffer();

        volumeOutputs.push({
          buffer: volBuf,
          filename: volumes.length === 1
            ? `${baseName}_长图_${validDpi}dpi.${fmt}`
            : `${baseName}_长图_第${vIdx + 1}卷.${fmt}`,
        });
      }

      if (volumeOutputs.length === 1) {
        if (onProgress) {
          onProgress({
            task: 'document:pdf-to-images',
            current: indices.length,
            total: indices.length,
            percent: 100,
            message: '超清长图拼接完成！',
          });
        }
        return {
          buffer: volumeOutputs[0].buffer,
          filename: volumeOutputs[0].filename,
          pageCount: indices.length,
          volumeCount: 1,
          isMultiPart: false,
          isZip: false,
          totalHeight: volumes[0].totalHeight,
        };
      }

      // 超长文档已触发高度溢出保护，自动将多卷长图打包为 ZIP
      return new Promise((resolve, reject) => {
        try {
          const archive = new ZipArchive({ zlib: { level: 9 } });
          const chunks = [];
          archive.on('data', (c) => chunks.push(c));
          archive.on('end', () => {
            if (onProgress) {
              onProgress({
                task: 'document:pdf-to-images',
                current: indices.length,
                total: indices.length,
                percent: 100,
                message: `超长文档已自动分卷打包 (${volumeOutputs.length} 卷)！`,
              });
            }
            resolve({
              buffer: Buffer.concat(chunks),
              filename: `${baseName}_长图分卷包_${volumeOutputs.length}卷.zip`,
              pageCount: indices.length,
              volumeCount: volumeOutputs.length,
              isMultiPart: true,
              isZip: true,
              totalHeight: volumes.reduce((s, v) => s + v.totalHeight, 0),
            });
          });
          archive.on('error', (err) => reject(err));
          for (const vo of volumeOutputs) {
            archive.append(vo.buffer, { name: vo.filename });
          }
          archive.finalize();
        } catch (err) {
          reject(err);
        }
      });
    }

    // 2B. 批量高清切片图片打包为 ZIP (若仅 1 页且用户选 zip，同样打包入 ZIP 保证格式一致，或直接输出归档)
    const encodedSlices = [];
    for (const p of renderedPages) {
      const sliceBuf = fmt === 'jpg'
        ? await getSharp()(p.rawPng).flatten({ background: '#FFFFFF' }).jpeg({ quality: q, mozjpeg: true }).toBuffer()
        : await getSharp()(p.rawPng).png({ compressionLevel: 8 }).toBuffer();
      const padNum = String(p.pageNum).padStart(3, '0');
      encodedSlices.push({
        buffer: sliceBuf,
        filename: `${baseName}_page_${padNum}.${fmt}`,
      });
    }

    return new Promise((resolve, reject) => {
      try {
        const archive = new ZipArchive({ zlib: { level: 9 } });
        const chunks = [];
        archive.on('data', (c) => chunks.push(c));
        archive.on('end', () => {
          if (onProgress) {
            onProgress({
              task: 'document:pdf-to-images',
              current: indices.length,
              total: indices.length,
              percent: 100,
              message: '高清图片切片 ZIP 打包完成！',
            });
          }
          resolve({
            buffer: Buffer.concat(chunks),
            filename: `${baseName}_${validDpi}dpi_${encodedSlices.length}p.zip`,
            pageCount: encodedSlices.length,
            volumeCount: encodedSlices.length,
            isMultiPart: true,
            isZip: true,
          });
        });
        archive.on('error', (err) => reject(err));
        for (const item of encodedSlices) {
          archive.append(item.buffer, { name: item.filename });
        }
        archive.finalize();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * 工具 C：多页合一缩印拼版 (Multi-Page N-Up Imposition)
   * - 使用 pdf-lib 的 embedPage() 将 2 / 4 / 6 / 9 页无损矢量缩印至单张标准 A4 纸中
   * - 支持绘制细灰分割边框线、自定义页边距与横纵向智能适配（发票/讲义合打神器）
   */
  static async nupPdf(
    {
      fileBuffer,
      fileName = 'document.pdf',
      pagesPerSheet = 4,
      orientation = 'auto',
      drawBorder = true,
      marginPt = 24,
    },
    onProgress
  ) {
    const buffer = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer);
    const srcDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const srcPages = srcDoc.getPages();
    const totalSrcPages = srcPages.length;
    if (totalSrcPages === 0) {
      throw new Error('PDF 文档不包含任何页面');
    }

    const n = [2, 4, 6, 9].includes(Number(pagesPerSheet)) ? Number(pagesPerSheet) : 4;
    const isLandscape =
      orientation === 'landscape' ||
      (orientation === 'auto' && (n === 2 || n === 6));

    // 标准 A4 物理尺寸 (pt)
    const A4_SHORT = 595.28;
    const A4_LONG = 841.89;
    const sheetW = isLandscape ? A4_LONG : A4_SHORT;
    const sheetH = isLandscape ? A4_SHORT : A4_LONG;

    let cols = 2;
    let rows = 2;
    if (n === 2) {
      cols = isLandscape ? 2 : 1;
      rows = isLandscape ? 1 : 2;
    } else if (n === 4) {
      cols = 2;
      rows = 2;
    } else if (n === 6) {
      cols = isLandscape ? 3 : 2;
      rows = isLandscape ? 2 : 3;
    } else if (n === 9) {
      cols = 3;
      rows = 3;
    }

    const outDoc = await PDFDocument.create();
    const margin = Math.max(0, Math.min(72, Number(marginPt) ?? 24));
    const gap = Math.max(6, Math.round(margin * 0.45));

    const usableW = Math.max(100, sheetW - margin * 2 - gap * (cols - 1));
    const usableH = Math.max(100, sheetH - margin * 2 - gap * (rows - 1));
    const cellW = usableW / cols;
    const cellH = usableH / rows;
    const innerPad = drawBorder ? 6 : 2;

    const totalSheets = Math.ceil(totalSrcPages / n);

    for (let sIdx = 0; sIdx < totalSheets; sIdx++) {
      const sheetPage = outDoc.addPage([sheetW, sheetH]);
      const startIdx = sIdx * n;
      const endIdx = Math.min(totalSrcPages, startIdx + n);

      for (let i = startIdx; i < endIdx; i++) {
        const localIdx = i - startIdx;
        const col = localIdx % cols;
        const row = Math.floor(localIdx / cols);

        const cellX = margin + col * (cellW + gap);
        // PDF 原点在左下角，第一行 (row=0) 位于页面最上方
        const cellY = sheetH - margin - (row + 1) * cellH - row * gap;

        if (drawBorder) {
          sheetPage.drawRectangle({
            x: cellX,
            y: cellY,
            width: cellW,
            height: cellH,
            borderColor: rgb(0.82, 0.82, 0.82),
            borderWidth: 0.6,
          });
        }

        try {
          const embeddedPage = await outDoc.embedPage(srcPages[i]);
          const ew = embeddedPage.width || 1;
          const eh = embeddedPage.height || 1;

          const availW = Math.max(10, cellW - innerPad * 2);
          const availH = Math.max(10, cellH - innerPad * 2);
          const scale = Math.min(availW / ew, availH / eh);

          const drawW = ew * scale;
          const drawH = eh * scale;
          const drawX = cellX + (cellW - drawW) / 2;
          const drawY = cellY + (cellH - drawH) / 2;

          sheetPage.drawPage(embeddedPage, {
            x: drawX,
            y: drawY,
            width: drawW,
            height: drawH,
          });
        } catch (_) {
          // 若遇到空白无内容流的特殊页面，保持空白格即可
        }
      }

      if (onProgress) {
        const pct = Math.round(((sIdx + 1) / totalSheets) * 95);
        onProgress({
          task: 'document:nup-pdf',
          current: sIdx + 1,
          total: totalSheets,
          percent: pct,
          message: `正在拼版第 ${sIdx + 1}/${totalSheets} 张 A4 印张...`,
        });
      }
    }

    const baseName = fileName.replace(/\.[^/.]+$/, '');
    const outBytes = await outDoc.save({ useObjectStreams: true });
    if (onProgress) {
      onProgress({
        task: 'document:nup-pdf',
        current: totalSheets,
        total: totalSheets,
        percent: 100,
        message: `${n} 合 1 矢量拼版完成！`,
      });
    }

    return {
      buffer: Buffer.from(outBytes),
      filename: `${baseName}_${n}up_A4.pdf`,
      inputPages: totalSrcPages,
      sourcePages: totalSrcPages,
      outputSheets: totalSheets,
      pagesPerSheet: n,
    };
  }
}

module.exports = DocumentService;
