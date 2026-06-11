# Homepage panel — clean UI (no video context)

**Status:** Implemented (2026-06-06)  
**Last updated:** 2026-06-06  
**Audience:** Anyone implementing the YouTube floating panel  

---

## 1. What you want (plain language)

When you are on the **YouTube homepage** (or any browse/feed page) and **no video is the active context**, the floating JustPractice panel should look **minimal and clean**.

It should **not** pretend there is a video. Specifically, hide:

| # | UI element | Panel part / selector |
|---|------------|------------------------|
| 1 | **Title** (video name or app name) | `[part="title"]` |
| 2 | **Save to library** button | `[part="save-row"]` |
| 3 | **Mark complete** button | `[part="complete-row"]` |
| 4 | **Level** label + level dropdown | `.level-controls` (`[part="level-label"]`, `[part="difficulty"]`) |

Also hide related video-only chrome (same mode):

- Status line under the title (`[part="status"]`)
- “Save this video to your library…” hint (`[part="hint"]`)
- Mark-complete confirmation prompt (`[part="complete-prompt"]`)

**Keep visible** on the homepage (this is the useful stuff without a video):

- Drag handle / collapse control
- **Rank / XP bar** (`[part="player-xp"]`)
- **Daily goal ring** (`[part="daily-goal-ring"]`)
- **Practice calendar** and streak

---

## 2. When to hide vs show

Use one boolean everywhere:

```text
showVideoLibraryChrome = true  →  user is watching a specific video (full watch or Shorts)
showVideoLibraryChrome = false →  browse / homepage / no active video context
```

### `false` (hide video chrome) when **any** of these is true:

1. **No resolvable video id** for the current page context (same idea as `needsHomeFeedPanelAttention`: on YouTube, not on `/watch` or `/shorts/…`, and URL has no `v=` id).
2. **Browse feed is the active surface** — `ytd-browse` is visible (home, subscriptions, search results, channel tabs, etc.). This matters because the mini player can change the URL to `/watch?v=…` while the feed is still on screen.
3. **Shorts feed** (`/shorts` with no video id) — no single video selected.

### `true` (show video chrome) when:

1. User is on a **full watch page** (`/watch?v=…` + `ytd-watch-flexy` visible, browse shell **not** visible).
2. User is on a **single Short** (`/shorts/{videoId}`).

### Edge cases (locked decisions)

| Situation | Video chrome |
|-----------|----------------|
| Homepage, nothing playing | Hidden |
| Homepage, mini player playing (feed still visible) | **Hidden** |
| Full watch page | Shown |
| Shorts player | Shown |
| Subscriptions / search / channel feed | Hidden |

---

## 3. Target layout (wireframe)

### Browse mode (homepage — what we want)

```text
┌─────────────────────────────┐
│ ▲  ⠿  Drag to move          │
├─────────────────────────────┤
│  Rank 4   ████░░  76/400 XP │  ○ 17s/2h
│                             │
│  ◀  June 2026  ▶            │
│  🔥 0  No streak…           │
│  [calendar grid]            │
└─────────────────────────────┘
```

No title row. No save / complete / level.

### Video mode (watch / Shorts — unchanged)

```text
┌─────────────────────────────┐
│ ▲  ⠿  Drag to move          │
├─────────────────────────────┤
│  Video title here…          │
│  [Save to library]          │
│  [Mark complete]            │
│  LEVEL [dropdown]  Rank …   │  ○ goal ring
│  Save this video to…        │
│  [calendar …]               │
└─────────────────────────────┘
```

---

## 4. Why the current approach feels broken

There is already code meant to do this (`shouldShowWatchPanelLibraryChrome`, `syncWatchPanelVideoLibraryChrome`), but it does **not** match the product goal yet.

### Problem A — Title is wrong on browse

In `syncWatchPanelVideoLibraryChrome`, when not on a watch page the code sets:

```ts
titleEl.textContent = APP_NAME;  // shows "JustPractice"
```

It does **not** hide the title. That is why you still see a title line on the homepage. **Fix:** set `titleEl.hidden = true` in browse mode; clear and show only in video mode.

### Problem B — Detection is too indirect

Logic relies on URL paths + DOM heuristics (`ytd-watch-flexy`, `ytd-browse`). YouTube’s SPA is messy: URL, mini player, and DOM do not always agree. The rule should be driven primarily by:

**“Is there an active video context for library actions?”**  
not  
**“Does this look like a watch URL?”**

`needsHomeFeedPanelAttention()` in `youtubePanelMount.ts` already encodes part of this (no video id on non-watch paths). The new helper should **combine** that with browse-shell visibility instead of duplicating conflicting checks.

### Problem C — Sync may run too late or not re-run

Hide/show is applied in `syncWatchPanelVideoLibraryChrome`, called from several places (panel mount, video change, label refresh, storage). If detection returns the wrong value once, or the panel was created before CSS/`hidden` rules existed, elements stay visible until reload.

### Problem D — Built extension can be stale

The loaded unpacked extension must be built from `dist/`. If `npm run build` was not run after source changes, Chrome still runs the old bundle.

---

## 5. Plan of action (implementation steps)

### Phase 1 — Single source of truth (≈30 min)

**File:** `src/lib/youtubeIds.ts` (or new `src/lib/watchPanelVideoContext.ts`)

1. Add `shouldShowWatchPanelLibraryChrome(getVideoIdFromUrl: () => string | null): boolean`.
2. Implement as:

   ```text
   if (Shorts feed only) → false
   if (single Short) → true
   if (hasYoutubeBrowseShellVisible()) → false
   if (needsHomeFeedPanelAttention(getVideoIdFromUrl)) → false
   if (full watch: classic watch path + visible ytd-watch-flexy) → true
   else → false
   ```

