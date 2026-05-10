CREATE TABLE public.contact_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a contact message"
ON public.contact_messages FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Hospital admins can view contact messages"
ON public.contact_messages FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.hospital_staff
  WHERE user_id = auth.uid() AND role = 'admin' AND is_active = TRUE
));