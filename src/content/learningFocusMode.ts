import { isYoutubeClassicWatchPage } from '../lib/youtubeIds';

/** Applied to `document.documentElement` on classic `/watch` when viewing a library video. */
export const LEARNING_FOCUS_ROOT_CLASS = 'jp-learning-focus';

const STYLE_ID = 'jp-learning-focus-styles';
const DIRECT_HIDE_ATTR = 'data-jp-learning-focus-hidden';

/** Light-DOM nodes YouTube uses for the watch-page recommendation column (2024–2026). */
export const LEARNING_FOCUS_HIDE_SELECTORS = [
  '#secondary',
  '#secondary-inner',
  'ytd-watch-next-secondary-results-renderer',
  '#related',
  'ytd-watch-flexy ytd-reel-shelf-renderer',
  'ytd-watch-flexy #secondary',
] as const;

/**
 * Hides YouTube’s sidebar recommendations on the standard watch layout.
 * Not applied on `/shorts/`, home, or embed — theater / mini player are not special-cased.
 */
export function learningFocusModeCss(): string {
  const root = `html.${LEARNING_FOCUS_ROOT_CLASS}`;
  const blocks = LEARNING_FOCUS_HIDE_SELECTORS.map(
    (sel) => `${root} ${sel} { display: none !important; visibility: hidden !important; }`,
  );
  return blocks.join('\n');
}

function ensureLearningFocusStyles(): void {
  const css = learningFocusModeCss();
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = STYLE_ID;
    (document.head || document.documentElement).appendChild(el);
  }
  if (el.textContent !== css) el.textContent = css;
}

function applyDirectRecommendationHide(active: boolean): void {
  for (const sel of LEARNING_FOCUS_HIDE_SELECTORS) {
    try {
      document.querySelectorAll(sel).forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        if (active) {
          node.setAttribute(DIRECT_HIDE_ATTR, '1');
          node.style.setProperty('display', 'none', 'important');
        } else if (node.hasAttribute(DIRECT_HIDE_ATTR)) {
          node.removeAttribute(DIRECT_HIDE_ATTR);
          node.style.removeProperty('display');
        }
      });
    } catch {
      /* invalid selector in exotic builds */
    }
  }
}

let domObserver: MutationObserver | null = null;
let observerDebounce: ReturnType<typeof setTimeout> | null = null;
let observerInput: LearningFocusModeInput | null = null;

function stopLearningFocusDomObserver(): void {
  if (observerDebounce != null) {
    clearTimeout(observerDebounce);
    observerDebounce = null;
  }
  domObserver?.disconnect();
  domObserver = null;
  observerInput = null;
}

function scheduleDirectHideFromObserver(): void {
  if (!observerInput || !shouldApplyLearningFocusMode(observerInput)) return;
  if (observerDebounce != null) clearTimeout(observerDebounce);
  observerDebounce = setTimeout(() => {
    observerDebounce = null;
    if (observerInput && shouldApplyLearningFocusMode(observerInput)) {
      applyDirectRecommendationHide(true);
    }
  }, 80);
}

function ensureLearningFocusDomObserver(p: LearningFocusModeInput, active: boolean): void {
  if (!active) {
    stopLearningFocusDomObserver();
    return;
  }
  observerInput = p;
  if (domObserver) return;
  domObserver = new MutationObserver(() => scheduleDirectHideFromObserver());
  domObserver.observe(document.documentElement, { childList: true, subtree: true });
  applyDirectRecommendationHide(true);
}

export interface LearningFocusModeInput {
  /** User setting: hide distractions on library videos. */
  settingEnabled: boolean;
  /** Current watch target is saved in the library. */
  inLibrary: boolean;
}

export function shouldApplyLearningFocusMode(p: LearningFocusModeInput): boolean {
  if (!p.settingEnabled || !p.inLibrary) return false;
  return isYoutubeClassicWatchPage();
}

/** Toggle focus layout on the YouTube page (no-op off `/watch`). */
export function syncLearningFocusMode(p: LearningFocusModeInput): void {
  if (typeof document === 'undefined') return;
  ensureLearningFocusStyles();
  const active = shouldApplyLearningFocusMode(p);
  document.documentElement.classList.toggle(LEARNING_FOCUS_ROOT_CLASS, active);
  applyDirectRecommendationHide(active);
  ensureLearningFocusDomObserver(p, active);
}
