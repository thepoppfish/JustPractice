import type { LevelFramework } from '../lib/storage';
import { watchPanelShadowInnerHtml } from './youtubePanelHtml';
import { attachPanelDrag, levelSelectOptionsHtml } from './youtubePanelUi';

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

/** Creates the floating host + shadow panel once; wires static listeners. */
export function ensureWatchPanelIfAbsent(opts: EnsureWatchPanelOptions): void {
  if (document.getElementById(opts.panelHostId)) return;

  const host = document.createElement('div');
  host.id = opts.panelHostId;
  host.setAttribute('data-jp-practice', '1');
  Object.assign(host.style, {
    position: 'fixed',
    right: '16px',
    bottom: '88px',
    zIndex: '99999',
    fontFamily: 'system-ui, Segoe UI, Roboto, sans-serif',
    fontSize: '13px',
    maxWidth: '300px',
  });

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

  const root = sr.querySelector('.wrap') as HTMLElement;
  const addBtn = sr.querySelector('[part="add"]') as HTMLButtonElement;
  const completeBtn = sr.querySelector('[part="complete-btn"]') as HTMLButtonElement;
  const completePromptYes = sr.querySelector('[part="complete-prompt-yes"]') as HTMLButtonElement;
  const completePromptNo = sr.querySelector('[part="complete-prompt-no"]') as HTMLButtonElement;
  const difficultySelect = sr.querySelector('[part="difficulty"]') as HTMLSelectElement;
  const practiceToggle = sr.querySelector('[part="practice"]') as HTMLInputElement;
  const statusEl = sr.querySelector('[part="status"]') as HTMLElement;
  const hintEl = sr.querySelector('[part="hint"]') as HTMLElement;
  const dragHandle = sr.querySelector('[part="drag-handle"]') as HTMLElement;
  const collapseBtn = sr.querySelector('[part="collapse"]') as HTMLButtonElement;
  const calPrev = sr.querySelector('[part="cal-prev"]') as HTMLButtonElement;
  const calNext = sr.querySelector('[part="cal-next"]') as HTMLButtonElement;

  const h = opts.handlers;

  collapseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    h.onCollapseClick();
  });

  const ui: WatchPanelUiRefs = {
    root,
    practiceToggle,
    difficultySelect,
    addBtn,
    statusEl,
    hintEl,
  };

  addBtn.addEventListener('click', () => h.onAddClick());
  completeBtn.addEventListener('click', () => h.onCompleteClick());
  completePromptYes.addEventListener('click', () => h.onCompletePromptYes());
  completePromptNo.addEventListener('click', () => h.onCompletePromptNo());
  difficultySelect.addEventListener('change', () => h.onDifficultyChange(difficultySelect.value));
  practiceToggle.addEventListener('change', () => {
    h.onPracticeToggleChange(practiceToggle.checked);
  });

  calPrev.addEventListener('click', () => h.onCalPrev());
  calNext.addEventListener('click', () => h.onCalNext());

  attachPanelDrag(host, dragHandle, h.onDragCommit);

  opts.onMounted({ host, shadowRoot: sr, ui });

  document.documentElement.appendChild(host);
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
