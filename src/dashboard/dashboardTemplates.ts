import { APP_NAME, appIconUrl } from '../lib/branding';
import {
  calendarDayBottomLabel,
  chartBarHeightPx,
  practiceCalendarDayVisual,
} from '../lib/practiceStats';
import { escapeAttr, escapeHtml } from '../lib/htmlEscape';
import { libraryMetricsHtml, librarySecondaryActionsHtml, playbackForLibraryItem } from '../lib/libraryPresentation';
import { tagsForFramework } from '../lib/levelTags';
import type { LibraryItem } from '../lib/storage';
import { thumbnailUrlForVideoId } from '../lib/youtubeMeta';
import {
  formatLocaleOptionLabel,
  languageLabelForLocale,
  LOCALE_DROPDOWN,
} from '../i18n';
import {
  dashWelcomeHtml,
  libraryWelcomeHtml,
  difficultyLabelForCard,
  formatCompletedDate,
  statBucketLabel,
  streakCaption,
  streakAriaLabel,
  goalRingCardHtml,
  progressXpGuideHtml,
  yearHeatmapStatusLabel,
} from './dashboardFormatters';
import { buildYearHeatmapGridModel, yearHeatmapSectionHtml } from '../lib/yearHeatmapHtml';
import type { DashboardViewModel } from './dashboardViewModel';
import { dashboardPathSectionHtml } from './dashboardPathSection';
import { ringDasharrayFromProgress } from '../lib/goalFormat';
import { MAX_ACCOUNT_LEVEL } from '../lib/playerProgress';
import { formatPracticeDuration } from '../lib/practiceDuration';
import { dashboardStatsSummaryHtml } from './dashboardStatsSummary';
import {
  icoTarget,
  icoSearch,
  icoRocket,
  icoBook,
  icoTag,
  icoLibrary,
  icoChart,
  icoGear,
  icoCheck,
  icoTrophy,
  icoClock,
  icoFlame,
  icoAchievement,
  icoLock,
} from './dashboardIcons';

export function dashboardSidebarHtml(vm: DashboardViewModel): string {
  return `
      <aside class="sidebar" aria-label="${escapeHtml(vm.t('dash.mainNavAria'))}">
        <div class="brand">
          <img class="brand-logo" src="${escapeAttr(appIconUrl(48))}" width="36" height="36" alt="" />
          <h1 class="brand-text" dir="ltr">Just<span class="brand-accent">Practice</span></h1>
        </div>
        <nav class="side-nav">
          <div class="nav-group">
            <div class="nav-label">${escapeHtml(vm.t('nav.groupPractice'))}</div>
            <button type="button" class="${vm.navItemClass('library')}" data-view="library" aria-current="${vm.navItemClass('library').includes('is-active') ? 'page' : 'false'}">
              <span class="nav-ico" aria-hidden="true">${icoLibrary()}</span>
              ${escapeHtml(vm.t('nav.library'))}
            </button>
            <button type="button" class="${vm.navItemClass('path')}" data-view="path" aria-current="${vm.navItemClass('path').includes('is-active') ? 'page' : 'false'}">
              <span class="nav-ico" aria-hidden="true">${icoClock()}</span>
              ${escapeHtml(vm.t('nav.path'))}
            </button>
            <button type="button" class="${vm.navItemClass('completed')}" data-view="completed" aria-current="${vm.navItemClass('completed').includes('is-active') ? 'page' : 'false'}">
              <span class="nav-ico" aria-hidden="true">${icoCheck()}</span>
              ${escapeHtml(vm.t('nav.completed'))}
            </button>
            <button type="button" class="${vm.navItemClass('stats')}" data-view="stats" aria-current="${vm.navItemClass('stats').includes('is-active') ? 'page' : 'false'}">
              <span class="nav-ico" aria-hidden="true">${icoChart()}</span>
              ${escapeHtml(vm.t('nav.stats'))}
            </button>
            <button type="button" class="${vm.navItemClass('progress')}" data-view="progress" aria-current="${vm.navItemClass('progress').includes('is-active') ? 'page' : 'false'}">
              <span class="nav-ico" aria-hidden="true">${icoTrophy()}</span>
              ${escapeHtml(vm.t('nav.progress'))}
            </button>
            <button type="button" class="${vm.navItemClass('goals')}" data-view="goals" aria-current="${vm.navItemClass('goals').includes('is-active') ? 'page' : 'false'}">
              <span class="nav-ico" aria-hidden="true">${icoTarget()}</span>
              ${escapeHtml(vm.t('nav.goals'))}
            </button>
          </div>
          <div class="nav-group">
            <div class="nav-label">${escapeHtml(vm.t('nav.groupApp'))}</div>
            <button type="button" class="${vm.navItemClass('settings')}" data-view="settings" aria-current="${vm.navItemClass('settings').includes('is-active') ? 'page' : 'false'}">
              <span class="nav-ico" aria-hidden="true">${icoGear()}</span>
              ${escapeHtml(vm.t('nav.settings'))}
            </button>
          </div>
        </nav>
      </aside>`;
}

