import {
  firstPositiveDailyDateKey,
  missTrackingStartDateKey,
  type PersistedData,
  type PlayerProgress,
} from './storage';
import { practiceStreakDays } from './practiceStats';
import {
  completedCount,
  levelFromTotalXp,
  totalPracticeSeconds,
} from './playerProgress';

export type AchievementCategory =
  | 'library'
  | 'completed'
  | 'watch'
  | 'streak'
  | 'level'
  | 'prestige'
  | 'meta';

export interface AchievementDef {
  id: string;
  category: AchievementCategory;
  /** Progression order within category (ascending). */
  threshold: number;
  iconKey?: string;
  check: (ctx: AchievementContext) => boolean;
}

export interface AchievementContext {
  libraryCount: number;
  completedCount: number;
  totalPracticeSeconds: number;
  streak: number;
  accountLevel: number;
  prestigeLevel: number;
  hasFirstPracticeDay: boolean;
}

export function buildAchievementContext(
  data: PersistedData,
  progress: PlayerProgress,
  nowMs: number = Date.now(),
): AchievementContext {
  const missStart = missTrackingStartDateKey(data.extensionInstalledDateKey, data.dailySeconds);
  return {
    libraryCount: data.library.length,
    completedCount: completedCount(data),
    totalPracticeSeconds: totalPracticeSeconds(data),
    streak: practiceStreakDays(data.dailySeconds, nowMs, missStart),
    accountLevel: levelFromTotalXp(progress.totalXp),
    prestigeLevel: progress.prestigeLevel,
    hasFirstPracticeDay: firstPositiveDailyDateKey(data.dailySeconds) !== null,
  };
}

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: 'lib_1', category: 'library', threshold: 1, check: (c) => c.libraryCount >= 1 },
  { id: 'lib_5', category: 'library', threshold: 5, check: (c) => c.libraryCount >= 5 },
  { id: 'lib_10', category: 'library', threshold: 10, check: (c) => c.libraryCount >= 10 },
  { id: 'lib_25', category: 'library', threshold: 25, check: (c) => c.libraryCount >= 25 },
  { id: 'lib_50', category: 'library', threshold: 50, check: (c) => c.libraryCount >= 50 },
  { id: 'lib_100', category: 'library', threshold: 100, check: (c) => c.libraryCount >= 100 },
  { id: 'complete_1', category: 'completed', threshold: 1, check: (c) => c.completedCount >= 1 },
  { id: 'complete_5', category: 'completed', threshold: 5, check: (c) => c.completedCount >= 5 },
  { id: 'complete_10', category: 'completed', threshold: 10, check: (c) => c.completedCount >= 10 },
  { id: 'complete_25', category: 'completed', threshold: 25, check: (c) => c.completedCount >= 25 },
  { id: 'complete_50', category: 'completed', threshold: 50, check: (c) => c.completedCount >= 50 },
  { id: 'complete_100', category: 'completed', threshold: 100, check: (c) => c.completedCount >= 100 },
  { id: 'watch_1h', category: 'watch', threshold: 3600, check: (c) => c.totalPracticeSeconds >= 3600 },
  { id: 'watch_10h', category: 'watch', threshold: 36_000, check: (c) => c.totalPracticeSeconds >= 36_000 },
  { id: 'watch_50h', category: 'watch', threshold: 180_000, check: (c) => c.totalPracticeSeconds >= 180_000 },
  { id: 'watch_100h', category: 'watch', threshold: 360_000, check: (c) => c.totalPracticeSeconds >= 360_000 },
  { id: 'watch_250h', category: 'watch', threshold: 900_000, check: (c) => c.totalPracticeSeconds >= 900_000 },
  { id: 'watch_500h', category: 'watch', threshold: 1_800_000, check: (c) => c.totalPracticeSeconds >= 1_800_000 },
  { id: 'streak_3', category: 'streak', threshold: 3, check: (c) => c.streak >= 3 },
  { id: 'streak_7', category: 'streak', threshold: 7, check: (c) => c.streak >= 7 },
  { id: 'streak_14', category: 'streak', threshold: 14, check: (c) => c.streak >= 14 },
  { id: 'streak_30', category: 'streak', threshold: 30, check: (c) => c.streak >= 30 },
  { id: 'streak_60', category: 'streak', threshold: 60, check: (c) => c.streak >= 60 },
  { id: 'streak_100', category: 'streak', threshold: 100, check: (c) => c.streak >= 100 },
  { id: 'level_5', category: 'level', threshold: 5, check: (c) => c.accountLevel >= 5 },
  { id: 'level_10', category: 'level', threshold: 10, check: (c) => c.accountLevel >= 10 },
  { id: 'level_20', category: 'level', threshold: 20, check: (c) => c.accountLevel >= 20 },
  { id: 'level_25', category: 'level', threshold: 25, check: (c) => c.accountLevel >= 25 },
  { id: 'level_50', category: 'level', threshold: 50, check: (c) => c.accountLevel >= 50 },
  { id: 'level_75', category: 'level', threshold: 75, check: (c) => c.accountLevel >= 75 },
  { id: 'level_100', category: 'level', threshold: 100, check: (c) => c.accountLevel >= 100 },
  { id: 'level_120', category: 'level', threshold: 120, check: (c) => c.accountLevel >= 120 },
  { id: 'prestige_1', category: 'prestige', threshold: 1, check: (c) => c.prestigeLevel >= 1 },
  { id: 'prestige_5', category: 'prestige', threshold: 5, check: (c) => c.prestigeLevel >= 5 },
  { id: 'prestige_10', category: 'prestige', threshold: 10, check: (c) => c.prestigeLevel >= 10 },
  {
    id: 'prestige_master',
    category: 'prestige',
    threshold: 10,
    check: (c) => c.prestigeLevel >= 10,
  },
  { id: 'first_practice', category: 'meta', threshold: 0, check: (c) => c.hasFirstPracticeDay },
  { id: 'first_completion', category: 'meta', threshold: 1, check: (c) => c.completedCount >= 1 },
  {
    id: 'meta_well_rounded',
    category: 'meta',
    threshold: 10,
    check: (c) => c.libraryCount >= 10 && c.completedCount >= 10,
  },
  {
    id: 'meta_momentum',
    category: 'meta',
    threshold: 7,
    check: (c) => c.totalPracticeSeconds >= 36_000 && c.streak >= 7,
  },
] as const;

