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

## Sixth round: 0.5, 16 November

Version 0.5 is tested on the **preview app only** (the APK from the link in the summary). It adds
three native modules (`expo-camera` for the check-in scanner, `react-native-webview` for the
video call and the map, `expo-keep-awake`), so an older build will not open this code. Install
the new APK over the old one; you stay signed in.

### What was checked here (no phone was connected)

- `tsc --noEmit` in `mobile/`: 0 errors. `expo-doctor`: 20 of 20 checks passed.
- Unit tests: 21 suites, 348 tests, all pass (the 280 from 0.4 plus 68 new). New in 0.5:
  `checkin.test.ts` (only our check-in links are accepted, from both the https and
  `healingnet://` forms; queue wording), `care.test.ts` (EDD and LMP, weeks and days, the
  High BP flag, grouping into Upcoming / No date / Done, the reminder times for each kind, the
  60 cap shared with medicines, the lock-screen wording, dropping an alert the server already
  sent), `calendar.test.ts` (the order of the calendar fallbacks, and which addresses the call
  screen may open), `geo.test.ts` (the Nigeria bounds, state names, one address search a second
  with a cache, rounding the patient's position, the Directions link, "Distance unknown" last).
- Website: `tsc -p tsconfig.app.json` 0 errors, `npm run build` passes. The map code is a
  separate file that only loads on pages that show a map.
- Live check (`node scripts/live-check.mjs`): 55 steps, all pass. New: the hospital's check-in
  code as staff, `checkin_lookup`, `self_check_in` (same place on a second scan), the front desk
  seeing it with the app tag and the reason, `my_checkin_status`, `cancel_my_checkin`, `my_care`,
  an `[E2E]` surgery and care item made by staff and ticked by the patient, and
  `bookable_hospitals` near Uyo returning `lat`, `lng` and `distance_km`.
  **The test hospital had no pin, so the check set one in Uyo (5.0377, 7.9128).**

### What could not be checked without a phone

- The camera scanner, the torch, and the calendar fallbacks on a real phone.
- **The video call inside the app.** Daily's page inside an Android WebView has not been run on
  a phone. If it does not work, use "Open in browser instead" (the 0.4 way, still there) and
  say so: the browser can then be made the default again.
- The map inside the app (it loads in a WebView and needs the internet).
- Care reminders ringing at the right time with the app closed.

### Why "Add to calendar" failed in 0.4

Since Expo SDK 58 the function the app called (`createEventInCalendarAsync` imported from
`expo-calendar`) throws an error every time, on every phone; it now has to be imported from
`expo-calendar/legacy`. That is the cause of "We couldn't open your calendar". 0.5 fixes the
import, declares the calendar "insert" request in the Android manifest (needed on Android 11+),
and adds two fallbacks: writing the event straight into your calendar (it asks for calendar
permission then), and sharing a calendar file.

### Phone checklist for 0.5 (about 45 minutes)

You need: the preview app on your phone, and the hospital website open on a computer, signed in
as a hospital admin. A second phone or browser signed in as a doctor helps for the video call.

**1. Scan to check in**

1. Website, as the hospital: Queue, **Check-in QR code**. The hospital's name is above the code.
   Tap **Print poster** and check the A4 page (name, code, 3 steps, "No app? Scan with your
   phone camera"). Leave the code on screen.
2. App: Home, **Check in**. It explains why it needs the camera; allow it. Scan the code on the
   computer screen. Try the torch button.
3. The confirm screen shows the hospital's name, address and city. Type a reason, tap **Check in**.
4. "You're checked in" shows a big queue number and how many people are ahead.
5. Website: the Queue shows you, with "Checked in with app" and your reason.
6. Website: set your status to **Called**. The phone gets "It's your turn"; the app's status
   screen and the Home card say "It's your turn".
7. Scan again: you get the same place, not a second one.
8. Check in a family member: on the confirm screen change "For: Me" to them, check in, and see
   them in the Queue. A locked family member cannot be chosen.
9. Scan a different QR code (any product): "This isn't a HealingNet check-in code."
10. Tap **Type the code instead** and try a wrong code: the database's message is shown.
11. Check in, then **Leave the queue**: it asks first, then you disappear from the Queue.
12. Turn on flight mode and open Check in: it says checking in needs the internet.
13. With the phone's own camera app (not HealingNet), scan the poster: the website opens the
    same confirm screen, with "Open in the app".
14. Hospital admin only: **Reset code**, confirm. The old code now says it is not valid.
15. "Share my records" (Health) still works as before.

**2. Add to calendar**

1. Visits, an upcoming visit, **Add to calendar**. Your calendar app should open with the visit
   filled in. Save it.
2. If no calendar app opens, the app asks for calendar permission and then says "Added to your
   calendar". Tap again: "This is already in your calendar".
3. If you refuse the permission, a share sheet opens with a calendar file.
4. Please tell me which of the three you saw on your phone.

**3. Surgery care plan**

1. Website, as the hospital: Surgery, **Schedule** one for your patient, about 3 days ahead.
   The phone gets "Procedure booked".
2. Click the row (or View). Set the admission time; under Fasting from tap **Use this**; save.
   Tick **Consent form signed**. Write Instructions for the patient and save.
3. Care plan, **Add item**: tap the "Blood test" template, add a date and time about 10 minutes
   from now, leave "Remind the patient" on, add it.
4. App: Home now has a **Care plan** card. Open it: the procedure, admission, "Fasting from…",
   "Consent signed", your instructions and the to-do list are there.
5. Tick the blood test. On the website it shows "Done by patient".
6. Untick it and wait for the time: a reminder arrives. With the screen locked it says only
   "Care plan reminder" (unless "Show details on the lock screen" is on in Settings).
7. Tap **Add to calendar** on the item and on the procedure.
8. On the website change the surgery's date (Edit): the phone gets "Procedure date changed".
9. Website: **Start now**, then **End now**: the duration is worked out and the status moves on.

**4. Maternity**

1. Website: Maternity, **Register ANC** for a patient, then click the row.
2. **Edit**: type the LMP; the EDD fills itself (and the other way round). Save. The header shows
   "Today: … weeks … days".
3. **Record visit**: weeks are filled in from the LMP. Type BP 150/95: it says **High BP** in
   words. Add a weight and a next visit date; save. It offers **Add to care plan?**; accept.
4. Record a second visit: the BP and weight chart appears.
5. **Add standard antenatal schedule**: it says how many visits were added. Tap it again: none
   are added twice.
6. Write a Message for the patient and save.
7. App: Care shows the weeks and days, the due date with a progress bar, the next visit, the
   message, the last visits and the to-do list. Visits say "The hospital will mark this".
8. Website (patient): Care plan in the menu shows the same.

**5. Video call inside the app**

1. Book a video visit and accept it as the doctor. Start the call as the doctor on a computer.
2. App: the "Your doctor is ready" notification, or Visits, **Join call**, **Join now**. Allow the
   camera and microphone when HealingNet asks.
3. Check: both sides see and hear each other; the loudspeaker works; turn the screen off for a
   few seconds and on again and the call is still there.
4. Press the phone's back button: it asks "Leave the call?".
5. **End call** (red): it asks, closes, and Visits refreshes.
6. If the call does not start or you cannot be seen or heard, tap **Open in browser instead**
   and tell me exactly what you saw.

**6. Hospital on the map**

1. Website: sign up a test hospital. Under "Where is your hospital?" search for an address,
   pick a result, then zoom in and drag the pin onto the building. The address, city and state
   fill in. The sign-up button stays off until there is a pin.
2. Try **Use my current location**: it first asks "Are you at the hospital right now?".
3. As that hospital: Settings, move the pin, save. (A hospital without a pin sees a banner on
   every hospital page until it sets one.)
4. As the HealingNet admin: Verifications shows a small map, the address and when the pin was
   set; a hospital without one shows "Warning: no location yet".
5. App, as a patient: Book, **Show how far each one is**, allow location. The list says
   "about 3.2 km away", or "Distance unknown" for a hospital with no pin.
6. Tap **Map**: the blue dot is you, the pins are hospitals. Tap a pin, then **Book here**.
7. Turn on flight mode and tap Map: it says the map needs the internet and shows the list.
8. Visits: an in-person visit at a pinned hospital shows the address and **Directions**
   (opens Google Maps). A video visit shows neither.
9. The same on the website: Book (List / Map) and Appointments (Directions, Show map).

## Fifth round: 0.4, 14 November

Version 0.4 needs a **new development build** (and the preview build): it adds two native
modules, `react-native-mmkv` (with `react-native-nitro-modules`) for the saved data and
`expo-document-picker` for family documents, and the camera and photo permission wording
changed. An older development build will not open this code.

### What was checked here (no phone was connected)

- `tsc --noEmit` in `mobile/`: 0 errors. `expo-doctor`: 20 of 20 checks passed.
- Unit tests: 17 suites, 280 tests, all pass. New in 0.4: `perf.test.ts` (names without ids
  or query strings, batches of 50, the 300 cap, nothing recorded when switched off,
  `log_perf_events` never timed), `visits.test.ts` (no duplicates when "Show older" loads),
  `overview.test.ts` (the card status lines), `verification.test.ts` (every status and its
  wording with the deadline's day and time, documents per relationship against the
  database's table, photo size and type checks, family notifications), the cache tests
  (one entry per query, no signatures saved, the move from the 0.3 blob), and the start-up
  tests (no path reaches the tabs with an incomplete profile, `profile_incomplete` routing).
- Website: `tsc -p tsconfig.app.json` 0 errors, `npm run build` passes.
- Live check (`node scripts/live-check.mjs`): 41 steps, all pass, including the upload of a
  test PDF, `pending` in `my_family`, and removal of the child and the file.

### Speed: what was measured, and what still has to be measured on the phone

Measured from this PC as the test patient (164 visits, 36 prescription documents), median of 5:

| | 0.3 | 0.4 |
| --- | --- | --- |
| Visits data | 4 requests, 81 KB, 1,226 ms | 1 request (`my_visits`), 428 ms |
| Prescriptions data | 37 requests, 256 KB (219 KB of it signature images), 1,483 ms | 1 request (`my_rx_documents`), 36 KB, 424 ms |
| Saved data written when any list refreshes | everything: one 341 KB blob (683 KB once hex-encoded), encrypted in JavaScript | only the list that changed (Visits is about 100 KB), encrypted natively |
| That write, on this PC | 115 ms under Node | not measurable here (native) |

The 115 ms is on a desktop with a JIT compiler. The phone runs the same JavaScript loop
without one, typically many times slower, which fits a freeze of a few seconds, but **that
is an estimate until it is read off the phone**. The tab-switch and cold-start times
themselves (Home to Visits, Home to Health, Visits to Home, cold start) could not be taken
here. To take them:

1. Install the new development build, run `npm start`, open the app and sign in.
2. Switch tabs a few times. Slow events print one line each in the terminal, for example
   `[speed] slow screen /(tabs)/visits 3412 ms on wifi`, and every save of the offline data
   over 50 ms prints `[speed] cache save of appointments, 98 KB, took 12 ms`.
3. For "before" numbers on the same phone: check out commit `0ebcc19` (0.3 behaviour with
   the timer added) in the old development build. It prints the same lines, including
   `[speed] cache save, 683 KB, took … ms` for the old blob.
4. After a day of use the same numbers are on the website at `/admin/performance`.

Targets: tab switch to content under 300 ms with data saved; cold start to Home under 2 s.

### Phone checklist for 0.4 (about 30 minutes)

Tab speed
- [ ] Home → Visits → Health → Home, several times: each feels instant, with no frozen taps.
- [ ] Open Visits, pull to refresh, then tap another tab straight away: the tap is taken at once.
- [ ] Visits → Past → scroll to the end → "Show older visits" loads more, with no visit shown twice.
- [ ] Close the app, turn on flight mode, open it: Home, Visits, Health and Prescriptions still show (the first start after updating from 0.3 too).
- [ ] Sign out, turn on flight mode, sign in is refused and nothing of the old account shows.

Home cards
- [ ] "Your health" sits under the next appointment with four cards: Prescriptions, Lab results, Records, Letters.
- [ ] Each card shows a line of status and a count, and opens its screen.
- [ ] A new lab result shows "1 new result" and a "1 new" badge; opening the result clears it when you return to Home.
- [ ] Switch to a family member: the cards change to theirs, and the heading says whose they are.

Verify a family member with a photo
- [ ] Add a child: the app goes straight to "Verify …". "Later" returns to Home.
- [ ] Home shows the banner "Verify … by <day> to keep managing their care." with a Verify button.
- [ ] Verify lists only the documents for that relationship (a spouse: marriage certificate and affidavit only).
- [ ] Take a photo: a preview shows before sending. "Send for checking" works; the status becomes "Being checked".
- [ ] Choose a PDF over 5 MB: refused with "That file is over 5 MB…".
- [ ] The status shows in words with an icon in the switcher sheet, the Family list and the member's profile.

Admin approves on the website
- [ ] On the website, sign in as an admin → Verifications → Family documents: the document is in the queue with the member's name, date of birth and age, the relationship, the guardian's name, email and phone, the type and when it was sent.
- [ ] "Open the document" shows the photo. Approve.
- [ ] On the phone a notification arrives; tapping it opens Family, and the badge now says "Verified". The Home banner is gone.

A rejection shows the reason
- [ ] Add another member, send a document, and on the website Reject it with "The document is unclear or cut off".
- [ ] On the phone: "Not accepted: The document is unclear or cut off" with "Upload another". The member is locked: choosing them in the switcher opens Verify, and if they were on screen the app says so and shows Me.
- [ ] Remove that member: they go from the list.

A new account must complete its profile
- [ ] Sign up with a new email, confirm from the email link: the app shows "Complete your profile" with "0 of 8 done", not the tabs.
- [ ] Android back does nothing there. Close and reopen the app: still Complete profile. The only way out is Sign out.
- [ ] Sign in to the same account on the website: also Complete profile. `/patient` and `/patient/settings` both lead back to it.
- [ ] Fill it in (try a non-Nigerian phone number: refused). The count goes up as fields are filled; after saving, Home opens.
- [ ] The keyboard never covers the field being typed in or the Save button.

Performance page and the switch
- [ ] Me → Settings shows "Share speed data" (on). Turn it off and on again.
- [ ] After using the app for a few minutes with it on, the website's `/admin/performance` shows rows (a name needs 5 samples to appear). Screens over 0.5 s and requests over 1 s are labelled "Slow". Selecting a row shows the chart per day.

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

The fifth-round live check on 14 November (0.4) created 2 cancelled appointments, 1 pending letter request, 1 message, 1 triage session, 2 share codes, 2 notifications, 1 speed event named `e2e:check`, one withdrawn family document, and one `[E2E]` child patient row that the hospital keeps after removal. The test PDF it uploaded was deleted again. The test patient's profile was already complete, so it was not changed. The ids are in `e2e/cleanup.md` under "Mobile app 0.4 live check".

The fourth-round live check on 13 November (family) created 2 cancelled appointments (one for the test patient, one for the `[E2E]` child), 1 pending letter request, 1 message, 1 triage session, 2 share codes, 2 notifications, and one `[E2E]` child patient row that the hospital keeps after removal. The ids are in `e2e/cleanup.md` under "Mobile app 0.3 live check".

Two runs of the live check on 13 November (third round) created 2 cancelled appointments, 2 pending letter requests, 2 messages, 2 triage sessions and 2 share codes. The ids are in `e2e/cleanup.md` under "Mobile app 0.2 live check".
