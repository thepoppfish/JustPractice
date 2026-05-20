import {
  dateKeyFromTimestamp,
  defaultGoals,
  defaultSettings,
  ensureSettingsShape,
  inProgressLibraryItems,
  isLibraryItemCompleted,
  missTrackingStartDateKey,
  type AppSettings,
  type LevelFramework,
  type LevelTag,
  type LibraryItem,
  type PersistedData,
  type PracticeGoals,
} from '../lib/storage';
import {
  aggregatePracticeStats,
  lastNDaysBuckets,
  libraryRowsWithPracticeSeconds,
  practiceStreakDays,
  secondsByLevelBucket,
  secondsThisCalendarMonth,
  type DayBucket,
} from '../lib/practiceStats';
import {
  canPrestige,
  isWeekendPracticeBonusActive,
  levelFromTotalXp,
  MAX_ACCOUNT_LEVEL,
  MAX_PRESTIGE_LEVEL,
  PRESTIGE_XP_BONUS_PER_LEVEL,
  xpIntoCurrentLevel,
} from '../lib/playerProgress';
import {
  ACHIEVEMENT_CATEGORY_ORDER,
  groupedAchievementsForUi,
  type AchievementCategory,
  type AchievementUiSection,
} from '../lib/achievements';
import { escapeAttr, escapeHtml } from '../lib/htmlEscape';
import { tagsForFramework, isLegacyLevelTag } from '../lib/levelTags';
import {
  createTranslator,
  resolveLocale,
  type ResolvedLocale,
  type Translator,
} from '../i18n';
import {
  matchesLevel,
  matchesLibrarySearch,
  resolvedPracticeGoals,
} from './dashboardFormatters';

export type DashView = 'library' | 'completed' | 'stats' | 'progress' | 'goals' | 'settings';

export interface DashboardViewModel {
  data: PersistedData;
  st: AppSettings;
  fw: LevelFramework;
  customLevels: readonly string[];
  resolvedLocale: ResolvedLocale;
  resolvedBrowserDefault: ResolvedLocale;
  t: Translator;
  /** Sanitized; assign back to dashboard module state when it differs from the raw filter. */
  libraryLevelFilter: '' | 'unset' | 'legacy' | LevelTag;

  today: number;
  week: number;
  all: number;
  monthSec: number;
  goals: PracticeGoals;
  rg: PracticeGoals;
  days7: DayBucket[];
  maxDaySec: number;
  dailyGoalSec: number | null;
  todayKey: string;
  streak: number;
  yearHeatmapYear: number;
  calendarShowPracticeTime: boolean;
  byLevel: { label: string; seconds: number }[];
  hasLegacyVideos: boolean;
  rows: Array<{ item: LibraryItem; seconds: number }>;
  completedRows: Array<{ item: LibraryItem; seconds: number }>;
  /** Saved videos still in the library tab (not completed). */
  libraryCount: number;
  completedCount: number;
  taggedCount: number;
  filterChipsInner: string;

  accountLevel: number;
  totalXp: number;
  lifetimeXp: number;
  prestigeLevel: number;
  canPrestige: boolean;
  isPrestigeMaster: boolean;
  prestigeXpBonusPercent: number;
  xpIntoLevel: number;
  xpNeededForNext: number;
  levelProgressPercent: number;
  weekendXpActive: boolean;
  achievementSections: AchievementUiSection[];
  achievementCategories: AchievementCategory[];

  navItemClass: (view: DashView) => string;
  viewPanelClass: (view: DashView) => string;
}

function compareCompletedLibraryRows(
  a: { item: LibraryItem; seconds: number },
  b: { item: LibraryItem; seconds: number },
): number {
  const aCompleted = a.item.completedAt ?? 0;
  const bCompleted = b.item.completedAt ?? 0;
  if (bCompleted !== aCompleted) return bCompleted - aCompleted;
  const byTitle = a.item.title.localeCompare(b.item.title, undefined, { sensitivity: 'base' });
  if (byTitle !== 0) return byTitle;
  return b.item.addedAt - a.item.addedAt;
}

