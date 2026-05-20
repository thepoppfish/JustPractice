import {
  dashboardCompletedSectionHtml,
  dashboardLibrarySectionHtml,
  dashboardTopbarMetricsHtml,
} from './dashboardTemplates';
import type { DashboardViewModel } from './dashboardViewModel';

export function patchTopbarMetrics(root: HTMLElement, vm: DashboardViewModel): void {
  const el = root.querySelector('.topbar-progress');
  if (!el) return;
  el.outerHTML = dashboardTopbarMetricsHtml(vm);
}

export function patchLibraryAndCompletedPanels(root: HTMLElement, vm: DashboardViewModel): void {
  const lib = root.querySelector('[data-view-panel="library"]');
  if (lib) lib.outerHTML = dashboardLibrarySectionHtml(vm);
  const completed = root.querySelector('[data-view-panel="completed"]');
  if (completed) completed.outerHTML = dashboardCompletedSectionHtml(vm);
}

export function isDashSearchFocused(root: HTMLElement): boolean {
  const el = root.querySelector('#dash-search');
  return el instanceof HTMLInputElement && document.activeElement === el;
}
