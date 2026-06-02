/** Unique per content-script injection; stale hosts from a prior injection are removed. */
export const WATCH_PANEL_BOOT_TOKEN = String(
  typeof performance !== 'undefined' ? performance.timeOrigin + performance.now() : Date.now(),
);

export function isWatchPanelHostLive(host: HTMLElement): boolean {
  return host.isConnected && host.dataset.jpBootToken === WATCH_PANEL_BOOT_TOKEN && !!host.shadowRoot;
}
