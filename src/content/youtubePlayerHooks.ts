import { pickFeedCardFromInteractionTarget, type VideoMeta } from './feedCards';

/** Minimum rendered size to treat a `<video>` as the main watch player (not a hover preview). */
const MIN_MAIN_PLAYER_VIDEO_PX = 120;

const WATCH_PLAYER_ROOT_SELECTORS = [
  '#movie_player',
  'ytd-watch-flexy #primary',
  'ytd-watch-flexy #player-container',
  'ytd-watch-flexy #player',
  'ytd-shorts #player-container',
  'ytd-reel-video-renderer',
  'ytd-short #player',
  '.html5-video-player',
] as const;

const FEED_PREVIEW_ANCESTOR_SELECTORS = [
  'ytd-compact-video-renderer',
  'ytd-video-renderer',
  'ytd-rich-item-renderer',
  'ytd-grid-video-renderer',
  'ytd-channel-video-renderer',
  'ytd-playlist-panel-video-renderer',
] as const;

export interface WatchVideoCandidateScoreInput {
  paused: boolean;
  ended: boolean;
  currentTime: number;
  width: number;
  height: number;
  inMoviePlayer: boolean;
  inWatchPrimary: boolean;
  inPlayerContainer: boolean;
  inShortsPlayer: boolean;
  isFeedPreview: boolean;
}

/** Collect `<video>` nodes under a root, including open shadow roots. */
export function collectVideosDeep(root: Element | ShadowRoot, out: HTMLVideoElement[]): void {
  root.querySelectorAll('video').forEach((node) => {
    if (node instanceof HTMLVideoElement) out.push(node);
  });
  root.querySelectorAll('*').forEach((el) => {
    if (el.shadowRoot) collectVideosDeep(el.shadowRoot, out);
  });
}

export function isFeedHoverPreviewVideo(video: Element): boolean {
  return FEED_PREVIEW_ANCESTOR_SELECTORS.some((sel) => Boolean(video.closest(sel)));
}

/** Score for choosing the main watch-page player among several `<video>` elements. */
export function scoreWatchPageVideoCandidate(input: WatchVideoCandidateScoreInput): number {
  if (input.isFeedPreview) return -1;
  if (input.width < MIN_MAIN_PLAYER_VIDEO_PX || input.height < MIN_MAIN_PLAYER_VIDEO_PX) return -1;

  let score = input.width * input.height;
  if (input.inMoviePlayer) score += 1e12;
  if (input.inWatchPrimary) score += 1e11;
  if (input.inPlayerContainer) score += 1e10;
  if (input.inShortsPlayer) score += 1e10;
  if (!input.paused && !input.ended) score += 1e9;
  if (input.currentTime > 0) score += 1e6;
  return score;
}

function scoreVideoElement(video: HTMLVideoElement): number {
  const rect = video.getBoundingClientRect();
  return scoreWatchPageVideoCandidate({
    paused: video.paused,
    ended: video.ended,
    currentTime: video.currentTime,
    width: rect.width,
    height: rect.height,
    inMoviePlayer: Boolean(video.closest('#movie_player')),
    inWatchPrimary: Boolean(video.closest('ytd-watch-flexy #primary')),
    inPlayerContainer: Boolean(video.closest('ytd-watch-flexy #player-container, ytd-watch-flexy #player')),
    inShortsPlayer: Boolean(
      video.closest('ytd-shorts #player-container, ytd-reel-video-renderer, ytd-short'),
    ),
    isFeedPreview: isFeedHoverPreviewVideo(video),
  });
}

function pickBestVideo(candidates: Iterable<HTMLVideoElement>): HTMLVideoElement | null {
  let best: HTMLVideoElement | null = null;
  let bestScore = -1;
  for (const video of candidates) {
    const score = scoreVideoElement(video);
    if (score > bestScore) {
      bestScore = score;
      best = video;
    }
  }
  return best;
}

function getWatchPlayerRoots(): Element[] {
  const seen = new Set<Element>();
  const roots: Element[] = [];
  for (const sel of WATCH_PLAYER_ROOT_SELECTORS) {
    const el = document.querySelector(sel);
    if (el && !seen.has(el)) {
      seen.add(el);
      roots.push(el);
    }
  }
  return roots;
}

/**
 * Best-effort primary `<video>` on watch / Shorts surfaces.
 * Prefers the main player (including shadow DOM), never a sidebar hover-preview tile.
 */
export function getVideoElement(): HTMLVideoElement | null {
  const roots = getWatchPlayerRoots();
  const candidates: HTMLVideoElement[] = [];

  if (roots.length > 0) {
    for (const root of roots) {
      collectVideosDeep(root, candidates);
    }
    const best = pickBestVideo(candidates);
    if (best) return best;
  }

  // Last resort: scan document but still reject feed previews and tiny tiles.
  collectVideosDeep(document.documentElement, candidates);
  return pickBestVideo(candidates);
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
