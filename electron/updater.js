const { autoUpdater } = require('electron-updater');
const { ipcMain, app } = require('electron');

function initUpdater(mainWindow) {
  // 不自动下载，由前端界面提示后用户点击才下载
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  const sendStatus = (status, payload = {}) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('app:update-status', { status, ...payload });
    }
  };

  autoUpdater.on('checking-for-update', () => {
    sendStatus('checking');
  });

  autoUpdater.on('update-available', (info) => {
    sendStatus('available', {
      version: info.version,
      releaseNotes: info.releaseNotes,
      releaseDate: info.releaseDate,
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    sendStatus('not-available', {
      version: info?.version,
      currentVersion: app.getVersion(),
    });
  });

  autoUpdater.on('download-progress', (progressObj) => {
    sendStatus('downloading', {
      percent: Math.round(progressObj.percent || 0),
      transferred: progressObj.transferred,
      total: progressObj.total,
      bytesPerSecond: progressObj.bytesPerSecond,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    sendStatus('ready', {
      version: info.version,
    });
  });

  autoUpdater.on('error', (err) => {
    const errMsg = err == null ? '' : (err.message || String(err));
    // 如果 GitHub Releases 尚未发布过任何版本，或者未找到更新清单 (404)，向用户展示“当前已是最新版本”
    if (errMsg.includes('No published versions on GitHub') || errMsg.includes('404') || errMsg.includes('Cannot find')) {
      sendStatus('not-available', {
        version: app.getVersion(),
        currentVersion: app.getVersion(),
        message: '当前已是最新版本',
      });
      return;
    }
    sendStatus('error', {
      message: errMsg || '未知更新错误',
    });
  });

  // 注册前端调用的 IPC 事件
  ipcMain.handle('app:check-for-updates', async () => {
    try {
      if (!app.isPackaged) {
        return { isDev: true, message: '开发模式下无需检查实际更新' };
      }
      const result = await autoUpdater.checkForUpdates();
      return { success: true, result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('app:start-download', async () => {
    try {
      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('app:quit-and-install', () => {
    autoUpdater.quitAndInstall(false, true);
  });

  ipcMain.handle('app:get-version', () => {
    return app.getVersion();
  });
}

module.exports = { initUpdater };
