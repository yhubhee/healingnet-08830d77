
ALTER TABLE public.lab_result_tests
  ADD COLUMN IF NOT EXISTS catalog_test_id text,
  ADD COLUMN IF NOT EXISTS is_custom boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS parameters jsonb;
