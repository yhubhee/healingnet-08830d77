# Three fixes

## 1. Why your hospital never appears after triage (root cause)

The `hospitals` table RLS only allows **hospital staff** to read it:

> `Staff can view their hospital — using is_hospital_staff(auth.uid(), id)`

So when a **patient** runs triage, `select from hospitals` returns an empty array — even with the "nationwide" fallback, there is literally nothing to show. Your one "Home Hospital" is invisible to patients.

**Fix:** add a public/anon read policy that exposes only safe, directory-style fields. The table already contains `name, address, city, state, phone, email, logo_url, license_number, is_active, lat, lng` — these are the fields a patient needs to discover and book. We will:

- Add an `anon, authenticated` `SELECT` policy on `hospitals` limited to `is_active = true`.
- Also add a public read policy on `hospital_doctors` and `doctors` (basic fields only — `first_name, last_name, specialty, rating, years_experience, profile_image_url, is_available`) so the specialty match in triage works for patients.

The patient-side queries already only select non-sensitive columns, so no view rewrite is needed.

## 2. Hospital location not editable in the UI

Hospital Settings → General currently only edits `name, phone, email, address, license_number`. We will extend that form with:

- **City** (text)
- **State** (text)
- **Latitude / Longitude** (number inputs)
- **"Use my current location"** button — calls `navigator.geolocation.getCurrentPosition` and fills lat/lng so the admin doesn't have to look them up.
- A small caption: *"Location is used to match nearby patients during AI triage."*

`saveInfo()` updated to persist these fields.

## 3. Patients can request a letter

On `/patient/letters`, add a **"Request a letter"** button (top-right of the page header). It opens a dialog:

- **Letter type** select (Fit-to-Work, Pregnancy & Maternity, Sick Leave, Excuse of Duty, Vaccination Record)
- **Reason / notes** textarea (what the patient needs it for, dates, employer, etc.)
- **Preferred doctor** (optional) — dropdown of doctors the patient has previously seen (derived from `patient_appointments` / `emr_entries`); falls back to "Any available doctor".

Submitting inserts into `patient_letters` with:
- `patient_id` = the patient
- `letter_type`, `title` = `"Request: <type label>"`, `body` = the patient's notes
- `status = 'pending'`
- `doctor_id` / `hospital_id` = chosen doctor and their hospital (nullable)
- `issued_at = today` (placeholder; doctor will overwrite when issuing)

Pending requests already render in the existing card grid with the **"Pending"** badge and a disabled Download button — so the patient sees the request show up immediately.

### Doctor side
On the doctor's `PatientDetail` page, the **Issue Letter** dialog already exists. We will:
- Add a small "Pending requests" list above the issue button, showing the patient's `status='pending'` letters with the requested type + notes, and a **Fulfil** button that pre-fills the IssueLetterDialog with that letter's id (updating instead of inserting on save, flipping status to `issued`).

### RLS / permissions
- `patient_letters` already allows patients to **read** their own rows. We need to also allow them to **INSERT** their own rows, restricted to `status = 'pending'` and `patient_id` mapping to `auth.uid()`. A new policy:
  - `INSERT WITH CHECK (patient_id IN (select id from patients where user_id = auth.uid()) AND status = 'pending')`

## Technical section

**Files**
- `supabase/migrations/<new>.sql` — new policies on `hospitals`, `doctors`, `hospital_doctors`, `patient_letters`.
- `src/pages/hospital/Settings.tsx` — extend form fields + geolocation button.
- `src/pages/patient/Letters.tsx` — add header button + dialog.
- `src/components/patient/RequestLetterDialog.tsx` — new.
- `src/components/doctor/IssueLetterDialog.tsx` — accept optional `existingLetterId` to fulfil pending requests (UPDATE path).
- `src/pages/doctor/PatientDetail.tsx` — render pending-request list above Issue Letter button.

**Policies to add (SQL sketch)**
```sql
-- Public hospital directory
create policy "Public can view active hospitals"
on public.hospitals for select to anon, authenticated
using (is_active = true);

-- Public doctor directory
create policy "Public can view doctors"
on public.doctors for select to anon, authenticated using (true);

create policy "Public can view hospital-doctor links"
on public.hospital_doctors for select to anon, authenticated
using (is_active = true);

-- Patient can request a letter (pending only)
create policy "Patients can request letters"
on public.patient_letters for insert to authenticated
with check (
  status = 'pending'
  and patient_id in (select id from patients where user_id = auth.uid())
);
```

## Out of scope
- Map picker UI for hospital lat/lng (text inputs + "use current location" only).
- Notifying doctors/hospitals via email/push when a letter is requested (in-app pending list only).
- Patient editing/cancelling a submitted request.
