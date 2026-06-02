/**
 * Ensure shipped manifest uses the single-file YouTube bundle (not CRXJS loader).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '../dist');
const manifestPath = path.join(distDir, 'manifest.json');

const YOUTUBE_MATCHES = [
  'https://www.youtube.com/*',
  'https://youtube.com/*',
  'https://m.youtube.com/*',
];

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

manifest.content_scripts = [
  {
    matches: YOUTUBE_MATCHES,
    js: ['assets/youtube-content.bundle.js'],
    run_at: 'document_idle',
    all_frames: false,
  },
];

delete manifest.web_accessible_resources;

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.info('[patch-crx-build] content_scripts → assets/youtube-content.bundle.js');
