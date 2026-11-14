# Testing: HealingNet patient app 0.3 (and 0.2)

Run on 13 November 2026, on Windows, against the live Supabase project. The notes for 0.1 are in git history (`git show 9e1525f:mobile/TESTING.md`).

## Summary

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` in `mobile/` | Pass, 0 errors |
| `npx expo-doctor` | Pass, 20 of 20 checks |
| Unit tests (`npm test`) | Pass, 155 tests in 12 files (61 in 0.1) |
| Android JavaScript bundle (`npx expo export --platform android`) | Pass, every import resolves; 4.5 MB |
| Website `npx tsc --noEmit -p tsconfig.app.json` | Pass, 0 errors |
| Website `npm run build` | Pass |
| Live data check (`node scripts/live-check.mjs`) | Pass, 24 of 24 steps, in the third round (see below). Two things in it had nothing to run on: rating a visit, and marking a lab result as seen |
| Preview APK built on EAS | Pass: build `394dd68b`, 24.1 MB (0.1 was 109 MB) |
| The app on a phone | **Not run** by me: this computer has no phone, emulator or `adb`. Use the checklist below |
| Cold-start and tab-switch times on a phone | **Not measured**, for the same reason (see "Speed") |

## Second round, later on 13 November

After the first APK, these were added: Messages live through Realtime (no polling), the "Your doctor is ready" and "New message" notifications opening the right place, reminder times for 4 times a day and every 6 hours, and Request a letter. Second preview build: `8ea2f97c`.

Two things asked for in that round were **not** done, because of what the live project answered:

- **The live data check still stops at sign-in.** `.env.test` in this folder was last changed on 4 November, so it still holds the old password. The new password has not reached this file.
- **"Seen by patient" on lab results is not built.** `lab-result-viewed-db.patch` is in the folder but has not been applied to the database: `mark_lab_result_viewed` and `lab_results.patient_viewed_at` do not exist there, and the migration list ends at `20261113110000`. Building against a column that is not there would break the Lab results screen, so "New" still uses the per-phone memory. Apply the patch (`git am`, then `npx supabase db push`) and ask again.

## Third round, later on 13 November

`.env.test` now has the test patient's new password and the lab database patch is applied, so the two things left over from the second round are done. No new build was made.

**The live data check ran in full: every step passed** (twice: 23 steps, then 24 with the new lab step). What it found and did not find:

- Signed in, every 0.2 query is allowed and well formed: 162 visits, 11 lab orders, 12 letters, 36 prescription documents, messages, the health card, triage, notification switches, push device, share code.
- **Rate your visit did not run.** The test patient has no completed `[E2E]` visit from the last 30 days. Only the refusal was checked (a visit that has not taken place cannot be rated). A doctor needs to complete one `[E2E]` visit for the rest.
- **None of the test patient's 11 lab orders is finished**, and none has values. So nothing could be marked as seen. See the next point.

**"Seen by patient" on lab results is built**, in the app and on the website.

- App: "New" on Lab results now comes from the database (`lab_results.patient_viewed_at`), so it is the same on every device. Opening a finished result calls `mark_lab_result_viewed`. The per-phone memory is gone. A result that was opened in the 0.2 APK shows "New" once more after updating, until it is opened again.
- Website, patient: Lab Results shows "New" on a finished result and records the first time it is expanded.
- Website, doctor (Lab Orders) and hospital (Laboratory Management): a finished order says "Seen by patient on <date>" or "Not yet seen by patient".
- Offline: the app clears "New" at once; if the call could not reach the server, "New" comes back at the next refresh and opening the result tries again.

What was checked against the live database: a result that is not the patient's is refused; a result that is not finished stays unseen; the patient cannot set the time directly. **Not checked: a finished result actually being marked**, the first-seen time staying the same on a second look, and the doctor's and hospital's wording with a real date, because the test patient has no finished result. The check also deliberately never marks one, so "New" can still be tried by hand. To try it: have the hospital enter results for one of the test patient's lab orders, open it in the app, then look at the doctor's Lab Orders page.

The current APK (`8ea2f97c`) does not have this: it still uses the per-phone memory. It needs the next build.

Also in this round: the files left by `create-expo-app` in `mobile/` (`src/`, `assets/images/`, `assets/expo.icon/`, `LICENSE`, `scripts/reset-project.js`) were deleted. Nothing in the app used them. `mobile/.claude/` and `mobile/.vscode/` are now ignored by git.

## Fourth round: family (0.3), 13 November

Version 0.3 adds family profiles to the app and the website, and prepares the Play Store listing. The database change (`20261114100000_family_profiles.sql`) was already applied; `my_family()` answers "permission denied" to a signed-out caller, as expected.

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` in `mobile/` | Pass, 0 errors |
| `npx expo-doctor` | Pass, 20 of 20 checks |
| Unit tests (`npm test`) | Pass, 199 tests in 13 files (155 before; 44 new in `__tests__/family.test.ts`) |
| Android JavaScript bundle (`npx expo export --platform android`) | Pass |
| Website `npx tsc --noEmit -p tsconfig.app.json` | Pass, 0 errors |
| Website `npm run build` | Pass |
| Live data check (`node scripts/live-check.mjs`) | Pass, 32 of 32 steps (8 new family steps) |
| Development build | Finished: `82b0bf52` (made before the version changed to 0.3.0, which does not matter: it loads the code from the PC) |
| Preview APK | Started: `be29653b` (see the hand-over note for whether it finished) |
| The app and the website's family pages on a phone or in a browser | **Not run** by me: no phone, emulator or browser session with a patient signed in. Use the checklist below |

