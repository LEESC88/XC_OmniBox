const { app, BrowserWindow, dialog, protocol, Tray, Menu, shell, ipcMain, session } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { registerIpcHandlers } = require('./ipcHandlers');

let _updaterModule = null;
function getUpdater() {
  if (!_updaterModule) {
    _updaterModule = require('./updater');
  }
  return _updaterModule;
}

let tray = null;
let isQuitting = false;

// 关键：必须在 app.ready 之前注册自定义特权 scheme，让它具备与 http/https 同等标准能力
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
};

const isDev = !app.isPackaged || process.env.NODE_ENV === 'development';
let mainWindow = null;

// ================= 全局持久化设置管理 =================
function getConfigFilePath() {
  return path.join(app.getPath('userData'), 'desktop_config.json');
}

let desktopConfig = {
  minimizeToTray: true,
  closeToTray: false,
  openFolderAfterExport: false,
  customExportPath: '',
  autoCheckUpdate: true,
  preferredEngine: 'auto',
};

function loadDesktopConfig() {
  try {
    const file = getConfigFilePath();
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf-8');
      desktopConfig = { ...desktopConfig, ...JSON.parse(content) };
    }
  } catch (e) {
    console.error('[Config] Failed to load desktop config:', e);
  }
}

function saveDesktopConfig(newConfig) {
  try {
    desktopConfig = { ...desktopConfig, ...newConfig };
    fs.writeFileSync(getConfigFilePath(), JSON.stringify(desktopConfig, null, 2), 'utf-8');
  } catch (e) {
    console.error('[Config] Failed to save desktop config:', e);
  }
}

