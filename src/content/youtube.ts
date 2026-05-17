import { APP_NAME } from '../lib/branding';
import { MSG } from '../lib/messages';
import type { ExtensionMessage, ExtensionResponse, GetStateResponse } from '../lib/messages';
import {
  STORAGE_KEY,
  dateKeyFromTimestamp,
  defaultGoals,
  ensureSettingsShape,
  MIN_DAY_PRACTICE_CREDIT_SECONDS,
  missTrackingStartDateKey,
  type AppSettings,
  type LevelFramework,
  type LevelTag,
  type LibraryItem,
  type PersistedData,
  defaultSettings,
} from '../lib/storage';
import { tagsForFramework, matchesActiveFramework, isLegacyLevelTag } from '../lib/levelTags';
import { initFeedCards, pickFeedCardFromInteractionTarget, type VideoMeta } from './feedCards';
import { createPracticeIntervalController, shouldCountPracticeTime } from './youtubePracticeTimer';
import { formatGoalPairLine, formatGoalSlash, ringDasharrayFromProgress } from '../lib/goalFormat';
import { parseYoutubeVideoId, resolveYoutubeVideoIdFromPage } from '../lib/youtubeIds';
import { escapeAttr, escapeHtml } from '../lib/htmlEscape';
import { watchPanelShadowInnerHtml } from './youtubePanelHtml';
import { createTranslator, resolveLocale, type ResolvedLocale } from '../i18n';
import { formatDuration, practiceCalendarDayVisual, practiceStreakDays, dayCountsAsPracticedForCalendar } from '../lib/practiceStats';
import { isBenignExtensionMessagingFailure, messagingFailureText } from '../lib/extensionMessaging';

const PANEL_HOST_ID = 'jp-practice-yt-panel-host';

/** When the URL has no watch id, user can tap a home/search feed card to bind the floating panel to that video. */
let homePickMeta: VideoMeta | null = null;

/** Set `localStorage.setItem('jpPracticeDebug','1')` on youtube.com, reload; panel shows a green log strip + extra console lines. Remove key and reload to turn off. */
const JP_DEBUG_LS = 'jpPracticeDebug';

function jpWatchDebugEnabled(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(JP_DEBUG_LS) === '1';
  } catch {
    return false;
  }
}

function jpWatchLog(event: string, detail: Record<string, unknown> = {}): void {
  if (!jpWatchDebugEnabled()) return;
  try {
    console.info('[JustPractice:watch]', event, { t: new Date().toISOString(), ...detail });
  } catch {
    /* ignore */
  }
}

function jpWatchStrip(line: string): void {
  if (!jpWatchDebugEnabled() || !shadowRoot) return;
  const strip = shadowRoot.querySelector('[part="jp-debug-strip"]') as HTMLElement | null;
  if (!strip) return;
  strip.hidden = false;
  const prev = strip.textContent ?? '';
  const combined = prev ? `${prev}\n${line}` : line;
  strip.textContent = combined.split('\n').slice(-18).join('\n');
  strip.scrollTop = strip.scrollHeight;
}

function syncJpWatchDebugStrip(): void {
  if (!shadowRoot) return;
  const strip = shadowRoot.querySelector('[part="jp-debug-strip"]') as HTMLElement | null;
  if (!strip) return;
  if (!jpWatchDebugEnabled()) {
    strip.hidden = true;
    strip.textContent = '';
    return;
  }
  strip.hidden = false;
  if (!strip.textContent?.trim()) {
    strip.textContent =
      'Debug ON (jpPracticeDebug=1). Console filter: JustPractice:watch\nOff: localStorage.removeItem("jpPracticeDebug"); reload';
  }
}

let shadowRoot: ShadowRoot | null = null;
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

let libraryBannerTimer: number | null = null;
let lastDailySnapshot: Record<string, number> = {};
let extensionInstallDateKey = dateKeyFromTimestamp(Date.now());

let calendarYear = new Date().getFullYear();
let calendarMonth = new Date().getMonth();

/** Fire-and-forget async UI handlers (void foo() would leave rejections uncaught). */
function fireAsyncWatch(p: Promise<unknown>): void {
  void p.catch((err) => {
    if (isBenignExtensionMessagingFailure(err)) return;
    console.warn('[JustPractice:watch] async handler failed', err);
  });
}

async function sendMsg<T = unknown>(msg: ExtensionMessage): Promise<T> {
  try {
    return (await chrome.runtime.sendMessage(msg)) as T;
  } catch (e) {
    if (isBenignExtensionMessagingFailure(e)) {
      console.warn('[JustPractice:watch] Extension messaging unavailable; refresh this YouTube tab.', messagingFailureText(e));
      return { ok: false, error: messagingFailureText(e) } as T;
    }
    throw e;
  }
}

