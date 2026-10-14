-- Platform admin console (HealingNet staff only).
--
-- Design:
--   * The browser never reads platform-wide tables directly. Every admin screen
--     calls an admin_* function that (1) checks private.is_platform_admin(),
--     (2) aggregates / paginates on the server, and (3) returns only business
--     data: counts, hospitals, doctors, payments. Never patient names or
--     clinical records (data minimisation, NDPA).
--   * Every admin action is written to admin_audit_log.
--   * Lists are paginated (max 100 rows) and searchable; metrics use
--     created_at indexes, so it stays fast as the data grows.

-- -----------------------------------------------------------------------------
-- 1. Audit log + contact message handling
-- -----------------------------------------------------------------------------
create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index idx_admin_audit_created on public.admin_audit_log (created_at desc);
create index idx_admin_audit_target on public.admin_audit_log (target_type, target_id);
alter table public.admin_audit_log enable row level security;
revoke all on public.admin_audit_log from public, anon, authenticated;
grant all on public.admin_audit_log to service_role;

alter table public.contact_messages
  add column handled_at timestamptz,
  add column handled_by uuid references auth.users(id) on delete set null;

-- -----------------------------------------------------------------------------
-- 2. Indexes for time-based metrics
-- -----------------------------------------------------------------------------
create index if not exists idx_hospitals_created on public.hospitals (created_at);
create index if not exists idx_hospitals_verif on public.hospitals (verification_status);
create index if not exists idx_doctors_created on public.doctors (created_at);
create index if not exists idx_doctors_verif on public.doctors (verification_status);
create index if not exists idx_patients_created on public.patients (created_at);
create index if not exists idx_payments_created on public.payments (created_at);
create index if not exists idx_payments_status_created on public.payments (status, created_at);
create index if not exists idx_checkins_created on public.patient_checkins (created_at);
create index if not exists idx_appointments_created on public.patient_appointments (created_at);
create index if not exists idx_consultations_created on public.consultations (created_at);
create index if not exists idx_triage_created on public.triage_sessions (created_at);
create index if not exists idx_consult_requests_created on public.consultation_requests (created_at);
create index if not exists idx_contact_created on public.contact_messages (created_at);
create index if not exists idx_function_calls_fn_created on public.function_calls (fn, created_at);

-- -----------------------------------------------------------------------------
-- 3. Helpers
-- -----------------------------------------------------------------------------
create or replace function private.require_platform_admin()
returns void
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
end;
$$;

create or replace function private.admin_log(_action text, _target_type text, _target_id uuid, _details jsonb default '{}'::jsonb)
returns void
language sql volatile security definer
set search_path = ''
as $$
  insert into public.admin_audit_log (admin_user_id, action, target_type, target_id, details)
  values (auth.uid(), _action, _target_type, _target_id, coalesce(_details, '{}'::jsonb));
$$;

-- Clamp paging inputs.
create or replace function private.page_limit(_n int) returns int
language sql immutable set search_path = '' as $$ select least(greatest(coalesce(_n, 25), 1), 100) $$;
create or replace function private.page_offset(_n int) returns int
language sql immutable set search_path = '' as $$ select greatest(coalesce(_n, 0), 0) $$;

-- -----------------------------------------------------------------------------
-- 4. Who am I (used by the /admin route guard)
-- -----------------------------------------------------------------------------
create or replace function public.admin_whoami()
returns boolean
language sql stable security definer
set search_path = ''
as $$ select private.is_platform_admin() $$;

