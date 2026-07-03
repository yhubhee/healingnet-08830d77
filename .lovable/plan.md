## Current RLS snapshot

I checked the affected backend tables. RLS is enabled on all of these:

- `doctors` — policies exist, but the recent column-level restriction means app queries using `select("*")` can fail or return no usable doctor profile data.
- `hospital_doctors` — policies exist; some doctor self-link checks still reference `doctors` directly, which is fragile after the column/security changes.
- `patients` — policies exist, but the broad staff policy is tied only to `get_user_hospital_id(auth.uid())`; doctors need an explicit “my patient / my hospital patient” policy.
- `patient_appointments` — policies exist for assigned doctors and patients, but patient booking needs a reliable hospital resolution path for the selected doctor.
- `lab_results` — policies exist for ordered-by doctor and hospital staff.
- `lab_result_tests` — policies exist for staff and doctor-inserted lab tests, but doctor read access for test rows linked to their lab orders is incomplete.
- `prescriptions` — policies exist for doctor-owned prescriptions and hospital prescriptions.
- `doctor_settings` / `doctor_availability` — RLS enabled with doctor-owned policies.

## Plan

1. **Add safe helper functions for doctor access**
   - Add or replace security-definer helper functions that avoid policy recursion and avoid relying on client-readable `doctors` rows:
     - Resolve the logged-in user’s doctor id.
     - Check whether a doctor belongs to a hospital.
     - Check whether a patient is linked to a doctor by appointment, prescription, lab order, or shared hospital.
   - Keep RLS enabled everywhere.

2. **Repair doctor RLS policies without weakening security**
   - `doctors`: allow authenticated doctors to read their own profile row while preserving public directory access only to safe columns where possible.
   - `hospital_doctors`: allow doctors to read their own active hospital links; keep sensitive compensation fields protected from normal doctor/patient directory reads.
   - `patients`: add explicit doctor read access only when the patient is linked to that doctor or to that doctor’s hospital.
   - `patient_appointments`: allow doctors to read/update appointments assigned to them and read related hospital appointments where appropriate; allow patients to create appointments only when the patient row belongs to them and the chosen hospital is a valid hospital for the selected doctor.
   - `lab_results`: allow doctors to read their own ordered lab results and relevant hospital-linked lab orders.
   - `lab_result_tests`: allow doctors to read test rows for lab orders they can read.
   - `prescriptions`: ensure doctors can read/create/update prescriptions they issued and read relevant hospital-linked patient prescriptions.

3. **Fix frontend doctor profile queries**
   - Update doctor profile loading paths to stop using `select("*")` against restricted columns when not needed.
   - Use the existing safe doctor profile view, or explicit safe column lists, for doctor dashboard/profile/verification reads.
   - Keep sensitive credential fields available only in places that need them and only through the safe self-profile path.

4. **Fix doctor context and patient lists**
   - Update `useDoctor()` so it reliably loads the doctor row and active hospital links after the RLS changes.
   - Update `useDoctorPatients()` to use the repaired policies and request the fields the UI actually displays, so patients, prescriptions, appointments, and lab orders populate again.

5. **Fix virtual appointment booking**
   - In the triage confirmation flow, resolve the selected doctor’s active hospital id before inserting.
   - For telemedicine, use the selected doctor’s first active hospital affiliation.
   - For in-person, validate that the selected hospital is provided.
   - If no valid hospital id can be resolved, show a clear error and do not attempt the insert.

6. **Validate as a doctor**
   - After implementation, test the live app as a logged-in doctor where possible:
     - Doctor profile loads.
     - Patients list loads.
     - Appointments list loads.
     - Lab orders list loads.
     - Prescriptions list loads.
     - Virtual appointment booking no longer inserts `hospital_id = null`.
   - If authenticated browser verification is unavailable for the current preview session, validate the backend access paths with read-only policy checks and report what could not be end-to-end tested.