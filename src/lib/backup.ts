import { normalizeImportedPersisted } from './storageMigrate';
import { SCHEMA_VERSION, STORAGE_KEY } from './storageTypes';

export const MAX_BACKUP_BYTES = 8 * 1024 * 1024;

export class BackupValidationError extends Error {
  constructor(public readonly reason: 'format' | 'version' | 'size' | 'data') {
    super(`Invalid JustPractice backup (${reason}). Your current data has not been changed.`);
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireData(condition: unknown): asserts condition {
  if (!condition) throw new BackupValidationError('data');
}

const finiteNonnegative = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= Number.MAX_SAFE_INTEGER;
const videoId = (v: string) => /^[\w-]{11}$/.test(v);
const dateKey = (v: string) => {
  const date = new Date(`${v}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === v;
};

function numberMap(value: unknown, validKey: (key: string) => boolean): void {
  requireData(record(value));
  for (const [key, seconds] of Object.entries(value)) {
    requireData(validKey(key) && finiteNonnegative(seconds));
  }
  requireData(finiteNonnegative(Object.values(value).reduce<number>((sum, seconds) => sum + (seconds as number), 0)));
}

/** Validate before migration so corrupt records are rejected instead of silently erased. */
export function prepareBackup(raw: unknown) {
  if (!record(raw) || !Object.prototype.hasOwnProperty.call(raw, STORAGE_KEY) || !record(raw[STORAGE_KEY])) {
    throw new BackupValidationError('format');
  }
  let bytes: number;
  try {
    bytes = new TextEncoder().encode(JSON.stringify(raw)).byteLength;
  } catch {
    throw new BackupValidationError('format');
  }
  if (bytes > MAX_BACKUP_BYTES) throw new BackupValidationError('size');
  const data = raw[STORAGE_KEY];
  if (!Number.isInteger(data.schemaVersion) || (data.schemaVersion as number) < 1 ||
      (data.schemaVersion as number) > SCHEMA_VERSION) {
    throw new BackupValidationError('version');
  }
  requireData(Array.isArray(data.library) && record(data.settings));
  const ids = new Set<string>();
  for (const item of data.library) {
    requireData(record(item) && typeof item.videoId === 'string' && videoId(item.videoId));
    requireData(!ids.has(item.videoId));
    ids.add(item.videoId);
    requireData(typeof item.title === 'string' && typeof item.channel === 'string' && finiteNonnegative(item.addedAt));
    requireData(item.difficulty == null || typeof item.difficulty === 'string');
    for (const key of ['durationSec', 'completedAt']) {
      requireData(item[key] == null || finiteNonnegative(item[key]));
    }
  }
  numberMap(data.dailySeconds, dateKey);
  numberMap(data.videoSeconds, videoId);
  if (data.videoPlaybackPositionSec !== undefined) numberMap(data.videoPlaybackPositionSec, videoId);
  if (data.videoDailySeconds !== undefined) {
    requireData(record(data.videoDailySeconds));
    for (const [id, days] of Object.entries(data.videoDailySeconds)) {
      requireData(videoId(id));
      numberMap(days, dateKey);
    }
  }
  const settings = data.settings;
  if (settings.levelFramework !== undefined) requireData(['jlpt', 'cefr', 'custom'].includes(settings.levelFramework as string));
  if (settings.uiLocale !== undefined) requireData(['auto', 'en', 'fr', 'ja', 'he', 'es', 'de'].includes(settings.uiLocale as string));
  for (const [key, value] of Object.entries(settings)) {
    if (['pauseWhenUnfocused', 'learningFocusHideRecommendations', 'yearHeatmapCalendar',
      'calendarShowPracticeTime', 'watchPanelCollapsed', 'goalNotificationsEnabled',
      'watchPanelXpToastsEnabled', 'dailyMotivationEnabled'].includes(key)) requireData(typeof value === 'boolean');
  }
  if (settings.displayName !== undefined) requireData(typeof settings.displayName === 'string');
  for (const key of ['customLevels', 'customDailyMessages']) {
    if (settings[key] !== undefined) requireData(Array.isArray(settings[key]) && settings[key].every(v => typeof v === 'string'));
  }
  if (settings.goals !== undefined) {
    requireData(record(settings.goals));
    for (const value of Object.values(settings.goals)) requireData(value === null || finiteNonnegative(value));
  }
  if (data.playerProgress !== undefined) {
    requireData(record(data.playerProgress));
    const p = data.playerProgress;
    for (const key of ['totalXp', 'lifetimeXp', 'prestigeLevel', 'practiceXpCarrySeconds']) {
      if (p[key] !== undefined) requireData(finiteNonnegative(p[key]));
    }
    if (p.achievements !== undefined) numberMap(p.achievements, key => key.length > 0 && key !== '__proto__');
    if (p.completeXpAwarded !== undefined) {
      requireData(record(p.completeXpAwarded));
      for (const [id, awarded] of Object.entries(p.completeXpAwarded)) requireData(videoId(id) && awarded === true);
    }
  }
  const normalized = normalizeImportedPersisted(data);
  return {
    storage: { ...raw, [STORAGE_KEY]: normalized },
    summary: {
      videos: normalized.library.length,
      completed: normalized.library.filter(item => item.completedAt !== null).length,
      minutes: Math.floor(Object.values(normalized.dailySeconds).reduce((sum, sec) => sum + sec, 0) / 60),
    },
  };
}
