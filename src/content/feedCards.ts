import { STORAGE_KEY } from '../lib/storage';
import {
  refreshLibraryIds,
  syncLibraryFromStoragePayload,
  type VideoMeta,
} from './feedCardsState';
import {
  extractCardMeta,
  findEnclosingFeedCard,
  mutationObserverRoot,
  scheduleFeedRescanDebounced,
  scheduleFeedRescanImmediate,
  scanExistingHoverStrips,
  shouldSkipCard,
} from './feedCardsDom';

export type { VideoMeta } from './feedCardsState';

/**
 * Resolve a feed/grid video from a pointer event target (home, subscriptions, search results, etc.).
 * Used by the floating watch panel when the URL has no watch/shorts id.
 */
export function pickFeedCardFromInteractionTarget(target: EventTarget | null): VideoMeta | null {
  if (!(target instanceof Node)) return null;
  const card = findEnclosingFeedCard(target);
  if (!card) return null;
  if (shouldSkipCard(card)) return null;
  return extractCardMeta(card);
}

export function initFeedCards(): void {
  void refreshLibraryIds();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[STORAGE_KEY]) return;
    const nv = changes[STORAGE_KEY].newValue;
    if (syncLibraryFromStoragePayload(nv)) {
      scanExistingHoverStrips();
    }
  });

  const mo = new MutationObserver(() => scheduleFeedRescanDebounced());
  mo.observe(mutationObserverRoot(), { childList: true, subtree: true });

  document.addEventListener('yt-navigate-finish', () => {
    void refreshLibraryIds();
    scheduleFeedRescanImmediate();
  });
  document.addEventListener('yt-page-data-updated', () => {
    void refreshLibraryIds();
    scheduleFeedRescanImmediate();
  });

  scheduleFeedRescanImmediate();
}