export function dashboardTopbarMetricsHtml(vm: DashboardViewModel): string {
  return `
          <div class="topbar-progress${vm.data.library.length === 0 ? ' is-soft' : ''}">
            <span class="progress-lead">${escapeHtml(vm.t('dash.progressLead'))}</span>
            <div class="progress-metrics">
              <div class="p-metric">
                <span class="p-ico">${icoRocket()}</span>
                <span class="p-text"><strong><bdi>${escapeHtml(formatPracticeDuration(vm.all, vm.t))}</bdi></strong> ${escapeHtml(vm.t('stats.totalPractice'))}</span>
              </div>
              <div class="p-metric">
                <span class="p-ico">${icoBook()}</span>
                <span class="p-text" data-total-saved><strong>${vm.data.library.length}</strong> ${escapeHtml(vm.t('dash.videosSaved'))}</span>
              </div>
              <div class="p-metric">
                <span class="p-ico">${icoTag()}</span>
                <span class="p-text"><strong>${vm.taggedCount}</strong> ${escapeHtml(vm.t('stats.activeTagged'))}</span>
              </div>
              ${
                vm.completedCount > 0 ?
                  `<div class="p-metric">
                <span class="p-ico">${icoCheck()}</span>
                <span class="p-text"><strong>${vm.completedCount}</strong> ${escapeHtml(vm.t('dash.videosCompleted'))}</span>
              </div>`
                : ''
              }
            </div>
          </div>`;
}

export function dashboardTopbarHtml(vm: DashboardViewModel, searchQuery: string): string {
  return `
        <header class="topbar">
${dashboardTopbarMetricsHtml(vm)}
          <div class="topbar-search">
            <span class="search-ico" aria-hidden="true">${icoSearch()}</span>
            <input type="search" id="dash-search" dir="auto" aria-label="${escapeAttr(vm.t('dash.searchPlaceholder'))}" class="search-pill" placeholder="${escapeAttr(
              vm.t('dash.searchPlaceholder'),
            )}" value="${escapeAttr(searchQuery)}" autocomplete="off" />
          </div>
          <img class="topbar-badge" src="${escapeAttr(appIconUrl(32))}" width="32" height="32" alt="${escapeAttr(APP_NAME)}" />
        </header>`;
}

function libraryCardHtml(vm: DashboardViewModel, item: LibraryItem): string {
  const { href, resume } = playbackForLibraryItem(item, vm.data);
  const lvl = difficultyLabelForCard(item.difficulty, vm.fw, vm.customLevels, vm.t);
  const completed = item.completedAt != null;
  const completedOn = completed ? formatCompletedDate(item.completedAt!, vm.resolvedLocale) : '';
  const primary = vm.t(resume ? 'library.continue' : 'common.open');
  return `<article class="video-card${completed ? ' video-card--completed' : ''}">
    <div class="card-media">
      <img class="card-thumb" src="${escapeAttr(thumbnailUrlForVideoId(item.videoId))}" width="320" height="180" alt="" loading="lazy" decoding="async" />
      <span class="card-badge" dir="auto">${escapeHtml(lvl)}</span>
      ${completed ? `<span class="card-badge card-badge--completed card-badge--level">${escapeHtml(vm.t('dash.completedBadge'))}</span>` : ''}
    </div>
    <div class="card-footer">
      <h3 class="card-title" dir="auto">${escapeHtml(item.title)}</h3>
      <bdi class="card-ch">${escapeHtml(item.channel)}</bdi>
      ${completedOn ? `<span class="card-completed-date">${escapeHtml(vm.t('dash.completedOn', { date: completedOn }))}</span>` : ''}
      ${libraryMetricsHtml(item, vm.data, vm.t)}
      <a class="library-primary jp-primary" href="${escapeAttr(href)}" target="_blank" rel="noreferrer" aria-label="${escapeAttr(primary + ': ' + item.title)}">${escapeHtml(primary)}</a>
      ${librarySecondaryActionsHtml(item, completed ? 'completed' : 'library', vm.t, tagsForFramework(vm.fw, vm.customLevels))}
    </div>
  </article>`;
}

export function libraryPanelBodyHtml(vm: DashboardViewModel): string {
  if (vm.rows.length === 0) {
    return vm.libraryCount === 0 && vm.completedCount === 0
      ? libraryWelcomeHtml(vm.t)
      : `<div class="empty-board">${escapeHtml(vm.t('dash.libraryEmptyFiltered'))}</div>`;
  }
  return `<div class="video-grid">${vm.rows.map(({ item }) => libraryCardHtml(vm, item)).join('')}</div>`;
}

export function dashboardLibrarySectionHtml(vm: DashboardViewModel): string {
  return `
          <section class="${vm.viewPanelClass('library')} dash-section-center" data-view-panel="library" aria-label="${escapeHtml(vm.t('nav.library'))}">
            <h2 class="row-title dash-section-head">${escapeHtml(vm.t('dash.titleLibrary'))}</h2>
            <div class="filter-chips" role="group" aria-label="${escapeAttr(vm.t('dash.filterAria'))}">
${vm.filterChipsInner}
            </div>
            <div class="library-panel-body" data-library-body>${libraryPanelBodyHtml(vm)}</div>
          </section>`;
}

