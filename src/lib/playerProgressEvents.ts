/**
 * Background-side XP + achievement orchestration (account level, not LevelTag).
 */

import { evaluateAchievements } from './achievements';
import {
  applyPrestige,
  awardDailyGoalXpBonus,
  awardFirstCompleteXpBonus,
  awardPracticeXp,
  awardStreakDayXpBonus,
  levelFromTotalXp,
  type XpDelta,
} from './playerProgress';
import { dateKeyFromTimestamp, type PersistedData } from './storage';

export interface XpEventResult {
  xpGained: number;
  newAchievements: string[];
  levelUp: boolean;
  newLevel: number;
}

function sumXpGained(...deltas: Array<XpDelta | null>): number {
  return deltas.reduce((sum, d) => sum + (d?.xpGained ?? 0), 0);
}

function anyLevelUp(...deltas: Array<XpDelta | null>): boolean {
  return deltas.some((d) => d?.levelUp === true);
}

function isDailyGoalMet(data: PersistedData, dateKey: string): boolean {
  const target = data.settings.goals?.dailyTargetSec;
  if (target === null || target === undefined || target <= 0) return false;
  return (data.dailySeconds[dateKey] ?? 0) >= target;
}

function finalizeXpEvent(
  data: PersistedData,
  levelBefore: number,
  xpGained: number,
  levelUpFromDeltas: boolean,
  nowMs: number,
): XpEventResult {
  const progress = data.playerProgress;
  const newAchievements = evaluateAchievements(data, progress, nowMs);
  const levelAfter = levelFromTotalXp(progress.totalXp);
  return {
    xpGained,
    newAchievements,
    levelUp: levelUpFromDeltas || levelAfter > levelBefore,
    newLevel: levelAfter,
  };
}

export function processPracticeTickXpEvent(
  data: PersistedData,
  deltaSeconds: number,
  endedAtMs: number,
): XpEventResult {
  const progress = data.playerProgress;
  const levelBefore = levelFromTotalXp(progress.totalXp);
  const dateKey = dateKeyFromTimestamp(endedAtMs);

  const practice = awardPracticeXp(progress, deltaSeconds, endedAtMs);
  const streak = awardStreakDayXpBonus(data, progress, dateKey, endedAtMs);
  const daily =
    isDailyGoalMet(data, dateKey) ? awardDailyGoalXpBonus(progress, dateKey) : null;

  const xpGained = sumXpGained(practice, streak, daily);
  return finalizeXpEvent(
    data,
    levelBefore,
    xpGained,
    anyLevelUp(practice, streak, daily),
    endedAtMs,
  );
}

export function processFirstCompleteXpEvent(
  data: PersistedData,
  videoId: string,
): XpEventResult {
  const progress = data.playerProgress;
  const levelBefore = levelFromTotalXp(progress.totalXp);
  const bonus = awardFirstCompleteXpBonus(progress, videoId);
  return finalizeXpEvent(data, levelBefore, bonus?.xpGained ?? 0, bonus?.levelUp === true, Date.now());
}

export function processDailyGoalXpEvent(data: PersistedData, dateKey?: string): XpEventResult {
  const progress = data.playerProgress;
  const levelBefore = levelFromTotalXp(progress.totalXp);
  const key = dateKey ?? dateKeyFromTimestamp(Date.now());
  const bonus = isDailyGoalMet(data, key) ? awardDailyGoalXpBonus(progress, key) : null;
  return finalizeXpEvent(data, levelBefore, bonus?.xpGained ?? 0, bonus?.levelUp === true, Date.now());
}

/** Idempotent achievement scan (e.g. on GET_STATE). */
export function processAchievementScan(data: PersistedData): XpEventResult {
  const levelBefore = levelFromTotalXp(data.playerProgress.totalXp);
  return finalizeXpEvent(data, levelBefore, 0, false, Date.now());
}

export function processPrestigeEvent(data: PersistedData): XpEventResult & {
  prestigeUp: boolean;
  prestigeLevel: number;
} {
  const progress = data.playerProgress;
  const levelBefore = levelFromTotalXp(progress.totalXp);
  const result = applyPrestige(progress);
  const xpResult = finalizeXpEvent(data, levelBefore, 0, false, Date.now());
  return {
    ...xpResult,
    prestigeUp: result.applied,
    prestigeLevel: progress.prestigeLevel,
  };
}
