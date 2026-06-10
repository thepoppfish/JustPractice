import { MSG } from '../lib/messages';
import type {
  BackfillLibraryDurationsOkResponse,
  ExtensionMessage,
  GetStateResponse,
} from '../lib/messages';
import { STORAGE_KEY, type LevelTag, type PersistedData } from '../lib/storage';
import { startStorageSyncPoll } from '../lib/storageSyncPoll';
import { isPlaceholderYoutubePageTitle } from '../lib/youtubePageTitle';
import { escapeHtml } from '../lib/htmlEscape';
import { createTranslator, resolveLocale } from '../i18n';
import { buildDashboardViewModel, type DashView } from './dashboardViewModel';
import { dashboardShellHtml } from './dashboardTemplates';
import {
  attachDashboardListeners,
  attachLibraryPanelListeners,
} from './dashboardListeners';
import { persistDashView, readPersistedDashView } from './dashViewPersistence';
import {
  DASH_VIEWS,
  isDashSearchFocused,
  patchDashboardChrome,
  patchDashboardPanels,
  patchDashWelcome,
  patchLibraryAndCompletedPanels,
  patchLibraryPanelBody,
  patchTopbarMetrics,
  switchActiveView,
} from './dashboardDomUpdate';
import { refreshPathTrailLayout } from './dashboardPathLayout';
import {
  buildRoadmapBonusPick,
  type RoadmapBonusTier,
} from '../lib/roadmapBonusVideo';
import {
  markRoadmapCelebrationShown,
  normalizeRoadmapCompletionSnapshot,
} from '../lib/roadmapCompletionSnapshot';
import {
  cancelRoadmapCompletionCelebration,
  playRoadmapCompletionCelebration,
} from './roadmapCompletionCelebration';

const app = document.getElementById('app')!;

let searchQuery = '';
let libraryLevelFilter: '' | 'unset' | 'legacy' | LevelTag = '';
let activeView: DashView = readPersistedDashView();
let yearHeatmapYear = new Date().getFullYear();
let pathForceRebuild = false;
let pathRegenerateFromVideoIds: string[] = [];
let cachedData: PersistedData | null = null;
let renderGeneration = 0;
let pendingFullRenderAfterSearch = false;
let storageRenderSuppressUntil = 0;
let dashboardListenerAbort: AbortController | null = null;
let durationBackfillInFlight = false;

async function send<T>(msg: ExtensionMessage): Promise<T> {
  return chrome.runtime.sendMessage(msg) as Promise<T>;
}

async function loadData(): Promise<PersistedData> {
  const res = await send<GetStateResponse>({ type: MSG.GET_STATE });
  if (!res.ok || !('data' in res)) throw new Error('Failed to load');
  return res.data;
}

function syncSearchQueryFromDom(): void {
  const el = app.querySelector('#dash-search');
  if (el instanceof HTMLInputElement) searchQuery = el.value;
}

function buildVm(data: PersistedData) {
  return buildDashboardViewModel({
    data,
    libraryLevelFilter,
    searchQuery,
    activeView,
    yearHeatmapYear,
    pathForceRebuild,
    pathRegenerateFromVideoIds,
  });
}

function celebrationSubtitle(vm: ReturnType<typeof buildVm>): string {
  const p = vm.pathUi;
  if (p.showGoalMet) return vm.t('path.completeSubGoalMet');
  if (p.showPlanCompleteOnly && p.remainingSec > 0) {
    return vm.t('path.completeSubPlanOnly', {
      minutes: String(Math.ceil(p.remainingSec / 60)),
    });
  }
  return vm.t('path.goalMetSub');
}

async function pickRoadmapBonus(tierRaw: string, videoId: string): Promise<void> {
  if (!cachedData) return;
  const tier = tierRaw as RoadmapBonusTier;
  if (tier !== 'short' && tier !== 'medium' && tier !== 'long') return;
  const todayKey = buildVm(cachedData).todayKey;
  const pick = buildRoadmapBonusPick(cachedData, todayKey, tier, videoId);
  if (!pick) return;
  suppressStorageRender(400);
  await send({ type: MSG.SET_ROADMAP_BONUS_PICK, payload: { pick } });
  cachedData = { ...cachedData, roadmapBonusPick: pick };
  await refreshAfterMutation(['path']);
}

