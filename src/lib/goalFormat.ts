import { formatDurationMinutesOnly } from './practiceStats';

/**
 * Human-readable durations for goal UI.
 * Under 60 minutes total: minutes + optional seconds.
 * 60+ minutes: hours (+ minutes / seconds as needed).
 */
export function formatGoalDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0s';
  if (sec < 60) return `${Math.floor(sec)}s`;
  const totalMin = Math.floor(sec / 60);
  if (totalMin < 60) {
    const s = Math.floor(sec % 60);
    return s === 0 ? `${totalMin}m` : `${totalMin}m ${s}s`;
  }
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const s = Math.floor(sec % 60);
  if (m === 0 && s === 0) return `${h}h`;
  if (s === 0) return `${h}h ${m}m`;
  return `${h}h ${m}m ${s}s`;
}

/** Minutes only (floored) — YouTube watch panel daily goal ring. */
export function formatGoalDurationMinutesOnly(sec: number): string {
  return formatDurationMinutesOnly(sec);
}

/** Compact center label e.g. `2m/3h 30m` */
export function formatGoalSlash(doneSec: number, targetSec: number): string {
  return `${formatGoalDuration(doneSec)}/${formatGoalDuration(targetSec)}`;
}

export function formatGoalSlashMinutesOnly(doneSec: number, targetSec: number): string {
  return `${formatGoalDurationMinutesOnly(doneSec)}/${formatGoalDurationMinutesOnly(targetSec)}`;
}

/** Live watch-panel ring: seconds until the first full minute, then whole minutes only. */
export function formatGoalLiveProgress(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  if (s < 60) return `${s}s`;
  return formatGoalDurationMinutesOnly(s);
}

export function formatGoalSlashLive(doneSec: number, targetSec: number): string {
  return `${formatGoalLiveProgress(doneSec)}/${formatGoalDurationMinutesOnly(targetSec)}`;
}

/** `done / target` line under rings */
export function formatGoalPairLine(doneSec: number, targetSec: number): string {
  return `${formatGoalDuration(doneSec)} / ${formatGoalDuration(targetSec)}`;
}

export function formatGoalPairLineMinutesOnly(doneSec: number, targetSec: number): string {
  return `${formatGoalDurationMinutesOnly(doneSec)} / ${formatGoalDurationMinutesOnly(targetSec)}`;
}

export function formatGoalPairLineLive(doneSec: number, targetSec: number): string {
  return `${formatGoalLiveProgress(doneSec)} / ${formatGoalDurationMinutesOnly(targetSec)}`;
}

/**
 * For SVG circles with pathLength="100": visible arc length is progress × 100,
 * remainder is gap. stroke-dashoffset stays 0 (do not use offset-only trick; it breaks with pathLength).
 */
export function ringDasharrayFromProgress(progress01: number): string {
  const p = Math.min(1, Math.max(0, progress01));
  const draw = p * 100;
  const gap = 100 - draw;
  return `${draw} ${gap}`;
}
