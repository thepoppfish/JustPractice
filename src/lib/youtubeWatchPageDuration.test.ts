import { describe, expect, it } from 'vitest';
import { parseLengthSecondsFromWatchPageHtml } from './youtubeWatchPageDuration';

describe('parseLengthSecondsFromWatchPageHtml', () => {
  it('reads lengthSeconds from ytInitialPlayerResponse', () => {
    const html = `var ytInitialPlayerResponse = {"videoDetails":{"lengthSeconds":"1025"}};`;
    expect(parseLengthSecondsFromWatchPageHtml(html)).toBe(1025);
  });

  it('reads bare numeric lengthSeconds', () => {
    const html = `"lengthSeconds":3600,"title":"x"`;
    expect(parseLengthSecondsFromWatchPageHtml(html)).toBe(3600);
  });

  it('falls back to approxDurationMs', () => {
    const html = `"approxDurationMs":"125000"`;
    expect(parseLengthSecondsFromWatchPageHtml(html)).toBe(125);
  });

  it('returns null when no duration markers exist', () => {
    expect(parseLengthSecondsFromWatchPageHtml('<html></html>')).toBeNull();
  });
});
