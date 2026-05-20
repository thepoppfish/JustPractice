import { APP_NAME } from '../lib/branding';
import { MSG } from '../lib/messages';
import type { ExtensionResponse } from '../lib/messages';
import {
  STORAGE_KEY,
  dateKeyFromTimestamp,
  defaultGoals,
  ensureSettingsShape,
  type AppSettings,
  type LibraryItem,
  type PersistedData,
  defaultSettings,
} from '../lib/storage';
import type { VideoMeta } from './feedCards';
import {
  attachPracticePageFlushListeners,
  createPracticeIntervalController,
  flushPendingPracticeSeconds,
  shouldCountPracticeTime,
} from './youtubePracticeTimer';
import { fireAsyncWatch, sendMsgFireAndForget } from './youtubeMessaging';
import {
  attachHomeFeedPointerPick,
  attachVideoCompletionPromptListener,
  attachYoutubeNavHooks,
  attachYoutubePlayerDomHooks,
  getVideoElement,
  shouldTriggerCompletionPrompt,
} from './youtubePlayerHooks';
import {
  applyWatchPanelCollapsed as applyWatchPanelCollapsedUi,
  calendarViewIncludesToday as calendarViewIncludesTodayUi,
  paintCalStreak as paintCalStreakUi,
  renderWatchPanelCalendar,
  setWatchPanelEndedPromptVisible,
  syncWatchPanelCompletionUi,
  syncWatchPanelEndedPromptLabels,
  syncWatchPanelLabels as syncWatchPanelLabelsUi,
  updateDailyGoalRing as updateDailyGoalRingUi,
} from './youtubePanelUi';
import {
  applyWatchPanelDifficultyChange,
  flashWatchPanelAfterLibraryWrite,
  refreshWatchPanelLibraryUiFromRemoteState,
  saveWatchPanelVideoToLibrary,
  setWatchPanelLibraryCompletion,
} from './youtubeLibraryPanel';
import {
  applyNoVideoHomePanelLayout,
  clearWatchPanelLibraryBanner,
  ensureWatchPanelIfAbsent,
  needsHomeFeedPanelAttention,
  updateHomeFeedAttentionStrip as updateHomeFeedAttentionStripUi,
  updateWatchPanelHint,
  type WatchPanelDebugHooks,
} from './youtubePanelMount';
import { parseYoutubeVideoId, resolveYoutubeVideoIdFromPage } from '../lib/youtubeIds';
import { createTranslator, resolveLocale, type ResolvedLocale } from '../i18n';
import {
  refreshWatchPanelCalendarSnapshot,
  runWatchPanelAfterJpPracticeStorageChange,
  runWatchPanelOnVideoChanged,
} from './youtubeWatchLifecycle';
import { createJpWatchPanelDebugStrip, jpWatchDebugEnabled, jpWatchLog } from './youtubeDebug';

const PANEL_HOST_ID = 'jp-practice-yt-panel-host';

/** When the URL has no watch id, user can tap a home/search feed card to bind the floating panel to that video. */
let homePickMeta: VideoMeta | null = null;

let shadowRoot: ShadowRoot | null = null;
const jpWatchPanelDebugStrip = createJpWatchPanelDebugStrip(() => shadowRoot);
const panelMountDebug: WatchPanelDebugHooks = {
  log: jpWatchLog,
  strip: (line) => jpWatchPanelDebugStrip.strip(line),
};
let ui: {
  root: HTMLElement;
  practiceToggle: HTMLInputElement;
  difficultySelect: HTMLSelectElement;
  addBtn: HTMLButtonElement;
  statusEl: HTMLElement;
  hintEl: HTMLElement;
} | null = null;

let currentVideoId: string | null = null;
let practiceEnabled = false;
let pendingSeconds = 0;
let settingsCache: AppSettings = defaultSettings();
let panelLocale: ResolvedLocale = resolveLocale(undefined);
let panelT = createTranslator(panelLocale);
let inLibrary = false;
let libraryItemForCurrentVideo: LibraryItem | null = null;
let detachCompletionPromptListener: (() => void) | null = null;
let endedPromptVisible = false;
/** Video id for which the completion prompt was triggered (persists until navigation). */
let completionPromptShownForVideoId: string | null = null;
/** Video id where the user chose "Not now" — suppress until they leave that video. */
let completionPromptDismissedForVideoId: string | null = null;

