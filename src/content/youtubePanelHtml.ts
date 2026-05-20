import { APP_NAME } from '../lib/branding';
import { escapeHtml } from '../lib/htmlEscape';

export interface WatchPanelLabels {
  dragToMove: string;
  level: string;
  saveToLibrary: string;
  countPracticeTime: string;
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
      :host { all: initial; }
      .wrap {
        background: rgba(15, 15, 15, 0.94);
        color: #eee;
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 10px;
        padding: 0;
        min-width: 220px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.45);
        overflow: hidden;
      }
      .drag-strip {
        display: flex;
        align-items: stretch;
        gap: 6px;
        padding: 8px 10px;
        background: rgba(255,255,255,0.06);
        border-radius: 10px 10px 0 0;
      }
      .wrap.collapsed .drag-strip {
        border-radius: 10px;
      }
      .collapse-btn {
        flex: 0 0 auto;
        min-width: 28px;
        padding: 2px 6px;
        font-size: 11px;
        line-height: 1.2;
        background: #2a2a2a;
        border-color: #555;
        color: #ccc;
      }
      .collapse-btn:hover { color: #fff; }
      .drag-handle {
        flex: 1;
        min-width: 0;
        cursor: grab;
        user-select: none;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 11px;
        color: #888;
      }
      .drag-handle:active { cursor: grabbing; }
      .panel-main { padding: 10px 12px 12px; }
      .wrap.collapsed .panel-main { display: none; }
      .wrap--no-video .panel-main [part="save-row"],
      .wrap--no-video .panel-main [part="complete-row"],
      .wrap--no-video .panel-main .row.level-row,
      .wrap--no-video .panel-main .row.practice,
      .wrap--no-video .panel-main .hint {
        display: none !important;
      }
      .home-feed-attention[hidden] {
        display: none !important;
      }
      .home-feed-attention {
        display: block;
        margin: 0;
        padding: 10px 12px;
        font-size: 12px;
        font-weight: 700;
        line-height: 1.45;
        color: #fff;
        text-shadow: 0 0 2px rgba(0, 0, 0, 0.75);
        border-bottom: 1px solid rgba(255, 255, 255, 0.2);
        box-sizing: border-box;
        animation: jp-home-attention-flash 1s ease-in-out infinite;
      }
      @keyframes jp-home-attention-flash {
        0%,
        100% {
          background: rgba(200, 28, 28, 0.96);
        }
        50% {
          background: rgba(110, 12, 12, 0.88);
        }
      }
      .grip { opacity: 0.85; letter-spacing: -1px; }
      .row { display: flex; align-items: center; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
      .row.level-row {
        justify-content: space-between;
        flex-wrap: nowrap;
        gap: 10px;
      }
      .level-controls {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1;
        min-width: 0;
      }
      .daily-goal-ring {
        flex-shrink: 0;
        width: 54px;
        height: 54px;
        position: relative;
      }
      .daily-ring-svg {
        width: 54px;
        height: 54px;
        display: block;
      }
      .daily-ring-bg {
        stroke: rgba(255, 255, 255, 0.12);
      }
      .daily-ring-fg {
        stroke: #ff6b26;
        stroke-linecap: round;
        transition: stroke-dasharray 0.35s ease;
      }
      .daily-ring-label {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        font-size: 9px;
        font-weight: 700;
        color: #eee;
        text-align: center;
        line-height: 1.1;
        max-width: 46px;
        pointer-events: none;
      }
      .daily-ring-muted {
        color: #666;
        font-weight: 600;
      }
      .row[hidden] {
        display: none !important;
      }
      .row:first-of-type { margin-top: 0; }
      label { color: #bbb; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
      select, button {
        font: inherit;
        border-radius: 6px;
        border: 1px solid rgba(255,255,255,0.2);
        background: #2a2a2a;
        color: #fff;
        padding: 6px 8px;
      }
      button { cursor: pointer; background: #1a66ff; border-color: #3d7cff; }
      button.secondary { background: #333; border-color: #555; }
      button.secondary.is-complete { background: rgba(66, 198, 111, 0.22); border-color: rgba(66, 198, 111, 0.55); color: #b8f0cc; }
      button:hover { filter: brightness(1.08); }
      .practice {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 600;
      }
      input[type="checkbox"] { width: 18px; height: 18px; accent-color: #1a66ff; }
      .hint { font-size: 11px; color: #888; line-height: 1.35; margin-top: 6px; }
      .status { font-size: 11px; color: #9cf; min-height: 14px; }
      .library-banner[hidden] {
        display: none !important;
      }
      .library-banner {
        font-size: 11px;
        line-height: 1.45;
        margin-top: 8px;
        padding: 8px 9px;
        border-radius: 8px;
        word-break: break-word;
      }
      .library-banner--warn {
        color: #ffe8d4;
        background: rgba(255, 140, 60, 0.16);
        border: 1px solid rgba(255, 170, 90, 0.5);
      }
      .library-banner--ok {
        color: #c8e8ff;
        background: rgba(80, 160, 255, 0.12);
        border: 1px solid rgba(120, 180, 255, 0.35);
      }
      .complete-prompt[hidden] {
        display: none !important;
      }
      .complete-prompt {
        margin-top: 8px;
        padding: 8px 9px;
        border-radius: 8px;
        background: rgba(66, 198, 111, 0.12);
        border: 1px solid rgba(66, 198, 111, 0.35);
      }
      .complete-prompt-text {
        margin: 0 0 8px;
        font-size: 11px;
        line-height: 1.4;
        color: #c8f0d4;
      }
      .complete-prompt-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .complete-prompt-actions button {
        flex: 1;
        min-width: 0;
        font-size: 11px;
        padding: 5px 8px;
      }
      .complete-prompt-actions .secondary {
        background: #333;
        border-color: #555;
      }
      .jp-debug-strip[hidden] {
        display: none !important;
      }
      .jp-debug-strip {
        display: block;
        margin-top: 8px;
        padding: 6px 8px;
        font-size: 10px;
        line-height: 1.35;
        font-family: ui-monospace, Consolas, monospace;
        color: #c8f0c8;
        background: rgba(0, 48, 24, 0.55);
        border: 1px solid rgba(80, 200, 120, 0.45);
        border-radius: 6px;
        max-height: 110px;
        overflow: auto;
        white-space: pre-wrap;
        word-break: break-word;
      }
      .title { font-weight: 600; font-size: 12px; color: #fff; margin-bottom: 4px; max-width: 260px; line-height: 1.3; }
      .calendar-section {
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px solid rgba(255,255,255,0.08);
      }
      .cal-header {
        margin-bottom: 8px;
      }
      .cal-header-year {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .cal-header-month {
        display: none;
        justify-content: center;
        width: 100%;
      }
      .calendar-section:has(.year-hm--month-open) .cal-header-year {
        display: none;
      }
      .calendar-section:has(.year-hm--month-open) .cal-header-month {
        display: flex;
      }
      .cal-header button { min-width: 36px; padding: 4px 8px; font-size: 16px; line-height: 1; }
      .cal-label { font-size: 11px; font-weight: 600; color: #ccc; flex: 1; text-align: center; }
      .cal-streak {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 4px 8px;
        margin-bottom: 8px;
        line-height: 1.25;
      }
      .cal-streak-flame { font-size: 15px; line-height: 1; }
      .cal-streak-n {
        font-size: 15px;
        font-weight: 800;
        font-variant-numeric: tabular-nums;
        color: #f2f2f2;
      }
      .cal-streak-cap { font-size: 10px; color: #888; flex: 1; min-width: 0; }
      .cal-grid { display: flex; flex-direction: column; gap: 4px; }
      .cal-legend { font-size: 10px; color: #666; line-height: 1.35; margin: 6px 0 0; }
      .cal-weekday-row {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 2px;
      }
      .cal-wd { font-size: 9px; color: #666; text-align: center; }
      .cal-cells {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 2px;
      }
      .cal-cell {
        min-height: 34px;
        padding: 3px 2px;
        border-radius: 4px;
        background: rgba(255,255,255,0.04);
        font-size: 10px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-start;
      }
      .cal-cell-empty { background: transparent; min-height: 34px; }
      .cal-cell-today { box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.5); }
      .cal-cell-future {
        opacity: 0.48;
        background: rgba(255, 255, 255, 0.03);
      }
      .cal-cell-future .cal-day-num { color: #777; }
      .cal-cell--none {
        background: rgba(224, 77, 77, 0.12);
        border: 1px solid rgba(224, 77, 77, 0.28);
      }
      .cal-cell--active {
        background: rgba(66, 198, 111, 0.14);
        border: 1px solid rgba(66, 198, 111, 0.32);
      }
      .cal-cell--goal {
        background: rgba(232, 184, 74, 0.16);
        border: 1px solid rgba(232, 184, 74, 0.38);
      }
      .cal-day-num { font-weight: 600; color: #eee; line-height: 1.2; }
      .cal-day-min { font-size: 9px; line-height: 1.1; margin-top: 2px; }
      .cal-cell--none .cal-day-min { color: #e88888; }
      .cal-cell--active .cal-day-min { color: #7bdc9e; }
      .cal-cell--goal .cal-day-min { color: #e8c878; }
      .cal-cell--neutral {
        opacity: 0.55;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.06);
      }
      .cal-cell--neutral .cal-day-num { color: #999; }
      .year-hm-chart { width: 100%; }
      .year-hm-body {
        display: grid;
        grid-template-columns: 16px minmax(0, 1fr);
        gap: 2px;
        align-items: stretch;
        width: 100%;
      }
      .year-hm-weekdays {
        display: grid;
        grid-template-rows: repeat(7, minmax(0, 1fr));
        gap: 2px;
        align-self: stretch;
      }
      .year-hm-wd {
        font-size: 9px;
        line-height: 1;
        color: #666;
        text-align: right;
        display: flex;
        align-items: center;
        justify-content: flex-end;
      }
      .year-hm-cells {
        display: grid;
        grid-template-rows: repeat(7, minmax(0, 1fr));
        grid-template-columns: repeat(var(--year-weeks, 53), minmax(0, 1fr));
        grid-auto-flow: column;
        gap: 2px;
        width: 100%;
        min-width: 0;
        padding-bottom: 2px;
      }
      .year-hm-cell {
        width: 100%;
        aspect-ratio: 1;
        min-width: 0;
        min-height: 0;
        border-radius: 2px;
        box-sizing: border-box;
      }
      .year-hm-cell--empty { visibility: hidden; pointer-events: none; }
      .year-hm-cell--blank { background: rgba(120, 120, 128, 0.45); }
      .year-hm-cell--none { background: #e04d4d; }
      .year-hm-cell--active { background: #42c66f; }
      .year-hm-cell--goal { background: #e8b84a; }
      .year-hm-cell--today { box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.85); }
      .year-hm-keys {
        display: flex;
        flex-wrap: wrap;
        gap: 6px 10px;
        margin: 0;
        font-size: 9px;
        color: #666;
      }
      .year-hm-key { display: inline-flex; align-items: center; gap: 4px; }
      .year-hm-key-dot { width: 7px; height: 7px; border-radius: 2px; flex-shrink: 0; }
      .year-hm-key-dot--none { background: #e04d4d; }
      .year-hm-key-dot--active { background: #42c66f; }
      .year-hm-key-dot--goal { background: #e8b84a; }
      .calendar-section:has(.year-hm--month-open) .cal-legend {
        display: none;
      }
      .year-hm-stage { min-height: 100px; }
      .year-hm-year-layer[hidden], .year-hm-month-layer[hidden] { display: none !important; }
      .year-hm-cell--month-hover { filter: brightness(1.35); box-shadow: 0 0 0 1px rgba(255,255,255,0.45); }
      .year-hm-cell { cursor: pointer; border: none; padding: 0; }
      .year-hm-month-detail { display: flex; flex-direction: column; gap: 6px; padding: 2px 0; border-radius: 6px; background: rgba(255,255,255,0.04); }
      .year-hm-month-detail--golden {
        background: linear-gradient(165deg, rgba(232,184,74,0.28), rgba(232,184,74,0.1) 50%, rgba(255,255,255,0.04));
        box-shadow: inset 0 0 0 1px rgba(232,184,74,0.35);
      }
      .year-hm-month-toolbar { display: flex; align-items: flex-start; gap: 8px; flex-wrap: wrap; }
      .year-hm-back {
        display: inline-flex; align-items: center; gap: 5px; flex-shrink: 0;
        padding: 5px 10px; font-size: 11px; font-weight: 500; line-height: 1.2;
        color: #eee; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.14);
        border-radius: 6px; cursor: pointer;
      }
      .year-hm-back:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.24); }
      .year-hm-back-icon { font-size: 13px; line-height: 1; opacity: 0.85; }
      .year-hm-back-label { white-space: nowrap; }
      .year-hm-month-heading { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
      .year-hm-month-title { font-size: 12px; font-weight: 700; line-height: 1.2; }
      .month-hm-total { margin: 0; font-size: 9px; color: #888; }
      .month-hm-chart { width: 100%; }
      .month-hm-dow-header { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 2px; margin-bottom: 2px; }
      .month-hm-dow { font-size: 8px; color: #666; text-align: center; }
      .month-hm-cells { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 2px; min-width: 0; width: 100%; }
      .month-hm-cell { min-height: 32px; border-radius: 3px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; padding: 2px 1px; box-sizing: border-box; }
      .month-hm-cell--empty { visibility: hidden; pointer-events: none; }
      .month-hm-cell--blank { background: rgba(120,120,128,0.45); }
      .month-hm-cell--none { background: rgba(224,77,77,0.2); border: 1px solid rgba(224,77,77,0.4); }
      .month-hm-cell--active { background: rgba(66,198,111,0.2); border: 1px solid rgba(66,198,111,0.4); }
      .month-hm-cell--goal { background: rgba(232,184,74,0.25); border: 1px solid rgba(232,184,74,0.45); }
      .month-hm-cell--today { box-shadow: inset 0 0 0 1px rgba(255,255,255,0.75); }
      .month-hm-day-num { font-size: 9px; font-weight: 700; }
      .month-hm-time { font-size: 8px; color: #aaa; font-variant-numeric: tabular-nums; }
      .month-hm-time--empty { opacity: 0.35; }
    </style>
    <div class="wrap">
      <div class="drag-strip">
        <button type="button" class="collapse-btn" part="collapse" aria-expanded="true">▲</button>
        <div class="drag-handle" part="drag-handle"><span class="grip">⠿</span><span part="drag-hint">${escapeHtml(labels.dragToMove)}</span></div>
      </div>
      <div
        class="home-feed-attention"
        part="home-feed-attention"
        role="alert"
        aria-live="assertive"
        hidden
      ></div>
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
            <span class="daily-ring-label daily-ring-muted" part="daily-ring-label">—</span>
          </div>
        </div>
        <div class="row practice">
          <input type="checkbox" id="jp-practice" part="practice" />
          <label for="jp-practice" part="practice-label" style="text-transform:none; font-size:13px; color:#eee;">${escapeHtml(labels.countPracticeTime)}</label>
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
