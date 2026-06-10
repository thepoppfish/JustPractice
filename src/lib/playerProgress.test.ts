import { describe, expect, it } from 'vitest';
import {
  BACKFILL_XP_CAP,
  BONUS_XP_DAILY_GOAL,
  BONUS_XP_FIRST_COMPLETE,
  BONUS_XP_STREAK_DAY,
  MAX_ACCOUNT_LEVEL,
  MAX_PRESTIGE_LEVEL,
  applyPrestige,
  canPrestige,
  getPrestigeXpMultiplier,
  awardDailyGoalXpBonus,
  awardFirstCompleteXpBonus,
  awardPracticeXp,
  awardStreakDayXpBonus,
  backfillXpFromDailySeconds,
  getPracticeXpMultiplier,
  isWeekendPracticeBonusActive,
  levelFromTotalXp,
  practiceXpFromSeconds,
  totalXpForLevel,
  xpIntoCurrentLevel,
} from './playerProgress';
import { SCHEMA_VERSION, defaultPlayerProgress, defaultSettings, type PersistedData } from './storage';

function mockData(over: Partial<PersistedData> = {}): PersistedData {
  return {
    schemaVersion: SCHEMA_VERSION,
    library: [],
    extensionInstalledDateKey: '2026-01-01',
    dailySeconds: {},
    videoSeconds: {},
    settings: defaultSettings(),
    playerProgress: defaultPlayerProgress(),
    ...over,
  };
}

describe('account level curve', () => {
  it('level thresholds match documented examples', () => {
    expect(totalXpForLevel(1)).toBe(0);
    expect(totalXpForLevel(2)).toBe(100);
    expect(totalXpForLevel(3)).toBe(300);
  });

  it('levelFromTotalXp is monotonic and caps at max', () => {
    expect(levelFromTotalXp(0)).toBe(1);
    expect(levelFromTotalXp(99)).toBe(1);
    expect(levelFromTotalXp(100)).toBe(2);
    expect(levelFromTotalXp(299)).toBe(2);
    expect(levelFromTotalXp(300)).toBe(3);
    expect(levelFromTotalXp(totalXpForLevel(120) - 1)).toBe(119);
    const capXp = totalXpForLevel(MAX_ACCOUNT_LEVEL);
    expect(levelFromTotalXp(capXp)).toBe(MAX_ACCOUNT_LEVEL);
    expect(levelFromTotalXp(capXp + 1_000_000)).toBe(MAX_ACCOUNT_LEVEL);
  });

  it('progress helpers behave at edges', () => {
    expect(xpIntoCurrentLevel(150).xpIntoLevel).toBe(50);
    expect(xpIntoCurrentLevel(150).xpNeededForNext).toBe(200);
    expect(xpIntoCurrentLevel(0).progressPercent).toBe(0);
    expect(xpIntoCurrentLevel(totalXpForLevel(MAX_ACCOUNT_LEVEL)).progressPercent).toBe(100);
  });
});

const WEEKDAY_NOON = new Date(2026, 4, 18, 12, 0, 0, 0).getTime();

describe('practice XP', () => {
  it('awards 1 XP per full minute only', () => {
    expect(practiceXpFromSeconds(59, WEEKDAY_NOON).xp).toBe(0);
    expect(practiceXpFromSeconds(60, WEEKDAY_NOON).xp).toBe(1);
    expect(practiceXpFromSeconds(125, WEEKDAY_NOON).xp).toBe(2);
  });

  it('banks sub-minute seconds across practice ticks (15s flush batches)', () => {
    const pp = defaultPlayerProgress();
    const mon = WEEKDAY_NOON;
    expect(awardPracticeXp(pp, 15, mon).xpGained).toBe(0);
    expect(pp.practiceXpCarrySeconds).toBe(15);
    expect(awardPracticeXp(pp, 15, mon).xpGained).toBe(0);
    expect(pp.practiceXpCarrySeconds).toBe(30);
    expect(awardPracticeXp(pp, 15, mon).xpGained).toBe(0);
    expect(pp.practiceXpCarrySeconds).toBe(45);
    expect(awardPracticeXp(pp, 15, mon).xpGained).toBe(1);
    expect(pp.practiceXpCarrySeconds).toBe(0);
    expect(pp.totalXp).toBe(1);
  });

  it('doubles on local weekend days', () => {
    const sat = new Date(2026, 4, 16, 12, 0, 0, 0).getTime();
    const mon = new Date(2026, 4, 18, 12, 0, 0, 0).getTime();
    expect(isWeekendPracticeBonusActive(sat)).toBe(true);
    expect(isWeekendPracticeBonusActive(mon)).toBe(false);
    expect(getPracticeXpMultiplier(sat)).toBe(2);
    expect(getPracticeXpMultiplier(mon)).toBe(1);
    expect(practiceXpFromSeconds(120, sat)).toEqual({
      xp: 4,
      multiplier: 2,
      prestigeMultiplier: 1,
      roadmapBonusMultiplier: 1,
    });
    expect(practiceXpFromSeconds(120, mon)).toEqual({
      xp: 2,
      multiplier: 1,
      prestigeMultiplier: 1,
      roadmapBonusMultiplier: 1,
    });
  });

  it('applies prestige multiplier to practice XP only', () => {
    const mon = new Date(2026, 4, 18, 12, 0, 0, 0).getTime();
    expect(getPrestigeXpMultiplier(0)).toBe(1);
    expect(getPrestigeXpMultiplier(2)).toBe(1.1);
    expect(getPrestigeXpMultiplier(10)).toBe(1.5);
    expect(getPrestigeXpMultiplier(99)).toBe(1.5);
    expect(practiceXpFromSeconds(120, mon, 2)).toEqual({
      xp: 2,
      multiplier: 1.1,
      prestigeMultiplier: 1.1,
      roadmapBonusMultiplier: 1,
    });
  });
});

