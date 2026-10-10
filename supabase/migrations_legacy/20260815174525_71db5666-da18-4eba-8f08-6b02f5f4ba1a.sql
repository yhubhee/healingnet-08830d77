ALTER TABLE public.hospitals
  ADD COLUMN IF NOT EXISTS active_plan text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'inactive';

ALTER TABLE public.hospitals DROP CONSTRAINT IF EXISTS hospitals_active_plan_check;
ALTER TABLE public.hospitals ADD CONSTRAINT hospitals_active_plan_check
  CHECK (active_plan IN ('none','emr','telemedicine'));

ALTER TABLE public.hospitals DROP CONSTRAINT IF EXISTS hospitals_subscription_status_check;
ALTER TABLE public.hospitals ADD CONSTRAINT hospitals_subscription_status_check
  CHECK (subscription_status IN ('inactive','pending','active','expired'));

ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS plan text;
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_plan_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_plan_check
  CHECK (plan IS NULL OR plan IN ('emr','telemedicine'));

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_purpose_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_purpose_check
  CHECK (purpose IN ('billing','pharmacy','consultation','subscription'));

UPDATE public.hospitals h
SET active_plan = s.plan,
    subscription_status = 'active'
FROM public.hospital_subscriptions s
WHERE s.hospital_id = h.id
  AND s.status = 'active'
  AND h.active_plan = 'none';