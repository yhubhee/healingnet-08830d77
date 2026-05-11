
## Goal
Make every page in the Patient and Doctor portals visually complete using hardcoded mock data, so you can review the UI/UX before wiring real data. Also add a verification step for doctors who sign up directly (without being added by a hospital).

## Part 1 — Patient Portal Pages (hardcoded UI)

All pages use the existing `PatientLayout` (sidebar + header). Each gets a polished UI with mock data inline (no DB calls for now — current `usePatientData` hooks will be bypassed with local arrays).

| Page | Contents |
|---|---|
| `/patient` Dashboard | Greeting, 4 stat cards, next appointment card, active prescriptions list, recent lab result, health tips |
| `/patient/appointments` | Tabs (Upcoming / Past / Cancelled), appointment cards with doctor, hospital, date, status badge, "Book new" CTA |
| `/patient/prescriptions` | Active vs Completed tabs, drug card (name, dosage, frequency, refills left, prescriber, refill button) |
| `/patient/lab-results` | Result cards grouped by date, normal/abnormal badges, "View details" expanding panel with test rows |
| `/patient/medical-records` | Timeline of EMR entries (consultation notes, diagnoses, vitals, immunizations) with type icons |
| `/patient/messages` | Two-pane chat: doctor list left, conversation right, message composer |
| `/patient/profile` | Personal info card, medical info (blood group, genotype AA/AS/SS, allergies), emergency contact, insurance/NHIS |
| `/patient/settings` | Notification toggles, privacy, language, password change |

## Part 2 — Doctor Portal Pages (hardcoded UI)

Uses existing `DoctorLayout`.

| Page | Contents |
|---|---|
| `/doctor` Dashboard | Greeting, 4 KPI cards, today's schedule list, pending consult requests, recent patients |
| `/doctor/appointments` | Calendar-ish list, accept/decline/start consult actions, filter by status |
| `/doctor/patients` | Searchable patient list with last visit, condition tags; click → mini profile drawer |
| `/doctor/prescriptions` | List of issued Rx, "New prescription" button opens form dialog |
| `/doctor/lab-orders` | Pending vs Completed tabs, order rows with results when ready |
| `/doctor/consultations` | External/marketplace consult requests, accept + add meeting link |
| `/doctor/profile` | Editable bio, specialty, fees, availability toggle, marketplace settings, **verification status badge** |

## Part 3 — Doctor Verification Flow (self-signup)

Problem: doctors added by a hospital are implicitly trusted. A doctor who self-signs-up has no employer vouching for them, so we must collect credentials before they can access patient data or appear in the marketplace.

### UX flow
1. Doctor signs up → lands on `/doctor` dashboard.
2. If `verification_status !== 'approved'`, show a full-width **VerificationGate** banner/screen blocking access to clinical pages, with a "Submit credentials" CTA.
3. CTA opens `/doctor/verification` form with fields:
   - Medical license number + issuing council (e.g., MDCN)
   - License expiry date
   - Specialty + years of experience
   - Current/last hospital of practice (name, city, role, dates)
   - Document uploads: medical certificate, license card, government ID, passport photo
   - Optional: 1 professional reference (name, hospital, phone)
4. On submit → status becomes `pending_review`. Banner changes to "Under review — typically 24–48h".
5. Admin (hospital admin role) reviews via a new `/hospital/doctor-verifications` page (out of scope for this round if you prefer — say so and I'll defer).

### Status states
`unverified` → `pending_review` → `approved` | `rejected` (with reason shown to doctor + resubmit option)

### Gating rules
- `unverified` / `rejected`: only Profile + Verification pages accessible
- `pending_review`: read-only access to dashboard, no patient PHI, no marketplace listing
- `approved`: full access; marketplace toggle becomes available

## Technical Notes

- New file `src/lib/mockData.ts` exports typed mock arrays (appointments, prescriptions, labs, EMR, messages, patients, consults).
- New `src/components/doctor/VerificationGate.tsx` wraps doctor portal pages.
- New `src/pages/doctor/Verification.tsx` form page; uploads handled with Supabase Storage bucket `doctor-credentials` (private, RLS: doctor uploads/reads own; hospital admins read).
- DB migration adds to `doctors` table: `verification_status text default 'unverified'`, `license_number`, `license_council`, `license_expiry`, `verification_submitted_at`, `verification_reviewed_at`, `verification_rejection_reason`, `current_practice jsonb`, `credential_documents jsonb` (storage paths), `reference_contact jsonb`.
- Add `verification_status` index. Auto-set `verification_status='approved'` for doctors created via hospital invite (existing path) so we don't break current flows.
- Update marketplace SELECT policy to require `verification_status='approved'`.
- Routes: add `/doctor/verification` in `App.tsx`.

## Out of Scope (this round)
- Wiring patient/doctor pages to real Supabase data (mock only for now, by your request).
- Admin-side verification review queue UI (mention only — add in a follow-up if you want).
- Telemedicine video integration, payments, real notifications.

## Files
**New**: `src/lib/mockData.ts`, `src/pages/patient/{Appointments,Prescriptions,LabResults,MedicalRecords,Messages,Profile,Settings}.tsx` (rebuild contents), `src/pages/doctor/{Appointments,Patients,Prescriptions,LabOrders,Consultations,Profile,Verification}.tsx` (rebuild contents), `src/components/doctor/VerificationGate.tsx`, migration for `doctors` columns + storage bucket.
**Edited**: `src/pages/patient/Dashboard.tsx`, `src/pages/doctor/Dashboard.tsx`, `src/App.tsx` (add verification route + gate), `src/layouts/DoctorLayout.tsx` (mount gate).

Confirm and I'll build it. Tell me if you'd also like the hospital-admin verification review screen included now.
