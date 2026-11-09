# Library actions and removal recovery (JP-10, JP-15)

[PR #6](https://github.com/thepoppfish/JustPractice/pull/6) is stacked on PR #5.
It leaves merging and publishing to the maintainer.

Accidental removal previously discarded saved metadata immediately. Dashboard
and popup now put Remove inside a native More actions disclosure and offer a
persistent, dismissible Undo. The most recent removal can be restored across
views and popup reopening for up to 24 hours within the browser session. Undo
preserves title, channel, original saved date, difficulty, completion timestamp,
duration and order; practice history and awarded XP are retained without a
second award. Undo metadata stays in session storage, outside user exports.
Dismissal, browser-session end, expiry, confirmed clear and valid restore end
recovery. A failed replacement can invalidate Undo before the original profile
is changed; the original data still uses the existing recovery journal.

The background serializes removal, recovery and ticks in its storage queue.
Session-write failure leaves the video saved; local-write failure preserves
the previous valid offer. Failed undo can be retried. Optional session cleanup
failure after a committed undo does not falsely report failure. A manual re-save
wins over an older recovery snapshot. Fresh local membership tokens distinguish
new saves, undo and restored profiles while preserving the original addedAt.
Ticks and delayed metadata/duration requests from older memberships are ignored.
Legacy records remain compatible; playback at 2× is not capped to wall time.

Dashboard titles and channels flow below unobscured thumbnails. Long English,
Hebrew and Japanese titles remain fully visible without moving controls on focus.
Open/Continue is the primary link. Continue starts at the explicitly labelled
farthest playback position; completed videos or videos at the end use Open.
Length, practice time and playback position are separate: repeat practice may
exceed the video's length. Unknown lengths are labelled and have no fabricated
progress bar. Secondary actions include difficulty editing on the dashboard and
completion/removal in both views. Native details use ordinary keyboard controls;
open state and identified focus survive storage paints.

Validation on 9 November 2026:

- 404 unit tests in 57 files, including metadata-exact undo, failed writes,
  stale ticks/enrichment, conflicts, duplicate undo, expiry and profile replacement.
- Type checks, zero-warning lint, production build, dependency audit, runtime ZIP
  verification and Windows paths with spaces/apostrophe/Unicode/brackets pass.
- 13 installed Chromium scenarios cover the existing onboarding/settings/watch
  paths plus cross-view recovery, popup reopening, completion metadata, level
  editing, genuine quota failure/retry and an outdated recovery offer.
- Dashboard and compact popup layouts are reviewed in all six locales at 100%
  and native 200% zoom, including keyboard disclosures and long mixed titles.
  Thirty focused captures and paired native PNGs are retained locally.
- Raw axe checks, traces and test reports accompany the evidence. Automated
  results do not substitute for the spoken screen-reader check under JP-07.

[PR checks](https://github.com/thepoppfish/JustPractice/pull/6/checks) run the same
suite on Linux and Windows. The local visual report is
`output/playwright/library-actions-2026-11-09/verification.html`; its retained
installable candidate is `justpractice-1.0.3-pr6.zip`. The source version remains
an unpublished candidate. Synthetic profiles/thumbnails are used throughout;
no real user profile or YouTube streaming session is captured in this evidence.
