ALTER TABLE public.patient_letters DROP CONSTRAINT IF EXISTS patient_letters_letter_type_check;
ALTER TABLE public.patient_letters ADD CONSTRAINT patient_letters_letter_type_check
  CHECK (letter_type = ANY (ARRAY['fit_to_work','pregnancy_maternity','sick_leave','excuse_of_duty','vaccination_record','lab_report']));