export function buildDashboardViewModel(input: {
  data: PersistedData;
  libraryLevelFilter: '' | 'unset' | 'legacy' | LevelTag;
  searchQuery: string;
  activeView: DashView;
  yearHeatmapYear: number;
}): DashboardViewModel {
  const { data, searchQuery, activeView } = input;
  const st = ensureSettingsShape({ ...defaultSettings(), ...data.settings });
  const fw = st.levelFramework ?? 'jlpt';
  const customLevels = st.customLevels ?? [];
  const resolvedLocale = resolveLocale(st.uiLocale);
  const t = createTranslator(resolvedLocale);
  const resolvedBrowserDefault = resolveLocale('auto');

  let libraryLevelFilter = input.libraryLevelFilter;
  const validFilterTags = new Set(tagsForFramework(fw, customLevels));
  if (
    libraryLevelFilter !== '' &&
    libraryLevelFilter !== 'unset' &&
    libraryLevelFilter !== 'legacy' &&
    !validFilterTags.has(libraryLevelFilter)
  ) {
    libraryLevelFilter = '';
  }

  const { today, week, all } = aggregatePracticeStats(data);
  const monthSec = secondsThisCalendarMonth(data);
  const goals = data.settings.goals ?? defaultGoals();
  const rg = resolvedPracticeGoals(goals);
  const days7 = lastNDaysBuckets(data, 7, resolvedLocale);
  const maxDaySec = Math.max(1, ...days7.map((d) => d.seconds));
  const dailyGoalSec =
    goals.dailyTargetSec != null && goals.dailyTargetSec > 0 ? goals.dailyTargetSec : null;
  const todayKey = dateKeyFromTimestamp(Date.now());
  const missStart = missTrackingStartDateKey(data.extensionInstalledDateKey, data.dailySeconds);
  const streak = practiceStreakDays(data.dailySeconds, Date.now(), missStart);
  const byLevel = secondsByLevelBucket(data, fw, customLevels);
  const inProgress = inProgressLibraryItems(data.library);
  const hasLegacyVideos = inProgress.some(
    (it) => it.difficulty !== null && isLegacyLevelTag(it.difficulty, fw, customLevels),
  );
  const rows = libraryRowsWithPracticeSeconds(data)
    .filter((r) => !isLibraryItemCompleted(r.item))
    .filter((r) => matchesLevel(r.item, libraryLevelFilter, fw, customLevels))
    .filter((r) => matchesLibrarySearch(r.item, searchQuery))
    .sort((a, b) => b.item.addedAt - a.item.addedAt);
  const completedRows = data.library
    .map((item) => ({
      item,
      seconds: data.videoSeconds[item.videoId] ?? 0,
    }))
    .filter((r) => isLibraryItemCompleted(r.item))
    .filter((r) => matchesLibrarySearch(r.item, searchQuery))
    .sort(compareCompletedLibraryRows);
  const libraryCount = inProgress.length;
  const completedCount = data.library.filter(isLibraryItemCompleted).length;
  const taggedCount = inProgress.filter((x) => x.difficulty !== null).length;

  const pp = data.playerProgress;
  const totalXp = pp.totalXp;
  const lifetimeXp =
    typeof pp.lifetimeXp === 'number' && Number.isFinite(pp.lifetimeXp) && pp.lifetimeXp >= 0
      ? pp.lifetimeXp
      : totalXp;
  const prestigeLevel = pp.prestigeLevel;
  const accountLevel = levelFromTotalXp(totalXp);
  const levelBar = xpIntoCurrentLevel(totalXp);
  const canPrestigeNow = canPrestige(pp);
  const isPrestigeMaster = prestigeLevel >= MAX_PRESTIGE_LEVEL;
  const prestigeXpBonusPercent = Math.round(prestigeLevel * PRESTIGE_XP_BONUS_PER_LEVEL * 100);
  const weekendXpActive = isWeekendPracticeBonusActive();
  const achievementSections = groupedAchievementsForUi(pp);
  const achievementCategories = ACHIEVEMENT_CATEGORY_ORDER.filter((cat) =>
    achievementSections.some((s) => s.category === cat),
  );

  const filterChipsInner = `
              <button type="button" class="filter-chip ${libraryLevelFilter === '' ? 'is-active' : ''}" data-level-filter="all">${escapeHtml(t('dash.filterAll'))}</button>
              <button type="button" class="filter-chip ${libraryLevelFilter === 'unset' ? 'is-active' : ''}" data-level-filter="unset">${escapeHtml(t('common.unrated'))}</button>
              ${tagsForFramework(fw, customLevels)
                .map(
                  (L) =>
                    `<button type="button" class="filter-chip ${libraryLevelFilter === L ? 'is-active' : ''}" data-level-filter="${escapeAttr(L)}">${escapeHtml(L)}</button>`,
                )
                .join('')}
              ${
                hasLegacyVideos
                  ? `<button type="button" class="filter-chip ${libraryLevelFilter === 'legacy' ? 'is-active' : ''}" data-level-filter="legacy">${escapeHtml(t('dash.filterLegacy'))}</button>`
                  : ''
              }`;

  const navItemClass = (v: DashView) =>
    activeView === v ? 'nav-item is-active' : 'nav-item';
  const viewPanelClass = (v: DashView) =>
    activeView === v ? 'view view--active' : 'view view--hidden';

  return {
    data,
    st,
    fw,
    customLevels,
    resolvedLocale,
    resolvedBrowserDefault,
    t,
    libraryLevelFilter,
    today,
    week,
    all,
    monthSec,
    goals,
    rg,
    days7,
    maxDaySec,
    dailyGoalSec,
    todayKey,
    streak,
    yearHeatmapYear: input.yearHeatmapYear,
    calendarShowPracticeTime: st.calendarShowPracticeTime === true,
    byLevel,
    hasLegacyVideos,
    rows,
    completedRows,
    libraryCount,
    completedCount,
    taggedCount,
    accountLevel,
    totalXp,
    lifetimeXp,
    prestigeLevel,
    canPrestige: canPrestigeNow,
    isPrestigeMaster,
    prestigeXpBonusPercent,
    xpIntoLevel: levelBar.xpIntoLevel,
    xpNeededForNext: levelBar.xpNeededForNext,
    levelProgressPercent: levelBar.progressPercent,
    weekendXpActive,
    achievementSections,
    achievementCategories,
    filterChipsInner,
    navItemClass,
    viewPanelClass,
  };
}