let lastDailySnapshot: Record<string, number> = {};
let extensionInstallDateKey = dateKeyFromTimestamp(Date.now());

let calendarYear = new Date().getFullYear();
let calendarMonth = new Date().getMonth();

function getTodayPracticeSeconds(): number {
  const key = dateKeyFromTimestamp(Date.now());
  const stored = lastDailySnapshot[key] ?? 0;
  return stored + (practiceEnabled ? pendingSeconds : 0);
}

function calendarViewIncludesToday(): boolean {
  return calendarViewIncludesTodayUi(calendarYear, calendarMonth);
}

function paintCalStreak(dailySeconds: Record<string, number>): void {
  paintCalStreakUi({
    shadowRoot,
    dailySeconds,
    extensionInstallDateKey,
    getTodayPracticeSeconds,
    panelT,
  });
}

function syncWatchPanelLabels(): void {
  syncWatchPanelLabelsUi({
    shadowRoot,
    inLibrary,
    panelT,
    onAfter: () => {
      syncWatchPanelCompletionUi({
        shadowRoot,
        item: libraryItemForCurrentVideo,
        panelT,
      });
      syncWatchPanelEndedPromptLabels({ shadowRoot, panelT });
      if (libraryItemForCurrentVideo?.completedAt != null) {
        endedPromptVisible = false;
      }
      setWatchPanelEndedPromptVisible({
        shadowRoot,
        visible: endedPromptVisible && libraryItemForCurrentVideo?.completedAt == null,
      });
      jpWatchPanelDebugStrip.sync();
    },
  });
}

function hideEndedPrompt(): void {
  endedPromptVisible = false;
  setWatchPanelEndedPromptVisible({ shadowRoot, visible: false });
}

function showEndedPrompt(): void {
  if (libraryItemForCurrentVideo?.completedAt != null) return;
  if (document.hidden) return;
  endedPromptVisible = true;
  syncWatchPanelEndedPromptLabels({ shadowRoot, panelT });
  setWatchPanelEndedPromptVisible({ shadowRoot, visible: true });
}

function clearCompletionPromptState(): void {
  completionPromptShownForVideoId = null;
  completionPromptDismissedForVideoId = null;
  hideEndedPrompt();
}

function dismissCompletionPromptForCurrentVideo(): void {
  if (currentVideoId) {
    completionPromptDismissedForVideoId = currentVideoId;
  }
  hideEndedPrompt();
}

function maybeShowCompletionPrompt(): void {
  if (!currentVideoId) return;
  if (libraryItemForCurrentVideo?.completedAt != null) return;
  if (completionPromptDismissedForVideoId === currentVideoId) return;
  completionPromptShownForVideoId = currentVideoId;
  showEndedPrompt();
}

function onCompletionThresholdReached(): void {
  if (!currentVideoId) return;
  if (completionPromptShownForVideoId === currentVideoId) return;
  if (completionPromptDismissedForVideoId === currentVideoId) return;
  maybeShowCompletionPrompt();
}

function onDocumentVisibilityChange(): void {
  if (document.hidden) {
    hideEndedPrompt();
    return;
  }
  if (
    currentVideoId &&
    completionPromptShownForVideoId === currentVideoId &&
    completionPromptDismissedForVideoId !== currentVideoId &&
    libraryItemForCurrentVideo?.completedAt == null
  ) {
    showEndedPrompt();
  }
}

function rebindCompletionPromptListener(): void {
  if (detachCompletionPromptListener) {
    detachCompletionPromptListener();
    detachCompletionPromptListener = null;
  }
  if (!currentVideoId) return;
  if (completionPromptDismissedForVideoId === currentVideoId) return;
  const video = getVideoElement();
  if (!video) return;

  if (
    completionPromptShownForVideoId === currentVideoId ||
    shouldTriggerCompletionPrompt(video.currentTime, video.duration)
  ) {
    maybeShowCompletionPrompt();
  }

  detachCompletionPromptListener = attachVideoCompletionPromptListener(
    video,
    onCompletionThresholdReached,
  );
}

async function toggleWatchPanelCompletion(complete: boolean): Promise<void> {
  hideEndedPrompt();
  await setWatchPanelLibraryCompletion({
    complete,
    getVideoId: getVideoIdFromUrl,
    readTitle,
    readChannel,
    panelT,
    getUi: () => ui,
    afterPersist: async (videoId) => {
      await refreshState(videoId);
      updateHint();
      resetTimers();
    },
  });
}