export function dashboardCompletedSectionHtml(vm: DashboardViewModel): string {
  const body = vm.completedRows.length === 0
    ? `<div class="empty-board">${escapeHtml(vm.t('dash.completedEmpty'))}</div>`
    : `<div class="video-grid completed-grid">${vm.completedRows.map(({ item }) => libraryCardHtml(vm, item)).join('')}</div>`;
  return `<section class="${vm.viewPanelClass('completed')} dash-section-center" data-view-panel="completed" aria-label="${escapeHtml(vm.t('nav.completed'))}">
    <h2 class="row-title dash-section-head">${escapeHtml(vm.t('dash.titleCompleted'))}</h2>
    <p class="row-sub dash-section-sub">${escapeHtml(vm.t('dash.completedIntro'))}</p>
    ${body}
  </section>`;
}

export function dashboardStatsSectionHtml(vm: DashboardViewModel): string {
  const chartCols = vm.days7
    .map((d) => {
      const isToday = d.dateKey === vm.todayKey;
      const barHeightPx = chartBarHeightPx(d.seconds);
      const vis = practiceCalendarDayVisual(
        d.dateKey,
        d.seconds,
        vm.todayKey,
        vm.data.extensionInstalledDateKey,
        vm.data.dailySeconds,
        vm.dailyGoalSec,
      );
      const barTier =
        vis === 'neutral' ? 'neutral'
        : vis === 'future' ? 'future'
        : vis;
      const valClass =
        vis === 'neutral' || vis === 'future' ? `chart-val--${barTier}` : `chart-val--${vis}`;
      return `
                <div class="chart-col${isToday ? ' chart-col--today' : ''}"${isToday ? ' aria-current="date"' : ''}>
                  <div class="chart-bar-track">
                    <div class="chart-bar chart-bar--${barTier}" style="height:${barHeightPx}px"></div>
                  </div>
                  <span class="chart-val ${valClass}">${escapeHtml(calendarDayBottomLabel(vis, d.seconds, d.dateKey, vm.todayKey))}</span>
                  <span class="chart-label${isToday ? ' chart-label--today' : ''}" title="${escapeAttr(d.dateKey)}">${escapeHtml(d.weekdayShort)}</span>
                  ${isToday ? `<span class="chart-today-caption">${escapeHtml(vm.t('dash.chartToday'))}</span>` : ''}
                </div>`;
    })
    .join('');

  const levelPills = vm.byLevel
    .map(
      (x) => `
              <div class="level-pill">
                <span class="lab">${escapeHtml(statBucketLabel(x.label, vm.t))}</span>
                <bdi class="num">${escapeHtml(formatPracticeDuration(x.seconds, vm.t))}</bdi>
              </div>`,
    )
    .join('');

  return `
          <section class="${vm.viewPanelClass('stats')} dash-section-center" data-view-panel="stats" aria-label="${escapeHtml(vm.t('nav.stats'))}">
            <h2 class="row-title dash-section-head">${escapeHtml(vm.t('dash.statsTw'))}</h2>
            ${dashboardStatsSummaryHtml(vm)}

            ${(() => {
              const grid = buildYearHeatmapGridModel({
                year: vm.yearHeatmapYear,
                dailySeconds: vm.data.dailySeconds,
                extensionInstalledDateKey: vm.data.extensionInstalledDateKey,
                dailyGoalSec: vm.dailyGoalSec,
                locale: vm.resolvedLocale,
              });
              const showTime = vm.calendarShowPracticeTime;
              const statusLabel = (
                display: import('../lib/yearHeatmapCalendar').YearHeatmapDisplayColor,
                dateKey: string,
                seconds = 0,
                showTimeArg = false,
              ) => yearHeatmapStatusLabel(vm.t, display, dateKey, seconds, showTimeArg);
              return `
            <h2 class="row-title row-title--spaced dash-section-head">${escapeHtml(vm.t('dash.yearHeatmapTitle'))}</h2>
            ${yearHeatmapSectionHtml({
              grid,
              locale: vm.resolvedLocale,
              variant: 'dashboard',
              statusLabel,
              showPracticeTime: showTime,
              showMonthTicks: true,
              navPrevLabel: vm.t('dash.yearHeatmapPrevYear'),
              navNextLabel: vm.t('dash.yearHeatmapNextYear'),
              backToYearLabel: vm.t('yearHeatmap.backToYear'),
              keysHtml: '',
              flawlessYearBadgeLabel: vm.t('dash.yearFlawlessBadge'),
              ariaLabel: vm.t('calendar.yearHeatmapAria'),
            })}`;
            })()}

            <h2 class="row-title row-title--spaced dash-section-head">${escapeHtml(vm.t('dash.statsLast7'))}</h2>
            <div class="chart-week-wrap">
              <div class="chart-streak" dir="ltr" role="status" aria-label="${escapeAttr(streakAriaLabel(vm.t, vm.streak))}">
                <span class="chart-streak-flame" aria-hidden="true">${icoFlame()}</span>
                <span class="chart-streak-num">${vm.streak}</span>
                <span class="chart-streak-cap">${escapeHtml(streakCaption(vm.t, vm.streak))}</span>
              </div>
              <div class="chart-keys" aria-hidden="true">
                <span class="chart-key"
                  ><span class="chart-key-dot chart-key-dot--none"></span>${escapeHtml(vm.t('calendar.chartKeyNone'))}</span
                >
                <span class="chart-key"
                  ><span class="chart-key-dot chart-key-dot--active"></span>${escapeHtml(vm.t('calendar.chartKeyActive'))}</span
                >
                ${
                  vm.dailyGoalSec != null ?
                    `<span class="chart-key"
                  ><span class="chart-key-dot chart-key-dot--goal"></span>${escapeHtml(vm.t('calendar.chartKeyGoal'))}</span
                >`
                  : ''
                }
              </div>
              <div class="chart" role="img" aria-label="${escapeAttr(vm.t('dash.chartAria'))}">
              ${chartCols}
              </div>
            </div>

            <h2 class="row-title row-title--spaced dash-section-head">${escapeHtml(vm.t('dash.statsByLevel'))}</h2>
            <p class="row-sub dash-section-sub">${escapeHtml(
              vm.t('dash.statsByLevelHint', {
                fw:
                  vm.fw === 'jlpt' ? vm.t('framework.jlpt')
                  : vm.fw === 'cefr' ? vm.t('framework.cefr')
                  : vm.t('framework.custom'),
              }),
            )}</p>
            <div class="level-grid">
              ${levelPills}
            </div>
          </section>`;
}

