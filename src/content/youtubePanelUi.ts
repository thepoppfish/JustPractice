import {
  formatGoalPairLineLive,
  formatGoalSlashLive,
  ringDasharrayFromProgress,
} from '../lib/goalFormat';
import { shouldShowWatchPanelLibraryChrome } from '../lib/youtubeIds';
import { escapeAttr, escapeHtml } from '../lib/htmlEscape';
import { matchesActiveFramework, isLegacyLevelTag, tagsForFramework } from '../lib/levelTags';
import {
  type LevelFramework,
  type LevelTag,
  type LibraryItem,
  type PracticeGoals,
} from '../lib/storage';
import { levelFromTotalXp, MAX_ACCOUNT_LEVEL, xpIntoCurrentLevel } from '../lib/playerProgress';

export {
  buildMergedDailyForPanel,
  mergeIncomingDailySnapshot,
  calendarViewIncludesToday,
  streakCaption,
  streakAriaLabel,
  paintCalStreak,
  renderWatchPanelCalendar,
  type RenderWatchPanelCalendarParams,
} from './youtubePanelCalendarUi';


export function levelSelectOptionsHtml(framework: LevelFramework, customLevels: readonly string[]): string {
  return tagsForFramework(framework, customLevels)
    .map((l) => `<option value="${escapeAttr(l)}">${escapeHtml(l)}</option>`)
    .join('');
}

export function populateLevelSelect(
  sel: HTMLSelectElement,
  fw: LevelFramework,
  current: LevelTag | null,
  customLevels: readonly string[],
  panelT: (k: string, p?: Record<string, string | number>) => string,
): void {
  const parts: string[] = ['<option value="">—</option>'];
  for (const lv of tagsForFramework(fw, customLevels)) {
    parts.push(`<option value="${escapeAttr(lv)}">${escapeHtml(lv)}</option>`);
  }
  if (current !== null && isLegacyLevelTag(current, fw, customLevels)) {
    parts.push(
      `<option value="${escapeAttr(current)}">${escapeHtml(current)} (${escapeHtml(panelT('common.legacyShort'))})</option>`,
    );
  }
  sel.innerHTML = parts.join('');
  if (current !== null && (matchesActiveFramework(current, fw, customLevels) || isLegacyLevelTag(current, fw, customLevels))) {
    sel.value = current;
  } else {
    sel.value = '';
  }
}

/** Save / complete / level controls only on watch-like pages; homepage keeps XP + calendar. */
export function syncWatchPanelVideoLibraryChrome(p: {
  shadowRoot: ShadowRoot | null;
  readTitle?: () => string;
  getVideoIdFromUrl?: () => string | null;
}): void {
  if (!p.shadowRoot) return;
  const resolveVideoId = p.getVideoIdFromUrl ?? (() => null);
  const onWatchPage = shouldShowWatchPanelLibraryChrome(resolveVideoId);
  const wrap = p.shadowRoot.querySelector('.wrap') as HTMLElement | null;
  if (wrap) wrap.dataset.jpLibraryChrome = onWatchPage ? '1' : '0';
  const titleEl = p.shadowRoot.querySelector('[part="title"]') as HTMLElement | null;
  if (titleEl) titleEl.hidden = !onWatchPage;
  for (const part of ['save-row', 'complete-row'] as const) {
    const el = p.shadowRoot.querySelector(`[part="${part}"]`) as HTMLElement | null;
    if (el) el.hidden = !onWatchPage;
  }
  const levelControls = p.shadowRoot.querySelector('.level-controls') as HTMLElement | null;
  if (levelControls) levelControls.hidden = !onWatchPage;
  const statusEl = p.shadowRoot.querySelector('[part="status"]') as HTMLElement | null;
  if (statusEl) statusEl.hidden = !onWatchPage;
  const hintEl = p.shadowRoot.querySelector('[part="hint"]') as HTMLElement | null;
  if (hintEl) hintEl.hidden = !onWatchPage;
  const libraryBanner = p.shadowRoot.querySelector('[part="library-banner"]') as HTMLElement | null;
  if (libraryBanner) libraryBanner.hidden = !onWatchPage;
  const completePrompt = p.shadowRoot.querySelector('[part="complete-prompt"]') as HTMLElement | null;
  if (!onWatchPage) {
    if (completePrompt) completePrompt.hidden = true;
    return;
  }
  if (titleEl && p.readTitle) {
    const t = p.readTitle();
    titleEl.textContent = t.length > 90 ? `${t.slice(0, 90)}…` : t;
  }
}

