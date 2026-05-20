/**
 * Apply per-locale overrides and keep key order aligned with en.json.
 * Run: node scripts/apply-i18n-overrides.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const localesDir = path.join(root, 'src/i18n/locales');
const en = JSON.parse(fs.readFileSync(path.join(localesDir, 'en.json'), 'utf8'));
const overrides = JSON.parse(
  fs.readFileSync(path.join(root, 'scripts/i18n-locale-overrides.json'), 'utf8'),
);

for (const loc of ['de', 'es', 'fr', 'he', 'ja']) {
  const file = path.join(localesDir, `${loc}.json`);
  const current = JSON.parse(fs.readFileSync(file, 'utf8'));
  const patch = overrides[loc] ?? {};
  const out = {};
  for (const key of Object.keys(en)) {
    const value = patch[key] ?? current[key];
    if (value == null || String(value).trim() === '') {
      console.error(`[${loc}] missing: ${key}`);
      process.exit(1);
    }
    out[key] = value;
  }
  fs.writeFileSync(file, `${JSON.stringify(out, null, 2)}\n`, 'utf8');
  console.log(`${loc}: ${Object.keys(out).length} keys`);
}
