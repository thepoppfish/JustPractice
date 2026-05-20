import {
  daysInCalendarMonth,
  defaultGoals,
  type LevelFramework,
  type LevelTag,
  type LibraryItem,
  type PracticeGoals,
} from '../lib/storage';
import {
  formatGoalPairLine,
  formatGoalSlash,
  ringDasharrayFromProgress,
} from '../lib/goalFormat';
import { escapeHtml } from '../lib/htmlEscape';
import { isLegacyLevelTag, isJlptTag, isCefrTag } from '../lib/levelTags';
import {
  defaultYearHeatmapKeysHtml,
  defaultYearHeatmapStatusLabel,
} from '../lib/yearHeatmapHtml';
import type { YearHeatmapDisplayColor } from '../lib/yearHeatmapCalendar';

export type DashTranslate = (key: string, params?: Record<string, string>) => string;

export function matchesLevel(
  item: LibraryItem,
  filter: '' | 'unset' | 'legacy' | LevelTag,
  fw: LevelFramework,
  customLevels: readonly string[],
): boolean {
  if (filter === '') return true;
  if (filter === 'unset') return item.difficulty === null;
  if (filter === 'legacy')
    return item.difficulty !== null && isLegacyLevelTag(item.difficulty, fw, customLevels);
  return item.difficulty === filter;
}

export function matchesLibrarySearch(item: LibraryItem, searchQuery: string): boolean {
  if (!searchQuery.trim()) return true;
  const q = searchQuery.toLowerCase();
  return (
    item.title.toLowerCase().includes(q) ||
    item.channel.toLowerCase().includes(q) ||
    item.videoId.toLowerCase().includes(q)
  );
}

export function libraryWelcomeHtml(t: DashTranslate): string {
  return `
    <div class="library-welcome" aria-live="polite">
      <div class="library-welcome-inner">
        <h3 class="library-welcome-title">${escapeHtml(t('dash.libraryWelcomeTitle'))}</h3>
        <p class="library-welcome-lead">
          ${escapeHtml(t('dash.libraryWelcomeLead'))}
        </p>
        <p class="library-welcome-hint">${escapeHtml(t('dash.libraryWelcomeHintOpen'))}<strong>${escapeHtml(t('panel.countPractice'))}</strong>${escapeHtml(t('dash.libraryWelcomeHintClose'))}</p>
        <a class="library-welcome-link" href="https://www.youtube.com" target="_blank" rel="noreferrer">${escapeHtml(t('dash.openYoutube'))}</a>
      </div>
    </div>`;
}

/** Done vs target line under rings */
function formatGoalFraction(done: number, target: number | null, t: DashTranslate): string {
  if (target === null || target <= 0) return t('dash.goalsNoTarget');
  return formatGoalPairLine(done, target);
}

function legacyBadgeFrameworkName(d: string, fw: LevelFramework, t: DashTranslate): string {
  if (fw === 'jlpt') return isCefrTag(d) ? t('framework.cefr') : t('framework.other');
  if (fw === 'cefr') return isJlptTag(d) ? t('framework.jlpt') : t('framework.other');
  if (isJlptTag(d)) return t('framework.jlpt');
  if (isCefrTag(d)) return t('framework.cefr');
  return t('framework.other');
}

export function difficultyLabelForCard(
  d: LevelTag | null,
  fw: LevelFramework,
  customLevels: readonly string[],
  t: DashTranslate,
): string {
  if (d === null) return t('common.unrated');
  if (!isLegacyLevelTag(d, fw, customLevels)) return d;
  const fwName = legacyBadgeFrameworkName(d, fw, t);
  return t('dash.legacyBadge', { framework: fwName, tag: d });
}

export function statBucketLabel(raw: string, t: DashTranslate): string {
  if (raw === 'Unrated') return t('common.unrated');
  if (raw === 'Legacy') return t('dash.bucketLegacy');
  return raw;
}

export function streakCaption(t: DashTranslate, streak: number): string {
  if (streak <= 0) return t('dash.streakNone');
  if (streak === 1) return t('dash.streakOne');
  return t('dash.streakMany', { n: String(streak) });
}

export function streakAriaLabel(t: DashTranslate, streak: number): string {
  if (streak <= 0) return t('dash.streakAriaNone');
  return t('dash.streakAria', { n: String(streak) });
}

export function yearHeatmapStatusLabel(
  t: DashTranslate,
  display: YearHeatmapDisplayColor,
  dateKey: string,
  seconds = 0,
  showTime = false,
): string {
  return defaultYearHeatmapStatusLabel(
    (key, params) => t(key, params),
    display,
    dateKey,
    seconds,
    showTime,
  );
}

export function yearHeatmapKeysHtml(t: DashTranslate, showGoalKey: boolean): string {
  return defaultYearHeatmapKeysHtml((key, params) => t(key, params), showGoalKey);
}

/** Weekly = daily×7; monthly = daily×days in this local calendar month (matches month progress sum). */
export function resolvedPracticeGoals(g: PracticeGoals): PracticeGoals {
  const d = g.dailyTargetSec;
  if (d === null || d <= 0) return defaultGoals();
  const now = Date.now();
  return {
    dailyTargetSec: d,
    weeklyTargetSec: d * 7,
    monthlyTargetSec: d * daysInCalendarMonth(now),
  };
}

export function goalRingCardHtml(
  title: string,
  doneSec: number,
  targetSec: number | null,
  t: DashTranslate,
): string {
  const has = targetSec !== null && targetSec > 0;
  const progress = has ? Math.min(1, doneSec / (targetSec as number)) : 0;
  const dashStr = ringDasharrayFromProgress(progress);
  const center = has ? formatGoalSlash(doneSec, targetSec as number) : '—';
  return `
    <div class="goal-ring-card">
      <span class="goal-ring-title">${escapeHtml(title)}</span>
      <div class="goal-ring-graphic" role="img" aria-hidden="true">
        <svg class="goal-ring-svg" viewBox="0 0 36 36">
          <circle class="goal-ring-bg" pathLength="100" cx="18" cy="18" r="15.9155" fill="none" stroke-width="3.2" />
          <circle
            class="goal-ring-fg"
            pathLength="100"
            cx="18"
            cy="18"
            r="15.9155"
            fill="none"
            stroke-width="3.2"
            stroke-dasharray="${dashStr}"
            stroke-dashoffset="0"
            transform="rotate(-90 18 18)"
          />
        </svg>
        <span class="goal-ring-center ${has ? '' : 'is-muted'}">${escapeHtml(center)}</span>
      </div>
      <span class="goal-ring-fraction">${escapeHtml(formatGoalFraction(doneSec, targetSec, t))}</span>
    </div>`;
}

export function formatCompletedDate(ms: number, locale: string): string {
  return new Date(ms).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function parseGoalMinutes(el: HTMLInputElement | null): number | null {
  if (!el) return null;
  const raw = el.value.trim();
  if (raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 60);
}

/** Local hour 0–23 for evening nudge; empty field → null (default 20 in notification logic). */
export function parseNudgeHour(el: HTMLInputElement | null): number | null {
  if (!el) return null;
  const raw = el.value.trim();
  if (raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  const r = Math.round(n);
  if (r < 0 || r > 23) return null;
  return r;
}
