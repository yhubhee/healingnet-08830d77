ALTER TABLE public.hospital_subscriptions DROP CONSTRAINT IF EXISTS hospital_subscriptions_status_check;
ALTER TABLE public.hospital_subscriptions ADD CONSTRAINT hospital_subscriptions_status_check
  CHECK (status IN ('pending','active','trialing','past_due','canceled','expired'));