-- -----------------------------------------------------------------------------
-- 5. Overview: one call, all headline numbers
-- -----------------------------------------------------------------------------
create or replace function public.admin_overview()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  _r jsonb;
begin
  perform private.require_platform_admin();

  with h as (
    select
      count(*) as total,
      count(*) filter (where verification_status = 'pending') as pending,
      count(*) filter (where verification_status = 'approved') as approved,
      count(*) filter (where verification_status = 'rejected') as rejected,
      count(*) filter (where not is_active) as suspended,
      count(*) filter (where subscription_status = 'trialing' and trial_ends_at > now()) as trialing,
      count(*) filter (where subscription_status = 'trialing' and trial_ends_at > now()
                         and trial_ends_at <= now() + interval '7 days') as trials_ending_7d,
      count(*) filter (where subscription_status = 'active' and plan_expires_at > now() and active_plan = 'emr') as paid_emr,
      count(*) filter (where subscription_status = 'active' and plan_expires_at > now() and active_plan = 'telemedicine') as paid_telemedicine,
      count(*) filter (where (subscription_status = 'active' and plan_expires_at <= now())
                          or (subscription_status = 'trialing' and trial_ends_at <= now())) as lapsed,
      count(*) filter (where created_at > now() - interval '7 days') as new_7d,
      count(*) filter (where created_at > now() - interval '30 days') as new_30d
    from public.hospitals
  ), d as (
    select
      count(*) as total,
      count(*) filter (where verification_status = 'pending_review') as pending,
      count(*) filter (where verification_status = 'approved') as approved,
      count(*) filter (where verification_status = 'unverified') as unverified,
      count(*) filter (where verification_status = 'rejected') as rejected,
      count(*) filter (where created_at > now() - interval '7 days') as new_7d,
      count(*) filter (where created_at > now() - interval '30 days') as new_30d
    from public.doctors
  ), p as (
    select
      count(*) as total,
      count(*) filter (where user_id is not null) as app_users,
      count(*) filter (where created_at > now() - interval '7 days') as new_7d,
      count(*) filter (where created_at > now() - interval '30 days') as new_30d
    from public.patients
  ), pay as (
    select
      coalesce(sum(amount) filter (where status = 'success' and paid_at > now() - interval '30 days'), 0) as revenue_30d_kobo,
      coalesce(sum(amount) filter (where status = 'success' and paid_at > now() - interval '30 days'
                                     and purpose = 'subscription'), 0) as subscription_revenue_30d_kobo,
      count(*) filter (where status = 'success' and paid_at > now() - interval '30 days') as success_30d,
      count(*) filter (where status in ('failed', 'abandoned') and created_at > now() - interval '30 days') as failed_30d,
      count(*) filter (where status = 'pending' and created_at < now() - interval '1 hour'
                         and created_at > now() - interval '7 days') as stuck_pending,
      count(*) filter (where metadata->>'review' = 'duplicate_payment_refund_needed') as refunds_needed
    from public.payments
  ), mrr as (
    -- Monthly recurring revenue: paid, unexpired plans at today's prices.
    select coalesce(sum(case when pp.billing_cycle = 'yearly' then pp.amount_kobo / 12 else pp.amount_kobo end), 0) as mrr_kobo
    from public.hospitals hh
    join lateral (
      select s.billing_cycle from public.hospital_subscriptions s
       where s.hospital_id = hh.id and s.status = 'active'
       order by s.started_at desc limit 1) sub on true
    join public.plan_prices pp on pp.plan = hh.active_plan and pp.billing_cycle = sub.billing_cycle
    where hh.subscription_status = 'active' and hh.plan_expires_at > now()
  ), act as (
    select
      (select count(*) from public.patient_checkins where created_at > now() - interval '7 days') as checkins_7d,
      (select count(*) from public.patient_appointments where created_at > now() - interval '7 days') as appointments_7d,
      (select count(*) from public.consultations where created_at > now() - interval '7 days') as consultations_7d,
      (select count(*) from public.triage_sessions where created_at > now() - interval '7 days') as triage_7d,
      (select count(*) from public.triage_sessions where created_at > now() - interval '7 days' and urgency = 'emergency') as triage_emergency_7d,
      (select count(*) from public.consultation_requests where created_at > now() - interval '7 days') as consult_requests_7d,
      ((select count(*) from public.patient_appointments where call_started_at > now() - interval '7 days')
       + (select count(*) from public.consultation_requests where call_started_at > now() - interval '7 days')) as calls_7d,
      ((select count(*) from public.patient_appointments where call_started_at is not null and call_ended_at is null
                                                    and call_started_at > now() - interval '4 hours')
       + (select count(*) from public.consultation_requests where call_started_at is not null and call_ended_at is null
                                                    and call_started_at > now() - interval '4 hours')) as live_calls
  )
  select jsonb_build_object(
    'generated_at', now(),
    'hospitals', (select to_jsonb(h) from h),
    'doctors', (select to_jsonb(d) from d),
    'patients', (select to_jsonb(p) from p),
    'payments', (select to_jsonb(pay) from pay),
    'mrr_kobo', (select mrr_kobo from mrr),
    'activity', (select to_jsonb(act) from act),
    'inbox', jsonb_build_object(
      'verifications_pending', (select pending from h) + (select pending from d),
      'refunds_needed', (select refunds_needed from pay),
      'contact_unhandled', (select count(*) from public.contact_messages where handled_at is null))
  ) into _r;
  return _r;
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. Time series for charts: one value per day
-- -----------------------------------------------------------------------------
create or replace function public.admin_timeseries(p_metric text, p_days int default 30)
returns table (day date, value numeric)
language plpgsql stable security definer
set search_path = ''
as $$
declare
  _days int := least(greatest(coalesce(p_days, 30), 7), 365);
  _from date := (now() at time zone 'Africa/Lagos')::date - (_days - 1);
