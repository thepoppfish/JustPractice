import { DASH_VIEWS } from './dashboardDomUpdate';
import type { DashView } from './dashboardViewModel';

const STORAGE_KEY = 'jp-dash-active-view';

export function isDashView(value: string): value is DashView {
  return (DASH_VIEWS as readonly string[]).includes(value);
}

export function readPersistedDashView(): DashView {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw && isDashView(raw)) return raw;
  } catch {
    /* private mode / blocked storage */
  }
  return 'library';
}

export function persistDashView(view: DashView): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, view);
  } catch {
    /* ignore */
  }
}
