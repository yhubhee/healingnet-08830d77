

## Plan: Marketing Landing Page, Subscription Plans & Patient Portal in React

This plan delivers three big pieces: (1) a public marketing landing page with subscription tiers for hospitals, (2) full conversion of the patient portal to React with a real backend, and (3) wiring the remaining hospital dashboards to live data with full CRUD. The hospital dashboards are already in React — this plan completes their backend integration.

### 1. Public Marketing Landing Page (`/`)

A new public landing page at `/` (the current `/` becomes `/patient`).

**Sections:**
- Hero: headline, sub-copy, "Get Started Free" + "Book Demo" CTAs, dashboard mockup illustration
- "Built for everyone" — 3 audience cards: Patients, Doctors, Hospitals (benefits per persona)
- Feature grid: EMR, Patient Queue, Billing, Lab/Pharmacy, Maternity, Surgery, Insurance, Telemedicine, Marketplace, Analytics
- "How it works" — 3-step flow (Sign up → Configure hospital → Onboard staff)
- **Pricing section** with 2 hospital tiers (toggle monthly/yearly):
  - **EMR Essentials** — Patient records, queue, billing, lab, pharmacy, basic analytics
  - **Telemedicine Suite** — everything in Essentials + teleconsultation, doctor marketplace, external consultations, video calls, advanced analytics
  - Patient plan: Free forever
- Testimonials, FAQ accordion, Footer with links
- Top nav: Logo, Features, Pricing, For Hospitals, For Patients, Login, Get Started

### 2. Auth System

- `/login` and `/signup` pages (email/password + Google)
- Signup flow asks: "Patient" or "Hospital Staff/Admin"
- Hospital signup → onboarding wizard: hospital name, address, plan choice (EMR vs Telemedicine), creates `hospitals` row + `hospital_staff` row (admin)
- Patient signup → creates `patients` row linked to `auth.uid()`
- Protected route wrapper redirects unauthenticated users to `/login`
- Role-based redirect after login: hospital staff → `/hospital`, patients → `/patient`

### 3. Subscription Plans (DB + enforcement)

- New `hospital_subscriptions` table: `hospital_id`, `plan` (`emr` | `telemedicine`), `status`, `started_at`, `expires_at`, `billing_cycle`
- New helper RPC `get_hospital_plan(_hospital_id uuid)`
- Telemedicine-only routes (`/hospital/consultations`, `/hospital/marketplace`) gated by a `<RequirePlan plan="telemedicine">` wrapper that shows an upgrade screen if on EMR plan
- Sidebar visually marks telemedicine items with a lock icon for EMR plan hospitals
- Settings page gets a "Subscription" tab to view current plan + upgrade button

### 4. Patient Portal in React (`/patient/*`)

Replaces legacy HTML in `public/export/`. New routes under a `PatientLayout` (sidebar + header):
- `/patient` — Dashboard (real data: upcoming appointments, active prescriptions, unread notifications, health metrics)
- `/patient/appointments` — Tabs: Upcoming, Pending, Past + "Book Appointment" modal
- `/patient/prescriptions` — Active + history, refill request action
- `/patient/lab-results` — View results with values/ranges
- `/patient/medical-records` — Personal EMR view
- `/patient/messages` — Messages from doctors
- `/patient/profile` — Edit profile, emergency contact, insurance
- `/patient/settings` — Notifications, privacy, password

### 5. Hospital Dashboard Backend Wiring (CRUD)

Hospital pages exist as React shells. This plan adds full create/edit/delete dialogs and connects every page to live data:

| Page | Actions added |
|---|---|
| Patients | Add patient dialog, edit, search, filter |
| Queue | Check-in patient dialog, call next, mark in-consultation, complete |
| Doctors | Assign doctor (link from `doctors` to `hospital_doctors`), edit employment, deactivate |
| EMR | Create entry dialog (note, diagnosis, prescription, vitals), view per-patient timeline |
| Lab | Order test dialog, enter results dialog with multiple test rows |
| Pharmacy | Add inventory item, dispense drug dialog, low-stock alerts |
| Billing | Create bill dialog, mark paid, payment method, record |
| Surgery | Schedule surgery, update status (scheduled→ongoing→completed), op notes |
| Maternity | Register ANC patient, log delivery, update gestational age |
| Referrals | Create referral, accept/reject, feedback |
| Insurance | File claim, update status, link to billing |
| Consultations | (Telemedicine) Create request, accept, generate meeting link |
| Marketplace | (Telemedicine) Browse external doctors, request consult |
| Beds | Add ward, add bed, assign patient, discharge |
| Notifications | Mark read, mark all read (already wired) |
| Settings | Hospital profile, staff list, subscription tab |
| Analytics | Real charts: patient flow (last 30d), revenue trend, top diagnoses, doctor utilization |

