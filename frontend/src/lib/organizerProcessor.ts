import JSZip from "jszip";

export interface FileItemMeta {
  path: string;       // 物理路径 (Electron) 或 文件名 (浏览器)
  name: string;
  size: number;
  mtime: number;
  ext: string;
  fileObj?: File;     // 浏览器拖拽模式下的 File 句柄
  relPath?: string;
}

export type OrganizeRuleType = "by-type" | "by-date" | "clean-empty";

export interface OrganizePlanItem {
  id: string;
  sourcePath: string;
  fileName: string;
  size: number;
  category: string;
  targetSubDir: string;
  targetRelativePath: string;
  targetFullPath?: string;
  fileObj?: File;
}

export interface DuplicateFileItem {
  path: string;
  name: string;
  size: number;
  mtime: number;
  isSuggestedDelete: boolean;
  fileObj?: File;
}

export interface DuplicateGroup {
  id: string;
  hash: string;
  size: number;
  files: DuplicateFileItem[];
}

// 扩展名到类型大类的映射字典
const EXT_CATEGORY_MAP: Record<string, string> = {
  // 文档
  ".pdf": "文档 (Documents)",
  ".doc": "文档 (Documents)",
  ".docx": "文档 (Documents)",
  ".xls": "文档 (Documents)",
  ".xlsx": "文档 (Documents)",
  ".ppt": "文档 (Documents)",
  ".pptx": "文档 (Documents)",
  ".txt": "文档 (Documents)",
  ".md": "文档 (Documents)",
  ".csv": "文档 (Documents)",
  // 图片
  ".jpg": "图片 (Images)",
  ".jpeg": "图片 (Images)",
  ".png": "图片 (Images)",
  ".webp": "图片 (Images)",
  ".gif": "图片 (Images)",
  ".svg": "图片 (Images)",
  ".bmp": "图片 (Images)",
  ".heic": "图片 (Images)",
  ".raw": "图片 (Images)",
  // 视频
  ".mp4": "视频 (Videos)",
  ".mov": "视频 (Videos)",
  ".mkv": "视频 (Videos)",
  ".avi": "视频 (Videos)",
  ".webm": "视频 (Videos)",
  ".flv": "视频 (Videos)",
  // 音频
  ".mp3": "音频 (Audios)",
  ".wav": "音频 (Audios)",
  ".flac": "音频 (Audios)",
  ".aac": "音频 (Audios)",
  ".m4a": "音频 (Audios)",
  ".ogg": "音频 (Audios)",
  // 压缩包
  ".zip": "压缩包 (Archives)",
  ".rar": "压缩包 (Archives)",
  ".7z": "压缩包 (Archives)",
  ".tar": "压缩包 (Archives)",
  ".gz": "压缩包 (Archives)",
  // 安装程序
  ".exe": "安装包 (Installers)",
  ".msi": "安装包 (Installers)",
  ".pkg": "安装包 (Installers)",
  ".dmg": "安装包 (Installers)",
  // 代码工程
  ".js": "代码 (Code)",
  ".ts": "代码 (Code)",
  ".tsx": "代码 (Code)",
  ".jsx": "代码 (Code)",
  ".py": "代码 (Code)",
  ".json": "代码 (Code)",
  ".html": "代码 (Code)",
  ".css": "代码 (Code)",
};

/**
 * 根据规则生成智能归档计划 (Dry Run 试运行)
 */
export function generateOrganizePlan(
  files: FileItemMeta[],
  rule: OrganizeRuleType,
  baseFolderPath?: string
): OrganizePlanItem[] {
  const plan: OrganizePlanItem[] = [];

  for (const file of files) {
    if (rule === "clean-empty") {
      if (file.size === 0) {
        plan.push({
          id: `plan_${Math.random().toString(36).substring(2, 9)}`,
          sourcePath: file.path,
          fileName: file.name,
          size: file.size,
          category: "零字节无效文件 (0 KB)",
          targetSubDir: "_待清理空文件",
          targetRelativePath: `_待清理空文件/${file.name}`,
          targetFullPath: baseFolderPath ? `${baseFolderPath}/_待清理空文件/${file.name}` : undefined,
          fileObj: file.fileObj,
        });
      }
      continue;
    }

    let targetSubDir = "其他 (Others)";
    let category = "其他";

    if (rule === "by-type") {
      const ext = file.ext.toLowerCase();
      targetSubDir = EXT_CATEGORY_MAP[ext] || "其他文件 (Others)";
      category = targetSubDir.split(" ")[0];
    } else if (rule === "by-date") {
      const date = new Date(file.mtime || Date.now());
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      targetSubDir = `${year}年/${month}月`;
      category = `${year}-${month}`;
    }

    const relPath = `${targetSubDir}/${file.name}`;
    const fullPath = baseFolderPath ? `${baseFolderPath}/${relPath}` : undefined;

    plan.push({
      id: `plan_${Math.random().toString(36).substring(2, 9)}`,
      sourcePath: file.path,
      fileName: file.name,
      size: file.size,
      category,
      targetSubDir,
      targetRelativePath: relPath,
      targetFullPath: fullPath,
      fileObj: file.fileObj,
    });
  }

  return plan;
}

/**
 * 纯前端 Web Crypto 计算 ArrayBuffer 哈希
 */
