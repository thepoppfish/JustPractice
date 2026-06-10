import { inProgressLibraryItems } from './storageMigrate';
import type { PersistedData, RoadmapCompletionSnapshot, TodayPathPlan } from './storageTypes';
import { normalizeTodayPathPlan } from './todayPathPlan';
import {
  buildTodayPath,
  isDailyGoalMetForPath,
  pathStepShowsVideoTotal,
  remainingDailySec,
  type PathBuilderCandidate,
} from './pathBuilder';
import { videoHasWatchTime, videoPracticeTodaySec } from './videoDailyPractice';
import {
  buildRoadmapCompletionSnapshot,
  isRoadmapPlanComplete,
  nodesFromRoadmapCompletionSnapshot,
  normalizeRoadmapCompletionSnapshot,
  shouldPlayRoadmapCelebration,
} from './roadmapCompletionSnapshot';
import { isPathStepComplete, practicedSecOnPathStep } from './pathStepProgress';

export type { TodayPathPlan } from './todayPathPlan';
export type TodayPathStep = TodayPathPlan['steps'][number];
export { practicedSecOnPathStep } from './pathStepProgress';

export type { PathNodeState, RoadmapUiMode, TodayPathNodeVm } from './todayPathTypes';
import type { PathNodeState, RoadmapUiMode, TodayPathNodeVm } from './todayPathTypes';

export interface TodayPathUiState {
  mode: RoadmapUiMode;
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
  /** Frozen completion trail for today (persist when newly complete). */
  snapshotToPersist: import('./storageTypes').RoadmapCompletionSnapshot | null;
  /** Clear stored snapshot (regenerate / new roadmap). */
  clearCompletionSnapshot: boolean;
  /** All steps on the plan were finished. */
  planComplete: boolean;
  /** Roadmap finished but daily goal not yet met. */
  showPlanCompleteOnly: boolean;
  showNoGoal: boolean;
  showGoalMet: boolean;
  showEmptyCandidates: boolean;
  /** In-progress saves exist but none have durationSec yet. */
  showMissingDuration: boolean;
  /** Library watch data changed since the plan was built. */
  showStalePlanHint: boolean;
  /** Any step is shorter than its video (show section hint). */
  showPartialStepHint: boolean;
  /** In-progress saves exist but every known-length video already has watch time. */
  showNoUnwatchedVideos: boolean;
  /** Run the completion celebration overlay once (R2). */
  playCompletionCelebration: boolean;
}

function pathCandidates(data: PersistedData, todayKey: string): {
  withDuration: PathBuilderCandidate[];
  unknownCount: number;
  watchedDisqualifiedCount: number;
} {
  const inProgress = inProgressLibraryItems(data.library);
  const withDuration: PathBuilderCandidate[] = [];
  let unknownCount = 0;
  let watchedDisqualifiedCount = 0;
  for (const item of inProgress) {
    const d = item.durationSec;
    if (typeof d !== 'number' || !Number.isFinite(d) || d <= 0) {
      unknownCount += 1;
      continue;
    }
    if (videoHasWatchTime(data, item.videoId, todayKey)) {
      watchedDisqualifiedCount += 1;
      continue;
    }
    withDuration.push({ item, durationSec: d });
  }
  return { withDuration, unknownCount, watchedDisqualifiedCount };
}

function planFromBuild(
  built: ReturnType<typeof buildTodayPath>,
  dateKey: string,
  remainingSec: number,
  data: PersistedData,
): TodayPathPlan {
  return {
    dateKey,
    remainingSecAtBuild: remainingSec,
    builtAtMs: Date.now(),
    steps: built.steps.map((s) => {
      const todayPractice = videoPracticeTodaySec(data, s.videoId, dateKey);
      const creditedSecAtBuild = Math.min(s.allocatedSec, todayPractice);
      return {
        videoId: s.videoId,
        durationSec: s.durationSec,
        allocatedSec: s.allocatedSec,
        videoSecondsBaseline: data.videoSeconds[s.videoId] ?? 0,
        videoDailyBaselineAtBuild: todayPractice,
        creditedSecAtBuild,
      };
    }),
  };
}

