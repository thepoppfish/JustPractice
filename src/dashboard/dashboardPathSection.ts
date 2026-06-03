import { formatDuration } from '../lib/practiceStats';
import { thumbnailUrlForVideoId } from '../lib/youtubeMeta';
import { escapeAttr, escapeHtml } from '../lib/htmlEscape';
import { goalRingCardHtml, difficultyLabelForCard } from './dashboardFormatters';
import type { DashboardViewModel } from './dashboardViewModel';
import { icoCheck, icoStar } from './dashboardIcons';

function pathNodeStateLabel(vm: DashboardViewModel, state: string): string {
  if (state === 'stepCompleted') return vm.t('path.stepCompleted');
  if (state === 'active') return vm.t('path.nodeActive');
  return vm.t('path.nodeAvailable');
}

function pathNodeHtml(vm: DashboardViewModel, index: number): string {
  const node = vm.pathUi!.nodes[index]!;
  const href = `https://www.youtube.com/watch?v=${encodeURIComponent(node.item.videoId)}`;
  const thumb = thumbnailUrlForVideoId(node.item.videoId);
  const lvl = difficultyLabelForCard(node.item.difficulty, vm.fw, vm.customLevels, vm.t);
  const isActive = node.state === 'active';
  const isDone = node.state === 'stepCompleted';
  const callout =
    isActive
      ? `<div class="path-start-callout" aria-hidden="true">${escapeHtml(vm.t('path.startCallout'))}</div>`
      : '';
  const iconInner =
    isDone
      ? icoCheck()
      : isActive
        ? icoStar()
        : '';
  const progressPct =
    node.allocatedSec > 0
      ? Math.min(100, Math.round((node.practicedSecOnStep / node.allocatedSec) * 100))
      : 0;
  const doneSec = Math.min(node.practicedSecOnStep, node.allocatedSec);
  const alreadyInVideo =
    node.watchedSecAtBuild > 0 && node.watchedSecAtBuild < node.durationSec
      ? escapeHtml(
          vm.t('path.alreadyInVideo', {
            duration: formatDuration(node.watchedSecAtBuild),
          }),
        )
      : '';
  const stepLine = escapeHtml(
    vm.t('path.nodeStepForToday', {
      done: formatDuration(doneSec),
      allocated: formatDuration(node.allocatedSec),
    }),
  );
  const videoLine = escapeHtml(
    vm.t('path.videoLengthTotal', { duration: formatDuration(node.durationSec) }),
  );
  const meta = [escapeHtml(lvl), alreadyInVideo, stepLine, videoLine].filter(Boolean).join(' · ');
  const doneBadge =
    isDone && thumb ? `<span class="path-node-done-badge" aria-hidden="true">${icoCheck()}</span>` : '';

  return `
    <li
      class="path-trail-item path-trail-item--${escapeAttr(node.side)}${isActive ? ' path-trail-item--active-step' : ''}"
      data-path-index="${index}"
    >
      <div class="path-trail-step">
      ${callout}
      <a
        class="path-node path-node--${escapeAttr(node.state)}"
        href="${href}"
        target="_blank"
        rel="noreferrer"
        aria-current="${isActive ? 'step' : 'false'}"
        aria-label="${escapeAttr(
          vm.t('path.openVideo', { title: node.item.title }) +
            ', ' +
            pathNodeStateLabel(vm, node.state),
        )}"
      >
        <span class="path-node-ring" style="--path-progress: ${progressPct}" aria-hidden="true"></span>
        ${
          thumb
            ? `<img class="path-node-thumb" src="${escapeAttr(thumb)}" width="176" height="99" alt="" loading="lazy" decoding="async" />`
            : `<span class="path-node-icon" aria-hidden="true">${iconInner}</span>`
        }
        ${doneBadge}
      </a>
      <div class="path-node-caption">
        <span class="path-node-title">${escapeHtml(node.item.title)}</span>
        <span class="path-node-meta">${meta}</span>
      </div>
      </div>
    </li>`;
}

function pathTrailHtml(vm: DashboardViewModel): string {
  const nodes = vm.pathUi!.nodes;
  if (nodes.length === 0) return '';
  const items = nodes.map((_, i) => pathNodeHtml(vm, i)).join('');
  return `
    <div class="path-canvas">
      <svg class="path-connectors" aria-hidden="true"></svg>
      <ol class="path-trail" aria-label="${escapeHtml(vm.t('path.mainAria'))}">${items}</ol>
    </div>`;
}