function sendMsgFireAndForget(msg: ExtensionMessage): void {
  void sendMsg(msg).catch((err) => {
    if (!isBenignExtensionMessagingFailure(err)) {
      console.warn('[JustPractice:watch] sendMessage failed', err);
    }
  });
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function dateKey(y: number, monthIndex: number, day: number): string {
  return `${y}-${pad2(monthIndex + 1)}-${pad2(day)}`;
}

function buildMergedDailyForPanel(dailySeconds: Record<string, number>): Record<string, number> {
  const merged = { ...dailySeconds };
  const todayKey = dateKeyFromTimestamp(Date.now());
  merged[todayKey] = Math.max(merged[todayKey] ?? 0, getTodayPracticeSeconds());
  return merged;
}

function calendarViewIncludesToday(): boolean {
  const t = new Date();
  return calendarYear === t.getFullYear() && calendarMonth === t.getMonth();
}

function streakCaption(t: (k: string, p?: Record<string, string | number>) => string, streak: number): string {
  if (streak <= 0) return t('dash.streakNone');
  if (streak === 1) return t('dash.streakOne');
  return t('dash.streakMany', { n: String(streak) });
}

function streakAriaLabel(t: (k: string, p?: Record<string, string | number>) => string, streak: number): string {
  if (streak <= 0) return t('dash.streakAriaNone');
  return t('dash.streakAria', { n: String(streak) });
}

function paintCalStreak(dailySeconds: Record<string, number>): void {
  if (!shadowRoot) return;
  const streakEl = shadowRoot.querySelector('[part="cal-streak"]') as HTMLElement | null;
  if (!streakEl) return;
  const merged = buildMergedDailyForPanel(dailySeconds);
  const missStart = missTrackingStartDateKey(extensionInstallDateKey, merged);
  const streak = practiceStreakDays(merged, Date.now(), missStart);
  streakEl.setAttribute('aria-label', streakAriaLabel(panelT, streak));
  streakEl.innerHTML = `<span class="cal-streak-flame" aria-hidden="true">🔥</span><span class="cal-streak-n">${String(
    streak,
  )}</span><span class="cal-streak-cap">${escapeHtml(streakCaption(panelT, streak))}</span>`;
}

function levelSelectOptionsHtml(framework: LevelFramework, customLevels: readonly string[]): string {
  return tagsForFramework(framework, customLevels)
    .map((l) => `<option value="${escapeAttr(l)}">${escapeHtml(l)}</option>`)
    .join('');
}

function populateLevelSelect(
  sel: HTMLSelectElement,
  fw: LevelFramework,
  current: LevelTag | null,
  customLevels: readonly string[],
): void {
  const parts: string[] = ['<option value="">—</option>'];
  for (const lv of tagsForFramework(fw, customLevels)) {
    parts.push(`<option value="${escapeAttr(lv)}">${escapeHtml(lv)}</option>`);
  }
  if (current !== null && isLegacyLevelTag(current, fw, customLevels)) {
    parts.push(
      `<option value="${escapeAttr(current)}">${escapeHtml(current)} (${escapeHtml(panelT('common.legacyShort'))})</option>`,
    );
  }
  sel.innerHTML = parts.join('');
  if (current !== null && (matchesActiveFramework(current, fw, customLevels) || isLegacyLevelTag(current, fw, customLevels))) {
    sel.value = current;
  } else {
    sel.value = '';
  }
}

function syncWatchPanelLabels(): void {
  if (!shadowRoot) return;
  const dh = shadowRoot.querySelector('[part="drag-hint"]');
  if (dh) dh.textContent = panelT('panel.dragToMove');
  const lvl = shadowRoot.querySelector('[part="level-label"]');
  if (lvl) lvl.textContent = panelT('common.level');
  const addBtn = shadowRoot.querySelector('[part="add"]') as HTMLButtonElement | null;
  if (addBtn) {
    addBtn.textContent = inLibrary ? panelT('panel.saveToLibraryWhenSaved') : panelT('panel.saveToLibrary');
    if (inLibrary) {
      addBtn.title = panelT('panel.saveToLibraryWhenSavedHint');
    } else {
      addBtn.removeAttribute('title');
    }
  }
  const practiceLb = shadowRoot.querySelector('[part="practice-label"]');
  if (practiceLb) practiceLb.textContent = panelT('panel.countPractice');
  const calLeg = shadowRoot.querySelector('[part="cal-legend"]');
  if (calLeg) calLeg.textContent = panelT('dash.practiceDayCreditHint');
  syncJpWatchDebugStrip();
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

function applyWatchPanelCollapsed(): void {
  if (!shadowRoot) return;
  const wrap = shadowRoot.querySelector('.wrap') as HTMLElement | null;
  const btn = shadowRoot.querySelector('[part="collapse"]') as HTMLButtonElement | null;
  if (!wrap || !btn) return;
  const collapsed = settingsCache.watchPanelCollapsed === true;
  wrap.classList.toggle('collapsed', collapsed);
  btn.textContent = collapsed ? '▼' : '▲';
  btn.title = collapsed ? panelT('panel.expand') : panelT('panel.collapse');
  btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
}

/** Whole minutes only (floor), aligned with {@link MIN_DAY_PRACTICE_CREDIT_SECONDS} for calendar color. */
function formatDayMinutes(sec: number): string {
  if (!sec || sec <= 0) return '';
  if (sec < MIN_DAY_PRACTICE_CREDIT_SECONDS) return '·';
  const m = Math.floor(sec / 60);
  if (m >= 60) return `${Math.floor(m / 60)}h`;
  return `${m}m`;
}

function getTodayPracticeSeconds(): number {
  const key = dateKeyFromTimestamp(Date.now());
  const stored = lastDailySnapshot[key] ?? 0;
  return stored + (practiceEnabled ? pendingSeconds : 0);
}

function updateDailyGoalRing(): void {
  if (!shadowRoot) return;
  const fg = shadowRoot.querySelector('[part="daily-ring-fg"]') as SVGCircleElement | null;
  const label = shadowRoot.querySelector('[part="daily-ring-label"]') as HTMLElement | null;
  const wrap = shadowRoot.querySelector('[part="daily-goal-ring"]') as HTMLElement | null;
  if (!fg || !label || !wrap) return;

  const goals = settingsCache.goals ?? defaultGoals();
  const target = goals.dailyTargetSec;
  const done = getTodayPracticeSeconds();

  if (target === null || target <= 0) {
    fg.setAttribute('stroke-dasharray', '0 100');
    fg.style.strokeDashoffset = '0';
    label.textContent = '—';
    label.classList.add('daily-ring-muted');
    wrap.title = 'Set a daily goal in the extension dashboard (Goals tab).';
    return;
  }

  label.classList.remove('daily-ring-muted');
  const pct = Math.min(1, done / target);
  fg.setAttribute('stroke-dasharray', ringDasharrayFromProgress(pct));
  fg.style.strokeDashoffset = '0';
  label.textContent = formatGoalSlash(done, target);
  wrap.title = `Daily goal: ${formatGoalPairLine(done, target)} (${Math.round(pct * 100)}%).`;
}

function renderCalendar(dailySeconds: Record<string, number>): void {
  if (!shadowRoot) return;
  const grid = shadowRoot.querySelector('[part="cal-grid"]') as HTMLElement | null;
  const label = shadowRoot.querySelector('[part="cal-label"]') as HTMLElement | null;
  if (!grid || !label) return;

  const locale = panelLocale;
  const labelDate = new Date(calendarYear, calendarMonth, 1);
  label.textContent = labelDate.toLocaleDateString(locale, { month: 'long', year: 'numeric' });

  const goals = settingsCache.goals ?? defaultGoals();
  const dailyGoalSec =
    goals.dailyTargetSec != null && goals.dailyTargetSec > 0 ? goals.dailyTargetSec : null;

  const merged = buildMergedDailyForPanel(dailySeconds);
  const todayKey = dateKeyFromTimestamp(Date.now());

  const first = new Date(calendarYear, calendarMonth, 1);
  const lastDay = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const startPad = (first.getDay() + 6) % 7;

  grid.innerHTML = '';
  const wdRow = document.createElement('div');
  wdRow.className = 'cal-weekday-row';
  for (let i = 0; i < 7; i++) {
    const ref = new Date(2024, 0, 1 + i);
    const c = document.createElement('span');
    c.className = 'cal-wd';
    c.textContent = ref.toLocaleDateString(locale, { weekday: 'short' });
    wdRow.appendChild(c);
  }
  grid.appendChild(wdRow);

  const cellsWrap = document.createElement('div');
  cellsWrap.className = 'cal-cells';
  for (let i = 0; i < startPad; i++) {
    const empty = document.createElement('div');
    empty.className = 'cal-cell cal-cell-empty';
    cellsWrap.appendChild(empty);
  }
  const today = new Date();
  const todayY = today.getFullYear();
  const todayM = today.getMonth();
  const todayD = today.getDate();

  for (let day = 1; day <= lastDay; day++) {
    const cell = document.createElement('div');
    cell.className = 'cal-cell';
    const key = dateKey(calendarYear, calendarMonth, day);
    const isToday =
      todayY === calendarYear && todayM === calendarMonth && todayD === day;
    if (isToday) cell.classList.add('cal-cell-today');

    const isFuture =
      calendarYear > todayY ||
      (calendarYear === todayY && calendarMonth > todayM) ||
      (calendarYear === todayY && calendarMonth === todayM && day > todayD);

    const sec = isFuture ? 0 : (merged[key] ?? 0);

    if (isFuture) {
      cell.classList.add('cal-cell-future');
    } else {
      const vis = practiceCalendarDayVisual(
        key,
        sec,
        todayKey,
        extensionInstallDateKey,
        merged,
        dailyGoalSec,
      );
      cell.classList.add(vis === 'future' ? 'cal-cell-future' : `cal-cell--${vis}`);
    }

    const num = document.createElement('span');
    num.className = 'cal-day-num';
    num.textContent = String(day);
    cell.appendChild(num);

    const mins = document.createElement('span');
    mins.className = 'cal-day-min';
    mins.textContent = isFuture ? '' : formatDayMinutes(sec);
    cell.appendChild(mins);

    if (!isFuture && dayCountsAsPracticedForCalendar(sec)) {
      cell.title = formatDuration(sec);
    } else if (isFuture) {
      cell.title = '';
    } else {
      cell.title = '';
    }

    cellsWrap.appendChild(cell);
  }
  grid.appendChild(cellsWrap);
  paintCalStreak(dailySeconds);
  const calLeg = shadowRoot.querySelector('[part="cal-legend"]');
  if (calLeg) calLeg.textContent = panelT('dash.practiceDayCreditHint');
}

function attachPanelDrag(host: HTMLElement, handle: HTMLElement): void {
  handle.style.touchAction = 'none';
  handle.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const rect = host.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    const move = (ev: PointerEvent): void => {
      let nx = ev.clientX - offsetX;
      let ny = ev.clientY - offsetY;
      const w = host.offsetWidth;
      const h = host.offsetHeight;
      nx = Math.max(8, Math.min(nx, window.innerWidth - w - 8));
      ny = Math.max(8, Math.min(ny, window.innerHeight - h - 8));
      host.style.left = `${nx}px`;
      host.style.top = `${ny}px`;
      host.style.right = 'auto';
      host.style.bottom = 'auto';
    };

    const up = (_ev: PointerEvent): void => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', up);
      const left = parseFloat(host.style.left) || 0;
      const top = parseFloat(host.style.top) || 0;
      sendMsgFireAndForget({
        type: MSG.SET_SETTINGS,
        payload: { watchPanelLeft: left, watchPanelTop: top },
      });
    };

    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', up);
  });
}

