import { describe, expect, it } from 'vitest';
import {
  SCHEMA_VERSION,
  completedLibraryItems,
  inProgressLibraryItems,
  dateKeyFromTimestamp,
  daysInCalendarMonth,
  defaultPlayerProgress,
  emptyPersisted,
  ensureSettingsShape,
  firstPositiveDailyDateKey,
  inferExtensionInstalledDateKey,
  isLibraryItemCompleted,
  missTrackingStartDateKey,
  normalizeCustomLevels,
  normalizeImportedPersisted,
  persistedNeedsCompactionRewrite,
  secondsInRange,
  startOfWeekMonday,
  type LibraryItem,
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

  it('defaults completedAt to null when missing', () => {
    const out = normalizeImportedPersisted({
      schemaVersion: 6,
      library: [{ videoId: 'a', title: 'T', channel: 'C', addedAt: 1, difficulty: null }],
      dailySeconds: {},
      videoSeconds: {},
      settings: {},
    });
    expect(out.library[0].completedAt).toBeNull();
    expect(out.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('migrates v7 to v8 with playerProgress backfill capped at 50k', () => {
    const out = normalizeImportedPersisted({
      schemaVersion: 7,
      library: [],
      dailySeconds: { '2020-01-01': 60 * 60 * 60_000 },
      videoSeconds: {},
      settings: {},
    });
    expect(out.schemaVersion).toBe(SCHEMA_VERSION);
    expect(out.playerProgress.totalXp).toBe(50_000);
    expect(out.playerProgress.completeXpAwarded).toEqual({});
  });

  it('migrates v7 with moderate practice to proportional backfill', () => {
    const out = normalizeImportedPersisted({
      schemaVersion: 7,
      library: [],
      dailySeconds: { '2026-05-01': 7200 },
      videoSeconds: {},
      settings: {},
    });
    expect(out.playerProgress.totalXp).toBe(120);
  });

  it('preserves v8 playerProgress and converts legacy completeXpAwardedVideoIds', () => {
    const out = normalizeImportedPersisted({
      schemaVersion: 8,
      library: [],
      dailySeconds: {},
      videoSeconds: {},
      settings: {},
      playerProgress: {
        totalXp: 42,
        achievements: { library_1: 1 },
        lastDailyGoalXpDateKey: '2026-05-01',
        lastStreakXpDateKey: null,
        completeXpAwardedVideoIds: ['abc'],
      },
    });
    expect(out.playerProgress.totalXp).toBe(42);
    expect(out.playerProgress.lifetimeXp).toBe(42);
    expect(out.playerProgress.prestigeLevel).toBe(0);
    expect(out.playerProgress.completeXpAwarded.abc).toBe(true);
    expect(out.playerProgress.achievements.library_1).toBe(1);
    expect(out.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('preserves v9 prestige fields', () => {
    const out = normalizeImportedPersisted({
      schemaVersion: 9,
      library: [],
      dailySeconds: {},
      videoSeconds: {},
      settings: {},
      playerProgress: {
        totalXp: 100,
        lifetimeXp: 9000,
        prestigeLevel: 3,
        achievements: {},
        lastDailyGoalXpDateKey: null,
        lastStreakXpDateKey: null,
        completeXpAwarded: {},
      },
    });
    expect(out.playerProgress.totalXp).toBe(100);
    expect(out.playerProgress.lifetimeXp).toBe(9000);
    expect(out.playerProgress.prestigeLevel).toBe(3);
  });

  it('v9 playerProgress without lifetimeXp defaults lifetimeXp to totalXp', () => {
    const out = normalizeImportedPersisted({
      schemaVersion: 9,
      library: [],
      dailySeconds: {},
      videoSeconds: {},
      settings: {},
      playerProgress: {
        totalXp: 31,
        prestigeLevel: 0,
        achievements: {},
        lastDailyGoalXpDateKey: null,
        lastStreakXpDateKey: null,
        completeXpAwarded: {},
      },
    });
    expect(out.playerProgress.totalXp).toBe(31);
    expect(out.playerProgress.lifetimeXp).toBe(31);
  });

  it('preserves completedAt on v7 library items', () => {
    const ts = 1_700_000_000_000;
    const out = normalizeImportedPersisted({
      schemaVersion: 7,
      library: [
        { videoId: 'a', title: 'T', channel: 'C', addedAt: 1, difficulty: null, completedAt: ts },
      ],
      dailySeconds: {},
      videoSeconds: {},
      settings: {},
    });
    expect(out.library[0].completedAt).toBe(ts);
    expect(out.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('rejects invalid completedAt values', () => {
    const out = normalizeImportedPersisted({
      schemaVersion: 7,
      library: [
        { videoId: 'a', title: 'T', channel: 'C', addedAt: 1, difficulty: null, completedAt: 'bad' },
        { videoId: 'b', title: 'T', channel: 'C', addedAt: 1, difficulty: null, completedAt: -1 },
      ],
      dailySeconds: {},
      videoSeconds: {},
      settings: {},
    });
    expect(out.library[0].completedAt).toBeNull();
    expect(out.library[1].completedAt).toBeNull();
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

describe('library completion helpers', () => {
  const item = (completedAt: number | null): LibraryItem => ({
    videoId: 'x',
    title: 'T',
    channel: 'C',
    addedAt: 1,
    difficulty: null,
    completedAt,
  });

  it('isLibraryItemCompleted is true only when completedAt is set', () => {
    expect(isLibraryItemCompleted(item(100))).toBe(true);
    expect(isLibraryItemCompleted(item(null))).toBe(false);
  });

  it('completedLibraryItems filters completed rows', () => {
    const rows = [item(null), item(200), item(300)];
    expect(completedLibraryItems(rows).map((x) => x.completedAt)).toEqual([200, 300]);
  });

  it('inProgressLibraryItems excludes completed rows', () => {
    const rows = [item(null), item(200), item(null), item(300)];
    expect(inProgressLibraryItems(rows)).toHaveLength(2);
    expect(inProgressLibraryItems(rows).every((x) => x.completedAt === null)).toBe(true);
  });
});

describe('persistedNeedsCompactionRewrite', () => {
  it('includes playerProgress in v8 compaction keys', () => {
    const blob = {
      schemaVersion: SCHEMA_VERSION,
      library: [],
      extensionInstalledDateKey: '2026-05-01',
      dailySeconds: {},
      videoSeconds: {},
      settings: {},
      playerProgress: defaultPlayerProgress(),
    };
    expect(persistedNeedsCompactionRewrite(blob)).toBe(false);
  });

  it('does not rewrite v7 data solely because library items have completedAt', () => {
    const blob = {
      schemaVersion: SCHEMA_VERSION,
      library: [
        {
          videoId: 'a',
          title: 'T',
          channel: 'C',
          addedAt: 1,
          difficulty: null,
          completedAt: 1_700_000_000_000,
        },
      ],
      extensionInstalledDateKey: '2026-05-01',
      dailySeconds: {},
      videoSeconds: {},
      settings: {},
      playerProgress: defaultPlayerProgress(),
    };
    expect(persistedNeedsCompactionRewrite(blob)).toBe(false);
  });

  it('still rewrites when schema version differs', () => {
    expect(
      persistedNeedsCompactionRewrite({
        schemaVersion: 6,
        library: [],
        extensionInstalledDateKey: '2026-05-01',
        dailySeconds: {},
        videoSeconds: {},
        settings: {},
      }),
    ).toBe(true);
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
