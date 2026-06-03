import { inProgressLibraryItems } from './storageMigrate';
import type { LibraryItem, PersistedData, TodayPathPlan } from './storageTypes';
import { normalizeTodayPathPlan } from './todayPathPlan';
import {
  buildTodayPath,
  effectiveWatchedSec,
  isDailyGoalMetForPath,
  remainingDailySec,
  type PathBuilderCandidate,
} from './pathBuilder';

export type { TodayPathPlan } from './todayPathPlan';
export type TodayPathStep = TodayPathPlan['steps'][number];

export type PathNodeState = 'stepCompleted' | 'active' | 'available';

export interface TodayPathNodeVm {
  item: LibraryItem;
  durationSec: number;
  allocatedSec: number;
  /** Seconds already consumed on this video when the plan was built. */
  watchedSecAtBuild: number;
  practicedSecOnStep: number;
  state: PathNodeState;
  side: 'left' | 'right' | 'center';
}

export interface TodayPathUiState {
  todayKey: string;
  todayPracticeSec: number;
  dailyGoalSec: number | null;
  remainingSec: number;
  dailyGoalMet: boolean;
  hasDailyGoal: boolean;
  nodes: TodayPathNodeVm[];
  plannedTotalSec: number;
  shortfallSec: number;
  unknownDurationCount: number;
  /** Plan to persist when it was freshly built. */
  planToPersist: TodayPathPlan | null;
  showNoGoal: boolean;
  showGoalMet: boolean;
  showEmptyCandidates: boolean;
  /** In-progress saves exist but none have durationSec yet. */
  showMissingDuration: boolean;
}

function pathCandidates(data: PersistedData): {
  withDuration: PathBuilderCandidate[];
  unknownCount: number;
} {
  const inProgress = inProgressLibraryItems(data.library);
  const withDuration: PathBuilderCandidate[] = [];
  let unknownCount = 0;
  const playback = data.videoPlaybackPositionSec ?? {};
  for (const item of inProgress) {
    const d = item.durationSec;
    if (typeof d === 'number' && Number.isFinite(d) && d > 0) {
      const practice = data.videoSeconds[item.videoId] ?? 0;
      const position = playback[item.videoId] ?? 0;
      const watchedSec = effectiveWatchedSec(d, practice, position);
      withDuration.push({ item, durationSec: d, watchedSec });
    } else {
      unknownCount += 1;
    }
  }
  return { withDuration, unknownCount };
}

function planFromBuild(
  built: ReturnType<typeof buildTodayPath>,
  dateKey: string,
  remainingSec: number,
  videoSeconds: Record<string, number>,
): TodayPathPlan {
  return {
    dateKey,
    remainingSecAtBuild: remainingSec,
    builtAtMs: Date.now(),
    steps: built.steps.map((s) => ({
      videoId: s.videoId,
      durationSec: s.durationSec,
      allocatedSec: s.allocatedSec,
      videoSecondsBaseline: videoSeconds[s.videoId] ?? 0,
    })),
  };
}

function isPlanStillValid(plan: TodayPathPlan, data: PersistedData, dateKey: string): boolean {
  if (plan.dateKey !== dateKey) return false;
  const ids = new Set(inProgressLibraryItems(data.library).map((i) => i.videoId));
  return plan.steps.every((s) => ids.has(s.videoId));
}

function practicedOnStep(step: TodayPathStep, videoSeconds: Record<string, number>): number {
  const current = videoSeconds[step.videoId] ?? 0;
  return Math.max(0, current - step.videoSecondsBaseline);
}

function nodeSide(index: number, total: number): 'left' | 'right' | 'center' {
  if (total <= 1) return 'center';
  return index % 2 === 0 ? 'left' : 'right';
}

export interface ResolveTodayPathUiOptions {
  forceRebuild?: boolean;
  /** Video ids from the plan being replaced (regenerate). */
  regenerateFromVideoIds?: string[];
}

