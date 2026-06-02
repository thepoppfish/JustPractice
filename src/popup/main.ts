import { MSG } from '../lib/messages';
import type { ExtensionMessage, GetStateResponse } from '../lib/messages';
import { requestWatchPanelSpawn } from '../lib/youtubeTabMessaging';
import { APP_NAME } from '../lib/branding';
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
import { tagsForFramework, isLegacyLevelTag, isJlptTag, isCefrTag } from '../lib/levelTags';
import { thumbnailUrlForVideoId } from '../lib/youtubeMeta';
import { isPlaceholderYoutubePageTitle } from '../lib/youtubePageTitle';
import { aggregatePracticeStats, formatDuration } from '../lib/practiceStats';
import { levelFromTotalXp, MAX_ACCOUNT_LEVEL, xpIntoCurrentLevel } from '../lib/playerProgress';
import { escapeAttr, escapeHtml } from '../lib/htmlEscape';
import { createTranslator, resolveLocale } from '../i18n';

type FilterLevel = '' | 'unset' | 'legacy' | LevelTag;

const app = document.getElementById('app')!;

const POPUP_TIP_SEEN_KEY = 'jpPopupTipSeen' as const;

async function send<T>(msg: ExtensionMessage): Promise<T> {
  return chrome.runtime.sendMessage(msg) as Promise<T>;
}

async function loadData(): Promise<PersistedData> {
  const res = await send<GetStateResponse>({ type: MSG.GET_STATE });
  if (!res.ok || !('data' in res)) throw new Error('Failed to load');
  return res.data;
}

let filterLevel: FilterLevel = '';
let searchQuery = '';

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
    app.innerHTML = `<div class="wrap"><p class="empty">${escapeHtml(createTranslator(resolveLocale(undefined))('popup.loadError'))}</p></div>`;
    return;
  }

  const st = ensureSettingsShape({ ...defaultSettings(), ...data.settings });
  const fw = st.levelFramework ?? 'jlpt';
  const customLevels = st.customLevels ?? [];
  const t = createTranslator(resolveLocale(st.uiLocale));

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

  const tipStore = await chrome.storage.local.get(POPUP_TIP_SEEN_KEY);
  const showOnboardingTip = tipStore[POPUP_TIP_SEEN_KEY] !== true;

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

  app.innerHTML = `
    <div class="wrap">
      <div class="popup-head">
        <h1>${escapeHtml(APP_NAME)}</h1>
        <div class="popup-xp-row" aria-label="${escapeAttr(t('progress.xpBarAria'))}">
          <span class="popup-rank-badge">${escapeHtml(t('popup.rank', { level: String(accountLevel) }))}</span>
          ${prestigeBadge}
          <div class="popup-xp-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${maxLevel ? accountLevel : xpBar.xpNeededForNext}" aria-valuenow="${maxLevel ? accountLevel : xpBar.xpIntoLevel}">
            <div class="popup-xp-fill" style="width:${maxLevel ? 100 : xpBar.progressPercent}%"></div>
          </div>
          <span class="popup-xp-label">${xpLabel}</span>
        </div>
      </div>
      ${
        showOnboardingTip
          ? `<div class="onboarding-tip" role="status">
        <p class="onboarding-tip-text">${escapeHtml(t('popup.tipPractice'))}</p>
        <button type="button" class="onboarding-tip-dismiss" id="dismiss-onboarding-tip">${escapeHtml(t('popup.tipOk'))}</button>
      </div>`
          : ''
      }
      <p class="open-dash"><button type="button" class="linkish" id="open-dashboard">${escapeHtml(t('popup.openDashboard'))}</button></p>
      <div class="tabs">
        <button type="button" data-tab="library" class="active">${escapeHtml(t('popup.tabLibrary'))}</button>
        <button type="button" data-tab="stats">${escapeHtml(t('popup.tabStats'))}</button>
        <button type="button" data-tab="settings">${escapeHtml(t('popup.tabSettings'))}</button>
      </div>
      <div id="panel-library" class="panel active">
        <input type="search" class="search" placeholder="${escapeAttr(t('popup.searchPlaceholder'))}" value="${escapeAttr(
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
            : filtered.map((item) => libraryItemHtml(item, fw, customLevels, t)).join('')
          }
        </div>
      </div>
      <div id="panel-stats" class="panel">
        <div class="stats-grid">
          <div class="stat-card">
            <h2>${escapeHtml(t('common.today'))}</h2>
            <div class="value">${formatDuration(today)}</div>
          </div>
          <div class="stat-card">
            <h2>${escapeHtml(t('common.thisWeek'))}</h2>
            <div class="value">${formatDuration(week)}</div>
          </div>
          <div class="stat-card">
            <h2>${escapeHtml(t('common.allTime'))}</h2>
            <div class="value">${formatDuration(all)}</div>
          </div>
        </div>
        <p class="help" style="margin-top:12px;color:var(--muted);font-size:11px;line-height:1.4;">
          ${escapeHtml(t('popup.helpStats'))}
        </p>
      </div>
      <div id="panel-settings" class="panel">
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
    </div>
  `;

  wireTabs();
  app.querySelector('#dismiss-onboarding-tip')?.addEventListener('click', async () => {
    await chrome.storage.local.set({ [POPUP_TIP_SEEN_KEY]: true });
    render();
  });
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
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-remove');
      if (!id) return;
      await send({ type: MSG.REMOVE_LIBRARY, payload: { videoId: id } });
      render();
    });
  });

  const pauseEl = app.querySelector<HTMLInputElement>('#pause-unfocused');
  pauseEl?.addEventListener('change', async () => {
    await send({
      type: MSG.SET_SETTINGS,
      payload: { pauseWhenUnfocused: pauseEl.checked },
    });
    render();
  });

  app.querySelector('#spawn-watch-panel')?.addEventListener('click', async () => {
    const res = await requestWatchPanelSpawn();
    if (res.status === 'no_youtube_tabs') {
      window.alert(t('settings.showWatchPanelNoTab'));
    } else if (res.status === 'needs_refresh') {
      window.alert(t('settings.showWatchPanelNeedsRefresh'));
    }
  });

  const learningFocusEl = app.querySelector<HTMLInputElement>('#learning-focus-hide-recs');
  learningFocusEl?.addEventListener('change', async () => {
    await send({
      type: MSG.SET_SETTINGS,
      payload: { learningFocusHideRecommendations: learningFocusEl.checked },
    });
    render();
  });
}

