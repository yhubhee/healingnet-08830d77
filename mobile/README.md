# HealingNet patient app

The HealingNet app for patients, for Android and iPhone. It is built with Expo (React Native) and TypeScript and talks to the same Supabase project and the same database functions as the website. All business rules and security live in the database; the app only calls what exists.

This is version 0.3. The folder is separate from the website: the website's build, type check and lint ignore `mobile/`.

## Run it

```bash
cd mobile
npm install
cp .env.example .env        # then fill in EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
npm start                   # starts the dev server for a development build
```

The publishable key is the same one as the website's `VITE_SUPABASE_PUBLISHABLE_KEY`. Never put the service-role key in this folder.

The app needs a **development build**, not Expo Go, because push notifications don't work in Expo Go on Android. Make one with `npx eas-cli build --profile development --platform android`, install it on a phone, then run `npm start`.

## Daily workflow (development build)

With a development build on the phone, code changes show on the phone in seconds. No new
APK is needed for ordinary changes.

**Once: install the development build.** Open the build link on the phone and install the
APK. It uses the same package name as the preview app (`com.healingnet.app`), so it
**replaces the preview app** on that phone; the two cannot be installed side by side. A
separate "HealingNet (dev)" app was not set up, because a second package name would need
its own entry in Firebase (or push stops working) and its own signing key. To go back to
the preview app, install the preview APK over it.

**Every day:**

1. On the PC: `cd mobile`, then `npx expo start --dev-client`.
2. Phone and PC on the **same Wi-Fi**. Open the HealingNet development app and scan the QR
   code shown in the terminal. If the network blocks it (the app cannot find the PC), stop
   and run `npx expo start --dev-client --tunnel` instead, then scan again.
3. Change code and save: the phone updates in seconds. Press `r` in the terminal to reload
   the app fully.

**When a new development build is needed:** only when a native library is added or
changed (a new `expo-*` or `react-native-*` package, or a change to `plugins`, permissions,
the icon or the package name in `app.json` / `app.config.js`). Changes to screens, wording,
logic and data calls never need one. Make one with
`npx eas-cli build --profile development --platform android --non-interactive`.

**Memory:** this PC is short on memory. Close Chrome and other heavy apps while Metro (the
dev server) runs. If Metro stops with an out-of-memory error, close more apps and start it
again with `npx expo start --dev-client --clear`.

The development build does not show how fast the real app is: it is slower to start and
loads code from the PC. Judge speed and size on a preview build.

## Commands

