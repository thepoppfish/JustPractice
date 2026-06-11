import { parseDateKey } from './yearHeatmapCalendar';
import type { YearHeatmapPracticeData } from './yearHeatmapMonth';
import { monthCarouselLayerHtml, monthHeatmapLegendHtml } from './yearHeatmapMonthHtml';
import type { YearHeatmapStatusLabelFn } from './yearHeatmapHtml';

export type { YearHeatmapPracticeData } from './yearHeatmapMonth';

export type YearHeatmapZoom =
  | { mode: 'year' }
  | { mode: 'month'; year: number; monthIndex: number };

export interface AttachYearHeatmapInteractiveOptions {
  root: HTMLElement;
  locale?: string;
  variant: 'dashboard' | 'panel';
  getYear: () => number;
  getData: () => YearHeatmapPracticeData;
  statusLabel: YearHeatmapStatusLabelFn;
  showPracticeTimeOnYear?: boolean;
  backToYearLabel: string;
  navPrevMonthLabel: string;
  navNextMonthLabel: string;
  formatMonthTotal: (totalSec: number) => string;
  /** When set, month drill-down includes its own legend and monthly-goal badge copy. */
  translate?: (key: string, params?: Record<string, string>) => string;
  onYearChange?: (year: number) => void;
  /** Zoom (year vs month) is in-session UI state; report it so a re-render can restore it. */
  onZoomChange?: (zoom: YearHeatmapZoom) => void;
  /** Restore a prior zoom on attach (e.g. after a data-change re-render). */
  initialZoom?: YearHeatmapZoom;
}

const MONTH_HOVER_CLASS = 'year-hm-cell--month-hover';

function navScope(root: HTMLElement): ParentNode {
  return root.closest('.calendar-section') ?? root;
}

