# Bug report & plan: UI resets every ~15 seconds

**Status:** Phase A + B implemented. Phase C (optional polish) pending.
**Reported by:** user
**Affected surfaces:** extension popup, dashboard (stats page), YouTube watch panel.

---

## 1. What the user reported (dissected)

> "Whenever I interact with something inside the extension, every 15 seconds it
> reverts to a previous state. It doesn't remember every action I do."

Concrete examples given:

| # | Where | What the user does | What goes wrong |
|---|-------|--------------------|-----------------|
| 1 | YouTube home, JustPractice ("JP") panel | Opens the panel, navigates into a settings / "quick setting" step | After ~15s it jumps back to the **first step** |
| 2 | Stats page | Drills from the **year** view into a **month** | After ~15s it jumps **back to the year** |
| 3 | Settings | Switches to the Settings tab/section | After ~15s it jumps **back to the start** (Library) |

Common thread: the user changes a **transient, in-session view** (a tab, a
drill-down, a sub-step). About **15 seconds** later the UI silently rebuilds
itself and that view selection is lost. Persisted data (library items, practice
seconds) is *not* lost — only the **navigation/view state**.

The "~15 seconds" is the key clue and points directly at a timer.

---

## 2. Root cause

There is a **15-second storage poll** that **unconditionally re-renders the UI**
from storage, even when **nothing in storage changed**. Each re-render rebuilds
the DOM from *persisted + module state* only, so any view state that lives
**only in the DOM** is thrown away.

### 2.1 The timer

```1:2:src/lib/storageSyncPoll.ts
/** Default interval for UI storage polls and practice flush to background. */
export const STORAGE_SYNC_INTERVAL_MS = 15_000;
```

`startStorageSyncPoll(onTick)` fires `onTick` every 15s while the page is
visible. It is wired into **all three** surfaces:

- Popup — `src/popup/main.ts:359` → `scheduleRenderFromStorage()` → `render()`
- Dashboard — `src/dashboard/main.ts:473` → `scheduleRenderFromStorage()` → `refreshAfterMutation(['library','path','completed', activeView])`
- Watch panel — `src/content/youtubeWatchPanelRuntime.ts:916` → `refreshCalendarOnly()`

The poll fires on a fixed interval **regardless of whether the data changed**.
(The `chrome.storage.onChanged` listener next to it is the correct, event-driven
path; the poll is a redundant "safety net" that causes the churn.)

### 2.2 Why each surface loses state

**Popup — active tab is DOM-only.** `render()` rebuilds the whole popup with the
Library tab hard-coded active, and tab switching only toggles CSS classes — there
is no module variable remembering the active tab:

```330:343:src/popup/main.ts
function wireTabs(): void {
  const buttons = app.querySelectorAll<HTMLButtonElement>('.tabs button');
  const panels = app.querySelectorAll<HTMLElement>('.panel');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      buttons.forEach((b) => b.classList.toggle('active', b === btn));
      panels.forEach((p) => {
        const id = p.id.replace('panel-', '');
        p.classList.toggle('active', id === tab);
      });
    });
  });
}
```

