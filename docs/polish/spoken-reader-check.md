# Spoken screen-reader acceptance check (JP-07)

Status: pending. Keyboard, browser accessibility trees and axe checks have
passed; no spoken-output result has been recorded. The available Windows
automation API can inspect controls and send keys but cannot capture or listen
to system audio. An accessibility-tree inspection cannot establish what a
reader actually announces.

An attempt to download and run the NVDA portable setup was rejected by automatic
approval review with “blocked by policy”; no more specific reason was returned.
The installer did not run. Use an existing reader or perform the check manually;
this restriction is not evidence that the application passes or fails.

Use an installed NVDA or Windows Narrator with Chrome, a disposable browser
profile and a build from the current PR stack. The public release predates
these changes. Build with `npm ci` and `npm run build`, then load `dist/`
unpacked as described in the repository README. Keep personal exports out of
test evidence. Test English first, then Hebrew with a suitable Hebrew voice if
available; record a missing voice separately from an application defect.

With the reader speaking and the mouse put aside:

1. Finish onboarding using Tab, arrow keys, Space and Enter. Check that language
   and framework choices announce their names, group and selected state; that
   each step has a readable heading; and that moving forward/back does not lose
   focus or announce hidden steps. Open the tutorial control and return.
2. In the popup, visit Library, Stats and Settings using arrows, Home and End.
   Confirm the selected tab and associated content are understandable, and that
   closed panels are skipped. Read today's duration and the next-action label.
3. In the dashboard, navigate Library, Completed, Stats, Goals and Settings.
   Confirm headings and navigation state are announced. With a saved test video,
   expand its actions, change a level, mark completed, and use Undo. Confirm the
   success/Undo announcement is understandable and focus remains usable.
4. Read today's goal and use the calendar's arrow keys, Home/End and Enter.
   Confirm that date, practice amount and goal status are understandable and
   that moving through dates does not trap focus.
5. In Settings, use section jumps and expand Personalization. Check labels,
   checkbox state, help, and the save acknowledgment after editing a test name.
   Reach Export and Clear and cancel Clear's confirmation. Never clear personal
   data for this check.
6. On a YouTube test video, reach the watch panel, read its title and daily
   progress, change a level and use the move handle's arrow keys. Confirm control
   names and status announcements are understandable alongside page content.
7. Repeat the navigation essentials in Hebrew. Check mixed Hebrew/Latin titles
   and durations for reading order and ensure arrows still follow the control's
   advertised behavior.

Record the source commit/PR, Windows/Chrome/reader versions, language/voice,
steps passed, and any repeated/missing/incorrect announcement or lost focus.
For a failure, include the control, exact action and words heard. A pass requires
actual spoken-output observation; do not infer it from zero automated violations.