function applyWatchPanelCollapsed(): void {
  applyWatchPanelCollapsedUi({
    shadowRoot,
    collapsed: settingsCache.watchPanelCollapsed === true,
    panelT,
  });
}

function updateDailyGoalRing(): void {
  updateDailyGoalRingUi({
    shadowRoot,
    getGoals: () => settingsCache.goals ?? defaultGoals(),
    getTodayPracticeSeconds,
  });
}

function renderCalendar(dailySeconds: Record<string, number>): void {
  renderWatchPanelCalendar({
    shadowRoot,
    calendarYear,
    calendarMonth,
    panelLocale,
    panelT,
    dailySeconds,
    extensionInstallDateKey,
    getGoals: () => settingsCache.goals ?? defaultGoals(),
    getTodayPracticeSeconds,
    useYearHeatmap: false,
    showPracticeTime: settingsCache.calendarShowPracticeTime === true,
  });
}

function applyPanelHostPosition(): void {
  const host = document.getElementById(PANEL_HOST_ID) as HTMLElement | null;
  if (!host) return;
  const L = settingsCache.watchPanelLeft;
  const T = settingsCache.watchPanelTop;
  if (typeof L === 'number' && typeof T === 'number' && !Number.isNaN(L) && !Number.isNaN(T)) {
    host.style.left = `${L}px`;
    host.style.top = `${T}px`;
    host.style.right = 'auto';
    host.style.bottom = 'auto';
  } else {
    host.style.left = 'auto';
    host.style.top = 'auto';
    host.style.right = '16px';
    host.style.bottom = '88px';
  }
}

export function getVideoIdFromUrl(): string | null {
  const resolved = resolveYoutubeVideoIdFromPage();
  if (resolved) {
    homePickMeta = null;
    return resolved;
  }
  return homePickMeta?.videoId ?? null;
}

export function bindHomePickMeta(pick: VideoMeta): void {
  homePickMeta = pick;
}

function readTitle(): string {
  const barId =
    typeof location !== 'undefined' && location.href ? parseYoutubeVideoId(location.href) : null;
  const hp = homePickMeta;
  const vid = getVideoIdFromUrl();
  if (hp && hp.videoId === vid && !barId) {
    return hp.title;
  }
  const meta = document.querySelector('meta[property="og:title"]');
  if (meta?.getAttribute('content')) return meta.getAttribute('content')!.trim();
  const h = document.querySelector('h1 yt-formatted-string, h1.title, ytd-watch-metadata h1');
  if (h?.textContent) return h.textContent.trim();
  return document.title.replace(/\s*-\s*YouTube\s*$/, '').trim() || 'Unknown title';
}

function readChannel(): string {
  const barId =
    typeof location !== 'undefined' && location.href ? parseYoutubeVideoId(location.href) : null;
  const hp = homePickMeta;
  const vid = getVideoIdFromUrl();
  if (hp && hp.videoId === vid && !barId) {
    return hp.channel;
  }
  const link = document.querySelector(
    'ytd-channel-name a, #channel-name a, ytd-video-owner-renderer a',
  ) as HTMLAnchorElement | null;
  if (link?.textContent) return link.textContent.trim();
  const meta = document.querySelector('link[itemprop="name"]');
  if (meta?.getAttribute('content')) return meta.getAttribute('content')!.trim();
  return 'Unknown channel';
}

