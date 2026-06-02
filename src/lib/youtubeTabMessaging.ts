import { MSG, type ExtensionMessage } from './messages';

/** Content-script match patterns (keep in sync with manifest.config.ts). */
export const YOUTUBE_TAB_URL_PATTERNS = [
  'https://www.youtube.com/*',
  'https://youtube.com/*',
  'https://m.youtube.com/*',
] as const;

/** Built output path (keep in sync with dist manifest content_scripts js). */
export const YOUTUBE_CONTENT_SCRIPT_FILES = ['assets/youtube-content.bundle.js'] as const;

export function isYoutubePageUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.replace(/^www\./i, '');
    return host === 'youtube.com' || host === 'm.youtube.com';
  } catch {
    return false;
  }
}

export interface YoutubeTabMessageResult {
  youtubeTabCount: number;
  tabsMessaged: number;
  tabsFailed: number;
  tabsInjected: number;
}

async function listYoutubeTabs(): Promise<chrome.tabs.Tab[]> {
  const seen = new Map<number, chrome.tabs.Tab>();

  const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (active?.id != null && isYoutubePageUrl(active.url)) {
    seen.set(active.id, active);
  }

  try {
    const byPattern = await chrome.tabs.query({ url: [...YOUTUBE_TAB_URL_PATTERNS] });
    for (const tab of byPattern) {
      if (tab.id != null) seen.set(tab.id, tab);
    }
  } catch {
    /* pattern query can fail on some builds — fall back below */
  }

  const all = await chrome.tabs.query({});
  for (const tab of all) {
    if (tab.id != null && isYoutubePageUrl(tab.url)) {
      seen.set(tab.id, tab);
    }
  }

  const tabs = [...seen.values()];
  tabs.sort((a, b) => {
    if (a.active && !b.active) return -1;
    if (!a.active && b.active) return 1;
    return 0;
  });
  return tabs;
}

async function injectYoutubeContentScript(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: [...YOUTUBE_CONTENT_SCRIPT_FILES],
  });
}

async function sendToTab(tabId: number, message: ExtensionMessage): Promise<boolean> {
  try {
    const res = (await chrome.tabs.sendMessage(tabId, message)) as { ok?: boolean } | undefined;
    return res?.ok !== false;
  } catch {
    return false;
  }
}

/** Sends a message to every open YouTube tab (best-effort). */
export async function sendMessageToYoutubeTabs(
  message: ExtensionMessage,
): Promise<YoutubeTabMessageResult> {
  const tabs = await listYoutubeTabs();
  let tabsMessaged = 0;
  let tabsFailed = 0;
  let tabsInjected = 0;

  for (const tab of tabs) {
    if (tab.id == null) continue;
    let ok = await sendToTab(tab.id, message);
    if (!ok) {
      try {
        await injectYoutubeContentScript(tab.id);
        tabsInjected += 1;
        await new Promise((r) => setTimeout(r, 700));
        ok = await sendToTab(tab.id, message);
      } catch {
        ok = false;
      }
    }
    if (ok) tabsMessaged += 1;
    else tabsFailed += 1;
  }

  return {
    youtubeTabCount: tabs.length,
    tabsMessaged,
    tabsFailed,
    tabsInjected,
  };
}

export type WatchPanelSpawnRequestStatus = 'spawned' | 'no_youtube_tabs' | 'needs_refresh';

export interface WatchPanelSpawnRequestResult {
  status: WatchPanelSpawnRequestStatus;
  youtubeTabCount: number;
  tabsMessaged: number;
  tabsInjected: number;
}

/** Spawn / reset the watch panel on all YouTube tabs (injects script if the tab was never refreshed). */
export async function requestWatchPanelSpawn(): Promise<WatchPanelSpawnRequestResult> {
  const res = await sendMessageToYoutubeTabs({ type: MSG.SHOW_WATCH_PANEL });
  if (res.youtubeTabCount === 0) {
    return { status: 'no_youtube_tabs', youtubeTabCount: 0, tabsMessaged: 0, tabsInjected: 0 };
  }
  if (res.tabsMessaged > 0) {
    return {
      status: 'spawned',
      youtubeTabCount: res.youtubeTabCount,
      tabsMessaged: res.tabsMessaged,
      tabsInjected: res.tabsInjected,
    };
  }
  return {
    status: 'needs_refresh',
    youtubeTabCount: res.youtubeTabCount,
    tabsMessaged: 0,
    tabsInjected: res.tabsInjected,
  };
}
