import { escapeAttr, escapeHtml } from '../lib/htmlEscape';
import { formatPracticeDuration } from '../lib/practiceDuration';
import type { DashboardViewModel } from './dashboardViewModel';

export function dashboardStatsSummaryHtml(vm: DashboardViewModel): string {
  const { t } = vm;
  const duration = (sec: number) => formatPracticeDuration(sec, t);
  const target = vm.rg.dailyTargetSec;
  const hasGoal = target != null && target > 0;
  const met = hasGoal && vm.today >= target;
  const percent = hasGoal ? Math.min(100, Math.floor(vm.today / target * 100)) : 0;
  const nextView = vm.libraryCount > 0 || vm.completedCount === 0 ? 'library' : 'completed';
  const nextLabel = t(vm.libraryCount > 0 ? 'stats.continuePractice' : vm.completedCount ? 'stats.reviewCompleted' : 'stats.startLibrary');
  const goalLabel = hasGoal ? t('stats.goalProgress', { target: duration(target), percent: String(percent) }) : t('stats.noGoal');
  const metric = (title: string, seconds: number, goal: number | null = null) => `<div class="stats-secondary-metric">
    <h3>${escapeHtml(title)}</h3><bdi class="stats-secondary-value">${escapeHtml(duration(seconds))}</bdi>
    ${goal != null && goal > 0 ? `<p>${escapeHtml(t('stats.target', { target: duration(goal) }))}</p>` : ''}
  </div>`;
  return `<div class="stats-overview">
    <div class="stats-today${met ? ' is-met' : ''}">
      <h3>${escapeHtml(t('common.today'))}</h3>
      <p class="stats-primary-value"><bdi>${escapeHtml(duration(vm.today))}</bdi></p>
      <p class="stats-goal-label">${escapeHtml(met ? `${t('stats.goalMet')} · ${goalLabel}` : goalLabel)}</p>
      ${hasGoal ? `<progress max="${target}" value="${Math.min(vm.today, target)}" aria-label="${escapeAttr(`${t('common.today')}: ${goalLabel}`)}"></progress>` : ''}
      <div class="stats-next-actions">
        <button type="button" class="${hasGoal ? 'jp-primary' : 'jp-secondary'}" data-stats-view="${nextView}">${escapeHtml(nextLabel)}</button>
        <button type="button" class="${hasGoal ? 'jp-secondary' : 'jp-primary'}" data-stats-view="goals">${escapeHtml(t(hasGoal ? 'stats.editGoals' : 'stats.setGoal'))}</button>
      </div>
    </div>
    <div class="stats-secondary-row">
      ${metric(t('common.thisWeek'), vm.week, vm.rg.weeklyTargetSec)}
      ${metric(t('common.thisMonth'), vm.monthSec, vm.rg.monthlyTargetSec)}
      ${metric(t('common.allTime'), vm.all)}
    </div>
    <p class="stats-library-counts">${escapeHtml(t('stats.libraryCounts', { total: String(vm.data.library.length), active: String(vm.libraryCount), completed: String(vm.completedCount) }))}</p>
  </div>`;
}
