# Lab Test Catalog + Connected Order/Result Flow

Note on login routing: the doctor-vs-hospital redirect bug was already patched in `src/pages/Login.tsx` (doctors are now matched via `get_user_doctor_id` before falling back to `hospital_staff`). If it's still happening, it's likely a stale session — sign out fully and sign back in. No further code change needed unless you can reproduce after a clean login (let me know and I'll dig deeper).

---

## 1. Test Catalog (data layer)

New file `src/lib/lab/catalog.ts` exporting a strongly-typed catalog. No DB migration — keep it as a static config for now (fast, versionable, no extra queries).

```ts
type Param = {
  name: string; unit?: string;
  range?: string;                 // display text ("<200", "13.0–17.0")
  low?: number; high?: number;    // numeric, for auto-flagging
  ranges?: { male?: {...}, female?: {...} }; // sex-specific override
};
type CatalogTest = {
  id: string;                     // "fbc", "lft", "tft", "mp", "widal"...
  name: string;
  category: "Hematology" | "Biochemistry" | "Lipids" | "Endocrine"
          | "Infectious disease" | "Microbiology";
  parameters: Param[];
};
type Bundle = { id: string; name: string; testIds: string[] };
```

Seed tests: **FBC, LFT, RFT, Lipid Profile, Fasting Blood Glucose, TFT, Malaria Parasite, Widal**. Hemoglobin inside FBC uses sex-specific ranges (M 13.0–17.0, F 12.0–15.5). Bundles include **Antenatal panel** (FBC + FBG + Widal + MP), **Executive check** (FBC + LFT + RFT + Lipid + FBG + TFT).

The existing `src/lib/lab/panels.ts` becomes a thin wrapper that re-exports/derives from the catalog so current call sites keep working; `computeFlag` stays.

## 2. Doctor's Order Screen

Rebuild `src/components/doctor/OrderLabTestDialog.tsx`:

- Search input filtering catalog by test name.
- Collapsible sections per category (using existing `@/components/ui/collapsible`) with a checkbox per test.
- Selected tests shown as chips at the top with remove buttons.
- Quick-pick bundle buttons (chips) that toggle all tests in a bundle.
- "Other — specify test" row with a free-text input; multiple custom rows supported.
- Clinical notes textarea (kept).
- On submit: insert one `lab_results` row (as today) and insert one `lab_result_tests` row per selected item:
  - Catalog test → `test_name = catalog.name`, `category_name = catalog.category`, plus a new column `catalog_test_id` (see schema note).
  - Custom test → `test_name = user input`, `category_name = "Custom"`, new column `is_custom = true`.

**Schema addition** (single migration):
- `lab_result_tests.catalog_test_id text NULL`
- `lab_result_tests.is_custom boolean NOT NULL DEFAULT false`

No policy changes; existing RLS already covers these rows.

## 3. Hospital Result Entry (auto-populated)

Edit `src/components/hospital/dialogs/EnterLabResultDialog.tsx`:

- Remove the manual panel/preset selector.
- On open, fetch `lab_result_tests` for the order and, for each row:
  - If `catalog_test_id` is set → look it up in the catalog and render a labeled sub-table with all its parameters (name, unit, reference range pre-filled, empty result input).
  - If `is_custom` → render one editable free-text row (parameter name, result, unit, reference range all editable).
- Group parameter inputs under a heading per ordered test ("Full Blood Count", "Lipid Profile", "Custom: <name>").
- Keep auto-flagging via `computeFlag` against catalog low/high (honoring sex-specific ranges based on the patient's `gender`).
- Interpretation textarea + markdown-lite toolbar unchanged.

**Persistence:** instead of one `lab_result_tests` row per ordered test, we expand into one row per parameter on save. To avoid clobbering the ordered rows, either:
- store parameters as a JSON column, or
- add `parent_test_id` self-reference on `lab_result_tests` and insert child rows per parameter.

Plan: add `lab_result_tests.parameters jsonb NULL` (simpler, single write, easy to render in the report). The ordered row keeps its `test_name`/`catalog_test_id`; results live inside `parameters` as `[{name, result, unit, range, flag}]`.

## 4. Report Generation

Update the "Save and generate report" body builder in `EnterLabResultDialog.tsx`:

- Iterate ordered tests. For each, output a section heading followed by a parameter table (Name • Result • Unit • Range • Flag).
- Custom tests render the single row the user filled in.
- Interpretation section appended at the bottom.
- Insert one `patient_letters` row (`letter_type = "lab_report"`) as today — patient side already handles this via the earlier `TYPE_META` change.

## Files touched

- New: `src/lib/lab/catalog.ts`
- Edit: `src/lib/lab/panels.ts` (compat shim)
- Edit: `src/components/doctor/OrderLabTestDialog.tsx` (full rebuild)
- Edit: `src/components/hospital/dialogs/EnterLabResultDialog.tsx` (auto-populated table + new report builder)
- Migration: add `catalog_test_id`, `is_custom`, `parameters` columns to `lab_result_tests`
- Types regenerate after migration; then wire the code above

## Out of scope

- Moving the catalog into the DB (kept static for speed; easy to migrate later).
- Editing catalog from the UI.
- PDF layout changes beyond the multi-section body already produced.
