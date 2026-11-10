# Baseline polish tracker

The 21 original requirements and their acceptance criteria are preserved in
[backlog.json](backlog.json). Status distinguishes merged changes from work in
open pull requests; an implementation is not evidence that every acceptance
check passed.

The [acceptance audit](completion-audit.md) maps every original item to its
retained evidence and explicitly identifies the remaining checks.

Open [the current visual tracker](index.html), regenerated with
`npm run review:polish`. It also links the current evidence from the original
local baseline report.

- PR #1 merged: distribution, backup recovery and panel bounds (JP-01–03).
- PR #2 merged: focus/counting policy and current instructions (JP-04–05).
- PR #3 open: contrast, keyboard semantics and Hebrew layouts (JP-06–08).
  The maintainer explicitly skipped JP-07's manual screen-reader check on
  10 November 2026; the implementation and other checks remain in place.
- PR #4 open: reproducible engineering checks (JP-11–14). Checks passed on
  Linux and Windows, including its documentation follow-up.
- PR #5 open: mutation feedback and recovery (JP-09), plus follow-ups to JP-07/08.
- PR #6 open: library undo and card/action hierarchy (JP-10, JP-15).
- PR #7 open: statistics, settings and shared visual styles (JP-16–18).
- PR #8 open: privacy/data flow, permission review and project case study (JP-19–20).
- PR #9: measured performance and payload reduction (JP-21), plus a practice
  display correction and working Details shortcut. Controlled measurements and
  automated checks pass. The [final normal-Chrome repeat](live-playback-result-2026-11-10.md#final-installed-candidate-repeat--passed)
  passed sustained playback (94.0%, above 85%), ten-minute media tracking, pause,
  exact reload persistence and the Details shortcut. JP-21 is now implemented-
  awaiting-review. Earlier incomplete runs and the disabled control remain
  recorded with their limits. JP-07's [reader check](spoken-reader-check.md)
  is recorded as skipped, not passed.

Earlier PR reports describe the reader check as outstanding at the time of
their measurements. The current tracker records the subsequent maintainer decision.

All 21 items are now merged or implemented-awaiting-review: five merged and
sixteen in open PRs. No required verification gate remains, with the explicit
reader-check waiver preserved. PR review, merges and publishing still require
the maintainer's approval.

Local visual evidence is retained under `output/playwright/` rather than shipped
inside the extension. The original review is
`output/playwright/baseline-2026-11-09/baseline-review.html`; prior verification
reports live in `p1-fixes-2026-11-09`, `counting-guidance-2026-11-09`, and
`accessibility-hebrew-2026-11-09` beside it. Do not include real user exports or
personal browser profiles in evidence.

Merging and publishing require the maintainer's approval. Pending PRs may be
stacked; review and merge them in dependency order.
