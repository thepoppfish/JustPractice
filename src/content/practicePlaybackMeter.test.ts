import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createPracticePlaybackMeter,
  isEligibleForPlaybackMeter,
  MAX_PLAYBACK_DELTA_SEC,
  PLAYBACK_SAMPLE_INTERVAL_MS,
  processPlaybackSample,
  type PracticeMeterEligibility,
} from './practicePlaybackMeter';

const eligibleBase: PracticeMeterEligibility = {
  practiceEnabled: true,
  currentVideoId: 'abc',
  inLibrary: true,
  visibilityState: 'visible',
  videoEnded: false,
};

describe('processPlaybackSample', () => {
  it('returns zero on first sample', () => {
    const r = processPlaybackSample({
      currentTime: 10,
      lastCurrentTime: null,
      seeking: false,
      ended: false,
    });
    expect(r.addedSeconds).toBe(0);
    expect(r.lastCurrentTime).toBe(10);
  });

  it('accumulates steady forward playback', () => {
    let last: number | null = null;
    let total = 0;
    for (let t = 1; t <= 5; t += 1) {
      const r = processPlaybackSample({
        currentTime: t,
        lastCurrentTime: last,
        seeking: false,
        ended: false,
      });
      total += r.addedSeconds;
      last = r.lastCurrentTime;
    }
    expect(total).toBeCloseTo(4, 2);
  });

  it('ignores large forward seek', () => {
    const r = processPlaybackSample({
      currentTime: 300,
      lastCurrentTime: 10,
      seeking: false,
      ended: false,
    });
    expect(r.addedSeconds).toBe(0);
    expect(r.ignoredSeek).toBe(true);
    expect(r.lastCurrentTime).toBe(300);
  });

  it('ignores when seeking flag is set', () => {
    const r = processPlaybackSample({
      currentTime: 12,
      lastCurrentTime: 10,
      seeking: true,
      ended: false,
    });
    expect(r.addedSeconds).toBe(0);
    expect(r.ignoredSeek).toBe(true);
  });

  it('ignores backward jumps', () => {
    const r = processPlaybackSample({
      currentTime: 5,
      lastCurrentTime: 20,
      seeking: false,
      ended: false,
    });
    expect(r.addedSeconds).toBe(0);
    expect(r.ignoredSeek).toBe(true);
  });

  it('ignores tiny deltas below minimum', () => {
    const r = processPlaybackSample({
      currentTime: 10.01,
      lastCurrentTime: 10,
      seeking: false,
      ended: false,
    });
    expect(r.addedSeconds).toBe(0);
  });

  it('treats delta beyond max as a seek', () => {
    const r = processPlaybackSample({
      currentTime: 10 + MAX_PLAYBACK_DELTA_SEC + 0.1,
      lastCurrentTime: 10,
      seeking: false,
      ended: false,
    });
    expect(r.ignoredSeek).toBe(true);
    expect(r.addedSeconds).toBe(0);
  });

  it('honors a wider maxDelta budget (e.g. 2x playback in a 1s sample)', () => {
    const r = processPlaybackSample({
      currentTime: 12,
      lastCurrentTime: 10,
      seeking: false,
      ended: false,
      maxDelta: 4,
    });
    expect(r.addedSeconds).toBeCloseTo(2, 2);
    expect(r.ignoredSeek).toBe(false);
  });

  it('adds nothing when ended', () => {
    const r = processPlaybackSample({
      currentTime: 99,
      lastCurrentTime: 98,
      seeking: false,
      ended: true,
    });
    expect(r.addedSeconds).toBe(0);
  });
});

describe('isEligibleForPlaybackMeter', () => {
  it('requires practice on, library membership, video id, and visible tab', () => {
    expect(isEligibleForPlaybackMeter(eligibleBase)).toBe(true);
    expect(isEligibleForPlaybackMeter({ ...eligibleBase, practiceEnabled: false })).toBe(false);
    expect(isEligibleForPlaybackMeter({ ...eligibleBase, inLibrary: false })).toBe(false);
    expect(isEligibleForPlaybackMeter({ ...eligibleBase, currentVideoId: null })).toBe(false);
    expect(isEligibleForPlaybackMeter({ ...eligibleBase, visibilityState: 'hidden' })).toBe(false);
    expect(isEligibleForPlaybackMeter({ ...eligibleBase, videoEnded: true })).toBe(false);
  });
});

describe('createPracticePlaybackMeter (interval sampler)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function fakeVideo(start = 0) {
    return {
      currentTime: start,
      seeking: false,
      ended: false,
      paused: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      getBoundingClientRect: () => ({ width: 1280, height: 720 }) as DOMRect,
      closest: () => null,
    } as unknown as HTMLVideoElement;
  }

  it('accumulates whole seconds as the 1s interval advances currentTime', () => {
    const video = fakeVideo(0);
    const meter = createPracticePlaybackMeter({
      getVideo: () => video,
      getEligibility: () => ({ ...eligibleBase }),
      onAccumulated: () => {},
    });
    meter.start();

    for (let i = 0; i < 5; i += 1) {
      video.currentTime += 1;
      vi.advanceTimersByTime(PLAYBACK_SAMPLE_INTERVAL_MS);
    }

    expect(meter.getPendingWholeSeconds()).toBe(5);
    meter.stop();
  });

  it('does not accumulate while paused (currentTime frozen)', () => {
    const video = fakeVideo(30);
    const meter = createPracticePlaybackMeter({
      getVideo: () => video,
      getEligibility: () => ({ ...eligibleBase }),
      onAccumulated: () => {},
    });
    meter.start();

    for (let i = 0; i < 4; i += 1) {
      vi.advanceTimersByTime(PLAYBACK_SAMPLE_INTERVAL_MS);
    }

    expect(meter.getPendingWholeSeconds()).toBe(0);
    meter.stop();
  });

  it('stops counting when tab becomes hidden', () => {
    const video = fakeVideo(0);
    let visibility: DocumentVisibilityState = 'visible';
    const meter = createPracticePlaybackMeter({
      getVideo: () => video,
      getEligibility: () => ({ ...eligibleBase, visibilityState: visibility }),
      onAccumulated: () => {},
    });
    meter.start();

    video.currentTime += 1;
    vi.advanceTimersByTime(PLAYBACK_SAMPLE_INTERVAL_MS);
    expect(meter.getPendingWholeSeconds()).toBe(1);

    visibility = 'hidden';
    video.currentTime += 5;
    vi.advanceTimersByTime(PLAYBACK_SAMPLE_INTERVAL_MS);
    expect(meter.getPendingWholeSeconds()).toBe(1);

    meter.stop();
  });

  it('consumeWholeSeconds keeps the sub-second remainder', () => {
    const video = fakeVideo(0);
    const meter = createPracticePlaybackMeter({
      getVideo: () => video,
      getEligibility: () => ({ ...eligibleBase }),
      onAccumulated: () => {},
    });
    meter.start();

    video.currentTime = 2.5;
    vi.advanceTimersByTime(PLAYBACK_SAMPLE_INTERVAL_MS);
    expect(meter.consumeWholeSeconds()).toBe(2);
    expect(meter.getPendingWholeSeconds()).toBe(0);

    video.currentTime = 3.0;
    vi.advanceTimersByTime(PLAYBACK_SAMPLE_INTERVAL_MS);
    expect(meter.getPendingWholeSeconds()).toBe(1);
    meter.stop();
  });
});
