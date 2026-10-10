# Legacy Drizzle migrations (historical, do not apply)

Drizzle was used briefly to write the consultation workspace migration
(`migrations/0000_consultation_phase1.sql`) and one prescription policy
(`0001_staff_update_prescriptions.sql`) for the Lovable Cloud database.
`schema.ts` was always an empty stub, and nothing in `src/` imports Drizzle.

Both migrations are folded into `supabase/migrations/20261010120000_baseline.sql`.
Drizzle has been removed from the project; use Supabase CLI migrations instead.
