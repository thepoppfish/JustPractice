import type { TodayPathPlan } from './storageTypes';

export type { TodayPathPlan };

export function normalizeTodayPathPlan(raw: unknown): TodayPathPlan | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const dateKey = typeof o.dateKey === 'string' ? o.dateKey : '';
  if (!dateKey) return null;
  const remainingSecAtBuild =
    typeof o.remainingSecAtBuild === 'number' && Number.isFinite(o.remainingSecAtBuild)
      ? Math.max(0, Math.floor(o.remainingSecAtBuild))
      : 0;
  const builtAtMs =
    typeof o.builtAtMs === 'number' && Number.isFinite(o.builtAtMs) ? o.builtAtMs : Date.now();
  const stepsRaw = Array.isArray(o.steps) ? o.steps : [];
  const steps: TodayPathPlan['steps'] = [];
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
    const videoSecondsBaseline =
      typeof st.videoSecondsBaseline === 'number' && Number.isFinite(st.videoSecondsBaseline)
        ? Math.max(0, st.videoSecondsBaseline)
        : 0;
    if (durationSec <= 0 || allocatedSec <= 0) continue;
    steps.push({ videoId, durationSec, allocatedSec, videoSecondsBaseline });
  }
  if (steps.length === 0 && remainingSecAtBuild > 0) return null;
  return { dateKey, remainingSecAtBuild, builtAtMs, steps };
}
