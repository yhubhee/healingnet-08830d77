# Doctor Portal — Full Functionality Plan

Make every page in the doctor portal interactive and deployment-ready. Today most pages render lists; this plan adds the actions, dialogs, navigation, and missing pages doctors need to actually work.

## 1. Dashboard (`/doctor`)
- Add **Quick Actions** row: New Prescription, Order Lab Test, Message Patient, View Schedule.
- Make today's appointment rows clickable → opens the new Appointment Detail drawer.
- Add a "Next 7 days" mini calendar strip.
- Add unread-message + pending-lab badges to stat cards.
- Pull verification banner if status ≠ approved.

## 2. Appointments (`/doctor/appointments`)
- Row click → **Appointment Detail Drawer** with patient summary, vitals (latest check-in), reason, history.
- Actions on pending: **Accept / Decline** (with optional note). Accepting writes `status=accepted` and creates a hospital notification.
- Actions on accepted: **Start consultation** (creates an `emr_entries` draft and routes to detail), **Reschedule** (date/time dialog), **Cancel** (with reason).
- Actions on completed: **View notes**.
- Add date-range and search filters; calendar/list toggle.

## 3. My Patients (`/doctor/patients`)
- Row click → **Patient Profile page** `/doctor/patients/:id` with tabs:
  - **Overview** — demographics, allergies, genotype, blood group, last visit.
  - **History** — past appointments + check-ins timeline.
  - **EMR** — entries authored by anyone in shared hospitals; "Add note" opens dialog (uses `emr_entries`).
  - **Prescriptions** — list + "New prescription" dialog.
  - **Lab orders** — list + "Order test" dialog.
  - **Messages** — thread with patient.
- Quick actions on row hover: Message, New Rx, Order Lab.

## 4. Prescriptions (`/doctor/prescriptions`)
- **New Prescription** dialog: patient picker (from my-patients), drug autocomplete from `pharmacy_inventory` of the doctor's hospital(s), dosage, frequency, duration, refills, instructions.
- Row actions: **Renew** (clones with reset refills), **Discontinue** (status=cancelled), **Print** (printable view).
- Status filter tabs (active / completed / cancelled), search by drug or patient.

## 5. Lab Orders (`/doctor/lab-orders`)
- **Order Test** dialog: patient picker, category, test selection (multi), priority, clinical notes → inserts `lab_results` + `lab_result_tests`.
- Row click → **Result Detail** modal showing tests, values, abnormal flags, attachments.
- Actions: **Cancel order** (pending only), **Re-order**, **Message patient about result**.

## 6. Consultations (`/doctor/consultations`) — Care Zone marketplace
- Pending row actions: **Accept** (sets meeting_link if virtual; uses Jitsi URL generated from id), **Decline** (with reason), **Propose new time**.
- Accepted: **Join virtual room** button (opens meeting link), **Complete consultation** (writes summary back).
- Filters: type (virtual/in-person), urgency, status.

## 7. New page: Messages (`/doctor/messages`)
- Two-pane inbox built on `patient_messages` (left: patient threads, right: thread).
- Compose to any of my patients. Realtime via `supabase.channel`.
- Add Messages icon + unread badge to sidebar.

## 8. Profile (`/doctor/profile`)
- Make **Edit** button open an edit dialog: avatar upload (to `doctor-credentials` or new bucket), bio, phone, years_experience, languages.
- Marketplace card becomes editable: toggles + fee inputs (writes to `doctor_marketplace`, upserts row if missing). Locked unless verified.
- Remove the hardcoded fallback (`Adaobi Okonkwo`) — show empty state instead.

## 9. Settings (`/doctor/settings`)
- Already exists; small additions:
  - Per-day fee override (optional) on schedule rows.
  - **Block time / leave** mini-section (writes day rows with `is_available=false`).
  - Validation: end > start; warn if no day enabled.
- No schema change.

## 10. Verification (`/doctor/verification`)
- Keep as is. Surface current status + rejection reason banner on entry.

## 11. Sidebar
- Add **Messages** entry. Show unread badges for Messages, Appointments (pending), Consultations (pending).
- Pull badge counts via realtime subscriptions.

## 12. Cross-cutting
- Shared `PatientPicker`, `DrugPicker`, `LabTestPicker`, `ConfirmDialog` components in `src/components/doctor/`.
- All writes go through React Query mutations with optimistic invalidations; toast on success/error.
- Remove every remaining hardcoded fallback in doctor pages.
- Empty states + loading skeletons on every list.

## Technical Notes
- Routes added: `/doctor/patients/:id`, `/doctor/messages`.
- DB: no schema changes required. Existing tables (`patient_appointments`, `prescriptions`, `lab_results`, `lab_result_tests`, `consultation_requests`, `emr_entries`, `patient_messages`, `doctor_marketplace`, `doctor_availability`, `doctor_settings`) cover everything. RLS already permits these doctor writes via `get_user_doctor_id(auth.uid())`.
- Virtual meeting links: use `https://meet.jit.si/healingnet-{consultationId}` (no key needed) for v1.
- Realtime: enable on `patient_messages`, `patient_appointments`, `consultation_requests` (publication add).
- Print prescription: dedicated route `/doctor/prescriptions/:id/print` with print stylesheet.

## Out of Scope
- Doctor-side billing/payouts.
- Video SDK beyond Jitsi link.
- Push/SMS delivery (in-app + email prefs only; actual SMS not wired).
- Doctor portal mobile-app shell.
