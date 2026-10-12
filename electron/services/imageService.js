const sharp = require('sharp');

class ImageService {
  /**
   * 将多个 PNG 图像打包为 Windows 标准多尺寸 ICO 格式
   */
  static buildIcoBuffer(pngBuffers, sizes) {
    const header = Buffer.alloc(6);
    header.writeUInt16LE(0, 0); // Reserved
    header.writeUInt16LE(1, 2); // Type: 1 = ICO
    header.writeUInt16LE(pngBuffers.length, 4);

    const entries = [];
    let offset = 6 + 16 * pngBuffers.length;

    for (let i = 0; i < pngBuffers.length; i++) {
      const buf = pngBuffers[i];
      const s = sizes[i];
      const entry = Buffer.alloc(16);
      entry.writeUInt8(s >= 256 ? 0 : s, 0); // Width (0 means 256)
      entry.writeUInt8(s >= 256 ? 0 : s, 1); // Height (0 means 256)
      entry.writeUInt8(0, 2); // Colors
      entry.writeUInt8(0, 3); // Reserved
      entry.writeUInt16LE(1, 4); // Color planes
      entry.writeUInt16LE(32, 6); // Bits per pixel
      entry.writeUInt32LE(buf.length, 8); // Size in bytes
      entry.writeUInt32LE(offset, 12); // Offset
      entries.push(entry);
      offset += buf.length;
    }

    return Buffer.concat([header, ...entries, ...pngBuffers]);
  }

  /**
   * 图像格式转换 (高保真 libvips 流式处理)
   */
  static async convertImage({
    fileBuffer,
    fileName = 'image.png',
    targetFormat = 'webp',
    quality = 85,
    fillBg = '#FFFFFF',
  }) {
    const buffer = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer);
    const fmt = String(targetFormat).toLowerCase().trim();
    const q = Math.max(1, Math.min(100, Number(quality) || 85));
    const baseName = fileName.replace(/\.[^/.]+$/, '');

    let pipeline = sharp(buffer).rotate(); // 自动矫正 EXIF 方向

    if (fmt === 'jpg' || fmt === 'jpeg') {
      const outBuffer = await pipeline
        .flatten({ background: fillBg || '#FFFFFF' })
        .jpeg({ quality: q, mozjpeg: true })
        .toBuffer();
      return { buffer: outBuffer, filename: `${baseName}.${fmt}` };
    }

    if (fmt === 'png') {
      const outBuffer = await pipeline.png({ quality: q, compressionLevel: 9 }).toBuffer();
      return { buffer: outBuffer, filename: `${baseName}.png` };
    }

    if (fmt === 'webp') {
      const outBuffer = await pipeline.webp({ quality: q, effort: 4 }).toBuffer();
      return { buffer: outBuffer, filename: `${baseName}.webp` };
    }

    if (fmt === 'avif') {
      const outBuffer = await pipeline.avif({ quality: q, effort: 4 }).toBuffer();
      return { buffer: outBuffer, filename: `${baseName}.avif` };
    }

    if (fmt === 'ico') {
      // 生成 Windows 标准多分辨率 ICO
      const icoSizes = [16, 32, 48, 64, 128, 256];
      const pngBuffers = [];
      for (const s of icoSizes) {
        const sBuf = await sharp(buffer)
          .rotate()
          .resize(s, s, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png()
          .toBuffer();
        pngBuffers.push(sBuf);
      }
      const icoBuffer = ImageService.buildIcoBuffer(pngBuffers, icoSizes);
      return { buffer: icoBuffer, filename: `${baseName}.ico` };
    }

    if (fmt === 'tiff') {
      const outBuffer = await pipeline.tiff({ quality: q }).toBuffer();
      return { buffer: outBuffer, filename: `${baseName}.tiff` };
    }

    if (fmt === 'bmp') {
      // sharp 可以通过 png / webp 格式或原生兼容输出
      const outBuffer = await pipeline.png().toBuffer();
      return { buffer: outBuffer, filename: `${baseName}.png` };
    }

    // 默认转换为 PNG
    const outBuffer = await pipeline.png().toBuffer();
    return { buffer: outBuffer, filename: `${baseName}.${fmt}` };
  }

  /**
   * 图像尺寸缩放
   */
  static async resizeImage({
    fileBuffer,
    fileName = 'image.png',
    targetWidth,
    targetHeight,
    maintainAspect = true,
  }) {
    const buffer = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer);
    const baseName = fileName.replace(/\.[^/.]+$/, '');
    const ext = fileName.split('.').pop() || 'png';

    const pipeline = sharp(buffer).rotate().resize({
      width: targetWidth ? Number(targetWidth) : undefined,
      height: targetHeight ? Number(targetHeight) : undefined,
      fit: maintainAspect ? 'inside' : 'fill',
    });

    const outBuffer = await pipeline.toBuffer();
    return {
      buffer: outBuffer,
      filename: `${baseName}_resized.${ext}`,
    };
  }

  /**
   * 剥离 EXIF 元数据 (保护地理位置与相机隐私)
   */
  static async stripExif({ fileBuffer, fileName = 'image.png' }) {
    const buffer = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer);
    const outBuffer = await sharp(buffer).rotate().withMetadata(false).toBuffer();
    return {
      buffer: outBuffer,
      filename: `clean_${fileName}`,
    };
  }
}

module.exports = ImageService;