function getVideoIdFromUrl(): string | null {
  const resolved = resolveYoutubeVideoIdFromPage();
  if (resolved) {
    homePickMeta = null;
    return resolved;
  }
  return homePickMeta?.videoId ?? null;
}

function getVideoElement(): HTMLVideoElement | null {
  const movie = document.querySelector('#movie_player video');
  if (movie instanceof HTMLVideoElement) return movie;
  const shorts = document.querySelector(
    'ytd-shorts #player-container video, ytd-reel-video-renderer video, ytd-short video',
  );
  if (shorts instanceof HTMLVideoElement) return shorts;
  const watchFlexy = document.querySelector('ytd-watch-flexy #player-container video');
  if (watchFlexy instanceof HTMLVideoElement) return watchFlexy;
  const v = document.querySelector('video');
  return v instanceof HTMLVideoElement ? v : null;
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
  if (document.getElementById(PANEL_HOST_ID)) return;

  const host = document.createElement('div');
  host.id = PANEL_HOST_ID;
  host.setAttribute('data-jp-practice', '1');
  Object.assign(host.style, {
    position: 'fixed',
    right: '16px',
    bottom: '88px',
    zIndex: '99999',
    fontFamily: 'system-ui, Segoe UI, Roboto, sans-serif',
    fontSize: '13px',
    maxWidth: '300px',
  });

  shadowRoot = host.attachShadow({ mode: 'open' });
  const fw = settingsCache.levelFramework ?? 'jlpt';
  const customLv = settingsCache.customLevels ?? [];
  shadowRoot.innerHTML = watchPanelShadowInnerHtml(levelSelectOptionsHtml(fw, customLv), {
    dragToMove: panelT('panel.dragToMove'),
    level: panelT('common.level'),
    saveToLibrary: panelT('panel.saveToLibrary'),
    countPracticeTime: panelT('panel.countPractice'),
  });

  const root = shadowRoot.querySelector('.wrap') as HTMLElement;
  const addBtn = shadowRoot.querySelector('[part="add"]') as HTMLButtonElement;
  const difficultySelect = shadowRoot.querySelector('[part="difficulty"]') as HTMLSelectElement;
  const practiceToggle = shadowRoot.querySelector('[part="practice"]') as HTMLInputElement;
  const statusEl = shadowRoot.querySelector('[part="status"]') as HTMLElement;
  const hintEl = shadowRoot.querySelector('[part="hint"]') as HTMLElement;
  const dragHandle = shadowRoot.querySelector('[part="drag-handle"]') as HTMLElement;
  const collapseBtn = shadowRoot.querySelector('[part="collapse"]') as HTMLButtonElement;
  const calPrev = shadowRoot.querySelector('[part="cal-prev"]') as HTMLButtonElement;
  const calNext = shadowRoot.querySelector('[part="cal-next"]') as HTMLButtonElement;

  collapseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const next = !settingsCache.watchPanelCollapsed;
    settingsCache = { ...settingsCache, watchPanelCollapsed: next };
    applyWatchPanelCollapsed();
    sendMsgFireAndForget({
      type: MSG.SET_SETTINGS,
      payload: { watchPanelCollapsed: next },
    });
  });

  ui = {
    root,
    practiceToggle,
    difficultySelect,
    addBtn,
    statusEl,
    hintEl,
  };

  addBtn.addEventListener('click', () => fireAsyncWatch(saveToLibrary()));
  difficultySelect.addEventListener('change', () => fireAsyncWatch(onDifficultyChange(difficultySelect.value)));
  practiceToggle.addEventListener('change', () => {
    practiceEnabled = practiceToggle.checked;
    updateHint();
    resetTimers();
    updateDailyGoalRing();
  });

  calPrev.addEventListener('click', () => {
    calendarMonth -= 1;
    if (calendarMonth < 0) {
      calendarMonth = 11;
      calendarYear -= 1;
    }
    fireAsyncWatch(refreshCalendarOnly());
  });
  calNext.addEventListener('click', () => {
    calendarMonth += 1;
    if (calendarMonth > 11) {
      calendarMonth = 0;
      calendarYear += 1;
    }
    fireAsyncWatch(refreshCalendarOnly());
  });

  attachPanelDrag(host, dragHandle);

  document.documentElement.appendChild(host);
  applyPanelHostPosition();
  applyWatchPanelCollapsed();
}

