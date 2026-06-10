import fs from 'fs';
import path from 'path';

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (/\.tsx?$/.test(ent.name) && !/\.test\.ts$/.test(ent.name)) acc.push(p);
  }
  return acc;
}

const dir = 'src/i18n/locales';
const locales = ['en', 'de', 'es', 'fr', 'he', 'ja'];
const data = {};
for (const l of locales) {
  data[l] = JSON.parse(fs.readFileSync(path.join(dir, `${l}.json`), 'utf8'));
}
const enKeys = Object.keys(data.en).sort();

for (const l of ['de', 'es', 'fr', 'he', 'ja']) {
  const same = enKeys.filter((k) => data[l][k] === data.en[k]);
  fs.writeFileSync(`scripts/audit-same-${l}.txt`, same.join('\n'));
  console.log(`${l}: ${same.length} identical to EN -> scripts/audit-same-${l}.txt`);
}

const srcFiles = walk('src');
const usedKeys = new Set();
const keyRe = /t\(\s*['"]([a-zA-Z0-9_.]+)['"]/g;
for (const file of srcFiles) {
  const text = fs.readFileSync(file, 'utf8');
  let m;
  while ((m = keyRe.exec(text))) usedKeys.add(m[1]);
}
const missingInEn = [...usedKeys].filter((k) => !(k in data.en)).sort();
console.log(`Used keys: ${usedKeys.size}, missing from en: ${missingInEn.length}`);
if (missingInEn.length) console.log(missingInEn.join('\n'));
