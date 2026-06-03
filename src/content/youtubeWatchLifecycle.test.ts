import { describe, expect, it, vi } from 'vitest';
import { runWatchPanelOnVideoChanged } from './youtubeWatchLifecycle';

function makeSteps(overrides: Partial<Parameters<typeof runWatchPanelOnVideoChanged>[0]> = {}) {
  return {
    getVideoIdFromUrl: () => 'abc123',
    flushPractice: vi.fn(),
    resetPracticeToggleAndPending: vi.fn(),
    commitVideoBinding: vi.fn(() => 'abc123'),
    clearLibraryBannerIfVideoChanged: vi.fn(),
    runNoVideoFlow: vi.fn(async () => {}),
    runHasVideoFlow: vi.fn(async () => {}),
    ...overrides,
  };
}

describe('runWatchPanelOnVideoChanged', () => {
  it('does not reset practice UI when the bound video id is unchanged', async () => {
    const runSameVideoFlow = vi.fn(async () => {});
    const steps = makeSteps({
      getVideoIdFromUrl: () => 'same',
      commitVideoBinding: vi.fn(() => 'same'),
      runSameVideoFlow,
    });
    await runWatchPanelOnVideoChanged(steps);
    expect(steps.flushPractice).toHaveBeenCalled();
    expect(steps.resetPracticeToggleAndPending).not.toHaveBeenCalled();
    expect(runSameVideoFlow).toHaveBeenCalledWith('same');
    expect(steps.runHasVideoFlow).not.toHaveBeenCalled();
  });

  it('resets practice UI when navigating to a different video', async () => {
    const steps = makeSteps({
      getVideoIdFromUrl: () => 'new',
      commitVideoBinding: vi.fn(() => 'old'),
    });
    await runWatchPanelOnVideoChanged(steps);
    expect(steps.resetPracticeToggleAndPending).toHaveBeenCalled();
    expect(steps.runHasVideoFlow).toHaveBeenCalledWith('new');
  });
});
