## Goal

Fix the recurring "results don't save / status out of sync / report crash blocks save" bugs by giving lab data a proper 3-level structure (order → test → parameter), computing order status from its tests, and separating "Save Results" from "Generate Report".

## Approach — reuse existing table names to avoid a rewrite of every page

The current schema already has two of the three levels: `lab_results` (acts as the order) and `lab_result_tests` (one row per test in the order). I'll keep those names so the ~10 pages/hooks that reference them don't churn, add the missing per-parameter level as a new table, and enforce the "status is computed" rule with a trigger.

Mapping to the names in your spec:
- `lab_orders` → existing `lab_results`
- `lab_order_tests` → existing `lab_result_tests` (add `status` column)
- `lab_results` (per parameter) → new `lab_result_parameters`

## 1. Schema migration

```text
lab_results (order)                — unchanged columns; status becomes trigger-managed
 └── lab_result_tests (per test)   — add status ('pending'|'completed'), completed_at
      └── lab_result_parameters    — NEW: id, order_test_id, parameter_key, parameter_label,
                                          result_value, unit_snapshot, ref_range_snapshot,
                                          flag ('normal'|'low'|'high'|'critical'), created_at
```

- Add `status text default 'pending' check in ('pending','completed')` and `completed_at timestamptz` on `lab_result_tests`.
- Create `lab_result_parameters` with GRANTs, RLS, and policies that mirror `lab_result_tests` (staff at owning hospital + assigned doctor + owning patient can read; hospital staff can write).
- `unit_snapshot` and `ref_range_snapshot` are copied from the catalog at save-time so historical reports are stable.

## 2. Computed order status via trigger

- Trigger on `lab_result_parameters` INSERT/UPDATE/DELETE and on `lab_result_tests` INSERT/UPDATE/DELETE:
  - Recompute owning `lab_results.status`: `completed` iff every child `lab_result_tests.status='completed'` AND at least one test exists; else `pending`.
- Drop client code paths that manually set `lab_results.status`.

## 3. Data migration (preserve existing entries)

- Backfill each existing `lab_result_tests` row with `status='completed'` when `result_value` is non-null, else `pending`.
- For rows whose `parameters` JSONB has entries, expand each key into a `lab_result_parameters` row (`unit_snapshot`, `ref_range_snapshot`, `flag` inferred from `is_abnormal`). Leave the legacy `parameters` column in place for now (read-only fallback).
- Run the status trigger once to sync existing `lab_results.status`.

## 4. Fix patient_letters constraint (unblock report generation)

The last migration already added `'lab_report'` to the check constraint. I'll verify it's present and, if the current insert uses a different value, either update the code to `'lab_report'` or extend the constraint. Report generation stays best-effort — failures never roll back saved results.

## 5. Split the save flow — two independent actions

`EnterLabResultDialog` gets two buttons:

- **Save Results** — for each test's parameter grid: upsert `lab_result_parameters` rows (with unit/range snapshots + computed flag), then set that test's `lab_result_tests.status='completed'`. Trigger recomputes order status. Toast success, invalidate `lab-results`, close.
- **Save and Generate Report** — runs Save Results, then, in an isolated try/catch, inserts a `patient_letters` row (`letter_type='lab_report'`, body rendered from saved parameters). If the letter insert fails, show a non-blocking warning; saved results and completed status remain.

Flag computation (client-side, from catalog range): numeric parse → compare against low/high → `low`/`normal`/`high`; free-text results default to `normal` unless the tech overrides.

## 6. Update the three views to read the new structure

- **Hospital `EnterLabResultDialog` (also used as "View" for completed orders)** — hydrate parameter inputs from `lab_result_parameters` (fallback to legacy `lab_result_tests.parameters` JSON if empty). Show interpretation text saved on the order.
- **Doctor `LabOrders.tsx` detail modal** — show each `lab_result_tests` row with its own status badge + parameter list from `lab_result_parameters`; header shows computed overall status.
- **Patient `LabResults.tsx`** — replace the current per-test row with per-parameter rows sourced from `lab_result_parameters` (value, `unit_snapshot`, `ref_range_snapshot`, `flag`). No more default "Normal" fallback — show real flag or "—" if not yet entered.
- Extend `useHospitalData.useLabResults` and equivalent doctor/patient queries to include `lab_result_parameters` in the nested select.

## 7. PDF export from the hospital View modal

Add a **Print / Export PDF** button in `EnterLabResultDialog` header (visible when order is completed). Uses `window.print()` against a hidden print-styled report container (hospital name/address as letterhead, patient block, per-test parameter tables with flag coloring, interpretation, doctor signature line). No new dependency needed; a follow-up can swap to `jspdf` if a true download file is required.

## 8. Test plan

1. Create order with 2 tests (e.g. FBC + LFT) as hospital.
2. Enter partial results for test 1 only → Save Results → order still `pending`, test 1 `completed`, test 2 `pending`. Verified in hospital list, doctor list, patient page.
3. Enter results for test 2 → Save Results → order flips to `completed` automatically (trigger).
4. Click "View" on completed order → all values, units, ranges, flags rehydrated from `lab_result_parameters`.
5. Click "Save and Generate Report" → confirm a `lab_report` letter appears in the patient's Letters page; deliberately break the letter (e.g. long title) to confirm results remain saved and only a warning shows.
6. Click Print/Export PDF → verify letterhead, patient block, parameter table, flags, interpretation render correctly.

## Files touched

**New migration** — `supabase/migrations/<ts>_lab_results_restructure.sql` (schema, GRANTs, RLS, trigger, backfill).

**Frontend**
- `src/components/hospital/dialogs/EnterLabResultDialog.tsx` — split submit into `saveResults()` + `saveAndGenerateReport()`; hydrate from `lab_result_parameters`; add Print button + print template.
- `src/hooks/useHospitalData.ts` — widen `lab_results` select to include `lab_result_tests(*, lab_result_parameters(*))`.
- `src/pages/doctor/LabOrders.tsx` — per-test status badge, read parameters from new table.
- `src/pages/patient/LabResults.tsx` — render per-parameter rows from `lab_result_parameters`.
- `src/components/doctor/OrderLabTestDialog.tsx` and hospital `OrderLabTestDialog.tsx` — no change needed (they only create tests).

**Untouched:** all other lab-adjacent code; no table renames, so hooks/pages referencing `lab_results`/`lab_result_tests` keep working.

## Non-goals

- Not renaming existing tables (would force edits across every lab-touching file for no functional gain).
- Not removing the legacy `lab_result_tests.parameters` JSONB column in this migration — kept as fallback for one release; can be dropped later.
- Not changing the test catalog (`src/lib/lab/catalog.ts`) structure.
