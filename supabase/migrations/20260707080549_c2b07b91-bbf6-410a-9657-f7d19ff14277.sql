
-- 1. Add per-test status columns
ALTER TABLE public.lab_result_tests
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

ALTER TABLE public.lab_result_tests
  DROP CONSTRAINT IF EXISTS lab_result_tests_status_check;
ALTER TABLE public.lab_result_tests
  ADD CONSTRAINT lab_result_tests_status_check
  CHECK (status IN ('pending','completed'));

-- 2. Per-parameter results table
CREATE TABLE IF NOT EXISTS public.lab_result_parameters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_test_id uuid NOT NULL REFERENCES public.lab_result_tests(id) ON DELETE CASCADE,
  parameter_name text NOT NULL,
  result_value text,
  unit_snapshot text,
  ref_range_snapshot text,
  flag text NOT NULL DEFAULT 'unknown' CHECK (flag IN ('normal','low','high','abnormal','unknown')),
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lab_result_parameters_order_test_idx
  ON public.lab_result_parameters(order_test_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lab_result_parameters TO authenticated;
GRANT ALL ON public.lab_result_parameters TO service_role;

ALTER TABLE public.lab_result_parameters ENABLE ROW LEVEL SECURITY;

-- Mirror lab_result_tests policies
CREATE POLICY "Staff can view lab parameters"
  ON public.lab_result_parameters FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.lab_result_tests lrt
    JOIN public.lab_results lr ON lr.id = lrt.lab_result_id
    WHERE lrt.id = lab_result_parameters.order_test_id
      AND lr.hospital_id = public.get_user_hospital_id(auth.uid())
  ));

CREATE POLICY "Staff can write lab parameters"
  ON public.lab_result_parameters FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.lab_result_tests lrt
    JOIN public.lab_results lr ON lr.id = lrt.lab_result_id
    WHERE lrt.id = lab_result_parameters.order_test_id
      AND lr.hospital_id = public.get_user_hospital_id(auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.lab_result_tests lrt
    JOIN public.lab_results lr ON lr.id = lrt.lab_result_id
    WHERE lrt.id = lab_result_parameters.order_test_id
      AND lr.hospital_id = public.get_user_hospital_id(auth.uid())
  ));

CREATE POLICY "Doctors can view linked lab parameters"
  ON public.lab_result_parameters FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.lab_result_tests lrt
    JOIN public.lab_results lr ON lr.id = lrt.lab_result_id
    WHERE lrt.id = lab_result_parameters.order_test_id
      AND (lr.ordered_by = public.get_user_doctor_id(auth.uid())
           OR public.is_doctor_at_hospital(public.get_user_doctor_id(auth.uid()), lr.hospital_id))
  ));

CREATE POLICY "Patients can view own lab parameters"
  ON public.lab_result_parameters FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.lab_result_tests lrt
    JOIN public.lab_results lr ON lr.id = lrt.lab_result_id
    JOIN public.patients p ON p.id = lr.patient_id
    WHERE lrt.id = lab_result_parameters.order_test_id
      AND p.user_id = auth.uid()
  ));

-- updated_at trigger
DROP TRIGGER IF EXISTS lab_result_parameters_updated_at ON public.lab_result_parameters;
CREATE TRIGGER lab_result_parameters_updated_at
  BEFORE UPDATE ON public.lab_result_parameters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Recompute order status from child test statuses
