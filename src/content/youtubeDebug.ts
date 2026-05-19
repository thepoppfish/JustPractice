/** Set `localStorage.setItem(JP_PRACTICE_DEBUG_LS_KEY,'1')` on youtube.com, reload; panel shows a green log strip + extra console lines. */
export const JP_PRACTICE_DEBUG_LS_KEY = 'jpPracticeDebug';

export function jpWatchDebugEnabled(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(JP_PRACTICE_DEBUG_LS_KEY) === '1';
  } catch {
    return false;
  }
}

export function jpWatchLog(event: string, detail: Record<string, unknown> = {}): void {
  if (!jpWatchDebugEnabled()) return;
  try {
    console.info('[JustPractice:watch]', event, { t: new Date().toISOString(), ...detail });
  } catch {
    /* ignore */
  }
}

/**
 * Debug strip lives in the panel shadow root; pass a getter so the shadow root can be mounted later.
 */
export function createJpWatchPanelDebugStrip(getShadowRoot: () => ShadowRoot | null): {
  strip: (line: string) => void;
  sync: () => void;
} {
  function strip(line: string): void {
    if (!jpWatchDebugEnabled()) return;
    const shadowRoot = getShadowRoot();
    if (!shadowRoot) return;
    const stripEl = shadowRoot.querySelector('[part="jp-debug-strip"]') as HTMLElement | null;
    if (!stripEl) return;
    stripEl.hidden = false;
    const prev = stripEl.textContent ?? '';
    const combined = prev ? `${prev}\n${line}` : line;
    stripEl.textContent = combined.split('\n').slice(-18).join('\n');
    stripEl.scrollTop = stripEl.scrollHeight;
  }

  function sync(): void {
    const shadowRoot = getShadowRoot();
    if (!shadowRoot) return;
    const stripEl = shadowRoot.querySelector('[part="jp-debug-strip"]') as HTMLElement | null;
    if (!stripEl) return;
    if (!jpWatchDebugEnabled()) {
      stripEl.hidden = true;
      stripEl.textContent = '';
      return;
    }
    stripEl.hidden = false;
    if (!stripEl.textContent?.trim()) {
      stripEl.textContent =
        'Debug ON (jpPracticeDebug=1). Console filter: JustPractice:watch\nOff: localStorage.removeItem("jpPracticeDebug"); reload';
    }
  }

  return { strip, sync };
}
