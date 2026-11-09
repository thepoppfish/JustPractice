# Installed-extension smoke checks

Run `npm ci`, `npm run build`, `npx playwright install chromium`, then
`npm run test:smoke`. Use `PW_HEADED=1` for a visible browser.

The tests use Playwright's bundled Chromium and a disposable persistent context,
not a personal Chrome profile. They complete onboarding in English and Hebrew,
persist the goal and framework, add a synthetic library item through the real
background handler, check dashboard/settings persistence and popup search,
and verify language/direction metadata. No YouTube account is required. Synthetic
thumbnail responses keep these UI checks independent of CDN timing.

The mutation checks also inject a real storage-set rejection in the isolated
service worker, rejected/disconnected message responses, a failed download,
and a held write with a second pointer click. They verify retained input,
retry after external storage paints, unrelated unsaved drafts, onboarding step
retention, watch save/level/completion/preferences, and actual export download.
The watch test fulfills a minimal synthetic YouTube layout rather than relying
on streaming playback. Scoped axe checks cover the added error states.

Evidence includes screenshots, axe JSON and interaction traces. Visual review
and native 200% zoom checks are tracked separately in the baseline reports;
these smoke tests do not claim that manual signoff or spoken screen-reader
coverage. Storage races, rejected ticks and invalid restores also have unit
regression coverage.

CI runs on Linux and Windows, retains the runtime ZIP and browser artifacts,
and never publishes a release. A passing smoke check establishes installation
and key wiring; it does not establish real-video playback accuracy or replace
the broader manual visual and screen-reader review.
