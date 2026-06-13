## Problem

Saving availability in **src/pages/doctor/Settings.tsx** calls:

```ts
supabase.from("doctor_availability").upsert(rows, { onConflict: "doctor_id,hospital_id,day_of_week" })
```

But the table's unique index is an **expression index** using `COALESCE(hospital_id, '0000…')` (to treat NULL hospital_id — the "global" schedule — as equal). Postgres `ON CONFLICT (col, col, col)` cannot match expression indexes, so it errors with "no unique or exclusion constraint matching the ON CONFLICT specification".

## Fix

In `saveAll()` of `src/pages/doctor/Settings.tsx`, replace the upsert with **delete-then-insert** scoped to the doctor and the keys being saved:

1. If `availability_mode === "global"`:
   - `delete from doctor_availability where doctor_id = ? and hospital_id is null`
2. Else (per-hospital):
   - `delete from doctor_availability where doctor_id = ? and hospital_id in (<hospital ids>)`
3. `insert(rows)` (no onConflict needed).

This works with the existing COALESCE-based unique index — no schema migration — and preserves correct handling of the global (NULL hospital_id) case, which a plain column unique constraint would mishandle (NULLs are distinct in standard UNIQUE).

## Files

- **Edit only:** `src/pages/doctor/Settings.tsx` (`saveAll` function).

## Out of scope

- Schema changes to `doctor_availability`.
- Touching `doctor_settings` upsert (that one has a real unique constraint on `doctor_id` and works fine).
