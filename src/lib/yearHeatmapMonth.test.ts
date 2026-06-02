import { describe, expect, it } from 'vitest';
import {
  buildMonthDetailGrid,
  formatMonthCellTime,
  isGoldenMonth,
  sumSecondsForMonth,
} from './yearHeatmapMonth';
import { allDateKeysInMonth, countYearHeatmapDays, daysInYear, buildYearHeatmapGrid } from './yearHeatmapCalendar';

describe('yearHeatmap calendar helpers', () => {
  it('allDateKeysInMonth returns correct count for February leap year', () => {
    expect(allDateKeysInMonth(2024, 1)).toHaveLength(29);
  });

  it('buildYearHeatmapGrid has exactly 365 or 366 day cells', () => {
    const g2025 = buildYearHeatmapGrid({
      year: 2025,
      dailySeconds: {},
      extensionInstalledDateKey: '2025-01-01',
      dailyGoalSec: null,
      nowMs: Date.parse('2025-12-31T12:00:00'),
    });
    expect(countYearHeatmapDays(g2025)).toBe(daysInYear(2025));

    const g2024 = buildYearHeatmapGrid({
      year: 2024,
      dailySeconds: {},
      extensionInstalledDateKey: '2024-01-01',
      dailyGoalSec: null,
      nowMs: Date.parse('2024-12-31T12:00:00'),
    });
    expect(countYearHeatmapDays(g2024)).toBe(366);
  });
});

describe('isGoldenMonth', () => {
  it('is false while the month is still in progress', () => {
    expect(
      isGoldenMonth(2025, 5, { '2025-06-15': 99999 }, 1000, '2025-06-20'),
    ).toBe(false);
  });

  it('is true only after the month ends and total meets goal', () => {
    const daily: Record<string, number> = {};
    for (const k of allDateKeysInMonth(2025, 0)) daily[k] = 120;
    expect(isGoldenMonth(2025, 0, daily, 3000, '2025-02-01')).toBe(true);
    expect(isGoldenMonth(2025, 0, daily, 50000, '2025-02-01')).toBe(false);
  });
});

describe('formatMonthCellTime', () => {
  const today = '2026-05-14';

  it('uses 0 only for today when under a full minute; X on past missed days', () => {
    expect(formatMonthCellTime('none', 45, '2026-05-13', today)).toBe('X');
    expect(formatMonthCellTime('none', 0, '2026-05-13', today)).toBe('X');
    expect(formatMonthCellTime('none', 45, today, today)).toBe('0');
    expect(formatMonthCellTime('none', 0, today, today)).toBe('0');
    expect(formatMonthCellTime('active', 125, '2026-05-13', today)).toBe('2m 5s');
    expect(formatMonthCellTime('active', 125, '2026-05-13', today, true)).toBe('2m');
  });
});

describe('buildMonthDetailGrid', () => {
  it('includes time labels on every day cell', () => {
    const grid = buildMonthDetailGrid({
      year: 2025,
      monthIndex: 0,
      dailySeconds: { '2025-01-15': 125 },
      extensionInstalledDateKey: '2025-01-01',
      dailyGoalSec: 60,
      monthlyGoalSec: null,
      nowMs: Date.parse('2025-06-01T12:00:00'),
    });
    const day = grid.cells.find((c) => c.kind === 'day' && c.dateKey === '2025-01-15');
    expect(day?.kind).toBe('day');
    if (day?.kind === 'day') {
      expect(day.timeLabel).toBe(formatMonthCellTime('active', 125, '2025-01-15', '2025-06-01'));
    }
  });

  it('marks golden month when complete and goal met', () => {
    const daily: Record<string, number> = {};
    for (const k of allDateKeysInMonth(2024, 11)) daily[k] = 600;
    const grid = buildMonthDetailGrid({
      year: 2024,
      monthIndex: 11,
      dailySeconds: daily,
      extensionInstalledDateKey: '2024-01-01',
      dailyGoalSec: 60,
      monthlyGoalSec: 10000,
      nowMs: Date.parse('2025-01-10T12:00:00'),
    });
    expect(grid.isMonthComplete).toBe(true);
    expect(grid.isGoldenMonth).toBe(true);
    expect(sumSecondsForMonth(daily, 2024, 11)).toBeGreaterThanOrEqual(10000);
  });
});
