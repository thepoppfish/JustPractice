import { describe, expect, it } from 'vitest';
import { emptyPersisted } from './storage';
import type { LibraryItem } from './storageTypes';
import {
  buildRoadmapBonusPick,
  canChangeRoadmapBonusPick,
  recommendBonusCandidates,
  resolveRoadmapBonusUi,
  roadmapBonusMultiplierForPractice,
  tierForDurationSec,
} from './roadmapBonusVideo';

function item(videoId: string, durationSec: number, addedAt: number): LibraryItem {
  return {
    videoId,
    title: videoId,
    channel: 'ch',
    addedAt,
    difficulty: null,
    completedAt: null,
    durationSec,
  };
}

describe('roadmapBonusVideo', () => {
  const todayKey = '2026-06-03';

  it('classifies duration bands', () => {
    expect(tierForDurationSec(8 * 60)).toBe('short');
    expect(tierForDurationSec(15 * 60)).toBe('medium');
    expect(tierForDurationSec(40 * 60)).toBe('long');
  });

  it('recommends oldest unwatched per tier', () => {
    const data = {
      ...emptyPersisted(),
      library: [
        item('short-old', 5 * 60, 1),
        item('short-new', 6 * 60, 2),
        item('long', 40 * 60, 3),
      ],
    };
    const rec = recommendBonusCandidates(data, todayKey, null);
    expect(rec.short?.videoId).toBe('short-old');
    expect(rec.long?.videoId).toBe('long');
    expect(rec.medium).toBeNull();
  });

  it('excludes snapshot videos and watched videos', () => {
    const data = {
      ...emptyPersisted(),
      library: [item('on-path', 10 * 60, 1), item('fresh', 12 * 60, 2), item('watched-med', 15 * 60, 3)],
      videoSeconds: { 'watched-med': 60 },
      roadmapCompletionSnapshot: {
        dateKey: todayKey,
        completedAtMs: 1,
        dailyGoalSec: 1800,
        todayPracticeSecAtComplete: 0,
        planComplete: true,
        dailyGoalMetAtComplete: false,
        steps: [
          {
            videoId: 'on-path',
            durationSec: 600,
            allocatedSec: 600,
            practicedSecOnStep: 600,
            title: 'On path',
            channel: '',
            difficulty: null,
            side: 'center',
          },
        ],
      },
    };
    const rec = recommendBonusCandidates(data, todayKey, data.roadmapCompletionSnapshot);
    expect(rec.medium?.videoId).toBe('fresh');
    expect(rec.short).toBeNull();
  });

  it('applies multiplier only for picked video today', () => {
    const pick = buildRoadmapBonusPick(
      {
        ...emptyPersisted(),
        library: [item('a', 15 * 60, 1)],
      },
      todayKey,
      'medium',
      'a',
    )!;
    const data = { ...emptyPersisted(), roadmapBonusPick: pick };
    expect(roadmapBonusMultiplierForPractice(data, 'a', todayKey)).toBe(2);
    expect(roadmapBonusMultiplierForPractice(data, 'b', todayKey)).toBe(1);
  });

  it('keeps the picked video on its tier card after practice starts', () => {
    const pick = buildRoadmapBonusPick(
      {
        ...emptyPersisted(),
        library: [item('a', 15 * 60, 1), item('b', 12 * 60, 2)],
      },
      todayKey,
      'medium',
      'a',
    )!;
    const data = {
      ...emptyPersisted(),
      library: [item('a', 15 * 60, 1), item('b', 12 * 60, 2)],
      roadmapBonusPick: pick,
      videoSeconds: { a: 120 },
      videoDailySeconds: { a: { [todayKey]: 120 } },
      roadmapCompletionSnapshot: {
        dateKey: todayKey,
        completedAtMs: 1,
        dailyGoalSec: 1800,
        todayPracticeSecAtComplete: 1800,
        planComplete: true,
        dailyGoalMetAtComplete: true,
        steps: [],
      },
    };
    const ui = resolveRoadmapBonusUi(data, todayKey, 'completed', 2);
    const medium = ui.tiers.find((t) => t.tier === 'medium');
    expect(medium?.candidate?.videoId).toBe('a');
    expect(medium?.isSelected).toBe(true);
    expect(medium?.canPick).toBe(true);
  });

  it('locks pick after practice on bonus video', () => {
    const pick = buildRoadmapBonusPick(
      {
        ...emptyPersisted(),
        library: [item('a', 15 * 60, 1)],
        videoSeconds: { a: 0 },
      },
      todayKey,
      'medium',
      'a',
    )!;
    let data = { ...emptyPersisted(), roadmapBonusPick: pick, videoSeconds: { a: 0 } };
    expect(canChangeRoadmapBonusPick(data, todayKey)).toBe(true);
    data = { ...data, videoSeconds: { a: 30 } };
    expect(canChangeRoadmapBonusPick(data, todayKey)).toBe(false);
  });
});
