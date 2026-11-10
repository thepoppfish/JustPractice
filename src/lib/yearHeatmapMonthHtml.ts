import { escapeAttr, escapeHtml } from './htmlEscape';
import { CALENDAR_MISSED_DAY_MARK, CALENDAR_UNDER_MINUTE_MARK } from './practiceStats';
import { formatDuration } from './practiceStats';
import { buildMonthDetailGrid } from './yearHeatmapMonth';
import type { MonthDetailCell, MonthDetailGrid } from './yearHeatmapMonth';
import { yearHeatmapWeekdayLabels } from './yearHeatmapHtml';
import type { YearHeatmapPracticeData } from './yearHeatmapMonth';
import type { YearHeatmapTranslate, YearHeatmapStatusLabelFn } from './yearHeatmapHtml';

export function monthHeatmapLegendHtml(t: YearHeatmapTranslate): string {
  const red = `<span class="year-hm-key"><span class="year-hm-key-dot year-hm-key-dot--none"></span>${escapeHtml(String(t('dash.chartKeyNone')))}</span>`;
  const green = `<span class="year-hm-key"><span class="year-hm-key-dot year-hm-key-dot--active"></span>${escapeHtml(String(t('dash.chartKeyActive')))}</span>`;
  const missed = `<span class="year-hm-key"><span class="month-hm-legend-mark" aria-hidden="true">X</span>${escapeHtml(String(t('dash.monthHeatmapLegendX')))}</span>`;
  return `<div class="month-hm-legend year-hm-keys-row" role="group" aria-label="${escapeAttr(String(t('dash.monthHeatmapLegendAria')))}">${red}${green}${missed}</div>`;
}

function monthDayClass(cell: MonthDetailCell): string {
  if (cell.kind === 'pad') return 'month-hm-cell month-hm-cell--empty';
  const parts = ['month-hm-cell'];
  if (cell.display === 'blank') {
    parts.push('month-hm-cell--blank');
  } else {
    parts.push(`month-hm-cell--${cell.display}`);
    if (cell.display === 'none') {
      if (cell.isToday) parts.push('month-hm-cell--today-open');
      else parts.push('month-hm-cell--no-practice');
    }
  }
  if (cell.isToday) parts.push('month-hm-cell--today');
  return parts.join(' ');
}

function monthCellTimeHtml(cell: MonthDetailCell, peek: boolean): string {
  if (peek || cell.kind === 'pad') return '';
  const label = cell.timeLabel;
  if (label === CALENDAR_MISSED_DAY_MARK || (cell.display === 'none' && !cell.isToday)) {
    return `<span class="month-hm-time month-hm-time--missed" aria-hidden="true">${CALENDAR_MISSED_DAY_MARK}</span>`;
  }
  if (label === CALENDAR_UNDER_MINUTE_MARK) {
    return `<span class="month-hm-time month-hm-time--under" aria-hidden="true">${CALENDAR_UNDER_MINUTE_MARK}</span>`;
  }
  if (label) {
    return `<span class="month-hm-time">${escapeHtml(label)}</span>`;
  }
  return '<span class="month-hm-time month-hm-time--empty" aria-hidden="true">—</span>';
}

