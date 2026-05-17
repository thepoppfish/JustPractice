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

/** Compact center label e.g. `2m/3h 30m` */
export function formatGoalSlash(doneSec: number, targetSec: number): string {
  return `${formatGoalDuration(doneSec)}/${formatGoalDuration(targetSec)}`;
}

/** `done / target` line under rings */
export function formatGoalPairLine(doneSec: number, targetSec: number): string {
  return `${formatGoalDuration(doneSec)} / ${formatGoalDuration(targetSec)}`;
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