CREATE OR REPLACE FUNCTION public.recompute_lab_order_status(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total int;
  pending_ct int;
  current_status text;
BEGIN
  SELECT status INTO current_status FROM public.lab_results WHERE id = _order_id;
  IF current_status = 'cancelled' THEN
    RETURN;
  END IF;

  SELECT count(*), count(*) FILTER (WHERE status <> 'completed')
    INTO total, pending_ct
    FROM public.lab_result_tests
    WHERE lab_result_id = _order_id;

  IF total = 0 THEN
    UPDATE public.lab_results SET status = 'pending', updated_at = now() WHERE id = _order_id;
  ELSIF pending_ct = 0 THEN
    UPDATE public.lab_results SET status = 'completed', updated_at = now() WHERE id = _order_id;
  ELSE
    UPDATE public.lab_results SET status = 'pending', updated_at = now() WHERE id = _order_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.lab_result_tests_status_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_lab_order_status(OLD.lab_result_id);
    RETURN OLD;
  ELSE
    PERFORM public.recompute_lab_order_status(NEW.lab_result_id);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS lab_result_tests_sync_order_status ON public.lab_result_tests;
CREATE TRIGGER lab_result_tests_sync_order_status
  AFTER INSERT OR UPDATE OF status OR DELETE ON public.lab_result_tests
  FOR EACH ROW EXECUTE FUNCTION public.lab_result_tests_status_sync();

-- 4. Backfill: mark existing tests as completed if a value or parameters json is present
UPDATE public.lab_result_tests
   SET status = 'completed',
       completed_at = COALESCE(completed_at, now())
 WHERE status = 'pending'
   AND (
     (result_value IS NOT NULL AND result_value <> '')
     OR (parameters IS NOT NULL AND jsonb_typeof(parameters) = 'array' AND jsonb_array_length(parameters) > 0
         AND EXISTS (
           SELECT 1 FROM jsonb_array_elements(parameters) e
           WHERE COALESCE(e->>'result_value','') <> ''
         ))
   );

-- Explode parameters jsonb into lab_result_parameters rows (only if not already migrated)
INSERT INTO public.lab_result_parameters (order_test_id, parameter_name, result_value, unit_snapshot, ref_range_snapshot, flag, sort_order)
SELECT
  lrt.id,
  COALESCE(NULLIF(e.value->>'name',''), lrt.test_name),
  NULLIF(e.value->>'result_value',''),
  NULLIF(COALESCE(e.value->>'unit', lrt.unit),''),
  NULLIF(COALESCE(e.value->>'reference_range', lrt.reference_range),''),
  CASE
    WHEN e.value->>'flag' IN ('normal','low','high','abnormal','unknown') THEN e.value->>'flag'
    WHEN COALESCE((e.value->>'result_value'),'') = '' THEN 'unknown'
    WHEN COALESCE(lrt.is_abnormal, false) THEN 'abnormal'
    ELSE 'normal'
  END,
  (e.ord - 1)::int
FROM public.lab_result_tests lrt
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(lrt.parameters, '[]'::jsonb)) WITH ORDINALITY AS e(value, ord)
WHERE jsonb_typeof(lrt.parameters) = 'array'
  AND NOT EXISTS (SELECT 1 FROM public.lab_result_parameters p WHERE p.order_test_id = lrt.id);

-- For legacy rows with a scalar result_value but no parameters array, seed one param row
INSERT INTO public.lab_result_parameters (order_test_id, parameter_name, result_value, unit_snapshot, ref_range_snapshot, flag)
SELECT
  lrt.id,
  lrt.test_name,
  lrt.result_value,
  lrt.unit,
  lrt.reference_range,
  CASE
    WHEN lrt.result_value IS NULL OR lrt.result_value = '' THEN 'unknown'
    WHEN COALESCE(lrt.is_abnormal, false) THEN 'abnormal'
    ELSE 'normal'
  END
FROM public.lab_result_tests lrt
WHERE (lrt.parameters IS NULL OR jsonb_typeof(lrt.parameters) <> 'array' OR jsonb_array_length(lrt.parameters) = 0)
  AND lrt.result_value IS NOT NULL AND lrt.result_value <> ''
  AND NOT EXISTS (SELECT 1 FROM public.lab_result_parameters p WHERE p.order_test_id = lrt.id);

-- Recompute all order statuses now
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.lab_results LOOP
    PERFORM public.recompute_lab_order_status(r.id);
  END LOOP;
END$$;
