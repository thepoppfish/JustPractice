import type { LibraryItem } from './storageTypes';

/** Slack so rounding does not flicker goal-met at the finish line. */
export const PATH_GOAL_MET_SLACK_SEC = 30;

export interface PathBuilderCandidate {
  item: LibraryItem;
  durationSec: number;
  /** Practice + playback position already consumed on this video (seconds). */
  watchedSec?: number;
}

/** How much of the video is already consumed (capped at full length). */
export function effectiveWatchedSec(
  durationSec: number,
  practiceSec: number,
  playbackPositionSec = 0,
): number {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return 0;
  const raw = Math.max(
    0,
    Number.isFinite(practiceSec) ? practiceSec : 0,
    Number.isFinite(playbackPositionSec) ? playbackPositionSec : 0,
  );
  return Math.min(durationSec, Math.floor(raw));
}

/** Seconds still available to count toward today's path on this video. */
export function remainingVideoSec(durationSec: number, watchedSec: number): number {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return 0;
  return Math.max(0, durationSec - effectiveWatchedSec(durationSec, watchedSec, 0));
}

function candidateRemainingSec(c: PathBuilderCandidate): number {
  const watched = Math.min(c.durationSec, Math.max(0, Math.floor(c.watchedSec ?? 0)));
  return Math.max(0, c.durationSec - watched);
}

export interface PathBuilderStep {
  videoId: string;
  durationSec: number;
  allocatedSec: number;
}

export interface PathBuilderResult {
  steps: PathBuilderStep[];
  plannedTotalSec: number;
  shortfallSec: number;
}

export type PathSortMode = 'oldestFirst' | 'newestFirst';

export interface BuildTodayPathOptions {
  maxNodes?: number;
  sortMode?: PathSortMode;
  /** On regenerate: pack other videos before reusing these. */
  deprioritizeVideoIds?: string[];
}

function sortPathCandidates(
  candidates: PathBuilderCandidate[],
  sortMode: PathSortMode,
): PathBuilderCandidate[] {
  return candidates.slice().sort((a, b) => {
    if (a.item.addedAt !== b.item.addedAt) {
      return sortMode === 'newestFirst'
        ? b.item.addedAt - a.item.addedAt
        : a.item.addedAt - b.item.addedAt;
    }
    return a.durationSec - b.durationSec;
  });
}

function orderCandidatesForPack(
  candidates: PathBuilderCandidate[],
  sortMode: PathSortMode,
  deprioritizeVideoIds: string[],
): PathBuilderCandidate[] {
  const sorted = sortPathCandidates(candidates, sortMode);
  if (deprioritizeVideoIds.length === 0) return sorted;
  const skip = new Set(deprioritizeVideoIds);
  const primary = sorted.filter((c) => !skip.has(c.item.videoId));
  const secondary = sorted.filter((c) => skip.has(c.item.videoId));
  return [...primary, ...secondary];
}

function greedyPackPath(
  ordered: PathBuilderCandidate[],
  remainingSec: number,
  maxNodes: number,
): PathBuilderResult {
  const steps: PathBuilderStep[] = [];
  let sumAllocated = 0;

  for (const c of ordered) {
    if (steps.length >= maxNodes) break;
    if (sumAllocated >= remainingSec) break;

    const leftOnVideo = candidateRemainingSec(c);
    if (leftOnVideo <= 0) continue;

    const need = remainingSec - sumAllocated;
    const allocatedSec = Math.min(leftOnVideo, need);
    steps.push({
      videoId: c.item.videoId,
      durationSec: c.durationSec,
      allocatedSec,
    });
    sumAllocated += allocatedSec;
  }

  const shortfallSec = Math.max(0, remainingSec - sumAllocated);
  return { steps, plannedTotalSec: sumAllocated, shortfallSec };
}

/**
 * Greedy pack: `addedAt` order (oldest or newest), tie-break shorter videos.
 * Stops when cumulative duration ≥ remainingSec (with per-step allocation caps).
 */
export function buildTodayPath(
  candidates: PathBuilderCandidate[],
  remainingSec: number,
  options: BuildTodayPathOptions = {},
): PathBuilderResult {
  const maxNodes = options.maxNodes ?? 12;
  const sortMode = options.sortMode ?? 'oldestFirst';
  const deprioritizeVideoIds = options.deprioritizeVideoIds ?? [];

  if (remainingSec <= 0) {
    return { steps: [], plannedTotalSec: 0, shortfallSec: 0 };
  }

  const eligible = candidates.filter(
    (c) => Number.isFinite(c.durationSec) && c.durationSec > 0 && candidateRemainingSec(c) > 0,
  );
  const ordered = orderCandidatesForPack(eligible, sortMode, deprioritizeVideoIds);
  return greedyPackPath(ordered, remainingSec, maxNodes);
}

export function isDailyGoalMetForPath(
  todaySec: number,
  dailyTargetSec: number | null | undefined,
): boolean {
  if (dailyTargetSec == null || dailyTargetSec <= 0) return false;
  return todaySec >= dailyTargetSec - PATH_GOAL_MET_SLACK_SEC;
}

export function remainingDailySec(
  todaySec: number,
  dailyTargetSec: number | null | undefined,
): number {
  if (dailyTargetSec == null || dailyTargetSec <= 0) return 0;
  return Math.max(0, dailyTargetSec - todaySec);
}
