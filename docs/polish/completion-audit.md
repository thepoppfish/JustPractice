# Baseline acceptance audit

This is an acceptance ledger, not a declaration that the goal is complete.
All 21 original `action` and `accept` values were compared with the initial
local baseline JSON on 9 November 2026 and are unchanged. PRs #1–2 are merged;
PRs #3–8 remain open in dependency order, and #9 is open on #8. Open changes
are reviewed as the combined source candidate, not represented as released.

The evidence directories below are under local `output/playwright/`. Each has a
`verification.html` report, raw checks and screenshots; these local artifacts
are deliberately excluded from source and runtime packages. Maintained notes,
tests and PR CI artifacts provide the repository-side review path.

| Item | Evidence inspected | Acceptance state / remaining work |
| --- | --- | --- |
| JP-01 runtime download | `p1-fixes-2026-11-09/verification.json`: public 1.0.1 workflow/download, root manifest, 24 files, fresh profile and onboarding | Passed; merged #1. Source archives remain distinguished from runtime downloads. |
| JP-02 backup safety | Same report: invalid payload unchanged, preview/cancel, valid restore, failed-write rollback and worker-restart journal recovery; restore/storage unit regressions | Passed; merged #1. Session recovery remains temporary, and export is still the durable backup. |
| JP-03 panel bounds | Same report: 1280×600, 1024×600, native 200%, saved drag/resize and popup reset; later six-locale 200% watch captures | Passed; merged #1, subsequent visual changes retain scrollable content and reachable controls. |
| JP-04 focus policy | `counting-guidance-2026-11-09/native-results.json` and `verification.json`: actual focused/unfocused/hidden/paused playback with both settings; removal/clear and stale-tick regressions | Passed; merged #2. External removal/reset discards the old session's unflushed remainder. |
| JP-05 current instructions | Same report: all six languages, popup/dashboard/setup/site/panel; source-candidate versus public-release labels in current docs | Original fix merged #2. #9 also repairs the saved-video Details shortcut; its installed-browser regression passes without changing the saved timestamp. |
| JP-06 contrast/readability | `accessibility-hebrew-2026-11-09`: raw extension-scoped axe, measured text contrast and native 100%/200% captures; later shared-style/error-state reports | Implemented in #3, with #5/#7 follow-ups. Incomplete automated contrast checks have manual measurements; YouTube-owned findings are excluded. |
| JP-07 roles/keyboard/reader | Same report plus keyboard/focus/browser regressions and subsequent shared-style checks | Implemented in #3 with follow-ups. **Manual reader check explicitly skipped by the maintainer on 10 November 2026.** It is unverified, not passed, and no longer a CV polish gate. [Decision and optional procedure](spoken-reader-check.md). |
| JP-08 Hebrew/locales | Same report plus later six-locale matrices: document/shadow language and direction, mixed-language text, long labels, keyboard and native zoom | Implemented in #3, with #5–#9 follow-ups. Spoken reading order was not verified; that manual check was explicitly skipped under JP-07. |
| JP-09 mutation feedback | `mutation-feedback-2026-11-09`: real worker quota rejection, rejected/disconnected responses, draft/focus retention, Retry, export failure and duplicate-write protection | Implemented in #5; installed-browser regressions retained. Refreshing can discard unsaved page-memory drafts, as documented. |
| JP-10 removal Undo | `library-actions-2026-11-09`: exact saved metadata, completion, timestamp and level restoration; cross-view/reopened popup; conflicts, expiry, session/write failure and retry | Implemented in #6; practice history and XP remain unchanged. |
| JP-11 deterministic lint | #4 Linux/Windows clean-install CI before and after production build; generated/report exclusions in ESLint configuration | Implemented in #4; later PRs repeat both lint gates. Corrected runtime/profile-guard heads in #9 also passed both jobs. |
| JP-12 dependency advisories | [Dependency review](dependency-review.md), checked lockfile and audit policy; clean production audit, individually scoped expiring development exception | Implemented in #4. Raw audit is not described as universally clean; the documented exception needs review by its expiry. |
| JP-13 repeatable CI/artifact | #4 and later Linux/Windows workflows: clean install, app/test type checks, tests, lint, packaging and uploaded runtime/browser artifacts | Implemented in #4. #7/#8 and corrected runtime/profile-guard heads in #9 passed both jobs. No release publication occurs in PR CI. |
| JP-14 Windows paths | Actual packaging checks with spaces, apostrophe, Hebrew and brackets; 24-file ZIP closure and root manifest validation | Implemented in #4; repeated in subsequent CI. |
| JP-15 library hierarchy | `library-actions-2026-11-09`: long EN/HE/JA titles, unobscured synthetic previews, primary Open/Continue, native secondary actions, six-locale 100%/200% captures | Implemented in #6; later shared-token checks retain the hierarchy. |
| JP-16 readable statistics | `visual-consistency-2026-11-09`: 1024×768/1440×900, today/next action, completed-inclusive totals, empty/no-goal/met/all-completed states and localized duration tests | Implemented in #7. All six locales' next actions fit the 1024×768 initial view. |
| JP-17 settings layout | Same report: language/counting/backups section jumps, adjacent help, pending/success/error, retained drafts, advanced disclosure, separated Clear/cancel | Implemented in #7; installed-browser focus and persistence checks retained. |
| JP-18 shared tokens | Same report: four-surface comparison, actual shadow CSS, computed primary styles, status colors, measured contrast and six-locale native zoom | Implemented in #7. #9 retries observation of current controls during repaint without changing expected styles. |
| JP-19 privacy/permissions | `privacy-case-study-2026-11-09`: source request/permission audit, responsive privacy/site pages, actual same-folder unpacked Reload retaining data and extension ID | Implemented in #8; alarms permission removed, remaining permissions/services documented. |
| JP-20 CV case study | README synthetic product screenshots/provenance, verified install path, [architecture](../ARCHITECTURE.md), transaction decision/regressions, contributor commands and historical-doc labels | Implemented in #8. Source-candidate features and screenshots are explicitly distinguished from the older public download. |
| JP-21 measured costs | `performance-2026-11-09`: before/after profiles, budgets, locale captures, ten-minute controlled playback and packaging; `normal-chrome-2026-11-10`: actual ten-minute media, counter, pause and reload samples | **Verification outstanding in #9.** Normal Chrome reached 622 seconds of media with 619 seconds counted; pause/reload checks passed. Media advancement was 83.4% of wall time, below the existing 85% threshold; a lower-resolution follow-up did not start. [Recorded result and limits](live-playback-result-2026-11-10.md). Sustained live responsiveness remains pending. |

The remaining verification gate is JP-21's sustained live-service responsiveness;
the normal-Chrome tracking, pause and reload checks now have passing evidence.
A subsequent disabled-extension control also reproduced a substantial stall;
its 88.3% overall advancement met the numeric threshold, but does not verify
the installed candidate or establish the slowdown's cause.
JP-07's manual reader check was explicitly skipped by the maintainer; its
original acceptance text is preserved with that exception recorded in the tracker.
No merge or publication is performed by this audit. Existing real user data is
not modified by fixture testing; disposable profiles and synthetic fixtures exercise
preservation, recovery and failure paths. The later normal-Chrome live run used
a separate candidate library; the maintainer left the old extension installed
and disabled, preserving its data.
