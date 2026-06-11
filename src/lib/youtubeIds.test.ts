/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isYoutubeClassicWatchPage,
  isYoutubeClassicWatchPath,
  isYoutubeWatchLikePage,
  isYoutubeWatchLikePath,
  parseYoutubeVideoId,
  resolveYoutubeVideoIdFromPage,
  shouldShowWatchPanelLibraryChrome,
} from './youtubeIds';

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

describe('isYoutubeClassicWatchPath', () => {
  it('matches /watch only, not shorts or embed', () => {
    expect(isYoutubeClassicWatchPath('/watch')).toBe(true);
    expect(isYoutubeClassicWatchPath('/watch/')).toBe(true);
    expect(isYoutubeClassicWatchPath('/shorts/abcdefghijk')).toBe(false);
    expect(isYoutubeClassicWatchPath('/embed/abc')).toBe(false);
    expect(isYoutubeClassicWatchPath('/')).toBe(false);
  });
});

describe('isYoutubeClassicWatchPage', () => {
  it('uses href when provided', () => {
    expect(isYoutubeClassicWatchPage('https://www.youtube.com/watch?v=x')).toBe(true);
    expect(isYoutubeClassicWatchPage('https://www.youtube.com/shorts/x')).toBe(false);
  });
});

describe('isYoutubeWatchLikePath', () => {
  it('matches watch, shorts, live, and embed paths', () => {
    expect(isYoutubeWatchLikePath('/watch')).toBe(true);
    expect(isYoutubeWatchLikePath('/watch?v=abc')).toBe(true);
    expect(isYoutubeWatchLikePath('/shorts/abcdefghijk')).toBe(true);
    expect(isYoutubeWatchLikePath('/shorts')).toBe(true);
    expect(isYoutubeWatchLikePath('/live/abc')).toBe(true);
    expect(isYoutubeWatchLikePath('/embed/abc')).toBe(true);
    expect(isYoutubeWatchLikePath('/')).toBe(false);
    expect(isYoutubeWatchLikePath('/feed/subscriptions')).toBe(false);
  });
});

describe('isYoutubeWatchLikePage', () => {
  it('uses href when provided', () => {
    expect(isYoutubeWatchLikePage('https://www.youtube.com/watch?v=x')).toBe(true);
    expect(isYoutubeWatchLikePage('https://www.youtube.com/')).toBe(false);
  });
});

function mockVisibleLayout(): void {
  Element.prototype.getBoundingClientRect = vi.fn(() => ({
    width: 400,
    height: 300,
    top: 0,
    left: 0,
    right: 400,
    bottom: 300,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  })) as typeof Element.prototype.getBoundingClientRect;
}

describe('shouldShowWatchPanelLibraryChrome', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    mockVisibleLayout();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is false on home browse even when a mini-player video is present', () => {
    vi.stubGlobal('location', {
      href: 'https://www.youtube.com/',
      pathname: '/',
      hostname: 'www.youtube.com',
    });
    document.body.innerHTML = `
      <ytd-browse page-subtype="home"></ytd-browse>
      <ytd-miniplayer active>
        <div selected><a href="/watch?v=dQw4w9WgXcQ">title</a></div>
      </ytd-miniplayer>
    `;
    expect(shouldShowWatchPanelLibraryChrome(() => 'dQw4w9WgXcQ')).toBe(false);
  });

  it('is false on subscriptions when no video id is resolved', () => {
    vi.stubGlobal('location', {
      href: 'https://www.youtube.com/feed/subscriptions',
      pathname: '/feed/subscriptions',
      hostname: 'www.youtube.com',
    });
    expect(shouldShowWatchPanelLibraryChrome(() => null)).toBe(false);
  });

  it('is false on /watch without the full watch layout', () => {
    vi.stubGlobal('location', { href: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });
    expect(shouldShowWatchPanelLibraryChrome()).toBe(false);
  });

  it('is false on /watch when the home browse shell is still visible (mini player)', () => {
    vi.stubGlobal('location', { href: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });
    document.body.innerHTML = `
      <ytd-browse page-subtype="home"></ytd-browse>
      <ytd-watch-flexy video-id="dQw4w9WgXcQ"></ytd-watch-flexy>
      <ytd-miniplayer active></ytd-miniplayer>
    `;
    expect(shouldShowWatchPanelLibraryChrome()).toBe(false);
  });

  it('is false on the Shorts feed', () => {
    vi.stubGlobal('location', { href: 'https://www.youtube.com/shorts' });
    expect(shouldShowWatchPanelLibraryChrome()).toBe(false);
  });

  it('is true on /watch with ytd-watch-flexy', () => {
    vi.stubGlobal('location', { href: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });
    document.body.innerHTML = '<ytd-watch-flexy video-id="dQw4w9WgXcQ"></ytd-watch-flexy>';
    expect(shouldShowWatchPanelLibraryChrome()).toBe(true);
  });

  it('is true on Shorts', () => {
    vi.stubGlobal('location', { href: 'https://www.youtube.com/shorts/dQw4w9WgXcQ' });
    expect(shouldShowWatchPanelLibraryChrome()).toBe(true);
  });

  it('is false on home when only ytd-rich-grid-renderer is present (no ytd-browse)', () => {
    vi.stubGlobal('location', {
      href: 'https://www.youtube.com/',
      pathname: '/',
      hostname: 'www.youtube.com',
    });
    document.body.innerHTML = '<ytd-rich-grid-renderer></ytd-rich-grid-renderer>';
    expect(shouldShowWatchPanelLibraryChrome(() => null)).toBe(false);
  });

  it('is false when browse grid is visible even if ytd-watch-flexy exists in DOM but not laid out', () => {
    vi.stubGlobal('location', {
      href: 'https://www.youtube.com/',
      pathname: '/',
      hostname: 'www.youtube.com',
    });
    document.body.innerHTML = `
      <ytd-rich-grid-renderer></ytd-rich-grid-renderer>
      <ytd-watch-flexy hidden video-id="dQw4w9WgXcQ"></ytd-watch-flexy>
    `;
    expect(shouldShowWatchPanelLibraryChrome(() => 'dQw4w9WgXcQ')).toBe(false);
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

  it('prefers mini-player over ytd-watch-flexy on home when bar has no v', () => {
    document.body.innerHTML = `
      <ytd-watch-flexy video-id="${otherId}"></ytd-watch-flexy>
      <ytd-miniplayer active>
        <span selected><a href="/watch?v=${validId}">mini</a></span>
      </ytd-miniplayer>
    `;
    expect(resolveYoutubeVideoIdFromPage('https://www.youtube.com/')).toBe(validId);
  });

  it('prefers ytd-watch-flexy over mini-player on watch when bar has no v', () => {
    document.body.innerHTML = `
      <ytd-watch-flexy video-id="${otherId}"></ytd-watch-flexy>
      <ytd-miniplayer active>
        <span selected><a href="/watch?v=${validId}">mini</a></span>
      </ytd-miniplayer>
    `;
    expect(resolveYoutubeVideoIdFromPage('https://www.youtube.com/watch')).toBe(otherId);
  });

  it('reads ytd-watch-flexy video-id when bar has no v', () => {
    document.body.innerHTML = `<ytd-watch-flexy video-id="${validId}"></ytd-watch-flexy>`;
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
