## 1. New "My Letters & Reports" page

**Sidebar nav** (`src/components/patient/PatientSidebar.tsx`): insert "My Letters & Reports" (FileText/Award icon) between Medical Records and Messages, route `/patient/letters`.

**Route**: add `/patient/letters` → `PatientLetters` page in `src/App.tsx`.

**Database** — new table `patient_letters`:
- `id`, `patient_id` (FK patients), `doctor_id` (FK doctors), `hospital_id`
- `letter_type` enum: `fit_to_work`, `pregnancy_maternity`, `sick_leave`, `excuse_of_duty`, `vaccination_record`
- `title`, `body` (text — clinical content), `issued_at` (date), `valid_until` (date, nullable)
- `status` text: `issued` | `pending` | `expired` (default `issued`)
- `pdf_url` (nullable — generated on demand)
- `created_at`, `updated_at`
- RLS: patient reads own; doctor/hospital staff who issued can read/write; service_role full. GRANTs to authenticated + service_role.

**Page** `src/pages/patient/Letters.tsx`:
- Fetches `patient_letters` joined with `doctors(first_name,last_name)` for the signed-in patient.
- Renders cards with icon per type, patient-friendly title, issued date, "Dr. X", status badge color-coded (issued=success, pending=warning, expired=muted), and **Download PDF** button.
- Download uses client-side `jspdf` to generate the letter from `body` + hospital letterhead and triggers download (no server needed). If `pdf_url` already exists, just open it.
- Empty state: icon + "No letters or reports yet. When your doctor issues one, it will appear here."

**Doctor side (optional minimal)**: add an "Issue Letter" button on `PatientDetail.tsx` opening a dialog with letter_type select + body textarea → inserts into `patient_letters` so the page isn't empty in practice. Keep it small — one dialog component.

## 2. Triage hospital fallback

In `src/pages/patient/Triage.tsx` → `loadResults`, change hospital matching logic:

1. Query doctors matching `recommended_specialty` → resolve hospitals with that specialty (current behaviour).
2. **If zero hospitals match the specialty**, fall back to hospitals that have a "General Practice" / general practitioner doctor. Mark `hasSpecialty=false` but flag `isGeneralFallback=true` so we can label the card "General Practitioner available".
3. After ranking, **if no hospital is within ~50 km of the user (or geo unavailable)**, show ALL active hospitals instead of an empty list.
4. UI: show a small notice above the list when fallback is in effect ("No <specialty> available nearby — showing general practitioners" / "Showing all hospitals nationwide").

Pure frontend change in `Triage.tsx` + small tweak to `rankHospitals` return type to carry `isGeneralFallback`.

## 3. WebRTC / video — clarification (no code change)

Yes, video consultations were built — but using **Daily.co**, not raw WebRTC. The previous turn explained why: raw WebRTC requires you to run TURN servers (coturn or paid Twilio NTS) for the ~15-20% of users behind symmetric NAT, plus a server-side mixer for recording, plus your own waiting room, transcription, mobile SDK, and HIPAA compliance — that's weeks of infrastructure.

Daily.co bundles all of that (TURN, cloud recording, knock-to-enter waiting room, transcription, mobile-ready iframe) and the free tier covers 10k participant-minutes/month. The integration lives in:
- `supabase/functions/daily-room/index.ts` — create room / mint tokens / start+stop recording
- `src/pages/VideoConsult.tsx` — Daily iframe + doctor note-taking sidebar (auto-saved)
- `src/components/JoinCallButton.tsx` — Start call / WhatsApp invite / copy link

If you still want **raw WebRTC** as an additional option, that's a separate larger project (≈1–2 weeks: signaling server via Supabase Realtime, coturn deployment, MediaRecorder for local-only recording). Tell me to proceed and I'll plan it out — otherwise Daily.co stays as the production path.

## 4. How the triage works (recap, no change)

`/patient/triage` is a 4-step LLM-powered nurse interview:

1. **Demographics** — age + biological sex (saved to `patients` if missing).
2. **Free-text symptoms** — patient describes the problem in their own words.
3. **Adaptive interview** — `triage-nurse` edge function (Lovable AI Gateway, Gemini 2.5 Flash) parses the text into clinical evidence and asks up to 8 targeted yes/no/unknown questions, narrowing the differential each turn.
4. **Results** — returns a ranked differential, an urgency level (self-care → emergency ambulance), a recommended specialty, red flags, and care navigation. The page then queries doctors of that specialty, intersects with `hospital_doctors`, ranks hospitals by Haversine distance from the user's geolocation, and lets them request an appointment that lands in `patient_appointments` with status `pending`. The full session is logged to `triage_sessions`.

After section 2 above ships, results never return an empty hospital list — they fall back to GPs and then to nationwide.

## Out of scope
- Raw WebRTC + self-hosted TURN
- AI-generated letter content (letters use the doctor-written body)
- Letter approval/co-signing workflow
- Server-side PDF rendering / signed letter storage in a bucket
