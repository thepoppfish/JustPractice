import { APP_NAME } from '../lib/branding';
import { escapeAttr, escapeHtml } from '../lib/htmlEscape';
import { createTranslator, resolveLocale, type Translator } from '../i18n';
import { MSG } from '../lib/messages';
import type { ExtensionMessage, ExtensionResponse, GetStateResponse } from '../lib/messages';
import {
  ensureSettingsShape,
  STORAGE_KEY,
  DEFAULT_CUSTOM_LEVELS,
  defaultSettings,
  type LevelFramework,
  type LevelTag,
  type PersistedData,
  type UiLocale,
} from '../lib/storage';
import { tagsForFramework, isLegacyLevelTag } from '../lib/levelTags';
import { parseYoutubeVideoId } from '../lib/youtubeIds';
import { isBenignExtensionMessagingFailure, messagingFailureText } from '../lib/extensionMessaging';

export type VideoMeta = { videoId: string; title: string; channel: string };

let libraryVideoIds = new Set<string>();
let feedTranslator: Translator = createTranslator('en');
let feedLevelFramework: LevelFramework = 'jlpt';
let feedCustomLevels: string[] = [...DEFAULT_CUSTOM_LEVELS];
let feedUiLocale: UiLocale | undefined = 'auto';
let popoverHost: HTMLElement | null = null;
let popoverShadow: ShadowRoot | null = null;
let activeAnchor: HTMLElement | null = null;
let activeAnchorRect: DOMRect | null = null;
let activeVideoId: string | null = null;
let outsideCloseListener: ((e: MouseEvent) => void) | null = null;

/** Prevent double-mount / skip dead cards once evaluated */
const FEED_MOUNT_ATTR = 'data-jp-feed-mount' as const;

/** Don’t churn the main thread during heavy feed DOM updates — wait briefly for idle */
const SCAN_DEBOUNCE_MS = 120;

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

function scheduleFeedRescanDebounced(): void {
  if (scanDebounceTimer !== null) clearTimeout(scanDebounceTimer);
  scanDebounceTimer = window.setTimeout(() => {
    scanDebounceTimer = null;
    runFeedScanAfterFrame();
  }, SCAN_DEBOUNCE_MS);
}

/** SPA navigation / yt events — flush pending debounced work and scan on the next frame */
function scheduleFeedRescanImmediate(): void {
  if (scanDebounceTimer !== null) {
    clearTimeout(scanDebounceTimer);
    scanDebounceTimer = null;
  }
  runFeedScanAfterFrame();
}

function mutationObserverRoot(): Element {
  return document.querySelector('ytd-app') ?? document.documentElement;
}

