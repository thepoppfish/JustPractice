/** Persisted shape in chrome.storage.local */

export const SCHEMA_VERSION = 6 as const;

export type JlptLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1';

export const JLPT_LEVELS: readonly JlptLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1'] as const;

export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export const CEFR_LEVELS: readonly CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

/** Stored per-video difficulty (JLPT, CEFR, or custom label). */
export type LevelTag = string;

/** Which level taxonomy the UI and new tags use (library may still hold “legacy” codes from the other family). */
export type LevelFramework = 'jlpt' | 'cefr' | 'custom';

export const MAX_CUSTOM_LEVELS = 15;
export const MAX_CUSTOM_LEVEL_LABEL_LEN = 32;

/** Starter list when “Custom” is chosen or the saved list is empty / invalid. */
export const DEFAULT_CUSTOM_LEVELS: readonly string[] = ['Beginner', 'Intermediate', 'Advanced'];

export type UiLocale = 'auto' | 'en' | 'fr' | 'ja' | 'he' | 'es' | 'de';

export interface LibraryItem {
  videoId: string;
  title: string;
  channel: string;
  addedAt: number;
  difficulty: LevelTag | null;
}

export interface PracticeGoals {
  /** Target practice seconds per calendar day; null = no goal */
  dailyTargetSec: number | null;
  /** Target per Mon–Sun week (same window as stats “this week”); typically daily×7 */
  weeklyTargetSec: number | null;
  /** Target for the full local calendar month at the daily rate (daily×days-in-month) */
  monthlyTargetSec: number | null;
}

export interface AppSettings {
  /** When true, practice seconds only count if the YouTube tab/window has focus */
  pauseWhenUnfocused: boolean;
  /** Saved position for the watch-page floating panel (viewport pixels). */
  watchPanelLeft?: number;
  watchPanelTop?: number;
  /** When true, only the top drag bar is shown (rest hidden). */
  watchPanelCollapsed?: boolean;
  goals: PracticeGoals;
  /** JLPT vs CEFR vs user-defined labels */
  levelFramework?: LevelFramework;
  /** Ordered labels when `levelFramework === 'custom'` (max {@link MAX_CUSTOM_LEVELS}). */
  customLevels?: string[];
  /** UI language preference */
  uiLocale?: UiLocale;
  /**
   * When true, show browser notifications for daily goal reached / evening nudge.
   * Uses the extension `notifications` permission (declared in the manifest).
   */
  goalNotificationsEnabled?: boolean;
  /** Local hour (0–23) to show the “still time today” nudge if the daily goal is not met */
  goalNudgeHourLocal?: number | null;
  /** yyyy-mm-dd — last local day we showed the “daily goal reached” notification */
  lastNotifiedGoalMetDate?: string | null;
  /** yyyy-mm-dd — last local day we showed the evening nudge */
  lastNotifiedGoalNudgeDate?: string | null;
}

export interface PersistedData {
  schemaVersion: number;
  library: LibraryItem[];
  /** yyyy-mm-dd — first calendar day we treat “missed practice” as meaningful (migration / inferred). */
  extensionInstalledDateKey: string;
  /** yyyy-mm-dd -> seconds practiced (when practice counting is enabled) */
  dailySeconds: Record<string, number>;
  /** videoId -> seconds (same metric as daily) */
  videoSeconds: Record<string, number>;
  settings: AppSettings;
}

export const STORAGE_KEY = 'jpPractice' as const;

/** Minimum logged seconds in a local day before it counts as “practiced” (green / streak / first-practice). */
export const MIN_DAY_PRACTICE_CREDIT_SECONDS = 60 as const;

export const defaultGoals = (): PracticeGoals => ({
  dailyTargetSec: null,
  weeklyTargetSec: null,
  monthlyTargetSec: null,
});

function normalizeGoalSec(x: unknown): number | null {
  if (x === null || x === undefined) return null;
  if (typeof x !== 'number' || !Number.isFinite(x) || x < 0) return null;
  return x;
}

function normalizeLevelFramework(x: unknown): LevelFramework {
  if (x === 'cefr' || x === 'jlpt' || x === 'custom') return x;
  return 'jlpt';
}

/** Allowed characters for custom level names and persisted non-JLPT/CEFR tags. */
export function isValidDifficultyLabel(t: string): boolean {
  if (t.length === 0 || t.length > MAX_CUSTOM_LEVEL_LABEL_LEN) return false;
  return /^[\p{L}\p{N}._+\-() ]+$/u.test(t);
}

