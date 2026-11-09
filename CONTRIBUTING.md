# Working on JustPractice

Use Node 24.15.0 from [`.node-version`](.node-version), then `npm ci`.
`npm run dev` starts Vite; `npm run build` produces the installable `dist/`
directory. In Chrome's extension manager, enable Developer mode and load that
directory unpacked. Use a disposable profile and synthetic videos for evidence.
Export personal data before reloading or replacing a real installation.

## Required checks

```sh
npm ci
npm run lint
npm run audit:dependencies
npm run typecheck
npm run build
npm run lint
npm test
npm run package
npm run verify:packaging-paths
npx playwright install chromium
npm run test:smoke
```

The second lint checks generated-build side effects. CI runs this sequence on
Linux and Windows and retains runtime ZIPs, browser screenshots and traces.
The dependency audit has a [documented expiring development-only exception](docs/polish/dependency-review.md).
Do not describe the raw audit as clean. Production dependency advisories are
not covered by that exception.

For behavior changes, add focused coverage of the user-visible failure or
invariant. For reversible text/style changes, verify the affected view rather
than adding tests that repeat the implementation. Review Hebrew, long titles,
empty states, keyboard access and native 200% zoom when layout changes.
See [the architecture](docs/ARCHITECTURE.md) and [browser scope](tests/browser/README.md).

## Performance investigations

After building and installing Playwright Chromium, run these separately on an
otherwise idle machine. The watch command takes ten minutes of actual playback:

```sh
npm run profile:library -- --label before --output output/performance
npm run profile:watch -- --label before --seconds 600 --output output/performance
```

After a measured change, rebuild and repeat with `--label after` in the same
directory. Completed labels are protected from accidental overwrite. Library
sizes/repeats can be changed with `--sizes 25,100,500 --repeats 5`; watch duration
supports 60–3600 seconds. Read `--help` for each script. The default profile is
synthetic and source controlled; no local review artifacts are required.

For a real-site follow-up, add `--live-video bT_g9030hx0` to the watch command
and choose a new label. Add `--headed` to use a normal visible browser window.
This uses the public project tutorial in a disposable,
anonymous YouTube session, with muted native looping and normal network/player
code. It can fail if playback needs consent/sign-in or the service is unavailable;
record that limitation rather than substituting a hidden or inactive player.
Real-page heap/long tasks include YouTube work. The JSON also records observed
media advancement, loops and practice/position writes for interpretation.
Discarded media sources produce a diagnostic screenshot and failure. A live
run must advance media for at least 85% of its measured window to qualify as
sustained playback; an idle/error page must not pass merely because its saved
total correctly stopped increasing. Reader/bot/consent restrictions require
separate attention, not automated retries around them.

Retain JSON, screenshots, `.cpuprofile` files and interaction traces. Open CPU
profiles in Chrome DevTools' JavaScript Profiler and trace ZIPs with Playwright's
trace viewer. Timings include automation observation and paint frames; the
background worker is warm, and memory means renderer JS heap/DOM, not total
browser memory. The canvas stream excludes real YouTube rendering, ads, network
and decoding costs. A short run can expose growth but cannot establish that
arbitrarily long sessions have no leak. These are manual investigation tools,
not hardware-sensitive CI pass/fail timing tests.

PRs should state the concrete problem, resulting behavior, relevant checks and
limitations. Preserve the original requirements in
`docs/polish/backlog.json`; update statuses/evidence and run `npm run review:polish`.
Local browser profiles, exports, screenshots, traces, `dist/` and `release/`
are not source files. Deliberately selected synthetic product screenshots in
`docs/assets/` are an exception; label their version and provenance.

## Releases and site

`npm run package` walks the runtime dependency closure and writes a ZIP with
`manifest.json` at its root. It does not publish anything. The release workflow
checks and attaches a versioned ZIP plus `justpractice.zip` for the stable link.
After maintainer review, publish a tag matching `manifest.config.ts` or run
**Release extension** on the intended commit. GitHub's source archives require
a build and are not runtime downloads. Keep old release evidence immutable.

GitHub Pages serves static HTML/CSS from `master:/docs`; no site build is
required. Preview with a local static server. Check relative links, screenshots,
mobile layout and accessibility when editing the public pages. Source-candidate
screenshots must not imply their features are already in the public release.
