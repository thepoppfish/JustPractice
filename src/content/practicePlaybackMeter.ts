/** Default cap for `currentTime` jumps treated as a seek (used when no wall-clock budget given). */
export const MAX_PLAYBACK_DELTA_SEC = 2.5;

/** Minimum forward delta to treat as real playback (not floating-point noise). */
export const MIN_PLAYBACK_DELTA_SEC = 0.02;

/** Sampling cadence. A visible tab is NOT subject to Chrome's hidden-page timer throttling. */
export const PLAYBACK_SAMPLE_INTERVAL_MS = 1000;

export interface PlaybackSampleInput {
  currentTime: number;
  lastCurrentTime: number | null;
  seeking: boolean;
  ended: boolean;
  /** Largest forward delta to accept as playback; larger is treated as a seek. */
  maxDelta?: number;
}

export interface PlaybackSampleResult {
  lastCurrentTime: number;
  addedSeconds: number;
  ignoredSeek: boolean;
}

/**
 * Advance the playback clock sample; returns how many seconds of media time elapsed.
 * Pure function — unit tested without DOM.
 */
export function processPlaybackSample(input: PlaybackSampleInput): PlaybackSampleResult {
  const { currentTime, lastCurrentTime, seeking, ended } = input;
  const maxDelta = input.maxDelta ?? MAX_PLAYBACK_DELTA_SEC;

  if (ended || lastCurrentTime === null || !Number.isFinite(lastCurrentTime)) {
    return { lastCurrentTime: currentTime, addedSeconds: 0, ignoredSeek: false };
  }

  const delta = currentTime - lastCurrentTime;

  if (seeking || delta < 0 || delta > maxDelta) {
    return { lastCurrentTime: currentTime, addedSeconds: 0, ignoredSeek: true };
  }

  if (delta < MIN_PLAYBACK_DELTA_SEC) {
    return { lastCurrentTime: currentTime, addedSeconds: 0, ignoredSeek: false };
  }

  return { lastCurrentTime: currentTime, addedSeconds: delta, ignoredSeek: false };
}

export interface PracticeMeterEligibility {
  practiceEnabled: boolean;
  currentVideoId: string | null;
  inLibrary: boolean;
  visibilityState: DocumentVisibilityState;
  videoEnded: boolean;
}

export function isEligibleForPlaybackMeter(e: PracticeMeterEligibility): boolean {
  if (!e.practiceEnabled || !e.currentVideoId) return false;
  if (!e.inLibrary) return false;
  if (e.visibilityState !== 'visible') return false;
  if (e.videoEnded) return false;
  return true;
}

export interface PracticePlaybackMeterDebugState {
  bound: boolean;
  pendingWholeSeconds: number;
  pendingFractional: number;
  lastDeltaSec: number;
  ignoredSeek: boolean;
  eligible: boolean;
  videoEnded: boolean;
  videoSeeking: boolean;
  videoPaused: boolean;
  videoWidth: number;
  videoHeight: number;
  inMoviePlayer: boolean;
}

export interface PracticePlaybackMeterOptions {
  getVideo: () => HTMLVideoElement | null;
  getEligibility: () => PracticeMeterEligibility;
  /** Called when media time is accumulated (refresh ring/calendar). */
  onAccumulated: () => void;
}

export interface PracticePlaybackMeter {
  /** Begin the 1s sampler and bind to the current video. Idempotent. */
  start: () => void;
  /** Stop the sampler and detach. */
  stop: () => void;
  /** Re-evaluate which video to track (e.g. after player DOM swap). */
  rebind: () => void;
  reset: () => void;
  getPendingWholeSeconds: () => number;
  /** Whole seconds ready to persist; keeps sub-second remainder in the meter. */
  consumeWholeSeconds: () => number;
  getDebugState: () => PracticePlaybackMeterDebugState;
  formatDebugLine: (flushInMs: number | null) => string;
}

