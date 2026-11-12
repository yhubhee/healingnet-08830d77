# HealingNet patient app

The HealingNet app for patients, for Android and iPhone. It is built with Expo (React Native) and TypeScript and talks to the same Supabase project and the same database functions as the website. All business rules and security live in the database; the app only calls what exists.

This is version 0.1. The folder is separate from the website: the website's build, type check and lint ignore `mobile/`.

## Run it

```bash
cd mobile
npm install
cp .env.example .env        # then fill in EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
npm start                   # starts the dev server for a development build
```

The publishable key is the same one as the website's `VITE_SUPABASE_PUBLISHABLE_KEY`. Never put the service-role key in this folder.

The app needs a **development build**, not Expo Go, because push notifications don't work in Expo Go on Android. Make one with `npx eas-cli build --profile development --platform android`, install it on a phone, then run `npm start`.

## Commands

| Command | What it does |
| --- | --- |
| `npm start` | Dev server for a development build |
| `npm test` | Unit tests (jest-expo) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run sync-types` | Copies the website's Supabase types to `shared/database.types.ts` |
| `npx expo-doctor` | Checks dependencies and config |
| `node scripts/live-check.mjs` | Runs the app's data calls against the live project as the test patient |

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

Profiles in `eas.json`: `development` (dev client, APK), `preview` (APK for testers), `production` (store build).

## How the app keeps data safe

- Only the publishable key is in the app. Every read and write goes through the database's own rules.
- The session and the saved (offline) data are encrypted with AES-256; the keys are in the phone's Keychain / Keystore (`lib/encryptedStorage.ts`).
- Only the profile, appointments, prescription documents and the home summary are saved for offline use (`lib/cache.ts`).
- Signing out or deleting the account removes the push registration, the data in memory, the saved data and the session.
- When the app leaves the foreground the screen is covered with the logo. On Android the window is also marked secure, which blanks the app-switcher preview and blocks screenshots (`ANDROID_SECURE_WINDOW` in `lib/lock.tsx`).
- Nothing is logged: no health data, names, phone numbers, tokens or codes. There is no analytics or crash-reporting SDK in 0.1.

## Keeping in step with the website

- `npm run sync-types` after the website's Supabase types change.
- `shared/errors.ts`, `shared/patientProfile.ts`, `shared/pharmacy.ts` and `shared/appointments.ts` are copies of website helpers (each file names its source). If the website's wording changes, change it here too.
- The columns and functions added by the mobile migration are typed by hand in `shared/database.ts` until the website's types are regenerated.

## Not in 0.1

Messages, Lab results, Records, Letters and Check symptoms open the website. Video visits open the website's call page in the in-app browser.
