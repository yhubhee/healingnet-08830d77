DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='patient_checkins' AND column_name='priority'
  ) THEN
    ALTER TABLE public.patient_checkins DROP CONSTRAINT IF EXISTS patient_checkins_priority_check;
    ALTER TABLE public.patient_checkins RENAME COLUMN priority TO urgency;
  END IF;
END $$;

ALTER TABLE public.patient_checkins DROP CONSTRAINT IF EXISTS patient_checkins_urgency_check;

UPDATE public.patient_checkins SET urgency = 'routine' WHERE urgency IS NULL OR urgency NOT IN ('routine','soon','urgent','emergency');

ALTER TABLE public.patient_checkins
  ADD CONSTRAINT patient_checkins_urgency_check CHECK (urgency IN ('routine','soon','urgent','emergency'));

ALTER TABLE public.patient_checkins ALTER COLUMN urgency SET DEFAULT 'routine';