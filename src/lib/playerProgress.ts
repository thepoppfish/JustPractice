import {
  completedLibraryItems,
  dateKeyFromTimestamp,
  defaultPlayerProgress,
  MIN_DAY_PRACTICE_CREDIT_SECONDS,
  missTrackingStartDateKey,
  type PersistedData,
  type PlayerProgress,
} from './storage';
import { practiceStreakDays } from './practiceStats';

export const XP_PER_PRACTICE_MINUTE = 1 as const;
export const BONUS_XP_DAILY_GOAL = 25 as const;
export const BONUS_XP_STREAK_DAY = 10 as const;
export const BONUS_XP_FIRST_COMPLETE = 15 as const;
export const MAX_ACCOUNT_LEVEL = 120 as const;
export const MAX_PRESTIGE_LEVEL = 10 as const;
export const PRESTIGE_XP_BONUS_PER_LEVEL = 0.05 as const;
export const BACKFILL_XP_CAP = 50_000 as const;

/** Total XP required to reach account level L (level 1 = 0 XP). */
export function totalXpForLevel(level: number): number {
  if (level <= 1) return 0;
  return (100 * level * (level - 1)) / 2;
}

export function xpRequiredForLevel(level: number): number {
  return totalXpForLevel(level);
}

export function levelFromTotalXp(totalXp: number): number {
  const xp = Math.max(0, Math.floor(totalXp));
  let lo = 1;
  let hi = MAX_ACCOUNT_LEVEL;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (totalXpForLevel(mid) <= xp) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export function xpIntoCurrentLevel(totalXp: number): {
  level: number;
  xpIntoLevel: number;
  xpNeededForNext: number;
  progressPercent: number;
} {
  const level = levelFromTotalXp(totalXp);
  const floorXp = totalXpForLevel(level);
  const nextLevelXp = level >= MAX_ACCOUNT_LEVEL ? floorXp : totalXpForLevel(level + 1);
  const xpIntoLevel = totalXp - floorXp;
  const xpNeededForNext = Math.max(0, nextLevelXp - floorXp);
  const progressPercent =
    level >= MAX_ACCOUNT_LEVEL || xpNeededForNext <= 0 ?
      100
    : Math.min(100, Math.round((xpIntoLevel / xpNeededForNext) * 100));
  return { level, xpIntoLevel, xpNeededForNext, progressPercent };
}

/** Local Saturday/Sunday → 2× practice XP. */
export function getPracticeXpMultiplier(nowMs: number = Date.now()): number {
  const day = new Date(nowMs).getDay();
  return day === 0 || day === 6 ? 2 : 1;
}

/** +5% practice XP per prestige level, cap +50% at prestige 10. */
export function getPrestigeXpMultiplier(prestigeLevel: number): number {
  const level = Math.max(0, Math.min(MAX_PRESTIGE_LEVEL, Math.floor(prestigeLevel)));
  return 1 + level * PRESTIGE_XP_BONUS_PER_LEVEL;
}

export function isWeekendPracticeBonusActive(nowMs: number = Date.now()): boolean {
  return getPracticeXpMultiplier(nowMs) > 1;
}

export function practiceXpFromSeconds(
  deltaSeconds: number,
  nowMs: number = Date.now(),
  prestigeLevel: number = 0,
): {
  xp: number;
  multiplier: number;
  prestigeMultiplier: number;
} {
  const base = Math.floor(Math.max(0, deltaSeconds) / 60) * XP_PER_PRACTICE_MINUTE;
  const weekendMultiplier = getPracticeXpMultiplier(nowMs);
  const prestigeMultiplier = getPrestigeXpMultiplier(prestigeLevel);
  const multiplier = weekendMultiplier * prestigeMultiplier;
  return { xp: Math.floor(base * multiplier), multiplier, prestigeMultiplier };
}

export function backfillXpFromDailySeconds(dailySeconds: Record<string, number>): number {
  const totalSec = Object.values(dailySeconds).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
  const xp = Math.floor(totalSec / 60) * XP_PER_PRACTICE_MINUTE;
  return Math.min(BACKFILL_XP_CAP, xp);
}

export interface XpDelta {
  xpGained: number;
  levelBefore: number;
  levelAfter: number;
  levelUp: boolean;
}

function addXp(progress: PlayerProgress, amount: number): XpDelta {
  const levelBefore = levelFromTotalXp(progress.totalXp);
  const gain = Math.max(0, amount);
  if (
    typeof progress.lifetimeXp !== 'number' ||
    !Number.isFinite(progress.lifetimeXp) ||
    progress.lifetimeXp < 0
  ) {
    progress.lifetimeXp = progress.totalXp;
  }
  progress.totalXp += gain;
  progress.lifetimeXp += gain;
  const levelAfter = levelFromTotalXp(progress.totalXp);
  return {
    xpGained: gain,
    levelBefore,
    levelAfter,
    levelUp: levelAfter > levelBefore,
  };
}

export function awardPracticeXp(
  progress: PlayerProgress,
  deltaSeconds: number,
  nowMs: number = Date.now(),
): XpDelta & { multiplier: number; prestigeMultiplier: number } {
  const carryIn = Math.max(0, Math.floor(progress.practiceXpCarrySeconds ?? 0));
  const added = Math.max(0, Math.floor(deltaSeconds));
  const pooled = carryIn + added;
  const billableSeconds = Math.floor(pooled / 60) * 60;
  progress.practiceXpCarrySeconds = pooled % 60;

  const { xp, multiplier, prestigeMultiplier } = practiceXpFromSeconds(
    billableSeconds,
    nowMs,
    progress.prestigeLevel,
  );
  if (xp <= 0) {
    return {
      xpGained: 0,
      multiplier,
      prestigeMultiplier,
      levelBefore: levelFromTotalXp(progress.totalXp),
      levelAfter: levelFromTotalXp(progress.totalXp),
      levelUp: false,
    };
  }
  const delta = addXp(progress, xp);
  return { ...delta, multiplier, prestigeMultiplier };
}

export function awardDailyGoalXpBonus(
  progress: PlayerProgress,
  todayKey: string = dateKeyFromTimestamp(Date.now()),
): XpDelta | null {
  if (progress.lastDailyGoalXpDateKey === todayKey) return null;
  progress.lastDailyGoalXpDateKey = todayKey;
  return addXp(progress, BONUS_XP_DAILY_GOAL);
}

export function awardStreakDayXpBonus(
  data: PersistedData,
  progress: PlayerProgress,
  todayKey: string = dateKeyFromTimestamp(Date.now()),
  nowMs: number = Date.now(),
): XpDelta | null {
  if (progress.lastStreakXpDateKey === todayKey) return null;

  const todaySec = data.dailySeconds[todayKey] ?? 0;
  if (todaySec < MIN_DAY_PRACTICE_CREDIT_SECONDS) return null;

  const missStart = missTrackingStartDateKey(data.extensionInstalledDateKey, data.dailySeconds);
  const streak = practiceStreakDays(data.dailySeconds, nowMs, missStart);
  if (streak < 2) return null;

  progress.lastStreakXpDateKey = todayKey;
  return addXp(progress, BONUS_XP_STREAK_DAY);
}

export function awardFirstCompleteXpBonus(progress: PlayerProgress, videoId: string): XpDelta | null {
  if (progress.completeXpAwarded[videoId]) return null;
  progress.completeXpAwarded[videoId] = true;
  return addXp(progress, BONUS_XP_FIRST_COMPLETE);
}

export function completedCount(data: PersistedData): number {
  return completedLibraryItems(data.library).length;
}

export function totalPracticeSeconds(data: PersistedData): number {
  return Object.values(data.dailySeconds).reduce((a, b) => a + b, 0);
}

export function canPrestige(progress: PlayerProgress): boolean {
  return (
    progress.prestigeLevel < MAX_PRESTIGE_LEVEL &&
    levelFromTotalXp(progress.totalXp) >= MAX_ACCOUNT_LEVEL
  );
}

export interface PrestigeResult {
  applied: boolean;
  prestigeLevel: number;
  previousPrestigeLevel: number;
}

/** Resets cycle XP; keeps lifetime XP, achievements, and library state. */
export function applyPrestige(progress: PlayerProgress): PrestigeResult {
  const previousPrestigeLevel = progress.prestigeLevel;
  if (!canPrestige(progress)) {
    return { applied: false, prestigeLevel: progress.prestigeLevel, previousPrestigeLevel };
  }
  progress.prestigeLevel += 1;
  progress.totalXp = 0;
  progress.practiceXpCarrySeconds = 0;
  return {
    applied: true,
    prestigeLevel: progress.prestigeLevel,
    previousPrestigeLevel,
  };
}

export { defaultPlayerProgress };