| Command | What it does |
| --- | --- |
| `npm start` | Dev server for a development build |
| `npm test` | Unit tests (jest-expo) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run sync-types` | Copies the website's Supabase types to `shared/database.types.ts` |
| `npx expo-doctor` | Checks dependencies and config |
| `node scripts/live-check.mjs` | Runs the app's data calls against the live project as the test patient |
| `node scripts/store-assets.mjs` | Rebuilds the Play Store feature graphic and 512 px icon in `store/` |

## Folders

| Folder | What is in it |
| --- | --- |
| `app/` | Screens (Expo Router). `(auth)/` is sign-in, `(tabs)/` is Home, Visits, Health, Messages, Me |
| `components/` | Buttons, cards, form fields, sheets, the page frame |
| `lib/` | Supabase client, encrypted storage, saved (offline) data, session, push, app lock, data hooks |
| `shared/` | Pure helpers copied from the website: dates, error messages, status wording, links, types |
| `theme/` | Colour tokens (light and dark), fonts, spacing |
| `scripts/` | `sync-types.mjs`, `live-check.mjs` |
| `__tests__/` | Unit tests |

## Setup steps for Bhee

Do these in order. Steps 3 and 4 are needed before push notifications can be tested on a phone.

### 1. Fill in `mobile/.env`

Copy `.env.example` to `.env` and paste the publishable key (the website's `VITE_SUPABASE_PUBLISHABLE_KEY`).

### 2. Add the app's link to Supabase

Supabase dashboard → Authentication → URL Configuration → Redirect URLs → add:

```
healingnet://**
```

Google sign-in, email confirmation and password reset all return to the app through this link.

### 3. Firebase (Android push)

Android push goes through Firebase Cloud Messaging. It is free.

1. Go to <https://console.firebase.google.com> and create a project (for example "HealingNet"). You can turn Google Analytics off.
2. In the project, choose **Add app → Android**.
3. Android package name: `com.healingnet.app` (it must match exactly). Skip the nickname and SHA-1.
4. Download `google-services.json` and put it in `mobile/` (next to `app.json`). It is not secret, but it is in `.gitignore`; don't commit it.
5. Skip the "Add Firebase SDK" steps; Expo does that.
6. Still in Firebase: **Project settings → Service accounts → Generate new private key**. A JSON file downloads. This one **is** secret: don't put it in the repo.
7. Give that key to Expo: run `npx eas-cli credentials` in `mobile/`, choose **Android → production (or preview) → Google Service Account → Manage your Google Service Account Key for Push Notifications (FCM V1) → Upload a new service account key**, and pick the file from step 6. You can also upload it on expo.dev under the project's **Credentials**.
8. Delete the downloaded key file from your computer once it is uploaded.

iPhone push needs an Apple Developer account; EAS sets it up when the first iPhone build is made.

### 4. Expo account and the EAS project

```bash
cd mobile
npx eas-cli login           # your own Expo account; type the password yourself
npx eas-cli init            # creates the project and writes its id into app.json
```

Commit the `extra.eas.projectId` that `eas init` adds to `app.json`. Push notifications need it.

### 5. Deploy the two edge functions

```bash
npx supabase functions deploy push-worker
npx supabase functions deploy delete-account
```

`push-worker` uses the same `INTERNAL_FUNCTION_SECRET` as `email-worker`. `delete-account` uses the service-role key that Supabase already gives every function.

### 6. Schedule the jobs

Run `mobile-cron-setup.sql` in the Supabase SQL editor. It schedules `push-worker` every minute and the appointment reminders.

### 7. Confirm the package name

`com.healingnet.app` is set for Android (`android.package`) and iPhone (`ios.bundleIdentifier`) in `app.json`. It can never change once the app is on the Play Store.

## Build an installable Android app

```bash
cd mobile
npx eas-cli build --profile preview --platform android
```

This makes an APK you can install directly. Free EAS builds can wait in a queue.

EAS uploads the files listed by the repo's root `.easignore`. That file sends only `mobile/`, and it includes `mobile/.env` and `mobile/google-services.json` (which git ignores) so the build has the Supabase address, the publishable key and the Firebase config. Neither file holds a secret.

Profiles in `eas.json`: `development` (dev client, APK), `preview` (APK for testers), `production` (an AAB for the Play Store; see `store/PLAY_STORE_GUIDE.md` and do not build it until the package name is final).

## How the app keeps data safe

- Only the publishable key is in the app. Every read and write goes through the database's own rules.
- The session and the saved (offline) data are encrypted with AES-256; the keys are in the phone's Keychain / Keystore (`lib/encryptedStorage.ts`).
- Only the profile, appointments, prescription documents, the home summary, lab results and medical records are saved for offline use (`lib/cache.ts`). Medicine reminders are kept in the same encrypted storage.
- Signing out or deleting the account removes the medicine reminders, the push registration, the data in memory, the saved data and the session.
- When the app leaves the foreground the screen is covered with the logo. On Android the window is also marked secure, which blanks the app-switcher preview and blocks screenshots (`ANDROID_SECURE_WINDOW` in `lib/lock.tsx`). The one exception is the prescription screen: screenshots are allowed while it is open, so a patient can send the QR to family.
- Nothing is logged: no health data, names, phone numbers, tokens or codes. There is no analytics or crash-reporting SDK.

## Keeping in step with the website

- `npm run sync-types` after the website's Supabase types change.
- `shared/errors.ts`, `shared/patientProfile.ts`, `shared/pharmacy.ts`, `shared/appointments.ts` and `shared/triage.ts` are copies of website helpers (each file names its source). If the website's wording changes, change it here too.

## What 0.2 added

- Every "open the website" hand-off is now a screen in the app: Messages, Lab results, Medical records, Letters and Check symptoms.
- Medicine reminders (`shared/reminders.ts`, `lib/reminders.ts`): local notifications only. Nothing about them is sent to the server. At most 60 are scheduled at a time, and the list is topped up whenever the app opens.
- Allergies and long-term conditions on the health card, and "Rate your visit".
- Video visits still open the website's call page in the in-app browser. A native video SDK would add tens of MB to the app.

## What 0.3 added

- **Family profiles.** One active person, "Me" or a family member (`lib/activePerson.ts`, `shared/activePerson.ts`), chosen from the "For: Me ▾" chip (`components/PersonSwitcher.tsx`). `usePatient()` in `lib/session.tsx` returns the active person, so every list read by patient id follows the choice, and every per-person query key carries that id (`shared/keys.ts`). Booking and share codes send `p_patient_id` only for a family member (`forPerson` in `shared/family.ts`).
- **Me → Family** (`app/family/`): list, add (with the permission tick for adults), a member's health card, and remove.
- Medicine reminders belong to a person; notifications about a family member switch to them before opening.
- The same on the website: `src/hooks/useFamily.ts`, `src/components/patient/PersonSwitcher.tsx` and `FamilySection.tsx`.
- Play Store preparation in `store/`.

## Start-up and speed

- The first screen is chosen from what is stored on the phone (`lib/boot.ts`, `shared/startup.ts`): a stored session opens the tabs at once, behind the native splash. The token refresh and the role and profile checks run afterwards and only move the person when they find a real problem.
- Long lists are FlatLists with memoised rows (`ListScreen` in `components/Screen.tsx`). Tabs stay mounted and freeze while hidden. Realtime is subscribed only while a screen is in front.
- Icons are imported one by one through `components/icons.ts`. Importing from the top of `lucide-react-native` packs all of its icons into the app; add a line to that file to use a new icon.

## App size

- Release builds are minified and resource-shrunk (`app.config.js`, expo-build-properties).
- The `preview` profile builds an APK for real phones only (arm64-v8a and armeabi-v7a) with its native libraries compressed; `production` builds an app bundle (AAB) for the Play Store, which sends each phone only its own processor's code.
