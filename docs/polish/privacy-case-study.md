# Privacy and project presentation (JP-19–20)

[PR #8](https://github.com/thepoppfish/JustPractice/pull/8) is stacked on PR #7.
No merge, site publication or extension release is part of this change.

The public privacy/data-flow page explains the actual local record, temporary
session recovery/Undo, page-memory drafts, export files and uninstall/reset
behavior. It lists YouTube metadata/watch requests, thumbnail CDN requests,
tutorial viewing/embedding and GitHub hosting/downloads. It distinguishes local
practice storage from offline operation and third-party request metadata.
README and site link directly to it. The explanation is based on source
inspection of the manifest, background requests, storage/recovery handlers,
thumbnail helpers, onboarding and static website; it is not a claim to enumerate
all requests made independently by Chrome or YouTube.

The permission review removes `alarms` and its obsolete cleanup calls. There
is no remaining alarm creator/listener or reminder feature; tracking and
practice flushing use the existing content runtime. `storage`, `contextMenus`,
`scripting` and the three explicit YouTube hosts remain and have concrete
purposes documented. Older public releases can still request the retired
permission; the page and screenshots identify the unreleased source candidate.

The README now starts with the learner problem and current product screenshots,
then gives a verified runtime/source install path, a concise engineering tour,
checks, usage, data controls and limitations. A source-linked architecture
diagram explains the transaction queue and delayed metadata merge decision.
Contributor instructions cover local verification, visual evidence and release
boundaries. Historical slimdown/Pages/package audits are marked as snapshots
and indexed away from current instructions; tests remain in place. The static
site's current candidate screenshots can be opened at full resolution.

Verification on 9 November 2026:

- 409 unit tests in 58 files and all 16 installed Chromium scenarios passed;
  app/test type checks, lint, production/runtime checks and special-character
  packaging passed. The candidate ZIP has 24 runtime files and a root manifest.
- An actual unpacked upgrade seeded five saved videos, settings, practice and a
  legacy alarm in the preceding PR #7 build. Replacing files in the same folder
  and using Developer mode + extension-manager Reload preserved the extension
  ID, library, practice and settings while the new manifest omitted `alarms`.
  The test compares JSON values, ignoring property order. Merely replacing files
  without the documented Reload is not the update procedure.
- Landing/privacy pages have desktop, 375 px mobile and native 200% (512×384 CSS)
  screenshots without horizontal overflow or broken images. Both raw axe scans
  report zero violations; incomplete checks are retained for manual review.
- Local HTML/Markdown links and screenshot dimensions were checked. Screenshot
  provenance identifies actual source-candidate captures, synthetic data and
  the difference from the public download; no personal browser profile is used.

The local report is
`output/playwright/privacy-case-study-2026-11-09/verification.html`, with raw
checks, upgrade snapshots, screenshots and a retained candidate ZIP. Linux and
Windows CI results are linked from the PR. Spoken-reader verification (JP-07)
and measured long-session performance (JP-21) remain separate acceptance items.