begin
  perform private.require_platform_admin();
  if p_metric not in ('signups_hospitals', 'signups_doctors', 'signups_patients', 'revenue_naira',
                      'payments_failed', 'checkins', 'appointments', 'consultations', 'triage',
                      'triage_emergency', 'calls', 'consult_requests') then
    raise exception 'Unknown metric';
  end if;

  return query
  with days as (
    select generate_series(_from, (now() at time zone 'Africa/Lagos')::date, interval '1 day')::date as d
  ), ev as (
    select (t at time zone 'Africa/Lagos')::date as d, v::numeric as v from (
      select created_at as t, 1 as v from public.hospitals where p_metric = 'signups_hospitals' and created_at >= _from
      union all select created_at, 1 from public.doctors where p_metric = 'signups_doctors' and created_at >= _from
      union all select created_at, 1 from public.patients where p_metric = 'signups_patients' and created_at >= _from
      union all select paid_at, amount / 100.0 from public.payments
                 where p_metric = 'revenue_naira' and status = 'success' and paid_at >= _from
      union all select created_at, 1 from public.payments
                 where p_metric = 'payments_failed' and status in ('failed', 'abandoned') and created_at >= _from
      union all select created_at, 1 from public.patient_checkins where p_metric = 'checkins' and created_at >= _from
      union all select created_at, 1 from public.patient_appointments where p_metric = 'appointments' and created_at >= _from
      union all select created_at, 1 from public.consultations where p_metric = 'consultations' and created_at >= _from
      union all select created_at, 1 from public.triage_sessions where p_metric = 'triage' and created_at >= _from
      union all select created_at, 1 from public.triage_sessions
                 where p_metric = 'triage_emergency' and urgency = 'emergency' and created_at >= _from
      union all select call_started_at, 1 from public.patient_appointments where p_metric = 'calls' and call_started_at >= _from
      union all select call_started_at, 1 from public.consultation_requests where p_metric = 'calls' and call_started_at >= _from
      union all select created_at, 1 from public.consultation_requests where p_metric = 'consult_requests' and created_at >= _from
    ) x(t, v)
  )
  select days.d, coalesce(sum(ev.v), 0)
    from days left join ev on ev.d = days.d
   group by days.d
   order by days.d;
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. Verification queue
-- -----------------------------------------------------------------------------
create or replace function public.admin_verification_queue()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform private.require_platform_admin();
  return jsonb_build_object(
    'hospitals', coalesce((
      select jsonb_agg(x order by x.created_at) from (
        select h.id, h.name, h.email, h.phone, h.address, h.city, h.state, h.license_number,
               h.created_at, h.subscription_status, h.active_plan,
               (select jsonb_build_object('name', btrim(s.first_name || ' ' || s.last_name), 'email', s.email, 'phone', s.phone)
                  from public.hospital_staff s
                 where s.hospital_id = h.id and s.role = 'admin' and s.is_active
                 order by s.created_at limit 1) as contact,
               (select count(*) from public.hospital_patients hp where hp.hospital_id = h.id) as patients_registered
          from public.hospitals h
         where h.verification_status = 'pending') x), '[]'::jsonb),
    'doctors', coalesce((
      select jsonb_agg(x order by x.verification_submitted_at) from (
        select d.id, d.user_id, btrim(d.first_name || ' ' || d.last_name) as name, d.email, d.phone, d.specialty,
               d.years_experience, d.license_number, d.license_council, d.license_expiry,
               d.current_practice, d.reference_contact, d.credential_documents,
               d.verification_submitted_at, d.created_at
          from public.doctors d
         where d.verification_status = 'pending_review') x), '[]'::jsonb)
  );