export function syncWatchPanelLabels(p: {
  shadowRoot: ShadowRoot | null;
  inLibrary: boolean;
  panelT: (k: string, p?: Record<string, string | number>) => string;
  onAfter?: () => void;
}): void {
  if (!p.shadowRoot) return;
  const dh = p.shadowRoot.querySelector('[part="drag-hint"]');
  if (dh) dh.textContent = p.panelT('panel.dragToMove');
  const lvl = p.shadowRoot.querySelector('[part="level-label"]');
  if (lvl) lvl.textContent = p.panelT('common.level');
  const addBtn = p.shadowRoot.querySelector('[part="add"]') as HTMLButtonElement | null;
  if (addBtn) {
    addBtn.textContent = p.inLibrary ? p.panelT('panel.saveToLibraryWhenSaved') : p.panelT('panel.saveToLibrary');
    if (p.inLibrary) {
      addBtn.title = p.panelT('panel.saveToLibraryWhenSavedHint');
    } else {
      addBtn.removeAttribute('title');
    }
  }
  const practiceLb = p.shadowRoot.querySelector('[part="practice-label"]');
  if (practiceLb) practiceLb.textContent = p.panelT('panel.countPractice');
  const calLeg = p.shadowRoot.querySelector('[part="cal-legend"]');
  if (calLeg) calLeg.textContent = p.panelT('dash.practiceDayCreditHint');
  p.onAfter?.();
}

export function syncWatchPanelCompletionUi(p: {
  shadowRoot: ShadowRoot | null;
  item: LibraryItem | null;
  panelT: (k: string, p?: Record<string, string | number>) => string;
}): void {
  if (!p.shadowRoot) return;
  const btn = p.shadowRoot.querySelector('[part="complete-btn"]') as HTMLButtonElement | null;
  const row = p.shadowRoot.querySelector('[part="complete-row"]') as HTMLElement | null;
  if (!btn || !row) return;
  const isComplete = p.item?.completedAt != null;
  btn.textContent = isComplete ? p.panelT('panel.markIncomplete') : p.panelT('panel.markComplete');
  btn.classList.toggle('is-complete', isComplete);
  if (isComplete) {
    btn.title = p.panelT('panel.markIncompleteHint');
  } else {
    btn.title = p.panelT('panel.markCompleteHint');
  }
}

export function syncWatchPanelEndedPromptLabels(p: {
  shadowRoot: ShadowRoot | null;
  panelT: (k: string, p?: Record<string, string | number>) => string;
}): void {
  if (!p.shadowRoot) return;
  const text = p.shadowRoot.querySelector('[part="complete-prompt-text"]');
  const yes = p.shadowRoot.querySelector('[part="complete-prompt-yes"]') as HTMLButtonElement | null;
  const no = p.shadowRoot.querySelector('[part="complete-prompt-no"]') as HTMLButtonElement | null;
  if (text) text.textContent = p.panelT('panel.videoEndedPrompt');
  if (yes) yes.textContent = p.panelT('panel.videoEndedYes');
  if (no) no.textContent = p.panelT('panel.videoEndedNo');
}