async function refreshCalendarOnly(): Promise<void> {
  try {
    const res = (await sendMsg<GetStateResponse>({ type: MSG.GET_STATE })) as GetStateResponse;
    if (res?.ok && 'data' in res) {
      lastDailySnapshot = { ...res.data.dailySeconds };
      extensionInstallDateKey = res.data.extensionInstalledDateKey;
      renderCalendar(res.data.dailySeconds);
      updateDailyGoalRing();
    }
  } catch {
    /* ignore */
  }
}

async function refreshState(videoId: string | null): Promise<void> {
  if (!ui) return;
  if (!videoId) {
    libraryItemForCurrentVideo = null;
    inLibrary = false;
    return;
  }
  const saveRowEl = shadowRoot?.querySelector('[part="save-row"]') as HTMLElement | null;

  try {
    const res = (await sendMsg<GetStateResponse>({
      type: MSG.GET_STATE,
    })) as GetStateResponse;
    if (!res?.ok || !('data' in res)) {
      if (saveRowEl) saveRowEl.hidden = false;
      libraryItemForCurrentVideo = null;
      inLibrary = false;
      syncWatchPanelLabels();
      return;
    }
    settingsCache = ensureSettingsShape({ ...defaultSettings(), ...res.data.settings });
    applyPanelHostPosition();
    applyWatchPanelCollapsed();
    lastDailySnapshot = { ...res.data.dailySeconds };
    extensionInstallDateKey = res.data.extensionInstalledDateKey;
    renderCalendar(res.data.dailySeconds);
    updateDailyGoalRing();
    const item = res.data.library.find((x) => x.videoId === videoId);
    inLibrary = Boolean(item);
    libraryItemForCurrentVideo = item ?? null;
    panelLocale = resolveLocale(settingsCache.uiLocale);
    panelT = createTranslator(panelLocale);
    syncWatchPanelLabels();

    populateLevelSelect(
      ui.difficultySelect,
      settingsCache.levelFramework ?? 'jlpt',
      item?.difficulty ?? null,
      settingsCache.customLevels ?? [],
    );

    ui.statusEl.textContent = item ? panelT('panel.statusInLibrary') : panelT('panel.statusNotSaved');

    if (saveRowEl) saveRowEl.hidden = false;

    if (item) {
      practiceEnabled = true;
      ui.practiceToggle.checked = true;
    } else {
      practiceEnabled = false;
      ui.practiceToggle.checked = false;
    }
    if (jpWatchDebugEnabled()) {
      jpWatchLog('refreshState:done', {
        videoId,
        inLibrary,
        libraryCount: res.data.library.length,
      });
      jpWatchStrip(`refreshState inLibrary=${String(inLibrary)} vid=${videoId.slice(0, 8)}…`);
    }
  } catch {
    libraryItemForCurrentVideo = null;
    inLibrary = false;
    ui.statusEl.textContent = panelT('panel.syncError');
    if (saveRowEl) saveRowEl.hidden = false;
    syncWatchPanelLabels();
  }
}