New unit tests cover: the active person (starts as Me, saved, reset at sign-out, restored at start-up, falls back to Me when the person leaves the family); a notification's `subject_patient_id` switching person; every per-person query key carrying the patient id; age by the calendar (17 years 364 days is 17, the birthday is 18, 29 February); the permission tick in the add form; the turning-18 note (91 days no, 90 days yes, adult without permission yes, adult with permission no); `p_patient_id` sent only for a family member; and reminders kept apart per person.

New live-check steps, all against the real database as the test patient: `my_family` refuses a signed-out caller; an adult without the permission tick is refused with the database's own message; an `[E2E]` child is added and appears in `my_family` aged 6; a visit is booked for the child with `p_patient_id` (it is saved under the child only) and cancelled; the guardian got 2 notifications about the child, both starting with the child's name; a share code for the child works and one for a stranger is refused; the child's allergies and blood group save; the child is removed and can no longer be read.

**Found by the live check, for Bhee to look at:** removing the child answered `held_by_hospitals: true`, although the only thing the hospital had was one booking that was cancelled a second later. So a family member who has ever had a booking at a hospital is kept by that hospital after removal, even if no visit took place. That is the database's rule, not the app's, and the app's wording ("If a hospital has treated Tobi, that hospital keeps its records") is slightly narrower than what happens. See Decisions in the hand-over note.

**Not built exactly as written, and why:**