function monthChartHtml(detail: MonthDetailGrid, locale?: string, peek = false, statusLabel?: YearHeatmapStatusLabelFn): string {
  const weekdays = yearHeatmapWeekdayLabels(locale);
  const dowHtml = weekdays
    .map((w, i) => `<span class="month-hm-dow" role="columnheader" aria-label="${escapeAttr(new Date(2024, 0, 7 + i).toLocaleDateString(locale, { weekday: 'long' }))}">${escapeHtml(w)}</span>`)
    .join('');
  const cellsHtml = detail.cells
    .map((cell, index) => {
      const open = index % 7 === 0 ? '<div class="month-hm-week" role="row">' : '';
      const close = index % 7 === 6 || index === detail.cells.length - 1 ? '</div>' : '';
      if (cell.kind === 'pad') {
        return `${open}<span class="month-hm-cell month-hm-cell--empty" role="cell" aria-hidden="true"></span>${close}`;
      }
      return `${open}<div class="${monthDayClass(cell)}" data-date="${escapeAttr(cell.dateKey)}" role="cell" aria-colindex="${index % 7 + 1}" aria-label="${escapeAttr(statusLabel?.(cell.display, cell.dateKey, cell.seconds, true) ?? cell.dateKey)}">
        <span class="month-hm-day-num">${cell.dayOfMonth}</span>
        ${monthCellTimeHtml(cell, peek)}
      </div>${close}`;
    })
    .join('');

  return `
      <div class="month-hm-chart" role="table" aria-colcount="7" aria-label="${escapeAttr(detail.label)}">
        <div class="month-hm-dow-header" role="row">${dowHtml}</div>
        <div class="month-hm-cells" role="rowgroup">${cellsHtml}</div>
      </div>`;
}

function monthDetailCardInnerHtml(
  detail: MonthDetailGrid,
  formatMonthTotal: (totalSec: number) => string,
  peek: boolean,
  monthLegendHtml = '',
  monthlyGoalMetLabel = '',
  locale?: string,
  statusLabel?: YearHeatmapStatusLabelFn,
): string {
  const goldenClass = detail.isGoldenMonth ? ' year-hm-month-detail--golden' : '';
  const diamondClass = detail.isDiamondMonth ? ' year-hm-month-detail--diamond' : '';
  const peekClass = peek ? ' year-hm-month-detail--peek' : '';
  const totalLine =
    !peek && detail.monthTotalSec > 0
      ? `<p class="month-hm-total">${escapeHtml(formatMonthTotal(detail.monthTotalSec))}</p>`
      : '';
  const flawlessMonthMark =
    !peek && detail.isDiamondMonth
      ? '<span class="year-hm-month-title-flawless" aria-hidden="true">◆</span>'
      : '';
  const monthlyGoalBadge =
    !peek && detail.isGoldenMonth && monthlyGoalMetLabel
      ? `<span class="year-hm-month-goal-badge">${escapeHtml(monthlyGoalMetLabel)}</span>`
      : '';
  const legendBlock = !peek && monthLegendHtml ? monthLegendHtml : '';

  return `
      <div class="year-hm-month-detail${goldenClass}${diamondClass}${peekClass}" data-month-detail>
        <div class="year-hm-month-heading">
          <h3 class="year-hm-month-title">${escapeHtml(detail.label)}${flawlessMonthMark}</h3>
          ${monthlyGoalBadge}
          ${totalLine}
        </div>
        ${monthChartHtml(detail, locale, peek, statusLabel)}
        ${legendBlock}
      </div>`;
}

export function monthDetailCardHtml(
  detail: MonthDetailGrid,
  formatMonthTotal: (totalSec: number) => string,
  peek = false,
  p?: { monthLegendHtml?: string; monthlyGoalMetLabel?: string; locale?: string; statusLabel?: YearHeatmapStatusLabelFn },
): string {
  return `<div class="year-hm-month-slot-scale">${monthDetailCardInnerHtml(
    detail,
    formatMonthTotal,
    peek,
    p?.monthLegendHtml ?? '',
    p?.monthlyGoalMetLabel ?? '',
    p?.locale,
    p?.statusLabel,
  )}</div>`;
}

/** @deprecated Use monthCarouselLayerHtml */
export function monthDetailLayerHtml(
  detail: MonthDetailGrid,
  p: { locale?: string; variant: 'dashboard' | 'panel'; formatMonthTotal?: (sec: number) => string },
): string {
  const formatMonthTotal =
    p.formatMonthTotal ?? ((sec) => `${formatDuration(sec)} total`);
  return monthDetailCardHtml(detail, formatMonthTotal, false, { locale: p.locale });
}