describe('historical backfill', () => {
  it('caps total backfill XP', () => {
    const huge: Record<string, number> = { '2020-01-01': 60 * 60 * 100_000 };
    expect(backfillXpFromDailySeconds(huge)).toBe(BACKFILL_XP_CAP);
  });

  it('uses full minutes from daily totals', () => {
    expect(backfillXpFromDailySeconds({ a: 3600, b: 1800 })).toBe(90);
  });
});

describe('bonus dedupe', () => {
  it('daily goal and streak bonuses fire once per date key', () => {
    const pp = defaultPlayerProgress();
    expect(awardDailyGoalXpBonus(pp, '2026-05-01')?.xpGained).toBe(BONUS_XP_DAILY_GOAL);
    expect(awardDailyGoalXpBonus(pp, '2026-05-01')).toBeNull();
    const data = mockData({
      dailySeconds: { '2026-05-01': 120, '2026-05-02': 120 },
      extensionInstalledDateKey: '2026-01-01',
    });
    const may2 = new Date(2026, 4, 2, 12, 0, 0, 0).getTime();
    expect(awardStreakDayXpBonus(data, pp, '2026-05-02', may2)?.xpGained).toBe(BONUS_XP_STREAK_DAY);
    expect(awardStreakDayXpBonus(data, pp, '2026-05-02', may2)).toBeNull();

    const lowStreak = mockData({
      dailySeconds: { '2026-05-01': 120 },
      extensionInstalledDateKey: '2026-01-01',
    });
    expect(awardStreakDayXpBonus(lowStreak, defaultPlayerProgress(), '2026-05-01', may2)).toBeNull();
  });

  it('first-complete bonus is once per videoId', () => {
    const pp = defaultPlayerProgress();
    expect(awardFirstCompleteXpBonus(pp, 'vid-a')?.xpGained).toBe(BONUS_XP_FIRST_COMPLETE);
    expect(awardFirstCompleteXpBonus(pp, 'vid-a')).toBeNull();
    expect(awardFirstCompleteXpBonus(pp, 'vid-b')?.xpGained).toBe(BONUS_XP_FIRST_COMPLETE);
    expect(pp.completeXpAwarded['vid-a']).toBe(true);
  });
});

describe('prestige', () => {
  it('canPrestige requires rank 120 and prestige below cap', () => {
    const pp = defaultPlayerProgress();
    expect(canPrestige(pp)).toBe(false);
    pp.totalXp = totalXpForLevel(MAX_ACCOUNT_LEVEL);
    pp.lifetimeXp = pp.totalXp;
    expect(canPrestige(pp)).toBe(true);
    pp.prestigeLevel = MAX_PRESTIGE_LEVEL;
    expect(canPrestige(pp)).toBe(false);
  });

  it('applyPrestige resets cycle XP and increments prestige', () => {
    const pp = {
      ...defaultPlayerProgress(),
      totalXp: totalXpForLevel(MAX_ACCOUNT_LEVEL) + 500,
      lifetimeXp: totalXpForLevel(MAX_ACCOUNT_LEVEL) + 500,
    };
    const result = applyPrestige(pp);
    expect(result.applied).toBe(true);
    expect(result.prestigeLevel).toBe(1);
    expect(pp.totalXp).toBe(0);
    expect(pp.lifetimeXp).toBe(totalXpForLevel(MAX_ACCOUNT_LEVEL) + 500);
    expect(levelFromTotalXp(pp.totalXp)).toBe(1);
  });

  it('applyPrestige is no-op when not eligible', () => {
    const pp = defaultPlayerProgress();
    const result = applyPrestige(pp);
    expect(result.applied).toBe(false);
    expect(pp.prestigeLevel).toBe(0);
    expect(pp.totalXp).toBe(0);
  });
});
