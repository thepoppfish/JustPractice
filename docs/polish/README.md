# Baseline polish tracker

The 21 original requirements and their acceptance criteria are preserved in
[backlog.json](backlog.json). Status distinguishes merged changes from work in
open pull requests; an implementation is not evidence that every acceptance
check passed.

- PR #1 merged: distribution, backup recovery and panel bounds (JP-01–03).
- PR #2 merged: focus/counting policy and current instructions (JP-04–05).
- PR #3 open: contrast, keyboard semantics and Hebrew layouts (JP-06–08).
  Spoken screen-reader verification for JP-07 remains outstanding.
- Next batch: reproducible engineering checks (JP-11–14), followed by mutation
  feedback and library actions (JP-09, JP-10, JP-15), visual consistency and
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
