import {
  calendarDayBottomLabel,
  dayCountsAsPracticedForCalendar,
  formatDurationMinutesOnly,
  practiceCalendarDayVisual,
  type PracticeCalendarVisual,
} from './practiceStats';
import {
  allDateKeysInMonth,
  buildYearHeatmapGrid,
  yearMonthKey,
  type YearHeatmapDisplayColor,
  yearHeatmapDisplayColor,
} from './yearHeatmapCalendar';
import { dateKeyFromTimestamp } from './storage';

export type MonthDetailCell =
  | { kind: 'pad' }
  | {
      kind: 'day';
      dateKey: string;
      dayOfMonth: number;
      display: YearHeatmapDisplayColor;
      seconds: number;
      timeLabel: string;
      isToday: boolean;
    };

export interface YearHeatmapPracticeData {
  dailySeconds: Record<string, number>;
  extensionInstalledDateKey: string;
  dailyGoalSec: number | null;
  monthlyGoalSec: number | null;
}

export interface MonthDetailGrid {
  year: number;
  monthIndex: number;
  label: string;
  startPad: number;
  daysInMonth: number;
  cells: MonthDetailCell[];
  monthTotalSec: number;
  /** True only when the full calendar month has ended and monthly goal was met. */
  isGoldenMonth: boolean;
  /** True when every eligible day in the month is practiced (green/gold). */
  isDiamondMonth: boolean;
  isMonthComplete: boolean;
}

/** Compact bottom label for month grid cells (aligned with stats chart / year heatmap). */
export function formatMonthCellTime(
  vis: PracticeCalendarVisual,
  sec: number,
  dateKey: string,
  todayKey: string,
  minutesOnly = false,
): string {
  if (minutesOnly && dayCountsAsPracticedForCalendar(sec)) {
    return formatDurationMinutesOnly(sec);
  }
  const label = calendarDayBottomLabel(vis, sec, dateKey, todayKey);
  return label === '—' ? '' : label;
}

/** Last local day of the month is strictly before today. */
export function isCalendarMonthComplete(
  year: number,
  monthIndex: number,
  todayKey: string,
): boolean {
  const last = new Date(year, monthIndex + 1, 0);
  const lastKey = dateKeyFromTimestamp(last.getTime());
  return lastKey < todayKey;
}

export function sumSecondsForMonth(
  dailySeconds: Record<string, number>,
  year: number,
  monthIndex: number,
): number {
  let total = 0;
  for (const key of allDateKeysInMonth(year, monthIndex)) {
    total += dailySeconds[key] ?? 0;
  }
  return total;
}

export function isGoldenMonth(
  year: number,
  monthIndex: number,
  dailySeconds: Record<string, number>,
  monthlyGoalSec: number | null,
  todayKey: string,
): boolean {
  if (monthlyGoalSec == null || monthlyGoalSec <= 0) return false;
  if (!isCalendarMonthComplete(year, monthIndex, todayKey)) return false;
  return sumSecondsForMonth(dailySeconds, year, monthIndex) >= monthlyGoalSec;
}

export function buildMonthDetailGrid(p: {
  year: number;
  monthIndex: number;
  dailySeconds: Record<string, number>;
  extensionInstalledDateKey: string;
  dailyGoalSec: number | null;
  monthlyGoalSec: number | null;
  locale?: string;
  nowMs?: number;
  /** YouTube panel: omit seconds in practiced-day cell labels. */
  minutesOnly?: boolean;
}): MonthDetailGrid {
  const nowMs = p.nowMs ?? Date.now();
  const todayKey = dateKeyFromTimestamp(nowMs);
  const first = new Date(p.year, p.monthIndex, 1);
  const daysInMonth = new Date(p.year, p.monthIndex + 1, 0).getDate();
  const startPad = first.getDay();
  const loc = p.locale && p.locale.length > 0 ? p.locale : undefined;
  const label = first.toLocaleDateString(loc, { month: 'long', year: 'numeric' });

  const monthTotalSec = sumSecondsForMonth(p.dailySeconds, p.year, p.monthIndex);
  const monthComplete = isCalendarMonthComplete(p.year, p.monthIndex, todayKey);
  const golden = isGoldenMonth(
    p.year,
    p.monthIndex,
    p.dailySeconds,
    p.monthlyGoalSec,
    todayKey,
  );
  const yearGrid = buildYearHeatmapGrid({
    year: p.year,
    dailySeconds: p.dailySeconds,
    extensionInstalledDateKey: p.extensionInstalledDateKey,
    dailyGoalSec: p.dailyGoalSec,
    nowMs,
  });
  const diamond = yearGrid.diamondMonthKeys.has(yearMonthKey(p.year, p.monthIndex));

  const cells: MonthDetailCell[] = [];
  for (let i = 0; i < startPad; i++) cells.push({ kind: 'pad' });
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(p.year, p.monthIndex, day);
    const dateKey = dateKeyFromTimestamp(d.getTime());
    const sec = p.dailySeconds[dateKey] ?? 0;
    const vis: PracticeCalendarVisual = practiceCalendarDayVisual(
      dateKey,
      sec,
      todayKey,
      p.extensionInstalledDateKey,
      p.dailySeconds,
      p.dailyGoalSec,
    );
    const isToday = dateKey === todayKey;
    cells.push({
      kind: 'day',
      dateKey,
      dayOfMonth: day,
      display: yearHeatmapDisplayColor(vis),
      seconds: sec,
      timeLabel: formatMonthCellTime(vis, sec, dateKey, todayKey, p.minutesOnly === true),
      isToday,
    });
  }

  return {
    year: p.year,
    monthIndex: p.monthIndex,
    label,
    startPad,
    daysInMonth,
    cells,
    monthTotalSec,
    isGoldenMonth: golden,
    isDiamondMonth: diamond,
    isMonthComplete: monthComplete,
  };
}
