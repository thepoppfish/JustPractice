import type { LibraryItem, RoadmapCompletionSnapshot, TodayPathPlan } from './storageTypes';
import { pathStepShowsVideoTotal } from './pathBuilder';
import { isPathStepComplete, practicedSecOnPathStep } from './pathStepProgress';
import type { TodayPathNodeVm } from './todayPathTypes';
import { videoPracticeTodaySec } from './videoDailyPractice';

export type { RoadmapCompletionSnapshot };

export function normalizeRoadmapCompletionSnapshot(raw: unknown): RoadmapCompletionSnapshot | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const dateKey = typeof o.dateKey === 'string' ? o.dateKey : '';
  if (!dateKey) return null;
  const completedAtMs =
    typeof o.completedAtMs === 'number' && Number.isFinite(o.completedAtMs) ? o.completedAtMs : Date.now();
  const dailyGoalSec =
    typeof o.dailyGoalSec === 'number' && Number.isFinite(o.dailyGoalSec) ? Math.max(0, o.dailyGoalSec) : 0;
  const todayPracticeSecAtComplete =
    typeof o.todayPracticeSecAtComplete === 'number' && Number.isFinite(o.todayPracticeSecAtComplete)
      ? Math.max(0, o.todayPracticeSecAtComplete)
      : 0;
  const planComplete = o.planComplete === true;
  const dailyGoalMetAtComplete = o.dailyGoalMetAtComplete === true;
  const celebrationShownAtMs =
    typeof o.celebrationShownAtMs === 'number' && Number.isFinite(o.celebrationShownAtMs)
      ? o.celebrationShownAtMs
      : undefined;
  const stepsRaw = Array.isArray(o.steps) ? o.steps : [];
  const steps: RoadmapCompletionSnapshot['steps'] = [];
  for (const s of stepsRaw) {
    if (!s || typeof s !== 'object') continue;
    const st = s as Record<string, unknown>;
    const videoId = typeof st.videoId === 'string' ? st.videoId : '';
    if (!videoId) continue;
    const durationSec =
      typeof st.durationSec === 'number' && Number.isFinite(st.durationSec) && st.durationSec > 0
        ? st.durationSec
        : 0;
    const allocatedSec =
      typeof st.allocatedSec === 'number' && Number.isFinite(st.allocatedSec) && st.allocatedSec > 0
        ? st.allocatedSec
        : 0;
    const practicedSecOnStep =
      typeof st.practicedSecOnStep === 'number' && Number.isFinite(st.practicedSecOnStep)
        ? Math.max(0, Math.floor(st.practicedSecOnStep))
        : 0;
    const title = typeof st.title === 'string' ? st.title : videoId;
    const channel = typeof st.channel === 'string' ? st.channel : '';
    const difficulty = st.difficulty === null || typeof st.difficulty === 'string' ? st.difficulty : null;
    const side = st.side === 'left' || st.side === 'right' || st.side === 'center' ? st.side : 'center';
    if (durationSec <= 0 || allocatedSec <= 0) continue;
    steps.push({
      videoId,
      durationSec,
      allocatedSec,
      practicedSecOnStep: Math.min(allocatedSec, practicedSecOnStep),
      title,
      channel,
      difficulty,
      side,
    });
  }
  if (steps.length === 0) return null;
  return {
    dateKey,
    completedAtMs,
    dailyGoalSec,
    todayPracticeSecAtComplete,
    planComplete,
    dailyGoalMetAtComplete,
    celebrationShownAtMs,
    steps,
  };
}

export function markRoadmapCelebrationShown(
  snapshot: RoadmapCompletionSnapshot,
): RoadmapCompletionSnapshot {
  return { ...snapshot, celebrationShownAtMs: Date.now() };
}

