# Baseline polish tracker

The 21 original requirements and their acceptance criteria are preserved in
[backlog.json](backlog.json). Status distinguishes merged changes from work in
open pull requests; an implementation is not evidence that every acceptance
check passed.

Open [the current visual tracker](index.html), regenerated with
`npm run review:polish`. It also links the current evidence from the original
local baseline report.

- PR #1 merged: distribution, backup recovery and panel bounds (JP-01–03).
- PR #2 merged: focus/counting policy and current instructions (JP-04–05).
- PR #3 open: contrast, keyboard semantics and Hebrew layouts (JP-06–08).
  Spoken screen-reader verification for JP-07 remains outstanding.
- PR #4 open: reproducible engineering checks (JP-11–14), followed by mutation
  checks passed on Linux and Windows, including its documentation follow-up.
- PR #5 open: mutation feedback and recovery (JP-09), plus follow-ups to JP-07/08.
- Next: library undo and actions (JP-10, JP-15), visual consistency and
  information hierarchy (JP-16–18), privacy/case study (JP-19–20), and measured
  performance (JP-21).

Local visual evidence is retained under `output/playwright/` rather than shipped
inside the extension. The original review is
`output/playwright/baseline-2026-11-09/baseline-review.html`; prior verification
reports live in `p1-fixes-2026-11-09`, `counting-guidance-2026-11-09`, and
`accessibility-hebrew-2026-11-09` beside it. Do not include real user exports or
personal browser profiles in evidence.

Merging and publishing require the maintainer's approval. Pending PRs may be
stacked; review and merge them in dependency order.