export function setWatchPanelEndedPromptVisible(p: {
  shadowRoot: ShadowRoot | null;
  visible: boolean;
}): void {
  const el = p.shadowRoot?.querySelector('[part="complete-prompt"]') as HTMLElement | null;
  if (!el) return;
  el.hidden = !p.visible;
}

export function applyWatchPanelCollapsed(p: {
  shadowRoot: ShadowRoot | null;
  collapsed: boolean;
  panelT: (k: string, p?: Record<string, string | number>) => string;
}): void {
  if (!p.shadowRoot) return;
  const wrap = p.shadowRoot.querySelector('.wrap') as HTMLElement | null;
  const btn = p.shadowRoot.querySelector('[part="collapse"]') as HTMLButtonElement | null;
  if (!wrap || !btn) return;
  wrap.classList.toggle('collapsed', p.collapsed);
  btn.textContent = p.collapsed ? '▼' : '▲';
  btn.title = p.collapsed ? p.panelT('panel.expand') : p.panelT('panel.collapse');
  btn.setAttribute('aria-expanded', p.collapsed ? 'false' : 'true');
}


export function updateDailyGoalRing(p: {
  shadowRoot: ShadowRoot | null;
  getGoals: () => PracticeGoals;
  getTodayPracticeSeconds: () => number;
  panelT: (k: string, params?: Record<string, string | number>) => string;
}): void {
  if (!p.shadowRoot) return;
  const fg = p.shadowRoot.querySelector('[part="daily-ring-fg"]') as SVGCircleElement | null;
  const label = p.shadowRoot.querySelector('[part="daily-ring-label"]') as HTMLElement | null;
  const wrap = p.shadowRoot.querySelector('[part="daily-goal-ring"]') as HTMLElement | null;
  if (!fg || !label || !wrap) return;

  const goals = p.getGoals();
  const target = goals.dailyTargetSec;
  const done = p.getTodayPracticeSeconds();

  if (target === null || target <= 0) {
    fg.setAttribute('stroke-dasharray', '0 100');
    fg.style.strokeDashoffset = '0';
    label.textContent = '—';
    label.classList.add('daily-ring-muted');
    wrap.title = p.panelT('panel.dailyGoalNoTarget');
    return;
  }

  label.classList.remove('daily-ring-muted');
  const pct = Math.min(1, done / target);
  fg.setAttribute('stroke-dasharray', ringDasharrayFromProgress(pct));
  fg.style.strokeDashoffset = '0';
  label.textContent = formatGoalSlashLive(done, target);
  wrap.title = p.panelT('panel.dailyGoalTooltip', {
    pair: formatGoalPairLineLive(done, target),
    percent: String(Math.round(pct * 100)),
  });
}

let xpToastTimer: ReturnType<typeof setTimeout> | null = null;

/** Brief +XP / rank-up floater on the rank block (live feedback without relying on status line). */
export function showWatchPanelXpToast(p: {
  shadowRoot: ShadowRoot | null;
  panelT: (k: string, params?: Record<string, string | number>) => string;
  xpGained: number;
  levelUp: boolean;
  newLevel: number;
}): void {
  if (!p.shadowRoot) return;
  const toast = p.shadowRoot.querySelector('[part="player-xp-toast"]') as HTMLElement | null;
  if (!toast) return;

  if (xpToastTimer != null) {
    clearTimeout(xpToastTimer);
    xpToastTimer = null;
  }

  if (p.levelUp) {
    toast.textContent = p.panelT('panel.flashRankUp', { level: String(p.newLevel) });
    toast.className = 'player-xp-toast player-xp-toast--rank-up is-visible';
  } else if (p.xpGained > 0) {
    toast.textContent = p.panelT('panel.flashXp', { xp: String(p.xpGained) });
    toast.className = 'player-xp-toast is-visible';
  } else {
    toast.hidden = true;
    return;
  }

  toast.hidden = false;
  xpToastTimer = setTimeout(() => {
    toast.classList.remove('is-visible');
    xpToastTimer = setTimeout(() => {
      toast.hidden = true;
      xpToastTimer = null;
    }, 350);
  }, 2200);
}