3. Rename mentally to **`isWatchPanelVideoContextActive`** (optional rename in code for clarity).
4. Unit tests in `src/lib/youtubeIds.test.ts` for every row in the edge-case table above.

### Phase 2 — Hide the right DOM nodes (≈20 min)

**File:** `src/content/youtubePanelUi.ts` — `syncWatchPanelVideoLibraryChrome`

1. When `showVideoLibraryChrome === false`:
   - `titleEl.hidden = true` (do **not** set APP_NAME text)
   - hide save-row, complete-row, level-controls, status, hint, complete-prompt (already mostly done)
2. When `true`:
   - `titleEl.hidden = false`
   - show rows; set title from `readTitle()`
3. Set `wrap.dataset.jpLibraryChrome = '0' | '1'` for CSS backup.

**File:** `src/content/youtubePanelCss.ts`

4. Ensure backup rules exist:

   ```css
   .wrap[data-jp-library-chrome="0"] [part="title"],
   .wrap[data-jp-library-chrome="0"] [part="save-row"],
   … { display: none !important; }
   ```

5. Add `.title[hidden] { display: none !important; }` if missing.

**File:** `src/content/youtubePanelMount.ts` — `updateWatchPanelHint`

6. Already skips hint when library chrome is off; keep aligned with the same helper.

### Phase 3 — Call sync at the right times (≈30 min)

**File:** `src/content/youtubeWatchPanelRuntime.ts`

Ensure `syncWatchPanelVideoLibraryChrome()` runs when:

| Event | Already? | Action |
|-------|----------|--------|
| Panel first mounted | Yes | Keep |
| `yt-navigate-finish` | Via `onWatchPanelVideoChanged` | Keep |
| Storage / settings refresh | Yes | Keep |
| Mini player opens/closes (URL → `/watch` on home) | Partial | **Add** listener or re-use nav hook |
| Browse shell appears/disappears | No | **Add** light `MutationObserver` on `ytd-browse` / `document.body` (debounced 100–200 ms) |

Pass `getVideoIdFromUrl` into the detection helper so “no video id” is authoritative on `/`.

### Phase 4 — Force panel refresh for open tabs (≈10 min)

**File:** `src/content/watchPanelBoot.ts`

1. Bump `WATCH_PANEL_MARKUP_VERSION` (e.g. `'4'`) so existing tabs recreate the shadow panel and pick up CSS + default markup.
2. In `migrateWatchPanelShadow`, inject missing CSS selectors if an old panel is reused.

### Phase 5 — Tests (≈30 min)

| Test file | Cases |
|-----------|--------|
| `src/lib/youtubeIds.test.ts` | Home `/`, home + mini player + `/watch` URL, full watch, Shorts feed, single Short |
| `src/content/youtubePanelUi.libraryChrome.test.ts` | Title **hidden** (not APP_NAME) on browse; all four user-requested elements hidden; shown on watch |

### Phase 6 — Build & manual QA (≈15 min)

1. `npm run build`
2. Chrome → Extensions → **Reload** JustPractice (`dist` folder)
3. Hard-refresh YouTube tabs

**Manual checklist:**

- [ ] Homepage, nothing playing: no title, no save, no complete, no level; XP + calendar visible
- [ ] Homepage, play video in mini player: still hidden while feed visible
- [ ] Click through to full watch: title + save + complete + level appear
- [ ] Back to home: video chrome hides again
- [ ] Shorts: chrome visible on one short; hidden on Shorts feed
- [ ] Collapse/expand panel: state preserved

---

## 6. Files to touch (summary)

| File | Change |
|------|--------|
| `src/lib/youtubeIds.ts` | Tighten `shouldShowWatchPanelLibraryChrome` (use video id + browse shell) |
| `src/content/youtubePanelUi.ts` | **Hide title** in browse mode; sync all four user-requested elements |
| `src/content/youtubePanelCss.ts` | CSS backup including `[part="title"]` |
| `src/content/youtubePanelMount.ts` | Pass `getVideoIdFromUrl` into detection if signature changes |
| `src/content/youtubeWatchPanelRuntime.ts` | Debounced DOM observer for browse ↔ watch transitions |
| `src/content/watchPanelBoot.ts` | Bump markup version |
| `src/lib/youtubeIds.test.ts` | Detection tests |
| `src/content/youtubePanelUi.libraryChrome.test.ts` | Title hidden assertion |
| `dist/` (via build) | User must reload extension |

---

## 7. Definition of done

The feature is **done** when, on the YouTube homepage with no full watch context:

1. Title is **not visible** (not empty, not “JustPractice” — **gone**).
2. Save to library is not visible.
3. Mark complete is not visible.
4. Level label and dropdown are not visible.
5. Rank/XP, goal ring, and calendar remain visible and functional.
6. All of the above appear again when opening a full watch page or a single Short.
7. Unit tests cover browse vs watch; manual QA checklist passes after reload.

---

## 8. Out of scope (for this task)

- Hiding the whole panel on the homepage (panel should stay for progress/calendar).
- Changing dashboard or popup UI.
- Feed card popover on thumbnails (separate surface).

---

## 9. Suggested implementation order (one PR)

1. Fix title hiding + CSS (immediate visible win).
2. Unify detection with `getVideoIdFromUrl` + `hasYoutubeBrowseShellVisible`.
3. Add MutationObserver for mini-player / SPA edge cases.
4. Bump markup version + tests + build.

Estimated total: **~2 hours** including QA.
