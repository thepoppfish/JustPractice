# Normal-Chrome playback result — 10 November 2026

**Passed: the final installed-candidate repeat completed ten minutes of actual
media playback at 94.0% of wall time, with correct tracking, a stable paused
total and exact reload persistence.** This closes JP-21's live-verification gate;
PR #9 is merged into `master`. Earlier incomplete runs and the disabled control
are retained below with their limitations. Their stalls were not exclusive to
JustPractice, and no underlying service cause or universal speedup is claimed.

## Initial candidate run and method

- Source: `a105d3702c3f3b1d078360e2204ff202c60ada6e`, PR #9 and its preceding stack.
- Candidate: 1.0.3, loaded from `dist/` by the maintainer. The maintainer disabled
  the separate 1.0.1 copy without removing it; no existing practice data was imported,
  cleared or overwritten. The candidate started with zero practice time.
- Watch bundle SHA-256: `8b2e834d47f17f20789f171d6fa019de6cefc0c6ba29d06af78e9622722046d9`.
- Public video: [Big Buck Bunny](https://www.youtube.com/watch?v=aqz-KE-bpKQ),
  duration 634.601 seconds. This was shorter than the guide's suggested eleven-minute
  minimum, but the measured playback still exceeded ten minutes without looping.
- Playback speed: 1×, muted; default focus requirement retained. The video was
  saved with the panel before the measured interval. No seek or speed change
  occurred during that interval.
- Start: 07:42:34 UTC. Browser control used the connected Chrome extension rather
  than a new automated Chromium profile. The installed Chrome binary reports
  157.0.8103.39; the running browser's exact version was not independently captured.

## Initial candidate observations

| Check | Recorded result |
| --- | --- |
| Initial media / practice | 0.094 seconds / 0 seconds |
| Media at pause | 622.261 seconds (10 min 22 s), paused, ready state 4, no sampled media error |
| Display at pause | 619 seconds (10 min 19 s), about 3.2 seconds behind actual media advancement |
| Wall time before pause | 745.835 seconds (12 min 26 s) |
| Paused counter | Unchanged at 619 seconds after another 46.221 seconds |
| Reload | Saved video remained in the library; total showed 623 seconds after 5.151 seconds of reload autoplay, consistent with the previous 619 seconds plus four newly counted seconds |
| Follow-up pause | The reloaded video was paused and the total remained 623 seconds |

Samples show the display following media progress rather than growing faster
than playback. There was no recurrence of the roughly fifteen-minute display
after ten minutes of practice. Reload verification used the watch panel; the
dashboard was not independently inspected in this live session, and no direct
storage read is claimed.

Media advancement was approximately **83.4% of wall time**, below the profiler's
existing **85%** sustained-playback threshold. Slow progress became pronounced
later in the run. A YouTube quality change from Auto (then reporting 1080p60)
to 720p60 was attempted at elapsed 590.660 seconds. The transition briefly reported
zero duration/readiness, then resumed at the previous position. The run was
extended until actual playback exceeded ten minutes; this does not turn it into
a passing near-real-time performance run. The cause of the slow advancement was
not established, and these observations do not attribute it to JustPractice.

A separate preflight confirmed fixed 360p through YouTube's visible quality
menu. Subsequent Play clicks and the keyboard shortcut left the observed video
paused at zero with a visible spinner. Some browser commands also timed out.
That follow-up never reached a measured playback interval and is **not a pass**.
The browser log API returned no captured warning/error entries; that is not
evidence that every component was error-free. No unrelated extension, network
setting or browser protection was changed.

## Extension-disabled control

After the maintainer confirmed both 1.0.1 and 1.0.3 were disabled, a fresh tab
played the same video in the same connected Chrome profile. The JustPractice
panel count was zero in every sample. The control used muted 1× playback at
fixed **1080p60**, confirmed in YouTube's visible quality menu; no seek, speed
or quality change occurred during the measured interval. Other extensions and
browser settings were left alone. Some browser commands timed out during setup,
before this measurement, with JustPractice already absent.

| Control check | Recorded result |
| --- | --- |
| Start | 08:12:54 UTC; media 0.771 seconds |
| Final elapsed time | 603.710 seconds (10 min 4 s) |
| Final media position | 533.900 seconds (8 min 54 s; YouTube's snapshot displayed 8:53) |
| Actual media advancement | 533.129 seconds, **88.3%** of wall time |
| Substantial stall | Between elapsed 193.401 and 251.456 seconds, media advanced only 2.412 seconds over 58.055 seconds |
| Sampled state | Every sample had no JustPractice panel, playback speed 1×, duration 634.601 seconds, ready state 4 and no media error; playback was unpaused until the final Pause action |
| End control | Pause succeeded and the final sampled video state was paused |

The control meets the numeric 85% window-advancement threshold, despite the
mid-run stall. It does not verify an installed candidate: JustPractice was
disabled. The stall demonstrates that JustPractice is not required for this
symptom to occur. It does not establish the cause or prove zero extension
overhead. These were sequential single trials, with potentially different
cache/network conditions and different quality policies: the candidate began
with Auto reporting 1080p60 and later attempted a switch to 720p60, whereas the control
stayed fixed at 1080p60. The 83.4% versus 88.3% results therefore must not be
presented as a measured causal slowdown from the extension.

The earlier 43-second discarded-stream error did not recur in either normal-
Chrome run. No runtime fix is justified solely by these observations. The
control did not close the candidate's acceptance gate; the later repeat below did.

## Final installed-candidate repeat — passed

The maintainer re-enabled 1.0.3 and left 1.0.1 disabled. A fresh tab in the same
normal Chrome profile played the same public video. Source head `26b7ffb` had
the same watch-bundle hash recorded above; no runtime code changed between runs.
YouTube's visible menu confirmed fixed **1080p60** before measurement, matching
the control. Playback was muted at 1×, with the default focus policy retained.
No seek, speed or quality change occurred during the measured interval.

During setup, the expanded floating panel visibly covered YouTube's Settings
button. Collapsing it exposed the control and allowed the resolution to be
confirmed; the panel was reopened before playback. This makes earlier missed
clicks inconclusive as evidence of an unresponsive player. It does not explain
the separate media stall observed without JustPractice. No new runtime fix or
browser-permission change was required.

| Final check | Recorded result |
| --- | --- |
| Start | 08:50:48 UTC; practice 627 seconds (10 min 27 s), media 0.150 seconds |
| Measured wall time | 647.903 seconds (10 min 48 s) |
| Final media / advancement | 609.249 seconds; **609.099 seconds advanced** (10 min 9 s) |
| Sustained advancement | **94.0%**, above the unchanged 85% threshold |
| Final practice | 1,229 seconds at the first paused read, then one pending tick settled to **1,230 seconds (20 min 30 s)** |
| Practice increase | **603 seconds (10 min 3 s)**, 6.099 seconds below actual media advancement; within the existing playback tolerance, with no double counting |
| Paused total | Settled total unchanged across a 36.802-second observed interval; 67.153 seconds elapsed between pause and the pre-reload read |
| Reload | **Exactly 1,230 seconds** returned, video still saved; reload autoplay was paused at 1.372 seconds without changing the displayed total |
| Panel control | Already saved — details focused the difficulty/Level control; no re-save was needed |
| Sampled player state | One candidate panel, 1× playback, duration 634.601 seconds, ready state 4 and no media error throughout the measured interval |

This is a passing installed-candidate live check, alongside the earlier
controlled profiles, library budgets and packaging checks. Persistence was
verified by a fresh watch-page reload rather than a direct storage read or
separate dashboard inspection. The six-second tracking difference is reported
explicitly; exact frame-for-frame accounting is not claimed. No live CPU/heap
profile was collected by this browser-control check. Single sequential live
runs cannot establish a general speedup, zero overhead, every network condition
or unlimited-session leak freedom.

## Evidence and acceptance state

Local evidence is in `output/playwright/normal-chrome-2026-11-10/`: `result.json`
contains all measured samples and pause/reload observations, `follow-up.json`
records the incomplete preflight, and `verification.html` links screenshots.
These normal-profile captures stay local and are excluded from source/runtime
packages; no personal export, cookies or browser profile is included.

The control's samples, `result.json`, screenshots and `verification.html` are
retained separately in `output/playwright/normal-chrome-control-2026-11-10/`.
Its report links the earlier candidate evidence. Both installed copies were
disabled during that control; the maintainer subsequently re-enabled 1.0.3 for
the final repeat. No extension or practice data was removed.

The final repeat's `result.json`, timestamped samples, baseline/midpoint/paused/
Details/reloaded screenshots and `verification.html` are retained in
`output/playwright/normal-chrome-final-2026-11-10/`. The raw normal-profile
captures stay local. Version 1.0.3 remains enabled and 1.0.1 remains disabled.

JP-21 is merged through PR #9. The original 21 action/acceptance
values remain unchanged. JP-07's manual reader check remains explicitly skipped
by the maintainer, not passed. PRs #3–#9 were merged in dependency order after
maintainer approval. The maintainer subsequently authorized and published
[runtime 1.0.3](https://github.com/thepoppfish/JustPractice/releases/tag/1.0.3).
Controlled performance measurements and the cross-platform regression
suite are recorded in [the performance notes](performance.md).

The source/documentation head `84af551` passed both full Linux and Windows jobs
in [run 42779402710](https://github.com/thepoppfish/JustPractice/actions/runs/42779402710).
The subsequent control head `26b7ffb` also passed both full jobs in
[run 42782676015](https://github.com/thepoppfish/JustPractice/actions/runs/42782676015).
The final verification follow-up changes evidence and documentation only.
