# Plan: Doctor Settings + Availability, Patient AI Triage, Real Data

## 1. Doctor Availability & Settings

**New DB tables (migration):**
- `doctor_availability` — per-doctor weekly schedule per hospital (or global):
  - `doctor_id`, `hospital_id` (nullable = global), `day_of_week` (0–6), `start_time`, `end_time`, `is_available` (bool), `accepts_virtual` (bool), `accepts_in_person` (bool)
  - unique (`doctor_id`, `hospital_id`, `day_of_week`)
- `doctor_settings` — single row per doctor:
  - `doctor_id` PK, `availability_mode` ('global' | 'per_hospital'), `accepts_virtual_global` (bool), `is_currently_available` (bool, the master on/off toggle), `virtual_consultation_fee`, `notification_prefs` (jsonb), `language`, `timezone`
- RLS: doctor manages own rows; authenticated can SELECT (so hospitals/patients see availability).

**New page `/doctor/settings`** (`src/pages/doctor/Settings.tsx`):
- Tabs: **Availability**, **Hospitals**, **Notifications**, **Account**.
- Availability tab:
  - Master "Currently accepting patients" switch.
  - Mode picker: **Global schedule** vs **Per-hospital schedule**.
  - When global: Mon–Sun grid with start/end time, available toggle, virtual toggle, in-person toggle.
  - When per-hospital: dropdown of hospitals doctor is in (`hospital_doctors` join), each with its own weekly grid.
  - "Open for virtual / online consultation" toggle (writes `accepts_virtual_global` and per-row).
- Notifications tab: email/SMS/in-app prefs (jsonb).
- Account tab: change password, language, timezone, sign-out.

**Sidebar** (`DoctorSidebar.tsx`): add **Settings** entry (Settings icon) → `/doctor/settings`.

**Dashboard quick toggle** (`pages/doctor/Dashboard.tsx`): add small "Available now" switch + link to Settings.

**Routing**: register `/doctor/settings` in `App.tsx`.

## 2. Patient AI-Assisted Triage (4-step)

**New table `triage_sessions`:**
- `patient_id`, `symptoms` (jsonb array), `duration`, `severity_self` (1–10), `severity_score` (1–10 computed), `recommended_specialty`, `urgency` ('routine' | 'soon' | 'urgent' | 'emergency'), `recommended_hospitals` (jsonb), `chosen_hospital_id`, `chosen_doctor_id`, `status`, `lat`, `lng`.

**Add to `hospitals` table** (migration): `lat numeric`, `lng numeric` so Haversine works (nullable).

**New rule engine** `src/lib/triage/engine.ts`:
- Rule table mapping symptom keywords → likely specialties + base severity weights (e.g. chest pain → Cardiology, +6; chest pain + sweating + arm pain → +9 emergency; rash → Dermatology +2; pregnancy bleeding → Obstetrics +8).
- `scoreSeverity(symptoms, duration, selfScore)` → 1–10.
- `routeSpecialty(symptoms)` → specialty string.
- `urgencyFromScore(score)` → routine/soon/urgent/emergency.

**Haversine matcher** `src/lib/triage/proximity.ts`:
- `haversineKm(a, b)` standard formula.
- `rankHospitals(userLatLng, hospitals, specialty)` — filter hospitals that have a doctor of that specialty (via `hospital_doctors` + `doctors.specialty`), sort by distance, cap at 5.

**New page `/patient/triage`** (`src/pages/patient/Triage.tsx`) — 4-step chat UI:
1. **Symptom chips** (Fever, Cough, Chest pain, Headache, Bleeding, Rash, Vomiting, Pain — multi-select + free text).
2. **Duration & self-rated severity** (Today / Few days / Weeks; slider 1–10).
3. **Triage result card**: severity score, urgency badge, recommended specialty, plain-language guidance ("Seek emergency care now" if ≥ 9).
4. **Hospital match**: requests browser geolocation, ranks hospitals by Haversine; user picks one → opens existing booking flow that creates a `patient_appointments` row (specialty/doctor pre-filled).

Wire CTA on `/patient` dashboard: replace the "Book new" button with "Start AI Triage" + secondary "Book directly".

## 3. Remove Hardcoded Mock Data

Replace `mockData.ts` reads with live Supabase queries (React Query) on:
- **Patient**: `Dashboard`, `Appointments`, `Prescriptions`, `LabResults` (+ `lab_result_tests`), `MedicalRecords` (`emr_entries`), `Messages` (`patient_messages`), `Profile` (`patients`).
- **Doctor**: `Dashboard` (today's `patient_appointments` where `doctor_id = me`, pending `consultation_requests`, distinct patients), `Appointments`, `Patients` (distinct patients from appointments + checkins), `Prescriptions`, `LabOrders` (`lab_results` ordered_by me), `Consultations`, `Profile`.

Empty states: every page gets a friendly "No data yet" card instead of mock fallbacks. `mockData.ts` is deleted.

## Technical details

- All new tables: RLS enabled, doctor/patient owns own rows, hospital staff can read where relevant.
- Time storage: `time` columns; render in user locale.
- Geolocation: `navigator.geolocation.getCurrentPosition` with graceful fallback to city dropdown.
- React Query keys: `['doctor','availability', doctorId]`, `['patient','appointments', patientId]`, etc.
- Validation: zod on all settings forms.
- No new external deps.

## Files

**New**: migration; `src/pages/doctor/Settings.tsx`; `src/pages/patient/Triage.tsx`; `src/lib/triage/engine.ts`; `src/lib/triage/proximity.ts`; `src/hooks/useDoctorAvailability.ts`; `src/hooks/useTriage.ts`.

**Edited**: `App.tsx`, `DoctorSidebar.tsx`, `pages/doctor/Dashboard.tsx`, `pages/doctor/Profile.tsx` (remove mock fallback), all patient pages, all doctor pages.

**Deleted**: `src/lib/mockData.ts`.

## Out of scope
- Real-time presence/“online now” indicator beyond the master switch.
- LLM-based triage (rule engine only, as specified).
- Admin UI for setting hospital lat/lng (will accept manual values via existing hospital settings page; can be added later).