export function dashboardProgressSectionHtml(vm: DashboardViewModel): string {
  const maxLevel = vm.accountLevel >= MAX_ACCOUNT_LEVEL;
  const barWidth = maxLevel ? 100 : vm.levelProgressPercent;
  const ringDash = ringDasharrayFromProgress(maxLevel ? 1 : barWidth / 100);
  const prestigeBadgeHtml =
    vm.prestigeLevel > 0
      ? `<span class="progress-prestige-badge" aria-label="${escapeAttr(vm.t('progress.prestigeBadge', { level: String(vm.prestigeLevel) }))}">${escapeHtml(vm.t('progress.prestigeBadge', { level: String(vm.prestigeLevel) }))}</span>`
      : '';
  const prestigeMasterHtml =
    vm.isPrestigeMaster
      ? `<span class="progress-prestige-master">${escapeHtml(vm.t('progress.prestigeMaster'))}</span>`
      : '';
  const prestigeBonusHtml =
    vm.prestigeLevel > 0
      ? `<span class="progress-prestige-pill">${escapeHtml(vm.t('progress.prestigeXpBonus', { percent: String(vm.prestigeXpBonusPercent) }))}</span>`
      : '';
  const prestigeCtaHtml =
    vm.canPrestige
      ? `<div class="progress-prestige-cta">
          <p class="progress-prestige-cta__lead">${escapeHtml(vm.t('progress.prestigeReadyLead'))}</p>
          <p class="progress-prestige-cta__hint">${escapeHtml(vm.t('progress.prestigeReadyHint'))}</p>
          <button type="button" class="btn-prestige" id="enter-prestige">${escapeHtml(vm.t('progress.enterPrestige'))}</button>
        </div>`
      : '';
  const renderAchievementCard = (a: (typeof vm.achievementSections)[0]['achievements'][0]) => {
      const locked = !a.unlocked;
      const unlockedDate =
        a.unlockedAt != null ? formatCompletedDate(a.unlockedAt, vm.resolvedLocale) : '';
      return `
              <article class="achievement-card${locked ? ' achievement-card--locked' : ' achievement-card--unlocked'}" data-ach-category="${escapeAttr(a.category)}">
                <div class="achievement-card__icon-wrap" aria-hidden="true">
                  <span class="achievement-card__icon">${icoAchievement(a.category)}</span>
                  ${locked ? `<span class="achievement-card__lock">${icoLock()}</span>` : ''}
                </div>
                <div class="achievement-card__body">
                  <h3 class="achievement-card__title">${escapeHtml(vm.t(`achievement.${a.id}.title`))}</h3>
                  <p class="achievement-card__desc">${escapeHtml(vm.t(`achievement.${a.id}.description`))}</p>
                  <footer class="achievement-card__footer">
                    ${
                      locked
                        ? `<span class="achievement-badge achievement-badge--locked"><span class="achievement-badge__ico">${icoLock()}</span>${escapeHtml(vm.t('progress.achievementLocked'))}</span>`
                        : `<span class="achievement-badge achievement-badge--unlocked">${escapeHtml(vm.t('progress.achievementUnlocked'))}</span>${
                            unlockedDate
                              ? `<time class="achievement-card__date" datetime="${escapeAttr(new Date(a.unlockedAt!).toISOString().slice(0, 10))}">${escapeHtml(vm.t('progress.achievementUnlockedOn', { date: unlockedDate }))}</time>`
                              : ''
                          }`
                    }
                  </footer>
                </div>
              </article>`;
  };

  const achievementSectionsHtml = vm.achievementSections
    .map(
      (section) => `
            <section class="achievement-section" data-ach-category="${escapeAttr(section.category)}">
              <h3 class="achievement-section__title">${escapeHtml(vm.t(`progress.category.${section.category}`))}</h3>
              <div class="achievement-grid">
                ${section.achievements.map(renderAchievementCard).join('')}
              </div>
            </section>`,
    )
    .join('');

  const categoryFilters = vm.achievementCategories
    .map(
      (cat) =>
        `<button type="button" class="filter-chip" data-ach-filter="${escapeAttr(cat)}" aria-pressed="false">${escapeHtml(vm.t(`progress.category.${cat}`))}</button>`,
    )
    .join('');

  const streakValue =
    vm.streak > 0
      ? `<span class="progress-momentum-stat__flame" aria-hidden="true">${icoFlame()}</span><span>${vm.streak}</span>`
      : '\u2014';

  return `
          <section class="${vm.viewPanelClass('progress')} dash-section-center" data-view-panel="progress" aria-label="${escapeHtml(vm.t('nav.progress'))}">
            <div class="progress-hero">
              <p class="progress-journey-lead">${escapeHtml(vm.t('progress.journeySubtitle'))}</p>
              ${progressXpGuideHtml(vm.t)}
              <div class="progress-journey-card">
              <div class="progress-journey-card__glow" aria-hidden="true"></div>
              <div class="progress-journey-card__mesh" aria-hidden="true"></div>
              <div class="progress-journey-card__inner">
                <div class="progress-journey-stage">
                  <div class="progress-level-ring-wrap" role="img" aria-label="${escapeAttr(vm.t('progress.rank', { level: String(vm.accountLevel) }))}">
                    <svg class="progress-level-ring" viewBox="0 0 120 120" aria-hidden="true">
                      <circle class="progress-level-ring__track" pathLength="100" cx="60" cy="60" r="52" fill="none" />
                      <circle
                        class="progress-level-ring__fill"
                        pathLength="100"
                        cx="60"
                        cy="60"
                        r="52"
                        fill="none"
                        stroke-dasharray="${escapeAttr(ringDash)}"
                        transform="rotate(-90 60 60)"
                      />
                    </svg>
                    <div class="progress-level-ring__center">
                      <span class="progress-level-ring__label">${escapeHtml(vm.t('progress.rankLabel'))}</span>
                      <span class="progress-level-ring__num">${vm.accountLevel}</span>
                    </div>
                  </div>
                  <div class="progress-journey-meta">
                    <div class="progress-journey-meta__head">
                      ${prestigeBadgeHtml}
                      ${prestigeMasterHtml}
                      ${
                        vm.weekendXpActive
                          ? `<span class="progress-weekend-pill">${escapeHtml(vm.t('progress.weekendBonus'))}</span>`
                          : ''
                      }
                      ${prestigeBonusHtml}
                    </div>
                <div class="progress-xp-bar-wrap" role="progressbar" aria-valuemin="0" aria-valuemax="${maxLevel ? vm.totalXp : vm.xpNeededForNext}" aria-valuenow="${maxLevel ? vm.totalXp : vm.xpIntoLevel}" aria-label="${escapeAttr(vm.t('progress.xpBarAria'))}">
                      <div class="progress-xp-bar-track">
                        <div class="progress-xp-bar-fill" style="width:${barWidth}%"></div>
                        <span class="progress-xp-bar-milestone" aria-hidden="true"></span>
                      </div>
                  <p class="progress-xp-bar-label"><bdi>
                    ${
                      maxLevel
                        ? escapeHtml(vm.t('progress.maxLevel'))
                        : escapeHtml(
                            vm.t('progress.xpToNext', {
                              current: String(vm.xpIntoLevel),
                              needed: String(vm.xpNeededForNext),
                            }),
                          )
                    }
                      </bdi></p>
                    </div>
                    <p class="progress-total-xp">${escapeHtml(vm.t('progress.cycleXp', { xp: String(vm.totalXp) }))}</p>
                    <p class="progress-lifetime-xp">${escapeHtml(vm.t('progress.lifetimeXp', { xp: String(vm.lifetimeXp) }))}</p>
                  </div>
                </div>
                ${prestigeCtaHtml}
                <ul class="progress-momentum-stats">
                  <li class="progress-momentum-stat">
                    <span class="progress-momentum-stat__ico" aria-hidden="true">${icoClock()}</span>
                    <div class="progress-momentum-stat__text">
                      <span class="progress-momentum-stat__label">${escapeHtml(vm.t('common.today'))}</span>
                      <span class="progress-momentum-stat__value">${escapeHtml(formatPracticeDuration(vm.today, vm.t))}</span>
                    </div>
                  </li>
                  <li class="progress-momentum-stat">
                    <span class="progress-momentum-stat__ico progress-momentum-stat__ico--flame" aria-hidden="true">${icoFlame()}</span>
                    <div class="progress-momentum-stat__text">
                      <span class="progress-momentum-stat__label">${escapeHtml(vm.t('progress.statStreak'))}</span>
                      <span class="progress-momentum-stat__value progress-momentum-stat__value--streak">${streakValue}</span>
                    </div>
                  </li>
                  <li class="progress-momentum-stat">
                    <span class="progress-momentum-stat__ico" aria-hidden="true">${icoCheck()}</span>
                    <div class="progress-momentum-stat__text">
                      <span class="progress-momentum-stat__label">${escapeHtml(vm.t('nav.completed'))}</span>
                      <span class="progress-momentum-stat__value">${vm.completedCount}</span>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
            </div>
            <h2 class="row-title row-title--spaced">${escapeHtml(vm.t('progress.achievementsTitle'))}</h2>
            <p class="row-sub row-sub--tight">${escapeHtml(vm.t('progress.achievementsIntro'))}</p>
            <div class="filter-chips progress-trophy-filters" role="group" aria-label="${escapeHtml(vm.t('progress.achievementFiltersAria'))}">
              <button type="button" class="filter-chip is-active" data-ach-filter="all" aria-pressed="true">${escapeHtml(vm.t('dash.filterAll'))}</button>
              ${categoryFilters}
            </div>
            <div class="achievement-sections">
              ${achievementSectionsHtml}
            </div>
          </section>`;
}