function updateHint(): void {
  if (!ui) return;
  ui.hintEl.textContent = practiceEnabled
    ? settingsCache.pauseWhenUnfocused ? panelT('panel.countHintFocused') : panelT('panel.countHintUnfocused')
    : panelT('panel.countHintOff');
}

async function saveToLibrary(): Promise<void> {
  const videoId = getVideoIdFromUrl();
  jpWatchLog('saveToLibrary:click', {
    videoId,
    hasUi: Boolean(ui),
    inLibrary,
    hasLibrarySnapshot: Boolean(libraryItemForCurrentVideo),
  });
  if (!videoId || !ui) {
    setFlash(ui?.statusEl ?? null, panelT('panel.noVideo'), 'err');
    jpWatchLog('saveToLibrary:abort', { reason: 'no-video-or-ui' });
    return;
  }
  const difficulty =
    ui.difficultySelect.value === '' ? null : (ui.difficultySelect.value as LevelTag);

  if (inLibrary) {
    jpWatchLog('saveToLibrary:branch-already-in-library', {
      difficulty,
      snapshotTitle: libraryItemForCurrentVideo?.title?.slice(0, 80),
    });
    return;
  }

  const res = (await sendMsg<ExtensionResponse>({
    type: MSG.ADD_OR_UPDATE_LIBRARY,
    payload: {
      videoId,
      title: readTitle(),
      channel: readChannel(),
      difficulty,
    },
  })) as ExtensionResponse;
  flashAfterLibraryWrite(res, 'panel.flashSaved');
  await refreshState(videoId);
  updateHint();
  resetTimers();
}

