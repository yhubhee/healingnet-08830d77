# E2E bugs

Pass 1 (first full run): 60 passed, 47 failed. One row per cause.

Pass 2: the full-suite run was stopped by the system for low memory, so pass 2 runs one spec file at a time against one dev server.

| Pass 2 run | Passed | Failed | Notes |
| --- | --- | --- | --- |
| appointment-flow (a) | 7 | 8 | 6 × #19 (mobile), 3 × #20 |
| appointment-flow (b, after #19 and warm-up) | 9 | 6 | All #20: page stuck on "Loading…" or element not there within 15 s |
| appointment-flow (c, 30 s waits) | – | – | Stopped by the system for low memory after 3 tests; no results |
| appointment-flow (d, 30 s waits) | 8 | 7 | All #20. The dev server log showed a full page reload each time Playwright wrote a trace file, and the server then exited with about 95 MB free |
| appointment-flow (e, after the Vite fix) | 13 | 2 | Flows 1–7 incl. 7 (cancel) pass on both sizes. Desktop Flow 1–2: hospital list still loading at 30 s (#20). Desktop Flow 4: #22 |
| doctor | 22 | 1 | Mobile consultation: #23. Re-run after the test fix: passed. New referral test passes on both sizes (#24) |
| patient | 37 | 0 | All pass, desktop and mobile |
| hospital | 41 | 2 | Mobile: #25, #26. Re-run of both after the fixes: passed on desktop and mobile |

Pass 3 (each spec file in turn, one dev server, desktop and mobile; counts include the 3 login setups per run): **all green.**

| Pass 3 run | Passed | Failed |
| --- | --- | --- |
| appointment-flow | 15 | 0 |
| patient | 37 | 0 |
| doctor | 23 | 0 |
| hospital | 43 | 0 |

After #23 (toasts at the top below 640 px), doctor spec on mobile: 12 passed, 1 failed (#28); after the #28 test fix, 13 passed, 0 failed.
"Test" in the Cause column means the test was wrong, not the app.

| # | Role | Page | What happens | Expected | Cause | Fix commit | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | all | login setup | `page.goto("/login")` times out for the first roles | All three logins pass | **Test.** Vite's first cold compile is slower than the 30 s navigation timeout | 7003783 | Fixed (test) |
| 2 | all | every test | `tracing.start: Tracing has been already started` | Tests run | **Test.** Playwright already traces contexts made from `browser`; the fixture started a second trace | 7003783 | Fixed (test) |
| 3 | patient | every patient page on mobile (26 tests) | Mobile shows the login screen; Postgres logs `permission denied for function bookable_hospitals` | Mobile runs signed in | **Test.** The mobile project does load the saved `storageState`, but the desktop sign-out test had signed that saved session out, which revokes it on the server. The sign-out test now uses its own login | 7003783 | Fixed (test) |
| 4 | doctor | `/doctor`, `/doctor/appointments` | Console: "Cannot update a component (`DataErrorBanner`) while rendering a different component" | No console errors | `DataErrorBanner` set state straight from the query-cache listener, which TanStack calls synchronously while another component renders a new query. Now deferred with `notifyManager.batchCalls` | 3d8f813 | Fixed |
| 5 | hospital | `/hospital/referrals` | New Referral returns 400 (`hospital_referrals_referral_type_check`) | Referral is created | `CreateReferralDialog` sent `referral_type: "external"`; now maps to `external_outgoing` like `DoctorReferralDialog` | 38450cf | Fixed |
| 6 | hospital | `/hospital/surgery` | Schedule with no surgeon returns 400 (`surgeon_id` NOT NULL) and the form clears | Clear message before submitting | Patient and Surgeon weren't checked (selects can't be `required`), and the form reset even after a failed save | beece30 | Fixed |
| 7 | patient | (logged-out request) | One `permission denied for table patients` from a logged-out request (about 10:47) | No query on `patients` before the session is ready | Not an app race. With a valid session, `ProtectedRoute` waits for auth and `usePatientProfile` is gated on `!!user`. With the revoked session from #3, supabase-js briefly reported the old user, failed to refresh, and sent the query with only the publishable key. Gone once #3 was fixed; not seen in passes 2 or 3 | 7003783 | Fixed (test) |
| 8 | doctor | `/doctor/appointments` | "Accept" matches 2 buttons (strict mode) | One Accept per card | **Test.** Substring match also hit the card's own button, whose label includes the reason "[E2E] Doctor spec accept". Matches are exact now | f525f1f | Fixed (test) |
| 9 | doctor | appointment drawer | Opened just after accepting, the drawer stays "Pending" (Accept/Decline) and "Join video call" never shows | Drawer shows the current status | The page kept a copy of the clicked row; it now keeps the id and reads the row from the current list | 2f00d1e | Fixed |
| 9b | doctor | Refer dialog (drawer) | Console: missing `key` prop; options read "Dr. undefined undefined (undefined)" with empty values | Doctors listed | `useDoctors` returns flat rows; the dialog read `d.doctors?.id` and friends | f525f1f | Fixed |
| 10 | patient | `/patient/appointments` | No Cancel button on a pending booking | Patient can cancel (brief, flow 7) | There had never been a Cancel action on this page. Decided: build it. Pending and accepted cards now have Cancel with an "are you sure" step; it's a plain status change, which RLS and `guard_patient_appointments` already allow | 8a2b2ec, 842a6d1 | Fixed |
| 11 | doctor | consultation | Lab picker "Send order" stays disabled | Order is sent | **Test.** It checked the first checkbox while the catalog was still loading, which is "Fasting required". It now picks the FBC row | bf0c228 | Fixed (test) |
| 12 | hospital | `/hospital/beds` | Add Ward dialog has no "Beds" field | Ward is added | **Test.** The page has its own Add Ward dialog (name, type, floor) with a plain "Add Ward" button | bf0c228 | Fixed (test) |
| 13 | hospital | `/hospital/doctors` | "Doctor Management" heading not found | Page loads | Flaky in pass 1 only; passed in passes 2 and 3 | | Not reproduced |
| 14 | hospital | `/hospital/settings` | "Staff" tab not found | Staff tab | Flaky in pass 1 only; passed in passes 2 and 3 | | Not reproduced |
| 15a | patient | `/patient/triage` | Stuck on the first yes/no question | Triage finishes | The "No" button's accessible name was "✕No" (decorative glyph not hidden), so screen readers read it out and the test couldn't find "No" | 2720205 | Fixed |
| 15b | patient | `/patient/triage` | Every triage session fails to save (400, `triage_sessions_severity_self_check`); only a console warning | Session saved | `severity_self` was sent as 0; the column allows 1-10 or null. Now null (the interview doesn't collect the rating as a number) | d47788d | Fixed |
| 16 | doctor | patient detail (mobile) | "Letter issued" but not found by title | Letter saved | Flaky in pass 1 only; passed in passes 2 and 3 | | Not reproduced |
| 17 | hospital | `/hospital/patients` | Search after registering finds nothing | Patient found | **Test.** On mobile the first "Search" box is the hidden header search; on desktop the first text match is in the hidden mobile cards | 5b67b82, df9b2eb | Fixed (test) |
| 17b | hospital | `/hospital/patients` | Patients without a birth date show "—y" | "—" | The "y" was added outside `getAge` | 6bafbcb | Fixed |
| 18 | hospital | `/hospital/pharmacy` (mobile) | Page is 6 px wider than 360 px | No horizontal scroll | Dispense + Add Drug sat beside the heading without wrapping; the header now wraps like Billing's | 138cd00 | Fixed |
| 19 | patient | booking (mobile, every flow) | `book()` fails with PGRST116 "Results contain 2 rows" | Booking found | **Test.** The `[E2E]` text was tagged with the run only, so the mobile booking's reason matched the desktop one from the same run. Inside a test the tag now also names the project (`…d` / `…m`) | a8864bf | Fixed (test) |
| 20 | all | pages under test | Page drops back to the full-screen "Loading…" (`PageLoadingFallback`) or an element vanishes; a different handful of tests fails each run | Page stays loaded | **Test setup.** Vite watched `e2e/results`, so every trace file Playwright wrote there made Vite **reload the page under test**. `vite.config.ts` now ignores `e2e/`. Low memory (about 100 to 370 MB free of 4 GB) made it worse, so setup also opens each role's main pages once and the waits are 30 s. The app's checks are unchanged | a8864bf, 4a9a95d | Fixed (test setup); confirmed in pass 3 |
| 21 | patient | `/patient/appointments` | Console: realtime WebSocket handshake got HTTP 520 | No console errors | Supabase's realtime endpoint returned 520 (an upstream/Cloudflare error) once in pass 2; not something the app sends wrong, and not seen in pass 3 | | External |
| 22 | patient | `/patient/book` | `book_appointment` returns 400 and the test never reaches the appointments page | Booking saved | **Test.** The chosen slot was already held by the test doctor (an accepted `[E2E]` booking from an earlier run). The app is right: the picker can't see other patients' bookings, the database refuses the slot, and a toast says "That time was just taken". `book()` now reads the doctor's held times (as the doctor, through RLS) and skips them | 4b01212 | Fixed (test) |
| 23 | doctor | consultation (mobile) | "Submit consultation" can't be tapped: the stacked toasts ("Examination saved", "1 item ordered", "Line added") cover the fixed Submit bar | Submit reachable | Sonner toasts sit bottom-right, over the bottom action bar at 360 px. For a person they clear after a few seconds; in the test they never closed because the pointer rested on them (Sonner pauses on hover). Decided: below 640 px Sonner toasts now show at the top (as the Radix toaster already did), and the test's wait-for-toasts workaround is gone. Doctor spec on mobile passes | 2d55d17 | Fixed |
| 24 | doctor | appointment drawer → Refer | Referral always stops at "Missing required information" | Referral created | `DoctorReferralDialog` took the hospital from `useHospitalId()`, which only returns hospitals where the user is **staff**, so for a doctor it was null. It now gets the appointment's `hospital_id`. RLS already allows it (`can_work_at` includes active doctors, Telemedicine counts as `emr`, and booking links the patient to the hospital), so no migration was needed. New test: refer from an accepted appointment | 5cb9ca9 | Fixed |
| 25 | hospital | `/hospital/beds` (mobile) | Page is 32 px wider than 360 px | No horizontal scroll | Add Ward + Add Bed sat beside the heading without wrapping (same as #18); the header now wraps | e5a6f58 | Fixed |
| 26 | hospital | `/hospital/settings` → Staff (mobile) | "Invited" badge and "Cancel invite" spill past the card's right edge | Inside the card | The card's text column had no `min-w-0`, so a long email pushed the right column out. Text column can shrink, email wraps | 27fd47d | Fixed |
| 27 | hospital | `/hospital/settings` → Staff (mobile) | "Cancel invite" not found | Invite cancelled | **Test.** It took the innermost element containing the email, which on mobile is the email line, not the card. It now takes the element holding both the email and the button | 0130031 | Fixed (test) |
| 28 | doctor | `/doctor/onboarding` (mobile) | "Your profile is complete" not found; the page had moved on to the dashboard | Heading seen | **Test.** The page shows the message for 2.5 s and then redirects (by design). `visit()` waits up to 15 s for the network to settle first, which on the slow machine outlasted it. The test now checks the heading straight after loading | 83a18b6 | Fixed (test) |

## Needs decision

None open. (#10: build the Cancel button. #23: toasts at the top below 640 px. Both done.)

## Found while fixing, not fixed

- **Triage self-rating.** `severity_self` is now saved as null. If the patient's own 1-10 rating is wanted, the scale answer needs keeping as a number (it's currently only kept as text in the evidence).
