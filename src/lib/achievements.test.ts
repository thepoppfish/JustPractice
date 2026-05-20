import { describe, expect, it } from 'vitest';
import {
  ACHIEVEMENT_CATALOG,
  ACHIEVEMENT_CATEGORY_ORDER,
  buildAchievementContext,
  evaluateAchievements,
  groupedAchievementsForUi,
} from './achievements';
import { totalXpForLevel } from './playerProgress';
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

describe('achievements catalog', () => {
  it('has 30+ catalog entries', () => {
    expect(ACHIEVEMENT_CATALOG.length).toBeGreaterThanOrEqual(30);
  });
});

describe('groupedAchievementsForUi', () => {
  it('orders sections by category and achievements by threshold ascending', () => {
    const progress = {
      ...defaultPlayerProgress(),
      achievements: {
        lib_10: 100,
        lib_1: 50,
        complete_25: 200,
      },
    };
    const sections = groupedAchievementsForUi(progress);
    expect(sections.map((s) => s.category)).toEqual([...ACHIEVEMENT_CATEGORY_ORDER]);
    const library = sections.find((s) => s.category === 'library')!;
    expect(library.achievements.map((a) => a.id)).toEqual([
      'lib_1',
      'lib_5',
      'lib_10',
      'lib_25',
      'lib_50',
      'lib_100',
    ]);
    expect(library.achievements.map((a) => a.threshold)).toEqual([1, 5, 10, 25, 50, 100]);
  });
});

describe('evaluateAchievements', () => {
  it('unlocks library and watch milestones from fixture data', () => {
    const progress = defaultPlayerProgress();
    const data = mockData({
      library: Array.from({ length: 5 }, (_, i) => ({
        videoId: `v${i}`,
        title: 'T',
        channel: 'C',
        addedAt: 1,
        difficulty: null,
        completedAt: i === 0 ? 100 : null,
      })),
      dailySeconds: { '2026-05-01': 3600 },
    });
    const ctx = buildAchievementContext(data, progress);
    expect(ctx.libraryCount).toBe(5);
    expect(ctx.completedCount).toBe(1);
    expect(ctx.totalPracticeSeconds).toBe(3600);

    const newly = evaluateAchievements(data, progress);
    expect(newly).toContain('lib_5');
    expect(newly).toContain('complete_1');
    expect(newly).toContain('watch_1h');
    expect(newly).toContain('first_practice');
    expect(newly).toContain('first_completion');

    expect(evaluateAchievements(data, progress)).toEqual([]);
    expect(progress.achievements.lib_5).toBeGreaterThan(0);
  });

  it('unlocks account level achievements when XP qualifies', () => {
    const progress = {
      ...defaultPlayerProgress(),
      totalXp: totalXpForLevel(10),
    };
    const data = mockData({ playerProgress: progress });
    const newly = evaluateAchievements(data, progress);
    expect(newly).toContain('level_5');
    expect(newly).toContain('level_10');
    expect(newly).not.toContain('level_20');
  });
});
