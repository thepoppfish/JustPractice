/** Types, defaults, and date/goal helpers for persisted storage. */
/** Persisted shape in chrome.storage.local */

export const SCHEMA_VERSION = 15 as const;

export const MAX_DISPLAY_NAME_LEN = 40 as const;
export const MAX_CUSTOM_DAILY_MESSAGES = 10 as const;
export const MAX_CUSTOM_DAILY_MESSAGE_LEN = 200 as const;

const HISTORICAL_XP_BACKFILL_CAP = 50_000;

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
  /** Unix ms when the user marked the video complete; null = not completed. */
  completedAt: number | null;
  /** YouTube video length in seconds; null until captured on watch or enriched. */
  durationSec: number | null;
}

/** Cached dashboard “Today” path for the current local day. */
export interface TodayPathPlan {
  dateKey: string;
  remainingSecAtBuild: number;
  builtAtMs: number;
  steps: {
    videoId: string;
    durationSec: number;
    allocatedSec: number;
    videoSecondsBaseline: number;
    /** Practice on this video today when the plan was built. */
    videoDailyBaselineAtBuild?: number;
    /** Practice/playback already on this video when the plan was built (counts toward the step). */
    creditedSecAtBuild?: number;
  }[];
}

/** Frozen roadmap trail after plan complete or daily goal met (same local day). */
export interface RoadmapCompletionSnapshot {
  dateKey: string;
  completedAtMs: number;
  dailyGoalSec: number;
  todayPracticeSecAtComplete: number;
  planComplete: boolean;
  dailyGoalMetAtComplete: boolean;
  /** Set after the dashboard completion animation has played (same day). */
  celebrationShownAtMs?: number;
  steps: {
    videoId: string;
    durationSec: number;
    allocatedSec: number;
    practicedSecOnStep: number;
    title: string;
    channel: string;
    difficulty: LevelTag | null;
    side: 'left' | 'right' | 'center';
  }[];
}

export type RoadmapBonusTier = 'short' | 'medium' | 'long';

/** Optional bonus watch after roadmap complete (same local day). */
export interface RoadmapBonusPick {
  dateKey: string;
  videoId: string;
  tier: RoadmapBonusTier;
  multiplier: number;
  pickedAtMs: number;
  /** Lifetime videoSeconds when the pick was made (lock after practice increases). */
  videoSecondsBaselineAtPick: number;
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
  /**
   * On `/watch` only: hide sidebar recommendations when the current video is in the library.
   * Does not apply to Shorts, theater, or mini player layouts.
   */
  learningFocusHideRecommendations?: boolean;
  /**
   * When true (default), use the year heatmap on the watch panel instead of the month grid.
   * Kept for storage compatibility; there is no UI to turn this off.
   */
  yearHeatmapCalendar?: boolean;
  /** When true, calendar tooltips / month cells include logged practice duration. */
  calendarShowPracticeTime?: boolean;
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
  /**
   * When true (default), show browser notifications for account level-up / achievements.
   * Phase 2+ UI may expose this toggle.
   */
  xpNotificationsEnabled?: boolean;
  /**
   * When true (default), show the watch-panel +XP toast and status flash each time practice XP is earned (~every minute).
   * Rank-up feedback still shows when this is off.
   */
  watchPanelXpToastsEnabled?: boolean;
  /** Shown in dashboard greeting (Hello, {name}). */
  displayName?: string;
  /** User-authored lines mixed into daily motivation rotation. */
  customDailyMessages?: string[];
  /** When false, hide the daily quote under the greeting. */
  dailyMotivationEnabled?: boolean;
}

