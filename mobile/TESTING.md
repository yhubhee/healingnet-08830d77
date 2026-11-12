# Testing: HealingNet patient app 0.1

Run on 12 November 2026, on Windows, against the live Supabase project.

## Summary

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` in `mobile/` | Pass, 0 errors |
| `npx expo-doctor` | Pass, 20 of 20 checks, no warnings |
| Unit tests (`npm test`) | Pass, 61 tests in 6 files |
| Android JavaScript bundle (`npx expo export --platform android`) | Pass, every import resolves |
| Website `npx tsc --noEmit -p tsconfig.app.json` | Pass, 0 errors |
| Website `npm run build` | Pass |
| Live data check as the test patient (`node scripts/live-check.mjs`) | Pass, 12 of 12 steps |
| The app on an Android emulator or phone | **Not run** (see below) |
| Push notifications on a real phone | **Not run** (needs Firebase and an Expo account) |
| Installable APK | **Not built** (needs `npx eas-cli login`) |

## What could not be run, and why

**The app has not been opened on an emulator or a phone.** This computer has no Android SDK, emulator, `adb` or Java, and no Expo account is signed in, so there was no way to build or start the app here. The screens are type-checked and bundled, and the data calls behind them were run against the live project, but nobody has yet tapped through the app. Treat every "on a phone" item below as still to do.

**Push on a real device** needs the Firebase project, the FCM key in EAS and the EAS project id (README, steps 3 and 4), plus the `push-worker` function deployed and scheduled.

**The edge functions were not run.** Deno is not installed here and the brief says not to deploy. `push-worker` and `delete-account` follow the `email-worker` pattern and use only the shared helpers, but their first real run will be after Bhee deploys them.

**Account deletion was not run end to end**, because the function is not deployed and it would delete the shared test patient.

## Unit tests

| File | What it covers |
| --- | --- |
| `theme.test.ts` | Light and dark have the same keys; mockup colours; QR on white; System / Light / Dark |
| `appointments.test.ts` | The status wording for every appointment status; cancel and join-call rules; ordering |
| `links.test.ts` | Notification URL → screen mapping; the QR content builder; website hand-off links; links back into the app |
| `cache.test.ts` | What is saved offline; encryption round trip; sign-out clears the cache, also offline |
| `dates.test.ts` | Date and time formatting in Africa/Lagos, around midnight and year end; time slots |
| `shared.test.ts` | Error messages; Nigerian phone and profile checks; prescription labels, prices and the PDF page |

## Live run (D3)

The brief's list, with what was actually checked. "Data" means the same query or database function the screen uses was run against the live project by `scripts/live-check.mjs`, signed in as the test patient. "On a phone" means seen in the app itself.

| Step | Data | On a phone |
| --- | --- | --- |
| Sign in | Pass | Not run |
| Home loads | Pass (157 appointments, 362 unread updates for the test patient) | Not run |
| Book "any available doctor" with `[E2E]` in the reason | Pass | Not run |
| See it in Visits as "Waiting…" | Pass (status `pending`) | Not run |
| Cancel it | Pass (status `cancelled`) | Not run |
| Open a prescription, then airplane mode: the QR still shows | Partly: the document and its code load (36 documents). The offline part is covered only by unit tests of the saved cache | Not run |
| Switch Light / Dark | Unit test of the theme choice only | Not run |
| Settings notification switches save | Pass (saved, read back, put back) | Not run |
| Sign out clears the data | Pass for the session (nothing readable afterwards); the cache clearing is unit tested | Not run |

Also checked against the live project: `register_push_device` refuses a signed-out caller; registering and unregistering a device; role detection; the booking lists; the pharmacy directory; creating a share code.

## To do on a phone once there is a build

1. Sign in with email and password; sign in with Google; forgot password and reset from the emailed link.
2. Sign in as a doctor: the "This app is for patients" screen appears, with working website and sign-out buttons.
3. Home: greeting, next appointment card, Add to calendar, both tiles, prescriptions card, updates, bell count.
4. Book a visit with "Any available doctor" and `[E2E]` in the reason; check the success screen wording.
5. Visits: the booking shows "Waiting for the hospital to confirm"; cancel it; it moves to Past as "Cancelled".
6. Reschedule a visit that has a doctor.
7. Open a prescription, turn on airplane mode, close and reopen the app: the QR, code and medicines still show, with the "Offline · last updated" bar. Book and Send to pharmacy are disabled with a message.
8. Share a prescription as PDF.
9. Switch System / Light / Dark; the QR stays on white in dark mode.
10. Settings → Notifications: each switch saves and survives a restart.
11. Turn on app lock, leave the app for 5 minutes, come back: it asks to unlock.
12. Open the app switcher: the HealingNet cover shows, not health details.
13. Change the profile photo from the camera and from the gallery.
14. Sign out, then check that reopening the app shows Welcome and no old data.
15. Text size: set the phone's font size to largest and check nothing is cut off. Check TalkBack reads every button.
16. After Firebase: receive a push, check the lock-screen text is generic, tap it and land on the right screen.

## Records created in the live project

Listed in `e2e/cleanup.md` under "Mobile app 0.1 live check": one `[E2E]` appointment (booked, then cancelled), the notifications the database sent for it, a default `notification_preferences` row for the test patient, and one share code that expires by itself.
