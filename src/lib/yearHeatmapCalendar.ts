import {
  practiceCalendarDayVisual,
  type PracticeCalendarVisual,
} from './practiceStats';
import { dateKeyFromTimestamp } from './storage';

/** Colored cells only: red / green / gold. Blank = no fill (padding, future, or before tracking). */
export type YearHeatmapDisplayColor = 'none' | 'active' | 'goal' | 'blank';

export type YearHeatmapSlot =
  | { kind: 'padding' }
  | { kind: 'day'; dateKey: string; display: YearHeatmapDisplayColor; isToday: boolean; seconds: number };

export interface YearHeatmapGrid {
  year: number;
  weekCount: number;
  /** [weekday 0=Sun … 6=Sat][weekColumn] */
  slots: YearHeatmapSlot[][];
}

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseDateKey(dateKey: string): { year: number; month: number; day: number } | null {
  const m = YMD.exec(dateKey);
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

/** `YYYY-MM` for grouping days in the year heatmap. */
export function yearMonthKey(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}

export function dateKeyToYearMonth(dateKey: string): string {
  const p = parseDateKey(dateKey);
  if (!p) return dateKey.slice(0, 7);
  return yearMonthKey(p.year, p.month - 1);
}

/** Every `yyyy-mm-dd` in a local calendar month (monthIndex 0–11). */
export function allDateKeysInMonth(year: number, monthIndex: number): string[] {
  const last = new Date(year, monthIndex + 1, 0).getDate();
  const out: string[] = [];
  for (let d = 1; d <= last; d++) {
    out.push(`${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  return out;
}

export function yearHeatmapDisplayColor(vis: PracticeCalendarVisual): YearHeatmapDisplayColor {
  if (vis === 'none') return 'none';
  if (vis === 'active') return 'active';
  if (vis === 'goal') return 'goal';
  return 'blank';
}

export function daysInYear(year: number): number {
  return (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 366 : 365;
}

/** Count real calendar days placed in the grid (excludes padding). */
export function countYearHeatmapDays(grid: YearHeatmapGrid): number {
  let n = 0;
  for (const row of grid.slots) {
    for (const slot of row) {
      if (slot.kind === 'day') n++;
    }
  }
  return n;
}

/** Drop trailing week columns that are entirely padding. */
export function trimTrailingPaddingWeeks(grid: YearHeatmapGrid): YearHeatmapGrid {
  let weeks = grid.weekCount;
  while (weeks > 0) {
    let allPad = true;
    for (let r = 0; r < 7; r++) {
      if (grid.slots[r]![weeks - 1]?.kind !== 'padding') {
        allPad = false;
        break;
      }
    }
    if (!allPad) break;
    weeks--;
  }
  if (weeks === grid.weekCount) return grid;
  const slots = grid.slots.map((row) => row.slice(0, weeks));
  return { year: grid.year, weekCount: weeks, slots };
}

export function buildYearHeatmapGrid(p: {
  year: number;
  dailySeconds: Record<string, number>;
  extensionInstalledDateKey: string;
  dailyGoalSec: number | null;
  nowMs?: number;
}): YearHeatmapGrid {
  const nowMs = p.nowMs ?? Date.now();
  const todayKey = dateKeyFromTimestamp(nowMs);
  const jan1 = new Date(p.year, 0, 1);
  const startDow = jan1.getDay();
  const weekCount = Math.ceil((startDow + daysInYear(p.year)) / 7);

  const slots: YearHeatmapSlot[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: weekCount }, () => ({ kind: 'padding' as const })),
  );

  const totalDays = daysInYear(p.year);
  for (let dayNum = 1; dayNum <= totalDays; dayNum++) {
    const cursor = new Date(p.year, 0, dayNum);
    const dow = cursor.getDay();
    const dayOfYear = dayNum - 1;
    const weekCol = Math.floor((dayOfYear + startDow) / 7);
    const dateKey = dateKeyFromTimestamp(cursor.getTime());
    const sec = p.dailySeconds[dateKey] ?? 0;
    const vis = practiceCalendarDayVisual(
      dateKey,
      sec,
      todayKey,
      p.extensionInstalledDateKey,
      p.dailySeconds,
      p.dailyGoalSec,
    );
    slots[dow]![weekCol] = {
      kind: 'day',
      dateKey,
      display: yearHeatmapDisplayColor(vis),
      isToday: dateKey === todayKey,
      seconds: sec,
    };
  }

  return trimTrailingPaddingWeeks({ year: p.year, weekCount, slots });
}

export interface YearHeatmapMonthLabel {
  /** Week column of that month’s 1st (same layout as day cells). */
  weekCol: number;
  label: string;
}

/** One label per month, aligned above the week column of the 1st of that month. */
export function yearHeatmapMonthLabels(
  grid: YearHeatmapGrid,
  locale?: string,
): YearHeatmapMonthLabel[] {
  const jan1 = new Date(grid.year, 0, 1);
  const startDow = jan1.getDay();
  const loc = locale && locale.length > 0 ? locale : undefined;
  const out: YearHeatmapMonthLabel[] = [];
  for (let month = 0; month < 12; month++) {
    const first = new Date(grid.year, month, 1);
    const dayOfYear = Math.floor((first.getTime() - jan1.getTime()) / 86_400_000);
    const weekCol = Math.floor((dayOfYear + startDow) / 7);
    const label = first.toLocaleDateString(loc, { month: 'short' });
    out.push({ weekCol, label });
  }
  return out;
}

/** Column-major cell order (each week column: Sun → Sat). */
export function yearHeatmapSlotsColumnMajor(grid: YearHeatmapGrid): YearHeatmapSlot[] {
  const out: YearHeatmapSlot[] = [];
  for (let c = 0; c < grid.weekCount; c++) {
    for (let r = 0; r < 7; r++) {
      out.push(grid.slots[r]![c]!);
    }
  }
  return out;
}
