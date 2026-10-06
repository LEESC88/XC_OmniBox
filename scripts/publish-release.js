const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT_DIR = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf-8'));
const version = pkg.version;
const tagName = `v${version}`;
const owner = 'LEESC88';
const repo = 'XC_OmniBox';

function getGitHubToken() {
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN;
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    const creds = execSync('git credential fill', {
      input: 'protocol=https\nhost=github.com\n\n',
      encoding: 'utf-8',
    });
    const line = creds.split('\n').find((l) => l.startsWith('password='));
    if (line) {
      return line.replace('password=', '').trim();
    }
  } catch (err) {
    console.warn('Could not retrieve token from git credential helper:', err.message);
  }
  return null;
}

const token = getGitHubToken();
if (!token) {
  console.error('❌ Error: No GitHub Personal Access Token found via git credentials or environment variables.');
  process.exit(1);
}

function httpsRequest(url, options = {}, bodyBuffer = null) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.request(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: options.method || 'GET',
        headers: {
          'User-Agent': 'XC-OmniBox-Release-Bot',
          Authorization: `token ${token}`,
          ...options.headers,
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks);
          let json = null;
          try {
            json = JSON.parse(raw.toString('utf-8'));
          } catch (_) {}
          resolve({ status: res.statusCode, data: raw, json });
        });
      }
    );
    req.on('error', reject);
    if (bodyBuffer) {
      req.write(bodyBuffer);
    }
    req.end();
  });
}

function extractReleaseNotes() {
  try {
    const readme = fs.readFileSync(path.join(ROOT_DIR, 'README.md'), 'utf-8');
    const marker = `## 🌟 v${version}`;
    const startIdx = readme.indexOf(marker);
    if (startIdx !== -1) {
      const endIdx = readme.indexOf('---', startIdx);
      if (endIdx !== -1) {
        return readme.substring(startIdx, endIdx).trim();
      }
      return readme.substring(startIdx, startIdx + 1500).trim();
    }
  } catch (_) {}
  return `Release v${version} of XC_OmniBox`;
}

async function uploadAsset(releaseId, filePath, fileName) {
  const fileStats = fs.statSync(filePath);
  const fileSize = fileStats.size;
  console.log(`[Upload] Uploading ${fileName} (${(fileSize / (1024 * 1024)).toFixed(2)} MB)...`);

  const fileStream = fs.readFileSync(filePath);
  const uploadUrl = `https://uploads.github.com/repos/${owner}/${repo}/releases/${releaseId}/assets?name=${encodeURIComponent(
    fileName
  )}`;

  const res = await httpsRequest(
    uploadUrl,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': fileSize,
      },
    },
    fileStream
  );

  if (res.status >= 200 && res.status < 300) {
    console.log(`✅ [Upload] Successfully uploaded ${fileName}`);
  } else {
    console.error(`❌ [Upload] Failed to upload ${fileName}:`, res.status, res.json || res.data.toString());
    throw new Error(`Failed to upload ${fileName}`);
  }
}

async function main() {
  console.log(`\n========================================================`);
  console.log(`🚀 Starting Full Release Workflow for v${version}`);
  console.log(`========================================================\n`);

  const releaseDir = path.join(ROOT_DIR, 'release');
  const exePath = path.join(releaseDir, `XC_OmniBox-Setup-${version}.exe`);
  const blockmapPath = path.join(releaseDir, `XC_OmniBox-Setup-${version}.exe.blockmap`);
  const ymlPath = path.join(releaseDir, 'latest.yml');

  // 1. 检查或构建安装包
  if (!fs.existsSync(exePath)) {
    console.log(`[Builder] Installer ${exePath} not found. Running electron-builder...`);
    const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    const buildRes = spawnSync(npxCmd, ['electron-builder', '--win'], {
      cwd: ROOT_DIR,
      stdio: 'inherit',
      shell: true,
    });
    if (buildRes.status !== 0) {
      console.error(`❌ Packaging failed with exit code ${buildRes.status}`);
      process.exit(1);
    }
  } else {
    console.log(`[Builder] Found existing built installer: ${exePath} (${(fs.statSync(exePath).size / (1024 * 1024)).toFixed(2)} MB)`);
  }

  // 2. 查询 GitHub Releases
  console.log(`[GitHub API] Querying releases for ${owner}/${repo}...`);
  const listRes = await httpsRequest(`https://api.github.com/repos/${owner}/${repo}/releases`);
  const releases = listRes.json || [];

  let release = releases.find((r) => r.tag_name === tagName);
  const releaseNotes = extractReleaseNotes();
  const releaseTitle = `XC OmniBox v${version} - 表格工坊、目录智能归类大师与极速排重`;

  if (!release) {
    console.log(`[GitHub API] Creating new release for tag ${tagName}...`);
    const createRes = await httpsRequest(
      `https://api.github.com/repos/${owner}/${repo}/releases`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      Buffer.from(
        JSON.stringify({
          tag_name: tagName,
          name: releaseTitle,
          body: releaseNotes,
          draft: false,
          prerelease: false,
        })
      )
    );
    release = createRes.json;
    console.log(`✅ [GitHub API] Created release ID ${release.id}`);
  } else {
    console.log(`[GitHub API] Found existing release ID ${release.id} (draft: ${release.draft}). Updating metadata...`);
    const updateRes = await httpsRequest(
      `https://api.github.com/repos/${owner}/${repo}/releases/${release.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      },
      Buffer.from(
        JSON.stringify({
          tag_name: tagName,
          name: releaseTitle,
          body: releaseNotes,
          draft: false,
          prerelease: false,
        })
      )
    );
    release = updateRes.json || release;
    console.log(`✅ [GitHub API] Updated release metadata.`);
  }

  // 3. 上传或补齐 Assets
  const currentAssets = release.assets || [];
  const filesToUpload = [
    { path: exePath, name: `XC_OmniBox-Setup-${version}.exe` },
    { path: blockmapPath, name: `XC_OmniBox-Setup-${version}.exe.blockmap` },
    { path: ymlPath, name: 'latest.yml' },
  ];

  for (const item of filesToUpload) {
    if (!fs.existsSync(item.path)) {
      console.warn(`⚠️ Warning: ${item.path} does not exist, skipping.`);
      continue;
    }

    const existingAsset = currentAssets.find((a) => a.name === item.name);
    if (existingAsset) {
      console.log(`[Asset] ${item.name} already exists (ID: ${existingAsset.id}). Deleting old asset...`);
      await httpsRequest(`https://api.github.com/repos/${owner}/${repo}/releases/assets/${existingAsset.id}`, {
        method: 'DELETE',
      });
    }

    await uploadAsset(release.id, item.path, item.name);
  }

  console.log(`\n========================================================`);
  console.log(`🎉 Release v${version} completely published!`);
  console.log(`🔗 Public URL: ${release.html_url}`);
  console.log(`========================================================\n`);
}

main().catch((err) => {
  console.error('Fatal release error:', err);
  process.exit(1);
});