async function markCelebrationShownInStorage(): Promise<void> {
  const snap = normalizeRoadmapCompletionSnapshot(cachedData?.roadmapCompletionSnapshot);
  if (!snap || snap.celebrationShownAtMs) return;
  const updated = markRoadmapCelebrationShown(snap);
  await send({ type: MSG.SET_ROADMAP_COMPLETION_SNAPSHOT, payload: { snapshot: updated } });
  if (cachedData) cachedData = { ...cachedData, roadmapCompletionSnapshot: updated };
}

function scheduleRoadmapCelebration(vm: ReturnType<typeof buildVm>): void {
  if (!vm.pathUi.playCompletionCelebration) return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const section = app.querySelector<HTMLElement>('.path-section');
      if (!section) return;
      refreshPathTrailLayout(app);
      playRoadmapCompletionCelebration(section, {
        title: vm.t('path.completeTitle'),
        subtitle: celebrationSubtitle(vm),
        skipLabel: vm.t('path.celebrationSkip'),
        onComplete: () => {
          void markCelebrationShownInStorage();
        },
      });
    });
  });
}

async function regenerateTodayPath(): Promise<void> {
  cancelRoadmapCompletionCelebration();
  suppressStorageRender(2000);
  let data: PersistedData;
  try {
    data = cachedData ?? (await loadData());
  } catch {
    return;
  }
  pathRegenerateFromVideoIds = data.todayPathPlan?.steps.map((s) => s.videoId) ?? [];
  pathForceRebuild = true;
  await send({ type: MSG.SET_TODAY_PATH_PLAN, payload: { plan: null } });
  await send({ type: MSG.SET_ROADMAP_COMPLETION_SNAPSHOT, payload: { snapshot: null } });
  await send({ type: MSG.SET_ROADMAP_BONUS_PICK, payload: { pick: null } });
  if (cachedData) {
    cachedData = {
      ...cachedData,
      todayPathPlan: null,
      roadmapCompletionSnapshot: null,
      roadmapBonusPick: null,
    };
  }
  await refreshAfterMutation(['path']);
  pathRegenerateFromVideoIds = [];
}

async function persistPathPlanIfNeeded(vm: ReturnType<typeof buildVm>): Promise<void> {
  const plan = vm.pathUi.planToPersist;
  if (plan) {
    await send({ type: MSG.SET_TODAY_PATH_PLAN, payload: { plan } });
    pathForceRebuild = false;
  }
  if (vm.pathUi.clearCompletionSnapshot) {
    await send({ type: MSG.SET_ROADMAP_COMPLETION_SNAPSHOT, payload: { snapshot: null } });
    await send({ type: MSG.SET_ROADMAP_BONUS_PICK, payload: { pick: null } });
    if (cachedData) {
      cachedData = {
        ...cachedData,
        roadmapCompletionSnapshot: null,
        roadmapBonusPick: null,
      };
    }
  }
  const snapshot = vm.pathUi.snapshotToPersist;
  if (snapshot) {
    await send({ type: MSG.SET_ROADMAP_COMPLETION_SNAPSHOT, payload: { snapshot } });
    if (cachedData) cachedData = { ...cachedData, roadmapCompletionSnapshot: snapshot };
  }
}

function suppressStorageRender(ms = 450): void {
  storageRenderSuppressUntil = Date.now() + ms;
}

function countLibraryMissingDuration(data: PersistedData): number {
  return data.library.filter(
    (i) =>
      i.completedAt === null &&
      !(typeof i.durationSec === 'number' && Number.isFinite(i.durationSec) && i.durationSec > 0),
  ).length;
}

async function requestLibraryDurationBackfill(): Promise<void> {
  if (durationBackfillInFlight) return;
  durationBackfillInFlight = true;
  try {
    for (let round = 0; round < 8; round += 1) {
      const res = await send<BackfillLibraryDurationsOkResponse>({
        type: MSG.BACKFILL_LIBRARY_DURATIONS,
        payload: { limit: 6 },
      });
      if (!res.ok || res.attempted === 0) break;
      if (res.updated > 0) {
        pathForceRebuild = true;
        await refreshAfterMutation(['path']);
      }
      if (res.updated === 0) break;
    }
  } finally {
    durationBackfillInFlight = false;
  }
}

