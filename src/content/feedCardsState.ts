import { createTranslator, resolveLocale, type Translator } from '../i18n';
import {
  DEFAULT_CUSTOM_LEVELS,
  defaultSettings,
  ensureSettingsShape,
  type LevelFramework,
  type PersistedData,
  type UiLocale,
} from '../lib/storage';
import { MSG } from '../lib/messages';
import type { GetStateResponse } from '../lib/messages';
import { isBenignExtensionMessagingFailure, messagingFailureText } from '../lib/extensionMessaging';
import type { ExtensionMessage } from '../lib/messages';

export type VideoMeta = { videoId: string; title: string; channel: string };

export const FEED_MOUNT_ATTR = 'data-jp-feed-mount' as const;

export const SCAN_DEBOUNCE_MS = 120;

let libraryVideoIds = new Set<string>();
let feedTranslator: Translator = createTranslator('en');
let feedLevelFramework: LevelFramework = 'jlpt';
let feedCustomLevels: string[] = [...DEFAULT_CUSTOM_LEVELS];
let feedUiLocale: UiLocale | undefined = 'auto';

export function getLibraryVideoIds(): Set<string> {
  return libraryVideoIds;
}

export function getFeedTranslator(): Translator {
  return feedTranslator;
}

export function getFeedLevelFramework(): LevelFramework {
  return feedLevelFramework;
}

export function getFeedCustomLevels(): string[] {
  return feedCustomLevels;
}

export async function sendFeedMsg<T = unknown>(msg: ExtensionMessage): Promise<T> {
  try {
    return (await chrome.runtime.sendMessage(msg)) as T;
  } catch (e) {
    if (isBenignExtensionMessagingFailure(e)) {
      console.warn(
        '[JustPractice:feed] Extension messaging unavailable; refresh this YouTube tab.',
        messagingFailureText(e),
      );
      return { ok: false, error: messagingFailureText(e) } as T;
    }
    throw e;
  }
}

export function fireAsyncFeed(p: Promise<unknown>): void {
  void p.catch((err) => {
    if (isBenignExtensionMessagingFailure(err)) return;
    console.warn('[JustPractice:feed] async handler failed', err);
  });
}

export async function refreshLibraryIds(): Promise<void> {
  try {
    const res = (await sendFeedMsg<GetStateResponse>({ type: MSG.GET_STATE })) as GetStateResponse;
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

export function syncLibraryFromStoragePayload(payload: unknown): boolean {
  const data = payload as PersistedData | undefined;
  let changed = false;
  if (data?.library) {
    libraryVideoIds = new Set(data.library.map((x) => x.videoId));
    changed = true;
  }
  if (data?.settings && typeof data.settings === 'object') {
    const st = ensureSettingsShape({ ...defaultSettings(), ...data.settings });
    feedUiLocale = st.uiLocale;
    feedLevelFramework = st.levelFramework ?? 'jlpt';
    feedCustomLevels = st.customLevels ?? [...DEFAULT_CUSTOM_LEVELS];
    feedTranslator = createTranslator(resolveLocale(feedUiLocale));
    changed = true;
  }
  return changed;
}
