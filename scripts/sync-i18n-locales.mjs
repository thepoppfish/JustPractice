/**
 * Merge gap translations into locale files so every locale has all en.json keys.
 * Run: node scripts/sync-i18n-locales.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const localesDir = path.join(root, 'src/i18n/locales');
const en = JSON.parse(fs.readFileSync(path.join(localesDir, 'en.json'), 'utf8'));
const gaps = JSON.parse(fs.readFileSync(path.join(root, 'scripts/i18n-gap-translations.json'), 'utf8'));

const targets = ['de', 'es', 'fr', 'he', 'ja'];
let failed = false;

for (const loc of targets) {
  const file = path.join(localesDir, `${loc}.json`);
  const current = JSON.parse(fs.readFileSync(file, 'utf8'));
  const patch = gaps[loc] ?? {};
  const out = {};

  for (const key of Object.keys(en)) {
    const value = patch[key] ?? current[key];
    if (value == null || String(value).trim() === '') {
      console.error(`[${loc}] missing translation for ${key}`);
      failed = true;
      continue;
    }
    out[key] = value;
  }

  fs.writeFileSync(file, `${JSON.stringify(out, null, 2)}\n`, 'utf8');
  console.log(`${loc}: ${Object.keys(out).length} keys`);
}

if (failed) process.exit(1);