export function dashboardGoalsSectionHtml(vm: DashboardViewModel): string {
  return `
          <section class="${vm.viewPanelClass('goals')} dash-section-center" data-view-panel="goals" aria-label="${escapeHtml(vm.t('nav.goals'))}">
            <h2 class="row-title dash-section-head">${escapeHtml(vm.t('dash.goalsTitle'))}</h2>
            <p class="row-sub goals-intro dash-section-sub">
              ${escapeHtml(vm.t('dash.goalsIntro'))}
            </p>
            <div class="goal-rings-row">
              ${goalRingCardHtml(vm.t('common.today'), vm.today, vm.rg.dailyTargetSec, vm.t)}
              ${goalRingCardHtml(vm.t('common.thisWeek'), vm.week, vm.rg.weeklyTargetSec, vm.t)}
              ${goalRingCardHtml(vm.t('common.thisMonth'), vm.monthSec, vm.rg.monthlyTargetSec, vm.t)}
            </div>
            <h3 class="goals-form-title">${escapeHtml(vm.t('dash.goalsDailyTitle'))}</h3>
            <p class="row-sub goals-form-hint">${escapeHtml(vm.t('dash.goalsDailyHint'))}</p>
            <div class="goals-form goals-form--single">
              <label class="goals-field">
                <span>${escapeHtml(vm.t('dash.goalsMinutesPerDay'))}</span>
                <input type="text" id="goal-daily-min" class="goals-field-input--compact" inputmode="numeric" pattern="[0-9]*" maxlength="3" autocomplete="off" placeholder="${escapeAttr(vm.t('dash.goalsMinutesPlaceholder'))}"
                  value="${vm.goals.dailyTargetSec == null ? '' : escapeAttr(String(Math.round(vm.goals.dailyTargetSec / 60)))}" />
              </label>
            </div>
            <button type="button" class="btn-save-goals jp-primary" id="save-goals" data-commit-controls="goal-daily-min">${escapeHtml(vm.t('dash.goalsSaveTargets'))}</button>
          </section>`;
}

