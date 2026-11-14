# Play Store listing (draft)

Draft text for the Google Play listing. Check every line before you paste it: it must stay
true for the build you upload. Nothing here claims a certification, an approval or a result
that HealingNet has not got.

Website: `https://healingnet-08830d77.vercel.app` (replace with your own domain if you get one
before submitting; the privacy and delete-account links must keep working).

## App name (30 characters at most)

```
HealingNet
```

## Short description (80 characters at most)

```
Book a doctor, see your prescriptions and results, and care for your family.
```

(76 characters.)

## Full description (4,000 characters at most)

```
HealingNet is a patient app for hospitals in Nigeria that use HealingNet. Book a doctor, keep your prescriptions and results on your phone, and look after your family's health care from one account.

WHAT YOU CAN DO

• Book a doctor: choose a hospital, a doctor and a time. The hospital confirms the appointment and the app tells you when it does.
• Video visits: join a video call with your doctor from your phone, at hospitals that offer it.
• Check your symptoms: answer a few questions and see how urgent it may be and what kind of doctor to see. This is guidance, not a diagnosis.
• Prescriptions: see each prescription with its code and QR to show at a pharmacy, and send it to a pharmacy on HealingNet.
• Medicine reminders: set reminders for each medicine and tick them off as you take them.
• Lab results: see every value and which ones are outside the normal range.
• Medical records and letters: read notes from your visits and download letters from your doctor.
• Messages: write to the doctors who are treating you.
• Share your records: show a one-time code at a hospital's front desk. It works once and expires after 15 minutes.

FAMILY PROFILES

Add your children, parents or other family members and manage their care from your own account. Book visits for them, see their prescriptions and results, and keep a health card for each person with allergies, long-term conditions, blood group and an emergency contact. The app always shows who you are acting for. For an adult family member, you confirm that you have their permission.

PRIVATE BY DESIGN

• Notifications on your lock screen do not show health details unless you choose to show them.
• The data saved on your phone for offline use is encrypted, and is cleared when you sign out.
• App lock can ask for your fingerprint, face or passcode.
• You can delete your account in the app at any time.

GOOD TO KNOW

• HealingNet works with hospitals, doctors and pharmacies that have joined HealingNet. You will only see those.
• The app does not replace a doctor. The symptom checker gives guidance only. In an emergency, call 112 or go to the nearest hospital.
• You need an internet connection to book, message and get new results. Your saved appointments, prescriptions and results can be read offline.

Privacy policy: https://healingnet-08830d77.vercel.app/privacy
Delete your account: https://healingnet-08830d77.vercel.app/delete-account
```

## Category

- App category: **Medical**
- Tags: choose from Play Console's list once the app is created (for example "Medical").

## Contact details (placeholders: fill in before submitting)

- Email: `[YOUR SUPPORT EMAIL]` (the website currently shows `support.healingnet@gmail.com`; use it only if you check that inbox)
- Phone: `[YOUR SUPPORT PHONE, optional]`
- Website: `https://healingnet-08830d77.vercel.app`
- Privacy policy URL: `https://healingnet-08830d77.vercel.app/privacy`

Google shows the email publicly on the listing.

## Screenshots: 8 to take from your phone

Use the preview or production build, light theme, with test data only: no real patient's
name or results. Hold the phone upright. Take them with a family member added so the
"For:" chip shows. Play accepts 2 to 8 phone screenshots; PNG or JPEG, each side between
320 and 3,840 pixels, and the long side no more than twice the short side.

| # | Screen | How to get there | What should be showing |
|---|--------|------------------|------------------------|
| 1 | Home | Home tab, "For: Me" | Next appointment card, the two main actions, Family row |
| 2 | Book a doctor, hospital list | Home → Book a doctor | "Booking for" line and a list of hospitals |
| 3 | Book a doctor, check and confirm | Go through to the last step | Hospital, doctor, date and time summary |
| 4 | Check symptoms, result | Home → Check symptoms, finish a check | "How urgent" card and suggested kind of doctor |
| 5 | Prescription with QR | Health → Prescriptions → open one | The code, the QR and the medicines |
| 6 | Lab result | Health → Lab results → open one | Values with one outside the normal range |
| 7 | Family | Tap the "For:" chip on Home | The "Who is this for?" sheet with Me and a family member |
| 8 | Health card | Health tab, with a family member chosen | "For: (name)" chip and their health card |

## Feature graphic (1024 × 500)

- File: `mobile/store/feature-graphic.png`, made from `mobile/store/feature-graphic.svg`.
- Spec: 1024 × 500 pixels, PNG or JPEG, no transparency, 15 MB at most.
- Content: teal background (#186E6A), the name "HealingNet", a coral underline (#EE6C4D), the
  line "Book a doctor and keep your family's health records in one place." and a simple
  drawing of a phone with a health cross and three people. No photos and no other brands.
- To change the words, edit the SVG and run `node scripts/store-assets.mjs` from `mobile/`.

## App icon (512 × 512)

- File: `mobile/store/icon-512.png`, resized from `mobile/assets/icon.png`.
- Spec: 512 × 512 pixels, 32-bit PNG, 1 MB at most. Google rounds the corners itself.
