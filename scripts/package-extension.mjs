/**
 * Build a Chrome Web Store zip from dist/ containing only the runtime closure
 * (same set as audit required=1). Refuses to run if user data is found in dist/.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { platform } from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  collectDistClosure,
  distDir,
  listDistFiles,
  norm,
  root,
} from './package-dist-closure.mjs';
import { shipFileSafetyIssue, USER_EXPORT_FILENAME_RE } from './package-safety.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const releaseDir = path.join(root, 'release');
const stageDir = path.join(releaseDir, '.package-stage');

function readText(absPath) {
  try {
    return fs.readFileSync(absPath, 'utf8');
  } catch {
    return null;
  }
}

function readVersion() {
  const manifestPath = path.join(distDir, 'manifest.json');
  const manifest = JSON.parse(readText(manifestPath));
  const v = manifest.version;
  if (typeof v !== 'string' || !v) throw new Error('dist/manifest.json missing version');
  return v;
}

function assertDistReady() {
  if (!fs.existsSync(path.join(distDir, 'manifest.json'))) {
    console.error('[package] dist/ missing — run: npm run build');
    process.exit(1);
  }
}

function collectSafetyErrors(closure) {
  /** @type {string[]} */
  const errors = [];

  for (const rel of [...closure].sort()) {
    const abs = path.join(distDir, rel);
    if (!fs.existsSync(abs)) {
      errors.push(`runtime file missing from dist/: ${rel}`);
      continue;
    }
    const issue = shipFileSafetyIssue(rel, readText(abs) ?? '');
    if (issue) errors.push(issue);
  }

  for (const rel of listDistFiles()) {
    if (closure.has(rel)) continue;
    const abs = path.join(distDir, rel);
    const text = readText(abs);
    const base = path.basename(rel);
    if (USER_EXPORT_FILENAME_RE.test(base)) {
      errors.push(`user export file in dist/ (remove before packaging): ${rel}`);
      continue;
    }
    if (text && shipFileSafetyIssue(rel, text)) {
      errors.push(`user data in dist/ outside runtime closure (remove before packaging): ${rel}`);
    }
  }

  return errors;
}

function stageClosure(closure) {
  fs.rmSync(stageDir, { recursive: true, force: true });
  fs.mkdirSync(stageDir, { recursive: true });

  for (const rel of [...closure].sort()) {
    const src = path.join(distDir, rel);
    const dest = path.join(stageDir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

function createZip(zipPath) {
  fs.mkdirSync(path.dirname(zipPath), { recursive: true });
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

  if (platform() === 'win32') {
    const ps = [
      'Compress-Archive',
      '-Path',
      path.join(stageDir, '*'),
      '-DestinationPath',
      zipPath,
      '-Force',
    ].join(' ');
    const r = spawnSync('powershell', ['-NoProfile', '-Command', ps], { stdio: 'pipe' });
    if (r.status !== 0) {
      throw new Error(r.stderr?.toString() || 'Compress-Archive failed');
    }
    return;
  }

  const r = spawnSync('zip', ['-qr', zipPath, '.'], { cwd: stageDir, stdio: 'pipe' });
  if (r.status !== 0) {
    throw new Error(
      r.stderr?.toString() || 'zip command failed — install zip or run on Windows with PowerShell',
    );
  }
}

function main() {
  assertDistReady();

  const verify = spawnSync('node', [path.join(__dirname, 'verify-extension-dist.mjs')], {
    cwd: root,
    stdio: 'inherit',
  });
  if (verify.status !== 0) process.exit(verify.status ?? 1);

  const closure = collectDistClosure();
  if (closure.size === 0) {
    console.error('[package] empty runtime closure — run: npm run build');
    process.exit(1);
  }

  const safetyErrors = collectSafetyErrors(closure);
  if (safetyErrors.length > 0) {
    console.error('[package] refused — user data or safety check failed:');
    for (const e of safetyErrors) console.error(`  • ${e}`);
    process.exit(1);
  }

  const allDist = listDistFiles();
  const excluded = allDist.filter((rel) => !closure.has(rel));

  stageClosure(closure);

  const version = readVersion();
  const zipName = `justpractice-${version}.zip`;
  const zipPath = path.join(releaseDir, zipName);
  createZip(zipPath);

  fs.rmSync(stageDir, { recursive: true, force: true });

  console.info(`[package] OK — ${closure.size} files → ${norm(path.relative(root, zipPath))}`);
  if (excluded.length > 0) {
    console.info(`[package] excluded ${excluded.length} dist file(s) not in runtime closure:`);
    for (const rel of excluded) console.info(`  - dist/${rel}`);
  }
}

main();
