// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createTranslator } from '../i18n';
import { uiActionFeedback } from '../lib/uiActionFeedback';
import { refreshWatchPanelLibraryUiFromRemoteState, saveWatchPanelVideoToLibrary } from './youtubeLibraryPanel';
import type { WatchPanelUiRefs } from './youtubePanelMount';

const t = createTranslator('en');
let ui: WatchPanelUiRefs;
beforeEach(() => {
  document.body.innerHTML = '<main><button part="add">Save</button><select part="difficulty"><option value="">Unrated</option><option value="N3">N3</option></select><p part="status"></p><p part="hint"></p></main>';
  ui = {
    root: document.querySelector('main')!, addBtn: document.querySelector('button')!,
    difficultySelect: document.querySelector('select')!, statusEl: document.querySelector('[part="status"]')!,
    hintEl: document.querySelector('[part="hint"]')!,
  };
});
afterEach(() => { vi.unstubAllGlobals(); document.body.innerHTML = ''; });

function saveOptions() {
  return {
    getVideoId: () => 'abcdefghijk', getUi: () => ui, getInLibrary: () => false,
    getLibrarySnapshot: () => null, readTitle: () => 'Practice', readChannel: () => 'Channel',
    panelT: t, log: vi.fn(), flash: vi.fn(), afterPersist: vi.fn(async () => {}),
  };
}

it('keeps the selected level and stops the success path after a rejected save', async () => {
  vi.stubGlobal('chrome', { runtime: { sendMessage: vi.fn().mockResolvedValue({ ok: false, error: 'Quota exceeded' }) } });
  ui.difficultySelect.value = 'N3';
  const options = saveOptions();
  await saveWatchPanelVideoToLibrary(options);
  expect(options.flash).not.toHaveBeenCalled();
  expect(options.afterPersist).not.toHaveBeenCalled();
  expect(ui.difficultySelect.value).toBe('N3');
  expect(ui.root.querySelector('[role="alert"]')?.textContent).toContain('Storage is full');
});

it('does not flash or refresh the next video when an earlier save finishes after navigation', async () => {
  let finish!: (value: unknown) => void;
  vi.stubGlobal('chrome', { runtime: { sendMessage: vi.fn(() => new Promise((resolve) => { finish = resolve; })) } });
  let videoId = 'abcdefghijk';
  const options = { ...saveOptions(), getVideoId: () => videoId };
  const pending = saveWatchPanelVideoToLibrary(options);
  videoId = 'differentId';
  uiActionFeedback(ui.root, t).reset();
  finish({ ok: true, libraryAction: 'inserted' });
  await pending;
  expect(options.flash).not.toHaveBeenCalled();
  expect(options.afterPersist).not.toHaveBeenCalled();
  expect(ui.root.querySelector('[role="alert"]')).toBeNull();
});

it('shows a synchronization error after a failed read instead of claiming the video is unsaved', async () => {
  vi.stubGlobal('chrome', { runtime: { sendMessage: vi.fn().mockResolvedValue({ ok: false, error: 'Unavailable' }) } });
  const noop = vi.fn();
  await refreshWatchPanelLibraryUiFromRemoteState({
    videoId: 'abcdefghijk', isCurrent: () => true, shadowRoot: null, ui, getPanelT: () => t,
    debug: { enabled: () => false, log: noop, strip: noop },
    mut: { setSettingsCache: noop, setLastDailySnapshot: noop, setExtensionInstallDateKey: noop, setInLibrary: noop, setLibraryItemForCurrentVideo: noop, setPanelLocale: noop, setPanelT: noop },
    fx: { applyPanelHostPosition: noop, applyWatchPanelCollapsed: noop, renderCalendar: noop, updateDailyGoalRing: noop, updatePlayerXpBar: noop, syncWatchPanelVideoLibraryChrome: noop, syncWatchPanelLabels: () => { ui.statusEl.textContent = 'Not saved'; } },
  });
  expect(ui.statusEl.textContent).toBe(t('panel.syncError'));
});
