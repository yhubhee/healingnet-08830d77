# Fix realtime crash, notification gaps, and add shared report/PDF layer

## 1. Realtime subscription crash (blank hospital dashboard)

Confirmed cause: **both** issues you listed are present.

- `useRealtimeNotifications` in `useHospitalData.ts` uses a hardcoded channel name `"realtime-notifications"` and is called from four places at once — `HospitalHeader`, `hospital/Dashboard`, `hospital/Notifications`, and `useUnreadNotificationCount`. Two mounted at the same time collide on the same channel name, and the second `.on()` lands on an already-subscribed channel.
- The same pattern exists for the other hardcoded channels in that file (`realtime-checkins`, `realtime-emr`, `realtime-beds`) and for `user-notifications-rt` in `useUserNotifications.ts` (PatientHeader + Notifications page mount together).

Fix: give every channel instance a unique name (`realtime-notifications-${useId()}`), keep all `.on()` calls before `.subscribe()` inside the `useEffect`, and always `supabase.removeChannel(channel)` in cleanup. No changes to query keys, data shape, or any other logic. I'll paste the corrected `useRealtimeNotifications` for review.

## 2. Notification 404s

The DB triggers deep-link some notifications to `/patient/dashboard`, which is not a route (the real one is `/patient`). Bills and "it's your turn" alerts therefore 404. Fix by correcting the `action_url` values in the trigger functions via a migration, plus a defensive redirect route so old rows still work.

## 3. Doctor notification bell

`DoctorLayout` has no header at all — only a mobile menu bar — so there is no bell anywhere in the doctor portal (the sidebar link exists). Add a `DoctorHeader` matching `PatientHeader`: unread badge, dropdown of recent items, deep links, "View all", readable hover contrast.

## 4. Reports on patient and doctor sides

Today only the hospital can print a lab report; patients only get a PDF if staff explicitly clicked "Save and generate report", and doctors get nothing.

- Extract the existing report/PDF builder into one shared module (`src/lib/reports/`) so hospital, doctor and patient render identical documents.
- **Lab**: add "View / Download report" on `patient/LabResults` and `doctor/LabOrders`, generated on demand from `lab_result_tests` + `lab_result_parameters` (no dependency on a letter row existing).
- **Prescription report**: new prescription document (hospital letterhead, patient block, prescriber block, drug/dosage/frequency/duration table, notes, signature line) with download buttons on `doctor/Prescriptions`, `patient/Prescriptions`, and hospital pharmacy dispensing.

## 5. Codebase gap analysis

Run an AI-assisted pass over the app for incomplete builds and improvements, delivered as a written report in chat (no code changes from this step alone): unfinished flows, dead buttons, pages that fetch but never mutate, missing empty/loading/error states, mobile overflow, and remaining hardcoded values.

## Technical notes

- Files touched: `src/hooks/useHospitalData.ts`, `src/hooks/useUserNotifications.ts`, new `src/components/doctor/DoctorHeader.tsx` + `src/layouts/DoctorLayout.tsx`, new `src/lib/reports/{lab,prescription}.ts`, `src/pages/patient/LabResults.tsx`, `src/pages/patient/Prescriptions.tsx`, `src/pages/doctor/LabOrders.tsx`, `src/pages/doctor/Prescriptions.tsx`, `src/App.tsx`.
- One migration: correct `action_url` strings inside the existing notification trigger functions.
- Report rendering reuses `jspdf` (already installed) for downloads and the existing print HTML for print.
