# Normal-Chrome playback result — 10 November 2026

**Tracking and reload persistence passed; sustained-performance acceptance remains pending.**
The browser extension connection allowed the candidate to be tested in the
maintainer's normal Chrome session. This run did not reproduce the earlier
43-second discarded-stream failure. Slow media advancement and an unsuccessful
follow-up prevent recording a complete JP-21 live-performance pass.

## Candidate and method

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

## Observations

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
later in the run. YouTube quality was changed from Auto (then reporting 1080p60)
to 720p60 at elapsed 590.660 seconds. The quality transition briefly reported
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

## Evidence and remaining check

Local evidence is in `output/playwright/normal-chrome-2026-11-10/`: `result.json`
contains all measured samples and pause/reload observations, `follow-up.json`
records the incomplete preflight, and `verification.html` links screenshots.
These normal-profile captures stay local and are excluded from source/runtime
packages; no personal export, cookies or browser profile is included.

JP-21 remains verification-pending for a live session meeting the existing
sustained-playback threshold with usable controls. Practice counting, stopping
while paused and persistence now have normal-Chrome evidence. No runtime fix
was made from an unestablished cause. Controlled performance measurements and
the cross-platform regression suite remain separate evidence in
[the performance notes](performance.md).
