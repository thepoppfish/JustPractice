# Readable statistics, grouped settings and shared styles (JP-16–18)

[PR #7](https://github.com/thepoppfish/JustPractice/pull/7) is stacked on PR #6.
Merging and publishing remain with the maintainer.

Statistics now lead with today's practice, one goal caption and a useful next
action. Secondary cards show week/month/all-time history. No-goal, goal-reached,
empty and all-completed states have explicit text/actions. Saved totals include
completed videos; active tagged counts are labelled as in progress. Shared
localized practice summaries retain seconds below an hour and whole minutes
afterwards. Video length/playback keep clock notation; dense calendar cells
retain their compact minute labels. Existing background tracking, goal periods,
practice history and XP calculations continue to supply the displayed values.

Settings start with language/levels, counting/display and backup/restore.
Section jumps move focus to an identified heading, retained across paints.
Personalization and tutorial replay are in a native advanced disclosure.
Visible labels, adjacent help, comfortable controls and directional text inputs
support English and Hebrew. The save model is stated: selections/switches save
immediately, ordinary text fields on leaving, and custom lists through their
explicit action buttons. Existing drafts, checked responses, retry and pending
protection are preserved. A failed edit opens its containing disclosure so the
error stays reachable. Clear has a separate danger section and confirmation;
restore keeps validation and the recovery journal.

Shared tokens cover text/muted colors, surfaces, borders, brand/action colors,
success/error/focus colors, spacing, radii and motion. Primary controls across
popup/dashboard/onboarding/watch use the same orange/dark text, 8 px radius and
44 px border-box minimum height. Working feedback is neutral; acknowledged
success is green; failure is red. The content-script build now bundles CSS
@imports before embedding shadow styles, matching the extension-page pipeline
and avoiding relative stylesheet requests to YouTube.

Validation on 9 November 2026:

- 409 tests in 58 files, including duration boundaries/localization, subsection
  focus restoration and disclosure error visibility. App/test type checks and
  zero-warning lint pass.
- 16 installed Chromium scenarios cover setup, settings, drafts/recovery,
  library Undo, current counts, goals, clear cancellation and shared control
  styles in all four surfaces, including the actual watch shadow DOM.
- At 1024×768, today's primary action ends at y=517.5 in all six locales; it
  remains visible without zoom. Dashboard/settings/popup were reviewed in six
  locales at native 100%/200% zoom, with no horizontal overflow. Hebrew also
  fits a 512×384 CSS viewport (1024×768 at 200%).
- 63 after captures, 11 before captures plus a before watch crop are retained.
  Onboarding/watch have English/Hebrew comparisons and Hebrew 200% views.
  Empty/all-completed/goal states, a held real write and a genuine quota failure
  accompany the matrix. All 26 raw axe scans report zero violations; incomplete
  checks are retained for manual review. Spoken reader verification is JP-07.
- Calculated primary text contrast is 7.93:1; muted body text
  8.95:1; working 12.81:1; success 11.14:1.
- Production/runtime verification, dependency audit, the 24-file ZIP and Windows
  packaging from spaces/apostrophe/Hebrew/bracketed paths pass.

[Current Linux and Windows checks](https://github.com/thepoppfish/JustPractice/pull/7/checks)
run the same commands. Local screenshots, raw results, before/after evidence and
the retained installable candidate are under
`output/playwright/visual-consistency-2026-11-09/verification.html`.
Synthetic profiles, previews and YouTube layouts are used; this does not prove
live streaming accuracy or replace the outstanding spoken-reader check.