end;
$$;

-- Review with an audit entry (wraps the existing review functions).
create or replace function public.admin_review_hospital(p_hospital_id uuid, p_approve boolean, p_notes text default null)
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
begin
  perform private.require_platform_admin();
  if not p_approve and nullif(btrim(coalesce(p_notes, '')), '') is null then
    raise exception 'Give a reason when rejecting';
  end if;
  perform public.review_hospital(p_hospital_id, p_approve, nullif(btrim(coalesce(p_notes, '')), ''));
  perform private.admin_log(case when p_approve then 'hospital.approve' else 'hospital.reject' end,
                            'hospital', p_hospital_id, jsonb_build_object('notes', p_notes));
end;
$$;

create or replace function public.admin_review_doctor(p_doctor_id uuid, p_approve boolean, p_reason text default null)
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
begin
  perform private.require_platform_admin();
  if not p_approve and nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'Give a reason when rejecting';
  end if;
  perform public.review_doctor(p_doctor_id, p_approve, nullif(btrim(coalesce(p_reason, '')), ''));
  perform private.admin_log(case when p_approve then 'doctor.approve' else 'doctor.reject' end,
                            'doctor', p_doctor_id, jsonb_build_object('reason', p_reason));
end;
$$;

-- -----------------------------------------------------------------------------
-- 8. Hospitals
-- -----------------------------------------------------------------------------
-- p_status: null | 'pending' | 'approved' | 'rejected' | 'suspended'
-- p_plan:   null | 'trialing' | 'emr' | 'telemedicine' | 'lapsed' | 'none'
create or replace function public.admin_list_hospitals(
  p_search text default null, p_status text default null, p_plan text default null,
  p_limit int default 25, p_offset int default 0)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  _q text := nullif(btrim(coalesce(p_search, '')), '');
  _res jsonb;
begin
  perform private.require_platform_admin();
  with f as (
    select h.*,
      case
        when h.subscription_status = 'active' and h.plan_expires_at > now() then h.active_plan
        when h.subscription_status = 'trialing' and h.trial_ends_at > now() then 'trialing'
        when h.subscription_status in ('active', 'trialing') then 'lapsed'
        else 'none' end as plan_state
    from public.hospitals h
    where (_q is null or h.name ilike '%' || _q || '%' or h.email ilike '%' || _q || '%'
           or h.city ilike '%' || _q || '%' or h.state ilike '%' || _q || '%')
      and (p_status is null
           or (p_status = 'suspended' and not h.is_active)
           or (p_status <> 'suspended' and h.verification_status = p_status))
  ), g as (
    select * from f where p_plan is null or f.plan_state = p_plan
  )
  select jsonb_build_object(
    'total', (select count(*) from g),
    'rows', coalesce((select jsonb_agg(r) from (
      select g.id, g.name, g.email, g.phone, g.city, g.state, g.verification_status, g.is_active,
             g.plan_state, g.active_plan, g.subscription_status, g.trial_ends_at, g.plan_expires_at, g.created_at,
             (select count(*) from public.hospital_staff s where s.hospital_id = g.id and s.is_active) as staff,
             (select count(*) from public.hospital_doctors hd where hd.hospital_id = g.id and hd.is_active and hd.status = 'active') as doctors,
             (select count(*) from public.hospital_patients hp where hp.hospital_id = g.id) as patients
        from g
       order by g.created_at desc
       limit private.page_limit(p_limit) offset private.page_offset(p_offset)) r), '[]'::jsonb)
  ) into _res;
  return _res;
