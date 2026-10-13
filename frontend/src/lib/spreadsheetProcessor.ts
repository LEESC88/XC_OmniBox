/**
 * XC_OmniBox - 表格处理服务调度层
 * 严格遵循前后端分离守则：前端仅负责入参收集与结果接收，底层 XLSX 计算 100% 运行于后端 Node.js 进程内
 */

export interface SheetProbeResult {
  fileName: string;
  sheetNames: string[];
  activeSheet: string;
  headers: string[];
  totalRows: number;
  previewRows: any[][];
}

export interface MergeConfig {
  mode: "union" | "intersection"; // union: 取列名并集(缺漏留空); intersection: 仅保留共有列
  appendSourceCol: boolean;       // 是否追加[来源文件]标识列
  sourceColName: string;          // 来源列名称
  deduplicate: boolean;           // 是否整行去重
  headerRowIndex: number;         // 表头所在行序号 (0-indexed, 默认 0)
  targetSheetName?: string;       // 指定合并哪个工作表 (若无则默认第一张)
}

export interface MergeResult {
  blob: Blob;
  filename: string;
  totalMergedRows: number;
  columnCount: number;
  headers: string[];
}

export interface SplitConfig {
  splitColumnIndex: number;       // 按照第几列拆分 (0-indexed)
  headerRowIndex: number;         // 表头所在行序号 (默认 0)
  includeHeader: boolean;         // 拆分出来的子表格是否保留表头 (默认 true)
  prefixWithOriginalName: boolean;// 文件名是否带原文件名 (例如 "原名_销售一部.xlsx")
  targetSheetName?: string;       // 指定拆分哪个工作表
}

export interface SplitResultItem {
  key: string;
  filename: string;
  rowCount: number;
  blob: Blob;
}

export interface SplitResult {
  items: SplitResultItem[];
  zipBlob: Blob;
  zipFilename: string;
}

export interface SplitProbeGroupResult {
  totalRows: number;
  distinctCount: number;
  sampleKeys: { key: string; count: number }[];
  isHighCardinality: boolean; // > 100 个分组提示高危 OOM 风险
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

function toBlob(buffer: any, type: string = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"): Blob {
  return new Blob([buffer as any], { type });
}

/**
 * 极速探测 Excel/CSV 文件的表头与基础结构（后端 Node.js 高速处理）
 */
export async function probeSpreadsheet(
  file: File,
  headerRowIndex: number = 0,
  targetSheetName?: string
): Promise<SheetProbeResult> {
  const fileBuffer = await file.arrayBuffer();
  const res = await invokeNative<any>("spreadsheet:probe", {
    fileBuffer,
    fileName: file.name,
    headerRowIndex,
    targetSheetName,
  });

  return {
    fileName: file.name,
    sheetNames: res.sheetNames || [],
    activeSheet: res.activeSheet || "",
    headers: res.headers || (res.headerColumns || []).map((c: any) => c.name),
    totalRows: res.totalRows || 0,
    previewRows: res.previewRows || [],
  };
}

/**
 * 多表格智能合并（后端 Node.js 高速处理，彻底避免前端内存溢出）
 */
export async function mergeSpreadsheets(
  files: File[],
  config: MergeConfig,
  onProgress?: (progress: { current: number; total: number; currentFile: string }) => void
): Promise<MergeResult> {
  if (onProgress && files.length > 0) {
    onProgress({ current: 1, total: files.length, currentFile: files[0].name });
  }

  const fileItems = await Promise.all(
    files.map(async (f) => ({
      buffer: await f.arrayBuffer(),
      name: f.name,
    }))
  );

  const res = await invokeNative<any>("spreadsheet:merge", {
    files: fileItems,
    mode: config.mode,
    appendSourceCol: config.appendSourceCol,
    sourceColName: config.sourceColName,
    deduplicate: config.deduplicate,
    headerRowIndex: config.headerRowIndex,
    targetSheetName: config.targetSheetName,
  });

  if (onProgress) {
    onProgress({ current: files.length, total: files.length, currentFile: files[files.length - 1]?.name || "" });
  }

  const blob = toBlob(res.buffer);
  return {
    blob,
    filename: res.filename,
    totalMergedRows: res.totalMergedRows || res.totalRowsMerged || 0,
    columnCount: res.columnCount || (res.headers ? res.headers.length : 0),
    headers: res.headers || [],
  };
}

/**
 * 单 Excel 大表按指定列字段快速拆分（后端 Node.js 流式拆分）
 */
export async function splitSpreadsheet(
  file: File,
  config: SplitConfig,
  onProgress?: (progress: { current: number; total: number; currentKey: string }) => void
): Promise<SplitResult> {
  if (onProgress) {
    onProgress({ current: 1, total: 1, currentKey: "初始化拆分" });
  }

  const fileBuffer = await file.arrayBuffer();
  const res = await invokeNative<any>("spreadsheet:split", {
    fileBuffer,
    fileName: file.name,
    splitColIndex: config.splitColumnIndex,
    headerRowIndex: config.headerRowIndex,
    targetSheetName: config.targetSheetName,
    includeHeader: config.includeHeader,
    prefixWithOriginalName: config.prefixWithOriginalName,
  });

  const items: SplitResultItem[] = (res.items || []).map((it: any) => ({
    key: it.key,
    filename: it.filename,
    rowCount: it.rowCount,
    blob: toBlob(it.buffer),
  }));

  if (onProgress && items.length > 0) {
    onProgress({ current: items.length, total: items.length, currentKey: items[items.length - 1]?.key || "" });
  }

  const isZip = res.zipFilename ? res.zipFilename.endsWith(".zip") : res.filename.endsWith(".zip");
  const zipBlob = toBlob(
    res.zipBuffer || res.buffer,
    isZip ? "application/zip" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );

  return {
    items,
    zipBlob,
    zipFilename: res.zipFilename || res.filename,
  };
}

/**
 * 拆分前探测指定列的分组数量与基数预警（后端极速采样）
 */
export async function probeSplitGroups(
  file: File,
  splitColIndex: number,
  headerRowIndex: number = 0,
  targetSheetName?: string
): Promise<SplitProbeGroupResult> {
  const fileBuffer = await file.arrayBuffer();
  const res = await invokeNative<any>("spreadsheet:probe-split", {
    fileBuffer,
    splitColIndex,
    headerRowIndex,
    targetSheetName,
  });

  return {
    totalRows: res.totalRows || 0,
    distinctCount: res.distinctCount || 0,
    sampleKeys: res.sampleKeys || (res.groups || []).slice(0, 10),
    isHighCardinality: Boolean(res.isHighCardinality),
  };
}
