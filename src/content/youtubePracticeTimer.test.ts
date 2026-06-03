import { describe, expect, it, vi } from 'vitest';
import { MSG } from '../lib/messages';
import {
  explainWhyNotCountingPractice,
  flushPendingPracticeSeconds,
  formatPracticeCountDebugLine,
  shouldCountPracticeTime,
} from './youtubePracticeTimer';

const base = {
  practiceEnabled: true,
  currentVideoId: 'abc',
  video: { paused: false, ended: false } as const,
  visibilityState: 'visible' as DocumentVisibilityState,
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

  it('returns false when video ended', () => {
    expect(shouldCountPracticeTime({ ...base, video: { paused: false, ended: true } })).toBe(false);
  });

  it('allows counting when paused (meter uses media delta, not paused flag)', () => {
    expect(shouldCountPracticeTime({ ...base, video: { paused: true, ended: false } })).toBe(true);
  });

  it('returns false when document is hidden', () => {
    expect(shouldCountPracticeTime({ ...base, visibilityState: 'hidden' })).toBe(false);
  });

  it('returns true when all gates pass', () => {
    expect(shouldCountPracticeTime(base)).toBe(true);
  });
});

describe('explainWhyNotCountingPractice', () => {
  it('returns null when all gates pass', () => {
    expect(explainWhyNotCountingPractice(base)).toBeNull();
  });

  it('returns the first failing gate in priority order', () => {
    expect(explainWhyNotCountingPractice({ ...base, practiceEnabled: false })).toBe('practiceOff');
    expect(explainWhyNotCountingPractice({ ...base, currentVideoId: null })).toBe('noVideoId');
    expect(explainWhyNotCountingPractice({ ...base, video: null })).toBe('noVideoElement');
    expect(
      explainWhyNotCountingPractice({ ...base, video: { paused: false, ended: true } }),
    ).toBe('ended');
    expect(explainWhyNotCountingPractice({ ...base, visibilityState: 'hidden' })).toBe('hidden');
  });

  it('formats debug lines for counting and blocked states', () => {
    expect(formatPracticeCountDebugLine(base, 7)).toBe('Counting: yes · pending 7s');
    expect(formatPracticeCountDebugLine({ ...base, visibilityState: 'hidden' }, 3)).toBe(
      'Counting: no — tab hidden · pending 3s',
    );
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
