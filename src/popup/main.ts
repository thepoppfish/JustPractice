import { MSG } from '../lib/messages';
import type { ExtensionMessage, GetStateResponse } from '../lib/messages';
import { requestWatchPanelSpawn } from '../lib/youtubeTabMessaging';
import { APP_NAME, appIconUrl } from '../lib/branding';
import {
  STORAGE_KEY,
  defaultSettings,
  ensureSettingsShape,
  inProgressLibraryItems,
  type LevelFramework,
  type LevelTag,
  type LibraryItem,
  type PersistedData,
} from '../lib/storage';
import { startStorageSyncPoll } from '../lib/storageSyncPoll';
import { signatureOf } from '../lib/dataSignature';
import { tagsForFramework, isLegacyLevelTag, isJlptTag, isCefrTag } from '../lib/levelTags';
import { thumbnailUrlForVideoId } from '../lib/youtubeMeta';
import { isPlaceholderYoutubePageTitle } from '../lib/youtubePageTitle';
import { aggregatePracticeStats, formatDuration } from '../lib/practiceStats';
import { levelFromTotalXp, MAX_ACCOUNT_LEVEL, xpIntoCurrentLevel } from '../lib/playerProgress';
import { escapeAttr, escapeHtml } from '../lib/htmlEscape';
import { applyUiLocale, createTranslator, resolveLocale } from '../i18n';
import { attachPopupTabs } from './popupTabs';
import { rememberUiFocus } from '../lib/restoreUiFocus';
import { sendChecked } from '../lib/extensionMessaging';
import { uiActionFeedback } from '../lib/uiActionFeedback';
import { libraryUndoUi } from '../lib/libraryUndoUi';
import type { LibraryUndoOffer } from '../lib/libraryUndo';
import { libraryMetricsHtml, librarySecondaryActionsHtml, playbackForLibraryItem } from '../lib/libraryPresentation';

type FilterLevel = '' | 'unset' | 'legacy' | LevelTag;

const app = document.getElementById('app')!;
const actions = uiActionFeedback(app, createTranslator(resolveLocale('auto')));

async function send<T>(msg: ExtensionMessage): Promise<T> {
  return sendChecked<T>(msg);
}

async function loadData(): Promise<PersistedData> {
  const res = await send<GetStateResponse>({ type: MSG.GET_STATE });
  if (!res.ok || !('data' in res)) throw new Error('Failed to load');
  return res.data;
}

type PopupTab = 'library' | 'stats' | 'settings';

let filterLevel: FilterLevel = '';
let searchQuery = '';
/** Active tab is in-session UI state; tracked so re-renders don't reset it. */
let activeTab: PopupTab = 'library';
/** Signature of the data last painted; lets the 15s poll skip no-op renders. */
let lastRenderedSignature: string | null = null;

function matchesFilter(item: LibraryItem, fw: LevelFramework, customLevels: readonly string[]): boolean {
  if (filterLevel === '') return true;
  if (filterLevel === 'unset') return item.difficulty === null;
  if (filterLevel === 'legacy')
    return item.difficulty !== null && isLegacyLevelTag(item.difficulty, fw, customLevels);
  return item.difficulty === filterLevel;
}

function matchesSearch(item: LibraryItem): boolean {
  if (!searchQuery.trim()) return true;
  const q = searchQuery.toLowerCase();
  return (
    item.title.toLowerCase().includes(q) ||
    item.channel.toLowerCase().includes(q) ||
    item.videoId.toLowerCase().includes(q)
  );
}

function legacyPopupName(
  d: string,
  fw: LevelFramework,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  if (fw === 'jlpt') return isCefrTag(d) ? t('framework.cefr') : t('framework.other');
  if (fw === 'cefr') return isJlptTag(d) ? t('framework.jlpt') : t('framework.other');
  if (isJlptTag(d)) return t('framework.jlpt');
  if (isCefrTag(d)) return t('framework.cefr');
  return t('framework.other');
}

function difficultyLabel(
  d: LevelTag | null,
  fw: LevelFramework,
  customLevels: readonly string[],
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  if (d === null) return t('common.unrated');
  if (!isLegacyLevelTag(d, fw, customLevels)) return d;
  const fwName = legacyPopupName(d, fw, t);
  return t('dash.legacyBadge', { framework: fwName, tag: d });
}

function emptyMessage(inProgressCount: number, t: (k: string) => string): string {
  if (inProgressCount === 0 && !searchQuery.trim() && filterLevel === '') {
    return t('popup.libraryEmpty');
  }
  return t('popup.noMatches');
}

