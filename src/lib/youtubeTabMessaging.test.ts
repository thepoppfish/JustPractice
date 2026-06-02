import { describe, expect, it } from 'vitest';
import { isYoutubePageUrl } from './youtubeTabMessaging';

describe('isYoutubePageUrl', () => {
  it('accepts watch URLs on www and bare host', () => {
    expect(isYoutubePageUrl('https://www.youtube.com/watch?v=abc')).toBe(true);
    expect(isYoutubePageUrl('https://youtube.com/watch?v=abc')).toBe(true);
    expect(isYoutubePageUrl('https://m.youtube.com/watch?v=abc')).toBe(true);
  });

  it('rejects non-YouTube pages', () => {
    expect(isYoutubePageUrl('https://google.com/')).toBe(false);
    expect(isYoutubePageUrl('https://music.youtube.com/')).toBe(false);
  });
});
