import { normalizeRoadmapBonusPick } from './roadmapBonusVideo';
import { normalizeRoadmapCompletionSnapshot } from './roadmapCompletionSnapshot';
import { normalizeTodayPathPlan } from './todayPathPlan';
import { normalizeVideoDailySeconds } from './videoDailyPractice';
import {
  SCHEMA_VERSION,
  CEFR_LEVELS,
  JLPT_LEVELS,
  defaultGoals,
  defaultPlayerProgress,
  defaultSettings,
  emptyPersisted,
  ensureSettingsShape,
  inferExtensionInstalledDateKey,
  isValidDifficultyLabel,
  normalizePlayerProgress,
  type AppSettings,
  type LevelTag,
  type LibraryItem,
  type PersistedData,
  type PracticeGoals,
} from './storageTypes';

function normalizeDifficulty(x: unknown): LevelTag | null {
  if (x === null || x === undefined) return null;
  if (typeof x !== 'string') return null;
  const s = x.trim();
  if (!s) return null;
  if ((JLPT_LEVELS as readonly string[]).includes(s)) return s;
  if ((CEFR_LEVELS as readonly string[]).includes(s)) return s;
  if (/^N\d/.test(s)) return null;
  if (isValidDifficultyLabel(s)) return s;
  return null;
}

function normalizeCompletedAt(x: unknown): number | null {
  if (x === null || x === undefined) return null;
  if (typeof x !== 'number' || !Number.isFinite(x) || x <= 0) return null;
  return x;
}

function normalizeVideoPlaybackPositionSec(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [videoId, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!videoId || typeof v !== 'number' || !Number.isFinite(v) || v <= 0) continue;
    out[videoId] = Math.floor(v);
  }
  return out;
}

function normalizeDurationSec(x: unknown): number | null {
  if (x === null || x === undefined) return null;
  if (typeof x !== 'number' || !Number.isFinite(x) || x <= 0) return null;
  return Math.floor(x);
}

function normalizeLibraryItem(raw: unknown): LibraryItem {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    videoId: typeof o.videoId === 'string' ? o.videoId : '',
    title: typeof o.title === 'string' ? o.title : 'Unknown title',
    channel: typeof o.channel === 'string' ? o.channel : 'Unknown channel',
    addedAt: typeof o.addedAt === 'number' && Number.isFinite(o.addedAt) ? o.addedAt : Date.now(),
    difficulty: normalizeDifficulty(o.difficulty),
    completedAt: normalizeCompletedAt(o.completedAt),
    durationSec: normalizeDurationSec(o.durationSec),
  };
}

export function isLibraryItemCompleted(item: LibraryItem): boolean {
  return item.completedAt !== null;
}

export function completedLibraryItems(library: LibraryItem[]): LibraryItem[] {
  return library.filter(isLibraryItemCompleted);
}

export function inProgressLibraryItems(library: LibraryItem[]): LibraryItem[] {
  return library.filter((item) => !isLibraryItemCompleted(item));
}
export function migrate(input: PersistedData): PersistedData {
  const base = emptyPersisted();
  const libraryRaw = Array.isArray(input.library) ? input.library : [];
  const library = libraryRaw.map(normalizeLibraryItem);

  const incomingSettings: Partial<AppSettings> =
    input.settings && typeof input.settings === 'object' && !Array.isArray(input.settings)
      ? (input.settings as Partial<AppSettings>)
      : {};
  const goalsIn =
    incomingSettings.goals &&
    typeof incomingSettings.goals === 'object' &&
    !Array.isArray(incomingSettings.goals)
      ? incomingSettings.goals
      : {};

  const dailySeconds =
    input.dailySeconds && typeof input.dailySeconds === 'object' ? { ...input.dailySeconds } : {};
  const videoSeconds =
    input.videoSeconds && typeof input.videoSeconds === 'object' ? { ...input.videoSeconds } : {};
  const videoPlaybackPositionSec = normalizeVideoPlaybackPositionSec(
    (input as PersistedData).videoPlaybackPositionSec,
  );
  const videoDailySeconds = normalizeVideoDailySeconds(
    (input as PersistedData).videoDailySeconds,
  );

  const settings = ensureSettingsShape({
    ...base.settings,
    ...incomingSettings,
    yearHeatmapCalendar: true,
    goals: {
      ...defaultGoals(),
      ...goalsIn,
    },
  });

  const extensionInstalledDateKey = inferExtensionInstalledDateKey({
    library,
    dailySeconds,
    extensionInstalledDateKey: (input as PersistedData).extensionInstalledDateKey,
  });

  const priorSchema =
    typeof input.schemaVersion === 'number' && Number.isFinite(input.schemaVersion)
      ? input.schemaVersion
      : 0;

  const todayPathPlan = normalizeTodayPathPlan((input as PersistedData).todayPathPlan);
  const roadmapCompletionSnapshot = normalizeRoadmapCompletionSnapshot(
    (input as PersistedData).roadmapCompletionSnapshot,
  );
  const roadmapBonusPick = normalizeRoadmapBonusPick((input as PersistedData).roadmapBonusPick);

  return {
    schemaVersion: SCHEMA_VERSION,
    library,
    extensionInstalledDateKey,
    dailySeconds,
    videoSeconds,
    videoPlaybackPositionSec,
    videoDailySeconds,
    settings,
    playerProgress: normalizePlayerProgress(
      (input as PersistedData).playerProgress,
      priorSchema,
      dailySeconds,
    ),
    todayPathPlan,
    roadmapCompletionSnapshot,
    roadmapBonusPick,
  };
}

/** Normalize backup / imported blobs before writing to storage. */
export function normalizeImportedPersisted(raw: unknown): PersistedData {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return emptyPersisted();
  }
  return migrate(raw as PersistedData);
}
