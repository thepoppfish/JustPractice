import { escapeHtml } from '../lib/htmlEscape';
import {
  dateKeyFromTimestamp,
  MIN_DAY_PRACTICE_CREDIT_SECONDS,
  missTrackingStartDateKey,
  type PracticeGoals,
} from '../lib/storage';
import { formatDuration, practiceCalendarDayVisual, practiceStreakDays } from '../lib/practiceStats';
import type { ResolvedLocale } from '../i18n';
import { daysInCalendarMonth } from '../lib/storage';
import { attachYearHeatmapInteractive } from '../lib/yearHeatmapInteractive';
import {
  buildYearHeatmapGridModel,
  defaultYearHeatmapKeysHtml,
  defaultYearHeatmapStatusLabel,
  yearHeatmapBackButtonHtml,
  yearHeatmapSectionHtml,
} from '../lib/yearHeatmapHtml';

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
/** Whole minutes only (floor), aligned with {@link MIN_DAY_PRACTICE_CREDIT_SECONDS} for calendar color. */
export function formatDayMinutes(sec: number): string {
  if (!sec || sec <= 0) return '';
  if (sec < MIN_DAY_PRACTICE_CREDIT_SECONDS) return '·';
  const m = Math.floor(sec / 60);
  if (m >= 60) return `${Math.floor(m / 60)}h`;
  return `${m}m`;
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
  useYearHeatmap?: boolean;
  showPracticeTime?: boolean;
}

let panelHeatmapDetach: (() => void) | null = null;

function renderWatchPanelYearHeatmap(p: RenderWatchPanelCalendarParams): void {
  if (!p.shadowRoot) return;
  const grid = p.shadowRoot.querySelector('[part="cal-grid"]') as HTMLElement | null;
  const label = p.shadowRoot.querySelector('[part="cal-label"]') as HTMLElement | null;
  if (!grid || !label) return;

  const goals = p.getGoals();
  const dailyGoalSec = goals.dailyTargetSec != null && goals.dailyTargetSec > 0 ? goals.dailyTargetSec : null;
  const monthlyGoalSec =
    dailyGoalSec != null ? dailyGoalSec * daysInCalendarMonth(Date.now()) : null;
  const merged = buildMergedDailyForPanel(p.dailySeconds, p.getTodayPracticeSeconds);
  const hm = buildYearHeatmapGridModel({
    year: p.calendarYear,
    dailySeconds: merged,
    extensionInstalledDateKey: p.extensionInstallDateKey,
    dailyGoalSec,
  });

  label.textContent = String(p.calendarYear);
  const statusLabel = (
    display: Parameters<typeof defaultYearHeatmapStatusLabel>[1],
    dateKey: string,
    seconds = 0,
    showTimeArg = false,
  ) => defaultYearHeatmapStatusLabel((key, params) => p.panelT(key, params), display, dateKey, seconds, showTimeArg);

  const backLabel = p.panelT('yearHeatmap.backToYear');
  const navMonth = p.shadowRoot.querySelector('[data-year-hm-nav-month]');
  if (navMonth) {
    navMonth.innerHTML = yearHeatmapBackButtonHtml(backLabel);
  }

  grid.innerHTML = yearHeatmapSectionHtml({
    grid: hm,
    locale: p.panelLocale,
    variant: 'panel',
    statusLabel,
    showPracticeTime: p.showPracticeTime === true,
    showMonthTicks: false,
    hideYearNav: true,
    navPrevLabel: '',
    navNextLabel: '',
    backToYearLabel: backLabel,
    keysHtml: defaultYearHeatmapKeysHtml(
      (key, params) => p.panelT(key, params),
      dailyGoalSec != null,
    ),
    ariaLabel: p.panelT('dash.yearHeatmapAria'),
  });

  if (panelHeatmapDetach) {
    panelHeatmapDetach();
    panelHeatmapDetach = null;
  }
  const hmRoot = grid.querySelector('[data-year-hm-root]');
  if (hmRoot instanceof HTMLElement) {
    panelHeatmapDetach = attachYearHeatmapInteractive({
      root: hmRoot,
      locale: p.panelLocale,
      variant: 'panel',
      getYear: () => p.calendarYear,
      getData: () => ({
        dailySeconds: merged,
        extensionInstalledDateKey: p.extensionInstallDateKey,
        dailyGoalSec,
        monthlyGoalSec,
      }),
      statusLabel,
      showPracticeTimeOnYear: p.showPracticeTime === true,
      backToYearLabel: p.panelT('yearHeatmap.backToYear'),
    });
  }

  const calLeg = p.shadowRoot.querySelector('[part="cal-legend"]');
  if (calLeg) {
    calLeg.innerHTML = defaultYearHeatmapKeysHtml(
      (key, params) => p.panelT(key, params),
      dailyGoalSec != null,
    );
  }

  paintCalStreak({
    shadowRoot: p.shadowRoot,
    dailySeconds: p.dailySeconds,
    extensionInstallDateKey: p.extensionInstallDateKey,
    getTodayPracticeSeconds: p.getTodayPracticeSeconds,
    panelT: p.panelT,
  });
}

export function renderWatchPanelCalendar(p: RenderWatchPanelCalendarParams): void {
  if (!p.shadowRoot) return;
  if (p.useYearHeatmap) {
    renderWatchPanelYearHeatmap(p);
    return;
  }
  if (panelHeatmapDetach) {
    panelHeatmapDetach();
    panelHeatmapDetach = null;
  }
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
    // Panel month calendar always shows per-day practice time (independent of dashboard setting).
    const showTime = true;
    mins.textContent = isFuture || !showTime ? '' : formatDayMinutes(sec);
    cell.appendChild(mins);

    if (!isFuture && showTime && sec > 0) {
      cell.title = formatDuration(sec);
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
