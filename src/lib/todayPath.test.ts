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

  it('aligns planned total with daily remainder when practice is on other videos', () => {
    const todayKeyLocal = todayKey;
    const data = dataWithLibrary(
      [libItem('a', 3600, 1), libItem('b', 3600, 2), libItem('c', 3600, 3)],
      {
        ...threeHourGoal,
        dailySeconds: { [todayKeyLocal]: 1800 },
        videoSeconds: { a: 1800 },
        videoDailySeconds: { a: { [todayKeyLocal]: 1800 } },
      },
    );
    const ui = resolveTodayPathUi(data, todayKeyLocal, true);
    expect(ui.remainingSec).toBe(150 * 60);
    expect(ui.plannedTotalSec).toBe(2 * 3600);
    expect(ui.shortfallSec).toBe(150 * 60 - 2 * 3600);
    expect(ui.nodes.every((n) => n.item.videoId !== 'a')).toBe(true);
  });

  it('excludes videos with lifetime watch time from the roadmap', () => {
    const data = dataWithLibrary(
      [libItem('a', 3600, 1), libItem('b', 3600, 2), libItem('c', 3600, 3)],
      { ...threeHourGoal, videoSeconds: { a: 1800 } },
    );
    const ui = resolveTodayPathUi(data, todayKey, true);
    expect(ui.nodes.find((n) => n.item.videoId === 'a')).toBeUndefined();
    expect(ui.plannedTotalSec).toBe(2 * 3600);
  });

  it('shows empty state when all in-progress videos have watch time', () => {
    const data = dataWithLibrary([libItem('a', 3600, 1)], {
      videoSeconds: { a: 100 },
    });
    const ui = resolveTodayPathUi(data, todayKey, true);
    expect(ui.showNoUnwatchedVideos).toBe(true);
    expect(ui.nodes).toHaveLength(0);
  });

  it('keeps the same path after practicing the first step', () => {
    const data = dataWithLibrary([
      libItem('a', 17 * 60, 1),
      libItem('b', 15 * 60, 2),
      libItem('c', 60 * 60, 3),
    ]);
    const first = resolveTodayPathUi(data, todayKey, false);
    expect(first.planToPersist).not.toBeNull();
    const plan = first.planToPersist!;

    const afterStepOne = dataWithLibrary(
      [
        libItem('a', 17 * 60, 1),
        libItem('b', 15 * 60, 2),
        libItem('c', 60 * 60, 3),
      ],
      {
        todayPathPlan: plan,
        dailySeconds: { [todayKey]: 17 * 60 },
        videoSeconds: { a: 17 * 60 },
        videoDailySeconds: { a: { [todayKey]: 17 * 60 } },
      },
    );
    const second = resolveTodayPathUi(afterStepOne, todayKey, false);
    expect(second.planToPersist).toBeNull();
    expect(second.nodes.map((n) => n.item.videoId)).toEqual(
      first.nodes.map((n) => n.item.videoId),
    );
    expect(second.nodes[0]!.state).toBe('stepCompleted');
    expect(second.nodes[1]!.state).toBe('active');
    expect(second.showStalePlanHint).toBe(false);
  });

  it('keeps a single-video plan locked after partial watch time', () => {
    const plan: TodayPathPlan = {
      dateKey: todayKey,
      remainingSecAtBuild: 30 * 60,
      builtAtMs: 1,
      steps: [
        {
          videoId: 'a',
          durationSec: 30 * 60,
          allocatedSec: 30 * 60,
          videoSecondsBaseline: 0,
          videoDailyBaselineAtBuild: 0,
          creditedSecAtBuild: 0,
        },
      ],
    };
    const data = dataWithLibrary([libItem('a', 30 * 60, 1)], {
      todayPathPlan: plan,
      dailySeconds: { [todayKey]: 5 * 60 },
      videoSeconds: { a: 5 * 60 },
      videoDailySeconds: { a: { [todayKey]: 5 * 60 } },
    });
    const ui = resolveTodayPathUi(data, todayKey, false);
    expect(ui.mode).toBe('active');
    expect(ui.showNoUnwatchedVideos).toBe(false);
    expect(ui.nodes.map((n) => n.item.videoId)).toEqual(['a']);
    expect(ui.nodes[0]!.state).toBe('active');
    expect(ui.planToPersist).toBeNull();
  });

  it('keeps the plan locked even when every step has watch time', () => {
    const plan: TodayPathPlan = {
      dateKey: todayKey,
      remainingSecAtBuild: 30 * 60,
      builtAtMs: 1,
      steps: [
        {
          videoId: 'a',
          durationSec: 17 * 60,
          allocatedSec: 17 * 60,
          videoSecondsBaseline: 0,
          videoDailyBaselineAtBuild: 0,
          creditedSecAtBuild: 0,
        },
        {
          videoId: 'b',
          durationSec: 15 * 60,
          allocatedSec: 13 * 60,
          videoSecondsBaseline: 0,
          videoDailyBaselineAtBuild: 0,
          creditedSecAtBuild: 0,
        },
      ],
    };
    const data = dataWithLibrary([libItem('a', 17 * 60, 1), libItem('b', 15 * 60, 2)], {
      todayPathPlan: plan,
      dailySeconds: { [todayKey]: 20 * 60 },
      videoSeconds: { a: 17 * 60, b: 3 * 60 },
      videoDailySeconds: { a: { [todayKey]: 17 * 60 }, b: { [todayKey]: 3 * 60 } },
    });
    const ui = resolveTodayPathUi(data, todayKey, false);
    expect(ui.nodes.map((n) => n.item.videoId)).toEqual(['a', 'b']);
    expect(ui.nodes[0]!.state).toBe('stepCompleted');
    expect(ui.nodes[1]!.state).toBe('active');
    expect(ui.showNoUnwatchedVideos).toBe(false);
    expect(ui.planToPersist).toBeNull();
  });

  it('keeps the same path when the first step is marked library complete', () => {
    const data = dataWithLibrary([
      libItem('a', 17 * 60, 1),
      libItem('b', 15 * 60, 2),
    ]);
    const first = resolveTodayPathUi(data, todayKey, false);
    const plan = first.planToPersist!;
    const library = [
      { ...libItem('a', 17 * 60, 1), completedAt: 99 },
      libItem('b', 15 * 60, 2),
    ];
    const afterMarkDone = dataWithLibrary(library, { todayPathPlan: plan });
    const second = resolveTodayPathUi(afterMarkDone, todayKey, false);
    expect(second.nodes.map((n) => n.item.videoId)).toEqual(['a', 'b']);
    expect(second.nodes[0]!.state).toBe('stepCompleted');
    expect(second.nodes[1]!.state).toBe('active');
  });

  it('rebuilds when a planned video was removed from the library', () => {
    const data = dataWithLibrary([
      libItem('a', 17 * 60, 1),
      libItem('b', 15 * 60, 2),
      libItem('c', 20 * 60, 3),
    ]);
    const first = resolveTodayPathUi(data, todayKey, false);
    const plan = first.planToPersist!;
    const withoutA = dataWithLibrary([libItem('b', 15 * 60, 2), libItem('c', 20 * 60, 3)], {
      todayPathPlan: plan,
    });
    const rebuilt = resolveTodayPathUi(withoutA, todayKey, false);
    expect(rebuilt.planToPersist).not.toBeNull();
    expect(rebuilt.nodes.every((n) => n.item.videoId !== 'a')).toBe(true);
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
    expect(ui.planToPersist!.steps[0]!.videoDailyBaselineAtBuild).toBe(0);
    expect(ui.nodes[0]!.showVideoLengthTotal).toBe(false);
    expect(ui.nodes[1]!.showVideoLengthTotal).toBe(true);
    expect(ui.showPartialStepHint).toBe(true);
  });

  it('hides video total when the only step is a full video', () => {
    const data = dataWithLibrary([libItem('a', 20 * 60, 1)]);
    const ui = resolveTodayPathUi(data, todayKey, false);
    expect(ui.nodes).toHaveLength(1);
    expect(ui.nodes[0]!.showVideoLengthTotal).toBe(false);
    expect(ui.showPartialStepHint).toBe(false);
  });

  it('credits today practice that existed when the plan was built', () => {
    const step: TodayPathPlan['steps'][number] = {
      videoId: 'a',
      durationSec: 2008,
      allocatedSec: 905,
      videoSecondsBaseline: 1103,
      videoDailyBaselineAtBuild: 600,
      creditedSecAtBuild: 600,
    };
    expect(practicedSecOnPathStep(step, 600)).toBe(600);
    expect(practicedSecOnPathStep(step, 905)).toBe(905);
    expect(practicedSecOnPathStep(step, 1200)).toBe(905);
  });

  it('shows completed trail when plan steps are done but video has watch time', () => {
    const data = dataWithLibrary([libItem('a', 20 * 60, 1)], {
      videoDailySeconds: { a: { [todayKey]: 20 * 60 } },
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
            videoDailyBaselineAtBuild: 0,
            creditedSecAtBuild: 0,
          },
        ],
      },
    });
    const ui = resolveTodayPathUi(data, todayKey, false);
    expect(ui.mode).toBe('completed');
    expect(ui.nodes).toHaveLength(1);
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