function ensurePanel(): void {
  ensureWatchPanelIfAbsent({
    panelHostId: PANEL_HOST_ID,
    getLevelFramework: () => settingsCache.levelFramework ?? 'jlpt',
    getCustomLevels: () => settingsCache.customLevels ?? [],
    getTemplateStrings: () => ({
      dragToMove: panelT('panel.dragToMove'),
      level: panelT('common.level'),
      saveToLibrary: panelT('panel.saveToLibrary'),
      countPracticeTime: panelT('panel.countPractice'),
      markComplete: panelT('panel.markComplete'),
      markIncomplete: panelT('panel.markIncomplete'),
    }),
    handlers: {
      onCollapseClick: () => {
        const next = !settingsCache.watchPanelCollapsed;
        settingsCache = { ...settingsCache, watchPanelCollapsed: next };
        applyWatchPanelCollapsed();
        sendMsgFireAndForget({
          type: MSG.SET_SETTINGS,
          payload: { watchPanelCollapsed: next },
        });
      },
      onAddClick: () => fireAsyncWatch(saveToLibrary()),
      onCompleteClick: () =>
        fireAsyncWatch(toggleWatchPanelCompletion(libraryItemForCurrentVideo?.completedAt == null)),
      onCompletePromptYes: () => fireAsyncWatch(toggleWatchPanelCompletion(true)),
      onCompletePromptNo: () => dismissCompletionPromptForCurrentVideo(),
      onDifficultyChange: (value) => fireAsyncWatch(onDifficultyChange(value)),
      onPracticeToggleChange: (checked) => {
        practiceEnabled = checked;
        updateHint();
        resetTimers();
        updateDailyGoalRing();
      },
      onCalPrev: () => {
        calendarMonth -= 1;
        if (calendarMonth < 0) {
          calendarMonth = 11;
          calendarYear -= 1;
        }
        fireAsyncWatch(refreshCalendarOnly());
      },
      onCalNext: () => {
        calendarMonth += 1;
        if (calendarMonth > 11) {
          calendarMonth = 0;
          calendarYear += 1;
        }
        fireAsyncWatch(refreshCalendarOnly());
      },
      onDragCommit: (left, top) => {
        sendMsgFireAndForget({
          type: MSG.SET_SETTINGS,
          payload: { watchPanelLeft: left, watchPanelTop: top },
        });
      },
    },
    onMounted: ({ shadowRoot: sr, ui: u }) => {
      shadowRoot = sr;
      ui = u;
    },
    onAfterAppend: () => {
      applyPanelHostPosition();
      applyWatchPanelCollapsed();
    },
  });
}

async function refreshCalendarOnly(): Promise<void> {
  await refreshWatchPanelCalendarSnapshot((dailySeconds, installKey) => {
    lastDailySnapshot = { ...dailySeconds };
    extensionInstallDateKey = installKey;
    renderCalendar(lastDailySnapshot);
    updateDailyGoalRing();
  });
}

function applyPersistedPracticeSnapshotToPanel(persisted: PersistedData | undefined): void {
  if (!persisted?.dailySeconds || typeof persisted.dailySeconds !== 'object') return;
  lastDailySnapshot = { ...persisted.dailySeconds };
  if (typeof persisted.extensionInstalledDateKey === 'string' && persisted.extensionInstalledDateKey.length > 0) {
    extensionInstallDateKey = persisted.extensionInstalledDateKey;
  }
  if (!shadowRoot) return;
  renderCalendar(lastDailySnapshot);
  updateDailyGoalRing();
  paintCalStreak(lastDailySnapshot);
}

async function refreshState(videoId: string | null): Promise<void> {
  if (!ui) return;
  if (!videoId) {
    libraryItemForCurrentVideo = null;
    inLibrary = false;
    await refreshCalendarOnly();
    syncWatchPanelLabels();
    return;
  }
  await refreshWatchPanelLibraryUiFromRemoteState({
    videoId,
    shadowRoot,
    ui,
    mut: {
      setSettingsCache: (s) => {
        settingsCache = s;
      },
      setLastDailySnapshot: (d) => {
        lastDailySnapshot = d;
      },
      setExtensionInstallDateKey: (k) => {
        extensionInstallDateKey = k;
      },
      setInLibrary: (v) => {
        inLibrary = v;
      },
      setLibraryItemForCurrentVideo: (v) => {
        libraryItemForCurrentVideo = v;
      },
      setPanelLocale: (l) => {
        panelLocale = l;
      },
      setPanelT: (t) => {
        panelT = t;
      },
      setPracticeEnabled: (v) => {
        practiceEnabled = v;
      },
    },
    fx: {
      applyPanelHostPosition,
      applyWatchPanelCollapsed,
      renderCalendar,
      updateDailyGoalRing,
      syncWatchPanelLabels,
    },
    getPanelT: () => panelT,
    debug: {
      enabled: jpWatchDebugEnabled,
      log: jpWatchLog,
      strip: (line) => jpWatchPanelDebugStrip.strip(line),
    },
  });
}

