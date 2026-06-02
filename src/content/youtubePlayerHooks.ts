import { pickFeedCardFromInteractionTarget, type VideoMeta } from './feedCards';

/** Best-effort primary `<video>` on watch / Shorts / flexy surfaces. */
export function getVideoElement(): HTMLVideoElement | null {
  const movie = document.querySelector('#movie_player video');
  if (movie instanceof HTMLVideoElement) return movie;
  const shorts = document.querySelector(
    'ytd-shorts #player-container video, ytd-reel-video-renderer video, ytd-short video',
  );
  if (shorts instanceof HTMLVideoElement) return shorts;
  const watchFlexy = document.querySelector('ytd-watch-flexy #player-container video');
  if (watchFlexy instanceof HTMLVideoElement) return watchFlexy;
  const v = document.querySelector('video');
  return v instanceof HTMLVideoElement ? v : null;
}

function elementTouchesPlayerShell(el: Element | null): boolean {
  if (!el) return false;
  return Boolean(
    el.closest('ytd-miniplayer') || el.closest('ytd-watch-flexy') || el.closest('.html5-video-player'),
  );
}

function mutationTouchesPlayerShell(m: MutationRecord): boolean {
  if (!(m.target instanceof Element)) return false;
  if (elementTouchesPlayerShell(m.target)) return true;
  if (m.type !== 'childList') return false;
  for (const n of [...m.addedNodes, ...m.removedNodes]) {
    if (!(n instanceof Element)) continue;
    if (n.matches('ytd-miniplayer, ytd-watch-flexy, .html5-video-player')) return true;
    if (elementTouchesPlayerShell(n)) return true;
  }
  return false;
}

/**
 * When the player chrome or layout under watch/miniplayer mutates, YouTube often swaps `<video>`;
 * debounce and notify so the content script can rebind timers and UI.
 */
export function attachYoutubePlayerDomHooks(onPlayerShellMaybeChanged: () => void): void {
  if (typeof MutationObserver === 'undefined' || !document.documentElement) return;

  let debounceTimer: number | null = null;
  const schedule = (): void => {
    if (debounceTimer !== null) clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
      debounceTimer = null;
      onPlayerShellMaybeChanged();
    }, 150);
  };

  const observer = new MutationObserver((mutations) => {
    for (const rec of mutations) {
      if (mutationTouchesPlayerShell(rec)) {
        schedule();
        return;
      }
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
  });
}

export function attachYoutubeNavHooks(onSpaNavigation: () => void): void {
  const schedule = (): void => {
    window.setTimeout(() => onSpaNavigation(), 0);
  };

  document.addEventListener('yt-navigate-finish', schedule);
  document.addEventListener('yt-page-data-updated', schedule);
  window.addEventListener('popstate', schedule);

  try {
    const { pushState, replaceState } = history;
    history.pushState = function (this: History, ...args: Parameters<History['pushState']>) {
      const r = pushState.apply(this, args);
      schedule();
      return r;
    };
    history.replaceState = function (this: History, ...args: Parameters<History['replaceState']>) {
      const r = replaceState.apply(this, args);
      schedule();
      return r;
    };
  } catch {
    /* ignore */
  }

  let lastHref = typeof location !== 'undefined' ? location.href : '';
  window.setInterval(() => {
    if (typeof location === 'undefined') return;
    if (location.href === lastHref) return;
    lastHref = location.href;
    schedule();
  }, 800);
}

export interface HomeFeedPointerPickOptions {
  /** Ignore picks that originate from our floating panel or feed popover. */
  elementInOurUiShell: (node: Node | null) => boolean;
  onFeedCardPicked: (pick: VideoMeta) => void;
}

/** Bind panel to the feed card the user taps when the address bar has no watch/shorts id. */
export function attachHomeFeedPointerPick(opts: HomeFeedPointerPickOptions): void {
  document.addEventListener(
    'pointerdown',
    (ev: PointerEvent) => {
      if (ev.button !== 0) return;

      const path: EventTarget[] =
        typeof ev.composedPath === 'function' ? ev.composedPath() : ev.target != null ? [ev.target] : [];
      for (const step of path) {
        if (step instanceof Node && opts.elementInOurUiShell(step)) return;
      }

      const pick = pickFeedCardFromInteractionTarget(ev.target);
      if (!pick) return;

      opts.onFeedCardPicked(pick);
    },
    true,
  );
}

/** Seconds before video end when the completion prompt should appear. */
export const COMPLETION_PROMPT_LEAD_SEC = 30;

/** For videos shorter than {@link COMPLETION_PROMPT_LEAD_SEC}, show when this fraction remains. */
export const SHORT_VIDEO_COMPLETION_PROMPT_RATIO = 0.5;

/** Playback time (seconds) at which the completion prompt should first appear. */
export function completionPromptThresholdSec(durationSec: number): number | null {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return null;
  if (durationSec >= COMPLETION_PROMPT_LEAD_SEC) {
    return durationSec - COMPLETION_PROMPT_LEAD_SEC;
  }
  return durationSec * SHORT_VIDEO_COMPLETION_PROMPT_RATIO;
}

export function shouldTriggerCompletionPrompt(currentTimeSec: number, durationSec: number): boolean {
  const threshold = completionPromptThresholdSec(durationSec);
  if (threshold === null) return false;
  return currentTimeSec >= threshold;
}

/** Poll `timeupdate` (throttled) until playback crosses the completion-prompt threshold. */
export function attachVideoCompletionPromptListener(
  video: HTMLVideoElement,
  onThresholdReached: () => void,
  throttleMs = 5000,
): () => void {
  let lastCheck = 0;

  const check = (): void => {
    const duration = video.duration;
    if (!Number.isFinite(duration) || duration <= 0) return;
    if (shouldTriggerCompletionPrompt(video.currentTime, duration)) {
      onThresholdReached();
    }
  };

  const onTimeUpdate = (): void => {
    const now = Date.now();
    if (now - lastCheck < throttleMs) return;
    lastCheck = now;
    check();
  };

  video.addEventListener('timeupdate', onTimeUpdate);
  video.addEventListener('loadedmetadata', check);
  video.addEventListener('durationchange', check);
  check();

  return () => {
    video.removeEventListener('timeupdate', onTimeUpdate);
    video.removeEventListener('loadedmetadata', check);
    video.removeEventListener('durationchange', check);
  };
}
