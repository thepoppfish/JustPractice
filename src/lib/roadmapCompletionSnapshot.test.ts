import { describe, expect, it } from 'vitest';
import { emptyPersisted } from './storage';
import type { TodayPathPlan } from './storageTypes';
import {
  buildRoadmapCompletionSnapshot,
  isRoadmapPlanComplete,
  nodesFromRoadmapCompletionSnapshot,
  normalizeRoadmapCompletionSnapshot,
} from './roadmapCompletionSnapshot';
import { resolveTodayPathUi } from './todayPath';

describe('roadmapCompletionSnapshot', () => {
  it('normalizes snapshot steps', () => {
    const snap = normalizeRoadmapCompletionSnapshot({
      dateKey: '2026-06-03',
      completedAtMs: 1,
      dailyGoalSec: 1800,
      todayPracticeSecAtComplete: 1800,
      planComplete: true,
      dailyGoalMetAtComplete: true,
      steps: [
        {
          videoId: 'v1',
          durationSec: 600,
          allocatedSec: 600,
          practicedSecOnStep: 600,
          title: 'Lesson',
          channel: 'ch',
          difficulty: 'N5',
          side: 'center',
        },
      ],
    });
    expect(snap?.steps).toHaveLength(1);
    expect(snap?.steps[0]!.title).toBe('Lesson');
  });

  it('builds all-gold nodes from snapshot', () => {
    const snap = normalizeRoadmapCompletionSnapshot({
      dateKey: '2026-06-03',
      completedAtMs: 1,
      dailyGoalSec: 1800,
      todayPracticeSecAtComplete: 900,
      planComplete: true,
      dailyGoalMetAtComplete: false,
      steps: [
        {
          videoId: 'v1',
          durationSec: 600,
          allocatedSec: 600,
          practicedSecOnStep: 600,
          title: 'A',
          channel: '',
          difficulty: null,
          side: 'left',
        },
      ],
    })!;
    const nodes = nodesFromRoadmapCompletionSnapshot(snap);
    expect(nodes).toHaveLength(1);
    expect(nodes[0]!.state).toBe('stepCompleted');
  });
});

describe('resolveTodayPathUi completion', () => {
  const todayKey = '2026-06-03';

  it('enters completed mode with snapshot when plan steps are done', () => {
    const plan: TodayPathPlan = {
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
    };
    const data = {
      ...emptyPersisted(),
      library: [
        {
          videoId: 'a',
          title: 'Video A',
          channel: 'ch',
          addedAt: 1,
          difficulty: null,
          completedAt: null,
          durationSec: 20 * 60,
        },
      ],
      settings: {
        ...emptyPersisted().settings,
        goals: { dailyTargetSec: 30 * 60, weeklyTargetSec: null, monthlyTargetSec: null },
      },
      videoDailySeconds: { a: { [todayKey]: 20 * 60 } },
      todayPathPlan: plan,
    };
    expect(isRoadmapPlanComplete(plan, data, todayKey)).toBe(true);
    const ui = resolveTodayPathUi(data, todayKey, false);
    expect(ui.mode).toBe('completed');
    expect(ui.nodes).toHaveLength(1);
    expect(ui.nodes[0]!.state).toBe('stepCompleted');
    expect(ui.snapshotToPersist).not.toBeNull();
  });

  it('reads stored snapshot even when videos now have watch time', () => {
    const snap = buildRoadmapCompletionSnapshot(
      {
        dateKey: todayKey,
        remainingSecAtBuild: 600,
        builtAtMs: 1,
        steps: [
          {
            videoId: 'a',
            durationSec: 600,
            allocatedSec: 600,
            videoSecondsBaseline: 0,
            videoDailyBaselineAtBuild: 0,
            creditedSecAtBuild: 0,
          },
        ],
      },
      {
        library: [
          {
            videoId: 'a',
            title: 'A',
            channel: '',
            addedAt: 1,
            difficulty: null,
            completedAt: null,
            durationSec: 600,
          },
        ],
        videoSeconds: { a: 600 },
        videoDailySeconds: { a: { [todayKey]: 600 } },
      },
      todayKey,
      {
        dailyGoalSec: 1800,
        todayPracticeSec: 600,
        planComplete: true,
        dailyGoalMetAtComplete: false,
      },
    );
    const ui = resolveTodayPathUi(
      {
        ...emptyPersisted(),
        settings: {
          ...emptyPersisted().settings,
          goals: { dailyTargetSec: 30 * 60, weeklyTargetSec: null, monthlyTargetSec: null },
        },
        roadmapCompletionSnapshot: snap,
        videoSeconds: { a: 600 },
        videoDailySeconds: { a: { [todayKey]: 600 } },
      },
      todayKey,
      false,
    );
    expect(ui.mode).toBe('completed');
    expect(ui.nodes).toHaveLength(1);
    expect(ui.snapshotToPersist).toBeNull();
  });
});
