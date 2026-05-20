/**
 * Print per-locale translation audit (keys still in English, settings/motivation gaps).
 * Run: node scripts/audit-i18n.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const localesDir = path.join(root, 'src/i18n/locales');
const en = JSON.parse(fs.readFileSync(path.join(localesDir, 'en.json'), 'utf8'));
const enKeys = Object.keys(en);

const ALLOW_SAME_AS_EN = new Set([
  'app.nameShort',
  'framework.jlpt',
  'framework.cefr',
  'framework.jlptLevels',
  'framework.cefrLevels',
  'yearHeatmap.statusBlank',
  'nav.groupApp',
  'achievement.prestige_1.title',
  'achievement.prestige_5.title',
  'achievement.prestige_10.title',
  'achievement.level_20.title',
]);

const FOCUS_PREFIXES = [
  'settings.profile',
  'settings.display',
  'settings.dailyMotivation',
  'settings.customDaily',
  'settings.language',
  'motivation.',
  'dash.hello',
  'dash.welcome',
  'dash.levelAndLanguage',
];

for (const loc of ['de', 'es', 'fr', 'he', 'ja']) {
  const table = JSON.parse(fs.readFileSync(path.join(localesDir, `${loc}.json`), 'utf8'));
  const missing = enKeys.filter((k) => !table[k]?.trim());
  const sameAsEn = enKeys.filter((k) => table[k] === en[k] && !ALLOW_SAME_AS_EN.has(k));
  const focusSame = sameAsEn.filter((k) => FOCUS_PREFIXES.some((p) => k.startsWith(p) || k === p));

  console.log(`\n========== ${loc.toUpperCase()} ==========`);
  console.log(`Keys: ${Object.keys(table).length} / ${enKeys.length}`);
  console.log(`Missing: ${missing.length}`);
  console.log(`Same as English (total): ${sameAsEn.length}`);
  console.log(`Same as English (profile/motivation/language): ${focusSame.length}`);
  if (focusSame.length) focusSame.forEach((k) => console.log(`  - ${k}`));
  if (missing.length) missing.forEach((k) => console.log(`  MISSING ${k}`));
}
