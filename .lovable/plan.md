
## Plan: Complete Platform Build-Out

This finishes the platform: every remaining hospital module gets full CRUD, a new Doctor portal is added, Analytics shows real charts, Settings gains Subscription + Staff tabs, legacy code is deleted, the marketing site stays at `/`, and the legacy `Index.tsx` (with hardcoded `upcomingAppointments` / `prescriptions`) is removed so no static demo data is shown anywhere.

### 1. Routing & Static Data Cleanup

- `/` already serves `Landing.tsx` — confirm and remove any reference to `Index.tsx`.
- **Delete `src/pages/Index.tsx`** entirely (this is the file with the hardcoded `upcomingAppointments` and `prescriptions` arrays the user pasted).
- Audit every page for hardcoded arrays (`Doctors.tsx`, `Maternity.tsx`, `Surgery.tsx`, `Referrals.tsx`, `Insurance.tsx`, `BedManagement.tsx`, `Marketplace.tsx`) and replace with live `useHospitalData` hooks.
- Patient `Dashboard.tsx`, `Appointments.tsx`, `Prescriptions.tsx` — verify they read from `usePatientData` only; remove any leftover demo arrays.

### 2. New CRUD Dialogs (Hospital)

Add under `src/components/hospital/dialogs/`:

| Dialog | Module | Key fields |
|---|---|---|
| `AddEmrEntryDialog` | EMR | patient, entry_type, title, content, structured_data |
| `OrderLabTestDialog` | Lab | patient, doctor, test rows (name, category, sample) |
| `EnterLabResultDialog` | Lab | per-test result_value, unit, reference_range, is_abnormal |
| `ScheduleSurgeryDialog` | Surgery | patient, surgeon, procedure_name, date/time, theatre, anaesthesia |
| `UpdateSurgeryStatusDialog` | Surgery | status, op findings, complications, blood loss |
| `RegisterAncDialog` | Maternity | patient, lmp_date, edd, gravida, para, risk_level |
| `LogDeliveryDialog` | Maternity | delivery_date, delivery_type, baby_weight, gender, apgar |
| `CreateReferralDialog` | Referrals | patient, type, specialty, reason, urgency, target |
| `UpdateReferralDialog` | Referrals | status, feedback, appointment_date |
| `FileClaimDialog` | Insurance | patient, billing link, provider, policy, claim_amount |
| `UpdateClaimDialog` | Insurance | status, approved_amount, rejection_reason, paid_date |
| `AssignDoctorDialog` | Doctors | doctor, employment_type, department, contract dates, salary |
| `EditEmploymentDialog` | Doctors | edit hospital_doctors row |
| `AddWardDialog` | Beds | ward_name, ward_type, floor, total_beds |
| `AddBedDialog` | Beds | ward, bed_number, bed_type, daily_rate |
| `AssignBedDialog` | Beds | patient, bed → sets status=occupied, assigned_at |
| `DispenseDrugDialog` | Pharmacy | patient, drug, qty (decrements stock), payment_status |
| `CreateConsultationDialog` | Consultations | patient, doctor, specialty, urgency, type, reason |
| `UpdatePrescriptionDialog` | Prescriptions | refill, status |

Each dialog: react-hook-form, Zod validation, optimistic toast, invalidate corresponding React Query key.

### 3. Mutations in `useHospitalData.ts`

Add `useMutation` hooks for every entity above (insert + update). Pattern:
```ts
export const useCreateEmrEntry = () => {
  const qc = useQueryClient();
  const { hospitalId } = useHospitalContext();
  return useMutation({
    mutationFn: async (input) => {
      const { error } = await supabase.from("emr_entries").insert({ ...input, hospital_id: hospitalId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["emr_entries"] }),
  });
};
```

### 4. Doctor Portal (new)

New top-level area `/doctor/*`:

- **Auth**: signup role `doctor` → creates `doctors` row linked to `auth.uid()` (extend `handle_new_user` trigger).
- **New table** `doctor_hospital_access` already exists indirectly via `hospital_doctors.doctor_id` — add a helper `get_user_doctor_id(uuid)` security-definer function and RLS so doctors can read their own appointments, prescriptions, EMR entries, consultations.
- **Layout**: `DoctorLayout` with sidebar (Dashboard, My Patients, Appointments, Prescriptions, Lab Orders, Consultations, Profile).
- **Pages**:
  - `Dashboard` — today's appointments, pending consult requests, active patients count, recent EMR entries
  - `Appointments` — list assigned appointments, accept/decline, mark complete
  - `Patients` — patients the doctor has seen (derived from emr_entries / checkins.assigned_doctor_id)
  - `Prescriptions` — write new prescription dialog, list past
  - `LabOrders` — orders this doctor has placed
  - `Consultations` — incoming external consult requests, accept + add meeting link/notes
  - `Profile` — edit doctors row, marketplace availability toggle (writes to `doctor_marketplace`)

