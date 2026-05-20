import { createTranslator, resolveLocale, type ResolvedLocale, type Translator } from '../i18n';
import { MSG } from '../lib/messages';
import type { ExtensionResponse, GetStateResponse } from '../lib/messages';
import {
  defaultSettings,
  ensureSettingsShape,
  type AppSettings,
  type LevelTag,
  type LibraryItem,
} from '../lib/storage';
import { sendMsg } from './youtubeMessaging';
import type { WatchPanelDebugHooks, WatchPanelUiRefs } from './youtubePanelMount';
import { setWatchPanelStatusFlash, showWatchPanelLibraryBanner } from './youtubePanelMount';
import { populateLevelSelect as populateLevelSelectUi } from './youtubePanelUi';

export interface WatchPanelGetStateMutators {
  setSettingsCache: (s: AppSettings) => void;
  setLastDailySnapshot: (d: Record<string, number>) => void;
  setExtensionInstallDateKey: (k: string) => void;
  setInLibrary: (v: boolean) => void;
  setLibraryItemForCurrentVideo: (v: LibraryItem | null) => void;
  setPanelLocale: (l: ResolvedLocale) => void;
  setPanelT: (t: Translator) => void;
  setPracticeEnabled: (v: boolean) => void;
}

export interface WatchPanelGetStateSideEffects {
  applyPanelHostPosition: () => void;
  applyWatchPanelCollapsed: () => void;
  renderCalendar: (dailySeconds: Record<string, number>) => void;
  updateDailyGoalRing: () => void;
  updatePlayerXpBar: (totalXp: number, prestigeLevel?: number) => void;
  syncWatchPanelLabels: () => void;
}

export interface WatchPanelGetStateDebug {
  enabled: () => boolean;
  log: (event: string, detail?: Record<string, unknown>) => void;
  strip: (line: string) => void;
}

/** GET_STATE → panel settings, calendar, library row, difficulty select, practice toggle. */
export async function refreshWatchPanelLibraryUiFromRemoteState(p: {
  videoId: string;
  shadowRoot: ShadowRoot | null;
  ui: WatchPanelUiRefs;
  mut: WatchPanelGetStateMutators;
  fx: WatchPanelGetStateSideEffects;
  getPanelT: () => Translator;
  debug: WatchPanelGetStateDebug;
}): Promise<void> {
  const saveRowEl = p.shadowRoot?.querySelector('[part="save-row"]') as HTMLElement | null;

  try {
    const res = (await sendMsg<GetStateResponse>({
      type: MSG.GET_STATE,
    })) as GetStateResponse;
    if (!res?.ok || !('data' in res)) {
      if (saveRowEl) saveRowEl.hidden = false;
      p.mut.setLibraryItemForCurrentVideo(null);
      p.mut.setInLibrary(false);
      p.fx.syncWatchPanelLabels();
      return;
    }
    const settings = ensureSettingsShape({ ...defaultSettings(), ...res.data.settings });
    p.mut.setSettingsCache(settings);
    p.fx.applyPanelHostPosition();
    p.fx.applyWatchPanelCollapsed();
    p.mut.setLastDailySnapshot({ ...res.data.dailySeconds });
    p.mut.setExtensionInstallDateKey(res.data.extensionInstalledDateKey);
    p.fx.renderCalendar(res.data.dailySeconds);
    p.fx.updateDailyGoalRing();
    p.fx.updatePlayerXpBar(res.data.playerProgress.totalXp, res.data.playerProgress.prestigeLevel);
    const item = res.data.library.find((x) => x.videoId === p.videoId);
    p.mut.setInLibrary(Boolean(item));
    p.mut.setLibraryItemForCurrentVideo(item ?? null);
    const loc = resolveLocale(settings.uiLocale);
    const panelT = createTranslator(loc);
    p.mut.setPanelLocale(loc);
    p.mut.setPanelT(panelT);
    p.fx.syncWatchPanelLabels();

    populateLevelSelectUi(
      p.ui.difficultySelect,
      settings.levelFramework ?? 'jlpt',
      item?.difficulty ?? null,
      settings.customLevels ?? [],
      panelT,
    );

    p.ui.statusEl.textContent = item ? panelT('panel.statusInLibrary') : panelT('panel.statusNotSaved');

    if (saveRowEl) saveRowEl.hidden = false;

    if (item) {
      p.mut.setPracticeEnabled(true);
      p.ui.practiceToggle.checked = true;
    } else {
      p.mut.setPracticeEnabled(false);
      p.ui.practiceToggle.checked = false;
    }
    if (p.debug.enabled()) {
      p.debug.log('refreshState:done', {
        videoId: p.videoId,
        inLibrary: Boolean(item),
        libraryCount: res.data.library.length,
      });
      p.debug.strip(`refreshState inLibrary=${String(Boolean(item))} vid=${p.videoId.slice(0, 8)}…`);
    }
  } catch {
    p.mut.setLibraryItemForCurrentVideo(null);
    p.mut.setInLibrary(false);
    p.ui.statusEl.textContent = p.getPanelT()('panel.syncError');
    if (saveRowEl) saveRowEl.hidden = false;
    p.fx.syncWatchPanelLabels();
  }
}

