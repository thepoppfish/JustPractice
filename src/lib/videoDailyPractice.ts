import type { PersistedData } from './storageTypes';

export type VideoDailySecondsMap = Record<string, Record<string, number>>;

/** Seconds practiced on a video during a specific local calendar day. */
export function videoPracticeTodaySec(
  data: Pick<PersistedData, 'videoDailySeconds'>,
  videoId: string,
  dateKey: string,
): number {
  const byVideo = data.videoDailySeconds?.[videoId];
  if (!byVideo) return 0;
  const sec = byVideo[dateKey];
  return typeof sec === 'number' && Number.isFinite(sec) && sec > 0 ? Math.floor(sec) : 0;
}

/** True if any practice or playback has been recorded for this video. */
export function videoHasWatchTime(
  data: Pick<PersistedData, 'videoSeconds' | 'videoPlaybackPositionSec' | 'videoDailySeconds'>,
  videoId: string,
  dateKey: string,
): boolean {
  if (videoPracticeTodaySec(data, videoId, dateKey) > 0) return true;
  const lifetime = data.videoSeconds?.[videoId];
  if (typeof lifetime === 'number' && lifetime > 0) return true;
  const position = data.videoPlaybackPositionSec?.[videoId];
  if (typeof position === 'number' && position > 0) return true;
  return false;
}

/** Add practice seconds to a video's daily bucket (mutates a copy). */
export function addVideoDailyPractice(
  map: VideoDailySecondsMap,
  videoId: string,
  dateKey: string,
  deltaSeconds: number,
): VideoDailySecondsMap {
  if (!videoId || deltaSeconds <= 0) return map;
  const next = { ...map };
  const byDay = { ...(next[videoId] ?? {}) };
  byDay[dateKey] = (byDay[dateKey] ?? 0) + Math.floor(deltaSeconds);
  next[videoId] = byDay;
  return next;
}

export function normalizeVideoDailySeconds(raw: unknown): VideoDailySecondsMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: VideoDailySecondsMap = {};
  for (const [videoId, days] of Object.entries(raw as Record<string, unknown>)) {
    if (!videoId || !days || typeof days !== 'object' || Array.isArray(days)) continue;
    const dayMap: Record<string, number> = {};
    for (const [dateKey, sec] of Object.entries(days as Record<string, unknown>)) {
      if (!dateKey || typeof sec !== 'number' || !Number.isFinite(sec) || sec <= 0) continue;
      dayMap[dateKey] = Math.floor(sec);
    }
    if (Object.keys(dayMap).length > 0) out[videoId] = dayMap;
  }
  return out;
}
