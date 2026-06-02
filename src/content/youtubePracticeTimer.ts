import { MSG } from '../lib/messages';
import type { ExtensionMessage } from '../lib/messages';
import { STORAGE_SYNC_INTERVAL_MS } from '../lib/storageSyncPoll';

/** 1s UI tick while practice intervals are active (counting adds seconds only when rules pass). */
export const PRACTICE_COUNT_INTERVAL_MS = 1000;

/** Background merge interval for `PRACTICE_TICK`. */
export const PRACTICE_FLUSH_INTERVAL_MS = STORAGE_SYNC_INTERVAL_MS;

/** Minimal video surface for eligibility checks. */
export type PracticeCountEligibleVideo = Pick<HTMLVideoElement, 'paused' | 'ended'>;

export interface ShouldCountPracticeTimeParams {
  practiceEnabled: boolean;
  currentVideoId: string | null;
  video: PracticeCountEligibleVideo | null;
  visibilityState: DocumentVisibilityState;
  pauseWhenUnfocused: boolean;
  documentHasFocus: boolean;
}

/**
 * Mirrors watch-page rules documented in ExplaneMe: practice on, video id, playing,
 * tab visible, and optional focus gate when `pauseWhenUnfocused` is set.
 */
export function shouldCountPracticeTime(p: ShouldCountPracticeTimeParams): boolean {
  if (!p.practiceEnabled || !p.currentVideoId) return false;
  if (!p.video || p.video.paused || p.video.ended) return false;
  if (p.visibilityState !== 'visible') return false;
  if (p.pauseWhenUnfocused && !p.documentHasFocus) return false;
  return true;
}

export interface FlushPendingPracticeSecondsParams {
  videoId: string | null;
  getPendingSeconds: () => number;
  setPendingSeconds: (next: number) => void;
  sendFireAndForget: (msg: ExtensionMessage) => void;
}

/**
 * If there is a bound video and positive pending seconds, clears pending and sends `PRACTICE_TICK`.
 * Same guards and payload shape as the legacy `flushPractice` in `youtube.ts`.
 */
export function flushPendingPracticeSeconds(p: FlushPendingPracticeSecondsParams): void {
  if (!p.videoId) return;
  const pending = p.getPendingSeconds();
  if (pending <= 0) return;
  p.setPendingSeconds(0);
  p.sendFireAndForget({
    type: MSG.PRACTICE_TICK,
    payload: {
      videoId: p.videoId,
      deltaSeconds: pending,
      endedAtMs: Date.now(),
    },
  });
}

export interface PracticeIntervalControllerOptions {
  /** When false after a reset, no 1s / flush intervals are scheduled. */
  getIntervalsActive: () => boolean;
  /** Fired every {@link PRACTICE_COUNT_INTERVAL_MS} while intervals are running. */
  onCountInterval: () => void;
  /** Persist pending practice seconds (e.g. `PRACTICE_TICK`); also used on flush timer. */
  flush: () => void;
}

/**
 * Owns the two `setInterval` handles for practice counting + periodic flush.
 * Matches prior `youtube.ts` behavior: clear both → flush → restart if active.
 */
export function createPracticeIntervalController(
  options: PracticeIntervalControllerOptions,
): { reset: () => void } {
  let countTimer: ReturnType<typeof setInterval> | null = null;
  let flushTimer: ReturnType<typeof setInterval> | null = null;

  function clearTimers(): void {
    if (flushTimer !== null) {
      clearInterval(flushTimer);
      flushTimer = null;
    }
    if (countTimer !== null) {
      clearInterval(countTimer);
      countTimer = null;
    }
  }

  function reset(): void {
    clearTimers();
    options.flush();
    if (options.getIntervalsActive()) {
      countTimer = setInterval(options.onCountInterval, PRACTICE_COUNT_INTERVAL_MS);
      flushTimer = setInterval(options.flush, PRACTICE_FLUSH_INTERVAL_MS);
    }
  }

  return { reset };
}

/** Tab hide / blur / unload → flush pending practice (same hooks as legacy `youtube.ts`). */
export function attachPracticePageFlushListeners(opts: {
  getPauseWhenUnfocused: () => boolean;
  flush: () => void;
}): void {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') opts.flush();
  });
  window.addEventListener('blur', () => {
    if (opts.getPauseWhenUnfocused()) opts.flush();
  });
  window.addEventListener('beforeunload', () => opts.flush());
}
