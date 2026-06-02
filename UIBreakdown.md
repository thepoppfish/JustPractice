# JustPractice — UI names (quick reference)

Use these names when asking for changes. Each line is **what you see** → **what to call it**.

---

## Where the app shows up

| Place | Call it |
|--------|---------|
| Box on YouTube over the video page | **YouTube watch panel** |
| Icon click in Chrome toolbar | **Popup** |
| Full tab (Library, Settings, …) | **Dashboard** |

---

## YouTube watch panel

| What you see | Call it |
|--------------|---------|
| Whole floating box | **Watch panel** |
| Top bar: ▲ and “drag to move” | **Collapse bar** / **drag strip** |
| Video title at top | **Panel title** |
| “Save to library” button | **Save button** |
| “Mark complete” | **Complete button** |
| “Video finished — mark it complete?” near the end | **End-of-video complete prompt** (saved videos only) |
| Sidebar hidden on saved `/watch` videos | **Learning focus mode** (settings toggle) |
| Level dropdown + rank badge + ring | **Level row** (level, **XP bar**, **daily goal ring**) |
| “Count practice time” checkbox | **Practice toggle** |
| Hint text under the checkbox | **Practice hint** |
| Calendar with one month + ‹ › | **Month calendar** (watch panel calendar) |
| Red / green day squares with numbers | **Day cells** |
| Small text under each day (0, X, 5m, …) | **Day labels** |
| Streak line (🔥 0 No streak…) | **Streak strip** |
| Red/green legend under the month | **Month legend** |

**Not on YouTube:** the wide year dot grid. That is only on the dashboard (**year heatmap**).

---

## Dashboard

| What you see | Call it |
|--------------|---------|
| Left menu (Library, Progress, …) | **Sidebar** / **nav** |
| Library list of videos | **Library** |
| Search + level filters | **Library filters** |
| Progress tab stats cards | **Progress stats** |
| “Last 7 days” row of days | **7-day chart** |
| Big year grid (dots for whole year) | **Year heatmap** (“year at a glance”) |
| Tap a month in year view → month detail | **Month viewer** (dashboard month drill-down) |
| Settings tab toggles | **Settings** |
| “Show practice time on calendar” toggle | **Calendar time toggle** |

---

## Popup

| What you see | Call it |
|--------------|---------|
| Small summary when you click the extension icon | **Popup** |
| Today’s time / quick stats there | **Popup stats** |

---

## Calendar types (easy mix-up)

| Call it | Looks like | Where |
|---------|------------|--------|
| **Month calendar** | One month, 7 columns, day numbers | Watch panel (always) |
| **Year heatmap** | Many narrow columns, whole year | Dashboard Progress |
| **Month viewer** | One month opened from the year heatmap | Dashboard only |
| **7-day chart** | Last 7 days in a row | Dashboard Progress |

---

## Home feed (YouTube, no video open)

| What you see | Call it |
|--------------|---------|
| Red banner “pick a video…” | **Home feed attention banner** |
| Hover card on thumbnails | **Feed card** / **feed popover** |

---

## Code files (only if you need to point at code)

| Area | Main file |
|------|-----------|
| Watch panel | `src/content/youtubeWatchPanelRuntime.ts` |
| Month calendar paint | `src/content/youtubePanelCalendarUi.ts` |
| Year heatmap | `src/lib/yearHeatmapHtml.ts` |
| Dashboard page | `src/dashboard/` |

---

## Example requests

- “Make **day labels** white on the **watch panel** **month calendar**.”
- “Change the **year heatmap** legend on the **dashboard**, not YouTube.”
- “Move the **watch panel** higher on the screen.”
- “Fix **7-day chart** on **dashboard** Progress tab.”
