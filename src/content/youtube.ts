import { MSG } from '../lib/messages';
import { STORAGE_KEY, type PersistedData } from '../lib/storage';
import { fireAsyncWatch } from './youtubeMessaging';
import { syncJpXpDebugFlagToExtensionStorage } from '../lib/xpDebug';
import { jpWatchDebugEnabled, jpWatchLog } from './youtubeDebug';
import {
  attachWatchPanelRuntimeHooks,
  getVideoIdFromUrl,
  mountWatchPanelShellSync,
  onJpPracticeStorageChanged,
  onWatchPanelVideoChanged,
  purgeStaleWatchPanelHost,
  refreshWatchPanelCalendarOnVisible,
  spawnWatchPanel,
} from './youtubeWatchPanelRuntime';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === MSG.SHOW_WATCH_PANEL) {
    void spawnWatchPanel().then(sendResponse);
    return true;
  }
  return false;
});

function boot(): void {
  console.info('[JustPractice] YouTube content script boot', location.href);
  try {
    purgeStaleWatchPanelHost();
    mountWatchPanelShellSync();
    void syncJpXpDebugFlagToExtensionStorage();
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
  } catch (err) {
    console.error('[JustPractice] YouTube content script boot failed', err);
  }
}

boot();
