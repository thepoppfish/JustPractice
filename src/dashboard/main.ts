import { MSG } from '../lib/messages';
import type { ExtensionMessage, GetStateResponse } from '../lib/messages';
import { STORAGE_KEY, type LevelTag, type PersistedData } from '../lib/storage';
import { isPlaceholderYoutubePageTitle } from '../lib/youtubePageTitle';
import { escapeHtml } from '../lib/htmlEscape';
import { createTranslator, resolveLocale } from '../i18n';
import { buildDashboardViewModel, type DashView } from './dashboardViewModel';
import { dashboardShellHtml } from './dashboardTemplates';
import {
  attachDashboardListeners,
  attachLibraryPanelListeners,
} from './dashboardListeners';
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

const app = document.getElementById('app')!;

let searchQuery = '';
let libraryLevelFilter: '' | 'unset' | 'legacy' | LevelTag = '';
let activeView: DashView = 'library';
let yearHeatmapYear = new Date().getFullYear();
let cachedData: PersistedData | null = null;
let renderGeneration = 0;
let pendingFullRenderAfterSearch = false;
let storageRenderSuppressUntil = 0;
let dashboardListenerAbort: AbortController | null = null;

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
  });
}

function suppressStorageRender(ms = 450): void {
  storageRenderSuppressUntil = Date.now() + ms;
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
  const panels: DashView[] = ['library', 'completed'];
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
  });
}

function switchView(view: DashView): void {
  activeView = view;
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
    panels.includes('completed') ||
    panels.includes('stats') ||
    panels.includes('progress') ||
    panels.includes('goals');

  if (needsChrome) patchDashboardChrome(app, vm, searchQuery);
  else if (needsTopbar) patchTopbarMetrics(app, vm);

  patchDashWelcome(app, vm);
  if (panels.length > 0) patchDashboardPanels(app, vm, panels);
  switchActiveView(app, activeView);
  bindDashboardListeners(vm);
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

  const hasShell = Boolean(app.querySelector('.app-shell'));
  if (!hasShell) {
    app.innerHTML = dashboardShellHtml(vm, searchQuery);
    bindDashboardListeners(vm);
    return;
  }

  suppressStorageRender();
  patchDashboardChrome(app, vm, searchQuery);
  patchDashboardPanels(app, vm, DASH_VIEWS);
  switchActiveView(app, activeView);
  bindDashboardListeners(vm);
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

render();
