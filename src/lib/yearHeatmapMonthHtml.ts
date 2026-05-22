import { escapeAttr, escapeHtml } from './htmlEscape';
import { CALENDAR_MISSED_DAY_MARK, CALENDAR_UNDER_MINUTE_MARK } from './practiceStats';
import { formatDuration } from './practiceStats';
import { buildMonthDetailGrid } from './yearHeatmapMonth';
import type { MonthDetailCell, MonthDetailGrid } from './yearHeatmapMonth';
import { yearHeatmapWeekdayLabels } from './yearHeatmapHtml';
import type { YearHeatmapPracticeData } from './yearHeatmapMonth';
import type { YearHeatmapTranslate } from './yearHeatmapHtml';

export function monthHeatmapLegendHtml(t: YearHeatmapTranslate): string {
  const red = `<span class="year-hm-key"><span class="year-hm-key-dot year-hm-key-dot--none"></span>${escapeHtml(String(t('dash.chartKeyNone')))}</span>`;
  const green = `<span class="year-hm-key"><span class="year-hm-key-dot year-hm-key-dot--active"></span>${escapeHtml(String(t('dash.chartKeyActive')))}</span>`;
  const missed = `<span class="year-hm-key"><span class="month-hm-legend-mark" aria-hidden="true">X</span>${escapeHtml(String(t('dash.monthHeatmapLegendX')))}</span>`;
  return `<div class="month-hm-legend year-hm-keys-row" aria-label="${escapeAttr(String(t('dash.monthHeatmapLegendAria')))}">${red}${green}${missed}</div>`;
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
  if (cell.timeLabel) {
    const underMin = cell.timeLabel === CALENDAR_UNDER_MINUTE_MARK;
    const cls = underMin ? 'month-hm-time month-hm-time--under' : 'month-hm-time';
    return `<span class="${cls}">${escapeHtml(cell.timeLabel)}</span>`;
  }
  if (cell.display === 'none') {
    return `<span class="month-hm-time month-hm-time--missed" aria-hidden="true">${CALENDAR_MISSED_DAY_MARK}</span>`;
  }
  return '<span class="month-hm-time month-hm-time--empty" aria-hidden="true">—</span>';
}

function monthChartHtml(detail: MonthDetailGrid, locale?: string, peek = false): string {
  const weekdays = yearHeatmapWeekdayLabels(locale);
  const dowHtml = weekdays
    .map((w) => `<span class="month-hm-dow">${escapeHtml(w)}</span>`)
    .join('');
  const cellsHtml = detail.cells
    .map((cell) => {
      if (cell.kind === 'pad') {
        return '<span class="month-hm-cell month-hm-cell--empty" aria-hidden="true"></span>';
      }
      return `<div class="${monthDayClass(cell)}" data-date="${escapeAttr(cell.dateKey)}" role="gridcell">
        <span class="month-hm-day-num">${cell.dayOfMonth}</span>
        ${monthCellTimeHtml(cell, peek)}
      </div>`;
    })
    .join('');

  return `
      <div class="month-hm-chart" role="grid" aria-label="${escapeAttr(detail.label)}">
        <div class="month-hm-dow-header" aria-hidden="true">${dowHtml}</div>
        <div class="month-hm-cells">${cellsHtml}</div>
      </div>`;
}

function monthDetailCardInnerHtml(
  detail: MonthDetailGrid,
  formatMonthTotal: (totalSec: number) => string,
  peek: boolean,
  monthLegendHtml = '',
  monthlyGoalMetLabel = '',
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
          <span class="year-hm-month-title">${escapeHtml(detail.label)}${flawlessMonthMark}</span>
          ${monthlyGoalBadge}
          ${totalLine}
        </div>
        ${monthChartHtml(detail, undefined, peek)}
        ${legendBlock}
      </div>`;
}

export function monthDetailCardHtml(
  detail: MonthDetailGrid,
  formatMonthTotal: (totalSec: number) => string,
  peek = false,
  p?: { monthLegendHtml?: string; monthlyGoalMetLabel?: string },
): string {
  return `<div class="year-hm-month-slot-scale">${monthDetailCardInnerHtml(
    detail,
    formatMonthTotal,
    peek,
    p?.monthLegendHtml ?? '',
    p?.monthlyGoalMetLabel ?? '',
  )}</div>`;
}

/** @deprecated Use monthCarouselLayerHtml */
export function monthDetailLayerHtml(
  detail: MonthDetailGrid,
  p: { locale?: string; variant: 'dashboard' | 'panel'; formatMonthTotal?: (sec: number) => string },
): string {
  const formatMonthTotal =
    p.formatMonthTotal ?? ((sec) => `${formatDuration(sec)} total`);
  return monthDetailCardHtml(detail, formatMonthTotal);
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
}

function buildDetail(
  year: number,
  monthIndex: number,
  data: YearHeatmapPracticeData,
  locale?: string,
): MonthDetailGrid {
  return buildMonthDetailGrid({
    year,
    monthIndex,
    dailySeconds: data.dailySeconds,
    extensionInstalledDateKey: data.extensionInstalledDateKey,
    dailyGoalSec: data.dailyGoalSec,
    monthlyGoalSec: data.monthlyGoalSec,
    locale,
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
  const monthExtras = { monthLegendHtml, monthlyGoalMetLabel };
  const canPrev = monthIndex > 0;
  const canNext = monthIndex < 11;

  const centerDetail = buildDetail(year, monthIndex, data, locale);
  const prevDetail = canPrev ? buildDetail(year, monthIndex - 1, data, locale) : null;
  const nextDetail = canNext ? buildDetail(year, monthIndex + 1, data, locale) : null;

  const prevSlot =
    prevDetail
      ? `<div class="year-hm-month-slot year-hm-month-slot--prev" data-year-hm-month-slot="prev" data-month-index="${monthIndex - 1}" title="${escapeAttr(prevDetail.label)}">
        ${monthDetailCardHtml(prevDetail, formatMonthTotal, true)}
      </div>`
      : '<div class="year-hm-month-slot year-hm-month-slot--prev year-hm-month-slot--empty" aria-hidden="true"></div>';

  const nextSlot =
    nextDetail
      ? `<div class="year-hm-month-slot year-hm-month-slot--next" data-year-hm-month-slot="next" data-month-index="${monthIndex + 1}" title="${escapeAttr(nextDetail.label)}">
        ${monthDetailCardHtml(nextDetail, formatMonthTotal, true)}
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