/** Keep today's plan while steps still exist in the library (watch progress is expected). */
function isPlanStillValid(plan: TodayPathPlan, data: PersistedData, dateKey: string): boolean {
  if (plan.dateKey !== dateKey) return false;
  const libraryIds = new Set(data.library.map((i) => i.videoId));
  return plan.steps.length > 0 && plan.steps.every((s) => libraryIds.has(s.videoId));
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

function withCelebrationFlag(
  state: TodayPathUiState,
  snapshotToPersist: RoadmapCompletionSnapshot | null,
  storedSnapshot: RoadmapCompletionSnapshot | null,
): TodayPathUiState {
  return {
    ...state,
    playCompletionCelebration: shouldPlayRoadmapCelebration(
      state.mode,
      state.nodes.length,
      snapshotToPersist,
      storedSnapshot,
    ),
  };
}

function completedUiFromSnapshot(
  snapshot: RoadmapCompletionSnapshot,
  base: TodayPathUiState,
): TodayPathUiState {
  const nodes = nodesFromRoadmapCompletionSnapshot(snapshot);
  const plannedTotalSec = snapshot.steps.reduce((a, s) => a + s.allocatedSec, 0);
  return {
    ...base,
    mode: 'completed',
    nodes,
    plannedTotalSec,
    shortfallSec: 0,
    planToPersist: null,
    snapshotToPersist: null,
    clearCompletionSnapshot: false,
    planComplete: snapshot.planComplete,
    showPlanCompleteOnly: snapshot.planComplete && !snapshot.dailyGoalMetAtComplete,
    showGoalMet: snapshot.dailyGoalMetAtComplete,
    showStalePlanHint: false,
    showPartialStepHint: nodes.some((n) => n.showVideoLengthTotal),
    showEmptyCandidates: false,
    showMissingDuration: false,
    showNoUnwatchedVideos: false,
    playCompletionCelebration: false,
  };
}

function maybeSnapshotFromPlan(
  plan: TodayPathPlan,
  data: PersistedData,
  todayKey: string,
  dailyGoalSec: number,
  todayPracticeSec: number,
  dailyGoalMet: boolean,
): RoadmapCompletionSnapshot | null {
  const planComplete = isRoadmapPlanComplete(plan, data, todayKey);
  if (!planComplete && !dailyGoalMet) return null;
  return buildRoadmapCompletionSnapshot(plan, data, todayKey, {
    dailyGoalSec,
    todayPracticeSec,
    planComplete,
    dailyGoalMetAtComplete: dailyGoalMet,
  });
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
    mode: 'active',
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
    snapshotToPersist: null,
    clearCompletionSnapshot: forceRebuild,
    planComplete: false,
    showPlanCompleteOnly: false,
    showNoGoal: !hasDailyGoal,
    showGoalMet: hasDailyGoal && dailyGoalMet,
    showEmptyCandidates: false,
    showMissingDuration: false,
    showStalePlanHint: false,
    showPartialStepHint: false,
    showNoUnwatchedVideos: false,
    playCompletionCelebration: false,
  };

  if (!hasDailyGoal) return emptyBase;

  const storedSnapshot = normalizeRoadmapCompletionSnapshot(data.roadmapCompletionSnapshot);
  if (!forceRebuild && storedSnapshot?.dateKey === todayKey) {
    return withCelebrationFlag(
      completedUiFromSnapshot(storedSnapshot, {
        ...emptyBase,
        todayPracticeSec,
        dailyGoalMet,
        remainingSec,
      }),
      null,
      storedSnapshot,
    );
  }

  const planForCompletion = normalizeTodayPathPlan(data.todayPathPlan);
  if (!forceRebuild && planForCompletion && planForCompletion.dateKey === todayKey) {
    const snap = maybeSnapshotFromPlan(
      planForCompletion,
      data,
      todayKey,
      dailyGoalSec!,
      todayPracticeSec,
      dailyGoalMet,
    );
    if (snap) {
      const pending = storedSnapshot ? null : snap;
      return withCelebrationFlag(
        {
          ...completedUiFromSnapshot(snap, emptyBase),
          snapshotToPersist: pending,
        },
        pending,
        storedSnapshot,
      );
    }
  }

  const { withDuration, unknownCount, watchedDisqualifiedCount } = pathCandidates(
    data,
    todayKey,
  );
  const inProgressCount = inProgressLibraryItems(data.library).length;

  const extraPracticePath = dailyGoalMet && forceRebuild;

  const packRemainingSec = extraPracticePath ? dailyGoalSec! : remainingSec;

  let plan: TodayPathPlan | null = planForCompletion;
  let planToPersist: TodayPathPlan | null = null;
  let snapshotToPersist: RoadmapCompletionSnapshot | null = null;

  // Once a plan exists for today it is locked: keep its exact steps (watch time
  // on them is expected) until the user regenerates or starts a new day. Only the
  // build path below cares about unwatched candidates / goal-met empty states.
  const keepExistingPlan = !forceRebuild && plan !== null && isPlanStillValid(plan, data, todayKey);

  if (!keepExistingPlan) {
    if (withDuration.length === 0 && !dailyGoalMet) {
      return {
        ...emptyBase,
        unknownDurationCount: unknownCount,
        showEmptyCandidates: inProgressCount === 0,
        showMissingDuration: inProgressCount > 0 && unknownCount > 0,
        showNoUnwatchedVideos:
          inProgressCount > 0 && unknownCount === 0 && watchedDisqualifiedCount > 0,
      };
    }

    if (dailyGoalMet && !extraPracticePath) {
      return {
        ...emptyBase,
        unknownDurationCount: unknownCount,
        showGoalMet: true,
      };
    }

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
    plan = planFromBuild(built, todayKey, packRemainingSec, data);
    planToPersist = plan;
  }

  if (!plan) {
    return { ...emptyBase, unknownDurationCount: unknownCount };
  }

  const libraryById = new Map(data.library.map((i) => [i.videoId, i]));
  let activeAssigned = false;
  const nodes: TodayPathNodeVm[] = [];

  for (let i = 0; i < plan.steps.length; i += 1) {
    const step = plan.steps[i]!;
    const item = libraryById.get(step.videoId);
    if (!item) continue;
    const d = step.durationSec;
    const todayPractice = videoPracticeTodaySec(data, step.videoId, todayKey);
    const practicedTodayAtBuild = step.videoDailyBaselineAtBuild ?? todayPractice;
    const practiceForStep =
      step.videoDailyBaselineAtBuild !== undefined
        ? todayPractice
        : (data.videoSeconds[step.videoId] ?? 0);
    const practicedSecOnStep = practicedSecOnPathStep(step, practiceForStep);
    const stepDone = isPathStepComplete(step, data, todayKey);
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
      practicedTodayAtBuild,
      practicedSecOnStep,
      showVideoLengthTotal: pathStepShowsVideoTotal(step.allocatedSec, d),
      state,
      side: nodeSide(i, plan.steps.length),
    });
  }

  const plannedTotalSec = plan.steps.reduce((a, s) => a + s.allocatedSec, 0);
  const showPartialStepHint = nodes.some((n) => n.showVideoLengthTotal);
  const shortfallSec = Math.max(0, packRemainingSec - plannedTotalSec);
  const planComplete = plan ? isRoadmapPlanComplete(plan, data, todayKey) : false;
  const shouldFreezeTrail =
    planComplete || (dailyGoalMet && !extraPracticePath && plan !== null && plan.steps.length > 0);
  if (!snapshotToPersist && plan && shouldFreezeTrail) {
    snapshotToPersist = maybeSnapshotFromPlan(
      plan,
      data,
      todayKey,
      dailyGoalSec!,
      todayPracticeSec,
      dailyGoalMet,
    );
  }

  if (snapshotToPersist) {
    const pending = storedSnapshot ? null : snapshotToPersist;
    return withCelebrationFlag(
      {
        ...completedUiFromSnapshot(snapshotToPersist, emptyBase),
        snapshotToPersist: pending,
        planToPersist,
        unknownDurationCount: unknownCount,
      },
      pending,
      storedSnapshot,
    );
  }

  return {
    mode: 'active',
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
    snapshotToPersist: null,
    clearCompletionSnapshot: false,
    planComplete,
    showPlanCompleteOnly: planComplete && !dailyGoalMet,
    showNoGoal: false,
    showGoalMet: dailyGoalMet && nodes.length === 0,
    showEmptyCandidates: nodes.length === 0 && withDuration.length === 0 && inProgressCount === 0,
    showMissingDuration: nodes.length === 0 && withDuration.length === 0 && unknownCount > 0,
    showStalePlanHint: false,
    showPartialStepHint,
    showNoUnwatchedVideos: false,
    playCompletionCelebration: false,
  };
}
