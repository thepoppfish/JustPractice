import { formatGoalPairLine, formatGoalSlash, ringDasharrayFromProgress } from '../lib/goalFormat';
import { escapeAttr, escapeHtml } from '../lib/htmlEscape';
import { matchesActiveFramework, isLegacyLevelTag, tagsForFramework } from '../lib/levelTags';
import {
  dateKeyFromTimestamp,
  MIN_DAY_PRACTICE_CREDIT_SECONDS,
  missTrackingStartDateKey,
  type LevelFramework,
  type LevelTag,
  type PracticeGoals,
} from '../lib/storage';
import {
  dayCountsAsPracticedForCalendar,
  formatDuration,
  practiceCalendarDayVisual,
  practiceStreakDays,
} from '../lib/practiceStats';
import type { ResolvedLocale } from '../i18n';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function dateKey(y: number, monthIndex: number, day: number): string {
  return `${y}-${pad2(monthIndex + 1)}-${pad2(day)}`;
}

export function buildMergedDailyForPanel(
  dailySeconds: Record<string, number>,
  getTodayPracticeSeconds: () => number,
): Record<string, number> {
  const merged = { ...dailySeconds };
  const todayKey = dateKeyFromTimestamp(Date.now());
  merged[todayKey] = Math.max(merged[todayKey] ?? 0, getTodayPracticeSeconds());
  return merged;
}

export function calendarViewIncludesToday(calendarYear: number, calendarMonth: number): boolean {
  const t = new Date();
  return calendarYear === t.getFullYear() && calendarMonth === t.getMonth();
}

export function streakCaption(
  t: (k: string, p?: Record<string, string | number>) => string,
  streak: number,
): string {
  if (streak <= 0) return t('dash.streakNone');
  if (streak === 1) return t('dash.streakOne');
  return t('dash.streakMany', { n: String(streak) });
}

export function streakAriaLabel(
  t: (k: string, p?: Record<string, string | number>) => string,
  streak: number,
): string {
  if (streak <= 0) return t('dash.streakAriaNone');
  return t('dash.streakAria', { n: String(streak) });
}

export function levelSelectOptionsHtml(framework: LevelFramework, customLevels: readonly string[]): string {
  return tagsForFramework(framework, customLevels)
    .map((l) => `<option value="${escapeAttr(l)}">${escapeHtml(l)}</option>`)
    .join('');
}

