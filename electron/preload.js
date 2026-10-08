const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  backendPort: 18520,

  // 检查更新
  checkForUpdates: () => ipcRenderer.invoke('app:check-for-updates'),
  // 开始下载更新
  startDownload: () => ipcRenderer.invoke('app:start-download'),
  // 立即重启并安装
  quitAndInstall: () => ipcRenderer.invoke('app:quit-and-install'),
  // 监听更新状态
  onUpdateStatus: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('app:update-status', listener);
    return () => ipcRenderer.removeListener('app:update-status', listener);
  },
  // 获取当前应用版本
  getAppVersion: () => ipcRenderer.invoke('app:get-version'),
  // 在系统默认浏览器中打开外部链接
  openExternal: (url) => ipcRenderer.invoke('app:open-external', url),

  // 全局设置与偏好配置
  getDesktopConfig: () => ipcRenderer.invoke('settings:get-config'),
  getDefaultPath: () => ipcRenderer.invoke('settings:get-default-path'),
  setDesktopConfig: (config) => ipcRenderer.invoke('settings:set-config', config),
  selectFolder: () => ipcRenderer.invoke('settings:select-folder'),
  openPath: (folderPath) => ipcRenderer.invoke('settings:open-path', folderPath),
  getCacheSize: () => ipcRenderer.invoke('settings:get-cache-size'),
  clearCache: () => ipcRenderer.invoke('settings:clear-cache'),
  getAutoStart: () => ipcRenderer.invoke('settings:get-autostart'),
  saveBatchFiles: (payload) => ipcRenderer.invoke('files:save-batch', payload),
  scanFolder: (payload) => ipcRenderer.invoke('files:scan-folder', payload),
  organizeExecute: (payload) => ipcRenderer.invoke('files:organize-execute', payload),
  showItemInFolder: (filePath) => ipcRenderer.invoke('files:show-item-in-folder', filePath),
  trashItems: (payload) => ipcRenderer.invoke('files:trash-items', payload),
  readFileHash: (payload) => ipcRenderer.invoke('files:read-file-hash', payload),
  restartBackend: () => ipcRenderer.invoke('backend:restart'),
  checkBackendHealth: () => ipcRenderer.invoke('backend:check-health'),
  onBackendStatus: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('backend:status', listener);
    return () => ipcRenderer.removeListener('backend:status', listener);
  },
});
