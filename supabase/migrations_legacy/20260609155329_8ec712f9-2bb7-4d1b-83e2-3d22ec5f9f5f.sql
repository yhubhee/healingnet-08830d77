
ALTER TABLE public.consultation_requests
  ADD COLUMN IF NOT EXISTS video_provider text,
  ADD COLUMN IF NOT EXISTS daily_room_name text,
  ADD COLUMN IF NOT EXISTS recording_url text,
  ADD COLUMN IF NOT EXISTS recording_status text,
  ADD COLUMN IF NOT EXISTS call_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS call_ended_at timestamptz;

ALTER TABLE public.patient_appointments
  ADD COLUMN IF NOT EXISTS is_telemedicine boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS meeting_link text,
  ADD COLUMN IF NOT EXISTS daily_room_name text;
