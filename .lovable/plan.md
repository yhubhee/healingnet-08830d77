# Consultation Page — Phase 1 only (database)

Scope: database changes only. No screens, no catalog seeding, no order picker. After this I stop and report.

## What the audit found (existing names to reuse)

- Lab orders live in `lab_results` (the order), `lab_result_tests` and `lab_result_parameters`. There are no `lab_orders` or `test_catalog` tables. The lab catalog is stored in app code. Lab columns get added to `lab_results`.
- Queue = `patient_checkins` (vitals already stored as `vitals` jsonb, plus `assigned_doctor_id`). This is the "queue entry".
- Appointments = `patient_appointments` (`is_telemedicine`).
- Prescriptions = `prescriptions`: one row per drug, no separate items table. On Submit, each drug line becomes one `prescriptions` row.
- Pharmacy stock = `pharmacy_inventory`.
- Staff roles = `hospital_staff.role` (admin, nurse, receptionist, lab_tech, pharmacist, manager, medical_officer).
- Existing access helpers to reuse: `private.is_hospital_staff`, `private.is_hospital_admin`, `private.get_user_doctor_id`, `private.is_doctor_at_hospital`, `private.get_hospital_plan`, `private.can_doctor_access_patient`.

## Migration (one portable, repeatable file in the migrations folder)

New tables (all have `hospital_id NOT NULL`, access grants, RLS on, and policies in the same file):
- `consultations`: hospital, patient, doctor, `appointment_id`, `checkin_id` (queue entry), `mode` (in_person/telemedicine), `started_at`, `submitted_at`, diagnoses, advice/plan, follow-up date, timestamps + an `updated_at` trigger. Two partial unique indexes allow only one open consultation per checkin and per appointment.
- `consultation_history` (1:1): complaint list, HPC, past medical/surgical/drug history, allergies, family and social history, LMP/EDD, obstetric notes, ROS, and who recorded it (with role).
- `consultation_examinations` (1:1): vitals columns as a per-visit copy/override, since the queue vitals are only jsonb. The UI pre-fills them from `patient_checkins.vitals`. Also general/systemic/other findings and who recorded them. BMI is not stored.
- `diagnostic_catalog`: global or hospital-specific items, kind, section, aliases, views, laterality, with a unique index on (hospital, lower(name), section). Empty until Phase 3.
- `diagnostic_requests`: per-item imaging/other/external requests. Status comes from `performed_at` / `reported_at` / `cancelled_at`, not a stored status column.
- `consultation_treatment_items`: Card 4 draft lines (drug, procedure or other; route, frequency, duration, quantity, give-in-clinic).
- `consultation_addenda`: append-only. Read and insert policies only.

Nullable columns added to existing tables:
- `lab_results`: `consultation_id`, `clinical_info`, `priority`, `fasting`, `bill_to`
- `prescriptions`: `consultation_id`

RPCs:
- `start_consultation(checkin_id, appointment_id, patient_id)`: returns the open consultation if one exists, otherwise creates it (repeat calls are safe). Blocked when the hospital plan is 'none'.
- `submit_consultation(id)`: one transaction. It checks that the caller owns the consultation, that it isn't already submitted, and that there is at least one complaint and a provisional diagnosis. It then sets `submitted_at`, creates one `prescriptions` row per drug line, marks the checkin completed if linked, and returns a summary. Any error rolls everything back.

Access rules:
- Doctor: full access to their own consultations in their hospital. Read-only access to other consultations for patients they can access in the same hospital.
- Hospital staff (nurse/admin/receptionist) in the same hospital: can read, and can insert/update history and examination while `submitted_at` is null.
- Patient: read-only access to their own consultations once submitted, and to their history, examination, treatment and addenda. No access to drafts.
- After submit, a check shared by all policies blocks updates and deletes on history, examination and treatment rows.
- Lab and pharmacy access stays exactly as it is.

Realtime: add `diagnostic_requests` and `lab_result_tests` to the realtime publication (guarded so it can be re-run).

## Verification
- Run a security check and confirm the new tables are listed with policies.
- Confirm the existing doctor, lab, pharmacy and queue pages still load.

## Final report
Migration name, tables/columns added, reused tables, deviations (lab table names, flat prescriptions, vitals copy), what's skipped (Phases 2–4), and manual steps: none on Lovable Cloud; replay the SQL file on another project.