export function normalizeCustomLevels(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [...DEFAULT_CUSTOM_LEVELS];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x !== 'string') continue;
    const trimmed = x.trim();
    if (!trimmed) continue;
    const t = trimmed.slice(0, MAX_CUSTOM_LEVEL_LABEL_LEN);
    if (!isValidDifficultyLabel(t)) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= MAX_CUSTOM_LEVELS) break;
  }
  return out.length > 0 ? out : [...DEFAULT_CUSTOM_LEVELS];
}

function normalizeUiLocale(x: unknown): UiLocale {
  if (x === 'en' || x === 'fr' || x === 'ja' || x === 'he' || x === 'es' || x === 'de' || x === 'auto') return x;
  return 'auto';
}

function normalizeNudgeHour(x: unknown): number | null {
  if (x === null || x === undefined) return null;
  if (typeof x !== 'number' || !Number.isFinite(x)) return null;
  const n = Math.round(x);
  if (n < 0 || n > 23) return null;
  return n;
}

/** Guarantees `goals` and required fields exist (fixes partial storage / bad merges). */
export function ensureSettingsShape(raw: AppSettings | Partial<AppSettings> | undefined): AppSettings {
  const base = defaultSettings();
  if (!raw || typeof raw !== 'object') return base;
  const gIn = raw.goals;
  const gMerge =
    gIn && typeof gIn === 'object' && !Array.isArray(gIn)
      ? { ...defaultGoals(), ...(gIn as unknown as Partial<PracticeGoals>) }
      : defaultGoals();
  const nh = normalizeNudgeHour(raw.goalNudgeHourLocal);
  const merged = { ...base, ...raw };
  return {
    ...merged,
    pauseWhenUnfocused:
      typeof raw.pauseWhenUnfocused === 'boolean' ? raw.pauseWhenUnfocused : base.pauseWhenUnfocused,
    levelFramework: normalizeLevelFramework(raw.levelFramework),
    customLevels: normalizeCustomLevels(
      raw.customLevels !== undefined ? raw.customLevels : base.customLevels,
    ),
    uiLocale: normalizeUiLocale(raw.uiLocale),
    goals: {
      dailyTargetSec: normalizeGoalSec(gMerge.dailyTargetSec),
      weeklyTargetSec: normalizeGoalSec(gMerge.weeklyTargetSec),
      monthlyTargetSec: normalizeGoalSec(gMerge.monthlyTargetSec),
    },
    goalNotificationsEnabled:
      typeof raw.goalNotificationsEnabled === 'boolean' ? raw.goalNotificationsEnabled : false,
    goalNudgeHourLocal: nh,
    lastNotifiedGoalMetDate:
      typeof raw.lastNotifiedGoalMetDate === 'string' ? raw.lastNotifiedGoalMetDate : null,
    lastNotifiedGoalNudgeDate:
      typeof raw.lastNotifiedGoalNudgeDate === 'string' ? raw.lastNotifiedGoalNudgeDate : null,
  };
}

export const defaultSettings = (): AppSettings => ({
  pauseWhenUnfocused: true,
  goals: defaultGoals(),
  levelFramework: 'jlpt',
  customLevels: [...DEFAULT_CUSTOM_LEVELS],
  uiLocale: 'auto',
  goalNotificationsEnabled: false,
  goalNudgeHourLocal: null,
  lastNotifiedGoalMetDate: null,
  lastNotifiedGoalNudgeDate: null,
});

export const emptyPersisted = (): PersistedData => {
  const t = dateKeyFromTimestamp(Date.now());
  return {
    schemaVersion: SCHEMA_VERSION,
    library: [],
    extensionInstalledDateKey: t,
    dailySeconds: {},
    videoSeconds: {},
    settings: defaultSettings(),
  };
};

const YMD_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** Earliest yyyy-mm-dd with at least {@link MIN_DAY_PRACTICE_CREDIT_SECONDS} logged. */
export function firstPositiveDailyDateKey(daily: Record<string, number>): string | null {
  let best: string | null = null;
  for (const [k, v] of Object.entries(daily)) {
    if (!YMD_KEY.test(k) || typeof v !== 'number' || v < MIN_DAY_PRACTICE_CREDIT_SECONDS) continue;
    if (best === null || k < best) best = k;
  }
  return best;
}