function customDailyMessagesSectionHtml(vm: DashboardViewModel): string {
  const messages = vm.st.customDailyMessages ?? [];
  const atMax = messages.length >= 10;
  const listHtml =
    messages.length === 0
      ? `<p class="custom-daily-messages-empty">${escapeHtml(vm.t('settings.customDailyMessagesEmpty'))}</p>`
      : `<ul class="custom-daily-messages-list" aria-label="${escapeAttr(vm.t('settings.customDailyMessagesListAria'))}">
              ${messages
                .map(
                  (msg, index) => `
                <li class="custom-daily-messages-item">
                  <span class="custom-daily-messages-text">${escapeHtml(msg)}</span>
                  <button
                    type="button"
                    class="custom-daily-messages-remove"
                    data-custom-message-index="${index}"
                    aria-label="${escapeAttr(vm.t('settings.customDailyMessagesRemoveAria', { message: msg }))}"
                  >${escapeHtml(vm.t('common.remove'))}</button>
                </li>`,
                )
                .join('')}
            </ul>`;

  return `
            <h4 class="row-title row-title--spaced dash-section-head">${escapeHtml(vm.t('settings.customDailyMessagesTitle'))}</h4>
            <p class="help dash-section-sub">${escapeHtml(vm.t('settings.customDailyMessagesHelp'))}</p>
            <div class="settings-block custom-daily-messages-block">
              <div class="custom-daily-messages-add">
                <label class="custom-daily-message-label" for="custom-daily-message-input">${escapeHtml(vm.t('settings.customDailyMessagesInputLabel'))}</label>
                <input
                  type="text"
                  id="custom-daily-message-input"
                  dir="auto"
                  maxlength="200"
                  placeholder="${escapeAttr(vm.t('settings.customDailyMessagesPlaceholder'))}"
                  ${atMax ? 'disabled' : ''}
                />
                <button
                  type="button"
                  class="btn-save-goals jp-primary custom-daily-messages-add-btn"
                  id="custom-daily-message-add" data-commit-controls="custom-daily-message-input"
                  ${atMax ? 'disabled' : ''}
                >${escapeHtml(vm.t('settings.customDailyMessagesAdd'))}</button>
              </div>
              ${atMax ? `<p class="help custom-daily-messages-max">${escapeHtml(vm.t('settings.customDailyMessagesMax'))}</p>` : ''}
              ${listHtml}
            </div>`;
}