export function resolveTodayPathUi(
  data: PersistedData,
  todayKey: string,
  forceRebuild = false,
  resolveOptions: ResolveTodayPathUiOptions = {},
): TodayPathUiState {
  const regenerateFromVideoIds = resolveOptions.regenerateFromVideoIds ?? [];
  const todayPracticeSec = data.dailySeconds[todayKey] ?? 0;
  const dailyGoalSec =
    data.settings.goals?.dailyTargetSec != null && data.settings.goals.dailyTargetSec > 0
      ? data.settings.goals.dailyTargetSec
      : null;
  const hasDailyGoal = dailyGoalSec !== null;
  const dailyGoalMet = isDailyGoalMetForPath(todayPracticeSec, dailyGoalSec);
  const remainingSec = remainingDailySec(todayPracticeSec, dailyGoalSec);

  const emptyBase: TodayPathUiState = {
    todayKey,
    todayPracticeSec,
    dailyGoalSec,
    remainingSec,
    dailyGoalMet,
    hasDailyGoal,
    nodes: [],
    plannedTotalSec: 0,
    shortfallSec: 0,
    unknownDurationCount: 0,
    planToPersist: null,
    showNoGoal: !hasDailyGoal,
    showGoalMet: hasDailyGoal && dailyGoalMet,
    showEmptyCandidates: false,
    showMissingDuration: false,
  };

  if (!hasDailyGoal) return emptyBase;

  const { withDuration, unknownCount } = pathCandidates(data);
  const inProgressCount = inProgressLibraryItems(data.library).length;
  if (withDuration.length === 0 && !dailyGoalMet) {
    return {
      ...emptyBase,
      unknownDurationCount: unknownCount,
      showEmptyCandidates: inProgressCount === 0,
      showMissingDuration: inProgressCount > 0 && unknownCount > 0,
    };
  }

  const extraPracticePath = dailyGoalMet && forceRebuild;

  if (dailyGoalMet && !extraPracticePath) {
    return {
      ...emptyBase,
      unknownDurationCount: unknownCount,
      showGoalMet: true,
    };
  }

  const packRemainingSec = extraPracticePath ? dailyGoalSec! : remainingSec;

  let plan: TodayPathPlan | null = normalizeTodayPathPlan(data.todayPathPlan);
  let planToPersist: TodayPathPlan | null = null;

  if (!plan || !isPlanStillValid(plan, data, todayKey) || forceRebuild) {
    const buildOptions =
      forceRebuild && regenerateFromVideoIds.length > 0
        ? {
            sortMode: 'newestFirst' as const,
            deprioritizeVideoIds: regenerateFromVideoIds,
          }
        : forceRebuild
          ? { sortMode: 'newestFirst' as const }
          : {};
    const built = buildTodayPath(withDuration, packRemainingSec, buildOptions);
    plan = planFromBuild(built, todayKey, packRemainingSec, data.videoSeconds);
    planToPersist = plan;
  }

  const libraryById = new Map(data.library.map((i) => [i.videoId, i]));
  let activeAssigned = false;
  const nodes: TodayPathNodeVm[] = [];

  for (let i = 0; i < plan.steps.length; i += 1) {
    const step = plan.steps[i]!;
    const item = libraryById.get(step.videoId);
    if (!item || item.completedAt !== null) continue;
    const d = step.durationSec;
    const practice = data.videoSeconds[step.videoId] ?? 0;
    const position = (data.videoPlaybackPositionSec ?? {})[step.videoId] ?? 0;
    const watchedSecAtBuild = effectiveWatchedSec(d, practice, position);
    const practicedSecOnStep = practicedOnStep(step, data.videoSeconds);
    const stepDone = practicedSecOnStep >= step.allocatedSec - 1;
    let state: PathNodeState;
    if (stepDone) {
      state = 'stepCompleted';
    } else if (!activeAssigned) {
      state = 'active';
      activeAssigned = true;
    } else {
      state = 'available';
    }
    nodes.push({
      item,
      durationSec: step.durationSec,
      allocatedSec: step.allocatedSec,
      watchedSecAtBuild,
      practicedSecOnStep,
      state,
      side: nodeSide(i, plan.steps.length),
    });
  }

  const plannedTotalSec = plan.steps.reduce((a, s) => a + s.allocatedSec, 0);
  const shortfallSec = Math.max(0, packRemainingSec - plannedTotalSec);

  return {
    todayKey,
    todayPracticeSec,
    dailyGoalSec,
    remainingSec,
    dailyGoalMet,
    hasDailyGoal,
    nodes,
    plannedTotalSec,
    shortfallSec,
    unknownDurationCount: unknownCount,
    planToPersist,
    showNoGoal: false,
    showGoalMet: dailyGoalMet && nodes.length === 0,
    showEmptyCandidates: nodes.length === 0 && withDuration.length === 0 && inProgressCount === 0,
    showMissingDuration: nodes.length === 0 && withDuration.length === 0 && unknownCount > 0,
  };
}
