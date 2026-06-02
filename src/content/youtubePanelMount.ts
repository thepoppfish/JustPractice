import type { LevelFramework } from '../lib/storage';
import { isYoutubeWatchLikePage } from '../lib/youtubeIds';
import { watchPanelShadowInnerHtml } from './youtubePanelHtml';
import { attachPanelDrag, levelSelectOptionsHtml } from './youtubePanelUi';
import { isWatchPanelHostLive, WATCH_PANEL_BOOT_TOKEN } from './watchPanelBoot';

export interface WatchPanelUiRefs {
  root: HTMLElement;
  practiceToggle: HTMLInputElement;
  difficultySelect: HTMLSelectElement;
  addBtn: HTMLButtonElement;
  statusEl: HTMLElement;
  hintEl: HTMLElement;
}

export interface WatchPanelEventHandlers {
  /** Toggle collapsed state (read/write settings + UI + persist). */
  onCollapseClick: () => void;
  onAddClick: () => void;
  onCompleteClick: () => void;
  onCompletePromptYes: () => void;
  onCompletePromptNo: () => void;
  onDifficultyChange: (value: string) => void;
  onPracticeToggleChange: (checked: boolean) => void;
  onCalPrev: () => void;
  onCalNext: () => void;
  onDragCommit: (left: number, top: number) => void;
}

export interface EnsureWatchPanelOptions {
  panelHostId: string;
  getLevelFramework: () => LevelFramework;
  getCustomLevels: () => readonly string[];
  getTemplateStrings: () => {
    dragToMove: string;
    level: string;
    saveToLibrary: string;
    countPracticeTime: string;
    markComplete: string;
    markIncomplete: string;
  };
  handlers: WatchPanelEventHandlers;
  onMounted: (ctx: { host: HTMLElement; shadowRoot: ShadowRoot; ui: WatchPanelUiRefs }) => void;
  onAfterAppend: () => void;
}

export function setWatchPanelHostVisible(panelHostId: string, visible: boolean): void {
  const host = document.getElementById(panelHostId) as HTMLElement | null;
  if (!host) return;
  host.style.display = visible ? '' : 'none';
}

/** Keep a dragged panel on-screen (custom left/top only). */
export function clampWatchPanelHostToViewport(host: HTMLElement, pad = 8): void {
  if (host.style.left === 'auto' || host.style.top === 'auto') return;
  const left = Number.parseFloat(host.style.left);
  const top = Number.parseFloat(host.style.top);
  if (!Number.isFinite(left) || !Number.isFinite(top)) return;

  const rect = host.getBoundingClientRect();
  const w = rect.width > 0 ? rect.width : host.offsetWidth;
  const h = rect.height > 0 ? rect.height : host.offsetHeight;
  const maxL = Math.max(pad, window.innerWidth - w - pad);
  const maxT = Math.max(pad, window.innerHeight - h - pad);
  const nextL = Math.min(Math.max(pad, left), maxL);
  const nextT = Math.min(Math.max(pad, top), maxT);
  if (nextL !== left) host.style.left = `${nextL}px`;
  if (nextT !== top) host.style.top = `${nextT}px`;
}

export function applyDefaultWatchPanelHostStyle(host: HTMLElement): void {
  host.style.setProperty('position', 'fixed', 'important');
  host.style.setProperty('z-index', '2147483646', 'important');
  host.style.setProperty('font-family', 'system-ui, Segoe UI, Roboto, sans-serif', 'important');
  host.style.setProperty('font-size', '13px', 'important');
  host.style.setProperty('max-width', '300px', 'important');
  host.style.setProperty('display', 'block', 'important');
  host.style.setProperty('visibility', 'visible', 'important');
  host.style.setProperty('opacity', '1', 'important');
  host.style.setProperty('pointer-events', 'auto', 'important');
  host.style.left = 'auto';
  host.style.top = 'auto';
  host.style.right = '16px';
  host.style.bottom = '88px';
}

/** Ensure the panel host is on top and in the viewport (after spawn or drag). */
export function forceWatchPanelHostVisible(host: HTMLElement): void {
  applyDefaultWatchPanelHostStyle(host);
  if (!host.isConnected) {
    (document.body ?? document.documentElement).appendChild(host);
  } else {
    (document.body ?? document.documentElement).appendChild(host);
  }
  requestAnimationFrame(() => clampWatchPanelHostToViewport(host));
}

export function extractWatchPanelUiFromShadow(sr: ShadowRoot): WatchPanelUiRefs {
  return {
    root: sr.querySelector('.wrap') as HTMLElement,
    practiceToggle: sr.querySelector('[part="practice"]') as HTMLInputElement,
    difficultySelect: sr.querySelector('[part="difficulty"]') as HTMLSelectElement,
    addBtn: sr.querySelector('[part="add"]') as HTMLButtonElement,
    statusEl: sr.querySelector('[part="status"]') as HTMLElement,
    hintEl: sr.querySelector('[part="hint"]') as HTMLElement,
  };
}

