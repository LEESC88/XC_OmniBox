let _XLSX = null;
function getXlsx() {
  if (!_XLSX) {
    _XLSX = require('xlsx');
  }
  return _XLSX;
}
const XLSX = new Proxy({}, {
  get(_target, prop) {
    return getXlsx()[prop];
  },
});

let _ZipArchive = null;
function getZipArchive() {
  if (!_ZipArchive) {
    _ZipArchive = require('archiver').ZipArchive;
  }
  return _ZipArchive;
}

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
        const ZipArchive = getZipArchive();
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

  // ==================== CSV / 表格乱码一键拯救与智能转码 ====================

  /**
   * 智能检测文本字节流编码 (BOM优先 -> UTF-16嗅探 -> 7位ASCII -> 严格UTF-8 -> CJK特征分析 -> 语言兜底)
   */
  static detectEncoding(buffer) {
    if (!buffer || buffer.length === 0) {
      return { encoding: 'utf-8', confidence: 1.0, hasBom: false, bomLength: 0, label: 'UTF-8' };
    }

    // 1. 优先检测权威 BOM 标记
    if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
      return { encoding: 'utf-8', confidence: 1.0, hasBom: true, bomLength: 3, label: 'UTF-8 (带 BOM 标准)' };
    }
    if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE) {
      return { encoding: 'utf-16le', confidence: 1.0, hasBom: true, bomLength: 2, label: 'UTF-16LE (Unicode 标头)' };
    }
    if (buffer.length >= 2 && buffer[0] === 0xFE && buffer[1] === 0xFF) {
      return { encoding: 'utf-16be', confidence: 1.0, hasBom: true, bomLength: 2, label: 'UTF-16BE (Unicode 标头)' };
    }

    // 2. 检测无 BOM 的 UTF-16 文本 (SAP/财务系统 Unicode TXT 导出常见)
    const sampleLen = Math.min(buffer.length, 8192);
    if (sampleLen >= 32) {
      let nullCountEven = 0;
      let nullCountOdd = 0;
      for (let i = 0; i < sampleLen; i++) {
        if (buffer[i] === 0) {
          if (i % 2 === 0) nullCountEven++;
          else nullCountOdd++;
        }
      }
      if (nullCountOdd > sampleLen * 0.25 && nullCountEven === 0) {
        return { encoding: 'utf-16le', confidence: 0.95, hasBom: false, bomLength: 0, label: 'UTF-16LE (无 BOM)' };
      }
      if (nullCountEven > sampleLen * 0.25 && nullCountOdd === 0) {
        return { encoding: 'utf-16be', confidence: 0.95, hasBom: false, bomLength: 0, label: 'UTF-16BE (无 BOM)' };
      }
    }

    // 3. 检测纯 7 位 ASCII
    let isPureAscii = true;
    for (let i = 0; i < sampleLen; i++) {
      if (buffer[i] >= 0x80) {
        isPureAscii = false;
        break;
      }
    }
    if (isPureAscii) {
      return { encoding: 'utf-8', confidence: 0.99, hasBom: false, bomLength: 0, label: 'ASCII (纯英数兼容)' };
    }

    // 4. 尝试严谨模式的 UTF-8 (若包含非法多字节序列立即报错排除)
    try {
      const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
      utf8Decoder.decode(buffer.subarray(0, sampleLen));
      return {
        encoding: 'utf-8',
        confidence: 0.99,
        hasBom: false,
        bomLength: 0,
        label: 'UTF-8 (无 BOM - 原生 Excel 易乱码)',
      };
    } catch (_) {}

    // 5. UTF-8 校验失败，测试国内网银/ERP最主流的 GB18030 / GBK / GB2312
    try {
      const gbkDecoder = new TextDecoder('gb18030', { fatal: true });
      const text = gbkDecoder.decode(buffer.subarray(0, sampleLen));
      let cjkCount = 0;
      for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        if (code >= 0x4e00 && code <= 0x9fa5) cjkCount++;
      }
      if (cjkCount > 0) {
        return {
          encoding: 'gb18030',
          confidence: 0.98,
          hasBom: false,
          bomLength: 0,
          label: 'GBK / GB18030 (国内网银/ERP/税控标准)',
        };
      }
    } catch (_) {}

    // 6. 测试繁体中文 Big5
    try {
      const big5Decoder = new TextDecoder('big5', { fatal: true });
      const text = big5Decoder.decode(buffer.subarray(0, sampleLen));
      let cjkCount = 0;
      for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        if (code >= 0x4e00 && code <= 0x9fa5) cjkCount++;
      }
      if (cjkCount > 0) {
        return {
          encoding: 'big5',
          confidence: 0.95,
          hasBom: false,
          bomLength: 0,
          label: 'Big5 (港台繁体中文)',
        };
      }
    } catch (_) {}

    // 7. 测试日文 Shift_JIS
    try {
      const sjisDecoder = new TextDecoder('shift_jis', { fatal: true });
      sjisDecoder.decode(buffer.subarray(0, sampleLen));
      return {
        encoding: 'shift_jis',
        confidence: 0.90,
        hasBom: false,
        bomLength: 0,
        label: 'Shift_JIS (日文标准)',
      };
    } catch (_) {}

    // 8. 兜底为 Windows-1252 (西欧 ANSI)
    return {
      encoding: 'windows-1252',
      confidence: 0.70,
      hasBom: false,
      bomLength: 0,
      label: 'Windows-1252 (ANSI/西欧)',
    };
  }

  /**
   * 自动探测 CSV 字段分隔符 (, / \t / ; / |)
   */
  static detectDelimiter(sampleText) {
    if (!sampleText) return ',';
    const lines = sampleText.split(/\r?\n/).filter(l => l.trim().length > 0).slice(0, 20);
    if (lines.length === 0) return ',';

    const candidates = [',', '\t', ';', '|'];
    let bestDelimiter = ',';
    let bestScore = -1;

    for (const delim of candidates) {
      let counts = [];
      for (const line of lines) {
        let inside = false;
        let count = 0;
        for (let i = 0; i < line.length; i++) {
          if (line[i] === '"') inside = !inside;
          else if (!inside && line[i] === delim) count++;
        }
        counts.push(count);
      }

      if (counts.length === 0 || counts[0] === 0) continue;

      const first = counts[0];
      const isUniform = counts.every(c => c === first && c > 0);
      const avg = counts.reduce((a, b) => a + b, 0) / counts.length;

      let score = avg * (isUniform ? 10 : 1);
      if (delim === '\t' && isUniform) score *= 1.2;

      if (score > bestScore) {
        bestScore = score;
        bestDelimiter = delim;
      }
    }

    return bestDelimiter;
  }

  /**
   * RFC 4180 标准流式 CSV 行解析器 (严谨支持引号转义 ""、内嵌换行与自定义分隔符)
   */
  static parseCsvRows(text, delimiter = ',') {
    const rows = [];
    let currentRow = [];
    let currentCell = '';
    let insideQuotes = false;
    let i = 0;
    const len = text.length;

    while (i < len) {
      const ch = text[i];

      if (ch === '"') {
        if (insideQuotes && text[i + 1] === '"') {
          currentCell += '"';
          i += 2;
          continue;
        } else {
          insideQuotes = !insideQuotes;
          i++;
          continue;
        }
      }

      if (!insideQuotes) {
        if (ch === delimiter) {
          currentRow.push(currentCell);
          currentCell = '';
          i++;
          continue;
        }
        if (ch === '\r') {
          if (text[i + 1] === '\n') i++;
          currentRow.push(currentCell);
          rows.push(currentRow);
          currentRow = [];
          currentCell = '';
          i++;
          continue;
        }
        if (ch === '\n') {
          currentRow.push(currentCell);
          rows.push(currentRow);
          currentRow = [];
          currentCell = '';
          i++;
          continue;
        }
      }

      currentCell += ch;
      i++;
    }

    if (currentCell.length > 0 || currentRow.length > 0) {
      currentRow.push(currentCell);
      rows.push(currentRow);
    }

    // 剔除末尾多余空行
    if (rows.length > 0 && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') {
      rows.pop();
    }

    return rows;
  }

  /**
   * RFC 4180 标准 CSV 字符串格式化
   */
  static formatToCsv(rows, delimiter = ',') {
    return rows.map(row => {
      return row.map(cell => {
        const str = String(cell ?? '');
        if (str.includes(delimiter) || str.includes('"') || str.includes('\n') || str.includes('\r')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(delimiter);
    }).join('\r\n');
  }

  /**
   * 获取多编码候选快照与文本预览片段 (供前端用户实时比对切换)
   */
  static getCandidateEncodings(buffer) {
    const candidateList = [
      { id: 'gb18030', label: 'GBK / GB18030 (国内网银/财务/ERP标准)' },
      { id: 'utf-8', label: 'UTF-8 (通用国际标准)' },
      { id: 'big5', label: 'Big5 (港台繁体中文)' },
      { id: 'shift_jis', label: 'Shift_JIS (日文编码)' },
      { id: 'windows-1252', label: 'Windows-1252 (西欧 ANSI)' },
    ];

    const sample = buffer.subarray(0, 1024);
    return candidateList.map(item => {
      let previewSnippet = '';
      try {
        const dec = new TextDecoder(item.id);
        previewSnippet = dec.decode(sample).substring(0, 60).replace(/\r?\n/g, ' ');
      } catch (_) {
        previewSnippet = '（无法以此编码解码）';
      }
      return {
        id: item.id,
        label: item.label,
        snippet: previewSnippet,
      };
    });
  }

  /**
   * 探测分析表格编码与结构 (CSV/TSV/TXT 智能字符集识别与分隔符嗅探)
   */
  static async probeTableEncoding({ fileBuffer, fileName = 'table.csv', overrideEncoding, overrideDelimiter }) {
    if (!fileBuffer || (Buffer.isBuffer(fileBuffer) && fileBuffer.length === 0)) {
      throw new Error('未接收到有效的表格数据');
    }
    const buffer = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer);
    const fileSize = buffer.length;

    // 1. 自动探测字符编码
    const detected = SpreadsheetService.detectEncoding(buffer);
    const activeEncoding = overrideEncoding || detected.encoding;

    // 2. 解码文本 (使用指定的编码或探测到的编码)
    let fullText = '';
    try {
      const decoder = new TextDecoder(activeEncoding);
      const sliceBuffer = detected.hasBom && !overrideEncoding ? buffer.subarray(detected.bomLength) : buffer;
      fullText = decoder.decode(sliceBuffer);
    } catch (_) {
      fullText = new TextDecoder('utf-8').decode(buffer);
    }

    // 3. 自动探测分隔符
    const detectedDelimiter = SpreadsheetService.detectDelimiter(fullText);
    const activeDelimiter = overrideDelimiter || detectedDelimiter;

    // 4. RFC 4180 流式解析表格行
    const rows = SpreadsheetService.parseCsvRows(fullText, activeDelimiter);
    const totalRows = rows.length;
    const headers = totalRows > 0 ? rows[0] : [];
    const totalCols = headers.length;

    // 5. 候选编码方案生成及预览片段
    const candidateEncodings = SpreadsheetService.getCandidateEncodings(buffer);

    return {
      fileName,
      fileSize,
      detectedEncoding: detected,
      activeEncoding,
      detectedDelimiter,
      activeDelimiter,
      totalRows,
      totalCols,
      headers,
      previewRows: rows.slice(1, 21),
      candidateEncodings,
      hasGibberishRisk: detected.encoding === 'gb18030' || (detected.encoding === 'utf-8' && !detected.hasBom),
    };
  }

  /**
   * 智能转码并导出双击必开的标准表格 (.xlsx / 带 BOM 的 .csv / 纯 UTF-8 .csv)
   */
  static async convertTableEncoding({
    fileBuffer,
    fileName = 'table.csv',
    sourceEncoding,
    targetFormat = 'xlsx',
    delimiter,
  }) {
    if (!fileBuffer || (Buffer.isBuffer(fileBuffer) && fileBuffer.length === 0)) {
      throw new Error('未接收到有效的表格数据');
    }
    const buffer = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer);

    // 1. 确定源字符集
    const detected = SpreadsheetService.detectEncoding(buffer);
    const encodingToUse = sourceEncoding || detected.encoding;

    // 2. 解码完整文本
    let fullText = '';
    try {
      const decoder = new TextDecoder(encodingToUse);
      const sliceBuffer = detected.hasBom && !sourceEncoding ? buffer.subarray(detected.bomLength) : buffer;
      fullText = decoder.decode(sliceBuffer);
    } catch (_) {
      fullText = new TextDecoder('utf-8').decode(buffer);
    }

    // 3. 确定分隔符并解析
    const activeDelimiter = delimiter || SpreadsheetService.detectDelimiter(fullText);
    const rows = SpreadsheetService.parseCsvRows(fullText, activeDelimiter);
    if (rows.length === 0) {
      throw new Error('未解析到有效的表格行数据');
    }

    const baseName = fileName.replace(/\.[^/.]+$/, '');

    // 4. 格式化输出
    if (targetFormat === 'xlsx') {
      const ws = {};
      const maxCols = Math.max(...rows.map(r => r.length), 1);
      const range = { s: { c: 0, r: 0 }, e: { c: maxCols - 1, r: rows.length - 1 } };

      for (let R = 0; R < rows.length; ++R) {
        const row = rows[R];
        for (let C = 0; C < row.length; ++C) {
          const cellRef = XLSX.utils.encode_cell({ c: C, r: R });
          const val = row[C] ?? '';

          // 核心保护：前导零字符（如 00123）、身份证号（18位）、银行卡号（16-19位）强制保留为字符串格式
          // 纯数字且无前导零的数值安全转为数值单元格（便于公式统计）
          const isLeadZero = val.length > 1 && val.startsWith('0') && !val.startsWith('0.');
          const isLongNumeric = val.length >= 15 && /^\d+$/.test(val);
          const isPureNumber = /^-?\d+(\.\d+)?$/.test(val) && !isLeadZero && !isLongNumeric;

          if (R > 0 && isPureNumber) {
            ws[cellRef] = { t: 'n', v: Number(val) };
          } else {
            ws[cellRef] = { t: 's', v: String(val) };
          }
        }
      }
      ws['!ref'] = XLSX.utils.encode_range(range);

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '标准表格');
      const outBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      return {
        success: true,
        buffer: Buffer.from(outBuffer),
        filename: `${baseName}_标准表格.xlsx`,
        mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        totalRows: rows.length,
        totalCols: maxCols,
        targetFormat: 'xlsx',
      };
    } else if (targetFormat === 'csv-bom') {
      // 带 UTF-8 BOM 的 CSV：Excel 双击必开且绝不乱码
      const csvStr = SpreadsheetService.formatToCsv(rows, ',');
      const outBuffer = Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from(csvStr, 'utf-8')]);

      return {
        success: true,
        buffer: outBuffer,
        filename: `${baseName}_Excel兼容(带BOM).csv`,
        mime: 'text/csv; charset=utf-8',
        totalRows: rows.length,
        totalCols: Math.max(...rows.map(r => r.length), 1),
        targetFormat: 'csv-bom',
      };
    } else {
      // 纯净 UTF-8 CSV (无 BOM，适合 Python/数据库/接口导入)
      const csvStr = SpreadsheetService.formatToCsv(rows, ',');
      const outBuffer = Buffer.from(csvStr, 'utf-8');

      return {
        success: true,
        buffer: outBuffer,
        filename: `${baseName}_标准UTF8.csv`,
        mime: 'text/csv; charset=utf-8',
        totalRows: rows.length,
        totalCols: Math.max(...rows.map(r => r.length), 1),
        targetFormat: 'csv-utf8',
      };
    }
  }
}

module.exports = SpreadsheetService;
