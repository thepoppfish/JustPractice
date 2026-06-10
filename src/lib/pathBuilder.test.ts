import { describe, expect, it } from 'vitest';
import {
  allocatePathStepSec,
  buildTodayPath,
  pathStepShowsVideoTotal,
  effectiveWatchedSec,
  isDailyGoalMetForPath,
  remainingDailySec,
  remainingVideoSec,
  type PathBuilderCandidate,
} from './pathBuilder';
import type { LibraryItem } from './storageTypes';

function item(videoId: string, addedAt: number): LibraryItem {
  return {
    videoId,
    title: videoId,
    channel: 'ch',
    addedAt,
    difficulty: null,
    completedAt: null,
    durationSec: null,
  };
}

function cand(videoId: string, addedAt: number, durationSec: number): PathBuilderCandidate {
  return { item: item(videoId, addedAt), durationSec };
}

describe('buildTodayPath', () => {
  it('returns empty when remaining is 0', () => {
    const r = buildTodayPath([cand('a', 1, 600)], 0);
    expect(r.steps).toHaveLength(0);
  });

  it('packs 17 + 15 min for 30 min remainder (2 nodes)', () => {
    const r = buildTodayPath(
      [
        cand('a', 100, 17 * 60),
        cand('b', 200, 15 * 60),
      ],
      30 * 60,
    );
    expect(r.steps).toHaveLength(2);
    expect(r.steps[0]!.videoId).toBe('a');
    expect(r.steps[1]!.videoId).toBe('b');
    expect(r.steps[0]!.allocatedSec).toBe(17 * 60);
    expect(r.steps[1]!.allocatedSec).toBe(13 * 60);
    expect(r.plannedTotalSec).toBe(30 * 60);
    expect(r.shortfallSec).toBe(0);
  });

  it('allocates only remainder on last node when one long video', () => {
    const r = buildTodayPath([cand('long', 1, 3 * 3600)], 30 * 60);
    expect(r.steps).toHaveLength(1);
    expect(r.steps[0]!.allocatedSec).toBe(30 * 60);
    expect(r.steps[0]!.durationSec).toBe(3 * 3600);
  });

  it('reports shortfall when library cannot cover remainder', () => {
    const r = buildTodayPath([cand('a', 1, 10 * 60)], 30 * 60);
    expect(r.steps).toHaveLength(1);
    expect(r.shortfallSec).toBe(20 * 60);
  });

  it('skips candidates without duration', () => {
    const r = buildTodayPath(
      [
        cand('a', 1, 0),
        { item: item('b', 2), durationSec: NaN },
        cand('c', 3, 20 * 60),
      ],
      15 * 60,
    );
    expect(r.steps).toHaveLength(1);
    expect(r.steps[0]!.videoId).toBe('c');
  });

  it('sorts oldest addedAt first', () => {
    const r = buildTodayPath(
      [
        cand('new', 300, 20 * 60),
        cand('old', 100, 20 * 60),
      ],
      25 * 60,
    );
    expect(r.steps[0]!.videoId).toBe('old');
  });

  it('keeps full step size when video was partially watched (not last node)', () => {
    const r = buildTodayPath(
      [
        { ...cand('partial', 1, 3600), watchedSec: 1800 },
        cand('b', 2, 3600),
        cand('c', 3, 3600),
      ],
      3 * 3600,
    );
    expect(r.plannedTotalSec).toBe(3 * 3600);
    expect(r.steps).toHaveLength(3);
    expect(r.steps.find((s) => s.videoId === 'partial')!.allocatedSec).toBe(3600);
    expect(r.steps.find((s) => s.videoId === 'c')!.allocatedSec).toBe(3600);
  });

  it('only last packed node gets a partial daily slice', () => {
    const r = buildTodayPath(
      [
        { ...cand('almostDone', 1, 577), watchedSec: 561 },
        cand('b', 2, 3600),
      ],
      30 * 60,
    );
    expect(r.steps[0]!.allocatedSec).toBe(577);
    expect(r.steps[1]!.allocatedSec).toBe(30 * 60 - 577);
  });

  it('skips fully watched videos in the pack', () => {
    const r = buildTodayPath(
      [
        { ...cand('done', 1, 3600), watchedSec: 3600 },
        cand('b', 2, 3600),
      ],
      3600,
    );
    expect(r.steps).toHaveLength(1);
    expect(r.steps[0]!.videoId).toBe('b');
  });

  it('deprioritizes previous plan videos on regenerate-style pack', () => {
    const r = buildTodayPath(
      [
        cand('a', 100, 20 * 60),
        cand('b', 200, 20 * 60),
        cand('c', 300, 20 * 60),
      ],
      20 * 60,
      { sortMode: 'newestFirst', deprioritizeVideoIds: ['c'] },
    );
    expect(r.steps[0]!.videoId).toBe('b');
  });
});

describe('pathStepShowsVideoTotal', () => {
  it('is true only when allocated is less than full duration', () => {
    expect(pathStepShowsVideoTotal(13 * 60, 15 * 60)).toBe(true);
    expect(pathStepShowsVideoTotal(17 * 60, 17 * 60)).toBe(false);
  });
});

describe('allocatePathStepSec', () => {
  it('returns daily remainder only when the next full video would overshoot', () => {
    expect(allocatePathStepSec(17 * 60, 0, 30 * 60)).toBe(17 * 60);
    expect(allocatePathStepSec(15 * 60, 17 * 60, 30 * 60)).toBe(13 * 60);
    expect(allocatePathStepSec(3 * 3600, 0, 30 * 60)).toBe(30 * 60);
  });
});

describe('effectiveWatchedSec', () => {
  it('uses max of practice and playback position capped by duration', () => {
    expect(effectiveWatchedSec(3600, 600, 1800)).toBe(1800);
    expect(effectiveWatchedSec(3600, 2400, 1800)).toBe(2400);
    expect(effectiveWatchedSec(3600, 5000, 0)).toBe(3600);
  });
});

describe('remainingVideoSec', () => {
  it('subtracts watched from duration', () => {
    expect(remainingVideoSec(3600, 1800)).toBe(1800);
  });
});

describe('remainingDailySec', () => {
  it('subtracts today from target', () => {
    expect(remainingDailySec(8 * 60, 30 * 60)).toBe(22 * 60);
  });

  it('floors at zero', () => {
    expect(remainingDailySec(40 * 60, 30 * 60)).toBe(0);
  });
});

describe('isDailyGoalMetForPath', () => {
  it('uses slack', () => {
    expect(isDailyGoalMetForPath(29 * 60 + 45, 30 * 60)).toBe(true);
  });
});
