# Putting HealingNet on Google Play: step by step

For someone who has never done it. Do the steps in order. The slow part is step 5: Google
asks a new personal developer account to run a closed test with at least 12 testers for 14
days before it can publish. So the aim is to start that clock as soon as version 0.3 has
been tested.

Play Console's screens change. If a button has a slightly different name, look for the
closest one. Files to have open: `listing.md` and `play-forms.md` in this folder.

## Before you start: decide the package name

The package name is the app's permanent id on Play. It is `com.healingnet.app` in
`mobile/app.json` today. **The first upload locks it for ever.** If you want a different
one, change it before the first production build, and tell whoever builds, because two
other things must change with it:

- Firebase: add the new package to the Firebase project and download a new
  `google-services.json`, or push notifications stop working.
- EAS: a new package gets a new signing key.

Do not start a production build until this is decided.

## 1. Create a Google Play developer account

1. Go to `https://play.google.com/console/signup` and sign in with the Google account that
   should own the app. Use one you will keep; turn on 2-step verification.
2. Choose the account type:
   - **Personal**: quickest. Google checks your identity (ID document) and your address.
     New personal accounts must run the closed test in step 5 before publishing.
   - **Organisation**: for a registered company. You need a **D-U-N-S number** for the
     company (free from Dun & Bradstreet, but it can take weeks), the company's legal name
     and address exactly as on the D-U-N-S record, a company website, and a work email and
     phone. Health apps are often expected to come from an organisation: read what Play
     says for the Medical category when you create the app, and choose accordingly.
3. Pay the registration fee: **US$25, once**.
4. Finish identity verification. Google may take a few days. You cannot publish until it
   is done.

## 2. Create the app and fill in the listing

1. In Play Console: **Create app**.
   - App name: `HealingNet`. Default language: English. App or game: **App**.
     Free or paid: **Free**.
   - Accept the declarations.
2. **Grow → Store presence → Main store listing**: paste from `listing.md`:
   - Short description and full description.
   - App icon: `icon-512.png`. Feature graphic: `feature-graphic.png`.
   - Phone screenshots: the 8 listed in `listing.md`, taken from your phone.
3. **Store settings**: category **Medical**; your contact email (shown publicly), and the
   website.
4. **Policy → App content**: work down the list using `play-forms.md`: privacy policy,
   app access (give a test account), ads, content rating, target audience, data safety,
   health apps, account deletion. Every item must show as done before a release can go out.

Have the privacy policy reviewed by a lawyer before you submit (note at the top of
`src/pages/Privacy.tsx`), and make sure the website with `/privacy` and `/delete-account`
is live at the address you give.

## 3. Build the app bundle (AAB)

Only after the package name is final. On the PC:

```
cd mobile
npx eas-cli build --profile production --platform android
```

- This makes an `.aab` file (an Android App Bundle), which is what Play wants. The APKs
  you install by hand for testing cannot be uploaded.
- EAS raises the version code by itself each time (`autoIncrement`).
- When the build finishes, download the `.aab` from the build page on expo.dev.
- The first time, let EAS create and keep the signing key (the upload key). Do not lose
  access to the Expo account: that key signs every later update.

## 4. Upload to a closed testing track and add testers

1. **Testing → Closed testing**. Use the default track ("Closed testing - Alpha") or
   create one.
2. **Create new release**. If asked about Play App Signing, accept it (Google keeps the
   app signing key; EAS keeps the upload key).
3. Upload the `.aab`. Give the release a name (for example `0.3.0`) and short notes.
4. **Testers** tab: create an email list and add **at least 12** Google account emails
   (add a few more than 12, in case some drop out). These must be the Google accounts the
   testers use on their phones.
5. **Countries/regions**: add Nigeria (and anywhere else your testers are).
6. **Review and roll out**. Google reviews the first release; this can take from a few
   hours to several days.
7. When it is approved, copy the **opt-in link** from the Testers tab ("Join on the web"
   or "Join on Android") and send it to the testers.

## 5. Testers opt in and keep it installed for 14 days

1. Each tester opens the link on their phone, signed in with the email you added, taps
   **Become a tester**, then installs HealingNet from Play.
2. At least **12 testers must be opted in for 14 days in a row**. If someone leaves and
   the count drops below 12, the count of days can stop. Ask them to keep it installed and
   open it now and then.
3. Play Console's Dashboard shows the count of testers and days. Check it every few days.
4. Collect what testers say, and fix what matters. To send a fix: build again (step 3) and
   create a new release on the same closed track. This does not restart the 14 days.

## 6. Apply for production access

1. After the 14 days, the Dashboard shows **Apply for production**.
2. Answer the questions truthfully: how you found testers, what they told you, what you
   changed, and why the app is ready. Short, plain answers are fine.
3. Google reviews the application (usually about a week or less).
4. When it is granted: **Production → Create new release**, add the `.aab` (you can
   promote the tested one from the closed track), choose countries, and roll out. Start
   with a small percentage if you want to be careful.

(Organisation accounts do not have the 12-tester rule, but a short closed test is still a
good idea.)

## 7. Optional, later: upload from the command line with `eas submit`

Once the app exists on Play and the first release was uploaded by hand:

1. In Google Cloud, create a service account, give it access in Play Console
   (**Users and permissions → Invite**, with release permissions for this app), and
   download its JSON key. Keep the key out of git.
2. Give the key to EAS (`npx eas-cli credentials`, Android, Google Service Account).
3. Then a build can be sent straight to a track:

```
npx eas-cli submit --platform android --profile production
```

The `submit.production` block in `mobile/eas.json` is where the track is set (for example
`"track": "internal"` or `"alpha"`). It is empty today.

## Things only you can do, in order

1. Decide the package name.
2. Decide personal or organisation account (start the D-U-N-S request now if organisation).
3. Have the privacy policy reviewed; fill in the support email.
4. Create the account, pay US$25, verify identity.
5. Test 0.3 on your phone; take the 8 screenshots.
6. Create the app, fill the listing and the App content forms.
7. Ask for the production build; upload it to closed testing.
8. Recruit 12 or more testers and send the opt-in link.
9. After 14 days, apply for production.
