import { describe, expect, it } from 'vitest';
import de from './locales/de.json';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import he from './locales/he.json';
import ja from './locales/ja.json';

const locales = { de, es, fr, he, ja } as const;
const enKeys = Object.keys(en).sort();

const MUST_TRANSLATE_PREFIXES = [
  'settings.profile',
  'settings.display',
  'settings.dailyMotivation',
  'settings.customDaily',
  'settings.language',
  'motivation.',
  'dash.hello',
  'dash.welcome',
  'welcome.',
];
const MUST_TRANSLATE_KEYS = [
  'path.subtitle',
  'path.noGoal',
  'path.bonus.stackHint',
  'panel.dailyGoalNoTarget',
];

describe('locale parity with en.json', () => {
  for (const [code, table] of Object.entries(locales)) {
    it(`${code} has every key and non-empty strings`, () => {
      const keys = Object.keys(table).sort();
      expect(keys).toEqual(enKeys);
      for (const key of enKeys) {
        const value = table[key as keyof typeof table];
        expect(typeof value).toBe('string');
        expect(value.trim().length).toBeGreaterThan(0);
      }
    });

    it(`${code} translates profile, language picker, and daily motivation strings`, () => {
      const mustTranslate = [
        ...enKeys.filter((k) => MUST_TRANSLATE_PREFIXES.some((p) => k.startsWith(p))),
        ...MUST_TRANSLATE_KEYS,
      ];
      for (const key of mustTranslate) {
        expect(table[key as keyof typeof table]).not.toBe(en[key as keyof typeof en]);
      }
    });
  }
});