/** Account-level XP / achievements (not video difficulty / LevelTag). */
export interface PlayerProgress {
  /** XP in the current prestige cycle (source of truth for rank). Resets on prestige. */
  totalXp: number;
  /** All XP ever earned across every cycle; never decreases. */
  lifetimeXp: number;
  /** Prestige count: 0 = never prestiged; 1 after first prestige; max 10. */
  prestigeLevel: number;
  /** achievementId -> unlockedAt Unix ms */
  achievements: Record<string, number>;
  /** yyyy-mm-dd — already granted daily-goal XP bonus */
  lastDailyGoalXpDateKey: string | null;
  /** yyyy-mm-dd — already granted streak-day XP bonus */
  lastStreakXpDateKey: string | null;
  /** videoIds that already received first-complete XP */
  completeXpAwarded: Record<string, true>;
  /** Sub-minute practice seconds banked toward the next practice XP minute. */
  practiceXpCarrySeconds: number;
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
  /** videoId -> farthest playback position seen on YouTube (seconds). */
  videoPlaybackPositionSec: Record<string, number>;
  /** videoId -> dateKey -> seconds practiced that day (for Today path steps). */
  videoDailySeconds: Record<string, Record<string, number>>;
  settings: AppSettings;
  playerProgress: PlayerProgress;
  /** Roadmap plan; rebuilt on new day or regenerate. */
  todayPathPlan?: TodayPathPlan | null;
  /** Completed roadmap trail for the current day. */
  roadmapCompletionSnapshot?: RoadmapCompletionSnapshot | null;
  roadmapBonusPick?: RoadmapBonusPick | null;
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

export function normalizeDisplayName(x: unknown): string {
  if (typeof x !== 'string') return '';
  return x.trim().slice(0, MAX_DISPLAY_NAME_LEN);
}

export function normalizeCustomDailyMessages(x: unknown): string[] {
  if (!Array.isArray(x)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of x) {
    if (typeof item !== 'string') continue;
    const line = item.trim().slice(0, MAX_CUSTOM_DAILY_MESSAGE_LEN);
    if (!line || seen.has(line)) continue;
    seen.add(line);
    out.push(line);
    if (out.length >= MAX_CUSTOM_DAILY_MESSAGES) break;
  }
  return out;
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
    learningFocusHideRecommendations:
      typeof raw.learningFocusHideRecommendations === 'boolean'
        ? raw.learningFocusHideRecommendations
        : base.learningFocusHideRecommendations,
    yearHeatmapCalendar:
      typeof raw.yearHeatmapCalendar === 'boolean' ? raw.yearHeatmapCalendar : base.yearHeatmapCalendar,
    calendarShowPracticeTime:
      typeof raw.calendarShowPracticeTime === 'boolean'
        ? raw.calendarShowPracticeTime
        : base.calendarShowPracticeTime,
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
    xpNotificationsEnabled:
      typeof raw.xpNotificationsEnabled === 'boolean' ? raw.xpNotificationsEnabled : true,
    watchPanelXpToastsEnabled:
      typeof raw.watchPanelXpToastsEnabled === 'boolean'
        ? raw.watchPanelXpToastsEnabled
        : base.watchPanelXpToastsEnabled,
    goalNudgeHourLocal: nh,
    lastNotifiedGoalMetDate:
      typeof raw.lastNotifiedGoalMetDate === 'string' ? raw.lastNotifiedGoalMetDate : null,
    lastNotifiedGoalNudgeDate:
      typeof raw.lastNotifiedGoalNudgeDate === 'string' ? raw.lastNotifiedGoalNudgeDate : null,
    displayName: normalizeDisplayName(raw.displayName),
    customDailyMessages: normalizeCustomDailyMessages(raw.customDailyMessages),
    dailyMotivationEnabled:
      typeof raw.dailyMotivationEnabled === 'boolean' ? raw.dailyMotivationEnabled : true,
  };
}

export const defaultSettings = (): AppSettings => ({
  pauseWhenUnfocused: true,
  learningFocusHideRecommendations: true,
  yearHeatmapCalendar: true,
  calendarShowPracticeTime: false,
  goals: defaultGoals(),
  levelFramework: 'jlpt',
  customLevels: [...DEFAULT_CUSTOM_LEVELS],
  uiLocale: 'auto',
  goalNotificationsEnabled: false,
  goalNudgeHourLocal: null,
  lastNotifiedGoalMetDate: null,
  lastNotifiedGoalNudgeDate: null,
  xpNotificationsEnabled: true,
  watchPanelXpToastsEnabled: true,
  displayName: '',
  customDailyMessages: [],
  dailyMotivationEnabled: true,
});

