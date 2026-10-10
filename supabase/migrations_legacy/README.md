# Legacy migrations (historical, do not apply)

These are the migrations written while HealingNet ran on Lovable Cloud (project
`cjjbfrckrfuaqyrkmbfn`). They are kept for history only.

They do **not** describe the database that was actually live: several were never
applied, some were applied by hand, and several files share the same version
prefix, so the Supabase CLI cannot replay them.

The schema now starts from a single baseline:
`supabase/migrations/20261010120000_baseline.sql`, built from a dump of the live
Lovable database with the audit fixes applied. Any new change goes in a new file in
`supabase/migrations/`.
