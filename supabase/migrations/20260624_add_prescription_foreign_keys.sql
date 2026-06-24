-- Add foreign key constraints to prescriptions table for Supabase relationship support

ALTER TABLE public.prescriptions
ADD CONSTRAINT fk_prescriptions_patient
  FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;

ALTER TABLE public.prescriptions
ADD CONSTRAINT fk_prescriptions_doctor
  FOREIGN KEY (doctor_id) REFERENCES public.doctors(id) ON DELETE SET NULL;

ALTER TABLE public.prescriptions
ADD CONSTRAINT fk_prescriptions_hospital
  FOREIGN KEY (hospital_id) REFERENCES public.hospitals(id) ON DELETE CASCADE;
