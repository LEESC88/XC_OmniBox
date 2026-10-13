const { ipcMain } = require('electron');
const DocumentService = require('./services/documentService');
const ImageService = require('./services/imageService');
const SpreadsheetService = require('./services/spreadsheetService');
const UtilityService = require('./services/utilityService');
const AudioService = require('./services/audioService');

function registerIpcHandlers(options = {}) {
  const getDesktopConfig = options.getDesktopConfig || (() => ({}));
  const emitProgress = (event) => (progressData) => {
    try {
      if (event && event.sender && !event.sender.isDestroyed()) {
        event.sender.send('task:progress', progressData);
      }
    } catch (_) {}
  };

  // ==================== 文档服务 (DocumentService) ====================
  ipcMain.handle('document:pdf-to-word', async (_e, payload) => {
    return await DocumentService.pdfToWord(payload);
  });

  ipcMain.handle('document:word-to-pdf', async (_e, payload) => {
    return await DocumentService.wordToPdf(payload);
  });

  ipcMain.handle('document:merge-pdfs', async (_e, payload) => {
    return await DocumentService.mergePdfs(payload, emitProgress(_e));
  });

  ipcMain.handle('document:split-pdf', async (_e, payload) => {
    return await DocumentService.splitPdf(payload);
  });

  ipcMain.handle('document:add-watermark', async (_e, payload) => {
    return await DocumentService.addWatermark(payload);
  });

  ipcMain.handle('document:protect-pdf', async (_e, payload) => {
    return await DocumentService.protectPdf(payload);
  });

  ipcMain.handle('document:compress-pdf', async (_e, payload) => {
    return await DocumentService.compressPdf(payload, emitProgress(_e));
  });

  ipcMain.handle('document:images-to-pdf', async (_e, payload) => {
    return await DocumentService.imagesToPdf(payload, emitProgress(_e));
  });

  ipcMain.handle('document:organize-pdf', async (_e, payload) => {
    return await DocumentService.organizePdf(payload);
  });

  ipcMain.handle('document:render-pdf-pages', async (_e, payload) => {
    return await DocumentService.renderPdfPages(payload);
  });

  ipcMain.handle('document:searchable-pdf', async (_e, payload) => {
    return await DocumentService.generateSearchablePdf(payload);
  });

  // ==================== 图像服务 (ImageService) ====================
  ipcMain.handle('image:compress', async (_e, payload) => {
    return await ImageService.compressImage(payload);
  });

  ipcMain.handle('image:convert', async (_e, payload) => {
    return await ImageService.convertImage(payload);
  });

  ipcMain.handle('image:resize', async (_e, payload) => {
    return await ImageService.resizeImage(payload);
  });

  ipcMain.handle('image:strip-exif', async (_e, payload) => {
    return await ImageService.stripExif(payload);
  });

  ipcMain.handle('image:watermark', async (_e, payload) => {
    return await ImageService.applyWatermark(payload);
  });

  ipcMain.handle('image:bundle-zip', async (_e, payload) => {
    return await ImageService.bundleZip(payload, emitProgress(_e));
  });

  ipcMain.handle('image:ocr-preprocess', async (_e, payload) => {
    return await ImageService.preprocessForOcr(payload);
  });

  ipcMain.handle('image:enhance', async (_e, payload) => {
    return await ImageService.enhanceImage(payload);
  });

  // ==================== 表格服务 (SpreadsheetService) ====================
  ipcMain.handle('spreadsheet:probe', async (_e, payload) => {
    return await SpreadsheetService.probeSpreadsheet(payload);
  });

  ipcMain.handle('spreadsheet:merge', async (_e, payload) => {
    return await SpreadsheetService.mergeSheets(payload, emitProgress(_e));
  });

  ipcMain.handle('spreadsheet:split', async (_e, payload) => {
    return await SpreadsheetService.splitSheet(payload, emitProgress(_e));
  });

  ipcMain.handle('spreadsheet:probe-split', async (_e, payload) => {
    return await SpreadsheetService.probeSplitGroups(payload);
  });

  // ==================== 实用工具服务 (UtilityService) ====================
  ipcMain.handle('files:scan-folder', async (_e, payload) => {
    return await UtilityService.scanFolder(payload);
  });

  ipcMain.handle('files:organize-execute', async (_e, payload) => {
    return await UtilityService.organizeExecute(payload);
  });

  ipcMain.handle('files:show-item-in-folder', (_e, filePath) => {
    const { shell } = require('electron');
    const fs = require('fs');
    if (filePath && fs.existsSync(filePath)) {
      shell.showItemInFolder(filePath);
      return true;
    }
    return false;
  });

  ipcMain.handle('files:trash-items', async (_e, payload) => {
    return await UtilityService.trashItems(payload);
  });

  ipcMain.handle('files:read-file-hash', async (_e, payload) => {
    return await UtilityService.readFileHash(payload);
  });

  ipcMain.handle('files:save-batch', async (_e, payload) => {
    const config = getDesktopConfig();
    return await UtilityService.saveBatch({
      ...payload,
      defaultPath: config.customExportPath,
    });
  });

  ipcMain.handle('files:find-duplicates', async (_e, payload) => {
    return await UtilityService.findDuplicates(payload, emitProgress(_e));
  });

  ipcMain.handle('files:generate-organize-plan', (_e, payload) => {
    return UtilityService.generateOrganizePlan(payload);
  });

  ipcMain.handle('files:export-organized-zip', async (_e, payload) => {
    return await UtilityService.exportOrganizedZip(payload);
  });

  ipcMain.handle('utility:text-diff', (_e, payload) => {
    return UtilityService.computeTextDiff(payload);
  });

  ipcMain.handle('utility:qr-generate', async (_e, payload) => {
    return await UtilityService.generateQrCode(payload);
  });

  ipcMain.handle('utility:qr-decode', async (_e, payload) => {
    return await UtilityService.decodeQrCode(payload);
  });

  ipcMain.handle('utility:calc-hash', (_e, payload) => {
    return UtilityService.calculateHash(payload);
  });

  ipcMain.handle('utility:convert-rmb', (_e, payload) => {
    return UtilityService.convertNumberToChineseRMB(payload);
  });

  ipcMain.handle('utility:parse-id-card', (_e, payload) => {
    return UtilityService.validateAndParseChineseId(payload);
  });

  // ==================== 音频服务 (AudioService) ====================
  ipcMain.handle('audio:export', async (_e, payload) => {
    return await AudioService.exportAudio(payload);
  });

  ipcMain.handle('audio:trim', (_e, payload) => {
    return AudioService.trimAudio(payload);
  });

  ipcMain.handle('audio:concat', (_e, payload) => {
    return AudioService.concatAudio(payload);
  });

  ipcMain.handle('audio:adjust-volume', (_e, payload) => {
    return AudioService.adjustVolumeAndNormalize(payload);
  });

  ipcMain.handle('audio:change-speed', (_e, payload) => {
    return AudioService.changeSpeed(payload);
  });

  ipcMain.handle('audio:enhance-voice', (_e, payload) => {
    return AudioService.enhanceVoiceClarity(payload);
  });

  ipcMain.handle('audio:reverse', (_e, payload) => {
    return AudioService.reverseAudio(payload);
  });

  ipcMain.handle('audio:extract-karaoke', (_e, payload) => {
    return AudioService.extractKaraoke(payload);
  });

  ipcMain.handle('audio:extract-peaks', (_e, payload) => {
    return AudioService.extractPeaks(payload);
  });

  // ==================== 后端健康检查兼容 ====================
  ipcMain.handle('backend:check-health', async () => {
    return { status: 'healthy', inProcess: true };
  });

  ipcMain.handle('backend:restart', async () => {
    return { success: true };
  });
}

module.exports = { registerIpcHandlers };
