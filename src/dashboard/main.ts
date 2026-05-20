import { MSG } from '../lib/messages';
import type { ExtensionMessage, GetStateResponse } from '../lib/messages';
import { STORAGE_KEY, type LevelTag, type PersistedData } from '../lib/storage';
import { escapeHtml } from '../lib/htmlEscape';
import { createTranslator, resolveLocale } from '../i18n';
import { buildDashboardViewModel, type DashView } from './dashboardViewModel';
import { dashboardShellHtml } from './dashboardTemplates';
import { attachDashboardListeners } from './dashboardListeners';

const app = document.getElementById('app')!;

let searchQuery = '';
let libraryLevelFilter: '' | 'unset' | 'legacy' | LevelTag = '';
let activeView: DashView = 'library';
let yearHeatmapYear = new Date().getFullYear();

async function send<T>(msg: ExtensionMessage): Promise<T> {
  return chrome.runtime.sendMessage(msg) as Promise<T>;
}

async function loadData(): Promise<PersistedData> {
  const res = await send<GetStateResponse>({ type: MSG.GET_STATE });
  if (!res.ok || !('data' in res)) throw new Error('Failed to load');
  return res.data;
}

function render(): void {
  void renderAsync();
}

async function renderAsync(): Promise<void> {
  let data: PersistedData;
  try {
    data = await loadData();
  } catch {
    app.innerHTML = `<div class="shell-error"><p>${escapeHtml(createTranslator(resolveLocale(undefined))('dash.loadError'))}</p></div>`;
    return;
  }

  const vm = buildDashboardViewModel({
    data,
    libraryLevelFilter,
    searchQuery,
    activeView,
    yearHeatmapYear,
  });
  libraryLevelFilter = vm.libraryLevelFilter;

  document.documentElement.setAttribute('lang', vm.resolvedLocale);
  document.documentElement.setAttribute('dir', vm.resolvedLocale === 'he' ? 'rtl' : 'ltr');

  const needsMeta = vm.data.library.filter(
    (i) => i.title === 'Unknown title' || i.channel === 'Unknown channel',
  );
  for (const item of needsMeta.slice(0, 15)) {
    void send({
      type: MSG.ENRICH_LIBRARY_META,
      payload: { videoId: item.videoId },
    });
  }

  app.innerHTML = dashboardShellHtml(vm, searchQuery);

  attachDashboardListeners({
    root: app,
    vm,
    send,
    render,
    setActiveView: (v) => {
      activeView = v;
    },
    setSearchQuery: (q) => {
      searchQuery = q;
    },
    setLibraryLevelFilter: (f) => {
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
    render();
  }, 150);
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes[STORAGE_KEY]) return;
  scheduleRenderFromStorage();
});

render();
