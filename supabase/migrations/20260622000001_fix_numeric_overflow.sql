-- Fix numeric overflow: increase DECIMAL precision for commission_rate
ALTER TABLE public.hospital_doctors
ALTER COLUMN commission_rate TYPE DECIMAL(10,2);
