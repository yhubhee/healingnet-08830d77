-- =============================================================================
-- Patient app 0.2
--   1. Health card: allergies and long-term conditions on the patient profile
--      (the patient edits them; their hospitals and doctors can read them like
--      the rest of the profile).
--   2. Rate your visit: one 1-5 star rating per completed appointment, by the
--      patient, within 30 days. The doctor's public rating and review count
--      are recalculated from these ratings.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Health card fields
-- -----------------------------------------------------------------------------
alter table public.patients
  add column if not exists allergies text check (allergies is null or length(allergies) <= 500),
  add column if not exists medical_conditions text check (medical_conditions is null or length(medical_conditions) <= 500);
-- SELECT is already table-wide for authenticated (row access is by RLS).
grant update (allergies, medical_conditions) on public.patients to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Visit ratings
-- -----------------------------------------------------------------------------
alter table public.doctors add column if not exists review_count int not null default 0;

create table public.appointment_reviews (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references public.patient_appointments(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  hospital_id uuid not null references public.hospitals(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text check (comment is null or length(comment) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_appointment_reviews_doctor on public.appointment_reviews (doctor_id);
create trigger trg_appointment_reviews_updated before update on public.appointment_reviews
  for each row execute function public.update_updated_at_column();

create or replace function private.refresh_doctor_rating(_doctor_id uuid)
returns void language sql volatile security definer set search_path = '' as $$
  update public.doctors d
     set rating = coalesce((select round(avg(r.rating)::numeric, 1) from public.appointment_reviews r where r.doctor_id = d.id), 0),
         review_count = (select count(*) from public.appointment_reviews r where r.doctor_id = d.id)
   where d.id = _doctor_id;
$$;
revoke all on function private.refresh_doctor_rating(uuid) from public, anon, authenticated;

-- Patient rates (or changes their rating of) a completed visit.
create or replace function public.rate_appointment(p_appointment_id uuid, p_rating int, p_comment text default null)
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  _a public.patient_appointments;
begin
  select * into _a from public.patient_appointments where id = p_appointment_id;
  if _a.id is null or auth.uid() is null or not private.is_own_patient(_a.patient_id) then
    raise exception 'Appointment not found' using errcode = '42501';
  end if;
  if _a.status <> 'completed' then
    raise exception 'You can rate a visit after it has taken place';
  end if;
  if _a.doctor_id is null then
    raise exception 'This visit has no doctor to rate';
  end if;
  if coalesce(_a.updated_at, _a.created_at) < now() - interval '30 days' then
    raise exception 'Visits can be rated for 30 days';
  end if;
  if p_rating is null or p_rating not between 1 and 5 then
    raise exception 'Choose 1 to 5 stars';
  end if;
  insert into public.appointment_reviews (appointment_id, patient_id, doctor_id, hospital_id, rating, comment)
  values (_a.id, _a.patient_id, _a.doctor_id, _a.hospital_id, p_rating, nullif(left(btrim(coalesce(p_comment, '')), 500), ''))
  on conflict (appointment_id) do update set rating = excluded.rating, comment = excluded.comment;
  perform private.refresh_doctor_rating(_a.doctor_id);
end;
$$;

alter table public.appointment_reviews enable row level security;
grant all on public.appointment_reviews to service_role;
grant select on public.appointment_reviews to authenticated;
-- The patient sees their own; the doctor sees reviews of themself; hospital
-- staff see reviews of visits at their hospital. Others only see the average
-- (doctors.rating / review_count).
create policy "Patient, the doctor, the hospital" on public.appointment_reviews
  for select to authenticated
  using (private.is_own_patient(patient_id)
         or doctor_id = private.my_doctor_id()
         or private.can_work_at(hospital_id, 'emr'));

-- review_count is readable wherever rating is.
grant select (review_count) on public.doctors to authenticated;

revoke all on function public.rate_appointment(uuid, int, text) from public, anon;
grant execute on function public.rate_appointment(uuid, int, text) to authenticated;
