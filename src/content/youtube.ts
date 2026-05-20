import { STORAGE_KEY, type PersistedData } from '../lib/storage';
import { initFeedCards } from './feedCards';
import { fireAsyncWatch } from './youtubeMessaging';
import { jpWatchDebugEnabled, jpWatchLog } from './youtubeDebug';
import {
  attachWatchPanelRuntimeHooks,
  getVideoIdFromUrl,
  onJpPracticeStorageChanged,
  onWatchPanelVideoChanged,
  refreshWatchPanelCalendarOnVisible,
} from './youtubeWatchPanelRuntime';

function boot(): void {
  jpWatchLog('content-script:boot', {
    href: typeof location !== 'undefined' ? location.href : '',
    resolvedVideoId: getVideoIdFromUrl(),
    jpWatchDebug: jpWatchDebugEnabled(),
  });

  attachWatchPanelRuntimeHooks();

  let visibleCalendarRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (visibleCalendarRefreshTimer !== null) clearTimeout(visibleCalendarRefreshTimer);
    visibleCalendarRefreshTimer = setTimeout(() => {
      visibleCalendarRefreshTimer = null;
      fireAsyncWatch(refreshWatchPanelCalendarOnVisible());
    }, 400);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[STORAGE_KEY]) return;
    const nv = changes[STORAGE_KEY].newValue as PersistedData | undefined;
    onJpPracticeStorageChanged(nv);
  });

  fireAsyncWatch(onWatchPanelVideoChanged());
  initFeedCards();
}

boot();
