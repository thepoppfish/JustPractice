import { parseDateKey } from './yearHeatmapCalendar';
import { buildMonthDetailGrid } from './yearHeatmapMonth';
import { monthDetailLayerHtml } from './yearHeatmapMonthHtml';
import type { YearHeatmapStatusLabelFn } from './yearHeatmapHtml';

export type YearHeatmapZoom =
  | { mode: 'year' }
  | { mode: 'month'; year: number; monthIndex: number };

export interface YearHeatmapPracticeData {
  dailySeconds: Record<string, number>;
  extensionInstalledDateKey: string;
  dailyGoalSec: number | null;
  monthlyGoalSec: number | null;
}

export interface AttachYearHeatmapInteractiveOptions {
  root: HTMLElement;
  locale?: string;
  variant: 'dashboard' | 'panel';
  getYear: () => number;
  getData: () => YearHeatmapPracticeData;
  statusLabel: YearHeatmapStatusLabelFn;
  showPracticeTimeOnYear?: boolean;
  backToYearLabel: string;
  onYearChange?: (year: number) => void;
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
    if (keys) keys.hidden = false;
    setNavMode('year');
    opts.root.classList.remove('year-hm--month-open');
    clearMonthHover();
  }

  function openMonth(year: number, monthIndex: number): void {
    const data = opts.getData();
    const detail = buildMonthDetailGrid({
      year,
      monthIndex,
      dailySeconds: data.dailySeconds,
      extensionInstalledDateKey: data.extensionInstalledDateKey,
      dailyGoalSec: data.dailyGoalSec,
      monthlyGoalSec: data.monthlyGoalSec,
      locale: opts.locale,
    });
    monthLayer.innerHTML = monthDetailLayerHtml(detail, {
      locale: opts.locale,
      variant: opts.variant,
    });
    yearLayer.hidden = true;
    monthLayer.hidden = false;
    if (keys) keys.hidden = true;
    setNavMode('month');
    opts.root.classList.add('year-hm--month-open');
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

  function onCellClick(e: Event): void {
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
    if (!t.closest('[data-year-hm-back]')) return;
    e.preventDefault();
    showYearView();
  }

  yearLayer.addEventListener('pointerover', onCellPointerOver);
  yearLayer.addEventListener('pointerout', onCellPointerOut);
  yearLayer.addEventListener('click', onCellClick);
  scope.addEventListener('click', onScopeClick);

  return () => {
    yearLayer.removeEventListener('pointerover', onCellPointerOver);
    yearLayer.removeEventListener('pointerout', onCellPointerOut);
    yearLayer.removeEventListener('click', onCellClick);
    scope.removeEventListener('click', onScopeClick);
  };
}