function pathHeaderHtml(vm: DashboardViewModel): string {
  const p = vm.pathUi!;
  const ring = goalRingCardHtml(
    vm.t('path.title'),
    p.todayPracticeSec,
    p.dailyGoalSec,
    vm.t,
  );

  let sub = '';
  if (p.showNoGoal) {
    sub = `<p class="path-header-sub">${escapeHtml(vm.t('path.noGoal'))} <button type="button" class="path-link-btn" data-path-goto="goals">${escapeHtml(vm.t('path.noGoalCta'))}</button></p>`;
  } else if (p.showGoalMet) {
    sub = `<p class="path-header-sub path-header-sub--celebrate">${escapeHtml(vm.t('path.goalMet'))}</p>
      <p class="path-header-sub">${escapeHtml(vm.t('path.goalMetSub'))}</p>`;
  } else if (p.dailyGoalMet && p.nodes.length > 0) {
    const planned = formatDuration(p.plannedTotalSec);
    const count = p.nodes.length;
    const plannedLine =
      count === 1
        ? vm.t('path.plannedSummaryOne', { duration: planned })
        : vm.t('path.plannedSummary', { count: String(count), duration: planned });
    sub = `<p class="path-header-sub path-header-sub--celebrate">${escapeHtml(vm.t('path.goalMet'))}</p>
      <p class="path-header-sub">${escapeHtml(plannedLine)}</p>`;
  } else if (p.remainingSec > 0) {
    const mins = Math.ceil(p.remainingSec / 60);
    sub = `<p class="path-header-sub">${escapeHtml(vm.t('path.minutesLeft', { minutes: String(mins) }))}</p>`;
    if (p.nodes.length > 0) {
      const planned = formatDuration(p.plannedTotalSec);
      const count = p.nodes.length;
      const plannedLine =
        count === 1
          ? vm.t('path.plannedSummaryOne', { duration: planned })
          : vm.t('path.plannedSummary', { count: String(count), duration: planned });
      sub += `<p class="path-header-sub">${escapeHtml(plannedLine)}</p>`;
    }
    if (p.shortfallSec > 0) {
      sub += `<p class="path-header-sub path-header-sub--warn">${escapeHtml(
        vm.t('path.shortfall', { minutes: String(Math.ceil(p.shortfallSec / 60)) }),
      )}</p>`;
    }
    if (p.unknownDurationCount > 0) {
      sub += `<p class="path-header-sub">${escapeHtml(
        vm.t('path.unknownDuration', { count: String(p.unknownDurationCount) }),
      )}</p>`;
    }
    if (p.showStalePlanHint) {
      sub += `<p class="path-header-sub path-header-sub--warn">${escapeHtml(vm.t('path.stalePlanHint'))}</p>`;
    }
  }

  const actions = `
    <div class="path-header-actions">
      <button type="button" class="secondary" data-path-action="regenerate">${escapeHtml(vm.t('path.regeneratePath'))}</button>
      ${
        p.showGoalMet
          ? `<button type="button" class="secondary" data-path-action="new-path">${escapeHtml(vm.t('path.newPath'))}</button>`
          : ''
      }
    </div>`;

  return `
    <div class="path-header">
      <div class="path-header-ring">${ring}</div>
      <div class="path-header-copy">${sub}${actions}</div>
    </div>`;
}

export function dashboardPathSectionHtml(vm: DashboardViewModel): string {
  const p = vm.pathUi!;

  let body = '';
  if (p.showNoGoal) {
    body = `<div class="path-empty">${escapeHtml(vm.t('path.noGoal'))}</div>`;
  } else if (p.showGoalMet && p.nodes.length === 0) {
    body = `<div class="path-empty path-empty--celebrate">${escapeHtml(vm.t('path.goalMetSub'))}</div>`;
  } else if (p.showMissingDuration) {
    body = `
      <div class="path-empty">
        <h3 class="path-empty-title">${escapeHtml(vm.t('path.loadingDurationsTitle'))}</h3>
        <p>${escapeHtml(vm.t('path.loadingDurationsBody', { count: String(p.unknownDurationCount) }))}</p>
      </div>`;
  } else if (p.showEmptyCandidates) {
    body = `
      <div class="path-empty">
        <h3 class="path-empty-title">${escapeHtml(vm.t('path.emptyTitle'))}</h3>
        <p>${escapeHtml(vm.t('path.emptyBody'))}</p>
      </div>`;
  } else if (p.nodes.length > 0) {
    body = pathTrailHtml(vm);
  } else {
    body = `<div class="path-empty">${escapeHtml(vm.t('path.emptyBody'))}</div>`;
  }

  return `
    <section class="${vm.viewPanelClass('path')} dash-section-center path-section" data-view-panel="path" aria-label="${escapeHtml(vm.t('path.mainAria'))}">
      <h1 class="row-title dash-section-head">${escapeHtml(vm.t('path.title'))}</h1>
      <p class="row-sub dash-section-sub">${escapeHtml(vm.t('path.subtitle'))}</p>
      ${
        p.nodes.length > 0 && !p.showNoGoal
          ? `<p class="row-sub dash-section-sub path-section-hint">${escapeHtml(vm.t('path.stepsNotFullVideosHint'))}</p>`
          : ''
      }
      ${pathHeaderHtml(vm)}
      ${body}
    </section>`;
}