function libraryItemHtml(
  item: LibraryItem,
  fw: LevelFramework,
  customLevels: readonly string[],
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  const href = `https://www.youtube.com/watch?v=${encodeURIComponent(item.videoId)}`;
  const lvl = difficultyLabel(item.difficulty, fw, customLevels, t);
  const thumbSrc = thumbnailUrlForVideoId(item.videoId);
  return `
    <div class="item item-with-thumb">
      <img class="item-thumb" src="${escapeAttr(thumbSrc)}" width="120" height="68" alt="" loading="lazy" decoding="async" />
      <div class="item-body">
        <div class="item-title">${escapeHtml(item.title)}</div>
        <div class="item-meta">${escapeHtml(item.channel)} · ${escapeHtml(lvl)}</div>
        <div class="item-actions">
          <a href="${href}" target="_blank" rel="noreferrer">${escapeHtml(t('common.open'))}</a>
          <button type="button" class="danger" data-remove="${escapeAttr(item.videoId)}">${escapeHtml(t('common.remove'))}</button>
        </div>
      </div>
    </div>
  `;
}

function wireTabs(): void {
  const buttons = app.querySelectorAll<HTMLButtonElement>('.tabs button');
  const panels = app.querySelectorAll<HTMLElement>('.panel');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      buttons.forEach((b) => b.classList.toggle('active', b === btn));
      panels.forEach((p) => {
        const id = p.id.replace('panel-', '');
        p.classList.toggle('active', id === tab);
      });
    });
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

const stopStorageSyncPoll = startStorageSyncPoll(() => scheduleRenderFromStorage());
window.addEventListener('pagehide', stopStorageSyncPoll);

render();
