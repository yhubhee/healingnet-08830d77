# Consultation Page — Phase 3 (catalog + order picker)

Scope: investigation catalog and the order picker opened by Add Lab / Add Radiology / Add More. Print slip, submit confirm dialog and "Resume" states stay for Phase 4. Stop and report after.

## 1. Catalog seeding
- Lab tests (Appendix section A): there is no `test_catalog` table — the lab catalog lives in app code. Extend that app catalog with the missing Appendix tests (category, aliases, requires-fasting flag). Existing tests are kept unchanged; duplicates skipped by case-insensitive name/alias match (e.g. FBC = Full Blood Count). New tests get one free-text result line with no range, and the flag logic returns no flag for empty ranges.
- Imaging (section B, kind `imaging`) and Other (section C, kind `other`): insert global rows (hospital_id null) into `diagnostic_catalog` with section, aliases, allowed views and laterality, skipping any already present. Data insert only, no schema change.

## 2. Order picker
- Dialog on desktop, full-height bottom sheet on mobile.
- Add Lab → lab tests by category. Add Radiology → tabs X-ray, Ultrasound, CT, MRI, Mammography, Special/Contrast. Add More → Other section plus a free-text "Custom request".
- Search across names and aliases (catalog cached once), section chips, multi-select checklist, "selected" tray with x per item.
- X-ray items: pick allowed views + "Other view"; laterality items ask Left / Right / Both.
- Order details: Priority Routine/Urgent/STAT; Fasting (auto-ticked); Clinical info pre-filled from provisional diagnosis + complaints; Bill to Patient/HMO/Company/Hospital (HMO if patient has insurance); Send to In-house or External facility (name field).
- Soft warning when the same test was ordered for this patient in the last 24 hours.

## 3. Sending
- In-house lab tests → one `lab_results` order + `lab_result_tests` (+ parameters) linked by consultation, same shape the hospital Lab page already uses, so it shows there and in Card 3 live.
- Everything else (imaging, other, custom, external lab) → `diagnostic_requests` rows.
- Queue status is left as is (no existing "awaiting investigations" status to reuse).
- Card 3: wire the three buttons; x cancels requests not yet started (sets cancelled_at; for lab, only while still pending).

## Technical details
- New: `src/lib/lab/appendixCatalog.ts`, `src/hooks/useInvestigationCatalog.ts`, `src/components/consultation/OrderPickerDialog.tsx`.
- Edit: `InvestigationsCard.tsx`, flag util (null-range guard), lab catalog merge.
- Seed via SQL insert with `WHERE NOT EXISTS` on lower(name)+section.
- Verify: build clean, typecheck, Playwright smoke of picker at 375px and desktop where a doctor session is available.
