import { APP_NAME } from '../lib/branding';
import { setWatchPanelHostVisible } from './youtubePanelMount';
import { runWatchPanelOnVideoChanged } from './youtubeWatchLifecycle';

export interface WatchPanelVideoFlowDeps {
  panelHostId: string;
  getVideoIdFromUrl: () => string | null;
  flushPractice: () => void;
  resetPracticeToggleAndPending: () => void;
  clearCompletionPromptState: () => void;
  detachCompletionListenerOnNoVideo: () => void;
  getShadowRoot: () => ShadowRoot | null;
  setCurrentVideoId: (nextId: string | null) => string | null;
  clearLibraryBanner: (reason?: string) => void;
  resetTimers: () => void;
  ensurePanel: () => void;
  applyPanelHostPosition: () => void;
  applyWatchPanelCollapsed: () => void;
  updateHomeFeedAttentionStrip: () => void;
  updateHint: () => void;
  refreshCalendarOnly: () => Promise<void>;
  shouldKeepWatchPanelVisibleWithoutVideoId: () => boolean;
  scheduleVideoIdResolutionRetries: () => void;
  applyNoVideoHomePanelLayout: (shadowRoot: ShadowRoot | null, show: boolean) => void;
  readTitle: () => string;
  refreshState: (videoId: string | null) => Promise<void>;
  rebindCompletionPromptListener: () => void;
  runSameVideoFlow: (videoId: string) => void | Promise<void>;
  fireAsyncWatch: (p: Promise<unknown>) => void;
}

export async function runWatchPanelVideoChangedFlow(deps: WatchPanelVideoFlowDeps): Promise<void> {
  await runWatchPanelOnVideoChanged({
    getVideoIdFromUrl: deps.getVideoIdFromUrl,
    flushPractice: deps.flushPractice,
    resetPracticeToggleAndPending: deps.resetPracticeToggleAndPending,
    commitVideoBinding: (nextId) => {
      const previousVideoId = deps.setCurrentVideoId(nextId);
      deps.clearCompletionPromptState();
      return previousVideoId;
    },
    clearLibraryBannerIfVideoChanged: (previousId, nextId) => {
      if (previousId !== nextId) {
        deps.clearLibraryBanner('video-change');
      }
    },
    runNoVideoFlow: async () => {
      deps.resetTimers();
      deps.clearLibraryBanner('no-video');
      deps.clearCompletionPromptState();
      deps.detachCompletionListenerOnNoVideo();
      deps.ensurePanel();
      deps.applyPanelHostPosition();
      deps.applyWatchPanelCollapsed();
      const titleEl = deps.getShadowRoot()?.querySelector('[part="title"]') as HTMLElement | null;
      if (titleEl) titleEl.textContent = APP_NAME;
      deps.updateHomeFeedAttentionStrip();
      deps.updateHint();
      deps.fireAsyncWatch(deps.refreshCalendarOnly());

      const keep = deps.shouldKeepWatchPanelVisibleWithoutVideoId();
      setWatchPanelHostVisible(deps.panelHostId, keep);
      if (keep) {
        if (!deps.getVideoIdFromUrl()) deps.scheduleVideoIdResolutionRetries();
      } else {
        deps.applyNoVideoHomePanelLayout(deps.getShadowRoot(), false);
      }
    },
    runHasVideoFlow: async (videoId) => {
      deps.ensurePanel();
      setWatchPanelHostVisible(deps.panelHostId, true);
      const shadowRoot = deps.getShadowRoot();
      deps.updateHomeFeedAttentionStrip();
      const titleEl = shadowRoot?.querySelector('[part="title"]') as HTMLElement | undefined;
      if (titleEl) {
        const t = deps.readTitle();
        titleEl.textContent = t.length > 90 ? `${t.slice(0, 90)}…` : t;
      }
      await deps.refreshState(videoId);
      deps.updateHint();
      deps.resetTimers();
      deps.rebindCompletionPromptListener();
    },
    runSameVideoFlow: async () => {
      deps.rebindCompletionPromptListener();
    },
  });
}
