-- Add status column to track invitation lifecycle: pending → active or declined
ALTER TABLE public.hospital_doctors
ADD COLUMN status TEXT DEFAULT 'active' CHECK (status IN ('pending', 'active', 'declined', 'expired'));

-- Create index for querying pending invitations
CREATE INDEX idx_hospital_doctors_status ON public.hospital_doctors(status);

-- Update existing records to active (for backwards compatibility)
UPDATE public.hospital_doctors SET status = 'active' WHERE status IS NULL;

-- Make status NOT NULL
ALTER TABLE public.hospital_doctors
ALTER COLUMN status SET NOT NULL;
