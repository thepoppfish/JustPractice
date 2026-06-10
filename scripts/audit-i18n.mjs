import fs from 'fs';
import path from 'path';

const dir = 'src/i18n/locales';
const locales = ['en', 'de', 'es', 'fr', 'he', 'ja'];
const data = {};
for (const l of locales) {
  data[l] = JSON.parse(fs.readFileSync(path.join(dir, `${l}.json`), 'utf8'));
}
const enKeys = Object.keys(data.en).sort();
console.log('EN key count:', enKeys.length);
for (const l of locales) {
  if (l === 'en') continue;
  const keys = Object.keys(data[l]);
  const missing = enKeys.filter((k) => !(k in data[l]));
  const extra = keys.filter((k) => !(k in data.en));
  const sameAsEn = enKeys.filter((k) => k in data[l] && data[l][k] === data.en[k]);
  console.log(`\n=== ${l.toUpperCase()} ===`);
  console.log(`keys: ${keys.length} missing: ${missing.length} extra: ${extra.length} identical-to-en: ${sameAsEn.length}`);
  if (missing.length) console.log('MISSING:\n  ' + missing.join('\n  '));
  if (extra.length) console.log('EXTRA:\n  ' + extra.join('\n  '));
}
for (const l of locales) {
  const raw = fs.readFileSync(path.join(dir, `${l}.json`), 'utf8');
  const matches = [...raw.matchAll(/"([^"]+)"\s*:/g)].map((m) => m[1]);
  const seen = new Set();
  const dups = [];
  for (const k of matches) {
    if (seen.has(k)) dups.push(k);
    seen.add(k);
  }
  if (dups.length) console.log(`\nDUP keys in ${l}: ${[...new Set(dups)].join(', ')}`);
}
