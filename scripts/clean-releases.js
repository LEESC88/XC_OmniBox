const fs = require('fs');
const path = require('path');

function parseSemver(v) {
  const parts = v.split('.').map((n) => parseInt(n, 10) || 0);
  return { major: parts[0] || 0, minor: parts[1] || 0, patch: parts[2] || 0 };
}

function compareSemver(a, b) {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (pa.major !== pb.major) return pa.major - pb.major;
  if (pa.minor !== pb.minor) return pa.minor - pb.minor;
  return pa.patch - pb.patch;
}

function cleanOldLocalReleases(releaseDir = path.resolve(__dirname, '..', 'release'), keepCount = 2) {
  if (!fs.existsSync(releaseDir)) {
    console.log(`[Cleaner] Release directory ${releaseDir} does not exist. Skipping.`);
    return { kept: [], deleted: [], freedBytes: 0 };
  }

  const files = fs.readdirSync(releaseDir);
  const versionMap = new Map();
  for (const file of files) {
    const match = file.match(/^XC_OmniBox-Setup-(\d+\.\d+\.\d+)\.exe$/);
    if (match) {
      versionMap.set(match[1], true);
    }
  }

  const sortedVersions = Array.from(versionMap.keys()).sort((a, b) => compareSemver(b, a));
  const keptVersions = sortedVersions.slice(0, keepCount);
  const toDeleteVersions = sortedVersions.slice(keepCount);

  console.log(`[Cleaner] Found ${sortedVersions.length} versions in local release directory.`);
  console.log(`[Cleaner] Keeping latest ${keepCount} versions: ${keptVersions.join(', ') || 'none'}`);

  let freedBytes = 0;
  const deletedFiles = [];

  for (const ver of toDeleteVersions) {
    const exe = path.join(releaseDir, `XC_OmniBox-Setup-${ver}.exe`);
    const blockmap = path.join(releaseDir, `XC_OmniBox-Setup-${ver}.exe.blockmap`);

    if (fs.existsSync(exe)) {
      try {
        const sz = fs.statSync(exe).size;
        freedBytes += sz;
        fs.unlinkSync(exe);
        deletedFiles.push(`XC_OmniBox-Setup-${ver}.exe`);
        console.log(`  🗑️ Deleted: XC_OmniBox-Setup-${ver}.exe (${(sz / (1024 * 1024)).toFixed(1)} MB)`);
      } catch (e) {
        console.warn(`  ⚠️ Failed to delete ${exe}:`, e.message);
      }
    }

    if (fs.existsSync(blockmap)) {
      try {
        const sz = fs.statSync(blockmap).size;
        freedBytes += sz;
        fs.unlinkSync(blockmap);
        deletedFiles.push(`XC_OmniBox-Setup-${ver}.exe.blockmap`);
        console.log(`  🗑️ Deleted: XC_OmniBox-Setup-${ver}.exe.blockmap`);
      } catch (e) {
        console.warn(`  ⚠️ Failed to delete ${blockmap}:`, e.message);
      }
    }
  }

  const freedMB = (freedBytes / (1024 * 1024)).toFixed(2);
  console.log(`[Cleaner] Done! Deleted ${deletedFiles.length} files, freed ${freedMB} MB of local disk space.\n`);

  return { kept: keptVersions, deleted: deletedFiles, freedBytes };
}

if (require.main === module) {
  cleanOldLocalReleases();
}

module.exports = { cleanOldLocalReleases };