- *"HealingNet (dev)" as a separate app.* The development build keeps the package `com.healingnet.app` and replaces the preview app. A second package name needs its own Firebase entry and signing key; see the README.
- *Under-5 danger signs in the symptom check.* The app sends the family member's real age and sex to the triage service and adds nothing of its own. The service's child rules that exist today key on under 13 (children's likelihoods, paediatrics) and under 1 (fever in a baby); it has no separate under-5 set, and none was invented.
- *A push names the family member only when "Show details on the lock screen" is on.* With details off the database sends its generic text, so "Tobi:" is not on the lock screen. Inside the app the title always starts with the name. Tapping a push still switches to the right person, by reading who the notification is about.
- *Website: a family member's health card is edited in a dialog* (Settings → Family, or Profile), not the Complete profile page, because that page requires a phone number and address a child does not have. The app uses its profile form with only the health-card fields.

## Combined checklist for 0.2 and 0.3 (about an hour)

One pass over both versions, grouped by screen. Install the **preview** APK for this (not the development build: speed and offline behaviour only count on a preview build). Sign in as a patient with a visit, a prescription and a lab result. Have the website open on a PC as the same patient, and as a doctor if you can. The longer 0.2 checklist below has more detail on any step.

**Start-up (5 min)**

1. Force-stop, tap the icon: splash, then Home with your data. No Welcome or sign-in flash.
2. Airplane mode, force-stop, open: Home with saved data and the "Offline" bar. Turn airplane mode off.
3. Tap Visits, Health, Messages, Me in turn: each shows at once.

**Family: add and switch (10 min)**

4. Me → Family → Add family member. Add a child ("Tobi", born 6 years ago, Child). No tick box shows. After saving, Home says **For: Tobi**.
5. Add a second person born over 18 years ago: the tick box "I have (name)'s permission…" appears and saving without it is refused. Change the date to make them 17: the box goes away.
6. Tap the **For:** chip on Home: the sheet lists Me, Tobi (6 · Child) and the adult, and "+ Add family member". Choose Me, then Tobi: Home changes each time and never shows one person's visits under the other's name.
7. On the website (Settings → Family) the same two people show. The header says "For: Me ▾"; switch to Tobi there and open Appointments: it is empty for Tobi.

**Home (5 min)**

8. As Me: the Family row lists Tobi with "No upcoming visit". Tap it: the app switches to Tobi.
9. As Tobi: the next-appointment card says "Tobi's next appointment"; the Family row now lists Me.

**Book a doctor (8 min)**

10. As Tobi, Home → Book a doctor. Every step shows **Booking for: Tobi (6)** with Change. Book an in-person visit. The last step lists "For: Tobi (6)".
11. Visits (For: Tobi) shows the new visit as waiting. Switch to Me: it is not in your visits. Home's Family row shows Tobi's next visit date.
12. On the website as the hospital, accept it. The phone gets a push; tap it while showing **Me**: a "Showing Tobi" message appears and Visits opens on Tobi's visit. In Notifications the title starts "Tobi:".
13. As Me, book and cancel a visit of your own, and reschedule one (0.2).

**Check symptoms (6 min)**

14. As Tobi: the first step is "About Tobi" with age 6 and his sex. Describe a mild fever and answer the questions. The result suggests a children's doctor. Book a doctor from it: still "Booking for: Tobi".
15. As Me: describe crushing chest pain to the left arm with sweating. The red emergency card shows at once, with Call 112 (do not press call).

**Health: card, prescriptions, results, records, letters (10 min)**

16. As Tobi: Health shows "Tobi's health card". Edit: only blood group, genotype, allergies, conditions and emergency contact are asked. Save an allergy: it shows on the card, and on the website under Profile (For: Tobi).
17. As Me: open a prescription: code and QR show. Lab results: open one, values and ranges show, "New" goes after opening. Medical records and Letters open. Request a letter (0.2).
18. Airplane mode, force-stop, open, Health → Lab results → open one: it shows, with the offline bar. Switch to Tobi while offline: Tobi's saved (empty) lists show, not yours. Airplane mode off.
19. Share my records as Tobi: the title says "Share Tobi's records" and a code with a countdown shows. Switch to Me: the code clears.

**Medicine reminders (6 min)**

20. As Me, on a valid prescription tap Remind me, set a time two minutes away, save. Lock the phone: "Time for your medicine" arrives without naming the medicine. Tap Taken: Home's Today's medicines shows it ticked.
21. Switch to Tobi: Today's medicines does not show your medicine. (If Tobi has a prescription: set a reminder for him; with "Show details on the lock screen" on it says "Tobi: time for medicine".)

**Messages and video (5 min)**

22. Have the doctor write from the website: it appears in Messages within a second or two; reply. Messages is the same whoever "For:" is set to.
23. If a video visit is accepted: Visits → Join call opens the call in the in-app browser.

**Me, removing, signing out (6 min)**

24. Me → Family → Tobi: his details and health card show. Remove: the message says he will be removed, open appointments are cancelled, and a hospital that has treated him keeps its records. Confirm: the list no longer has him, and if the app was showing Tobi it is back to **For: Me**.
25. Me → Delete my account (do not confirm): it says your family members will be removed too.
26. Switch to the adult family member, then sign out. Sign in again: the app starts as **For: Me**.
27. Rate a completed visit if you have one (0.2).

**Website only (5 min)**

28. As Tobi (add him again or use the adult): Book an appointment shows "Booking for:" with Change; Prescriptions, Lab results, Medical records and Letters follow the switcher; Triage says "About (name)".
29. `/privacy` reads correctly and links to `/delete-account`.

## What could not be run, and why

*(This section describes the first round. The live check has since run; see "Third round" above. The phone points still stand.)*

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

`scripts/live-check.mjs` now also does the following, signed in as the test patient. They first ran in the third round on 13 November.

| Step | What it does |
| --- | --- |
| Visits with the 0.2 columns | Reads appointments with the call and date columns, the patient's ratings, and doctors' review counts |
| Lab results, medical records, letters | Runs each screen's query and counts the rows |
| Lab results: seen by the patient | Checks `mark_lab_result_viewed` refuses a result that is not the patient's, leaves an unfinished one unseen, keeps the first time on a second look, and that the patient cannot set the time directly. Writes nothing |
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

8. **Messages.** With no conversations: the empty screen says your doctors will message you here. After a doctor writes from the website: the conversation shows the doctor's name, the last message and "● 1 new". Open it: the message is marked read (the doctor's side shows it). Type a reply with the keyboard open: the text box stays above the keyboard. The reply appears on the doctor's page; the doctor's next message appears in the chat within a second or two without pulling to refresh (Realtime). Put the app in the background and have the doctor write again: a "New message" push arrives without the message text, and tapping it opens Messages.
9. **Lab results.** The list shows the tests, hospital, date and "New". Open one: every parameter has its value, unit and reference range, and anything outside the range says "▲ High", "▼ Low" or "Outside the normal range" in words. Go back: "New" is gone. (From the build after `8ea2f97c`: it is also gone on the website and on a second phone, and the doctor's Lab Orders page and the hospital's Laboratory page say "Seen by patient on" with today's date.) Share as PDF: the PDF opens in the share sheet and reads correctly.
10. **Airplane mode on Lab results.** Open Lab results once online. Turn on airplane mode, force-stop the app, open it, go to Health → Lab results and open a result: it all shows, with the "Offline · last updated" bar. Same for Medical records.
11. **Medical records.** A timeline with date, doctor, hospital and type; tapping an entry shows the notes or the vitals. Nothing can be edited.
12. **Letters.** List with Issued / Requested / Expired in words; open one; Share as PDF. Tap + (Request a letter): choose a type and a doctor, write the reason, submit. The request appears in the list as "Requested: waiting for your doctor", and the doctor sees it on the website. Submitting with no reason is refused with a message.
13. **Check symptoms.** Home → Check symptoms. About you shows your age; pick a sex; describe a mild problem; answer the questions (one per screen, big buttons). The result says how urgent it is in words and suggests a kind of doctor. Tap Book a doctor: booking opens with that specialty as a chip and the reason filled in. The doctor sees the triage in their panel on the website.
14. **Emergency card.** Start again and describe crushing chest pain going to the left arm with sweating. The red emergency card shows at once, with Call 112 (opens the dialler; do not press call) and Find the nearest hospital (opens Maps).
15. **A video call through the browser.** Book a video visit and have the doctor accept it. In Visits tap Join call: a sheet explains the camera and microphone and shows Join now. Tap it: "Joining…", then the call page opens in the in-app browser, the browser asks for camera and microphone, and the call works both ways. When the doctor joins first, the card says "Your doctor is in the call and waiting for you". Close the browser: you are back in Visits and the visit has refreshed. Then repeat with the app closed: when the doctor joins, a "Your doctor is ready" push arrives; tapping it opens Visits with the Join call sheet already open for that visit.
16. **Health card.** Health shows Allergies and Long-term conditions as "None known". Edit, type an allergy, save: it shows on the card and on the website's Profile page. Clear it: "None known" again.
17. **Rating a visit.** Have a doctor complete a visit. In Visits → Past it shows Rate your visit. Tap it, pick 4 stars, add a comment, submit: the card shows "★★★★☆ (4 of 5)" and Change rating. Change it to 5. In booking, that doctor now shows "5.0 ★ (1 review)"; a doctor nobody has rated shows "New". The website's booking flow shows the same. A completed visit older than 30 days shows no Rate button.

### Medicine reminders

18. Open a valid prescription, tap **Remind me** on a medicine. The times match how often it is taken (for example "Twice daily" → 8:00 am and 8:00 pm; "4 times a day" → 8:00 am, 12:00 pm, 4:00 pm, 8:00 pm; "every 6 hours" → 12:00 am, 6:00 am, 12:00 pm, 6:00 pm). Change one time to two minutes from now. Save. Allow notifications if asked.
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

The fourth-round live check on 13 November (family) created 2 cancelled appointments (one for the test patient, one for the `[E2E]` child), 1 pending letter request, 1 message, 1 triage session, 2 share codes, 2 notifications, and one `[E2E]` child patient row that the hospital keeps after removal. The ids are in `e2e/cleanup.md` under "Mobile app 0.3 live check".

Two runs of the live check on 13 November (third round) created 2 cancelled appointments, 2 pending letter requests, 2 messages, 2 triage sessions and 2 share codes. The ids are in `e2e/cleanup.md` under "Mobile app 0.2 live check".