function render(): void {
  void renderAsync();
}

async function renderAsync(): Promise<void> {
  let data: PersistedData;
  try {
    data = await loadData();
  } catch {
    if (app.querySelector('.wrap')) return;
    applyUiLocale(resolveLocale(undefined));
    app.innerHTML = `<main class="wrap"><p class="empty">${escapeHtml(createTranslator(resolveLocale(undefined))('popup.loadError'))}</p></main>`;
    return;
  }
  lastRenderedSignature = signatureOf(data);

  const st = ensureSettingsShape({ ...defaultSettings(), ...data.settings });
  const fw = st.levelFramework ?? 'jlpt';
  const customLevels = st.customLevels ?? [];
  const locale = resolveLocale(st.uiLocale);
  applyUiLocale(locale);
  const t = createTranslator(locale);
  actions.setTranslator(t);
  const undo = libraryUndoUi(app, t, renderAsync);

  const validFilterTags = new Set(tagsForFramework(fw, customLevels));
  if (
    filterLevel !== '' &&
    filterLevel !== 'unset' &&
    filterLevel !== 'legacy' &&
    !validFilterTags.has(filterLevel)
  ) {
    filterLevel = '';
  }

  const { today, week, all } = aggregatePracticeStats(data);
  const pp = data.playerProgress;
  const accountLevel = levelFromTotalXp(pp.totalXp);
  const xpBar = xpIntoCurrentLevel(pp.totalXp);
  const maxLevel = accountLevel >= MAX_ACCOUNT_LEVEL;
  const prestigeBadge =
    pp.prestigeLevel > 0
      ? `<span class="popup-prestige-badge">${escapeHtml(t('progress.prestigeBadge', { level: String(pp.prestigeLevel) }))}</span>`
      : '';
  const xpLabel = maxLevel
    ? escapeHtml(t('progress.maxLevel'))
    : escapeHtml(t('popup.xpToNext', { current: String(xpBar.xpIntoLevel), needed: String(xpBar.xpNeededForNext) }));

  const inProgress = inProgressLibraryItems(data.library);

  const hasLegacyVideos = inProgress.some(
    (it) => it.difficulty !== null && isLegacyLevelTag(it.difficulty, fw, customLevels),
  );

  const needsMeta = data.library.filter(
    (i) =>
      i.title === 'Unknown title' ||
      isPlaceholderYoutubePageTitle(i.title) ||
      i.channel === 'Unknown channel',
  );
  for (const item of needsMeta.slice(0, 10)) {
    void send({
      type: MSG.ENRICH_LIBRARY_META,
      payload: { videoId: item.videoId },
    });
  }

  const filtered = inProgress
    .filter((item) => matchesFilter(item, fw, customLevels))
    .filter(matchesSearch)
    .sort((a, b) => b.addedAt - a.addedAt);

  const levelFilterOptions = [
    `<option value="" ${filterLevel === '' ? 'selected' : ''}>${escapeHtml(t('common.allLevels'))}</option>`,
    `<option value="unset" ${filterLevel === 'unset' ? 'selected' : ''}>${escapeHtml(t('common.unrated'))}</option>`,
    ...tagsForFramework(fw, customLevels).map(
      (L) =>
        `<option value="${escapeAttr(L)}" ${filterLevel === L ? 'selected' : ''}>${escapeHtml(L)}</option>`,
    ),
    ...(hasLegacyVideos ?
      [
        `<option value="legacy" ${filterLevel === 'legacy' ? 'selected' : ''}>${escapeHtml(t('dash.filterLegacy'))}</option>`,
      ]
    : []),
  ].join('');

  const restoreFocus = rememberUiFocus(app);
  actions.captureDrafts();
  app.innerHTML = `
    <main class="wrap">
      <div class="popup-head">
        <div class="popup-title-row">
          <img class="popup-logo" src="${escapeAttr(appIconUrl(32))}" width="28" height="28" alt="" />
          <h1 dir="ltr">${escapeHtml(APP_NAME)}</h1>
        </div>
        <div class="popup-xp-row">
          <span class="popup-rank-badge">${escapeHtml(t('popup.rank', { level: String(accountLevel) }))}</span>
          ${prestigeBadge}
          <div class="popup-xp-bar" role="progressbar" aria-label="${escapeAttr(t('progress.xpBarAria'))}" aria-valuemin="0" aria-valuemax="${maxLevel ? accountLevel : xpBar.xpNeededForNext}" aria-valuenow="${maxLevel ? accountLevel : xpBar.xpIntoLevel}">
            <div class="popup-xp-fill" style="width:${maxLevel ? 100 : xpBar.progressPercent}%"></div>
          </div>
          <bdi class="popup-xp-label">${xpLabel}</bdi>
        </div>
      </div>
      <p class="open-dash"><button type="button" class="linkish" id="open-dashboard">${escapeHtml(t('popup.openDashboard'))}</button></p>
      <div class="tabs" role="tablist" aria-label="${escapeAttr(t('dash.mainNavAria'))}">
        ${(['library', 'stats', 'settings'] as const).map((tab) => `<button type="button" id="tab-${tab}" role="tab" aria-controls="panel-${tab}" aria-selected="${activeTab === tab}" tabindex="${activeTab === tab ? 0 : -1}" data-tab="${tab}" class="${activeTab === tab ? 'active' : ''}">${escapeHtml(t(tab === 'library' ? 'popup.tabLibrary' : tab === 'stats' ? 'popup.tabStats' : 'popup.tabSettings'))}</button>`).join('')}
      </div>
      <div id="panel-library" role="tabpanel" aria-labelledby="tab-library" tabindex="0"${activeTab === 'library' ? '' : ' hidden'} class="panel${activeTab === 'library' ? ' active' : ''}">
        <input type="search" id="popup-search" class="search" dir="auto" aria-label="${escapeAttr(t('popup.searchPlaceholder'))}" placeholder="${escapeAttr(t('popup.searchPlaceholder'))}" value="${escapeAttr(
          searchQuery,
        )}" />
        <div class="filter-row">
          <label for="lvl-filter">${escapeHtml(t('common.level'))}</label>
          <select id="lvl-filter">
            ${levelFilterOptions}
          </select>
        </div>
        <div class="list">
          ${
            filtered.length === 0 ?
              `<div class="empty">${escapeHtml(emptyMessage(inProgress.length, t))}</div>`
            : filtered.map((item) => libraryItemHtml(item, data, fw, customLevels, t)).join('')
          }
        </div>
      </div>
      <div id="panel-stats" role="tabpanel" aria-labelledby="tab-stats" tabindex="0"${activeTab === 'stats' ? '' : ' hidden'} class="panel${activeTab === 'stats' ? ' active' : ''}">
        <div class="stats-grid">
          <div class="stat-card">
            <h2>${escapeHtml(t('common.today'))}</h2>
            <bdi class="value">${formatDuration(today)}</bdi>
          </div>
          <div class="stat-card">
            <h2>${escapeHtml(t('common.thisWeek'))}</h2>
            <bdi class="value">${formatDuration(week)}</bdi>
          </div>
          <div class="stat-card">
            <h2>${escapeHtml(t('common.allTime'))}</h2>
            <bdi class="value">${formatDuration(all)}</bdi>
          </div>
        </div>
        <p class="help stats-help">
          ${escapeHtml(t('popup.helpStats'))}
        </p>
      </div>
      <div id="panel-settings" role="tabpanel" aria-labelledby="tab-settings" tabindex="0"${activeTab === 'settings' ? '' : ' hidden'} class="panel${activeTab === 'settings' ? ' active' : ''}">
        <div class="settings">
          <label>
            <input type="checkbox" id="pause-unfocused" ${data.settings.pauseWhenUnfocused ? 'checked' : ''} />
            <span>${escapeHtml(t('popup.pauseUnfocused'))}</span>
          </label>
          <p class="help">${escapeHtml(t('popup.pauseHelp'))}</p>
          <label>
            <input type="checkbox" id="learning-focus-hide-recs" ${data.settings.learningFocusHideRecommendations !== false ? 'checked' : ''} />
            <span>${escapeHtml(t('popup.learningFocusHideRecs'))}</span>
          </label>
          <p class="help">${escapeHtml(t('popup.learningFocusHideRecsHelp'))}</p>
          <button type="button" class="btn-spawn-watch-panel" id="spawn-watch-panel">${escapeHtml(t('settings.showWatchPanel'))}</button>
          <p class="help">${escapeHtml(t('settings.showWatchPanelHelp'))}</p>
        </div>
      </div>
    </main>
  `;

  attachPopupTabs(app, (tab) => { activeTab = tab as PopupTab; });
  app.querySelector('#open-dashboard')?.addEventListener('click', () => {
    void chrome.runtime.openOptionsPage();
  });
  const searchEl = app.querySelector<HTMLInputElement>('.search');
  searchEl?.addEventListener('input', () => {
    searchQuery = searchEl.value;
    render();
  });
  const filterEl = app.querySelector<HTMLSelectElement>('#lvl-filter');
  filterEl?.addEventListener('change', () => {
    const raw = filterEl.value;
    const validTags = tagsForFramework(fw, customLevels);
    let next: FilterLevel = '';
    if (raw === '') next = '';
    else if (raw === 'unset') next = 'unset';
    else if (raw === 'legacy') next = 'legacy';
    else if ((validTags as readonly string[]).includes(raw)) next = raw as LevelTag;
    filterLevel = next;
    render();
  });

  app.querySelectorAll<HTMLButtonElement>('[data-remove]').forEach((btn) => {
    btn.addEventListener('click', (event) => actions.handle(event, async () => {
      const id = btn.getAttribute('data-remove');
      if (!id) return;
      const result = await actions.sender(send)<{ ok: true; undo: LibraryUndoOffer | null }>({ type: MSG.REMOVE_LIBRARY, payload: { videoId: id } });
      actions.silenceSuccess();
      await renderAsync();
      undo.removed(result.undo);
    }));
  });

  app.querySelectorAll<HTMLButtonElement>('[data-library-complete]').forEach((btn) => {
    btn.addEventListener('click', (event) => actions.handle(event, async () => {
      const videoId = btn.dataset.libraryComplete;
      if (!videoId) return;
      await actions.sender(send)({ type: MSG.SET_LIBRARY_COMPLETION, payload: { videoId, complete: btn.dataset.complete === 'true' } });
      await renderAsync();
      if (document.activeElement === document.body) app.querySelector<HTMLInputElement>('#popup-search')?.focus({ preventScroll: true });
    }));
  });

  const pauseEl = app.querySelector<HTMLInputElement>('#pause-unfocused');
  pauseEl?.addEventListener('change', (event) => actions.handle(event, async () => {
    await actions.sender(send)({
      type: MSG.SET_SETTINGS,
      payload: { pauseWhenUnfocused: pauseEl.checked },
    });
    render();
  }));

  app.querySelector('#spawn-watch-panel')?.addEventListener('click', (event) => actions.handle(event, async () => {
    const res = await requestWatchPanelSpawn();
    if (res.status === 'no_youtube_tabs') {
      window.alert(t('settings.showWatchPanelNoTab'));
    } else if (res.status === 'needs_refresh') {
      window.alert(t('settings.showWatchPanelNeedsRefresh'));
    }
  }));

  const learningFocusEl = app.querySelector<HTMLInputElement>('#learning-focus-hide-recs');
  learningFocusEl?.addEventListener('change', (event) => actions.handle(event, async () => {
    await actions.sender(send)({
      type: MSG.SET_SETTINGS,
      payload: { learningFocusHideRecommendations: learningFocusEl.checked },
    });
    render();
  }));
  actions.restore();
  restoreFocus();
}

