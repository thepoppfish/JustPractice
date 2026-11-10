# Watch payload and measured performance (JP-21)

Controlled verification has passed. The source has passed local and
Linux/Windows checks. The [final normal-Chrome repeat](live-playback-result-2026-11-10.md#final-installed-candidate-repeat--passed)
also passed sustained playback, tracking, pause and exact reload persistence:
609.099 media seconds over 647.903 wall seconds (94.0%), with 603 practice
seconds added. JP-21 is implemented-awaiting-review. No release, merge or
publication is part of this work.

## Measured changes

The preceding PR #8 watch bundle is 703,404 bytes. The optimized build before the
daily-display correction is 346,228 bytes (SHA-256
`b5f88a4bf6da734e9338012dbc517f061bd15241fca84d22c07d071df4befd29`).
This is a 50.8% payload reduction, independent of machine timing. Minification,
focused D3 imports and omission of dashboard/onboarding messages account for the
reduction. The corrected final bundle is 346,144 bytes, SHA-256
`8b2e834d47f17f20789f171d6fa019de6cefc0c6ba29d06af78e9622722046d9`.
The retained candidate ZIP is 267,465 bytes, 17.4% smaller than PR #8's 323,683-byte
ZIP. It contains 24 runtime files and a root manifest; source maps stay outside
the archive. Shared calendar labels retain all six translations under a shared
namespace; extension pages retain complete dictionaries. A build guard rejects
page-only message references in watch dependencies. A classic-script parser and
350 KiB size check protect packaging.

Five fresh dashboard documents per library size, with three search interactions
per trial, have completed for the original and final corrected build:

| Saved videos | Before startup max | Corrected startup max | Before search max | Corrected search max |
| --- | ---: | ---: | ---: | ---: |
| 25 | 277.8 ms | 187.3 ms | 63.8 ms | 47.6 ms |
| 100 | 242.4 ms | 271.2 ms | 94.5 ms | 80.1 ms |
| 500 | 690.8 ms | 730.6 ms | 316.8 ms | 338.5 ms |

Both builds fit the chosen investigation budgets. These observations do not
establish a general dashboard speedup; the change targets watch payload size.
Startup uses a warm background worker and includes automation observation and
two animation frames. Search includes one match, no match and clearing the query.
Twenty percent of the saved fixtures are completed and excluded from the active
library. The 500-item case is a stress workload.
The intermediate pre-display-correction trials remain in `after-library.json`;
the final numbers above are in `corrected-library.json` and identify the same
bundle hash as the retained candidate.

## Playback finding and follow-up

The controlled baseline completed 600 seconds with 598 seconds persisted and no
steady-state long tasks after the first minute. Its displayed daily duration,
however, advanced faster than playback. Calendar synchronization folded pending
seconds into its baseline, then the renderer added those seconds again.
Persisted practice remained accurate. The correction keeps synchronized/flushed
seconds separate from the meter's unflushed remainder. Regression coverage
exercises repeated polls, stale snapshots and the normal playback/save intervals.
The corrected build completed 600.051 seconds with 598 seconds both persisted
and displayed (9 minutes 58 seconds). Its observed usable panel time was 134.6 ms,
with no page errors or steady-state long tasks after the first minute. Post-GC
renderer heap grew from 3.01 to 3.31 MiB (+0.30 MiB), with 827 final DOM nodes.
Listeners remained at 57 throughout the corrected run; the older baseline had
44. The data supports bounded growth over this window, not a claim of lower
absolute memory use or unlimited leak freedom.

The final run identifies source `fc6396c` and the retained candidate's exact
watch-bundle hash. Earlier intermediate runs were collected with edits based on
`59cfc83`; their `source` field names that base commit, while their bundle hashes
identify the actual measured payload. They are retained separately from the
final corrected build. The original before-bundle hash also matches the retained
PR #8 ZIP directly.

## Actual YouTube results and environment limits

The public project tutorial played initially, then YouTube emptied the media
source around 43 seconds and displayed “Something went wrong. Refresh or try
again later.” The same failure reproduced without the extension in headless
and visible Chromium, and on a second public video (the Blender Foundation's
Big Buck Bunny). The extension's saved total stopped with actual playback.
This is evidence against attributing the observed failure to this extension;
it does not establish YouTube's underlying cause or qualify as sustained
live-playback verification.

The profiler now retains player text/readiness and a full diagnostic screenshot
when a media source is discarded, and fails the run. A live session must advance
media for at least 85% of its window to qualify as sustained playback. The
invalid, intentionally terminated headless run is retained for diagnosis and
excluded from acceptance. No restriction is bypassed or repeatedly retried.
The corrected installed build's diagnostic run also stopped around 44 seconds:
44 seconds were both persisted and displayed, with no extension page errors.
Its new guard rejected the discarded media source and retained the full player
error screenshot; the run is not counted as successful sustained playback.
The [10 November normal-Chrome run](live-playback-result-2026-11-10.md) reached
622.261 seconds of media with 619 seconds displayed, unchanged during a subsequent
46-second pause. Reload preserved the total, with four additional seconds counted
during brief reload autoplay. The earlier 43-second failure did not recur.
However, media advancement was only 83.4% of the 745.835-second window, below
the existing 85% threshold. A fixed-360p follow-up did not start successfully.
This supports live counting/persistence, not a sustained-performance pass or a
claim about the cause of the slow playback. It is retained as an incomplete
initial run, separate from the passing repeat below.

The subsequent extension-disabled control advanced 533.129 media seconds over
603.710 wall seconds (88.3%). It also had a substantial stall, advancing only
2.412 seconds over a 58.055-second interval with the JustPractice panel absent
in every sample. Thus this symptom occurs without JustPractice. The trials'
quality policies and potential cache/network conditions differ, so the average
throughput difference is not a causal extension-overhead measurement. The
control does not replace a passing installed-candidate live run. See the
[recorded comparison](live-playback-result-2026-11-10.md#extension-disabled-control).

With 1.0.3 re-enabled, the final repeat used confirmed fixed 1080p60, muted 1×
playback and the same public video. It advanced **609.099 seconds over 647.903
seconds (94.0%)**, above the unchanged 85% threshold. Practice increased from
627 to **1,230 seconds**, a 603-second increase, 6.099 seconds below media
advancement and within the existing tracking tolerance. One pending tick settled
after pause; the settled total was unchanged across 36.802 observed seconds and
returned **exactly** after reload. The Details shortcut focused Level correctly.
The expanded panel had covered Settings during setup; collapsing it cleared
that overlap. Earlier missed clicks therefore do not establish an unresponsive
player. The full [result and scope](live-playback-result-2026-11-10.md#final-installed-candidate-repeat--passed)
retain samples and screenshots without claiming a causal speedup, zero overhead
or new live CPU/heap measurements. This closes the live-verification gate.

## Checks and retained candidate

The corrected source passed 411 unit tests in 58 files and all 18 installed
browser cases locally, including actual playback across two calendar polls and
a normal save interval. Type checks, zero-warning lint before/after the build,
dependency policy, production/runtime verification and special-character Windows
packaging passed. Linux and Windows passed the same full sequence for runtime
commit `72f2f30` in [run 42664942999](https://github.com/thepoppfish/JustPractice/actions/runs/42664942999)
and the profiling-guard follow-up `fc6396c` in
[run 42666669215](https://github.com/thepoppfish/JustPractice/actions/runs/42666669215).
There were no skipped or retried browser cases in the inspected Linux artifact.

The local immutable candidate is `justpractice-1.0.3-pr9.zip`, SHA-256
`641e0d80d2c9133e4a8b52d0b33e200169be1cf836bca07606f18ad063ac0d7a`.
Its watch bundle matches the inspected Linux CI runtime byte for byte. This is
an unpublished candidate; it does not replace the public 1.0.1 release.

[PR #9](https://github.com/thepoppfish/JustPractice/pull/9) is stacked on #8.
JP-21 is implemented-awaiting-review; controlled and final live checks have
passed. Source/documentation head `26b7ffb` passed both full jobs in
[run 42782676015](https://github.com/thepoppfish/JustPractice/actions/runs/42782676015).
JP-07's
manual reader check was explicitly skipped by the maintainer on 10 November
2026 and is no longer a gate; no reader pass is claimed.

## Scope, budgets and retained evidence

Controlled measurements use disposable installed-extension profiles, synthetic library
records and thumbnails, Chromium 158.0.8127.18 on Windows 11 with an Intel Core
Ultra 7 268V, an unthrottled 1440×900 viewport and reduced motion. No personal
browser profile or export is used in those measurements. The separate 10 November
live check used the maintainer's normal Chrome session with an isolated candidate
library; its raw captures remain local. Controlled playback uses a visible real
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
labels, missing translation keys and horizontal overflow are checked. The
maintainer skipped [JP-07's manual screen-reader check](spoken-reader-check.md).
