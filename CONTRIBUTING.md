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
