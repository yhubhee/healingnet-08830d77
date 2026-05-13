## 1. Fix "Not authenticated" hospital signup

**Root cause:** Email confirmation is on, so `supabase.auth.signUp` returns no session. The fallback `signInWithPassword` then fails (`invalid_credentials`) because the email isn't confirmed yet. The RPC `create_hospital_with_admin` requires `auth.uid()` and rejects with "Not authenticated".

**Fix:** Move hospital creation into an edge function `create-hospital` that:
- Verifies the just-created user via the service-role client (looks up by email + checks `user_metadata.role === "hospital"`).
- Inserts hospital + admin staff + subscription using service role (bypasses RLS).
- Returns the new hospital id.

Signup flow becomes: `signUp` → call edge function with the new `user.id` → show "Check your email to confirm" toast → redirect to `/login`.

This works regardless of whether email confirmation is on, and removes the auth race condition.

## 2. Rebuild Triage as "AI Nurse" (Infermedica-style)

Replace the current rule-based `src/pages/patient/Triage.tsx` with a 4-step LLM-driven wizard backed by Lovable AI.

### Step 1 — Demographics
- On mount, fetch the patient row. If `date_of_birth` and `gender` are both present, auto-fill and skip to Step 2.
- Otherwise show Age (number) + Biological Sex (male/female) form. On submit, write back to `patients` (compute a DOB from age = Jan 1 of year `today - age` if user only knows age).

### Step 2 — Initial symptoms (free text)
- Large textarea: "Describe what you're feeling…"
- Submit → loading state "Analyzing your symptoms…" → calls edge function `triage-nurse` with `{ stage: "parse", age, sex, text }`.
- LLM (google/gemini-2.5-flash) returns structured `evidence: [{id, name, present:true}]` + initial `differential` candidates via tool calling.

### Step 3 — Dynamic diagnostic interview
- One card at a time with question + Yes / No / I don't know buttons.
- Each answer → calls `triage-nurse` with `{ stage: "next", age, sex, evidence }` → returns either next `question` or `should_stop: true`.
- Progress bar increments (cap ~8 questions, or stop early if confidence high).
- LLM is instructed to behave like Infermedica's diagnostic engine: ask the highest-information-gain question, never repeat, stop when one condition dominates or red flag detected.

### Step 4 — Results & care navigation (2-column dashboard)
- Left column: ranked **possible conditions** (top 3-5 with probability bar + plain-language description).
- Right column: **care navigation** — triage level (self-care / GP / urgent / emergency), recommended specialty, then the existing hospital-matching list (reuses `rankHospitals` + Haversine) with "Book" buttons.
- Saves full session to `triage_sessions` (already exists).

### Edge function `triage-nurse`
- Single endpoint, three stages: `parse`, `next`, `final`.
- Uses Lovable AI (`LOVABLE_API_KEY` already configured) with tool-calling for structured JSON.
- System prompt frames it as a cautious medical triage nurse (not diagnostic), always surfaces red flags, avoids prescribing.
- Returns 429/402 errors gracefully to the client.

## Technical details

**Files to create**
- `supabase/functions/create-hospital/index.ts`
- `supabase/functions/triage-nurse/index.ts`
- `src/lib/triage/nurseClient.ts` (thin client wrapping the edge function calls)

**Files to edit**
- `src/pages/Signup.tsx` — replace RPC call with `supabase.functions.invoke("create-hospital", …)`; on success route to `/login` (or `/hospital` if session is present).
- `src/pages/patient/Triage.tsx` — full rewrite: 4-step wizard, demographics gate, LLM interview loop, two-column results.
- Keep `src/lib/triage/proximity.ts` and reuse `rankHospitals`.
- The old `src/lib/triage/engine.ts` becomes a fallback used only if the edge function errors.

**No DB schema changes required.** `patients.date_of_birth`/`gender` and `triage_sessions` already exist.

**Security**
- `create-hospital` validates the caller's email matches the looked-up user and that role metadata is `hospital`. Service role usage stays inside the function.
- `triage-nurse` is JWT-verified (default) so only authenticated patients call it.

## Out of scope
- No changes to doctor/hospital portals.
- No new tables.
- No paid Infermedica API — uses Lovable AI only.