export function createPracticePlaybackMeter(
  options: PracticePlaybackMeterOptions,
): PracticePlaybackMeter {
  let boundVideo: HTMLVideoElement | null = null;
  let detachListeners: (() => void) | null = null;
  let sampleTimer: ReturnType<typeof setInterval> | null = null;
  let lastCurrentTime: number | null = null;
  let lastSampleAtMs = 0;
  let pendingFractional = 0;
  let lastDeltaSec = 0;
  let lastIgnoredSeek = false;
  let lastEligible = false;

  function bindTo(video: HTMLVideoElement | null): void {
    if (video === boundVideo) return;
    detachListeners?.();
    detachListeners = null;
    boundVideo = video;
    lastCurrentTime = video ? video.currentTime : null;
    lastSampleAtMs = Date.now();

    if (!video) return;

    // `timeupdate` is a secondary, finer-grained trigger; the 1s interval is the primary driver.
    const onTick = (): void => sample();
    video.addEventListener('timeupdate', onTick);
    video.addEventListener('seeked', onTick);
    detachListeners = () => {
      video.removeEventListener('timeupdate', onTick);
      video.removeEventListener('seeked', onTick);
    };
  }

  function rebind(): void {
    bindTo(options.getVideo());
  }

  function sample(): void {
    // Always track the live main player; YouTube swaps the <video> on layout/quality changes.
    const current = options.getVideo();
    if (current !== boundVideo) bindTo(current);

    const video = boundVideo;
    const nowMs = Date.now();
    const eligible = isEligibleForPlaybackMeter(options.getEligibility());
    lastEligible = eligible;

    if (!video || !eligible) {
      lastCurrentTime = video ? video.currentTime : null;
      lastSampleAtMs = nowMs;
      lastDeltaSec = 0;
      return;
    }

    // Budget the accepted delta to elapsed wall time (allows up to ~3x speed; rejects real seeks).
    const wallElapsedSec = lastSampleAtMs > 0 ? (nowMs - lastSampleAtMs) / 1000 : 1;
    const maxDelta = Math.max(MAX_PLAYBACK_DELTA_SEC, wallElapsedSec * 3 + 1);

    const result = processPlaybackSample({
      currentTime: video.currentTime,
      lastCurrentTime,
      seeking: video.seeking,
      ended: video.ended,
      maxDelta,
    });

    lastCurrentTime = result.lastCurrentTime;
    lastSampleAtMs = nowMs;
    lastDeltaSec = result.addedSeconds;
    lastIgnoredSeek = result.ignoredSeek;

    if (result.addedSeconds > 0) {
      pendingFractional += result.addedSeconds;
      options.onAccumulated();
    }
  }

  function start(): void {
    rebind();
    if (sampleTimer !== null) return;
    sampleTimer = setInterval(sample, PLAYBACK_SAMPLE_INTERVAL_MS);
  }

  function stop(): void {
    if (sampleTimer !== null) {
      clearInterval(sampleTimer);
      sampleTimer = null;
    }
    detachListeners?.();
    detachListeners = null;
    boundVideo = null;
    lastCurrentTime = null;
  }

  function reset(): void {
    lastCurrentTime = boundVideo ? boundVideo.currentTime : null;
    lastSampleAtMs = Date.now();
    pendingFractional = 0;
    lastDeltaSec = 0;
    lastIgnoredSeek = false;
  }

  function getPendingWholeSeconds(): number {
    return Math.floor(pendingFractional);
  }

  function consumeWholeSeconds(): number {
    const whole = Math.floor(pendingFractional);
    if (whole > 0) pendingFractional -= whole;
    return whole;
  }

  function getDebugState(): PracticePlaybackMeterDebugState {
    const video = boundVideo;
    const rect = video?.getBoundingClientRect();
    return {
      bound: Boolean(video),
      pendingWholeSeconds: getPendingWholeSeconds(),
      pendingFractional,
      lastDeltaSec,
      ignoredSeek: lastIgnoredSeek,
      eligible: lastEligible,
      videoEnded: Boolean(video?.ended),
      videoSeeking: Boolean(video?.seeking),
      videoPaused: Boolean(video?.paused),
      videoWidth: Math.round(rect?.width ?? 0),
      videoHeight: Math.round(rect?.height ?? 0),
      inMoviePlayer: Boolean(video?.closest('#movie_player')),
    };
  }

  function formatDebugLine(flushInMs: number | null): string {
    const d = getDebugState();
    const flushPart =
      flushInMs !== null && flushInMs >= 0 ? ` (flush ~${Math.ceil(flushInMs / 1000)}s)` : '';
    if (!d.bound) return `media: no video bound${flushPart}`;
    if (!d.eligible) return `media: idle (tab hidden/off) · pending ${d.pendingWholeSeconds}s${flushPart}`;
    if (d.lastDeltaSec > 0) {
      return `media +${d.lastDeltaSec.toFixed(2)}s · pending ${d.pendingWholeSeconds}s${flushPart}`;
    }
    if (d.ignoredSeek) return `media: seek ignored · pending ${d.pendingWholeSeconds}s${flushPart}`;
    return `media: paused/no progress · pending ${d.pendingWholeSeconds}s · ${d.videoWidth}x${d.videoHeight}${flushPart}`;
  }

  return {
    start,
    stop,
    rebind,
    reset,
    getPendingWholeSeconds,
    consumeWholeSeconds,
    getDebugState,
    formatDebugLine,
  };
}
