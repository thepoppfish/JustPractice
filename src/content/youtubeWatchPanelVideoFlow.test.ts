import { describe, expect, it, vi } from 'vitest';
import { runWatchPanelVideoChangedFlow } from './youtubeWatchPanelVideoFlow';

function makeDeps(
  overrides: Partial<Parameters<typeof runWatchPanelVideoChangedFlow>[0]> = {},
) {
  return {
    panelHostId: 'jp-practice-yt-panel-host',
    getVideoIdFromUrl: () => 'same',
    flushPractice: vi.fn(),
    resetPracticeToggleAndPending: vi.fn(),
    clearCompletionPromptState: vi.fn(),
    detachCompletionListenerOnNoVideo: vi.fn(),
    getShadowRoot: () => null,
    setCurrentVideoId: vi.fn(() => 'same'),
    clearLibraryBanner: vi.fn(),
    resetTimers: vi.fn(),
    ensurePanel: vi.fn(),
    applyPanelHostPosition: vi.fn(),
    applyWatchPanelCollapsed: vi.fn(),
    updateHint: vi.fn(),
    refreshCalendarOnly: vi.fn(async () => {}),
    shouldKeepWatchPanelVisibleWithoutVideoId: () => false,
    scheduleVideoIdResolutionRetries: vi.fn(),
    readTitle: () => 'title',
    syncWatchPanelVideoLibraryChrome: vi.fn(),
    refreshState: vi.fn(async () => {}),
    rebindCompletionPromptListener: vi.fn(),
    runSameVideoFlow: vi.fn(async () => {}),
    fireAsyncWatch: vi.fn(),
    ...overrides,
  };
}

describe('runWatchPanelVideoChangedFlow', () => {
  it('delegates same-video flow to the caller (meter rebind, completion, etc.)', async () => {
    const deps = makeDeps();
    await runWatchPanelVideoChangedFlow(deps);
    expect(deps.resetPracticeToggleAndPending).not.toHaveBeenCalled();
    expect(deps.runSameVideoFlow).toHaveBeenCalledWith('same');
    expect(deps.refreshState).not.toHaveBeenCalled();
  });
});