/** Alias for plan/docs naming. */
export const ACHIEVEMENT_CATALOG = ACHIEVEMENTS;

/** Display order for Progress tab achievement sections. */
export const ACHIEVEMENT_CATEGORY_ORDER: readonly AchievementCategory[] = [
  'library',
  'completed',
  'watch',
  'streak',
  'level',
  'prestige',
  'meta',
] as const;

export type AchievementUiRow = AchievementDef & {
  unlocked: boolean;
  unlockedAt: number | null;
};

export type AchievementUiSection = {
  category: AchievementCategory;
  achievements: AchievementUiRow[];
};

function sortAchievementsWithinCategory(a: AchievementUiRow, b: AchievementUiRow): number {
  if (a.threshold !== b.threshold) return a.threshold - b.threshold;
  return a.id.localeCompare(b.id);
}

export function groupedAchievementsForUi(progress: PlayerProgress): AchievementUiSection[] {
  const rows: AchievementUiRow[] = ACHIEVEMENTS.map((a) => ({
    ...a,
    unlocked: progress.achievements[a.id] != null,
    unlockedAt: progress.achievements[a.id] ?? null,
  }));
  const byCategory = new Map<AchievementCategory, AchievementUiRow[]>();
  for (const row of rows) {
    const list = byCategory.get(row.category) ?? [];
    list.push(row);
    byCategory.set(row.category, list);
  }
  return ACHIEVEMENT_CATEGORY_ORDER.filter((cat) => byCategory.has(cat)).map((category) => ({
    category,
    achievements: [...(byCategory.get(category) ?? [])].sort(sortAchievementsWithinCategory),
  }));
}

export function evaluateAchievements(
  data: PersistedData,
  progress: PlayerProgress,
  nowMs: number = Date.now(),
): string[] {
  const ctx = buildAchievementContext(data, progress, nowMs);
  const now = Date.now();
  const newlyUnlocked: string[] = [];
  for (const ach of ACHIEVEMENTS) {
    if (progress.achievements[ach.id] != null) continue;
    if (!ach.check(ctx)) continue;
    progress.achievements[ach.id] = now;
    newlyUnlocked.push(ach.id);
  }
  return newlyUnlocked;
}

export function achievementById(id: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

export function sortedAchievementsForUi(progress: PlayerProgress): AchievementUiRow[] {
  return groupedAchievementsForUi(progress).flatMap((s) => s.achievements);
}
