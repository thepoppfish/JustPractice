import { describe, expect, it } from 'vitest';
import {
  SCHEMA_VERSION,
  dateKeyFromTimestamp,
  daysInCalendarMonth,
  emptyPersisted,
  ensureSettingsShape,
  firstPositiveDailyDateKey,
  inferExtensionInstalledDateKey,
  missTrackingStartDateKey,
  normalizeCustomLevels,
  normalizeImportedPersisted,
  secondsInRange,
  startOfWeekMonday,
} from './storage';

describe('extension install / miss window keys', () => {
  it('firstPositiveDailyDateKey picks earliest day with ≥1 min logged', () => {
    expect(firstPositiveDailyDateKey({ '2026-05-10': 60, '2026-05-06': 120 })).toBe('2026-05-06');
    expect(firstPositiveDailyDateKey({ '2026-05-06': 59 })).toBeNull();
    expect(firstPositiveDailyDateKey({})).toBeNull();
  });

  it('missTrackingStartDateKey is max(install, first practice)', () => {
    expect(missTrackingStartDateKey('2026-05-15', { '2026-05-06': 60 })).toBe('2026-05-15');
    expect(missTrackingStartDateKey('2026-05-01', { '2026-05-06': 120 })).toBe('2026-05-06');
    expect(missTrackingStartDateKey('2026-05-01', {})).toBeNull();
  });

  it('inferExtensionInstalledDateKey prefers persisted value when valid', () => {
    expect(
      inferExtensionInstalledDateKey({
        library: [],
        dailySeconds: {},
        extensionInstalledDateKey: '2025-06-01',
      }),
    ).toBe('2025-06-01');
  });
});

describe('storage date helpers', () => {
  it('daysInCalendarMonth matches calendar length (local tz)', () => {
    expect(daysInCalendarMonth(new Date(2026, 0, 15).getTime())).toBe(31); // January
    expect(daysInCalendarMonth(new Date(2026, 1, 10).getTime())).toBe(28); // February 2026
    expect(daysInCalendarMonth(new Date(2024, 1, 10).getTime())).toBe(29); // leap Feb
    expect(daysInCalendarMonth(new Date(2026, 3, 1).getTime())).toBe(30); // April
  });

  it('secondsInRange sums whole local days between bounds', () => {
    const daily = {
      '2026-05-11': 60,
      '2026-05-12': 120,
      '2026-05-13': 30,
      '2026-05-14': 10,
    };
    const day12 = new Date(2026, 4, 12, 12, 0, 0, 0).getTime(); // noon local May 12
    const day13End = new Date(2026, 4, 13, 23, 59, 59, 999).getTime();
    expect(secondsInRange(daily, day12, day13End)).toBe(120 + 30);
  });

  it('startOfWeekMonday aligns with Monday-boundary week aggregation', () => {
    /* Thursday 2026-05-14 */
    const thu = new Date(2026, 4, 14, 15, 0, 0, 0).getTime();
    const monStart = startOfWeekMonday(thu);
    expect(dateKeyFromTimestamp(monStart)).toBe('2026-05-11');
  });
});

describe('normalizeImportedPersisted', () => {
  it('returns empty persisted for junk input', () => {
    const e = emptyPersisted();
    expect(normalizeImportedPersisted(null)).toEqual(e);
    expect(normalizeImportedPersisted([])).toEqual(e);
  });

  it('normalizes minimal backup blob', () => {
    const out = normalizeImportedPersisted({
      schemaVersion: 1,
      library: [
        { videoId: 'abcdefghijk', title: '', channel: '', addedAt: 0, difficulty: 'N999' },
      ],
      dailySeconds: { '2026-05-01': 90 },
      videoSeconds: {},
      settings: {},
    });
    expect(out.library[0].videoId).toBe('abcdefghijk');
    expect(out.library[0].difficulty).toBeNull();
    expect(out.dailySeconds['2026-05-01']).toBe(90);
    expect(out.schemaVersion).toBe(SCHEMA_VERSION);
    expect(out.settings.levelFramework).toBe('jlpt');
    expect(out.settings.uiLocale).toBe('auto');
    expect(out.extensionInstalledDateKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('preserves JLPT and CEFR difficulty codes', () => {
    const out = normalizeImportedPersisted({
      schemaVersion: 2,
      library: [
        { videoId: 'a', title: '', channel: '', addedAt: 1, difficulty: 'N3' },
        { videoId: 'b', title: '', channel: '', addedAt: 2, difficulty: 'B2' },
      ],
      dailySeconds: {},
      videoSeconds: {},
      settings: {},
    });
    expect(out.library[0].difficulty).toBe('N3');
    expect(out.library[1].difficulty).toBe('B2');
  });

  it('respects persisted level framework when valid', () => {
    const out = normalizeImportedPersisted({
      schemaVersion: 3,
      library: [],
      dailySeconds: {},
      videoSeconds: {},
      settings: { levelFramework: 'cefr', uiLocale: 'fr' },
    });
    expect(out.settings.levelFramework).toBe('cefr');
    expect(out.settings.uiLocale).toBe('fr');
  });

  it('preserves sanitized custom difficulty strings', () => {
    const out = normalizeImportedPersisted({
      schemaVersion: 4,
      library: [{ videoId: 'z', title: '', channel: '', addedAt: 1, difficulty: 'HSK 3' }],
      dailySeconds: {},
      videoSeconds: {},
      settings: {},
    });
    expect(out.library[0].difficulty).toBe('HSK 3');
  });
});

describe('normalizeCustomLevels', () => {
  it('dedupes, trims, and caps count', () => {
    expect(normalizeCustomLevels(['  A ', 'A', 'B', 'C'])).toEqual(['A', 'B', 'C']);
  });

  it('falls back to defaults when empty after filtering', () => {
    expect(normalizeCustomLevels(['   ', '!!!'])[0]).toBe('Beginner');
  });
});

describe('ensureSettingsShape', () => {
  it('preserves customLevels when omitted in partial update', () => {
    const base = ensureSettingsShape({ customLevels: ['Easy', 'Hard'] });
    const next = ensureSettingsShape({ ...base, pauseWhenUnfocused: false });
    expect(next.customLevels).toEqual(['Easy', 'Hard']);
    expect(next.pauseWhenUnfocused).toBe(false);
  });

  it('accepts custom framework', () => {
    expect(ensureSettingsShape({ levelFramework: 'custom' }).levelFramework).toBe('custom');
  });

  it('defaults jlpt/auto and clamps bad settings values', () => {
    expect(ensureSettingsShape({}).levelFramework).toBe('jlpt');
    expect(ensureSettingsShape({}).uiLocale).toBe('auto');
    expect(ensureSettingsShape({ levelFramework: 'invalid' as never, uiLocale: 'xx' as never }).levelFramework).toBe(
      'jlpt',
    );
    expect(ensureSettingsShape({ levelFramework: 'invalid' as never, uiLocale: 'xx' as never }).uiLocale).toBe('auto');
  });
});
