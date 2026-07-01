# Redesign "Enter Lab Results" modal as a structured lab report

## Overview
Replace the current plain form in `EnterLabResultDialog` with a professional lab-report layout: branded header, test panel selector with preset parameters, auto-flagging results table, formatted interpretation, existing attachments box, and a "Save and generate report" action that also files the report into the patient's **My Letters & Reports** section.

## Files touched
- **Edit** `src/components/hospital/dialogs/EnterLabResultDialog.tsx` — full UI rebuild + save-and-generate logic.
- **New** `src/lib/lab/panels.ts` — lookup config for FBC, LFT, RFT, Lipid Profile panels (parameter, unit, reference range low/high or textual range). Structured so more panels can be added by dropping into the object.
- **Edit** `src/pages/patient/Letters.tsx` — add a `lab_report` entry to `TYPE_META` (icon: `FlaskConical`) so lab reports render with the right label/icon in the patient view.

No DB migration needed: the generated report is stored in existing `patient_letters` (`letter_type = "lab_report"`, `title = "Laboratory Report — LAB-XXXX"`, `body` = formatted text/HTML of header + table + interpretation, `hospital_id`, `doctor_id` from the order, `patient_id`, `status = "issued"`).

## Modal structure (top → bottom)

**1. Header band** (inside `DialogContent`, dark navy card matching dashboard tokens)
- Left: hospital name (from `useHospitalData` current-hospital hook) + subtitle "Laboratory Report".
- Right: small `FlaskConical` accent icon.
- Two-column info grid below: **Patient**, **Lab ID** (`LAB-{order.id.slice(0,4).toUpperCase()}`), **Ordering doctor** (`Dr. …` or "—"), **Report date** (today, read-only, formatted).

**2. Test panel selector**
- shadcn `Select` labeled "Test panel" with options: Full Blood Count (FBC), Liver Function Test (LFT), Renal Function Test (RFT), Lipid Profile, plus "Custom / Ordered tests" (the default — keeps whatever `order.lab_result_tests` already contains).
- Selecting a preset replaces the results table rows with that panel's parameters (with blank `result_value`). A confirm step warns before overwriting entered values.

**3. Results table** (replaces the current test cards)
- Columns: **Parameter**, **Result** (input), **Unit**, **Reference range**, **Flag**, row-delete button.
- Flag auto-computed from numeric result vs. `range_low`/`range_high` in the panel config:
  - inside → green **Normal** badge
  - below → amber **Low**
  - above → amber **High**
  - non-numeric result or missing range → neutral **—**
- "Add parameter" button under the table appends a blank editable row (name, unit, range are all editable for custom rows).

**4. Clinical interpretation**
- Textarea with a small formatting toolbar above it (**B**, *I*, • list). Toolbar buttons wrap the current selection with `**…**`, `*…*`, or prefix lines with `- ` (markdown-style, stored as text). Keeps things lightweight — no new rich-text dependency.

**5. Attachments** — unchanged file upload UI.

**6. Footer**
- `Cancel` (outline) + `Save and generate report` (primary).
- On submit:
  1. Upsert `lab_result_tests` rows: update existing rows by id; for panel/custom rows without an id, insert new rows tied to `order.id`.
  2. Update `lab_results` row: `status = "completed"`, `notes = interpretation`.
  3. Build a formatted `body` string (header lines + markdown table of parameters/result/unit/range/flag + interpretation) and insert a `patient_letters` row: `letter_type = "lab_report"`, `title = "Laboratory Report — LAB-XXXX"`, `patient_id`, `hospital_id`, `doctor_id = order.ordered_by`, `status = "issued"`, `issued_at = now()`.
  4. Invalidate `lab-results` and `patient-letters` queries, toast success, close.

## Patient-side rendering
`Letters.tsx` already renders any `patient_letters` row and offers a jsPDF fallback download. Adding `lab_report` to `TYPE_META` gives it the right label + icon; the existing PDF generator already prints hospital letterhead + title + body, so the saved report shows up as an official-looking letterhead document with no additional work.

## Visual style
All colors via existing tokens (`bg-card`, `border-border`, `text-primary`, `bg-success/15 text-success`, `bg-warning/15 text-warning`, `bg-muted`). No hardcoded colors. Consistent with current dark-navy dashboard.

## Out of scope
- Full WYSIWYG rich text (using lightweight markdown toolbar instead).
- Server-side PDF generation (client-side jsPDF in Letters.tsx is reused).
- Uploading attachment files to storage (existing dialog also doesn't persist them; keeping parity).
