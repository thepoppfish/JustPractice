/**
 * Fail the build if dist/ is not safe to load as the unpacked extension.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const manifestPath = path.join(dist, 'manifest.json');
const bundlePath = path.join(dist, 'assets', 'youtube-content.bundle.js');

const errors = [];

if (!fs.existsSync(manifestPath)) {
  errors.push('missing dist/manifest.json — run npm run build');
}

if (!fs.existsSync(bundlePath)) {
  errors.push('missing dist/assets/youtube-content.bundle.js — run npm run build');
}

if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const scripts = manifest.content_scripts ?? [];
  const jsFiles = scripts.flatMap((s) => s.js ?? []);

  if (!jsFiles.includes('assets/youtube-content.bundle.js')) {
    errors.push(
      `content_scripts must list assets/youtube-content.bundle.js, got: ${JSON.stringify(jsFiles)}`,
    );
  }

  for (const file of jsFiles) {
    if (file.includes('loader') || file.endsWith('youtube.ts.js')) {
      errors.push(`content_scripts must not use CRXJS loader/split chunks: ${file}`);
    }
    const onDisk = path.join(dist, file.replace(/\//g, path.sep));
    if (!fs.existsSync(onDisk)) {
      errors.push(`content_scripts entry missing on disk: ${file}`);
    }
  }

  if (manifest.web_accessible_resources?.length) {
    const warJs = manifest.web_accessible_resources.flatMap((w) => w.resources ?? []);
    if (warJs.some((r) => String(r).includes('youtube.ts') || String(r).includes('xpDebug'))) {
      errors.push('web_accessible_resources still lists split YouTube chunks — drop or rebuild');
    }
  }
}

if (fs.existsSync(bundlePath)) {
  const bundle = fs.readFileSync(bundlePath, 'utf8');
  if (!bundle.includes('jp-practice-yt-panel-host')) {
    errors.push('bundle missing panel host id jp-practice-yt-panel-host');
  }
  if (!bundle.includes('function boot(') && !bundle.includes('boot();')) {
    errors.push('bundle missing boot()');
  }
  if (bundle.includes('youtube.ts-loader')) {
    errors.push('bundle must not reference youtube.ts-loader');
  }
}

if (errors.length > 0) {
  console.error('[verify-extension-dist] FAILED:\n' + errors.map((e) => `  - ${e}`).join('\n'));
  console.error('\nLoad chrome://extensions → JustPractice → point at the dist/ folder after npm run build');
  process.exit(1);
}

console.info('[verify-extension-dist] OK — load unpacked extension from:', dist);