function updateHint(): void {
  if (!ui) return;
  updateWatchPanelHint({
    hintEl: ui.hintEl,
    practiceEnabled,
    pauseWhenUnfocused: settingsCache.pauseWhenUnfocused,
    panelT,
  });
}

async function saveToLibrary(): Promise<void> {
  await saveWatchPanelVideoToLibrary({
    getVideoId: getVideoIdFromUrl,
    getUi: () => ui,
    getInLibrary: () => inLibrary,
    getLibrarySnapshot: () => libraryItemForCurrentVideo,
    readTitle,
    readChannel,
    panelT,
    log: jpWatchLog,
    flash: flashAfterLibraryWrite,
    afterPersist: async (videoId) => {
      await refreshState(videoId);
      updateHint();
      resetTimers();
    },
  });
}

async function onDifficultyChange(value: string): Promise<void> {
  await applyWatchPanelDifficultyChange({
    value,
    getVideoId: getVideoIdFromUrl,
    getUi: () => ui,
    getInLibrary: () => inLibrary,
    readTitle,
    readChannel,
    flash: flashAfterLibraryWrite,
    afterPersist: async (videoId) => {
      await refreshState(videoId);
      updateHint();
      resetTimers();
    },
  });
}

function flashAfterLibraryWrite(
  res: ExtensionResponse,
  successKey: 'panel.flashSaved' | 'panel.flashSavedLevel',
): void {
  if (!ui) return;
  flashWatchPanelAfterLibraryWrite({
    res,
    successKey,
    ui,
    shadowRoot,
    panelT,
    mountDebug: panelMountDebug,
  });
}

function tickSecond(): void {
  const video = getVideoElement();
  if (
    shouldCountPracticeTime({
      practiceEnabled,
      currentVideoId,
      video,
      visibilityState: document.visibilityState,
      pauseWhenUnfocused: settingsCache.pauseWhenUnfocused,
      documentHasFocus: document.hasFocus(),
    })
  ) {
    pendingSeconds += 1;
  }
  updateDailyGoalRing();
  if (!shadowRoot) return;
  if (calendarViewIncludesToday()) {
    renderCalendar(lastDailySnapshot);
  } else {
    paintCalStreak(lastDailySnapshot);
  }
}

export function flushWatchPanelPractice(): void {
  flushPendingPracticeSeconds({
    videoId: currentVideoId,
    getPendingSeconds: () => pendingSeconds,
    setPendingSeconds: (next) => {
      pendingSeconds = next;
    },
    sendFireAndForget: sendMsgFireAndForget,
  });
}

const practiceIntervals = createPracticeIntervalController({
  getIntervalsActive: () => practiceEnabled && Boolean(currentVideoId),
  onCountInterval: tickSecond,
  flush: flushWatchPanelPractice,
});

function resetTimers(): void {
  practiceIntervals.reset();
  updateDailyGoalRing();
}

function clearLibraryBanner(reason = 'unknown'): void {
  clearWatchPanelLibraryBanner({ shadowRoot, reason, debug: panelMountDebug });
}

function updateHomeFeedAttentionStrip(): void {
  updateHomeFeedAttentionStripUi({
    shadowRoot,
    needsAttention: needsHomeFeedPanelAttention(getVideoIdFromUrl),
    watchPanelCollapsed: settingsCache.watchPanelCollapsed === true,
    panelT,
    onExpandFromCollapsed: () => {
      settingsCache = { ...settingsCache, watchPanelCollapsed: false };
      applyWatchPanelCollapsed();
      sendMsgFireAndForget({
        type: MSG.SET_SETTINGS,
        payload: { watchPanelCollapsed: false },
      });
    },
  });
}