function libraryItemHtml(
  item: LibraryItem,
  data: PersistedData,
  fw: LevelFramework,
  customLevels: readonly string[],
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  const { href, resume } = playbackForLibraryItem(item, data);
  const primary = t(resume ? 'library.continue' : 'common.open');
  const lvl = difficultyLabel(item.difficulty, fw, customLevels, t);
  const thumbSrc = thumbnailUrlForVideoId(item.videoId);
  return `
    <div class="item item-with-thumb">
      <img class="item-thumb" src="${escapeAttr(thumbSrc)}" width="120" height="68" alt="" loading="lazy" decoding="async" />
      <div class="item-body">
        <div class="item-title" dir="auto">${escapeHtml(item.title)}</div>
        <div class="item-meta"><bdi>${escapeHtml(item.channel)}</bdi> · <bdi>${escapeHtml(lvl)}</bdi></div>
        ${libraryMetricsHtml(item, data, t)}
        <div class="item-actions">
          <a class="library-primary" href="${escapeAttr(href)}" target="_blank" rel="noreferrer" aria-label="${escapeAttr(primary + ': ' + item.title)}">${escapeHtml(primary)}</a>
          ${librarySecondaryActionsHtml(item, 'popup', t)}
        </div>
      </div>
    </div>
  `;
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

/** Poll safety net: only re-render when stored data actually changed, so the
 *  user's active tab / scroll position is not reset every 15s. */
async function pollFromStorage(): Promise<void> {
  let data: PersistedData;
  try {
    data = await loadData();
  } catch {
    return;
  }
  if (signatureOf(data) === lastRenderedSignature) return;
  scheduleRenderFromStorage();
}

const stopStorageSyncPoll = startStorageSyncPoll(() => {
  void pollFromStorage();
});
window.addEventListener('pagehide', stopStorageSyncPoll);

render();
