import * as XLSX from "xlsx";
import JSZip from "jszip";

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

/**
 * 极速探测 Excel/CSV 文件的表头与基础结构（采样前 5 行预览）
 */
export async function probeSpreadsheet(file: File, headerRowIndex: number = 0): Promise<SheetProbeResult> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true, dense: true });
  
  const sheetNames = workbook.SheetNames || [];
  if (sheetNames.length === 0) {
    throw new Error(`文件 "${file.name}" 中未发现有效工作表 (Worksheet)`);
  }

  const activeSheetName = sheetNames[0];
  const worksheet = workbook.Sheets[activeSheetName];
  if (!worksheet) {
    throw new Error(`无法读取文件 "${file.name}" 的工作表 "${activeSheetName}"`);
  }

  // 读取为二维数组 (最大采样前 30 行以减少内存开销)
  const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: "",
    blankrows: false,
  });

  if (rows.length === 0) {
    return {
      fileName: file.name,
      sheetNames,
      activeSheet: activeSheetName,
      headers: [],
      totalRows: 0,
      previewRows: [],
    };
  }

  const safeHeaderIdx = Math.min(headerRowIndex, rows.length - 1);
  const rawHeaders = rows[safeHeaderIdx] || [];
  const headers = rawHeaders.map((h, i) => (h !== undefined && h !== null && String(h).trim() !== "" ? String(h).trim() : `第${i + 1}列`));

  // 截取前 5 行数据作为预览
  const dataRows = rows.slice(safeHeaderIdx + 1);
  const previewRows = dataRows.slice(0, 5);

  return {
    fileName: file.name,
    sheetNames,
    activeSheet: activeSheetName,
    headers,
    totalRows: dataRows.length,
    previewRows,
  };
}

/**
 * 多 Excel 文件智能纵向拼合 (Smart Union/Intersection Merge)
 */
