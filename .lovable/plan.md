# Fix batch: payments, header/search, mobile, email, dropdown contrast

## 1. Notification dropdown contrast (hospital header)

The dropdown items highlight with the cyan accent while keeping light text, so hovered notification text is unreadable. Force dark foreground on hover/focus for the notification items in the hospital header dropdown (accent background + near-black text), and apply the same to the doctor and patient header dropdowns so all three match.

## 2. Hospital header: real identity + working search

- Replace the hardcoded "Hospital Admin" / "Admin" with the signed-in staff member's name and role, plus the hospital name, read from the existing hospital staff record.
- Make the search box functional: typing shows a results panel with matching patients, doctors, and lab orders for the current hospital; selecting a result navigates to that record. Debounced, minimum 2 characters, empty-state and loading states included.

## 3. Payments actually collect

Currently pharmacy dispensing and hospital billing just record a status; nothing is charged. The consultation payments table was never created in the database (the old SQL file was never applied), which is why it is missing from generated types.

- Create the payments table properly (payment for a consultation, bill, or dispense: amount, reference, status, timestamps) with access rules so a patient sees only their own payments and hospital staff see their hospital's.
- Move Paystack to the backend. The secret key is currently exposed in the frontend env file — that is a live security hole. Two backend endpoints: one to start a payment (returns a checkout link), one to verify a payment by reference and mark the related bill/dispense/consultation paid.
- Wire the UI: a "Collect payment" action on pending bills and on drug dispensing that opens Paystack checkout and, on return, verifies and flips the record to paid.

Note: this needs the Paystack secret key stored as a backend secret, and the exposed key in the env file should be rotated in the Paystack dashboard afterwards.

## 4. Gmail SMTP for outgoing email

Instead of setting up a sender domain, send through your Gmail account using an app password.

- Store the Gmail address and app password as backend secrets.
- Add one backend email function that connects to Gmail SMTP and sends a branded HTML email.
- Hook it into the notification triggers that already exist, respecting each user's saved email preferences (lab results ready, appointment updates, letters, prescriptions, billing).

Limits to be aware of: Gmail caps at roughly 500 emails/day, the From address will be your Gmail address, and deliverability is weaker than a verified domain. Auth emails (signup/reset) will keep using the built-in sender — Gmail SMTP only covers app notifications.

## 5. Mobile layout at ~820px

Hospital tables and dashboards overflow. Fix by converting the wide tables (patients, billing, pharmacy, lab, queue) to a card list below the medium breakpoint, tightening dashboard stat grids to 2 columns, and making page headers with action buttons wrap instead of overflow.

## Already resolved

The doctor notifications page already uses the per-user inbox with per-user read/dismiss — it no longer touches hospital-wide notifications. No change needed there.

## Technical notes

- Dropdown fix: override `focus:bg-accent` pairing with an explicit `focus:text-accent-foreground` (or a dark token) on the notification items in `HospitalHeader.tsx`, `PatientHeader.tsx`, and the doctor header.
- Header identity: reuse `useHospitalId` plus a new query on `hospital_staff` filtered by `auth.uid()`.
- Search: single hook running three parallel scoped queries against `patients`, `doctors`, `lab_results`.
- Payments: new `payments` table with GRANTs + RLS; edge functions `paystack-initialize` and `paystack-verify` reading `PAYSTACK_SECRET_KEY` from secrets; remove `VITE_PAYSTACK_SECRET_KEY` usage from `src/services/paystack.ts`.
- Email: edge function `send-email` using `denomailer` against `smtp.gmail.com:465` with `GMAIL_USER` / `GMAIL_APP_PASSWORD` secrets; invoked from the notification emit path.
- Mobile: responsive card fallbacks in the hospital page tables; no data-layer changes.
