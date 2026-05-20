import { APP_NAME } from '../lib/branding';
import { parseYoutubeVideoId } from '../lib/youtubeIds';
import {
  FEED_MOUNT_ATTR,
  SCAN_DEBOUNCE_MS,
  fireAsyncFeed,
  getFeedTranslator,
  getLibraryVideoIds,
} from './feedCardsState';
import type { VideoMeta } from './feedCardsState';
import { openFeedPopover } from './feedCardsPopover';

let scanRafQueued = false;
let scanDebounceTimer: number | null = null;

function runFeedScanAfterFrame(): void {
  if (scanRafQueued) return;
  scanRafQueued = true;
  requestAnimationFrame(() => {
    scanRafQueued = false;
    scanNewCards();
  });
}

export function scheduleFeedRescanDebounced(): void {
  if (scanDebounceTimer !== null) clearTimeout(scanDebounceTimer);
  scanDebounceTimer = window.setTimeout(() => {
    scanDebounceTimer = null;
    runFeedScanAfterFrame();
  }, SCAN_DEBOUNCE_MS);
}

export function scheduleFeedRescanImmediate(): void {
  if (scanDebounceTimer !== null) {
    clearTimeout(scanDebounceTimer);
    scanDebounceTimer = null;
  }
  runFeedScanAfterFrame();
}

export function mutationObserverRoot(): Element {
  return document.querySelector('ytd-app') ?? document.documentElement;
}

/** Collect watch/shorts anchors including inside open shadow roots */
export function collectWatchAnchorsDeep(root: Document | ShadowRoot, seen: Set<HTMLAnchorElement>): void {
  const sel = [
    'a[href*="/watch?v="]',
    'a[href^="/watch?v"]',
    'a[href^="/shorts/"]',
    'a[href*="youtu.be/"]',
  ].join(', ');
  root.querySelectorAll(sel).forEach((el) => {
    const a = el as HTMLAnchorElement;
    if (!a.href) return;
    if (parseYoutubeVideoId(a.href)) seen.add(a);
  });
  root.querySelectorAll('*').forEach((el) => {
    if (el.shadowRoot) collectWatchAnchorsDeep(el.shadowRoot, seen);
  });
}

export function findEnclosingFeedCard(start: Node | null): HTMLElement | null {
  const TAGS = new Set([
    'YTD-RICH-ITEM-RENDERER',
    'YTD-VIDEO-RENDERER',
    'YTD-GRID-VIDEO-RENDERER',
    'YTD-COMPACT-VIDEO-RENDERER',
    'YTD-CHANNEL-VIDEO-RENDERER',
    'YTD-PLAYLIST-PANEL-VIDEO-RENDERER',
  ]);
  let node: Node | null = start;
  while (node) {
    if (node instanceof Element && TAGS.has(node.tagName)) {
      return node as HTMLElement;
    }
    const parent = node.parentNode;
    if (!parent) break;
    if (parent instanceof ShadowRoot) {
      node = parent.host;
    } else {
      node = parent;
    }
  }
  return null;
}

export function querySelectorDeep(root: Element | ShadowRoot, selector: string): HTMLElement | null {
  const direct = root.querySelector(selector);
  if (direct) return direct as HTMLElement;
  for (const el of root.querySelectorAll('*')) {
    if (el.shadowRoot) {
      const inner = querySelectorDeep(el.shadowRoot, selector);
      if (inner) return inner;
    }
  }
  return null;
}

export function extractTitleChannel(
  card: HTMLElement,
  watchLink?: HTMLAnchorElement | null,
): { title: string; channel: string } {
  const titleEl =
    querySelectorDeep(card, 'yt-formatted-string#video-title') ??
    querySelectorDeep(card, '#video-title') ??
    querySelectorDeep(card, 'a#video-title') ??
    querySelectorDeep(card, '[id="video-title"]') ??
    querySelectorDeep(card, 'h3 yt-formatted-string') ??
    card.querySelector('#video-title') ??
    card.querySelector('a#video-title') ??
    card.querySelector('yt-formatted-string#video-title');
  let title = titleEl?.textContent?.trim() || 'Unknown title';

  if ((title === 'Unknown title' || !title.length) && watchLink) {
    const aria = watchLink.getAttribute('aria-label');
    if (aria?.trim()) {
      title = aria.trim().split('\n')[0].trim();
    }
  }

  const channelEl =
    querySelectorDeep(card, 'ytd-channel-name yt-formatted-string a') ??
    querySelectorDeep(card, 'ytd-channel-name a') ??
    querySelectorDeep(card, 'ytd-channel-name yt-formatted-string') ??
    querySelectorDeep(card, '#channel-info ytd-channel-name a') ??
    querySelectorDeep(card, 'ytd-video-meta-block ytd-channel-name a') ??
    querySelectorDeep(card, 'ytd-video-meta-block #channel-name a') ??
    card.querySelector('ytd-channel-name a');
  const channel = channelEl?.textContent?.trim() || 'Unknown channel';

  return { title, channel };
}