`render()` does `app.innerHTML = ...` with `data-tab="library" class="active"`
and `<div id="panel-library" class="panel active">` baked in. Every 15s poll →
`render()` → innerHTML reset → **back to Library** (explains example #3).

**Dashboard stats — the month drill-down is DOM-only.** The year→month view is
managed by a closure variable `activeMonth` inside `attachYearHeatmapInteractive`,
held on the heatmap DOM node:

```49:51:src/lib/yearHeatmapInteractive.ts
  let hoveredMonth: string | null = null;
  let activeMonth: { year: number; monthIndex: number } | null = null;
```

The 15s poll calls `refreshAfterMutation(['stats'])` (stats is in the default
panel set when it's the active view), which **rebuilds the stats panel HTML**.
That discards the old DOM node + its `activeMonth` closure and re-attaches a
fresh interactive that defaults to the year view → **back to year** (explains
example #2). Note: `activeView` and `yearHeatmapYear` *do* survive because they
are tracked as module state (`src/dashboard/main.ts:48-49`) — but the month
drill-down is not.

**Watch panel.** The panel poll only calls `refreshCalendarOnly()` (calendar +
goal ring), so the calendar redraw itself is narrow. Example #1 ("quick setting
goes back to first step") is the same class of bug — a transient in-panel view
that is rebuilt — and is resolved by the same fix pattern (track the view, or
don't rebuild it when data is unchanged). Exact panel sub-view to confirm during
implementation.

### 2.3 One-line summary

> A 15s poll re-renders the UI even when storage hasn't changed, and the
> re-render only restores state that is tracked in module/persisted variables.
> Transient view state stored in the DOM (popup tab, stats month drill-down,
> panel sub-step) is lost on every tick.

---

## 3. Plan of action

Two complementary fixes. Phase A alone stops the 15s "phantom" resets (the thing
the user actually feels). Phase B makes the UI robust even on *real* data-change
re-renders so it never jumps.

### Phase A — Stop re-rendering when nothing changed (highest leverage) — DONE

Goal: the 15s poll becomes a true no-op when storage is unchanged.

**Implemented:**
- New helper `src/lib/dataSignature.ts` → `signatureOf(value)` (stable
  `JSON.stringify` signature; unserializable values count as "changed" so updates
  are never silently dropped). Unit-tested in `src/lib/dataSignature.test.ts`.
- **Popup** (`src/popup/main.ts`): records `lastRenderedSignature` on each paint;
  the poll now loads data, compares the signature, and only re-renders on a real
  change. `chrome.storage.onChanged` still renders immediately on real writes.
- **Dashboard** (`src/dashboard/main.ts`): same pattern; signature recorded in
  `renderAsync`, `refreshAfterMutation`, and `refreshWhileSearchFocused`.
- **Watch panel** (`src/content/youtubeWatchPanelRuntime.ts`): extracted
  `applyCalendarSnapshot(...)`; the poll path `pollCalendarSync()` compares
  `lastCalendarSignature` and skips the repaint when the snapshot is unchanged.
  Direct `refreshCalendarOnly()` calls (nav, prev/next month, onChanged) are
  unaffected.

Net effect: while storage is idle, the 15s tick no longer rebuilds the DOM, so
the active tab / drill-down / scroll position stay put.

1. In `storageSyncPoll` consumers (popup, dashboard, panel), keep a **snapshot
   signature** of the last-rendered persisted data (e.g. `JSON.stringify(data)`
   or a cheap hash of the relevant slices).
2. On each poll tick, load data and **skip the render if the signature is
   unchanged** since the last render. Only render on a genuine diff.
3. Keep `chrome.storage.onChanged` as the primary event-driven refresh (it
   already only fires on real writes). Consider whether the poll is even needed
   once onChanged is trusted; if kept, it is now purely a guarded safety net.

This removes the unconditional 15s churn for the common case (user interacting
while storage is idle), which is exactly examples #1–#3.

Files: `src/popup/main.ts`, `src/dashboard/main.ts`,
`src/content/youtubeWatchPanelRuntime.ts`, possibly a small helper in
`src/lib/storageSyncPoll.ts` or a new `lib/dataSignature.ts`.

### Phase B — Preserve transient view state across renders — DONE

Even when a real data change forces a re-render, the user's current view is now
restored (mirrors how `activeView`/`yearHeatmapYear` already survive).

**Implemented:**
1. **Popup active tab** (`src/popup/main.ts`): added module state
   `activeTab: 'library' | 'stats' | 'settings'`, set in `wireTabs`, applied in
   the render markup instead of hard-coding the Library tab as active. A re-render
   now keeps you on Stats/Settings.
2. **Dashboard stats month drill-down**: lifted the zoom (year vs month) out of
   the `attachYearHeatmapInteractive` DOM closure. The component now reports zoom
   via `onZoomChange` and accepts `initialZoom` to restore on re-attach
   (`src/lib/yearHeatmapInteractive.ts`). The dashboard tracks `yearHeatmapZoom`
   in module state and threads getter/setter through `attachDashboardListeners`
   (`src/dashboard/main.ts`, `src/dashboard/dashboardListeners.ts`). Restore is
   guarded to the matching year; changing year resets the zoom to year view.
3. **Watch panel sub-view**: no separate multi-step "quick settings" UI exists in
   the content panel; its only poll-driven repaint is the calendar, already
   change-gated in Phase A. No further change needed.

**Remaining (moved to Phase C):** preserve scroll position / focused element
across panel patches.

Files: `src/popup/main.ts`, `src/dashboard/main.ts`,
`src/dashboard/dashboardListeners.ts`, `src/lib/yearHeatmapInteractive.ts`.

### Phase C — Reduce re-render scope + preserve scroll/focus (optional polish)

- Only re-render the panels whose underlying data actually changed (e.g. redraw
  the calendar/stats only when `dailySeconds` changed) so legitimate writes cause
  the minimum DOM churn.
- Preserve scroll position and the focused element across panel patches.

---

## 4. Test plan

- **Repro before fix**: open popup → Settings tab → wait 15s → observe jump to
  Library. Same for stats month drill-down and the panel step.
- **Unit**: extend `src/lib/storageSyncPoll.test.ts` (or new test) to assert the
  poll does **not** invoke the render callback when the data signature is
  unchanged, and **does** on change.
- **Popup**: add a test that `render()` keeps the active tab when re-run.
- **Dashboard**: test that a re-render with an open month restores the month view.
- **Manual**: on each surface, change a view, wait 20s with no data activity →
  view must stay put. Then trigger a real data change (mark practice / add to
  library) → UI updates but stays on the current view.

---

## 5. Risk / notes

- The poll exists as a safety net for cross-process writes that might miss
  `onChanged`. Phase A keeps the net but guards it — low risk. Do **not** silently
  drop legitimate updates: the signature must cover everything the UI renders.
- Watch panel example #1 needs the exact sub-view identified during
  implementation; the mechanism and fix are otherwise identical.
- Phase A is small and high-impact; recommend shipping A first, then B.
