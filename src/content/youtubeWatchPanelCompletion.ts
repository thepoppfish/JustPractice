import type { LibraryItem } from '../lib/storage';
import type { Translator } from '../i18n';
import type { ExtensionResponse } from '../lib/messages';
import {
  attachVideoCompletionPromptListener,
  getVideoElement,
  shouldTriggerCompletionPrompt,
} from './youtubePlayerHooks';
import {
  setWatchPanelEndedPromptVisible,
  syncWatchPanelCompletionUi,
  syncWatchPanelEndedPromptLabels,
} from './youtubePanelUi';
import { setWatchPanelLibraryCompletion } from './youtubeLibraryPanel';

export interface WatchPanelCompletionDeps {
  getShadowRoot: () => ShadowRoot | null;
  getPanelT: () => Translator;
  getInLibrary: () => boolean;
  getLibraryItemForCurrentVideo: () => LibraryItem | null;
  getCurrentVideoId: () => string | null;
  getVideoIdFromUrl: () => string | null;
  readTitle: () => string;
  readChannel: () => string;
  getUi: () => {
    root: HTMLElement;
    difficultySelect: HTMLSelectElement;
    addBtn: HTMLButtonElement;
    statusEl: HTMLElement;
    hintEl: HTMLElement;
  } | null;
  afterCompletionPersist: (videoId: string) => Promise<void>;
  syncWatchPanelLabels: () => void;
  applyXpFromResponse: (res: ExtensionResponse) => void;
}

export interface WatchPanelCompletionController {
  hideEndedPrompt: () => void;
  clearCompletionPromptState: () => void;
  dismissCompletionPromptForCurrentVideo: () => void;
  onCompletionThresholdReached: () => void;
  onDocumentVisibilityChange: () => void;
  rebindCompletionPromptListener: () => void;
  toggleWatchPanelCompletion: (complete: boolean) => Promise<void>;
  detachCompletionListenerOnNoVideo: () => void;
  /** Called from `syncWatchPanelLabels` onAfter hook. */
  syncCompletionUiOnLabelsRefresh: () => void;
}

export function createWatchPanelCompletionController(
  deps: WatchPanelCompletionDeps,
): WatchPanelCompletionController {
  let endedPromptVisible = false;
  let completionPromptShownForVideoId: string | null = null;
  let completionPromptDismissedForVideoId: string | null = null;
  let detachCompletionPromptListener: (() => void) | null = null;

  /** End-of-video prompt only applies to videos saved in the library. */
  function canOfferCompletionPrompt(): boolean {
    const currentVideoId = deps.getCurrentVideoId();
    if (!currentVideoId) return false;
    if (!deps.getInLibrary()) return false;
    if (deps.getLibraryItemForCurrentVideo()?.completedAt != null) return false;
    if (completionPromptDismissedForVideoId === currentVideoId) return false;
    return true;
  }

  function hideEndedPrompt(): void {
    endedPromptVisible = false;
    setWatchPanelEndedPromptVisible({ shadowRoot: deps.getShadowRoot(), visible: false });
  }

  function showEndedPrompt(): void {
    if (!canOfferCompletionPrompt()) return;
    if (document.hidden) return;
    endedPromptVisible = true;
    syncWatchPanelEndedPromptLabels({ shadowRoot: deps.getShadowRoot(), panelT: deps.getPanelT() });
    setWatchPanelEndedPromptVisible({ shadowRoot: deps.getShadowRoot(), visible: true });
  }

  function clearCompletionPromptState(): void {
    completionPromptShownForVideoId = null;
    completionPromptDismissedForVideoId = null;
    hideEndedPrompt();
  }

  function dismissCompletionPromptForCurrentVideo(): void {
    const currentVideoId = deps.getCurrentVideoId();
    if (currentVideoId) {
      completionPromptDismissedForVideoId = currentVideoId;
    }
    hideEndedPrompt();
  }

  function maybeShowCompletionPrompt(): void {
    const currentVideoId = deps.getCurrentVideoId();
    if (!canOfferCompletionPrompt()) return;
    completionPromptShownForVideoId = currentVideoId;
    showEndedPrompt();
  }

  function onCompletionThresholdReached(): void {
    const currentVideoId = deps.getCurrentVideoId();
    if (!currentVideoId) return;
    if (completionPromptShownForVideoId === currentVideoId) return;
    if (completionPromptDismissedForVideoId === currentVideoId) return;
    maybeShowCompletionPrompt();
  }

  function onDocumentVisibilityChange(): void {
    const currentVideoId = deps.getCurrentVideoId();
    if (document.hidden) {
      hideEndedPrompt();
      return;
    }
    if (currentVideoId && completionPromptShownForVideoId === currentVideoId && canOfferCompletionPrompt()) {
      showEndedPrompt();
    }
  }

  function rebindCompletionPromptListener(): void {
    const currentVideoId = deps.getCurrentVideoId();
    if (detachCompletionPromptListener) {
      detachCompletionPromptListener();
      detachCompletionPromptListener = null;
    }
    if (!currentVideoId) return;
    if (!deps.getInLibrary()) return;
    if (completionPromptDismissedForVideoId === currentVideoId) return;
    const video = getVideoElement();
    if (!video) return;

    if (
      completionPromptShownForVideoId === currentVideoId ||
      shouldTriggerCompletionPrompt(video.currentTime, video.duration)
    ) {
      maybeShowCompletionPrompt();
    }

    detachCompletionPromptListener = attachVideoCompletionPromptListener(
      video,
      onCompletionThresholdReached,
    );
  }

  async function toggleWatchPanelCompletion(complete: boolean): Promise<void> {
    hideEndedPrompt();
    await setWatchPanelLibraryCompletion({
      complete,
      getVideoId: deps.getVideoIdFromUrl,
      readTitle: deps.readTitle,
      readChannel: deps.readChannel,
      panelT: deps.getPanelT(),
      getUi: deps.getUi,
      shadowRoot: deps.getShadowRoot(),
      applyXpFromResponse: deps.applyXpFromResponse,
      afterPersist: deps.afterCompletionPersist,
    });
  }

  function detachCompletionListenerOnNoVideo(): void {
    if (detachCompletionPromptListener) {
      detachCompletionPromptListener();
      detachCompletionPromptListener = null;
    }
  }

  function syncCompletionUiOnLabelsRefresh(): void {
    const libraryItem = deps.getLibraryItemForCurrentVideo();
    syncWatchPanelCompletionUi({
      shadowRoot: deps.getShadowRoot(),
      item: libraryItem,
      panelT: deps.getPanelT(),
    });
    syncWatchPanelEndedPromptLabels({ shadowRoot: deps.getShadowRoot(), panelT: deps.getPanelT() });
    if (libraryItem?.completedAt != null) {
      endedPromptVisible = false;
    }
    setWatchPanelEndedPromptVisible({
      shadowRoot: deps.getShadowRoot(),
      visible: endedPromptVisible && deps.getInLibrary() && libraryItem?.completedAt == null,
    });
  }

  return {
    hideEndedPrompt,
    clearCompletionPromptState,
    dismissCompletionPromptForCurrentVideo,
    onCompletionThresholdReached,
    onDocumentVisibilityChange,
    rebindCompletionPromptListener,
    toggleWatchPanelCompletion,
    detachCompletionListenerOnNoVideo,
    syncCompletionUiOnLabelsRefresh,
  };
}
