import { MSG, type SetSettingsPayload } from '../lib/messages';
import type { AppSettings } from '../lib/storage';
import { sendMsg } from './youtubeMessaging';
import {
  applyDefaultWatchPanelHostStyle,
  extractWatchPanelUiFromShadow,
  type EnsureWatchPanelOptions,
  type WatchPanelUiRefs,
} from './youtubePanelMount';

export function removeWatchPanelHost(panelHostId: string): void {
  document.getElementById(panelHostId)?.remove();
}

export function omitWatchPanelPosition(settings: AppSettings): AppSettings {
  const next = { ...settings, watchPanelCollapsed: false };
  delete next.watchPanelLeft;
  delete next.watchPanelTop;
  return next;
}

export async function persistWatchPanelSpawnDefaults(): Promise<void> {
  const payload: SetSettingsPayload = {
    watchPanelCollapsed: false,
    watchPanelLeft: null,
    watchPanelTop: null,
  };
  await sendMsg({
    type: MSG.SET_SETTINGS,
    payload,
  });
}

export function rebindWatchPanelFromHost(
  host: HTMLElement,
  opts: Pick<EnsureWatchPanelOptions, 'onMounted' | 'onAfterAppend'>,
): WatchPanelUiRefs {
  const sr = host.shadowRoot!;
  const ui = extractWatchPanelUiFromShadow(sr);
  opts.onMounted({ host, shadowRoot: sr, ui });
  opts.onAfterAppend();
  return ui;
}
