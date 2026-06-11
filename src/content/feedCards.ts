import { parseYoutubeVideoId } from '../lib/youtubeIds';

export type VideoMeta = { videoId: string; title: string; channel: string };

const FEED_CARD_TAGS = new Set([
  'YTD-RICH-ITEM-RENDERER',
  'YTD-VIDEO-RENDERER',
  'YTD-GRID-VIDEO-RENDERER',
  'YTD-COMPACT-VIDEO-RENDERER',
  'YTD-CHANNEL-VIDEO-RENDERER',
  'YTD-PLAYLIST-PANEL-VIDEO-RENDERER',
]);

function findEnclosingFeedCard(start: Node | null): HTMLElement | null {
  let node: Node | null = start;
  while (node) {
    if (node instanceof Element && FEED_CARD_TAGS.has(node.tagName)) {
      return node as HTMLElement;
    }
    const parent = node.parentNode;
    if (!parent) break;
    node = parent instanceof ShadowRoot ? parent.host : parent;
  }
  return null;
}

function querySelectorDeep(root: Element | ShadowRoot, selector: string): HTMLElement | null {
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

function extractTitleChannel(
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

function findPrimaryWatchLink(card: HTMLElement): HTMLAnchorElement | null {
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

function extractCardMeta(card: HTMLElement): VideoMeta | null {
  const thumbLink = findPrimaryWatchLink(card);
  if (!thumbLink?.href) return null;
  const videoId = parseYoutubeVideoId(thumbLink.href);
  if (!videoId) return null;
  return { videoId, ...extractTitleChannel(card, thumbLink) };
}

function shouldSkipCard(card: HTMLElement): boolean {
  if (card.hasAttribute('is-ad')) return true;
  if (card.closest('ytd-display-ad-renderer, ytd-promoted-sparkles-web-renderer')) return true;
  return false;
}

/**
 * Resolve a feed/grid video from a pointer event target (home, subscriptions, search results, etc.).
 * Used by the floating watch panel when the URL has no watch/shorts id.
 */
export function pickFeedCardFromInteractionTarget(target: EventTarget | null): VideoMeta | null {
  if (!(target instanceof Node)) return null;
  const card = findEnclosingFeedCard(target);
  if (!card) return null;
  if (shouldSkipCard(card)) return null;
  return extractCardMeta(card);
}
