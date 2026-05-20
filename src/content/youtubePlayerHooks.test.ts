import { describe, expect, it } from 'vitest';
import {
  COMPLETION_PROMPT_LEAD_SEC,
  completionPromptThresholdSec,
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
