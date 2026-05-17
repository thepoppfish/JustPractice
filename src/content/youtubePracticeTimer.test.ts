import { describe, expect, it } from 'vitest';
import { shouldCountPracticeTime } from './youtubePracticeTimer';

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
