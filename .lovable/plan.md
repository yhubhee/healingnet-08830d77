# Verify the lab restructure end-to-end

The order → test → parameter restructure has never been exercised against the running app. This plan runs the full flow in a real browser session, fixes whatever breaks, and reports results.

## Step 0: clear the existing TypeScript errors

The project currently fails typecheck with ~35 pre-existing errors that predate the lab work and hide real regressions. These get fixed first so the verification run isn't happening on top of a broken build:

- `consultation_payments` table is missing from the generated database types, breaking `services/paystack.ts` and `useConsultationPayment.ts` (most of the errors).
- MCP tool files reference `process.env` without Node types.
- Small type mismatches in doctor Consultations/Notifications/PatientDetail and patient Dashboard.


## Verification run

Using an automated browser session against the live preview, signed in with the managed session:

1. **Create a 2-test order** (doctor side, Lab Orders): order two catalog tests for one patient, confirm both rows land under the order and the order shows as pending.
2. **Partial save** (hospital side, Lab → Enter Results): fill parameters for test 1 only, click "Save results". Expect: parameter values persist, test 1 becomes completed, test 2 stays pending, and the **order stays pending** (status trigger check).
3. **Reload check**: reopen the dialog and confirm saved values, units, and reference ranges come back from `lab_result_parameters` — not blank.
4. **Full save**: fill test 2, save. Expect the order flips to **completed** in all three views: hospital Lab list, doctor Lab Orders, patient Lab Results.
5. **Flags**: confirm auto-flag badges (Normal / Low / High / Positive) render from the saved snapshots, including a sex-specific and a qualitative parameter.
6. **Report + print**: run "Save and generate report", confirm a `lab_report` letter appears in the patient's My Letters & Reports, then open "Print / Export PDF" from the completed order and confirm the letterhead report renders with all parameters from both tests.

Any step that fails gets diagnosed and fixed in the same pass (data-model, RLS/grant, or UI read path), then the affected steps are re-run until the whole chain passes.

## Technical notes

- Checks run against `lab_results` (order), `lab_result_tests`, and `lab_result_parameters`, plus the `lab_result_tests_sync_order_status` trigger.
- Database rows are inspected directly after each save to distinguish a write failure from a display failure.
- Test data created during verification is cleaned up at the end.

## Your environment connection values

These are the public client values already wired into the app (`.env`), safe to use in a browser:

- `VITE_SUPABASE_URL` = `https://cjjbfrckrfuaqyrkmbfn.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqamJmcmNrcmZ1YXF5cmttYmZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMDk3OTgsImV4cCI6MjA4ODU4NTc5OH0.EQHjADKjYSohYecsN5hl91dwgLFkK9o750GjhhCKcK0`

## Security note (separate issue, needs your call)

`.env` also contains `VITE_PAYSTACK_SECRET_KEY` and `DAILY_API_KEY`. Anything prefixed `VITE_` is bundled into the browser, so the Paystack **secret** key is currently exposed to anyone loading the app. Recommended: rotate it in Paystack, remove it from `.env`, and move any call that needs it into a backend function. Say the word and I'll fold that into this pass.
