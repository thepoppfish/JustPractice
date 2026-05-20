import { MSG } from '../lib/messages';
import type { ExtensionMessage, ExtensionResponse } from '../lib/messages';
import { isPlaceholderYoutubePageTitle } from '../lib/youtubePageTitle';
import {
  dateKeyFromTimestamp,
  ensureSettingsShape,
  normalizeImportedPersisted,
  readPersisted,
  STORAGE_KEY,
  writePersisted,
  emptyPersisted,
} from '../lib/storage';
import {
  ensureGoalCheckAlarm,
  maybeNotifyDailyGoalMet,
} from '../lib/goalNotifications';
import {
  processAchievementScan,
  processFirstCompleteXpEvent,
  processPracticeTickXpEvent,
  processPrestigeEvent,
} from '../lib/playerProgressEvents';
import { canPrestige, levelFromTotalXp } from '../lib/playerProgress';
import { maybeNotifyXpEvents, maybeNotifyPrestigeUp } from '../lib/xpNotifications';
import { enrichLibraryItemFromOEmbed } from './backgroundOEmbed';
import { rebuildContextMenusFromStorage } from './backgroundContextMenus';

const MAX_TICK_SECONDS = 120;

export async function handleBackgroundMessage(message: ExtensionMessage): Promise<ExtensionResponse> {
  switch (message.type) {
    case MSG.GET_STATE: {
      const data = await readPersisted();
      const achBefore = Object.keys(data.playerProgress.achievements).length;
      const xpResult = processAchievementScan(data);
      if (xpResult.newAchievements.length > 0 || Object.keys(data.playerProgress.achievements).length !== achBefore) {
        await writePersisted(data);
        void maybeNotifyXpEvents(data, xpResult);
      }
      return { ok: true, data };
    }
    case MSG.ADD_OR_UPDATE_LIBRARY: {
      const p = await readPersisted();
      const { videoId, title, channel, difficulty } = message.payload;
      const idx = p.library.findIndex((x) => x.videoId === videoId);
      const cleanTitle =
        title.trim() && title !== 'Unknown title' && !isPlaceholderYoutubePageTitle(title) ?
          title.trim()
        : null;
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
          completedAt: null,
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
    case MSG.SET_LIBRARY_COMPLETION: {
      const p = await readPersisted();
      const { videoId, complete, title, channel } = message.payload;
      const idx = p.library.findIndex((x) => x.videoId === videoId);
      const now = Date.now();
      const wasAlreadyComplete = idx >= 0 && p.library[idx].completedAt !== null;
      if (idx >= 0) {
        const prev = p.library[idx];
        const cleanTitle =
          title?.trim() && !isPlaceholderYoutubePageTitle(title) && title !== 'Unknown title' ?
            title.trim()
          : null;
        const cleanChannel =
          channel?.trim() && channel !== 'Unknown channel' ? channel.trim() : null;
        p.library[idx] = {
          ...prev,
          completedAt: complete ? now : null,
          title: cleanTitle ?? prev.title,
          channel: cleanChannel ?? prev.channel,
        };
      } else if (complete) {
        const rawTitle = title?.trim();
        const safeTitle =
          rawTitle && !isPlaceholderYoutubePageTitle(rawTitle) ? rawTitle : 'Unknown title';
        p.library.push({
          videoId,
          title: safeTitle,
          channel: channel?.trim() || 'Unknown channel',
          addedAt: now,
          difficulty: null,
          completedAt: now,
        });
      } else {
        return { ok: true, xpGained: 0, newAchievements: [], levelUp: false, newLevel: levelFromTotalXp(p.playerProgress.totalXp) };
      }
      let xpResult = {
        xpGained: 0,
        newAchievements: [] as string[],
        levelUp: false,
        newLevel: levelFromTotalXp(p.playerProgress.totalXp),
      };
      if (complete && !wasAlreadyComplete) {
        xpResult = processFirstCompleteXpEvent(p, videoId);
      } else {
        const scan = processAchievementScan(p);
        xpResult = scan;
      }
      await writePersisted(p);
      if (complete) {
        void enrichLibraryItemFromOEmbed(videoId, 'fill-unknown');
      }
      void maybeNotifyXpEvents(p, xpResult);
      return { ok: true, ...xpResult };
    }
    case MSG.PRACTICE_TICK: {
      let { deltaSeconds } = message.payload;
      if (deltaSeconds <= 0) {
        return {
          ok: true,
          xpGained: 0,
          newAchievements: [],
          levelUp: false,
          newLevel: levelFromTotalXp((await readPersisted()).playerProgress.totalXp),
        };
      }
      if (deltaSeconds > MAX_TICK_SECONDS) deltaSeconds = MAX_TICK_SECONDS;
      const p = await readPersisted();
      const { videoId, endedAtMs } = message.payload;
      const key = dateKeyFromTimestamp(endedAtMs);
      p.dailySeconds[key] = (p.dailySeconds[key] ?? 0) + deltaSeconds;
      p.videoSeconds[videoId] = (p.videoSeconds[videoId] ?? 0) + deltaSeconds;
      const xpResult = processPracticeTickXpEvent(p, deltaSeconds, endedAtMs);
      await writePersisted(p);
      void maybeNotifyDailyGoalMet(p);
      void maybeNotifyXpEvents(p, xpResult);
      return { ok: true, ...xpResult };
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
    case MSG.PRESTIGE: {
      const p = await readPersisted();
      if (!canPrestige(p.playerProgress)) {
        return { ok: false, error: 'Cannot prestige yet' };
      }
      const xpResult = processPrestigeEvent(p);
      if (!xpResult.prestigeUp) {
        return { ok: false, error: 'Cannot prestige yet' };
      }
      await writePersisted(p);
      void maybeNotifyXpEvents(p, xpResult);
      void maybeNotifyPrestigeUp(p, xpResult.prestigeLevel);
      return {
        ok: true,
        xpGained: 0,
        newAchievements: xpResult.newAchievements,
        levelUp: false,
        newLevel: levelFromTotalXp(p.playerProgress.totalXp),
        prestigeUp: true,
        prestigeLevel: xpResult.prestigeLevel,
      };
    }
    default:
      return { ok: false, error: 'Unknown message' };
  }
}
