/**
 * Generate docs/assets screenshot placeholders for GitHub Pages.
 * Run: node scripts/generate-pages-placeholders.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assetsDir = path.join(root, 'docs', 'assets');
const iconSrc = path.join(root, 'public', 'icons', 'icon-128.png');
const iconDst = path.join(assetsDir, 'icon-128.png');

const W = 900;
const H = 520;

const shots = [
  { file: 'screenshot-popup.png', label: 'Toolbar popup' },
  { file: 'screenshot-panel.png', label: 'YouTube watch panel' },
  { file: 'screenshot-dashboard.png', label: 'Dashboard' },
];

function placeholderSvg(label) {
  const safe = label.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1a1a1e"/>
      <stop offset="100%" stop-color="#0a0a0a"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <rect x="24" y="24" width="${W - 48}" height="${H - 48}" rx="12" fill="none" stroke="rgba(255,107,38,0.35)" stroke-width="2" stroke-dasharray="8 6"/>
  <text x="50%" y="46%" text-anchor="middle" fill="#f1f3f4" font-family="system-ui,Segoe UI,sans-serif" font-size="28" font-weight="600">JustPractice</text>
  <text x="50%" y="54%" text-anchor="middle" fill="#9aa0a6" font-family="system-ui,Segoe UI,sans-serif" font-size="18">${safe}</text>
  <text x="50%" y="62%" text-anchor="middle" fill="#ff6b26" font-family="system-ui,Segoe UI,sans-serif" font-size="14">Replace with a real screenshot</text>
</svg>`);
}

fs.mkdirSync(assetsDir, { recursive: true });
fs.copyFileSync(iconSrc, iconDst);

for (const { file, label } of shots) {
  const out = path.join(assetsDir, file);
  await sharp(placeholderSvg(label)).png().toFile(out);
  console.info(`[pages-placeholders] wrote ${path.relative(root, out)}`);
}

console.info(`[pages-placeholders] copied icon → ${path.relative(root, iconDst)}`);
