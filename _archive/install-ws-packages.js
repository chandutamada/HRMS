/**
 * Direct package installer — bypasses npm workspace arborist bug.
 * Downloads and extracts packages manually into the correct node_modules directories.
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = __dirname;
const API_MODULES = path.join(ROOT, 'apps', 'api', 'node_modules');
const WEB_MODULES = path.join(ROOT, 'apps', 'web', 'node_modules');
const TEMP_DIR = path.join(ROOT, '.ws-install-temp');

// Ensure temp dir exists
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

const API_PACKAGES = [
  '@nestjs/websockets@11.0.0',
  '@nestjs/platform-socket.io@11.0.0',
  'socket.io@4.8.1',
];

const WEB_PACKAGES = [
  'socket.io-client@4.8.1',
];

function installPackages(packages, targetModules, label) {
  console.log(`\n📦 Installing packages for ${label}...`);
  for (const pkg of packages) {
    const pkgName = pkg.split('@').slice(0, pkg.startsWith('@') ? 2 : 1).join('@');
    const version = pkg.split('@').slice(pkg.startsWith('@') ? 2 : 1).join('@');
    const safeName = pkgName.replace('/', '-').replace('@', '');
    const tarball = path.join(TEMP_DIR, `${safeName}-${version}.tgz`);

    console.log(`  ↓ Packing ${pkg}...`);
    try {
      execSync(`npm pack ${pkg} --pack-destination "${TEMP_DIR}"`, {
        stdio: 'pipe',
        cwd: TEMP_DIR,
      });
    } catch (e) {
      console.error(`  ✗ Failed to pack ${pkg}: ${e.message}`);
      continue;
    }

    // Find the tgz file
    const tgzFiles = fs.readdirSync(TEMP_DIR).filter(f => f.endsWith('.tgz'));
    if (tgzFiles.length === 0) {
      console.error(`  ✗ No tgz found for ${pkg}`);
      continue;
    }
    const tgzFile = path.join(TEMP_DIR, tgzFiles[tgzFiles.length - 1]);

    // Extract to target node_modules
    const nsScope = pkgName.startsWith('@') ? pkgName.split('/')[0] : null;
    const pkgBaseName = pkgName.startsWith('@') ? pkgName.split('/')[1] : pkgName;
    const destDir = nsScope
      ? path.join(targetModules, nsScope, pkgBaseName)
      : path.join(targetModules, pkgBaseName);

    if (!fs.existsSync(path.dirname(destDir))) {
      fs.mkdirSync(path.dirname(destDir), { recursive: true });
    }

    console.log(`  → Extracting to ${destDir}...`);
    try {
      execSync(`tar -xzf "${tgzFile}" -C "${path.dirname(destDir)}" --strip-components=1 --one-top-level="${pkgBaseName}"`, {
        stdio: 'pipe',
      });
      console.log(`  ✓ ${pkgName} installed`);
    } catch (e) {
      // tar may not be available, fallback to using npm install --prefix
      console.log(`  ℹ tar failed, trying npm install --prefix...`);
      try {
        execSync(`npm install ${pkg} --prefix "${path.join(targetModules, '..')}" --no-workspaces --legacy-peer-deps --no-package-lock`, {
          stdio: 'inherit',
          cwd: path.join(targetModules, '..'),
          env: { ...process.env, npm_config_workspaces: 'false' },
        });
        console.log(`  ✓ ${pkgName} installed via prefix`);
      } catch (e2) {
        console.error(`  ✗ Both methods failed for ${pkgName}: ${e2.message}`);
      }
    }

    // Clean up tgz
    try { fs.unlinkSync(tgzFile); } catch (_) {}
  }
}

installPackages(API_PACKAGES, API_MODULES, 'API (NestJS)');
installPackages(WEB_PACKAGES, WEB_MODULES, 'Web (Next.js)');

// Cleanup temp
try { fs.rmSync(TEMP_DIR, { recursive: true }); } catch (_) {}

console.log('\n✅ Done! Package installation complete.');
