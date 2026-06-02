import { describe, expect, it, vi } from 'vitest';
import {
  aggregatePracticeStats,
  calendarDayBottomLabel,
  chartDayTier,
  formatDuration,
  formatDurationMinutesOnly,
  lastNDaysBuckets,
  practiceCalendarDayVisual,
  practiceStreakDays,
  secondsByLevelBucket,
  secondsThisCalendarMonth,
} from './practiceStats';
import { SCHEMA_VERSION, defaultPlayerProgress, defaultSettings, type PersistedData } from './storage';

function mockData(over: Partial<PersistedData> = {}): PersistedData {
  const base: PersistedData = {
    schemaVersion: SCHEMA_VERSION,
    library: [],
    extensionInstalledDateKey: '2000-01-01',
    dailySeconds: {},
    videoSeconds: {},
    settings: defaultSettings(),
    playerProgress: defaultPlayerProgress(),
  };
  const { settings: sOverride, ...rest } = over;
  return {
    ...base,
    ...rest,
    settings: {
      ...base.settings,
      ...(typeof sOverride === 'object' && sOverride !== null ? sOverride : {}),
    },
  };
}

describe('secondsByLevelBucket', () => {
  it('groups legacy tags separately when JLPT active', () => {
    const data = mockData({
      library: [{ videoId: 'a', title: '', channel: '', addedAt: 1, difficulty: 'B2' }],
      videoSeconds: { a: 100 },
      settings: { levelFramework: 'jlpt' },
    });
    const rows = secondsByLevelBucket(data, 'jlpt');
    const legacy = rows.find((r) => r.label === 'Legacy');
    expect(legacy?.seconds).toBe(100);
  });

  it('uses custom level order when framework is custom', () => {
    const data = mockData({
      library: [
        { videoId: 'a', title: '', channel: '', addedAt: 1, difficulty: 'Easy' },
        { videoId: 'b', title: '', channel: '', addedAt: 2, difficulty: 'N1' },
      ],
      videoSeconds: { a: 10, b: 20 },
      settings: { levelFramework: 'custom', customLevels: ['Easy', 'Hard'] },
    });
    const rows = secondsByLevelBucket(data, 'custom', ['Easy', 'Hard']);
    expect(rows.find((r) => r.label === 'Easy')?.seconds).toBe(10);
    expect(rows.find((r) => r.label === 'Legacy')?.seconds).toBe(20);
  });
});

describe('formatDuration', () => {
  it('formats hours, minutes, seconds', () => {
    expect(formatDuration(45)).toBe('45s');
    expect(formatDuration(125)).toBe('2m 5s');
    expect(formatDuration(3725)).toBe('1h 2m');
  });
});

describe('formatDurationMinutesOnly', () => {
  it('floors to whole minutes without seconds', () => {
    expect(formatDurationMinutesOnly(45)).toBe('0m');
    expect(formatDurationMinutesOnly(125)).toBe('2m');
    expect(formatDurationMinutesOnly(3725)).toBe('1h 2m');
  });
});

describe('chartDayTier', () => {
  it('maps seconds and optional daily goal to bar colors (≥1 min counts as practice)', () => {
    expect(chartDayTier(0, 600)).toBe('none');
    expect(chartDayTier(59, 600)).toBe('none');
    expect(chartDayTier(60, 600)).toBe('active');
    expect(chartDayTier(600, 600)).toBe('goal');
    expect(chartDayTier(700, 600)).toBe('goal');
    expect(chartDayTier(60, null)).toBe('active');
    expect(chartDayTier(0, null)).toBe('none');
  });
});

describe('calendarDayBottomLabel', () => {
  const today = '2026-05-14';

  it('shows 0 on today and X on past missed days', () => {
    expect(calendarDayBottomLabel('none', 0, today, today)).toBe('0');
    expect(calendarDayBottomLabel('none', 0, '2026-05-13', today)).toBe('X');
    expect(calendarDayBottomLabel('none', 45, '2026-05-13', today)).toBe('X');
  });

  it('shows duration when at least one minute practiced', () => {
    expect(calendarDayBottomLabel('active', 77, today, today)).toBe('1m 17s');
  });
});