function getTempDirPath() {
  const dir = path.join(app.getPath('userData'), 'temp');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getFolderSize(dirPath) {
  let size = 0;
  if (!fs.existsSync(dirPath)) return 0;
  try {
    const files = fs.readdirSync(dirPath);
    for (const f of files) {
      const p = path.join(dirPath, f);
      const stat = fs.statSync(p);
      if (stat.isDirectory()) {
        size += getFolderSize(p);
      } else {
        size += stat.size;
      }
    }
  } catch (_) {}
  return size;
}

function clearFolder(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  try {
    const files = fs.readdirSync(dirPath);
    for (const f of files) {
      const p = path.join(dirPath, f);
      try {
        if (fs.statSync(p).isDirectory()) {
          fs.rmSync(p, { recursive: true, force: true });
        } else {
          fs.unlinkSync(p);
        }
      } catch (_) {}
    }
  } catch (_) {}
}

// 检查后端是否已就绪


function createTray() {
  if (tray) return;
  const iconPath = path.join(__dirname, '../resources/icon.ico');
  tray = new Tray(iconPath);
  tray.setToolTip('XC 万象箱 (XC_OmniBox)');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主界面',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.focus();
        }
      },
    },
    {
      label: '检查更新',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.focus();
          mainWindow.webContents.send('app:update-status', { status: 'checking' });
        }
      },
    },
    { type: 'separator' },
    {
      label: '彻底退出',
      click: () => {
        isQuitting = true;
        stopBackendService();
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
        mainWindow.focus();
      } else {
        mainWindow.focus();
      }
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// 确保 Windows 高分屏与文字亚像素抗锯齿 (ClearType) 正常启用，彻底杜绝字体边缘模糊与发虚
app.commandLine.appendSwitch('high-dpi-support', '1');
app.commandLine.appendSwitch('enable-font-antialiasing');
app.commandLine.appendSwitch('force-color-profile', 'srgb');

// 强制释放 Chromium 引擎 GPU 硬件加速，确保高刷屏 60~120 FPS 满帧丝滑运行
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-features', 'CanvasOopRasterization,Accelerated2dCanvas,VaapiVideoDecoder');

function createWindow() {
  const iconPath = path.join(__dirname, '../resources/icon.ico');

  mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'XC 万象箱 (XC_OmniBox)',
    icon: iconPath,
    backgroundColor: '#FAF1E8',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false, // 窗口失焦或最小化时不降频卡死，保证批量多任务满速处理
      spellcheck: false, // 禁用系统后台拼写检查线程，杜绝代码/长文本/Base64 处理时的微卡顿
      v8CacheOptions: 'bypassHeatCheck', // 提高 V8 脚本执行缓存命中率，启动与加载极速响应
    },
    autoHideMenuBar: true,
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadURL('app://localhost/index.html');
  }

  // 缩小（最小化）行为拦截：根据用户设置决定是否缩入系统托盘
  mainWindow.on('minimize', (event) => {
    if (desktopConfig.minimizeToTray) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // 关闭窗口行为拦截：如果设置了关闭时隐藏至托盘且不是退出状态
  mainWindow.on('close', (event) => {
    if (desktopConfig.closeToTray && !isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // 拦截全部 target="_blank" 或 window.open 外部链接，一律调用系统默认外部浏览器 (Chrome/Edge 等) 打开，严禁在内嵌窗口加载
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // 拦截非本地的外部页面导航跳转
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      if (!url.startsWith('http://localhost:3000') && !url.startsWith('http://127.0.0.1:3000')) {
        event.preventDefault();
        shell.openExternal(url);
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 初始化自动更新监听（延迟至下一事件循环按需加载 electron-updater，零阻塞首屏）
  setImmediate(() => {
    getUpdater().initUpdater(mainWindow);
  });
}

// 注册设置相关的 IPC 通道
function setupSettingsIPC() {
  ipcMain.handle('app:open-external', async (_e, url) => {
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      await shell.openExternal(url);
    }
  });

  ipcMain.handle('settings:get-config', () => {
    let defaultDownloadsPath = '';
    try {
      defaultDownloadsPath = app.getPath('downloads');
    } catch (_) {}
    return {
      ...desktopConfig,
      defaultDownloadsPath,
    };
  });

  ipcMain.handle('settings:get-default-path', () => {
    try {
      return app.getPath('downloads');
    } catch (_) {
      return '';
    }
  });

  ipcMain.handle('settings:set-config', (_e, newConfig) => {
    saveDesktopConfig(newConfig);
    return desktopConfig;
  });

  ipcMain.handle('settings:select-folder', async () => {
    if (!mainWindow) return null;
    let defPath = desktopConfig.customExportPath;
    if (!defPath) {
      try {
        defPath = app.getPath('downloads');
      } catch (_) {}
    }
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory'],
      title: '选择自定义保存目录',
      defaultPath: defPath,
    });
    if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });

  ipcMain.handle('settings:open-path', (_e, folderPath) => {
    let target = folderPath || desktopConfig.customExportPath;
    if (!target) {
      try {
        target = app.getPath('downloads');
      } catch (_) {}
    }
    if (target && fs.existsSync(target)) {
      shell.openPath(target);
      return true;
    }
    return false;
  });

  ipcMain.handle('settings:get-cache-size', () => {
    const tempDir = getTempDirPath();
    const bytes = getFolderSize(tempDir);
    return {
      bytes,
      formatted: (bytes / (1024 * 1024)).toFixed(2) + ' MB',
    };
  });

  ipcMain.handle('settings:clear-cache', () => {
    const tempDir = getTempDirPath();
    clearFolder(tempDir);
    return { success: true };
  });

  ipcMain.handle('settings:get-autostart', () => {
    try {
      return app.getLoginItemSettings().openAtLogin;
    } catch {
      return false;
    }
  });

  ipcMain.handle('settings:set-autostart', (_e, enable) => {
    try {
      app.setLoginItemSettings({ openAtLogin: Boolean(enable) });
      return app.getLoginItemSettings().openAtLogin;
    } catch {
      return false;
    }
  });
}

// 单例锁：防止用户重复打开多个客户端实例
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (!mainWindow.isVisible()) mainWindow.show();
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    loadDesktopConfig();
    setupSettingsIPC();
    registerIpcHandlers({ getDesktopConfig: () => desktopConfig });

    // 注册自定义 app:// 协议处理器
    protocol.handle('app', async (request) => {
      try {
        const reqUrl = new URL(request.url);
        let pathname = decodeURIComponent(reqUrl.pathname);

        if (pathname === '/' || !pathname) {
          pathname = '/index.html';
        }

        const outDir = path.join(__dirname, '../frontend/out');
        let targetFile = path.join(outDir, pathname);

        if (fs.existsSync(targetFile) && fs.statSync(targetFile).isDirectory()) {
          targetFile = path.join(targetFile, 'index.html');
        } else if (!fs.existsSync(targetFile) && !path.extname(targetFile)) {
          if (fs.existsSync(targetFile + '.html')) {
            targetFile = targetFile + '.html';
          } else if (fs.existsSync(path.join(targetFile, 'index.html'))) {
            targetFile = path.join(targetFile, 'index.html');
          }
        }

        if (fs.existsSync(targetFile)) {
          const ext = path.extname(targetFile).toLowerCase();
          const contentType = MIME_TYPES[ext] || 'application/octet-stream';
          const data = fs.readFileSync(targetFile);
          return new Response(data, {
            status: 200,
            headers: {
              'Content-Type': contentType,
              'Access-Control-Allow-Origin': '*',
            },
          });
        }

        console.warn(`[Protocol App] 404 Not Found: ${pathname} -> ${targetFile}`);
        return new Response('404 Not Found', { status: 404 });
      } catch (err) {
        console.error('[Protocol App Error]', err);
        return new Response('500 Internal Server Error', { status: 500 });
      }
    });

    // 1. 窗口与托盘秒开
    createWindow();
    createTray();

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('backend:status', { status: 'healthy' });
    }

    // 监听文件导出/下载：支持指定固定目录与完成后自动在资源管理器定位
    session.defaultSession.on('will-download', (_event, item) => {
      if (desktopConfig.customExportPath && fs.existsSync(desktopConfig.customExportPath)) {
        const targetPath = path.join(desktopConfig.customExportPath, item.getFilename());
        item.setSavePath(targetPath);
      }
      item.once('done', (_e, state) => {
        if (state === 'completed' && desktopConfig.openFolderAfterExport) {
          try {
            shell.showItemInFolder(item.getSavePath());
          } catch (_) {}
        }
      });
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('before-quit', () => {
    isQuitting = true;
  });

  app.on('will-quit', () => {
    isQuitting = true;
  });
}
