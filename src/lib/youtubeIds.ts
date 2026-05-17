/** Parse an 11-char YouTube video id from watch, shorts, or youtu.be URLs (absolute or relative). */
export function parseYoutubeVideoId(urlStr: string): string | null {
  try {
    const u = new URL(urlStr, 'https://www.youtube.com');
    if (u.hostname === 'youtu.be') {
      const id = u.pathname.replace(/^\//, '').split('/')[0]?.replace(/[^a-zA-Z0-9_-]/g, '');
      return id && id.length === 11 ? id : null;
    }
    if (u.pathname.startsWith('/shorts/')) {
      const id = u.pathname.replace(/^\/shorts\//, '').split('/')[0]?.replace(/[^a-zA-Z0-9_-]/g, '');
      return id && id.length === 11 ? id : null;
    }
    const v = u.searchParams.get('v');
    return v && /^[a-zA-Z0-9_-]{11}$/.test(v) ? v : null;
  } catch {
    return null;
  }
}

function idFromAnchorHref(el: Element | null): string | null {
  if (!el) return null;
  const raw = el.getAttribute('href')?.trim();
  if (raw) {
    const id = parseYoutubeVideoId(raw);
    if (id) return id;
  }
  if (el instanceof HTMLAnchorElement && el.href) {
    return parseYoutubeVideoId(el.href);
  }
  return null;
}

/**
 * Resolves the current watch video id when the address bar is wrong or still on `/`
 * (YouTube SPA, mini-player, etc.). Order: address bar, then active mini-player link,
 * HTML5 player title link, `link[rel="canonical"]`, `og:url`, `ytd-watch-flexy[video-id]`.
 */
export function resolveYoutubeVideoIdFromPage(href?: string): string | null {
  const bar =
    href ??
    (typeof location !== 'undefined' && location.href ? location.href : '');
  const fromBar = parseYoutubeVideoId(bar);
  if (fromBar) return fromBar;

  if (typeof document === 'undefined') return null;

  try {
    const miniA = document.querySelector('ytd-miniplayer[active] [selected] a');
    const fromMini = idFromAnchorHref(miniA);
    if (fromMini) return fromMini;
  } catch {
    /* ignore */
  }

  try {
    const titleA = document.querySelector('.html5-video-player .ytp-title-link[href]');
    const fromTitle = idFromAnchorHref(titleA);
    if (fromTitle) return fromTitle;
  } catch {
    /* ignore */
  }

  try {
    const canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    const c = canonical?.href?.trim();
    if (c) {
      const id = parseYoutubeVideoId(c);
      if (id) return id;
    }
  } catch {
    /* ignore */
  }

  try {
    const og = document.querySelector('meta[property="og:url"]') as HTMLMetaElement | null;
    const ou = og?.getAttribute('content')?.trim();
    if (ou) {
      const id = parseYoutubeVideoId(ou);
      if (id) return id;
    }
  } catch {
    /* ignore */
  }

  try {
    const flexy = document.querySelector('ytd-watch-flexy') as HTMLElement | null;
    const raw = flexy?.getAttribute('video-id')?.trim();
    if (raw && /^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw;
  } catch {
    /* ignore */
  }

  return null;
}
