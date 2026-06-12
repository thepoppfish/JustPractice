import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const iconsDir = path.join(root, 'public', 'icons');
const source = path.join(iconsDir, 'logo-source.png');

if (!fs.existsSync(source)) {
  console.error('[generate-icons] missing public/icons/logo-source.png');
  process.exit(1);
}

const sizes = [16, 32, 48, 128];

function circleMaskPng(size) {
  const r = size / 2;
  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <circle cx="${r}" cy="${r}" r="${r}" fill="white"/>
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

for (const size of sizes) {
  const out = path.join(iconsDir, `icon-${size}.png`);
  const mask = await circleMaskPng(size);
  await sharp(source)
    .resize(size, size, { fit: 'cover' })
    .ensureAlpha()
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toFile(out);
  console.info(`[generate-icons] wrote ${path.relative(root, out)}`);
}
