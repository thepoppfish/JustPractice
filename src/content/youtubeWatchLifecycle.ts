import { MSG } from '../lib/messages';
import type { GetStateResponse } from '../lib/messages';
import type { PersistedData } from '../lib/storage';
import { sendMsg } from './youtubeMessaging';

/** GET_STATE → apply daily snapshot + repaint calendar / goal ring (watch panel only). */
export async function refreshWatchPanelCalendarSnapshot(
  applyFetchedPracticeSnapshot: (
    dailySeconds: Record<string, number>,
    extensionInstalledDateKey: string,
  ) => void,
): Promise<void> {
  try {
    const res = (await sendMsg<GetStateResponse>({ type: MSG.GET_STATE })) as GetStateResponse;
    if (res?.ok && 'data' in res) {
      applyFetchedPracticeSnapshot(res.data.dailySeconds, res.data.extensionInstalledDateKey);
    }
  } catch {
    /* ignore */
  }
}

export interface WatchPanelStorageChangePipeline {
  /** When `newValue.settings` is present, merge into in-memory settings and refresh panel chrome. */
  applyIncomingSettingsFromPersisted: (newValue: PersistedData) => void;
  /** Always runs (e.g. `GET_STATE` resync + timers) — typically wrapped in `fireAsyncWatch`. */
  schedulePostStorageResync: () => void;
}

/**
 * `chrome.storage.onChanged` handler body for `STORAGE_KEY` — optional settings fast-path + full resync.
 * Caller must already verify `area === 'local'` and `changes[STORAGE_KEY]` exists.
 */
export function runWatchPanelAfterJpPracticeStorageChange(
  newValue: PersistedData | undefined,
  pipeline: WatchPanelStorageChangePipeline,
): void {
  if (newValue?.settings && typeof newValue.settings === 'object') {
    pipeline.applyIncomingSettingsFromPersisted(newValue);
  }
  pipeline.schedulePostStorageResync();
}

export interface WatchPanelOnVideoChangedSteps {
  getVideoIdFromUrl: () => string | null;
  flushPractice: () => void;
  resetPracticeToggleAndPending: () => void;
  /** Returns previous bound id after committing `nextId` as the current watch target. */
  commitVideoBinding: (nextId: string | null) => string | null;
  clearLibraryBannerIfVideoChanged: (previousId: string | null, nextId: string | null) => void;
  runNoVideoFlow: () => Promise<void>;
  runHasVideoFlow: (videoId: string) => Promise<void>;
}

/** SPA / feed-pick navigation: flush, reset local practice UI, rebind `currentVideoId`, refresh panel. */
export async function runWatchPanelOnVideoChanged(steps: WatchPanelOnVideoChangedSteps): Promise<void> {
  const vid = steps.getVideoIdFromUrl();
  steps.flushPractice();
  steps.resetPracticeToggleAndPending();
  const previousId = steps.commitVideoBinding(vid);
  steps.clearLibraryBannerIfVideoChanged(previousId, vid);
  if (!vid) {
    await steps.runNoVideoFlow();
    return;
  }
  await steps.runHasVideoFlow(vid);
}
