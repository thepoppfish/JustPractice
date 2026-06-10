import type { PersistedData, TodayPathPlan } from './storageTypes';
import { videoPracticeTodaySec } from './videoDailyPractice';

export type TodayPathStep = TodayPathPlan['steps'][number];

/** Step progress: credit at plan build plus new practice today since baseline (capped at allocated). */
export function practicedSecOnPathStep(
  step: TodayPathStep,
  todayPracticeSecNow: number,
): number {
  if (step.videoDailyBaselineAtBuild !== undefined) {
    const baseline = step.videoDailyBaselineAtBuild;
    const credited = step.creditedSecAtBuild ?? Math.min(step.allocatedSec, baseline);
    const sincePlan = Math.max(0, todayPracticeSecNow - baseline);
    return Math.min(step.allocatedSec, credited + sincePlan);
  }
  const credited = step.creditedSecAtBuild ?? 0;
  const sincePlan = Math.max(0, todayPracticeSecNow - step.videoSecondsBaseline);
  return Math.min(step.allocatedSec, credited + sincePlan);
}

function practiceSecNowForStep(
  step: TodayPathStep,
  data: Pick<PersistedData, 'videoSeconds' | 'videoDailySeconds'>,
  todayKey: string,
): number {
  const todayPractice = videoPracticeTodaySec(data, step.videoId, todayKey);
  const practiceForStep =
    step.videoDailyBaselineAtBuild !== undefined
      ? todayPractice
      : (data.videoSeconds[step.videoId] ?? 0);
  return practicedSecOnPathStep(step, practiceForStep);
}

/** Step done when allocated practice is met or the library item was marked complete. */
export function isPathStepComplete(
  step: TodayPathStep,
  data: Pick<PersistedData, 'library' | 'videoSeconds' | 'videoDailySeconds'>,
  todayKey: string,
): boolean {
  const item = data.library.find((i) => i.videoId === step.videoId);
  if (item?.completedAt != null) return true;
  return practiceSecNowForStep(step, data, todayKey) >= step.allocatedSec - 1;
}
