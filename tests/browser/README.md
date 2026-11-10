# Installed-extension smoke checks

Run `npm ci`, `npm run build`, `npx playwright install chromium`, then
`npm run test:smoke`. Use `PW_HEADED=1` for a visible browser.

The tests use Playwright's bundled Chromium and a disposable persistent context,
not a personal Chrome profile. They complete onboarding in English and Hebrew,
persist the goal and framework, add a synthetic library item through the real
background handler, check dashboard/settings persistence and popup search,
and verify language/direction metadata. No YouTube account is required.

QA inventory: onboarding language/framework/goal/continue, populated library,
settings checkbox on/off/reload, popup search with caret focus, and popup tab
switch. Evidence: screenshots of library/settings/popup in both locales plus
an interaction trace. Exploratory failure coverage remains in unit tests
(storage errors, rejected ticks, invalid restore); visual and 200% zoom review
is tracked separately in the baseline reports, not claimed by this smoke test.

CI runs on Linux and Windows, retains the runtime ZIP and browser artifacts,
and never publishes a release. A passing smoke check establishes installation
and key wiring; it does not establish real-video playback accuracy or replace
the broader manual visual and screen-reader review.
