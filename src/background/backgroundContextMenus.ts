import { APP_NAME } from '../lib/branding';
import { parseYoutubeVideoId } from '../lib/youtubeIds';
import { readPersisted, type LevelTag } from '../lib/storage';
import { parseContextMenuDifficulty, tagsForFramework } from '../lib/levelTags';
import { createTranslator, resolveLocale } from '../i18n';
import { MSG } from '../lib/messages';
import { handleBackgroundMessage } from './backgroundMessageHandlers';

const DOC_YT = ['https://*.youtube.com/*', 'https://youtube.com/*', 'https://m.youtube.com/*'] as const;
const TARGET_LINK = [
  'https://*.youtube.com/watch*',
  'https://*.youtube.com/shorts/*',
  'https://youtu.be/*',
] as const;

/** One parent for page + link + video so Chrome never shows duplicate JustPractice rows when several contexts match the same click. */
const CONTEXTS_YT = ['page', 'link', 'video'] as const;

/** Serialize menu rebuilds — parallel removeAll/create races cause "duplicate id" lastErrors. */
let contextMenuRebuildChain: Promise<void> = Promise.resolve();

export function rebuildContextMenusFromStorage(): void {
  contextMenuRebuildChain = contextMenuRebuildChain
    .then(() => rebuildContextMenusOnce())
    .catch((e) => {
      console.error('[JustPractice:bg] contextMenus rebuild failed', e);
    });
}

function consumeContextMenuLastError(phase: string, itemId?: string): void {
  const err = chrome.runtime.lastError;
  if (!err?.message) return;
  if (err.message.includes('duplicate id')) return;
  console.warn('[JustPractice:bg] contextMenus', phase, itemId ?? '', err.message);
}

async function rebuildContextMenusOnce(): Promise<void> {
  const p = await readPersisted();
  await new Promise<void>((resolve) => {
    chrome.contextMenus.removeAll(() => {
      consumeContextMenuLastError('removeAll');
      resolve();
    });
  });

  const framework = p.settings.levelFramework ?? 'jlpt';
  const customLevels = p.settings.customLevels ?? [];
  const t = createTranslator(resolveLocale(p.settings.uiLocale));
  const tags = tagsForFramework(framework, customLevels);
  const levelEntries: { idSuffix: string; title: string; difficulty: LevelTag | null }[] = [
    { idSuffix: 'u', title: t('ctx.unrated'), difficulty: null },
    ...tags.map((L, i) => ({
      idSuffix: framework === 'custom' ? `x${i}` : L,
      title: L,
      difficulty: L,
    })),
  ];

  chrome.contextMenus.create({
    id: 'jp_root',
    title: APP_NAME,
    contexts: [...CONTEXTS_YT],
    documentUrlPatterns: [...DOC_YT],
    targetUrlPatterns: [...TARGET_LINK],
  });
  consumeContextMenuLastError('create', 'jp_root');

  for (const lv of levelEntries) {
    const id = `jp_root_${lv.idSuffix}`;
    chrome.contextMenus.create({
      id,
      parentId: 'jp_root',
      title: lv.title,
      contexts: [...CONTEXTS_YT],
      documentUrlPatterns: [...DOC_YT],
      targetUrlPatterns: [...TARGET_LINK],
    });
    consumeContextMenuLastError('create', id);
  }
}

export function attachBackgroundContextMenuListeners(): void {
  chrome.runtime.onInstalled.addListener(() => {
    rebuildContextMenusFromStorage();
  });

  rebuildContextMenusFromStorage();

  chrome.runtime.onStartup.addListener(() => {
    rebuildContextMenusFromStorage();
  });

  chrome.contextMenus.onClicked.addListener((info, tab) => {
    const mid = typeof info.menuItemId === 'string' ? info.menuItemId : '';

    void (async () => {
      const p = await readPersisted();
      const fw = p.settings.levelFramework ?? 'jlpt';
      const customLevels = p.settings.customLevels ?? [];
      const difficulty = parseContextMenuDifficulty(mid, tagsForFramework(fw, customLevels));
      if (difficulty === undefined) return;

      let videoId: string | null = null;
      if (info.linkUrl) {
        videoId = parseYoutubeVideoId(info.linkUrl);
      }
      if (!videoId && tab?.url) {
        videoId = parseYoutubeVideoId(tab.url);
      }
      if (!videoId) return;

      await handleBackgroundMessage({
        type: MSG.ADD_OR_UPDATE_LIBRARY,
        payload: {
          videoId,
          title: 'Unknown title',
          channel: 'Unknown channel',
          difficulty,
        },
      });
    })();
  });
}
