import { isCefrTag, isJlptTag } from './levelTags';
import type { LibraryItem, LevelFramework, LevelTag, PersistedData } from './storage';
import {
  CEFR_LEVELS,
  JLPT_LEVELS,
  MIN_DAY_PRACTICE_CREDIT_SECONDS,
  dateKeyFromTimestamp,
  missTrackingStartDateKey,
  secondsInRange,
  startOfCalendarMonth,
  startOfWeekMonday,
} from './storage';

export function formatDuration(totalSec: number): string {
  const s = Math.floor(totalSec % 60);
  const m = Math.floor((totalSec / 60) % 60);
  const h = Math.floor(totalSec / 3600);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/** Whole minutes only (floored) — used in the compact YouTube watch panel. */
export function formatDurationMinutesOnly(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const totalMin = Math.floor(sec / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${totalMin}m`;
}

/** HH:MM style for top-bar “hours practiced” (hours + minutes within current hour). */
export function formatHoursMinutesClock(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function aggregatePracticeStats(data: PersistedData): { today: number; week: number; all: number } {
  const now = Date.now();
  const todayKey = dateKeyFromTimestamp(now);
  const today = data.dailySeconds[todayKey] ?? 0;
  const wStart = startOfWeekMonday(now);
  const week = secondsInRange(data.dailySeconds, wStart, now);
  const all = Object.values(data.dailySeconds).reduce((a, b) => a + b, 0);
  return { today, week, all };
}

/** Sum of daily buckets from the start of the local calendar month through now. */
export function secondsThisCalendarMonth(data: PersistedData): number {
  const now = Date.now();
  return secondsInRange(data.dailySeconds, startOfCalendarMonth(now), now);
}

export interface DayBucket {
  dateKey: string;
  seconds: number;
  weekdayShort: string;
}

/** Bar color tier for a single calendar day in the stats chart */
export type ChartDayTier = 'none' | 'active' | 'goal';

export type PracticeCalendarVisual = ChartDayTier | 'neutral' | 'future';

/** Some watch time, but under {@link MIN_DAY_PRACTICE_CREDIT_SECONDS} (still red on calendar). */
export const CALENDAR_UNDER_MINUTE_MARK = '0';

/** Missed tracked day with no credited practice. */
export const CALENDAR_MISSED_DAY_MARK = 'X';

export function dayCountsAsPracticedForCalendar(seconds: number): boolean {
  return seconds >= MIN_DAY_PRACTICE_CREDIT_SECONDS;
}

/** Bottom label for stats chart / panel day cells (aligned with month grid: 0 = today, X = past missed). */
export function calendarDayBottomLabel(
  vis: PracticeCalendarVisual,
  seconds: number,
  dateKey: string,
  todayKey: string,
): string {
  if (dayCountsAsPracticedForCalendar(seconds)) return formatDuration(seconds);
  if (dateKey === todayKey) return CALENDAR_UNDER_MINUTE_MARK;
  if (vis === 'none') return CALENDAR_MISSED_DAY_MARK;
  return '—';
}

/** Red = missed day in tracking window; green/gold = practice; neutral = before tracking or future. */
export function practiceCalendarDayVisual(
  dateKey: string,
  seconds: number,
  todayKey: string,
  extensionInstalledDateKey: string,
  dailySeconds: Record<string, number>,
  dailyGoalSec: number | null,
): PracticeCalendarVisual {
  if (dateKey > todayKey) return 'future';
  const missStart = missTrackingStartDateKey(extensionInstalledDateKey, dailySeconds);
  if (missStart === null) {
    if (!dayCountsAsPracticedForCalendar(seconds)) return 'neutral';
    return chartDayTier(seconds, dailyGoalSec);
  }
  if (dateKey < missStart) {
    if (!dayCountsAsPracticedForCalendar(seconds)) return 'neutral';
    return chartDayTier(seconds, dailyGoalSec);
  }
  if (!dayCountsAsPracticedForCalendar(seconds)) return 'none';
  return chartDayTier(seconds, dailyGoalSec);
}

/** Red = under 1 min or no time, green = ≥1 min practice, gold = met daily goal (when set). */
export function chartDayTier(seconds: number, dailyGoalSec: number | null): ChartDayTier {
  if (!dayCountsAsPracticedForCalendar(seconds)) return 'none';
  if (dailyGoalSec != null && dailyGoalSec > 0 && seconds >= dailyGoalSec) return 'goal';
  return 'active';
}

/**
 * Consecutive local calendar days with at least {@link MIN_DAY_PRACTICE_CREDIT_SECONDS} logged,
 * counting backward from the last “closed” day: **today** is ignored when it has no credit yet
 * (the day is still in progress). Any **earlier** day without credit breaks the streak.
 */
export function practiceStreakDays(
  dailySeconds: Record<string, number>,
  nowMs: number = Date.now(),
  missStartKey: string | null = null,
): number {
  if (missStartKey === null) return 0;
  const maxDays = 10000;
  const todayKey = dateKeyFromTimestamp(nowMs);
  let streak = 0;
  for (let dayOffset = 0; dayOffset < maxDays; dayOffset++) {
    const d = new Date(nowMs);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - dayOffset);
    const key = dateKeyFromTimestamp(d.getTime());
    if (key < missStartKey) break;
    const sec = dailySeconds[key] ?? 0;
    if (!dayCountsAsPracticedForCalendar(sec)) {
      if (key === todayKey) continue;
      break;
    }
    streak++;
  }
  return streak;
}

/** Calendar days ending today (local), oldest first */
export function lastNDaysBuckets(data: PersistedData, n: number, locale?: string): DayBucket[] {
  const out: DayBucket[] = [];
  const now = new Date();
  const loc = locale && locale.length > 0 ? locale : undefined;
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const dateKey = dateKeyFromTimestamp(d.getTime());
    const weekdayShort = d.toLocaleDateString(loc, { weekday: 'short' });
    out.push({
      dateKey,
      seconds: data.dailySeconds[dateKey] ?? 0,
      weekdayShort,
    });
  }
  return out;
}

/** Fixed Y-axis for the dashboard 7-day chart: 60 minutes = full bar height. */
export const CHART_BAR_SCALE_SEC = 60 * 60;

/** Inner bar area height in px — must match `.chart-bar-track` height in dashboard.css. */
export const CHART_INNER_PX = 220;

/** Pixel height for a practice-time bar on a fixed 0–60 min scale. */
export function chartBarHeightPx(
  seconds: number,
  chartInnerPx: number = CHART_INNER_PX,
): number {
  const clamped = Math.max(0, seconds);
  const ratio = Math.min(1, clamped / CHART_BAR_SCALE_SEC);
  const minPx =
    clamped > 0 && clamped < MIN_DAY_PRACTICE_CREDIT_SECONDS ? 6
    : clamped > 0 ? 14
    : 5;
  return Math.max(minPx, Math.round(ratio * chartInnerPx));
}

const ORDER_JLPT = ['Unrated', ...JLPT_LEVELS, 'Legacy'] as const;
const ORDER_CEFR = ['Unrated', ...CEFR_LEVELS, 'Legacy'] as const;

/** Practice seconds grouped by level for the active framework; “Legacy” = outside the active tag set. */
export function secondsByLevelBucket(
  data: PersistedData,
  activeFramework: LevelFramework,
  customLevels: readonly string[] = [],
): { label: string; seconds: number }[] {
  let order: readonly string[];
  if (activeFramework === 'jlpt') order = ORDER_JLPT;
  else if (activeFramework === 'cefr') order = ORDER_CEFR;
  else order = ['Unrated', ...customLevels, 'Legacy'];
  const map: Record<string, number> = {};
  for (const label of order) {
    map[label] = 0;
  }

  for (const item of data.library) {
    const sec = data.videoSeconds[item.videoId] ?? 0;
    const d: LevelTag | null = item.difficulty;
    let k: string;
    if (d === null) k = 'Unrated';
    else if (activeFramework === 'jlpt' && isJlptTag(d)) k = d;
    else if (activeFramework === 'cefr' && isCefrTag(d)) k = d;
    else if (activeFramework === 'custom' && customLevels.includes(d)) k = d;
    else k = 'Legacy';
    map[k] = (map[k] ?? 0) + sec;
  }

  return order.filter((label) => label in map).map((label) => ({
    label,
    seconds: map[label] ?? 0,
  }));
}

/** @deprecated use secondsByLevelBucket */
export function secondsByJlptBucket(data: PersistedData): { label: string; seconds: number }[] {
  return secondsByLevelBucket(data, 'jlpt');
}

export function libraryRowsWithPracticeSeconds(
  data: PersistedData,
): Array<{ item: LibraryItem; seconds: number }> {
  return data.library
    .map((item) => ({
      item,
      seconds: data.videoSeconds[item.videoId] ?? 0,
    }))
    .sort((a, b) => b.seconds - a.seconds || b.item.addedAt - a.item.addedAt);
}