export function dateKeyFromTimestamp(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const emptyPersisted = (): PersistedData => {
  const t = dateKeyFromTimestamp(Date.now());
  return {
    schemaVersion: SCHEMA_VERSION,
    library: [],
    extensionInstalledDateKey: t,
    dailySeconds: {},
    videoSeconds: {},
    videoPlaybackPositionSec: {},
    videoDailySeconds: {},
    settings: defaultSettings(),
    playerProgress: defaultPlayerProgress(),
    todayPathPlan: null,
    roadmapCompletionSnapshot: null,
    roadmapBonusPick: null,
  };
};

export function defaultPlayerProgress(): PlayerProgress {
  return {
    totalXp: 0,
    lifetimeXp: 0,
    prestigeLevel: 0,
    achievements: {},
    lastDailyGoalXpDateKey: null,
    lastStreakXpDateKey: null,
    completeXpAwarded: {},
    practiceXpCarrySeconds: 0,
  };
}

function historicalPracticeBackfillXp(dailySeconds: Record<string, number>): number {
  const totalSec = Object.values(dailySeconds).reduce(
    (a, b) => a + (typeof b === 'number' ? b : 0),
    0,
  );
  const raw = Math.floor(totalSec / 60);
  return Math.min(HISTORICAL_XP_BACKFILL_CAP, raw);
}

export function normalizePlayerProgress(raw: unknown, priorSchema: number, dailySeconds: Record<string, number>): PlayerProgress {
  const base = defaultPlayerProgress();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    if (priorSchema < 8) {
      base.totalXp = historicalPracticeBackfillXp(dailySeconds);
    }
    base.lifetimeXp = base.totalXp;
    return base;
  }
  const o = raw as Record<string, unknown>;
  const totalXp =
    typeof o.totalXp === 'number' && Number.isFinite(o.totalXp) && o.totalXp >= 0
      ? Math.floor(o.totalXp)
      : priorSchema < 8
        ? historicalPracticeBackfillXp(dailySeconds)
        : 0;

  const achievements: Record<string, number> = {};
  if (o.achievements && typeof o.achievements === 'object' && !Array.isArray(o.achievements)) {
    for (const [k, v] of Object.entries(o.achievements as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) achievements[k] = v;
    }
  }

  const completeXpAwarded: Record<string, true> = {};
  if (o.completeXpAwarded && typeof o.completeXpAwarded === 'object' && !Array.isArray(o.completeXpAwarded)) {
    for (const k of Object.keys(o.completeXpAwarded as Record<string, unknown>)) {
      if (typeof k === 'string' && k) completeXpAwarded[k] = true;
    }
  }
  const legacyIds = o.completeXpAwardedVideoIds;
  if (Array.isArray(legacyIds)) {
    for (const id of legacyIds) {
      if (typeof id === 'string' && id) completeXpAwarded[id] = true;
    }
  }

  const lifetimeXp =
    typeof o.lifetimeXp === 'number' && Number.isFinite(o.lifetimeXp) && o.lifetimeXp >= 0
      ? Math.floor(o.lifetimeXp)
      : totalXp;

  const prestigeLevel =
    typeof o.prestigeLevel === 'number' && Number.isFinite(o.prestigeLevel) && o.prestigeLevel >= 0
      ? Math.min(10, Math.floor(o.prestigeLevel))
      : 0;

  const practiceXpCarrySeconds =
    typeof o.practiceXpCarrySeconds === 'number' &&
    Number.isFinite(o.practiceXpCarrySeconds) &&
    o.practiceXpCarrySeconds >= 0
      ? Math.min(59, Math.floor(o.practiceXpCarrySeconds))
      : 0;

  return {
    totalXp,
    lifetimeXp,
    prestigeLevel,
    achievements,
    lastDailyGoalXpDateKey:
      typeof o.lastDailyGoalXpDateKey === 'string' ? o.lastDailyGoalXpDateKey : null,
    lastStreakXpDateKey: typeof o.lastStreakXpDateKey === 'string' ? o.lastStreakXpDateKey : null,
    completeXpAwarded,
    practiceXpCarrySeconds,
  };
}

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
  'videoPlaybackPositionSec',
  'videoDailySeconds',
  'todayPathPlan',
  'roadmapCompletionSnapshot',
  'roadmapBonusPick',
  'settings',
  'playerProgress',
]);

function playerProgressNeedsLifetimeXpRewrite(pp: unknown): boolean {
  if (!pp || typeof pp !== 'object' || Array.isArray(pp)) return true;
  const o = pp as Record<string, unknown>;
  return (
    typeof o.lifetimeXp !== 'number' || !Number.isFinite(o.lifetimeXp) || o.lifetimeXp < 0
  );
}

/** True when stored blob includes legacy keys so we should rewrite a compact v4 payload. */
export function persistedNeedsCompactionRewrite(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const o = raw as Record<string, unknown>;
  for (const k of Object.keys(o)) {
    if (!PERSISTED_TOP_KEYS.has(k)) return true;
  }
  if (playerProgressNeedsLifetimeXpRewrite(o.playerProgress)) return true;
  return o.schemaVersion !== SCHEMA_VERSION;
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