async function computeBufferHash(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * 快速读取文件切片哈希 (支持 Electron IPC 与浏览器 File 切片双模)
 */
async function getFileHeadHash(item: FileItemMeta, headBytes: number = 4096): Promise<string> {
  // 如果在 Electron 环境且存在物理路径
  if ((window as any).electronAPI?.readFileHash && item.path) {
    try {
      const hash = await (window as any).electronAPI.readFileHash({
        filePath: item.path,
        partialBytes: headBytes,
      });
      return `${item.size}_${hash}`;
    } catch (_) {}
  }

  // 纯前端 File.slice 降级
  if (item.fileObj) {
    const slice = item.fileObj.slice(0, headBytes);
    const buf = await slice.arrayBuffer();
    const hash = await computeBufferHash(buf);
    return `${item.size}_${hash}`;
  }

  return `${item.size}_mock_${item.name}`;
}

/**
 * 终审全量哈希计算
 */
async function getFileFullHash(item: FileItemMeta): Promise<string> {
  if ((window as any).electronAPI?.readFileHash && item.path) {
    try {
      return await (window as any).electronAPI.readFileHash({ filePath: item.path });
    } catch (_) {}
  }

  if (item.fileObj) {
    const buf = await item.fileObj.arrayBuffer();
    return await computeBufferHash(buf);
  }

  return `${item.size}_${item.name}`;
}

/**
 * 三级阶梯极速查重引擎 (Level 1: Size -> Level 2: Head4K -> Level 3: FullHash)
 */
export async function findDuplicatesFast(
  files: FileItemMeta[],
  onProgress?: (progress: { stage: string; current: number; total: number }) => void
): Promise<DuplicateGroup[]> {
  // 过滤 0 字节文件
  const validFiles = files.filter((f) => f.size > 0);
  if (validFiles.length < 2) return [];

  // ================= Level 1: 大小字典聚类 (零文件 I/O，耗时 ~1ms) =================
  onProgress?.({ stage: "大小初筛分析", current: 0, total: validFiles.length });
  const sizeMap = new Map<number, FileItemMeta[]>();
  for (const f of validFiles) {
    const list = sizeMap.get(f.size) || [];
    list.push(f);
    sizeMap.set(f.size, list);
  }

  // 仅保留同大小文件数 >= 2 的候选者
  const candidatesLevel1 = Array.from(sizeMap.values()).filter((g) => g.length > 1);
  const totalL1Files = candidatesLevel1.reduce((sum, g) => sum + g.length, 0);

  if (candidatesLevel1.length === 0) return [];

  // ================= Level 2: 头部 4KB 局部指纹短路校验 =================
  onProgress?.({ stage: "头部局部哈希指纹检验", current: 0, total: totalL1Files });
  const headHashMap = new Map<string, FileItemMeta[]>();
  let scannedCount = 0;

  for (const group of candidatesLevel1) {
    for (const file of group) {
      scannedCount++;
      if (scannedCount % 5 === 0) {
        onProgress?.({ stage: "头部局部指纹检验", current: scannedCount, total: totalL1Files });
      }
      const headHash = await getFileHeadHash(file, 4096);
      const subGroup = headHashMap.get(headHash) || [];
      subGroup.push(file);
      headHashMap.set(headHash, subGroup);
    }
  }

  const candidatesLevel2 = Array.from(headHashMap.values()).filter((g) => g.length > 1);
  const totalL2Files = candidatesLevel2.reduce((sum, g) => sum + g.length, 0);

  if (candidatesLevel2.length === 0) return [];

  // ================= Level 3: 终审全量哈希确认 =================
  onProgress?.({ stage: "终审全量哈希核对", current: 0, total: totalL2Files });
  let finalScanned = 0;
  const duplicateGroups: DuplicateGroup[] = [];

  for (const group of candidatesLevel2) {
    const fullHashMap = new Map<string, FileItemMeta[]>();
    for (const file of group) {
      finalScanned++;
      onProgress?.({ stage: "终审全量哈希核对", current: finalScanned, total: totalL2Files });
      const fullHash = await getFileFullHash(file);
      const subGroup = fullHashMap.get(fullHash) || [];
      subGroup.push(file);
      fullHashMap.set(fullHash, subGroup);
    }

    for (const [hash, dups] of Array.from(fullHashMap.entries())) {
      if (dups.length > 1) {
        // 智能策略：按修改时间降序排序，最新的或者最早的一份保留，其余标记为建议删除
        dups.sort((a, b) => b.mtime - a.mtime);
        duplicateGroups.push({
          id: `dup_${hash.slice(0, 10)}_${dups[0].size}`,
          hash,
          size: dups[0].size,
          files: dups.map((f, idx) => ({
            path: f.path,
            name: f.name,
            size: f.size,
            mtime: f.mtime,
            fileObj: f.fileObj,
            isSuggestedDelete: idx > 0, // 保留第一份（最新修改），其余建议清理
          })),
        });
      }
    }
  }

  return duplicateGroups;
}

/**
 * 纯前端 Web 降级：将归类计划打包生成 ZIP
 */
export async function exportOrganizedZip(
  plan: OrganizePlanItem[],
  onProgress?: (percent: number) => void
): Promise<Blob> {
  const zip = new JSZip();

  for (const item of plan) {
    if (item.fileObj) {
      zip.file(item.targetRelativePath, item.fileObj);
    }
  }

  return await zip.generateAsync({ type: "blob" }, (metadata) => {
    onProgress?.(Math.round(metadata.percent));
  });
}