export async function mergeSpreadsheets(
  files: File[],
  config: MergeConfig,
  onProgress?: (progress: { current: number; total: number; currentFile: string }) => void
): Promise<MergeResult> {
  if (files.length === 0) {
    throw new Error("请至少选择一个待合并的 Excel 文件");
  }

  // 1. 探针所有文件的表头
  const probes: SheetProbeResult[] = [];
  for (let i = 0; i < files.length; i++) {
    onProgress?.({ current: i + 1, total: files.length, currentFile: `正在扫描表头: ${files[i].name}` });
    const p = await probeSpreadsheet(files[i], config.headerRowIndex);
    probes.push(p);
  }

  // 2. 计算最终输出的列头列表 (Master Headers)
  let masterHeaders: string[] = [];
  if (config.mode === "intersection") {
    // 交集模式：所有文件共有的列
    masterHeaders = probes[0].headers.filter((h) => probes.every((p) => p.headers.includes(h)));
    if (masterHeaders.length === 0) {
      throw new Error("所选文件之间没有完全一致的公共列头，请切换为「并集对齐模式」进行容错合并");
    }
  } else {
    // 并集模式：按出现顺序拼接所有不重复的列
    const set = new Set<string>();
    for (const p of probes) {
      p.headers.forEach((h) => set.add(h));
    }
    masterHeaders = Array.from(set);
  }

  // 是否追加来源文件列
  const actualHeaders = [...masterHeaders];
  if (config.appendSourceCol) {
    const colName = config.sourceColName?.trim() || "来源文件名";
    actualHeaders.push(colName);
  }

  const seenRowHashes = new Set<string>();
  const mergedRows: any[][] = [actualHeaders];

  // 3. 逐个读取并映射数据行
  for (let fileIdx = 0; fileIdx < files.length; fileIdx++) {
    const file = files[fileIdx];
    onProgress?.({ current: fileIdx + 1, total: files.length, currentFile: `正在合并数据: ${file.name}` });

    const arrayBuffer = await file.arrayBuffer();
    const wb = XLSX.read(arrayBuffer, { type: "array", cellDates: true, dense: true });
    const firstSheetName = wb.SheetNames[0];
    const ws = wb.Sheets[firstSheetName];
    if (!ws) continue;

    const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: "",
      blankrows: false,
    });

    const fileHeaders = probes[fileIdx].headers;
    const dataRows = rawRows.slice(config.headerRowIndex + 1);

    for (const row of dataRows) {
      // 过滤完全空白的行
      const isBlank = row.every((c) => c === undefined || c === null || String(c).trim() === "");
      if (isBlank) continue;

      // 按照 masterHeaders 的位置对齐重排单元格
      const alignedRow: any[] = masterHeaders.map((targetCol) => {
        const colIdx = fileHeaders.indexOf(targetCol);
        if (colIdx >= 0 && colIdx < row.length) {
          return row[colIdx];
        }
        return ""; // 缺失列填补空字符串
      });

      // 追加来源文件名
      if (config.appendSourceCol) {
        alignedRow.push(file.name);
      }

      // 整行去重校验
      if (config.deduplicate) {
        const rowHash = JSON.stringify(alignedRow);
        if (seenRowHashes.has(rowHash)) {
          continue; // 跳过重复行
        }
        seenRowHashes.add(rowHash);
      }

      mergedRows.push(alignedRow);
    }
  }

  // 4. 构建输出工作簿
  const outputWb = XLSX.utils.book_new();
  const outputWs = XLSX.utils.aoa_to_sheet(mergedRows);

  // 自动设置列宽 (自适应最长字符)
  outputWs["!cols"] = actualHeaders.map((h, i) => {
    let maxLen = h.length;
    for (let r = 1; r < Math.min(mergedRows.length, 50); r++) {
      const cellVal = mergedRows[r][i];
      if (cellVal !== undefined && cellVal !== null) {
        maxLen = Math.max(maxLen, String(cellVal).length);
      }
    }
    return { wch: Math.min(Math.max(maxLen + 3, 10), 45) };
  });

  XLSX.utils.book_append_sheet(outputWb, outputWs, "合并汇总");

  const outBuffer = XLSX.write(outputWb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([outBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const timestamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const outFilename = `合并汇总_${files.length}个文件_${timestamp}.xlsx`;

  return {
    blob,
    filename: outFilename,
    totalMergedRows: mergedRows.length - 1,
    columnCount: actualHeaders.length,
    headers: actualHeaders,
  };
}

/**
 * 单 Excel 大表按指定列字段快速拆分 (Smart Column Splitter)
 */
export async function splitSpreadsheet(
  file: File,
  config: SplitConfig,
  onProgress?: (progress: { current: number; total: number; currentKey: string }) => void
): Promise<SplitResult> {
  const arrayBuffer = await file.arrayBuffer();
  const wb = XLSX.read(arrayBuffer, { type: "array", cellDates: true, dense: true });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  if (!ws) {
    throw new Error(`无法读取表格内容`);
  }

  const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: "",
    blankrows: false,
  });

  if (rawRows.length <= config.headerRowIndex + 1) {
    throw new Error("表格中没有足够的数据行供拆分");
  }

  const headers = rawRows[config.headerRowIndex] || [];
  const dataRows = rawRows.slice(config.headerRowIndex + 1);

  // 按照指定列进行分组
  const groups = new Map<string, any[][]>();

  for (const row of dataRows) {
    let keyValue = row[config.splitColumnIndex];
    let keyStr = keyValue !== undefined && keyValue !== null ? String(keyValue).trim() : "";
    if (keyStr === "") {
      keyStr = "未分类_空值";
    }
    // 过滤 Windows 文件名非法字符: \ / : * ? " < > |
    keyStr = keyStr.replace(/[\\/:*?"<>|]/g, "_");

    if (!groups.has(keyStr)) {
      groups.set(keyStr, []);
    }
    groups.get(keyStr)!.push(row);
  }

  const baseFileName = file.name.replace(/\.[^/.]+$/, "");
  const zip = new JSZip();
  const resultItems: SplitResultItem[] = [];
  const totalKeys = groups.size;

  let currentIdx = 0;
  for (const [key, rows] of Array.from(groups.entries())) {
    currentIdx++;
    onProgress?.({ current: currentIdx, total: totalKeys, currentKey: key });

    const newWb = XLSX.utils.book_new();
    const sheetData = config.includeHeader ? [headers, ...rows] : rows;
    const newWs = XLSX.utils.aoa_to_sheet(sheetData);

    XLSX.utils.book_append_sheet(newWb, newWs, key.slice(0, 31)); // 工作表名最长 31 字符

    const outBuffer = XLSX.write(newWb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([outBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const itemFilename = config.prefixWithOriginalName
      ? `${baseFileName}_${key}.xlsx`
      : `${key}.xlsx`;

    resultItems.push({
      key,
      filename: itemFilename,
      rowCount: rows.length,
      blob,
    });

    zip.file(itemFilename, outBuffer);
  }

  // 打包为 Zip
  const zipBlob = await zip.generateAsync({ type: "blob" });
  const zipFilename = `${baseFileName}_拆分导出_${resultItems.length}个文件.zip`;

  return {
    items: resultItems,
    zipBlob,
    zipFilename,
  };
}