describe('practiceCalendarDayVisual', () => {
  const install = '2026-05-01';
  const daily = { '2026-05-06': 60, '2026-05-10': 120 };

  it('treats sub-minute totals in miss window as missed (none)', () => {
    expect(practiceCalendarDayVisual('2026-05-11', 45, '2026-05-14', install, daily, null)).toBe('none');
  });

  it('treats zeros before miss window as neutral', () => {
    expect(practiceCalendarDayVisual('2026-05-03', 0, '2026-05-14', install, daily, null)).toBe('neutral');
  });

  it('treats zeros in miss window as none (missed)', () => {
    expect(practiceCalendarDayVisual('2026-05-11', 0, '2026-05-14', install, daily, null)).toBe('none');
  });

  it('marks goal when daily target met inside window', () => {
    expect(practiceCalendarDayVisual('2026-05-10', 120, '2026-05-14', install, daily, 120)).toBe('goal');
  });
});

describe('practiceStreakDays', () => {
  const may14noon = new Date(2026, 4, 14, 12, 0, 0).getTime();
  const missMay12 = '2026-05-12';

  it('counts consecutive local days with practice ending on the given day', () => {
    expect(
      practiceStreakDays(
        {
          '2026-05-14': 60,
          '2026-05-13': 120,
          '2026-05-12': 60,
        },
        may14noon,
        missMay12,
      ),
    ).toBe(3);
  });

  it('does not break streak on in-progress today with no minutes yet (counts from yesterday)', () => {
    expect(
      practiceStreakDays(
        {
          '2026-05-13': 3600,
        },
        may14noon,
        '2026-05-13',
      ),
    ).toBe(1);
  });

  it('returns zero when the last completed day had no practice', () => {
    expect(
      practiceStreakDays(
        {
          '2026-05-12': 3600,
        },
        may14noon,
        '2026-05-12',
      ),
    ).toBe(0);
  });

  it('stops at the first gap', () => {
    expect(
      practiceStreakDays(
        {
          '2026-05-14': 120,
          '2026-05-12': 60,
        },
        may14noon,
        missMay12,
      ),
    ).toBe(1);
  });

  it('returns zero when miss window has not started (no streak yet)', () => {
    expect(practiceStreakDays({ '2026-05-14': 60 }, may14noon, null)).toBe(0);
  });

  it('does not count a day with under 1 minute toward streak', () => {
    expect(
      practiceStreakDays(
        {
          '2026-05-14': 60,
          '2026-05-13': 45,
          '2026-05-12': 60,
        },
        may14noon,
        missMay12,
      ),
    ).toBe(1);
  });
});

describe('lastNDaysBuckets', () => {
  it('returns n local calendar days oldest-first ending today', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 14, 12, 0, 0, 0));

    const data = mockData({ dailySeconds: { '2026-05-14': 10, '2026-05-08': 5 } });
    const buckets = lastNDaysBuckets(data, 7);
    expect(buckets).toHaveLength(7);
    expect(buckets[0].dateKey).toBe('2026-05-08');
    expect(buckets[0].seconds).toBe(5);
    expect(buckets[6].dateKey).toBe('2026-05-14');
    expect(buckets[6].seconds).toBe(10);

    vi.useRealTimers();
  });

  it('uses locale for weekday labels (stats chart)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 14, 12, 0, 0, 0));

    const data = mockData({});
    const en = lastNDaysBuckets(data, 7, 'en-US').at(-1)!.weekdayShort;
    const fr = lastNDaysBuckets(data, 7, 'fr').at(-1)!.weekdayShort;
    expect(en).not.toEqual(fr);

    vi.useRealTimers();
  });
});

describe('aggregatePracticeStats', () => {
  it('uses local today key and rolling week', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 14, 12, 0, 0, 0));

    const data = mockData({
      dailySeconds: {
        '2026-05-14': 100,
        '2026-05-13': 50,
        '2026-05-11': 10,
        '2026-05-10': 999,
      },
    });
    const { today, week, all } = aggregatePracticeStats(data);
    expect(today).toBe(100);
    expect(week).toBe(100 + 50 + 10);
    expect(all).toBe(100 + 50 + 10 + 999);

    vi.useRealTimers();
  });
});

describe('secondsThisCalendarMonth', () => {
  it('sums from first of month through today', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 14, 8, 0, 0, 0));

    const data = mockData({
      dailySeconds: {
        '2026-04-30': 1000,
        '2026-05-01': 10,
        '2026-05-14': 20,
      },
    });
    expect(secondsThisCalendarMonth(data)).toBe(10 + 20);

    vi.useRealTimers();
  });
});
