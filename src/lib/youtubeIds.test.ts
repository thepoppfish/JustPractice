/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { parseYoutubeVideoId, resolveYoutubeVideoIdFromPage } from './youtubeIds';

describe('parseYoutubeVideoId', () => {
  const validId = 'dQw4w9WgXcQ';

  it('parses standard watch URLs', () => {
    expect(parseYoutubeVideoId(`https://www.youtube.com/watch?v=${validId}`)).toBe(validId);
  });

  it('parses relative watch URLs', () => {
    expect(parseYoutubeVideoId(`/watch?v=${validId}`)).toBe(validId);
  });

  it('parses shorts and youtu.be with strict 11-char id', () => {
    expect(parseYoutubeVideoId(`https://www.youtube.com/shorts/${validId}`)).toBe(validId);
    expect(parseYoutubeVideoId(`https://youtu.be/${validId}`)).toBe(validId);
    expect(parseYoutubeVideoId('https://www.youtube.com/shorts/ab')).toBeNull();
    expect(parseYoutubeVideoId('https://www.youtube.com/shorts/abcdefghi')).toBeNull(); // 9 chars
  });

  it('parses mobile host watch param', () => {
    expect(parseYoutubeVideoId(`https://m.youtube.com/watch?v=${validId}`)).toBe(validId);
  });

  it('rejects missing or malformed v param', () => {
    expect(parseYoutubeVideoId('https://www.youtube.com/watch')).toBeNull();
    expect(parseYoutubeVideoId('https://www.youtube.com/watch?v=too-short')).toBeNull();
    expect(parseYoutubeVideoId('not a url')).toBeNull();
  });
});

describe('resolveYoutubeVideoIdFromPage', () => {
  const validId = 'dQw4w9WgXcQ';
  const otherId = 'aaaaaaaaaaa';

  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  it('uses explicit href like parse when no document DOM needed', () => {
    expect(resolveYoutubeVideoIdFromPage(`https://www.youtube.com/watch?v=${validId}`)).toBe(validId);
    expect(resolveYoutubeVideoIdFromPage('https://www.youtube.com/')).toBeNull();
  });

  it('reads active mini-player selected link when URL has no v', () => {
    document.body.innerHTML = `
      <ytd-miniplayer active>
        <div selected><a href="/watch?v=${validId}">title</a></div>
      </ytd-miniplayer>
    `;
    expect(resolveYoutubeVideoIdFromPage('https://www.youtube.com/')).toBe(validId);
  });

  it('reads HTML5 player title link when URL has no v', () => {
    document.body.innerHTML = `
      <div class="html5-video-player">
        <a class="ytp-title-link" href="https://www.youtube.com/watch?v=${validId}">x</a>
      </div>
    `;
    expect(resolveYoutubeVideoIdFromPage('https://www.youtube.com/')).toBe(validId);
  });

  it('prefers mini-player over ytd-watch-flexy when bar has no v', () => {
    document.body.innerHTML = `
      <ytd-watch-flexy video-id="${otherId}"></ytd-watch-flexy>
      <ytd-miniplayer active>
        <span selected><a href="/watch?v=${validId}">mini</a></span>
      </ytd-miniplayer>
    `;
    expect(resolveYoutubeVideoIdFromPage('https://www.youtube.com/')).toBe(validId);
  });

  it('explicit watch href still wins over conflicting DOM', () => {
    document.body.innerHTML = `
      <ytd-miniplayer active>
        <span selected><a href="/watch?v=${validId}">mini</a></span>
      </ytd-miniplayer>
    `;
    expect(resolveYoutubeVideoIdFromPage(`https://www.youtube.com/watch?v=${otherId}`)).toBe(otherId);
  });
});
