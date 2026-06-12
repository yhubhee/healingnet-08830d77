# Plan

## Part 1 — Date & time selection in triage booking

Today Step 8 auto-picks a date and never sets a time, so two patients can collide on the same doctor. We add a real scheduling step.

### New Step 7.5 — "Pick a date & time" (shown for both visit types)
A new component `TriageStep7_5DateTimeStep.tsx` inserted before confirmation:

- Reads the doctor's weekly schedule from `doctor_availability` (the doctor already sets this in their dashboard).
- Filters rows for the chosen visit type using `accepts_virtual` / `accepts_in_person`, and (for in-person) the chosen `hospital_id`.
- Calendar (shadcn Calendar in a popover):
  - Disables dates earlier than today.
  - Disables dates whose `day_of_week` has no availability row.
  - Soft-caps to the triage urgency window (emergency = today only, 24h = today/tomorrow, routine = 7 days, etc.) but the user can still see the limit explained.
- Time slots: once a date is picked, generate 30-min slots between `start_time` and `end_time` of that day's availability row(s). For each slot:
  - Query `patient_appointments` where `doctor_id = X`, `requested_date = date`, `status in ('pending','accepted','confirmed')` and mark matching `requested_time` as **Taken** (disabled).
  - Show remaining slots as selectable chips.
- "No slots on this day" empty state with link to pick another date.

### Confirmation step
`TriageStep8ConfirmationStep` receives `selectedDate` and `selectedTime` props, shows them in the summary, and inserts them as `requested_date` / `requested_time`.

### Race-condition safety (DB)
A partial unique index prevents two active bookings on the same doctor/date/time:

```sql
CREATE UNIQUE INDEX patient_appointments_doctor_slot_unique
ON public.patient_appointments (doctor_id, requested_date, requested_time)
WHERE status IN ('pending','accepted','confirmed');
```

If two patients confirm the same slot simultaneously, the second insert errors and we show "That slot was just booked — please choose another time."

### Triage.tsx wiring
Add `selectedDate` / `selectedTime` state, render the new step between 7 and 8, pass through. For telemedicine flow (which skips hospital pick), still show the new step.

## Part 2 — Hospital "Patients" page: editable status + working View

### Schema change
Add a `status` column to `public.patients`:

```sql
ALTER TABLE public.patients
  ADD COLUMN status text NOT NULL DEFAULT 'outpatient';
```

Allowed values used in the UI dropdown:
- `outpatient` (default)
- `inpatient`
- `admitted`
- `discharged`
- `under_observation`
- `critical`
- `deceased`
- `transferred`

(Stored as free text so hospitals can extend later; UI restricts to this list.)

### Patients table UI
- Replace the static green "active" badge with a `Select` bound to `patients.status`. Color-coded badges (green=outpatient/discharged, blue=inpatient/admitted, amber=under_observation, red=critical, grey=transferred/deceased). On change → `update patients set status=… where id=…` then invalidate the `usePatients` query.
- "View" button opens a new `PatientDetailDrawer` (right-side `Sheet`).

### PatientDetailDrawer content
Pulls one patient + related records and shows the data hospital staff actually need:

- **Identity**: full name, DOB/age, gender, phone, email, address (city/state).
- **Medical**: blood group, genotype, allergies (from latest emr entry if present), current status (editable in drawer too).
- **Insurance & emergency contact**: provider + policy #, NHIS if any, emergency contact name/phone.
- **Recent appointments** (last 5 from `patient_appointments` with doctor name + status).
- **Active prescriptions** (count + list from `prescriptions` where `status='active'`).
- **Recent lab results** (last 3 from `lab_results`).
- **Active admission** (if `hospital_beds` has a bed assigned to this patient → ward/bed #).
- **Outstanding bills** (sum of `hospital_billing` where unpaid).
- Quick actions row: "Add EMR entry", "New prescription", "Assign bed", "Create bill" (re-use existing dialogs).

## Technical Notes

- Files created: `src/components/triage/TriageStep7_5DateTimeStep.tsx`, `src/components/hospital/PatientDetailDrawer.tsx`.
- Files edited: `src/pages/patient/Triage.tsx`, `src/components/triage/TriageStep8ConfirmationStep.tsx`, `src/pages/hospital/Patients.tsx`.
- Migrations: add `patients.status` column + the unique partial index on `patient_appointments`.
- Use existing shadcn `Calendar`, `Popover`, `Select`, `Sheet`, `Badge`.
- All reads stay within current RLS (doctor_availability and patient_appointments are already readable to authenticated patients for their own context; we'll add a public `SELECT` policy on `doctor_availability` if it isn't there yet, scoped to `is_available = true`).

## Out of scope
- Doctor-side blocking of individual one-off dates (holiday/leave) — only weekly recurring availability is honored.
- Rescheduling/cancellation UI for the patient after booking.
- SMS/email reminders for the chosen time.
