import { APP_NAME } from '../lib/branding';
import { escapeHtml } from '../lib/htmlEscape';
import { watchPanelShadowCss } from './youtubePanelCss';

export interface WatchPanelLabels {
  dragToMove: string;
  level: string;
  saveToLibrary: string;
  markComplete: string;
  markIncomplete: string;
}

/** Shadow-DOM markup + styles for the watch-page floating panel. */
export function watchPanelShadowInnerHtml(
  levelOptionsHtml: string,
  labels: WatchPanelLabels,
): string {
  return `
    <style>
${watchPanelShadowCss()}
    </style>
    <div class="wrap">
      <div class="drag-strip">
        <button type="button" class="collapse-btn" part="collapse" aria-expanded="true">▲</button>
        <div class="drag-handle" part="drag-handle"><span class="grip">⠿</span><span part="drag-hint">${escapeHtml(labels.dragToMove)}</span></div>
      </div>
      <div class="panel-main">
        <div class="title" part="title">${escapeHtml(APP_NAME)}</div>
        <div class="status" part="status"></div>
        <div
          class="library-banner"
          part="library-banner"
          role="status"
          aria-live="polite"
          hidden
        ></div>
        <div class="row" part="save-row">
          <button type="button" class="secondary" part="add">${escapeHtml(labels.saveToLibrary)}</button>
        </div>
        <div class="row" part="complete-row">
          <button type="button" class="secondary" part="complete-btn">${escapeHtml(labels.markComplete)}</button>
        </div>
        <div class="complete-prompt" part="complete-prompt" hidden>
          <p class="complete-prompt-text" part="complete-prompt-text"></p>
          <div class="complete-prompt-actions">
            <button type="button" part="complete-prompt-yes"></button>
            <button type="button" class="secondary" part="complete-prompt-no"></button>
          </div>
        </div>
        <pre class="jp-debug-strip" part="jp-debug-strip" hidden></pre>
        <div class="row level-row">
          <div class="level-controls">
            <label for="jp-diff" part="level-label">${escapeHtml(labels.level)}</label>
            <select id="jp-diff" part="difficulty">
              <option value="">—</option>
              ${levelOptionsHtml}
            </select>
          </div>
          <div class="player-xp-mini" part="player-xp" aria-label="Rank">
            <span class="player-level-badge" part="player-level-badge">—</span>
            <span class="player-prestige-badge" part="player-prestige-badge" hidden></span>
            <div class="player-xp-track" aria-hidden="true">
              <div class="player-xp-fill" part="player-xp-fill"></div>
            </div>
            <span class="player-xp-label" part="player-xp-label">
              <span class="player-xp-progress" part="player-xp-progress">—</span>
              <span class="player-xp-remaining" part="player-xp-remaining" hidden></span>
            </span>
            <span class="player-xp-toast" part="player-xp-toast" hidden aria-live="polite"></span>
          </div>
          <div class="daily-goal-ring" part="daily-goal-ring" role="img" aria-hidden="true">
            <svg class="daily-ring-svg" viewBox="0 0 36 36" aria-hidden="true">
              <circle
                class="daily-ring-bg"
                pathLength="100"
                cx="18"
                cy="18"
                r="15.9155"
                fill="none"
                stroke-width="3.2"
              />
              <circle
                part="daily-ring-fg"
                class="daily-ring-fg"
                pathLength="100"
                cx="18"
                cy="18"
                r="15.9155"
                fill="none"
                stroke-width="3.2"
                stroke-dasharray="0 100"
                stroke-dashoffset="0"
                transform="rotate(-90 18 18)"
              />
            </svg>
            <svg class="daily-ring-fx" part="daily-ring-fx" viewBox="0 0 36 36" aria-hidden="true"></svg>
            <span class="daily-ring-label daily-ring-muted" part="daily-ring-label">—</span>
          </div>
        </div>
        <div class="hint" part="hint"></div>
        <div class="calendar-section">
          <div class="cal-header">
            <div class="cal-header-year" data-year-hm-nav-year>
              <button type="button" class="secondary" part="cal-prev">‹</button>
              <span class="cal-label" part="cal-label"></span>
              <button type="button" class="secondary" part="cal-next">›</button>
            </div>
            <div class="cal-header-month" data-year-hm-nav-month hidden></div>
          </div>
          <div class="cal-streak" part="cal-streak" dir="ltr" role="status"></div>
          <div class="cal-grid" part="cal-grid"></div>
          <p class="cal-legend" part="cal-legend"></p>
        </div>
      </div>
    </div>
  `;
}
