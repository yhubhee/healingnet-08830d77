-- Prevent anonymous visitors from selecting email/phone on the public doctors directory.
-- The directory row policy remains (name, specialty, etc. still visible to anon),
-- but PostgREST will now reject anon requests that ask for these PII columns.
REVOKE SELECT (email, phone) ON public.doctors FROM anon;