export function attachYearHeatmapInteractive(opts: AttachYearHeatmapInteractiveOptions): () => void {
  const scope = navScope(opts.root);
  const stage = opts.root.querySelector('[data-year-hm-stage]') as HTMLElement | null;
  const yearLayerNode = opts.root.querySelector('[data-year-hm-year-layer]');
  const monthLayerNode = opts.root.querySelector('[data-year-hm-month-layer]');
  const navYear = scope.querySelector('[data-year-hm-nav-year]') as HTMLElement | null;
  const navMonth = scope.querySelector('[data-year-hm-nav-month]') as HTMLElement | null;
  const keys = opts.root.querySelector('[data-year-hm-keys]') as HTMLElement | null;
  if (!stage || !(yearLayerNode instanceof HTMLElement) || !(monthLayerNode instanceof HTMLElement)) {
    return () => {};
  }
  const yearLayer = yearLayerNode;
  const monthLayer = monthLayerNode;

  let hoveredMonth: string | null = null;
  let activeMonth: { year: number; monthIndex: number } | null = null;

  const cellsRoot = () => yearLayer.querySelector('.year-hm-cells');

  function clearMonthHover(): void {
    hoveredMonth = null;
    yearLayer.querySelectorAll(`.${MONTH_HOVER_CLASS}`).forEach((el) => {
      el.classList.remove(MONTH_HOVER_CLASS);
    });
  }

  function applyMonthHover(ym: string): void {
    if (hoveredMonth === ym) return;
    hoveredMonth = ym;
    const cells = cellsRoot();
    if (!cells) return;
    cells.querySelectorAll<HTMLElement>('[data-year-month]').forEach((el) => {
      if (el.dataset.yearMonth === ym) el.classList.add(MONTH_HOVER_CLASS);
      else el.classList.remove(MONTH_HOVER_CLASS);
    });
  }

  function setNavMode(mode: 'year' | 'month'): void {
    if (navYear) navYear.hidden = mode === 'month';
    if (navMonth) navMonth.hidden = mode === 'year';
  }

  function showYearView(): void {
    yearLayer.hidden = false;
    monthLayer.hidden = true;
    monthLayer.innerHTML = '';
    activeMonth = null;
    if (keys) keys.hidden = false;
    setNavMode('year');
    opts.root.classList.remove('year-hm--month-open');
    clearMonthHover();
    opts.onZoomChange?.({ mode: 'year' });
  }

  function renderMonthView(year: number, monthIndex: number): void {
    activeMonth = { year, monthIndex };
    const data = opts.getData();
    const monthExtras = opts.translate
      ? {
          monthLegendHtml: monthHeatmapLegendHtml(opts.translate),
          monthlyGoalMetLabel: opts.translate('yearHeatmap.monthlyGoalMet'),
        }
      : {};
    monthLayer.innerHTML = monthCarouselLayerHtml({
      year,
      monthIndex,
      data,
      locale: opts.locale,
      variant: opts.variant,
      navPrevLabel: opts.navPrevMonthLabel,
      navNextLabel: opts.navNextMonthLabel,
      formatMonthTotal: opts.formatMonthTotal,
      ...monthExtras,
    });
    yearLayer.hidden = true;
    monthLayer.hidden = false;
    if (keys) keys.hidden = true;
    setNavMode('month');
    opts.root.classList.add('year-hm--month-open');
    opts.onZoomChange?.({ mode: 'month', year, monthIndex });
  }

  function openMonth(year: number, monthIndex: number): void {
    const clamped = Math.max(0, Math.min(11, monthIndex));
    renderMonthView(year, clamped);
  }

  function shiftMonth(delta: number): void {
    if (!activeMonth) return;
    openMonth(activeMonth.year, activeMonth.monthIndex + delta);
  }

  function onCellPointerOver(e: Event): void {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    const btn = t.closest<HTMLElement>('[data-year-month]');
    if (!btn?.dataset.yearMonth) return;
    applyMonthHover(btn.dataset.yearMonth);
  }

  function onCellPointerOut(e: Event): void {
    const related = (e as MouseEvent).relatedTarget;
    if (related instanceof Node && yearLayer.contains(related)) {
      const btn = related instanceof HTMLElement ? related.closest('[data-year-month]') : null;
      if (btn) return;
    }
    clearMonthHover();
  }

  function onYearLayerClick(e: Event): void {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    const btn = t.closest<HTMLElement>('[data-date]');
    const dk = btn?.dataset.date;
    if (!dk) return;
    e.preventDefault();
    const parsed = parseDateKey(dk);
    if (!parsed) return;
    openMonth(parsed.year, parsed.month - 1);
  }

  function onScopeClick(e: Event): void {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;

    if (t.closest('[data-year-hm-back]')) {
      e.preventDefault();
      showYearView();
      return;
    }

    if (!monthLayer.hidden && activeMonth) {
      if (t.closest('[data-year-hm-month-prev]:not(:disabled)')) {
        e.preventDefault();
        shiftMonth(-1);
        return;
      }
      if (t.closest('[data-year-hm-month-next]:not(:disabled)')) {
        e.preventDefault();
        shiftMonth(1);
        return;
      }
      const sideSlot = t.closest<HTMLElement>('[data-year-hm-month-slot="prev"], [data-year-hm-month-slot="next"]');
      if (sideSlot?.dataset.monthIndex != null) {
        e.preventDefault();
        openMonth(activeMonth.year, Number(sideSlot.dataset.monthIndex));
      }
    }
  }

  if (
    opts.initialZoom?.mode === 'month' &&
    opts.initialZoom.year === opts.getYear()
  ) {
    openMonth(opts.initialZoom.year, opts.initialZoom.monthIndex);
  }

  yearLayer.addEventListener('pointerover', onCellPointerOver);
  yearLayer.addEventListener('pointerout', onCellPointerOut);
  yearLayer.addEventListener('click', onYearLayerClick);
  scope.addEventListener('click', onScopeClick);

  return () => {
    yearLayer.removeEventListener('pointerover', onCellPointerOver);
    yearLayer.removeEventListener('pointerout', onCellPointerOut);
    yearLayer.removeEventListener('click', onYearLayerClick);
    scope.removeEventListener('click', onScopeClick);
  };
}
