const { ipcMain } = require('electron');
const DocumentService = require('./services/documentService');
const ImageService = require('./services/imageService');
const SpreadsheetService = require('./services/spreadsheetService');
const UtilityService = require('./services/utilityService');

function registerIpcHandlers(options = {}) {
  const getDesktopConfig = options.getDesktopConfig || (() => ({}));
  // ==================== 文档服务 (DocumentService) ====================
  ipcMain.handle('document:pdf-to-word', async (_e, payload) => {
    return await DocumentService.pdfToWord(payload);
  });

  ipcMain.handle('document:word-to-pdf', async (_e, payload) => {
    return await DocumentService.wordToPdf(payload);
  });

  ipcMain.handle('document:merge-pdfs', async (_e, payload) => {
    return await DocumentService.mergePdfs(payload);
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
    return await DocumentService.compressPdf(payload);
  });

  ipcMain.handle('document:images-to-pdf', async (_e, payload) => {
    return await DocumentService.imagesToPdf(payload);
  });

  ipcMain.handle('document:organize-pdf', async (_e, payload) => {
    return await DocumentService.organizePdf(payload);
  });

  ipcMain.handle('document:render-pdf-pages', async (_e, payload) => {
    return await DocumentService.renderPdfPages(payload);
  });

  // ==================== 图像服务 (ImageService) ====================
  ipcMain.handle('image:convert', async (_e, payload) => {
    return await ImageService.convertImage(payload);
  });

  ipcMain.handle('image:resize', async (_e, payload) => {
    return await ImageService.resizeImage(payload);
  });

  ipcMain.handle('image:strip-exif', async (_e, payload) => {
    return await ImageService.stripExif(payload);
  });

  // ==================== 表格服务 (SpreadsheetService) ====================
  ipcMain.handle('spreadsheet:probe', async (_e, payload) => {
    return await SpreadsheetService.probeSpreadsheet(payload);
  });

  ipcMain.handle('spreadsheet:merge', async (_e, payload) => {
    return await SpreadsheetService.mergeSheets(payload);
  });

  ipcMain.handle('spreadsheet:split', async (_e, payload) => {
    return await SpreadsheetService.splitSheet(payload);
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

  // ==================== 后端健康检查兼容 ====================
  ipcMain.handle('backend:check-health', async () => {
    return { status: 'healthy', inProcess: true };
  });

  ipcMain.handle('backend:restart', async () => {
    return { success: true };
  });
}

module.exports = { registerIpcHandlers };