end;
$$;

create or replace function public.admin_hospital_detail(p_hospital_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  _res jsonb;
begin
  perform private.require_platform_admin();
  select jsonb_build_object(
    'hospital', to_jsonb(h) - 'lat' - 'lng',
    'admins', coalesce((select jsonb_agg(jsonb_build_object(
                 'name', btrim(s.first_name || ' ' || s.last_name), 'email', s.email, 'phone', s.phone, 'role', s.role))
               from public.hospital_staff s where s.hospital_id = h.id and s.role = 'admin' and s.is_active), '[]'::jsonb),
    'counts', jsonb_build_object(
      'staff', (select count(*) from public.hospital_staff s where s.hospital_id = h.id and s.is_active),
      'doctors', (select count(*) from public.hospital_doctors hd where hd.hospital_id = h.id and hd.is_active and hd.status = 'active'),
      'patients', (select count(*) from public.hospital_patients hp where hp.hospital_id = h.id),
      'checkins_30d', (select count(*) from public.patient_checkins c where c.hospital_id = h.id and c.created_at > now() - interval '30 days'),
      'appointments_30d', (select count(*) from public.patient_appointments a where a.hospital_id = h.id and a.created_at > now() - interval '30 days'),
      'consultations_30d', (select count(*) from public.consultations c where c.hospital_id = h.id and c.created_at > now() - interval '30 days')),
    'subscriptions', coalesce((select jsonb_agg(jsonb_build_object(
                 'plan', s.plan, 'status', s.status, 'billing_cycle', s.billing_cycle,
                 'started_at', s.started_at, 'expires_at', s.expires_at) order by s.started_at desc)
               from public.hospital_subscriptions s where s.hospital_id = h.id), '[]'::jsonb),
    'payments', coalesce((select jsonb_agg(x) from (
                 select p.id, p.purpose, p.amount, p.status, p.paystack_reference, p.created_at, p.paid_at,
                        p.metadata->>'review' as review
                   from public.payments p where p.hospital_id = h.id
                  order by p.created_at desc limit 20) x), '[]'::jsonb),
    'audit', coalesce((select jsonb_agg(x) from (
                 select a.action, a.details, a.created_at, u.email as admin_email
                   from public.admin_audit_log a left join auth.users u on u.id = a.admin_user_id
                  where a.target_type = 'hospital' and a.target_id = h.id
                  order by a.created_at desc limit 20) x), '[]'::jsonb)
  ) into _res
  from public.hospitals h where h.id = p_hospital_id;
  if _res is null then
    raise exception 'Hospital not found';
  end if;
  return _res;
end;
$$;

-- Suspend / reactivate. A suspended hospital loses all plan access
-- (private.hospital_has_plan requires is_active) and is hidden from patients.
create or replace function public.admin_set_hospital_active(p_hospital_id uuid, p_active boolean, p_reason text default null)
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
begin
  perform private.require_platform_admin();
  if not p_active and nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'Give a reason when suspending';
  end if;
  update public.hospitals set is_active = p_active where id = p_hospital_id;
  if not found then
    raise exception 'Hospital not found';
  end if;
  perform public.emit_hospital_notification(p_hospital_id, 'system',
    case when p_active then 'Account reactivated' else 'Account suspended' end,
    case when p_active then 'Your HealingNet account is active again.'
         else 'Your HealingNet account has been suspended. Reason: ' || p_reason || '. Contact HealingNet support.' end);
  perform private.admin_log(case when p_active then 'hospital.reactivate' else 'hospital.suspend' end,
                            'hospital', p_hospital_id, jsonb_build_object('reason', p_reason));
end;
$$;

-- Give a hospital extra trial days (only if it has no paid plan running).
create or replace function public.admin_extend_trial(p_hospital_id uuid, p_days int, p_reason text default null)
returns timestamptz
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  _h public.hospitals;
  _new timestamptz;
begin
  perform private.require_platform_admin();
  if p_days is null or p_days < 1 or p_days > 60 then
    raise exception 'Days must be between 1 and 60';
  end if;
  select * into _h from public.hospitals where id = p_hospital_id for update;
  if not found then
    raise exception 'Hospital not found';
  end if;
  if _h.subscription_status = 'active' and _h.plan_expires_at > now() then
    raise exception 'This hospital has a paid plan running';
  end if;
  _new := greatest(now(), coalesce(_h.trial_ends_at, now())) + make_interval(days => p_days);
  update public.hospitals
     set subscription_status = 'trialing', active_plan = 'emr', trial_ends_at = _new
   where id = p_hospital_id;
  update public.hospital_subscriptions
     set expires_at = _new
   where id = (select s.id from public.hospital_subscriptions s
                where s.hospital_id = p_hospital_id and s.status = 'trialing'
                order by s.started_at desc limit 1);
  perform public.emit_hospital_notification(p_hospital_id, 'system', 'Trial extended',
    'Your EMR trial now runs until ' || to_char(_new at time zone 'Africa/Lagos', 'DD Mon YYYY') || '.');
  perform private.admin_log('hospital.extend_trial', 'hospital', p_hospital_id,
                            jsonb_build_object('days', p_days, 'until', _new, 'reason', p_reason));
  return _new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 9. Doctors
-- -----------------------------------------------------------------------------
create or replace function public.admin_list_doctors(
  p_search text default null, p_status text default null, p_limit int default 25, p_offset int default 0)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  _q text := nullif(btrim(coalesce(p_search, '')), '');
  _res jsonb;
begin
  perform private.require_platform_admin();
  with g as (
    select d.* from public.doctors d
     where (_q is null or (d.first_name || ' ' || d.last_name) ilike '%' || _q || '%'
            or d.email ilike '%' || _q || '%' or d.specialty ilike '%' || _q || '%'
            or d.license_number ilike '%' || _q || '%')
       and (p_status is null or d.verification_status = p_status)
  )
  select jsonb_build_object(
    'total', (select count(*) from g),
    'rows', coalesce((select jsonb_agg(r) from (
      select g.id, btrim(g.first_name || ' ' || g.last_name) as name, g.email, g.phone, g.specialty,
             g.years_experience, g.verification_status, g.license_number, g.license_council, g.license_expiry,
             g.verification_submitted_at, g.verification_reviewed_at, g.is_available, g.created_at,
             (select count(*) from public.hospital_doctors hd where hd.doctor_id = g.id and hd.is_active and hd.status = 'active') as hospitals
        from g order by g.created_at desc
       limit private.page_limit(p_limit) offset private.page_offset(p_offset)) r), '[]'::jsonb)
  ) into _res;
  return _res;
end;
$$;

create or replace function public.admin_doctor_detail(p_doctor_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  _res jsonb;
begin
  perform private.require_platform_admin();
  select jsonb_build_object(
    'doctor', to_jsonb(d),
    'hospitals', coalesce((select jsonb_agg(jsonb_build_object('id', h.id, 'name', h.name, 'status', hd.status, 'is_active', hd.is_active))
                 from public.hospital_doctors hd join public.hospitals h on h.id = hd.hospital_id
                where hd.doctor_id = d.id), '[]'::jsonb),
    'counts', jsonb_build_object(
      'consultations_30d', (select count(*) from public.consultations c where c.doctor_id = d.id and c.created_at > now() - interval '30 days'),
      'consult_requests_30d', (select count(*) from public.consultation_requests r where r.doctor_id = d.id and r.created_at > now() - interval '30 days')),
    'audit', coalesce((select jsonb_agg(x) from (
                 select a.action, a.details, a.created_at, u.email as admin_email
                   from public.admin_audit_log a left join auth.users u on u.id = a.admin_user_id
                  where a.target_type = 'doctor' and a.target_id = d.id
                  order by a.created_at desc limit 20) x), '[]'::jsonb)
  ) into _res
  from public.doctors d where d.id = p_doctor_id;
  if _res is null then
    raise exception 'Doctor not found';
  end if;
  return _res;
end;
$$;

-- -----------------------------------------------------------------------------
-- 10. Payments
-- -----------------------------------------------------------------------------
-- p_status: null | pending | success | failed | abandoned
-- p_review: null | 'refund_needed' | 'refund_resolved'
create or replace function public.admin_list_payments(
  p_status text default null, p_purpose text default null, p_review text default null,
  p_search text default null, p_limit int default 25, p_offset int default 0)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  _q text := nullif(btrim(coalesce(p_search, '')), '');
  _res jsonb;
begin
  perform private.require_platform_admin();
  with g as (
    select p.*, h.name as hospital_name
      from public.payments p left join public.hospitals h on h.id = p.hospital_id
     where (p_status is null or p.status = p_status)
       and (p_purpose is null or p.purpose = p_purpose)
       and (p_review is null
            or (p_review = 'refund_needed' and p.metadata->>'review' = 'duplicate_payment_refund_needed')
            or (p_review = 'refund_resolved' and p.metadata->>'review' = 'refund_resolved'))
       and (_q is null or p.paystack_reference ilike '%' || _q || '%' or h.name ilike '%' || _q || '%')
  )
  select jsonb_build_object(
    'total', (select count(*) from g),
    'total_success_kobo', (select coalesce(sum(amount), 0) from g where status = 'success'),
    'rows', coalesce((select jsonb_agg(r) from (
      select g.id, g.hospital_id, g.hospital_name, g.purpose, g.plan, g.billing_cycle, g.amount, g.currency,
             g.status, g.channel, g.paystack_reference, g.created_at, g.paid_at,
             g.metadata->>'review' as review, g.metadata->>'review_note' as review_note,
             case when g.patient_id is not null then 'patient' when g.payee_doctor_id is not null then 'consultation' else 'hospital' end as payer_type
        from g order by g.created_at desc
       limit private.page_limit(p_limit) offset private.page_offset(p_offset)) r), '[]'::jsonb)
  ) into _res;
  return _res;
end;
$$;

-- Mark a duplicate-payment refund as done (after refunding in the Paystack dashboard).
create or replace function public.admin_resolve_refund(p_payment_id uuid, p_note text)
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
begin
  perform private.require_platform_admin();
  if nullif(btrim(coalesce(p_note, '')), '') is null then
    raise exception 'Add a note (e.g. the Paystack refund reference)';
  end if;
  update public.payments
     set metadata = metadata || jsonb_build_object('review', 'refund_resolved', 'review_note', btrim(p_note),
                                                   'resolved_at', now(), 'resolved_by', auth.uid())
   where id = p_payment_id and metadata->>'review' = 'duplicate_payment_refund_needed';
  if not found then
    raise exception 'That payment is not waiting for a refund';
  end if;
  perform private.admin_log('payment.refund_resolved', 'payment', p_payment_id, jsonb_build_object('note', p_note));
end;
$$;

-- -----------------------------------------------------------------------------
-- 11. System health
-- -----------------------------------------------------------------------------
create or replace function public.admin_system_health()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform private.require_platform_admin();
  return jsonb_build_object(
    'generated_at', now(),
    'function_usage_24h', coalesce((select jsonb_object_agg(fn, n) from (
        select fn, count(*) as n from public.function_calls
         where created_at > now() - interval '24 hours' group by fn) x), '{}'::jsonb),
    'payments_pending_over_1h', (select count(*) from public.payments
        where status = 'pending' and created_at < now() - interval '1 hour' and created_at > now() - interval '7 days'),
    'payments_failed_24h', (select count(*) from public.payments
        where status in ('failed', 'abandoned') and created_at > now() - interval '24 hours'),
    'calls_open_over_4h', (select count(*) from public.patient_appointments
        where call_started_at < now() - interval '4 hours' and call_ended_at is null)
      + (select count(*) from public.consultation_requests
        where call_started_at < now() - interval '4 hours' and call_ended_at is null),
    'share_code_failures_24h', (select count(*) from public.function_calls
        where fn = 'link_patient_by_code:fail' and created_at > now() - interval '24 hours'),
    'staff_invites_pending', (select count(*) from public.hospital_staff_invites
        where accepted_at is null and expires_at > now()),
    'doctor_licences_expiring_30d', (select count(*) from public.doctors
        where verification_status = 'approved' and license_expiry between current_date and current_date + 30),
    'doctor_licences_expired', (select count(*) from public.doctors
        where verification_status = 'approved' and license_expiry < current_date),
    'plans_expiring_7d', (select count(*) from public.hospitals
        where subscription_status = 'active' and plan_expires_at between now() and now() + interval '7 days'),
    'database_size_mb', (select round(pg_database_size(current_database()) / 1048576.0, 1))
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 12. Contact messages and audit log
-- -----------------------------------------------------------------------------
create or replace function public.admin_list_contact_messages(p_handled boolean default false, p_limit int default 25, p_offset int default 0)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  _res jsonb;
begin
  perform private.require_platform_admin();
  with g as (
    select * from public.contact_messages c
     where p_handled is null or (p_handled and c.handled_at is not null) or (not p_handled and c.handled_at is null)
  )
  select jsonb_build_object(
    'total', (select count(*) from g),
    'rows', coalesce((select jsonb_agg(r) from (
      select g.id, g.name, g.email, g.subject, g.message, g.created_at, g.handled_at
        from g order by g.created_at desc
       limit private.page_limit(p_limit) offset private.page_offset(p_offset)) r), '[]'::jsonb)
  ) into _res;
  return _res;
end;
$$;

create or replace function public.admin_mark_contact_handled(p_id uuid, p_handled boolean default true)
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
begin
  perform private.require_platform_admin();
  update public.contact_messages
     set handled_at = case when p_handled then now() end,
         handled_by = case when p_handled then auth.uid() end
   where id = p_id;
  if not found then
    raise exception 'Message not found';
  end if;
  perform private.admin_log(case when p_handled then 'contact.handled' else 'contact.reopened' end, 'contact_message', p_id);
end;
$$;

create or replace function public.admin_list_audit(p_limit int default 50, p_offset int default 0)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  _res jsonb;
begin
  perform private.require_platform_admin();
  select jsonb_build_object(
    'total', (select count(*) from public.admin_audit_log),
    'rows', coalesce((select jsonb_agg(r) from (
      select a.id, a.action, a.target_type, a.target_id, a.details, a.created_at, u.email as admin_email,
             case a.target_type
               when 'hospital' then (select h.name from public.hospitals h where h.id = a.target_id)
               when 'doctor' then (select btrim(d.first_name || ' ' || d.last_name) from public.doctors d where d.id = a.target_id)
             end as target_name
        from public.admin_audit_log a left join auth.users u on u.id = a.admin_user_id
       order by a.created_at desc
       limit private.page_limit(p_limit) offset private.page_offset(p_offset)) r), '[]'::jsonb)
  ) into _res;
  return _res;
end;
$$;

-- -----------------------------------------------------------------------------
-- 13. Grants: helpers are internal; admin_* callable by signed-in users
--     (each one checks platform admin itself).
-- -----------------------------------------------------------------------------
revoke all on function private.require_platform_admin() from public, anon, authenticated;
revoke all on function private.admin_log(text, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function private.page_limit(int), private.page_offset(int) from public, anon;
grant execute on function private.page_limit(int), private.page_offset(int) to authenticated;

do $$
declare f text;
begin
  foreach f in array array[
    'public.admin_whoami()',
    'public.admin_overview()',
    'public.admin_timeseries(text, int)',
    'public.admin_verification_queue()',
    'public.admin_review_hospital(uuid, boolean, text)',
    'public.admin_review_doctor(uuid, boolean, text)',
    'public.admin_list_hospitals(text, text, text, int, int)',
    'public.admin_hospital_detail(uuid)',
    'public.admin_set_hospital_active(uuid, boolean, text)',
    'public.admin_extend_trial(uuid, int, text)',
    'public.admin_list_doctors(text, text, int, int)',
    'public.admin_doctor_detail(uuid)',
    'public.admin_list_payments(text, text, text, text, int, int)',
    'public.admin_resolve_refund(uuid, text)',
    'public.admin_system_health()',
    'public.admin_list_contact_messages(boolean, int, int)',
    'public.admin_mark_contact_handled(uuid, boolean)',
    'public.admin_list_audit(int, int)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
