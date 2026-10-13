const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { shell, app } = require('electron');

class UtilityService {
  /**
   * 递归快速扫描目录结构与元信息
   */
  static async scanFolder({ folderPath, maxDepth = 10 }) {
    if (!folderPath || !fs.existsSync(folderPath)) {
      throw new Error('指定文件夹路径不存在或无权访问');
    }

    const results = [];
    function walk(currentDir, depth) {
      if (depth > maxDepth) return;
      let entries = [];
      try {
        entries = fs.readdirSync(currentDir, { withFileTypes: true });
      } catch (_) {
        return;
      }

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        try {
          if (entry.isDirectory()) {
            if (['.git', 'node_modules', '$RECYCLE.BIN', 'System Volume Information'].includes(entry.name)) {
              continue;
            }
            walk(fullPath, depth + 1);
          } else if (entry.isFile()) {
            const stat = fs.statSync(fullPath);
            results.push({
              path: fullPath,
              name: entry.name,
              size: stat.size,
              mtime: stat.mtimeMs,
              ext: path.extname(entry.name).toLowerCase(),
              relPath: path.relative(folderPath, fullPath),
            });
          }
        } catch (_) {}
      }
    }

    walk(folderPath, 0);
    return { success: true, files: results, count: results.length };
  }

  /**
   * 目录分类归档批量执行
   */
  static async organizeExecute({ tasks }) {
    const executed = [];
    const errors = [];

    for (const task of tasks) {
      try {
        const sourceResolved = path.resolve(task.sourcePath);
        const targetResolved = path.resolve(task.targetPath);

        if (sourceResolved === targetResolved) {
          executed.push({ source: task.sourcePath, target: task.targetPath, skipped: true });
          continue;
        }

        const targetDir = path.dirname(task.targetPath);
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }

        let finalTarget = task.targetPath;
        let count = 1;
        const parsed = path.parse(task.targetPath);
        while (fs.existsSync(finalTarget)) {
          if (path.resolve(finalTarget) === sourceResolved) {
            break;
          }
          finalTarget = path.join(parsed.dir, `${parsed.name} (${count})${parsed.ext}`);
          count++;
        }

        if (path.resolve(finalTarget) === sourceResolved) {
          executed.push({ source: task.sourcePath, target: finalTarget, skipped: true });
          continue;
        }

        fs.renameSync(task.sourcePath, finalTarget);
        executed.push({ source: task.sourcePath, target: finalTarget });
      } catch (err) {
        errors.push({ source: task.sourcePath, error: err.message });
      }
    }

    return {
      success: executed.length > 0 || errors.length === 0,
      count: executed.length,
      successCount: executed.length,
      errorCount: errors.length,
      executed,
      errors,
    };
  }

  /**
   * 安全删除至系统回收站 (调用 OS 原生回收站，支持恢复)
   */
  static async trashItems({ paths }) {
    let trashedCount = 0;
    const errors = [];

    for (const p of paths) {
      try {
        if (fs.existsSync(p)) {
          await shell.trashItem(p);
          trashedCount++;
        }
      } catch (err) {
        errors.push({ path: p, error: err.message });
      }
    }

    return {
      success: true,
      count: trashedCount,
      trashedCount,
      errorCount: errors.length,
      errors,
    };
  }

  /**
   * 三级极速哈希分块计算 (用于大文件秒级去重)
   */
  static async readFileHash({ filePath, partialBytes }) {
    if (!fs.existsSync(filePath)) {
      throw new Error('文件不存在');
    }

    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('md5');
      const streamOptions = partialBytes ? { start: 0, end: partialBytes - 1 } : {};
      const stream = fs.createReadStream(filePath, streamOptions);

      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', (err) => reject(err));
    });
  }

  /**
   * 批量保存文件到本地目录
   */
  static async saveBatch({ files, targetFolder, defaultPath }) {
    let outDir = targetFolder || defaultPath;
    if (!outDir) {
      try {
        outDir = app.getPath('downloads');
      } catch (_) {
        outDir = process.cwd();
      }
    }
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    const savedPaths = [];
    for (const f of files) {
      const sanitizedName = path.basename(f.name);
      let filePath = path.join(outDir, sanitizedName);
      let count = 1;
      const parsed = path.parse(sanitizedName);
      while (fs.existsSync(filePath)) {
        filePath = path.join(outDir, `${parsed.name}_(${count})${parsed.ext}`);
        count++;
      }
      const buffer = Buffer.isBuffer(f.buffer) ? f.buffer : Buffer.from(f.buffer);
      await fs.promises.writeFile(filePath, buffer);
      savedPaths.push(filePath);
    }
    return { success: true, folder: outDir, count: savedPaths.length };
  }

  /**
   * 三级极速排重引擎 (Level 1: 大小聚类 -> Level 2: 头部 4KB 哈希 -> Level 3: 全量 MD5)
   */
  static async findDuplicates({ files }, onProgress) {
    if (!Array.isArray(files) || files.length === 0) return [];
    const validFiles = files.filter((f) => f && f.size > 0);
    if (validFiles.length < 2) return [];

    if (onProgress) onProgress({ task: 'duplicate-scan', current: 1, total: 3, percent: 20 });

    // Level 1: 大小聚类
    const sizeMap = new Map();
    for (const f of validFiles) {
      const list = sizeMap.get(f.size) || [];
      list.push(f);
      sizeMap.set(f.size, list);
    }
    const candidatesLevel1 = Array.from(sizeMap.values()).filter((g) => g.length > 1);
    if (candidatesLevel1.length === 0) return [];

    if (onProgress) onProgress({ task: 'duplicate-scan', current: 2, total: 3, percent: 55 });

    // Level 2: 头部 4KB 哈希
    const headHashMap = new Map();
    for (const group of candidatesLevel1) {
      for (const file of group) {
        let headHash;
        try {
          if (file.path && fs.existsSync(file.path)) {
            headHash = await UtilityService.readFileHash({ filePath: file.path, partialBytes: 4096 });
          } else if (file.buffer) {
            const buf = Buffer.isBuffer(file.buffer) ? file.buffer : Buffer.from(file.buffer);
            headHash = crypto.createHash('md5').update(buf.subarray(0, 4096)).digest('hex');
          } else {
            headHash = `${file.size}_${file.name}`;
          }
        } catch (_) {
          continue;
        }
        const subGroup = headHashMap.get(headHash) || [];
        subGroup.push(file);
        headHashMap.set(headHash, subGroup);
      }
    }
    const candidatesLevel2 = Array.from(headHashMap.values()).filter((g) => g.length > 1);
    if (candidatesLevel2.length === 0) return [];

    // Level 3: 终审全量哈希
    const duplicateGroups = [];
    let level3Processed = 0;
    const level3Total = candidatesLevel2.length;
    for (const group of candidatesLevel2) {
      level3Processed++;
      if (onProgress) {
        onProgress({
          task: 'duplicate-scan',
          current: level3Processed,
          total: level3Total,
          percent: Math.round(55 + (level3Processed / level3Total) * 45),
        });
      }
      const fullHashMap = new Map();
      for (const file of group) {
        let fullHash;
        try {
          if (file.path && fs.existsSync(file.path)) {
            fullHash = await UtilityService.readFileHash({ filePath: file.path });
          } else if (file.buffer) {
            const buf = Buffer.isBuffer(file.buffer) ? file.buffer : Buffer.from(file.buffer);
            fullHash = crypto.createHash('md5').update(buf).digest('hex');
          } else {
            fullHash = `${file.size}_${file.name}`;
          }
        } catch (_) {
          continue;
        }
        const subGroup = fullHashMap.get(fullHash) || [];
        subGroup.push(file);
        fullHashMap.set(fullHash, subGroup);
      }

      for (const [hash, dups] of Array.from(fullHashMap.entries())) {
        if (dups.length > 1) {
          dups.sort((a, b) => (b.mtime || 0) - (a.mtime || 0));
          duplicateGroups.push({
            id: `dup_${hash.slice(0, 10)}_${dups[0].size}`,
            hash,
            size: dups[0].size,
            files: dups.map((f, idx) => ({
              path: f.path || f.name,
              name: f.name,
              size: f.size,
              mtime: f.mtime || 0,
              isSuggestedDelete: idx > 0,
            })),
          });
        }
      }
    }

    return duplicateGroups;
  }

  /**
   * 智能文件整理计划生成
   */
  static generateOrganizePlan({ files, rule, baseFolderPath, options }) {
    const EXT_CATEGORY_MAP = {
      '.pdf': '文档 (Documents)', '.doc': '文档 (Documents)', '.docx': '文档 (Documents)',
      '.xls': '文档 (Documents)', '.xlsx': '文档 (Documents)', '.ppt': '文档 (Documents)',
      '.pptx': '文档 (Documents)', '.txt': '文档 (Documents)', '.md': '文档 (Documents)',
      '.csv': '文档 (Documents)',
      '.jpg': '图片 (Images)', '.jpeg': '图片 (Images)', '.png': '图片 (Images)',
      '.webp': '图片 (Images)', '.gif': '图片 (Images)', '.svg': '图片 (Images)',
      '.bmp': '图片 (Images)', '.heic': '图片 (Images)', '.raw': '图片 (Images)',
      '.mp4': '视频 (Videos)', '.mov': '视频 (Videos)', '.mkv': '视频 (Videos)',
      '.avi': '视频 (Videos)', '.webm': '视频 (Videos)', '.flv': '视频 (Videos)',
      '.mp3': '音频 (Audios)', '.wav': '音频 (Audios)', '.flac': '音频 (Audios)',
      '.aac': '音频 (Audios)', '.m4a': '音频 (Audios)', '.ogg': '音频 (Audios)',
      '.zip': '压缩包 (Archives)', '.rar': '压缩包 (Archives)', '.7z': '压缩包 (Archives)',
      '.tar': '压缩包 (Archives)', '.gz': '压缩包 (Archives)',
      '.exe': '安装包 (Installers)', '.msi': '安装包 (Installers)',
      '.pkg': '安装包 (Installers)', '.dmg': '安装包 (Installers)',
      '.js': '代码 (Code)', '.ts': '代码 (Code)', '.tsx': '代码 (Code)',
      '.jsx': '代码 (Code)', '.py': '代码 (Code)', '.json': '代码 (Code)',
      '.html': '代码 (Code)', '.css': '代码 (Code)',
    };
    const IGNORED = new Set(['desktop.ini', 'thumbs.db', '.ds_store', 'icon\r']);

    const plan = [];
    for (const file of files) {
      const lowerName = file.name.toLowerCase();
      const lowerExt = (file.ext || path.extname(file.name)).toLowerCase();

      if (IGNORED.has(lowerName) || lowerName.startsWith('~$') || lowerExt === '.lnk' || lowerExt === '.url') {
        continue;
      }

      let category = '其他文件 (Others)';
      let targetSubDir = '其他文件';

      if (rule === 'by-type') {
        category = EXT_CATEGORY_MAP[lowerExt] || '其他文件 (Others)';
        targetSubDir = category.split(' ')[0];
      } else if (rule === 'by-date') {
        const d = new Date(file.mtime || Date.now());
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        category = `${y}年${m}月`;
        targetSubDir = `${y}-${m}`;
      }

      const targetRelativePath = `${targetSubDir}/${file.name}`;
      const targetFullPath = baseFolderPath ? path.join(baseFolderPath, targetSubDir, file.name) : undefined;

      plan.push({
        id: `plan_${file.name}_${file.size}_${file.mtime}`,
        sourcePath: file.path || file.name,
        fileName: file.name,
        size: file.size,
        category,
        targetSubDir,
        targetRelativePath,
        targetFullPath,
      });
    }

    return plan;
  }

  /**
   * 打包归档为 ZIP 压缩包 (后端流式处理)
   */
  static async exportOrganizedZip({ plan, baseFolderPath }) {
    const { ZipArchive } = require('archiver');
    return new Promise((resolve, reject) => {
      try {
        const archive = new ZipArchive({ zlib: { level: 9 } });
        const chunks = [];
        archive.on('data', (c) => chunks.push(c));
        archive.on('end', () => resolve({ buffer: Buffer.concat(chunks), filename: 'organized_files.zip' }));
        archive.on('error', (err) => reject(err));

        for (const item of plan) {
          const srcPath = item.sourcePath;
          if (srcPath && fs.existsSync(srcPath)) {
            archive.file(srcPath, { name: item.targetRelativePath });
          } else if (item.buffer) {
            archive.append(Buffer.isBuffer(item.buffer) ? item.buffer : Buffer.from(item.buffer), { name: item.targetRelativePath });
          }
        }
        archive.finalize();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * 文本对比分析
   */
  static computeTextDiff({ text1, text2 }) {
    const diff = require('diff');
    return diff.diffLines(text1 || '', text2 || '');
  }

  /**
   * 二维码生成
   */
  static async generateQrCode({ text, options = {} }) {
    const QRCode = require('qrcode');
    const qrBuffer = await QRCode.toBuffer(String(text || ''), {
      errorCorrectionLevel: options.errorCorrectionLevel || 'M',
      margin: options.margin !== undefined ? Number(options.margin) : 2,
      width: Number(options.width) || 300,
      color: {
        dark: options.darkColor || '#000000',
        light: options.lightColor || '#FFFFFF',
      },
    });
    return { buffer: qrBuffer, filename: 'qrcode.png' };
  }

  /**
   * 二维码识别与解码
   */
  static async decodeQrCode({ imageBuffer }) {
    const sharp = require('sharp');
    const jsQR = require('jsqr');
    const buffer = Buffer.isBuffer(imageBuffer) ? imageBuffer : Buffer.from(imageBuffer);
    const { data, info } = await sharp(buffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const code = jsQR(new Uint8ClampedArray(data), info.width, info.height);
    if (!code) {
      throw new Error('未在图片中检测到有效的二维码');
    }
    return { data: code.data };
  }

  /**
   * 极速哈希计算
   */
  static calculateHash({ text, algorithm = 'md5' }) {
    return crypto.createHash(algorithm).update(String(text || ''), 'utf8').digest('hex');
  }

  /**
   * 人民币大写金额转换
   */
  static convertNumberToChineseRMB({ money }) {
    const num = Number(money);
    if (isNaN(num)) return { uppercase: '零元整', valid: false };
    const fraction = ['角', '分'];
    const digit = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
    const unit = [
      ['元', '万', '亿'],
      ['', '拾', '佰', '仟'],
    ];
    const head = num < 0 ? '欠' : '';
    let n = Math.abs(num);
    let s = '';
    for (let i = 0; i < fraction.length; i++) {
      s += (digit[Math.floor(n * 10 * Math.pow(10, i)) % 10] + fraction[i]).replace(/零./, '');
    }
    s = s || '整';
    n = Math.floor(n);
    for (let i = 0; i < unit[0].length && n > 0; i++) {
      let p = '';
      for (let j = 0; j < unit[1].length && n > 0; j++) {
        p = digit[n % 10] + unit[1][j] + p;
        n = Math.floor(n / 10);
      }
      s = p.replace(/(零.)*零$/, '').replace(/^$/, '零') + unit[0][i] + s;
    }
    const result = head + s.replace(/(零.)*零元/, '元').replace(/(零.)+/g, '零').replace(/^整$/, '零元整');
    return { uppercase: result, valid: true };
  }

  /**
   * 中华人民共和国二代身份证号校验与信息解析
   */
  static validateAndParseChineseId({ idCard }) {
    const id = String(idCard || '').trim().toUpperCase();
    if (!/^\d{17}[\dX]$/.test(id)) {
      return { valid: false, error: '身份证号码必须为 18 位数字（末位可为 X）' };
    }
    const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
    const checkCodes = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];
    let sum = 0;
    for (let i = 0; i < 17; i++) {
      sum += parseInt(id[i], 10) * weights[i];
    }
    const expected = checkCodes[sum % 11];
    if (id[17] !== expected) {
      return { valid: false, error: `校验码错误 (末位应为 ${expected})` };
    }
    const birthYear = id.slice(6, 10);
    const birthMonth = id.slice(10, 12);
    const birthDay = id.slice(12, 14);
    const gender = parseInt(id[16], 10) % 2 === 1 ? '男' : '女';
    return {
      valid: true,
      birthday: `${birthYear}-${birthMonth}-${birthDay}`,
      gender,
      provinceCode: id.slice(0, 2),
    };
  }
}

module.exports = UtilityService;
