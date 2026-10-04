# Consultation Page — Phase 4 (finishing touches)

Scope: print slip, submit confirmation, prescriptions reaching pharmacy, Start/Resume labels. No new tables. Stop and report after.

## 1. Printable request slip
- Enable "Print request slip" in the Investigations card.
- Opens a print-friendly slip (hospital name/logo, patient name, age, sex, ID, HMO, date, doctor, clinical info, priority, fasting, bill-to) listing every active lab test, radiology item (views, laterality) and other request, grouped by section, with signature line.
- Uses the same print/PDF style as the existing lab and prescription reports. Works on mobile (prints via browser).

## 2. Submit confirmation
- "Submit consultation" opens a confirm box first, summarising: complaints count, diagnosis, number of drugs going to pharmacy, tests/requests ordered, follow-up date.
- Clear warnings if something is missing (diagnosis, complaint) or not yet saved; Submit disabled until fixed.
- After submit: success message, page becomes read-only, doctor returns to Appointments.

## 3. Prescriptions reach pharmacy
- Submitting already creates prescription rows per drug line. The hospital Pharmacy page currently does not show them.
- Add a "Prescriptions to dispense" tab on Pharmacy: active prescriptions for this hospital (patient, drug, dose, frequency, duration, doctor, time), newest first, with mobile cards.
- "Dispense" opens the existing dispense flow pre-filled (drug matched to stock where possible), records the dispensing and marks the prescription dispensed. Live refresh when new ones arrive.

## 4. Start / Resume labels
- Doctor Appointments list and appointment drawer: button reads "Start consultation" if none exists for that appointment, "Resume consultation" if one is in progress, "View consultation" if submitted. Clicking opens the existing consultation (no duplicates).

## Technical details
- New: `src/components/consultation/RequestSlip.ts` (HTML print via shared `lib/reports/documents.ts`), `SubmitConfirmDialog.tsx`, `src/components/hospital/PrescriptionQueue.tsx`.
- Edit: `InvestigationsCard.tsx`, `ConsultationPage.tsx` (SubmitBar), `pages/hospital/Pharmacy.tsx`, `DispenseDrugDialog.tsx` (accept prefill + prescription id), `pages/doctor/Appointments.tsx`, `AppointmentDetailDrawer.tsx` (fetch consultations by appointment_id).
- Prescription status set to `dispensed` via existing update policy; verify staff update access with a query first and add a policy only if missing.
- Verify: build clean, typecheck, Playwright smoke where a session is available.
