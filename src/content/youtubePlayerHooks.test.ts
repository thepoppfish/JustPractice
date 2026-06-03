import { describe, expect, it } from 'vitest';
import {
  COMPLETION_PROMPT_LEAD_SEC,
  completionPromptThresholdSec,
  scoreWatchPageVideoCandidate,
  shouldTriggerCompletionPrompt,
  SHORT_VIDEO_COMPLETION_PROMPT_RATIO,
} from './youtubePlayerHooks';

describe('completionPromptThresholdSec', () => {
  it('returns T-30s for videos at least 30 seconds long', () => {
    const duration = COMPLETION_PROMPT_LEAD_SEC + 600;
    expect(completionPromptThresholdSec(duration)).toBe(duration - COMPLETION_PROMPT_LEAD_SEC);
  });

  it('returns 50% for videos shorter than 30 seconds', () => {
    const duration = 20;
    expect(completionPromptThresholdSec(duration)).toBe(duration * SHORT_VIDEO_COMPLETION_PROMPT_RATIO);
  });

  it('returns null when duration is unknown', () => {
    expect(completionPromptThresholdSec(Number.NaN)).toBeNull();
    expect(completionPromptThresholdSec(0)).toBeNull();
  });
});

describe('shouldTriggerCompletionPrompt', () => {
  it('triggers when 30 seconds remain for long videos', () => {
    const duration = 3600;
    const threshold = duration - COMPLETION_PROMPT_LEAD_SEC;
    expect(shouldTriggerCompletionPrompt(threshold - 1, duration)).toBe(false);
    expect(shouldTriggerCompletionPrompt(threshold, duration)).toBe(true);
  });

  it('triggers at 50% for videos under 30 seconds', () => {
    const duration = 20;
    const threshold = duration * SHORT_VIDEO_COMPLETION_PROMPT_RATIO;
    expect(shouldTriggerCompletionPrompt(threshold - 1, duration)).toBe(false);
    expect(shouldTriggerCompletionPrompt(threshold, duration)).toBe(true);
  });
});

describe('scoreWatchPageVideoCandidate', () => {
  const mainPlayer = {
    paused: false,
    ended: false,
    currentTime: 42,
    width: 1280,
    height: 720,
    inMoviePlayer: true,
    inWatchPrimary: true,
    inPlayerContainer: true,
    inShortsPlayer: false,
    isFeedPreview: false,
  };

  it('prefers the main movie player over a playing sidebar hover preview', () => {
    const main = scoreWatchPageVideoCandidate(mainPlayer);
    const preview = scoreWatchPageVideoCandidate({
      paused: false,
      ended: false,
      currentTime: 3,
      width: 168,
      height: 94,
      inMoviePlayer: false,
      inWatchPrimary: false,
      inPlayerContainer: false,
      inShortsPlayer: false,
      isFeedPreview: true,
    });
    expect(main).toBeGreaterThan(preview);
    expect(preview).toBe(-1);
  });

  it('prefers a playing main-sized video over a paused one in the same shell', () => {
    const playing = scoreWatchPageVideoCandidate(mainPlayer);
    const paused = scoreWatchPageVideoCandidate({ ...mainPlayer, paused: true, currentTime: 0 });
    expect(playing).toBeGreaterThan(paused);
  });

  it('rejects tiny preview tiles', () => {
    expect(
      scoreWatchPageVideoCandidate({
        ...mainPlayer,
        width: 80,
        height: 45,
        isFeedPreview: false,
      }),
    ).toBe(-1);
  });
});
