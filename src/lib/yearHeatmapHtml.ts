import { escapeAttr, escapeHtml } from './htmlEscape';
import { formatDuration } from './practiceStats';
import {
  buildYearHeatmapGrid,
  dateKeyToYearMonth,
  yearHeatmapMonthLabels,
  yearHeatmapSlotsColumnMajor,
  type YearHeatmapDisplayColor,
  type YearHeatmapGrid,
  type YearHeatmapSlot,
} from './yearHeatmapCalendar';

export type YearHeatmapStatusLabelFn = (
  display: YearHeatmapDisplayColor,
  dateKey: string,
  seconds?: number,
  showTime?: boolean,
) => string;

export type YearHeatmapTranslate = (
  key: string,
  params?: Record<string, string>,
) => string;

export function defaultYearHeatmapStatusLabel(
  t: YearHeatmapTranslate,
  display: YearHeatmapDisplayColor,
  dateKey: string,
  seconds = 0,
  showTime = false,
): string {
  const time = showTime && seconds > 0 ? formatDuration(seconds) : '';
  switch (display) {
    case 'none':
      return time
        ? t('yearHeatmap.statusMissedTime', { date: dateKey, time })
        : t('yearHeatmap.statusMissed', { date: dateKey });
    case 'active':
      return time
        ? t('yearHeatmap.statusPracticedTime', { date: dateKey, time })
        : t('yearHeatmap.statusPracticed', { date: dateKey });
    case 'goal':
      return time
        ? t('yearHeatmap.statusGoalTime', { date: dateKey, time })
        : t('yearHeatmap.statusGoal', { date: dateKey });
    default:
      return t('yearHeatmap.statusBlank', { date: dateKey });
  }
}

export function yearHeatmapCellClass(
  slot: YearHeatmapSlot,
  diamondMonthKeys?: ReadonlySet<string>,
): string {
  if (slot.kind === 'padding') return 'year-hm-cell year-hm-cell--empty';
  const parts = ['year-hm-cell'];
  if (slot.display === 'blank') parts.push('year-hm-cell--blank');
  else parts.push(`year-hm-cell--${slot.display}`);
  if (slot.isToday) parts.push('year-hm-cell--today');
  if (diamondMonthKeys?.has(dateKeyToYearMonth(slot.dateKey))) {
    parts.push('year-hm-cell--diamond-month');
  }
  return parts.join(' ');
}

export function yearHeatmapCellTitle(
  slot: YearHeatmapSlot,
  statusLabel: YearHeatmapStatusLabelFn,
  seconds = 0,
  showTime = false,
): string {
  if (slot.kind === 'padding') return '';
  return statusLabel(slot.display, slot.dateKey, seconds, showTime);
}

export function defaultYearHeatmapKeysHtml(
  t: YearHeatmapTranslate,
  showGoalKey: boolean,
): string {
  const none = `<span class="year-hm-key"><span class="year-hm-key-dot year-hm-key-dot--none"></span>${escapeHtml(String(t('dash.chartKeyNone')))}</span>`;
  const active = `<span class="year-hm-key"><span class="year-hm-key-dot year-hm-key-dot--active"></span>${escapeHtml(String(t('dash.chartKeyActive')))}</span>`;
  const goal = showGoalKey
    ? `<span class="year-hm-key"><span class="year-hm-key-dot year-hm-key-dot--goal"></span>${escapeHtml(String(t('dash.chartKeyGoal')))}</span>`
    : '';
  return `${none}${active}${goal}`;
}

export function yearHeatmapCellMarkup(
  slot: YearHeatmapSlot,
  statusLabel: YearHeatmapStatusLabelFn,
  showTime: boolean,
  diamondMonthKeys?: ReadonlySet<string>,
): string {
  const title = yearHeatmapCellTitle(
    slot,
    statusLabel,
    slot.kind === 'day' ? slot.seconds : 0,
    showTime,
  );
  const cls = yearHeatmapCellClass(slot, diamondMonthKeys);
  if (slot.kind === 'padding') {
    return `<span class="${cls}" aria-hidden="true"></span>`;
  }
  const esc = title ? escapeAttr(title) : escapeAttr(slot.dateKey);
  const ym = dateKeyToYearMonth(slot.dateKey);
  return `<button type="button" class="${cls}" data-date="${escapeAttr(slot.dateKey)}" data-year-month="${escapeAttr(ym)}" title="${esc}" aria-label="${esc}"></button>`;
}

export function buildYearHeatmapGridModel(p: {
  year: number;
  dailySeconds: Record<string, number>;
  extensionInstalledDateKey: string;
  dailyGoalSec: number | null;
  locale?: string;
  nowMs?: number;
}): YearHeatmapGrid {
  return buildYearHeatmapGrid({
    year: p.year,
    dailySeconds: p.dailySeconds,
    extensionInstalledDateKey: p.extensionInstalledDateKey,
    dailyGoalSec: p.dailyGoalSec,
    nowMs: p.nowMs,
  });
}