export async function onWatchPanelVideoChanged(): Promise<void> {
  await runWatchPanelOnVideoChanged({
    getVideoIdFromUrl,
    flushPractice: flushWatchPanelPractice,
    resetPracticeToggleAndPending: () => {
      practiceEnabled = false;
      if (ui) {
        ui.practiceToggle.checked = false;
      }
      pendingSeconds = 0;
    },
    commitVideoBinding: (nextId) => {
      const previousVideoId = currentVideoId;
      currentVideoId = nextId;
      clearCompletionPromptState();
      return previousVideoId;
    },
    clearLibraryBannerIfVideoChanged: (previousId, nextId) => {
      if (previousId !== nextId) {
        clearLibraryBanner('video-change');
      }
    },
    runNoVideoFlow: async () => {
      resetTimers();
      clearLibraryBanner('no-video');
      clearCompletionPromptState();
      if (detachCompletionPromptListener) {
        detachCompletionPromptListener();
        detachCompletionPromptListener = null;
      }
      ensurePanel();
      applyPanelHostPosition();
      applyWatchPanelCollapsed();
      const titleEl = shadowRoot?.querySelector('[part="title"]') as HTMLElement | null;
      if (titleEl) titleEl.textContent = APP_NAME;
      updateHomeFeedAttentionStrip();
      updateHint();
      fireAsyncWatch(refreshCalendarOnly());

      const host = document.getElementById(PANEL_HOST_ID) as HTMLElement | null;
      if (needsHomeFeedPanelAttention(getVideoIdFromUrl)) {
        if (host) (host as HTMLElement).style.display = '';
      } else {
        applyNoVideoHomePanelLayout(shadowRoot, false);
        if (host) (host as HTMLElement).style.display = 'none';
      }
    },
    runHasVideoFlow: async (videoId) => {
      ensurePanel();
      if (shadowRoot?.host) (shadowRoot.host as HTMLElement).style.display = '';
      updateHomeFeedAttentionStrip();
      const titleEl = shadowRoot?.querySelector('[part="title"]') as HTMLElement | undefined;
      if (titleEl) {
        const t = readTitle();
        titleEl.textContent = t.length > 90 ? `${t.slice(0, 90)}…` : t;
      }
      await refreshState(videoId);
      updateHint();
      resetTimers();
      rebindCompletionPromptListener();
    },
  });
}

export function elementInWatchPanelUiShell(node: Node | null): boolean {
  if (!node) return false;
  const panel = document.getElementById(PANEL_HOST_ID);
  if (panel && panel.contains(node)) return true;
  const feedPop = document.getElementById('jp-practice-feed-popover-host');
  if (feedPop && feedPop.contains(node)) return true;
  return false;
}

export function getWatchPanelPauseWhenUnfocused(): boolean {
  return settingsCache.pauseWhenUnfocused;
}

export function onJpPracticeStorageChanged(nv: PersistedData | undefined): void {
  runWatchPanelAfterJpPracticeStorageChange(nv, {
    applyIncomingSettingsFromPersisted: (persisted) => {
      settingsCache = ensureSettingsShape({ ...defaultSettings(), ...persisted.settings });
      panelLocale = resolveLocale(settingsCache.uiLocale);
      panelT = createTranslator(panelLocale);
      applyPanelHostPosition();
      applyWatchPanelCollapsed();
      syncWatchPanelLabels();
      updateHint();
      updateHomeFeedAttentionStrip();
    },
    schedulePostStorageResync: () => {
      fireAsyncWatch(
        (async () => {
          applyPersistedPracticeSnapshotToPanel(nv);
          if (jpWatchDebugEnabled()) {
            jpWatchLog('storage:onChanged:refreshState', { key: STORAGE_KEY });
            jpWatchPanelDebugStrip.strip('storage changed → refreshState');
          }
          await refreshState(getVideoIdFromUrl());
          updateHint();
          resetTimers();
        })(),
      );
    },
  });
}

export function attachWatchPanelRuntimeHooks(): void {
  attachYoutubeNavHooks(() => fireAsyncWatch(onWatchPanelVideoChanged()));
  attachYoutubePlayerDomHooks(() => {
    fireAsyncWatch(onWatchPanelVideoChanged());
    rebindCompletionPromptListener();
  });
  attachHomeFeedPointerPick({
    elementInOurUiShell: elementInWatchPanelUiShell,
    onFeedCardPicked: (pick) => {
      bindHomePickMeta(pick);
      if (jpWatchDebugEnabled()) {
        jpWatchLog('homePick:card', { videoId: pick.videoId, title: pick.title.slice(0, 60) });
      }
      fireAsyncWatch(onWatchPanelVideoChanged());
    },
  });
  attachPracticePageFlushListeners({
    getPauseWhenUnfocused: getWatchPanelPauseWhenUnfocused,
    flush: flushWatchPanelPractice,
  });
  document.addEventListener('visibilitychange', onDocumentVisibilityChange);
}

export async function refreshWatchPanelCalendarOnVisible(): Promise<void> {
  await refreshCalendarOnly();
}