export function flashWatchPanelAfterLibraryWrite(p: {
  res: ExtensionResponse;
  successKey: 'panel.flashSaved' | 'panel.flashSavedLevel';
  ui: WatchPanelUiRefs;
  shadowRoot: ShadowRoot | null;
  panelT: Translator;
  mountDebug: WatchPanelDebugHooks;
}): void {
  p.mountDebug.log('flashAfterLibraryWrite', {
    ok: p.res.ok,
    libraryAction: p.res.ok && 'libraryAction' in p.res ? p.res.libraryAction : undefined,
  });
  if (!p.res.ok) {
    showWatchPanelLibraryBanner({
      shadowRoot: p.shadowRoot,
      text: p.res.error,
      tone: 'err',
      debug: p.mountDebug,
    });
    return;
  }
  if ('libraryAction' in p.res && p.res.libraryAction === 'updated') {
    return;
  }
  setWatchPanelStatusFlash(p.ui.statusEl, p.panelT(p.successKey));
}

export function flashWatchPanelXpTick(p: {
  ui: WatchPanelUiRefs;
  panelT: Translator;
  xpGained: number;
  levelUp: boolean;
  newLevel: number;
}): void {
  if (p.xpGained <= 0 && !p.levelUp) return;
  if (p.levelUp) {
    setWatchPanelStatusFlash(
      p.ui.statusEl,
      p.panelT('panel.flashRankUp', { level: String(p.newLevel) }),
      'ok',
    );
    return;
  }
  setWatchPanelStatusFlash(p.ui.statusEl, p.panelT('panel.flashXp', { xp: String(p.xpGained) }), 'ok');
}

export async function saveWatchPanelVideoToLibrary(p: {
  getVideoId: () => string | null;
  getUi: () => WatchPanelUiRefs | null;
  getInLibrary: () => boolean;
  getLibrarySnapshot: () => LibraryItem | null;
  readTitle: () => string;
  readChannel: () => string;
  panelT: Translator;
  log: (event: string, detail?: Record<string, unknown>) => void;
  flash: (res: ExtensionResponse, key: 'panel.flashSaved' | 'panel.flashSavedLevel') => void;
  afterPersist: (videoId: string) => Promise<void>;
}): Promise<void> {
  const videoId = p.getVideoId();
  const ui = p.getUi();
  p.log('saveToLibrary:click', {
    videoId,
    hasUi: Boolean(ui),
    inLibrary: p.getInLibrary(),
    hasLibrarySnapshot: Boolean(p.getLibrarySnapshot()),
  });
  if (!videoId || !ui) {
    setWatchPanelStatusFlash(ui?.statusEl ?? null, p.panelT('panel.noVideo'), 'err');
    p.log('saveToLibrary:abort', { reason: 'no-video-or-ui' });
    return;
  }
  const difficulty = ui.difficultySelect.value === '' ? null : (ui.difficultySelect.value as LevelTag);

  if (p.getInLibrary()) {
    p.log('saveToLibrary:branch-already-in-library', {
      difficulty,
      snapshotTitle: p.getLibrarySnapshot()?.title?.slice(0, 80),
    });
    return;
  }

  const res = (await sendMsg<ExtensionResponse>({
    type: MSG.ADD_OR_UPDATE_LIBRARY,
    payload: {
      videoId,
      title: p.readTitle(),
      channel: p.readChannel(),
      difficulty,
    },
  })) as ExtensionResponse;
  p.flash(res, 'panel.flashSaved');
  await p.afterPersist(videoId);
}

export async function applyWatchPanelDifficultyChange(p: {
  value: string;
  getVideoId: () => string | null;
  getUi: () => WatchPanelUiRefs | null;
  getInLibrary: () => boolean;
  readTitle: () => string;
  readChannel: () => string;
  flash: (res: ExtensionResponse, key: 'panel.flashSaved' | 'panel.flashSavedLevel') => void;
  afterPersist: (videoId: string) => Promise<void>;
}): Promise<void> {
  const videoId = p.getVideoId();
  const ui = p.getUi();
  if (!videoId || !ui) return;
  const difficulty = p.value === '' ? null : (p.value as LevelTag);
  if (p.getInLibrary()) {
    await sendMsg({
      type: MSG.SET_DIFFICULTY,
      payload: { videoId, difficulty },
    });
  } else {
    const res = (await sendMsg<ExtensionResponse>({
      type: MSG.ADD_OR_UPDATE_LIBRARY,
      payload: {
        videoId,
        title: p.readTitle(),
        channel: p.readChannel(),
        difficulty,
      },
    })) as ExtensionResponse;
    p.flash(res, 'panel.flashSavedLevel');
  }
  await p.afterPersist(videoId);
}

export async function setWatchPanelLibraryCompletion(p: {
  complete: boolean;
  getVideoId: () => string | null;
  readTitle: () => string;
  readChannel: () => string;
  panelT: Translator;
  getUi: () => WatchPanelUiRefs | null;
  afterPersist: (videoId: string) => Promise<void>;
}): Promise<void> {
  const videoId = p.getVideoId();
  const ui = p.getUi();
  if (!videoId || !ui) {
    setWatchPanelStatusFlash(ui?.statusEl ?? null, p.panelT('panel.noVideo'), 'err');
    return;
  }
  const res = (await sendMsg<ExtensionResponse>({
    type: MSG.SET_LIBRARY_COMPLETION,
    payload: {
      videoId,
      complete: p.complete,
      title: p.readTitle(),
      channel: p.readChannel(),
    },
  })) as ExtensionResponse;
  if (!res.ok) {
    setWatchPanelStatusFlash(ui.statusEl, res.error, 'err');
    return;
  }
  if (p.complete) {
    setWatchPanelStatusFlash(ui.statusEl, p.panelT('panel.flashMarkedComplete'));
  } else {
    setWatchPanelStatusFlash(ui.statusEl, p.panelT('panel.flashMarkedIncomplete'));
  }
  await p.afterPersist(videoId);
}