async function onDifficultyChange(value: string): Promise<void> {
  const videoId = getVideoIdFromUrl();
  if (!videoId || !ui) return;
  const difficulty = value === '' ? null : (value as LevelTag);
  if (inLibrary) {
    await sendMsg({
      type: MSG.SET_DIFFICULTY,
      payload: { videoId, difficulty },
    });
  } else {
    const res = (await sendMsg<ExtensionResponse>({
      type: MSG.ADD_OR_UPDATE_LIBRARY,
      payload: {
        videoId,
        title: readTitle(),
        channel: readChannel(),
        difficulty,
      },
    })) as ExtensionResponse;
    flashAfterLibraryWrite(res, 'panel.flashSavedLevel');
  }
  await refreshState(videoId);
  updateHint();
  resetTimers();
}

function setFlash(
  el: HTMLElement | null,
  text: string,
  tone: 'ok' | 'err' | 'warn' = 'ok',
): void {
  if (!el) return;
  el.textContent = text;
  el.style.color = tone === 'err' ? '#f88' : tone === 'warn' ? '#fdb' : '#9cf';
}

function flashAfterLibraryWrite(
  res: ExtensionResponse,
  successKey: 'panel.flashSaved' | 'panel.flashSavedLevel',
): void {
  if (!ui) return;
  jpWatchLog('flashAfterLibraryWrite', {
    ok: res.ok,
    libraryAction: res.ok && 'libraryAction' in res ? res.libraryAction : undefined,
  });
  if (!res.ok) {
    showLibraryBanner(res.error, 'err');
    return;
  }
  if ('libraryAction' in res && res.libraryAction === 'updated') {
    return;
  }
  setFlash(ui.statusEl, panelT(successKey));
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
  if (shadowRoot && calendarViewIncludesToday()) {
    renderCalendar(lastDailySnapshot);
  } else if (shadowRoot) {
    paintCalStreak(lastDailySnapshot);
  }
}

function flushPractice(): void {
  if (!currentVideoId || pendingSeconds <= 0) return;
  const ds = pendingSeconds;
  pendingSeconds = 0;
  sendMsgFireAndForget({
    type: MSG.PRACTICE_TICK,
    payload: {
      videoId: currentVideoId,
      deltaSeconds: ds,
      endedAtMs: Date.now(),
    },
  });
}

const practiceIntervals = createPracticeIntervalController({
  getIntervalsActive: () => practiceEnabled && Boolean(currentVideoId),
  onCountInterval: tickSecond,
  flush: flushPractice,
});

function resetTimers(): void {
  practiceIntervals.reset();
  updateDailyGoalRing();
}

function clearLibraryBanner(reason = 'unknown'): void {
  jpWatchLog('libraryBanner:clear', {
    reason,
    hadShadowRoot: Boolean(shadowRoot),
  });
  jpWatchStrip(`clear reason=${reason}`);
  if (libraryBannerTimer) {
    clearTimeout(libraryBannerTimer);
    libraryBannerTimer = null;
  }
  const el = shadowRoot?.querySelector('[part="library-banner"]') as HTMLElement | null;
  if (!el) {
    if (shadowRoot) {
      jpWatchLog('libraryBanner:clear:missing-banner-in-shadow', { reason });
      jpWatchStrip(`WARN: no [part=library-banner] (${reason})`);
    }
    return;
  }
  el.hidden = true;
  el.textContent = '';
  el.className = 'library-banner';
}

