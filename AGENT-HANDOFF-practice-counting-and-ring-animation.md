# Agent handoff: practice second counting + goal-ring completion animation

**Repo:** `C:\Users\thepo\Brower` (JustPractice — Chrome MV3 extension)  
**User priority:** Fix / verify **practice time counting** (seconds) on YouTube watch pages. Secondary: **completion celebration animation** on the daily goal ring (Motivation #8) — user has not been able to validate animation until counting feels trustworthy.  
**Do not trust training data for YouTube DOM, Chrome timer throttling, or `document.hasFocus()` — verify in code + MDN/Chrome docs.**

---

## Mission for the next agent

1. **Primary:** Make practice second counting reliable and explainable on `youtube.com` watch pages (and home-pick flow if in scope).
2. **Secondary:** Confirm **placement C** ring celebration works when marking a library video complete (`animejs` + `d3`).
3. **Do not** re-add the removed debug “Test ring animation” button unless the user asks — it was test-only and deleted on purpose.

---

## Product context

- **JustPractice** tracks practice time on saved YouTube library videos, daily goals, streaks, XP, heatmap, etc.
- Data: `chrome.storage.local` key `jpPractice` (`STORAGE_KEY` in `src/lib/storage.ts`).
- YouTube entry: single bundled content script `dist/assets/youtube-content.bundle.js` (esbuild from `src/content/youtube.ts`), **not** CRXJS split chunks.
- **Load unpacked extension from `dist/`** after `npm run build`. Reload extension + **hard-refresh YouTube tab** after every build (stale content script is a common false negative).

---

## How practice counting is supposed to work

### Pipeline

| Step | Interval | What happens |
|------|----------|----------------|
| Meter | **`timeupdate` / `playing`** | `practicePlaybackMeter` adds `currentTime` delta to in-memory pending (fractional) |
| Flush | **30000 ms** + lifecycle | `flushWatchPanelPractice()` → `MSG.PRACTICE_TICK` to service worker |
| Persist | Background | Updates `dailySeconds[dateKey]`, `videoSeconds[videoId]`, practice XP |

Constants: `src/content/practicePlaybackMeter.ts`, `src/content/youtubePracticeTimer.ts` (`PRACTICE_FLUSH_INTERVAL_MS` = 30s, write batching only).

### Eligibility (`shouldCountPracticeTime` in `youtubePracticeTimer.ts`)

**All** must be true:

1. `practiceEnabled` (user checked “Count practice time”) and `currentVideoId` set.
2. `getVideoElement()` returns the main watch `<video>` (shadow DOM, not sidebar hover preview).
3. `document.visibilityState === 'visible'`.
4. Forward `currentTime` advancement on that video (not seeking; not `ended`). **`paused` is not a hard gate** (theater/fullscreen can flicker `paused`).

Orchestration: `src/content/youtubeWatchPanelRuntime.ts` (`createPracticePlaybackMeter`, `createPracticeFlushScheduler`, `flushWatchPanelPractice`).

Background: `src/background/backgroundMessageHandlers.ts` case `MSG.PRACTICE_TICK` — clamps `deltaSeconds` to **120** max per message (`MAX_TICK_SECONDS`).

### Video element resolution (`getVideoElement` in `youtubePlayerHooks.ts`)

Order:

1. `#movie_player video`
2. Shorts selectors
3. `ytd-watch-flexy #player-container video`
4. Fallback: first `document.querySelector('video')` (risk: wrong video in edge cases)

### Hooks that affect counting (`attachWatchPanelRuntimeHooks` in `youtubeWatchPanelRuntime.ts`)

- **SPA nav:** `attachYoutubeNavHooks` → `onWatchPanelVideoChanged()` (full rebind).
- **Player DOM:** `attachYoutubePlayerDomHooks` → **must NOT** run full `onWatchPanelVideoChanged()` (see bug fix below).
- **Flush on hide:** `attachPracticePageFlushListeners` — `visibilitychange` (hidden), `blur` (if pauseWhenUnfocused), `beforeunload`.
- **Storage sync:** `chrome.storage.onChanged` → `onJpPracticeStorageChanged` → may `resetTimers()` + `refreshState`.

### Video change lifecycle (`runWatchPanelOnVideoChanged` in `youtubeWatchLifecycle.ts`)

On navigation / feed pick:

1. `flushPractice()` (send pending seconds for current binding).
2. `commitVideoBinding(vid)` → returns `previousId`.
3. **Only if `previousId !== vid`:** `resetPracticeToggleAndPending()` (unchecks practice toggle, clears pending).
4. `runNoVideoFlow` or `runHasVideoFlow` (latter calls `resetTimers()`).

---

## Known bug (fixed in source — verify in user's build)

### Symptom (user-reported)

- Practice seconds don’t accumulate, or “Count practice time” **turns off** when moving mouse near player / spurious YouTube UI updates.
- User could not trust counting → could not test ring animation.

### Root cause

`attachYoutubePlayerDomHooks` observes **attribute + subtree** mutations on `ytd-watch-flexy`, `#movie_player`, miniplayer, etc. YouTube fires these on hover/controls/layout.

**Previously:** callback called `onWatchPanelVideoChanged()` → always ran `resetPracticeToggleAndPending()` even when **video id unchanged**.

### Fix (should be in tree — confirm)

**File:** `src/content/youtubeWatchLifecycle.ts`

```ts
const previousId = steps.commitVideoBinding(vid);
if (previousId !== vid) {
  steps.resetPracticeToggleAndPending();
}
```

(Order: flush → commit → conditional reset.)

**File:** `src/content/youtubeWatchPanelRuntime.ts`

```ts
attachYoutubePlayerDomHooks(() => {
  completion.rebindCompletionPromptListener();
  if (practiceEnabled && currentVideoId) {
    resetTimers();
  }
});
```

**Tests:** `src/content/youtubeWatchLifecycle.test.ts` (2 cases: same id vs changed id).

**If counting still fails after fix:** investigate other causes below; do not assume the DOM-hook bug is the only issue.

---

## Other likely causes (research-backed — verify, don’t assume)

| Issue | Why it matters |
|-------|----------------|
| **`pauseWhenUnfocused: true` (default)** | `document.hasFocus()` is false when focus is address bar, DevTools, another window, or sometimes when clicking the extension panel. Seconds won’t tick — by design but feels broken. MDN: [hasFocus](https://developer.mozilla.org/en-US/docs/Web/API/Document/hasFocus). |
| **Tab hidden** | `visibilityState !== 'visible'` → no count. [Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API). |
| **Background tab timer throttling** | Chrome clamps `setInterval` in background; extension also stops counting when hidden. [Background tabs](https://developer.chrome.com/blog/background_tabs). |
| **Stale content script** | Reloading extension without F5 on YouTube leaves old JS running. |
| **Wrong `dist/` folder** | Must load `dist/` not repo root. `npm run build` runs `verify-extension-dist.mjs`. |
| **Video change** | Navigating to new video intentionally unchecks practice toggle. |
| **`resetTimers()` on storage change** | Dashboard/popup settings change triggers resync + timer reset (should not uncheck toggle if id unchanged). |
| **Wrong `<video>`** | Fallback `querySelector('video')` on busy pages. |

---

## Debugging practice counting (built-in)

### Panel debug strip

On `youtube.com`, DevTools console:

```js
localStorage.setItem('jpPracticeDebug', '1');  // key: JP_PRACTICE_DEBUG_LS_KEY in lib/xpDebug.ts
location.reload();
```

- Green log strip on watch panel (`part="jp-debug-strip"`).
- Console: `[JustPractice:watch]` via `jpWatchLog` in `src/content/youtubeDebug.ts`.
- Flush logs include `count=true/false` from `practiceCountingSnapshot()` in runtime.

### XP / background tick logs

```js
localStorage.setItem('jp-debug-xp', '1');
location.reload();
```

Service worker console: `bg:PRACTICE_TICK` via `jpXpLogBackground` in `src/lib/xpDebug.ts`.

### Manual verification checklist

1. `npm run build` → reload extension from **`dist/`** → **F5** YouTube watch tab.
2. Video in library optional for **seconds** (ticks always update `dailySeconds`); XP may differ if not in library.
3. Enable **Count practice time**; keep checkbox checked while testing.
4. Video **playing**, tab **visible**, window **focused** (or disable “pause when unfocused” in dashboard settings).
5. Watch ring label / calendar today cell / dashboard after 15s flush.

---

## Completion animation (Motivation #8, placement C)

### When it runs

- **Only** after successful `SET_LIBRARY_COMPLETION` with `complete: true`.
- Trigger: `playDailyGoalRingCompleteCelebration(p.shadowRoot)` in `src/content/youtubeLibraryPanel.ts`.
- **Not** on incomplete, errors, or dismissing end-of-video prompt.

### Where (UI)

Watch panel shadow DOM — **daily goal ring** (e.g. “25m/30m”):

- `[part="daily-goal-ring"]`, `[part="daily-ring-fg"]`, `[part="daily-ring-label"]`, `[part="daily-ring-fx"]`
- Markup: `src/content/youtubePanelHtml.ts`
- Styles: `src/content/youtubePanelCss.ts` (`.daily-goal-ring--celebrate`, etc.)

### Implementation

- **File:** `src/content/watchPanelGoalRingCelebration.ts`
- **Libraries:** `animejs` v4 (`animate`, `createTimeline`), `d3` (particles/ripples in overlay SVG)
- **Reduced motion:** `prefers-reduced-motion: reduce` → shorter pulse/color, no sparks/stars/checkmark
- **Tests:** `src/content/watchPanelGoalRingCelebration.test.ts` (`buildBurstParticleSpecs` only)

### Removed (do not restore without user ask)

- `watchPanelGoalRingCelebrationDebug.ts` — test button(s) removed per user request.
- User had trouble seeing test button due to stale tabs / panel reuse; not needed for production.

---

## Key files map

| Area | Files |
|------|--------|
| Counting rules | `src/content/youtubePracticeTimer.ts`, `.test.ts` |
| Orchestration | `src/content/youtubeWatchPanelRuntime.ts` |
| Video / SPA hooks | `src/content/youtubePlayerHooks.ts`, `youtubeWatchPanelVideoFlow.ts` |
| Lifecycle | `src/content/youtubeWatchLifecycle.ts`, `.test.ts` |
| Background persist | `src/background/backgroundMessageHandlers.ts` |
| Messages | `src/lib/messages.ts` (`PRACTICE_TICK`) |
| Settings defaults | `src/lib/storageTypes.ts` (`pauseWhenUnfocused: true`) |
| Panel HTML/CSS | `src/content/youtubePanelHtml.ts`, `youtubePanelCss.ts` |
| Ring animation | `src/content/watchPanelGoalRingCelebration.ts` |
| Completion flow | `src/content/youtubeWatchPanelCompletion.ts`, `youtubeLibraryPanel.ts` |
| Build | `scripts/build-youtube-bundle.mjs`, `scripts/vite-plugin-youtube-bundle.ts`, `scripts/verify-extension-dist.mjs` |
| Docs | `ExplaneMe.md` § practice counting (~line 505), `MotivationIdeas.md` #8 |

---

## Build & test commands

```powershell
cd C:\Users\thepo\Brower
npm test
npm run build
```

- PowerShell: use `;` not `&&` between commands if chaining.
- Extension path: **`dist/`** (manifest `content_scripts` → `assets/youtube-content.bundle.js`).
- Tests: 163+ (includes `youtubeWatchLifecycle.test.ts`, `youtubePracticeTimer.test.ts`).

---

## Suggested work order for next agent

1. Confirm handoff fixes exist in git (lifecycle conditional reset + player hook not calling full video change).
2. Reproduce on fresh build: watch page, practice on, playing video, focused tab — confirm `pendingSeconds` / ring / calendar move over 30–60s.
3. Reproduce failure modes: unfocused tab, paused video, hover player (toggle must **stay checked** after fix).
4. If still broken: add **non-invasive** debug UI (e.g. panel status line “Counting: yes — playing, visible, focused”) or log `explainNotCounting` helper; avoid large refactors.
5. Only after counting OK: verify ring animation on Mark complete.
6. Optional improvements (ask user first): `timeupdate`-based accumulation vs `setInterval`; worker timer for background tabs; relax focus rule to visibility-only; pierce shadow DOM for video if `#movie_player` fails on new YouTube layout.

---

## Git / history notes

- User previously ran `git reset --hard origin/master` and lost uncommitted work (practice-counting fixes, docs). See user’s `LOST-WORK-REPORT-JustPractice.md` outside repo if still present.
- Current branch state may include: ring celebration, animejs/d3 deps, lifecycle fix, **no** debug test button.
- **Do not commit** unless user asks.

---

## Console noise (ignore for JustPractice)

User paste often includes Migaku, Return YouTube Dislike, YouTube `kevlar`/`LegacyDataMixin`, `requestStorageAccessFor` — not this extension. Only `[JustPractice]` lines are ours.

---

## User preferences (from rules)

- Minimal scope; match existing code style.
- Load extension from `dist/`; refresh YouTube after reload.
- No proactive git commits.
- Code citations and clear prose in replies.

---

## Open questions for user (if stuck)

1. Does the practice checkbox **stay on** while hovering the player for 30s+ after latest build?
2. Is “Pause practice when tab loses focus” enabled in dashboard settings?
3. Exact repro URL: `/watch?v=`, Shorts, or home with feed pick?
4. Does **dashboard** show increasing minutes after 15s, or only panel ring wrong?

Good luck — counting is the gate; animation is already wired if completion succeeds.
