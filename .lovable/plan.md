# Split frontend from backend with an API layer (lab domain pilot)

## Goal

Introduce a clean client/server seam so the React app stops talking to the database directly and instead calls a typed API layer. The backend keeps running here on Lovable Cloud (database, auth, functions). The lab domain goes first as the pilot; once it proves out, the same pattern rolls across the other domains.

## Architecture

```text
  UI components / pages
          |  (only React Query hooks)
  src/api/hooks/*        <- useLabOrders(), useSaveLabResults()
          |
  src/api/lab.ts         <- LabApi: pure async functions, domain types in/out
          |
  src/api/client.ts      <- the ONE place that knows about the backend
          |
  Lovable Cloud (Postgres + RLS + auth)
```

Rules the pilot establishes:
- No page or component imports the database client. Ever.
- `src/api/*` returns plain domain objects (`LabOrder`, `LabTest`, `LabParameter`) defined in `src/api/types.ts` — not raw table rows. Field renames in the DB stop leaking into the UI.
- All API functions throw a normalized `ApiError { status, message, code }` so error handling is uniform.
- Only `src/api/client.ts` would change if you later point the app at an Express server: swap the transport, keep every hook and component untouched.

## Scope: lab domain

Files that currently query lab tables directly and get refactored to the API layer:

- `src/pages/doctor/LabOrders.tsx`
- `src/pages/patient/LabResults.tsx`
- `src/components/hospital/dialogs/EnterLabResultDialog.tsx`
- `src/components/doctor/OrderLabTestDialog.tsx`
- `src/components/hospital/dialogs/OrderLabTestDialog.tsx`
- lab query in `src/hooks/useHospitalData.ts` (`useLabResults`) — re-exported from the new hook so existing callers keep working
- lab queries in `src/hooks/usePatientData.ts`, `src/hooks/useDoctor.ts`, `src/pages/doctor/PatientDetail.tsx`, `src/components/hospital/PatientDetailDrawer.tsx`

## API surface (lab)

`src/api/lab.ts`:
- `listOrdersForDoctor(doctorId)`
- `listOrdersForPatient(patientId)`
- `listOrdersForHospital(hospitalId)`
- `getOrder(orderId)` — order + tests + parameters, fully hydrated
- `createOrder({ patientId, hospitalId, doctorId, tests })`
- `saveTestResults(orderTestId, parameters)`
- `cancelOrder(orderId)`

`src/api/hooks/useLab.ts` wraps each in React Query with shared query keys (`['lab','orders',scope,id]`) and invalidation, so cache behaviour is defined once instead of per page.

## Not changing

- No database migration. Schema, RLS policies and grants stay exactly as they are.
- Realtime subscriptions stay direct as agreed — they only trigger cache invalidation, they don't carry data.
- Auth flow, other domains (patients, appointments, prescriptions, EMR, billing) untouched this pass.
- No Express/MongoDB server. The sandbox can't host a persistent Node process, and the current Postgres + RLS backend already enforces per-user access that a hand-rolled Express layer would have to re-implement from scratch.

## Follow-up passes (after you approve the pattern)

One domain per pass, same structure: `patients` → `appointments` → `prescriptions` → `emr` → `billing`. At the end, `src/integrations/supabase/client` is imported by `src/api/*` and the auth hook only.

## Verification

Full lab round-trip after the refactor: doctor creates a 2-test order → hospital enters and saves results for both → hospital "View" shows saved values → doctor sees per-test and order status → patient sees values, ranges and flags → PDF export renders.
