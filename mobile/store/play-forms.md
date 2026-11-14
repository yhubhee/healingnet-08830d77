# Google Play forms: draft answers

**CHECK BEFORE SUBMITTING.** These are draft answers for the forms under *Policy → App
content* in Play Console, with the reason for each. Google changes the questions from time
to time, so the wording on screen may differ: answer what is on screen, using the reasons
here. You are responsible for the answers being true. If the app changes, change the forms.

Site used below: `https://healingnet-08830d77.vercel.app`

## 1. Privacy policy

- URL: `https://healingnet-08830d77.vercel.app/privacy`
- Reason: required for any app that handles personal or health data. The page covers the
  app and the website. **Check:** a lawyer should review it first (see the note at the top
  of `src/pages/Privacy.tsx`).

## 2. Data safety

**CHECK BEFORE SUBMITTING.**

Overview questions:

| Question | Draft answer | Reason |
|----------|--------------|--------|
| Does your app collect or share any of the required user data types? | Yes | Accounts and health records are stored on HealingNet's servers. |
| Is all of the user data collected by your app encrypted in transit? | Yes | The app only talks to Supabase and Expo over HTTPS. |
| Do you provide a way for users to request that their data is deleted? | Yes | In the app (Me → Delete my account) and at `/delete-account`. |

"Collected" means it leaves the phone. "Shared" means passed to another company for its
own use. Companies that only process data for HealingNet (Supabase, Expo, Firebase, Daily)
are service providers, which Google does not count as sharing. So the draft answer for
**shared** is **No** for every type. **Check** this against Google's definitions on screen.

Data types collected:

| Data type (Play's name) | Collected | Why (purpose) | Required or optional | Reason |
|-------------------------|-----------|---------------|----------------------|--------|
| Personal info: Name | Yes | App functionality, Account management | Required | Needed for an account and for hospitals to identify the patient. Family members' names too. |
| Personal info: Email address | Yes | App functionality, Account management | Required | Sign-in and account emails. |
| Personal info: Phone number | Yes | App functionality | Required | Hospitals contact the patient. |
| Personal info: Address | Yes | App functionality | Required | Part of the patient profile hospitals need. |
| Personal info: Other info (date of birth, sex) | Yes | App functionality | Required | Needed for care and for the symptom checker. |
| Personal info: User IDs | Yes | App functionality, Account management | Required | The account and patient ids. |
| Health and fitness: Health info | Yes | App functionality | Required | Appointments, prescriptions, lab results, records, letters, symptom checks, allergies, conditions. This is the purpose of the app. |
| Location: Approximate location | Yes | App functionality | Optional | Only if the user allows it: to show how far hospitals are, and saved with a symptom check. |
| Location: Precise location | **Check** | App functionality | Optional | The app asks for "while in use" location. If the build requests fine location, answer Yes here as well. Look at the permissions list Play shows for the uploaded bundle. |
| Messages: Other in-app messages | Yes | App functionality | Optional | Messages between patient and doctor. |
| Photos and videos: Photos | Yes | App functionality | Optional | A profile picture, only if the user adds one. |
| App activity: Other user-generated content | Yes | App functionality | Optional | Ratings and comments on visits and pharmacies. |
| Device or other IDs | Yes | App functionality | Optional | The push notification token, only if notifications are allowed. |

Not collected (draft): financial info (patients do not pay in the app), contacts, calendar
(the app only *writes* an appointment to the calendar when asked; it does not read or
upload it), audio and video recordings (video calls are live, in the browser, and not
recorded by the app), files, web browsing, app performance and crash data (no analytics or
crash SDK is in the app). **Check** this last one if you ever add analytics.

For each collected type Play also asks:

- Is it processed ephemerally? **No** (it is stored).
- Can users choose whether it is collected? Use the Required/Optional column.

Not sent from the phone at all (so not "collected"): medicine reminders and the encrypted
offline copy.

## 3. Health apps declaration

**CHECK BEFORE SUBMITTING.**

- Does the app have health features? **Yes.**
- Draft categories to tick (choose the closest on screen):
  - *Medical → Healthcare services and management* (booking, records, prescriptions).
  - *Medical → Clinical decision support / symptom checking*, if listed. Reason: the
    symptom checker gives triage guidance. It does not diagnose and says so on screen.
  - *Medical → Medication and treatment management* (prescriptions, medicine reminders).
  - *Telehealth*, if listed (video visits with a doctor).
- Is the app a regulated medical device? Draft answer: **No / not registered as one.**
  Reason: HealingNet has no medical-device registration. **Check with your lawyer** whether
  the symptom checker needs one under NAFDAC rules; do not tick anything that says the app
  is approved or certified.
- Health Connect: **not used.**

## 4. Target audience and content

**CHECK BEFORE SUBMITTING.**

- Target age group: **18 and over** only.
- Reason: the account holder is an adult. Children's data is entered and managed by a
  parent or guardian through family profiles. Children do not sign in.
- "Could your store listing unintentionally appeal to children?" **No.** The listing and
  feature graphic show a phone, a health cross and plain figures; nothing aimed at children.
- Because the app is not aimed at children, the Families policy forms do not apply. Do not
  tick any age group under 18.

## 5. Content rating (IARC questionnaire)

**CHECK BEFORE SUBMITTING.**

- Category: choose **Utility, Productivity, Communication or Other** (not a game).
- Violence, sexual content, bad language, drugs, gambling: **No** to all.
  - Note on "drugs": the app shows prescribed medicines. That is medical reference, not
    promotion of drug use. If a question asks about references to medicines, answer
    truthfully that it shows prescription medicines for medical use.
- Does the app let users interact or exchange content? **Yes**, messages between a patient
  and their own doctor. It is not public or user-to-user chat between strangers.
- Does the app share the user's location with other users? **No.** Location, if allowed, is
  saved with a symptom check for the treating doctor; it is not shown to other patients.
- Does the app allow purchases? **No.**
- Expected result: a low age rating. The 18+ target audience above is set separately.

## 6. Account deletion

- Account deletion URL: `https://healingnet-08830d77.vercel.app/delete-account`
- In-app path to state: **Me → Delete my account**.
- What to say is deleted: login, contact details, devices, notifications; open
  appointments are cancelled; family members are removed.
- What to say is kept: medical records held by hospitals that treated the patient or a
  family member, which hospitals must keep; they are no longer linked to an account.
- Does the app let users delete some data without deleting the account? Draft: **Yes**:
  a family member can be removed in Me → Family. **Check** how the question is worded.

## 7. Other App content items

| Item | Draft answer | Reason |
|------|--------------|--------|
| Ads | No ads | The app shows none. |
| App access | All or some functionality is restricted | Sign-in is needed. Give Google a test patient account (email and password) that already has an appointment, a prescription and a lab result, and say that hospital approval is not needed to look around. |
| Government apps | No | |
| Financial features | None | Patients do not pay in the app. |
| News apps | No | |
| Advertising ID | No | No ads or analytics SDK. **Check** the merged manifest Play shows; if `AD_ID` appears, a library added it and the answer changes. |