export function populateLevelSelect(
  sel: HTMLSelectElement,
  fw: LevelFramework,
  current: LevelTag | null,
  customLevels: readonly string[],
  panelT: (k: string, p?: Record<string, string | number>) => string,
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

export function syncWatchPanelLabels(p: {
  shadowRoot: ShadowRoot | null;
  inLibrary: boolean;
  panelT: (k: string, p?: Record<string, string | number>) => string;
  onAfter?: () => void;
}): void {
  if (!p.shadowRoot) return;
  const dh = p.shadowRoot.querySelector('[part="drag-hint"]');
  if (dh) dh.textContent = p.panelT('panel.dragToMove');
  const lvl = p.shadowRoot.querySelector('[part="level-label"]');
  if (lvl) lvl.textContent = p.panelT('common.level');
  const addBtn = p.shadowRoot.querySelector('[part="add"]') as HTMLButtonElement | null;
  if (addBtn) {
    addBtn.textContent = p.inLibrary ? p.panelT('panel.saveToLibraryWhenSaved') : p.panelT('panel.saveToLibrary');
    if (p.inLibrary) {
      addBtn.title = p.panelT('panel.saveToLibraryWhenSavedHint');
    } else {
      addBtn.removeAttribute('title');
    }
  }
  const practiceLb = p.shadowRoot.querySelector('[part="practice-label"]');
  if (practiceLb) practiceLb.textContent = p.panelT('panel.countPractice');
  const calLeg = p.shadowRoot.querySelector('[part="cal-legend"]');
  if (calLeg) calLeg.textContent = p.panelT('dash.practiceDayCreditHint');
  p.onAfter?.();
}

export function applyWatchPanelCollapsed(p: {
  shadowRoot: ShadowRoot | null;
  collapsed: boolean;
  panelT: (k: string, p?: Record<string, string | number>) => string;
}): void {
  if (!p.shadowRoot) return;
  const wrap = p.shadowRoot.querySelector('.wrap') as HTMLElement | null;
  const btn = p.shadowRoot.querySelector('[part="collapse"]') as HTMLButtonElement | null;
  if (!wrap || !btn) return;
  wrap.classList.toggle('collapsed', p.collapsed);
  btn.textContent = p.collapsed ? '▼' : '▲';
  btn.title = p.collapsed ? p.panelT('panel.expand') : p.panelT('panel.collapse');
  btn.setAttribute('aria-expanded', p.collapsed ? 'false' : 'true');
}

/** Whole minutes only (floor), aligned with {@link MIN_DAY_PRACTICE_CREDIT_SECONDS} for calendar color. */
export function formatDayMinutes(sec: number): string {
  if (!sec || sec <= 0) return '';
  if (sec < MIN_DAY_PRACTICE_CREDIT_SECONDS) return '·';
  const m = Math.floor(sec / 60);
  if (m >= 60) return `${Math.floor(m / 60)}h`;
  return `${m}m`;
}

export function updateDailyGoalRing(p: {
  shadowRoot: ShadowRoot | null;
  getGoals: () => PracticeGoals;
  getTodayPracticeSeconds: () => number;
}): void {
  if (!p.shadowRoot) return;
  const fg = p.shadowRoot.querySelector('[part="daily-ring-fg"]') as SVGCircleElement | null;
  const label = p.shadowRoot.querySelector('[part="daily-ring-label"]') as HTMLElement | null;
  const wrap = p.shadowRoot.querySelector('[part="daily-goal-ring"]') as HTMLElement | null;
  if (!fg || !label || !wrap) return;

  const goals = p.getGoals();
  const target = goals.dailyTargetSec;
  const done = p.getTodayPracticeSeconds();

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

export function paintCalStreak(p: {
  shadowRoot: ShadowRoot | null;
  dailySeconds: Record<string, number>;
  extensionInstallDateKey: string;
  getTodayPracticeSeconds: () => number;
  panelT: (k: string, p?: Record<string, string | number>) => string;
}): void {
  if (!p.shadowRoot) return;
  const streakEl = p.shadowRoot.querySelector('[part="cal-streak"]') as HTMLElement | null;
  if (!streakEl) return;
  const merged = buildMergedDailyForPanel(p.dailySeconds, p.getTodayPracticeSeconds);
  const missStart = missTrackingStartDateKey(p.extensionInstallDateKey, merged);
  const streak = practiceStreakDays(merged, Date.now(), missStart);
  streakEl.setAttribute('aria-label', streakAriaLabel(p.panelT, streak));
  streakEl.innerHTML = `<span class="cal-streak-flame" aria-hidden="true">🔥</span><span class="cal-streak-n">${String(
    streak,
  )}</span><span class="cal-streak-cap">${escapeHtml(streakCaption(p.panelT, streak))}</span>`;
}

export interface RenderWatchPanelCalendarParams {
  shadowRoot: ShadowRoot | null;
  calendarYear: number;
  calendarMonth: number;
  panelLocale: ResolvedLocale;
  panelT: (k: string, p?: Record<string, string | number>) => string;
  dailySeconds: Record<string, number>;
  extensionInstallDateKey: string;
  getGoals: () => PracticeGoals;
  getTodayPracticeSeconds: () => number;
}

export function renderWatchPanelCalendar(p: RenderWatchPanelCalendarParams): void {
  if (!p.shadowRoot) return;
  const grid = p.shadowRoot.querySelector('[part="cal-grid"]') as HTMLElement | null;
  const label = p.shadowRoot.querySelector('[part="cal-label"]') as HTMLElement | null;
  if (!grid || !label) return;

  const locale = p.panelLocale;
  const labelDate = new Date(p.calendarYear, p.calendarMonth, 1);
  label.textContent = labelDate.toLocaleDateString(locale, { month: 'long', year: 'numeric' });

  const goals = p.getGoals();
  const dailyGoalSec = goals.dailyTargetSec != null && goals.dailyTargetSec > 0 ? goals.dailyTargetSec : null;

  const merged = buildMergedDailyForPanel(p.dailySeconds, p.getTodayPracticeSeconds);
  const todayKey = dateKeyFromTimestamp(Date.now());

  const first = new Date(p.calendarYear, p.calendarMonth, 1);
  const lastDay = new Date(p.calendarYear, p.calendarMonth + 1, 0).getDate();
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
    const key = dateKey(p.calendarYear, p.calendarMonth, day);
    const isToday = todayY === p.calendarYear && todayM === p.calendarMonth && todayD === day;
    if (isToday) cell.classList.add('cal-cell-today');

    const isFuture =
      p.calendarYear > todayY ||
      (p.calendarYear === todayY && p.calendarMonth > todayM) ||
      (p.calendarYear === todayY && p.calendarMonth === todayM && day > todayD);

    const sec = isFuture ? 0 : (merged[key] ?? 0);

    if (isFuture) {
      cell.classList.add('cal-cell-future');
    } else {
      const vis = practiceCalendarDayVisual(
        key,
        sec,
        todayKey,
        p.extensionInstallDateKey,
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
  paintCalStreak({
    shadowRoot: p.shadowRoot,
    dailySeconds: p.dailySeconds,
    extensionInstallDateKey: p.extensionInstallDateKey,
    getTodayPracticeSeconds: p.getTodayPracticeSeconds,
    panelT: p.panelT,
  });
  const calLeg = p.shadowRoot.querySelector('[part="cal-legend"]');
  if (calLeg) calLeg.textContent = p.panelT('dash.practiceDayCreditHint');
}

export function attachPanelDrag(
  host: HTMLElement,
  handle: HTMLElement,
  onCommitPosition: (left: number, top: number) => void,
): void {
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
      onCommitPosition(left, top);
    };

    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', up);
  });
}