/** Play the trail celebration once per completion snapshot. */
export function shouldPlayRoadmapCelebration(
  mode: 'active' | 'completed',
  nodeCount: number,
  snapshotToPersist: RoadmapCompletionSnapshot | null,
  storedSnapshot: RoadmapCompletionSnapshot | null,
): boolean {
  if (mode !== 'completed' || nodeCount === 0) return false;
  if (snapshotToPersist) return true;
  if (storedSnapshot && !storedSnapshot.celebrationShownAtMs) return true;
  return false;
}

function practiceSecForStep(
  step: TodayPathPlan['steps'][number],
  data: Pick<import('./storageTypes').PersistedData, 'videoSeconds' | 'videoDailySeconds'>,
  todayKey: string,
): number {
  const todayPractice = videoPracticeTodaySec(data, step.videoId, todayKey);
  const practiceForStep =
    step.videoDailyBaselineAtBuild !== undefined
      ? todayPractice
      : (data.videoSeconds[step.videoId] ?? 0);
  return practicedSecOnPathStep(step, practiceForStep);
}

/** True when every plan step has met its allocated slice. */
export function isRoadmapPlanComplete(
  plan: TodayPathPlan,
  data: Pick<
    import('./storageTypes').PersistedData,
    'library' | 'videoSeconds' | 'videoDailySeconds'
  >,
  todayKey: string,
): boolean {
  if (plan.steps.length === 0) return false;
  return plan.steps.every((step) => isPathStepComplete(step, data, todayKey));
}

export function buildRoadmapCompletionSnapshot(
  plan: TodayPathPlan,
  data: Pick<
    import('./storageTypes').PersistedData,
    'library' | 'videoSeconds' | 'videoDailySeconds'
  >,
  todayKey: string,
  opts: {
    dailyGoalSec: number;
    todayPracticeSec: number;
    planComplete: boolean;
    dailyGoalMetAtComplete: boolean;
  },
): RoadmapCompletionSnapshot {
  const libraryById = new Map(data.library.map((i) => [i.videoId, i]));
  const total = plan.steps.length;
  return {
    dateKey: todayKey,
    completedAtMs: Date.now(),
    dailyGoalSec: opts.dailyGoalSec,
    todayPracticeSecAtComplete: opts.todayPracticeSec,
    planComplete: opts.planComplete,
    dailyGoalMetAtComplete: opts.dailyGoalMetAtComplete,
    steps: plan.steps.map((step, index) => {
      const item = libraryById.get(step.videoId);
      const practicedSecOnStep = practiceSecForStep(step, data, todayKey);
      const side =
        total <= 1 ? 'center' : index % 2 === 0 ? 'left' : 'right';
      return {
        videoId: step.videoId,
        durationSec: step.durationSec,
        allocatedSec: step.allocatedSec,
        practicedSecOnStep: Math.min(step.allocatedSec, practicedSecOnStep),
        title: item?.title ?? step.videoId,
        channel: item?.channel ?? '',
        difficulty: item?.difficulty ?? null,
        side,
      };
    }),
  };
}

function snapshotItemFromStep(step: RoadmapCompletionSnapshot['steps'][number]): LibraryItem {
  return {
    videoId: step.videoId,
    title: step.title,
    channel: step.channel,
    difficulty: step.difficulty,
    addedAt: 0,
    completedAt: null,
    durationSec: step.durationSec,
  };
}

export function nodesFromRoadmapCompletionSnapshot(
  snapshot: RoadmapCompletionSnapshot,
): TodayPathNodeVm[] {
  return snapshot.steps.map((step) => ({
    item: snapshotItemFromStep(step),
    durationSec: step.durationSec,
    allocatedSec: step.allocatedSec,
    practicedTodayAtBuild: 0,
    practicedSecOnStep: Math.min(step.allocatedSec, step.practicedSecOnStep),
    showVideoLengthTotal: pathStepShowsVideoTotal(step.allocatedSec, step.durationSec),
    state: 'stepCompleted' as const,
    side: step.side,
  }));
}
