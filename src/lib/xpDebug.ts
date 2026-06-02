/**
 * Opt-in XP / practice-tick tracing (no PII beyond video ids).
 *
 * **YouTube page** (DevTools → Console on youtube.com):
 * ```js
 * localStorage.setItem('jp-debug-xp', '1'); location.reload();
 * ```
 * Full panel debug strip + watch logs: `localStorage.setItem('jpPracticeDebug', '1'); location.reload();`
 * Off: `localStorage.removeItem('jp-debug-xp'); localStorage.removeItem('jpPracticeDebug'); location.reload();`
 *
 * **Extension service worker** (chrome://extensions → JustPractice → Service worker):
 * ```js
 * chrome.storage.local.set({ jpDebugXp: true });
 * ```
 * Content script mirrors localStorage flags into `jpDebugXp` on boot.
 */

export const JP_XP_DEBUG_LS_KEY = 'jp-debug-xp';
export const JP_PRACTICE_DEBUG_LS_KEY = 'jpPracticeDebug';
export const JP_XP_DEBUG_STORAGE_KEY = 'jpDebugXp';

export const JP_XP_LOG_PREFIX = '[JP XP]';

export function isJpXpDebugEnabledInContent(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    return (
      localStorage.getItem(JP_XP_DEBUG_LS_KEY) === '1' ||
      localStorage.getItem(JP_PRACTICE_DEBUG_LS_KEY) === '1'
    );
  } catch {
    return false;
  }
}

export async function isJpXpDebugEnabledInBackground(): Promise<boolean> {
  try {
    const r = await chrome.storage.local.get(JP_XP_DEBUG_STORAGE_KEY);
    return r[JP_XP_DEBUG_STORAGE_KEY] === true;
  } catch {
    return false;
  }
}

/** Mirror page localStorage debug flags so the service worker can log PRACTICE_TICK. */
export async function syncJpXpDebugFlagToExtensionStorage(): Promise<void> {
  const on = isJpXpDebugEnabledInContent();
  try {
    if (on) {
      await chrome.storage.local.set({ [JP_XP_DEBUG_STORAGE_KEY]: true });
    } else {
      await chrome.storage.local.remove(JP_XP_DEBUG_STORAGE_KEY);
    }
  } catch {
    /* ignore */
  }
}

function logXp(event: string, detail: Record<string, unknown>): void {
  try {
    console.info(JP_XP_LOG_PREFIX, event, { t: new Date().toISOString(), ...detail });
  } catch {
    /* ignore */
  }
}

export function jpXpLogContent(event: string, detail: Record<string, unknown> = {}): void {
  if (!isJpXpDebugEnabledInContent()) return;
  logXp(event, detail);
}

export async function jpXpLogBackground(
  event: string,
  detail: Record<string, unknown> = {},
): Promise<void> {
  if (!(await isJpXpDebugEnabledInBackground())) return;
  logXp(event, detail);
}

/** Human-readable hint when a flush/tick did not increase XP. */
export function explainPracticeXpZero(params: {
  deltaSeconds: number;
  carryIn: number;
  carryOut: number;
  xpGained: number;
  practiceEnabled?: boolean;
}): string {
  if (params.xpGained > 0) return '';
  if (params.practiceEnabled === false) return 'practice toggle off (no seconds sent)';
  if (params.deltaSeconds <= 0) return 'deltaSeconds<=0';
  if (params.carryOut > 0) {
    const need = 60 - params.carryOut;
    return `banking ${params.carryOut}s carry (need ${need}s more counted practice for +1 XP)`;
  }
  return 'no billable full minute in this tick';
}
