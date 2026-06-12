# Project slimdown plan

**Goal:** Reduce repo size and clutter before / while hosting on GitHub — without breaking `npm run build`, `npm test`, or `npm run package`.

**Full file list:** [PROJECT-SLIMDOWN-INVENTORY.csv](./PROJECT-SLIMDOWN-INVENTORY.csv) (199 tracked paths, generated from git)

Regenerate inventory after classification changes:

```bash
node scripts/generate-slimdown-inventory.mjs
```

---

## How to read the inventory

| `action` | Meaning |
|----------|---------|
| **KEEP** | Required for build, tests, packaging, or strongly recommended |
| **REMOVE** | Delete from git; no code changes (or trivial doc links only) |
| **REMOVE_WITH_CODE** | Delete file **and** update scripts / config listed in plan |
| **OPTIONAL** | Safe to delete if *you* do not use that workflow; not required for the extension |
| **REVIEW** | Rare; decide manually |

| `phase` | When to execute |
|---------|-----------------|
| **P1** | First pass — biggest wins, low risk |
| **P2** | Second pass — planning docs |
| **P3** | Optional — only if you want a minimal repo |

---

## Summary (tracked files)

| Action | Files | ~Size |
|--------|------:|------:|
| KEEP | 164 | (all `src/`, build scripts, config, tests) |
| REMOVE | 25 | **~2.1 MB** |
| REMOVE_WITH_CODE | 2 | small |
| OPTIONAL | 8 | ~0.1 MB |

**Not in git (already ignored):** `dist/`, `release/`, `node_modules/`, `public/assets/youtube-content.bundle.js*`

**Local disk only:** If you have extra `assets/logo-intro/frames/` beyond the 14 tracked frames, delete those folders locally — they are not in git but waste disk.

---

## What we are **not** removing

Do **not** delete these thinking they are “0” in the package audit:

- All of **`src/`** — this is the product
- **`*.test.ts`** — regression safety (41 files); removing them “slims” git but hurts quality
- **Build scripts** (`build-youtube-bundle`, `generate-icons`, `patch-crx-build`, `verify-extension-dist`, packaging scripts)
- **`public/icons/logo-source.png`** — master icon for `generate-icons.mjs`
- **`LICENSE`**, **`README.md`**, **`package.json`**, tsconfig, vite, eslint, vitest
- **`docs/PACKAGE-FILE-AUDIT.*`** — useful for store / GitHub release zips

Debug helpers (`src/lib/xpDebug.ts`, `src/content/youtubeDebug.ts`) stay **KEEP** unless you explicitly want a “no debug” fork — they are small and help support issues.

---

## Phase P1 — Remove (~2.1 MB, low risk) ✅ Done 2026-06-12


### A. Logo intro promo pipeline (not used by extension)

The extension never loads these. They exist only to re-render a marketing B-roll MP4.

| Remove |
|--------|
| `assets/logo-intro/` (entire folder: MP4, 14 frames, README) |
| `scripts/render-logo-intro-video.mjs` |
| `package.json` → `"render:logo-intro"` script |
| `package.json` → devDependency `@ffmpeg-installer/ffmpeg` (only used by logo script) |

**If you still want the MP4:** upload it to a GitHub Release or YouTube once, then delete from repo.

### B. Orphan asset

| Remove | Why |
|--------|-----|
| `src/assets/notify.png` | Leftover from deleted `goalNotifications.ts`; nothing imports it |

### C. Unused icon size + script trim

| Remove / change | Why |
|-----------------|-----|
| `public/icons/icon-96.png` | Manifest only uses 16/32/48/128 |
| `scripts/generate-icons.mjs` | Change `sizes` from `[16, 32, 48, 96, 128]` → `[16, 32, 48, 128]` |

### D. Obsolete agent / feature docs

