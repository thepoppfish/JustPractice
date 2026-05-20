import { escapeAttr, escapeHtml } from './htmlEscape';
import { formatDuration } from './practiceStats';
import type { MonthDetailCell, MonthDetailGrid } from './yearHeatmapMonth';
import { yearHeatmapWeekdayLabels } from './yearHeatmapHtml';

function monthDayClass(cell: MonthDetailCell): string {
  if (cell.kind === 'pad') return 'month-hm-cell month-hm-cell--empty';
  const parts = ['month-hm-cell'];
  if (cell.display === 'blank') parts.push('month-hm-cell--blank');
  else parts.push(`month-hm-cell--${cell.display}`);
  if (cell.isToday) parts.push('month-hm-cell--today');
  return parts.join(' ');
}

export function monthDetailLayerHtml(
  detail: MonthDetailGrid,
  p: { locale?: string; variant: 'dashboard' | 'panel' },
): string {
  const weekdays = yearHeatmapWeekdayLabels(p.locale);
  const dowHtml = weekdays
    .map((w) => `<span class="month-hm-dow">${escapeHtml(w)}</span>`)
    .join('');
  const goldenClass = detail.isGoldenMonth ? ' year-hm-month-detail--golden' : '';

  const cellsHtml = detail.cells
    .map((cell) => {
      if (cell.kind === 'pad') {
        return '<span class="month-hm-cell month-hm-cell--empty" aria-hidden="true"></span>';
      }
      const timeHtml =
        cell.timeLabel ?
          `<span class="month-hm-time">${escapeHtml(cell.timeLabel)}</span>`
        : '<span class="month-hm-time month-hm-time--empty" aria-hidden="true">—</span>';
      return `<div class="${monthDayClass(cell)}" data-date="${escapeAttr(cell.dateKey)}" role="gridcell">
        <span class="month-hm-day-num">${cell.dayOfMonth}</span>
        ${timeHtml}
      </div>`;
    })
    .join('');

  const totalLine =
    detail.monthTotalSec > 0
      ? `<p class="month-hm-total">${escapeHtml(formatDuration(detail.monthTotalSec))} total</p>`
      : '';

  return `
    <div class="year-hm-month-detail${goldenClass}" data-month-detail>
      <div class="year-hm-month-toolbar">
        <div class="year-hm-month-heading">
          <span class="year-hm-month-title">${escapeHtml(detail.label)}</span>
          ${totalLine}
        </div>
      </div>
      <div class="month-hm-chart" role="grid" aria-label="${escapeAttr(detail.label)}">
        <div class="month-hm-dow-header" aria-hidden="true">${dowHtml}</div>
        <div class="month-hm-cells">${cellsHtml}</div>
      </div>
    </div>`;
}
