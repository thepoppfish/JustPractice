/**
 * One-off generator for docs/PROJECT-SLIMDOWN-INVENTORY.csv
 * Run: node scripts/generate-slimdown-inventory.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = execSync('git ls-files', { cwd: root, encoding: 'utf8' }).trim().split(/\n/).filter(Boolean);

const REMOVE_EXACT = new Set([
  'src/assets/notify.png',
  'AGENT-HANDOFF-practice-counting-and-ring-animation.md',
  'MotivationIdeas.md',
  'docs/GOAL-REMINDERS-WHY-NOT-WORKING.md',
]);

const REMOVE_PREFIX = ['assets/logo-intro/'];

const REMOVE_WITH_CODE = new Set([
  'scripts/render-logo-intro-video.mjs',
  'public/icons/icon-96.png',
]);

const BUILD_PIPELINE = new Set([
  'scripts/build-youtube-bundle.mjs',
  'scripts/generate-icons.mjs',
  'scripts/patch-crx-build.mjs',
  'scripts/verify-extension-dist.mjs',
  'scripts/vite-plugin-youtube-bundle.ts',
]);

function classify(rel) {
  if (REMOVE_EXACT.has(rel)) return ['REMOVE', 'orphan or obsolete; safe delete', 'P1'];
  for (const p of REMOVE_PREFIX) {
    if (rel.startsWith(p)) return ['REMOVE', 'logo-intro promo pipeline; not used by extension build', 'P1'];
  }
  if (REMOVE_WITH_CODE.has(rel)) {
    return [
      'REMOVE_WITH_CODE',
      'delete file then update package.json and/or generate-icons.mjs',
      'P1',
    ];
  }
  if (rel.endsWith('.test.ts')) return ['KEEP', 'unit test; recommended for regression safety', '—'];
  if (rel.startsWith('src/')) return ['KEEP', 'application source; required to build extension', '—'];
  if (rel.startsWith('scripts/package-') || rel === 'scripts/generate-package-file-audit.mjs') {
    return ['KEEP', 'store zip packaging and audit', '—'];
  }
  if (BUILD_PIPELINE.has(rel)) return ['KEEP', 'build pipeline', '—'];
  if (rel === 'public/icons/icon-96.png') {
    return ['REMOVE_WITH_CODE', 'not in manifest; stop generating in generate-icons.mjs', 'P1'];
  }
  if (rel.startsWith('public/icons/')) return ['KEEP', 'icon assets for build', '—'];
  if (rel === 'public/icons/logo-source.png') return ['KEEP', 'master icon; required by generate-icons.mjs', '—'];
  if (rel.startsWith('docs/PACKAGE-FILE-AUDIT')) {
    return ['KEEP', 'packaging reference; regenerate with npm run audit:package-files', '—'];
  }
  if (rel.startsWith('docs/')) return ['OPTIONAL', 'documentation', 'P3'];
  if (
    [
      'README.md',
      'LICENSE',
      '.gitignore',
      'package.json',
      'package-lock.json',
      'manifest.config.ts',
      'vite.config.ts',
      'vitest.config.ts',
      'eslint.config.js',
      'tsconfig.json',
      'tsconfig.node.json',
    ].includes(rel)
  ) {
    return ['KEEP', 'project root / tooling config', '—'];
  }
  if (rel.startsWith('scripts/')) return ['OPTIONAL', 'dev script; review before removing', 'P3'];
  return ['REVIEW', 'unclassified; decide manually', 'P3'];
}

function csvEsc(s) {
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const rows = [['path', 'size_bytes', 'action', 'reason', 'phase']];
const totals = {};
let bytesRemovable = 0;

for (const rel of files.sort()) {
  const st = fs.statSync(path.join(root, rel));
  const [action, reason, phase] = classify(rel);
  rows.push([rel, String(st.size), action, reason, phase]);
  totals[action] = (totals[action] ?? 0) + 1;
  if (action === 'REMOVE' || action === 'REMOVE_WITH_CODE') bytesRemovable += st.size;
}

const outPath = path.join(root, 'docs', 'PROJECT-SLIMDOWN-INVENTORY.csv');
fs.writeFileSync(outPath, `${rows.map((r) => r.map(csvEsc).join(',')).join('\n')}\n`, 'utf8');
console.info(`[slimdown-inventory] ${files.length} paths → ${path.relative(root, outPath)}`);
console.info(`  removable: ${((bytesRemovable / 1048576).toFixed(2))} MB (${totals.REMOVE ?? 0} REMOVE, ${totals.REMOVE_WITH_CODE ?? 0} REMOVE_WITH_CODE)`);
console.info(`  totals:`, totals);
