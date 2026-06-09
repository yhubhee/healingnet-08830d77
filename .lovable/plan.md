## Honest take on "native WebRTC vs Daily.co"

Native WebRTC is free but for a real telehealth product it is the wrong call:

- **TURN servers — yes, mandatory.** ~15-20% of users (corporate networks, symmetric NAT, mobile carriers) cannot connect peer-to-peer. You'd need to run/pay for a TURN relay (coturn, Twilio NTS, Metered, Xirsys). That's the part people underestimate.
- **No recording.** Browser MediaRecorder only captures the local stream; recording both sides means a server-side mixer (LiveKit Egress, Daily recording, AWS Chime). Building this is weeks of work.
- **No transcription, no waiting room, no >2 participants, no network resilience, no mobile SDK.**
- **HIPAA/clinical compliance posture is on you.**

**Recommendation:** Use **Daily.co** as the default. It bundles TURN, cloud recording, transcription, waiting rooms, and a drop-in iframe. Free tier = 10k participant-mins/month, perfect for launch. WhatsApp (wa.me link) and Jitsi stay as fallbacks. No native WebRTC.

---

## Plan

### 1. Hospital dashboard — replace Revenue card with Telemedicine card
File: `src/pages/hospital/Dashboard.tsx`

New card shows:
- Today's scheduled video consults (count)
- Active rooms right now (live)
- Pending consult requests
- Click → `/hospital/consultations`

### 2. Daily.co integration

**Setup (you do once):**
1. Sign up at daily.co → pick subdomain **`healingnet`** (not the lovable URL — Daily wants a short slug). Rooms become `healingnet.daily.co/visit-xyz`.
2. Copy your Daily API key from Developers → API keys.
3. I'll prompt you to paste it as secret `DAILY_API_KEY`.

**New edge function `daily-room`:**
- `POST { action: "create", consultation_id, doctor_name, patient_name, scheduled_for }` → creates a private Daily room with 2-hour expiry, returns `{ room_url, room_name }`, saves to `consultation_requests.meeting_link`.
- `POST { action: "token", room_name, user_name, is_owner }` → returns short-lived meeting token (owner = doctor → can start/stop recording).
- `POST { action: "delete", room_name }` → cleanup.

**New embedded video page** `src/pages/VideoConsult.tsx` (route `/consult/:id`):
- Uses `@daily-co/daily-js` (or iframe with prebuilt UI for speed).
- Fetches consult, validates user is participant, requests token, joins room.
- Sidebar with: live **note-taking** textarea (autosaves to `consultation_requests.doctor_notes`), patient summary, prescription/lab shortcuts, end-call button.
- Doctor sees **Record** toggle (calls Daily REST `recordings/start`).
- After call ends → recording URL saved to consult row, doctor prompted to finalize notes.

### 3. WhatsApp fallback
- Add `whatsapp_number` to consult flow (use patient phone).
- Button on consult card: "Send via WhatsApp" → opens `https://wa.me/<digits>?text=<encoded message with meeting link>`.
- Plain link, no API key, works immediately.

### 4. Join button logic (doctor + patient consult cards)
Three buttons stacked / dropdown:
- **Start video call** (primary) → Daily room
- **Send WhatsApp invite** → wa.me with meeting link
- **Copy link** (Jitsi remains as zero-config backup if Daily key missing)

Updates `src/pages/doctor/Consultations.tsx`, `src/pages/patient/Appointments.tsx`, `AppointmentDetailDrawer`.

### 5. DB migration
Add columns to `consultation_requests`:
- `video_provider` text (`daily` | `jitsi` | `whatsapp`)
- `daily_room_name` text
- `recording_url` text
- `recording_status` text
- `call_started_at` timestamptz
- `call_ended_at` timestamptz

Add columns to `patient_appointments` for telemedicine appointments:
- `is_telemedicine` boolean default false
- `meeting_link` text
- `daily_room_name` text

### 6. Mobile responsiveness — `/doctor` dashboard
File: `src/pages/doctor/Dashboard.tsx` + `DoctorLayout` + `DoctorSidebar`.

Issues to fix:
- Sidebar is fixed-width and pushes content off-screen on mobile → convert to slide-out Sheet drawer below `md`, with hamburger in a new top bar.
- `main` padding `p-6` is too tight → `p-4 md:p-6`.
- Quick-actions row wraps awkwardly → horizontal scroll on mobile.
- 4-column stat grid → already `grid-cols-2 lg:grid-cols-4` ✅, keep.
- "Today's Schedule" rows overflow → stack patient name above status on `<sm`.
- Consult requests card sits beside schedule on `lg` only ✅.

Same Sheet pattern applied to all doctor pages via `DoctorLayout`.

### 7. Telemedicine card data source
Query in hospital dashboard:
```text
- video_today: consultation_requests WHERE hospital_id=X AND request_type='virtual' AND DATE(scheduled_for)=today
- active_now: consultation_requests WHERE call_started_at IS NOT NULL AND call_ended_at IS NULL
- pending: consultation_requests WHERE status='pending' AND request_type='virtual'
```

---

## Order of execution
1. DB migration (consult + appointment columns).
2. Ask you for `DAILY_API_KEY` secret.
3. Edge function `daily-room`.
4. Install `@daily-co/daily-js`.
5. `VideoConsult.tsx` page + route.
6. Update consult cards (doctor + patient) with 3-button join.
7. Replace hospital dashboard Revenue card with Telemedicine card.
8. Mobile-responsive pass on `DoctorLayout` + `DoctorSidebar` + `Dashboard.tsx`.

## Out of scope
- Native WebRTC + self-hosted TURN (covered above — not worth it).
- WhatsApp Business API templated messaging (you chose wa.me link).
- Group calls / waiting rooms beyond Daily defaults.
- Auto-transcription (can add later — Daily supports it via one extra API flag).
- Billing/charging per video minute.
