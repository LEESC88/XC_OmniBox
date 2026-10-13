/**
 * XC_OmniBox - 文件智能整理与排重服务调度层
 * 严格遵循前后端职责隔离守则 (Rule 6)：
 * 排重三级哈希计算与 ZIP 归档由后端 Node.js (Crypto / Archiver) 强力驱动
 */

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

export interface OrganizePlanOptions {
  onlyTopLevel?: boolean;
}

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

const IGNORED_SYSTEM_FILES = new Set([
  "desktop.ini",
  "thumbs.db",
  ".ds_store",
  "icon\r",
]);

function isInsideSubdirectory(file: FileItemMeta): boolean {
  if (!file.relPath) return false;
  const normalized = file.relPath.replace(/\\/g, "/");
  const segments = normalized.split("/").filter(Boolean);
  if (file.fileObj && file.relPath.includes("/")) {
    return segments.length > 2;
  }
  return segments.length > 1;
}

async function invokeNative<T = any>(channel: string, payload: any): Promise<T> {
  if (typeof window !== "undefined" && (window as any).electronAPI?.invoke) {
    try {
      const res = await (window as any).electronAPI.invoke(channel, payload);
      if (res && res.error) {
        throw new Error(res.error);
      }
      return res as T;
    } catch (err: any) {
      console.error(`[IPC Error] Channel ${channel} failed:`, err);
      throw err;
    }
  }
  throw new Error("桌面端原生服务未就绪 (仅支持在桌面客户端中运行)");
}

/**
 * 依据规则生成智能归档计划 (UI 预测与视图渲染)
 */
export function generateOrganizePlan(
  files: FileItemMeta[],
  rule: OrganizeRuleType,
  baseFolderPath?: string,
  options?: OrganizePlanOptions
): OrganizePlanItem[] {
  const plan: OrganizePlanItem[] = [];

  for (const file of files) {
    const lowerName = file.name.toLowerCase();
    const lowerExt = file.ext.toLowerCase();

    if (
      IGNORED_SYSTEM_FILES.has(lowerName) ||
      lowerName.startsWith("~$") ||
      lowerExt === ".lnk" ||
      lowerExt === ".url"
    ) {
      continue;
    }

    if (options?.onlyTopLevel && isInsideSubdirectory(file)) {
      continue;
    }

    let category = "其他文件 (Others)";
    let targetSubDir = "其他文件";

    if (rule === "by-type") {
      category = EXT_CATEGORY_MAP[lowerExt] || "其他文件 (Others)";
      targetSubDir = category.split(" ")[0];
    } else if (rule === "by-date") {
      const d = new Date(file.mtime);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      category = `${y}年${m}月`;
      targetSubDir = `${y}-${m}`;
    }

    const targetRelativePath = `${targetSubDir}/${file.name}`;
    let targetFullPath: string | undefined = undefined;
    if (baseFolderPath) {
      const sep = baseFolderPath.includes("/") ? "/" : "\\";
      targetFullPath = `${baseFolderPath}${sep}${targetSubDir}${sep}${file.name}`;
    }

    plan.push({
      id: `plan_${file.name}_${file.size}_${file.mtime}`,
      sourcePath: file.path,
      fileName: file.name,
      size: file.size,
      category,
      targetSubDir,
      targetRelativePath,
      targetFullPath,
      fileObj: file.fileObj,
    });
  }

  return plan;
}

/**
 * 三级阶梯极速查重引擎 (调用后端 Node.js 极速文件流哈希)
 */
export async function findDuplicatesFast(
  files: FileItemMeta[],
  onProgress?: (progress: { stage: string; current: number; total: number }) => void
): Promise<DuplicateGroup[]> {
  onProgress?.({ stage: "极速哈希比对分析中...", current: 0, total: files.length });

  // 将带有物理路径或 fileObj 的条目精简整理后送达后端 Node.js
  const payloadFiles = await Promise.all(
    files.map(async (f) => ({
      path: f.path,
      name: f.name,
      size: f.size,
      mtime: f.mtime,
      buffer: f.fileObj && !f.path ? await f.fileObj.arrayBuffer() : undefined,
    }))
  );

  const groups = await invokeNative<DuplicateGroup[]>("files:find-duplicates", {
    files: payloadFiles,
  });

  onProgress?.({ stage: "分析完成", current: files.length, total: files.length });
  return groups || [];
}

/**
 * 打包归档为 ZIP 压缩包 (后端 Node.js Archiver 流式压缩，零前端内存泄露)
 */
export async function exportOrganizedZip(
  plan: OrganizePlanItem[],
  onProgress?: (percent: number) => void
): Promise<Blob> {
  onProgress?.(20);

  const payloadPlan = await Promise.all(
    plan.map(async (item) => ({
      sourcePath: item.sourcePath,
      targetRelativePath: item.targetRelativePath,
      buffer: item.fileObj && !item.sourcePath ? await item.fileObj.arrayBuffer() : undefined,
    }))
  );

  onProgress?.(50);

  const res = await invokeNative<{ buffer: ArrayBuffer; filename: string }>(
    "files:export-organized-zip",
    { plan: payloadPlan }
  );

  onProgress?.(100);
  return new Blob([res.buffer as any], { type: "application/zip" });
}
