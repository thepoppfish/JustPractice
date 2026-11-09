# Quality and packaging batch (JP-11–14)

[PR #4](https://github.com/thepoppfish/JustPractice/pull/4) is stacked on PR #3.
Neither is merged by this goal. No tag or release was published.

[GitHub run 42622579932](https://github.com/thepoppfish/JustPractice/actions/runs/42622579932)
passed on **Linux and Windows** for implementation commit `c26ddfd`:

- Clean `npm ci` with Node 24.15.0.
- Lint before and after the production build: zero errors/warnings.
- Application and test TypeScript checks.
- Dependency policy, production build and all 365 tests in 52 files.
- Runtime verification and a ZIP containing 24 runtime files.
- Actual packaging from paths containing spaces, an apostrophe, Hebrew and
  literal brackets; `manifest.json` at the ZIP root.
- Installed Chromium flows in English and Hebrew: onboarding, goals/framework,
  library, settings persistence, popup search and tabs.
- Uploaded per-platform runtime ZIP, screenshots and traces (14-day retention).

The same commands passed locally on Windows. A separate native 200% Hebrew
popup check measured CSS viewport width 190, client/content width 182 with no
horizontal overflow; lower controls remained reachable. Local evidence is in
`output/playwright/quality-checks-2026-11-09/verification.html`.

The raw development audit retains seven moderate entries representing one
[triaged advisory and its parent chain](dependency-review.md). Production
audit reports zero findings. Synthetic video metadata in smoke tests does not
establish real YouTube playback behavior. Spoken screen-reader verification
remains outstanding for JP-07.