export function findPrimaryWatchLink(card: HTMLElement): HTMLAnchorElement | null {
  const thumb =
    (querySelectorDeep(card, 'a#thumbnail') as HTMLAnchorElement | null) ??
    (querySelectorDeep(card, 'ytd-thumbnail a[href*="/watch"]') as HTMLAnchorElement | null);
  if (thumb?.href) return thumb;

  const surfaceWatch =
    (card.querySelector('a#video-title[href*="watch?v="]') as HTMLAnchorElement | null) ??
    (card.querySelector('a[href*="watch?v="]') as HTMLAnchorElement | null) ??
    (card.querySelector('a.yt-simple-endpoint[href*="watch?v="]') as HTMLAnchorElement | null);
  if (surfaceWatch?.href) return surfaceWatch;

  const anyWatch = querySelectorDeep(card, 'a[href*="/watch?v="]') as HTMLAnchorElement | null;
  if (anyWatch?.href) return anyWatch;

  return null;
}

export function buildMetaFromCardAndLink(card: HTMLElement, link: HTMLAnchorElement): VideoMeta | null {
  const videoId = parseYoutubeVideoId(link.href);
  if (!videoId) return null;
  const tc = extractTitleChannel(card, link);
  return { videoId, ...tc };
}

export function extractCardMeta(card: HTMLElement): VideoMeta | null {
  const thumbLink = findPrimaryWatchLink(card);
  if (!thumbLink?.href) return null;
  return buildMetaFromCardAndLink(card, thumbLink);
}

export function shouldSkipCard(card: HTMLElement): boolean {
  if (card.hasAttribute('is-ad')) return true;
  if (card.closest('ytd-display-ad-renderer, ytd-promoted-sparkles-web-renderer')) return true;
  return false;
}

function findThumbnailHost(card: HTMLElement): HTMLElement | null {
  const ytThumb =
    (querySelectorDeep(card, 'ytd-thumbnail') as HTMLElement | null) ??
    (card.querySelector('ytd-thumbnail') as HTMLElement | null);
  if (ytThumb) return ytThumb;

  const thumbBox = querySelectorDeep(card, '#thumbnail');
  if (thumbBox) return thumbBox as HTMLElement;

  return querySelectorDeep(card, 'ytd-rich-grid-media') ?? querySelectorDeep(card, 'ytd-playlist-thumbnail');
}

export function updateStripAppearance(sr: ShadowRoot, videoId: string): void {
  const t = getFeedTranslator();
  const saved = getLibraryVideoIds().has(videoId);
  const btn = sr.querySelector('[part="trigger"]') as HTMLButtonElement | null;
  const dot = sr.querySelector('[part="dot"]') as HTMLElement | null;
  const label = sr.querySelector('[part="label"]') as HTMLElement | null;
  if (!btn || !dot || !label) return;
  btn.classList.toggle('saved', saved);
  dot.classList.toggle('unsaved', !saved);
  label.textContent = saved ? t('feed.inLibraryChip') : APP_NAME;
  btn.title = saved ? t('feed.savedUpdateTitle') : t('feed.savedSaveTitle');
}

export function scanExistingHoverStrips(): void {
  document.querySelectorAll(`[data-jp-feed-shadow="1"]`).forEach((host) => {
    const id = host.getAttribute('data-jp-video-id');
    const sr = host.shadowRoot;
    if (!id || !sr) return;
    updateStripAppearance(sr, id);
  });
}

function bindThumbHover(thumbHost: HTMLElement, sr: ShadowRoot): void {
  const strip = sr.querySelector('[part="strip"]') as HTMLElement | null;
  if (!strip) return;

  const show = (): void => {
    strip.classList.add('visible');
  };
  const hide = (): void => {
    strip.classList.remove('visible');
  };

  thumbHost.addEventListener('mouseenter', show);
  thumbHost.addEventListener('mouseleave', hide);
}

