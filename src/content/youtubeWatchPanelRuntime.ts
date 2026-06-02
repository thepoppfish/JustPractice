import { MSG } from '../lib/messages';
import type { ExtensionResponse, PracticeTickOkResponse } from '../lib/messages';
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
import { startStorageSyncPoll } from '../lib/storageSyncPoll';
import type { VideoMeta } from './feedCards';
import {
  isPlaceholderYoutubePageTitle,
  stripYoutubeSuffixFromPageTitle,
} from '../lib/youtubePageTitle';
import {
  attachPracticePageFlushListeners,
  createPracticeIntervalController,
  shouldCountPracticeTime,
} from './youtubePracticeTimer';
import { fireAsyncWatch, sendMsg, sendMsgFireAndForget } from './youtubeMessaging';
import {
  attachHomeFeedPointerPick,
  attachYoutubeNavHooks,
  attachYoutubePlayerDomHooks,
  getVideoElement,
} from './youtubePlayerHooks';
import {
  applyWatchPanelCollapsed as applyWatchPanelCollapsedUi,
  calendarViewIncludesToday as calendarViewIncludesTodayUi,
  paintCalStreak as paintCalStreakUi,
  renderWatchPanelCalendar,
  syncWatchPanelLabels as syncWatchPanelLabelsUi,
  updateDailyGoalRing as updateDailyGoalRingUi,
  updatePlayerXpBar as updatePlayerXpBarUi,
} from './youtubePanelUi';
import {
  applyWatchPanelDifficultyChange,
  flashWatchPanelAfterLibraryWrite,
  flashWatchPanelXpTick,
  refreshWatchPanelLibraryUiFromRemoteState,
  saveWatchPanelVideoToLibrary,
} from './youtubeLibraryPanel';
import {
  applyNoVideoHomePanelLayout,
  clearWatchPanelLibraryBanner,
  applyDefaultWatchPanelHostStyle,
  clampWatchPanelHostToViewport,
  forceWatchPanelHostVisible,
  ensureWatchPanelIfAbsent,
  setWatchPanelHostVisible,
  needsHomeFeedPanelAttention,
  shouldKeepWatchPanelVisibleWithoutVideoId,
  updateHomeFeedAttentionStrip as updateHomeFeedAttentionStripUi,
  updateWatchPanelHint,
  type WatchPanelDebugHooks,
} from './youtubePanelMount';
import {
  isYoutubeWatchLikePage,
  parseYoutubeVideoId,
  resolveYoutubeVideoIdFromPage,
} from '../lib/youtubeIds';
import { createTranslator, resolveLocale, type ResolvedLocale } from '../i18n';
import {
  refreshWatchPanelCalendarSnapshot,
  runWatchPanelAfterJpPracticeStorageChange,
} from './youtubeWatchLifecycle';
import { jpXpLogContent } from '../lib/xpDebug';
import { PRACTICE_FLUSH_INTERVAL_MS } from './youtubePracticeTimer';
import { createJpWatchPanelDebugStrip, jpWatchDebugEnabled, jpWatchLog } from './youtubeDebug';
import { createWatchPanelCompletionController } from './youtubeWatchPanelCompletion';
import { syncLearningFocusMode } from './learningFocusMode';
import { runWatchPanelVideoChangedFlow } from './youtubeWatchPanelVideoFlow';
import {
  omitWatchPanelPosition,
  persistWatchPanelSpawnDefaults,
  removeWatchPanelHost,
} from './watchPanelSpawn';
import { isWatchPanelHostLive } from './watchPanelBoot';

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

let lastDailySnapshot: Record<string, number> = {};
let cachedPlayerTotalXp = 0;
let cachedPlayerPrestigeLevel = 0;
let extensionInstallDateKey = dateKeyFromTimestamp(Date.now());

let calendarYear = new Date().getFullYear();
let calendarMonth = new Date().getMonth();

let videoIdRetryGeneration = 0;

function scheduleVideoIdResolutionRetries(): void {
  if (!isYoutubeWatchLikePage()) return;
  const gen = ++videoIdRetryGeneration;
  for (const ms of [50, 150, 400, 1000, 2500]) {
    window.setTimeout(() => {
      if (gen !== videoIdRetryGeneration) return;
      if (getVideoIdFromUrl()) fireAsyncWatch(onWatchPanelVideoChanged());
    }, ms);
  }
}

