# Watch payload and measured performance (JP-21)

Verification is in progress. The final ten-minute playback checks, exact-head
cross-platform checks and retained candidate are still required before this item
can be marked implemented. No release, merge or publication is part of this work.

## Measured changes

The preceding PR #8 watch bundle is 703,404 bytes. The optimized build before the
daily-display correction is 346,228 bytes (SHA-256
`b5f88a4bf6da734e9338012dbc517f061bd15241fca84d22c07d071df4befd29`).
This is a 50.8% payload reduction, independent of machine timing. Minification,
focused D3 imports and omission of dashboard/onboarding messages account for the
reduction. Shared calendar labels retain all six translations under a shared
namespace; extension pages retain complete dictionaries. A build guard rejects
page-only message references in watch dependencies. A classic-script parser and
350 KiB size check protect packaging.

Five fresh dashboard documents per library size, with three search interactions
per trial, have completed before and after that build:

| Saved videos | Before startup max | After startup max | Before search max | After search max |
| --- | ---: | ---: | ---: | ---: |
| 25 | 277.8 ms | 204.1 ms | 63.8 ms | 49.6 ms |
| 100 | 242.4 ms | 287.2 ms | 94.5 ms | 90.8 ms |
| 500 | 690.8 ms | 795.6 ms | 316.8 ms | 353.3 ms |

Both builds fit the chosen investigation budgets. These observations do not
establish a general dashboard speedup; the change targets watch payload size.
Startup uses a warm background worker and includes automation observation and
two animation frames. Search includes one match, no match and clearing the query.
Twenty percent of the saved fixtures are completed and excluded from the active
library. The 500-item case is a stress workload.

## Playback finding and follow-up

The controlled baseline completed 600 seconds with 598 seconds persisted and no
steady-state long tasks after the first minute. Its displayed daily duration,
however, advanced faster than playback. Calendar synchronization folded pending
seconds into its baseline, then the renderer added those seconds again.
Persisted practice remained accurate. The correction keeps synchronized/flushed
seconds separate from the meter's unflushed remainder. Regression coverage
exercises repeated polls, stale snapshots and the normal playback/save intervals.
Final measurements must identify the corrected bundle rather than reuse the
earlier optimized build's results.

## Scope, budgets and retained evidence

Measurements use disposable installed-extension profiles, synthetic library
records and thumbnails, Chromium 158.0.8127.18 on Windows 11 with an Intel Core
Ultra 7 268V, an unthrottled 1440×900 viewport and reduced motion. No personal
browser profile or export is used. Controlled playback uses a visible real
HTMLVideoElement fed by a canvas MediaStream; it excludes YouTube network,
decoding and ad costs. A separate anonymous live YouTube follow-up uses the
public project tutorial with muted native looping and normal network/player code.
Whole-page live metrics include YouTube work and cannot be attributed solely to
the extension. Ten minutes can reveal growth; it cannot prove unlimited-session
leak freedom.

Chosen budgets: observed usable watch panel within 1,500 ms; watch bundle at most
350 KiB; 100-item startup/search within 1,000/200 ms; 500-item stress startup/search
within 2,000/500 ms. Controlled persisted practice must remain within elapsed
playback minus 35 seconds and plus 5 seconds. Post-GC renderer heap growth should
stay within 5 MiB, with no repeated steady-state tasks above 100 ms. Real-page
tracking is compared with observed media advancement; YouTube's own task and
memory costs are reported separately. Only the deterministic payload budget is
a CI gate; machine timings remain manual investigation thresholds.

Local evidence is retained under
`output/playwright/performance-2026-11-09/`: before/after JSON, separate CPU
profiles and interaction traces, screenshots and raw axe results. Completed
labels are protected from overwrite. Invalid early workload preflights are
explicitly labelled and excluded. See [reproduction commands](../../CONTRIBUTING.md#performance-investigations).

The six-locale visual matrix checks statistics at 100% and the watch panel,
Details control and calendar at native 200% zoom (512×300 CSS viewport). Thirty
captures and twelve scoped raw axe scans are retained; all scans have zero
violations, with incomplete checks preserved. Hebrew direction/language, long
labels, missing translation keys and horizontal overflow are checked. Actual
screen-reader verification remains [JP-07](spoken-reader-check.md).