function showLibraryBanner(text: string, tone: 'ok' | 'err' | 'warn'): void {
  jpWatchLog('libraryBanner:show:start', {
    tone,
    textLen: text.length,
    textPreview: text.slice(0, 160),
    hasShadowRoot: Boolean(shadowRoot),
  });
  const el = shadowRoot?.querySelector('[part="library-banner"]') as HTMLElement | null;
  if (!el) {
    jpWatchLog('libraryBanner:show:missing-element', { tone, textLen: text.length });
    jpWatchStrip(`ERROR: no [part=library-banner] in shadow (tone=${tone})`);
    return;
  }
  if (libraryBannerTimer) {
    clearTimeout(libraryBannerTimer);
    libraryBannerTimer = null;
  }
  el.className = `library-banner library-banner--${tone}`;
  el.textContent = text;
  el.hidden = false;
  jpWatchLog('libraryBanner:show:applied', {
    tone,
    hidden: el.hidden,
    className: el.className,
    computedDisplay: typeof getComputedStyle !== 'undefined' ? getComputedStyle(el).display : 'n/a',
  });
  jpWatchStrip(`banner applied tone=${tone} hidden=${String(el.hidden)} len=${text.length}`);
  libraryBannerTimer = window.setTimeout(() => {
    libraryBannerTimer = null;
    clearLibraryBanner('timeout');
  }, 14000);
}

function needsHomeFeedAttention(): boolean {
  if (typeof location === 'undefined') return false;
  if (!/(^|\.)youtube\.com$/i.test(location.hostname) && !/(^|\.)m\.youtube\.com$/i.test(location.hostname)) {
    return false;
  }
  const path = location.pathname;
  if (path.startsWith('/watch') || path.startsWith('/shorts/')) return false;
  return getVideoIdFromUrl() === null;
}

/** After first flash of the home attention strip, auto-expand once if the user had collapsed the panel. */
let prevHomeFeedAttentionShown = false;

function applyNoVideoHomePanelLayout(active: boolean): void {
  if (!shadowRoot) return;
  const wrap = shadowRoot.querySelector('.wrap') as HTMLElement | null;
  if (!wrap) return;
  wrap.classList.toggle('wrap--no-video', active);
}

function updateHomeFeedAttentionStrip(): void {
  if (!shadowRoot) return;
  const el = shadowRoot.querySelector('[part="home-feed-attention"]') as HTMLElement | null;
  const wrap = shadowRoot.querySelector('.wrap') as HTMLElement | null;
  if (!el || !wrap) return;

  const show = needsHomeFeedAttention();
  if (show) {
    if (!prevHomeFeedAttentionShown && settingsCache.watchPanelCollapsed) {
      settingsCache = { ...settingsCache, watchPanelCollapsed: false };
      applyWatchPanelCollapsed();
      sendMsgFireAndForget({
        type: MSG.SET_SETTINGS,
        payload: { watchPanelCollapsed: false },
      });
    }
    prevHomeFeedAttentionShown = true;
    el.textContent = panelT('panel.homeFeedPickAttention');
    el.hidden = false;
    applyNoVideoHomePanelLayout(true);
  } else {
    prevHomeFeedAttentionShown = false;
    el.hidden = true;
    el.textContent = '';
    applyNoVideoHomePanelLayout(false);
  }
}

async function onVideoChanged(): Promise<void> {
  const vid = getVideoIdFromUrl();
  flushPractice();
  practiceEnabled = false;
  if (ui) {
    ui.practiceToggle.checked = false;
  }
  pendingSeconds = 0;
  const previousVideoId = currentVideoId;
  currentVideoId = vid;
  if (previousVideoId !== vid) {
    clearLibraryBanner('video-change');
  }

  if (!vid) {
    resetTimers();
    clearLibraryBanner('no-video');
    ensurePanel();
    applyPanelHostPosition();
    applyWatchPanelCollapsed();
    const titleEl = shadowRoot?.querySelector('[part="title"]') as HTMLElement | null;
    if (titleEl) titleEl.textContent = APP_NAME;
    updateHomeFeedAttentionStrip();
    updateHint();
    fireAsyncWatch(refreshCalendarOnly());

    const host = document.getElementById(PANEL_HOST_ID) as HTMLElement | null;
    if (needsHomeFeedAttention()) {
      if (host) (host as HTMLElement).style.display = '';
    } else {
      applyNoVideoHomePanelLayout(false);
      if (host) (host as HTMLElement).style.display = 'none';
    }
    return;
  }

  ensurePanel();
  if (shadowRoot?.host) (shadowRoot.host as HTMLElement).style.display = '';
  updateHomeFeedAttentionStrip();
  const titleEl = shadowRoot?.querySelector('[part="title"]') as HTMLElement | undefined;
  if (titleEl) {
    const t = readTitle();
    titleEl.textContent = t.length > 90 ? `${t.slice(0, 90)}…` : t;
  }
  await refreshState(vid);
  updateHint();
  resetTimers();
}

