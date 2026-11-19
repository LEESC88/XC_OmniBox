const net = require('net');
const { execSync, spawn } = require('child_process');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const mode = process.argv[2] === 'frontend' ? 'frontend' : 'electron';
const BASE_PORT = 3000;

/**
 * 尝试清理当前用户下占用指定端口的残留进程
 */
function tryReleasePort(port) {
  if (process.platform !== 'win32') return;
  try {
    const out = execSync(`netstat -aon | findstr ":${port} " | findstr "LISTENING"`, {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const pids = new Set();
    for (const line of out.split(/\r?\n/)) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && /^\d+$/.test(pid) && pid !== '0') {
        pids.add(pid);
      }
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
        console.log(`[DevLauncher] Released occupied port ${port} (PID: ${pid}).`);
      } catch (_) {
        // 若该进程属于管理员或其他 Windows 会话（Access Denied），后续自动切换可用端口
      }
    }
  } catch (_) {}
}

/**
 * 检测端口是否真正空闲可用
 */
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const tester = net
      .createServer()
      .once('error', () => resolve(false))
      .once('listening', () => {
        tester.close(() => resolve(true));
      })
      .listen(port, '0.0.0.0');
  });
}

async function findAvailablePort(startPort) {
  tryReleasePort(startPort);
  for (let p = startPort; p < startPort + 50; p++) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await isPortAvailable(p);
    if (ok) return p;
  }
  return startPort;
}

(async () => {
  const port = await findAvailablePort(BASE_PORT);
  if (port !== BASE_PORT) {
    console.log(
      `[DevLauncher] Port ${BASE_PORT} is occupied by a system/other-session process. Automatically switched to port ${port}.`
    );
  } else {
    console.log(`[DevLauncher] Using port ${port}.`);
  }

  const env = {
    ...process.env,
    XC_DEV_PORT: String(port),
    PORT: String(port),
  };

  if (mode === 'frontend') {
    const child = spawn(`npm --prefix frontend run dev -- -p ${port}`, {
      cwd: ROOT_DIR,
      env,
      stdio: 'inherit',
      shell: true,
    });
    child.on('exit', (code) => process.exit(code ?? 0));
  } else {
    const cmd = `npx concurrently -k "npm --prefix frontend run dev -- -p ${port}" "npx wait-on tcp:${port} && npx electron ."`;
    const child = spawn(cmd, {
      cwd: ROOT_DIR,
      env,
      stdio: 'inherit',
      shell: true,
    });
    child.on('exit', (code) => process.exit(code ?? 0));
  }
})();
