import { daysInCalendarMonth, defaultGoals, type PracticeGoals } from './storage';

/** Build persisted goal targets from a daily minutes input (dashboard + welcome). */
export function goalsFromDailyMinutes(minutes: number | null, atMs = Date.now()): PracticeGoals {
  if (minutes === null || minutes <= 0) return defaultGoals();
  const dailyTargetSec = Math.round(minutes * 60);
  return {
    dailyTargetSec,
    weeklyTargetSec: dailyTargetSec * 7,
    monthlyTargetSec: dailyTargetSec * daysInCalendarMonth(atMs),
  };
}

/** Parse a minutes input string; returns whole minutes or null when empty/invalid. */
export function parseDailyGoalMinutesInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(180, Math.floor(n));
}