/**
 * First day we assume the user could have “missed” logging practice: max(install, first ≥1 min daily).
 * Null if they have never logged at least {@link MIN_DAY_PRACTICE_CREDIT_SECONDS} on any day.
 */
export function missTrackingStartDateKey(
  extensionInstalledDateKey: string,
  dailySeconds: Record<string, number>,
): string | null {
  const fp = firstPositiveDailyDateKey(dailySeconds);
  if (fp === null) return null;
  return extensionInstalledDateKey > fp ? extensionInstalledDateKey : fp;
}

/** yyyy-mm-dd inferred once for existing profiles (library / daily evidence, else today). */
export function inferExtensionInstalledDateKey(
  input: Pick<PersistedData, 'library' | 'dailySeconds'> & { extensionInstalledDateKey?: string | null },
): string {
  const ex = input.extensionInstalledDateKey;
  if (typeof ex === 'string' && YMD_KEY.test(ex)) return ex;
  const candidates: string[] = [dateKeyFromTimestamp(Date.now())];
  for (const item of input.library) {
    candidates.push(dateKeyFromTimestamp(item.addedAt));
  }
  for (const [dk, sec] of Object.entries(input.dailySeconds)) {
    if (typeof sec === 'number' && sec >= MIN_DAY_PRACTICE_CREDIT_SECONDS && YMD_KEY.test(dk)) candidates.push(dk);
  }
  return candidates.reduce((a, b) => (a < b ? a : b));
}

const PERSISTED_TOP_KEYS = new Set([
  'schemaVersion',
  'library',
  'extensionInstalledDateKey',
  'dailySeconds',
  'videoSeconds',
  'settings',
]);

/** True when stored blob includes legacy keys so we should rewrite a compact v4 payload. */
export function persistedNeedsCompactionRewrite(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const o = raw as Record<string, unknown>;
  for (const k of Object.keys(o)) {
    if (!PERSISTED_TOP_KEYS.has(k)) return true;
  }
  if (o.schemaVersion !== SCHEMA_VERSION) return true;
  if (Array.isArray(o.library)) {
    for (const item of o.library) {
      if (item && typeof item === 'object' && 'completedAt' in item) return true;
    }
  }
  return false;
}

export async function readPersisted(): Promise<PersistedData> {
  const raw = await chrome.storage.local.get(STORAGE_KEY);
  const blob = raw[STORAGE_KEY] as PersistedData | undefined;
  if (!blob) return emptyPersisted();
  const migrated = migrate(blob);
  migrated.settings = ensureSettingsShape(migrated.settings);
  if (persistedNeedsCompactionRewrite(blob)) {
    await writePersisted(migrated);
  }
  return migrated;
}

export async function writePersisted(data: PersistedData): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: data });
}

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

function normalizeLibraryItem(raw: unknown): LibraryItem {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    videoId: typeof o.videoId === 'string' ? o.videoId : '',
    title: typeof o.title === 'string' ? o.title : 'Unknown title',
    channel: typeof o.channel === 'string' ? o.channel : 'Unknown channel',
    addedAt: typeof o.addedAt === 'number' && Number.isFinite(o.addedAt) ? o.addedAt : Date.now(),
    difficulty: normalizeDifficulty(o.difficulty),
  };
}

function migrate(input: PersistedData): PersistedData {
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

  const settings = ensureSettingsShape({
    ...base.settings,
    ...incomingSettings,
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

  return {
    schemaVersion: SCHEMA_VERSION,
    library,
    extensionInstalledDateKey,
    dailySeconds,
    videoSeconds,
    settings,
  };
}

/** Normalize backup / imported blobs before writing to storage. */
export function normalizeImportedPersisted(raw: unknown): PersistedData {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return emptyPersisted();
  }
  return migrate(raw as PersistedData);
}

export function dateKeyFromTimestamp(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function secondsInRange(
  daily: Record<string, number>,
  startMs: number,
  endMs: number,
): number {
  let total = 0;
  const cur = new Date(startMs);
  const end = new Date(endMs);
  while (cur <= end) {
    const key = dateKeyFromTimestamp(cur.getTime());
    total += daily[key] ?? 0;
    cur.setDate(cur.getDate() + 1);
  }
  return total;
}

export function startOfCalendarMonth(ms: number): number {
  const d = new Date(ms);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Days in the local calendar month containing `ms` (28–31). */
export function daysInCalendarMonth(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

export function startOfWeekMonday(ms: number): number {
  const d = new Date(ms);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
