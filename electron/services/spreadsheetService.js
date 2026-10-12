const XLSX = require('xlsx');
const { ZipArchive } = require('archiver');

class SpreadsheetService {
  /**
   * 探测分析表格结构 (Sheet 清单、列头、前数行预览)
   */
  static async probeSpreadsheet({ fileBuffer, fileName = 'table.xlsx', headerRowIndex = 0, targetSheetName }) {
    const buffer = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer);
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true, dense: true });

    const sheetNames = workbook.SheetNames;
    if (!sheetNames || sheetNames.length === 0) {
      throw new Error('表格中未包含有效的 Sheet 工作表');
    }

    const activeSheet = targetSheetName && sheetNames.includes(targetSheetName)
      ? targetSheetName
      : sheetNames[0];

    const worksheet = workbook.Sheets[activeSheet];
    const rows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: '',
      blankrows: false,
    });

    const totalRows = rows.length;
    const headerRow = (rows[headerRowIndex] || []).map((c) => String(c ?? '').trim());
    const totalCols = headerRow.length;

    const previewDataRows = rows.slice(headerRowIndex + 1, headerRowIndex + 6);
    const headerColumns = headerRow.map((colName, colIdx) => {
      const previews = previewDataRows
        .map((r) => String(r[colIdx] ?? '').trim())
        .filter(Boolean);
      return {
        index: colIdx,
        name: colName || `第 ${colIdx + 1} 列`,
        previewValues: previews.slice(0, 3),
      };
    });

    return {
      fileName,
      sheetNames,
      activeSheet,
      totalRows,
      totalCols,
      headerColumns,
      previewRows: rows.slice(0, 10),
    };
  }

  /**
   * 多表格智能合并与自动对齐
   */
  static async mergeSheets({
    files,
    mode = 'union',
    appendSourceCol = true,
    sourceColName = '来源文件',
    deduplicate = false,
    headerRowIndex = 0,
    targetSheetName,
  }) {
    if (!files || files.length === 0) {
      throw new Error('请至少提供一个待合并表格');
    }

    const fileProbes = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const p = await SpreadsheetService.probeSpreadsheet({
        fileBuffer: f.buffer,
        fileName: f.name,
        headerRowIndex,
        targetSheetName,
      });
      fileProbes.push(p);
    }

    let unifiedHeaders = [];
    if (mode === 'union') {
      const headerSet = new Set();
      for (const p of fileProbes) {
        p.headerColumns.forEach((c) => {
          if (c.name) headerSet.add(c.name);
        });
      }
      unifiedHeaders = Array.from(headerSet);
    } else {
      if (fileProbes.length > 0) {
        let intersection = fileProbes[0].headerColumns.map((c) => c.name).filter(Boolean);
        for (let i = 1; i < fileProbes.length; i++) {
          const currentHeaders = new Set(fileProbes[i].headerColumns.map((c) => c.name));
          intersection = intersection.filter((h) => currentHeaders.has(h));
        }
        unifiedHeaders = intersection;
      }
    }

    if (unifiedHeaders.length === 0) {
      throw new Error('未找到可合并的共有表头列，请检查对齐模式');
    }

    const mergedRows = [];
    const finalHeaderRow = appendSourceCol ? [...unifiedHeaders, sourceColName] : unifiedHeaders;
    mergedRows.push(finalHeaderRow);

    const seenRowSignatures = new Set();
    let totalMergedRowsCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const buffer = Buffer.isBuffer(file.buffer) ? file.buffer : Buffer.from(file.buffer);
      const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true, dense: true });
      const sheetName = targetSheetName && wb.SheetNames.includes(targetSheetName)
        ? targetSheetName
        : wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false });

      const fileHeader = (rawRows[headerRowIndex] || []).map((c) => String(c ?? '').trim());
      const colMap = {};
      unifiedHeaders.forEach((uh) => {
        colMap[uh] = fileHeader.indexOf(uh);
      });

      const dataRows = rawRows.slice(headerRowIndex + 1);
      for (const row of dataRows) {
        const isAllBlank = row.every((c) => c === '' || c === null || c === undefined);
        if (isAllBlank) continue;

        const alignedRow = unifiedHeaders.map((uh) => {
          const idx = colMap[uh];
          return idx !== -1 && idx < row.length ? row[idx] : '';
        });

        if (deduplicate) {
          const sig = JSON.stringify(alignedRow);
          if (seenRowSignatures.has(sig)) continue;
          seenRowSignatures.add(sig);
        }

        if (appendSourceCol) {
          alignedRow.push(file.name);
        }

        mergedRows.push(alignedRow);
        totalMergedRowsCount++;
      }
    }

    const outputWb = XLSX.utils.book_new();
    const outputWs = XLSX.utils.aoa_to_sheet(mergedRows);
    XLSX.utils.book_append_sheet(outputWb, outputWs, '合并汇总');

    const outBuffer = XLSX.write(outputWb, { bookType: 'xlsx', type: 'buffer' });
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const outFilename = `合并汇总_${files.length}个文件_${timestamp}.xlsx`;

    return {
      buffer: outBuffer,
      filename: outFilename,
      totalRowsMerged: totalMergedRowsCount,
      filesCount: files.length,
    };
  }

  /**
   * 表格按列值智能拆分 (单表或 ZIP 打包)
   */
  static async splitSheet({
    fileBuffer,
    fileName = 'table.xlsx',
    splitColIndex = 0,
    headerRowIndex = 0,
    targetSheetName,
    includeHeader = true,
    prefixWithOriginalName = true,
  }) {
    const buffer = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer);
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true, dense: true });
    const sheetName = targetSheetName && wb.SheetNames.includes(targetSheetName)
      ? targetSheetName
      : wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false });

    if (rawRows.length <= headerRowIndex) {
      throw new Error('表格数据行数不足，无法拆分');
    }

    const headerRow = rawRows[headerRowIndex] || [];
    const dataRows = rawRows.slice(headerRowIndex + 1);

    const groups = {};
    for (const r of dataRows) {
      const isBlank = r.every((c) => c === '' || c === null || c === undefined);
      if (isBlank) continue;
      const rawVal = r[splitColIndex];
      const key = (rawVal === undefined || rawVal === null || String(rawVal).trim() === '')
        ? '未分类'
        : String(rawVal).trim().replace(/[\\/:*?"<>|]/g, '_');

      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    }

    const groupKeys = Object.keys(groups);
    if (groupKeys.length === 0) {
      throw new Error('未在指定拆分列中找到有效分类值');
    }

    const baseFileName = fileName.replace(/\.[^/.]+$/, '');

    // 单个分组直接导出 .xlsx
    if (groupKeys.length === 1) {
      const key = groupKeys[0];
      const newWb = XLSX.utils.book_new();
      const sheetData = includeHeader ? [headerRow, ...groups[key]] : groups[key];
      const newWs = XLSX.utils.aoa_to_sheet(sheetData);
      XLSX.utils.book_append_sheet(newWb, newWs, key.slice(0, 30));
      const outBuffer = XLSX.write(newWb, { bookType: 'xlsx', type: 'buffer' });
      const outName = prefixWithOriginalName ? `${baseFileName}_${key}.xlsx` : `${key}.xlsx`;
      return {
        buffer: outBuffer,
        filename: outName,
        groupsCount: 1,
        groupNames: groupKeys,
      };
    }

    // 多个分组打包为 ZIP
    return new Promise(async (resolve, reject) => {
      try {
        const archive = new ZipArchive({ zlib: { level: 9 } });
        const chunks = [];

        archive.on('data', (c) => chunks.push(c));
        archive.on('end', () => {
          resolve({
            buffer: Buffer.concat(chunks),
            filename: `${baseFileName}_按列拆分_${groupKeys.length}个文件.zip`,
            groupsCount: groupKeys.length,
            groupNames: groupKeys,
          });
        });
        archive.on('error', (err) => reject(err));

        for (const key of groupKeys) {
          const newWb = XLSX.utils.book_new();
          const sheetData = includeHeader ? [headerRow, ...groups[key]] : groups[key];
          const newWs = XLSX.utils.aoa_to_sheet(sheetData);
          XLSX.utils.book_append_sheet(newWb, newWs, key.slice(0, 30));
          const fileBuf = XLSX.write(newWb, { bookType: 'xlsx', type: 'buffer' });
          const singleName = prefixWithOriginalName ? `${baseFileName}_${key}.xlsx` : `${key}.xlsx`;
          archive.append(fileBuf, { name: singleName });
        }

        await archive.finalize();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * 探测指定列的分组分布预览
   */
  static async probeSplitGroups({ fileBuffer, splitColIndex = 0, headerRowIndex = 0, targetSheetName }) {
    const buffer = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer);
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true, dense: true });
    const sheetName = targetSheetName && wb.SheetNames.includes(targetSheetName)
      ? targetSheetName
      : wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false });

    const dataRows = rawRows.slice(headerRowIndex + 1);
    const countMap = {};

    for (const r of dataRows) {
      const isBlank = r.every((c) => c === '' || c === null || c === undefined);
      if (isBlank) continue;
      const rawVal = r[splitColIndex];
      const key = (rawVal === undefined || rawVal === null || String(rawVal).trim() === '')
        ? '未分类'
        : String(rawVal).trim();
      countMap[key] = (countMap[key] || 0) + 1;
    }

    const groups = Object.entries(countMap).map(([key, count]) => ({ key, count }));
    groups.sort((a, b) => b.count - a.count);

    return {
      groups,
      totalGroups: groups.length,
      activeSheet: sheetName,
    };
  }
}

module.exports = SpreadsheetService;