export function yearHeatmapWeekdayLabels(locale?: string): string[] {
  const loc = locale && locale.length > 0 ? locale : undefined;
  return Array.from({ length: 7 }, (_, i) => {
    const ref = new Date(2024, 0, 7 + i);
    return ref.toLocaleDateString(loc, { weekday: 'narrow' });
  });
}

export interface YearHeatmapHtmlOptions {
  grid: YearHeatmapGrid;
  locale?: string;
  variant: 'dashboard' | 'panel';
  statusLabel: YearHeatmapStatusLabelFn;
  showPracticeTime?: boolean;
  showMonthTicks?: boolean;
  navPrevLabel: string;
  navNextLabel: string;
  keysHtml: string;
  ariaLabel: string;
  /** Panel uses external cal-header for year navigation. */
  hideYearNav?: boolean;
  backToYearLabel?: string;
}

export function yearHeatmapBackButtonHtml(backLabel: string): string {
  return `<button type="button" class="year-hm-back" data-year-hm-back aria-label="${escapeAttr(backLabel)}">
    <span class="year-hm-back-icon" aria-hidden="true">←</span>
    <span class="year-hm-back-label">${escapeHtml(backLabel)}</span>
  </button>`;
}

function yearHeatmapNavHtml(opts: YearHeatmapHtmlOptions): string {
  const backBtn =
    opts.backToYearLabel ? yearHeatmapBackButtonHtml(opts.backToYearLabel) : '';
  const yearInner =
    opts.hideYearNav
      ? ''
      : `<button type="button" class="secondary year-hm-prev" aria-label="${escapeAttr(opts.navPrevLabel)}">‹</button>
        <span class="year-hm-year">${opts.grid.year}</span>
        <button type="button" class="secondary year-hm-next" aria-label="${escapeAttr(opts.navNextLabel)}">›</button>`;
  if (!yearInner && !backBtn) return '';
  return `
      <div class="year-hm-nav" data-year-hm-nav>
        <div class="year-hm-nav-year" data-year-hm-nav-year>${yearInner}</div>
        <div class="year-hm-nav-month" data-year-hm-nav-month hidden>${backBtn}</div>
      </div>`;
}

export function yearHeatmapSectionHtml(opts: YearHeatmapHtmlOptions): string {
  const cells = yearHeatmapSlotsColumnMajor(opts.grid);
  const weekdays = yearHeatmapWeekdayLabels(opts.locale);
  const wdHtml = weekdays
    .map((w) => `<span class="year-hm-wd">${escapeHtml(w)}</span>`)
    .join('');
  const showTime = opts.showPracticeTime === true;
  const cellsHtml = cells
    .map((slot) =>
      yearHeatmapCellMarkup(slot, opts.statusLabel, showTime, opts.grid.diamondMonthKeys),
    )
    .join('');

  const weekCount = opts.grid.weekCount;
  let monthTicksHtml = '';
  if (opts.showMonthTicks) {
    const labels = yearHeatmapMonthLabels(opts.grid, opts.locale);
    monthTicksHtml = `
      <div class="year-hm-months" aria-hidden="true">
        <span class="year-hm-months-corner"></span>
        ${labels
          .map((m, monthIndex) => {
            const ym = `${opts.grid.year}-${String(monthIndex + 1).padStart(2, '0')}`;
            const diamond = opts.grid.diamondMonthKeys.has(ym) ? ' year-hm-month--diamond' : '';
            return `<span class="year-hm-month${diamond}" style="grid-column:${m.weekCol + 2};grid-row:1">${escapeHtml(m.label)}</span>`;
          })
          .join('')}
      </div>`;
  }

  const variantClass = opts.variant === 'panel' ? 'year-hm--panel' : 'year-hm--dashboard';
  const allGreenClass = opts.grid.isAllGreenYear ? ' year-hm--all-green-year' : '';
  const navHtml = opts.hideYearNav ? '' : yearHeatmapNavHtml(opts);

  return `
    <div class="year-hm ${variantClass}${allGreenClass}" data-year-hm-root aria-label="${escapeAttr(opts.ariaLabel)}">
      ${navHtml}
      <div class="year-hm-stage" data-year-hm-stage>
        <div class="year-hm-year-layer" data-year-hm-year-layer>
          <div class="year-hm-chart" style="--year-weeks:${weekCount}">
            ${monthTicksHtml}
            <div class="year-hm-body">
              <div class="year-hm-weekdays" aria-hidden="true">${wdHtml}</div>
              <div class="year-hm-cells">${cellsHtml}</div>
            </div>
          </div>
        </div>
        <div class="year-hm-month-layer" data-year-hm-month-layer hidden></div>
      </div>
      <div class="year-hm-keys" data-year-hm-keys aria-hidden="true">${opts.keysHtml}</div>
    </div>`;
}
