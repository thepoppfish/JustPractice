import { MSG } from '../lib/messages';
import type { ExtensionMessage, ExtensionResponse } from '../lib/messages';
import { APP_NAME } from '../lib/branding';
import { parseYoutubeVideoId } from '../lib/youtubeIds';
import {
  dateKeyFromTimestamp,
  ensureSettingsShape,
  normalizeImportedPersisted,
  readPersisted,
  STORAGE_KEY,
  writePersisted,
  emptyPersisted,
  type LevelTag,
} from '../lib/storage';
import { parseContextMenuDifficulty, tagsForFramework } from '../lib/levelTags';
import { createTranslator, resolveLocale } from '../i18n';
import {
  ensureGoalCheckAlarm,
  onGoalAlarmName,
  maybeNotifyDailyGoalMet,
  runPeriodicGoalChecks,
} from '../lib/goalNotifications';
const MAX_TICK_SECONDS = 120;

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

function rebuildContextMenusFromStorage(): void {
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

chrome.runtime.onInstalled.addListener(() => {
  rebuildContextMenusFromStorage();
  void ensureGoalCheckAlarm();
});

rebuildContextMenusFromStorage();
void ensureGoalCheckAlarm();

chrome.alarms.onAlarm.addListener((a) => {
  if (onGoalAlarmName(a.name)) void runPeriodicGoalChecks();
});

chrome.runtime.onStartup.addListener(() => {
  void ensureGoalCheckAlarm();
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

    await handleMessage({
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

async function enrichLibraryItemFromOEmbed(
  videoId: string,
  mode: 'fill-unknown' | 'overwrite' = 'fill-unknown',
): Promise<void> {
  try {
    const p = await readPersisted();
    const item = p.library.find((x) => x.videoId === videoId);
    if (!item) return;

    const watchUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
    const oembed = `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`;
    const r = await fetch(oembed);
    if (!r.ok) return;
    const j = (await r.json()) as { title?: string; author_name?: string };
    let changed = false;
    const fillTitle =
      mode === 'overwrite' ||
      item.title === 'Unknown title' ||
      !item.title.trim();
    const fillChannel =
      mode === 'overwrite' ||
      item.channel === 'Unknown channel' ||
      !item.channel.trim();
    if (j.title?.trim() && fillTitle) {
      item.title = j.title.trim();
      changed = true;
    }
    if (j.author_name?.trim() && fillChannel) {
      item.channel = j.author_name.trim();
      changed = true;
    }
    if (changed) await writePersisted(p);
  } catch {
    /* network / parse */
  }
}

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    _sender,
    sendResponse: (r: ExtensionResponse) => void,
  ) => {
    void (async () => {
      try {
        const r = await handleMessage(message);
        sendResponse(r);
      } catch (e) {
        sendResponse({
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    })();
    return true;
  },
);

async function handleMessage(message: ExtensionMessage): Promise<ExtensionResponse> {
  switch (message.type) {
    case MSG.GET_STATE: {
      const data = await readPersisted();
      return { ok: true, data };
    }
    case MSG.ADD_OR_UPDATE_LIBRARY: {
      const p = await readPersisted();
      const { videoId, title, channel, difficulty } = message.payload;
      const idx = p.library.findIndex((x) => x.videoId === videoId);
      const cleanTitle =
        title.trim() && title !== 'Unknown title' ? title.trim() : null;
      const cleanChannel =
        channel.trim() && channel !== 'Unknown channel' ? channel.trim() : null;

      const libraryAction: 'inserted' | 'updated' = idx >= 0 ? 'updated' : 'inserted';

      if (idx >= 0) {
        const prev = p.library[idx];
        p.library[idx] = {
          ...prev,
          title: cleanTitle ?? prev.title,
          channel: cleanChannel ?? prev.channel,
          ...(difficulty !== undefined ? { difficulty } : {}),
        };
      } else {
        p.library.push({
          videoId,
          title: cleanTitle ?? (title.trim() || 'Unknown title'),
          channel: cleanChannel ?? (channel.trim() || 'Unknown channel'),
          addedAt: Date.now(),
          difficulty: difficulty ?? null,
        });
      }
      await writePersisted(p);
      void enrichLibraryItemFromOEmbed(videoId, 'fill-unknown');
      const row = p.library.find((x) => x.videoId === videoId);
      if (!row) return { ok: false, error: 'Library write failed' };
      return {
        ok: true,
        libraryAction,
        title: row.title,
        channel: row.channel,
        difficulty: row.difficulty,
      };
    }
    case MSG.ENRICH_LIBRARY_META: {
      await enrichLibraryItemFromOEmbed(message.payload.videoId, 'overwrite');
      return { ok: true };
    }
    case MSG.REMOVE_LIBRARY: {
      const p = await readPersisted();
      p.library = p.library.filter((x) => x.videoId !== message.payload.videoId);
      await writePersisted(p);
      return { ok: true };
    }
    case MSG.SET_DIFFICULTY: {
      const p = await readPersisted();
      const item = p.library.find((x) => x.videoId === message.payload.videoId);
      if (item) {
        item.difficulty = message.payload.difficulty;
        await writePersisted(p);
      }
      return { ok: true };
    }
    case MSG.PRACTICE_TICK: {
      let { deltaSeconds } = message.payload;
      if (deltaSeconds <= 0) return { ok: true };
      if (deltaSeconds > MAX_TICK_SECONDS) deltaSeconds = MAX_TICK_SECONDS;
      const p = await readPersisted();
      const { videoId, endedAtMs } = message.payload;
      const key = dateKeyFromTimestamp(endedAtMs);
      p.dailySeconds[key] = (p.dailySeconds[key] ?? 0) + deltaSeconds;
      p.videoSeconds[videoId] = (p.videoSeconds[videoId] ?? 0) + deltaSeconds;
      await writePersisted(p);
      void maybeNotifyDailyGoalMet(p);
      return { ok: true };
    }
    case MSG.SET_SETTINGS: {
      const p = await readPersisted();
      const inc = message.payload;
      const { goals, ...rest } = inc;
      p.settings = ensureSettingsShape({ ...p.settings, ...rest });
      if (goals !== undefined && goals !== null && typeof goals === 'object' && !Array.isArray(goals)) {
        p.settings.goals = {
          ...p.settings.goals,
          ...goals,
        };
      }
      p.settings = ensureSettingsShape(p.settings);
      await writePersisted(p);
      rebuildContextMenusFromStorage();
      return { ok: true };
    }
    case MSG.CLEAR_ALL_EXTENSION_DATA: {
      await writePersisted(emptyPersisted());
      await ensureGoalCheckAlarm();
      return { ok: true };
    }
    case MSG.RESTORE_EXTENSION_STORAGE: {
      const incoming = message.payload;
      if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
        return { ok: false, error: 'Backup must be a JSON object.' };
      }
      try {
        const normalized: Record<string, unknown> = { ...incoming };
        if (Object.prototype.hasOwnProperty.call(normalized, STORAGE_KEY)) {
          normalized[STORAGE_KEY] = normalizeImportedPersisted(normalized[STORAGE_KEY]);
        }
        await chrome.storage.local.clear();
        await chrome.storage.local.set(normalized);
        await ensureGoalCheckAlarm();
        return { ok: true };
      } catch (e) {
        return {
          ok: false,
          error: e instanceof Error ? e.message : 'Could not restore backup.',
        };
      }
    }
    default:
      return { ok: false, error: 'Unknown message' };
  }
}
