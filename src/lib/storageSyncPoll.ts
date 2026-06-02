/** Default interval for UI storage polls and practice flush to background. */
export const STORAGE_SYNC_INTERVAL_MS = 15_000;

export interface StartStorageSyncPollOptions {
  intervalMs?: number;
  /** When true (default), skip ticks while the document is hidden. */
  whenVisible?: boolean;
}

/**
 * Poll callback on a fixed interval while the page is open.
 * Returns `stop()` to clear the interval.
 */
export function startStorageSyncPoll(
  onTick: () => void,
  options: StartStorageSyncPollOptions = {},
): () => void {
  const intervalMs = options.intervalMs ?? STORAGE_SYNC_INTERVAL_MS;
  const whenVisible = options.whenVisible !== false;

  const id = setInterval(() => {
    if (whenVisible && typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return;
    }
    onTick();
  }, intervalMs);

  return () => clearInterval(id);
}
