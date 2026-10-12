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
}

module.exports = UtilityService;