/** Creates the floating host + shadow panel once; wires static listeners. */
export function ensureWatchPanelIfAbsent(opts: EnsureWatchPanelOptions): void {
  const existing = document.getElementById(opts.panelHostId) as HTMLElement | null;
  if (existing && isWatchPanelHostLive(existing)) {
    opts.onMounted({
      host: existing,
      shadowRoot: existing.shadowRoot!,
      ui: extractWatchPanelUiFromShadow(existing.shadowRoot!),
    });
    opts.onAfterAppend();
    return;
  }
  existing?.remove();

  const host = document.createElement('div');
  host.id = opts.panelHostId;
  host.setAttribute('data-jp-practice', '1');
  host.dataset.jpBootToken = WATCH_PANEL_BOOT_TOKEN;
  applyDefaultWatchPanelHostStyle(host);

  const sr = host.attachShadow({ mode: 'open' });
  const fw = opts.getLevelFramework();
  const customLv = opts.getCustomLevels();
  const tmpl = opts.getTemplateStrings();
  sr.innerHTML = watchPanelShadowInnerHtml(levelSelectOptionsHtml(fw, customLv), {
    dragToMove: tmpl.dragToMove,
    level: tmpl.level,
    saveToLibrary: tmpl.saveToLibrary,
    countPracticeTime: tmpl.countPracticeTime,
    markComplete: tmpl.markComplete,
    markIncomplete: tmpl.markIncomplete,
  });

  const ui = extractWatchPanelUiFromShadow(sr);
  const completeBtn = sr.querySelector('[part="complete-btn"]') as HTMLButtonElement;
  const completePromptYes = sr.querySelector('[part="complete-prompt-yes"]') as HTMLButtonElement;
  const completePromptNo = sr.querySelector('[part="complete-prompt-no"]') as HTMLButtonElement;
  const dragHandle = sr.querySelector('[part="drag-handle"]') as HTMLElement;
  const collapseBtn = sr.querySelector('[part="collapse"]') as HTMLButtonElement;
  const calPrev = sr.querySelector('[part="cal-prev"]') as HTMLButtonElement;
  const calNext = sr.querySelector('[part="cal-next"]') as HTMLButtonElement;

  const h = opts.handlers;

  collapseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    h.onCollapseClick();
  });

  ui.addBtn.addEventListener('click', () => h.onAddClick());
  completeBtn.addEventListener('click', () => h.onCompleteClick());
  completePromptYes.addEventListener('click', () => h.onCompletePromptYes());
  completePromptNo.addEventListener('click', () => h.onCompletePromptNo());
  ui.difficultySelect.addEventListener('change', () => h.onDifficultyChange(ui.difficultySelect.value));
  ui.practiceToggle.addEventListener('change', () => {
    h.onPracticeToggleChange(ui.practiceToggle.checked);
  });

  calPrev.addEventListener('click', () => h.onCalPrev());
  calNext.addEventListener('click', () => h.onCalNext());

  attachPanelDrag(host, dragHandle, h.onDragCommit);

  opts.onMounted({ host, shadowRoot: sr, ui });

  (document.body ?? document.documentElement).appendChild(host);
  forceWatchPanelHostVisible(host);
  opts.onAfterAppend();
}

export function updateWatchPanelHint(p: {
  hintEl: HTMLElement;
  practiceEnabled: boolean;
  pauseWhenUnfocused: boolean;
  panelT: (k: string, p?: Record<string, string | number>) => string;
}): void {
  p.hintEl.textContent = p.practiceEnabled
    ? p.pauseWhenUnfocused
      ? p.panelT('panel.countHintFocused')
      : p.panelT('panel.countHintUnfocused')
    : p.panelT('panel.countHintOff');
}

export function setWatchPanelStatusFlash(
  el: HTMLElement | null,
  text: string,
  tone: 'ok' | 'err' | 'warn' = 'ok',
): void {
  if (!el) return;
  el.textContent = text;
  el.style.color = tone === 'err' ? '#f88' : tone === 'warn' ? '#fdb' : '#9cf';
}

let libraryBannerTimer: number | null = null;

export interface WatchPanelDebugHooks {
  log: (event: string, detail?: Record<string, unknown>) => void;
  strip: (line: string) => void;
}

