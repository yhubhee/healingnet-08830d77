-- Standardize patient_checkins priority field to use urgency terminology
-- Rename constraint to be semantically correct: urgency levels (routine, soon, urgent, emergency)

-- Drop old constraint
ALTER TABLE public.patient_checkins
DROP CONSTRAINT IF EXISTS patient_checkins_priority_check;

-- Rename column from 'priority' to 'urgency' for clarity
ALTER TABLE public.patient_checkins
RENAME COLUMN priority TO urgency;

-- Add new constraint with standardized urgency levels
ALTER TABLE public.patient_checkins
ADD CONSTRAINT patient_checkins_urgency_check
CHECK (urgency IN ('routine', 'soon', 'urgent', 'emergency'));

-- Set default to 'routine'
ALTER TABLE public.patient_checkins
ALTER COLUMN urgency SET DEFAULT 'routine';