export function dashboardSettingsSectionHtml(vm: DashboardViewModel): string {
  const localeOptions = LOCALE_DROPDOWN.map((row) => {
    const current = vm.st.uiLocale ?? 'auto';
    const sel = current === row.value ? ' selected' : '';
    const lab = formatLocaleOptionLabel(row.value, vm.resolvedBrowserDefault, vm.t);
    return `<option value="${escapeAttr(row.value)}"${sel}>${escapeHtml(lab)}</option>`;
  }).join('');

  return `<section class="${vm.viewPanelClass('settings')} settings-view" data-view-panel="settings" aria-label="${escapeHtml(vm.t('nav.settings'))}">
    <h2>${escapeHtml(vm.t('settings.heading'))}</h2>
    <p class="settings-save-model">${escapeHtml(vm.t('settings.saveModel'))}</p>
    <nav class="settings-jumps" aria-label="${escapeAttr(vm.t('settings.jump'))}">
      ${[['language', 'settings.sectionLanguage'], ['counting', 'settings.sectionCounting'], ['data', 'settings.sectionData'], ['personalization', 'settings.sectionPersonalization']].map(([id,key]) => `<button type="button" class="jp-secondary" data-settings-section="settings-${id}">${escapeHtml(vm.t(key))}</button>`).join('')}
    </nav>
    <section id="settings-language" class="settings-group" aria-labelledby="settings-language-title">
      <h3 id="settings-language-title" class="row-title row-title--spaced dash-section-head">${escapeHtml(vm.t('dash.levelAndLanguageTitle'))}</h3>
            <p class="help dash-section-sub">${escapeHtml(vm.t('settings.levelFrameworkHint'))}</p>
            <div class="settings-framework">
              <div class="settings-block">
                <label for="setting-level-framework">${escapeHtml(vm.t('settings.levelFramework'))}</label>
                <select id="setting-level-framework">
                  <option value="jlpt" ${vm.fw === 'jlpt' ? 'selected' : ''}>${escapeHtml(vm.t('framework.jlpt'))} (${escapeHtml(vm.t('framework.jlptLevels'))})</option>
                  <option value="cefr" ${vm.fw === 'cefr' ? 'selected' : ''}>${escapeHtml(vm.t('framework.cefr'))} (${escapeHtml(vm.t('framework.cefrLevels'))})</option>
                  <option value="custom" ${vm.fw === 'custom' ? 'selected' : ''}>${escapeHtml(vm.t('framework.custom'))}</option>
                </select>
              </div>
              ${
                vm.fw === 'custom'
                  ? `<div class="settings-block" id="custom-levels-block">
                <label for="custom-levels-lines">${escapeHtml(vm.t('settings.customLevelsLabel'))}</label>
                <textarea id="custom-levels-lines" rows="8" spellcheck="false" placeholder="${escapeAttr(vm.t('settings.customLevelsPlaceholder'))}">${escapeHtml(vm.customLevels.join('\n'))}</textarea>
                <p class="help">${escapeHtml(vm.t('settings.customLevelsHelp'))}</p>
                <button type="button" class="btn-save-goals jp-primary" id="save-custom-levels" data-commit-controls="custom-levels-lines">${escapeHtml(vm.t('settings.saveCustomLevels'))}</button>
              </div>`
                  : ''
              }
              <div class="settings-block">
                <label for="setting-ui-locale">${escapeHtml(vm.t('settings.language'))}</label>
                <select id="setting-ui-locale">
                  ${localeOptions}
                </select>
                <p class="help">${escapeHtml(
                  vm.t('settings.languageActive', {
                    lang: languageLabelForLocale(vm.resolvedLocale, vm.t),
                  }),
                )}</p>
              </div>
            </div>


    </section>
    <section id="settings-counting" class="settings-group" aria-labelledby="settings-counting-title">
      <h3 id="settings-counting-title" class="row-title row-title--spaced dash-section-head">${escapeHtml(vm.t('settings.countingTitle'))}</h3>
            <div class="settings-block">
              <label>
                <input type="checkbox" id="pause-unfocused" ${vm.data.settings.pauseWhenUnfocused ? 'checked' : ''} />
                <span>${escapeHtml(vm.t('settings.pauseUnfocused'))}</span>
              </label>
              <p class="help">${escapeHtml(vm.t('settings.pauseHelp'))}</p>
            </div>
            <h3 class="row-title row-title--spaced dash-section-head">${escapeHtml(vm.t('settings.learningFocusTitle'))}</h3>
            <div class="settings-block">
              <label>
                <input type="checkbox" id="learning-focus-hide-recs" ${vm.data.settings.learningFocusHideRecommendations !== false ? 'checked' : ''} />
                <span>${escapeHtml(vm.t('settings.learningFocusHideRecs'))}</span>
              </label>
              <p class="help">${escapeHtml(vm.t('settings.learningFocusHideRecsHelp'))}</p>
            </div>
            <div class="settings-block">
              <label>
                <input type="checkbox" id="calendar-show-practice-time" ${vm.data.settings.calendarShowPracticeTime ? 'checked' : ''} />
                <span>${escapeHtml(vm.t('settings.calendarShowPracticeTime'))}</span>
              </label>
              <p class="help">${escapeHtml(vm.t('settings.calendarShowPracticeTimeHelp'))}</p>
            </div>
            <p class="foot-note dash-section-sub">
              <strong>${escapeHtml(vm.t('settings.howCounted'))}:</strong> ${escapeHtml(vm.t('settings.howCountedBody'))}
            </p>


      <h3 class="row-title row-title--spaced dash-section-head">${escapeHtml(vm.t('settings.notificationsTitle'))}</h3>
            <p class="help dash-section-sub">${escapeHtml(vm.t('settings.notificationsIntro'))}</p>
            <div class="settings-block">
              <label class="settings-notif-option">
                <input type="checkbox" id="watch-panel-xp-toasts" ${vm.data.settings.watchPanelXpToastsEnabled !== false ? 'checked' : ''} />
                <span>${escapeHtml(vm.t('settings.watchPanelXpToasts'))}</span>
              </label>
              <p class="help settings-notif-option-help">${escapeHtml(vm.t('settings.watchPanelXpToastsHelp'))}</p>
            </div>

    </section>
    <section id="settings-data" class="settings-group" aria-labelledby="settings-data-title">
      <h3 id="settings-data-title">${escapeHtml(vm.t('settings.sectionData'))}</h3>
      <p class="help">${escapeHtml(vm.t('settings.dataHint'))}</p>
      <div class="settings-block data-actions">
        <button type="button" class="jp-primary btn-data-export" id="export-extension-data">${escapeHtml(vm.t('settings.export'))}</button>
        <button type="button" class="jp-secondary btn-data-restore" id="restore-extension-data">${escapeHtml(vm.t('settings.restore'))}</button>
        <input type="file" id="restore-extension-file" accept="application/json,.json,.txt" hidden />
      </div>
      <div class="settings-danger">
        <h4>${escapeHtml(vm.t('settings.clearHeading'))}</h4>
        <p>${escapeHtml(vm.t('settings.clearWarning'))}</p>
        <button type="button" class="btn-data-clear" id="clear-extension-data">${escapeHtml(vm.t('settings.clear'))}</button>
      </div>
    </section>
    <details id="settings-personalization" class="settings-group settings-advanced">
      <summary id="settings-personalization-summary">${escapeHtml(vm.t('settings.advanced'))}</summary>
      <h3 class="row-title dash-section-head">${escapeHtml(vm.t('settings.profileTitle'))}</h3>
            <p class="help dash-section-sub">${escapeHtml(vm.t('settings.profileHint'))}</p>
            <div class="settings-profile">
              <div class="settings-block">
                <label for="setting-display-name">${escapeHtml(vm.t('settings.displayName'))}</label>
                <input
                  type="text"
                  id="setting-display-name"
                  dir="auto"
                  maxlength="40"
                  autocomplete="nickname"
                  placeholder="${escapeAttr(vm.t('settings.displayNamePlaceholder'))}"
                  value="${escapeAttr(vm.displayName)}"
                />
                <p class="help">${escapeHtml(vm.t('settings.displayNameHelp'))}</p>
              </div>
              <div class="settings-block">
                <label>
                  <input type="checkbox" id="daily-motivation-enabled" ${vm.st.dailyMotivationEnabled !== false ? 'checked' : ''} />
                  <span>${escapeHtml(vm.t('settings.dailyMotivationEnabled'))}</span>
                </label>
              </div>
            </div>

            ${customDailyMessagesSectionHtml(vm)}


      <h3 class="row-title row-title--spaced dash-section-head">${escapeHtml(vm.t('settings.showWelcomeAgain'))}</h3>
            <div class="settings-block">
              <button type="button" class="jp-secondary" id="show-welcome-again">${escapeHtml(vm.t('settings.showWelcomeAgain'))}</button>
              <p class="help">${escapeHtml(vm.t('settings.showWelcomeAgainHelp'))}</p>
            </div>


    </details>
  </section>`;
}

export function dashboardShellHtml(vm: DashboardViewModel, searchQuery: string): string {
  return `
    <div class="app-shell">
${dashboardSidebarHtml(vm)}
      <div class="main-area">
${dashboardTopbarHtml(vm, searchQuery)}
${dashWelcomeHtml(vm.t, vm.displayName, vm.dailyMotivationMessage)}
        <main class="content">
${dashboardLibrarySectionHtml(vm)}
${dashboardPathSectionHtml(vm)}
${dashboardCompletedSectionHtml(vm)}
${dashboardStatsSectionHtml(vm)}
${dashboardProgressSectionHtml(vm)}
${dashboardGoalsSectionHtml(vm)}
${dashboardSettingsSectionHtml(vm)}
        </main>
      </div>
    </div>
  `;
}