const completion = createWatchPanelCompletionController({
  getShadowRoot: () => shadowRoot,
  getPanelT: () => panelT,
  getInLibrary: () => inLibrary,
  getLibraryItemForCurrentVideo: () => libraryItemForCurrentVideo,
  getCurrentVideoId: () => currentVideoId,
  getVideoIdFromUrl,
  readTitle,
  readChannel,
  getUi: () => ui,
  afterCompletionPersist: async (videoId) => {
    await refreshState(videoId);
    updateHint();
    resetTimers();
  },
  syncWatchPanelLabels,
  applyXpFromResponse: (res) => {
    if (!res.ok || !('xpGained' in res)) return;
    applyXpFromPracticeResponse(res);
  },
});

function syncLearningFocusFromState(): void {
  syncLearningFocusMode({
    settingEnabled: settingsCache.learningFocusHideRecommendations !== false,
    inLibrary,
  });
}

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
      completion.syncCompletionUiOnLabelsRefresh();
      jpWatchPanelDebugStrip.sync();
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

function updatePlayerXpBar(totalXp?: number, prestigeLevel?: number): void {
  if (totalXp != null) cachedPlayerTotalXp = totalXp;
  if (prestigeLevel != null) cachedPlayerPrestigeLevel = prestigeLevel;
  updatePlayerXpBarUi({
    shadowRoot,
    totalXp: cachedPlayerTotalXp,
    prestigeLevel: cachedPlayerPrestigeLevel,
    panelT,
  });
}

