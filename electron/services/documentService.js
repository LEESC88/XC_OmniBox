const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const { PDFDocument, rgb, degrees } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');
const sharp = require('sharp');
const { ZipArchive } = require('archiver');
const { encryptPDF } = require('@pdfsmaller/pdf-encrypt-lite');

// Initialize pdfjs-dist with @napi-rs/canvas polyfills for in-process rendering
const canvasModule = require('@napi-rs/canvas');
if (typeof global.DOMMatrix === 'undefined') {
  global.DOMMatrix = canvasModule.DOMMatrix;
}
if (typeof global.Path2D === 'undefined') {
  global.Path2D = canvasModule.Path2D;
}
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');

class DocumentService {
  /**
   * PDF 合并
   */
  static async mergePdfs({ files }) {
    if (!files || files.length < 2) {
      throw new Error('请至少上传 2 个 PDF 文件进行合并');
    }

    const mergedDoc = await PDFDocument.create();

    for (const file of files) {
      const buffer = Buffer.isBuffer(file.buffer) ? file.buffer : Buffer.from(file.buffer);
      const srcDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      const copiedPages = await mergedDoc.copyPages(srcDoc, srcDoc.getPageIndices());
      copiedPages.forEach((p) => mergedDoc.addPage(p));
    }

    const mergedBytes = await mergedDoc.save({ useObjectStreams: true });
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
   * PDF 密码保护
   */
  static async protectPdf({ fileBuffer, fileName = 'document.pdf', password }) {
    if (!password) {
      throw new Error('请设置保护密码');
    }
    const buffer = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer);
    const encryptedBytes = await encryptPDF(buffer, password, password);

    return {
      buffer: Buffer.from(encryptedBytes),
      filename: `protected_${fileName}`,
    };
  }

  /**
   * PDF 压缩优化
   */
  static async compressPdf({ fileBuffer, fileName = 'document.pdf', level = 'medium' }) {
    const buffer = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer);
    const originalSize = buffer.length;

    const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    // 启用对象流和冗余字典压缩
    const compressedBytes = await doc.save({
      useObjectStreams: true,
      addDefaultPage: false,
      preservePDFForm: true,
    });

    const compressedBuffer = Buffer.from(compressedBytes);
    return {
      buffer: compressedBuffer,
      filename: `compressed_${fileName}`,
      originalSize,
      compressedSize: compressedBuffer.length,
    };
  }

  /**
   * 图片合成 PDF
   */
  static async imagesToPdf({ files, pageSize = 'fit' }) {
    if (!files || files.length === 0) {
      throw new Error('请至少上传一张图片进行合成');
    }

    const doc = await PDFDocument.create();
    const isA4 = String(pageSize).toLowerCase() === 'a4';
    const a4Width = 595.28;
    const a4Height = 841.89;

    for (const f of files) {
      const buffer = Buffer.isBuffer(f.buffer) ? f.buffer : Buffer.from(f.buffer);

      // 通过 sharp 统一转为标准 PNG，解决各种奇特图片编码与色彩空间
      const pngBuffer = await sharp(buffer).png().toBuffer();
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
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
      disableFontFace: false,
    });

    const doc = await loadingTask.promise;
    const numPages = doc.numPages;
    const limit = maxPages ? Math.min(numPages, Number(maxPages)) : numPages;
    const scale = (Number(dpi) || 100) / 72;
    const pages = [];

    for (let i = 1; i <= limit; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale });
      const canvas = canvasModule.createCanvas(Math.round(viewport.width), Math.round(viewport.height));
      const ctx = canvas.getContext('2d');

      await page.render({
        canvasContext: ctx,
        viewport,
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
   * Word 转 PDF (调用 Windows 原生 Word COM)
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
        `$word = New-Object -ComObject Word.Application`,
        `$word.Visible = $false`,
        `$word.DisplayAlerts = 0`,
        `try {`,
        `  $doc = $word.Documents.Open("${inputDocx.replace(/\\/g, '\\\\')}", $false, $true)`,
        `  $doc.ExportAsFixedFormat("${outputPdf.replace(/\\/g, '\\\\')}", 17, $false, ${optimizeCode})`,
        `  $doc.Close($false)`,
        `} finally {`,
        `  $word.Quit()`,
        `  [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null`,
        `}`,
      ].join('\r\n');

      fs.writeFileSync(psScriptPath, psContent, 'utf8');

      execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${psScriptPath}"`, {
        timeout: 60000,
        windowsHide: true,
      });

      if (!fs.existsSync(outputPdf)) {
        throw new Error('Word 转 PDF 导出未生成结果文件');
      }

      const pdfData = fs.readFileSync(outputPdf);
      return {
        buffer: pdfData,
        filename: path.basename(outputPdf),
      };
    } finally {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (_) {}
    }
  }

  /**
   * PDF 转 Word (调用 Windows 原生 Word COM 智能重排转换)
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
        `$word = New-Object -ComObject Word.Application`,
        `$word.Visible = $false`,
        `$word.DisplayAlerts = 0`,
        `try {`,
        `  $doc = $word.Documents.Open("${inputPdf.replace(/\\/g, '\\\\')}", $false, $true)`,
        `  $doc.SaveAs2("${outputDocx.replace(/\\/g, '\\\\')}", 16)`,
        `  $doc.Close($false)`,
        `} finally {`,
        `  $word.Quit()`,
        `  [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null`,
        `}`,
      ].join('\r\n');

      fs.writeFileSync(psScriptPath, psContent, 'utf8');

      execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${psScriptPath}"`, {
        timeout: 60000,
        windowsHide: true,
      });

      if (!fs.existsSync(outputDocx)) {
        throw new Error('PDF 转 Word 导出未生成结果文件');
      }

      const docxData = fs.readFileSync(outputDocx);
      return {
        buffer: docxData,
        filename: path.basename(outputDocx),
      };
    } finally {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (_) {}
    }
  }
}

module.exports = DocumentService;
