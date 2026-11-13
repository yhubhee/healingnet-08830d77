-- =============================================================================
-- "Seen by the patient" for lab results
--   The patient's first look at a finished result is recorded once, on the
--   server, so "New" is right on every device and the ordering doctor and the
--   hospital can see that the patient has seen it.
-- =============================================================================

alter table public.lab_results add column if not exists patient_viewed_at timestamptz;
-- SELECT is already table-wide (row access by RLS). No INSERT/UPDATE grant on
-- this column: it changes only through mark_lab_result_viewed().

-- Staff can insert lab orders with a table-wide grant, so make sure an order
-- can never start out as "seen".
create or replace function private.lab_viewed_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if not private.is_trusted() then new.patient_viewed_at := null; end if;
  elsif new.patient_viewed_at is distinct from old.patient_viewed_at and not private.is_trusted() then
    new.patient_viewed_at := old.patient_viewed_at;
  end if;
  -- Marking a result as seen is not an edit: keep updated_at as it was.
  -- (Named zz_ so it runs after the updated_at trigger.)
  if tg_op = 'UPDATE' and new.patient_viewed_at is distinct from old.patient_viewed_at
     and (new.status, new.notes, new.clinical_info, new.priority, new.fasting, new.bill_to)
         is not distinct from (old.status, old.notes, old.clinical_info, old.priority, old.fasting, old.bill_to) then
    new.updated_at := old.updated_at;
  end if;
  return new;
end;
$$;
create trigger zz_lab_viewed_guard before insert or update on public.lab_results
  for each row execute function private.lab_viewed_guard();

-- Called by the app and the website when the patient opens a finished result.
-- Only the first view is recorded; later calls change nothing.
create or replace function public.mark_lab_result_viewed(p_lab_result_id uuid)
returns timestamptz
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  _r public.lab_results;
begin
  select * into _r from public.lab_results where id = p_lab_result_id;
  if _r.id is null or auth.uid() is null or not private.is_own_patient(_r.patient_id) then
    raise exception 'Result not found' using errcode = '42501';
  end if;
  if _r.status not in ('completed', 'final') then
    return null;   -- not ready yet: nothing to have seen
  end if;
  if _r.patient_viewed_at is null then
    update public.lab_results set patient_viewed_at = now() where id = _r.id and patient_viewed_at is null
    returning patient_viewed_at into _r.patient_viewed_at;
  end if;
  return _r.patient_viewed_at;
end;
$$;

revoke all on function public.mark_lab_result_viewed(uuid) from public, anon;
grant execute on function public.mark_lab_result_viewed(uuid) to authenticated;
