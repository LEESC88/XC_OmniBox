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
      headers: headerRow,
      totalRows,
      totalCols,
      headerColumns,
      previewRows: rows.slice(0, 10),
    };
  }

  /**
   * 多表格智能合并与自动对齐 (单次解析优化 + 实时进度流)
   */
  static async mergeSheets(
    {
      files,
      mode = 'union',
      appendSourceCol = true,
      sourceColName = '来源文件',
      deduplicate = false,
      headerRowIndex = 0,
      targetSheetName,
    },
    onProgress
  ) {
    if (!files || files.length === 0) {
      throw new Error('请至少提供一个待合并表格');
    }

    const total = files.length;
    const parsedTables = [];

    for (let i = 0; i < total; i++) {
      const f = files[i];
      if (onProgress) {
        onProgress({
          task: 'spreadsheet:merge',
          current: i + 1,
          total,
          percent: Math.round(((i + 0.5) / total) * 45),
          message: `正在读取并解析表格 (${i + 1}/${total}): ${f.name || ''}`,
        });
      }
      const buffer = Buffer.isBuffer(f.buffer) ? f.buffer : Buffer.from(f.buffer);
      const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true, dense: true });
      if (!wb.SheetNames || wb.SheetNames.length === 0) continue;
      const sheetName = targetSheetName && wb.SheetNames.includes(targetSheetName)
        ? targetSheetName
        : wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false });
      const fileHeader = (rawRows[headerRowIndex] || []).map((c) => String(c ?? '').trim());
      parsedTables.push({
        name: f.name || `table_${i + 1}.xlsx`,
        rawRows,
        fileHeader,
        validColumns: fileHeader.map((colName, colIdx) => ({
          index: colIdx,
          name: colName || `第 ${colIdx + 1} 列`,
        })),
      });
    }

    let unifiedHeaders = [];
    if (mode === 'union') {
      const headerSet = new Set();
      for (const p of parsedTables) {
        p.validColumns.forEach((c) => {
          if (c.name) headerSet.add(c.name);
        });
      }
      unifiedHeaders = Array.from(headerSet);
    } else {
      if (parsedTables.length > 0) {
        let intersection = parsedTables[0].validColumns.map((c) => c.name).filter(Boolean);
        for (let i = 1; i < parsedTables.length; i++) {
          const currentHeaders = new Set(parsedTables[i].validColumns.map((c) => c.name));
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

    for (let i = 0; i < parsedTables.length; i++) {
      const pt = parsedTables[i];
      if (onProgress) {
        onProgress({
          task: 'spreadsheet:merge',
          current: i + 1,
          total: parsedTables.length,
          percent: 45 + Math.round(((i + 1) / parsedTables.length) * 45),
          message: `正在对齐并归并数据行 (${i + 1}/${parsedTables.length}): ${pt.name}`,
        });
      }

      const colMap = {};
      unifiedHeaders.forEach((uh) => {
        colMap[uh] = pt.fileHeader.indexOf(uh);
      });

      const dataRows = pt.rawRows.slice(headerRowIndex + 1);
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
          alignedRow.push(pt.name);
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

    if (onProgress) {
      onProgress({
        task: 'spreadsheet:merge',
        current: total,
        total,
        percent: 100,
        message: `合并完成，共汇总 ${totalMergedRowsCount} 行数据！`,
      });
    }

    return {
      buffer: outBuffer,
      filename: outFilename,
      totalMergedRows: totalMergedRowsCount,
      totalRowsMerged: totalMergedRowsCount,
      columnCount: unifiedHeaders.length,
      headers: unifiedHeaders,
      filesCount: files.length,
    };
  }

  /**
   * 表格按列值智能拆分 (单表或 ZIP 打包，含非法工作表字符清洗与实时进度流)
   */
  static async splitSheet(
    {
      fileBuffer,
      fileName = 'table.xlsx',
      splitColIndex = 0,
      headerRowIndex = 0,
      targetSheetName,
      includeHeader = true,
      prefixWithOriginalName = true,
    },
    onProgress
  ) {
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
    const baseFileName = fileName.replace(/\.[^/.]+$/, '');

    const groups = {};
    for (const r of dataRows) {
      const isBlank = r.every((c) => c === '' || c === null || c === undefined);
      if (isBlank) continue;
      const rawVal = r[splitColIndex];
      // 过滤文件名及 Excel 工作表名禁止的特殊字符 (: \ / ? * [ ] " < > |)
      const key = (rawVal === undefined || rawVal === null || String(rawVal).trim() === '')
        ? '未分类'
        : String(rawVal).trim().replace(/[\\/:*?"<>|\[\]]/g, '_');

      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    }

    const groupKeys = Object.keys(groups);
    if (groupKeys.length === 0) {
      throw new Error('未在指定拆分列中找到有效分类值');
    }

    const items = [];
    for (let i = 0; i < groupKeys.length; i++) {
      const key = groupKeys[i];
      if (onProgress) {
        onProgress({
          task: 'spreadsheet:split',
          current: i + 1,
          total: groupKeys.length,
          percent: Math.round(((i + 1) / groupKeys.length) * 85),
          message: `正在生成分组子表 (${i + 1}/${groupKeys.length}): ${key}`,
        });
      }
      const newWb = XLSX.utils.book_new();
      const sheetData = includeHeader ? [headerRow, ...groups[key]] : groups[key];
      const newWs = XLSX.utils.aoa_to_sheet(sheetData);
      const safeSheetName = key.slice(0, 30) || 'Sheet1';
      XLSX.utils.book_append_sheet(newWb, newWs, safeSheetName);
      const fileBuf = XLSX.write(newWb, { bookType: 'xlsx', type: 'buffer' });
      const singleName = prefixWithOriginalName ? `${baseFileName}_${key}.xlsx` : `${key}.xlsx`;
      items.push({
        key,
        filename: singleName,
        rowCount: groups[key].length,
        buffer: fileBuf,
      });
    }

    if (groupKeys.length === 1) {
      if (onProgress) {
        onProgress({ task: 'spreadsheet:split', current: 1, total: 1, percent: 100, message: '拆分完成！' });
      }
      return {
        items,
        buffer: items[0].buffer,
        filename: items[0].filename,
        zipBuffer: items[0].buffer,
        zipFilename: items[0].filename,
        groupsCount: 1,
        groupNames: groupKeys,
      };
    }

    return new Promise(async (resolve, reject) => {
      try {
        const archive = new ZipArchive({ zlib: { level: 9 } });
        const chunks = [];

        archive.on('data', (c) => chunks.push(c));
        archive.on('end', () => {
          const zipBuffer = Buffer.concat(chunks);
          const zipFilename = `${baseFileName}_按列拆分_${groupKeys.length}个文件.zip`;
          if (onProgress) {
            onProgress({ task: 'spreadsheet:split', current: groupKeys.length, total: groupKeys.length, percent: 100, message: '拆分打包完成！' });
          }
          resolve({
            items,
            buffer: zipBuffer,
            filename: zipFilename,
            zipBuffer,
            zipFilename,
            groupsCount: groupKeys.length,
            groupNames: groupKeys,
          });
        });
        archive.on('error', (err) => reject(err));

        for (const item of items) {
          archive.append(item.buffer, { name: item.filename });
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
      totalRows: dataRows.length,
      distinctCount: groups.length,
      sampleKeys: groups.slice(0, 10),
      isHighCardinality: groups.length > 100,
      groups,
      totalGroups: groups.length,
      activeSheet: sheetName,
    };
  }
}

module.exports = SpreadsheetService;
