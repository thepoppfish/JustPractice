# Manual live-playback acceptance check (JP-21)

Status: pending. Controlled installed-extension playback, library benchmarks,
packaging and browser regressions are recorded separately in
[the performance notes](performance.md). This check covers sustained playback
on the actual YouTube service in a normal Chrome session.

The automated Chromium session played initially, then YouTube discarded the
media source at about 43 seconds and displayed “Something went wrong. Refresh
or try again later.” The same failure occurred without the extension, in both
headless and visible windows, and on two different public videos. Practice
stopped when playback stopped. These observations do not establish the service's
underlying cause or prove ten minutes of actual streaming playback. No consent,
sign-in or other restriction was bypassed.

Use a disposable normal Chrome profile, keeping personal data out of evidence.
Use the source candidate from PR #9 and its preceding stack; the public 1.0.1
download is older. Build the branch with `npm ci` and `npm run build`, then load
`dist/` unpacked through `chrome://extensions`, or use the retained local PR #9
candidate after its verification report is finalized. Finish onboarding.

1. Choose a public video longer than eleven minutes that plays normally in
   your browser. Record its URL/ID, Chrome version, candidate source commit and
   initial practice total. Set playback to 1× and save it using the watch panel.
2. Keep the video tab visible and focused for ten minutes. If you need to use
   another window, first disable **Pause counting when YouTube loses focus** in
   the disposable profile and record that choice; a hidden tab never counts.
   Do not seek or change speed during the measured interval.
3. Check that the displayed daily duration advances with media playback,
   without repeatedly adding pending seconds. Record the final media position
   and duration shown in the panel. Pause the video, then wait for the normal
   thirty-second save interval and check the dashboard's total.
4. Compare the increase with the playback that actually elapsed. Ordinary
   batching permits a short pending remainder before the save; the UI should
   not show roughly fifteen minutes after ten minutes of playback. Note any
   unexpected pause, error, repeated long freeze or lost panel control.
5. Record pass/fail, source/Chrome version, video ID, start/end media and
   practice totals, focus setting, and any error text. Screenshots should show
   only the disposable test profile. Do not send a personal export or cookies.

If YouTube also fails here, report the error and observed playback duration
instead of recording a pass. The separate
[screen-reader check](spoken-reader-check.md) was explicitly skipped by the
maintainer; playback verification is the remaining gate.
