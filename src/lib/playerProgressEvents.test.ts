import { describe, expect, it } from 'vitest';
import { BONUS_XP_DAILY_GOAL, BONUS_XP_STREAK_DAY } from './playerProgress';
import { processPracticeTickXpEvent } from './playerProgressEvents';
import {
  SCHEMA_VERSION,
  dateKeyFromTimestamp,
  defaultPlayerProgress,
  defaultSettings,
  type PersistedData,
} from './storage';

const WEEKDAY_NOON = new Date(2026, 4, 18, 12, 0, 0, 0).getTime();
const WEEKDAY_KEY = dateKeyFromTimestamp(WEEKDAY_NOON);
const PRIOR_DAY_KEY = '2026-05-17';

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

describe('processPracticeTickXpEvent', () => {
  it('awards practice XP from banked 15s flushes after 60s credited today', () => {
    const data = mockData();
    data.dailySeconds[WEEKDAY_KEY] = 0;

    let gained = 0;
    for (let i = 0; i < 4; i++) {
      data.dailySeconds[WEEKDAY_KEY] = (data.dailySeconds[WEEKDAY_KEY] ?? 0) + 15;
      const res = processPracticeTickXpEvent(data, 15, WEEKDAY_NOON);
      gained += res.xpGained;
    }

    expect(gained).toBe(1);
    expect(data.playerProgress.totalXp).toBe(1);
    expect(data.playerProgress.practiceXpCarrySeconds).toBe(0);
  });

  it('grants daily and streak bonuses on the same tick when eligible', () => {
    const data = mockData({
      settings: {
        ...defaultSettings(),
        goals: { ...defaultSettings().goals, dailyTargetSec: 60 },
      },
      dailySeconds: {
        [PRIOR_DAY_KEY]: 120,
        [WEEKDAY_KEY]: 45,
      },
      extensionInstalledDateKey: '2026-01-01',
      playerProgress: { ...defaultPlayerProgress(), practiceXpCarrySeconds: 45 },
    });

    data.dailySeconds[WEEKDAY_KEY] = (data.dailySeconds[WEEKDAY_KEY] ?? 0) + 15;

    const res = processPracticeTickXpEvent(data, 15, WEEKDAY_NOON);
    expect(res.xpGained).toBe(1 + BONUS_XP_DAILY_GOAL + BONUS_XP_STREAK_DAY);
    expect(data.playerProgress.lastDailyGoalXpDateKey).toBe(WEEKDAY_KEY);
    expect(data.playerProgress.lastStreakXpDateKey).toBe(WEEKDAY_KEY);
  });
});