Login redirect: doctor → `/doctor`, patient → `/patient`, hospital staff → `/hospital`.

### 5. Settings → Subscription + Staff

Convert `Settings.tsx` to tabs:

1. **General** (existing hospital info form — make Save actually call update; currently Save button does nothing).
2. **Subscription**: shows current plan from `hospital_subscriptions`, plan comparison, "Upgrade to Telemedicine" button → opens contact-sales modal (no payment yet, per prior scope).
3. **Staff**: lists `hospital_staff` rows, "Invite Staff" dialog (creates a pending invite — for now inserts a placeholder row since `hospital_staff` insert is blocked by RLS; add policy "Admins can insert staff" via security-definer admin check), edit role, deactivate.
4. **Notifications** (existing toggles — persist to a new `hospital_notification_prefs` JSON column or local table).

DB additions: RLS policy allowing hospital admins (role='admin') to insert/update/delete `hospital_staff` for their hospital; helper `is_hospital_admin(uuid)`.

### 6. Real Analytics Charts

Use `recharts` (already supported via `src/components/ui/chart.tsx`).

- **Patient flow (last 30 days)** — line chart from `patient_checkins` grouped by `date(checkin_time)`.
- **Revenue trend (last 30 days)** — area chart from `hospital_billing` grouped by `date(created_at)`, split paid vs pending.
- **Top diagnoses** — bar chart from `emr_entries` where `entry_type='diagnosis'`, top 8 titles.
- **Doctor utilization** — horizontal bar of patients seen per doctor (`patient_checkins.assigned_doctor_id`).
- **Department mix** — donut from `patient_checkins.department`.
- **Bed occupancy gauge** — from `hospital_beds` status.

All queries client-side via React Query; no edge function needed.

### 7. Legacy Code Cleanup

Delete:
- `backend/` (entire Express/EJS server — replaced by Supabase + React)
- `public/export/` (entire folder of legacy HTML/CSS partials)
- `public/hospital-dashboard.html`, `public/hospital-login.html`
- `src/pages/Index.tsx`

Keep `index.html` (Vite entry) untouched.

### 8. Database Migration Summary

```sql
-- Doctor portal helpers
CREATE FUNCTION get_user_doctor_id(_uid uuid) RETURNS uuid ...;
CREATE FUNCTION is_hospital_admin(_uid uuid, _hid uuid) RETURNS boolean ...;

-- Update handle_new_user to support 'doctor' and 'staff' roles
-- (patient already handled)

-- RLS additions
CREATE POLICY "Doctor view own appts" ON patient_appointments
  FOR SELECT USING (doctor_id = get_user_doctor_id(auth.uid()));
CREATE POLICY "Doctor view own emr" ON emr_entries
  FOR SELECT USING (doctor_id = get_user_doctor_id(auth.uid()));
CREATE POLICY "Doctor view own prescriptions" ON prescriptions
  FOR SELECT USING (doctor_id = get_user_doctor_id(auth.uid()));
CREATE POLICY "Doctor accept consults" ON consultation_requests
  FOR UPDATE USING (doctor_id = get_user_doctor_id(auth.uid()));
CREATE POLICY "Admin manage staff" ON hospital_staff
  FOR ALL USING (is_hospital_admin(auth.uid(), hospital_id));

-- Hospital info update policy
CREATE POLICY "Admin update hospital" ON hospitals
  FOR UPDATE USING (is_hospital_admin(auth.uid(), id));

-- Optional: notification preferences
CREATE TABLE hospital_notification_prefs (
  hospital_id uuid PRIMARY KEY,
  prefs jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now()
);
```

### 9. Out of Scope (this round)

- Real payment processing for plan upgrades (still "Contact Sales" stub).
- Real video calling (consultation `meeting_link` stays a placeholder URL).
- Email invites for staff (insert row only; email delivery deferred).

### Estimated Scope

~20 new dialog files, ~7 doctor portal files, ~6 chart components, 1 migration, deletion of `backend/` and `public/export/`, full rewrite of `Settings.tsx` and `Analytics.tsx`, and removal of `Index.tsx`.