function mountHoverStrip(card: HTMLElement, meta: VideoMeta, thumbLink: HTMLAnchorElement | null): void {
  if (card.hasAttribute(FEED_MOUNT_ATTR)) return;

  const thumbHost =
    (thumbLink?.closest('ytd-thumbnail') as HTMLElement | null) ?? findThumbnailHost(card);
  if (!thumbHost) return;

  const thumbStyle = getComputedStyle(thumbHost);
  if (thumbStyle.position === 'static') {
    thumbHost.style.position = 'relative';
  }

  const anchor = document.createElement('div');
  anchor.className = 'jp-practice-hover-anchor';
  anchor.setAttribute('data-jp-feed-shadow', '1');
  anchor.setAttribute('data-jp-video-id', meta.videoId);
  Object.assign(anchor.style, {
    position: 'absolute',
    inset: '0',
    zIndex: '12',
    pointerEvents: 'none',
  });

  const sr = anchor.attachShadow({ mode: 'open' });
  sr.innerHTML = `
    <style>
      :host { display: block; }
      [part="strip"] {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        padding: 12px 10px 10px;
        background: linear-gradient(to top, rgba(6, 8, 14, 0.94) 0%, rgba(6, 8, 14, 0.5) 52%, transparent 100%);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        opacity: 0;
        transition: opacity 0.22s ease;
        pointer-events: none;
      }
      [part="strip"].visible {
        opacity: 1;
        pointer-events: auto;
      }
      [part="trigger"] {
        all: unset;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        width: 100%;
        box-sizing: border-box;
        padding: 9px 12px;
        border-radius: 10px;
        cursor: pointer;
        font-family: system-ui, "Segoe UI", Roboto, sans-serif;
        font-size: 11px;
        font-weight: 650;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.96);
        background: rgba(26, 102, 255, 0.28);
        border: 1px solid rgba(255, 255, 255, 0.22);
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.42);
        transition: transform 0.14s ease, background 0.14s ease, border-color 0.14s ease;
      }
      [part="trigger"]:hover {
        transform: translateY(-1px);
        background: rgba(26, 102, 255, 0.42);
        border-color: rgba(255, 255, 255, 0.35);
      }
      [part="trigger"].saved {
        background: rgba(38, 120, 75, 0.28);
        border-color: rgba(130, 240, 170, 0.28);
      }
      [part="trigger"].saved:hover {
        background: rgba(38, 120, 75, 0.4);
      }
      [part="dot"] {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        flex-shrink: 0;
        background: rgba(255, 255, 255, 0.95);
        box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.2);
      }
      [part="dot"]:not(.unsaved) {
        background: #7dffb0;
        box-shadow: 0 0 12px rgba(125, 255, 176, 0.55);
      }
    </style>
    <div part="strip" class="">
      <button type="button" part="trigger">
        <span part="dot" class="unsaved"></span>
        <span part="label">${APP_NAME}</span>
      </button>
    </div>
  `;

  const trigger = sr.querySelector('[part="trigger"]') as HTMLButtonElement;
  trigger.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    fireAsyncFeed(openFeedPopover(meta, trigger.getBoundingClientRect()));
  });

  thumbHost.appendChild(anchor);
  bindThumbHover(thumbHost, sr);

  card.setAttribute(FEED_MOUNT_ATTR, '1');
  card.setAttribute('data-video-id', meta.videoId);
  updateStripAppearance(sr, meta.videoId);
}

function mountCard(card: HTMLElement): void {
  if (card.hasAttribute(FEED_MOUNT_ATTR)) return;
  if (shouldSkipCard(card)) {
    card.setAttribute(FEED_MOUNT_ATTR, 'skip');
    return;
  }

  const meta = extractCardMeta(card);
  if (!meta) return;

  const thumbLink = findPrimaryWatchLink(card);
  mountHoverStrip(card, meta, thumbLink);
}

function scanAnchorsOntoCards(): void {
  const seen = new Set<HTMLAnchorElement>();
  collectWatchAnchorsDeep(document, seen);

  for (const link of seen) {
    const card = findEnclosingFeedCard(link);
    if (!card || card.hasAttribute(FEED_MOUNT_ATTR)) continue;
    if (shouldSkipCard(card)) {
      card.setAttribute(FEED_MOUNT_ATTR, 'skip');
      continue;
    }
    const meta = buildMetaFromCardAndLink(card, link);
    if (!meta) continue;
    mountHoverStrip(card, meta, link);
  }
}

export function scanNewCards(): void {
  scanAnchorsOntoCards();

  const selectors = [
    'ytd-rich-item-renderer',
    'ytd-video-renderer',
    'ytd-compact-video-renderer',
    'ytd-grid-video-renderer',
  ];
  for (const sel of selectors) {
    document.querySelectorAll(sel).forEach((el) => {
      mountCard(el as HTMLElement);
    });
  }
}