export interface MonthCarouselHtmlOptions {
  year: number;
  monthIndex: number;
  data: YearHeatmapPracticeData;
  locale?: string;
  variant: 'dashboard' | 'panel';
  navPrevLabel: string;
  navNextLabel: string;
  formatMonthTotal: (totalSec: number) => string;
  monthLegendHtml?: string;
  monthlyGoalMetLabel?: string;
  statusLabel?: YearHeatmapStatusLabelFn;
}

function buildDetail(
  year: number,
  monthIndex: number,
  data: YearHeatmapPracticeData,
  locale?: string,
  minutesOnly = false,
): MonthDetailGrid {
  return buildMonthDetailGrid({
    year,
    monthIndex,
    dailySeconds: data.dailySeconds,
    extensionInstalledDateKey: data.extensionInstalledDateKey,
    dailyGoalSec: data.dailyGoalSec,
    monthlyGoalSec: data.monthlyGoalSec,
    locale,
    minutesOnly,
  });
}

export function monthCarouselLayerHtml(opts: MonthCarouselHtmlOptions): string {
  const {
    year,
    monthIndex,
    data,
    locale,
    navPrevLabel,
    navNextLabel,
    formatMonthTotal,
    monthLegendHtml = '',
    monthlyGoalMetLabel = '',
  } = opts;
  const monthExtras = { monthLegendHtml, monthlyGoalMetLabel, locale, statusLabel: opts.statusLabel };
  const canPrev = monthIndex > 0;
  const canNext = monthIndex < 11;

  const minutesOnly = opts.variant === 'panel';
  const centerDetail = buildDetail(year, monthIndex, data, locale, minutesOnly);
  const prevDetail = canPrev ? buildDetail(year, monthIndex - 1, data, locale, minutesOnly) : null;
  const nextDetail = canNext ? buildDetail(year, monthIndex + 1, data, locale, minutesOnly) : null;

  const prevSlot =
    prevDetail
      ? `<div class="year-hm-month-slot year-hm-month-slot--prev" data-year-hm-month-slot="prev" data-month-index="${monthIndex - 1}" title="${escapeAttr(prevDetail.label)}" aria-hidden="true">
        ${monthDetailCardHtml(prevDetail, formatMonthTotal, true, { locale })}
      </div>`
      : '<div class="year-hm-month-slot year-hm-month-slot--prev year-hm-month-slot--empty" aria-hidden="true"></div>';

  const nextSlot =
    nextDetail
      ? `<div class="year-hm-month-slot year-hm-month-slot--next" data-year-hm-month-slot="next" data-month-index="${monthIndex + 1}" title="${escapeAttr(nextDetail.label)}" aria-hidden="true">
        ${monthDetailCardHtml(nextDetail, formatMonthTotal, true, { locale })}
      </div>`
      : '<div class="year-hm-month-slot year-hm-month-slot--next year-hm-month-slot--empty" aria-hidden="true"></div>';

  const prevDisabled = canPrev ? '' : ' disabled';
  const nextDisabled = canNext ? '' : ' disabled';

  return `
    <div class="year-hm-month-carousel" data-year-hm-carousel>
      <button type="button" class="year-hm-month-nav year-hm-month-nav--prev" data-year-hm-month-prev aria-label="${escapeAttr(navPrevLabel)}"${prevDisabled}>
        <span aria-hidden="true">‹</span>
      </button>
      <div class="year-hm-month-carousel-track">
        ${prevSlot}
        <div class="year-hm-month-slot year-hm-month-slot--center" data-year-hm-month-slot="center" data-month-index="${monthIndex}">
          ${monthDetailCardHtml(centerDetail, formatMonthTotal, false, monthExtras)}
        </div>
        ${nextSlot}
      </div>
      <button type="button" class="year-hm-month-nav year-hm-month-nav--next" data-year-hm-month-next aria-label="${escapeAttr(navNextLabel)}"${nextDisabled}>
        <span aria-hidden="true">›</span>
      </button>
    </div>`;
}
