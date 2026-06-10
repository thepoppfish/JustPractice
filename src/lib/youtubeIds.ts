/** Standard watch page only (`/watch?v=…`), not Shorts / live / embed. */
export function isYoutubeClassicWatchPath(pathname: string): boolean {
  return pathname === '/watch' || pathname.startsWith('/watch/');
}

export function isYoutubeClassicWatchPage(href?: string): boolean {
  const bar =
    href ?? (typeof location !== 'undefined' && location.href ? location.href : '');
  try {
    return isYoutubeClassicWatchPath(new URL(bar, 'https://www.youtube.com').pathname);
  } catch {
    return false;
  }
}

/** Watch / Shorts / live / embed surfaces where the panel should stay visible while the id resolves. */
export function isYoutubeWatchLikePath(pathname: string): boolean {
  return (
    pathname.startsWith('/watch') ||
    pathname === '/shorts' ||
    pathname.startsWith('/shorts/') ||
    pathname.startsWith('/live/') ||
    pathname.startsWith('/embed/')
  );
}

export function isYoutubeWatchLikePage(href?: string): boolean {
  const bar =
    href ?? (typeof location !== 'undefined' && location.href ? location.href : '');
  try {
    return isYoutubeWatchLikePath(new URL(bar, 'https://www.youtube.com').pathname);
  } catch {
    return false;
  }
}

/**
 * Library actions (save / level / complete) belong on a full watch or Shorts player —
 * not on home browse, subscriptions, or the mini-player while the feed is visible.
 */
export function shouldShowWatchPanelLibraryChrome(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const path = new URL(
      typeof location !== 'undefined' && location.href ? location.href : 'https://www.youtube.com/',
      'https://www.youtube.com',
    ).pathname;
    if (path === '/shorts' || path.startsWith('/shorts/')) return true;
    if (!isYoutubeClassicWatchPath(path)) return false;
    return document.querySelector('ytd-watch-flexy') != null;
  } catch {
    return false;
  }
}

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
function readWatchFlexyVideoId(): string | null {
  try {
    const flexy = document.querySelector('ytd-watch-flexy') as HTMLElement | null;
    const raw = flexy?.getAttribute('video-id')?.trim();
    if (raw && /^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw;
  } catch {
    /* ignore */
  }
  return null;
}

export function resolveYoutubeVideoIdFromPage(href?: string): string | null {
  const bar =
    href ??
    (typeof location !== 'undefined' && location.href ? location.href : '');
  const fromBar = parseYoutubeVideoId(bar);
  if (fromBar) return fromBar;

  if (typeof document === 'undefined') return null;

  const watchLike = isYoutubeWatchLikePage(bar);

  if (watchLike) {
    const fromFlexy = readWatchFlexyVideoId();
    if (fromFlexy) return fromFlexy;
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

  if (!watchLike) {
    try {
      const miniA = document.querySelector('ytd-miniplayer[active] [selected] a');
      const fromMini = idFromAnchorHref(miniA);
      if (fromMini) return fromMini;
    } catch {
      /* ignore */
    }
    const fromFlexy = readWatchFlexyVideoId();
    if (fromFlexy) return fromFlexy;
  } else {
    try {
      const miniA = document.querySelector('ytd-miniplayer[active] [selected] a');
      const fromMini = idFromAnchorHref(miniA);
      if (fromMini) return fromMini;
    } catch {
      /* ignore */
    }
  }

  return null;
}