| Remove | Why |
|--------|-----|
| `AGENT-HANDOFF-practice-counting-and-ring-animation.md` | Agent handoff, not user docs |
| `MotivationIdeas.md` | Brainstorm list, not product docs |
| `docs/GOAL-REMINDERS-WHY-NOT-WORKING.md` | Documents removed notifications feature |

### P1 verification

```bash
npm install
npm run build
npm test
npm run package
```

---

## Phase P2 — Remove completed planning docs ✅ Done 2026-06-12

These were useful during development; the features are shipped or abandoned. Remove if you do not need history in-repo (git history still has them).

| Remove |
|--------|
| `docs/DAILY-PATH-DESIGN.md` |
| `docs/HOMEPAGE-PANEL-CLEAN-UI-PLAN.md` |
| `docs/ROADMAP-COMPLETION-AND-REWARDS-PLAN.md` |
| `docs/WELCOME-ONBOARDING-PLAN.md` |
| `docs/UI-15S-RESET-BUG-PLAN.md` |

**Alternative:** move to a `docs/archive/` folder instead of deleting (slightly cleaner than losing context).

---

## Phase P3 — Optional dev tooling & notes ✅ Done 2026-06-12

Remove only if you will maintain locales manually and do not need AI/project maps.

| OPTIONAL file | Purpose |
|---------------|---------|
| `ExplaneMe.md` | Large AI/human project map (42 KB); outdated in places |
| `UIBreakdown.md` | UI naming cheat sheet |
| `scripts/apply-i18n-overrides.mjs` | i18n maintenance |
| `scripts/audit-i18n.mjs` | i18n maintenance |
| `scripts/audit-i18n-detail.mjs` | i18n maintenance |
| `scripts/sync-i18n-locales.mjs` | i18n maintenance |
| `scripts/i18n-gap-translations.json` | i18n data |
| `scripts/i18n-locale-overrides.json` | i18n data |

---

## Code cleanup (not file deletes) — do with P1 or after

These slim the **product** without removing repo files:

| Task | Files | Benefit |
|------|-------|---------|
| Remove unused i18n keys `welcome.tutorialBullet1/2/3` | all `src/i18n/locales/*.json` | 18 dead strings (UI no longer shows bullet list) |
| Stop shipping YouTube bundle source map | `scripts/build-youtube-bundle.mjs` | ~1.1 MB less in `dist/` per build (already excluded from `npm run package`) |
| Stop copying `logo-source.png` into `dist/icons/` | vite / crx public copy rules if applicable | 1 less dist bloat file |

---

## Untracked / ignored cleanup (local machine)

| Path | Action |
|------|--------|
| `dist/` | Safe to delete anytime; `npm run build` recreates |
| `release/` | Safe to delete; `npm run package` recreates |
| `public/assets/youtube-content.bundle.js(.map)` | Regenerated by build; gitignored |

---

## Suggested execution order

1. **Review** [PROJECT-SLIMDOWN-INVENTORY.csv](./PROJECT-SLIMDOWN-INVENTORY.csv) — filter `action=REMOVE` or `REMOVE_WITH_CODE`
2. **Execute P1** — delete files, patch `package.json` + `generate-icons.mjs`, `npm install`
3. **Run verification** commands above
4. **Execute P2** if you want fewer docs
5. **Execute P3** only if you accept losing i18n scripts / ExplaneMe
6. **Commit** with message e.g. `chore: slim repo — remove logo-intro assets and stale docs`
7. **Regenerate** `npm run audit:package-files` if dist layout changed

---

## After slimdown — GitHub-facing checklist

- [ ] Polish `README.md` (screenshots, install from Releases)
- [ ] Attach `release/justpractice-*.zip` to GitHub Release (24 runtime files only)
- [ ] Confirm GPL `LICENSE` and copyright name are correct
- [ ] Do **not** commit `dist/` or `release/`

---

## Inventory totals by action

All three phases complete. Re-run `node scripts/generate-slimdown-inventory.mjs` for current counts — expect **KEEP only** (no pending REMOVE/OPTIONAL).

*Last updated: 2026-06-12.*