function scheduleLibraryDurationBackfill(data: PersistedData): void {
  if (countLibraryMissingDuration(data) === 0) return;
  void requestLibraryDurationBackfill();
}

function requestLibraryMetaEnrich(data: PersistedData): void {
  const needsMeta = data.library.filter(
    (i) =>
      i.title === 'Unknown title' ||
      isPlaceholderYoutubePageTitle(i.title) ||
      i.channel === 'Unknown channel',
  );
  for (const item of needsMeta.slice(0, 15)) {
    void send({
      type: MSG.ENRICH_LIBRARY_META,
      payload: { videoId: item.videoId },
    });
  }
}

function defaultMutationPanels(): DashView[] {
  const panels: DashView[] = ['library', 'path', 'completed'];
  if (!panels.includes(activeView)) panels.push(activeView);
  return panels;
}

function bindDashboardListeners(vm: ReturnType<typeof buildVm>): void {
  dashboardListenerAbort?.abort();
  dashboardListenerAbort = new AbortController();
  attachDashboardListeners({
    root: app,
    vm,
    send,
    signal: dashboardListenerAbort.signal,
    suppressStorageRender,
    switchView,
    refreshAfterMutation,
    refreshLibraryPanels,
    afterLibraryDataChange,
    onSearchBlur: () => {
      if (!pendingFullRenderAfterSearch) return;
      pendingFullRenderAfterSearch = false;
      void refreshAfterMutation(defaultMutationPanels());
    },
    setActiveView: (v) => {
      activeView = v;
    },
    setSearchQuery: (q) => {
      searchQuery = q;
    },
    setLibraryLevelFilter: (f: '' | 'unset' | 'legacy' | LevelTag) => {
      libraryLevelFilter = f;
    },
    setYearHeatmapYear: (y) => {
      yearHeatmapYear = y;
    },
    requestPathRebuild: () => {
      pathForceRebuild = true;
    },
    regenerateTodayPath: () => {
      void regenerateTodayPath();
    },
    pickRoadmapBonus: (tier, videoId) => {
      void pickRoadmapBonus(tier, videoId);
    },
    scheduleDurationBackfill: () => {
      if (cachedData) scheduleLibraryDurationBackfill(cachedData);
    },
  });
}

function switchView(view: DashView): void {
  if (view !== 'path') cancelRoadmapCompletionCelebration();
  activeView = view;
  persistDashView(view);
  switchActiveView(app, view);
}

function refreshLibraryPanels(): void {
  if (!cachedData) {
    render();
    return;
  }
  syncSearchQueryFromDom();
  const vm = buildVm(cachedData);
  libraryLevelFilter = vm.libraryLevelFilter;
  patchLibraryPanelBody(app, vm);
  attachLibraryPanelListeners({
    root: app,
    vm,
    send,
    signal: dashboardListenerAbort?.signal,
    refreshLibraryPanels,
    afterLibraryDataChange,
    setLibraryLevelFilter: (f: '' | 'unset' | 'legacy' | LevelTag) => {
      libraryLevelFilter = f;
    },
  });
}

async function refreshAfterMutation(panels: readonly DashView[] = defaultMutationPanels()): Promise<void> {
  suppressStorageRender();
  const gen = ++renderGeneration;
  let data: PersistedData;
  try {
    data = await loadData();
  } catch {
    return;
  }
  if (gen !== renderGeneration) return;
  if (!app.querySelector('.app-shell')) {
    render();
    return;
  }

  cachedData = data;
  syncSearchQueryFromDom();
  const vm = buildVm(data);
  libraryLevelFilter = vm.libraryLevelFilter;

  document.documentElement.setAttribute('lang', vm.resolvedLocale);
  document.documentElement.setAttribute('dir', vm.resolvedLocale === 'he' ? 'rtl' : 'ltr');

  const needsChrome = panels.some((p) => p === 'settings');
  const needsTopbar =
    panels.includes('library') ||
    panels.includes('path') ||
    panels.includes('completed') ||
    panels.includes('stats') ||
    panels.includes('progress') ||
    panels.includes('goals');

  if (needsChrome) patchDashboardChrome(app, vm, searchQuery);
  else if (needsTopbar) patchTopbarMetrics(app, vm);

  patchDashWelcome(app, vm);
  if (panels.length > 0) patchDashboardPanels(app, vm, panels);
  switchActiveView(app, activeView);
  await persistPathPlanIfNeeded(vm);
  bindDashboardListeners(vm);
  if (panels.includes('path')) {
    refreshPathTrailLayout(app);
    scheduleRoadmapCelebration(vm);
  }
}

