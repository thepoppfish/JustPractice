/** Shadow-DOM styles for the watch-page floating panel. */
export function watchPanelShadowCss(): string {
  return `      :host {
        display: block;
        box-sizing: border-box;
      }
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
      .player-xp-mini {
        position: relative;
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 3px;
        min-width: 72px;
        max-width: 96px;
      }
      .player-xp-toast {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) scale(0.85);
        z-index: 2;
        padding: 3px 8px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 800;
        color: #fff;
        background: linear-gradient(135deg, #ff6b26, #ffb347);
        border: 1px solid rgba(255, 200, 120, 0.55);
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.45);
        white-space: nowrap;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.15s ease, transform 0.35s ease;
      }
      .player-xp-toast.is-visible {
        opacity: 1;
        transform: translate(-50%, -72%) scale(1);
      }
      .player-xp-toast--rank-up {
        background: linear-gradient(135deg, #ffd966, #ff6b26);
        color: #1a1208;
      }
      .player-level-badge {
        font-size: 9px;
        font-weight: 800;
        color: #ffb347;
        letter-spacing: 0.02em;
        white-space: nowrap;
      }
      .player-prestige-badge {
        font-size: 8px;
        font-weight: 800;
        color: #ffd966;
        letter-spacing: 0.02em;
        white-space: nowrap;
      }
      .player-prestige-badge[hidden] {
        display: none !important;
      }
      .player-xp-track {
        width: 100%;
        min-width: 72px;
        height: 4px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.12);
        overflow: hidden;
      }
      .player-xp-fill {
        height: 100%;
        border-radius: inherit;
        background: linear-gradient(90deg, #ff6b26, #ffb347);
        width: 0%;
        transition: width 0.35s ease;
      }
      .player-xp-label {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1px;
        width: 100%;
        text-align: center;
        line-height: 1.2;
      }
      .player-xp-progress {
        font-size: 8px;
        font-weight: 700;
        color: #ccc;
        white-space: nowrap;
      }
      .player-xp-remaining {
        font-size: 7px;
        font-weight: 600;
        color: #888;
        white-space: nowrap;
      }
      .player-xp-remaining[hidden] {
        display: none !important;
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
      .cal-day-min { font-size: 9px; line-height: 1.1; margin-top: 2px; color: #fff; }
      .cal-day-min--missed { font-size: 10px; font-weight: 500; opacity: 0.55; }
      .cal-day-min--under { font-size: 10px; font-weight: 500; }
      .cal-cell--none .cal-day-min,
      .cal-cell--active .cal-day-min,
      .cal-cell--goal .cal-day-min { color: #fff; }
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
      .year-hm-keys { display: flex; justify-content: center; margin: 0; font-size: 9px; color: #666; }
      .year-hm-keys-row { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px 10px; }
      .month-hm-legend { margin: 4px 0 0; justify-content: center; }
      .year-hm-key { display: inline-flex; align-items: center; gap: 4px; }
      .year-hm-key-dot { width: 7px; height: 7px; border-radius: 2px; flex-shrink: 0; }
      .year-hm-key-dot--none { background: #e04d4d; }
      .year-hm-key-dot--active { background: #42c66f; }
      .year-hm-key-dot--goal { background: #e8b84a; }
      .year-hm-key-icon--flawless-month { font-size: 10px; color: #c4b5fd; }
      .year-hm-key-icon--flawless-year { width: 9px; height: 9px; border-radius: 2px; border: 2px solid rgba(255,204,51,0.85); background: transparent; box-sizing: border-box; }
      .year-hm-month-flawless { margin-left: 1px; font-size: 8px; color: #c4b5fd; vertical-align: super; }
      .month-hm-legend { display: flex; flex-wrap: wrap; gap: 4px 8px; margin: 0 0 6px; font-size: 8px; color: #666; }
      .month-hm-legend-mark { font-weight: 700; color: #eee; }
      .month-hm-legend-swatch { width: 8px; height: 8px; border-radius: 2px; background: rgba(88,108,138,0.55); border: 1px solid rgba(128,158,198,0.55); }
      .year-hm-month-goal-badge { display: inline-block; margin-left: 6px; padding: 1px 6px; font-size: 8px; color: #f5d76e; border: 1px solid rgba(232,184,74,0.45); border-radius: 3px; background: rgba(232,184,74,0.15); }
      .calendar-section:has(.year-hm--month-open) .cal-legend {
        display: none;
      }
      .year-hm-stage { min-height: 100px; }
      .year-hm-year-layer[hidden], .year-hm-month-layer[hidden] { display: none !important; }
      .year-hm-cell--month-hover { filter: brightness(1.35); box-shadow: 0 0 0 1px rgba(255,255,255,0.45); }
      .year-hm-cell { cursor: pointer; border: none; padding: 0; }
      .year-hm-month-carousel { display: flex; align-items: center; justify-content: center; gap: 4px; width: 100%; }
      .year-hm-month-carousel-track { display: flex; align-items: center; justify-content: center; gap: 6px; flex: 1; min-width: 0; }
      .year-hm-month-nav {
        flex-shrink: 0; width: 28px; height: 28px; padding: 0; font-size: 16px; line-height: 1;
        color: #eee; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.14);
        border-radius: 6px; cursor: pointer;
      }
      .year-hm-month-nav:disabled { opacity: 0.28; cursor: default; }
      .year-hm-month-slot-scale { width: 100%; transform-origin: center center; transition: transform 0.2s ease, opacity 0.2s ease; }
      .year-hm-month-slot--center { flex: 0 0 200px; width: 200px; }
      .year-hm-month-slot--prev, .year-hm-month-slot--next { flex: 0 0 128px; width: 128px; cursor: pointer; }
      .year-hm-month-slot--prev .year-hm-month-slot-scale, .year-hm-month-slot--next .year-hm-month-slot-scale { transform: scale(0.72); opacity: 0.38; }
      .year-hm-month-slot--center .year-hm-month-slot-scale { transform: scale(1); opacity: 1; }
      .year-hm-month-detail--peek .month-hm-time, .year-hm-month-detail--peek .month-hm-total { display: none; }
      .year-hm-month-slot--empty { width: 0; opacity: 0; pointer-events: none; overflow: hidden; }
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
      .month-hm-cell--none.month-hm-cell--no-practice { background: rgba(150,42,52,0.42); border: 1px solid rgba(195,72,82,0.62); }
      .month-hm-cell--none.month-hm-cell--today-open { background: rgba(88,108,138,0.3); border: 1px solid rgba(128,158,198,0.55); }
      .month-hm-cell--active { background: rgba(66,198,111,0.2); border: 1px solid rgba(66,198,111,0.4); }
      .month-hm-cell--goal { background: rgba(232,184,74,0.25); border: 1px solid rgba(232,184,74,0.45); }
      .month-hm-cell--today { box-shadow: inset 0 0 0 1px rgba(255,255,255,0.75); }
      .month-hm-day-num { font-size: 9px; font-weight: 700; }
      .month-hm-time { font-size: 8px; font-weight: 600; color: #fff; font-variant-numeric: tabular-nums; }
      .month-hm-cell--none .month-hm-time,
      .month-hm-cell--active .month-hm-time,
      .month-hm-cell--goal .month-hm-time { color: #fff; }
      .month-hm-time--under, .month-hm-time--missed { font-size: 10px; font-weight: 500; }
      .month-hm-time--missed { opacity: 0.55; }
      .month-hm-time--empty { opacity: 0.35; }`;
}
