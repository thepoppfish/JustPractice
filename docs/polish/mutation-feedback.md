# Mutation feedback and recovery (JP-09)

[PR #5](https://github.com/thepoppfish/JustPractice/pull/5) is stacked on PR #4.
It makes rejected writes visible and preserves edited values across ordinary
storage paints. No merge or publication is performed.

Dashboard, popup, onboarding and watch-panel user actions share checked
responses, pending-control protection, localized inline errors and Retry.
Only acknowledged controls release their drafts; unrelated edits remain.
Retry uses the current control after DOM replacement and returns keyboard
focus. Onboarding stays on its step if saving fails. Export reports failure
and acknowledges a requested download rather than claiming a completed backup.

Watch saves, level/completion changes and panel preferences use the same
feedback. A late save does not flash or refresh another video. Dashboard
storage notifications received during suppression are queued rather than lost.
Follow-ups to JP-07/08 fix initial watch-label language and include the visible
move label in its accessible name.

Local validation on 9 November 2026:

- All **384 tests in 55 files** pass, including storage-race and recovery checks.
- App/test type checks, zero-warning lint, production build, runtime verification
  and special-character Windows packaging pass; the ZIP has 24 runtime files.
- Nine installed Chromium scenarios pass: genuine service-worker storage quota
  rejection, simulated rejected/disconnected messages, export failure and real
  download retry, held-write duplicate click, external paints and current-input
  retry, onboarding, and watch save/level/completion/preferences.
- Six error-state axe scans in browser tests report zero violations; ten
  additional scoped scans accompany visual QA. Raw incomplete checks are
  retained as manual-review items rather than counted as passes.
- Six popup languages fit at 100% and native 200% zoom. Hebrew onboarding,
  dashboard and watch error states were reviewed at 200%; keyboard Tab/Enter
  retry returns focus. Error text is 14 px at **12.69:1** contrast; Retry text
  is **11.19:1** against its solid background.

The latest cross-platform results are on [the PR checks](https://github.com/thepoppfish/JustPractice/pull/5/checks).
Local screenshots, native captures, traces, raw axe results and numeric checks
are under `output/playwright/mutation-feedback-2026-11-09/verification.html`.
The original baseline was source-confirmed and did not inject quota failures;
these are new fault-injection results, not reconstructed before screenshots.

Unsaved drafts are held in the current page's memory. Refreshing or unloading
can discard them; disconnected-context guidance says to copy first. Browser
tests use synthetic thumbnails and a synthetic YouTube layout, so they do not
establish streaming playback accuracy. Spoken screen-reader verification remains
outstanding under JP-07. Undo and library-card hierarchy remain JP-10/15.