Realtime subscriptions extended to: `hospital_billing`, `lab_results`, `pharmacy_inventory`, `consultation_requests`.

### 6. Patient ↔ Hospital data linkage

- `patient_appointments` table (new): `patient_id`, `hospital_id`, `doctor_id`, `requested_date`, `status` — bridges patient bookings to hospital queue
- `prescriptions` table (new): `patient_id`, `doctor_id`, `hospital_id`, `drug_name`, `dosage`, `frequency`, `duration`, `refills_allowed`, `status` — feeds both patient prescription view and pharmacy dispensing
- `patient_messages` table (new): `from_user_id`, `to_user_id`, `subject`, `body`, `is_read`

### 7. Cleanup

- Delete legacy `backend/` folder (Node/EJS) and `public/export/*` HTML files — fully replaced by React
- Delete `public/hospital-dashboard.html`, `public/hospital-login.html`
- Move root-level patient redirect: `/` → marketing site, `/patient` → patient dashboard, `/hospital` stays

---

### Technical Details

**Routing changes (`src/App.tsx`):**
```
/                       → Landing (public)
/login, /signup         → Auth (public)
/patient/*              → PatientLayout (auth required, role=patient)
/hospital/*             → HospitalLayout (auth required, role=staff, plan-gated for telemedicine)
```

**New tables (migrations):**
- `hospital_subscriptions(hospital_id, plan, status, billing_cycle, started_at, expires_at)` with RLS: staff of hospital can read, only admins update
- `patient_appointments(...)` with RLS: patient owns rows + staff of target hospital can manage
- `prescriptions(...)` with RLS: patient reads own + hospital staff manage
- `patient_messages(...)` with RLS: sender/recipient only
- RPC `get_hospital_plan(hospital_id) returns text`

**New components/files:**
- `src/pages/Landing.tsx`, `src/pages/Login.tsx`, `src/pages/Signup.tsx`, `src/pages/HospitalOnboarding.tsx`
- `src/pages/patient/{Dashboard,Appointments,Prescriptions,LabResults,MedicalRecords,Messages,Profile,Settings}.tsx`
- `src/layouts/PatientLayout.tsx`, `src/components/patient/PatientSidebar.tsx`, `PatientHeader.tsx`
- `src/components/landing/{Hero,Features,Pricing,Audiences,HowItWorks,FAQ,Footer,Nav}.tsx`
- `src/components/auth/{ProtectedRoute,RequirePlan,RoleGate}.tsx`
- `src/components/hospital/dialogs/*` — Add/Edit dialogs for each entity (Patient, Bill, LabOrder, Prescription, Surgery, etc.)
- `src/hooks/useAuth.ts`, `src/hooks/usePatientData.ts`, `src/hooks/useSubscription.ts`
- Mutations added to `useHospitalData.ts` for every entity

**Auth approach:** Email/password + Google via Lovable Cloud. `onAuthStateChange` listener in a top-level `AuthProvider`. Password reset page at `/reset-password` included.

**Plan gating:** `RequirePlan` reads `useSubscription()` and renders `<UpgradePrompt />` if plan insufficient. Sidebar items get a lock badge when plan is EMR.

**Out of scope (this round):** Real payment processing for subscriptions (stub the upgrade flow with a "Contact Sales" / "Coming Soon" modal — actual Stripe/Paddle integration can be added later when the user requests it). Video call infrastructure (teleconsultation generates a placeholder meeting link).

**Estimated scope:** ~45 new files, ~5 migrations, full rewrite of `src/App.tsx`, deletion of `backend/` and legacy `public/export/`.