function applyXpFromPracticeResponse(res: {
  xpGained: number;
  levelUp: boolean;
  newLevel: number;
  totalXp?: number;
}): void {
  if (typeof res.totalXp === 'number' && Number.isFinite(res.totalXp)) {
    cachedPlayerTotalXp = res.totalXp;
  } else if (res.xpGained > 0) {
    cachedPlayerTotalXp += res.xpGained;
  }
  updatePlayerXpBar();
  jpXpLogContent('ui:applyXpResponse', {
    xpGained: res.xpGained,
    levelUp: res.levelUp,
    newLevel: res.newLevel,
    totalXp: res.totalXp ?? cachedPlayerTotalXp,
    barUpdated: true,
    flash: res.xpGained > 0 || res.levelUp,
  });
  if (jpWatchDebugEnabled()) {
    jpWatchPanelDebugStrip.strip(
      `XP ui +${res.xpGained} lvl=${res.newLevel}${res.levelUp ? ' UP' : ''}`,
    );
  }
  if (!ui || (res.xpGained <= 0 && !res.levelUp)) return;
  flashWatchPanelXpTick({
    shadowRoot,
    ui,
    panelT,
    xpGained: res.xpGained,
    levelUp: res.levelUp,
    newLevel: res.newLevel,
    showRoutineXpFeedback: settingsCache.watchPanelXpToastsEnabled !== false,
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
  if (isYoutubeWatchLikePage()) {
    setWatchPanelHostVisible(PANEL_HOST_ID, true);
  }
  const L = settingsCache.watchPanelLeft;
  const T = settingsCache.watchPanelTop;
  if (typeof L === 'number' && typeof T === 'number' && !Number.isNaN(L) && !Number.isNaN(T)) {
    host.style.left = `${L}px`;
    host.style.top = `${T}px`;
    host.style.right = 'auto';
    host.style.bottom = 'auto';
    requestAnimationFrame(() => clampWatchPanelHostToViewport(host));
  } else {
    applyDefaultWatchPanelHostStyle(host);
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
  const og = meta?.getAttribute('content')?.trim();
  if (og && !isPlaceholderYoutubePageTitle(og)) return og;
  const h = document.querySelector('h1 yt-formatted-string, h1.title, ytd-watch-metadata h1');
  const heading = h?.textContent?.trim();
  if (heading && !isPlaceholderYoutubePageTitle(heading)) return heading;
  const stripped = stripYoutubeSuffixFromPageTitle(document.title);
  if (isPlaceholderYoutubePageTitle(stripped)) return 'Unknown title';
  return stripped;
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

/** Create/show panel chrome immediately so YouTube never depends on async GET_STATE first. */
export function mountWatchPanelShellSync(): void {
  try {
    ensurePanel();
    setWatchPanelHostVisible(PANEL_HOST_ID, true);
    const host = document.getElementById(PANEL_HOST_ID) as HTMLElement | null;
    if (host) forceWatchPanelHostVisible(host);
    applyPanelHostPosition();
    applyWatchPanelCollapsed();
    document.documentElement.dataset.jpPracticeScript = '1';
  } catch (err) {
    console.error('[JustPractice] mountWatchPanelShellSync failed', err);
  }
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
      onCompletePromptNo: () => completion.dismissCompletionPromptForCurrentVideo(),
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
  await refreshWatchPanelCalendarSnapshot((dailySeconds, installKey, playerProgress) => {
    lastDailySnapshot = { ...dailySeconds };
    extensionInstallDateKey = installKey;
    if (playerProgress) {
      cachedPlayerTotalXp = playerProgress.totalXp;
      cachedPlayerPrestigeLevel = playerProgress.prestigeLevel ?? 0;
      updatePlayerXpBar();
    }
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
  if (persisted.playerProgress && typeof persisted.playerProgress.totalXp === 'number') {
    cachedPlayerTotalXp = persisted.playerProgress.totalXp;
    cachedPlayerPrestigeLevel = persisted.playerProgress.prestigeLevel ?? 0;
  }
  if (!shadowRoot) return;
  renderCalendar(lastDailySnapshot);
  updateDailyGoalRing();
  updatePlayerXpBar();
  paintCalStreak(lastDailySnapshot);
}

async function refreshState(videoId: string | null): Promise<void> {
  if (!ui) return;
  if (!videoId) {
    libraryItemForCurrentVideo = null;
    inLibrary = false;
    await refreshCalendarOnly();
    syncWatchPanelLabels();
    syncLearningFocusFromState();
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
      updatePlayerXpBar,
      syncWatchPanelLabels,
    },
    getPanelT: () => panelT,
    debug: {
      enabled: jpWatchDebugEnabled,
      log: jpWatchLog,
      strip: (line) => jpWatchPanelDebugStrip.strip(line),
    },
  });
  syncLearningFocusFromState();
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

function practiceCountingSnapshot(): {
  counting: boolean;
  paused: boolean;
  ended: boolean;
  visible: boolean;
  focusOk: boolean;
} {
  const video = getVideoElement();
  const counting = shouldCountPracticeTime({
    practiceEnabled,
    currentVideoId,
    video,
    visibilityState: document.visibilityState,
    pauseWhenUnfocused: settingsCache.pauseWhenUnfocused,
    documentHasFocus: document.hasFocus(),
  });
  return {
    counting,
    paused: Boolean(video?.paused),
    ended: Boolean(video?.ended),
    visible: document.visibilityState === 'visible',
    focusOk: !settingsCache.pauseWhenUnfocused || document.hasFocus(),
  };
}

export function flushWatchPanelPractice(): void {
  if (!currentVideoId) return;
  const pending = pendingSeconds;
  if (pending <= 0) return;
  const videoId = currentVideoId;
  const snap = practiceCountingSnapshot();
  pendingSeconds = 0;
  jpXpLogContent('content:PRACTICE_TICK send', {
    videoId,
    deltaSeconds: pending,
    flushIntervalMs: PRACTICE_FLUSH_INTERVAL_MS,
    practiceEnabled,
    inLibrary,
    ...snap,
  });
  if (jpWatchDebugEnabled()) {
    jpWatchPanelDebugStrip.strip(
      `flush ${pending}s lib=${String(inLibrary)} count=${String(snap.counting)}`,
    );
  }
  void sendMsg<PracticeTickOkResponse>({
    type: MSG.PRACTICE_TICK,
    payload: {
      videoId,
      deltaSeconds: pending,
      endedAtMs: Date.now(),
    },
  }).then((res) => {
    if (!res?.ok || !('xpGained' in res)) {
      jpXpLogContent('content:PRACTICE_TICK response ignored', {
        videoId,
        ok: res?.ok,
        hasXp: res != null && typeof res === 'object' && 'xpGained' in res,
      });
      return;
    }
    const zeroWhy =
      res.xpGained <= 0 && !res.levelUp ?
        'no XP this flush (carry banks sub-minute; see background log for carry)'
      : undefined;
    jpXpLogContent('content:PRACTICE_TICK response', {
      videoId,
      deltaSeconds: pending,
      xpGained: res.xpGained,
      levelUp: res.levelUp,
      newLevel: res.newLevel,
      totalXp: res.totalXp,
      ...(zeroWhy ? { zeroXpReason: zeroWhy } : {}),
    });
    applyXpFromPracticeResponse(res);
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

async function toggleWatchPanelCompletion(complete: boolean): Promise<void> {
  await completion.toggleWatchPanelCompletion(complete);
}

export async function onWatchPanelVideoChanged(): Promise<void> {
  videoIdRetryGeneration += 1;
  await runWatchPanelVideoChangedFlow({
    panelHostId: PANEL_HOST_ID,
    getVideoIdFromUrl,
    flushPractice: flushWatchPanelPractice,
    resetPracticeToggleAndPending: () => {
      practiceEnabled = false;
      if (ui) {
        ui.practiceToggle.checked = false;
      }
      pendingSeconds = 0;
    },
    clearCompletionPromptState: () => completion.clearCompletionPromptState(),
    detachCompletionListenerOnNoVideo: () => completion.detachCompletionListenerOnNoVideo(),
    getShadowRoot: () => shadowRoot,
    setCurrentVideoId: (nextId) => {
      const previousVideoId = currentVideoId;
      currentVideoId = nextId;
      return previousVideoId;
    },
    clearLibraryBanner,
    resetTimers,
    ensurePanel,
    applyPanelHostPosition,
    applyWatchPanelCollapsed,
    updateHomeFeedAttentionStrip,
    updateHint,
    refreshCalendarOnly,
    shouldKeepWatchPanelVisibleWithoutVideoId: () =>
      shouldKeepWatchPanelVisibleWithoutVideoId(getVideoIdFromUrl, () => Boolean(getVideoElement())),
    scheduleVideoIdResolutionRetries,
    applyNoVideoHomePanelLayout,
    readTitle,
    refreshState,
    rebindCompletionPromptListener: () => completion.rebindCompletionPromptListener(),
    fireAsyncWatch,
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
  if (nv) {
    applyPersistedPracticeSnapshotToPanel(nv);
  }
  runWatchPanelAfterJpPracticeStorageChange(nv, {
    applyIncomingSettingsFromPersisted: (persisted) => {
      settingsCache = ensureSettingsShape({ ...defaultSettings(), ...persisted.settings });
      panelLocale = resolveLocale(settingsCache.uiLocale);
      panelT = createTranslator(panelLocale);
      applyPanelHostPosition();
      applyWatchPanelCollapsed();
      syncWatchPanelLabels();
      syncLearningFocusFromState();
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
    completion.rebindCompletionPromptListener();
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
  document.addEventListener('visibilitychange', () => completion.onDocumentVisibilityChange());
  startStorageSyncPoll(() => {
    fireAsyncWatch(refreshCalendarOnly());
  });
}

export async function refreshWatchPanelCalendarOnVisible(): Promise<void> {
  await refreshCalendarOnly();
}

/** Drop panel DOM from a prior extension injection (broken listeners / hidden host). */
export function purgeStaleWatchPanelHost(): void {
  const host = document.getElementById(PANEL_HOST_ID) as HTMLElement | null;
  if (host && !isWatchPanelHostLive(host)) {
    host.remove();
    shadowRoot = null;
    ui = null;
  }
}

/**
 * Remount the watch panel at the default bottom-right position and expand it.
 * Triggered from dashboard/popup or DevTools via {@link MSG.SHOW_WATCH_PANEL}.
 */
export async function spawnWatchPanel(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    removeWatchPanelHost(PANEL_HOST_ID);
    shadowRoot = null;
    ui = null;
    settingsCache = omitWatchPanelPosition(settingsCache);
    await persistWatchPanelSpawnDefaults();
    ensurePanel();
    const host = document.getElementById(PANEL_HOST_ID) as HTMLElement | null;
    if (host) forceWatchPanelHostVisible(host);
    setWatchPanelHostVisible(PANEL_HOST_ID, true);
    applyWatchPanelCollapsed();
    await onWatchPanelVideoChanged();
    jpWatchLog('spawnWatchPanel:done', {
      href: location.href,
      videoId: getVideoIdFromUrl(),
      hostInDom: Boolean(document.getElementById(PANEL_HOST_ID)),
    });
    return { ok: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.warn('[JustPractice:watch] spawnWatchPanel failed', err);
    return { ok: false, error };
  }
}
