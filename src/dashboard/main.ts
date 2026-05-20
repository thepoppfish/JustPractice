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
  isDashSearchFocused,
  patchLibraryAndCompletedPanels,
  patchTopbarMetrics,
} from './dashboardDomUpdate';

const app = document.getElementById('app')!;

let searchQuery = '';
let libraryLevelFilter: '' | 'unset' | 'legacy' | LevelTag = '';
let activeView: DashView = 'library';
let yearHeatmapYear = new Date().getFullYear();
let cachedData: PersistedData | null = null;
let renderGeneration = 0;
let pendingFullRenderAfterSearch = false;

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

function afterLibraryDataChange(): void {
  if (app.querySelector('.app-shell') && isDashSearchFocused(app)) {
    void refreshWhileSearchFocused();
    return;
  }
  render();
}

function refreshLibraryPanels(): void {
  if (!cachedData) {
    render();
    return;
  }
  syncSearchQueryFromDom();
  const vm = buildVm(cachedData);
  libraryLevelFilter = vm.libraryLevelFilter;
  patchLibraryAndCompletedPanels(app, vm);
  attachLibraryPanelListeners({
    root: app,
    vm,
    send,
    render,
    refreshLibraryPanels,
    afterLibraryDataChange,
    setLibraryLevelFilter: (f: '' | 'unset' | 'legacy' | LevelTag) => {
      libraryLevelFilter = f;
    },
  });
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

  app.innerHTML = dashboardShellHtml(vm, searchQuery);

  attachDashboardListeners({
    root: app,
    vm,
    send,
    render,
    refreshLibraryPanels,
    afterLibraryDataChange,
    onSearchBlur: () => {
      if (!pendingFullRenderAfterSearch) return;
      pendingFullRenderAfterSearch = false;
      render();
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

let storageRenderTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleRenderFromStorage(): void {
  if (storageRenderTimer != null) clearTimeout(storageRenderTimer);
  storageRenderTimer = setTimeout(() => {
    storageRenderTimer = null;
    if (app.querySelector('.app-shell') && isDashSearchFocused(app)) {
      pendingFullRenderAfterSearch = true;
      void refreshWhileSearchFocused();
      return;
    }
    render();
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
    render,
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