export function clearWatchPanelLibraryBanner(p: {
  shadowRoot: ShadowRoot | null;
  reason: string;
  debug: WatchPanelDebugHooks;
}): void {
  p.debug.log('libraryBanner:clear', {
    reason: p.reason,
    hadShadowRoot: Boolean(p.shadowRoot),
  });
  p.debug.strip(`clear reason=${p.reason}`);
  if (libraryBannerTimer) {
    clearTimeout(libraryBannerTimer);
    libraryBannerTimer = null;
  }
  const el = p.shadowRoot?.querySelector('[part="library-banner"]') as HTMLElement | null;
  if (!el) {
    if (p.shadowRoot) {
      p.debug.log('libraryBanner:clear:missing-banner-in-shadow', { reason: p.reason });
      p.debug.strip(`WARN: no [part=library-banner] (${p.reason})`);
    }
    return;
  }
  el.hidden = true;
  el.textContent = '';
  el.className = 'library-banner';
}

export function showWatchPanelLibraryBanner(p: {
  shadowRoot: ShadowRoot | null;
  text: string;
  tone: 'ok' | 'err' | 'warn';
  debug: WatchPanelDebugHooks;
}): void {
  p.debug.log('libraryBanner:show:start', {
    tone: p.tone,
    textLen: p.text.length,
    textPreview: p.text.slice(0, 160),
    hasShadowRoot: Boolean(p.shadowRoot),
  });
  const el = p.shadowRoot?.querySelector('[part="library-banner"]') as HTMLElement | null;
  if (!el) {
    p.debug.log('libraryBanner:show:missing-element', { tone: p.tone, textLen: p.text.length });
    p.debug.strip(`ERROR: no [part=library-banner] in shadow (tone=${p.tone})`);
    return;
  }
  if (libraryBannerTimer) {
    clearTimeout(libraryBannerTimer);
    libraryBannerTimer = null;
  }
  el.className = `library-banner library-banner--${p.tone}`;
  el.textContent = p.text;
  el.hidden = false;
  p.debug.log('libraryBanner:show:applied', {
    tone: p.tone,
    hidden: el.hidden,
    className: el.className,
    computedDisplay: typeof getComputedStyle !== 'undefined' ? getComputedStyle(el).display : 'n/a',
  });
  p.debug.strip(`banner applied tone=${p.tone} hidden=${String(el.hidden)} len=${p.text.length}`);
  libraryBannerTimer = window.setTimeout(() => {
    libraryBannerTimer = null;
    clearWatchPanelLibraryBanner({
      shadowRoot: p.shadowRoot,
      reason: 'timeout',
      debug: p.debug,
    });
  }, 14_000);
}

export function needsHomeFeedPanelAttention(getVideoIdFromUrl: () => string | null): boolean {
  if (typeof location === 'undefined') return false;
  if (!/(^|\.)youtube\.com$/i.test(location.hostname) && !/(^|\.)m\.youtube\.com$/i.test(location.hostname)) {
    return false;
  }
  const path = location.pathname;
  if (path.startsWith('/watch') || path.startsWith('/shorts/')) return false;
  return getVideoIdFromUrl() === null;
}

/** Keep the floating panel on-screen when id resolution is still in flight (SPA / DOM lag). */
export function shouldKeepWatchPanelVisibleWithoutVideoId(
  getVideoIdFromUrl: () => string | null,
  hasVideoElement: () => boolean,
): boolean {
  if (needsHomeFeedPanelAttention(getVideoIdFromUrl)) return true;
  if (isYoutubeWatchLikePage()) return true;
  return hasVideoElement();
}

let prevHomeFeedAttentionShown = false;

export function updateHomeFeedAttentionStrip(p: {
  shadowRoot: ShadowRoot | null;
  needsAttention: boolean;
  watchPanelCollapsed: boolean;
  panelT: (k: string, p?: Record<string, string | number>) => string;
  onExpandFromCollapsed: () => void;
}): void {
  if (!p.shadowRoot) return;
  const el = p.shadowRoot.querySelector('[part="home-feed-attention"]') as HTMLElement | null;
  const wrap = p.shadowRoot.querySelector('.wrap') as HTMLElement | null;
  if (!el || !wrap) return;

  if (p.needsAttention) {
    if (!prevHomeFeedAttentionShown && p.watchPanelCollapsed) {
      p.onExpandFromCollapsed();
    }
    prevHomeFeedAttentionShown = true;
    el.textContent = p.panelT('panel.homeFeedPickAttention');
    el.hidden = false;
    applyNoVideoHomePanelLayout(p.shadowRoot, true);
  } else {
    prevHomeFeedAttentionShown = false;
    el.hidden = true;
    el.textContent = '';
    applyNoVideoHomePanelLayout(p.shadowRoot, false);
  }
}

export function applyNoVideoHomePanelLayout(shadowRoot: ShadowRoot | null, active: boolean): void {
  if (!shadowRoot) return;
  const wrap = shadowRoot.querySelector('.wrap') as HTMLElement | null;
  if (!wrap) return;
  wrap.classList.toggle('wrap--no-video', active);
}
