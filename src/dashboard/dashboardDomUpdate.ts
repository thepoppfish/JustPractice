import { dashWelcomeHtml } from './dashboardFormatters';
import {
  dashboardCompletedSectionHtml,
  dashboardGoalsSectionHtml,
  dashboardLibrarySectionHtml,
  dashboardProgressSectionHtml,
  dashboardSettingsSectionHtml,
  dashboardSidebarHtml,
  dashboardStatsSectionHtml,
  dashboardTopbarHtml,
  dashboardTopbarMetricsHtml,
  libraryPanelBodyHtml,
} from './dashboardTemplates';
import type { DashView, DashboardViewModel } from './dashboardViewModel';

export const DASH_VIEWS: readonly DashView[] = [
  'library',
  'completed',
  'stats',
  'progress',
  'goals',
  'settings',
];

export function isDashSearchFocused(root: HTMLElement): boolean {
  const el = root.querySelector('#dash-search');
  return el instanceof HTMLInputElement && document.activeElement === el;
}

export function patchTopbarMetrics(root: HTMLElement, vm: DashboardViewModel): void {
  const el = root.querySelector('.topbar-progress');
  if (!el) return;
  el.outerHTML = dashboardTopbarMetricsHtml(vm);
}

export function patchDashWelcome(root: HTMLElement, vm: DashboardViewModel): void {
  const el = root.querySelector('.dash-welcome');
  const html = dashWelcomeHtml(vm.t, vm.displayName, vm.dailyMotivationMessage);
  if (el) {
    el.outerHTML = html;
    return;
  }
  const content = root.querySelector('.content');
  if (content) content.insertAdjacentHTML('beforebegin', html);
}

export function switchActiveView(root: HTMLElement, activeView: DashView): void {
  root.querySelectorAll<HTMLElement>('[data-view]').forEach((btn) => {
    const v = btn.getAttribute('data-view') as DashView | null;
    if (!v) return;
    btn.className = activeView === v ? 'nav-item is-active' : 'nav-item';
  });
  root.querySelectorAll<HTMLElement>('[data-view-panel]').forEach((panel) => {
    const v = panel.getAttribute('data-view-panel') as DashView | null;
    if (!v) return;
    const on = v === activeView;
    panel.classList.toggle('view--active', on);
    panel.classList.toggle('view--hidden', !on);
    panel.classList.add('view');
  });
}

export function patchLibraryLevelFilterChips(root: HTMLElement, vm: DashboardViewModel): void {
  const toolbar = root.querySelector('[data-view-panel="library"] .filter-chips');
  if (!toolbar) return;
  toolbar.querySelectorAll<HTMLButtonElement>('[data-level-filter]').forEach((btn) => {
    const raw = btn.getAttribute('data-level-filter');
    let active = false;
    if (raw === 'all' || raw === null) active = vm.libraryLevelFilter === '';
    else if (raw === 'unset') active = vm.libraryLevelFilter === 'unset';
    else if (raw === 'legacy') active = vm.libraryLevelFilter === 'legacy';
    else active = vm.libraryLevelFilter === raw;
    btn.classList.toggle('is-active', active);
  });
}

export function patchLibraryPanelBody(root: HTMLElement, vm: DashboardViewModel): void {
  patchLibraryLevelFilterChips(root, vm);
  const body = root.querySelector('[data-library-body]');
  if (body) {
    body.innerHTML = libraryPanelBodyHtml(vm);
    return;
  }
  const lib = root.querySelector('[data-view-panel="library"]');
  if (lib) lib.outerHTML = dashboardLibrarySectionHtml(vm);
}

export function patchLibraryAndCompletedPanels(root: HTMLElement, vm: DashboardViewModel): void {
  patchLibraryPanelBody(root, vm);
  const completed = root.querySelector('[data-view-panel="completed"]');
  if (completed) completed.outerHTML = dashboardCompletedSectionHtml(vm);
}

export function patchViewPanel(root: HTMLElement, vm: DashboardViewModel, view: DashView): void {
  const panel = root.querySelector(`[data-view-panel="${view}"]`);
  if (!panel) return;
  const html = viewPanelHtml(vm, view);
  panel.outerHTML = html;
}

function viewPanelHtml(vm: DashboardViewModel, view: DashView): string {
  switch (view) {
    case 'library':
      return dashboardLibrarySectionHtml(vm);
    case 'completed':
      return dashboardCompletedSectionHtml(vm);
    case 'stats':
      return dashboardStatsSectionHtml(vm);
    case 'progress':
      return dashboardProgressSectionHtml(vm);
    case 'goals':
      return dashboardGoalsSectionHtml(vm);
    case 'settings':
      return dashboardSettingsSectionHtml(vm);
  }
}

export function patchDashboardChrome(
  root: HTMLElement,
  vm: DashboardViewModel,
  searchQuery: string,
): void {
  const sidebar = root.querySelector('.sidebar');
  if (sidebar) sidebar.outerHTML = dashboardSidebarHtml(vm);
  const topbar = root.querySelector('.topbar');
  if (topbar) topbar.outerHTML = dashboardTopbarHtml(vm, searchQuery);
  patchDashWelcome(root, vm);
}

export function patchDashboardPanels(
  root: HTMLElement,
  vm: DashboardViewModel,
  panels: readonly DashView[],
): void {
  for (const view of panels) patchViewPanel(root, vm, view);
}
