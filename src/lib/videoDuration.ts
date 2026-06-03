/** Read a positive whole-second duration from a watch-page video element. */
export function readVideoDurationSec(video: HTMLVideoElement | null | undefined): number | null {
  if (!video) return null;
  const d = video.duration;
  if (!Number.isFinite(d) || d <= 0) return null;
  return Math.floor(d);
}