export function updatePlayerXpBar(p: {
  shadowRoot: ShadowRoot | null;
  totalXp: number;
  prestigeLevel?: number;
  panelT: (k: string, params?: Record<string, string | number>) => string;
}): void {
  if (!p.shadowRoot) return;
  const badge = p.shadowRoot.querySelector('[part="player-level-badge"]') as HTMLElement | null;
  const prestigeEl = p.shadowRoot.querySelector('[part="player-prestige-badge"]') as HTMLElement | null;
  const fill = p.shadowRoot.querySelector('[part="player-xp-fill"]') as HTMLElement | null;
  const wrap = p.shadowRoot.querySelector('[part="player-xp"]') as HTMLElement | null;
  const progressLine = p.shadowRoot.querySelector('[part="player-xp-progress"]') as HTMLElement | null;
  const remainingLine = p.shadowRoot.querySelector('[part="player-xp-remaining"]') as HTMLElement | null;
  if (!badge || !fill || !wrap) return;

  const level = levelFromTotalXp(p.totalXp);
  const bar = xpIntoCurrentLevel(p.totalXp);
  const maxLevel = level >= MAX_ACCOUNT_LEVEL;
  badge.textContent = p.panelT('panel.rankShort', { level: String(level) });
  fill.style.width = `${maxLevel ? 100 : bar.progressPercent}%`;

  if (progressLine) {
    if (maxLevel) {
      progressLine.textContent = p.panelT('progress.maxLevel');
      if (remainingLine) remainingLine.hidden = true;
    } else {
      const remaining = Math.max(0, bar.xpNeededForNext - bar.xpIntoLevel);
      progressLine.textContent = p.panelT('panel.xpBarProgress', {
        current: String(bar.xpIntoLevel),
        needed: String(bar.xpNeededForNext),
      });
      if (remainingLine) {
        remainingLine.hidden = false;
        remainingLine.textContent = p.panelT('panel.xpToRankUp', { remaining: String(remaining) });
      }
    }
  }

  wrap.setAttribute(
    'aria-label',
    maxLevel
      ? p.panelT('progress.maxLevel')
      : p.panelT('panel.xpBarAria', {
          level: String(level),
          current: String(bar.xpIntoLevel),
          needed: String(bar.xpNeededForNext),
          remaining: String(Math.max(0, bar.xpNeededForNext - bar.xpIntoLevel)),
        }),
  );
  if (prestigeEl) {
    const pl = p.prestigeLevel ?? 0;
    if (pl > 0) {
      prestigeEl.hidden = false;
      prestigeEl.textContent = p.panelT('progress.prestigeBadgeShort', { level: String(pl) });
    } else {
      prestigeEl.hidden = true;
      prestigeEl.textContent = '';
    }
  }
}


export function attachPanelDrag(
  host: HTMLElement,
  handle: HTMLElement,
  onCommitPosition: (left: number, top: number) => void,
): void {
  handle.style.touchAction = 'none';
  handle.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const rect = host.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    const move = (ev: PointerEvent): void => {
      let nx = ev.clientX - offsetX;
      let ny = ev.clientY - offsetY;
      const w = host.offsetWidth;
      const h = host.offsetHeight;
      nx = Math.max(8, Math.min(nx, window.innerWidth - w - 8));
      ny = Math.max(8, Math.min(ny, window.innerHeight - h - 8));
      host.style.left = `${nx}px`;
      host.style.top = `${ny}px`;
      host.style.right = 'auto';
      host.style.bottom = 'auto';
    };

    const up = (_ev: PointerEvent): void => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', up);
      const left = parseFloat(host.style.left) || 0;
      const top = parseFloat(host.style.top) || 0;
      onCommitPosition(left, top);
    };

    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', up);
  });
}
