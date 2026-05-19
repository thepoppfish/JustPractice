import { describe, expect, it, vi } from 'vitest';
import { MSG } from '../lib/messages';
import { flushPendingPracticeSeconds, shouldCountPracticeTime } from './youtubePracticeTimer';

const base = {
  practiceEnabled: true,
  currentVideoId: 'abc',
  video: { paused: false, ended: false } as const,
  visibilityState: 'visible' as DocumentVisibilityState,
  pauseWhenUnfocused: false,
  documentHasFocus: true,
};

describe('shouldCountPracticeTime', () => {
  it('returns false when practice is off', () => {
    expect(shouldCountPracticeTime({ ...base, practiceEnabled: false })).toBe(false);
  });

  it('returns false without a video id', () => {
    expect(shouldCountPracticeTime({ ...base, currentVideoId: null })).toBe(false);
  });

  it('returns false when video is missing', () => {
    expect(shouldCountPracticeTime({ ...base, video: null })).toBe(false);
  });

  it('returns false when video is paused or ended', () => {
    expect(shouldCountPracticeTime({ ...base, video: { paused: true, ended: false } })).toBe(false);
    expect(shouldCountPracticeTime({ ...base, video: { paused: false, ended: true } })).toBe(false);
  });

  it('returns false when document is hidden', () => {
    expect(shouldCountPracticeTime({ ...base, visibilityState: 'hidden' })).toBe(false);
  });

  it('returns false when pauseWhenUnfocused and document lacks focus', () => {
    expect(
      shouldCountPracticeTime({
        ...base,
        pauseWhenUnfocused: true,
        documentHasFocus: false,
      }),
    ).toBe(false);
  });

  it('returns true when all gates pass', () => {
    expect(shouldCountPracticeTime(base)).toBe(true);
  });

  it('allows unfocused when pauseWhenUnfocused is false', () => {
    expect(shouldCountPracticeTime({ ...base, documentHasFocus: false })).toBe(true);
  });
});

describe('flushPendingPracticeSeconds', () => {
  it('does nothing without video id', () => {
    const send = vi.fn();
    let pending = 5;
    flushPendingPracticeSeconds({
      videoId: null,
      getPendingSeconds: () => pending,
      setPendingSeconds: (n) => {
        pending = n;
      },
      sendFireAndForget: send,
    });
    expect(pending).toBe(5);
    expect(send).not.toHaveBeenCalled();
  });

  it('does nothing when pending is zero', () => {
    const send = vi.fn();
    flushPendingPracticeSeconds({
      videoId: 'vid',
      getPendingSeconds: () => 0,
      setPendingSeconds: vi.fn(),
      sendFireAndForget: send,
    });
    expect(send).not.toHaveBeenCalled();
  });

  it('clears pending and sends PRACTICE_TICK with delta', () => {
    const send = vi.fn();
    let pending = 12;
    flushPendingPracticeSeconds({
      videoId: 'abc',
      getPendingSeconds: () => pending,
      setPendingSeconds: (n) => {
        pending = n;
      },
      sendFireAndForget: send,
    });
    expect(pending).toBe(0);
    expect(send).toHaveBeenCalledTimes(1);
    const msg = send.mock.calls[0][0] as {
      type: string;
      payload: { videoId: string; deltaSeconds: number; endedAtMs: number };
    };
    expect(msg.type).toBe(MSG.PRACTICE_TICK);
    expect(msg.payload.videoId).toBe('abc');
    expect(msg.payload.deltaSeconds).toBe(12);
    expect(typeof msg.payload.endedAtMs).toBe('number');
  });
});
