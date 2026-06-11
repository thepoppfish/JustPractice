import { MSG } from '../lib/messages';
import type { ExtensionMessage } from '../lib/messages';

/** Batched persist interval for `PRACTICE_TICK` (write batching only — not how seconds are measured). */
export const PRACTICE_FLUSH_INTERVAL_MS = 30_000;

/** Minimal video surface for status / ended checks (not used to gate the playback meter). */
export type PracticeCountEligibleVideo = Pick<HTMLVideoElement, 'paused' | 'ended'>;

export interface ShouldCountPracticeTimeParams {
  practiceEnabled: boolean;
  currentVideoId: string | null;
  inLibrary: boolean;
  video: PracticeCountEligibleVideo | null;
  visibilityState: DocumentVisibilityState;
}

/** First gate that blocks counting; `null` when session gates pass (meter uses media delta). */
export type PracticeCountBlockReason =
  | 'practiceOff'
  | 'noVideoId'
  | 'notInLibrary'
  | 'noVideoElement'
  | 'ended'
  | 'hidden';

const PRACTICE_COUNT_BLOCK_LABELS: Record<PracticeCountBlockReason, string> = {
  practiceOff: 'practice off',
  noVideoId: 'no video id',
  notInLibrary: 'not saved to library',
  noVideoElement: 'no player video',
  ended: 'ended',
  hidden: 'tab hidden',
};

export function explainWhyNotCountingPractice(
  p: ShouldCountPracticeTimeParams,
): PracticeCountBlockReason | null {
  if (!p.practiceEnabled) return 'practiceOff';
  if (!p.currentVideoId) return 'noVideoId';
  if (!p.inLibrary) return 'notInLibrary';
  if (!p.video) return 'noVideoElement';
  if (p.video.ended) return 'ended';
  if (p.visibilityState !== 'visible') return 'hidden';
  return null;
}

export function shouldCountPracticeTime(p: ShouldCountPracticeTimeParams): boolean {
  return explainWhyNotCountingPractice(p) === null;
}

/** One-line status for the watch-panel debug strip. */
export function formatPracticeCountDebugLine(
  p: ShouldCountPracticeTimeParams,
  pendingSeconds: number,
): string {
  const block = explainWhyNotCountingPractice(p);
  if (block === null) {
    return `Counting: yes · pending ${pendingSeconds}s`;
  }
  return `Counting: no — ${PRACTICE_COUNT_BLOCK_LABELS[block]} · pending ${pendingSeconds}s`;
}

export interface FlushPendingPracticeSecondsParams {
  videoId: string | null;
  getPendingSeconds: () => number;
  setPendingSeconds: (next: number) => void;
  sendFireAndForget: (msg: ExtensionMessage) => void;
}

/**
 * If there is a bound video and positive pending seconds, clears pending and sends `PRACTICE_TICK`.
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

export interface PracticeFlushSchedulerOptions {
  getActive: () => boolean;
  getPendingSeconds: () => number;
  flush: () => void;
}

/**
 * Periodic flush while practice is active (only when pending > 0).
 */
export function createPracticeFlushScheduler(
  options: PracticeFlushSchedulerOptions,
): { reset: () => void; stop: () => void; msUntilNextFlush: () => number } {
  let flushTimer: ReturnType<typeof setInterval> | null = null;
  let lastFlushAt = Date.now();

  function clearTimer(): void {
    if (flushTimer !== null) {
      clearInterval(flushTimer);
      flushTimer = null;
    }
  }

  function startTimer(): void {
    clearTimer();
    lastFlushAt = Date.now();
    flushTimer = setInterval(() => {
      if (!options.getActive()) return;
      if (options.getPendingSeconds() <= 0) return;
      lastFlushAt = Date.now();
      options.flush();
    }, PRACTICE_FLUSH_INTERVAL_MS);
  }

  function reset(): void {
    options.flush();
    lastFlushAt = Date.now();
    if (options.getActive()) {
      startTimer();
    } else {
      clearTimer();
    }
  }

  function stop(): void {
    clearTimer();
  }

  function msUntilNextFlush(): number {
    const elapsed = Date.now() - lastFlushAt;
    return Math.max(0, PRACTICE_FLUSH_INTERVAL_MS - elapsed);
  }

  return { reset, stop, msUntilNextFlush };
}

/** Tab hide / unload → flush pending practice. */
export function attachPracticePageFlushListeners(opts: {
  flush: () => void;
}): void {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') opts.flush();
  });
  window.addEventListener('pagehide', () => opts.flush());
  window.addEventListener('beforeunload', () => opts.flush());
}
