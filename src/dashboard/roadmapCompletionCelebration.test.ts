import { describe, expect, it } from 'vitest';
import { shouldPlayRoadmapCelebration } from '../lib/roadmapCompletionSnapshot';
import type { RoadmapCompletionSnapshot } from '../lib/storageTypes';

const snap: RoadmapCompletionSnapshot = {
  dateKey: '2026-06-03',
  completedAtMs: 1,
  dailyGoalSec: 1800,
  todayPracticeSecAtComplete: 900,
  planComplete: true,
  dailyGoalMetAtComplete: false,
  steps: [
    {
      videoId: 'a',
      durationSec: 600,
      allocatedSec: 600,
      practicedSecOnStep: 600,
      title: 'A',
      channel: '',
      difficulty: null,
      side: 'center',
    },
  ],
};

describe('shouldPlayRoadmapCelebration', () => {
  it('plays for new snapshot to persist', () => {
    expect(shouldPlayRoadmapCelebration('completed', 1, snap, null)).toBe(true);
  });

  it('plays when stored snapshot never celebrated', () => {
    expect(shouldPlayRoadmapCelebration('completed', 1, null, snap)).toBe(true);
  });

  it('skips when celebration already shown', () => {
    expect(
      shouldPlayRoadmapCelebration('completed', 1, null, {
        ...snap,
        celebrationShownAtMs: 99,
      }),
    ).toBe(false);
  });

  it('skips in active mode', () => {
    expect(shouldPlayRoadmapCelebration('active', 2, snap, null)).toBe(false);
  });
});