function afterLibraryDataChange(): void {
  if (app.querySelector('.app-shell') && isDashSearchFocused(app)) {
    void refreshWhileSearchFocused();
    return;
  }
  void refreshAfterMutation(defaultMutationPanels());
}

function render(): void {
  void renderAsync();
}

async function renderAsync(): Promise<void> {
  const gen = ++renderGeneration;
  let data: PersistedData;
  try {
    data = await loadData();
  } catch {
    if (gen !== renderGeneration) return;
    app.innerHTML = `<div class="shell-error"><p>${escapeHtml(createTranslator(resolveLocale(undefined))('dash.loadError'))}</p></div>`;
    return;
  }
  if (gen !== renderGeneration) return;

  cachedData = data;
  syncSearchQueryFromDom();
  const vm = buildVm(data);
  libraryLevelFilter = vm.libraryLevelFilter;

  document.documentElement.setAttribute('lang', vm.resolvedLocale);
  document.documentElement.setAttribute('dir', vm.resolvedLocale === 'he' ? 'rtl' : 'ltr');

  requestLibraryMetaEnrich(data);
  scheduleLibraryDurationBackfill(data);

  const hasShell = Boolean(app.querySelector('.app-shell'));
  if (!hasShell) {
    app.innerHTML = dashboardShellHtml(vm, searchQuery);
    await persistPathPlanIfNeeded(vm);
    bindDashboardListeners(vm);
    refreshPathTrailLayout(app);
    if (activeView === 'path') scheduleRoadmapCelebration(vm);
    return;
  }

  suppressStorageRender();
  patchDashboardChrome(app, vm, searchQuery);
  patchDashboardPanels(app, vm, DASH_VIEWS);
  switchActiveView(app, activeView);
  bindDashboardListeners(vm);
  if (activeView === 'path') {
    refreshPathTrailLayout(app);
    scheduleRoadmapCelebration(vm);
  }
}

let storageRenderTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleRenderFromStorage(): void {
  if (Date.now() < storageRenderSuppressUntil) return;
  if (storageRenderTimer != null) clearTimeout(storageRenderTimer);
  storageRenderTimer = setTimeout(() => {
    storageRenderTimer = null;
    if (Date.now() < storageRenderSuppressUntil) return;
    if (app.querySelector('.app-shell') && isDashSearchFocused(app)) {
      pendingFullRenderAfterSearch = true;
      void refreshWhileSearchFocused();
      return;
    }
    void refreshAfterMutation(defaultMutationPanels());
  }, 150);
}

async function refreshWhileSearchFocused(): Promise<void> {
  const gen = ++renderGeneration;
  let data: PersistedData;
  try {
    data = await loadData();
  } catch {
    return;
  }
  if (gen !== renderGeneration) return;

  cachedData = data;
  syncSearchQueryFromDom();
  const vm = buildVm(data);
  libraryLevelFilter = vm.libraryLevelFilter;

  patchTopbarMetrics(app, vm);
  patchLibraryAndCompletedPanels(app, vm);
  attachLibraryPanelListeners({
    root: app,
    vm,
    send,
    signal: dashboardListenerAbort?.signal,
    refreshLibraryPanels,
    afterLibraryDataChange,
    setLibraryLevelFilter: (f: '' | 'unset' | 'legacy' | LevelTag) => {
      libraryLevelFilter = f;
    },
  });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes[STORAGE_KEY]) return;
  scheduleRenderFromStorage();
});

const stopStorageSyncPoll = startStorageSyncPoll(() => scheduleRenderFromStorage());
window.addEventListener('pagehide', stopStorageSyncPoll);

render();
