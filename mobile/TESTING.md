# Testing: HealingNet patient app 0.2

Run on 13 November 2026, on Windows, against the live Supabase project. The notes for 0.1 are in git history (`git show 9e1525f:mobile/TESTING.md`).

## Summary

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` in `mobile/` | Pass, 0 errors |
| `npx expo-doctor` | Pass, 20 of 20 checks |
| Unit tests (`npm test`) | Pass, 136 tests in 12 files (61 in 0.1) |
| Android JavaScript bundle (`npx expo export --platform android`) | Pass, every import resolves; 4.5 MB |
| Website `npx tsc --noEmit -p tsconfig.app.json` | Pass, 0 errors |
| Website `npm run build` | Pass |
| Live data check (`node scripts/live-check.mjs`) | **Not run past sign-in**: the test patient's login in `.env.test` is refused (see below) |
| Preview APK built on EAS | Pass: build `394dd68b`, 24.1 MB (0.1 was 109 MB) |
| The app on a phone | **Not run** by me: this computer has no phone, emulator or `adb`. Use the checklist below |
| Cold-start and tab-switch times on a phone | **Not measured**, for the same reason (see "Speed") |

## What could not be run, and why

**The live data check stopped at sign-in.** `.env.test` still holds the test patient's email and password, but Supabase answers "Invalid login credentials". The password was changed or the account was removed after the 0.1 run on 12 November (0.1 testing included password reset and account deletion, either of which would do it). Until the login is fixed, none of the signed-in steps can run, old or new. What was checked instead:

- Signed out, `rate_appointment` and `register_push_device` both answer "permission denied" (so the 0.2 database patch is live).
- Signed out, every new query (lab results with tests and parameters, records, letters, messages, ratings, the new appointment and patient columns) is accepted as well formed by the API and refused only for lack of access. A deliberately wrong join is rejected, so this check does tell the two apart. It does not prove a signed-in patient may read every column; the first signed-in run will.

To finish: put a working test-patient login in `.env.test`, then run `cd mobile && node scripts/live-check.mjs`. It has 22 steps; the 0.2 ones are listed under "Live check" below.

**Nothing was opened on a phone.** As in 0.1, the screens are type-checked and bundled and their pure logic is unit tested, but nobody has tapped through 0.2 yet. The release build is now minified (R8), which can strip code a library needs; that only shows on a real phone. If a screen crashes in the preview APK but not in a development build, tell me which one: the fix is a keep rule in `app.config.js`.

**Medicine reminders have not fired on a device.** The times, the 60 limit and the top-up are unit tested. The notification itself, the Taken and Snooze buttons and what happens with the app closed need a phone.

## Speed

I could not time the app: there is no Android device or emulator on this computer, so there are no before and after numbers from me. What changed, and how to time it:

| | 0.1 | 0.2 |
| --- | --- | --- |
| First screen for a signed-in patient | Waited for the session to be read **and refreshed over the network** when the token had expired (any time the app had been closed for an hour), then for the role check: five requests, one after another, then the profile | Chosen from what is stored on the phone, behind the splash. No network before the first screen. Role check is one round trip, in the background |
| Visits, first open | Requested its data when tapped; drew **every** visit as a full card (the test patient has 157) | Data prefetched while Home is showing; draws 6 cards and the rest as you scroll |
| Coming back to a tab | Tab re-rendered in the background on every data change | Tab stays mounted and is frozen while hidden |
| JavaScript bundle | 6.7 MB or more | 4.5 MB |

To time it on Bhee's phone (targets: Home under 2 seconds from the icon; a tab under 300 ms once the app has data):

1. Force-stop the app, start a screen recording, tap the icon, stop when Home shows the next appointment. Count the frames or read the recording's clock. Do it once straight after using the app and once after the phone has sat for over an hour (that is the case 0.1 was slowest at).
2. Same for tapping Visits the first time after a cold start, and again on the second tap.

No timing logs were added to the code, so there are none to remove.

## App size

Measured from the finished preview APK (build `394dd68b`), by reading the file's contents.

| | Size |
| --- | --- |
| 0.1 test APK | 109 MB |
| 0.2 preview APK (arm64-v8a + armeabi-v7a) | **24.1 MB** |
| Of that, for an arm64-v8a phone only | about 17.2 MB |
| Of that, for an armeabi-v7a phone only | about 16.2 MB |
| Estimated Play Store download, arm64-v8a phone | **about 17 MB** |

What is inside the 24.1 MB: native code for arm64-v8a 7.9 MB and for armeabi-v7a 6.9 MB, the app's Java/Kotlin code 3.5 MB, the JavaScript 3.5 MB, images and other resources 2.0 MB.

Why the 0.1 file was 109 MB: it was a "universal" APK. It carried native code for four processor types (arm64-v8a, armeabi-v7a, x86 and x86_64; the two x86 ones are only used by emulators), that code was stored uncompressed, nothing was minified, and the JavaScript included all 2,300 icons of the icon library and several unused packages. No phone ever needed most of it. The Play Store does not ship a file like that: it takes an app bundle (AAB) and sends each phone only its own processor's code, compressed.

The estimate for the Play Store is the arm64 share of this APK. The real figure will be shown in the Play Console once an AAB is uploaded; expect it within a couple of MB.

On the phone the app takes more room than its download, because Android unpacks the native code when installing (about 24 MB for arm64).


## Unit tests

| File | What it covers |
| --- | --- |
| `startup.test.ts` (new) | Start-up routing: stored session → tabs, none → Welcome, a background check that fails → the right screen; a fresh sign-in waits for its first check |
| `reminders.test.ts` (new) | Frequency → reminder times (every case in the brief, and unknown text → none); duration; the 60-reminder cap and top-up; lock-screen wording |
| `labs.test.ts` (new) | The out-of-range wording (High, Low, Outside the normal range); the lab report and letter pages; record types and vitals |
| `triage.test.ts` (new) | The emergency triggers; how answers are recorded; the saved session (with `severity_self` empty); booking reason |
| `reviews.test.ts` (new) | Which visits can be rated (completed, with a doctor, 30 days); "4.6 ★ (12 reviews)" and "New" |
| `messages.test.ts` (new) | Grouping messages into conversations; unread counts |
| `links.test.ts` | Now also: lab results, records, letters and messages links open their app screens |
| `cache.test.ts` | Now also: lab results and records are saved for offline; messages, letters and ratings are not |
| `shared.test.ts` | Now also: the two health-card fields and their 500-character limit |
| `theme`, `appointments`, `dates` | As in 0.1 |

## Live check

`scripts/live-check.mjs` now also does the following, signed in as the test patient. None of these ran on 13 November (see above).

| Step | What it does |
| --- | --- |
| Visits with the 0.2 columns | Reads appointments with the call and date columns, the patient's ratings, and doctors' review counts |
| Lab results, medical records, letters | Runs each screen's query and counts the rows |
| Messages | Reads the conversations and sends one `[E2E]` message to a doctor the patient has a visit with |
| Health card | Saves allergies, reads it back, restores the original; checks 501 characters is refused |
| Check symptoms | Calls `triage-nurse`, saves one `[E2E]` session, and reports the level for a chest-pain description |
| Rate your visit | Rates a completed `[E2E]` visit if there is one (and checks 6 stars is refused); otherwise says so and checks that a visit that is not completed is refused |

It never prints `.env.test` values, names or health data: only step names, counts and the database's own messages. New `[E2E]` records are described in `e2e/cleanup.md` under "Mobile app 0.2 live check".

## Phone checklist for 0.2

Install the preview APK over 0.1 (or uninstall 0.1 first). Sign in as a patient who has visits, a prescription, a lab result and a message if possible.

### Start-up and speed

1. **Cold start straight to Home.** Sign in, use the app, force-stop it, tap the icon. Expect: splash, then Home with your data. The Welcome or sign-in screen must not appear, even for a moment.
2. Leave the phone for over an hour, force-stop, open again. Same result, in under 2 seconds.
3. Turn on airplane mode, force-stop, open. Home opens with saved data and the "Offline" bar. You are not signed out.
4. Sign out, force-stop, open. Welcome shows, with no old data.
5. Turn on App lock (Me), force-stop, open. The lock shows before anything else; Home must not flash first.
6. **Tab-switch speed.** After Home has loaded, tap Visits, Health, Messages, Me in turn. Each shows its content at once (under 300 ms): no full-screen spinner, and no skeleton when it has been opened before. Scroll Visits to the bottom of Past: it scrolls smoothly.
7. On another device, have the hospital accept a pending visit while Visits is open. The card updates by itself within a few seconds.

### New screens

8. **Messages.** With no conversations: the empty screen says your doctors will message you here. After a doctor writes from the website: the conversation shows the doctor's name, the last message and "● 1 new". Open it: the message is marked read (the doctor's side shows it). Type a reply with the keyboard open: the text box stays above the keyboard. The reply appears on the doctor's page; the doctor's next message appears in the chat within 5 seconds without pulling to refresh.
9. **Lab results.** The list shows the tests, hospital, date and "New". Open one: every parameter has its value, unit and reference range, and anything outside the range says "▲ High", "▼ Low" or "Outside the normal range" in words. Go back: "New" is gone. Share as PDF: the PDF opens in the share sheet and reads correctly.
10. **Airplane mode on Lab results.** Open Lab results once online. Turn on airplane mode, force-stop the app, open it, go to Health → Lab results and open a result: it all shows, with the "Offline · last updated" bar. Same for Medical records.
11. **Medical records.** A timeline with date, doctor, hospital and type; tapping an entry shows the notes or the vitals. Nothing can be edited.
12. **Letters.** List with Issued / Requested / Expired in words; open one; Share as PDF.
13. **Check symptoms.** Home → Check symptoms. About you shows your age; pick a sex; describe a mild problem; answer the questions (one per screen, big buttons). The result says how urgent it is in words and suggests a kind of doctor. Tap Book a doctor: booking opens with that specialty as a chip and the reason filled in. The doctor sees the triage in their panel on the website.
14. **Emergency card.** Start again and describe crushing chest pain going to the left arm with sweating. The red emergency card shows at once, with Call 112 (opens the dialler; do not press call) and Find the nearest hospital (opens Maps).
15. **A video call through the browser.** Book a video visit and have the doctor accept it. In Visits tap Join call: a sheet explains the camera and microphone and shows Join now. Tap it: "Joining…", then the call page opens in the in-app browser, the browser asks for camera and microphone, and the call works both ways. When the doctor joins first, the card says "Your doctor is in the call and waiting for you". Close the browser: you are back in Visits and the visit has refreshed.
16. **Health card.** Health shows Allergies and Long-term conditions as "None known". Edit, type an allergy, save: it shows on the card and on the website's Profile page. Clear it: "None known" again.
17. **Rating a visit.** Have a doctor complete a visit. In Visits → Past it shows Rate your visit. Tap it, pick 4 stars, add a comment, submit: the card shows "★★★★☆ (4 of 5)" and Change rating. Change it to 5. In booking, that doctor now shows "5.0 ★ (1 review)"; a doctor nobody has rated shows "New". The website's booking flow shows the same. A completed visit older than 30 days shows no Rate button.

### Medicine reminders

18. Open a valid prescription, tap **Remind me** on a medicine. The times match how often it is taken (for example "Twice daily" → 8:00 am and 8:00 pm). Change one time to two minutes from now. Save. Allow notifications if asked.
19. **A reminder firing with the app closed.** Force-stop the app and lock the phone. At the time, the lock screen shows "Time for your medicine" and does **not** name the medicine. (Android may be a minute or two late; see Decisions in the hand-over note.)
20. **Taken.** Tap Taken on the notification. The app opens on Home, and Today's medicines shows that dose ticked, "1 of 2 taken".
21. **Snooze.** Set another time two minutes away, tap Snooze 15 min when it fires. It fires again 15 minutes later. Tick it on Home before then instead: the snoozed one does not fire.
22. Me → Notifications → turn on "Show details on the lock screen". Set a new time two minutes away: this one names the medicine and dose.
23. Home's Today's medicines lists today's doses in time order; tapping a row ticks and unticks it.
24. Turn off reminders (Change reminders → Turn off reminders): the row leaves Today's medicines and nothing fires.
25. Set a reminder, then **sign out**. Wait for its time: nothing fires. Sign in again: Today's medicines is empty.

### Still worth repeating from 0.1

26. Book, cancel and reschedule a visit; open a prescription offline and show the QR (it is now drawn by the app's own code, so check a pharmacist's scanner or the phone camera still reads it); share a prescription PDF; change the profile photo; the app switcher still shows the cover; push notifications still arrive and open the right screen, including the lab results one.

## Records created in the live project

None on 13 November (the check stopped at sign-in). What a successful run creates is listed in `e2e/cleanup.md` under "Mobile app 0.2 live check".
