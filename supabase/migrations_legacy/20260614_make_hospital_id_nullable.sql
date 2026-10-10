-- Make hospital_id nullable for telemedicine appointments
-- For online appointments, doctor's hospital will be used (or NULL if doctor has no hospital)
ALTER TABLE public.patient_appointments
  ALTER COLUMN hospital_id DROP NOT NULL;