/** Collect watch/shorts anchors including inside open shadow roots */
function collectWatchAnchorsDeep(root: Document | ShadowRoot, seen: Set<HTMLAnchorElement>): void {
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

function findEnclosingFeedCard(start: Node | null): HTMLElement | null {
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

function extractTitleChannel(card: HTMLElement, watchLink?: HTMLAnchorElement | null): { title: string; channel: string } {
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

function buildMetaFromCardAndLink(card: HTMLElement, link: HTMLAnchorElement): VideoMeta | null {
  const videoId = parseYoutubeVideoId(link.href);
  if (!videoId) return null;
  const tc = extractTitleChannel(card, link);
  return { videoId, ...tc };
}

function extractCardMeta(card: HTMLElement): VideoMeta | null {
  const thumbLink = findPrimaryWatchLink(card);
  if (!thumbLink?.href) return null;
  return buildMetaFromCardAndLink(card, thumbLink);
}

function shouldSkipCard(card: HTMLElement): boolean {
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

async function sendMsg<T = unknown>(msg: ExtensionMessage): Promise<T> {
  try {
    return (await chrome.runtime.sendMessage(msg)) as T;
  } catch (e) {
    if (isBenignExtensionMessagingFailure(e)) {
      console.warn('[JustPractice:feed] Extension messaging unavailable; refresh this YouTube tab.', messagingFailureText(e));
      return { ok: false, error: messagingFailureText(e) } as T;
    }
    throw e;
  }
}

function fireAsyncFeed(p: Promise<unknown>): void {
  void p.catch((err) => {
    if (isBenignExtensionMessagingFailure(err)) return;
    console.warn('[JustPractice:feed] async handler failed', err);
  });
}

async function refreshLibraryIds(): Promise<void> {
  try {
    const res = (await sendMsg<GetStateResponse>({ type: MSG.GET_STATE })) as GetStateResponse;
    if (res?.ok && 'data' in res) {
      libraryVideoIds = new Set(res.data.library.map((x) => x.videoId));
      const st = ensureSettingsShape({ ...defaultSettings(), ...res.data.settings });
      feedUiLocale = st.uiLocale;
      feedLevelFramework = st.levelFramework ?? 'jlpt';
      feedCustomLevels = st.customLevels ?? [...DEFAULT_CUSTOM_LEVELS];
      feedTranslator = createTranslator(resolveLocale(feedUiLocale));
    }
  } catch {
    /* ignore */
  }
}

function syncLibraryFromStoragePayload(payload: unknown): void {
  const data = payload as PersistedData | undefined;
  if (data?.library) {
    libraryVideoIds = new Set(data.library.map((x) => x.videoId));
  }
  if (data?.settings && typeof data.settings === 'object') {
    const st = ensureSettingsShape({ ...defaultSettings(), ...data.settings });
    feedUiLocale = st.uiLocale;
    feedLevelFramework = st.levelFramework ?? 'jlpt';
    feedCustomLevels = st.customLevels ?? [...DEFAULT_CUSTOM_LEVELS];
    feedTranslator = createTranslator(resolveLocale(feedUiLocale));
  }
  if (data?.library || data?.settings) {
    scanExistingHoverStrips();
  }
}

function updateStripAppearance(sr: ShadowRoot, videoId: string): void {
  const t = feedTranslator;
  const saved = libraryVideoIds.has(videoId);
  const btn = sr.querySelector('[part="trigger"]') as HTMLButtonElement | null;
  const dot = sr.querySelector('[part="dot"]') as HTMLElement | null;
  const label = sr.querySelector('[part="label"]') as HTMLElement | null;
  if (!btn || !dot || !label) return;
  btn.classList.toggle('saved', saved);
  dot.classList.toggle('unsaved', !saved);
  label.textContent = saved ? t('feed.inLibraryChip') : APP_NAME;
  btn.title = saved ? t('feed.savedUpdateTitle') : t('feed.savedSaveTitle');
}

function scanExistingHoverStrips(): void {
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
    fireAsyncFeed(openPopover(meta, trigger.getBoundingClientRect()));
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

function scanNewCards(): void {
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

function closePopover(): void {
  if (outsideCloseListener) {
    document.removeEventListener('click', outsideCloseListener, true);
    outsideCloseListener = null;
  }
  document.removeEventListener('keydown', onKeyDown, true);
  if (popoverHost) {
    popoverHost.style.display = 'none';
  }
  activeAnchor = null;
  activeAnchorRect = null;
  activeVideoId = null;
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape') closePopover();
}

function feedLevelSelectOptionsHtml(
  fw: LevelFramework,
  difficulty: LevelTag | null,
  t: Translator,
  customLevels: readonly string[],
): string {
  const parts: string[] = [`<option value="">${escapeHtml(t('common.unrated'))}</option>`];
  for (const lv of tagsForFramework(fw, customLevels)) {
    const sel = difficulty === lv ? ' selected' : '';
    parts.push(`<option value="${escapeAttr(lv)}"${sel}>${escapeHtml(lv)}</option>`);
  }
  if (difficulty !== null && isLegacyLevelTag(difficulty, fw, customLevels)) {
    parts.push(
      `<option value="${escapeAttr(difficulty)}" selected>${escapeHtml(difficulty)} (${escapeHtml(t('common.legacyShort'))})</option>`,
    );
  }
  return parts.join('');
}

async function openPopover(meta: VideoMeta, anchorRect: DOMRect): Promise<void> {
  if (popoverHost && activeVideoId === meta.videoId && popoverHost.style.display !== 'none') {
    closePopover();
    return;
  }

  closePopover();
  activeAnchor = null;
  activeAnchorRect = anchorRect;
  activeVideoId = meta.videoId;

  let difficulty: LevelTag | null = null;
  let inLibrary = libraryVideoIds.has(meta.videoId);
  let fw: LevelFramework = feedLevelFramework;
  let t: Translator = feedTranslator;
  let customLevels = feedCustomLevels;

  try {
    const res = (await sendMsg<GetStateResponse>({ type: MSG.GET_STATE })) as GetStateResponse;
    if (res?.ok && 'data' in res) {
      const item = res.data.library.find((x) => x.videoId === meta.videoId);
      difficulty = item?.difficulty ?? null;
      inLibrary = Boolean(item);
      const st = ensureSettingsShape({ ...defaultSettings(), ...res.data.settings });
      fw = st.levelFramework ?? 'jlpt';
      customLevels = st.customLevels ?? [...DEFAULT_CUSTOM_LEVELS];
      t = createTranslator(resolveLocale(st.uiLocale));
      feedUiLocale = st.uiLocale;
      feedLevelFramework = fw;
      feedCustomLevels = customLevels;
      feedTranslator = t;
    }
  } catch {
    /* use defaults */
  }

  ensurePopoverHost();
  if (!popoverShadow) return;

  popoverShadow.innerHTML = `
    <style>
      :host { all: initial; }
      .panel {
        font-family: system-ui, Segoe UI, Roboto, sans-serif;
        font-size: 13px;
        color: #eee;
        background: rgba(16, 18, 24, 0.97);
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 12px;
        padding: 12px 14px;
        min-width: 228px;
        box-shadow: 0 16px 40px rgba(0,0,0,0.55);
      }
      .title { font-weight: 600; margin-bottom: 8px; font-size: 12px; line-height: 1.35; max-width: 260px; color: #fff; }
      label { display: block; font-size: 10px; color: #9aa0aa; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.1em; }
      select {
        width: 100%;
        padding: 8px 10px;
        border-radius: 8px;
        border: 1px solid rgba(255,255,255,0.14);
        background: rgba(34, 38, 48, 0.95);
        color: #fff;
        font: inherit;
        margin-bottom: 12px;
      }
      .actions { display: flex; gap: 8px; justify-content: flex-end; }
      button {
        font: inherit;
        padding: 7px 14px;
        border-radius: 8px;
        cursor: pointer;
        border: 1px solid rgba(255,255,255,0.14);
      }
      .save { background: #1a66ff; color: #fff; border-color: rgba(61, 124, 255, 0.9); }
      .cancel { background: rgba(42, 44, 52, 0.95); color: #eee; }
      .hint { font-size: 11px; color: #7d8496; margin-bottom: 8px; line-height: 1.35; }
    </style>
    <div class="panel">
      <div class="title">${escapeHtml(meta.title.slice(0, 120))}${meta.title.length > 120 ? '…' : ''}</div>
      <p class="hint">${escapeHtml(inLibrary ? t('feed.updateLevel') : t('feed.chooseLevel'))}</p>
      <label for="jp-feed-level">${escapeHtml(t('common.level'))}</label>
      <select id="jp-feed-level" part="level">
        ${feedLevelSelectOptionsHtml(fw, difficulty, t, customLevels)}
      </select>
      <div class="actions">
        <button type="button" class="cancel" part="cancel">${escapeHtml(t('common.cancel'))}</button>
        <button type="button" class="save" part="save">${escapeHtml(t('common.save'))}</button>
      </div>
    </div>
  `;

  const panel = popoverShadow.querySelector('.panel') as HTMLElement;
  const sel = popoverShadow.querySelector('[part="level"]') as HTMLSelectElement;
  const cancelBtn = popoverShadow.querySelector('[part="cancel"]') as HTMLButtonElement;
  const saveBtn = popoverShadow.querySelector('[part="save"]') as HTMLButtonElement;

  cancelBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closePopover();
  });
  saveBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    fireAsyncFeed(
      (async () => {
        const d = sel.value === '' ? null : (sel.value as LevelTag);
        if (inLibrary) {
          const res = (await sendMsg<ExtensionResponse>({
            type: MSG.SET_DIFFICULTY,
            payload: { videoId: meta.videoId, difficulty: d },
          })) as ExtensionResponse;
          if (!res.ok) {
            const hintEl = popoverShadow?.querySelector('.hint');
            if (hintEl) {
              hintEl.textContent = res.error;
              (hintEl as HTMLElement).style.color = '#f88';
            }
            return;
          }
          await refreshLibraryIds();
          scanExistingHoverStrips();
          closePopover();
          return;
        }
        const res = (await sendMsg<ExtensionResponse>({
          type: MSG.ADD_OR_UPDATE_LIBRARY,
          payload: {
            videoId: meta.videoId,
            title: meta.title,
            channel: meta.channel,
            difficulty: d,
          },
        })) as ExtensionResponse;
        await refreshLibraryIds();
        scanExistingHoverStrips();
        if (!res.ok) {
          const hintEl = popoverShadow?.querySelector('.hint');
          if (hintEl) {
            hintEl.textContent = res.error;
            (hintEl as HTMLElement).style.color = '#f88';
          }
          return;
        }
        closePopover();
      })(),
    );
  });

  popoverHost!.style.display = 'block';

  requestAnimationFrame(() => {
    positionPopoverNearRect(panel);
    if (popoverHost && panel.offsetWidth) {
      popoverHost.style.width = `${panel.offsetWidth}px`;
    }
  });

  window.setTimeout(() => {
    outsideCloseListener = (e: MouseEvent) => {
      const path = e.composedPath();
      if (popoverHost && path.includes(popoverHost)) return;
      if (activeAnchor && path.includes(activeAnchor)) return;
      closePopover();
    };
    document.addEventListener('click', outsideCloseListener, true);
  }, 120);

  document.addEventListener('keydown', onKeyDown, true);
}

function ensurePopoverHost(): void {
  if (popoverHost) {
    popoverShadow = popoverHost.shadowRoot;
    return;
  }
  popoverHost = document.createElement('div');
  popoverHost.id = 'jp-practice-feed-popover-host';
  popoverHost.style.display = 'none';
  popoverHost.style.position = 'fixed';
  popoverHost.style.zIndex = '2147483646';
  popoverShadow = popoverHost.attachShadow({ mode: 'open' });
  document.documentElement.appendChild(popoverHost);
}

function positionPopoverNearRect(panel: HTMLElement): void {
  if (!popoverHost || !activeAnchorRect) return;
  const r = activeAnchorRect;
  const pad = 8;
  const w = Math.min(panel.offsetWidth || 240, window.innerWidth - 16);
  let left = r.left;
  let top = r.bottom + pad;
  const popH = panel.offsetHeight || 160;
  const popW = w;

  if (left + popW > window.innerWidth - 8) {
    left = window.innerWidth - popW - 8;
  }
  if (left < 8) left = 8;

  if (top + popH > window.innerHeight - 8) {
    top = r.top - pad - popH;
  }
  if (top < 8) top = 8;

  popoverHost.style.left = `${left}px`;
  popoverHost.style.top = `${top}px`;
  popoverHost.style.width = `${Math.ceil(panel.offsetWidth || popW)}px`;
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

export function initFeedCards(): void {
  void refreshLibraryIds();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[STORAGE_KEY]) return;
    const nv = changes[STORAGE_KEY].newValue;
    syncLibraryFromStoragePayload(nv);
  });

  const mo = new MutationObserver(() => scheduleFeedRescanDebounced());
  mo.observe(mutationObserverRoot(), { childList: true, subtree: true });

  document.addEventListener('yt-navigate-finish', () => {
    void refreshLibraryIds();
    scheduleFeedRescanImmediate();
  });
  document.addEventListener('yt-page-data-updated', () => {
    void refreshLibraryIds();
    scheduleFeedRescanImmediate();
  });

  scheduleFeedRescanImmediate();
}
