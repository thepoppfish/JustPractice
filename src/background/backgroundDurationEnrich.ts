import { parseLengthSecondsFromWatchPageHtml } from '../lib/youtubeWatchPageDuration';
import { readPersisted, writePersisted } from '../lib/storage';
import type { LibraryItem } from '../lib/storageTypes';

const FETCH_DELAY_MS = 220;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchVideoDurationSecFromYoutube(videoId: string): Promise<number | null> {
  const watchUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
  try {
    const r = await fetch(watchUrl, { credentials: 'omit', cache: 'no-store' });
    if (!r.ok) return null;
    const html = await r.text();
    return parseLengthSecondsFromWatchPageHtml(html);
  } catch {
    return null;
  }
}

export async function enrichLibraryItemDuration(videoId: string): Promise<boolean> {
  const p = await readPersisted();
  const item = p.library.find((x) => x.videoId === videoId);
  if (!item || hasKnownDuration(item)) return false;

  const durationSec = await fetchVideoDurationSecFromYoutube(videoId);
  if (durationSec === null) return false;

  const latest = await readPersisted();
  const row = latest.library.find((x) => x.videoId === videoId);
  if (!row || hasKnownDuration(row)) return false;

  row.durationSec = durationSec;
  await writePersisted(latest);
  return true;
}

function hasKnownDuration(item: LibraryItem): boolean {
  return typeof item.durationSec === 'number' && Number.isFinite(item.durationSec) && item.durationSec > 0;
}

export function libraryItemsMissingDuration(
  library: LibraryItem[],
  onlyInProgress = true,
): LibraryItem[] {
  return library.filter((item) => {
    if (onlyInProgress && item.completedAt !== null) return false;
    return !hasKnownDuration(item);
  });
}

/** Rate-limited batch backfill for dashboard path planning. */
export async function backfillLibraryDurations(limit: number): Promise<{ updated: number; attempted: number }> {
  const p = await readPersisted();
  const missing = libraryItemsMissingDuration(p.library);
  const batch = missing.slice(0, Math.max(0, Math.min(limit, 20)));
  let updated = 0;

  for (let i = 0; i < batch.length; i += 1) {
    if (i > 0) await sleep(FETCH_DELAY_MS);
    const ok = await enrichLibraryItemDuration(batch[i]!.videoId);
    if (ok) updated += 1;
  }

  return { updated, attempted: batch.length };
}
