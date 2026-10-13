const { ipcMain } = require('electron');

// 服务级按需懒加载缓存 (Lazy Singleton Getters)，消除主进程冷启动时加载 C++/二进制模块的 150-200ms 阻塞
let _documentService = null;
let _imageService = null;
let _spreadsheetService = null;
let _utilityService = null;
let _audioService = null;

function getDocumentService() {
  if (!_documentService) _documentService = require('./services/documentService');
  return _documentService;
}
function getImageService() {
  if (!_imageService) _imageService = require('./services/imageService');
  return _imageService;
}
function getSpreadsheetService() {
  if (!_spreadsheetService) _spreadsheetService = require('./services/spreadsheetService');
  return _spreadsheetService;
}
function getUtilityService() {
  if (!_utilityService) _utilityService = require('./services/utilityService');
  return _utilityService;
}
function getAudioService() {
  if (!_audioService) _audioService = require('./services/audioService');
  return _audioService;
}

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
    return await getDocumentService().pdfToWord(payload);
  });

  ipcMain.handle('document:word-to-pdf', async (_e, payload) => {
    return await getDocumentService().wordToPdf(payload);
  });

  ipcMain.handle('document:merge-pdfs', async (_e, payload) => {
    return await getDocumentService().mergePdfs(payload, emitProgress(_e));
  });

  ipcMain.handle('document:split-pdf', async (_e, payload) => {
    return await getDocumentService().splitPdf(payload);
  });

  ipcMain.handle('document:add-watermark', async (_e, payload) => {
    return await getDocumentService().addWatermark(payload);
  });

  ipcMain.handle('document:protect-pdf', async (_e, payload) => {
    return await getDocumentService().protectPdf(payload);
  });

  ipcMain.handle('document:unlock-pdf', async (_e, payload) => {
    return await getDocumentService().unlockPdf(payload);
  });

  ipcMain.handle('document:compress-pdf', async (_e, payload) => {
    return await getDocumentService().compressPdf(payload, emitProgress(_e));
  });

  ipcMain.handle('document:images-to-pdf', async (_e, payload) => {
    return await getDocumentService().imagesToPdf(payload, emitProgress(_e));
  });

  ipcMain.handle('document:organize-pdf', async (_e, payload) => {
    return await getDocumentService().organizePdf(payload);
  });

  ipcMain.handle('document:render-pdf-pages', async (_e, payload) => {
    return await getDocumentService().renderPdfPages(payload);
  });

  ipcMain.handle('document:searchable-pdf', async (_e, payload) => {
    return await getDocumentService().generateSearchablePdf(payload);
  });

  // ==================== 图像服务 (ImageService) ====================
  ipcMain.handle('image:compress', async (_e, payload) => {
    return await getImageService().compressImage(payload);
  });

  ipcMain.handle('image:convert', async (_e, payload) => {
    return await getImageService().convertImage(payload);
  });

  ipcMain.handle('image:resize', async (_e, payload) => {
    return await getImageService().resizeImage(payload);
  });

  ipcMain.handle('image:strip-exif', async (_e, payload) => {
    return await getImageService().stripExif(payload);
  });

  ipcMain.handle('image:watermark', async (_e, payload) => {
    return await getImageService().applyWatermark(payload);
  });

  ipcMain.handle('image:bundle-zip', async (_e, payload) => {
    return await getImageService().bundleZip(payload, emitProgress(_e));
  });

  ipcMain.handle('image:ocr-preprocess', async (_e, payload) => {
    return await getImageService().preprocessForOcr(payload);
  });

  ipcMain.handle('image:enhance', async (_e, payload) => {
    return await getImageService().enhanceImage(payload);
  });

  // ==================== 表格服务 (SpreadsheetService) ====================
  ipcMain.handle('spreadsheet:probe', async (_e, payload) => {
    return await getSpreadsheetService().probeSpreadsheet(payload);
  });

  ipcMain.handle('spreadsheet:merge', async (_e, payload) => {
    return await getSpreadsheetService().mergeSheets(payload, emitProgress(_e));
  });

  ipcMain.handle('spreadsheet:split', async (_e, payload) => {
    return await getSpreadsheetService().splitSheet(payload, emitProgress(_e));
  });

  ipcMain.handle('spreadsheet:probe-split', async (_e, payload) => {
    return await getSpreadsheetService().probeSplitGroups(payload);
  });

  // ==================== 实用工具服务 (UtilityService) ====================
  ipcMain.handle('files:scan-folder', async (_e, payload) => {
    return await getUtilityService().scanFolder(payload);
  });

  ipcMain.handle('files:organize-execute', async (_e, payload) => {
    return await getUtilityService().organizeExecute(payload);
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
    return await getUtilityService().trashItems(payload);
  });

  ipcMain.handle('files:read-file-hash', async (_e, payload) => {
    return await getUtilityService().readFileHash(payload);
  });

  ipcMain.handle('files:save-batch', async (_e, payload) => {
    const config = getDesktopConfig();
    return await getUtilityService().saveBatch({
      ...payload,
      defaultPath: config.customExportPath,
    });
  });

  ipcMain.handle('files:find-duplicates', async (_e, payload) => {
    return await getUtilityService().findDuplicates(payload, emitProgress(_e));
  });

  ipcMain.handle('files:generate-organize-plan', (_e, payload) => {
    return getUtilityService().generateOrganizePlan(payload);
  });

  ipcMain.handle('files:export-organized-zip', async (_e, payload) => {
    return await getUtilityService().exportOrganizedZip(payload);
  });

  ipcMain.handle('utility:text-diff', (_e, payload) => {
    return getUtilityService().computeTextDiff(payload);
  });

  ipcMain.handle('utility:qr-generate', async (_e, payload) => {
    return await getUtilityService().generateQrCode(payload);
  });

  ipcMain.handle('utility:qr-decode', async (_e, payload) => {
    return await getUtilityService().decodeQrCode(payload);
  });

  ipcMain.handle('utility:calc-hash', (_e, payload) => {
    return getUtilityService().calculateHash(payload);
  });

  ipcMain.handle('utility:convert-rmb', (_e, payload) => {
    return getUtilityService().convertNumberToChineseRMB(payload);
  });

  ipcMain.handle('utility:parse-id-card', (_e, payload) => {
    return getUtilityService().validateAndParseChineseId(payload);
  });

  // ==================== 音频服务 (AudioService) ====================
  ipcMain.handle('audio:export', async (_e, payload) => {
    return await getAudioService().exportAudio(payload);
  });

  ipcMain.handle('audio:trim', (_e, payload) => {
    return getAudioService().trimAudio(payload);
  });

  ipcMain.handle('audio:concat', (_e, payload) => {
    return getAudioService().concatAudio(payload);
  });

  ipcMain.handle('audio:adjust-volume', (_e, payload) => {
    return getAudioService().adjustVolumeAndNormalize(payload);
  });

  ipcMain.handle('audio:change-speed', (_e, payload) => {
    return getAudioService().changeSpeed(payload);
  });

  ipcMain.handle('audio:enhance-voice', (_e, payload) => {
    return getAudioService().enhanceVoiceClarity(payload);
  });

  ipcMain.handle('audio:reverse', (_e, payload) => {
    return getAudioService().reverseAudio(payload);
  });

  ipcMain.handle('audio:extract-karaoke', (_e, payload) => {
    return getAudioService().extractKaraoke(payload);
  });

  ipcMain.handle('audio:extract-peaks', (_e, payload) => {
    return getAudioService().extractPeaks(payload);
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
