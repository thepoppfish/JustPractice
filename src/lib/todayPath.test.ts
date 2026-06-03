import { describe, expect, it } from 'vitest';
import { emptyPersisted } from './storage';
import type { LibraryItem, PersistedData } from './storageTypes';
import { practicedSecOnPathStep, resolveTodayPathUi } from './todayPath';
import type { TodayPathPlan } from './todayPathPlan';

function libItem(
  videoId: string,
  durationSec: number,
  addedAt: number,
): LibraryItem {
  return {
    videoId,
    title: videoId,
    channel: 'ch',
    difficulty: null,
    addedAt,
    completedAt: null,
    durationSec,
  };
}

function dataWithLibrary(
  library: LibraryItem[],
  overrides: Partial<PersistedData> = {},
): PersistedData {
  return {
    ...emptyPersisted(),
    library,
    settings: {
      ...emptyPersisted().settings,
      goals: { dailyTargetSec: 30 * 60, weeklyTargetSec: null, monthlyTargetSec: null },
    },
    ...overrides,
  };
}

describe('resolveTodayPathUi', () => {
  const todayKey = '2026-06-03';

  it('shows no-goal state when daily target unset', () => {
    const data = dataWithLibrary([], {
      settings: { ...emptyPersisted().settings, goals: {} },
    });
    const ui = resolveTodayPathUi(data, todayKey, false);
    expect(ui.showNoGoal).toBe(true);
    expect(ui.nodes).toHaveLength(0);
  });

  it('flags missing duration when saves lack length', () => {
    const data = dataWithLibrary([libItem('a', 17 * 60, 1)]);
    data.library[0]!.durationSec = null;
    const ui = resolveTodayPathUi(data, todayKey, false);
    expect(ui.showMissingDuration).toBe(true);
    expect(ui.showEmptyCandidates).toBe(false);
  });

  const threeHourGoal = {
    settings: {
      ...emptyPersisted().settings,
      goals: { dailyTargetSec: 3 * 3600, weeklyTargetSec: null, monthlyTargetSec: null },
    },
  };

  it('aligns planned total with daily remainder when partial watch was today', () => {
    const todayKeyLocal = todayKey;
    const data = dataWithLibrary(
      [libItem('a', 3600, 1), libItem('b', 3600, 2), libItem('c', 3600, 3)],
      {
        ...threeHourGoal,
        dailySeconds: { [todayKeyLocal]: 1800 },
        videoSeconds: { a: 1800 },
      },
    );
    const ui = resolveTodayPathUi(data, todayKeyLocal, true);
    expect(ui.remainingSec).toBe(150 * 60);
    expect(ui.plannedTotalSec).toBe(150 * 60);
  });

  it('plans less when a candidate was partially watched before', () => {
    const data = dataWithLibrary(
      [libItem('a', 3600, 1), libItem('b', 3600, 2), libItem('c', 3600, 3)],
      { ...threeHourGoal, videoSeconds: { a: 1800 } },
    );
    const ui = resolveTodayPathUi(data, todayKey, true);
    expect(ui.plannedTotalSec).toBe(2.5 * 3600);
    expect(ui.nodes.find((n) => n.item.videoId === 'a')!.allocatedSec).toBe(1800);
    expect(ui.nodes.find((n) => n.item.videoId === 'a')!.watchedSecAtBuild).toBe(1800);
  });

  it('builds greedy path for remaining daily minutes', () => {
    const data = dataWithLibrary([
      libItem('a', 17 * 60, 1),
      libItem('b', 15 * 60, 2),
      libItem('c', 60 * 60, 3),
    ]);
    const ui = resolveTodayPathUi(data, todayKey, false);
    expect(ui.nodes).toHaveLength(2);
    expect(ui.nodes[0]!.item.videoId).toBe('a');
    expect(ui.plannedTotalSec).toBe(30 * 60);
    expect(ui.planToPersist).not.toBeNull();
  });

  it('credits watch time that existed when the plan was built', () => {
    const step: TodayPathPlan['steps'][number] = {
      videoId: 'a',
      durationSec: 2008,
      allocatedSec: 905,
      videoSecondsBaseline: 1103,
      creditedSecAtBuild: 905,
    };
    expect(practicedSecOnPathStep(step, 1103)).toBe(905);
    expect(practicedSecOnPathStep(step, 1200)).toBe(905);
  });

  it('shows prior watch on step when plan was built after partial viewing', () => {
    const data = dataWithLibrary([libItem('a', 2008, 1)], {
      ...threeHourGoal,
      videoSeconds: { a: 1103 },
    });
    const ui = resolveTodayPathUi(data, todayKey, true);
    const node = ui.nodes.find((n) => n.item.videoId === 'a')!;
    expect(node.watchedSecAtBuild).toBe(1103);
    expect(node.practicedSecOnStep).toBeGreaterThan(0);
    expect(node.practicedSecOnStep).toBeLessThanOrEqual(node.allocatedSec);
  });

  it('marks step complete from videoSeconds baseline delta', () => {
    const data = dataWithLibrary([libItem('a', 20 * 60, 1)], {
      videoSeconds: { a: 20 * 60 },
      todayPathPlan: {
        dateKey: todayKey,
        remainingSecAtBuild: 30 * 60,
        builtAtMs: 1,
        steps: [
          {
            videoId: 'a',
            durationSec: 20 * 60,
            allocatedSec: 20 * 60,
            videoSecondsBaseline: 0,
            creditedSecAtBuild: 0,
          },
        ],
      },
    });
    const ui = resolveTodayPathUi(data, todayKey, false);
    expect(ui.nodes[0]!.state).toBe('stepCompleted');
  });

  it('rebuild uses alternate pack when regenerating from prior plan', () => {
    const data = dataWithLibrary([
      libItem('old', 20 * 60, 100),
      libItem('mid', 20 * 60, 200),
      libItem('new', 20 * 60, 300),
    ]);
    const first = resolveTodayPathUi(data, todayKey, false);
    const priorIds = first.nodes.map((n) => n.item.videoId);

    const regen = resolveTodayPathUi(data, todayKey, true, {
      regenerateFromVideoIds: priorIds,
    });
    expect(regen.planToPersist).not.toBeNull();
    expect(regen.nodes[0]!.practicedSecOnStep).toBe(0);
    if (priorIds.length > 0 && data.library.length > priorIds.length) {
      const sameOrder =
        regen.nodes.length === first.nodes.length &&
        regen.nodes.every((n, i) => n.item.videoId === first.nodes[i]!.item.videoId);
      expect(sameOrder).toBe(false);
    }
  });

  it('allows extra-practice path after goal met when force rebuild', () => {
    const data = dataWithLibrary([libItem('a', 17 * 60, 1), libItem('b', 15 * 60, 2)], {
      dailySeconds: { [todayKey]: 30 * 60 },
    });
    const met = resolveTodayPathUi(data, todayKey, false);
    expect(met.showGoalMet).toBe(true);
    expect(met.nodes).toHaveLength(0);

    const extra = resolveTodayPathUi(data, todayKey, true);
    expect(extra.nodes.length).toBeGreaterThan(0);
    expect(extra.nodes[0]!.state).toBe('active');
    expect(extra.showGoalMet).toBe(false);
  });
});
