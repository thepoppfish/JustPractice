/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { syncWatchPanelVideoLibraryChrome } from './youtubePanelUi';

function mountPanelShadow(): ShadowRoot {
  const host = document.createElement('div');
  const sr = host.attachShadow({ mode: 'open' });
  sr.innerHTML = `
    <div class="wrap">
      <div part="title">Video title</div>
      <div part="status">Not saved</div>
      <div part="save-row"><button part="add"></button></div>
      <div part="complete-row"><button part="complete-btn"></button></div>
      <div class="level-controls"><select part="difficulty"></select></div>
      <div part="hint">hint</div>
      <div part="library-banner">banner</div>
      <div part="complete-prompt"></div>
    </div>
  `;
  document.body.appendChild(host);
  return sr;
}

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

describe('syncWatchPanelVideoLibraryChrome', () => {
  beforeEach(() => {
    mockVisibleLayout();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it('hides library chrome on the YouTube homepage', () => {
    vi.stubGlobal('location', {
      href: 'https://www.youtube.com/',
      pathname: '/',
      hostname: 'www.youtube.com',
    });
    document.body.innerHTML = `
      <ytd-miniplayer active>
        <div selected><a href="/watch?v=dQw4w9WgXcQ">title</a></div>
      </ytd-miniplayer>
    `;
    const sr = mountPanelShadow();
    syncWatchPanelVideoLibraryChrome({ shadowRoot: sr, readTitle: () => 'A title' });

    expect(sr.querySelector('.wrap')?.dataset.jpLibraryChrome).toBe('0');
    expect(sr.querySelector('[part="save-row"]')?.hidden).toBe(true);
    expect(sr.querySelector('[part="complete-row"]')?.hidden).toBe(true);
    expect(sr.querySelector('.level-controls')?.hidden).toBe(true);
    expect(sr.querySelector('[part="status"]')?.hidden).toBe(true);
    expect(sr.querySelector('[part="hint"]')?.hidden).toBe(true);
    expect(sr.querySelector('[part="library-banner"]')?.hidden).toBe(true);
    expect(sr.querySelector('[part="complete-prompt"]')?.hidden).toBe(true);
    expect(sr.querySelector('[part="title"]')?.hidden).toBe(true);
  });

  it('hides library chrome when /watch URL still has the browse feed (mini player)', () => {
    vi.stubGlobal('location', {
      href: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      pathname: '/watch',
      hostname: 'www.youtube.com',
    });
    document.body.innerHTML = `
      <ytd-browse page-subtype="home"></ytd-browse>
      <ytd-watch-flexy video-id="dQw4w9WgXcQ"></ytd-watch-flexy>
    `;
    const sr = mountPanelShadow();
    syncWatchPanelVideoLibraryChrome({ shadowRoot: sr, readTitle: () => 'Watch title' });

    expect(sr.querySelector('.wrap')?.dataset.jpLibraryChrome).toBe('0');
    expect(sr.querySelector('[part="save-row"]')?.hidden).toBe(true);
    expect(sr.querySelector('[part="hint"]')?.hidden).toBe(true);
  });

  it('shows library chrome on dedicated watch pages', () => {
    vi.stubGlobal('location', {
      href: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      pathname: '/watch',
      hostname: 'www.youtube.com',
    });
    document.body.innerHTML = '<ytd-watch-flexy video-id="dQw4w9WgXcQ"></ytd-watch-flexy>';
    const sr = mountPanelShadow();

    syncWatchPanelVideoLibraryChrome({ shadowRoot: sr, readTitle: () => 'Watch title' });

    expect(sr.querySelector('.wrap')?.dataset.jpLibraryChrome).toBe('1');
    expect(sr.querySelector('[part="save-row"]')?.hidden).toBe(false);
    expect(sr.querySelector('[part="complete-row"]')?.hidden).toBe(false);
    expect(sr.querySelector('.level-controls')?.hidden).toBe(false);
    expect(sr.querySelector('[part="status"]')?.hidden).toBe(false);
    expect(sr.querySelector('[part="hint"]')?.hidden).toBe(false);
    expect(sr.querySelector('[part="title"]')?.hidden).toBe(false);
    expect(sr.querySelector('[part="title"]')?.textContent).toBe('Watch title');
  });
});
