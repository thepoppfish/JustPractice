import { describe, expect, it } from 'vitest';
import {
  allDateKeysInMonth,
  buildYearHeatmapGrid,
  dateKeyToYearMonth,
  yearHeatmapDisplayColor,
  yearHeatmapMonthLabels,
  yearHeatmapSlotsColumnMajor,
} from './yearHeatmapCalendar';

describe('dateKeyToYearMonth', () => {
  it('groups keys by YYYY-MM', () => {
    expect(dateKeyToYearMonth('2025-03-15')).toBe('2025-03');
    expect(allDateKeysInMonth(2025, 2)).toHaveLength(31);
  });
});

describe('yearHeatmapDisplayColor', () => {
  it('maps practice visuals to red, green, or gold only', () => {
    expect(yearHeatmapDisplayColor('none')).toBe('none');
    expect(yearHeatmapDisplayColor('active')).toBe('active');
    expect(yearHeatmapDisplayColor('goal')).toBe('goal');
    expect(yearHeatmapDisplayColor('neutral')).toBe('blank');
    expect(yearHeatmapDisplayColor('future')).toBe('blank');
  });
});

describe('buildYearHeatmapGrid', () => {
  it('places Jan 1 2025 on Wednesday (row 3, col 0)', () => {
    const grid = buildYearHeatmapGrid({
      year: 2025,
      dailySeconds: {},
      extensionInstalledDateKey: '2025-01-01',
      dailyGoalSec: null,
      nowMs: Date.parse('2025-06-15T12:00:00'),
    });
    expect(grid.weekCount).toBeGreaterThanOrEqual(52);
    const jan1 = grid.slots[3]![0];
    expect(jan1?.kind).toBe('day');
    if (jan1?.kind === 'day') expect(jan1.dateKey).toBe('2025-01-01');
    expect(grid.slots[0]![0]?.kind).toBe('padding');
  });

  it('column-major order has 7 * weekCount entries', () => {
    const grid = buildYearHeatmapGrid({
      year: 2024,
      dailySeconds: { '2024-02-01': 120 },
      extensionInstalledDateKey: '2024-01-01',
      dailyGoalSec: 60,
      nowMs: Date.parse('2024-12-31T12:00:00'),
    });
    const flat = yearHeatmapSlotsColumnMajor(grid);
    expect(flat.length).toBe(7 * grid.weekCount);
    const practiced = flat.find((s) => s.kind === 'day' && s.dateKey === '2024-02-01');
    expect(practiced && practiced.kind === 'day' ? practiced.display : null).toBe('goal');
    if (practiced?.kind === 'day') expect(practiced.seconds).toBe(120);
  });
});

describe('yearHeatmapMonthLabels', () => {
  it('places each label on the week column of that month’s 1st', () => {
    const grid = buildYearHeatmapGrid({
      year: 2026,
      dailySeconds: {},
      extensionInstalledDateKey: '2026-01-01',
      dailyGoalSec: null,
      nowMs: Date.parse('2026-05-19T12:00:00'),
    });
    const labels = yearHeatmapMonthLabels(grid, 'en-US');
    expect(labels).toHaveLength(12);
    expect(labels[0]!.weekCol).toBe(0);
    expect(labels[0]!.label).toMatch(/jan/i);
    const dec1 = new Date(2026, 11, 1);
    const jan1 = new Date(2026, 0, 1);
    const startDow = jan1.getDay();
    const decWeekCol = Math.floor(
      (Math.floor((dec1.getTime() - jan1.getTime()) / 86_400_000) + startDow) / 7,
    );
    expect(labels[11]!.weekCol).toBe(decWeekCol);
  });
});