function elementTouchesPlayerShell(el: Element | null): boolean {
  if (!el) return false;
  return Boolean(
    el.closest('ytd-miniplayer') || el.closest('ytd-watch-flexy') || el.closest('.html5-video-player'),
  );
}

function mutationTouchesPlayerShell(m: MutationRecord): boolean {
  if (!(m.target instanceof Element)) return false;
  if (elementTouchesPlayerShell(m.target)) return true;
  if (m.type !== 'childList') return false;
  for (const n of [...m.addedNodes, ...m.removedNodes]) {
    if (!(n instanceof Element)) continue;
    if (n.matches('ytd-miniplayer, ytd-watch-flexy, .html5-video-player')) return true;
    if (elementTouchesPlayerShell(n)) return true;
  }
  return false;
}

function attachYoutubePlayerDomHooks(): void {
  if (typeof MutationObserver === 'undefined' || !document.documentElement) return;

  let debounceTimer: number | null = null;
  const scheduleOnVideoChanged = (): void => {
    if (debounceTimer !== null) clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
      debounceTimer = null;
      fireAsyncWatch(onVideoChanged());
    }, 150);
  };

  const observer = new MutationObserver((mutations) => {
    for (const rec of mutations) {
      if (mutationTouchesPlayerShell(rec)) {
        scheduleOnVideoChanged();
        return;
      }
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
  });
}

function elementInOurUiShell(node: Node | null): boolean {
  if (!node) return false;
  const panel = document.getElementById(PANEL_HOST_ID);
  if (panel && panel.contains(node)) return true;
  const feedPop = document.getElementById('jp-practice-feed-popover-host');
  if (feedPop && feedPop.contains(node)) return true;
  return false;
}

/** Bind panel to the feed card the user taps when the address bar has no watch/shorts id. */
function attachHomeFeedPointerPick(): void {
  document.addEventListener(
    'pointerdown',
    (ev: PointerEvent) => {
      if (ev.button !== 0) return;

      const path: EventTarget[] =
        typeof ev.composedPath === 'function' ? ev.composedPath() : ev.target != null ? [ev.target] : [];
      for (const step of path) {
        if (step instanceof Node && elementInOurUiShell(step)) return;
      }

      const pick = pickFeedCardFromInteractionTarget(ev.target);
      if (!pick) return;

      homePickMeta = pick;
      if (jpWatchDebugEnabled()) {
        jpWatchLog('homePick:card', { videoId: pick.videoId, title: pick.title.slice(0, 60) });
      }
      fireAsyncWatch(onVideoChanged());
    },
    true,
  );
}

function attachYoutubeNavHooks(): void {
  document.addEventListener('yt-navigate-finish', () => {
    window.setTimeout(() => fireAsyncWatch(onVideoChanged()), 0);
  });
  document.addEventListener('yt-page-data-updated', () => {
    window.setTimeout(() => fireAsyncWatch(onVideoChanged()), 0);
  });
}

function attachVisibilityHandlers(): void {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPractice();
  });
  window.addEventListener('blur', () => {
    if (settingsCache.pauseWhenUnfocused) flushPractice();
  });
  window.addEventListener('beforeunload', () => flushPractice());
}

function boot(): void {
  jpWatchLog('content-script:boot', {
    href: typeof location !== 'undefined' ? location.href : '',
    resolvedVideoId: getVideoIdFromUrl(),
    jpWatchDebug: jpWatchDebugEnabled(),
  });
  attachYoutubeNavHooks();
  attachYoutubePlayerDomHooks();
  attachHomeFeedPointerPick();
  attachVisibilityHandlers();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[STORAGE_KEY]) return;
    const nv = changes[STORAGE_KEY].newValue as PersistedData | undefined;
    if (nv?.settings && typeof nv.settings === 'object') {
      settingsCache = ensureSettingsShape({ ...defaultSettings(), ...nv.settings });
      panelLocale = resolveLocale(settingsCache.uiLocale);
      panelT = createTranslator(panelLocale);
      applyPanelHostPosition();
      applyWatchPanelCollapsed();
      syncWatchPanelLabels();
      updateHint();
      updateHomeFeedAttentionStrip();
    }
    fireAsyncWatch(
      (async () => {
        if (jpWatchDebugEnabled()) {
          jpWatchLog('storage:onChanged:refreshState', { key: STORAGE_KEY });
          jpWatchStrip('storage changed → refreshState');
        }
        await refreshState(getVideoIdFromUrl());
        updateHint();
        resetTimers();
      })(),
    );
  });
  fireAsyncWatch(onVideoChanged());
  initFeedCards();
}

boot();
